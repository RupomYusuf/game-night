/* Fantasy Chain — you build a story together, one sentence each, alternating.
   The story lives in shared state (it's meant to be seen by both), turns
   alternate, either of you can end it and read the whole thing back. */
import { registerGame, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const PROMPTS = [
  'The hotel room. Midnight. Neither of you wanted to sleep yet…',
  'You matched on an app — but the app matched the wrong two people…',
  'Two strangers stuck in an airport overnight, one charging cable between them…',
  'The rain trapped you both under the same tiny awning…',
  'A masquerade, a spilled drink, and one very bold apology…',
  'Your neighbor turns out to be the person from all those late-night calls…',
  'The power went out on your video date — so you kept talking in the dark…',
  'One umbrella, one long walk home, and neither of you in a hurry…',
];
const MAX_LINES = 40;

registerGame({
  id: 'fantasy', name: 'Fantasy Chain', tag: 'Build a story — one line each', icon: '✍️', section: 'adult',
  init() { return { phase: 'lobby', round: 0, turn: 'host', prompt: null, lines: [], ended: false, winner: null }; },
  canOptimistic(a) { return a.type !== 'start'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && (s.phase === 'over' || s.ended))) {
      return { ...s, phase: 'play', round: s.round + 1, turn: 'host', prompt: a.prompt || null, lines: [], ended: false, winner: null };
    }
    if (s.phase !== 'play' || s.ended) return s;
    if (a.type === 'add') {
      if (a.by !== s.turn || !a.text || s.lines.length >= MAX_LINES) return s;
      const lines = [...s.lines, { by: a.by, text: String(a.text).slice(0, 220) }];
      const next = { ...s, lines, turn: a.by === 'host' ? 'guest' : 'host' };
      if (lines.length >= MAX_LINES) return { ...next, ended: true };
      return next;
    }
    if (a.type === 'endStory') {
      if (s.lines.length < 2) return s;
      return { ...s, ended: true };
    }
    return s;
  },
  fill(a) {
    if (a.type === 'start' || a.type === 'rematch') {
      a.prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    }
  },
  view(el, s, ctx, api) {
    const myRole = ctx.myRole;
    if (s.phase === 'lobby') {
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '✍️'),
        h('div', { class: 'g-prompt' }, 'Fantasy Chain — write it together'),
        h('div', { class: 'g-sub', style: 'max-width:420px' }, 'One sentence each, alternating. Take it anywhere you both dare — sweet, slow, filthy. The story exists only in this room.'),
        h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'start' }) }, 'Start the chain ✍️'),
      ));
      return;
    }

    const myTurn = s.turn === myRole && !s.ended;
    const story = h('div', { class: 'fstory' },
      s.prompt ? h('div', { class: 'fline prompt' }, '📖 ', s.prompt) : null,
      ...s.lines.map((l) => h('div', { class: 'fline ' + (l.by === myRole ? 'mine' : 'theirs') },
        h('span', { class: 'fwho' }, l.by === myRole ? 'You' : api.peerName), l.text)),
      s.ended ? h('div', { class: 'fline end' }, '📖 The end — that one was just for you two.') : null,
    );

    const input = h('input', { class: 'field', 'data-k': 'fantasy-line', maxlength: 220, placeholder: myTurn ? 'Your sentence…' : 'Their turn…', disabled: !myTurn, id: 'fantasy-input' });

    el.append(
      h('div', { class: 'g-center', style: 'gap:10px' },
        h('div', { class: 'g-sub' + (myTurn ? ' turn-glow' : '') },
          s.ended ? 'The story is complete' : myTurn ? 'Your line — keep it going' : `${api.peerName} is writing…`),
        story,
        !s.ended ? h('div', { style: 'display:flex; gap:8px; width:min(480px,100%)' },
          input,
          h('button', {
            class: 'btn btn-hot',
            onclick: () => {
              const inp = el.querySelector('#fantasy-input');
              const v = (inp.value || '').trim();
              if (!v) return;
              inp.value = '';
              act({ type: 'add', text: v });
              sfx.pop(); haptic(buzz.tap);
            },
          }, 'Send ✍️'),
        ) : null,
        !s.ended && s.lines.length >= 2 ? h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: () => { act({ type: 'endStory' }); sfx.match(); haptic(buzz.match); },
        }, 'End the story — read it back 📖') : null,
        s.ended ? h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'rematch' }) }, 'Write another ✍️') : null,
      ),
    );
    // keep the newest line visible + focus the writer
    requestAnimationFrame(() => {
      story.scrollTop = story.scrollHeight;
      if (myTurn) el.querySelector('#fantasy-input')?.focus();
    });
  },
});
