// Whether the playtest helpers (the number keys, G, L, T, U, B, K, R and the Settings
// buttons) are on. Like the original's debug mode, they're for building and testing the
// game: on a local server, with ?debug in the address, or in a build made for playtesting
// (PLAYTEST=1 npm run build, stamped in by build.mjs). Off on the live site.

export const playtestAllowed = (loc, built) =>
  built || ['localhost', '127.0.0.1', ''].includes(loc.hostname) || new URLSearchParams(loc.search).has('debug');

export const PLAYTEST = playtestAllowed(location, typeof __PLAYTEST__ === 'boolean' && __PLAYTEST__);
