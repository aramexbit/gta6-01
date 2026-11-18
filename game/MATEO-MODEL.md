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
  Rig `"mixamo"` — the bones are exactly `mixamorig:*` (52 bones),
  so the Xbot idle/walk/run clips transfer verbatim.
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
