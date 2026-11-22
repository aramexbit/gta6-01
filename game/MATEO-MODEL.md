# MATEO-MODEL.md — PIER HEAT v8.0

Mateo Vega, 28, getaway driver of Sunset Bay. Built entirely from procedural
low-poly parts in `game/mateo.js` — no scanned or borrowed model, no photorealism.

## Face

Structured low-poly face: a rounded head with a canvas-painted face texture
(eyes with pupils, brows, nose shading, two-tone lips, jaw shade), separate
ear meshes, a swept tidy hair cap with a fringe, and a thin beard with a
moustache. Warm tan skin, dark brown-blond swept hair.

## Outfit

- Burnt-orange bomber jacket, open over a white tee: zipper strip, flap
  pockets, darker back panel.
- Thin gold chain at the collar.
- Dark jeans with front pockets, pale shoes.

## Animation

Walk / run / idle: limbs swing on a sine cycle, body bobs slightly, idle
breathes. The crowd uses the same factory in a lighter form (see `game/sim.js`).

## Crew variants

The same builder makes the crew with distinct faces, hair and clothes:

- **Kira** — radio handler. Teal jacket, dark tee, long dark hair, headset
  with a boom mic.
- **Dario** — driver. Tall, dark grey jacket, flat cap.
- **Lena** — lookout. Red jacket, long auburn hair, cream tee.

Portraits in `game/portraits.js` are canvas-drawn face + shoulders for dialog
and crew cards, matching the same palettes. v8.0 is a fresh from-zero build:
every part above was written new for this version, in a single recorded session.
