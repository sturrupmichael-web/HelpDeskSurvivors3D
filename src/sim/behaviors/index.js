// Registry of enemy movement behaviors, referenced by `behavior` in data/enemies.js.
// A behavior is { init?(enemy, game), update(enemy, game, dt), post?(enemy, game) (after
// the spatial hash is built) }. Ported from the original as each user joins the game;
// users whose behavior isn't here yet are left out of the spawn mix, and boss fights whose
// boss isn't here yet are skipped (see spawner.js). The map bosses come with their maps.

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

export const BEHAVIORS = { chase, dart, line, summoner, dropper, teleport, aura, pair, tailgate, still, incidentBoss, executiveBoss };
