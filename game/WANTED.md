# WANTED.md — PIER HEAT v8.0

The wanted system of Sunset Bay: five stars, earned by crime, lost by escape.

## Earning stars

Wanted points run 0–125; stars are `floor(points / 25)`, capped at 5.

- Firing a shot in public: **+8 points** (a public shot raises wanted a little).
- Firing near police (within 25 m): **+12 more**.
- Hitting a civilian: **+15**.
- Shooting at a police car: **+30**.
- Attacking police is the fastest way to five stars.

## Decay

Points decay at 2.5 per second, but only once 6 seconds have passed since the
last crime **and** no police unit is within 45 m. You have to actually escape.

## Police response

| Stars | Response |
|------:|----------|
| 0 | No pursuit. Police cars patrol the road loops. |
| 1 | One unit pursues. |
| 2 | Two units pursue, and the police helicopter joins (AIR-1, spotlight). |
| 3 | Three units, intercept driving: they lead your line and ram. |
| 4–5 | Four units, full intercept. |

Police cars steer toward the player, accelerate to catch up, lead a fast
moving target, and ram when they get close. A ram on foot hurts Mateo
(armor absorbs first); a ram in a car damages the car and bleeds its speed.

## Dispatch panel

While wanted, the HUD dispatch panel lists every real active unit with its
callsign (HARBOR-7, PALM-12, DUNE-21, BRIDGE-3, SURF-9, PIER-5, AIR-1 HELI,
MARINE-4), its state (PATROL / PURSUIT / INTERCEPT / OVERWATCH / MARINE
PURSUIT) and its live distance from the player in metres.

## Downed

If Mateo's health reaches 0 he is down. Respawning costs $50, clears the
wanted level, and puts him back on his feet at the start of Sunset Boulevard.

## Boat escape

During the boat stage, the marine unit (MARINE-4) joins the pursuit on the
water, and the helicopter keeps overwatch from two stars. Wanted points still
decay the same way — outrun the boats, reach the far pier, and the job is done.
