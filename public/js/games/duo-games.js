/* Never Have I Ever (standard + 18+) and Spicy Would You Rather.
   All built on the shared duo-game factory. */
import { makeDuoGame } from './prompted.js';

/* ---------------- Never Have I Ever — standard ---------------- */
const NHIE_STD = [
  '…fallen asleep on a video call with someone.', '…written a song or poem about someone.',
  '…had a crush on a friend\'s sibling.', '…googled "how to know if someone likes me".',
  '…practiced a conversation in the mirror.', '…replayed a first kiss in my head this week.',
  '…cooked a meal to impress someone.', '…worn someone else\'s hoodie until it smelled like them.',
  '…danced alone to "our song".', '…saved a screenshot of a cute message.',
  '…laughed so hard with someone I cried.', '…written a text and deleted it ten times.',
  '…stalked someone\'s profile at 2am.', '…said "I\'m fine" when I absolutely was not.',
  '…kissed someone under the rain.', '…held hands in a movie theater.',
  '…planned a future daydream with someone in it.', '…skipped work or class to spend a day with someone.',
  '…sang karaoke to impress someone.', '…tried to cook their favorite dish and failed.',
  '…cried at a rom-com this year.', '…kept a memento from a first date.',
  '…made a playlist for someone.', '…waited hours just to see someone for five minutes.',
  '…fallen for my best friend.', '…said "I love you" first.',
  '…had a date end in a food fight.', '…gotten lost with someone and loved it.',
  '…watched the stars with someone special.', '…been someone\'s first kiss.',
  '…fallen asleep smiling after a date.', '…named a pet after someone I loved.',
  '…smiled at my phone like a fool in public.', '…danced in the kitchen at midnight.',
];

/* ---------------- Never Have I Ever — 18+ ---------------- */
const NHIE_HOT = [
  '…kissed my partner somewhere unexpected in the house.', '…had a steamy dream about my partner this week.',
  '…skinny dipped with someone.', '…thought about my partner while at work… more than once.',
  '…ever been caught in the act.', '…worn something special just for my partner.',
  '…kissed someone\'s neck until they melted.', '…had a moment in a hot tub or pool.',
  '…given a massage that went somewhere else.', '…been on a date dressed up with no underwear jokes allowed… well.',
  '…licked whipped cream off someone.', '…kissed in the backseat of a car.',
  '…had my partner pick my outfit for a night.', '…fallen asleep tangled up with someone.',
  '…showered with a partner to "save water".', '…been covered in kisses until I laughed.',
  '…tried candlelight and slow music on purpose.', '…sent a text I would blush if my mom read.',
  '…held someone\'s hand under a table at dinner with a straight face.', '…kissed someone senseless at the door before they left.',
  '…planned an entire evening in the bedroom.', '…worn my partner\'s shirt and nothing else.',
  '…had a slow dance that turned into more.', '…hidden a love note somewhere cheeky.',
  '…fallen asleep in someone\'s arms mid-kiss.', '…been the little spoon and loved it.',
  '…wanted to skip dessert and go straight to bed.', '…surprised my partner after a shower.',
  '…counted down the hours until my partner got home.', '…smirked at an inside joke in public.',
  '…kept the lights on on purpose.', '…started something in the kitchen (cooking counts… barely).',
  '…lost track of time because of a kiss.', '…woken up at 3am just to be closer.',
];

/* ---------------- Spicy Would You Rather (18+) ---------------- */
const WYR_HOT = [
  ['Slow, lingering kisses for an hour', 'A surprise kiss that takes my breath away'],
  ['A candlelit bubble bath for two', 'A midnight skinny dip'],
  ['A full-body massage with oil', 'Being kissed from head to toe'],
  ['Whispered secrets under the sheets', 'Loud laughter that turns into more'],
  ['A weekend hotel with no plans', 'A night in with nothing but each other'],
  ['I plan the seduction', 'You plan the seduction'],
  ['Morning kisses before coffee', 'Midnight kisses after wine'],
  ['A slow dance in candlelight', 'A steamy shower duet'],
  ['Blindfolded taste tests', 'Feather-light tickle fights'],
  ['Love bites or soft traces?', 'Gentle scratches or tender holds?'],
  ['Being pinned softly against the wall', 'Being lifted off my feet'],
  ['A striptease just for me', 'A lap dance just for me'],
  ['Sexting all day then exploding at night', 'Total radio silence then pure surprise'],
  ['Ice cubes or warm candle wax (safely!)', 'Silk blindfold or fluffy handcuffs'],
  ['Kiss me in public, daringly', 'Kiss me somewhere we could get caught… almost'],
  ['I wear your shirt all day', 'You wear my perfume all night'],
  ['Whisper my name', 'Moan my name'],
  ['Breakfast served in bed, wearing only an apron', 'Dinner slow-cooked with zero clothes plan'],
  ['A kiss that never stops', 'A hug that becomes a kiss'],
  ['Netflix or chill?', 'Chill then Netflix?'],
  ['Take a couples\' dance class', 'Take a couples\' massage class'],
  ['A dare I can\'t refuse', 'A truth I can\'t hide'],
  ['Stargazing on a blanket', 'Stargazing with no blanket… need body heat'],
  ['Hot tub with champagne', 'Sauna with whispered confessions'],
  ['I surprise you at work', 'You surprise me at home'],
  ['Slow build-up all evening', 'Spontaneous spark right now'],
  ['Your lips on my neck', 'Your hands in my hair'],
  ['Falling asleep tangled together', 'Waking up tangled together'],
  ['A rain-soaked kiss outside', 'A fireside cuddle inside'],
  ['I whisper what I want', 'I show you what I want'],
];

/* ---------------- registration ---------------- */

makeDuoGame({
  id: 'nhie', name: 'Never Have I Ever', tag: 'Confess, giggle, get closer', icon: '🙈', section: 'classic',
  bank: NHIE_STD,
  promptOf: (q) => q,
  options: [
    { v: 'never', label: 'Never have I ever', emoji: '🙅' },
    { v: 'have', label: 'Oh I have', emoji: '😏' },
  ],
  endEmoji: '🙈',
});

makeDuoGame({
  id: 'nhie18', name: 'Never Have I Ever', tag: 'The after-dark edition', icon: '🌶️', section: 'adult',
  bank: NHIE_HOT,
  promptOf: (q) => q,
  options: [
    { v: 'never', label: 'Never have I ever', emoji: '🙅' },
    { v: 'have', label: 'Oh, I have', emoji: '😏' },
  ],
  endEmoji: '🌶️',
});

makeDuoGame({
  id: 'wyr', name: 'Spicy Would You Rather', tag: 'Two tempting scenarios — pick in secret', icon: '🍑', section: 'adult',
  bank: WYR_HOT,
  promptOf: (pair) => `Would you rather… ${pair[0]}  or  ${pair[1]}?`,
  options: [
    { v: 'a', label: (item) => item[0], emoji: '🅰️' },
    { v: 'b', label: (item) => item[1], emoji: '🅱️' },
  ],
  matchCheck: (a, b) => a === b,
  answerText: (v, q) => (v === 'a' ? q[0] : q[1]),
  endEmoji: '🍑',
});
