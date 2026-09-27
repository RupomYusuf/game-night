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
  'A word that tastes like Sunday morning',
  'A word that feels like your hand in mine',
  'A color for the way you text goodnight',
  'A sound our house will make someday',
  'A word for the pause before we kiss',
  'A smell that means home now',
  'A word that whispers like you do',
  'A word made only for the two of us',
  'A word that feels like candlelight',
  'A color for midnight calls',
  'A word for the day we finally meet',
  'A word that feels like flying home',
  'A word that giggles',
  'A word that blushes',
  'A word that smells like rain and your jacket',
  'A word for the last dance of the night',
  'A word that hums like our song',
  'A word that feels like fresh sheets',
  'A color for your laugh at 2 a.m.',
  'A word for the first snow together',
  'What my heartbeat says in one word',
  'What our future house is called',
  'What you\'d name our first dance',
  'What the moon calls us',
  'What our love tastes like at midnight',
  'What I look like when I\'m asleep on call',
  'What you\'d name the scent of us',
  'What my goodnight text feels like',
  'What our inside joke would be as a color',
  'What the stars call our road trips',
  'What you\'d name our private island',
  'What my sleepy voice sounds like to you',
  'What our wedding would smell like',
  'What the ocean knows about us',
  'What your hoodie means to me',
  'What our duet would be titled',
  'What my name sounds like in your accent',
  'What the airport gate felt like',
  'What our first home will whisper',
  'What my smile tastes like',
  'The color of forever',
  'The sound of coming home',
  'The smell of your cologne on my pillow',
  'The word our story ends with',
  'The temperature of your hug',
  'The color of us in twenty years',
  'The name of the street we\'ll live on',
  'The sound of your key in my door',
  'The word for missing you at noon',
  'The color of our first made-up argument',
  'The smell of our someday kitchen',
  'The word between hello and kiss',
  'The sound of us laughing at nothing',
  'The color of your sleepy voice',
  'The name of our future dog',
  'The word for how you hold me',
  'The sound of two cups, one morning',
  'The color of the first flower you give me',
  'The name of our boat someday',
  'The word for dancing with no music',
  'One word for the day we met',
  'One word for your hand in mine',
  'One word for the last goodbye at the airport',
  'One word for our song at full volume',
  'One word for the rain on our window',
  'One word for your terrible karaoke',
  'One word for the first time you said it',
  'One word for the blanket we fight over',
  'One word for our midnight snacks',
  'One word for the drive home, together',
  'One word for the morning after forever starts',
  'One word for our long-distance days',
  'One word for the hug at arrivals',
  'One word for the candle we never lit',
  'One word for the future we keep sketching',
  'One word for the playlist you made me',
  'One word for our first apartment',
  'One word for the kiss in the rain',
  'One word for every Sunday we\'ll share',
  'One word for the day distance ends',
  'Your love language, one word',
  'Your favorite hour of us',
  'Your word for my sleepy face',
  'Your favorite memory, as a color',
  'Your word for our inside jokes',
  'Your word for forehead kisses',
  'Your name for me, invented tonight',
  'Your favorite sound I make',
  'Your word for our future Sundays',
  'Your favorite flavor of us',
  'Your word for missing me',
  'Your favorite weather to hold hands in',
  'Your word for the way I laugh',
  'Your favorite minute of every call',
  'Your word for home now',
  'Your favorite photo of us, as a word',
  'Your word for my cold hands',
  'Your favorite smell on my side of the bed',
  'Your word for our someday porch',
  'Your favorite way I say your name',
  'Our dream country, one word',
  'Our future street name, invented',
  'Our wedding song\'s secret title',
  'Our anniversary tradition, one word',
  'Our shared nickname for mornings',
  'Our future pet\'s ridiculous name',
  'Our favorite hiding spot in the world',
  'Our someday front door color',
  'Our word for holding hands',
  'Our private word for I love you',
  'Our honeymoon, one word',
  'Our first home\'s smell, imagined',
  'Our favorite season together',
  'Our word for lazy Sundays',
  'Our someday garden, one flower',
  'Our road trip, one word',
  'Our favorite hour of the night',
  'Our word for the countdown',
  'Our first dance, one word',
  'Our word for old and gray',
  'Something that always smells like you',
  'Something purple that reminds me of you',
  'Something soft that feels like your hugs',
  'Something sweet that isn\'t dessert',
  'Something loud that still means love',
  'Something small you\'d put in my pocket',
  'Something warm for a cold goodbye',
  'Something you\'d name a star after us',
  'Something bright for our darkest week',
  'Something quiet that says everything',
  'Something golden from our story',
  'Something you\'d bury in our time capsule',
  'Something that always makes me text you',
  'Something blue for the day we met',
  'Something cozy like our calls',
  'Something spicy for after dark',
  'Something that tastes like your laugh',
  'Something I\'d steal from your suitcase',
  'Something we\'ll do when distance ends',
  'Something silver for our future',
  'If our love were weather',
  'If we were a drink, we\'d be',
  'If our story were a song title',
  'If we had a band name',
  'If you were a season',
  'If I were a dessert, you\'d call me',
  'If our kisses had a flavor',
  'If our hugs were priced per second',
  'If the moon texted us, it would say',
  'If we wrote a cookbook, we\'d call it',
  'If our love were a temperature',
  'If I were your favorite hoodie',
  'If we painted our bedroom, the color',
  'If we adopted a cloud, its name',
  'If our road trip were a movie title',
  'If I whispered all night, you\'d hear',
  'If we could bottle one feeling',
  'If our laughter were currency',
  'If I were the last cookie',
  'If forever had a nickname',
  'Describe my hugs in one word',
  'Describe the way you look at me',
  'Describe our first kiss, hypothetically',
  'Describe my voice when I\'m sleepy',
  'Describe us in one color',
  'Describe forever in one word',
  'Describe your favorite daydream of me',
  'Describe the silence after our goodnight call',
  'Describe me as a scent',
  'Describe our future as a season',
  'Describe my laugh as a texture',
  'Describe our midnight kitchen dance',
  'Describe us as a dessert',
  'Describe our love in one verb',
  'Describe me as weather',
  'Describe your favorite photo of me',
  'Describe our calls as a flavor',
  'Describe me as a song genre',
  'Describe the day we close the distance',
  'Describe us as a constellation',
  'Name the ship we\'d sail away on',
  'Name our castle in the clouds',
  'Name the diner we\'ll always claim',
  'Name the first street we\'ll walk together',
  'Name our tree in the forest of couples',
  'Name the planet we\'d move to',
  'Name our team if love were a sport',
  'Name the bridge we\'d meet halfway on',
  'Name our room at the haunted hotel',
  'Name the recipe that is us',
  'Name our secret garden',
  'Name the lighthouse that guides us',
  'Name the painting of our first kiss',
  'Name our double act in show business',
  'Name the boat where we say forever',
  'Name the star we wished on',
  'Name our shared bookshelf',
  'Name the mountain we\'d climb together',
  'Name our dive into forever',
  'Name the quilt made of our memories',
  'First word you\'d teach our dog',
  'First thing you\'d save from a fire (after me)',
  'First bite of our wedding cake, one word',
  'First morning in our new home, one word',
  'First song at our wedding',
  'First thing you\'d say at the arrivals gate',
  'First snowball of our first snowball fight',
  'First thing we\'d buy for our apartment',
  'First place we\'d travel as a couple',
  'First thing I\'d cook for you',
  'First word of our vows',
  'First thing you noticed about me',
  'First stamp in our shared passport',
  'First plant we\'d keep alive together',
  'First thing we\'d do after the long drive',
  'First firework of our summer night',
  'First thing you\'d whisper at the altar',
  'First Christmas ornament we\'d buy',
  'First photo on our fridge',
  'First thing I\'d grab from your closet',
  'Last thing you\'d say before sleeping',
  'Last bite we\'d share at dinner',
  'Last song of our road trip',
  'Last word in our storybook',
  'Last dance at our wedding',
  'Last thing I\'d whisper at the airport',
  'Last light we turn off at night',
  'Last cookie, who gets it',
  'Last star to fade at dawn, named',
  'Last thing in our suitcase',
  'Last hug before the train leaves',
  'Last text of the night, one word',
  'Last slice of pizza, negotiated',
  'Last page of our photo album',
  'Last candle to burn out',
  'Last minute before midnight on New Year\'s',
  'Last look in the mirror before seeing you',
  'Last drop of summer, one word',
  'Last thing folded into the laundry',
  'Last word of our favorite song',
  'Best hour of the whole week',
  'Best smell in the whole world',
  'Best thing about sleepy goodbyes',
  'Best flavor for our wedding cake',
  'Best seat on the couch, claimed',
  'Best part of coming home to you',
  'Best name for our future band',
  'Best color for my dress at our party',
  'Best word whispered at 3 a.m.',
  'Best thing in my purse for you',
  'Best day of the year to be lazy',
  'Best weather for slow dancing',
  'Best word for our group chat of two',
  'Best snack for movie marathons',
  'Best sound after a long day',
  'Best emoji that means you',
  'Best place to hide a love note',
  'Best thing about long distance',
  'Best word to end an argument',
  'Best time to be kissed',
  'Imagine our house, one word',
  'Imagine us old, one word',
  'Imagine our tomorrow, one word',
  'Imagine the ocean knew our names',
  'Imagine a city built for two',
  'Imagine our song played by an orchestra',
  'Imagine the moon kept our secrets',
  'Imagine love had a smell',
  'Imagine us in a snow globe',
  'Imagine a world where hugs travel by mail',
  'Imagine our laughter bottled and labeled',
  'Imagine kissing me at midnight, one word',
  'Imagine our forever, one word',
  'Imagine me showing up with soup',
  'Imagine a library of our memories',
  'Imagine a postcard from our future',
  'Imagine our shadow on the moon',
  'Imagine the wind carrying your name',
  'Imagine every red light turning green on your way',
  'Imagine a door that opens only for us',
  'Say forever in one word',
  'Say yes in our own language',
  'Say my name in one color',
  'Say goodnight in one breath',
  'Say I miss you without saying it',
  'Say I love you in one word',
  'Say stay like you mean it',
  'Say kiss me in one word',
  'Say come home in one word',
  'Say always instead of forever',
  'Where we\'d hide from the world',
  'Where our first kiss will happen',
  'Where we\'d retire, one word',
  'Where the map pins our hearts',
  'When did you know, one word',
  'When the waiting ends, we\'ll feel',
  'Who falls asleep first, one word',
  'Who steals the blankets, one word',
  'Why us, one word',
  'How forever tastes, one word',
  'Word for the space between our hands',
  'Word for the day we stop counting days',
  'Word for you, capitalized',
  'Word for me, according to you',
  'Word for us, one last time',
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
    if (s.phase === 'reveal' && now > s.revealAt) {
      const i = s.i + 1;
      const wrapped = i >= s.prompts.length;
      return startRound(wrapped ? { ...s, prompts: shuffle(s.prompts) } : s, wrapped ? 0 : i);
    }
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
