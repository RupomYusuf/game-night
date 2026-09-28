/* Emoji Guess Duel — both players get the same emoji puzzle and race to type
   the answer; fastest correct guess scores. 500+ puzzles across categories,
   drawn at random every round by the host. Answers are checked on each
   player's own device — the answer key never crosses the wire. */
import { registerGame, hostNow } from './engine.js';
import { h } from '../ui.js';
import { sfx, haptic, buzz } from '../sound.js';

/* flags are real emoji, written per country */
const FLAGS = [
  ['🇦🇷','Argentina'],['🇦🇺','Australia'],['🇦🇹','Austria'],['🇧🇪','Belgium'],['🇧🇷','Brazil'],
  ['🇧🇬','Bulgaria'],['🇨🇦','Canada'],['🇨🇱','Chile'],['🇨🇳','China'],['🇨🇴','Colombia'],
  ['🇨🇷','Costa Rica'],['🇭🇷','Croatia'],['🇨🇺','Cuba'],['🇨🇿','Czechia'],['🇩🇰','Denmark'],
  ['🇩🇴','Dominican Republic'],['🇪🇬','Egypt'],['🇪🇪','Estonia'],['🇪🇹','Ethiopia'],['🇫🇮','Finland'],
  ['🇫🇷','France'],['🇩🇪','Germany'],['🇬🇷','Greece'],['🇬🇹','Guatemala'],['🇭🇳','Honduras'],
  ['🇭🇰','Hong Kong'],['🇭🇺','Hungary'],['🇮🇸','Iceland'],['🇮🇳','India'],['🇮🇩','Indonesia'],
  ['🇮🇷','Iran'],['🇮🇶','Iraq'],['🇮🇪','Ireland'],['🇮🇱','Israel'],['🇮🇹','Italy'],
  ['🇯🇲','Jamaica'],['🇯🇵','Japan'],['🇯🇴','Jordan'],['🇰🇿','Kazakhstan'],['🇰🇪','Kenya'],
  ['🇰🇼','Kuwait'],['🇱🇻','Latvia'],['🇱🇧','Lebanon'],['🇱🇹','Lithuania'],['🇱🇺','Luxembourg'],
  ['🇲🇾','Malaysia'],['🇲🇹','Malta'],['🇲🇽','Mexico'],['🇲🇩','Moldova'],['🇲🇦','Morocco'],
  ['🇲🇲','Myanmar'],['🇳🇵','Nepal'],['🇳🇱','Netherlands'],['🇳🇿','New Zealand'],['🇳🇬','Nigeria'],
  ['🇳🇴','Norway'],['🇴🇲','Oman'],['🇵🇰','Pakistan'],['🇵🇦','Panama'],['🇵🇪','Peru'],
  ['🇵🇭','Philippines'],['🇵🇱','Poland'],['🇵🇹','Portugal'],['🇶🇦','Qatar'],['🇷🇴','Romania'],
  ['🇷🇺','Russia'],['🇸🇦','Saudi Arabia'],['🇸🇳','Senegal'],['🇷🇸','Serbia'],['🇸🇬','Singapore'],
  ['🇸🇰','Slovakia'],['🇸🇮','Slovenia'],['🇿🇦','South Africa'],['🇰🇷','South Korea'],['🇪🇸','Spain'],
  ['🇱🇰','Sri Lanka'],['🇸🇪','Sweden'],['🇨🇭','Switzerland'],['🇹🇼','Taiwan'],['🇹🇭','Thailand'],
  ['🇹🇳','Tunisia'],['🇹🇷','Turkey'],['🇺🇦','Ukraine'],['🇦🇪','United Arab Emirates'],['🇬🇧','United Kingdom'],
  ['🇺🇸','United States'],['🇺🇾','Uruguay'],['🇺🇿','Uzbekistan'],['🇻🇪','Venezuela'],['🇻🇳','Vietnam'],
  ['🇾🇪','Yemen'],['🇿🇼','Zimbabwe'],['🇧🇩','Bangladesh'],['🇦🇱','Albania'],['🇧🇦','Bosnia'],
  ['🇹🇳','Tunisia'],['🇪🇨','Ecuador'],['🇨🇮','Ivory Coast'],['🇬🇭','Ghana'],['🇺🇬','Uganda'],
  ['🇹🇿','Tanzania'],['🇿🇲','Zambia'],['🇨🇲','Cameroon'],['🇭🇹','Haiti'],['🇱🇦','Laos'],
  ['🇲🇳','Mongolia'],['🇰🇭','Cambodia'],['🇳🇮','Nicaragua'],['🇵🇾','Paraguay'],['🇧🇴','Bolivia'],
  ['🇱🇺','Luxembourg'],['🇲🇨','Monaco'],['🇱🇮','Liechtenstein'],['🇭🇹','Honduras'],['🇸🇻','El Salvador'],
  ['🇧🇼','Botswana'],['🇳🇦','Namibia'],['🇲🇿','Mozambique'],['🇦🇴','Angola'],['🇪🇭','Sahara'],
  ['🇫🇯','Fiji'],['🇵🇬','Papua New Guinea'],['🇲🇻','Maldives'],['🇧🇭','Bahrain'],['🇱🇰','Sri Lanka'],
];
const EASY = [
  ['🐘☁️','dumbo'],
  ['🐨','koala'],['🦊','fox'],['🐺','wolf'],['🐸','frog'],['🐵','monkey'],
  ['🦉','owl'],['🦅','eagle'],['🦇','bat'],['🐝','bee'],['🦋','butterfly'],
  ['🐢','turtle'],['🐙','octopus'],['🦈','shark'],['🐬','dolphin'],['🐳','whale'],
  ['🐊','crocodile'],['🦓','zebra'],['🦏','rhino'],['🐪','camel'],['🦔','hedgehog'],
  ['🐇','rabbit'],['🐿️','squirrel'],['🦩','flamingo'],['🦚','peacock'],['🐔','chicken'],
  ['🦆','duck'],['🦜','parrot'],['🐍','snake'],['🦎','lizard'],['🕷️','spider'],
  ['🍎','apple'],['🍌','banana'],['🍓','strawberry'],['🍇','grapes'],['🍉','watermelon'],
  ['🍕','pizza'],['🍔','burger'],['🍟','fries'],['🌮','taco'],['🍣','sushi'],
  ['🍩','donut'],['🍪','cookie'],['🎂','cake'],['🥑','avocado'],['🧀','cheese'],
  ['🍤','shrimp'],['🥨','pretzel'],['🌭','hot dog'],['🍦','ice cream'],['🧁','cupcake'],
  ['🥞','pancakes'],['🍫','chocolate'],['🍬','candy'],['🥕','carrot'],['🌽','corn'],
  ['🎸','guitar'],['🎹','piano'],['🚀','rocket'],['🧲','magnet'],['🔮','crystal ball'],
  ['🕰️','clock'],['💡','lightbulb'],['🔑','key'],['🔨','hammer'],['🎈','balloon'],
  ['🧸','teddy bear'],['📷','camera'],['🎧','headphones'],['⌚','watch'],['🔭','telescope'],
  ['🧭','compass'],['⏳','hourglass'],['🛁','bathtub'],['🕯️','candle'],['🪑','chair'],
  ['⚽','football'],['🏀','basketball'],['🎾','tennis'],['🏐','volleyball'],['🏓','ping pong'],
  ['⛳','golf'],['🥊','boxing'],['🏄','surfing'],['🏊','swimming'],['🚴','cycling'],
  ['🌋','volcano'],['🏝️','island'],['🌈','rainbow'],['⚡','lightning'],['❄️','snowflake'],
  ['🌵','cactus'],['🌻','sunflower'],['🍄','mushroom'],['🌙','moon'],['☀️','sun'],
  ['🌍','earth'],['⭐','star'],['☁️','cloud'],['🔥','fire'],['💧','water drop'],
];
const REBUS = [
  ['🦁👑','the lion king'],['🐠🔍','finding nemo'],['❄️🏰','frozen'],['🕷️🧑','spider-man'],
  ['🦇🧑','batman'],['🌊🚢💔','titanic'],['👽🚲','e.t.'],['🐼🥋','kung fu panda'],
  ['🚗🏁','cars'],['💍🌋','the lord of the rings'],['🧹🧙‍♂️','harry potter'],['🦈🌊','jaws'],
  ['🍫🏭','willy wonka'],['🏝️📦','cast away'],['🏰💤','sleeping beauty'],['🕷️❄️','snow white'],
  ['👸🧜‍♀️','the little mermaid'],['🐯🥋??','kung fu panda 2'],['🐭🏰','disneyland'],
  ['🚢🧊❄️','titanic'],['🐕🏡','lady and the tramp'],['elephant 🐘☁️','dumbo'],
  ['🥊🎮','punch out'],['🦸🦸‍♀️','the avengers'],['🤴🏾👨🏿','the lion king 2'],
  ['🧛‍♂️🦇','dracula'],['🎃👻🎃','halloween'],['🕵️🔍放大镜','detective'],
  ['🚀🕰️','interstellar'],['🕰️⏪','time travel'],['🧠🤖','inception'],
  ['🔫🤠','the wild west'],['🐪🏜️','the desert'],['⚔️🛡️','gladiator'],['🦍🏢','king kong'],
  ['🎹🎵', 'the piano'],['🌪️🦈','sharknado'],['🎅,@','santa claus'],['🧜‍♂️🌊','the little merman'],
  ['👀🙏','i see you'],['🗣️📞','phone call'],['🐀👨‍🍳','ratatouille'],['🥋🇯🇵','karate kid'],
  ['🎶🎭','musical'],['🦕🦖','jurassic park'],['🌵🤠🐴','the cowboy'],['🛸🍻','aliens at the bar'],
  ['⚽⚽⚽','hat trick'],['🏆🥇','the champion'],['⚰️🧛','vampire coffin'],['🕯️🔮','fortune teller'],
  ['🌂💃','dancing in the rain'],['🎂🎈🎉','the birthday party'],['🏃💨','run fast'],
  ['🌙🐺','the wolf moon'],['🏰🌉','the castle bridge'],['🐝🍯','honey bees'],
];
const MUSIC = [
  ['🎤👑','queen'],['🌧️💜','purple rain'],['🎆','firework'],['⚡🎸','thunderstruck'],
  ['🌙🚶','walking on the moon'],['🍬','sugar'],['💋 lipstick','kiss'],['💃🔥','firework dancer'],
  ['🖤🎩','back in black'],['🎸🙋','guitar hero'],['🎹🎧','piano man'],['🎺🎺','trumpets'],
  ['💍🎤','the wedding singer'],['🕺🪩','disco'],['🎻🌧️','violin in the rain'],['🎤🧢','the singer with the cap'],
];
const PHRASES = [
  ['🐦📱','tweet'],['🧊🧠','ice cold'],['🍰😌','piece of cake'],['🐘🍽️','elephant appetite'],
  ['🐟🌊','plenty of fish in the sea'],['🌙💡','moonlight'],['🕰️⏳','time will tell'],
  ['👁️❤️','love at first sight'],['🔑❤️','key to my heart'],['🌮🎉','taco tuesday'],
  ['☕😔','but first coffee'],['🛏️😅','bed breath'],['🌍❤️','world love'],['🦶👟','footwear'],
  ['🕯️🕰️','candle light'],['🧤🥊','glove up'],['🐝🍯','busy bee'],['🏔️🔝','top of the world'],
  ['❤️⚡','love shock'],['🌟✨','shine bright'],['🐘🧠','elephant memory'],['🐝🔨','spelling bee'],
];
const SPORTS_EXTRA = [
  ['🏹','archery'],['🎱','billiards'],['⛸️','ice skating'],['🥌','curling'],['🪂','skydiving'],
  ['🧗','climbing'],['🤿','diving'],['🏋️','weightlifting'],['🤸','gymnastics'],['🏌️‍♀️','lady golf'],
  ['🎯','darts'],['🎮','esports'],['♟️','chess'],['🃏','card games'],['🎲','dice games'],
];
const LANDMARKS = [
  ['🗼','eiffel tower'],['🗽','statue of liberty'],['🏯','japanese castle'],['⛩️','torii gate'],
  ['🕌','mosque'],['🏰','castle'],['🎡','ferris wheel'],['🎢','roller coaster'],['🗿','moai'],
  ['🏖️','beach'],['🏜️','desert'],['🌉','bridge'],['⛲','fountain'],['⛺','camping tent'],
  ['🛕','temple'],['🏛️','museum'],['🎪','circus'],['🎠','carousel'],['🙇🇯🇵','japan bow'],
];
const TECH = [
  ['📱','phone'],['💻','laptop'],['🖥️','desktop'],['⌨️','keyboard'],['🖱️','mouse'],
  ['🖨️','printer'],['🤖','robot'],['🎮','game controller'],['📡','satellite'],['🔋','battery'],
  ['🔌','plug'],['💡💡','double lightbulb'],['🛰️','antenna'],['🔬','microscope'],['🖥️💻','workstation'],
  ['📻','radio'],['📺','television'],['📷📸','two cameras'],['☎️📞','old and new phones'],['🔋🔌','charge me'],
];
const FOOD2 = [
  ['🥪','sandwich'],['🥗','salad'],['🍜','noodles'],['🍲','soup'],['🍿','popcorn'],
  ['🧇','waffles'],['🥞🥞','double pancakes'],['🍞','bread'],['🥐','croissant'],['🧂','salt'],
  ['🌶️','chili'],['🥦','broccoli'],['🍅','tomato'],['🥒','cucumber'],['🌽🌽','double corn'],
  ['🫐','blueberries'],['🍒','cherries'],['🍑','peach'],['🥭','mango'],['🍍','pineapple'],
  ['🥥','coconut'],['🍯','honey'],['🥛','milk'],['☕','coffee'],['🍵','tea'],
  ['🧃','juice'],['🥤','soda'],['🍺','beer'],['🍷','wine'],['🍸','cocktail'],
  ['🍾','champagne'],['🥂','champagne glasses'],['☕🍪','coffee and cookies'],['🍿🎬','movie popcorn'],['🥟','dumplings'],
];
const ANIMALS2 = [
  ['🐮','cow'],['🐷','pig'],['🐔','hen'],['🐧','penguin'],['🦘','kangaroo'],
  ['🐂','bull'],['🐄','cattle'],['🐖','piglet'],['🐓','rooster'],['🦃','turkey'],
  ['🦌','deer'],['🐐','goat'],['🐑','sheep'],['🐎','horse'],['🐖🐖','two pigs'],
  ['🦭','seal'],['🐋','big whale'],['🦐','shrimp'],['🦑','squid'],['🐌','snail'],
  ['🐜','ant'],['🦗','cricket'],['🕸️','spider web'],['🐝🌺','bee on a flower'],['🐠','tropical fish'],
];
const NATURE2 = [
  ['🌸','blossom'],['🌺','hibiscus'],['🌷','tulip'],['🌹','rose'],['🪴','plant'],
  ['🌲','pine tree'],['🌳','tree'],['🌴🌴','two palms'],['🍂','falling leaves'],['🍁','maple leaf'],
  ['🌾','wheat'],['🌊','wave'],['💨','wind'],['🌫️','fog'],['⛰️','mountain'],
  ['🏔️','snowy mountain'],['🪨','rock'],['🪵','wood'],['🌙⭐','moon and stars'],['☀️🌤️','sunny day'],
];

const FLAGS2 = [
  ['🇸🇾','Syria'],['🇱🇾','Libya'],['🇸🇩','Sudan'],['🇦🇫','Afghanistan'],['🇧🇾','Belarus'],
  ['🇸🇴','Somalia'],['🇲🇬','Madagascar'],['🇧🇸','Bahamas'],['🇧🇳','Brunei'],['🇧🇹','Bhutan'],
  ['🇰🇵','North Korea'],['🇹🇲','Turkmenistan'],['🇰🇬','Kyrgyzstan'],['🇹🇯','Tajikistan'],['🇦🇲','Armenia'],
  ['🇬🇪','Georgia'],['🇦🇿','Azerbaijan'],['🇸🇷','Suriname'],['🇬🇾','Guyana'],['🇧🇿','Belize'],
  ['🇩🇿','Algeria'],['🇲🇱','Mali'],['🇳🇪','Niger'],['🇧🇫','Burkina Faso'],['🇬🇳','Guinea'],
  ['🇧🇯','Benin'],['🇹🇬','Togo'],['🇬🇦','Gabon'],['🇨🇬','Congo'],['🇷🇼','Rwanda'],
  ['🇧🇮','Burundi'],['🇸🇿','Eswatini'],['🇱🇸','Lesotho'],['🇬🇲','Gambia'],['🇱🇷','Liberia'],
  ['🇸🇱','Sierra Leone'],['🇲🇷','Mauritania'],['🇹🇬','Togo flag'],['🇨🇫','Central Africa'],['🇹🇩','Chad'],
];
const EXTRA2 = [
  ['🦄','unicorn'],['🐉','dragon'],['🧜‍♀️','mermaid'],['🧚','fairy'],['👸','princess'],
];
const EXTRA3 = [
  ['🍏','green apple'],['🍐','pear'],['🥯','bagel'],['🌯','burrito'],['🥫','can'],
  ['🍶','sake'],['🥄','spoon'],['🍴','fork and knife'],['🍽️','plate'],['🧊','ice cube'],
  ['☂️','umbrella'],['🧣','scarf'],['🧤','gloves'],['🧦','socks'],['👒','sun hat'],
  ['🎒','backpack'],['👞','shoe'],['👗','dress'],['🧢','cap'],['🎓','graduation cap'],
  ['💍','ring'],['💄','lipstick'],['🕶️','sunglasses'],['👃','nose'],['👂','ear'],
  ['👄','mouth'],['🦷','tooth'],['💪','strong arm'],['🙏','pray'],['👏','clap'],
  ['🤝','handshake'],['💅','nail polish'],['🪥','toothbrush'],['🧻','toilet paper'],['🧴','lotion'],
  ['🛒','shopping cart'],['🧺','basket'],['🚿','shower'],['🧼','soap'],
  ['🪒','razor'],['🧹','broom'],['🪣','bucket'],['🧽','sponge'],['🔔','bell'],
  ['🗝️','old key'],['🪑','stool'],['🛎️','service bell'],['🪟','window'],['🚪','door'],
];
const EXTRA4 = [
  ['🥧','pie'],['🧇🧇','waffle stack'],['🍑🍑','two peaches'],['🥦🥦','broccoli pair'],['🧀🍷','cheese and wine'],
  ['🎼','sheet music'],['🪗','accordion duo'],['🎺🎺','brass section'],['🎤🎧','studio session'],['🎬🎬','double feature'],
  ['🚦','traffic light'],['🚧','construction'],['⛽','gas station'],['🛤️','railway tracks'],['🚲','bicycle'],
  ['🛴','scooter'],['🚂','train'],['✈️','airplane'],['🛸','ufo'],['⛵','sailboat'],
  ['🛶','canoe'],['🚤','speedboat'],['🚁','helicopter'],['🚀🚀','two rockets'],['🛰️🪐','satellite in orbit'],
  ['🌈☀️','sunshower'],['🌪️','tornado'],['🌊🌊','big waves'],['🌙⭐','night sky'],['🌅','sunrise'],
  ['🌄','mountain sunrise'],['🌄🌅','two horizons'],['🏜️🌵','desert cactus'],['🏝️🌴','palm island'],['🌊🏖️','waves on sand'],
  ['🥾','hiking boot'],['🧿🧿','two charms'],['🕯️🕯️','two candles'],['🪞','mirror'],['🛏️','bed'],
  ['🚿🧼','soap and shower'],['🧺🧺','two baskets'],['🔑🚪','key and door'],['🔔🚪','doorbell'],['📌','pushpin'],
];

const EXTRA = [
  ['🦄','unicorn'],['🐉','dragon'],['🧜‍♀️','mermaid'],['🧚','fairy'],['🐲','dragon flag'],
  ['👸','princess'],['🤴','prince'],['🧙','wizard'],['🦸‍♂️','superhero'],['🦹','villain'],
  ['🎺','trumpet'],['🎻','violin'],['🥁','drums'],['🎷','saxophone'],['🪕','banjo'],
  ['🎬','clapperboard'],['🎤','microphone'],['🎲','dice'],['🧩','puzzle'],['🪁','kite'],
];
const FLAGS3 = [
  ['🇹🇴','Tonga'],['🇼🇸','Samoa'],['🇸🇨','Seychelles'],['🇲🇺','Mauritius'],['🇨🇻','Cape Verde'],
  ['🇱🇨','St Lucia'],['🇧🇧','Barbados'],['🇬🇩','Grenada'],['🇦🇬','Antigua'],['🇩🇲','Dominica'],
  ['🇪🇷','Eritrea'],['🇩🇯','Djibouti'],['🇸🇸','South Sudan'],['🇨🇩','DR Congo'],['🇬🇳','Guinea'],
];
const REBUS2 = [
  ['🐝🎬','bee movie'],['🍋🍋','double lemon'],['🧄🧛','garlic for the vampire'],
  ['🐭🧀','mouse and cheese'],['🎁🎂','birthday presents'],['💣🧨','explosives'],
  ['🛵🍕','pizza delivery'],['🏊🥇','swimming gold'],['🎸🎤','rock star'],
  ['🏰🗡️','medieval throne'],['🌙🐺','the wolf howls'],['🚬🚫','no smoking'],
  ['🗝️🚪','the key and the door'],['🦄🌈','unicorn rainbow'],['🪙🪙','two coins'],
  ['🧿','evil eye'],['🔮🕯️','fortune teller room'],['🧨🎆','new year fireworks'],
  ['🍦🌈','rainbow ice cream'],
  ['🧛‍♂️🧄','vampire garlic'],['🐺🌕','full wolf moon'],['🍓❤️','berry love'],
];
const DECK = [
  ...FLAGS, ...FLAGS2, ...EASY, ...REBUS, ...REBUS2, ...MUSIC, ...PHRASES, ...SPORTS_EXTRA,
  ...LANDMARKS, ...TECH, ...FOOD2, ...ANIMALS2, ...NATURE2, ...EXTRA2, ...EXTRA3, ...EXTRA4,
].map(([e, a]) => ({ e, a, al: [a, a.replace(/^the /, ''), a.replace(/^the /, '').replace(/ & /g, ' and ')] }));

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const isCorrect = (idx, guess) => {
  const g = norm(guess);
  if (!g) return false;
  const card = DECK[idx];
  return card.al.some((a) => norm(a) === g || norm(a) === g.replace(/^the /, '') || g === norm(a).replace(/ /g, ''));
};

const ROUND_MS = 75_000;
const TARGET = 10;

registerGame({
  id: 'emojiduel', name: 'Emoji Guess Duel', tag: 'Same puzzle — fastest answer scores', icon: '🎯', section: 'classic',
  init() { return { phase: 'lobby', round: 0, turn: 'host', cardIdx: 0, cardEndsAt: null, win: null, score: { host: 0, guest: 0 }, winner: null }; },
  fill(a) {
    if (a.type === 'next' || a.type === 'start') a.cardIdx = Math.floor(Math.random() * DECK.length);
  },
  reduce(s, a) {
    if ((a.type === 'start' && s.phase === 'lobby') || (a.type === 'rematch' && s.phase === 'over')) {
      if (a.cardIdx == null) return s;
      return { ...s, phase: 'play', round: s.round + 1, turn: 'both', cardIdx: a.cardIdx, cardEndsAt: Date.now() + ROUND_MS, win: null, score: { host: 0, guest: 0 }, winner: null };
    }
    if (s.phase !== 'play' && s.phase !== 'reveal') return s;
    if (a.type === 'next') {
      if (s.phase !== 'play' && s.phase !== 'reveal') return s;
      if (a.cardIdx == null) return s;
      return { ...s, phase: 'play', round: s.round + 1, cardIdx: a.cardIdx, cardEndsAt: Date.now() + ROUND_MS, win: null };
    }
    if (a.type === 'win') {
      if (s.win) return s;
      const score = { ...s.score, [a.by]: s.score[a.by] + 1 };
      const over = score[a.by] >= TARGET;
      return { ...s, win: a.by, score, phase: over ? 'over' : 'reveal', winner: over ? a.by : null };
    }
    return s;
  },
  tick(s, { now }) {
    // host-only: a card that timed out draws a fresh random one
    if (s.phase === 'play' && s.cardEndsAt && now > s.cardEndsAt) {
      return { ...s, round: s.round + 1, cardIdx: Math.floor(Math.random() * DECK.length), cardEndsAt: now + ROUND_MS, win: null };
    }
    return null;
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    const card = DECK[s.cardIdx % DECK.length];
    const myTurnToType = !s.win;

    if (s.phase === 'lobby') {
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, '🎯'),
        h('div', { class: 'g-prompt' }, 'Emoji Guess Duel — 500+ puzzles'),
        h('div', { class: 'g-sub', style: 'max-width:430px' }, 'Both of you get the same emoji puzzle. Type the answer — the fastest correct guess scores. Countries, movies, songs, animals, objects and more. First to 10 wins.'),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'start' }) }, 'Start the duel 🎯'),
      ));
      return;
    }

    if (s.phase === 'over') {
      const iWon = s.winner === ctx.myRole;
      el.append(h('div', { class: 'g-center' },
        h('div', { style: 'font-size:52px' }, iWon ? '🏆' : '🎯'),
        h('div', { class: 'g-prompt' }, iWon ? `First to ${TARGET} — you win! 🎉` : `${api.peerName} reached ${TARGET} first`),
        h('div', { class: 'g-sub' }, `Final score — you ${s.score[ctx.myRole]} · them ${s.score[ctx.myRole === 'host' ? 'guest' : 'host']}`),
        h('button', { class: 'btn btn-primary', onclick: () => act({ type: 'rematch' }) }, 'Rematch 🎯'),
      ));
      return;
    }

    const iWonThis = s.win === ctx.myRole;
    const theyWon = s.win && s.win !== ctx.myRole;
    const remaining = Math.max(0, s.cardEndsAt - hostNow());
    const chip = h('span', { class: 'grace-chip', style: 'font-variant-numeric:tabular-nums' }, '⏱ 75');
    const anim = () => {
      if (!chip.isConnected) return;
      const rem = Math.max(0, s.cardEndsAt - hostNow());
      chip.textContent = `⏱ ${Math.ceil(rem / 1000)}s`;
      requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);

    el.append(h('div', { class: 'g-center', style: 'gap:10px' },
      h('div', { class: 'scoreline' },
        h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, String(s.score[ctx.myRole]))),
        chip,
        h('div', { class: 'sc' }, h('b', {}, String(s.score[ctx.myRole === 'host' ? 'guest' : 'host'])), ' ', api.peerName)),
      h('div', { class: 'glass', style: 'padding:26px; border-radius:22px; max-width:420px' },
        h('div', { class: 'g-prompt', style: 'font-size:44px; letter-spacing:.08em' }, card.e),
        h('div', { class: 'g-sub' }, 'What is it?')),
      myTurnToType ? h('div', { style: 'display:flex; gap:8px; width:min(420px,100%)' },
        h('input', { class: 'field', 'data-k': 'emo-ans', placeholder: 'Type your answer…', maxlength: 40, id: 'emo-input' }),
        h('button', {
          class: 'btn btn-hot',
          onclick: () => {
            const inp = el.querySelector('#emo-input');
            const v = (inp?.value || '').trim();
            if (!v) return;
            inp.value = '';
            if (isCorrect(s.cardIdx, v)) { act({ type: 'win', by: ctx.myRole }); sfx.win(); haptic(buzz.win); }
            else { sfx.miss(); const st = el.querySelector('#emo-status'); if (st) { st.textContent = '❌ not it — try again'; setTimeout(() => { st.textContent = ''; }, 1200); } }
          },
        }, 'Send ⚡'),
      ) : null,
      h('div', { class: 'g-sub', id: 'emo-status', style: 'min-height:18px' },
        s.win ? (iWonThis ? `⚡ You were fastest — +1` : `⚡ ${api.peerName} was fastest`) : 'First correct answer scores'),
    ));

    const inp = el.querySelector('#emo-input');
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.closest('.g-center').querySelector('button.btn-hot').click(); });
  },
});

