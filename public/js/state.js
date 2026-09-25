/* Shared session state + tiny event bus. Everything here dies with the tab. */

export const G = {
  me: null,          // {code, clientId, token, role: 'host'|'guest', name, emoji}
  peer: { name: '', emoji: '💖', connected: false, graceEndsAt: null },
  chat: [],          // [{id, from, mine, kind, text, dataURL, mime, ts, status, reactions}]
  unread: 0,
  peerTyping: false,
  activeGame: null,  // {id, variant} | null
  scores: {},        // {gameId: {host, guest}}
  unlocked18: false,
  skew: 0,           // serverNow - clientNow, from latest snapshot/event
  online: false,
  joinedOnce: false,
};

export const settings = Object.assign(
  { sound: true, haptics: true, theme: 'dark' },
  JSON.parse(sessionStorage.getItem('gn.settings') || '{}')
);

export function saveSettings() {
  sessionStorage.setItem('gn.settings', JSON.stringify(settings));
  document.documentElement.dataset.theme = settings.theme;
}
saveSettings();

const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
export function emit(evt, data) {
  (listeners.get(evt) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
}

/* session identity — sessionStorage so closing the tab truly ends the night */
export function loadSession() {
  try { return JSON.parse(sessionStorage.getItem('gn.auth') || 'null'); } catch { return null; }
}
export function saveSession(auth) { sessionStorage.setItem('gn.auth', JSON.stringify(auth)); }
export function clearSession() { sessionStorage.removeItem('gn.auth'); }

export function serverNow() { return Date.now() + G.skew; }
