/* Dare Roulette — Cam Edition. Every dare is something you can actually DO
   on camera from wherever you are. Big dice popup draws from the current
   tier's deck; the partner rates the performance out of 10; every four rated
   dares the deck gets one tier spicier. */
import { registerGame, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const TIERS = [
  {
    name: 'Warm-up', emoji: '🌙',
    dares: [
      'Blow a kiss to the camera — slowly.',
      'Say the alphabet using only your eyes.',
      'Show the camera your favorite angle of yourself — hold it.',
      'Trace your lips with one finger. Slowly.',
      'Whisper one word you\'d moan tonight. Just one.',
      'Dance for 20 seconds to a song only you can hear.',
      'Give the camera a 10-second stare. No smiling.',
      'Describe what you\'re wearing right now — in detail.',
      'Run your hands through your hair, eyes closed.',
      'Kiss the screen like it\'s my cheek.',
      'Do your best "come here" gesture. With everything.',
      'Bite your lip and hold the stare for 10 seconds.',
      'Send the look that always works on me.',
      'Show me how you\'d greet me at the door.',
    ],
  },
  {
    name: 'Heating up', emoji: '🔥',
    dares: [
      'Unbutton or remove one thing. Slowly. Show it.',
      'Ice cube. Wrist. Lips. In that order.',
      'Kiss the camera like it\'s my neck.',
      '30-second show to your favorite song. Lights low.',
      'Write one word on your skin where only I\'d see it. Show me.',
      'Describe what you\'re NOT wearing right now.',
      'Trace where you want my hands. With the camera watching.',
      'Whisper 10 seconds of what you\'d do if I walked in.',
      'Show me the view only I\'m allowed to see.',
      'Let your hands wander for 30 seconds. Camera decides the angle.',
      'One layer lighter. Hold the pose.',
      'Moan my name like I\'m right behind you.',
    ],
  },
  {
    name: 'No limits', emoji: '🌶️',
    dares: [
      '60 seconds. Full confidence. The camera is me.',
      'Show me exactly what you\'d do first if I were there.',
      'Take it all off — one piece every 10 seconds, no rushing.',
      'The move you think about when you\'re alone. Show me.',
      'Describe your filthiest thought about me. Out loud. Whole thing.',
      'Use the camera angle I like most. Give me a full minute.',
      'Edge of your seat, literally — show me how you\'d tease me for an hour.',
      'Give me a preview of tonight. Make it impossible to forget.',
    ],
  },
];

const RATES_PER_TIER = 4;

const els = {};
let lastSeenDareId = 0;

registerGame({
  id: 'dareroulette', name: 'Dare Roulette', tag: 'Cam-only dares — roll, perform, get rated', icon: '🎯', section: 'adult',
  init() { return { phase: 'lobby', round: 0, turn: 'host', dare: null, dareId: 0, rated: 0, tier: 0, avg: null, passUsed: { host: false, guest: false }, winner: null }; },
  fill(a) {
    if (a.type === 'roll') {
      const tier = TIERS[Math.min(2, Math.floor((a.rated || 0) / RATES_PER_TIER))];
      a.dare = tier.dares[Math.floor(Math.random() * tier.dares.length)];
    }
  },
  canOptimistic(a) { return a.type === 'roll' ? false : true; },
  reduce(s, a) {
    if (a.type === 'start' && s.phase === 'lobby') {
      return { ...s, phase: 'play', round: 1, turn: 'host', dare: null, dareId: 0, rated: 0, tier: 0, passUsed: { host: false, guest: false } };
    }
    if (s.phase !== 'play') return s;
    if (a.type === 'roll') {
      if (a.by !== s.turn || s.dare) return s;
      const tier = Math.min(2, Math.floor(s.rated / RATES_PER_TIER));
      return { ...s, dare: a.dare || null, dareId: s.dareId + 1, tier };
    }
    if (a.type === 'rate') {
      if (!s.dare || a.by === s.turn) return s;
      const v = Math.max(1, Math.min(10, a.v | 0));
      const rated = s.rated + 1;
      const avg = s.avg == null ? v : Math.round(((s.avg * s.rated) + v) / rated);
      const other = s.turn === 'host' ? 'guest' : 'host';
      return { ...s, dare: null, rated, avg, turn: other, round: s.round + 1, tier: Math.min(2, Math.floor(rated / RATES_PER_TIER)) };
    }
    if (a.type === 'skip') {
      if (!s.dare || a.by !== s.turn || s.passUsed[a.by]) return s;
      const other = s.turn === 'host' ? 'guest' : 'host';
      return { ...s, dare: null, round: s.round + 1, turn: other, passUsed: { ...s.passUsed, [a.by]: true } };
    }
    return s;
  },
  view(el, s, ctx, api) {
    const myRole = ctx.myRole;
    const myTurn = s.turn === myRole;
    const tier = TIERS[s.tier];

    if (s.phase === 'lobby') {
      lastSeenDareId = 0;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🎯'),
        h('div', { class: 'g-prompt' }, 'Dare Roulette — Cam Edition'),
        h('div', { class: 'g-sub', style: 'max-width:430px' }, 'Every dare is made for the camera — nothing that needs hands but yours. Roll it, perform it, and your partner rates the show. Every four dares the deck gets one level filthier.'),
        h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'start' }) }, 'Spin the barrel 🎯'),
      ));
      return;
    }

    // big popup while a fresh dare lands (persistent element, like ludo's dice)
    if (s.dare && lastSeenDareId !== s.dareId) {
      lastSeenDareId = s.dareId;
      if (!els.pop) {
        els.pop = h('div', { class: 'ldice-pop' }, h('div', { class: 'ldice-big' }));
        document.body.append(els.pop);
      }
      els.pop.firstChild.textContent = tier.emoji;
      els.pop.classList.add('show');
      clearTimeout(els.popT);
      els.popT = setTimeout(() => els.pop.classList.remove('show'), 1400);
      sfx.spin(); haptic([30, 80, 30, 80, 30]);
    }

    const rating = s.dare && !myTurn;

    el.append(
      h('div', { class: 'g-center', style: 'gap:10px' },
        h('div', { class: 'scoreline' },
          h('div', { class: 'sc' }, `${tier.emoji} ${tier.name}`),
          h('div', { class: 'sc' }, `dare ${s.round}`),
          h('div', { class: 'sc' }, s.avg != null ? `avg ${s.avg}/10 🔥` : 'no ratings yet')),
        h('div', { class: 'ltop' },
          h('div', { class: 'lplayer' + (s.turn === 'host' ? ' active' : '') }, h('span', { class: 'ldot', style: 'background:#ff5fa2' }), 'You'),
          h('div', { class: 'lplayer' + (s.turn === 'guest' ? ' active' : '') }, h('span', { class: 'ldot', style: 'background:#4f9dff' }), api.peerName)),
        s.dare
          ? h('div', { class: 'glass', style: 'padding:22px; border-radius:20px; max-width:460px' },
              h('div', { class: 'g-prompt' }, s.dare),
              myTurn
                ? h('div', { class: 'g-sub' }, 'Do it on camera — they\'re waiting 👀')
                : h('div', { class: 'g-sub' }, `${api.peerName} is on camera… rate the show`))
          : h('div', { class: 'g-prompt' }, myTurn ? 'Your dare — spin for it' : `Waiting for ${api.peerName} to spin…`),
        myTurn && !s.dare ? h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'roll' }) }, '🎯 ROLL THE DARE') : null,
        rating ? h('div', { class: 'uraterow' },
          ...Array.from({ length: 10 }, (_, i) => h('button', {
            class: 'urate' + (i >= 7 ? ' hot' : ''),
            onclick: () => { act({ type: 'rate', v: i + 1 }); sfx.match(); haptic(buzz.match); },
          }, i + 1)),
        ) : null,
        s.dare && !myTurn ? h('div', { class: 'g-sub' }, 'Tap a score for their performance') : null,
        myTurn && s.dare && !s.passUsed[myRole] ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => act({ type: 'skip' }) }, 'Skip — one per night 🚪') : null,
      ),
    );
  },
});
