# Mateo model — Quaternius Animated Human (v3.4)

Mateo is the Quaternius **"Animated Human"** (`game/vendor/mateo.glb`,
536,764 bytes), built 18 Nov 2026. Source: Poly Pizza
https://poly.pizza/m/c3Ibh9I3udk — **CC0 1.0 / public domain**,
698,560 bytes. Build scripts: `/tmp/v34/build.py` (Blender 4.2.0
headless: material split, soles, clip rename) and
`/tmp/v34/retarget_gltf.py` (pure-Python glTF retarget of the aim/fire
clips + facing fix). Verification renders: `/tmp/v34/verify/`,
`/tmp/v34/facing/`.

## Why the model was replaced (v3.3 retired)

v3.3 used a MakeHuman MPFB2 human. Its MESH was defective, not its
pose: the upper arms were fused to the torso (no shoulders, arms like
seal flippers), the hands were pale cube segments like beads/dice,
the eyes were googly, the face read as a mask. Three rounds of pose
fixes (v3.3.1 world-space retarget, v3.3.2 skirt/gamma fixes, v3.3.3
hand fix — forearm pronation, finger curl damping, adduction,
sleeve cylinders, collar) reached their maximum and could not repair
mesh defects. The user (18 Nov 2026, 23:29 WIB): "Kerjakan yang
original, saya yakin kita bisa top 1" — replace the model, do not
patch the pose again. All MPFB-specific runtime code
(`mateoFixHands`, collar, sole slabs, sleeve cylinders, finger
corrections) was deleted from `game/world.js` in v3.4.

The first choice, the Quaternius **Animated Base Character**
(Poly Pizza https://poly.pizza/m/cwYvO5UauX), was REJECTED on
license: it is technically perfect (DEF-* rig identical to the UAL,
45 clips embedded) but obtained now it falls under the Quaternius
Asset License QAL v1.0 (https://quaternius.com/license.html, updated
8/28/2026), whose §3(a) forbids reselling/redistributing the Assets
themselves as a standalone asset/pack/file. Committing its raw GLB
to this public repo would let anyone download the asset alone — the
prohibited case. The Animated Human is CC0, so it can be committed
freely. The QAL decision is recorded here so nobody "upgrades" to
the Base Character by committing its GLB.

## The source asset

- One skinned mesh `Human_Mesh` (4,733 verts, 1,578 polys), one grey
  material `Texture`, no textures/images. Mixamo-style rig, 41 bones:
  Hips, Spine/Spine1/Spine2, Neck, Head, LeftShoulder/LeftArm/
  LeftForeArm/LeftHand (thumb + index finger bones only), LeftUpLeg/
  LeftLeg/LeftFoot/LeftToeBase (mirrored right). 5.321 units tall.
- Own clips: Idle (10 s), Walk (1 s), Run (0.625 s), Jump, Punch,
  Death, Working. No aim/shoot clips of its own.
- Blender check (before install): shoulders rounded and separate
  from the torso — min arm–torso vertex distance 0.244 model units
  = 8.3 cm at 1.80 m scale; hands are a single-colour tapered
  mitten-like shape (317 verts each), no pale cube segments; eyes
  small, symmetric, not googly; two separate legs; feet BARE with
  modelled toes (need shoe covering — see soles below). Rest pose is
  a T-pose; the GLB's active action on import is a mid-run pose, so
  rest-pose renders need `pose_position='REST'`. The character faces
  +X in glTF space.
- A 42-vert `Icosphere` object appears on Blender import but is NOT
  in the GLB JSON — a Blender import artifact; it is deleted before
  export and three.js never sees it.

## Build recipe (`/tmp/v34/build.py`)

- Import `human.glb`, delete the Icosphere + empties.
- **Material split** by dominant vertex group + face centroid (sRGB
  hexes converted to LINEAR in the script — feeding sRGB numbers
  into Blender's linear colour sockets made every colour too
  bright/washed out; hair #2A2018 rendered mid-brown instead of
  near-black):
  skin #D8A077, hair #2A2018, eyes #1F1710, jacket #E8960F (amber
  base — renders burnt orange under the sunset + ACES grade, the
  v3.3.2 lesson), tee #F4ECDF, jeans #23233A, sneakers #F5F5F5,
  soles #1A1A1E. Face counts: skin 548, hair 265, eyes 120, jacket
  223, tee 2, jeans 154, sneaker 266, sole 0 (soles joined after).
- **Hair rule**: top cap (z ≥ 4.93 and x < 0.05) + back of head
  (x < −0.12 and z ≥ 4.50). The forehead (front, x > 0.05) stays
  skin — a z-only rule pulled the hairline down to the eyebrows.
- **Eyes rule** (the hard one): the eye bulges are small spheres
  centred at (0.29, ±0.135, 5.09) — high on the face, near the
  hairline. A face is an eye face only if ALL its vertices lie
  within 0.05 of a bulge centre. Centroid bands kept failing: a
  z 4.60–4.98 band caught cheek triangles and painted a dark mask
  over the lower face; a z 5.00–5.16 box caught 186 forehead faces.
  Final count: 120 faces = the two densely-tessellated bulge
  spheres. Verified by face close-up: two small dark round eyes,
  clean skin lower face.
- **Tee V**: Spine2-dominant faces, x > 0.10, z 3.95–4.48,
  |y| < 0.22 − (4.48−z)×0.35 — a small white V at the neck (the
  chest front has only 2 faces in that band; it reads as a V-neck).
- **Soles**: dark boxes sized from the foot bounding boxes, joined
  into `Human_Mesh` with 100% foot-bone vertex weights (no
  bone-parent matrix risk). Mesh now 4,749 verts / 1,590 polys.
- **Clips renamed** idle/walk/run; **Hips location stripped** (the
  clips are in-place — the game moves the wrapper). Export GLB,
  ACTIONS mode, +Y up. Materials are written in the right order
  (the mesh's materials are cleared before the Mateo materials are
  appended — otherwise every colour shifts one slot).
- Exported base: `/tmp/v34/mateo-base.glb`, 506,900 bytes,
  animations `Human Armature|Idle|Walk|Run`.

## Aim/fire retarget (`/tmp/v34/retarget_gltf.py`)

Aim/fire come from the **Universal Animation Library** (UAL),
mirror https://github.com/J-Ponzo/gltf-universal-animation-library,
LICENSE CC0 1.0 — single file
`glTF/AnimationLibrary_Godot_Standard.gltf` + `.bin`, 46 animations,
53-joint DEF-* rig. Clips used: `Pistol_Aim_Neutral` (0.167 s, a
static two-handed aim pose) and `Pistol_Shoot` (0.625 s). Also
available but unused: Idle_Loop, Walk_Loop, Sprint_Loop, Jog.

Retarget is pure Python at the glTF level (node space composes
cleanly as parent_world @ local — the Blender world-space delta
retarget diverged at 177–179° FK error and was abandoned). Bone map:
Hips→DEF-hips, Spine→DEF-spine.001, Spine1→.002, Spine2→.003,
Neck→DEF-neck, Head→DEF-head, shoulders/arms/forearms/hands,
thumb1–4→DEF-thumb.01–03 (4th copies 3rd), index1–4→DEF-f_index.01–03,
legs→DEF-thigh/shin/foot/toe. Rotation-only, in-place.

Three modes were computed; **mode A won** (render-verified):
- **W** = world-space delta (D = Qw_src(t)·Qw_src_rest⁻¹;
  Qw_dst = D·Qw_dst_rest). FK err 0.000° by construction, but the
  aim renders BROKEN: one arm up by the head, the other across the
  waist — the 90° facing difference (UAL faces −Z, Human faces +X)
  is applied raw.
- **A** = W conjugated by R_y(−90°) = quat (0, −0.7071, 0, 0.7071).
  Aim renders PERFECT: both arms extended straight forward at
  shoulder height, hands together, shooting stance, one leg forward.
- **L** = local-space delta. FK err 176–180° — wrong (rest-local
  quats differ hugely between rigs, e.g. LeftUpLeg 179.67°).

**Facing fix** (found by 4-side renders): the Human's own clips
(idle/walk/run) face −Y in Blender space while the bind pose and
the retargeted aim/fire face +X — Mateo would yaw 90° every time he
started walking. Fix: the Hips rotation keys of idle/walk/run are
premultiplied by R_y(+90°) = (0, 0.7071, 0, 0.7071) in glTF space
(== R_z(+90°) in Blender space, which maps −Y → +X). Premultiplying
in the armature frame yaws the whole body without changing the pose.
After the fix every clip faces +X: verified by idle-front, walk-side
(profile stride) and aim-front/aim-side renders.

Final file: `/tmp/v34/mateo-v34-a.glb` (536,764 bytes), animations
idle, walk, run, aim, fire — installed as `game/vendor/mateo.glb`.

## Game integration (`game/world.js`)

- `MATEO_SCALE = 1.80 / 5.321` (0.3383). `model.scale` set on the
  GLTF scene root; `model.rotation.y = Math.PI / 2` (model faces
  glTF +X, game forward is −Z — VERIFY in the playtest probe).
- `mateoPlayClip` (crossfade 0.3 s), `mateoSetSpeed` (sp < 0.3 idle,
  sp > 6 run else walk; sprint = Run at 1.35× via `sim.js`),
  `mateoAim` → 'aim', `mateoFire` → 'fire' then back to aim/idle
  after 450 ms — all unchanged from v3.3 (model-agnostic).
- Pistol (Quaternius P226, CC0, `vendor/pistol.glb`) parented to
  the RightHand bone, visible only for aim/fire. Its grip scale and
  position are divided by MATEO_SCALE (grip scale 1.15/0.3383,
  position (0, −0.059, 0.030) in hand-bone units) so it still reads
  0.28 m in the world. The grip orientation (`inner.rotation`,
  barrel → hand +Y) was tuned for the MPFB hand — verify the barrel
  points forward in the aim probe.
- Beard: the small procedural beard stays on the Head bone, scaled
  by 1/boneScale (see below).
- **Bone world scale (the v3.4 trap, 18 Nov 2026).** The Human GLB's
  armature node carries a 69.183x scale (Blender export artifact),
  so 1 unit in bone-local space is MATEO_SCALE × 69.183 ≈ 23.4 m in
  the world. The first v3.4 build divided the beard and pistol grip
  by MATEO_SCALE only (0.3383) — and rendered a 4 m beard sphere and
  a 22 m pistol that filled the mission frame (diagnosed via
  matrixWorld decomposition: pistol mwScale 1224 = 100 (Pistol_5
  node) × 0.1539 (inner) × 3.4 (grip) × 69.183 (armature) × 0.3383
  (model)). The giant dark slabs in the first aim/idle-back probes
  were the beard sphere and the pistol, NOT rocks or buildings.
  Fix: the scale is measured at runtime from a bone's world matrix
  (`boneScale`, ≈23.4) and the beard radius/position and the pistol
  grip scale/position are divided by it (grip scale 1.15/23.4,
  grip position (0, −0.02/23.4, 0.01/23.4)). The skinned mesh itself
  is unaffected — its vertices live in armature space, so the
  armature scale is part of Mateo's correct 1.80 m height. Anything
  else parented to a bone with sizes in metres must use boneScale.
- Materials named `Mateo*` get `envMapIntensity = 0` (the v3.3.1
  lesson: the HDRI sun disc streaks the jacket otherwise).
- Locomotion speeds stay walk 4.2 / run 8 / sprint 11.5 m/s.

## Verification (Blender, `/tmp/v34/verify/`)

- `a-rest-front.png` — burnt-orange jacket, white tee V, dark navy
  jeans, white sneakers + dark soles, skin face/hands, dark hair.
- `a-rest-back.png` — hair covers the whole back of the head, jacket
  covers the whole back, arms separate from the torso.
- `a-idle-front.png` — idle faces +X (facing fix works), arms at
  sides, palms toward thighs, fingers down.
- `a-aim-front.png` / `a-aim-side.png` — two-handed aim, both arms
  forward at shoulder height, hands together.
- `a-walk-side.png` — mid-stride profile, arms swinging.
- `face-close4.png` — two small dark round eyes, clean skin face,
  no mask, no googly eyes.

In-game proof is the street screenshot (`2-street.jpg`, camera
behind Mateo — jacket from the back) and the mission screenshot
(`3-mission.jpg`, aim pose with the pistol in hand), plus the
playtest-distance probes (camera ~2.5–3 m, full body, idle + walk +
aim, front + side + back).

No Rockstar assets are used anywhere. The background pedestrians and
foot cops stay slim procedural humans (`makePerson` in `game/world.js`)
— only Mateo is the GLB.

## v3.3 history (retired model, kept for the record)

- v3.3: MPFB2 human (MakeHuman system assets, CC0), 3,399,932 bytes,
  Mixamo rig `mixamorig:*`, shells for jacket/jeans/tee built in
  Blender, Xbot idle/walk/run clips pasted by bone name — WRONG
  (rest orientations differ; FK errors to 179°).
- v3.3.1: world-space delta retarget of idle/walk/run (FK err
  1.51°), GLB surgery (jeans crotch web degenerated, jacket pushed
  out 32 mm radial, nipple tips flattened, neck/face smoothed),
  jeans gamma corrected to #23233A, envMapIntensity 0.
- v3.3.2: the "skirt" was the jeans gamma + an envelope tube
  enclosing both legs (deleted below y 0.85) + jacket hue shifted to
  amber #E8960F + body poke-through triangles deleted + collar and
  sole slabs added at runtime.
- v3.3.3: hand fix — forearm pronation ±90°, hand ±45°, finger curl
  damping 0.5, adduction, sleeve cylinders. Maximum pose fix; the
  mesh defects (fused arms, cube hands, googly eyes) remained.
  Model replaced in v3.4.
