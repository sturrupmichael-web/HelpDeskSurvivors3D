// The game's version: the time of the last commit (UTC), stamped in by build.mjs.
// dev.html isn't built, so there it is "dev".
export const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';
