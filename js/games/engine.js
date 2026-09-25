/* Game engine — the sync core.
   Model: every game is a deterministic reducer over shared state.
   - Room creator ("host") is the state owner: after every action they
     broadcast an authoritative snapshot. The server remembers the latest
     snapshot so a refreshed tab rejoins mid-game.
   - Both screens apply each action optimistically (identical reducer),
     so taps feel instant; the snapshot then corrects any drift.
   - Actions that need randomness are filled host-side (mod.fill) and are
     never applied optimistically on the guest (mod.canOptimistic=false). */
import { G, emit, serverNow } from '../state.js';
import { send } from '../net.js';
import { h, confettiBurst } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const modules = new Map();
export function registerGame(m) { modules.set(m.id, m); }
export function allGames() { return [...modules.values()]; }
export function getGame(id) { return modules.get(id); }

let cur = null;          // { mod, id, variant, state, root, ctx, tickTimer }
export function active() { return cur; }
export function isHost() { return G.me.role === 'host'; }

/* Host-clock estimate (for cross-device timing, e.g. Word Rush speed points). */
let hClock = { at: Date.now(), now: Date.now() };
export function hostNow() { return hClock.now + (Date.now() - hClock.at); }

export function openGame(id, variant = null) {
  send('game-open', { id, variant });
  startGame(id, variant);
}

export function closeGame() {
  stopTicking();
  cur = null;
  G.activeGame = null;
  send('game-close', {});
  emit('game-closed', {});
}

/* ---- lifecycle ---- */

function startGame(id, variant, adoptState = null) {
  const mod = getGame(id);
  if (!mod) return;
  stopTicking();
  G.activeGame = { id, variant };
  cur = { mod, id, variant, state: null, root: null, adoptState: adoptState || null, ctx: { myRole: G.me.role, variant } };
  emit('game-started', { id, variant });           // app builds the game view synchronously
  cur.root = document.getElementById('game-stage'); // now it exists
  sfx.whoosh();
  // Adopt a stored snapshot (refresh/reconnect resume) instead of starting fresh —
  // one broadcast of the authoritative state, no reset race.
  if (cur.adoptState) {
    cur.state = cur.adoptState;
    cur.adoptState = null;
    render();
    if (isHost()) broadcast();
  } else if (isHost()) {
    cur.state = mod.init(cur.ctx);
    render();
    broadcast();
  } else if (cur.root) {
    cur.root.innerHTML = '';
    cur.root.append(h('div', { class: 'g-center' },
      h('div', { style: 'font-size:44px' }, mod.icon),
      h('div', { class: 'g-sub' }, 'Syncing with your partner…')));
  }
  if (mod.tick) startTicking();
}

function stopTicking() { if (cur?.tickTimer) { clearInterval(cur.tickTimer); cur.tickTimer = null; } }
function startTicking() {
  cur.tickTimer = setInterval(() => {
    if (!cur || !isHost()) return;
    const before = cur.state;
    const next = cur.mod.tick ? cur.mod.tick(cur.state, { act, now: serverNow() }) : null;
    if (next && next !== before) { cur.state = next; render(); broadcast(); }
  }, 400);
}

/* ---- actions ---- */

/** Local player acts. */
export function act(a) {
  if (!cur) return;
  a.by = G.me.role;
  const { mod } = cur;
  const optimistic = isHost() || !mod.fill || mod.canOptimistic?.(a) !== false;
  if (optimistic) {
    try {
      if (isHost() && mod.fill) mod.fill(a);
      cur.state = mod.reduce(cur.state, { ...a }, cur.ctx);
      render();
    } catch (e) { console.error('optimistic apply failed', e); }
  }
  send('game-act', { a });
  if (isHost()) broadcast();
  if (!isHost()) sfx.tap();
}

/** Host re-applies with fill() and broadcasts (used by timers). */
function hostAct(a) { act(a); }

/* ---- remote events ---- */

export function onRemoteAction({ a }) {
  if (!cur || !a) return;
  const { mod } = cur;
  try {
    if (isHost() && mod.fill && a.by !== 'host') mod.fill(a);
    cur.state = mod.reduce(cur.state, { ...a }, cur.ctx);
    render();
  } catch (e) { console.error('remote apply failed', e); }
  if (isHost()) broadcast(); // authoritative correction + any randomness
  else sfx.tap();
}

export function onSnapshot(p) {
  if (!cur || !p || !p.s) return;
  if (p.hnow) { G.skew = p.hnow - Date.now(); hClock = { at: Date.now(), now: p.hnow }; }
  cur.state = p.s;
  render();
}

function broadcast() {
  if (!cur) return;
  hClock = { at: Date.now(), now: Date.now() };
  send('game-state', { s: cur.state, hnow: Date.now() });
}

/* ---- render + scorecard + celebrations ---- */

function render() {
  if (!cur) return;
  const stage = document.getElementById('game-stage');
  if (!stage) return;
  cur.root = stage;
  const { mod, state, ctx } = cur;
  const prevWinner = cur.lastWinner;
  stage.innerHTML = '';
  mod.view(stage, state, ctx, api());
  // scorecard extraction for the lobby menu
  if (mod.score && isHost()) {
    const sc = mod.score(state);
    if (sc && JSON.stringify(sc) !== JSON.stringify(G.scores[mod.id])) {
      G.scores[mod.id] = sc;
      send('score', { game: mod.id, s: sc });
      emit('scores-changed', {});
    }
  }
  // celebration when a winner/phase appears
  const winner = state?.winner;
  if (winner && winner !== prevWinner) {
    cur.lastWinner = winner;
    if (winner === 'tie') { sfx.match(); }
    else if (winner === ctx.myRole) { confettiBurst(); sfx.win(); haptic(buzz.win); }
    else { sfx.lose(); }
  } else if (!winner) cur.lastWinner = null;
}

export function api() {
  return {
    act,
    myRole: G.me.role,
    isHost: isHost(),
    peerName: G.peer.name || 'Your partner',
    myName: G.me.name,
    h: h,
    now: serverNow,
    hostNow,
  };
}

/* Reconnection / refresh: adopt the server's stored snapshot so the game
   resumes exactly where it was — for BOTH roles. */
export function resumeGame(activeGame, gameState) {
  if (!activeGame) return;
  const freshStart = !cur || cur.id !== activeGame.id || cur.variant !== activeGame.variant;
  if (freshStart) {
    cur = null;
    startGame(activeGame.id, activeGame.variant, gameState || null);
  } else if (gameState) {
    cur.state = gameState;
    render();
    if (isHost()) broadcast(); // re-anchor the peer to the restored state
  }
  if (cur && cur.state == null && cur.root) {
    cur.root.innerHTML = '';
    cur.root.append(h('div', { class: 'g-center' },
      h('div', { style: 'font-size:44px' }, cur.mod.icon),
      h('div', { class: 'g-sub' }, 'Syncing with your partner…')));
  }
}

/* Re-render into the current stage without touching state. */
export function rerender() { if (cur && cur.state != null) render(); }
