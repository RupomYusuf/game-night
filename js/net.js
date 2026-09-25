/* Networking: P2P transport over WebRTC DataChannels (PeerJS public broker).
   Drop-in for the old SSE relay — same events on the app bus, so nothing
   above this layer changed. The room lives entirely on the two devices:
   the host's tab is the only "server", and nothing is ever stored.
   Big payloads (photos/videos) ride as chunked messages with progress. */
import { G, emit, loadSession } from './state.js';

/* ---------------- internals ---------------- */

let peer = null;        // my PeerJS handle
let conn = null;        // the live DataConnection to the partner
let incoming = null;    // a pending connection from a joiner (host side)
let graceTimer = null;
let retryTimer = null;
const partials = new Map(); // media chunk reassembly: id -> { meta, chunks }

const PEER_OPTS = { debug: 0 };
const GRACE_MS = 60_000;
const CHUNK = 60_000; // ~60KB of base64 per message

const peerIdFor = (code) => 'gnh-' + String(code).toLowerCase().replace(/[^a-z0-9]/g, '');
const CODE_WORDS = ['LOVE','KISS','MOON','STAR','HONEY','BLISS','ROSE','FLAME','DUSK',
  'DREAM','SWEET','CORAL','PEACH','EMBER','HEART','MANGO','LUNAR','SUGAR','CANDLE','VIOLA'];
const genCode = () =>
  CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] + '-' + (10 + Math.floor(Math.random() * 90));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function route(t, p) {
  if (t === 'chat-begin' || t === 'chat-chunk' || t === 'chat-end') { onMediaChunk(t, p); return; }
  emit(t, p || {});
}

/* guest-side: the partner link is live */
function wireConn(c) {
  conn = c;
  incoming = null;
  clearGrace();
  G.online = true;
  emit('online', {});
  c.on('data', (msg) => { if (msg && msg.t) route(msg.t, msg.p); });
  c.on('close', () => { if (conn === c) onConnLost(); });
  c.on('error', () => { if (conn === c) onConnLost(); });
}

/* host-side: a joiner connected */
function wireIncoming(c) {
  incoming = c;
  c.on('data', (msg) => {
    if (!msg || !msg.t) return;
    if (msg.t === 'join-req') { incoming = c; emit('incoming-join', { info: msg.p || {} }); return; }
    if (conn === c) route(msg.t, msg.p);
  });
  c.on('close', () => { if (conn === c) onConnLost(); });
  c.on('error', () => { if (conn === c) onConnLost(); });
}

function onConnLost() {
  if (!conn) return;
  conn = null;
  G.online = false;
  emit('offline', {});
  const graceEndsAt = Date.now() + GRACE_MS;
  G.peer.connected = false;
  G.peer.graceEndsAt = graceEndsAt;
  emit('presence', { connected: false, graceEndsAt, name: G.peer.name });
  armGrace();
  if (G.me?.role === 'guest') scheduleRetry(); // the host's peer is still alive — it just waits
}

function armGrace() {
  clearGrace();
  graceTimer = setTimeout(() => {
    if (conn) return;
    destroyPeer();
    emit('end', { reason: 'grace' });
  }, GRACE_MS);
}
function clearGrace() {
  if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
}

/* the guest keeps trying to rejoin while the grace window is open */
function scheduleRetry() {
  if (retryTimer || !G.me) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    if (conn || !G.me) return;
    try { await rejoin(); } catch { scheduleRetry(); }
  }, 2200);
}

function destroyPeer() {
  try { conn && conn.close(); } catch { /* */ }
  try { peer && peer.destroy(); } catch { /* */ }
  conn = null; peer = null; incoming = null; G.online = false;
}

/* ---------------- host: own the room ---------------- */

async function hostCreate({ name, emoji, code }) {
  const reclaim = !!code;
  const attempts = reclaim ? 40 : 12;
  const delay = reclaim ? 700 : 60;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const c = code || genCode();
    const ok = await new Promise((resolve) => {
      let settled = false;
      const p = new Peer(peerIdFor(c), PEER_OPTS);
      p.on('open', () => { if (!settled) { settled = true; peer = p; wireHost(p); resolve(true); } });
      p.on('error', (e) => {
        if (settled) return;
        settled = true; try { p.destroy(); } catch { /* */ }
        resolve(String(e && e.type) === 'unavailable-id');
      });
    });
    if (ok) return { code: c };
    if (!reclaim) await wait(delay);
    else await wait(delay);
  }
  throw new Error(reclaim
    ? 'Could not reclaim your night — it may have been open elsewhere. Start a new one?'
    : 'Could not open a night — try again.');
}

function wireHost(p) {
  p.on('connection', (c) => wireIncoming(c));
}

/* ---------------- guest: join by code ---------------- */

function guestJoin({ code, name, emoji, token }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    try { peer && peer.destroy(); } catch { /* */ }
    const fail = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { peer && peer.destroy(); } catch { /* */ }
      peer = null;
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error('The host is not answering — check the code or try again. 🌙')), 14000);

    const p = new Peer(PEER_OPTS);
    peer = p;
    p.on('error', (e) => {
      if (settled) return;
      const type = String(e && e.type);
      if (type === 'peer-unavailable') fail(new Error('No night found with that code. Double-check it?'));
      else fail(new Error('Connection trouble — try again. (' + type + ')'));
    });
    p.on('open', () => {
      const c = p.connect(peerIdFor(code), { reliable: true });
      c.on('open', () => {
        c.send({ t: 'join-req', p: { name, emoji, token, code } });
      });
      c.on('data', (msg) => {
        if (!msg || !msg.t) return;
        if (msg.t === 'join-accept') {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          wireConn(c);
          resolve(msg.p);
        } else if (msg.t === 'join-reject') {
          fail(new Error((msg.p && msg.p.error) || 'Could not join that night.'));
        }
      });
      c.on('close', () => { if (!settled) fail(new Error('The host closed the connection. 🌙')); });
    });
  });
}

/* ---------------- public API (same shapes as the SSE relay) ---------------- */

export async function api(path, body = {}) {
  if (path === '/api/create') {
    const out = await hostCreate(body);
    return { code: out.code, clientId: 'host', token: 'host-' + out.code, role: 'host' };
  }
  if (path === '/api/join') {
    const saved = loadSession();
    if (saved && saved.role === 'host' && saved.code === String(body.code || '').toUpperCase()) {
      // the host is re-opening their own night — reclaim the deterministic ID
      const out = await hostCreate({ name: body.name, emoji: body.emoji, code: saved.code });
      const savedGame = readSavedGame();
      return {
        code: out.code, clientId: 'host', token: saved.token, role: 'host',
        peer: null, chat: [], scores: {}, unlocked: false,
        activeGame: savedGame?.activeGame || null, gameState: savedGame?.state || null,
      };
    }
    const payload = await guestJoin({ code: body.code, name: body.name, emoji: body.emoji, token: body.token });
    return {
      code: String(body.code).toUpperCase(), clientId: 'guest',
      token: body.token || 'guest-' + Math.random().toString(36).slice(2), role: 'guest',
      ...payload,
    };
  }
  if (path === '/api/leave') {
    send('end', { reason: 'left', by: G.me?.name });
    setTimeout(() => destroyPeer(), 200);
    return { ok: true };
  }
  throw new Error('unsupported');
}

function readSavedGame() {
  try { return JSON.parse(sessionStorage.getItem('gn.game') || 'null'); } catch { return null; }
}

/** Host accepts a pending joiner. app.js supplies the sync payload. */
export function acceptJoin(payload) {
  if (!incoming) return;
  conn = incoming;
  incoming = null;
  clearGrace();
  G.online = true;
  try { conn.send({ t: 'join-accept', p: payload }); } catch { /* */ }
}
export function rejectJoin(error) {
  const c = incoming;
  incoming = null;
  try { c && c.send({ t: 'join-reject', p: { error } }); } catch { /* */ }
  setTimeout(() => { try { c && c.close(); } catch { /* */ } }, 150);
}

export function send(t, p) {
  if (!conn) return Promise.resolve();
  try { conn.send({ t, p }); } catch { /* */ }
  return Promise.resolve();
}

/** Large payloads (photos / videos) ride as chunked messages with progress. */
export function sendLarge(t, p, onProgress) {
  if (!conn) return Promise.reject(new Error('Not connected'));
  const data = p.dataURL || '';
  const parts = Math.max(1, Math.ceil(data.length / CHUNK));
  conn.send({ t: 'chat-begin', p: { id: p.id, parts, meta: { ...p, dataURL: undefined } } });
  return (async () => {
    for (let i = 0; i < parts; i++) {
      conn.send({ t: 'chat-chunk', p: { id: p.id, i, c: data.slice(i * CHUNK, (i + 1) * CHUNK) } });
      if (onProgress) onProgress((i + 1) / parts);
      if (i % 5 === 4) await wait(0); // let the queue breathe
    }
    conn.send({ t: 'chat-end', p: { id: p.id } });
  })();
}

function onMediaChunk(t, p) {
  if (t === 'chat-begin') { partials.set(p.id, { meta: p.meta, chunks: new Array(p.parts) }); return; }
  if (t === 'chat-chunk') {
    const rec = partials.get(p.id);
    if (rec) rec.chunks[p.i] = p.c;
    return;
  }
  if (t === 'chat-end') {
    const rec = partials.get(p.id);
    if (!rec) return;
    partials.delete(p.id);
    route('chat', { ...rec.meta, dataURL: rec.chunks.join('') || null });
  }
}

/** Kept for symmetry — the P2P link is managed inline by create/join. */
export function connect() { /* no-op */ }
export function disconnectStream() { destroyPeer(); }

export async function rejoin() {
  const auth = loadSession();
  if (!auth) throw new Error('no session');
  const info = await api('/api/join', { code: auth.code, token: auth.token, name: auth.name, emoji: auth.emoji });
  G.me = { ...auth, ...info, name: auth.name, emoji: auth.emoji };
  emit('resynced', info);
}

/* ---------------- bootstrap ---------------- */

if (typeof window !== 'undefined' && typeof Peer === 'undefined') {
  console.warn('PeerJS failed to load — realtime will not work. Check your connection to the CDN.');
}
