/* Import every game file — each self-registers with the engine.
   Menu order lives here. */
import '../games/board.js';
import '../games/wordrush.js';
import '../games/twentyq.js';
import '../games/draw.js';
import '../games/prompted.js';   // This or That + Heat Check
import '../games/duo-games.js';  // NHIE (std + 18+) + Spicy WYR
import '../games/truthdare.js';

import { allGames } from './engine.js';

export const CLASSIC_GAMES = ['tictactoe', 'connect4', 'memory', 'wordrush', 'draw', 'twentyq', 'thisorthat', 'nhie'];
export const ADULT_GAMES = ['nhie18', 'truthdare', 'wyr', 'heatcheck'];

export function gameMeta(id) { return allGames().find((g) => g.id === id); }
export function classicMeta() { return CLASSIC_GAMES.map(gameMeta).filter(Boolean); }
export function adultMeta() { return ADULT_GAMES.map(gameMeta).filter(Boolean); }
