# PIER HEAT — Sunset Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aramexbit/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aramexbit/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world driving + on-foot game set in **Sunset Bay**, a
coastal city at golden hour and in bright daylight. You are **Mateo Vega**,
28, getaway driver in a burnt-orange bomber jacket. Your handler **Kira**
is on the radio (Nightwave 98.3). The Bay City PD wants your car — the
matte-orange wedge coupe **Scarlet Arrow** (plate `SUN-8821`) — so lose the
heat, reach the pier, and hold the line.

Everything is original: no Rockstar assets, no GTA mods, no downloads.
The 3D world, the people, the cars and the music are all built in code;
the only model file is a CC0 animated human (`game/vendor/mateo.glb`),
loaded by a minimal GLB reader written for this game.

## Play

| Key | Action |
| --- | --- |
| W A S D / Arrows | Drive (accelerate, steer) |
| Space | Brake |
| Shift | Run on foot |
| F | Enter / exit car |
| Click | Shoot on foot |
| P | Save (free play only) |
| M | Mute |

Save is stored in `localStorage` under `pierheat-save-v69` and loaded
automatically on the next visit.

## The world

- **Sunset Blvd** — the main north–south avenue, cross streets every
  40 units, sidewalks, zebra crossings, street lamps, hydrants, benches and
  traffic lights.
- **Downtown** — a grid of pastel buildings with real 3D windows (about
  22% lit warm), glass storefronts with chrome doors, striped awnings and
  64 original shop signs, plus three landmark towers.
- **The beach** — speckled sand, a living shore with foam lines, 12
  umbrellas, towels, surfboards, a volleyball court, sandcastles,
  swimmers, surfers, joggers, kids digging, fishers and selfie-takers.
- **The pier** — a wooden pier at Z 40 with posts, rails, lamps, benches
  and the red-coned `PIER BAIT` shack.
- **The sky** — gradient sky dome, a glowing sun disc, drifting 3D clouds
  (10 at sunset, 16 by day, plus 6 fixed hero clouds) with soft shadows
  on the ground by day.

## Systems

- **Driving + on foot** — 16 traffic cars on two-way routes, a 130-strong
  city crowd plus 12 pier walkers and ~38 beach NPCs with 9 activities.
- **Wanted** — 1–5 stars (see `game/WANTED.md`): patrol cruisers, chase,
  roadblocks in the dispatch board, a police helicopter with a long
  searchlight beam, and crowds that flee when the heat is on.
- **Missions + story** — 3 stages (Meet Kira → Lose the Heat →
  Hold the Line) with objectives, a progress bar, a timer and a pulsing
  diamond on the round minimap.
- **Combat** — pistol / SMG / rifle slots, muzzle flash with a warm point
  light, and aiming police officers.
- **HUD** — objective panel, wanted stars + cash, dispatch board, weapon
  slots, health/armor bars, round minimap with roads, sea, sand, pier,
  objective diamond, police dots and a rotating player arrow, speedometer
  and radio readout.
- **Sound** — fully synthesised WebAudio: Nightwave 98.3 synthwave radio
  (96 BPM, Am–F–C–G), waves, siren, engine and gunshots. Audio starts only
  after a click or button press.

## Screenshots

Four staged shots, seeded for determinism (`?shot=N&seed=1`):

1. `1-chase.jpg` — sunset chase, 3 stars, heli overhead.
2. `2-onfoot.jpg` — daylight, Mateo facing the camera.
3. `3-mission.jpg` — daylight, Mateo meets Kira on the pier.
4. `4-combat.jpg` — sunset shootout, 5 stars, muzzle flash held.

## Build

```sh
node serve.ts            # play at http://localhost:8080/
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build dossier.json
```

## Known deviations from the brief (v7.2 rev 2)

- **Shot 2 heli height:** the brief stages the heli at Y 10, but at Y 10
  its rotor is clipped by the top frame edge. It is staged at Y 7.5 so the
  heli is whole in frame, which the brief also requires.
- **Clouds:** rendered with an unlit material (always white) instead of a
  lit standard material, which rendered pitch black on its shaded side.
- **Side windows:** buildings also carry windows on their flanks, so a
  flank seen from the street does not read as a blank wall.
- **Mateo scale (rev 3):** the ~69x armature scale is kept, not baked
  out — baking it broke the model twice (animation tracks overwrite bone
  translations; the mesh node has a zero translation). Height is measured
  from the skeleton, and the bind matrix is captured after world matrices
  are computed. See `game/MATEO-MODEL.md`.
- **Shot 2 / 4 foreground (rev 3):** foreground walkers and props were
  sitting centre-frame and blocking Mateo; they are now on the frame
  edges.
- **Crowd near the lens (rev 5):** in staged shots, city walkers within
  14 units of the camera are pushed 40 units along their lane, so a
  passer-by cannot walk in front of the lens before the screenshot.
  Foreground walkers in shot 2 sit 9–13 units out instead of 3–6.

## Files

- `game/index.html` — page + HUD markup and styles, loads the scripts.
- `game/core.js` — seeded RNG, canvas textures, minimal GLB reader,
  retinting, HUD setters, round minimap painter.
- `game/world.js` — Sunset Bay: sky, light, ground, sea, roads,
  buildings, street props, palms, beach, pier, clouds.
- `game/sim.js` — procedural people + poses, hero/traffic/police cars,
  traffic, crowds, police, helicopter, Mateo wrapper, muzzle flash.
- `game/audio.js` — WebAudio synth engine (radio, waves, siren, engine,
  gunshots).
- `game/main.js` — boot, input, save/load, 4 staged shots, free-play loop.
- `game/MATEO-MODEL.md` — the Mateo model, loader and retint notes.
- `game/WANTED.md` — the wanted system.
- `game/vendor/three.min.js` — Three.js global build (untouched).
- `game/vendor/mateo.glb` — CC0 animated human model (untouched).
- `main.ts` — dossier builder. `serve.ts` — local static server.
- `shots.json` — the 4 screenshot definitions.
