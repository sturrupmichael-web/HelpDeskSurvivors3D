# Helpdesk Survivors: Doom Mode

Helpdesk Survivors as a 1993-style first-person shooter. You're the IT tech. The users
from the 3D game are the monsters, IT tools are the weapons, and access badges are the
keycards. Somewhere in the office there are server closets that everyone forgot about.

It's a separate entry point inside this repo. It shares the 3D game's Three.js, models,
icons, palette and loop, but has its own page, code and maps.

There are two levels so far, E1M1: The Help Desk and E1M2: Merger Day. You keep your
health, armor, tools and ammo from one level to the next. After the last level, the
episode's ending plays.

```
doom/
  dev.html          the page for development (loads src/ as ES modules)
  index.html        the built page (npm run build), one self-contained file; not in git
  maps/             the levels, as data (e1m1.json, e1m2.json)
  data/             weapons, items, users (enemies), skills and the episode, as plain tables
  src/              the game: level.js, geometry.js, renderer.js, game.js, enemies.js, ...
```

## Run it locally

```sh
npm install
npm run serve            # python3 -m http.server 8000
```

Open <http://localhost:8000/doom/dev.html>. It loads the source straight from `doom/src/`,
so refresh to see a change. Any static server works, but opening the file directly from
disk doesn't: browsers won't load ES modules from `file://`.

To try the built page, run `npm run build` and open <http://localhost:8000/doom/index.html>.
Everything is in that one file, including the map, so you can copy it anywhere and it
still runs.

### Controls

| | |
|---|---|
| Mouse | Look and turn (click the screen to capture the mouse) |
| Click, Ctrl or F | Fire |
| W A S D | Move and strafe (the arrow keys move and turn) |
| Shift | Walk (with Always Run on, which is the default) |
| Space, E or right-click | Use: doors, lifts, the exit switch |
| 1 to 6, the wheel, [ ] | Switch tools |
| Tab | Automap (- and = zoom) |
| Esc or P | Pause menu: options, controls, restart, quit |
| M / N | Music / all sound on and off |
| Gamepad | Left stick moves, right stick looks, RT fires, A uses, Start pauses |

The cheat codes are DOOM's: type `iddqd` for invulnerability, or `idkfa` for every tool,
full ammo, armor and all three badges. `idclev12` warps to E1M2 (`idclev11` back to E1M1).

## Edit the maps

Each level is a file in `maps/`, such as `maps/e1m1.json`. It has two grids of characters, each one character per
2 x 2 metre cell:

- `map` is the building. Each character is looked up in `tiles`.
- `things` is the same size and says what stands in each cell: the player start, items,
  users and decorations. Each character is looked up in `thingTypes`, and `.` means
  nothing.

Each tile says what a cell is:

- **Wall**: `"wall": "DRYWALL"` names its texture. Add `"exit": true` to make it the exit
  switch.
- **Door**: `"door": "DOOR"`. Add `"key": "blue"`, `"yellow"` or `"red"` to make it a badge
  door, or `"secret": true` to make it look like a wall.
- **Lift**: `"lift": {"high": 2, "wait": 3}`.
- **Floor**: everything else, with `floor` and `ceil` heights in metres (the player is 1.75
  tall and can step up 0.75), `floorTex` and `ceilTex`, a `light` level from 0 to 255, and
  an optional `effect` (`flicker`, `strobe` or `glow`).

Floors can also be hazards (`"hazard": {"damage": 10, "slow": 0.6}`) or part of a secret
(`"secret": true`). A tile that leaves out a height, light or texture, like a desk, a door
or a lift, takes it from the room next to it. Plain walls (`#`) take on the room's `walls`
texture.

Each thing type is one of these:

- `{"type": "start", "angle": 0}`: the player start. The angle is in degrees, with 0 facing
  north and 90 facing east.
- `{"item": "coffee"}`: an item from `data/items.js`.
- `{"monster": "pam"}`: a user from `data/enemies.js`.
- `{"decor": "plant"}`: a decoration.

Add `"minSkill": 4` to a thing to show it only on Ultra-Escalation and On-Call!.

Textures are drawn in code in `src/textures.js`. To add one, add a function there and use
its name in a tile. To try out a map file on its own, put it in `maps/` and open
`dev.html?map=maps/yours.json`. To add it to the episode, put its name in the `maps` list
in `data/episode.js`, which also holds the ending text.

The tests check every map in the episode. `npm test` floods each level from the start and
picks up badges in order. It fails if anything can't be reached: an item, a user, a
secret or the exit.

## Tune the game

- `data/weapons.js`: the six tools, with their damage, fire rate, spread, ammo and sounds.
- `data/items.js`: health, armor, ammo, power-ups and badges.
- `data/enemies.js`: each user's health, speed, attacks and behaviors. It also holds the
  five skills, with the damage and ammo multipliers each one uses.

## Deploy

The repo's Deploy workflow already publishes Doom Mode with the 3D game, at
<https://michaelsturrup.com/HelpDeskSurvivors3D/doom/>. Merging to `main` builds
`doom/index.html`, and `site.mjs` copies it and the maps into the site.

### On a subdomain (doom.michaelsturrup.com)

A GitHub Pages site serves one custom domain, and this repo is served under
michaelsturrup.com. A subdomain needs a repo of its own. The 2D game does the same thing at
game.michaelsturrup.com.

1. Create an empty public repo, for example `helpdesk-doom`.
2. Add a `CNAME` file containing `doom.michaelsturrup.com`, and the built `doom/index.html`
   as `index.html`. That one file is the whole game.
3. In that repo, go to Settings > Pages and set Source to the `main` branch. Under Custom
   domain, enter `doom.michaelsturrup.com`, then tick Enforce HTTPS once the certificate
   is ready.
4. At your DNS provider, add a `CNAME` record from `doom` to `sturrupmichael-web.github.io`.

To keep the subdomain in step with this repo, add a step to `.github/workflows/deploy.yml`.
After `npm run build`, it should push `doom/index.html` to that repo using a deploy key or
token. Or copy the file over by hand when you release.

## How it works

- **Level** (`src/level.js`): the map becomes a 2.5D grid of "sectors". Each cell has a
  floor and ceiling height. Doors are cells whose ceiling rises, and lifts are cells whose
  floor moves. Collision, line of sight and hitscan all use one ray trace through that
  grid.
- **Rendering** (`src/geometry.js`, `src/renderer.js`): the grid is turned into meshes
  with baked sector lighting and dark corners. They are drawn at about 240 lines and
  stretched with nearest-neighbour scaling. The status bar and the menus draw on a 2D
  canvas at DOOM's 320 x 200 scale.
- **Sprites** (`src/sprites.js`): when the game loads, each user model from the 3D game is
  rendered from 8 directions and in 4 poses into a sprite sheet. Each one falls over in
  4 more frames.
- **Users** (`src/enemies.js`): a user stands idle until it sees you or hears gunfire in a
  connected room. Then it chases you along a flow field that is recomputed a few times a
  second and attacks. A user hurt by a different kind of user turns on it.
- **Sound** (`src/audio.js`, `src/music.js`): every effect and the music are synthesized
  with Web Audio, so there are no sound files.
