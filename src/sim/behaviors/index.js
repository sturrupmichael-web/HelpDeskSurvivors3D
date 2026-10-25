// Registry of enemy movement behaviors, referenced by `behavior` in data/enemies.js.
// A behavior is { init?(enemy, game), update(enemy, game, dt), post?(enemy, game) (after
// the spatial hash is built) }. Ported from the original as each user joins the game;
// users whose behavior isn't here yet are left out of the spawn mix, and boss fights whose
// boss isn't here yet are skipped (see spawner.js). All of the original's are here now.

import chase from './chase.js';
import dart from './dart.js';
import line from './line.js';
import summoner from './summoner.js';
import dropper from './dropper.js';
import teleport from './teleport.js';
import aura from './aura.js';
import pair from './pair.js';
import tailgate from './tailgate.js';
import still from './still.js';
import incidentBoss from './incidentBoss.js';
import executiveBoss from './executiveBoss.js';
import ratsnestBoss from './ratsnestBoss.js';
import callerBoss from './callerBoss.js';
import janitorBoss from './janitorBoss.js';
import takeoverBoss from './takeoverBoss.js';

export const BEHAVIORS = { chase, dart, line, summoner, dropper, teleport, aura, pair, tailgate, still, incidentBoss, executiveBoss, ratsnestBoss, callerBoss, janitorBoss, takeoverBoss };
