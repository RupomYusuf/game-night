/* Rock Paper Scissors — first to 3 points. Both players lock their pick in
   secret (it never leaves their device until reveal); when both are locked
   the picks reveal together, so nobody can wait out the other's answer. */
import { registerGame, act } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const ICON = ['🪨', '📄', '✂️'];
const NAME = ['Rock', 'Paper', 'Scissors'];
const BEATS = [2, 0, 1];       // rock beats scissors, paper beats rock, scissors beats paper
const TARGET = 3;

let myPick = null;             // locked locally — never synced until reveal

registerGame({
  id: 'rps', name: 'Rock Paper Scissors', tag: 'First to 3 — pick in secret', icon: '✂️', section: 'classic',
  init() { return { phase: 'lobby', round: 1, ready: { host: false, guest: false }, picks: { host: null, guest: null }, score: { host: 0, guest: 0 }, last: null, winner: null }; },
  canOptimistic(a) { return a.type !== 'start'; },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      return { ...s, phase: 'play', round: 1, ready: { host: false, guest: false }, picks: { host: null, guest: null }, score: { host: 0, guest: 0 }, last: null, winner: null };
    }
    if (s.phase !== 'play') return s;
    if (a.type === 'ready') {
      if (s.ready[a.by] || s.picks.host != null) return s;
      return { ...s, ready: { ...s.ready, [a.by]: true } };
    }
    if (a.type === 'reveal') {
      const v = a.v | 0;
      if (v < 0 || v > 2 || !s.ready[a.by] || s.picks[a.by] != null) return s;
      const picks = { ...s.picks, [a.by]: v };
      if (picks.host == null || picks.guest == null) return { ...s, picks };
      // both revealed — settle the round
      const winner = picks.host === picks.guest ? 'tie' : (BEATS[picks.host] === picks.guest ? 'host' : 'guest');
      const score = winner === 'tie' ? s.score : { ...s.score, [winner]: s.score[winner] + 1 };
      const last = { host: picks.host, guest: picks.guest, winner, round: s.round };
      if (score.host >= TARGET || score.guest >= TARGET) {
        return { ...s, phase: 'over', score, last, picks: { host: null, guest: null }, ready: { host: false, guest: false }, winner: score.host > score.guest ? 'host' : 'guest' };
      }
      return { ...s, score, last, picks: { host: null, guest: null }, ready: { host: false, guest: false }, round: s.round + 1 };
    }
    return s;
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    const myRole = ctx.myRole;
    const bothLocked = s.ready.host && s.ready.guest;
    const myLocked = s.ready[myRole];

    if (s.phase === 'lobby') {
      myPick = null;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '✂️'),
        h('div', { class: 'g-prompt' }, 'Rock Paper Scissors — first to 3'),
        h('div', { class: 'g-sub', style: 'max-width:400px' }, 'Both of you pick in secret — the hands reveal together, so no peeking and no waiting-out.'),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'start' }) }, 'Throw hands 🥊'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === myRole;
      const theirScore = s.score[myRole === 'host' ? 'guest' : 'host'];
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, iWon ? '🏆' : '😤'),
        h('div', { class: 'g-prompt' }, iWon ? `You take it ${s.score[myRole]}–${theirScore}! 🎉` : `${api.peerName} takes it ${theirScore}–${s.score[myRole]}`),
        h('button', { class: 'btn btn-primary', onclick: () => { myPick = null; act({ type: 'rematch' }); } }, 'Rematch 🥊'),
      ));
      return;
    }

    const scoreRow = h('div', { class: 'scoreline' },
      h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, String(s.score[myRole]))),
      h('div', { class: 'sc' }, `round ${s.round} · first to ${TARGET}`),
      h('div', { class: 'sc' }, h('b', {}, String(s.score[myRole === 'host' ? 'guest' : 'host'])), ' ', api.peerName));

    // between rounds: show the last throw until someone picks again
    const betweenRounds = s.last && s.last.round === s.round - 1 && !myLocked && !s.ready[myRole === 'host' ? 'guest' : 'host'];
    if (betweenRounds && s.last) {
      const myIcon = ICON[s.last[myRole]], theirIcon = ICON[s.last[myRole === 'host' ? 'guest' : 'host']];
      const verdict = s.last.winner === 'tie' ? 'Tie! 🤝' : s.last.winner === myRole ? 'You win the round! ✨' : `${api.peerName} takes it`;
      el.append(h('div', { class: 'g-center' },
        scoreRow,
        h('div', { class: 'rps-reveal' },
          h('div', { class: 'rps-hand' + (s.last.winner === myRole ? ' win' : '') }, h('div', { class: 'rps-big' }, myIcon), h('div', { class: 'g-sub' }, 'You')),
          h('div', { class: 'rps-vs' }, 'VS'),
          h('div', { class: 'rps-hand' + (s.last.winner !== 'tie' && s.last.winner !== myRole ? ' win' : '') }, h('div', { class: 'rps-big' }, theirIcon), h('div', { class: 'g-sub' }, api.peerName))),
        h('div', { class: 'g-prompt' }, verdict),
        h('button', { class: 'btn btn-primary', onclick: () => { myPick = null; sfx.tap(); } }, 'Next throw 🤜'),
      ));
      return;
    }

    el.append(
      scoreRow,
      h('div', { class: 'g-center' },
        h('div', { class: 'g-prompt' }, bothLocked ? 'Revealing…' : myLocked ? `Locked! Waiting for ${api.peerName}…` : 'Make your pick — in secret'),
        !myLocked ? h('div', { class: 'rps-row' },
          ...ICON.map((ic, v) => h('button', {
            class: 'rps-btn',
            onclick: () => { myPick = v; sfx.tap(); haptic(buzz.tap); act({ type: 'ready' }); },
          }, h('div', { class: 'rps-big' }, ic), h('div', { class: 'g-sub' }, NAME[v])))) : null,
        myLocked ? h('div', { class: 'rps-locked' }, h('div', { class: 'rps-big' }, ICON[myPick]), h('div', { class: 'g-sub' }, 'your hand is in the fist 🤜')) : null,
      ),
    );

    // both locked → fire my reveal (the reducer settles once both are in)
    if (bothLocked && myPick != null && s.picks[myRole] == null) {
      act({ type: 'reveal', v: myPick });
      sfx.whoosh();
    }
  },
});
