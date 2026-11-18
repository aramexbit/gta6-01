# Mateo model — realistic MPFB2 civilian (v3.3)

Mateo is a MakeHuman human (`game/vendor/mateo.glb`, 3,399,932 bytes),
built 18 Nov 2026 with MPFB2 v2.0.18
(https://github.com/makehumancommunity/mpfb2, GPL-3.0 code — the
addon itself is NOT shipped, only its CC0 output) from the MakeHuman
system assets pack (CC0 1.0 Universal). Build script:
`~/workspace/makefun/v33-work/mateo-build.py` (Blender 4.2.0
headless), patch scripts `mateo-patch.py` (v3.1), `mateo-patch2.py`
(v3.2), `mateo-patch3.py` (v3.3), `mateo-patch4.py` (v3.4, aim solved
numerically), `mateo-patch5.py` (v3.5, final shells).

## Build recipe

- Macros: male, muscle 0.6, weight 0.4, height 0.7 (~1.80 m), age
  0.35, caucasian 1.0. Skin `young_caucasian_male` (GAMEENGINE).
  Rig `"mixamo"` — the bones are exactly `mixamorig:*` (52 bones).
  v3.3 assumed the Xbot idle/walk/run clips transfer verbatim by bone
  name — WRONG (see v3.3.1 below): the rigs share names but NOT rest
  orientations, and pasting the clips verbatim deformed the mesh.
- Assets: eyes `low-poly`, eyebrows `eyebrow001`, eyelashes
  `eyelashes01`, hair `short01`, shoes `shoes04` (whitened to white
  sneakers in-script). MPFB ships no facial hair and no bomber
  jacket/jeans — those are built in Blender.
- Clothing shells: the body mesh is duplicated, a region is kept
  with bmesh, and the shell is displaced along its normals —
  jacket +0.016 (burnt-orange `#B93E0C`, full sleeves to the wrist,
  narrow white-tee V at the chest, hem overlapping the jeans top),
  jeans +0.014 (dark `#23233A`, legs + hips up to z 1.06,
  fingertips excluded so no denim blobs on the hands),
  tee +0.010 (white `#F4ECDF`, backs the whole V cut). The shells
  are separate skinned meshes with their own materials, so the
  jacket reads from the BACK as real material/geometry — the v3.2
  defect (vertex-paint jacket, naked from behind) is gone. The
  jacket is Laplacian-smoothed 3x after the displace (the first
  0.028 offset folded the shell over the nipples into dark craters);
  the body's nipple zone is flattened 10 mm under the jacket. The
  thin beard is a small procedural mesh parented to the
  `mixamorig:Head` bone.
- Animations: idle/walk/run copied from the Mixamo Xbot clips, with
  the Hips root-motion location tracks stripped (the game moves the
  wrapper, the clips are in-place). Aim/fire were authored as
  quaternion keyframes (two-handed pistol stance, curled fingers,
  recoil pulses) and crossfade 0.3 s in `game/world.js`
  (`mateoAim` / `mateoFire` / `mateoPlayClip`). The aim angles were
  solved NUMERICALLY in patch v3.4: a diagnostic proved the arm's
  forward swing is Euler X+ (forward-inward) with Z-/Z+ lifting it
  (Y is only the twist axis), then a grid search placed both hands
  ~12 cm apart in front of the chest (R arm (0.9,0,-0.9), L arm
  (1.3,0,0.9)) — verified front + side in Cycles renders.
- Export: glTF, selection-only, `export_animation_mode='ACTIONS'`,
  `export_yup=True`; opaque PNG textures re-encoded to JPEG q82
  and RGBA textures downscaled to max 512 px (`glb_jpeg.py`) —
  10.04 MB → 3.40 MB. Animations in the file:
  idle, walk, run, aim, fire.

## Why MPFB2, not Xbot (v3.3 change)

v3.2 used the Mixamo `Xbot.glb` mannequin with a vertex-paint
jacket: slim, smooth, naked from behind, and the jacket was paint,
not clothing. The user (18 Nov 2026) corrected this: "Mateo bukan
cuman berisi tapi realistis" — realistic, not just bulky. MPFB2
gives a real human: textured skin, realistic proportions (broad
shoulders, defined chest/back, natural legs — muscle 0.6, not
cartoon-bulky), real clothing geometry, and a Mixamo-compatible
rig. `Xbot.glb` is no longer shipped in `game/vendor/`.

## Verification (Blender Cycles renders, `v33-work/renders/`)

- `mateo-front.png` — burnt-orange bomber, full sleeves, narrow
  white tee V, dark jeans, white sneakers, clean skin hands.
- `mateo-back.png` — the jacket covers the whole back as geometry.
- `mateo-side.png` / `mateo-walk.png` — realistic profile, mid-stride.
- `mateo-aim.png` / `mateo-aim-side.png` — two-handed aim, curled
  fingers, pistol stance.

In-game proof is the street screenshot (`2-street.jpg`, camera
behind Mateo — jacket from the back) and the mission screenshot
(`3-mission.jpg`, aim pose with the pistol in hand).

No Rockstar assets are used anywhere. The background pedestrians and
foot cops stay slim procedural humans (`makePerson` in `game/world.js`)
— only Mateo is the GLB.

## v3.3.1 — the retarget fix (18 Nov 2026)

ROOT CAUSE of the v3.3 defect (proven by FK analysis, Xbot vs Mateo
rest poses): the v3.3 build pasted Xbot actions onto the MPFB armature
by bone name. The rigs share bone names but NOT rest orientations —
Xbot rest local rotations are identity; MPFB's are e.g. LeftShoulder
124°, LeftArm 35.4°, LeftForeArm 45.5°, LeftUpLeg 173.9° off. Pasting
clip quaternions verbatim produced FK delta errors of 12–179° (worst
179.48° in run) — hands clasped behind the back, legs splayed sideways,
jeans crotch web stretched into a skirt, neck/back sheared into a long
blonde "second person". The GLB skinning itself is sound (inverse-bind
errors ~0, weights sum to 1.0) and the mesh has NO second character.

FIX: world-space delta retarget (`/tmp/v331/retarget.py`) of idle/walk/
run only — for each bone, D_xbot(t) = W_xbot(t)·W_xbot_rest⁻¹, target
W_mpfb(t) = D_xbot(t)·W_mpfb_rest, local quaternions solved top-down.
Xbot clips sampled at Mateo's keyframe times via slerp. Translations
untouched (in-place clips). Aim/fire untouched (authored on the MPFB
rig itself, already correct). Verified (`/tmp/v331/verify.py`): worst
FK delta error 1.51° across idle/walk/run (was 179.48°). The motion is
the SAME Xbot locomotion as v3.2 (walk 4.2 / run 8 / sprint 11.5 m/s,
0.3 s crossfade) — only the model/skin is new, per the user's
correction "di versi sebelumnya karakternya jalannya sudah benar
hanya skinnya yang jelek".

Also v3.3.1: the jacket/jeans/tee shells' `envMapIntensity` is 0 in
`world.js` (the HDRI sun disc reflected as white vertical streaks;
0.15 did not remove them), and the shoes material's map is dropped at
load so the off-white baseColorFactor renders as white sneakers (the
shoes04 texture is nearly black — the v3.3 "white sneakers" claim was
false for the texture). No new third-party assets: same Mixamo clips
(retargeted), same MPFB assets, same CC0 textures; the cloud texture
is procedural canvas (see `world.js`).

## v3.3.1 — GLB surgery, causes #2 and #3 (18 Nov 2026)

After the retarget, the arms were fixed (verified in-game: hands at the
sides, swinging) but two defects remained, both proven to be MESH DATA,
not animation, lighting, or textures:

- **Cause #2 — jacket centre-front craters, body + tee poke through
  (the white vertical streaks on the red jacket).** Front-sector
  max-radius analysis (body vs jacket vs tee): at y 1.2–1.3 the body
  sticks out 15–17 mm past the jacket; at y 1.4–1.5 the tee also pokes
  through. The jacket shell is dented inward at centre front (the
  v3.3 build flattened the body's nipple zone 10 mm under the jacket
  and Laplacian-smoothed the jacket 3x after displacing it — the
  first 0.028 offset folded the shell over the nipples into dark
  craters). The pale strips are the BODY's skin (and tee) showing
  through the craters. NOT the tee, NOT the sun, NOT the HDRI/env
  (envMapIntensity 0 did not remove them), NOT vertex colours (none),
  NOT normals (jacket chest normals smooth and correct).
- **Cause #3 — jeans crotch web (the black skirt).** The jeans mesh
  has a web of triangles joining the legs at y 0.72–1.00,
  |x| < 0.045, |z| < 0.06 (397 triangles; the BODY's legs are properly
  separate — 0 core verts at y 0.10–0.74). Below y 0.70 the jeans legs
  ARE separate tubes. The web is what read as a skirt/dress.

FIX (`/tmp/v331/surgery1.py`, in-place, same file size 3,399,932 B,
animations intact, retarget still verifies 1.51°):
1. Jeans web: the 397 web triangles degenerated (all 3 indices set to
   the first index — zero-area, invisible). 0 live web triangles left.
2. Jacket: centre-front verts (angle ±40° from +Z, y 1.05–1.55)
   pushed 32 mm RADIAL (outward from the body axis, feathered at the
   sector edges) — radial, not along the stored normal, because the
   crater's stored normals point inward and a normal-push only gained
   9 mm. Jacket normals recomputed from the new geometry.
3. Body nipple tips flattened: the two nipple tips stick out to
   r = 0.183–0.189 while the chest is r = 0.139–0.149 (24 verts,
   y 1.15–1.30, flattened to r = 0.150). They are under the tee +
   jacket, so this is invisible in-game. Body normals recomputed.
   Post-fix clearance (body/tee vs jacket, front sector): +0.022 to
   +0.047 at y 1.05–1.35; the y 1.40 "touch" is the jacket's V-neck
   opening where the white tee legitimately shows.
4. Jeans colour: the GLB's `MateoJeans.001` baseColorFactor was
   [0.017, 0.017, 0.042] — essentially black (#04040B), far darker
   than the documented #23233A. Near-black jeans against the dark
   street gave no contrast, so the two (geometrically separate) legs
   read as one black mass. Set to the documented #23233A
   [0.137, 0.137, 0.227]. The legs now read as two dark-navy jeans
   legs in every probe (front / back / walk / run).

KNOWN REMAINING DEFECT — face strips: thin pale vertical lines on
the face/neck (the "long blonde hair" read). Proven NOT texture, NOT
UVs, NOT vertex colours, NOT pose, NOT sun/env/shadows, NOT specular
(diffuse-only render still shows them), NOT the stored normals
(clearing the custom split normals and rendering with pure
geometry-derived smooth normals shows them identically), NOT
positions at 1 cm scale (radius/depth/Laplacian all smooth), NOT
NaNs or degenerate triangles. The top view of the head shows them
for what they are: the mesh's vertical edge loops (gores) — the
MakeHuman body is built from vertical strips, and the shading is
faceted along the gore boundaries. Laplacian smoothing reduces them:
a strong smooth on the neck/face (y 1.45–1.82, λ = 0.7, 3 iters)
reduces the face/neck strips dramatically in Blender (the face reads
clean), at the cost of up to 43 mm of vertex movement at the sharpest
features (ears/nose tip) — the face shape is preserved at render
resolution. Applied in surgery3 (`/tmp/v331/surgery3.py`); faint
traces remain on the neck at close range. The same gore lines are
what read as "white streaks" on the jacket's BACK in the aim pose:
the body's exposed neck/trapezius (striped) shows above the collar
and overlaps the upper back from behind — the jacket's own back is
clean (verified jacket-only) and its rest/aim clearance is +0.05,
so it is NOT poke-through. The jacket back was also pushed out
32 mm radial (surgery2, `/tmp/v331/surgery2.py`, 550 verts) for
margin in the aim pose. Reported honestly — see the v3.3.1 handoff.

## v3.3.2 — the skirt, fixed for real (18 Nov 2026)

The v3.3.1 fixes were WRONG in both directions (proven by an
independent measurement round, round 3, plus this session's own
per-component plane-section analysis of mateo.glb):

- **Cause #1 — GAMMA (the skirt's main cause).** v3.3's jeans factor
  [0.017, 0.017, 0.042] linear was the CORRECT linear value for sRGB
  #23233A dark navy. v3.3.1 "fixed" it by writing the sRGB numbers
  [0.137, 0.137, 0.227] raw into the linear field, so the jeans
  rendered as light grey-blue #686883 — a waist-to-ankle light mass
  that reads as a skirt. v3.3.1 made it BRIGHTER, not darker. Fix:
  factor restored to linear [0.0168, 0.0168, 0.0423]. Rule: never
  write sRGB numbers raw into a linear field; in Three.js use
  `new THREE.Color('#23233A')` (auto-converts).
- **Cause #2 — ENVELOPE TUBE (the skirt's geometry).** The jeans mesh
  is THREE coincident walls. Per-component section tests at y=0.5:
  comp0 (1337 verts) and comp1 (922 verts) are TWO SEPARATE LEG
  TUBES (gap 0.176 m at y=0.5, 0.284 m at y=0.2); comp2 (694 verts)
  is ONE enclosing tube spanning both legs (single section loop
  x -0.243..+0.243). The body mesh has the same structure (legs in
  the two big comps + a 740-vert envelope tube). The v3.3.1 "397 web
  triangles" were only the crotch tip of that tube — degenerating
  them changed nothing, which is why the render never changed. Fix
  (`/tmp/v332/surgery332.py`, real index rebuild, not degeneration):
  the envelope's triangles below y=0.85 are DELETED (its hip band
  y>=0.85 is kept: real jeans are one piece at the hips), plus the
  midline web triangles below 0.85 and all degenerate triangles.
  Jeans 6194 -> 4748 tris, body 36972 -> 35976 tris; jeans triangles
  crossing x=0 below y=0.85: 0 (was 14+12+13 per band + the tube).
  A stray 5.4 cm cube at the model origin (12 tris, a modeling
  artifact rendering as a skin lump between the boots) is deleted too
  (`/tmp/v332/surgery332b.py`). File 3,399,932 -> 4,320,932 B
  (orphaned old index buffers stay in the file; game/ budget is 48 MiB).
- **Cause #3 — jacket red, not orange.** Factor [0.484, 0.048,
  0.0037] linear = sRGB #B93E0C, but under the magenta sunset + ACES
  it renders red. First shift (sRGB #CC5A12) still rendered hue
  ~11 deg (red-orange) in the browser probe. Fix: factor shifted to
  amber sRGB #E8960F -> linear [0.807, 0.305, 0.005] (the sunset +
  ACES shift hue down ~15-20 deg, so the base must be amber for the
  render to read burnt orange ~25-30 deg); the collar matches
  (`new THREE.Color('#E8960F')`). Verified in-game, not in Blender.
- **Cause #4 — pale bars on the back.** NOT hair (short01 texture
  is near-black, RGB 18) and NOT holes in the jacket (0 uncovered
  cells on a 1 cm rasterization). It is the BODY's skin poking
  THROUGH the jacket's back: a fine rasterization (interpolated
  triangle surfaces, 1 cm grid) found 67 cells where the body's back
  surface is further back than the jacket's at the same (x, y) —
  trapezius y 1.505-1.565, x +/-0.055 (up to 3.5 cm through) and
  lumbar y 1.205-1.265, x +/-0.075-0.125 (up to 1.5 cm). Proven by
  the hide test in the browser: the bars VANISH when the body mesh
  is hidden (`bars-nobody.jpg`). The jacket's and body's skin weights
  at the scapulae are nearly identical (Spine2-dominant), so the
  poke-through is static (present in idle too), not a walk-swing
  artifact. Fix (`/tmp/v332/surgery332d.py` + `surgery332e.py`, index
  rebuild): delete the body triangles whose surface is behind the
  jacket's back (pass 1: 482 tris by a vertex rule; pass 2: 8 more by
  a per-cell surface rule). Body 36972 -> 35486 tris; poke-through
  cells after: **0**. The deleted triangles are only visible from the
  back, where the jacket covers them. (Pass 1's first write omitted
  the 'JSON' chunk tag — repaired by `/tmp/v332/repair332d.py`; pass
  2 writes the chunk at its real length. Both passes wrote the new
  index bufferView with byteLength = tris*4 instead of indices*4 —
  the GLB then failed in Three.js (`Invalid typed array length:
  106458`); fixed by `/tmp/v332/fix332f.py`, which audits every
  accessor and sets each bufferView's byteLength to the max its
  accessors need. Lesson: a GLB index bufferView's byteLength is
  count*componentSize, not triangleCount*4.)
- **Cause #5 — the neck strip.** The neck/trapezius skin shows above
  the collar (the jacket ends at y 1.58) + faceted MakeHuman gore
  shading. Fix (runtime, `world.js`): a flared burnt-orange collar
  (CylinderGeometry 0.075/0.12/0.13) on the Neck bone covers the
  neck base and upper trapezius.
- **Cause #6 — shoes read as bare feet.** The shoes04 texture averages
  RGB (33,33,34), near-black; dropping the map makes the off-white
  base render, but under the warm sun it renders cream/skin-tone and
  reads as bare feet (front/back/side probes). Fix: shoe upper forced
  pure white (GLB factor [1,1,1,1] + `world.js` sets
  `material.color` white where the map is dropped) and dark sole
  slabs (0.14 x 0.05 x 0.30, #1A1A1E) parented to the Foot bones,
  thick enough to read as a dark band from the front, back and side.
  Sole local transform computed at runtime from the bones' own
  matrices (foot bind pos +/-0.197, 0.074, 0.010; footprint centre
  z 0.078).
- **SPLAY deliberately NOT applied.** Measured leg gap at y=0.5 is
  0.176 m (not <0.05 m), and the Blender bone test shows no clean
  single-axis splay for this rig (local Z+6deg also swings the foot
  5 cm backward; Z-6deg crosses the legs 15 cm inward). Separation is
  verified in the browser probe instead; splay is added only if the
  probe shows the legs merging.
- Verification is browser-only (Playwright probes 1.5-2 m, front /
  back / side, idle + mid-stride walk): `gta6-01-probe-v332.mjs`.

## v3.3.3 — the hands (18 Nov 2026, hands only, no rebuild)

Round-4 diagnosis (independent, measured in the browser, verified by
the parent from `mateo-front-1-zoom2.jpg`): both hands held at waist
height, PALMS UP like trays, fingers straight and fanned like a
fan, thumbs sticking out sideways; forearms bare skin from the elbow
to the wrist. Three measured causes, three fixes — all in `world.js`
(`mateoUpdate` + `mateoFixHands` + the `makeMateo` GLB callback),
locomotion only (idle/walk/run); aim/fire keep the authored grip.

- **Cause (a) — the wrist is never rotated.** The MPFB hand's bind
  pose has the palm facing sideways (+X in hand space), 90 deg off
  the Mixamo/Xbot convention, and the retargeted clips barely rotate
  the wrist (idle: Hand 9-14 deg, ForeArm 8-13 deg), so the bind
  orientation survives into the pose. The "FK error 1.51 deg" claim
  does not cover palm direction. Fix, probe-verified in two steps:
  (1) pronate each ForeArm bone by a FIXED local-Y rotation,
  mirrored Left +90 / Right -90 deg, post-multiplied after every
  mixer update — probe `mateo-hands-B-foreY90.jpg`: fingers point
  down, palms face the thighs (stable palm metric: 11-19 deg from
  medial, vs 88 deg baseline). (2) That alone leaves the fingers
  pointing down-FORWARD (only 64-75% down) because the wrist itself
  is bent ~40 deg in the clip, so a second rotation of the HAND
  bone about its own long axis (local Y, mirrored Left +45 /
  Right -45 deg) swings the curled fingers to point straight down
  (93-97% down) while the palm stays 29-37 deg from the thigh —
  probe `mateo-hands-F-handY45.jpg`. +90 deg puts the palm 69-78
  deg off (backwards); -45 deg leaves the fingers pointing
  up-forward. The palm metric that decided this is STABLE: the
  palm normal in Hand space is computed ONCE at bind from the
  middle-finger and thumb directions and transformed by the hand
  bone's world quaternion at runtime. The earlier thumb-flip
  cross-product metric (palm = cross(finger, thumb) from live joint
  positions) is UNRELIABLE once the thumb is adducted — the thumb
  points along the fingers, the cross product goes degenerate, and
  the "medial" angle swings 20-30 deg for the same pose. Do not use
  it again.
- **Cause (b) — the fan.** The bind pose holds the fingers SPREAD
  (index-to-pinky ~29 deg in Hand space, tip spread 9.6 cm); the
  clip's uniform curl does not close it, so damping the curl alone
  leaves a claw. Fix: (1) damp each finger joint's rotation halfway
  back toward its bind pose (bind = straight fingers; the idle clip
  holds a constant ~42-47 deg uniform curl on every joint) — bind
  quaternions captured at load, before the mixer ever runs;
  (2) adduction: each finger's direction in Hand space at bind is
  measured, and a fixed rotation pulls it toward the middle finger
  (index/ring/pinky 100% — parallel fingers; the knuckle spacing
  keeps them from intersecting — thumb 80% toward the index),
  premultiplied onto the first joint after the damping (damping
  would halve it otherwise). Tip spread 9.6 -> 7.9 cm at 70-80%,
  and the fingers hang parallel at 100%. Verified by
  `gta6-01-probe-v333-verify.mjs`.
- **Cause (c) — bare forearms.** 43-44% of forearm vertices are
  >3 cm from any jacket vertex; the jacket shell ends at the elbow.
  Fix: orange (#E8960F) sleeve cylinders on the ForeArm bones
  (local +Y = elbow->wrist, proven: the forearm's local Y equals
  the elbow->wrist direction), 0.042/0.058 x 0.32, centred at
  y=0.13 (spans -0.03..0.29; the forearm bone is 0.258 m, so the
  sleeve reaches the wrist). Same pattern as the v3.3.2 collar.
- **Pistol during locomotion.** The pistol is parented to the wrist,
  so while walking it reads as a floating grey plank at the wrist,
  not a gripped weapon. Fix: `grip.visible = false` by default in
  `loadPistol`, and `mateoUpdate` shows it only for aim/fire —
  which is when it must read. The aim pose and grip are untouched.
- Verification is browser-only: `gta6-01-probe-v333-handsclose.mjs`
  (camera 1 m, front + side + back, idle + mid-stride walk + aim).
  Pass: palms face the thighs, fingers together pointing straight
  down with a light curl, no flat tray, orange sleeves to the
  wrist, pistol reads when aiming. Remaining nits (NOT in scope):
  the finger joints read as pale knuckle caps at 1 m, and the aim
  hands are blocky white around the pistol — both are the MPFB
  mesh/material, not the pose.
