# Helpdesk Survivors 3D

A 2.5D rebuild of [Helpdesk Survivors](https://github.com/sturrupmichael-web/HelpDeskSurvivor)
in Three.js: the same survivors-like about working the IT helpdesk, drawn in 3D with a tilted
follow camera and low-poly models built from code. The game logic is ported from the original;
the rendering, camera and floor visuals are new.

Plain ES modules with one runtime dependency (Three.js). No backend: the published page is a
single static `index.html`.

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
| F | FPS counter on/off |
| O (or the gear button) | Settings: shadows, resolution, FPS counter, screen shake, camera tilt and distance |

## Project layout

```
data/          balance and content, copied from the original (world pixels, as there)
src/engine/    fixed-timestep loop, input, object pool, spatial hash (ported)
src/sim/       the simulation: player, floor layout and collision. No Three.js, no DOM
src/render/    Three.js: view, follow camera, floor chunks, models.js (every shape lives here)
src/ui/        HTML/CSS overlays: settings, FPS counter, touch stick
tests/         npm test: simulation tests in Node, page tests in headless Chromium
```

Rules that keep this working:

- `src/sim/` never imports Three.js or touches the page, so it runs headless in Node
  (`npm test -- node`). The renderer only reads simulation state.
- Simulation units are the original's world pixels on a flat plane (x right, y down the screen),
  so numbers in `data/` port unchanged. The renderer maps (x, y) to Three.js (X, Z) at
  1 unit = 16 px, and draws everything at its feet (`y + foot`), where collision happens.
- Every model comes from `src/render/models.js` as vertex-colored geometry on one flat-shaded
  material. To use real art later, swap an entry there for a loaded glTF.
- The furniture layout is the original's, chunk for chunk (same seeded RNG sequence), so the
  cubicles stand where they did in 2D.

## Tests

`npm test` runs every `tests/*.test.mjs`: simulation tests in Node, and page tests in headless
Chromium against `dev.html` and, if built, `index.html`. First time: `npx playwright install chromium`.
WebGL runs in software there, so it checks correctness, not speed.

## Deploy

Pushes to `main` run Tests; when they pass, Deploy builds `index.html` and publishes it to
GitHub Pages (Settings > Pages > Source: GitHub Actions).
