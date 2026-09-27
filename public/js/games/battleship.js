/* Battleship — your fleet never leaves your device. Placement happens locally;
   shots sync through the engine and the DEFENDER resolves each shot privately
   (hit / miss / sunk) and reports it — same trust model as UNO's hidden hands.
   Classic rules: sink all seventeen ship cells to win; a hit grants another shot. */
import { registerGame, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const SIZE = 10;
const FLEET = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];
const TOTAL_CELLS = 17;
const COLS = 'ABCDEFGHIJ';

/* ---------------- my private fleet (this device only) ---------------- */
let myFleet = null;        // [{id, cells: [idx]}]
let placing = null;        // {horiz}
let myBoard = null;        // 100 ints: 0 water, 1 ship
let lastSeen = { shotsAgainst: new Set(), resolved: null };

function randomFleet() {
  const board = Array(100).fill(0);
  const fleet = [];
  for (const ship of FLEET) {
    let placed = false;
    while (!placed) {
      const horiz = Math.random() < .5;
      const x = Math.floor(Math.random() * (horiz ? SIZE - ship.size + 1 : SIZE));
      const y = Math.floor(Math.random() * (horiz ? SIZE : SIZE - ship.size + 1));
      const cells = Array.from({ length: ship.size }, (_, k) => (horiz ? y * SIZE + x + k : (y + k) * SIZE + x));
      if (cells.every((c) => !board[c])) { cells.forEach((c) => { board[c] = 1; }); fleet.push({ id: ship.id, cells }); placed = true; }
    }
  }
  return { fleet, board };
}

const allMyShipsSunk = () => myFleet && myFleet.every((ship) => ship.cells.every((c) => lastSeen.shotsAgainst.has(c)));
function sunkShipName(idx) {
  for (const ship of myFleet || []) {
    if (ship.cells.includes(idx)) {
      return ship.cells.every((c) => c === idx || lastSeen.shotsAgainst.has(c)) ? FLEET.find((f) => f.id === ship.id).name : null;
    }
  }
  return null;
}
function resetLocal() { myFleet = null; myBoard = Array(100).fill(0); placing = null; lastSeen = { shotsAgainst: new Set(), resolved: null }; }

/* ---------------- rendering ---------------- */
const gridEl = (cls) => h('div', { class: 'bsgrid ' + cls },
  ...Array.from({ length: 100 }, (_, i) => h('div', { class: 'bscell', 'data-i': i })));

registerGame({
  id: 'battleship', name: 'Battleship', tag: 'Hide your fleet, hunt theirs', icon: '🚢', section: 'classic',
  init() { return { phase: 'lobby', round: 1, ready: { host: false, guest: false }, turn: 'host', shots: { host: [], guest: [] }, pendingShot: null, winner: null }; },
  canOptimistic(a) { return a.type !== 'start'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      return { ...s, phase: 'place', round: s.round + 1, ready: { host: false, guest: false }, turn: 'host', shots: { host: [], guest: [] }, pendingShot: null, winner: null };
    }
    if (s.phase === 'place') {
      if (a.type !== 'fleetReady') return s;
      const ready = { ...s.ready, [a.by]: true };
      return { ...s, ready, phase: ready.host && ready.guest ? 'play' : 'place', turn: 'host' };
    }
    if (s.phase !== 'play') return s;
    if (a.type === 'fire') {
      if (a.by !== s.turn || s.pendingShot) return s;
      if (typeof a.idx !== 'number' || a.idx < 0 || a.idx > 99) return s;
      if (s.shots[a.by].some((sh) => sh.idx === a.idx)) return s;   // already fired there
      return { ...s, pendingShot: { idx: a.idx, by: a.by } };
    }
    if (a.type === 'result') {
      // only the defender of the shot may resolve it, and only for the pending shot
      if (!s.pendingShot || a.by === s.pendingShot.by || a.idx !== s.pendingShot.idx) return s;
      const shooter = s.pendingShot.by;
      if (s.shots[shooter].some((sh) => sh.idx === a.idx)) return { ...s, pendingShot: null };
      const shots = { ...s.shots, [shooter]: [...s.shots[shooter], { idx: a.idx, hit: !!a.hit, sunk: a.sunk || null }] };
      const destroyed = a.done || shots[shooter].filter((sh) => sh.hit).length >= TOTAL_CELLS;
      if (destroyed) return { ...s, shots, pendingShot: null, phase: 'over', winner: shooter };
      return { ...s, shots, pendingShot: null, turn: a.hit ? shooter : a.by };   // hit → shoot again
    }
    return s;
  },
  view(el, s, ctx, api) {
    const myRole = ctx.myRole;
    const theirRole = myRole === 'host' ? 'guest' : 'host';

    if (s.phase === 'lobby') {
      resetLocal();
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🚢'),
        h('div', { class: 'g-prompt' }, 'Battleship — hunt their fleet'),
        h('div', { class: 'g-sub', style: 'max-width:420px' }, 'Your fleet stays on your screen — only your shots and their results cross the wire. Hide five ships, sink all seventeen of their cells.'),
        h('button', { class: 'btn btn-primary', onclick: () => { resetLocal(); act({ type: 'start' }); } }, 'Set sail ⚓'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === myRole;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, iWon ? '🏆' : '🌊'),
        h('div', { class: 'g-prompt' }, iWon ? 'Their whole fleet is at the bottom! 🎉' : 'Your fleet went down…'),
        h('button', { class: 'btn btn-primary', onclick: () => { resetLocal(); act({ type: 'rematch' }); } }, 'Battle again ⚓'),
      ));
      return;
    }

    /* ---- placement (my fleet, my screen) ---- */
    if (s.phase === 'place') {
      if (!myFleet) { const rf = randomFleet(); myFleet = rf.fleet; myBoard = rf.board; placing = { horiz: true }; }
      const nextIdx = myFleet.length;
      const placedAll = nextIdx >= FLEET.length;
      const grid = gridEl('place');
      myBoard.forEach((v, i) => { if (v) grid.children[i].classList.add('ship'); });
      grid.addEventListener('click', (e) => {
        const cell = e.target.closest('.bscell');
        if (!cell || placedAll) return;
        const i = +cell.dataset.i;
        const ship = FLEET[nextIdx];
        const horiz = placing.horiz;
        const x = Math.min(i % SIZE, SIZE - (horiz ? ship.size : 1));
        const y = Math.min(Math.floor(i / SIZE), SIZE - (horiz ? 1 : ship.size));
        const cells = Array.from({ length: ship.size }, (_, k) => (horiz ? y * SIZE + x + k : (y + k) * SIZE + x));
        if (!cells.every((c) => !myBoard[c])) { sfx.miss(); return; }
        cells.forEach((c) => { myBoard[c] = 1; });
        myFleet.push({ id: ship.id, cells });
        sfx.pop();
      });

      el.append(h('div', { class: 'g-center', style: 'gap:10px' },
        h('div', { class: 'g-prompt' }, 'Position your fleet'),
        h('div', { class: 'g-sub' },
          placedAll
            ? (s.ready[myRole] ? `Fleet set — waiting for ${api.peerName}…` : 'Fleet positioned! Ready when they are.')
            : `Tap the water to drop the ${FLEET[nextIdx].name} (${FLEET[nextIdx].size} cells) — ${placing.horiz ? 'horizontal' : 'vertical'}`),
        grid,
        h('div', { class: 'urow' },
          !placedAll ? h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => { placing.horiz = !placing.horiz; sfx.tap(); },
          }, placing.horiz ? '↔ Horizontal' : '↕ Vertical') : null,
          h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => { const rf = randomFleet(); myFleet = rf.fleet; myBoard = rf.board; sfx.tap(); },
          }, '🎲 Shuffle all'),
          placedAll && !s.ready[myRole] ? h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'fleetReady' }) }, 'Fleet ready ⚓') : null,
        ),
      ));
      return;
    }

    /* ---- battle: my fleet + their waters ---- */
    const myShots = s.shots[myRole];
    const theirShots = s.shots[theirRole];
    lastSeen.shotsAgainst = new Set(theirShots.map((sh) => sh.idx));

    // the defender resolves the pending shot privately and reports the result
    if (s.pendingShot && s.pendingShot.by !== myRole && lastSeen.resolved !== s.pendingShot.idx + ':' + s.round) {
      lastSeen.resolved = s.pendingShot.idx + ':' + s.round;
      const idx = s.pendingShot.idx;
      const hit = !!myBoard[idx];
      const sunk = hit ? sunkShipName(idx) : null;
      if (hit) lastSeen.shotsAgainst.add(idx);
      const done = hit && allMyShipsSunk();
      act({ type: 'result', idx, hit, sunk, done });
      if (hit) { sfx.miss(); haptic(buzz.recv); } else sfx.tap();
    }

    const myGrid = gridEl('mine');
    myFleet?.forEach((ship) => ship.cells.forEach((c) => myGrid.children[c].classList.add('ship')));
    theirShots.forEach((sh) => myGrid.children[sh.idx].classList.add(sh.hit ? 'hit' : 'miss'));

    const theirGrid = gridEl('theirs');
    myShots.forEach((sh) => theirGrid.children[sh.idx].classList.add(sh.hit ? 'hit' : 'miss'));

    const myTurn = s.turn === myRole && !s.pendingShot;
    if (myTurn) theirGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.bscell');
      if (!cell) return;
      const i = +cell.dataset.i;
      if (myShots.some((sh) => sh.idx === i)) { sfx.miss(); return; }
      act({ type: 'fire', idx: i });
      sfx.spin();
    });
    else theirGrid.classList.add('locked');

    const lastShot = myShots[myShots.length - 1];
    const incoming = theirShots[theirShots.length - 1];
    el.append(h('div', { class: 'g-center', style: 'gap:10px' },
      h('div', { class: 'g-sub' + (myTurn ? ' turn-glow' : '') },
        myTurn ? 'Your shot — tap their waters' : s.pendingShot ? 'Incoming shell…' : `${api.peerName} is aiming at you…`),
      h('div', { class: 'bswrap' },
        h('div', { class: 'bscol' }, h('div', { class: 'bslabel' }, 'Your fleet'), myGrid),
        h('div', { class: 'bscol' }, h('div', { class: 'bslabel' }, `${api.peerName}'s waters`), theirGrid)),
      lastShot ? h('div', { class: 'g-sub' },
        `Your last: ${COLS[lastShot.idx % SIZE]}${Math.floor(lastShot.idx / SIZE) + 1} — ${lastShot.sunk ? `SUNK their ${lastShot.sunk}! 💥` : lastShot.hit ? 'HIT!' : 'miss…'}`) : null,
      incoming ? h('div', { class: 'g-sub' },
        `Their last: ${COLS[incoming.idx % SIZE]}${Math.floor(incoming.idx / SIZE) + 1} — ${incoming.hit ? 'you were HIT' : 'they missed'}`) : null,
    ));
  },
});
