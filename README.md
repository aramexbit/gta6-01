# PIER HEAT — Sunset Bay

An original open-world crime game for the make.fun `gta6-01` bounty. You are
**Mateo Vega**, 28, a getaway driver in a burnt-orange bomber jacket, on the
run from the **Bay City PD** through the sun-soaked coastal city of **Sunset
Bay**. Steal the orange wedge coupe — the **Scarlet Arrow**, plate
`SUN-8821` — lose the heat, and make the pier. Your handler **Kira** talks
you through the job on the radio while **Nightwave 98.3** plays.

Everything in the game is original: the city, the story, the characters, the
car, the map, the art and the music. It is not GTA and uses no GTA assets.

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open
http://localhost:8080). Click **START ENGINE** to play.

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive the Scarlet Arrow / walk as Mateo |
| F | Get in / out of the car |
| Space | Brake |
| Left mouse | Shoot (on foot) |
| Shift | Run (on foot) |
| P | Save progress (localStorage) |
| M | Mute / unmute the radio |

## The world

- **Sunset Bay**: a beachfront avenue (Sunset Blvd) with a living beach —
  umbrellas, towels, surfers, swimmers, a volleyball court, joggers, kids
  building sandcastles, anglers on the wooden pier — and a gridded downtown
  with 60+ original shopfronts (ARCADE, TACOS, RECORDS, DANCE HALL, HOTEL
  OCEAN, CINEMA, BURGERS…) with real 3D windows, doors and glass shopfronts
  that reflect the sky.
- **Day mode**: saturated blue sky, drifting 3D clouds and moving cloud
  shadows. **Shot 1** runs at golden hour: low warm sun, orange haze.
- **Traffic**: colourful procedural cars with dark glass, door seams,
  handles, mirrors, grilles, plates and wheels; police cruisers with
  flashing light bars and a police helicopter with a searchlight.
- **Crowds**: 180+ pedestrians on the sidewalks, the beach and the pier.
  When a police chase starts (wanted level 1 or higher), nearby pedestrians
  **run away from the chase** — beach-goers sprint for the water, shoppers
  clear the sidewalks — with a proper running gait, not a stroll.
- **Mateo Vega** is a real skinned GLB character model (`game/vendor/
  mateo.glb`, loaded by a small hand-written GLB reader in `game/core.js`),
  with his own idle / walk / run / aim / fire animations. Kira is the same
  model re-outfitted in teal.

## Sound — all synthesised, all original

Every sound is generated live with the WebAudio API — no samples, no audio
files, nothing downloaded:

- **Nightwave 98.3**: a gentle 96 BPM synthwave loop (detuned-saw pads,
  triangle bass, sine kick, noise hats and snare) that starts after your
  first click or key press (browser autoplay policy). Mute it with the HUD
  button or the M key.
- **Effects**: gunshots (filtered noise burst + falling square wave), the
  two-tone police siren, the engine hum (sawtooth through a low-pass
  filter, pitch following speed), and a slow surf swell on the beach
  (filtered noise, gently rising and falling). In headless / screenshot mode the game
  stays silent and reports zero console errors.

## Screenshots (v6.8)

All four are real renders of the game itself, 1280×720, taken with
`?shot=N&seed=1`:

1. `1-chase.jpg` — **cover**: golden-hour car chase on Sunset Blvd. Three
   wanted stars, minimap with police markers and the pier objective,
   traffic, beach-goers fleeing the chase, the police helicopter overhead
   at the top-right, and the Scarlet Arrow big in frame.
2. `2-onfoot.jpg` — Mateo Vega on foot on the shopfront sidewalk,
   third-person, with pedestrians, traffic and the HUD (health / armor /
   ammo / minimap).
3. `3-mission.jpg` — the pier job: Mateo meets Kira on the pier and the two
   face each other, in-engine dialogue, the police helicopter big overhead,
   the beach alive behind them.
4. `4-combat.jpg` — open-street shootout, five wanted stars, Mateo firing
   from beside the Scarlet Arrow with the muzzle flash bright, police cars
   and officers ahead, the helicopter overhead, minimap showing the police.

## Build

`main.ts` hands the entry in: it copies `game/` and `screenshots/` to
`/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `/output/dossier.json`
with the vendored make.fun library. Check it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `game/index.html` — page + HUD (objective, wanted stars, health/armor,
  minimap, ammo, speed, radio, dialogue)
- `game/core.js` — seeded random, canvas textures, GLB loader, HUD, minimap
- `game/world.js` — city, beach, pier, sky, clouds, shopfronts
- `game/sim.js` — cars, crowds, beach activities, police, helicopter, Mateo
- `game/audio.js` — Nightwave 98.3 radio + synthesised sound effects
- `game/main.js` — boot, shot staging, game loop, input, save/load
- `game/vendor/three.min.js` — vendored Three.js (minified loader)
- `game/vendor/mateo.glb` — the Mateo character model
