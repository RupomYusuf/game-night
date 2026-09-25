/* Word Rush — same prompt, 8 seconds, reveal together. Race to 20 points.
   Points: faster answer +2, slower +1, matching answers +1 bonus each. */
import { registerGame, hostNow } from './engine.js';
import { h } from '../ui.js';
import { sfx } from '../sound.js';

const PROMPTS = [
  'Something you\'d whisper across a crowded room', 'A word that smells like us',
  'What I taste like in the morning (keep it sweet)', 'Our ideal Sunday — one word',
  'The first thing you noticed about me', 'A sound that means "home"',
  'Three letters for how you feel', 'What my laugh looks like',
  'A place you\'d kiss me right now', 'Our song, one word',
  'What you\'d name our boat', 'A color for tonight',
  'Something soft you think of when you think of me', 'The weather in your heart',
  'What we should name a future pet', 'Your favorite flaw of mine',
  'A food that tastes like our first date', 'What you\'d shout from a mountaintop about us',
  'The smell of my hair, one word', 'A movie title for our story',
  'One word for how you sleep next to me', 'What you\'d whisper at 3am',
  'A drink that feels like us', 'What my hugs are made of',
  'The word you\'d tattoo (temporarily!) for me', 'What love sounds like',
  'A flower for our wedding table', 'What you feel when I text "hi"',
  'Our dream city, one word', 'The taste of midnight',
  'What my eyes are shaped like', 'A word for missing me',
  'What you\'d name our star', 'Something we should do tonight',
  'One word our friends would use for us', 'What the moon knows about us',
  'Your favorite word in any language', 'What forever feels like',
];

const norm = (t) => (t || '').trim().toLowerCase();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DURATION = 8000, REVEAL = 4500, TARGET = 20;

registerGame({
  id: 'wordrush', name: 'Word Rush', tag: 'Same prompt, 8 seconds, race to 20', icon: '⚡', section: 'classic',
  fill(a) { if (a.type === 'rematch') a.prompts = shuffle(PROMPTS); },
  canOptimistic(a) { return a.type !== 'rematch'; },
  init() {
    return startRound({ prompts: shuffle(PROMPTS), log: [], score: { host: 0, guest: 0 }, winner: null, round: 1 }, 0);
  },
  reduce(s, a) {
    if (a.type === 'rematch') {
      if (!a.prompts) return s;
      return startRound({ prompts: a.prompts, log: [], score: { host: 0, guest: 0 }, winner: null, round: s.round + 1 }, 0);
    }
    if (a.type !== 'answer' || s.phase !== 'input' || s[a.by + 'Text'] != null) return s;
    const next = { ...s, [a.by + 'Text']: a.text, [a.by + 'Ts']: a.ts };
    if (next.hostText != null && next.guestText != null) return reveal(next);
    return next;
  },
  tick(s, { now }) {
    if (s.winner) return null;
    if (s.phase === 'input' && now > s.deadline) return reveal({ ...s, hostText: s.hostText ?? '', guestText: s.guestText ?? '' });
    if (s.phase === 'reveal' && now > s.revealAt) return startRound(s, s.i + 1);
    return null;
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    const prompt = s.prompts[s.i % s.prompts.length];
    const mineKey = ctx.myRole + 'Text', theirKey = (ctx.myRole === 'host' ? 'guest' : 'host') + 'Text';
    const mine = s[mineKey], theirs = s[theirKey];
    const last = s.log[s.log.length - 1];

    const head = h('div', { class: 'scoreline' },
      h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, s.score[ctx.myRole])),
      h('div', { class: 'sc' }, 'first to ', h('b', {}, TARGET)),
      h('div', { class: 'sc' }, api.peerName, ' ', h('b', {}, s.score[ctx.myRole === 'host' ? 'guest' : 'host'])));

    if (s.winner) {
      el.append(head, h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, '🏆'),
        h('div', { class: 'g-prompt' }, s.winner === ctx.myRole ? `You win the rush, ${s.score[ctx.myRole]} to ${s.score[ctx.myRole === 'host' ? 'guest' : 'host']}! 🎉` : `${api.peerName} wins this one 🏆`),
        h('button', { class: 'btn btn-primary', onclick: () => api.act({ type: 'rematch' }) }, 'Rematch ⚡'),
      ), ...(logStrip(s.log, api) ? [logStrip(s.log, api)] : []));
      return;
    }

    if (s.phase === 'input') {
      const remaining = Math.max(0, s.deadline - api.hostNow());
      const ring = h('div', { class: 'ring ' + (remaining < 3000 ? 'urgent' : '') },
        ringSvg(remaining / DURATION), h('span', { class: 'ring-num' }, Math.ceil(remaining / 1000)));
      el.append(head,
        h('div', { class: 'g-center' },
          h('div', { class: 'g-sub' }, `Round ${s.round} · ${s.i % s.prompts.length + 1}/${s.prompts.length}`),
          h('div', { class: 'g-prompt' }, prompt),
          ring,
          h('input', {
            class: 'field', style: 'max-width:420px; text-align:center', placeholder: 'Type your answer…',
            'data-k': 'wr-input', maxlength: 80, disabled: mine != null,
            onkeydown: (e) => { if (e.key === 'Enter') submit(e.target); },
          }),
          mine != null
            ? h('div', { class: 'waiting-tag' }, h('i'), 'Locked in — waiting for ', api.peerName, '…')
            : h('button', { class: 'btn btn-primary', onclick: (e) => submit(e.target.closest('.g-center').querySelector('input')) }, 'Lock it in ⚡'),
        ),
        ...(logStrip(s.log, api) ? [logStrip(s.log, api)] : []));
      // animate the countdown locally until this DOM is replaced by the next render
      const fg = ring.querySelector('.ring-fg'), num = ring.querySelector('.ring-num'), C = 2 * Math.PI * 31;
      const anim = () => {
        if (!ring.isConnected) return;
        const rem = Math.max(0, s.deadline - hostNow());
        fg.setAttribute('stroke-dashoffset', C * (1 - Math.max(0, Math.min(1, rem / DURATION))));
        num.textContent = Math.ceil(rem / 1000);
        ring.classList.toggle('urgent', rem < 3000 && rem > 0);
        if (rem > 0 && Math.ceil(rem / 1000) !== num.dataset.last) { num.dataset.last = Math.ceil(rem / 1000); sfx.tick(); }
        requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    } else {
      el.append(head,
        h('div', { class: 'g-center' },
          h('div', { class: 'g-prompt' }, prompt),
          h('div', { class: 'g-row', style: 'width:100%; max-width:640px' },
            [[api.myName, mine, last], [api.peerName, theirs, last]].map(([who, txt]) =>
              h('div', { class: `choice-btn ${last && last.match && txt ? 'reveal-match' : ''}`, style: 'flex-direction:column' },
                h('b', {}, txt || '— (no answer) —'),
                h('div', { class: 'g-sub', style: 'font-size:11.5px' }, who)))),
          last && last.match ? h('div', { style: 'font-weight:800' }, '✨ Matched! +2 each') : h('div', { class: 'g-sub' }, last && last.ptsNote),
        ),
        ...(logStrip(s.log, api) ? [logStrip(s.log, api)] : []));
    }

    function submit(input) {
      const text = (input.value || '').trim();
      if (!text) { input.focus(); return; }
      input.value = '';
      api.act({ type: 'answer', text, ts: hostNow() });
    }
  },
});

function startRound(s, i) {
  return { ...s, i, phase: 'input', hostText: null, guestText: null, hostTs: null, guestTs: null, deadline: Date.now() + DURATION, revealAt: null };
}

function reveal(s) {
  const a = norm(s.hostText), b = norm(s.guestText);
  const match = a && b && a === b;
  let pts = { host: 0, guest: 0 }, note = '';
  if (match) { pts = { host: 2, guest: 2 }; }
  else if (a && b) {
    const hostFaster = (s.hostTs ?? Infinity) <= (s.guestTs ?? Infinity);
    pts = hostFaster ? { host: 2, guest: 1 } : { host: 1, guest: 2 };
  } else if (a || b) { pts = a ? { host: 2, guest: 0 } : { host: 0, guest: 2 }; }
  else note = 'Neither of you answered in time 🙈';

  const score = { host: s.score.host + pts.host, guest: s.score.guest + pts.guest };
  const over = score.host >= TARGET || score.guest >= TARGET;
  let winner = null;
  if (over && score.host !== score.guest) winner = score.host > score.guest ? 'host' : 'guest';

  const hostFaster = (s.hostTs ?? Infinity) <= (s.guestTs ?? Infinity);
  if (!note) note = match ? 'Perfect sync! +2 each ✨' : `+2 ${hostFaster ? 'host' : 'guest'} for speed, +1 ${hostFaster ? 'guest' : 'host'}`;

  return {
    ...s, phase: 'reveal',
    log: [...s.log, { q: s.prompts[s.i % s.prompts.length], a: s.hostText, b: s.guestText, match, pts }],
    score, winner, note, revealAt: Date.now() + REVEAL,
  };
}

function ringSvg(frac) {
  const R = 31, C = 2 * Math.PI * R;
  return h('div', {},
    h('svg', { width: '74', height: '74' },
      h('defs', {}, h('linearGradient', { id: 'ringGrad', x1: '0', y1: '0', x2: '1', y2: '1' },
        h('stop', { offset: '0%', 'stop-color': '#ff5fa2' }), h('stop', { offset: '100%', 'stop-color': '#ff9950' }))),
      h('circle', { class: 'ring-bg', cx: '37', cy: '37', r: R }),
      h('circle', { class: 'ring-fg', cx: '37', cy: '37', r: R, 'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - Math.max(0, Math.min(1, frac))) })));
}

function logStrip(log, api) {
  if (!log.length) return null;
  return h('div', { class: 'log-strip' },
    [...log].reverse().slice(0, 25).map((r) => h('div', { class: 'log-row' },
      h('b', {}, r.q), ' — you: ', h('span', {}, r.a || '—'),
      ' · them: ', h('span', {}, r.b || '—'),
      r.match ? h('span', { class: 'match-flag same' }, 'match ✨') : null)));
}
