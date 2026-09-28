/* Yes · No · Maybe — Private Edition. A deck of 500+ intimate activities; both
   players mark each card privately on their own screen. Marks travel as
   salted commitments and only unlock after BOTH have locked in — and only
   MUTUAL interest is ever revealed. Anything one of you said no to stays
   sealed forever. */
import { registerGame, hostNow } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

const CARDS_PER_MATCH = 12;

/* ---------- deck: 500+ curated + generated activities ---------- */
const TIER_WARM = 0, TIER_SPICY = 1, TIER_INTENSE = 2;

const HAND_WARM = [
  'Slow dance to one song, cameras on', 'Cuddle on call for ten minutes', 'Read me a bedtime story',
  'Blow a kiss to the camera', 'Say three things you love about me', 'Wink at me slowly',
  'Describe our perfect lazy Sunday', 'Send the look that always works on me', 'Plan our dream date out loud',
  'Tell me the moment you knew you liked me', 'Compliment my smile, my voice, my laugh', 'Hum our song softly',
  'Trace a heart on your screen where my face is', 'Give me a virtual forehead kiss', 'Say goodnight in the softest voice',
  'Share the first thing you noticed about me', 'Tell me your favorite photo of us', 'Describe our first kiss in slow motion',
  'Whisper what you\u2019d whisper if I were asleep beside you', 'Name the smell that reminds you of me',
  'Kiss your screen where my lips are', 'Hold your hand up to the camera like you\u2019re holding mine',
  'Tell me three places you\u2019d kiss me first', 'Describe the outfit I\u2019d look best in', 'Say my name like you miss me',
  'Draw a heart on your cheek and show me', 'Blow a kiss goodnight, eyes closed', 'Tell me what you\u2019d cook me for breakfast',
  'Describe our future home in three words', 'Say the date of our first call out loud from memory',
];
const HAND_SPICY = [
  'Kiss the camera like it\u2019s my neck', 'Trace your lips with one fingertip, slowly', 'Whisper one word you\u2019d moan tonight',
  'Show the view only I\u2019m allowed to see', 'Bite your lip and hold the stare', 'Run your hands through your hair, eyes closed',
  'Ice cube — wrist, then lips', 'Unbutton one thing, slowly', 'Kiss the camera where my neck would be',
  'Describe my coldest "come here" look', 'Give the camera a ten-second stare', 'Whisper your favorite pet name for me',
  'Show me your favorite angle of yourself', 'Blow a kiss, then bite your lip', 'Trace where you want my hands',
  'Moan my name softly', 'Describe what you\u2019re wearing in slow detail', 'Kiss the lens like it\u2019s my shoulder',
  'Give a ten-second shoulder show', 'Whisper the nickname only you use for me', 'Show me your "walking toward me" walk',
  'Say what cologne or perfume you\u2019d wear for our night in', 'Slow-motion hair flip', 'Camera close: eyes, lips, back up',
  'Describe the first ten seconds of our next night in', 'Tell me where your mind goes when I say "later"', 'Blow a kiss to the lens, then lick your lips',
  'Hum the song that turns you on', 'Say "come here" in your lowest voice', 'Describe our next video date, dress code included',
  'Trace your collarbone on camera', 'Whisper what you\u2019d text me at 2 a.m.', 'Give my avatar on screen a slow once-over',
  'Show me how you\u2019d fix my collar', 'Whisper "I miss you" like you mean it dangerously', 'Say three places you\u2019d kiss me tonight',
];
const HAND_INTENSE = [
  'A 60-second show to one song, no skipping', 'The move you think about when you\u2019re alone — show me',
  'Describe your filthiest thought about me. All of it.', 'Give a preview of tonight that\u2019s impossible to forget',
  'One layer lighter. Every ten seconds.', 'Full confidence: the camera is me for one minute',
  'Show me how you\u2019d tease me for an hour', 'Describe exactly what you\u2019d do first if I walked in',
  'The fantasy you\u2019ve never typed out — say it now', 'Dress for our night in. Show every step.',
  'Slowly remove one thing, then hold the pose', 'The sound you make when it\u2019s too good — one second of it',
  'Tell me your top three, in order, no shyness', 'Lose the shirt for the rest of the game',
  'Give me the look you give right before… you know', 'Describe what you\u2019d whisper against my ear',
  'The position of our next night in — charade it', 'Say what you\u2019d cook me… wearing only an apron',
  'One minute: lips, camera, no words', 'Show me the screensaver of your desire: your choice',
  'Tell me the silliest place you\u2019ve thought about me', 'Say "I\u2019m yours tonight" — and mean it',
  'Do your best "just woke up like this" shot', 'Whisper our next night in like a movie trailer',
  'Describe me from head to toe as you\u2019d unwrap me', 'The emoji that describes tonight — and why, out loud',
  'Set a timer: one minute of your best moves', 'Kiss the camera like it\u2019s the last time for a month',
  'Tell me what you\u2019d wear under your outfit for me', 'Say the naughtiest compliment you\u2019ve saved for me',
];

/* generated combinations — same tone, many distinct cards */
const BODIES = ['neck', 'lips', 'shoulders', 'hands', 'back', 'stomach', 'hips', 'thighs', 'ears', 'chest'];
const BODY_ACTS = [
  (b) => `Kiss my ${b}, slowly`,
  (b) => `Whisper what you\u2019d do to my ${b}`,
  (b) => `Trace your fingertips along your own ${b} — show me`,
  (b) => `Describe my ${b} in exactly five words`,
  (b) => `Warm hands, then cool breath — on my ${b}`,
  (b) => `Blindfolded, you\u2019d have to find my ${b} — tell me your plan`,
  (b) => `Kiss the camera the way you\u2019d kiss my ${b}`,
  (b) => `Trace where you want my hands — starting at your ${b}`,
  (b) => `Give my ${b} a two-second compliment`,
  (b) => `Show me your favorite spot to be kissed — yours is the ${b}`,
];
const SCENES = ['in the shower', 'on the kitchen counter', 'in the backseat of a car', 'in a hotel elevator', 'by a big window, lights on', 'during a movie on the sofa', 'in the sea on holiday', 'against the front door', 'on a lazy Sunday morning', 'during a power cut', 'in the middle of a slow dance', 'at 3 a.m.'];
const SCENE_VERBS = [
  (sc) => `A long kiss ${sc}`,
  (sc) => `A slow make-out ${sc}`,
  (sc) => `A whispered fantasy ${sc}`,
  (sc) => `Something neither of us has dared yet ${sc}`,
  (sc) => `Start something ${sc} and see where it goes`,
  (sc) => `Get caught sneaking a kiss ${sc}`,
];
const OUTFITS = ['an oversized shirt', 'only an apron', 'my favorite outfit of yours', 'nothing but a towel', 'pajamas three sizes too big', 'something you\u2019ve never dared to wear'];
const OUTFIT_VERBS = [
  (o) => `Wear ${o} on our next call`,
  (o) => `Take a photo in ${o} — for my eyes only`,
  (o) => `Show up to our video date in ${o}`,
  (o) => `Do a slow spin in ${o}`,
];
const ROMANTIC = [
  'Write a two-line poem about us', 'Name a song that is secretly about us', 'Plan our dream holiday out loud, in detail',
  'Describe our first morning living together', 'Tell me the trait you hope our kids inherit', 'Say what you\u2019d name a boat after us',
  'Tell me the meal you\u2019d cook for our anniversary', 'Describe the view from our dream bedroom window', 'Pick our wedding dance song and say why',
  'Tell me the little habit of mine you\u2019d miss most', 'Describe the first place we\u2019d travel post-savings-goal', 'Name the movie that is most "us"',
  'Say what you\u2019d tell our friends about our first night chatting', 'Describe the city where you\u2019d run away with me',
  'Pick the pet we\u2019d adopt and name it', 'Tell me the season that fits our love', 'Describe our favorite chair in our future home',
  'Say the three words that describe our story so far', 'Tell me which of my texts you\u2019ve reread the most',
  'Describe the coffee mug we\u2019d fight over', 'Tell me the nickname our friends would give us as a couple',
  'Describe the Sunday morning smell of our home', 'Say what you\u2019d engrave on my gift', 'Pick the color of our bedroom walls',
  'Tell me the first holiday we\u2019d take our families on together', 'Describe our dream kitchen in three words',
  'Say what you\u2019d do if we woke up in the same timezone forever', 'Tell me the book you\u2019d read me in bed',
  'Pick the photo of us that belongs framed', 'Describe the exact moment you\u2019d propose if you could',
  'Tell me the song for our first dance', 'Name the street we\u2019d live on', 'Describe the breakfast I\u2019d find you making',
  'Say the trait of mine that would survive a zombie apocalypse', 'Tell me what our dog would be named',
  'Describe our first house plant\u2019s name', 'Say the city lights you\u2019d show me first', 'Pick our karaoke duet',
  'Tell me the jacket of mine you\u2019d steal', 'Describe the meal that means "I\u2019m sorry"',
];
const PLAYFUL = [
  'Do your best impression of me on camera', 'Speak in an accent for the next two cards', 'Show me the dance move you\u2019d use to cheer me up',
  'Sing the chorus of our song', 'Tell me the most embarrassing thing you\u2019ve done to impress someone', 'Show your best model pose',
  'Do a dramatic reading of my last text', 'Imitate my laugh', 'Show me your "caught red-handed" face',
  'Tell me the worst pickup line you\u2019d use on me', 'Reveal the emoji that is most "you"', 'Do a runway walk in slow motion',
  'Tell me the weirdest thing you\u2019ve googled at 2 a.m.', 'Show me your best "please" face', 'Narrate what you\u2019re doing like a nature documentary',
  'Do your best evil-genius laugh', 'Show me three facial expressions: happy, flirty, guilty', 'Tell me the song you\u2019d serenade me with',
  'Describe your dream proposal in five words', 'Show the face you make when I say something dirty', 'Give a TED talk titled "Why I Like You"',
  'Do ten jumping jacks while saying something sweet', 'Whisper-gossip about us like our neighbors', 'Show me your victory dance for our next game night',
  'Tell me the prank you\u2019d pull on me someday', 'Describe me as a movie villain', 'Say the cheesiest compliment that still works on me',
  'Show me your "I told you so" dance', 'Rank: my smile, my voice, my hugs', 'Do a slow-motion high five to the camera',
  'Tell me the nickname you\u2019d give my belly laugh',
];

const DECK = [];
const push = (text, tier) => DECK.push({ text, tier });
const TOPUP2 = {
  warm: [
    'Send me the emoji of our next adventure', 'Describe the hoodie I’d steal from you', 'Say the word you’d text at midnight',
    'Tell me the show we’d binge in one weekend', 'Describe the dance we’d do at a wedding', 'Say the dessert that means I’m sorry',
    'Name the city lights I’d photograph', 'Tell me the market we’d get lost in', 'Describe the fireplace we’d fall asleep beside',
    'Say the breakfast you’d bring to my balcony', 'Show me the stretch you do every morning', 'Tell me the hobby you’d teach me',
    'Describe the kitchen playlist for pancakes', 'Say the flower I’d find on my pillow', 'Name the bridge we’d take a photo on',
    'Tell me the coat we’d share in winter', 'Describe the drive we’d take with no destination', 'Say the board game you’d let me win',
    'Show me the ring tone you’d set for me', 'Tell me the tree we’d carve our initials into',
    'Say the photo you’d retake just for me', 'Describe the playlist for our road trip',
    'Tell me the snack you’d save me from the machine', 'Show me the sweater you’d sleep in',
    'Name the show we’d restart after falling asleep', 'Describe the mug you’d hand me first',
    'Say the walk we’d take to fall back in love', 'Tell me the breakfast we’d burn together',
    'Describe the rooftop we’d sneak up to with two blankets and zero plans',
  ],
  spicy: [
    'Say the shirt that has to hit the floor first', 'Describe the whisper that would end my evening plans', 'Tell me the room I’d pull you into',
    'Show me the angle that drives you crazy', 'Say the kiss you’d rehearse before our date', 'Describe the outfit that means no talking tonight',
    'Tell me the light switch you’d flick slowly', 'Say the shower thought you’d never text me', 'Describe the blanket we’d not need tonight',
    'Whisper the word before the word', 'Tell me the hour we’d lose track of', 'Say the candle count for round two',
    'Describe the pause that says everything', 'Show me the wrist that would pull me back', 'Tell me the sofa cushion that is yours',
    'Say the playlist that would get us in trouble', 'Describe the goodnight that isn’t goodnight', 'Tell me the outfit that means behave — or not',
    'Show me the look for our next hotel morning', 'Say the pet name that would make me blush in public',
    'Describe the texts that would keep me smiling all day', 'Say the kiss that would restart an argument, happily', 'Tell me the blanket we’d fight over tonight',
    'Describe the look I’d give across the dinner table', 'Say the time you’d knock on my hotel door', 'Whisper the dress code for our next night in',
    'Tell me the song that would end our evening early', 'Describe the breakfast we’d need after tonight', 'Say the word you’d mouth across the room',
  ],
};
TOPUP2.warm.forEach((text) => push(text, TIER_WARM));
const TOPUP = {
  warm: [
    'Kiss my forehead before you say goodnight', 'Slow-motion wave goodbye on camera', 'Tell me the detail of me you\u2019d sketch from memory',
    'Describe our perfect rainy afternoon', 'Say what you\u2019d thank me for today', 'Share the exact moment you wanted to call me',
    'Whisper the compliment you\u2019ve been saving', 'Tell me the joke that always makes you think of us',
    'Say the word you\u2019d never use for anyone else', 'Describe my voice in three words', 'Show me your talking-to-you face',
    'Tell me the meal that means celebration for us', 'Name the place you\u2019d take me the day we meet', 'Describe the jacket you\u2019d lend me',
    'Say what you\u2019d whisper at the airport gate', 'Tell me the song that ruined you for other songs', 'Show me the emoji that is our story',
    'Describe the blanket I\u2019d find on your sofa', 'Say the time of day you miss my voice most', 'Tell me the food you\u2019d feed me by hand',
    'Describe our anniversary dinner table', 'Say what you\u2019d engrave inside my ring', 'Show me the screensaver you\u2019d pick of us',
    'Tell me the habit you want us to start', 'Describe the walk you\u2019d take me on', 'Say the drink that tastes like our first date',
    'Name the movie you\u2019d watch just to hold me', 'Tell me the word you\u2019d never say to anyone but me',
    'Describe the photo you\u2019d keep in your wallet', 'Say what you\u2019d name our karaoke duo', 'Tell me the smell of our future home',
    'Describe the lamp we\u2019d argue about', 'Say the city you\u2019d move to if I asked', 'Show me your sleepiest, softest voice',
    'Tell me the little thing you\u2019d do to annoy me lovingly', 'Describe our Sunday market basket', 'Say the tea we\u2019d sip at midnight',
    'Name the rain song for our window', 'Show me your sleepy smile for the camera',
  ],
  spicy: [
    'Whisper what my perfume does to you', 'Describe the kiss you\u2019d steal at the movies', 'Say where my lipstick should end up',
    'Trace your lower lip with your thumb', 'Tell me the text that would make you drop everything', 'Describe the way you\u2019d unwrap my scarf',
    'Say what my hoodie smells like in your head', 'Kiss the back of your own hand like it\u2019s mine', 'Whisper the word that starts our nights',
    'Describe my hands in your favorite memory', 'Say the sound of my name that you like most', 'Tell me where my voice lands in your chest',
    'Show me how you\u2019d pull me closer', 'Describe our slow dance in one breath', 'Say the hour you\u2019d wake me at \u2014 and why',
    'Tell me the shirt you\u2019d unbutton first', 'Whisper the adjective that fits my kiss', 'Describe the look before the lean-in',
    'Say what my laugh does to your shoulders', 'Show me your favorite lean-in angle', 'Tell me the perfume that means our night',
    'Describe the way you\u2019d warm my cold hands', 'Say where you\u2019d keep my photo', 'Whisper the word between yes and more',
    'Describe the walk from the door to the couch', 'Tell me the seat you\u2019d pull me onto', 'Show me the smile that means later',
    'Say what you\u2019d cook wearing my apron', 'Tell me the song that would slow our kitchen dance', 'Describe the light you\u2019d leave on for me',
    'Say what you\u2019d whisper at the movie\u2019s credits', 'Tell me the jacket you\u2019d wrap us both in', 'Describe the morning you\u2019d make worth staying in',
    'Say the word you\u2019d teach me in your language', 'Show me the gesture that means come-here in your country', 'Tell me the candle scent for our bath',
    'Describe the playlist for our rainy night', 'Say what my emoji does to your evening', 'Whisper the meal you\u2019d eat off my plate',
    'Tell me the blanket fort you\u2019d build for us', 'Describe the sleepy kiss that starts everything', 'Say the shower song for our duet',
    'Tell me the coat pocket you\u2019d hold my hand in', 'Describe the mirror you\u2019d dance me past', 'Say the nightcap you\u2019d invent for us',
  ],
  intense: [
    'Show me the pose you\u2019d hold for a full minute', 'Describe our night in the style of a movie trailer', 'Say the three words before the three words',
    'Whisper the dare you want back', 'Describe the sound of our next hello', 'Tell me the game you\u2019d invent to undress me',
    'Say what you\u2019d do with 60 seconds and no rules', 'Show me the shoulder that misses my teeth', 'Describe the kiss that would make me forget my name',
    'Tell me the minute you\u2019d replay from our last call', 'Say what you\u2019d trade for one night in the same bed', 'Describe the shirt that has to go first',
    'Whisper the rule you\u2019d set for tonight', 'Show me the look that says the door is locked', 'Tell me the candle count for our next game',
    'Say the sentence you\u2019d breathe against my ear', 'Describe the way you\u2019d pin my hands', 'Tell me the dare you\u2019d invent if I lost twice',
    'Say what you\u2019d do to win three rounds straight', 'Describe the ice cube\u2019s journey on my skin', 'Show me the arms that would hold me after',
    'Tell me the sentence that would undo a year', 'Say the bed\u2019s first sound in the morning', 'Describe the after \u2014 the part nobody writes about',
  ],
  playful: [
    'Do your best dramatic gasp', 'Whisper-gossip about our future neighbors', 'Rank: mornings, nights, and 3 a.m. calls',
    'Show the face you make when I win a game', 'Narrate your day like a royal announcement', 'Say the compliment that would embarrass you most',
    'Describe me as a weather forecast', 'Do a slow-motion wink and explain it', 'Tell me the pet name you\u2019d never admit to liking',
    'Show me your I-am-not-blushing face', 'Describe our love as a food truck', 'Say the superpower our couple would have',
    'Tell me the statue we\u2019d be as museum figures', 'Give the weather report for our weekend', 'Describe our couple tattoo idea',
    'Show the walk you\u2019d do after winning an argument', 'Say the emoji that ruins you', 'Describe me as a sound effect',
    'Tell me the dessert you\u2019d guard from me', 'Do the eyebrow raise that ends negotiations', 'Say the cereal our couple would be',
    'Show the you-first bow', 'Describe our duet as a circus act', 'Say the outfit our dog would wear',
  ],
};
TOPUP.warm.forEach((text) => push(text, TIER_WARM));
TOPUP.spicy.forEach((text) => push(text, TIER_SPICY));
TOPUP.intense.forEach((text) => push(text, TIER_INTENSE));
TOPUP.playful.forEach((text) => push(text, TIER_WARM));


HAND_WARM.forEach((text) => push(text, TIER_WARM));
ROMANTIC.forEach((text) => push(text, TIER_WARM));
PLAYFUL.forEach((text) => push(text, TIER_WARM));
BODIES.forEach((b) => BODY_ACTS.slice(0, 4).forEach((fn) => push(fn(b), TIER_SPICY)));
HAND_SPICY.forEach((text) => push(text, TIER_SPICY));
OUTFITS.forEach((o) => OUTFIT_VERBS.forEach((fn) => push(fn(o), TIER_SPICY)));
SCENES.forEach((sc) => SCENE_VERBS.slice(0, 4).forEach((fn) => push(fn(sc), TIER_INTENSE)));
BODIES.forEach((b) => BODY_ACTS.slice(4).forEach((fn) => push(fn(b), TIER_INTENSE)));
HAND_INTENSE.forEach((text) => push(text, TIER_INTENSE));

/* commit-reveal helpers — a salted 32-bit mix, deterministic on both devices */
function markHash(mark, salt) {
  let h = 0x9e3779b9 ^ salt;
  for (const ch of String(mark)) { h = (h ^ ch.charCodeAt(0)) >>> 0; h = Math.imul(h, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; }
  return h >>> 0;
}

registerGame({
  id: 'yesnomaybe', name: 'Yes · No · Maybe', tag: 'Private marks — only mutual yes\u2019s reveal', icon: '🤫', section: 'adult',
  init() { return { phase: 'lobby', round: 0, cardIdx: 0, commits: {}, marks: {}, outcome: null, matched: [], soft: 0, sealed: 0, cardsDone: 0, winner: null }; },
  fill(a) { if (a.type === 'next' || a.type === 'start') a.cardIdx = Math.floor(Math.random() * DECK.length); },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && (s.phase === 'over' || s.cardsDone >= CARDS_PER_MATCH))) {
      if (a.cardIdx == null) return s;
      return { ...s, phase: 'play', round: s.round + 1, cardIdx: a.cardIdx, commits: {}, marks: {}, outcome: null, matched: [], soft: 0, sealed: 0, cardsDone: 0, winner: null };
    }
    if (s.phase !== 'play') return s;

    if (a.type === 'next') {
      if (a.cardIdx == null || s.cardsDone >= CARDS_PER_MATCH) return s;
      return { ...s, round: s.round + 1, cardIdx: a.cardIdx, commits: {}, marks: {}, outcome: null };
    }

    if (a.type === 'commit') {
      if (s.commits[a.by] || s.outcome) return s;
      const commits = { ...s.commits, [a.by]: a.hash >>> 0 };
      return { ...s, commits };
    }

    if (a.type === 'reveal') {
      if (!s.commits[a.by] || s.marks[a.by]) return s;
      const mark = ['yes', 'maybe', 'no'].includes(a.mark) ? a.mark : null;
      if (!mark || markHash(mark, a.salt) !== s.commits[a.by]) return { ...s, outcome: 'invalid', cardsDone: s.cardsDone + 1 };
      const marks = { ...s.marks, [a.by]: mark };
      if (!marks.host || !marks.guest) return { ...s, marks };
      // both revealed → compute the outcome and keep only that
      const bothYes = marks.host === 'yes' && marks.guest === 'yes';
      const softPair = (marks.host === 'yes' && marks.guest === 'maybe') || (marks.host === 'maybe' && marks.guest === 'yes') || (marks.host === 'maybe' && marks.guest === 'maybe');
      const outcome = bothYes ? 'match' : softPair ? 'soft' : 'sealed';
      const matched = outcome === 'match' ? [...s.matched, DECK[s.cardIdx % DECK.length].text] : s.matched;
      const soft = s.soft + (outcome === 'soft' ? 1 : 0);
      const sealed = s.sealed + (outcome === 'sealed' ? 1 : 0);
      return { ...s, marks: {}, outcome, matched, soft, sealed, cardsDone: s.cardsDone + 1 };
    }
    return s;
  },
  view(el, s, ctx, api) {
    const myRole = ctx.myRole;
    const card = DECK[s.cardIdx % DECK.length];

    if (s.phase === 'lobby') {
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🤫'),
        h('div', { class: 'g-prompt' }, 'Yes · No · Maybe — Private Edition'),
        h('div', { class: 'g-sub', style: 'max-width:440px' }, `${DECK.length} intimate activities, drawn at random. Mark each one privately — Yes, Maybe or No. Your answers lock in secret (neither of you can peek), and only the things you BOTH said yes to ever appear. ${CARDS_PER_MATCH} cards per night.`),
        h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'start' }) }, 'Start privately 🤫'),
      ));
      return;
    }

    if (s.cardsDone >= CARDS_PER_MATCH) {
      el.append(h('div', { class: 'g-center', style: 'gap:10px' },
        h('div', { style: 'font-size:52px' }, '🤫'),
        h('div', { class: 'g-prompt' }, `${s.matched.length} mutual yes${s.matched.length === 1 ? '' : 'es'}, ${s.soft} soft match${s.soft === 1 ? '' : 'es'}, ${s.sealed} sealed`),
        s.matched.length ? h('div', { class: 'glass', style: 'padding:18px; border-radius:18px; max-width:440px; max-height:34dvh; overflow-y:auto' },
          h('div', { class: 'g-sub' }, 'Your mutual yes list'),
          ...s.matched.map((t) => h('div', { class: 'ynm-hit' }, '💚 ', t))) : h('div', { class: 'g-sub' }, 'No mutual yeses tonight — the seal held 🤫'),
        h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'rematch' }) }, 'New deck 🤫'),
      ));
      return;
    }

    // both locked in → reveal my mark (it was committed before either could peek)
    if (bothCommitted && !s.marks[myRole] && !s.outcome && myMark && !revealedFor(s)) {
      revealedFor(s);
      act({ type: 'reveal', mark: myMark, salt: mySalt });
    }

    const committed = !!s.commits[myRole];
    const bothCommitted = !!s.commits.host && !!s.commits.guest;

    const outcomeView = s.outcome === 'match' ? h('div', { class: 'ynm-outcome match' }, '💚 MATCH! You both said yes')
      : s.outcome === 'soft' ? h('div', { class: 'ynm-outcome soft' }, '💛 Soft match — worth a conversation')
        : s.outcome === 'sealed' ? h('div', { class: 'ynm-outcome sealed' }, '🔒 Sealed — at least one of you said no')
          : s.outcome === 'invalid' ? h('div', { class: 'ynm-outcome sealed' }, '🤨 A mark didn\u2019t verify — card skipped')
            : null;

    el.append(h('div', { class: 'g-center', style: 'gap:10px' },
      h('div', { class: 'scoreline' },
        h('div', { class: 'sc' }, `card ${Math.min(s.cardsDone + 1, CARDS_PER_MATCH)} of ${CARDS_PER_MATCH}`),
        h('div', { class: 'sc' }, `💚 ${s.matched.length} · 💛 ${s.soft} · 🔒 ${s.sealed}`)),
      h('div', { class: 'glass', style: 'padding:22px; border-radius:20px; max-width:460px' },
        h('div', { class: 'g-prompt' }, card.text),
        h('div', { class: 'g-sub' }, card.tier === TIER_WARM ? 'soft tier' : card.tier === TIER_SPICY ? 'spicy tier' : 'intense tier')),
      outcomeView,
      !committed && !s.outcome ? h('div', { class: 'ynmrow' },
        h('button', { class: 'ynm-btn yes', onclick: () => { sendMark('yes'); sfx.match(); haptic(buzz.match); } }, 'YES'),
        h('button', { class: 'ynm-btn maybe', onclick: () => { sendMark('maybe'); sfx.tap(); haptic(buzz.tap); } }, 'MAYBE'),
        h('button', { class: 'ynm-btn no', onclick: () => { sendMark('no'); sfx.tap(); haptic(buzz.tap); } }, 'NO'),
      ) : null,
      committed && !s.outcome ? h('div', { class: 'g-sub' }, 'Locked in — waiting for your partner…') : null,
      s.outcome && s.cardsDone < CARDS_PER_MATCH ? h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'next' }) }, 'Next card 🤫') : null,
      s.outcome && s.cardsDone >= CARDS_PER_MATCH ? h('button', { class: 'btn btn-hot', onclick: () => act({ type: 'rematch' }) }, 'See the summary 🤫') : null,
    ));

    function sendMark(mark) {
      const salt = Math.floor(Math.random() * 1000000);
      myMark = mark; mySalt = salt;
      act({ type: 'commit', hash: markHash(mark, salt) });
      haptic(buzz.tap);
    }
  },
});

let myMark = null, mySalt = null;
let revealedKey = null;
function revealedFor(s) { const k = s.round + ':' + s.cardIdx; if (revealedKey === k) return true; revealedKey = k; return false; }
