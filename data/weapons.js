// Copied unchanged from the original (HelpDeskSurvivor data/).
// Weapon definitions. `behavior` picks a module from src/game/weapons/.
// `levels` has one full row per level (1..8) so you can read and tune each level directly.
// `notes` is the text shown on the level-up card for reaching that level.
//
// Common stats (not every behavior uses every stat):
//   damage    per hit (multiplied by the Domain Admin Rights passive)
//   cooldown  seconds between activations (Runbook passive reduces it)
//   radius    area size in world px (Second Monitor passive increases it)
//   knockback push strength in world px/s
//   speed     how fast the effect travels / expands (Mechanical Keyboard increases it)
//   count     projectiles / shields per activation
//   pierce    extra enemies a projectile passes through
//
// `tags` matter for enemy resistances (Shadow IT Steve shrugs off `policy` weapons).
// `sprite` is the projectile / deployable sprite id. `weight` is the chance of being
// offered on a level-up card relative to other items. `bossDamage` multiplies damage
// against bosses (the crowd-clearing evolutions would otherwise barely scratch them).

// The tools live in data/weapons/, one file per group. They are listed here in one
// object, in this order (the order matters: it's the order level-up cards are rolled in).
import { TOOLS } from './weapons/tools.js';
import { JOB_TITLE_TOOLS } from './weapons/jobtitle.js';
import { EVOLVED } from './weapons/evolved.js';

export const WEAPONS = { ...TOOLS, ...JOB_TITLE_TOOLS, ...EVOLVED };
