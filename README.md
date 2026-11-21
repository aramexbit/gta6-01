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
The 3D world, the people, the cars, the boats and the music are all built
in code — v7.3 removed the last model file entirely, so there are no
binary assets at all.

## v7.5 — what changed

- **Real sunset sky** (`game/sky.js`, new): layered cumulus — lit-orange base, gold sun side, dark crown, gold rim — over a blue-to-orange gradient, with a low sun disc + starburst + glare, warm haze bands and slanted sunbeams. The old flat cloud blobs are skipped when it loads.
- **Hero rear, rebuilt** (`game/herocar.js`, new): curved fastback stern, round LED-ring tail lamps, black mesh deck vent, integrated spoiler lip, glossy clearcoat paint, black 7-spoke wheels, side intakes. The old flat rear panel, fog lamps and 5-spoke wheels are skipped when it loads.
- **Police heli, rebuilt** (`game/heli.js`, new): rounded cabin, curved cockpit glass, thin tapered tail boom + tall fin, main rotor as a tilted blur disc that leans into motion, vertical tail-rotor blur disc, tube skids, sensor turret, POLICE on a blue cheatline. The old mesh heli is skipped when it loads.
- **Planing hull + V-wake** (`game/waterfx.js`, new): the boat rides high with its bow up, a thick white V-wake whose arms narrow with speed, hull foam and bow spray, two-tone sea (deep blue far, turquoise near). The old ribbon wakes are skipped when it loads.
- **Reflective glass** (`game/facades.js`, new): every pane gets its own sky/cloud reflection + mullion grid, warm toward the sun and cool away, with a dark building base.
- **Wet road** (`game/wetroad.js`, new): glossy asphalt; lamp, neon and taillight reflections stretch toward the camera as vertical ribbons, always darker than their source and stronger the lower the camera sits.
- **Four v7.4 defects fixed:** Mateo's shot-2 heading is now derived from the camera (he can never face away again); the red pickup moved to (-26,-5) so it no longer stacks on the hero's stern in shot 1; the shot-3 heli drops to y 5.2 so its rotor clears the top frame edge; the zebra crossings are real stripes now — long across the road, narrow along travel — instead of wide white blocks.

## v7.4 — what changed

- **Volumetric sunset clouds** (`game/world.js`, `game/core.js`): each
  cloud is a layered cluster — flat base, warm sun-side mid body, small
  round cauliflower crown sheared downwind, ragged wisps at the edges —
  with a soft ground shadow that drifts with the cloud, so streets and
  roofs slide in and out of shade. A denser cloud field rings the sun
  on the sky dome, and a big radial glare sprite sits exactly at the sun.
- **Real facades** (`game/world.js`): every window pane rolls its own
  look — sky-reflecting glass (warm toward the sun, cool away), dark,
  lit, or a tiny shop interior (shelves per shop kind). Upper floors sit
  in bays with frames, sills, lintels, curtains and rain streaks; ground
  floors roll a stoop, a glass lobby or a loading dock; crowns get a
  cornice, a parapet and an antenna with a blinking red beacon; flanks
  carry a faded painted sign, a drain pipe and an awning. Brick-course
  textures fade with distance, and a dark gradient hugs every wall base.
- **Real cars** (`game/sim.js`): the hero's rear now reads from behind —
  sky-reflecting rear glass, trunk seam, wiper, antenna, fog lamps —
  wheels carry five spokes, and every car sits on a soft contact shadow.
  Traffic rolls four silhouettes from one kit: sedan, hatch, van and
  pickup (the race rivals are a blue hatch and a red pickup), some with
  a roof rack.
- **Shot 3 is on the water** (`game/boats.js`, `game/main.js`, `game/mateo.js`):
  Mateo stands at the helm of the speedboat in an orange life vest, both
  hands on the wheel (new `drive` pose), wake behind him, two police
  boats in pursuit and the heli above; Kira waves him off from the pier
  end. A boat chase on the water is a scene the top entries do not show.
- **Shot 1 rivals, big and close** (`game/races.js`): both rivals run
  beside the hero, one in each lane, with the checkpoint gate framing
  them instead of hiding them.
- **Fixes**: cash is now $24,750 / $48,250 / $36,900 / $84,300 (big and
  green); the muzzle flash is a short tongue of flame, a third of its
  old size; zebra crossings are 4 slim strips; the pier deck carries
  crates, coiled rope, tackle, buckets, rods, working fishers and
  circling gulls; market fruit sits in crates, not scattered; the
  dialog box rides above the weapon wheel so all six slots show.
- **Sound** (`game/audio.js`): gull cries over the pier and a harbour
  horn for the boat job join Nightwave 98.3.
- **v7.4 rev 2 — wheels, rivals, Kira:** the hero's wheels sit at the
  real axles and flush with the body (rev 1 had all four clustered at
  the front, sticking out of the flanks); the red pickup rival runs
  further ahead so the hero no longer hides it; Kira rides the stern
  bench instead of standing at the pier end, where the minimap hid her;
  sunset cloud shade is a softer mauve.

- **Procedural Mateo & Kira** (`game/mateo.js`): the GLB file is gone;
  both characters are assembled from code primitives with faces, bomber
  jackets and poseable limbs. See `game/MATEO-MODEL.md`.
- **Boat chase** (`game/boats.js`): shot 3 is now a boat mission — a
  player speedboat with a foam wake, two police boats in pursuit and the
  heli over the water.
- **Street race** (`game/races.js`): shot 1 runs a checkpoint race — an
  amber gate arches over the road, a rival car runs alongside, and the
  HUD shows live race position and lap.
- **Canvas portraits** (`game/portraits.js`): crew cards and dialog use
  drawn faces instead of letter tiles.
- **Real street-map minimap**: pre-rendered roads/blocks/sea with
  labels drawn on top, so police dots can never cover them.
- **Sunset light**: low sun with long shadows, horizon-coloured haze,
  sun glare and bigger, lower, sun-lit clouds.

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
- **The pier** — a wooden pier at Z 40 with posts, rails, lamps, benches,
  crates, coiled rope, tackle, buckets, rods, working fishers, circling
  gulls and the red-coned `PIER BAIT` shack.
- **The sky** — gradient sky dome, a glowing sun disc with a big radial
  glare, drifting volumetric 3D clouds (10 at sunset, 16 by day, plus 6
  fixed hero clouds and a denser field around the sun) with soft moving
  shadows on the ground.

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
- **HUD** — objective panel, wanted stars + cash, dispatch board (6 units),
  weapon wheel (6 slots), health/armor bars, crew cards with canvas
  portraits, round street-map minimap with roads, sea, sand, pier,
  race loop, objective diamond, police dots and boats, a rotating player
  arrow, race position + lap, boat speed readout, big speedometer with
  car name and condition, and radio readout.
- **Sound** — fully synthesised WebAudio: Nightwave 98.3 synthwave radio
  (96 BPM, Am–F–C–G), waves, siren, engine, boat outboard, race
  countdown beeps, bow splash and gunshots. Audio starts only
  after a click or button press.
- **Boat chase** — speedboat with buoyancy on summed-sine waves, foam
  wake ribbon, a helm wheel Mateo steers in shot 3, and two police boats
  steering at a point ahead of the player (see `game/boats.js`).
- **Street race** — 14-gate loop on the city road graph, 2 rival cars
  (blue hatch, red pickup) with corner-aware pace, countdown, position
  by gates cleared then distance to the next gate (see `game/races.js`).

## Screenshots

Four staged shots, seeded for determinism (`?shot=N&seed=1`):

1. `1-chase.jpg` — sunset chase + street race, 3 stars, heli overhead,
   both rivals big and close beside the hero.
2. `2-onfoot.jpg` — daylight, Mateo facing the camera.
3. `3-mission.jpg` — daylight, Mateo AT THE HELM of the speedboat on the
   water with Kira riding the stern bench, police boats in pursuit, heli
   above. v7.4 rev 2: Kira joins the boat — the pier-end spot hid her
   behind the minimap.
4. `4-combat.jpg` — sunset shootout, 5 stars, small muzzle flash held.

## Build

```sh
node serve.ts            # play at http://localhost:8080/
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build dossier.json
```

## Known deviations from the brief (v7.2 rev 2, plus v7.3, plus v7.4)

- **v7.4 — shot 3 is played on the water:** Mateo is at the helm of the
  speedboat (not briefed on the pier) because a boat chase on the water
  is a gameplay scene the top entries do not show; the pier talk still
  happens through Kira's dialog and her wave from the pier end.
- **v7.3 — GLB removed:** the character model file that v7.2 shipped
  was removed entirely; Mateo and Kira are procedural (see
  `game/MATEO-MODEL.md`). No binary assets remain in the game.
- **v7.3 — shot 3 is a boat mission:** the pier job now ends at a
  speedboat, with police boats and the heli on the water behind the
  pier talk, so the mission reads on the water as well as on the deck.

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
- `game/core.js` — seeded RNG, canvas textures, HUD setters, round
  street-map minimap painter (pre-rendered base layer).
- `game/world.js` — Sunset Bay: sky, low sun + haze + glare, ground,
  sea, roads, buildings, street props, palms, beach, pier, clouds.
- `game/sim.js` — procedural people + poses, hero/traffic/police cars,
  traffic, crowds, police, helicopter, muzzle flash.
- `game/mateo.js` — procedural Mateo + Kira (primitives, faces, rig).
- `game/boats.js` — boat chase: speedboats, waves, foam wakes, police boats.
- `game/races.js` — street race: checkpoint gates, rivals, countdown, position.
- `game/portraits.js` — canvas face portraits for crew cards and dialog.
- `game/audio.js` — WebAudio synth engine (radio, waves, siren, engine,
  boat outboard, countdown, splash, gunshots).
- `game/main.js` — boot, input, save/load, 4 staged shots, free-play loop.
- `game/MATEO-MODEL.md` — the procedural Mateo/Kira rig.
- `game/WANTED.md` — the wanted system (incl. boat chase + race heat).
- `game/vendor/three.min.js` — Three.js global build (untouched).
- `main.ts` — dossier builder. `serve.ts` — local static server.
- `shots.json` — the 4 screenshot definitions.
