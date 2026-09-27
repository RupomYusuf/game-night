/* Drawing Guess — one draws a secret word (with swap, colors, sizes, eraser, undo),
   the other guesses live. Roles swap every round. The word stays on the drawer's screen. */
import { registerGame, hostNow } from './engine.js';
import { h } from '../ui.js';

const WORDS = [
  'candlelight', 'umbrella', 'hug', 'moon', 'pizza', 'guitar', 'pillow', 'airplane', 'snowman',
  'coffee', 'anchor', 'rainbow', 'teddy bear', 'sunflower', 'lighthouse', 'first kiss', 'slow dance',
  'heart', 'star', 'rocket', 'penguin', 'ice cream', 'bicycle', 'castle', 'dragon', 'mermaid',
  'hot air balloon', 'cactus', 'palm tree', 'windmill', 'ladybug', 'jellyfish', 'pineapple',
  'wedding cake', 'love letter', 'wine glass', 'music note', 'roller skates', 'treasure map',
  'campfire', 'ferris wheel', 'cupcake', 'washing machine', 'sneezing cat', 'selfie stick',
  'matryoshka doll', 'sock puppet', 'hula hoop', 'watermelon', 'fireworks',
  'cat',
  'dog',
  'mouse',
  'horse',
  'donkey',
  'monkey',
  'bear',
  'chicken',
  'baby chick',
  'kitten',
  'puppy',
  'lamb',
  'alpaca',
  'skunk',
  'porcupine',
  'chameleon',
  'swan',
  'ostrich',
  'moose',
  'beaver',
  'pigeon',
  'seagull',
  'woodpecker',
  'wild boar',
  'toad',
  'gecko',
  'iguana',
  'walrus',
  'seal pup',
  'pufferfish',
  'clownfish',
  'angelfish',
  'tadpole',
  'moth',
  'pelican',
  'teacup',
  'pencil',
  'crayon',
  'paintbrush',
  'easel',
  'paint palette',
  'notebook',
  'envelope',
  'postage stamp',
  'paper clip',
  'thumbtack',
  'ruler',
  'eraser',
  'pencil sharpener',
  'backpack',
  'suitcase',
  'handbag',
  'wallet',
  'sunglasses',
  'eyeglasses',
  'wristwatch',
  'necklace',
  'bracelet',
  'top hat',
  'beanie',
  'scarf',
  'mittens',
  'raincoat',
  'rain boots',
  'fuzzy slippers',
  'sneakers',
  'high heels',
  'bow tie',
  'necktie',
  'button',
  'zipper',
  'sewing needle',
  'spool of thread',
  'knitting needles',
  'ball of yarn',
  'drum',
  'violin',
  'trumpet',
  'piano',
  'harp',
  'xylophone',
  'maracas',
  'microphone',
  'headphones',
  'radio',
  'television',
  'laptop',
  'smartphone',
  'camera',
  'binoculars',
  'telescope',
  'magnifying glass',
  'compass',
  'hourglass',
  'balance scale',
  'life preserver',
  'wooden oar',
  'fishing rod',
  'birdcage',
  'doghouse',
  'bird bath',
  'wind chime',
  'garden gnome',
  'apple pie',
  'cherry pie',
  'gingerbread man',
  'sugar cookie',
  'macaron',
  'eclair',
  'pudding cup',
  'custard tart',
  'crepe',
  'churro',
  'funnel cake',
  'cotton candy',
  'candy cane',
  'candy apple',
  'gummy bear',
  'chocolate bar',
  'snow cone',
  'shaved ice',
  'root beer float',
  'banana split',
  'fruit salad',
  'garden salad',
  'tomato soup',
  'grilled cheese',
  'mac and cheese',
  'mashed potatoes',
  'baked potato',
  'hash browns',
  'scrambled eggs',
  'fried egg',
  'bacon strips',
  'sausage links',
  'roast chicken',
  'spare ribs',
  'grilled salmon',
  'fish and chips',
  'spring rolls',
  'wonton',
  'ramen bowl',
  'bento box',
  'rice ball',
  'steamed bun',
  'mooncake',
  'fortune cookie',
  'avocado toast',
  'sleeping baby',
  'crying baby',
  'yawning sloth',
  'dancing robot',
  'singing bird',
  'flying a kite',
  'riding a bike',
  'doing push ups',
  'lifting weights',
  'throwing a ball',
  'catching fireflies',
  'blowing bubbles',
  'walking the dog',
  'feeding ducks',
  'climbing a tree',
  'swinging on a swing',
  'going down a slide',
  'jumping in puddles',
  'making a snow angel',
  'ice skating',
  'downhill skiing',
  'snowboarding',
  'sledding',
  'surfing a wave',
  'snorkeling',
  'scuba diving',
  'rowing a boat',
  'kayaking',
  'fishing',
  'watering flowers',
  'picking apples',
  'raking leaves',
  'shoveling snow',
  'mowing the lawn',
  'hanging laundry',
  'washing dishes',
  'brushing teeth',
  'combing hair',
  'tying shoelaces',
  'writing a letter',
  'reading a book',
  'playing chess',
  'giving a high five',
  'blowing a kiss',
  'piggyback ride',
  'city skyline',
  'quiet village',
  'log cabin',
  'cozy cottage',
  'mansion',
  'apartment building',
  'office tower',
  'school building',
  'classroom',
  'kitchen',
  'living room',
  'bedroom',
  'garage',
  'basement',
  'front porch',
  'backyard',
  'flower garden',
  'city park',
  'duck pond',
  'wooden bridge',
  'tunnel',
  'harbor',
  'dock',
  'pier',
  'boardwalk',
  'campsite',
  'ski lodge',
  'pillow fort',
  'haunted house',
  'gingerbread house',
  'candy shop',
  'bookshop',
  'coffee shop',
  'flower shop',
  'fire station',
  'rain cloud',
  'smiling sun',
  'crescent moon',
  'starry night',
  'meteor shower',
  'raindrops',
  'heavy rain',
  'drizzle',
  'hailstorm',
  'snowfall',
  'blizzard',
  'frosty window',
  'snowball fight',
  'frozen pond',
  'morning mist',
  'sunburn',
  'autumn leaves',
  'falling leaves',
  'spring blossoms',
  'cherry blossom',
  'sunflower field',
  'tall grass',
  'wildflowers',
  'tumbleweed',
  'sand dunes',
  'rolling waves',
  'seashell',
  'starfish',
  'driftwood',
  'tide pool',
  'stream',
  'forest path',
  'mossy rock',
  'fallen log',
  'twinkling stars',
  'dewdrops',
  'oasis',
  'pinecone',
  'school bus',
  'taxi',
  'police car',
  'food truck',
  'jeep',
  'convertible',
  'limousine',
  'pickup truck',
  'delivery van',
  'snowplow',
  'steamroller',
  'excavator',
  'crane',
  'dump truck',
  'tow truck',
  'steam train',
  'monorail',
  'tram',
  'snowmobile',
  'hovercraft',
  'playing soccer',
  'basketball dunk',
  'bowling',
  'playing tennis',
  'badminton',
  'table tennis',
  'playing darts',
  'playing billiards',
  'doing yoga',
  'roasting marshmallows',
  'summer picnic',
  'hide and seek',
  'tug of war',
  'pillow fight',
  'karaoke night',
];
const COLORS = ['#f4f1fa', '#ff5fa2', '#ff9950', '#ffe066', '#7ce7ff', '#8bff9a', '#b06bff', '#111122'];
const SIZES = [3, 7, 16];
const CANVAS_BG = '#10101c';
const W = 800, H = 560, ROUND_MS = 90_000, REVEAL_MS = 4500;

let myWord = null;   // drawer's device only — never synced
let canvasEl = null, ctx2d = null;
let tool = { color: COLORS[0], size: SIZES[1], erase: false };
let drawing = false, curPts = [];

function pickWord() {
  let w = null;
  do { w = WORDS[Math.floor(Math.random() * WORDS.length)]; } while (w === myWord);
  myWord = w;
  return w;
}

function paintStroke(ctx, s) {
  ctx.strokeStyle = s.erase ? CANVAS_BG : s.color;
  ctx.lineWidth = s.erase ? s.size * 3 : s.size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  s.pts.forEach(([x, y], i) => { x *= W; y *= H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  if (s.pts.length === 1) { const [x, y] = s.pts[0]; ctx.lineTo(x * W + .01, y * H); }
  ctx.stroke();
}

function repaintAll(strokes) {
  if (!ctx2d) return;
  ctx2d.fillStyle = CANVAS_BG; ctx2d.fillRect(0, 0, W, H);
  for (const st of strokes) paintStroke(ctx2d, st);
}

registerGame({
  id: 'draw', name: 'Drawing Guess', tag: 'Draw the word, guess it live, swap roles', icon: '🎨', section: 'classic',
  init() {
    return { round: 1, drawer: 'host', strokes: [], guesses: [], phase: 'play', wordLen: null, deadline: Date.now() + ROUND_MS, revealAt: null, score: { host: 0, guest: 0 }, revealedWord: null, winner: null };
  },
  reduce(s, a) {
    if (a.type === 'setLen' && a.by === s.drawer && s.phase === 'play') return { ...s, wordLen: a.n, deadline: Date.now() + ROUND_MS };
    if (a.type === 'stroke' && a.by === s.drawer && s.phase === 'play') return { ...s, strokes: [...s.strokes, a.s] };
    if (a.type === 'undo' && a.by === s.drawer) return { ...s, strokes: s.strokes.slice(0, -1) };
    if (a.type === 'clear' && a.by === s.drawer) return { ...s, strokes: [] };
    if (a.type === 'guess' && a.by !== s.drawer && s.phase === 'play') {
      return { ...s, guesses: [...s.guesses.slice(-40), { by: a.by, text: a.text }] };
    }
    if (a.type === 'correct' && a.by === s.drawer && s.phase === 'play') {
      const guesser = s.drawer === 'host' ? 'guest' : 'host';
      return {
        ...s, phase: 'reveal', winner: guesser, revealedWord: a.word || null,
        score: { ...s.score, [guesser]: s.score[guesser] + 1 },
        revealAt: Date.now() + REVEAL_MS,
      };
    }
    if (a.type === 'timeout' && s.phase === 'play') {
      return { ...s, phase: 'reveal', winner: null, revealAt: Date.now() + REVEAL_MS };
    }
    if (a.type === 'revealWord' && a.by === s.drawer && s.phase === 'reveal' && !s.revealedWord) {
      return { ...s, revealedWord: a.word };
    }
    if (a.type === 'next' && s.phase === 'reveal') {
      return { ...s, round: s.round + 1, drawer: s.drawer === 'host' ? 'guest' : 'host', strokes: [], guesses: [], phase: 'play', wordLen: null, deadline: Date.now() + ROUND_MS, revealedWord: null, winner: null };
    }
    return s;
  },
  tick(s, { act, now }) {
    if (s.phase === 'play' && now > s.deadline) { act({ type: 'timeout', by: 'host' }); return s; }
    if (s.phase === 'reveal' && s.revealedWord && now > s.revealAt) {
      return { ...s, round: s.round + 1, drawer: s.drawer === 'host' ? 'guest' : 'host', strokes: [], guesses: [], phase: 'play', wordLen: null, deadline: Date.now() + ROUND_MS, revealedWord: null, winner: null };
    }
    return null;
  },
  score: (s) => s.score,
  view(el, s, ctx, api) {
    const iDraw = s.drawer === ctx.myRole;

    // drawer verifies guesses locally — the word never leaves their device
    if (iDraw && s.phase === 'play' && myWord && s.guesses.length) {
      const last = s.guesses[s.guesses.length - 1];
      if (last.text.trim().toLowerCase() === myWord.trim().toLowerCase()) {
        api.act({ type: 'correct', word: myWord });
      }
    }

    // drawer auto-picks a word when a new round begins on their device
    if (iDraw && s.wordLen == null && s.phase === 'play') {
      api.act({ type: 'setLen', n: pickWord().length });
    }
    // drawer reveals the word after a timeout
    if (iDraw && s.phase === 'reveal' && !s.revealedWord && myWord) {
      api.act({ type: 'revealWord', word: myWord });
    }

    const head = h('div', { class: 'scoreline' },
      h('div', { class: 'sc' }, 'Round ', h('b', {}, s.round)),
      h('div', { class: 'sc' }, api.myName, ' ', h('b', {}, s.score[ctx.myRole])),
      h('div', { class: 'sc' }, api.peerName, ' ', h('b', {}, s.score[ctx.myRole === 'host' ? 'guest' : 'host'])));

    if (s.phase === 'reveal') {
      el.append(head, h('div', { class: 'g-center' },
        h('div', { style: 'font-size:50px' }, s.winner ? '🎉' : '⏰'),
        h('div', { class: 'g-prompt' },
          s.winner ? (s.winner === ctx.myRole ? 'You guessed it! The word was:' : `${api.peerName} guessed it! The word was:`) : "Time's up! The word was:"),
        h('div', { class: 'g-prompt grad-text' }, s.revealedWord || '…'),
        h('div', { class: 'g-sub' }, 'Next round starting — roles swap!'),
      ));
      return;
    }

    const chip = h('span', { class: 'grace-chip', style: 'font-variant-numeric:tabular-nums' }, '⏱ 90');
    const top = h('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:center; margin-bottom:10px' },
      chip,
      h('div', { class: 'g-sub' },
        iDraw ? `Your word: “${myWord || '…'}” — they only see ${s.wordLen ?? '?'} letters` : `Guess what ${api.peerName} is drawing!`));
    if (iDraw) top.append(h('button', {
      class: 'btn btn-ghost btn-sm', onclick: () => {
        api.act({ type: 'clear' });
        api.act({ type: 'setLen', n: pickWord().length });
      },
    }, '🔄 Swap word'));
    const anim = () => {
      if (!chip.isConnected) return;
      const rem = Math.max(0, s.deadline - hostNow());
      chip.textContent = `⏱ ${Math.ceil(rem / 1000)}s`;
      requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);

    // canvas — element is reused across renders, repainted from the stroke log
    const box = h('div', { class: 'draw-canvas-box' });
    if (!canvasEl) { canvasEl = h('canvas'); canvasEl.width = W; canvasEl.height = H; ctx2d = canvasEl.getContext('2d'); }
    box.append(canvasEl);
    requestAnimationFrame(() => repaintAll(s.strokes));

    if (iDraw) {
      const tools = h('div', { class: 'draw-tools' });
      const colorBtns = COLORS.map((c) => h('button', {
        class: `swatch ${tool.color === c && !tool.erase ? 'on' : ''}`, style: `background:${c}`,
        onclick: (e) => { tool = { ...tool, color: c, erase: false }; markColors(e.currentTarget); },
      }));
      const colorWrap = h('div', { style: 'display:flex; gap:6px; align-items:center' }, colorBtns);
      const sizeBtns = SIZES.map((sz) => h('button', {
        class: `size-btn ${tool.size === sz ? 'on' : ''}`,
        onclick: (e) => { tool = { ...tool, size: sz }; markSizes(e.currentTarget); },
      }, h('span', { class: 'size-dot', style: `width:${5 + sz}px; height:${5 + sz}px` })));
      const sizeWrap = h('div', { style: 'display:flex; gap:6px; align-items:center' }, sizeBtns);
      const eraseBtn = h('button', {
        class: `btn btn-ghost btn-sm ${tool.erase ? 'btn-danger' : ''}`,
        onclick: () => { tool = { ...tool, erase: !tool.erase }; eraseBtn.classList.toggle('btn-danger', tool.erase); colorBtns.forEach((b, i) => b.classList.toggle('on', !tool.erase && COLORS[i] === tool.color)); },
      }, tool.erase ? '🧽 Erasing' : '🧽 Eraser');
      function markColors(btn) { colorBtns.forEach((b) => b.classList.toggle('on', b === btn)); eraseBtn.classList.remove('btn-danger'); }
      function markSizes(btn) { sizeBtns.forEach((b) => b.classList.toggle('on', b === btn)); }
      tools.append(colorWrap, h('div', { style: 'width:1px; height:26px; background:var(--glass-border)' }), sizeWrap, eraseBtn,
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => api.act({ type: 'undo' }) }, '↩️ Undo'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => api.act({ type: 'clear' }) }, '🗑️ Clear'));
      el.append(head, top, box, tools);
    } else {
      el.append(head, top, box);
    }

    if (!iDraw) {
      el.append(h('div', { style: 'display:flex; gap:8px; margin-top:10px' },
        h('input', { class: 'field', 'data-k': 'draw-guess', placeholder: `Type your guess… (${s.wordLen ?? '?'} letters)`, maxlength: 40, id: 'guess-input' }),
        h('button', {
          class: 'btn btn-primary',
          onclick: () => {
            const inp = el.querySelector('#guess-input');
            const v = (inp.value || '').trim();
            if (!v) return;
            inp.value = '';
            api.act({ type: 'guess', text: v });
            if (myWordGuessMatches(v)) { /* drawer checks on their screen — nothing here */ }
          },
        }, 'Guess')));
    }
    function myWordGuessMatches() { return false; } // guesses are verified on the drawer's device

    if (s.guesses.length) {
      el.append(h('div', { class: 'guess-list', style: 'margin-top:8px' },
        [...s.guesses].reverse().map((g) => h('div', { class: 'guess-row' },
          `${g.by === ctx.myRole ? 'You' : api.peerName}: ${g.text}`))));
    }

    if (iDraw) {
      const toPt = (e) => {
        const r = canvasEl.getBoundingClientRect();
        return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
      };
      canvasEl.style.cursor = 'crosshair';
      canvasEl.onpointerdown = (e) => {
        if (drawing || s.phase !== 'play') return;
        drawing = true; curPts = [toPt(e)];
        canvasEl.setPointerCapture(e.pointerId);
        paintStroke(ctx2d, { pts: curPts, ...tool });
      };
      canvasEl.onpointermove = (e) => {
        if (!drawing) return;
        curPts.push(toPt(e));
        paintStroke(ctx2d, { pts: curPts.slice(-2), ...tool });
      };
      const up = () => {
        if (!drawing) return;
        drawing = false;
        if (curPts.length) api.act({ type: 'stroke', s: { pts: curPts, color: tool.color, size: tool.size, erase: tool.erase } });
        curPts = [];
      };
      canvasEl.onpointerup = up; canvasEl.onpointercancel = up;
    }
  },
});
