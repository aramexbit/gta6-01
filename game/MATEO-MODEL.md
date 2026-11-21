# Mateo Vega — the character (v7.6, procedural)

## The character
Mateo Vega, 28, getaway driver. Burnt-orange bomber jacket, white tee, dark
jeans. v7.6: a SLIMMER rig (torso capsule radius 0.30, arms 0.15 wide at
+-0.38, legs 0.20 wide at +-0.13) and a STRUCTURED face — white eye spheres
with dark pupils and glints, angled brows, a wedged nose with tip and
nostril shade, two-tone lips, a chin block, a jaw-stubble band, ears and a
neck — so the face reads as a face from the camera side in shots 2 and 4,
not two dots and a moustache line. Kira is the same rig recoloured: teal
bomber, dark tee, long hair, gold hoop earring. On the boat (shot 3, v7.4)
Mateo wears an orange life vest and a cap over the same rig.
v7.5: in shot 2 Mateo's heading is derived from the camera position in
main.js (atan2 of camera minus Mateo), so he faces the lens even if the
camera is ever moved — the rig itself is unchanged.

## The file — there is none
v7.3 REMOVED `game/vendor/mateo.glb` and the whole model loader. Mateo and
Kira are now assembled in `game/mateo.js` from code primitives only: a
capsule bomber shell over a white tee panel (with zipper, waistband,
collar, shoulder patches and a chest pocket), box limbs on shoulder/hip/
knee joint Groups, sphere head with hair cap, and sneakers with white
soles. Nothing is fetched; the game is fully static with zero network
requests. `PH.loadMateo` in `mateo.js` keeps the old call shape
`(scene, tint, onReady)` so `main.js` did not need a new loader API.
v7.6 adds bomber detail: a chrome zipper pull, chest pocket flaps with
buttons, a gold chain (rev 2: tighter, hugging the collar — the wider
ring read as a handle across the chest), ribbed sleeve cuffs, jeans
front pockets and rolled cuffs, and a back-hair volume behind the head.

## Rig and proportions
The rig origin is at the soles; total height is ~1.85 units (Kira is
scaled 0.96). Joints are empty Groups at the shoulders, hips and knees,
so a limb swings from its root when its joint rotates. The torso is a
capsule (puffed bomber), the head a sphere at Y 1.74 (radius 0.21 in
v7.6), legs are boxes with a knee Group halfway down, and the right hand
carries a pistol mesh that is only visible while aiming or firing.
Head-to-height is about 1/7.5 in v7.6, shoulders about two heads wide —
real proportions, not the boxy v7.5 rig.

## Animations (state machine in `mateo.js`)
`idle` (breathing + slow look-around), `walk`, `run` (knees bend on the
trailing leg, torso leans forward), `aim` and `fire` (both arms raised,
pistol visible), `drive` (v7.4: both hands forward on the boat helm,
knees braced against the swell, torso leaning into the wind — used for
Mateo at the helm in shot 3) and `wave` (v7.4 rev 2: one arm raised,
waving at the boats behind — Kira on the stern bench in shot 3).
`setAnim(name)` switches the state; `update(dt)` advances the swing
phase from time, so the walk cycle is the same in every seeded
screenshot. `setBoatGear(true)` shows the life vest and cap; it is off
everywhere else — in shot 3 both Mateo and Kira wear it.

## Facing
The face points along local +Z, so `forwardOffset` is 0: a movement
heading h (0 = south, +Z) is applied as `rotation.y = h`. (v7.2 needed
-PI/2 because the old model's face pointed along +X.)

## Retinting
`PH.retint` (core.js) recolours a procedural character by part tag:
mateo.js marks the jacket shell (`userData.part = 'jacket'`), the tee
panel (`'tee'`) and the hair cap (`'hair'`). Mateo's jacket is burnt
orange `0xff7a1a` — note: `0xFF9900` was tried and still rendered yellow
under this engine's sun, so `0xff7a1a` is the colour that actually reads
orange. Kira is the same rig built with teal jacket `0x0e7a7a`, dark tee
`0x222831`, dark hair `0x2a1a12`, long hair and stubble off.

## Face
v7.6: white eye spheres with dark pupils and glints, angled brows, a
wedged nose with tip and nostril shade, two-tone lips (upper darker,
lower lighter), a chin block, a jaw-stubble band, ears and a neck, all
attached to the head Group on the front (+Z) so the face reads from the
camera side in shots 2 and 3. Kira's long hair adds side locks and a
back panel, plus a gold hoop earring. Portraits of both characters are
drawn separately in `game/portraits.js` for crew cards and dialog — same
feature set (skin, hair style, jacket), same faces everywhere. Portraits
in v7.6 use filled per-character lips, a jaw/chin shadow curve, a nose
bridge with tip, hair highlight strands and jacket details (zipper,
collar, chest pocket, chain/necklace).

## Why the GLB went away
The model file is what got v7.2 rejected. The procedural rig keeps the
same silhouette, the same jacket and the same face, with no binary
asset to review, no loader to maintain and no network fetch at all.
v7.4 keeps the rule and extends the same rig to the boat: the helm
wheel in `boats.js` and the `drive` pose + life vest here are primitives
too, so shot 3's Mateo-on-the-boat staging adds no asset at all.
v7.6: the hero boat in `boats.js` is now white with teal stripes and a
dark-slate interior — white + teal against Mateo's orange, so he pops
off the boat instead of melting into it — and shot 3's beach foreground
in `main.js` gains the dead man on the sand with dark-red blood pools,
stylized low-poly, the crime-scene detail the beach mission opens on.
