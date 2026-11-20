# PIER HEAT — Sunset Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aramexbit/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aramexbit/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

[![version](https://img.shields.io/badge/version-6.5-orange)](https://github.com/aramexbit/gta6-01)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-r152-blue)](https://threejs.org/)

An original open-world crime game in the spirit of GTA 6, built with Three.js
from static files — no build step, no network at runtime. Entered in the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

## About

Sunset Bay (also called Bay City) is an original coastal city at golden hour:
indigo sky, magenta haze, a low orange sun sinking into a teal sea. You are
**Mateo Vega**, 28, a getaway driver in a burnt-orange bomber jacket. Your
radio handler **Kira** talks you through the job on Nightwave 98.3 while the
Bay City PD closes in.

Drive the wedge sports car **Scarlet Arrow** (plate SUN-8821) down Ocean
Drive, thread police roadblocks, lose the helicopter at three stars, and run
the **Three Gates** mission chain through the Little Havana night market.
On foot you can punch, draw a pistol, SMG or rifle, and steal any car you
find — in front of a witness, and the wanted stars climb.

Everything is original: the city, the names, the characters, the cars, the
radio, the sounds (synthesised in WebAudio). No Rockstar assets, no mods,
no pirated game files.

## Systems

- **Driving & walking** — arcade car physics, on-foot third person, E to
  enter/exit any car.
- **Traffic & pedestrians** — 32 traffic cars in 14 colours, 14 parked cars,
  120 pedestrians on the sidewalks, plus beachgoers and a market crowd.
- **Wanted 1–5 stars** — crimes witnesses see raise the level; 22 seconds
  with no police inside 40 m drops one star. Patrol cars, foot officers
  and a police helicopter (from 3 stars) respond, with PIT / FLANK / BLOCK
  tactics on the dispatch board.
- **Missions** — M1 "First Light" complete ($15,300, Respect 140); M2
  "Three Gates" runs in three stages with a timer and a beacon.
- **Combat** — fists, pistol, SMG, rifle; tracers and muzzle flash.
- **HUD** — wanted stars, money, health / armour / respect bars, mission
  panel with timer, police dispatch board, weapon wheel, live minimap,
  Kira's portrait dialogue.
- **Start screen & saves** — title screen with a real Slot 1 save
  (M2 PIER RUN, $15,300, Respect 140) stored in localStorage.
- **Sound** — procedural WebAudio: engine, two-tone siren, gunshots.

## Controls

| Key | Action |
| --- | --- |
| WASD | Drive / walk |
| Mouse | Look (click the game to lock the pointer) |
| E | Enter / exit car |
| Click / F | Shoot |
| 1–4 | Fists / Pistol / SMG / Rifle |
| Space | Handbrake |

## Play it

```sh
node serve.ts            # serves game/ at http://localhost:8080/
```

Open `http://localhost:8080/` in desktop Chrome. Screenshot framings are
staged with `?shot=1` (chase), `?shot=2` (street), `?shot=3` (night-market
firefight), `?shot=4` (title screen).

## Layout

- `game/index.html` — page, HUD and title screen
- `game/core.js` — renderer, sunset sky, materials, minimal glTF loader
- `game/world.js` — the city, the beach, the market, detailed vehicles
- `game/sim.js` — state, AI, wanted system, missions, combat, staging
- `game/main.js` — boot, camera, input, HUD, audio
- `game/WANTED.md` — the wanted system, in detail
- `game/MATEO-MODEL.md` — Mateo Vega's character model
- `game/vendor/three.min.js` — vendored Three.js r152 (the only library)

## License

MIT — see `LICENSE`.

## The shots

The four screenshots in `screenshots/` are rendered from the running game
in headless Chromium (1280×720, JPEG, each under 256 KiB):

1. **chase** — Mateo in the Scarlet Arrow on Ocean Drive, police on the
   bumper, roadblock ahead, the police helicopter overhead, the sun low
   over the sea.
2. **street** — the chase turns north into the grid, police flanking left
   and right, glass towers and shop signs on both sides.
3. **mission** — Mateo firing his pistol in the Little Havana night market:
   six striped stalls, lanterns, tracers, a downed enemy and a downed
   officer, the beacon marking the drop.
4. **start** — the title screen over the city at sunset, Slot 1 carrying
   the real progress: M2 PIER RUN, $15,300, Respect 140.

## Development

- Build the dossier: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
- Play locally: `node serve.ts --port 8080`, then open http://localhost:8080/
- Screenshots: `?shot=1..4` stages each shot; `?autostart=1` skips the title.
