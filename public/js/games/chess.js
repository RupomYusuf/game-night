/* Chess — full rules: legal move generation with king safety, castling,
   en passant, promotion, check/checkmate/stalemate, 50-move rule, threefold
   repetition and insufficient material. No hidden information, so the whole
   position lives in shared state; every move is validated by the reducer on
   both devices. Host plays white. */
import { registerGame, act, active } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const START_BACK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
const els = {};                                      // persistent board pieces (survive re-renders)

function initBoard() {
  const b = Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    b[c] = { t: START_BACK[c], c: 'b' };
    b[8 + c] = { t: 'p', c: 'b' };
    b[48 + c] = { t: 'p', c: 'w' };
    b[56 + c] = { t: START_BACK[c], c: 'w' };
  }
  return b;
}
const rc = (sq) => [Math.floor(sq / 8), sq % 8];
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

/* is `sq` attacked by color `by`? (reverse scan — no move generation needed) */
function attacked(board, sq, by) {
  const [r, c] = rc(sq);
  // pawns
  const pd = by === 'w' ? 1 : -1;               // white pawns attack upward (row decreases)
  for (const dc of [-1, 1]) if (inB(r + pd, c + dc)) { const p = board[(r + pd) * 8 + c + dc]; if (p && p.c === by && p.t === 'p') return true; }
  // knights
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    if (inB(r + dr, c + dc)) { const p = board[(r + dr) * 8 + c + dc]; if (p && p.c === by && p.t === 'n') return true; }
  }
  // king
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    if (inB(r + dr, c + dc)) { const p = board[(r + dr) * 8 + c + dc]; if (p && p.c === by && p.t === 'k') return true; }
  }
  // sliders
  const rays = [[[0,-1],'r'],[[0,1],'r'],[[-1,0],'r'],[[1,0],'r'],[[-1,-1],'b'],[[-1,1],'b'],[[1,-1],'b'],[[1,1],'b']];
  for (const [[dr, dc], kind] of rays) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = board[rr * 8 + cc];
      if (p) {
        if (p.c === by && (p.t === 'q' || p.t === kind)) return true;
        break;
      }
      rr += dr; cc += dc;
    }
  }
  return false;
}
const kingSq = (board, color) => board.findIndex((p) => p && p.c === color && p.t === 'k');
const inCheck = (board, color) => attacked(board, kingSq(board, color), color === 'w' ? 'b' : 'w');

/* pseudo-legal moves (king safety handled by legalMoves) */
function pseudoMoves(board, sq, castle, ep) {
  const p = board[sq];
  const [r, c] = rc(sq);
  const out = [];
  const push = (to, extra = {}) => out.push({ from: sq, to, ...extra });
  if (p.t === 'p') {
    const d = p.c === 'w' ? -1 : 1;
    const one = (r + d) * 8 + c;
    if (inB(r + d, c) && !board[one]) {
      push(one, { promo: (r + d) === 0 || (r + d) === 7 });
      const startRow = p.c === 'w' ? 6 : 1;
      const two = (r + 2 * d) * 8 + c;
      if (r === startRow && !board[two]) push(two, { dbl: true });
    }
    for (const dc of [-1, 1]) {
      if (!inB(r + d, c + dc)) continue;
      const to = (r + d) * 8 + c + dc;
      const t = board[to];
      if (t && t.c !== p.c) push(to, { promo: (r + d) === 0 || (r + d) === 7 });
      else if (to === ep) push(to, { ep: true });
    }
  } else if (p.t === 'n') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      if (inB(r + dr, c + dc)) { const to = (r + dr) * 8 + c + dc; if (!board[to] || board[to].c !== p.c) push(to); }
    }
  } else if (p.t === 'k') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (inB(r + dr, c + dc)) { const to = (r + dr) * 8 + c + dc; if (!board[to] || board[to].c !== p.c) push(to); }
    }
    // castling: king on its square via rights, path empty, not through/into check
    const enemy = p.c === 'w' ? 'b' : 'w';
    const homeRow = p.c === 'w' ? 7 : 0;
    if (sq === homeRow * 8 + 4 && !inCheck(board, p.c)) {
      const kRight = p.c === 'w' ? castle.wK : castle.bK;
      const qRight = p.c === 'w' ? castle.wQ : castle.bQ;
      if (kRight && !board[homeRow * 8 + 5] && !board[homeRow * 8 + 6]
        && !attacked(board, homeRow * 8 + 5, enemy) && !attacked(board, homeRow * 8 + 6, enemy)) push(homeRow * 8 + 6, { castle: 'K' });
      if (qRight && !board[homeRow * 8 + 1] && !board[homeRow * 8 + 2] && !board[homeRow * 8 + 3]
        && !attacked(board, homeRow * 8 + 3, enemy) && !attacked(board, homeRow * 8 + 2, enemy)) push(homeRow * 8 + 2, { castle: 'Q' });
    }
  } else {
    const rays = p.t === 'r' ? [[0,-1],[0,1],[-1,0],[1,0]]
      : p.t === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of rays) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc)) {
        const to = rr * 8 + cc;
        if (!board[to]) push(to);
        else { if (board[to].c !== p.c) push(to); break; }
        rr += dr; cc += dc;
      }
    }
  }
  return out;
}

function applyMove(board, m) {
  const b = [...board];
  const p = { ...b[m.from] };
  b[m.from] = null;
  if (m.ep) b[m.to + (p.c === 'w' ? 8 : -8)] = null;            // en passant capture
  if (m.promo && p.t === 'p') p.t = m.promoPiece || 'q';
  b[m.to] = p;
  if (m.castle) {
    const row = p.c === 'w' ? 7 : 0;
    if (m.castle === 'K') { b[row * 8 + 5] = b[row * 8 + 7]; b[row * 8 + 7] = null; }
    else { b[row * 8 + 3] = b[row * 8 + 0]; b[row * 8 + 0] = null; }
  }
  return b;
}

function legalMoves(board, color, castle, ep) {
  const out = [];
  board.forEach((p, sq) => {
    if (!p || p.c !== color) return;
    for (const m of pseudoMoves(board, sq, castle, ep)) {
      const nb = applyMove(board, m);
      if (!attacked(nb, kingSq(nb, color), color === 'w' ? 'b' : 'w')) out.push(m);
    }
  });
  return out;
}

function posKey(s) {
  return s.board.map((p) => (p ? (p.c === 'w' ? p.t.toUpperCase() : p.t) : '.')).join('')
    + '|' + s.turn + '|' + JSON.stringify(s.castle) + '|' + (s.ep ?? '-');
}
function insufficient(board) {
  const pieces = board.filter(Boolean).map((p) => p.c + p.t);
  if (pieces.length > 3) return false;
  const minors = pieces.filter((x) => /[wb][bn]/.test(x)).length;
  return pieces.length === 2 || (pieces.length === 3 && minors === 1);
}

function newGame() {
  return { phase: 'play', round: 1, turn: 'w', board: initBoard(), castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, half: 0, counts: {}, winner: null, endReason: null, lastMove: null };
}
const settle = (s) => {
  const key = posKey(s);
  const counts = { ...s.counts, [key]: (s.counts[key] || 0) + 1 };
  const next = { ...s, counts };
  const moves = legalMoves(next.board, next.turn, next.castle, next.ep);
  if (!moves.length) {
    const checked = inCheck(next.board, next.turn);
    return { ...next, phase: 'over', winner: checked ? (next.turn === 'w' ? 'b' : 'w') : null, endReason: checked ? 'checkmate' : 'stalemate' };
  }
  if (counts[key] >= 3) return { ...next, phase: 'over', winner: null, endReason: 'threefold repetition' };
  if (next.half >= 100) return { ...next, phase: 'over', winner: null, endReason: '50-move rule' };
  if (insufficient(next.board)) return { ...next, phase: 'over', winner: null, endReason: 'insufficient material' };
  return next;
};

registerGame({
  id: 'chess', name: 'Chess', tag: 'Full rules — mate them properly', icon: '♟️', section: 'classic',
  init() { return newGame(); },
  reduce(s, a) {
    if (a.type === 'rematch' && s.phase === 'over') {
      return { ...newGame(), round: s.round + 1 };
    }
    if (s.phase !== 'play') return s;
    if (a.type === 'move') {
      const color = a.by === 'host' ? 'w' : 'b';        // host plays white, guest black
      if (color !== s.turn) return s;
      const legal = legalMoves(s.board, color, s.castle, s.ep).find((m) => m.from === a.from && m.to === a.to);
      if (!legal) return s;
      if (legal.promo && !['q', 'r', 'b', 'n'].includes(a.promoPiece)) return s;
      const board = applyMove(s.board, { ...legal, promoPiece: a.promoPiece });
      const captured = !!s.board[legal.to] || legal.ep;
      // castling rights die when the king or a corner rook moves (or is captured)
      const castle = { ...s.castle };
      if (legal.castle) {
        if (legal.castle === 'K') { color === 'w' ? (castle.wK = castle.wQ = false) : (castle.bK = castle.bQ = false); }
        else { color === 'w' ? (castle.wK = castle.wQ = false) : (castle.bK = castle.bQ = false); }
      }
      if (color === 'w' && a.from === 60) castle.wK = castle.wQ = false;
      if (color === 'w' && a.from === 56) castle.wQ = false;
      if (color === 'w' && a.from === 63) castle.wK = false;
      if (color === 'b' && a.from === 4) castle.bK = castle.bQ = false;
      if (color === 'b' && a.from === 0) castle.bQ = false;
      if (color === 'b' && a.from === 7) castle.bK = false;
      [0, 7, 56, 63].forEach((sq) => {
        if (a.to === sq) {
          if (sq === 56) castle.wQ = false; if (sq === 63) castle.wK = false;
          if (sq === 0) castle.bQ = false; if (sq === 7) castle.bK = false;
        }
      });
      const ep = legal.dbl ? ((legal.from + legal.to) / 2) : null;
      const half = (captured || s.board[legal.from].t === 'p') ? 0 : s.half + 1;
      return settle({
        ...s, board, castle, ep, half, lastMove: { from: legal.from, to: legal.to },
        turn: color === 'w' ? 'b' : 'w',
      });
    }
    return s;
  },
  view(el, s, ctx, api) {
    const myColor = ctx.myRole === 'host' ? 'w' : 'b';
    const myTurn = s.turn === myColor;
    const legal = s.phase === 'play' && myTurn ? legalMoves(s.board, myColor, s.castle, s.ep) : [];

    const sel = els.sel;                             // {from, targets: [sq]} for the tapped piece
    const targets = sel ? legal.filter((m) => m.from === sel.from) : [];

    if (s.phase === 'lobby') { /* never shown — chess starts in play */ }

    const boardEl = els.board || (() => {
      els.board = h('div', { class: 'chboard' });
      els.sqs = [];
      for (let sq = 0; sq < 64; sq++) {
        const d = h('div', { class: 'chcell' });
        d.addEventListener('click', () => {
          const cur = active();
          if (!cur || cur.id !== 'chess' || cur.state.phase !== 'play') return;
          const st = cur.state;
          if (st.turn !== myColor) return;
          if (els.sel) {
            const mv = legal.find((m) => m.from === els.sel.from && m.to === sq);
            if (mv) {
              if (mv.promo) { askPromo((pc) => act({ type: 'move', from: mv.from, to: mv.to, promoPiece: pc })); els.sel = null; return; }
              els.sel = null;
              const cap = !!st.board[mv.to] || mv.ep;
              act({ type: 'move', from: mv.from, to: mv.to, promoPiece: mv.promoPiece });
              cap ? sfx.match() : sfx.pop(); haptic(buzz.tap);
              return;
            }
          }
          const p = st.board[sq];
          if (p && p.c === myColor) {
            els.sel = { from: sq };
            sfx.tap();
          } else els.sel = null;
        });
        els.sqs.push(d);
        els.board.append(d);
      }
      document.body.addEventListener('click', (e) => { if (!e.target.closest('.chboard')) els.sel = null; }, true);
      return els.board;
    })();

    // paint the board (guest sees black at the bottom)
    const flip = myColor === 'b';
    for (let vis = 0; vis < 64; vis++) {
      const sq = flip ? 63 - vis : vis;
      const [r, c] = rc(sq);
      const cell = els.sqs[vis];
      cell.className = 'chcell ' + ((r + c) % 2 ? 'dark' : 'light')
        + (s.lastMove && (s.lastMove.from === sq || s.lastMove.to === sq) ? ' last' : '');
      cell.textContent = s.board[sq] ? GLYPH[s.board[sq].t] : '';
      if (s.board[sq]) cell.classList.add(s.board[sq].c === 'w' ? 'pw' : 'pb');
      const isTarget = targets.some((m) => m.to === sq);
      const isFrom = els.sel && els.sel.from === sq;
      if (isFrom) cell.classList.add('from');
      if (isTarget) cell.classList.add(s.board[sq] ? 'capture' : 'target');
      if (s.board[sq]?.t === 'k' && s.board[sq].c === s.turn && s.phase === 'play' && inCheck(s.board, s.turn)) cell.classList.add('check');
    }

    const statusText = s.phase === 'over'
      ? (s.winner ? (s.winner === myColor ? 'Checkmate — you win! 🎉' : `Checkmate — ${api.peerName} wins`) : `Draw — ${s.endReason}`)
      : myTurn ? (inCheck(s.board, s.turn) ? 'You are in CHECK — save your king!' : 'Your move') : `${api.peerName} is thinking…`;

    el.append(
      h('div', { class: 'g-center', style: 'gap:10px' },
        h('div', { class: 'scoreline' },
          h('div', { class: 'sc' }, '⚪ ', h('b', {}, ctx.myRole === 'host' ? api.myName : api.peerName)),
          h('div', { class: 'sc' }, s.phase === 'over' ? s.endReason : ''),
          h('div', { class: 'sc' }, h('b', {}, ctx.myRole === 'host' ? api.peerName : api.myName), ' ⚫'),
        ),
        boardEl,
        h('div', { class: 'g-sub' + (myTurn && s.phase === 'play' ? ' turn-glow' : '') }, statusText),
        s.phase === 'over' ? h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'rematch' }) }, 'New game ♟️') : null,
      ),
    );
  },
});

function askPromo(cb) {
  document.getElementById('chpromo')?.remove();
  const row = h('div', { class: 'g-center', style: 'gap:12px' },
    ...['q', 'r', 'b', 'n'].map((pc) => h('button', {
      class: 'chpromo-btn',
      onclick: () => { row.remove(); cb(pc); },
    }, GLYPH[pc])));
  row.id = 'chpromo';
  row.style.cssText = 'position:fixed; inset:0; background:rgba(4,4,10,.85); z-index:90; backdrop-filter:blur(6px)';
  document.body.append(row);
}
