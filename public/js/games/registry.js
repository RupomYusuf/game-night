/* Import every game file — each self-registers with the engine.
   Menu order lives here. */
import '../games/board.js';
import '../games/tetris.js';
import '../games/wordrush.js';
import '../games/hangman.js';    // Hangman Duel
import '../games/dotsboxes.js';  // Dots and Boxes
import '../games/emojiduel.js';  // Emoji Guess Duel
import '../games/yesnomaybe.js'; // Yes No Maybe (18+)
import '../games/twentyq.js';
import '../games/draw.js';
import '../games/uno.js';        // UNO Duel
import '../games/ludo.js';       // Ludo Duel
import '../games/chess.js';      // Chess
import '../games/battleship.js'; // Battleship
import '../games/rps.js';        // Rock Paper Scissors
import '../games/dareroulette.js'; // Dare Roulette (18+)
import '../games/strip.js';      // Strip Showdown (18+)
import '../games/fantasy.js';    // Fantasy Chain (18+)
import '../games/prompted.js';   // This or That + Heat Check
import '../games/duo-games.js';  // NHIE (std + 18+) + Spicy WYR
import '../games/truthdare.js';

import { allGames } from './engine.js';

export const CLASSIC_GAMES = ['tictactoe', 'connect4', 'memory', 'chess', 'battleship', 'rps', 'tetris', 'uno', 'ludo', 'hangman', 'dotsboxes', 'emojiduel', 'wordrush', 'draw', 'twentyq', 'thisorthat', 'nhie'];
export const ADULT_GAMES = ['yesnomaybe', 'dareroulette', 'stripshowdown', 'fantasy', 'nhie18', 'truthdare', 'wyr', 'heatcheck'];

export function gameMeta(id) { return allGames().find((g) => g.id === id); }
export function classicMeta() { return CLASSIC_GAMES.map(gameMeta).filter(Boolean); }
export function adultMeta() { return ADULT_GAMES.map(gameMeta).filter(Boolean); }
