/* Dots and Boxes — 5×5 dots, 4×4 boxes. Tap between two dots to claim a line;
   complete a box and it's yours (plus an extra turn). Most boxes when every
   line is drawn wins. Deterministic reducer, persistent animated board. */
import { registerGame, act, active } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const DOTS = 5;                          // 5×5 dots → 4×4 boxes
const TOTAL_EDGES = DOTS * (DOTS - 1) * 2;
const BOX_TOTAL = (DOTS - 1) * (DOTS - 1);
const boxEdges = (r, c) => ['H' + r + ':' + c, 'H' + (r + 1) + ':' + c, 'V' + r + ':' + c, 'V' + r + ':' + (c + 1)];

let myRole = 'host';
let elsB = null;

registerGame({
  id: 'dotsboxes', name: 'Dots and Boxes', tag: 'Claim boxes, steal turns', icon: '⬚', section: 'classic',
  init() { return { phase: 'lobby', round: 0, turn: 'host', lines: {}, boxes: {}, winner: null }; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      return { ...s, phase: 'play', round: s.round + 1, turn: s.round % 2 === 0 ? 'host' : 'guest', lines: {}, boxes: {}, winner: null };
    }
    if (s.phase !== 'play' || a.type !== 'line') return s;
    if (a.by !== s.turn) return s;
    const id = String(a.edgeId || '');
    const mh = id.match(/^H([0-4]):([0-3])$/);
    const mv = id.match(/^V([0-4]):([0-4])$/);          // V edges run along the full dot column (0..4)
    const mm = mh || mv;
    if (!mm || s.lines[id]) return s;
    const lines = { ...s.lines, [id]: a.by };
    const tag = mh ? 'H' : 'V', r = +(mh ? mh[1] : mv[1]), c = +(mh ? mh[2] : mv[2]);
    const boxes = { ...s.boxes };
    let claimedNew = false;
    const adj = tag === 'H'
      ? (r > 0 ? [[r - 1, c]] : []).concat(r < DOTS - 1 ? [[r, c]] : [])
      : (c > 0 ? [[r, c - 1]] : []).concat(c < DOTS - 1 ? [[r, c]] : []);
    for (const [br, bc] of adj) {
      const key = br + ':' + bc;
      if (boxes[key]) continue;
      const need = boxEdges(br, bc);
      if (need.every((e) => e === id || lines[e])) { boxes[key] = a.by; claimedNew = true; }
    }
    const next = { ...s, lines, boxes };
    if (Object.keys(boxes).length === BOX_TOTAL) {
      const hb = Object.values(boxes).filter((v) => v === 'host').length;
      const gb = BOX_TOTAL - hb;
      return { ...next, phase: 'over', winner: hb > gb ? 'host' : gb > hb ? 'guest' : 'tie' };
    }
    if (claimedNew) return next;                       // a claimed box grants another line
    return { ...next, turn: a.by === 'host' ? 'guest' : 'host' };
  },
  score: (s) => {
    const boxes = Object.values(s.boxes || {});
    return { host: boxes.filter((v) => v === 'host').length, guest: boxes.filter((v) => v === 'guest').length };
  },
  view(el, s, ctx, api) {
    myRole = ctx.myRole;
    buildBoard();
    paint(s);

    if (s.phase === 'lobby') {
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '⬚'),
        h('div', { class: 'g-prompt' }, 'Dots and Boxes — claim the most boxes'),
        h('div', { class: 'g-sub', style: 'max-width:430px' }, 'Take turns drawing lines between the dots. Complete a box and it\u2019s yours — plus another line. When the grid fills, most boxes wins.'),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'start' }) }, 'Start ▣'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === myRole;
      const mine = Object.values(s.boxes).filter((v) => v === myRole).length;
      const theirs = BOX_TOTAL - mine;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, s.winner === 'tie' ? '🤝' : (iWon ? '🏆' : '⬚')),
        h('div', { class: 'g-prompt' }, s.winner === 'tie' ? 'Dead even!' : iWon ? 'Most boxes — you win! 🎉' : `${api.peerName} claimed more boxes`),
        h('div', { class: 'g-sub' }, `Boxes — you ${mine} · them ${theirs}`),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'rematch' }) }, 'Play again ▣'),
      ));
      return;
    }

    const myTurn = s.turn === myRole;
    const mine = Object.values(s.boxes).filter((v) => v === myRole).length;
    const theirs = BOX_TOTAL - mine;
    el.append(h('div', { class: 'g-center', style: 'gap:10px' },
      h('div', { class: 'scoreline' },
        h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, String(mine)), ' boxes'),
        h('div', { class: 'sc' }, myTurn ? 'your line' : `${api.peerName}\u2019s line`),
        h('div', { class: 'sc' }, h('b', {}, String(theirs)), ' ', api.peerName)),
      elsB,
      h('div', { class: 'g-sub' + (myTurn ? ' turn-glow' : '') },
        myTurn ? 'Tap between two dots to draw a line' : `Waiting for ${api.peerName}…`),
    ));
  },
});

/* persistent board — dots, clickable edges, box fills (rebuilt only once) */
function buildBoard() {
  if (elsB) return;
  elsB = h('div', { class: 'dbboard' });
  const pct = (i) => (i / (DOTS - 1)) * 100;
  const mkEdge = (id, cls, x, y, w, hh) => {
    const e = h('button', { class: 'dbedge ' + cls, 'data-edge': id, style: `left:${x}%; top:${y}%; width:${w}%; height:${hh}%` });
    e.addEventListener('click', () => {
      const cur = active();
      if (!cur || cur.id !== 'dotsboxes' || cur.state.phase !== 'play') return;
      if (cur.state.lines[id] || cur.state.turn !== myRole) { sfx.miss(); return; }
      act({ type: 'line', edgeId: id });
      sfx.tap(); haptic(buzz.tap);
    });
    elsB.append(e);
  };
  for (let r = 0; r < DOTS; r++) for (let c = 0; c < DOTS - 1; c++) {
    const w = 100 / (DOTS - 1);
    mkEdge('H' + r + ':' + c, 'h', pct(c) + w * 0.2, pct(r) - 3, w * 0.6, 6);
  }
  for (let r = 0; r < DOTS - 1; r++) for (let c = 0; c < DOTS; c++) {
    const hh = 100 / (DOTS - 1);
    mkEdge('V' + r + ':' + c, 'v', pct(c) - 3, pct(r) + hh * 0.2, 6, hh * 0.6);
  }
  for (let r = 0; r < DOTS - 1; r++) for (let c = 0; c < DOTS - 1; c++) {
    elsB.append(h('div', { class: 'dbbox', 'data-box': r + ':' + c, style: `left:${pct(c)}%; top:${pct(r)}%; width:${100 / (DOTS - 1)}%; height:${100 / (DOTS - 1)}%` }));
  }
  for (let r = 0; r < DOTS; r++) for (let c = 0; c < DOTS; c++) {
    elsB.append(h('div', { class: 'dbdot', style: `left:${pct(c)}%; top:${pct(r)}%` }));
  }
}

function paint(s) {
  for (const [id, role] of Object.entries(s.lines)) {
    const e = elsB.querySelector(`[data-edge="${CSS.escape(id)}"]`);
    if (e) { e.classList.add('claimed', role); e.disabled = true; }
  }
  for (const [key, role] of Object.entries(s.boxes)) {
    const b = elsB.querySelector(`[data-box="${CSS.escape(key)}"]`);
    if (b) { b.classList.add('claimed', role); b.textContent = role === 'host' ? '💖' : '💙'; }
  }
}
