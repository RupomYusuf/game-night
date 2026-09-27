/* Ludo Duel (2-player) — host owns the top-left base, partner the bottom-right.
   Dice rolls are filled host-side; token moves are a deterministic reducer, so
   both boards stay in lockstep while each device animates its own hops.
   Rules: six to leave the yard, extra roll on a six / capture / home, three
   sixes in a row forfeits, exact roll to step into the center, captures send
   a token back to its yard (start cells and the four starred cells are safe). */
import { registerGame, act, active } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const ROLE_HEX = { host: '#ff5fa2', guest: '#4f9dff' };
const ROLE_NAME = { host: 'Pink', guest: 'Blue' };

/* the 52-cell main circuit, clockwise, as (col,row) on a 15×15 board */
const LOOP = [
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  [0,7],
];
const START = { host: 1, guest: 27 };            // loop index of each start cell
const HOME_PATH = {
  host: [[1,7],[2,7],[3,7],[4,7],[5,7]],         // p 51..55
  guest: [[13,7],[12,7],[11,7],[10,7],[9,7]],
};
const YARD = {
  host: [[1.5,1.5],[3.5,1.5],[1.5,3.5],[3.5,3.5]],
  guest: [[10.5,10.5],[12.5,10.5],[10.5,12.5],[12.5,12.5]],
};
const SAFE = new Set([1, 27, 25, 51]);           // start cells + starred middles
const GOAL = 56;

const loopIndexOf = (role, p) => (START[role] + p) % LOOP.length;
function cellOf(role, p) {
  if (p === -1) return null;
  if (p <= 50) return LOOP[loopIndexOf(role, p)];
  if (p <= 55) return HOME_PATH[role][p - 51];
  return [7, 7];
}

function legalMoves(tks, d) {
  const out = [];
  tks.forEach((p, i) => {
    if (p === -1) { if (d === 6) out.push({ i, target: 0 }); return; }
    if (p + d <= GOAL) out.push({ i, target: p + d });
  });
  return out;
}

/* ---------------- persistent board (built once, survives re-renders) ---------------- */
const els = {};
let prevTokens = null;    // for move animations
let animTimers = [];
let lastDice = null, diceTimer = null;
let lastSeen = {};

function clearAnims() { animTimers.forEach(clearTimeout); animTimers = []; }

function buildBoard() {
  if (els.board) return;
  els.board = h('div', { class: 'lboard' });
  const cell = (x, y, cls, label) => {
    const d = h('div', { class: 'lcell ' + cls, style: `--x:${x}; --y:${y}` }, label || '');
    return d;
  };
  const inBase = (x, y) => (x <= 5 && y <= 5) || (x >= 9 && y >= 9);
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      let cls = 'track', label = '';
      if (x <= 5 && y <= 5) cls = 'base host';
      else if (x >= 9 && y >= 9) cls = 'base guest';
      else if ((x >= 9 && y <= 5) || (x <= 5 && y >= 9)) cls = 'base off';  // unused corners in 2-player
      else if (x >= 6 && x <= 8 && y >= 6 && y <= 8) cls = 'center';
      const li = LOOP.findIndex(([cx, cy]) => cx === x && cy === y);
      if (li >= 0) {
        if (li === START.host) { cls += ' start host'; }
        if (li === START.guest) { cls += ' start guest'; }
        if (SAFE.has(li) && !/start/.test(cls)) { cls += ' safe'; label = '★'; }
      }
      for (const role of ['host', 'guest']) {
        const hi = HOME_PATH[role].findIndex(([cx, cy]) => cx === x && cy === y);
        if (hi >= 0) cls = `homecol ${role}`;
      }
      if (x === 7 && y === 7) cls += ' goal';
      if (cls !== 'track' || !inBase(x, y)) els.board.append(cell(x, y, cls, label));
    }
  }
  // base plates inside the two active yards
  els.board.append(
    h('div', { class: 'lyard host', style: '--x:0; --y:0' }),
    h('div', { class: 'lyard guest', style: '--x:9; --y:9' }),
  );
  // tokens
  els.tokens = {};
  for (const role of ['host', 'guest']) {
    els.tokens[role] = [];
    for (let i = 0; i < 4; i++) {
      const t = h('div', { class: `ltoken ${role}`, 'data-role': role, 'data-i': i });
      t.addEventListener('click', () => tryMove(role, i));
      els.tokens[role].push(t);
      els.board.append(t);
    }
  }
  els.dice = h('div', { class: 'ldice' });
}

let anim = {};   // 'role:i' → true while that token's hop animation is in flight

/* place every token from state; tokens sharing a cell fan out instead of
   stacking invisibly on top of each other */
function applyPositions(s, instant = false) {
  const pos = {};
  const byCell = new Map();
  for (const role of ['host', 'guest']) s.tokens[role].forEach((p, i) => {
    const c = p === -1 ? YARD[role][i] : cellOf(role, p);
    pos[role + ':' + i] = c;
    const k = c[0] + ',' + c[1];
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k).push(role + ':' + i);
  });
  for (const [, keys] of byCell) {
    keys.forEach((k, idx) => {
      const [role, i] = k.split(':');
      const [x, y] = pos[k];
      const n = keys.length;
      const dx = n > 1 ? (idx - (n - 1) / 2) * 0.32 : 0;   // fan out stacked tokens
      const sc = n > 2 ? 0.7 : n > 1 ? 0.82 : 1;
      const t = els.tokens[role][i];
      if (instant) t.classList.add('noanim');
      t.style.setProperty('--tx', ((x + 0.5 + dx) / 15 * 100) + '%');
      t.style.setProperty('--ty', ((y + 0.5) / 15 * 100) + '%');
      t.style.setProperty('--s', sc);
      if (instant) { void t.offsetWidth; t.classList.remove('noanim'); }
    });
  }
}

const snapAll = (s, instant = true) => { clearAnims(); anim = {}; applyPositions(s, instant); };

/* step-by-step hop along the path for a token that just moved */
function animateMove(role, i, fromP, toP, s) {
  const key = role + ':' + i;
  anim[key] = true;
  const t = els.tokens[role][i];
  const steps = [];
  if (fromP === -1) steps.push(0);
  else for (let p = fromP + 1; p <= toP; p++) steps.push(p);
  steps.forEach((p, k) => {
    animTimers.push(setTimeout(() => {
      const [x, y] = cellOf(role, p);
      t.style.setProperty('--tx', ((x + 0.5) / 15 * 100) + '%');
      t.style.setProperty('--ty', ((y + 0.5) / 15 * 100) + '%');
      if (k < steps.length - 1) sfx.tick();
      else { delete anim[key]; applyPositions(s, false); }  // settle with stack offsets
    }, k * 140));
  });
}

/* ---------------- gameplay ---------------- */
let myRole = 'host';

function tryMove(role, i) {
  if (role !== myRole) return;                        // opponent tokens aren't clickable
  const cur = active();
  if (!cur || cur.id !== 'ludo' || cur.state.phase !== 'play') return;
  const s = cur.state;
  if (s.turn !== myRole || s.dice == null || s.noMoves) return;
  const legal = legalMoves(s.tokens[myRole], s.dice).find((m) => m.i === i);
  if (!legal) return;
  const wasCapture = legal.target <= 50 && !SAFE.has(loopIndexOf(myRole, legal.target))
    && s.tokens[myRole === 'host' ? 'guest' : 'host'].some((p) => p >= 0 && p <= 50 && loopIndexOf(myRole === 'host' ? 'guest' : 'host', p) === loopIndexOf(myRole, legal.target));
  const reachedHome = legal.target === GOAL;
  act({ type: 'move', i });
  if (wasCapture || reachedHome) { sfx.match(); haptic(buzz.match); }
  else { sfx.pop(); haptic(buzz.tap); }
}

function rollDice() {
  const cur = active();
  if (!cur || cur.id !== 'ludo' || cur.state.phase !== 'play') return;
  const s = cur.state;
  if (s.turn !== myRole || s.dice != null) return;
  sfx.spin(); haptic([30, 60, 30]);
  act({ type: 'roll' });
}

/* ---------------- engine registration ---------------- */

const finish = (s, winner) => ({ ...s, phase: 'over', winner });

/* big center-popup dice — both players see every roll land */
function showDicePopup(v) {
  if (!els.pop) {
    els.pop = h('div', { class: 'ldice-pop' }, h('div', { class: 'ldice-big' }));
    document.body.append(els.pop);
  }
  const face = els.pop.firstChild;
  els.pop.classList.add('show');
  let n = 0;
  const fl = setInterval(() => {
    face.textContent = '⚀⚁⚂⚃⚄⚅'[Math.floor(Math.random() * 6)];
    if (++n > 6) { clearInterval(fl); face.textContent = '⚀⚁⚂⚃⚄⚅'[v - 1]; }
  }, 70);
  clearTimeout(els.popT);
  els.popT = setTimeout(() => els.pop.classList.remove('show'), 1250);
}

registerGame({
  id: 'ludo', name: 'Ludo Duel', tag: 'Race your four tokens home', icon: '🎲', section: 'classic',
  init() { return { phase: 'lobby', round: 0, turn: 'host', dice: null, sixChain: 0, rollId: 0, tokens: { host: [-1, -1, -1, -1], guest: [-1, -1, -1, -1] }, noMoves: false, forfeit: false, winner: null }; },
  fill(a) {
    if (a.type === 'roll') a.v = 1 + Math.floor(Math.random() * 6);
  },
  canOptimistic(a) { return a.type !== 'roll'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      return { ...s, phase: 'play', round: s.round + 1, turn: s.round % 2 === 0 ? 'host' : 'guest', dice: null, sixChain: 0, rollId: 0, tokens: { host: [-1, -1, -1, -1], guest: [-1, -1, -1, -1] }, noMoves: false, forfeit: false, winner: null };
    }
    if (s.phase !== 'play') return s;

    if (a.type === 'roll') {
      if (a.by !== s.turn || s.dice != null || !a.v) return s;
      const v = Math.max(1, Math.min(6, a.v | 0));
      const id = s.rollId + 1;
      if (v === 6) {
        const chain = s.sixChain + 1;
        if (chain >= 3) return { ...s, dice: v, sixChain: 0, rollId: id, noMoves: true, forfeit: true }; // third six forfeits
        return { ...s, dice: v, sixChain: chain, rollId: id, noMoves: legalMoves(s.tokens[a.by], v).length === 0 };
      }
      return { ...s, dice: v, sixChain: 0, rollId: id, noMoves: legalMoves(s.tokens[a.by], v).length === 0 };
    }

    if (a.type === 'noMove') {
      if (a.by !== s.turn || s.dice == null || !s.noMoves) return s;
      return { ...s, dice: null, noMoves: false, forfeit: false, turn: a.by === 'host' ? 'guest' : 'host' };
    }

    if (a.type === 'move') {
      if (a.by !== s.turn || s.dice == null || s.noMoves) return s;
      const tks = s.tokens[a.by];
      const legal = legalMoves(tks, s.dice).find((m) => m.i === a.i);
      if (!legal) return s;
      const nextTks = [...tks];
      nextTks[a.i] = legal.target;
      let next = { ...s, tokens: { ...s.tokens, [a.by]: nextTks } };

      // captures: my token lands on the main track where an enemy stands (not safe)
      let captured = false;
      if (legal.target <= 50) {
        const idx = loopIndexOf(a.by, legal.target);
        if (!SAFE.has(idx)) {
          const opp = a.by === 'host' ? 'guest' : 'host';
          next.tokens[opp] = next.tokens[opp].map((p) => (p >= 0 && p <= 50 && loopIndexOf(opp, p) === idx ? -1 : p));
          captured = next.tokens[opp].some((p, i) => p === -1 && s.tokens[opp][i] !== -1);
        }
      }
      const extra = s.dice === 6 || captured || legal.target === GOAL;
      next.dice = null;
      next.noMoves = false;
      next.forfeit = false;
      if (nextTks.every((p) => p === GOAL)) return finish(next, a.by);
      if (!extra) next.turn = a.by === 'host' ? 'guest' : 'host';
      return next;
    }
    return s;
  },
  view(el, s, ctx, api) {
    myRole = ctx.myRole;
    buildBoard();

    if (s.phase === 'lobby') {
      prevTokens = null;
      snapAll({ tokens: { host: [-1, -1, -1, -1], guest: [-1, -1, -1, -1] } });
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🎲'),
        h('div', { class: 'g-prompt' }, 'Ludo Duel — first to bring all four tokens home'),
        h('div', { class: 'g-sub', style: 'max-width:420px' },
          'Roll a six to leave the yard. Landing on your partner sends them back (stars are safe). Extra roll on a six, a capture, or a homecoming — but three sixes in a row and you forfeit the turn.'),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'start' }) }, 'Start the race 🏁'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === ctx.myRole;
      snapAll(s);
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, iWon ? '🏆' : '🎲'),
        h('div', { class: 'g-prompt' }, iWon ? 'All four home — you win the race! 🎉' : `${api.peerName} raced all four home first`),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'rematch' }) }, 'Race again 🔁'),
      ));
      return;
    }

    // diff tokens against the previous render → hop animation for what moved
    if (prevTokens) {
      clearAnims();
      let needPlace = false;
      for (const role of ['host', 'guest']) {
        s.tokens[role].forEach((p, i) => {
          const key = role + ':' + i;
          const old = prevTokens[role][i];
          if (p === old) { if (!anim[key]) needPlace = true; return; }   // don't snap mid-hop
          if (p === -1) {                                                // captured → sail home
            delete anim[key];
            els.tokens[role][i].classList.add('captured');
            animTimers.push(setTimeout(() => els.tokens[role][i].classList.remove('captured'), 600));
            sfx.miss();
            needPlace = true;
            return;
          }
          animateMove(role, i, old, p, s);
        });
      }
      if (needPlace) applyPositions(s, false);
    } else {
      snapAll(s);
    }
    prevTokens = { host: [...s.tokens.host], guest: [...s.tokens.guest] };

    // dice flicker when a new value lands → big popup on both screens
    if (s.dice !== lastDice) {
      clearInterval(diceTimer);
      if (s.dice != null) {
        showDicePopup(s.dice);
        let n = 0;
        diceTimer = setInterval(() => {
          els.dice.textContent = '⚀⚁⚂⚃⚄⚅'[(n++ + Math.floor(Math.random() * 6)) % 6];
          if (n > 6) { clearInterval(diceTimer); els.dice.textContent = '⚀⚁⚂⚃⚄⚅'[s.dice - 1]; els.dice.classList.remove('rolling'); }
        }, 70);
        els.dice.classList.add('rolling');
      }
      lastDice = s.dice;
    }

    const myTurn = s.turn === ctx.myRole;
    const legal = myTurn && s.dice != null ? legalMoves(s.tokens[myRole], s.dice) : [];
    const movable = new Set(legal.map((m) => m.i));
    for (const role of ['host', 'guest']) {
      els.tokens[role].forEach((t, i) => {
        t.classList.toggle('movable', role === myRole && movable.has(i));
        t.classList.toggle('mine', role === myRole);
      });
    }

    el.append(
      h('div', { class: 'g-center', style: 'gap:10px' },
        h('div', { class: 'ltop' },
          h('div', { class: 'lplayer' + (s.turn === 'host' ? ' active' : '') },
            h('span', { class: 'ldot', style: `background:${ROLE_HEX.host}` }), 'You'),
          els.dice,
          h('div', { class: 'lplayer' + (s.turn === 'guest' ? ' active' : '') },
            h('span', { class: 'ldot', style: `background:${ROLE_HEX.guest}` }), api.peerName),
        ),
        els.board,
        h('div', { class: 'lstatus' },
          myTurn && s.dice == null ? h('button', { class: 'btn btn-hot', onclick: rollDice }, '🎲 Roll') : null,
          !myTurn ? h('span', { class: 'g-sub' }, `${api.peerName} is rolling…`) : null,
          myTurn && s.dice != null && !s.noMoves && !legal.length ? h('span', { class: 'g-sub' }, 'No possible move…') : null,
          myTurn && s.dice != null && legal.length ? h('span', { class: 'g-sub' }, `You rolled ${s.dice} — tap a glowing token`) : null,
          s.noMoves && myTurn ? h('span', { class: 'g-sub' }, 'Nothing possible — passing…') : null,
        ),
      ),
    );

    // roller rolled into a dead end (or forfeited three sixes) → auto-pass
    if (s.noMoves && myTurn && lastSeen.passedRoll !== s.rollId) {
      lastSeen.passedRoll = s.rollId;
      animTimers.push(setTimeout(() => {
        const cur = active();
        if (cur && cur.id === 'ludo' && cur.state.noMoves && cur.state.turn === myRole) act({ type: 'noMove' });
      }, 1100));
    }
  },
});
