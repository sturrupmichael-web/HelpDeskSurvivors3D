# Helpdesk Survivors 3D

Play it at <https://michaelsturrup.com/HelpDeskSurvivors3D/>, where it's one of the games on
michaelsturrup.com. The original 2D game stays at
<https://game.michaelsturrup.com/>.

A 2.5D rebuild of [Helpdesk Survivors](https://github.com/sturrupmichael-web/HelpDeskSurvivor)
in Three.js: the same survivors-like about working the IT helpdesk, drawn in 3D with a tilted
follow camera and low-poly models built from code. The game logic is ported from the original;
the rendering, camera and floor visuals are new.

Plain ES modules with one runtime dependency (Three.js). The published page is a single static
`index.html`; the online leaderboard, accounts and cloud saves talk to the 2D game's Supabase
project, with tables of the 3D game's own (`supabase/`).

## Run it

```sh
npm install                 # once: Three.js, esbuild, Playwright
python3 -m http.server 8000 # or: npm run serve
```

Then open <http://localhost:8000/dev.html>, which loads the code straight from `src/` (an import
map points `three` at `node_modules`), so edits show up on reload.

`npm run build` writes `index.html`: one self-contained page with the CSS and all JavaScript,
Three.js included, inlined and minified by esbuild, under a strict Content Security Policy. It
isn't kept in git; GitHub Actions builds it on every deploy.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys / left stick | Move |
| Touch | Put a finger down anywhere and drag (floating joystick) |
| Enter (title screen) | Clock In: pick a tech (once there's more than one, or pay to hire one), then a map, then Shift Policies (after your first shift). Arrows or 1-9 to choose, Enter for next, Esc to go back. The very first Clock In offers the training shift |
| H (map step) | Hardcore on/off (once you've won a shift on every map) |
| R / N (Shift Policies step) | Reorg: two random bad policies for an extra +10% / no policies |
| S / C / A / O / T (title screen) | Overtime Shop / Characters / Achievements / Settings / Training |
| B / U (title screen) | Leaderboard (1-5 or arrows for the map, C no policies only, H Hardcore only; tap a player for their profile) / Account (name, Sign in with Google, cloud save) |
| P (end-of-shift summary) | Post the shift to the leaderboard (the first time, type a name; a guest account is made for you). Shifts that used a playtest helper can't be posted |
| Esc / P / gamepad Start (or the II button) | Pause; also pauses when the tab is hidden. R restarts and Q quits to the title from the pause menu (press twice) |
| Enter / C / S / Esc | End-of-shift summary: Next Shift / Change Tech or Map / Overtime Shop / Title |
| R (level-up cards) | Reroll the cards (needs the shop's Escalation Path) |
| M | Mute / unmute (sound starts after your first key press or tap) |
| F | FPS counter on/off |
| O (or the gear button) | Settings: shadows, outlines, simpler far-away users, resolution, FPS counter, sound and music volume, screen shake, damage numbers, vibration, camera tilt and distance, and the playtest helpers where they're on |
| | **Playtest helpers** (below): only on a local server, with `?debug` in the address, or in a `PLAYTEST=1` build (the playtest copy). Off on the live site |
| 1 / 2 | Playtest: spawn 50 / 300 users |
| 3 | Playtest: add the next tool |
| T | Playtest: swap your newest tool for the next one in the toolbox (to try every tool in turn) |
| 4 | Playtest: skip ahead 1 minute |
| 5 | Playtest: god mode on/off |
| 6 | Playtest: clear users |
| 7 | Playtest: level up every tool |
| 8 | Playtest: enough XP for the next level (level-up cards) |
| 9 | Playtest: drop a Change Approved chest |
| 0 | Playtest: evolution kit (max tools + paired passives, and a chest) |
| U | Playtest: one of each user in a ring around you |
| B (or =) | Playtest: start the next boss fight now (the map's own boss before 10:00, then the Executive) |
| K | Playtest: knock a quarter of its HP off the boss (to see its phases and the ending) |
| 1–4 / tap | Pick a level-up card |
| R | Playtest: start a new shift |
| G | Playtest: +$1,000 Overtime Pay (works on the menus too). Settings also has Wipe the save |
| L | Playtest: unlock the next map, as if you'd won a shift on the one before it; once every map is open, count a win on all of them, which opens Hardcore (works on the menus too) |

## Project layout

```
data/          balance and content, copied from the original (world pixels, as there)
src/engine/    fixed-timestep loop, input, object pool, spatial hash, synthesized sound and music,
               phone vibration (all ported)
src/sim/       the simulation: player, users and their behaviors/, tools (weapons/) and their
               projectiles, Closed Tickets and items (pickups.js), level-up cards and chests
               (upgrades.js), CSAT score (score.js), floor zones such as paper jams (zones.js), boss
               attacks (hazards.js), spawner and wave timeline, the five maps' floor layouts and
               collision (floor.js) and their twists (maps.js), the
               save with Overtime Pay, the shop and unlocks (meta.js), achievements, tech perks
               (perks.js), Shift Policies and Hardcore (policies.js), the training shift
               (tutorial.js), the shift timeline and the performance review. No Three.js, no DOM
src/render/    Three.js: view, follow camera, floor chunks, the instanced horde, projectiles and
               tool effects, pickups, floor zones (zones.js), bosses and their floor telegraphs (bosses.js), boss
               bullets and meeting bombs (hazards.js), particles (fx.js), models.js (every shape
               lives here)
src/net/       the online parts, ported from the original: accounts through Supabase Auth
               (account.js), the leaderboard (leaderboard.js) and cloud saves (cloudsave.js)
src/ui/        HTML/CSS overlays: HUD (hud.js), floating numbers and words (floaters.js, a 2D
               canvas), the title and menus between shifts (menus.js), level-up cards and chests,
               pause menu, end-of-shift summary with its timeline chart, the leaderboard,
               Account and profiles (online.js), settings,
               FPS counter, touch stick (icons.js is the original's pixel icons)
supabase/      the SQL for the 3D game's tables, and how to set them up (README.md there)
tests/         npm test: simulation tests in Node, page tests in headless Chromium
```

Rules that keep this working:

- `src/sim/` never imports Three.js or touches the page, so it runs headless in Node
  (`npm test -- node`). The renderer only reads simulation state.
- Simulation units are the original's world pixels on a flat plane (x right, y down the screen),
  so numbers in `data/` port unchanged. The renderer maps (x, y) to Three.js (X, Z) at
  1 unit = 16 px, and draws everything at its feet (`y + foot`), where collision happens.
- On phones (Settings: Simpler far-away users), users well beyond the tech are drawn from a
  low-detail copy of their model (`lowDetail` in models.js, about half the triangles) with no
  outline.
- Every model comes from `src/render/models.js` as vertex-colored geometry: people are
  toon-shaded, everything else flat-shaded, and people and furniture get ink outlines
  (an inverted hull, toggled in Settings). To use real art later, swap an entry there for a
  loaded glTF.
- The furniture layout is the original's, chunk for chunk (same seeded RNG sequence), on every
  map, so the cubicles, racks, pods and parked cars stand where they did in 2D. Each map has
  its own light in `src/render/view.js` (LOOKS); the Night Shift turns it off and gives the
  tech a flashlight.
- The visible floor is a trapezoid in 3D. The renderer passes its corners to the simulation
  each frame (`sim.setView`), and the spawner places users just outside that shape.
- Users are drawn with one `InstancedMesh` per kind plus one instanced blob shadow. A user
  whose behavior hasn't been ported yet is left out of the spawn mix (`src/sim/spawner.js`),
  and a user with no model yet is warned about once in the console and not drawn.
- Tools work the same way: `src/sim/weapons/index.js` lists the ported behaviors (all 21 of
  the original's), and only those tools are offered (`weaponReady`). Projectiles share one
  pool and are drawn with one `InstancedMesh` per sprite id; a projectile with no model yet is
  drawn as a small cube. `src/render/weapons.js` draws projectiles, shockwaves, auras and
  shields; `src/render/tools.js` draws the rest (lightning, beams, radar, puddles, zip ties,
  grids, ducks, turrets, helpers) through a few shared instanced batches.

## Tests

`npm test` runs every `tests/*.test.mjs`: simulation tests in Node, and page tests in headless
Chromium against `dev.html` and, if built, `index.html`. First time: `npx playwright install chromium`.
WebGL runs in software there, so it checks correctness, not speed. The online tests answer the
game's requests with a pretend Supabase (`tests/fakeSupabase.mjs`); nothing reaches the real one.

## Deploy

Pushes to `main` run Tests; when they pass, Deploy builds `index.html` and publishes it to
GitHub Pages (Settings > Pages > Source: GitHub Actions). There's no custom domain or CNAME
here on purpose: the account's user site (sturrupmichael-web.github.io) uses
michaelsturrup.com, so GitHub serves this repo at `michaelsturrup.com/HelpDeskSurvivors3D/`
(the repo's name is the folder). `site.mjs`
lists what's served: the page, `sw.js` (offline play once installed), `manifest.webmanifest`
and `icons/` (home-screen icons and the link preview, made from the game by
`node icons/make.mjs`).

`PLAYTEST=1 npm run build` makes a copy with the playtest helpers on wherever it runs, for
the private playtest page.
