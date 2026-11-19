# PIER HEAT — Sunset Bay

An original open-world crime game in the spirit of GTA 6, built for the make.fun **gta6-01** bounty: a golden-hour coastal city to explore on foot and by car, traffic and pedestrians, cars to steal and drive, a wanted level with police who respond, eight chained missions with a story, combat, a HUD with a minimap, a start screen, pause, and local saves.

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/c/gta6-01)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Open World](https://img.shields.io/badge/open--world-Sunset%20Bay-green)](https://make.fun/c/gta6-01)

## The game

You are **Mateo Vega**, 28, getaway driver. **Kira**, your radio handler, talks you through eight jobs across **Sunset Bay** — a pastel deco Ocean Drive, terracotta Little Havana, and glass Downtown towers, with a sandy beach, the sea, and a wooden pier under a low golden sun.

- **Steal the Scarlet Arrow**, run the pier, deliver packages, tail a courier, watch the marina, escape through three checkpoints, and survive the final three-star tide.
- **Witness rule:** a crime only raises your wanted level when a police officer or a walking pedestrian within 30 m sees it. No witnesses, no stars. Hide for 22 seconds with no police near and the heat drops a star.
- **Police response:** 1 star — officers on foot try to bust you; 2+ — police cars chase and roadblock; 3+ — a helicopter circles and fires after locking on.
- **Controls:** WASD move/drive, mouse look (pointer lock or drag), **E** enter/exit car, **F** shoot, **Shift** boost, **Space** drift, **R** change radio, **P** pause, **Q** EMP pulse.
- **HUD:** mission panel, money and wanted stars, police dispatch feed, speed / health / car condition, ammo and items (EMP, SMOKE), a round minimap with mission beacon and police dots, Kira's dialogue, and the original Nightwave 98.3 radio loop (procedural WebAudio — no audio files).
- Everything is procedural: the city, Mateo, the cars, the helicopter and the pedestrians are built from basic shapes and canvas textures. No downloaded assets.

## How to run

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Or serve `game/` with any static server and open `index.html` in desktop Chrome. The game loads no network resources.

## Build the entry dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Bounty

- Competition: [make.fun gta6-01 — Make GTA 6](https://make.fun/c/gta6-01)
- Repository: https://github.com/aramexbit/gta6-01
- License: MIT (see LICENSE)
