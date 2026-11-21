# Wanted system — Bay City PD (v7.4)

## Stars 1–5
The wanted level is shown as five stars in the top-right HUD panel, next to
the cash balance and the `BAY CITY PD` label. Lit stars are gold; unlit
stars are dim. At 3 stars or more the wanted panel gets a red glow. The
cash balance is big and green in v7.4 ($24,750 in shot 1, $48,250 in
shot 2, $36,900 in shot 3, $84,300 in shot 4) — the old four-figure
amounts read as pocket change next to a getaway driver's job.

## How it rises
- In free play, the wanted level rises while a police cruiser is within
  18 units of the hero car (about +0.2 stars per second, up to 5).
- The staged shots set fixed levels: shot 1 (chase) is 3 stars, shot 4
  (combat) is 5 stars, shots 2 and 3 (on foot / mission) are 0 stars.
- Street racing adds heat: every checkpoint the player clears while a
  cruiser is in sight adds a little wanted, so winning the race and
  losing the heat are the same job in shot 1.

## How it falls
- In free play, the wanted level falls (about −0.08 stars per second) while
  no police cruiser is within 18 units. Lose the heat by breaking line of
  sight and distance — reach the pier marker to complete the stage.
- On the water the same rule applies to police boats: outrun them past
  the pier and the stars fall twice as fast while no boat is within
  25 units.

## Police response
- **Patrol:** 3 Bay City PD cruisers (white body, black doors,
  `BAY CITY PD` door stickers, red/blue roof light bar flashing
  alternately, plates PD-104, PD-111, PD-118) and 3 officers on foot
  (dark-blue uniform + cap, aiming pose).
- **Chase:** cruisers close on the Scarlet Arrow; the dispatch board (right
  side, under the wanted panel) lists live units with a red tactic chip
  (`PURSUIT` / `RAMMING` / `SPOTLIGHT` / `ROADBLOCK` / `K9`), the unit
  name, its role and its distance in metres. v7.3 lists 6 units in shots
  1 and 4.
- **Boat chase:** 2 police boats (white hull, blue stripe, flashing roof
  bar) hunt the player's speedboat on the water. They steer at a point
  6 units ahead of the player, never at the exact position, so they
  trail behind in a visible pursuit line with foam wakes. In shot 3
  (v7.4) Mateo is at the helm himself, so the boats chase the player
  directly instead of chasing a boat the player is only looking at.
  Kira rides the stern bench (v7.4 rev 2), watching the boats behind.
- **Helicopter:** the police heli orbits the hero in free play (radius
  ~26, height ~34, gentle bob) with a long translucent searchlight cone
  that reaches the ground. In the staged shots it is frozen at the staged
  position — in shot 3 it hangs over the water above the boats. Its rotor spins at all times.
- **Crowd panic:** while wanted is active, city pedestrians within 26 units
  of the threat run away from it at 4.4 units/s; beach NPCs on land within
  45 units run west toward the sea/pier at 4.6 units/s. Swimmers and surfers
  stay in the water. Once the threat passes, NPCs walk back to their home
  spots.

## Siren
The siren (800 Hz sine wobbled ±160 Hz by a 0.9 Hz square LFO) starts when
the wanted level reaches 2 stars in free play, and stops when it drops
below 2. While the siren is on, the radio bus is ducked to 45% so the
siren stays readable over Nightwave 98.3; it returns to full volume when
the siren stops.

## Staged levels (fixed per shot)
Shot 1 (chase) is 3 stars, shot 4 (combat) is 5 stars, shots 2 and 3
(on foot / mission) are 0 stars. The dispatch board distances in shots 1
and 4 are the staged values for those scenes, not live measurements.
Shot 1 also carries the street race (P2/3): both rivals run beside the
hero, so the heat and the race share the same frame.
