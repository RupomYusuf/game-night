/* Truth or Dare (18+) — spinning wheel decides, the other partner picks from
   3 preset options or writes their own. Pass is always available. */
import { registerGame } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const TRUTHS = [
  'What\'s the most unexpected place you\'ve wanted to kiss me?',
  'What\'s one fantasy you\'ve never told me about?',
  'What do you think about when we\'re apart at night?',
  'What\'s the boldest thing you\'ve ever wanted to try with me?',
  'Which of my outfits lives rent-free in your head?',
  'What\'s the sexiest text you\'ve ever wanted to send me but didn\'t?',
  'Where would you take me if there were zero consequences?',
  'What\'s your favorite memory of us… in the dark?',
  'What do you whisper about me to your friends?',
  'What\'s one thing my body does that drives you crazy?',
  'When was the last time you thought about me today? Be honest.',
  'What would you do if I said "yes" to anything right now?',
];
const DARES = [
  'Give your partner a 30-second massage — no talking allowed.',
  'Kiss them slowly for ten seconds… with eye contact after.',
  'Whisper the naughtiest compliment you can think of.',
  'Let your partner pick where your hands go for one minute.',
  'Describe, in detail, your favorite kiss we\'ve ever shared.',
  'Kiss somewhere you\'ve never kissed before.',
  'Feed your partner something sweet — slowly.',
  'Give a neck massage that gets dangerously close to more.',
  'Say the alphabet with kisses — one per letter, cheek counts.',
  'Reenact your first kiss, but slower.',
  'Hold eye contact for 60 seconds. No giggling. (You\'ll giggle.)',
  'Serenade your partner with the most romantic song you know.',
];
const pick3 = (arr) => {
  const s = [...arr].sort(() => Math.random() - .5);
  return [s[0], s[1], s[2]];
};

registerGame({
  id: 'truthdare', name: 'Truth or Dare', tag: 'Spin the wheel — fate decides', icon: '🎡', section: 'adult',
  fill(a) {
    if (a.type === 'spin') {
      a.result = Math.random() < .5 ? 'truth' : 'dare';
      a.options = pick3(a.result === 'truth' ? TRUTHS : DARES);
    }
  },
  canOptimistic(a) { return a.type !== 'spin'; },
  init() { return { round: 1, phase: 'idle', result: null, options: [], choice: null, spinner: 'host', winner: null }; },
  reduce(s, a) {
    if (a.type === 'spin' && s.phase === 'idle' && a.by === s.spinner) {
      if (!a.result) return s;
      return { ...s, phase: 'spun', result: a.result, options: a.options || [], choice: null, spinBy: a.by, spunAt: Date.now() };
    }
    if (a.type === 'choose' && s.phase === 'spun' && a.by !== s.spinner) {
      return { ...s, phase: 'done', choice: { by: a.by, text: a.text, custom: !!a.custom } };
    }
    if (a.type === 'complete' && a.by === s.spinner && s.phase === 'done') {
      return { ...s, round: s.round + 1, phase: 'idle', result: null, options: [], choice: null, spinner: s.spinner === 'host' ? 'guest' : 'host' };
    }
    if (a.type === 'pass' && (s.phase === 'done' || s.phase === 'spun')) {
      return { ...s, round: s.round + 1, phase: 'idle', result: null, options: [], choice: null, spinner: s.spinner === 'host' ? 'guest' : 'host' };
    }
    return s;
  },
  view(el, s, ctx, api) {
    const iSpin = s.spinner === ctx.myRole;
    const spinName = iSpin ? 'You' : api.peerName;
    const segs = 8;

    const wheelSvg = (rotDeg) => h('div', { class: 'wheel-box' },
      h('div', { class: 'wheel-needle' }, '🔻'),
      h('div', {
        class: 'wheel', style: `transform: rotate(${rotDeg}deg)`,
      }, h('div', {
        style: `width:100%; height:100%; border-radius:50%; background: conic-gradient(${Array.from({ length: segs }, (_, i) =>
          `${i % 2 ? '#ff9950' : '#ff2d55'} ${(360 / segs) * i}deg ${(360 / segs) * (i + 1)}deg`).join(',')});`,
      }, h('div', {
        style: 'position:absolute; inset:22%; border-radius:50%; background:var(--bg1); display:grid; place-items:center; font-size:34px; flex-direction:column',
      }, '🌶️'))));

    if (s.phase === 'idle') {
      el.append(h('div', { class: 'g-center' },
        h('div', { class: 'g-sub' }, `Round ${s.round} — the wheel belongs to ${spinName}`),
        wheelSvg(s.rotation || 0),
        h('div', { class: 'g-prompt' }, iSpin ? 'Spin it, and let fate decide 😏' : `${api.peerName} spins — you pick the outcome when it lands.`),
        iSpin
          ? h('button', { class: 'btn btn-hot', onclick: () => { sfx.spin(); haptic([30, 80, 30, 80, 30]); api.act({ type: 'spin' }); } }, '🎡 SPIN')
          : h('div', { class: 'waiting-tag' }, h('i'), 'Waiting for the spin…'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => api.act({ type: 'pass' }) }, 'Pass this round 🚪'),
      ));
      return;
    }

    if (s.phase === 'spun') {
      const label = s.result === 'truth' ? 'TRUTH 🫢' : 'DARE 😈';
      // animate wheel to land on the result segment
      const target = (s.result === 'truth' ? 1 : 2) * (360 / segs) + 720 * 2;
      el.append(h('div', { class: 'g-center' },
        wheelSvg(target),
        h('div', { class: 'g-prompt grad-text', style: 'font-size:34px' }, label),
        h('div', { class: 'g-sub' }, `${spinName} spun ${s.result === 'truth' ? 'TRUTH' : 'DARE'} — so ${iSpin ? api.peerName + ' picks' : 'you pick'}:`),
        !iSpin ? h('div', { style: 'display:flex; flex-direction:column; gap:8px; width:min(480px,100%)' },
          s.options.map((o) => h('button', { class: 'opt-card', onclick: () => { sfx.match(); haptic(buzz.match); api.act({ type: 'choose', text: o }); } }, o)),
          h('div', { class: 'g-sub' }, '— or write your own —'),
          h('div', { style: 'display:flex; gap:8px' },
            h('input', { class: 'field', 'data-k': 'tod-custom', placeholder: 'Your own truth/dare…', maxlength: 120, id: 'tod-input' }),
            h('button', { class: 'btn btn-hot', onclick: () => {
              const v = el.querySelector('#tod-input').value.trim();
              if (v) api.act({ type: 'choose', text: v, custom: true });
            } }, 'Send')),
        ) : h('div', { class: 'waiting-tag' }, h('i'), `${api.peerName} is choosing…`),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => api.act({ type: 'pass' }) }, 'Pass 🚪'),
      ));
      return;
    }

    // done
    el.append(h('div', { class: 'g-center' },
      h('div', { class: 'g-sub' }, `Round ${s.round} · ${s.result === 'truth' ? 'TRUTH 🫢' : 'DARE 😈'}`),
      h('div', { class: 'glass', style: 'padding:20px; border-radius:20px; max-width:480px' },
        h('div', { class: 'g-prompt' }, s.choice?.text),
        h('div', { class: 'g-sub', style: 'margin-top:8px' }, `— chosen by ${s.choice?.by === ctx.myRole ? 'you' : api.peerName}${s.choice?.custom ? ' (custom ✍️)' : ''}`)),
      iSpin
        ? h('div', { class: 'g-row' },
            h('button', { class: 'btn btn-hot', onclick: () => { sfx.win(); haptic(buzz.win); api.act({ type: 'complete' }); } }, 'Done — next round 💕'),
            h('button', { class: 'btn btn-ghost', onclick: () => api.act({ type: 'pass' }) }, 'Pass — no reason needed 🚪'))
        : h('div', { class: 'waiting-tag' }, h('i'), `Waiting for ${api.peerName}…`),
    ));
  },
});
