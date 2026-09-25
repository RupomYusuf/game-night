/* Factory for "both players answer, reveal together" games:
   This or That, Never Have I Ever (std + 18+), Spicy Would You Rather, Heat Check.
   Config-driven: options, match logic, heat meter, auto-next, pass button. */
import { registerGame } from './engine.js';
import { h } from '../ui.js';
import { sfx } from '../sound.js';

const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function makeDuoGame(cfg) {
  const hot = cfg.section === 'adult';
  const opts = cfg.options; // [{v, label, emoji}] — label may be (item) => string
  const labelOf = (v, item) => {
    const L = opts.find((o) => o.v === v)?.label;
    return typeof L === 'function' ? L(item) : L;
  };
  const optLabel = (o, item) => (typeof o.label === 'function' ? o.label(item) : o.label);

  registerGame({
    id: cfg.id,
    name: cfg.name,
    tag: cfg.tag,
    icon: cfg.icon,
    section: cfg.section,
    init() {
      return {
        order: shuffle(cfg.bank.map((_, i) => i)),
        i: 0, host: null, guest: null, phase: 'pick', deadline: null,
        log: [], heat: 0, round: 1,
      };
    },
    fill(a) {
      if (a.type === 'next') a.nextIndex = Math.floor(Math.random() * 999999); // noop, determinism helper
    },
    canOptimistic(a) { return true; },
    reduce(s, a) {
      const item = cfg.bank[s.order[s.i % s.order.length]];
      if (a.type === 'pass') {
        return advance(s, s.i + 1);
      }
      if (a.type === 'next') {
        if (s.phase !== 'reveal' && s.a === null && s.b === null) return s;
        return advance(s, s.i + 1);
      }
      if (a.type !== 'pick' || s.phase !== 'pick') return s;
      const next = { ...s, [a.by]: a.v };
      if (next.host != null && next.guest != null) {
        const match = cfg.matchCheck ? cfg.matchCheck(next.a, next.b, item) : next.a === next.b;
        const log = [...s.log, { q: cfg.promptOf(item), a: next.host, b: next.guest, match, item }];
        const heat = match ? s.heat + 1 : s.heat;
        return {
          ...next, phase: 'reveal', log, heat,
          deadline: cfg.autoNext ? Date.now() + cfg.revealMs : null,
          done: (s.done || 0) + 1,
        };
      }
      return next;
    },
    tick(s, { act, now }) {
      if (cfg.autoNext && s.phase === 'reveal' && s.deadline && now > s.deadline) {
        return advance(s, s.i + 1);
      }
      return null;
    },
    view(el, s, ctx, api) {
      const item = cfg.bank[s.order[s.i % s.order.length]];
      const prompt = cfg.promptOf(item);
      const total = cfg.bank.length;
      const finished = (s.done || 0) >= total;
      const mine = s[ctx.myRole];
      const theirs = s[ctx.myRole === 'host' ? 'guest' : 'host'];
      const lastMatch = s.log.length ? s.log[s.log.length - 1].match : null;

      if (finished) {
        el.append(h('div', { class: 'g-center' },
          h('div', { style: 'font-size:52px' }, cfg.endEmoji || '🌙'),
          h('div', { class: 'g-prompt' }, cfg.endText ? cfg.endText(s) : "That's every card — you know each other so well 💞"),
          cfg.heatMeter ? heatMeter(s) : null,
          h('button', { class: `btn ${hot ? 'btn-hot' : 'btn-primary'}`, onclick: () => api.act({ type: 'pass' }) }, 'Go again 🔁'),
        ));
        return;
      }

      const pickRow = h('div', { class: 'g-row', style: 'width:100%; max-width:640px' },
        opts.map((o) => h('button', {
          class: `choice-btn ${hot ? 'hot-choice' : ''} ${mine === o.v ? 'picked' : ''}`,
          disabled: mine != null || s.phase !== 'pick',
          onclick: () => { sfx.tap(); api.act({ type: 'pick', v: o.v }); },
        }, `${o.emoji}  ${optLabel(o, item)}`)));

      const revealRow = s.phase === 'reveal' ? h('div', { class: 'g-row', style: 'width:100%; max-width:640px' },
        opts.map((o) => {
          const iGot = mine === o.v, theyGot = theirs === o.v;
          const cls = lastMatch === true ? 'reveal-match' : (iGot || theyGot) && lastMatch === false ? 'reveal-diff' : '';
          return h('div', { class: `choice-btn ${hot ? 'hot-choice' : ''} ${cls}`, style: 'cursor:default; opacity:' + ((iGot || theyGot) ? 1 : .35) },
            `${o.emoji}  ${optLabel(o, item)}`,
            h('div', { class: 'g-sub', style: 'font-size:11.5px' },
              (iGot ? 'You' : '') + (iGot && theyGot ? ' + ' : '') + (theyGot ? api.peerName : '') || '—'));
        })) : null;

      el.append(
        h('div', { class: 'g-center' },
          cfg.heatMeter && cfg.showMeterDuringPlay !== false ? heatMeter(s) : null,
          h('div', { class: 'g-sub' }, `Card ${(s.i % total) + 1} of ${total}`),
          h('div', { class: 'g-prompt' }, prompt),
          s.phase === 'pick'
            ? (mine != null
                ? h('div', { class: 'waiting-tag' }, h('i'), 'Locked in — waiting for ', api.peerName, '…')
                : pickRow)
            : revealRow,
          s.phase === 'reveal' ? h('div', {},
            h('div', { style: 'font-weight:800; font-size:17px; margin-top:4px' },
              cfg.matchCheck
                ? (lastMatch ? '✨ You matched!' : '🌊 Different — and that\'s interesting too')
                : 'Both revealed'),
            cfg.autoNext
              ? h('div', { class: 'g-sub' }, 'Next card coming up…')
              : h('button', { class: `btn btn-sm ${hot ? 'btn-hot' : 'btn-primary'}`, style: 'margin-top:10px', onclick: () => api.act({ type: 'next' }) }, 'Next card →'),
          ) : null,
          h('button', {
            class: 'btn btn-ghost btn-sm', style: 'opacity:.75',
            onclick: () => { sfx.tap(); api.act({ type: 'pass' }); },
          }, 'Pass — skip this one 🚪'),
        ),
      );
      const lg = logStrip(s.log, cfg, api);
      if (lg) el.append(lg);
    },
  });

  function advance(s, i) {
    const wrapped = i >= cfg.bank.length;
    return { ...s, i: wrapped ? 0 : i, host: null, guest: null, phase: 'pick', deadline: null, done: wrapped ? 0 : s.done };
  }

  function heatMeter(s) {
    const max = cfg.bank.length;
    const pct = Math.round((s.heat / max) * 100);
    return h('div', { style: 'display:flex; flex-direction:column; align-items:center; gap:6px; width:100%' },
      h('div', { class: 'heat-meter' }, h('div', { class: 'heat-fill', style: `width:${pct}%` })),
      h('div', { class: 'g-sub', style: 'font-size:12.5px' }, `🔥 Heat meter — ${s.heat} match${s.heat === 1 ? '' : 'es'} (${pct}%)`));
  }

  function logStrip(log, c, api) {
    if (!log.length) return null;
    const rows = [...log].reverse().slice(0, 30).map((r, idx) => {
      const realIdx = log.length - 1 - idx;
      return h('div', { class: 'log-row' },
        h('b', {}, r.q), ' — ',
        `${api.myName}: ${c.answerText ? c.answerText(r.a, r.item) : labelOf(r.a, r.item)} · ${api.peerName}: ${c.answerText ? c.answerText(r.b, r.item) : labelOf(r.b, r.item)}`,
        c.matchCheck ? h('span', { class: `match-flag ${r.match ? 'same' : 'diff'}` }, r.match ? 'match ✨' : 'different') : null,
        c.logNote ? c.logNote(r) : null,
      );
    });
    return h('div', { class: 'log-strip' }, rows);
  }
}

/* ============================ THIS OR THAT ============================ */
const TOT = [
  ['Cuddling all night', 'Staying up talking all night'], ['Sunrise together', 'Sunset together'],
  ['Love letter', 'Love song'], ['Picnic at noon', 'Midnight drive'],
  ['Handwritten note', 'Voice message'], ['Beach trip', 'Mountain cabin'],
  ['Slow dance in the kitchen', 'Karaoke duet'], ['Matching outfits', 'Inside jokes only'],
  ['Breakfast in bed', 'Dinner cooked together'], ['Stargazing', 'Cloud watching'],
  ['Movie night in', 'Concert night out'], ['Forehead kiss', 'Surprise hug'],
  ['Sharing dessert', 'Sharing headphones'], ['Rainy window cuddles', 'Snow day adventure'],
  ['Coffee date', 'Late-night snack run'], ['Board games', 'Video games'],
  ['Couple photo album', 'Couple playlist'], ['Surprise party', 'Surprise trip'],
  ['Holding hands everywhere', 'Arm around me always'], ['Pizza night', 'Sushi night'],
  ['Their hoodie', 'Their t-shirt'], ['Sweet good-morning text', 'Sweet goodnight call'],
  ['Baking together', 'Ordering in together'], ['A walk in the park', 'A museum date'],
  ['Matching mugs', 'Matching keychains'], ['Photo booth', 'Polaroid camera'],
  ['Camping under stars', 'Hotel room luxury'], ['Reading to each other', 'Gaming with each other'],
  ['Sunroof drive', 'Train window seat'], ['Home-cooked meal', 'Fancy restaurant'],
  ['Falling asleep on call', 'Waking up to texts'], ['Remembering dates', 'Remembering details'],
  ['Anniversary trip', 'Spontaneous weekend'],
];

registerGame({
  id: 'thisorthat', name: 'This or That', tag: 'Pick in secret, reveal together', icon: '🤔', section: 'classic',
  init() {
    return { order: shuffle(TOT.map((_, i) => i)), i: 0, host: null, guest: null, phase: 'pick', log: [], done: 0 };
  },
  reduce(s, a) {
    if (a.type === 'pass') return { ...s, i: s.i + 1, host: null, guest: null, phase: 'pick' };
    if (a.type === 'next') return { ...s, i: s.i + 1, host: null, guest: null, phase: 'pick' };
    if (a.type !== 'pick' || s.phase !== 'pick' || s[a.by] != null) return s;
    const next = { ...s, [a.by]: a.v };
    if (next.a != null && next.b != null) {
      return { ...next, phase: 'reveal', log: [...s.log, { q: TOT[s.order[s.i % TOT.length]][0], a: next.host, b: next.guest, match: next.host === next.guest }], done: s.done + 1 };
    }
    return next;
  },
  view(el, s, ctx, api) {
    const [x, y] = TOT[s.order[s.i % TOT.length]];
    const mine = s[ctx.myRole];
    const theirs = s[ctx.myRole === 'host' ? 'guest' : 'host'];
    const last = s.log[s.log.length - 1];
    el.append(
      h('div', { class: 'g-center' },
        h('div', { class: 'g-sub' }, `Pair ${(s.i % TOT.length) + 1} of ${TOT.length}`),
        h('div', { class: 'g-prompt' }, 'This or that?'),
        s.phase === 'pick'
          ? h('div', { class: 'g-row', style: 'width:100%; max-width:640px' },
              [x, y].map((label) => h('button', {
                class: `choice-btn ${mine === label ? 'picked' : ''}`,
                disabled: mine != null || s.phase !== 'pick',
                onclick: () => { sfx.tap(); api.act({ type: 'pick', v: label }); },
              }, label)))
          : h('div', { class: 'g-row', style: 'width:100%; max-width:640px' },
              [x, y].map((label) => {
                const you = mine === label, them = theirs === label;
                return h('div', {
                  class: `choice-btn ${last && last.match ? 'reveal-match' : (you || them) && last ? 'reveal-diff' : ''}`,
                  style: `cursor:default; opacity:${(you || them) ? 1 : .35}`,
                }, label, h('div', { class: 'g-sub', style: 'font-size:11.5px' }, [you ? 'You' : '', them ? api.peerName : ''].filter(Boolean).join(' + ') || '—'));
              })),
        s.phase === 'pick' && mine != null
          ? h('div', { class: 'waiting-tag' }, h('i'), 'Locked in — waiting for ', api.peerName, '…')
          : null,
        s.phase === 'reveal'
          ? h('div', {},
              h('div', { style: 'font-weight:800; font-size:17px' }, last.match ? '✨ Same answer — soulmates' : '🌊 You went different ways'),
              h('button', { class: 'btn btn-sm btn-primary', style: 'margin-top:10px', onclick: () => api.act({ type: 'next' }) }, 'Next pair →'))
          : null,
      ));
      if (s.log.length) el.append(h('div', { class: 'log-strip' },
        [...s.log].reverse().slice(0, 30).map((r) => h('div', { class: 'log-row' },
          h('b', {}, r.q), ` — you picked ${r.a === r.q ? 'the first' : 'the second'} · ${api.peerName} ${r.match ? 'matched ✨' : 'picked the other one'}`))));
    },
  });

/* ============================ HEAT CHECK (18+) ============================ */
const HEAT = [
  'Candles lit right now?', 'Feeling bold tonight?', 'Whipped cream: yes or no?',
  'Slow music on?', 'Would you sneak a kiss right now?', 'Lights on or feeling shy?',
  'Up for a late night?', 'Thinking about me right now?', 'Would you kiss me in the rain?',
  'Fancy a massage, no takebacks?', 'Feeling playful or sleepy?', 'Skin to skin: yes please?',
  'Would you skinny dip with me?', 'Do you miss me this second?', 'Sweet talk or dirty talk?',
  'Would you share a bath tonight?', 'Ice cubes: fun idea?', 'Fancy stealing a hoodie kiss?',
  'Ready for round two already?', 'Would you dance for me?', 'Silk or lace?', 'Feeling mischievous?',
  'Would you bite, gently?', 'Up for a dare later?', 'Missing my hands on you?',
  'Would you kiss my neck?', 'Want breakfast in bed… tomorrow, late?', 'Blushing right now?',
  'Would you let me plan a surprise night?', 'Feeling hot in here, or is it me?', 'Are you smiling at your screen?',
  'Do you want one more round of this game?', 'Thinking about next weekend together?', 'Are you falling for me again?',
];

makeDuoGame({
  id: 'heatcheck', name: 'Heat Check', tag: 'Rapid-fire yes/no — fill the meter', icon: '🔥', section: 'adult',
  bank: HEAT,
  promptOf: (q) => q,
  options: [{ v: 'yes', label: 'Yes', emoji: '🔥' }, { v: 'no', label: 'No', emoji: '🧊' }],
  matchCheck: (a, b) => a === b,
  autoNext: true, revealMs: 1700,
  heatMeter: true, showMeterDuringPlay: true,
  endEmoji: '🥵',
  endText: (s) => {
    const pct = Math.round((s.heat / HEAT.length) * 100);
    const label = pct >= 75 ? 'Certified Inferno 🔥🔥🔥' : pct >= 45 ? 'Sizzling hot 🔥🔥' : pct >= 20 ? 'Warm and cozy 🔥' : 'Slow burn, sweet night 🌙';
    return `You matched ${s.heat} of ${HEAT.length}. ${label}`;
  },
});
