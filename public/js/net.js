/* Networking: REST + SSE. Maintains the stream, resyncs after drops,
   and routes every server event onto the app event bus. */
import { G, emit, loadSession } from './state.js';

let es = null;
let resyncing = false;

export async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong'); e.status = res.status; throw e; }
  return data;
}

/** Fire-and-forget relay to the partner. Large payloads (video) get progress via sendLarge(). */
export function send(t, p) {
  if (!G.me) return Promise.resolve();
  return api('/api/relay', { token: G.me.token, t, p }).catch((e) => {
    if (e.status === 401) emit('session-dead', {});
    // 404/network blips are fine — the resync loop heals them.
  });
}

/** POST with upload progress (used for media). */
export function sendLarge(t, p, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/relay');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Send failed')));
    xhr.onerror = () => reject(new Error('Send failed'));
    xhr.send(JSON.stringify({ token: G.me.token, t, p }));
  });
}

export function connect() {
  if (es) es.close();
  es = new EventSource(`/api/stream?token=${encodeURIComponent(G.me.token)}`);
  es.onmessage = (e) => {
    try {
      const { t, p, ts } = JSON.parse(e.data);
      if (ts) G.skew = ts - Date.now();
      if (t === 'hello') { G.online = true; emit('online', {}); }
      else emit(t, p || {});
    } catch (err) { console.error('bad event', err); }
  };
  es.onerror = () => {
    es.close(); es = null;
    if (G.online) { G.online = false; emit('offline', {}); }
    scheduleResync();
  };
}

let resyncTimer = null;
function scheduleResync() {
  if (resyncTimer || !G.me) return;
  resyncTimer = setTimeout(async () => {
    resyncTimer = null;
    if (!G.me || es) return;
    try { await rejoin(); } catch { scheduleResync(); }
  }, 1600);
}

/** Re-join with the stored token: restores chat tail, game state, presence — then reopens the stream. */
export async function rejoin() {
  if (resyncing) return;
  const auth = loadSession();
  if (!auth) throw new Error('no session');
  resyncing = true;
  try {
    const info = await api('/api/join', { code: auth.code, token: auth.token, name: auth.name, emoji: auth.emoji });
    G.me = { ...auth, ...info, name: auth.name, emoji: auth.emoji };
    emit('resynced', info);
    connect();
  } finally { resyncing = false; }
}

export function disconnectStream() {
  if (es) { es.close(); es = null; }
  G.online = false;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && G.me && !es) scheduleResync();
});
window.addEventListener('online', () => { if (G.me && !es) scheduleResync(); });
