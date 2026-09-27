/* Tetris Race — two boards, one shared piece sequence (seeded by the host),
   3:00 on the clock, highest score wins. Each player watches the other's
   stack grow live: every locked piece syncs a compact grid snapshot.
   The real game runs locally per device; the engine only carries progress,
   so gravity speed never depends on the network. */
import { registerGame, hostNow, active, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';
import { send } from '../net.js';
import { on } from '../state.js';

const ROUND_MS = 180_000, COUNTDOWN_MS = 3200;
const COLS = 10, ROWS = 20, CELL = 20;
const COLORS = [null, '#4fd8ff', '#ffe066', '#b06bff', '#8bff9a', '#ff5f6d', '#6ba8ff', '#ff9950'];
/* piece cells per rotation — index 1..7 = I O T S Z J L */
const PIECES = {
  1: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]]],
  2: [[[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]]],
  3: [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]],
  4: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]]],
  5: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]]],
  6: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]],
  7: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]],
};

/* mulberry32 — every bag is seeded from (seed ^ bagIndex), so spawn number k
   is the same piece on both devices no matter how differently each player
   uses hold — that keeps the race fair. */
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let bagCache = { n: -1, pieces: [] };
function seqPiece(i) {
  const n = Math.floor(i / 7), pos = i % 7;
  if (bagCache.n !== n) {
    const rng = mulberry((localSeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0);
    const b = [1, 2, 3, 4, 5, 6, 7];
    for (let k = b.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [b[k], b[j]] = [b[j], b[k]];
    }
    bagCache = { n, pieces: b };
  }
  return bagCache.pieces[pos];
}

/* ---------------- local game (this device only) ---------------- */
let me = null;            // { grid, cur:{t,rot,x,y}, next, hold, canHold, score, lines, level, over, seqIdx, acc, last }
let localSeed = null;     // seed the local board was built from
let myRole = 'host';
let raf = 0, loopOn = false, finalsDrawn = false;
let lastSent = 0, sendTimer = 0;
const els = {};           // persistent DOM: canvases + info nodes survive engine re-renders

function blank() { return { score: 0, lines: 0, level: 1, grid: '', over: false }; }
function speed(level) { return Math.max(70, 850 - (level - 1) * 70); }

function startLocal(s) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  me = { grid, cur: null, next: [], hold: 0, canHold: true, score: 0, lines: 0, level: 1, over: false, seqIdx: 0, acc: 0, last: 0 };
  localSeed = s.seed;
  bagCache = { n: -1, pieces: [] };
  peerLive = { round: -1, cur: null, grid: '', over: false };
  finalsDrawn = false;
  spawn();
  startLoop();
  drawPeerBoard(s);
}

function spawn() {
  const t = seqPiece(me.seqIdx++);
  me.cur = { t, rot: 0, x: 3, y: 0 };
  me.next = [0, 1, 2].map((j) => seqPiece(me.seqIdx + j));
  if (collides(me.cur.t, me.cur.rot, me.cur.x, me.cur.y)) topOut();
}

function collides(t, rot, x, y) {
  for (const [cx, cy] of PIECES[t][rot]) {
    const gx = x + cx, gy = y + cy;
    if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
    if (gy >= 0 && me.grid[gy][gx]) return true;
  }
  return false;
}

const canMove = (dx, dy) => me.cur && !collides(me.cur.t, me.cur.rot, me.cur.x + dx, me.cur.y + dy);

function move(dx) {
  if (!playable()) return;
  if (canMove(dx, 0)) { me.cur.x += dx; sendLive(); }
}

function rotate(dir) {
  if (!playable()) return;
  const rot = (me.cur.rot + dir + 4) % 4;
  for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
    if (!collides(me.cur.t, rot, me.cur.x + kx, me.cur.y + ky)) {
      me.cur.rot = rot; me.cur.x += kx; me.cur.y += ky;
      sendLive();
      return;
    }
  }
}

function softDrop() {
  if (!playable()) return;
  if (canMove(0, 1)) { me.cur.y++; me.score++; sendLive(); }
  else lockNow();
}

function hardDrop() {
  if (!playable()) return;
  let n = 0;
  while (canMove(0, 1)) { me.cur.y++; n++; }
  me.score += n * 2;
  lockNow();
  haptic(buzz.tap);
}

function holdPiece() {
  if (!playable() || !me.canHold) return;
  const t = me.cur.t;
  // first hold pulls the next piece from the shared sequence; later holds just swap
  me.cur = { t: me.hold || seqPiece(me.seqIdx++), rot: 0, x: 3, y: 0 };
  me.next = [0, 1, 2].map((j) => seqPiece(me.seqIdx + j));
  me.hold = t;
  me.canHold = false;
  sendLive();
  if (collides(me.cur.t, 0, me.cur.x, me.cur.y)) topOut();
}

function playable() {
  return me && !me.over && me.cur && started();
}

function started() {
  const cur = active();
  if (!cur || cur.id !== 'tetris') return false;
  const s = cur.state;
  return s.phase === 'play' || (s.phase === 'countdown' && hostNow() >= s.startsAt);
}

function lockNow() {
  for (const [cx, cy] of PIECES[me.cur.t][me.cur.rot]) {
    const gx = me.cur.x + cx, gy = me.cur.y + cy;
    if (gy >= 0) me.grid[gy][gx] = me.cur.t;
  }
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (me.grid[r].every(Boolean)) {
      me.grid.splice(r, 1);
      me.grid.unshift(Array(COLS).fill(0));
      cleared++; r++;
    }
  }
  if (cleared) {
    me.score += [0, 100, 300, 500, 800][cleared] * me.level;
    me.lines += cleared;
    me.level = 1 + Math.floor(me.lines / 8);
    cleared === 4 ? (sfx.win(), haptic(buzz.win)) : sfx.match();
  } else {
    sfx.pop();
  }
  me.canHold = true;
  spawn();
  sendProgress();
  sendLive(true);
}

function topOut() {
  if (me.over) return;
  me.over = true;
  me.cur = null;
  sfx.miss(); haptic(buzz.recv);
  sendProgress(true);
  sendLive(true);
}

/* my score/grid → shared state, so the partner board stays live */
function sendProgress(force) {
  const go = () => {
    if (!me) return;
    lastSent = Date.now();
    const cur = active();
    if (cur && cur.id === 'tetris') {
      act({
        type: 'progress', score: me.score, lines: me.lines, level: me.level,
        grid: gridStr(me.grid), over: me.over,
      });
    }
  };
  clearTimeout(sendTimer);
  if (force || Date.now() - lastSent > 120) go();
  else sendTimer = setTimeout(go, 140);
}

const gridStr = (g) => g.flat().map((v) => (v ? String(v) : '.')).join('');
const strGrid = (str, out) => {
  if (!str || str.length !== COLS * ROWS) return out;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = str[r * COLS + c];
    out[r][c] = ch === '.' ? 0 : +ch || 0;
  }
  return out;
};

/* live view of the partner's board — the falling piece and fresh grid ride a
   light side-channel (not the game engine) so moves stream in real time
   without flooding the shared state. Locks still sync through the engine. */
let peerLive = { round: -1, cur: null, grid: '', over: false };
let lastLive = 0, liveTimer = 0;

function sendLive(force) {
  const go = () => {
    if (!me) return;
    const cur = active();
    if (!cur || cur.id !== 'tetris') return;
    lastLive = Date.now();
    send('tetris-live', {
      round: cur.state.round ?? 0,
      cur: me.cur ? { t: me.cur.t, rot: me.cur.rot, x: me.cur.x, y: me.cur.y } : null,
      grid: gridStr(me.grid),
      over: me.over,
    });
  };
  clearTimeout(liveTimer);
  if (force || Date.now() - lastLive > 40) go();
  else liveTimer = setTimeout(go, 45);
}

if (typeof window !== 'undefined') {
  on('tetris-live', (p) => { if (p && typeof p.round === 'number') peerLive = p; });
}

/* ---------------- rendering (persistent canvases survive re-renders) ---------------- */

function ensureEls() {
  if (els.mine) return;
  els.mine = h('canvas', { class: 'tk-board' }); els.mine.width = COLS * CELL; els.mine.height = ROWS * CELL;
  els.peer = h('canvas', { class: 'tk-board' }); els.peer.width = COLS * CELL; els.peer.height = ROWS * CELL;
  els.next = h('canvas', { class: 'tk-mini' }); els.next.width = 84; els.next.height = 168;
  els.hold = h('canvas', { class: 'tk-mini' }); els.hold.width = 84; els.hold.height = 56;
  els.infoMine = h('div', { class: 'tk-info' });
  els.infoPeer = h('div', { class: 'tk-info' });
  els.timer = h('div', { class: 'tk-timer' });
  els.count = h('div', { class: 'tk-count', style: 'min-height:70px; font-size:56px; font-weight:800; line-height:70px' });
  els.nameMine = h('div', { class: 'tk-name' }, 'You');
  els.namePeer = h('div', { class: 'tk-name' });
}

function cellRect(ctx, x, y, color, alpha) {
  ctx.globalAlpha = alpha ?? 1;
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  ctx.globalAlpha = 1;
}

function drawMine() {
  const ctx = els.mine.getContext('2d');
  ctx.fillStyle = '#0b0b16'; ctx.fillRect(0, 0, els.mine.width, els.mine.height);
  if (!me) return;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (me.grid[r][c]) cellRect(ctx, c, r, COLORS[me.grid[r][c]]);
  }
  if (me.cur) {
    const ghost = { ...me.cur };
    while (!collides(ghost.t, ghost.rot, ghost.x, ghost.y + 1)) ghost.y++;
    if (ghost.y !== me.cur.y) {
      for (const [cx, cy] of PIECES[ghost.t][ghost.rot]) {
        if (ghost.y + cy >= 0) cellRect(ctx, ghost.x + cx, ghost.y + cy, COLORS[ghost.t], .22);
      }
    }
    for (const [cx, cy] of PIECES[me.cur.t][me.cur.rot]) {
      if (me.cur.y + cy >= 0) cellRect(ctx, me.cur.x + cx, me.cur.y + cy, COLORS[me.cur.t]);
    }
  }
  if (me.over) {
    ctx.fillStyle = 'rgba(5,5,12,.72)'; ctx.fillRect(0, 0, els.mine.width, els.mine.height);
    ctx.fillStyle = '#ff8aa0'; ctx.font = '800 17px Outfit, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TOP OUT', els.mine.width / 2, els.mine.height / 2 - 8);
    ctx.fillStyle = '#a9a3c2'; ctx.font = '600 11px Outfit, sans-serif';
    ctx.fillText('waiting for the clock…', els.mine.width / 2, els.mine.height / 2 + 14);
  }
}

function drawPeerBoard(s) {
  if (!els.peer) return;
  const ctx = els.peer.getContext('2d');
  ctx.fillStyle = '#0b0b16'; ctx.fillRect(0, 0, els.peer.width, els.peer.height);
  const theirs = s[myRole === 'host' ? 'guest' : 'host'];
  // prefer the live side-channel when it belongs to the current round —
  // it carries the falling piece and the freshest grid
  const live = peerLive && peerLive.round === s.round ? peerLive : null;
  const grid = live ? live.grid : theirs?.grid;
  if (grid) {
    const g = strGrid(grid, Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (g[r][c]) cellRect(ctx, c, r, COLORS[g[r][c]]);
    }
  }
  if (live?.cur) {
    for (const [cx, cy] of PIECES[live.cur.t][live.cur.rot]) {
      if (live.cur.y + cy >= 0) cellRect(ctx, live.cur.x + cx, live.cur.y + cy, COLORS[live.cur.t]);
    }
  }
  if (live ? live.over : theirs?.over) {
    ctx.fillStyle = 'rgba(5,5,12,.72)'; ctx.fillRect(0, 0, els.peer.width, els.peer.height);
    ctx.fillStyle = '#ff8aa0'; ctx.font = '800 15px Outfit, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TOPPED OUT', els.peer.width / 2, els.peer.height / 2);
  }
  if (els.infoPeer) {
    els.infoPeer.textContent = theirs ? `Score ${theirs.score} · Lines ${theirs.lines}` : 'getting ready…';
  }
}

function drawMini(ctx, t, ox, oy, cell) {
  if (!t) return;
  ctx.fillStyle = COLORS[t];
  for (const [cx, cy] of PIECES[t][0]) ctx.fillRect(ox + cx * cell + 1, oy + cy * cell + 1, cell - 2, cell - 2);
}

function drawSide() {
  if (!me) return;
  const nx = els.next.getContext('2d');
  nx.fillStyle = '#0b0b16'; nx.fillRect(0, 0, els.next.width, els.next.height);
  me.next.forEach((t, i) => drawMini(nx, t, 8, 8 + i * 56, 17));
  const hx = els.hold.getContext('2d');
  hx.fillStyle = '#0b0b16'; hx.fillRect(0, 0, els.hold.width, els.hold.height);
  drawMini(hx, me.hold, 8, 8, 17);
  if (!me.canHold) { hx.fillStyle = 'rgba(11,11,22,.6)'; hx.fillRect(0, 0, els.hold.width, els.hold.height); }
}

/* ---------------- loop ---------------- */

function startLoop() {
  if (loopOn) return;
  loopOn = true;
  const step = (ts) => {
    if (!loopOn) return;
    raf = requestAnimationFrame(step);
    const cur = active();
    if (!cur || cur.id !== 'tetris') { stopLoop(); return; }
    const s = cur.state;
    if (s.phase === 'over') {
      if (!finalsDrawn) { finalsDrawn = true; drawMine(); drawPeerBoard(s); }
      return;
    }
    if (s.seed !== localSeed) { startLocal(s); return; }
    if (started() && me && !me.over) {
      if (!me.last) me.last = ts;
      const dt = Math.min(100, ts - me.last);
      me.last = ts;
      me.acc += dt;
      const iv = speed(me.level);
      while (me.acc > iv && !me.over) {
        me.acc -= iv;
        if (canMove(0, 1)) { me.cur.y++; sendLive(); }
        else lockNow();
      }
    } else if (me) me.last = 0;
    drawMine(); drawSide(); drawPeerBoard(s);
    els.infoMine.textContent = me ? `Score ${me.score} · Lines ${me.lines} · Lv ${me.level}` : '';
    const rem = Math.max(0, s.endsAt - hostNow());
    els.timer.textContent = `${Math.floor(rem / 60000)}:${String(Math.floor((rem % 60000) / 1000)).padStart(2, '0')}`;
    els.timer.classList.toggle('low', rem < 30_000 && rem > 0);
    const cd = Math.ceil((s.startsAt - hostNow()) / 1000);
    els.count.textContent = s.phase === 'countdown' ? (cd > 0 ? cd : 'GO!') : '';
  };
  raf = requestAnimationFrame(step);
}

function stopLoop() {
  loopOn = false;
  cancelAnimationFrame(raf);
}

/* ---------------- input ---------------- */

let keyBound = false;
function bindKeys() {
  if (keyBound || typeof document === 'undefined') return;
  keyBound = true;
  document.addEventListener('keydown', (e) => {
    const cur = active();
    if (!cur || cur.id !== 'tetris') return;
    if (e.target && /^(input|textarea)$/i.test(e.target.tagName)) return;
    const map = {
      ArrowLeft: () => move(-1), ArrowRight: () => move(1),
      ArrowDown: () => softDrop(), ArrowUp: () => rotate(1),
      x: () => rotate(1), X: () => rotate(1), z: () => rotate(-1), Z: () => rotate(-1),
      ' ': () => hardDrop(), c: () => holdPiece(), C: () => holdPiece(), Shift: () => holdPiece(),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    if (!playable()) return;
    fn();
  });
}

let touch = null;
function bindTouch(canvas) {
  if (canvas.dataset.tkBound) return;
  canvas.dataset.tkBound = '1';
  canvas.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!touch || !playable()) { touch = null; return; }
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y, dt = Date.now() - touch.t;
    touch = null;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && dt < 300) { rotate(1); return; } // tap = rotate
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy > 40) hardDrop();
    else if (dy < -40) holdPiece();
  });
}

/* ---------------- engine registration ---------------- */

function finish(s) {
  const hs = s.host?.score ?? 0, gs = s.guest?.score ?? 0;
  return { ...s, phase: 'over', winner: hs > gs ? 'host' : gs > hs ? 'guest' : 'tie' };
}

registerGame({
  id: 'tetris', name: 'Tetris Race', tag: 'Two boards · 3:00 · highest score wins', icon: '🟪', section: 'classic',
  init() { return { phase: 'lobby', seed: null, startsAt: 0, endsAt: 0, host: null, guest: null, winner: null, round: 0 }; },
  fill(a) {
    if (a.type === 'start' || a.type === 'rematch') {
      a.seed = (Math.random() * 2 ** 31) | 0;
      a.startsAt = Date.now() + COUNTDOWN_MS;
      a.endsAt = a.startsAt + ROUND_MS;
    }
  },
  canOptimistic(a) { return a.type !== 'start' && a.type !== 'rematch'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      if (!a.seed) return s;
      return { ...s, phase: 'countdown', seed: a.seed, startsAt: a.startsAt, endsAt: a.endsAt, host: blank(), guest: blank(), winner: null, round: s.round + 1 };
    }
    if (a.type === 'progress' && (s.phase === 'play' || s.phase === 'countdown')) {
      const p = { score: a.score | 0, lines: a.lines | 0, level: a.level || 1, grid: typeof a.grid === 'string' ? a.grid.slice(0, COLS * ROWS) : '', over: !!a.over };
      const next = { ...s, [a.by]: p };
      return next.host?.over && next.guest?.over ? finish(next) : next;
    }
    return s;
  },
  tick(s, { now }) {
    if (s.phase === 'countdown' && now >= s.startsAt) return { ...s, phase: 'play' };
    if (s.phase === 'play' && now >= s.endsAt) return finish(s);
    return null;
  },
  score: (s) => ({ host: s.host?.score ?? 0, guest: s.guest?.score ?? 0 }),
  view(el, s, ctx, api) {
    myRole = ctx.myRole;
    ensureEls();
    bindKeys();
    els.namePeer.textContent = api.peerName;
    if (s.phase === 'lobby') {
      stopLoop(); localSeed = null; me = null;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🟪'),
        h('div', { class: 'g-prompt' }, 'Tetris Race — 3 minutes, highest score wins'),
        h('div', { class: 'g-sub', style: 'max-width:420px' },
          'Both boards get the exact same pieces. Watch ', api.peerName, '’s stack grow live while you race. Arrows / swipe on your board, space = hard drop, C = hold.'),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'start' }) }, 'Start the 3:00 ⏱'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const hs = s.host?.score ?? 0, gs = s.guest?.score ?? 0;
      const myScore = myRole === 'host' ? hs : gs, theirScore = myRole === 'host' ? gs : hs;
      const myLines = myRole === 'host' ? s.host?.lines ?? 0 : s.guest?.lines ?? 0;
      stopLoop();
      drawPeerBoard(s);
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, s.winner === 'tie' ? '🤝' : (s.winner === myRole ? '🏆' : '🧊')),
        h('div', { class: 'g-prompt' },
          s.winner === 'tie' ? `Dead heat — ${hs} points each!`
            : s.winner === myRole ? `You win ${myScore} to ${theirScore}! 🎉`
            : `${api.peerName} wins ${theirScore} to ${myScore}`),
        h('div', { class: 'g-sub' }, `Your lines: ${myLines}`),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'rematch' }) }, 'Go again 🔁'),
      ));
      return;
    }

    if ((s.phase === 'countdown' || s.phase === 'play') && (localSeed !== s.seed || !me)) startLocal(s);
    drawPeerBoard(s);

    el.append(
      h('div', { class: 'scoreline' },
        els.timer,
        h('div', { class: 'sc' }, '🟪 ', h('b', {}, String(myRole === 'host' ? (s.host?.score ?? 0) : (s.guest?.score ?? 0)))),
        h('div', { class: 'sc' }, 'vs'),
        h('div', { class: 'sc' }, h('b', {}, String(myRole === 'host' ? (s.guest?.score ?? 0) : (s.host?.score ?? 0))), ' 🟪'),
      ),
      h('div', { class: 'g-center' },
        els.count,
        h('div', { class: 'tk-boards' },
          h('div', { class: 'tk-col' },
            els.nameMine, els.mine, els.infoMine,
            h('div', { class: 'tk-controls' },
              ...[['◀', () => move(-1)], ['▼', () => softDrop()], ['▶', () => move(1)], ['⟳', () => rotate(1)], ['⏬', () => hardDrop()], ['⇄', () => holdPiece()]]
                .map(([label, fn]) => h('button', { class: 'tk-btn', onclick: fn }, label))),
          ),
          h('div', { class: 'tk-mid' },
            h('div', { class: 'tk-name' }, 'Hold'), els.hold,
            h('div', { class: 'tk-name' }, 'Next'), els.next,
          ),
          h('div', { class: 'tk-col' },
            els.namePeer, els.peer, els.infoPeer,
          ),
        ),
        h('div', { class: 'g-sub', style: 'margin-top:8px' }, 'Tap your board to rotate · swipe to move · swipe down = hard drop'),
      ),
    );
    bindTouch(els.mine);
    startLoop();
  },
});
