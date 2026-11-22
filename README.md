# PIER HEAT — Sunset Bay v8.0

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/aramexbit/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/aramexbit/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the spirit of GTA 6, built from zero for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01). All original: its own
city, characters, vehicles, names, story, art, sounds and music — nothing from
Rockstar Games.

## The game

Mateo Vega, getaway driver, one golden-hour job in Sunset Bay: meet Kira on
the pier, win the street race down Sunset Boulevard against RICO, SABLE and
VOLT, then vanish across the bay by speedboat with the Sunset Bay PD on your
tail.

- A connected coastal city to explore on foot and by car: Sunset Boulevard,
  cross streets, beachfront, pier, harbor, and the Sunset Bay Bridge causeway.
- Traffic that follows the roads and pedestrians that stroll the sidewalks.
- Cars to steal and drive — the hero car is the orange fastback **Scarlet
  Arrow**, plate SUN-8821.
- A five-star wanted system with police cars that really pursue, intercept and
  ram, plus a police helicopter from two stars.
- Three mission stages, combat with six weapons, a HUD with a round minimap,
  dispatch panel, crew cards and dialog with portraits.
- Procedural everything: Nightwave 98.3 radio, engine hum, sirens, gunshots —
  all synthesised, no copied assets.
- Save / load (P / L), pause menu, and a title screen.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network request, every
file it loads lives under `game/`.

**Controls:** W A S D drive / walk · mouse look & aim · Click / F shoot ·
R reload · E enter / exit car & boat, talk · 1–6 weapons · Shift sprint ·
Space brake · P save · L load · Esc pause · M radio on/off.

## Version

8.0 — fresh from-zero build, 22 Nov 2026. License: MIT.

## Testing

Acceptance-probed headlessly in Chromium (Playwright build, software
rendering): straight-line drive holds heading to 0°, turns agree left/right at
low and high speed, buildings and the pier mouth stop the car, exit/re-enter
leaves the car exactly where it was, Kira's interact starts the race, all five
gates complete the race (+$1,500), the boat boards, drives and completes
(+$3,000), a shot raises wanted, police close distance in pursuit, a pistol
hit deals 34 damage with hit feedback, and save/load restores the exact
position with health 0 staying 0. 10-minute soak: zero console errors.
