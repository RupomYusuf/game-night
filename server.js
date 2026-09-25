#!/usr/bin/env node
/* ============================================================
   Game Night — session-only relay server.
   Zero dependencies. Node >= 18.
   Rooms live in memory only. When the night ends, everything
   (chat, media, scores, state) is deleted. No database, ever.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, 'public');
const GRACE_MS = 60_000;        // reconnect grace window
const FIRST_CONNECT_MS = 3 * 60_000; // window for the host to actually open the page
const CHAT_MAX = 250;           // messages buffered for the session (reconnect restore)
const MEDIA_BYTES_MAX = 45 * 1024 * 1024; // in-memory media budget per room
const BODY_LIMIT = 30 * 1024 * 1024;     // video clips ride through here
const ROOM_MAX = 500;

const CODE_WORDS = ['LOVE','KISS','MOON','STAR','HONEY','BLISS','ROSE','FLAME','DUSK',
  'DREAM','SWEET','CORAL','PEACH','EMBER','HEART','MANGO','LUNAR','SUGAR','CANDLE','VIOLA'];

const rooms = new Map(); // code -> room

/* ---------------- helpers ---------------- */

const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => Date.now();

function makeCode() {
  for (let i = 0; i < 50; i++) {
    const code = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] + '-' +
      (10 + Math.floor(Math.random() * 90));
    if (!rooms.has(code)) return code;
  }
  return 'NIGHT-' + Math.floor(1000 + Math.random() * 9000);
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > BODY_LIMIT) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('Bad JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

/* ---------------- rooms ---------------- */

function member(name, emoji) {
  return { id: uid(), token: uid(), name, emoji, conn: false, es: null, graceTimer: null };
}

function createRoom(name, emoji) {
  if (rooms.size >= ROOM_MAX) sweepRooms(true);
  const code = makeCode();
  const room = {
    code, createdAt: now(), chat: [], chatBytes: 0,
    activeGame: null, gameState: null, scores: {}, unlocked: false,
    members: { host: member(name, emoji), guest: null },
  };
  rooms.set(code, room);
  armGrace(room, room.members.host, FIRST_CONNECT_MS); // host must open the page
  return room;
}

function findRoomAndMember(token) {
  if (!token) return {};
  for (const room of rooms.values()) {
    for (const role of ['host', 'guest']) {
      const m = room.members[role];
      if (m && m.token === token) return { room, role, m };
    }
  }
  return {};
}

function peerOf(room, role) {
  return room.members[role === 'host' ? 'guest' : 'host'];
}

function sendTo(m, t, p) {
  if (m && m.es) {
    try { m.es.write(`data: ${JSON.stringify({ t, p, ts: now() })}\n\n`); } catch { /* ignore */ }
  }
}

function armGrace(room, m, ms = GRACE_MS) {
  if (m.graceTimer) clearTimeout(m.graceTimer);
  m.graceEndsAt = now() + ms;
  m.graceTimer = setTimeout(() => {
    if (m.conn || !rooms.has(room.code)) return;
    const other = room.members.host === m ? room.members.guest : room.members.host;
    // If the other partner is still connected, end the night for them; otherwise quietly delete.
    if (other && other.conn) endRoom(room, 'grace');
    else rooms.delete(room.code);
  }, ms);
}

function endRoom(room, reason) {
  for (const role of ['host', 'guest']) {
    const m = room.members[role];
    if (!m) continue;
    if (m.graceTimer) clearTimeout(m.graceTimer);
    sendTo(m, 'end', { reason });
  }
  rooms.delete(room.code);
}

function sweepRooms(force) {
  const t = now();
  for (const [code, room] of rooms) {
    const host = room.members.host, guest = room.members.guest;
    const anyConn = (host && host.conn) || (guest && guest.conn);
    const age = t - room.createdAt;
    if (force && rooms.size > ROOM_MAX && !anyConn && age > 10 * 60_000) rooms.delete(code);
    else if (!anyConn && age > 6 * 3600_000) rooms.delete(code);
  }
}
setInterval(sweepRooms, 5 * 60_000).unref();

function pushChat(room, entry) {
  const bytes = entry.data ? entry.data.length : 0;
  room.chat.push(entry);
  room.chatBytes += bytes;
  while (room.chat.length > CHAT_MAX) {
    const old = room.chat.shift();
    room.chatBytes -= old.data ? old.data.length : 0;
  }
  // Evict oldest media payloads if we blow the memory budget (keep the caption note).
  while (room.chatBytes > MEDIA_BYTES_MAX) {
    const idx = room.chat.findIndex((c) => c.data);
    if (idx === -1) break;
    room.chatBytes -= room.chat[idx].data.length;
    room.chat[idx] = { ...room.chat[idx], data: null, expired: true };
  }
}

/* ---------------- HTTP ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(PUBLIC_DIR, path.normalize(p).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, b2) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        res.end(b2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  try {
    /* ---- create ---- */
    if (p === '/api/create' && req.method === 'POST') {
      const b = await readBody(req);
      const room = createRoom(String(b.name || 'Me').slice(0, 24), String(b.emoji || '💖').slice(0, 8));
      const host = room.members.host;
      return json(res, 200, { code: room.code, clientId: host.id, token: host.token, role: 'host' });
    }

    /* ---- join / rejoin ---- */
    if (p === '/api/join' && req.method === 'POST') {
      const b = await readBody(req);
      const code = String(b.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return json(res, 404, { error: "No night found with that code. Double-check it?" });

      let role = null, m = null;
      if (b.token) {
        for (const r of ['host', 'guest']) {
          if (room.members[r] && room.members[r].token === b.token) { role = r; m = room.members[r]; }
        }
      }
      if (!m) {
        if (room.members.guest) return json(res, 409, { error: 'This night already has two players — it is a private table for two. 💞' });
        role = 'guest';
        m = room.members.guest = member(String(b.name || 'Me').slice(0, 24), String(b.emoji || '💖').slice(0, 8));
      }
      if (b.name) m.name = String(b.name).slice(0, 24);
      if (b.emoji) m.emoji = String(b.emoji).slice(0, 8);

      const peer = peerOf(room, role);
      return json(res, 200, {
        code: room.code, role, clientId: m.id, token: m.token,
        peer: peer ? { name: peer.name, emoji: peer.emoji, connected: peer.conn, graceEndsAt: peer.conn ? null : peer.graceEndsAt || null } : null,
        chat: room.chat, scores: room.scores, unlocked: room.unlocked,
        activeGame: room.activeGame, gameState: room.gameState,
      });
    }

    /* ---- relay ---- */
    if (p === '/api/relay' && req.method === 'POST') {
      const b = await readBody(req);
      const { room, role, m } = findRoomAndMember(b.token);
      if (!m) return json(res, 401, { error: 'Session ended.' });
      const peer = peerOf(room, role);
      const t = String(b.t || '');

      switch (t) {
        case 'chat': {
          const entry = {
            id: String(b.p.id || uid()), from: role, kind: b.p.kind === 'media' ? 'media' : 'text',
            text: b.p.text ? String(b.p.text).slice(0, 4000) : undefined,
            mime: b.p.mime, data: b.p.dataURL, name: b.p.name,
            ts: now(), reactions: {},
          };
          pushChat(room, entry);
          sendTo(peer, 'chat', entry);
          break;
        }
        case 'seen': case 'typing': case 'react': case 'game-act':
          sendTo(peer, t, b.p);
          break;
        case 'game-open':
          room.activeGame = { id: String(b.p.id).slice(0, 40), variant: b.p.variant || null };
          room.gameState = null;
          sendTo(peer, 'game-open', room.activeGame);
          break;
        case 'game-close':
          room.activeGame = null; room.gameState = null;
          sendTo(peer, 'game-close', {});
          break;
        case 'game-state':
          room.gameState = b.p && b.p.s ? b.p.s : null;
          sendTo(peer, 'game-state', { s: room.gameState, hnow: now() });
          break;
        case 'score':
          if (b.p && b.p.game) { room.scores[String(b.p.game).slice(0, 40)] = b.p.s; sendTo(peer, 'score', { game: b.p.game, s: b.p.s }); }
          break;
        case 'unlock':
          room.unlocked = !!b.p.on;
          sendTo(peer, 'unlock', { on: room.unlocked, by: m.name });
          break;
        default:
          sendTo(peer, t, b.p);
      }
      return json(res, 200, { ok: true });
    }

    /* ---- leave ---- */
    if (p === '/api/leave' && req.method === 'POST') {
      const b = await readBody(req);
      const { room, m } = findRoomAndMember(b.token);
      if (room) {
        const name = m.name;
        rooms.delete(room.code);
        for (const role of ['host', 'guest']) {
          const other = room.members[role];
          if (other && other !== m) sendTo(other, 'end', { reason: 'left', by: name });
        }
      }
      return json(res, 200, { ok: true });
    }

    /* ---- SSE stream ---- */
    if (p === '/api/stream' && req.method === 'GET') {
      const { room, m } = findRoomAndMember(url.searchParams.get('token'));
      if (!m) { res.writeHead(401); res.end(); return; }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      m.es = res; m.conn = true; m.graceEndsAt = null;
      if (m.graceTimer) { clearTimeout(m.graceTimer); m.graceTimer = null; }
      res.write(`data: ${JSON.stringify({ t: 'hello', p: { ts: now() } })}\n\n`);

      const role = m === room.members.host ? 'host' : 'guest';
      const peer = peerOf(room, role);
      sendTo(peer, 'presence', { connected: true, name: m.name });

      const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch { /* */ } }, 15000);
      req.on('close', () => {
        clearInterval(hb);
        m.es = null; m.conn = false;
        if (!rooms.has(room.code)) return;
        const stillHost = room.members.host === m;
        const other = room.members[stillHost ? 'guest' : 'host'];
        armGrace(room, m, GRACE_MS);
        sendTo(other, 'presence', { connected: false, graceEndsAt: m.graceEndsAt, name: m.name });
      });
      return;
    }

    if (p.startsWith('/api/')) { res.writeHead(404); res.end(); return; }
    serveStatic(req, res, p);
  } catch (err) {
    json(res, err.status || 500, { error: err.status ? err.message : 'Server hiccup — try again.' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🌙  Game Night is lit.');
  console.log(`      Open  http://localhost:${PORT}  in two tabs to start.`);
  console.log('      Everything lives in memory — close it and it is gone.');
  console.log('');
});
