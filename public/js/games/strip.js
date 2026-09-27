/* Strip Showdown — five rounds of high-card duels. Each round both players
   draw from their own private deck (values only matter, ties redraw), the
   cards reveal together, and the loser takes it off on camera. Most losses
   after five rounds draws a final forfeit card. */
import { registerGame, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const ROUNDS = 5;
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const rankOf = (card) => RANKS.indexOf(card.slice(0, -1));
const isRed = (card) => card.includes('♥') || card.includes('♦');
const FORFEITS = [
  'Full lap of the room in whatever you have (or don\'t) on — camera follows.',
  'One slow spin. Then a bow toward the lens.',
  'Recreate your best "caught in the act" face — hold it for 10 seconds.',
  'Lights off for one minute. Camera stays on. Your call what they see.',
  'Describe your losing hand in your most dramatic, soap-opera voice.',
  'Whisper what the winner gets next time you\'re in the same room.',
];

/* my private deck — values stay on this device until the reveal */
let myPool = [];
let myCardLocal = null;   // my drawn card for the locked round — re-sent until the host accepts

function reshuffleMyDeck() {
  myPool = [];
  for (const r of RANKS) for (const s of SUITS) myPool.push(r + s);
  for (let i = myPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [myPool[i], myPool[j]] = [myPool[j], myPool[i]];
  }
}

function drawMyCard() {
  if (!myPool.length) reshuffleMyDeck();
  return myPool.splice(Math.floor(Math.random() * myPool.length), 1)[0];
}

registerGame({
  id: 'stripshowdown', name: 'Strip Showdown', tag: '5 high-card duels — loser strips on camera', icon: '🃏', section: 'adult',
  init() { return { phase: 'lobby', round: 1, ready: { host: false, guest: false }, cards: { host: null, guest: null }, losses: { host: 0, guest: 0 }, last: null, forfeit: null, winner: null }; },
  canOptimistic(a) { return a.type !== 'start'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      return { ...s, phase: 'play', round: 1, ready: { host: false, guest: false }, cards: { host: null, guest: null }, losses: { host: 0, guest: 0 }, last: null, forfeit: null, winner: null };
    }
    if (s.phase !== 'play') return s;
    if (a.type === 'ready') {
      if (s.ready[a.by] || s.cards.host) return s;
      return { ...s, ready: { ...s.ready, [a.by]: true } };
    }
    if (a.type === 'reveal') {
      if (!a.card || !s.ready[a.by] || s.cards[a.by]) return s;
      const cards = { ...s.cards, [a.by]: a.card };
      if (cards.host == null || cards.guest == null) return { ...s, cards };
      // both revealed — rank decides (tie = both redraw the round)
      const rh = rankOf(cards.host), rg = rankOf(cards.guest);
      if (rh === rg) return { ...s, cards: { host: null, guest: null }, ready: { host: false, guest: false } };
      const loser = rh > rg ? 'guest' : 'host';
      const losses = { ...s.losses, [loser]: s.losses[loser] + 1 };
      const last = { host: cards.host, guest: cards.guest, loser, round: s.round };
      if (s.round >= ROUNDS) {
        const forfeit = FORFEITS[Math.floor(Math.random() * FORFEITS.length)];
        const winner = losses.host === losses.guest ? null : (losses.host < losses.guest ? 'host' : 'guest');
        return { ...s, phase: 'over', cards: { host: null, guest: null }, ready: { host: false, guest: false }, losses, last, forfeit, winner };
      }
      return { ...s, cards: { host: null, guest: null }, ready: { host: false, guest: false }, losses, last, round: s.round + 1 };
    }
    return s;
  },
  view(el, s, ctx, api) {
    const myRole = ctx.myRole;
    const bothLocked = s.ready.host && s.ready.guest;
    const myLocked = s.ready[myRole];
    const last = s.last;
    const betweenRounds = last && last.round === s.round - 1 && !myLocked && !s.ready[myRole === 'host' ? 'guest' : 'host'];

    if (s.phase === 'lobby') {
      myPool = []; myCardLocal = null;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🃏'),
        h('div', { class: 'g-prompt' }, 'Strip Showdown — 5 high-card duels'),
        h('div', { class: 'g-sub', style: 'max-width:430px' }, 'Both draw from a full deck in secret — higher card wins the round. The loser takes one item off on camera (you track your own honest count, the camera is watching 📸). Most losses after five rounds pulls a forfeit card.'),
        h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'start' }) }, 'Deal the deck 🃏'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === myRole;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, '🃏'),
        h('div', { class: 'g-prompt' },
          s.winner == null ? 'Dead even — no forfeit, just respect 🤝'
            : iWon ? 'You survived the showdown — they owe the forfeit 😏'
            : `You owe the forfeit — ${api.peerName} holds the card 🙈`),
        s.forfeit ? h('div', { class: 'glass', style: 'padding:20px; border-radius:20px; max-width:440px' },
          h('div', { class: 'g-sub' }, 'FORFEIT CARD'), h('div', { class: 'g-prompt' }, s.forfeit)) : null,
        h('div', { class: 'g-sub' }, `Losses — you: ${s.losses[myRole]} · them: ${s.losses[myRole === 'host' ? 'guest' : 'host']}`),
        h('button', { class: 'btn btn-hot', onclick: () => { myPool = []; act({ type: 'rematch' }); } }, 'Deal again 🃏'),
      ));
      return;
    }

    const scoreRow = h('div', { class: 'scoreline' },
      h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, String(s.losses[myRole])), ' losses'),
      h('div', { class: 'sc' }, `round ${Math.min(s.round, ROUNDS)} of ${ROUNDS}`),
      h('div', { class: 'sc' }, h('b', {}, String(s.losses[myRole === 'host' ? 'guest' : 'host'])), ' losses ', api.peerName));

    const freshReveal = last && last.round === s.round - 1;

    if (betweenRounds && freshReveal) {
      const myCard = last[myRole], theirCard = last[myRole === 'host' ? 'guest' : 'host'];
      const iLost = last.loser === myRole;
      el.append(h('div', { class: 'g-center' },
        scoreRow,
        h('div', { class: 'rps-reveal' },
          h('div', { class: 'upcard' + (isRed(myCard) ? ' red' : '') }, h('b', {}, myCard)),
          h('div', { class: 'rps-vs' }, 'VS'),
          h('div', { class: 'upcard' + (isRed(theirCard) ? ' red' : '') }, h('b', {}, theirCard))),
        h('div', { class: 'g-prompt' }, iLost ? 'You lost the round — camera says take it off 📸' : `You took it — ${api.peerName} strips 📸`),
        h('button', {
          class: 'btn btn-hot', style: 'min-width:200px',
          onclick: () => { act({ type: 'ready' }); sfx.tap(); haptic(buzz.tap); },
        }, `🃏 DRAW round ${s.round}`),
      ));
      return;
    }

    el.append(
      scoreRow,
      h('div', { class: 'g-center' },
        h('div', { class: 'g-prompt' }, bothLocked ? 'Cards in the air…' : myLocked ? `Card drawn! Waiting for ${api.peerName}…` : 'Draw your card — in secret'),
        !myLocked ? h('button', { class: 'btn btn-hot', style: 'min-width:200px', onclick: () => { act({ type: 'ready' }); sfx.tap(); haptic(buzz.tap); } }, `🃏 DRAW round ${s.round}`) : null,
        myLocked ? h('div', { class: 'g-sub' }, 'Your card is face-down 🂠 — no peeking for them') : null,
      ),
    );

    // both locked → my card must reach the shared state. The ready and the reveal
    // can cross the wire out of order (the render fires the reveal during act()),
    // so keep re-sending until the shared state actually holds my card.
    if (!bothLocked) myCardLocal = null;
    if (bothLocked && s.cards[myRole] == null) {
      if (myCardLocal == null) myCardLocal = drawMyCard();
      act({ type: 'reveal', card: myCardLocal });
      sfx.whoosh(); haptic(buzz.match);
    }
  },
});
