/* Hangman Duel — one of you picks a secret word (it stays on your device; only
   the length and hint cross the wire), the other guesses letters while the
   stickman appears: six wrong guesses and the round is lost. Roles swap every
   round, first to 3 round-wins takes the match. The guesser can solve the
   whole word at any time — a wrong solve loses the round.
   Public state carries only the revealed letter positions; the word itself
   never leaves the word-master's device until the round ends. */
import { registerGame, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const MAX_WRONG = 6;
const TARGET = 3;
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/* positions where `letter` occurs in `word` (case-insensitive) — pure */
function computePositions(word, letter) {
  const w = String(word || '').toUpperCase();
  const L = String(letter || '').toUpperCase();
  const out = [];
  for (let i = 0; i < w.length; i++) if (w[i] === L) out.push(i);
  return out;
}

let myWord = null;            // the word master's secret — this device only
let resolvedKey = null;       // pending guess/solve already resolved on this device

registerGame({
  id: 'hangman', name: 'Hangman Duel', tag: 'Save the stickman — guess the word', icon: '🪢', section: 'classic',
  init() { return { phase: 'lobby', round: 0, wordMaster: null, wordLen: 0, hint: '', reveals: {}, wrong: [], wrongCount: 0, pendingLetter: null, pendingSolve: null, roundOver: null, score: { host: 0, guest: 0 }, winner: null }; },
  canOptimistic(a) { return a.type !== 'start'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      const round = 1;                       // every fresh match starts at round 1 (host picks first)
      return { ...s, phase: 'play', round, wordMaster: round % 2 === 1 ? 'host' : 'guest', wordLen: 0, hint: '', reveals: {}, wrong: [], wrongCount: 0, pendingLetter: null, pendingSolve: null, roundOver: null, winner: null, score: { host: 0, guest: 0 } };
    }
    if (s.phase !== 'play') return s;

    if (a.type === 'wordSet') {
      if (a.by !== s.wordMaster || s.wordLen > 0) return s;
      return { ...s, wordLen: Math.max(2, Math.min(14, a.len | 0)), hint: String(a.hint || '').slice(0, 40) };
    }

    if (a.type === 'guess') {
      if (a.by === s.wordMaster || s.wordLen === 0 || s.roundOver || s.pendingLetter || s.pendingSolve) return s;
      const letter = String(a.letter || '').toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return s;
      if (s.correct?.includes(letter) || s.wrong.includes(letter) || s.reveals[letter]) return s;
      return { ...s, pendingLetter: letter };
    }

    if (a.type === 'solve') {
      if (a.by === s.wordMaster || s.wordLen === 0 || s.roundOver || s.pendingSolve || s.pendingLetter) return s;
      return { ...s, pendingSolve: String(a.word || '').toUpperCase().slice(0, 14) };
    }

    if (a.type === 'result') {
      // the word master resolves the pending letter guess: which positions (if any)
      if (a.by !== s.wordMaster || !s.pendingLetter || s.roundOver) return s;
      const letter = s.pendingLetter;
      if (s.reveals[letter] || s.wrong.includes(letter)) return { ...s, pendingLetter: null };
      const positions = (Array.isArray(a.positions) ? a.positions : []).filter((p) => Number.isInteger(p) && p >= 0 && p < s.wordLen);
      const reveals = { ...s.reveals };
      if (positions.length) reveals[letter] = positions;
      const wrong = positions.length ? s.wrong : [...s.wrong, letter];
      return { ...s, reveals, wrong, wrongCount: wrong.length, pendingLetter: null };
    }

    if (a.type === 'roundEnd') {
      // the word master settles the round: word filled (guesser wins) or stickman done (master wins)
      if (a.by !== s.wordMaster || s.roundOver) return s;
      const winner = a.winner === 'guesser' ? (s.wordMaster === 'host' ? 'guest' : 'host') : s.wordMaster;
      const score = { ...s.score, [winner]: s.score[winner] + 1 };
      const roundOver = { winner, word: String(a.word || '').slice(0, 14) };
      if (score[winner] >= TARGET) return { ...s, roundOver, score, phase: 'over', winner };
      return { ...s, roundOver, score };
    }

    if (a.type === 'nextRound') {
      if (!s.roundOver) return s;
      const round = s.round + 1;
      return { ...s, round, wordMaster: round % 2 === 1 ? 'host' : 'guest', wordLen: 0, hint: '', reveals: {}, wrong: [], wrongCount: 0, pendingLetter: null, pendingSolve: null, roundOver: null };
    }
    return s;
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    const myRole = ctx.myRole;
    const iAmMaster = s.wordMaster === myRole;
    const myTurn = !iAmMaster && !s.roundOver && s.wordLen > 0 && !s.pendingLetter && !s.pendingSolve;
    const covered = Object.values(s.reveals).reduce((sum, arr) => sum + arr.length, 0);

    if (s.phase === 'lobby') {
      myWord = null; resolvedKey = null;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🪢'),
        h('div', { class: 'g-prompt' }, 'Hangman Duel — save the stickman'),
        h('div', { class: 'g-sub', style: 'max-width:430px' }, 'One of you picks a secret word (it stays on your screen — only blanks cross the wire), the other guesses letters. Six mistakes and the stickman is done for. Roles swap every round — first to 3 round-wins takes the match.'),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'start' }) }, 'Start 🪢'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === myRole;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, iWon ? '🏆' : '🪢'),
        h('div', { class: 'g-prompt' }, iWon ? 'Match won — three rounds to you! 🎉' : `${api.peerName} wins the match`),
        h('button', { class: 'btn btn-primary', onclick: () => { myWord = null; resolvedKey = null; act({ type: 'rematch' }); } }, 'Play again 🪢'),
      ));
      return;
    }

    const scoreRow = h('div', { class: 'scoreline' },
      h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, String(s.score[myRole]))),
      h('div', { class: 'sc' }, `round ${s.round} · first to ${TARGET}`),
      h('div', { class: 'sc' }, h('b', {}, String(s.score[myRole === 'host' ? 'guest' : 'host'])), ' ', api.peerName));

    /* round finished → result screen */
    if (s.roundOver) {
      const iWon = s.roundOver.winner === myRole;
      el.append(h('div', { class: 'g-center', style: 'gap:10px' },
        scoreRow,
        h('div', { style: 'font-size:46px' }, iWon ? '🎉' : '💀'),
        h('div', { class: 'g-prompt' }, iWon ? 'You won the round!' : 'You lost this round…'),
        h('div', { class: 'g-sub' }, `The word was “${s.roundOver.word.toUpperCase()}”`),
        h('div', { class: 'g-sub' + (s.score[myRole] === TARGET - 1 ? ' turn-glow' : '') },
          `Score — you ${s.score[myRole]} · ${api.peerName} ${s.score[myRole === 'host' ? 'guest' : 'host']} — first to ${TARGET}`),
        h('button', { class: 'btn btn-primary', onclick: () => { myWord = null; resolvedKey = null; act({ type: 'nextRound' }); } }, 'Next round 🔁'),
      ));
      return;
    }

    /* word master picks the secret word */
    if (iAmMaster && s.wordLen === 0) {
      el.append(h('div', { class: 'g-center', style: 'gap:12px' },
        scoreRow,
        h('div', { style: 'font-size:46px' }, '🤫'),
        h('div', { class: 'g-prompt' }, 'Your turn to pick the secret word'),
        h('div', { class: 'g-sub' }, `${api.peerName} only ever sees blanks — the word itself never leaves your screen.`),
        h('input', { class: 'field', placeholder: 'Your secret word (2–14 letters)', maxlength: 14, id: 'hm-word', style: 'max-width:340px; text-align:center' }),
        h('input', { class: 'field', placeholder: 'Optional hint for them…', maxlength: 40, id: 'hm-hint', style: 'max-width:340px; text-align:center' }),
        h('button', {
          class: 'btn btn-hot',
          onclick: () => {
            const w = (el.querySelector('#hm-word')?.value || '').trim().toUpperCase();
            const hint = (el.querySelector('#hm-hint')?.value || '').trim();
            if (!/^[A-Z]{2,14}$/.test(w)) { sfx.miss(); return; }
            myWord = w;
            sfx.send(); haptic(buzz.tap);
            act({ type: 'wordSet', len: w.length, hint });
          },
        }, 'Lock it in 🔒'),
      ));
      return;
    }

    /* shared blanks — both screens render from the public reveals */
    const revealAt = Array(s.wordLen).fill('');
    for (const [letter, positions] of Object.entries(s.reveals)) positions.forEach((p) => { revealAt[p] = letter; });
    const blanks = h('div', { class: 'hmblanks' },
      ...revealAt.map((ch) => h('span', { class: 'hmblank' + (ch ? ' filled' : '') }, ch)));

    /* the word master resolves the pending guess / solve privately */
    if (iAmMaster && myWord && resolvedKey !== s.round + ':' + (s.pendingLetter || '') + (s.pendingSolve || '')) {
      if (s.pendingLetter) {
        const positions = computePositions(myWord, s.pendingLetter);
        const totalCovered = covered + positions.length;
        if (totalCovered >= s.wordLen) {
          resolvedKey = s.round + ':' + s.pendingLetter;
          act({ type: 'roundEnd', winner: 'guesser', word: myWord });
          sfx.win(); haptic(buzz.win);
        } else {
          resolvedKey = s.round + ':' + s.pendingLetter;
          act({ type: 'result', letter: s.pendingLetter, positions });
          positions.length ? sfx.match() : sfx.miss();
        }
      } else if (s.pendingSolve) {
        resolvedKey = s.round + ':solve';
        const correct = s.pendingSolve === myWord.toUpperCase();
        act({ type: 'roundEnd', winner: correct ? 'guesser' : 'master', word: myWord });
        correct ? (sfx.win(), haptic(buzz.win)) : (sfx.miss(), haptic(buzz.recv));
      }
    }

    el.append(h('div', { class: 'g-center', style: 'gap:10px' },
      scoreRow,
      hangmanSvg(s.wrongCount),
      h('div', { class: 'g-sub' }, `${s.wrongCount} of ${MAX_WRONG} wrong`),
      s.hint ? h('div', { class: 'g-sub', style: 'font-style:italic' }, `💡 ${s.hint}`) : null,
      blanks,
      iAmMaster
        ? h('div', { class: 'g-sub' }, `Your word: “${myWord || '…'}” — ${api.peerName} is guessing…`)
        : s.pendingSolve
          ? h('div', { class: 'g-sub' }, `Solving “${s.pendingSolve}”…`)
          : myTurn
            ? h('div', { class: 'g-sub turn-glow' }, 'Your guess — tap a letter')
            : h('div', { class: 'g-sub' }, `Waiting for ${api.peerName} to guess…`),
    ));

    /* the guesser's keyboard + solve (only rendered on the guesser's screen) */
    if (!iAmMaster && !s.pendingSolve && !s.pendingLetter) {
      const solveWrap = h('div', { class: 'hm-solve', style: 'display:none' },
        h('input', { class: 'field', placeholder: 'The whole word…', maxlength: 14, id: 'hm-solve', style: 'max-width:260px; text-align:center' }),
        h('button', {
          class: 'btn btn-hot btn-sm',
          onclick: () => {
            const v = (el.querySelector('#hm-solve')?.value || '').trim().toUpperCase();
            if (!v) return;
            act({ type: 'solve', word: v });
            sfx.whoosh(); haptic(buzz.tap);
          },
        }, 'Solve it 🎯'));
      const keys = h('div', { class: 'hmkeys' },
        ...ALPHA.map((L) => {
          const usedCorrect = !!s.reveals[L];
          const usedWrong = s.wrong.includes(L);
          return h('button', {
            class: 'hmkey' + (usedCorrect ? ' good' : '') + (usedWrong ? ' bad' : ''),
            disabled: usedCorrect || usedWrong,
            onclick: () => { act({ type: 'guess', letter: L }); sfx.tap(); haptic(buzz.tap); },
          }, L);
        }));
      el.append(h('div', { class: 'g-center' },
        solveWrap,
        keys,
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: () => { const w = el.querySelector('.hm-solve'); w.style.display = w.style.display === 'none' ? 'flex' : 'none'; },
        }, '🎯 Solve the whole word…'),
      ));
      const keydown = (e) => {
        if (!el.isConnected) { document.removeEventListener('keydown', keydown); return; }
        if (!/^[a-zA-Z]$/.test(e.key)) return;
        if (e.target && /^(input|textarea)$/i.test(e.target.tagName)) return;
        e.preventDefault();
        const L = e.key.toUpperCase();
        if (s.reveals[L] || s.wrong.includes(L)) return;
        act({ type: 'guess', letter: L });
        sfx.tap();
      };
      document.removeEventListener('keydown', keydown);
      document.addEventListener('keydown', keydown);
    }
  },
});

/* progressive stickman — every wrong letter draws one more part */
function hangmanSvg(wrongCount) {
  const part = (tag, attrs, nn) => h(tag, { ...attrs, class: 'hpart p' + nn + (wrongCount >= nn ? ' drawn' : '') });
  return h('svg', { class: 'hmsvg', viewBox: '0 0 200 200' },
    h('line', { x1: '30', y1: '180', x2: '110', y2: '180', class: 'hframe' }),
    h('line', { x1: '50', y1: '180', x2: '50', y2: '30', class: 'hframe' }),
    h('line', { x1: '50', y1: '30', x2: '100', y2: '30', class: 'hframe' }),
    h('line', { x1: '100', y1: '30', x2: '100', y2: '46', class: 'hframe rope' }),
    part('circle', { cx: '100', cy: '64', r: '17' }, 1),
    part('line', { x1: '100', y1: '81', x2: '100', y2: '135' }, 2),
    part('line', { x1: '100', y1: '95', x2: '76', y2: '115' }, 3),
    part('line', { x1: '100', y1: '95', x2: '124', y2: '115' }, 4),
    part('line', { x1: '100', y1: '135', x2: '78', y2: '168' }, 5),
    part('line', { x1: '100', y1: '135', x2: '122', y2: '168' }, 6),
    wrongCount >= MAX_WRONG ? h('text', { x: '100', y: '192', 'text-anchor': 'middle', class: 'hmdead' }, 'GAME OVER') : null,
  );
}
