// Registry of enemy movement behaviors, referenced by `behavior` in data/enemies.js.
// A behavior is { init?(enemy, game), update(enemy, game, dt), post?(enemy, game) (after
// the spatial hash is built) }. Ported from the original as each user joins the game;
// users whose behavior isn't here yet are left out of the spawn mix (see spawner.js).

import chase from './chase.js';
import dart from './dart.js';
import line from './line.js';

export const BEHAVIORS = { chase, dart, line };
