# PIER HEAT — Sunset Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/aramexbit/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/aramexbit/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01).

You are **Mateo Vega**, 28, a getaway driver in **Sunset Bay** — a golden-hour
coastal city with three districts (pastel Ocean Drive, terracotta Little
Havana, glass Downtown), a sandy beach, and a wooden pier. Steal the
**SCARLET ARROW**, run eight chained jobs for your radio handler **Kira**,
outrun the Sunset Bay PD through a five-star wanted system where crimes only
count when someone sees them, and escape the marina finale with the whole
city on your tail.

## Play

Serve the `game/` folder with any static server and open `game/index.html`
in desktop Chrome — no network needed, everything is local:

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080/
```

## The eight jobs

1. **The Arrow** — steal the orange SCARLET ARROW on Ocean Drive ($500).
2. **Pier Safehouse** — the heat comes on mid-drive; reach the pier ($800).
3. **Package Run** — deliver across the city to Little Havana ($1,000).
4. **Kira's Drop** — fetch the case in Downtown, bring it back ($1,200).
5. **Tail the Courier** — stay within 12 m of the van for 5 s ($1,500).
6. **Stakeout** — watch the corner from the beacon for 8 s ($900).
7. **Checkpoint Dash** — burn through three checkpoints in order ($1,800).
8. **Marina Finale** — reach the marina at 3 stars, then escape ($3,000).

## Controls

- **WASD** — walk / drive · **Mouse** — look (pointer lock or drag)
- **E** — enter / exit car · **F** — shoot · **Right mouse** — aim
- **Shift** — boost / sprint · **Space** — drift
- **1** — EMP · **2** — Smoke · **R** — radio station · **P** — pause

Progress (cash and furthest mission) saves automatically to localStorage.

## What is inside

- A 7×7 road-grid city (~300×300 m) with pastel hotels, terracotta shops,
  20–46 m glass towers, palms, lamps, benches, a park, a beach and a pier.
- Traffic that loops the roads, pedestrians who walk the sidewalks and flee
  gunfire, foot cops, cruisers with flashing light bars, roadblocks, and a
  police helicopter at 3+ stars.
- A witness rule: shooting, hitting a pedestrian, ramming a cruiser, or
  stealing a car only raises your wanted level when a cop or a walking
  pedestrian is within ~30 m. No witness, no stars. Wanted decays one star
  after 22 seconds with no police within 40 m.
- Eight missions with Kira briefings, beacons, minimap markers and cash
  rewards — including a delayed-heat getaway, a courier tail, a stakeout,
  a checkpoint dash, and a three-star marina escape.
- HUD with mission panel, cash, wanted stars, police response list, speed,
  health, weapon/ammo, EMP/Smoke items, radio, and a round live minimap.
- Procedural WebAudio only: engine hum, two-tone siren, gunshots, and the
  original Nightwave 98.3 radio loop. All art is procedural — no borrowed
  assets, no GTA names, characters, map, art or music.

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
