/* 20 Questions — one picks a secret word, the other asks yes/no/maybe questions.
   The secret word lives ONLY on the chooser's device. Verification of final
   guesses is performed by the chooser (whoever holds the word), host or not. */
import { registerGame } from './engine.js';
import { h } from '../ui.js';
import { sfx } from '../sound.js';

const IDEAS = ['candlelight', 'umbrella', 'hug', 'moonlight', 'pizza', 'guitar', 'pillow', 'airplane',
  'first kiss', 'snowman', 'coffee', 'anchor', 'rainbow', 'teddy bear', 'sunflower', 'lighthouse'];
const norm = (t) => (t || '').trim().toLowerCase();

registerGame({
  id: 'twentyq', name: '20 Questions', tag: 'Guess the secret word in 20 yes/no questions', icon: '❓', section: 'classic',
  init() { return { phase: 'setup', log: [], questions: 0, wrongGuesses: 0, winner: null, secret: null, chooser: null, pending: null, finalGuess: null, round: 1 }; },
  reduce(s, a) {
    if (a.type === 'start') return { ...s, phase: 'questioning', chooser: a.by, questions: 0, log: [], wrongGuesses: 0, winner: null, pending: null, finalGuess: null };
    if (s.phase === 'setup') return s;

    if (a.type === 'ask' && a.by !== s.chooser && s.phase === 'questioning' && s.questions < 20 && !s.winner && !s.finalGuess) {
      return { ...s, questions: s.questions + 1, pending: { q: a.text } };
    }
    if (a.type === 'answer' && a.by === s.chooser && s.pending && !s.winner) {
      return { ...s, log: [...s.log, { q: s.pending.q, ans: a.v }], pending: null };
    }
    if (a.type === 'finalGuess' && a.by !== s.chooser && s.phase === 'questioning' && !s.winner && !s.finalGuess) {
      return { ...s, finalGuess: a.text };
    }
    if (a.type === 'verdict' && a.by === s.chooser && s.finalGuess && !s.winner) {
      const won = !!a.won;
      const log = [...s.log, { q: `Final guess: “${s.finalGuess}”`, ans: won ? '✅ correct!' : '❌ nope' }];
      const wrongGuesses = won ? s.wrongGuesses : s.wrongGuesses + 1;
      if (won || wrongGuesses >= 3) {
        return { ...s, phase: 'done', winner: won ? (s.chooser === 'host' ? 'guest' : 'host') : s.chooser, secret: a.word || s.finalGuess, log, wrongGuesses, finalGuess: null };
      }
      return { ...s, log, wrongGuesses, finalGuess: null };
    }
    if (a.type === 'reveal' && a.by === s.chooser && !s.winner) {
      // 20 questions used up (or chooser surrenders the word) → chooser wins
      return { ...s, phase: 'done', winner: s.chooser, secret: a.word || 'a mystery 🤫' };
    }
    if (a.type === 'rematch') {
      return { ...s, phase: 'setup', log: [], questions: 0, wrongGuesses: 0, winner: null, secret: null, pending: null, finalGuess: null, chooser: null, round: s.round + 1 };
    }
    return s;
  },
  view(el, s, ctx, api) {
    const iAmChooser = s.chooser === ctx.myRole;
    const chooserName = s.chooser ? (s.chooser === ctx.myRole ? 'You' : api.peerName) : '';
    const remaining = 20 - s.questions;

    if (s.phase === 'setup') {
      const willChoose = s.round % 2 === 1 ? 'host' : 'guest';
      const meChoose = willChoose === ctx.myRole;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🕵️'),
        h('div', { class: 'g-prompt' }, meChoose ? 'Your turn to think of a secret word' : `${api.peerName} is thinking of a secret word…`),
        h('div', { class: 'g-sub' }, meChoose
          ? 'A person, place, food, memory of us — they get 20 yes/no/maybe questions to find it.'
          : 'You get 20 yes/no/maybe questions. 3 wrong final guesses and they win.'),
        meChoose ? h('div', { style: 'display:flex; flex-direction:column; gap:10px; width:min(400px,100%)' },
          h('input', { class: 'field', 'data-k': '20q-secret', placeholder: 'Your secret word (stays on your screen)', maxlength: 40, id: 'secret-input' }),
          h('button', {
            class: 'btn btn-primary btn-block',
            onclick: () => {
              const v = el.querySelector('#secret-input').value.trim();
              if (!v) return;
              mySecret = v;
              sfx.send();
              api.act({ type: 'start' });
            },
          }, 'Lock it in 🔒'),
          h('div', { class: 'g-sub' }, `Need inspiration? ${IDEAS.slice(0, 4).join(' · ')}`),
        ) : null));
      return;
    }

    if (s.phase === 'done') {
      const iWon = s.winner === ctx.myRole;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, iWon ? '🎉' : '🕵️‍♀️'),
        h('div', { class: 'g-prompt' },
          iWon
            ? `You got it — the word was “${s.secret}”!`
            : `The word was “${s.secret}” — ${iAmChooser ? `you stumped ${api.peerName}` : `${chooserName} stumped you`}.`),
        h('button', { class: 'btn btn-primary', onclick: () => api.act({ type: 'rematch' }) }, 'New round — swap roles 🔄')));
      return;
    }

    // questioning
    el.append(...[
h('div', { class: 'scoreline' },
        h('div', { class: 'sc' }, '❓ Questions left ', h('b', {}, remaining)),
        h('div', { class: 'sc' }, '🔴 Wrong guesses ', h('b', {}, `${s.wrongGuesses}/3`))),
      h('div', { class: 'q-log', style: 'flex:1; margin-top:6px' },
        s.log.map((r) => h('div', { class: 'q-row' },
          h('div', { class: 'q-bubble' }, r.q),
          h('div', { class: 'g-sub' }, r.ans))),
        s.finalGuess ? h('div', { class: 'q-row' },
          h('div', { class: 'q-bubble' }, `Final guess: “${s.finalGuess}”`),
          iAmChooser
            ? h('div', { class: 'yn-row', style: 'width:100%; margin-top:4px' },
                h('button', { class: 'yn-btn y', onclick: () => api.act({ type: 'verdict', won: true, word: mySecret }) }, '✅ That\'s it!'),
                h('button', { class: 'yn-btn n', onclick: () => api.act({ type: 'verdict', won: false }) }, '❌ Nope'))
            : h('div', { class: 'waiting-tag' }, h('i'), 'Drumroll…')) : null,
        s.pending ? h('div', { class: 'q-row' },
          h('div', { class: 'q-bubble' }, s.pending.q),
          iAmChooser
            ? h('div', { class: 'yn-row', style: 'width:100%; margin-top:4px' },
                ['yes', 'no', 'maybe'].map((v) => h('button', {
                  class: `yn-btn ${v[0]}`,
                  onclick: () => { sfx.pop(); api.act({ type: 'answer', v }); },
                }, v === 'yes' ? '✅ Yes' : v === 'no' ? '❌ No' : '🤷 Maybe')))
            : h('div', { class: 'waiting-tag' }, h('i'), 'Waiting for the answer…')) : null,
      ),
      !iAmChooser ? h('div', { style: 'display:flex; gap:8px; margin-top:8px' },
        h('input', { class: 'field', 'data-k': '20q-ask', placeholder: 'Ask a yes/no question…', maxlength: 140, id: 'ask-input' }),
        h('button', {
          class: 'btn btn-primary',
          onclick: () => {
            const inp = el.querySelector('#ask-input');
            const v = (inp.value || '').trim();
            if (!v || s.pending || s.finalGuess) return;
            inp.value = '';
            api.act({ type: 'ask', text: v });
          },
        }, 'Ask')) : null,
      !iAmChooser ? h('button', {
        class: 'btn btn-ghost btn-sm', style: 'margin-top:8px',
        onclick: () => {
          const inp = el.querySelector('#ask-input');
          const guess = (inp?.value || '').trim();
          if (!guess) { inp?.focus(); inp?.setAttribute('placeholder', 'Type your final guess here, then tap this 🎯'); return; }
          inp.value = '';
          api.act({ type: 'finalGuess', text: guess });
        },
      }, '🎯 Use what I typed as my final guess') : null,
      iAmChooser && remaining <= 0 && !s.pending && !s.finalGuess ? h('button', {
        class: 'btn btn-primary btn-sm', style: 'margin-top:8px',
        onclick: () => api.act({ type: 'reveal', word: mySecret }),
      }, 'They\'re out of questions — claim the win 🏆') : null,
      iAmChooser ? h('div', { class: 'g-sub', style: 'margin-top:8px; text-align:center' },
        `Your word: “${mySecret || '…'}” — only you can see this. If they're close, be generous with “maybe” 😌`) : null,
    ].filter(Boolean));
  },
});

let mySecret = null; // chooser's device only — never synced
