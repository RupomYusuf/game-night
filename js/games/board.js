/* Board games: Tic Tac Toe, Connect Four, Memory Match.
   Each registers itself with the engine. Deterministic reducers. */
import { registerGame } from './engine.js';
import { h } from '../ui.js';
import { sfx } from '../sound.js';

const nameOf = (role, api) => role === 'host' ? (api.isHost ? api.myName : api.peerName) : (api.isHost ? api.peerName : api.myName);
const playAgainBtn = (state, api) => h('button', { class: 'btn btn-primary', onclick: () => api.act({ type: 'rematch' }) }, 'Play again 💫');

/* ============================ TIC TAC TOE ============================ */

registerGame({
  id: 'tictactoe', name: 'Tic Tac Toe', tag: 'Classic 3×3 — first to three', icon: '❌⭕', section: 'classic',
  init() {
    return { board: Array(9).fill(null), turn: 'host', winner: null, line: null, score: { host: 0, guest: 0 }, round: 1 };
  },
  reduce(s, a) {
    if (s.winner && a.type !== 'rematch') return s;
    if (a.type === 'rematch') {
      const nextStarter = s.round % 2 === 0 ? 'host' : 'guest';
      return { ...s, board: Array(9).fill(null), turn: nextStarter, winner: null, line: null, round: s.round + 1 };
    }
    if (a.type !== 'move' || a.by !== s.turn || s.board[a.i]) return s;
    const board = [...s.board];
    board[a.i] = a.by;
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const line = LINES.find((l) => board[l[0]] && board[l[0]] === board[l[1]] && board[l[1]] === board[l[2]]);
    if (line) return { ...s, board, line, winner: a.by, score: { ...s.score, [a.by]: s.score[a.by] + 1 } };
    if (board.every(Boolean)) return { ...s, board, winner: 'tie' };
    return { ...s, board, turn: a.by === 'host' ? 'guest' : 'host' };
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    const sym = (r) => (r === 'host' ? '❌' : '⭕');
    el.append(
      h('div', { class: 'scoreline' },
        h('div', { class: 'sc' }, '❌ ', api.myName, ' ', h('b', {}, s.score[ctx.myRole])),
        h('div', { class: 'sc' }, '⭕ ', api.peerName, ' ', h('b', {}, s.score[ctx.myRole === 'host' ? 'guest' : 'host'])),
      ),
      h('div', { class: 'g-center' },
        !s.winner
          ? h('div', { class: 'turn-tag' }, (s.turn === ctx.myRole ? 'Your' : `${api.peerName}'s`), ' turn ', sym(s.turn))
          : h('div', { class: 'g-prompt' },
              s.winner === 'tie' ? 'A perfect draw 🤝' : (s.winner === ctx.myRole ? 'You win! 🎉' : `${api.peerName} wins 🎉`)),
        h('div', { class: 'board-ttt' },
          s.board.map((v, i) => h('button', {
            class: `cell-ttt ${v || ''} ${s.line && s.line.includes(i) ? 'win' : ''}`,
            disabled: !!v || !!s.winner || s.turn !== ctx.myRole,
            onclick: () => api.act({ type: 'move', i }),
          }, v ? (v === 'host' ? '❌' : '⭕') : '')),
        ),
        s.winner ? playAgainBtn(s, api) : null,
      ),
    );
  },
});

/* ============================ CONNECT FOUR ============================ */

registerGame({
  id: 'connect4', name: 'Connect Four', tag: 'Drop four in a row', icon: '🔴🟡', section: 'classic',
  init() {
    return { grid: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 'host', winner: null, winCells: null, score: { host: 0, guest: 0 }, round: 1, full: false };
  },
  reduce(s, a) {
    if (s.winner || s.full) {
      if (a.type !== 'rematch') return s;
      return { ...s, grid: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: s.round % 2 === 0 ? 'host' : 'guest', winner: null, winCells: null, full: false, round: s.round + 1 };
    }
    if (a.type !== 'drop' || a.by !== s.turn) return s;
    const grid = s.grid.map((r) => [...r]);
    let row = -1;
    for (let r = 5; r >= 0; r--) if (!grid[r][a.col]) { row = r; break; }
    if (row < 0) return s;
    grid[row][a.col] = a.by;
    const at = (r, c) => (r >= 0 && r < 6 && c >= 0 && c < 7 && grid[r][c] === a.by);
    let winCells = null;
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      const cells = [[row, a.col]];
      for (let k = 1; k < 4; k++) { if (at(row + dr * k, a.col + dc * k)) cells.push([row + dr * k, a.col + dc * k]); else break; }
      for (let k = 1; k < 4; k++) { if (at(row - dr * k, a.col - dc * k)) cells.push([row - dr * k, a.col - dc * k]); else break; }
      if (cells.length >= 4) { winCells = cells; break; }
    }
    if (winCells) return { ...s, grid, winCells, winner: a.by, score: { ...s.score, [a.by]: s.score[a.by] + 1 } };
    if (grid[0].every(Boolean)) return { ...s, grid, full: true };
    return { ...s, grid, turn: a.by === 'host' ? 'guest' : 'host', lastDrop: [row, a.col] };
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    const coin = (r) => (r === 'host' ? '🔴' : '🟡');
    el.append(
      h('div', { class: 'scoreline' },
        h('div', { class: 'sc' }, coin('host'), ' ', h('b', {}, s.score.host), ' — ', h('b', {}, s.score.guest), ' ', coin('guest')),
      ),
      h('div', { class: 'g-center' },
        !s.winner && !s.full
          ? h('div', { class: 'turn-tag' }, s.turn === ctx.myRole ? 'Your drop 🔽' : `${api.peerName} is thinking…`)
          : h('div', { class: 'g-prompt' }, s.full ? 'Board is full — draw! 🤝' : (s.winner === ctx.myRole ? 'Four in a row — you win! 🎉' : `${api.peerName} connected four 🎉`)),
        h('div', { class: 'board-c4' },
          s.grid.flatMap((rowArr, r) => rowArr.map((v, c) => h('button', {
            class: `slot ${v === 'host' ? 'p1' : v === 'guest' ? 'p2' : ''} ${s.winCells?.some(([wr, wc]) => wr === r && wc === c) ? 'win' : ''} ${s.lastDrop && s.lastDrop[0] === r && s.lastDrop[1] === c ? 'drop-anim' : ''}`,
            disabled: !!v || !!s.winner || s.full || s.turn !== ctx.myRole,
            onclick: () => api.act({ type: 'drop', col: c }),
          }))),
        ),
        (s.winner || s.full) ? playAgainBtn(s, api) : null,
      ),
    );
  },
});

/* ============================ MEMORY MATCH ============================
   5×5 grid: 12 pairs + one golden heart bonus tile in the center. */

const MEM_EMOJI = ['🌹','🍫','🍷','🌙','⭐','🦢','🍒','💌','🕯️','🎸','🧸','🍓'];
const shuffleArr = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

registerGame({
  id: 'memory', name: 'Memory Match', tag: '5×5 — match the pairs', icon: '🃏', section: 'classic',
  fill(a) { // host fills a fresh shuffle
    if (a.type === 'rematch') {
      const deck = shuffleArr([...MEM_EMOJI, ...MEM_EMOJI]);
      deck.splice(12, 0, 'bonus'); // 25th tile
      a.deck = deck;
    }
  },
  init() {
    const deck = shuffleArr([...MEM_EMOJI, ...MEM_EMOJI]);
    deck.splice(12, 0, 'bonus');
    return { deck, flipped: [], done: [], bonusTaken: false, turn: 'host', score: { host: 0, guest: 0 }, busy: false, winner: null, round: 1 };
  },
  canOptimistic(a) { return a.type !== 'rematch'; }, // rematch needs host's fresh shuffle
  reduce(s, a) {
    if (s.winner && a.type !== 'rematch') return s;
    if (a.type === 'rematch') {
      if (!a.deck) return s;
      return { ...s, deck: a.deck, flipped: [], done: [], bonusTaken: false, turn: s.round % 2 === 0 ? 'host' : 'guest', busy: false, winner: null, round: s.round + 1 };
    }
    if (a.type !== 'flip' || s.busy || a.by !== s.turn) return s;
    const i = a.i;
    if (s.done.includes(i) || s.flipped.includes(i) || i == null) return s;

    // golden heart bonus tile
    if (s.deck[i] === 'bonus') {
      const done = [...s.done, i];
      const score = { ...s.score, [a.by]: s.score[a.by] + 1 };
      const next = { ...s, done, bonusTaken: true, score, flipped: [] };
      if (done.length === 25) return { ...next, winner: score.host === score.guest ? 'tie' : (score.host > score.guest ? 'host' : 'guest') };
      return next;
    }

    const flipped = [...s.flipped, i];
    if (flipped.length < 2) return { ...s, flipped, busy: false };

    // two cards revealed — resolve
    const [x, y] = flipped;
    if (s.deck[x] === s.deck[y]) {
      const done = [...s.done, x, y];
      const score = { ...s.score, [a.by]: s.score[a.by] + 1 };
      const next = { ...s, flipped: [], done, score, busy: false }; // match → go again
      if (done.length === 25) return { ...next, winner: score.host === score.guest ? 'tie' : (score.host > score.guest ? 'host' : 'guest') };
      return next;
    }
    // no match: flip back and pass the turn — host timer resolves the visual pause
    return { ...s, flipped, busy: true, missAt: Date.now(), missTurn: a.by === 'host' ? 'guest' : 'host' };
  },
  tick(s, { act, now }) {
    if (s.busy && s.missAt && now - s.missAt > 950) {
      return { ...s, flipped: [], busy: false, turn: s.missTurn, missAt: null };
    }
    return null;
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    el.append(
      h('div', { class: 'scoreline' },
        h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, s.score[ctx.myRole])),
        h('div', { class: 'sc' }, api.peerName, ' ', h('b', {}, s.score[ctx.myRole === 'host' ? 'guest' : 'host'])),
      ),
      h('div', { class: 'g-center' },
        s.winner
          ? h('div', { class: 'g-prompt' }, s.winner === 'tie' ? 'All matched — a tie! 🤝' : (s.winner === ctx.myRole ? 'Sharpest memory — you win! 🧠🎉' : `${api.peerName} remembered best 🧠`))
          : h('div', { class: 'turn-tag' }, s.busy ? 'No match…' : (s.turn === ctx.myRole ? 'Your turn — flip two 💫' : `${api.peerName}'s turn`)),
        h('div', { class: 'board-mem' },
          s.deck.map((face, i) => {
            const shown = s.done.includes(i) || s.flipped.includes(i);
            const isBonus = face === 'bonus';
            return h('button', {
              class: `mem-card ${shown ? 'flip' : ''} ${s.done.includes(i) ? 'done' : ''} ${isBonus ? 'heart' : ''}`,
              disabled: shown || s.busy || !!s.winner || s.turn !== ctx.myRole,
              onclick: () => { sfx.tap(); api.act({ type: 'flip', i }); },
            }, h('div', { class: 'mem-inner' },
              h('div', { class: 'mem-face mem-back' }, '💞'),
              h('div', { class: 'mem-face mem-front' }, isBonus ? '👑' : face)));
          }),
        ),
        s.winner ? playAgainBtn(s, api) : null,
      ),
    );
  },
});
