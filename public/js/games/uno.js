/* UNO Duel (2-player) — hidden hands, public counts.
   Hands never travel the wire: each device draws its own cards from a local
   pool of "cards not visible to it" and only hand SIZES, the discard pile and
   the active color are shared through the engine. That keeps the reducer
   deterministic where it matters (turns, penalties, win) without leaking hands.
   Rules: 2-player official-flavored — Skip/Reverse both grant another turn,
   Draw Two / Wild+4 make the partner draw and lose their turn. */
import { registerGame, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const COLOR_HEX = { R: '#ff5f6d', Y: '#ffb02e', G: '#2fbf71', B: '#4f9dff', W: '#2a2a3a' };
const COLOR_NAME = { R: 'Red', Y: 'Yellow', G: 'Green', B: 'Blue' };
const ALL_CARDS = (() => {
  const d = [];
  for (const c of ['R', 'Y', 'G', 'B']) {
    d.push(c + '0');
    for (let v = 1; v <= 9; v++) d.push(c + v, c + v);
    for (const a of ['S', 'Rv', 'D2']) d.push(c + a, c + a);
  }
  for (let i = 0; i < 4; i++) d.push('W', 'WD4');
  return d;
})();
const isWild = (c) => c[0] === 'W';
const cardVal = (c) => (c[0] === 'W' ? c : c.slice(1));   // wild ids ('W', 'WD4') must not lose their W
const CARD_LABEL = { S: '⊘', Rv: '⇄', D2: '+2', W: '★', WD4: '+4' };
const labelOf = (c) => CARD_LABEL[cardVal(c)] ?? cardVal(c);

let myRole = 'host';

/* ---------------- my private hand ---------------- */
let myHand = [];          // card ids only this device knows
let handStamp = 0;        // increments when my hand changes → drives deal animations
let lastSeen = {};        // animation change-detection markers

/* multiset difference — cards appear twice in the deck, counts matter */
function multisetMinus(all, ...take) {
  const counts = new Map();
  for (const c of all) counts.set(c, (counts.get(c) || 0) + 1);
  for (const list of take) for (const c of list) counts.set(c, (counts.get(c) || 0) - 1);
  const pool = [];
  for (const [c, n] of counts) for (let i = 0; i < n; i++) pool.push(c);
  return pool;
}

/* cards I cannot see = full deck − my hand − public discard */
function unknownPool(s) {
  return multisetMinus(ALL_CARDS, myHand, s.discard);
}
const oppCountPublic = (s) => s.counts[myRole === 'host' ? 'guest' : 'host'];

function drawLocal(n, s) {
  let pool = unknownPool(s);
  let reshuffled = false;
  // the face-down deck (pool minus the cards the opponent actually holds) is short → recycle discards
  if (pool.length - oppCountPublic(s) < n) {
    pool = multisetMinus(ALL_CARDS, myHand, [s.discard[s.discard.length - 1]]);
    reshuffled = true;
  }
  const drawn = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  myHand.push(...drawn);
  handStamp++;
  return { drawn, reshuffled };
}

function isPlayable(card, s) {
  if (isWild(card)) return true;
  return card[0] === s.chosen || cardVal(card) === cardVal(s.top);
}

function resetLocal() {
  myHand = [];
  handStamp++;
  lastSeen = { handStamp: null, top: null, opp: null, pendingId: null };
}

function dealInitial(s) {
  resetLocal();
  const pool = multisetMinus(ALL_CARDS, [s.top]);
  for (let i = 0; i < 7; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    myHand.push(pool.splice(idx, 1)[0]);
  }
  handStamp++;
}

/* ---------------- animations (CSS classes applied on change) ---------------- */
function animFlags(s) {
  const flags = {};
  if (lastSeen.top !== s.top) { flags.topPop = lastSeen.top !== null; lastSeen.top = s.top; }
  if (lastSeen.handStamp !== handStamp) { flags.handDeal = lastSeen.handStamp !== null; lastSeen.handStamp = handStamp; }
  const oppN = s.counts[myRole === 'host' ? 'guest' : 'host'];
  if (lastSeen.opp !== oppN) { flags.oppDeal = lastSeen.opp !== null; lastSeen.opp = oppN; }
  return flags;
}

function cardEl(card, opts = {}) {
  const wild = isWild(card);
  const col = wild ? COLOR_HEX.W : COLOR_HEX[card[0]];
  const cls = 'ucard' + (opts.back ? ' back' : '') + (opts.playable ? ' playable' : '') + (opts.dim ? ' dim' : '') + (opts.pop ? ' pop' : '') + (opts.sm ? ' sm' : '');
  return h('div', { class: cls, style: `--uc:${col}`, 'data-card': opts.back ? '' : card },
    opts.back ? h('div', { class: 'uc-back' }, '🌙')
      : h('div', { class: 'uc-inner' },
          h('span', { class: 'uc-corner' }, labelOf(card)),
          h('span', { class: 'uc-face' }, labelOf(card)),
          h('span', { class: 'uc-corner b' }, labelOf(card))));
}

function pickColor(cb) {
  document.getElementById('uno-pick')?.remove();
  const row = h('div', { class: 'g-center', style: 'gap:14px' },
    ...['R', 'Y', 'G', 'B'].map((c) => h('button', {
      class: 'uno-color',
      style: `background:${COLOR_HEX[c]}`,
      onclick: () => { row.remove(); sfx.tap(); cb(c); },
    }, COLOR_NAME[c])));
  row.id = 'uno-pick';
  row.style.cssText = 'position:fixed; inset:0; background:rgba(4,4,10,.85); z-index:90; backdrop-filter:blur(6px)';
  document.body.append(row);
}

/* ---------------- engine registration ---------------- */

const finish = (s, winner) => ({ ...s, phase: 'over', winner });

registerGame({
  id: 'uno', name: 'UNO Duel', tag: 'Empty your hand first', icon: '🎴', section: 'classic',
  init() { return { phase: 'lobby', round: 0, turn: 'host', top: null, discard: [], chosen: null, counts: { host: 0, guest: 0 }, pendingFor: null, pendingN: 0, pendingId: 0, winner: null }; },
  fill(a) {
    if (a.type === 'start' || a.type === 'rematch') {
      const nums = ALL_CARDS.filter((c) => /^[RGBY]\d$/.test(c));
      a.top = nums[Math.floor(Math.random() * nums.length)];
      a.turn = Math.floor(Math.random() * 2) ? 'host' : 'guest';
    }
  },
  canOptimistic(a) { return a.type !== 'start' && a.type !== 'rematch'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      if (!a.top) return s;
      return { ...s, phase: 'play', round: s.round + 1, turn: a.turn, top: a.top, discard: [a.top], chosen: a.top[0], counts: { host: 7, guest: 7 }, pendingFor: null, pendingN: 0, pendingId: 0, winner: null };
    }
    if (s.phase !== 'play') return s;

    if (a.type === 'play') {
      if (a.by !== s.turn || s.pendingFor || !a.card) return s;
      const wild = isWild(a.card);
      const matches = wild || a.card[0] === s.chosen || cardVal(a.card) === cardVal(s.top);
      if (!matches) return s;
      const chosen = wild ? (['R', 'Y', 'G', 'B'].includes(a.chosen) ? a.chosen : s.chosen) : a.card[0];
      const next = { ...s, top: a.card, discard: [...s.discard, a.card], chosen, counts: { ...s.counts, [a.by]: s.counts[a.by] - 1 } };
      if (next.counts[a.by] === 0) return finish(next, a.by);
      const v = cardVal(a.card);
      if (v === 'S' || v === 'Rv') return next;                    // 2p: go again
      if (v === 'D2' || v === 'WD4') {
        const other = a.by === 'host' ? 'guest' : 'host';
        return { ...next, pendingFor: other, pendingN: v === 'D2' ? 2 : 4, pendingId: s.pendingId + 1 };
      }
      return { ...next, turn: a.by === 'host' ? 'guest' : 'host' };
    }

    if (a.type === 'drew') {
      const n = Math.max(1, Math.min(4, a.n | 0));
      if (s.pendingFor === a.by) {                                  // settling a Draw-Two/+4 penalty
        return { ...s, counts: { ...s.counts, [a.by]: s.counts[a.by] + n }, pendingFor: null, pendingN: 0, pendingId: s.pendingId + 1 };
      }
      if (a.by !== s.turn) return s;                                // normal turn draw
      return { ...s, counts: { ...s.counts, [a.by]: s.counts[a.by] + n } };
    }

    if (a.type === 'pass') {
      if (s.pendingFor || a.by !== s.turn) return s;
      return { ...s, turn: a.by === 'host' ? 'guest' : 'host' };
    }
    return s;
  },
  view(el, s, ctx, api) {
    myRole = ctx.myRole;
    if (s.phase === 'lobby') {
      resetLocal();
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🎴'),
        h('div', { class: 'g-prompt' }, 'UNO Duel — first to empty their hand'),
        h('div', { class: 'g-sub', style: 'max-width:420px' },
          'Your cards stay on your screen — the other player only ever sees how many you hold. Match the color or the symbol; ', h('b', {}, '★ +4'), ' makes them draw four.'),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'start' }) }, 'Deal me in 🎴'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === ctx.myRole;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, iWon ? '🏆' : '🎴'),
        h('div', { class: 'g-prompt' }, iWon ? 'UNO! You emptied your hand first! 🎉' : `${api.peerName} said UNO first`),
        h('div', { class: 'g-sub' }, `Cards left — you: ${s.counts[ctx.myRole]} · them: ${s.counts[ctx.myRole === 'host' ? 'guest' : 'host']}`),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'rematch' }) }, 'Deal again 🔁'),
      ));
      return;
    }

    // refresh / rejoin recovery: the hand lives only on this device, so if it's
    // gone we rebuild it with the right count from still-unknown cards
    if (!myHand.length && s.counts[ctx.myRole] > 0) {
      const pool = unknownPool(s);
      for (let i = 0; i < s.counts[ctx.myRole] && pool.length; i++) {
        myHand.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      handStamp++;
    }

    const flags = animFlags(s);
    const myTurn = s.turn === ctx.myRole;
    const pendingMine = s.pendingFor === ctx.myRole;
    const canAct = myTurn && !pendingMine;
    const playableSet = new Set(canAct ? myHand.filter((c) => isPlayable(c, s)) : []);

    const oppN = s.counts[ctx.myRole === 'host' ? 'guest' : 'host'];
    const backs = [];
    for (let i = 0; i < Math.min(oppN, 10); i++) backs.push(cardEl('back', { back: true, sm: true, pop: flags.oppDeal && i === Math.min(oppN, 10) - 1 }));
    if (oppN > 10) backs.push(h('span', { class: 'uc-more' }, `+${oppN - 10}`));

    const drawPile = Math.max(0, 108 - s.counts.host - s.counts.guest - s.discard.length);

    const handRow = h('div', { class: 'uhand' },
      ...myHand.map((c) => {
        const playable = playableSet.has(c);
        return cardEl(c, { playable, dim: canAct && !playable, pop: flags.handDeal });
      }));

    el.append(
      h('div', { class: 'g-center', style: 'gap:12px' },
        h('div', { class: 'uopp' + (!myTurn ? ' their-turn' : '') },
          h('div', { class: 'ucardfan' }, backs),
          h('div', { class: 'g-sub' }, `${api.peerName} · ${oppN} card${oppN === 1 ? '' : 's'}`)),
        h('div', { class: 'utable' },
          h('div', { class: 'upile' },
            h('div', { class: 'upile-back' }),
            h('div', { class: 'g-sub' }, `draw · ${drawPile}`)),
          cardEl(s.top, { pop: flags.topPop }),
          h('div', { class: 'upile' },
            h('div', { class: 'ucolor-chip' },
              h('span', { class: 'ucolor', style: `background:${COLOR_HEX[s.chosen] || '#555'}` }),
              h('span', {}, COLOR_NAME[s.chosen] || '')),
            pendingMine
              ? h('div', { class: 'g-sub', style: 'color:#ff8aa0' }, `you draw ${s.pendingN}…`)
              : (s.pendingFor ? h('div', { class: 'g-sub' }, `they draw ${s.pendingN}…`) : null)),
        ),
        pendingMine ? null
          : h('div', { class: 'g-sub' + (myTurn ? ' turn-glow' : '') },
              myTurn ? 'Your turn' : `Waiting for ${api.peerName}…`),
        handRow,
        myTurn && !pendingMine ? h('div', { class: 'urow' },
          h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => {
              const { reshuffled } = drawLocal(1, s);
              const playableDrawn = isPlayable(myHand[myHand.length - 1], s);
              act({ type: 'drew', n: 1, reshuffled });
              if (!playableDrawn) act({ type: 'pass' });
            },
          }, 'Draw one 🎴'),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => act({ type: 'pass' }) }, 'Pass turn ⏭'),
        ) : null,
      ),
    );

    handRow.querySelectorAll('.ucard.playable').forEach((elm) => {
      elm.addEventListener('click', () => {
        const card = elm.dataset.card;
        const play = (chosen) => {
          myHand = myHand.filter((c) => c !== card);
          handStamp++;
          act({ type: 'play', card, chosen });
          sfx.match(); haptic(buzz.tap);
        };
        if (isWild(card)) pickColor(play);
        else play();
      });
    });

    // auto-settle a pending draw penalty on my side
    if (pendingMine && lastSeen.pendingId !== s.pendingId) {
      lastSeen.pendingId = s.pendingId;
      const { reshuffled } = drawLocal(s.pendingN, s);
      act({ type: 'drew', n: s.pendingN, reshuffled });
      sfx.pop(); haptic(buzz.recv);
    } else if (!pendingMine) lastSeen.pendingId = null;
  },
});
