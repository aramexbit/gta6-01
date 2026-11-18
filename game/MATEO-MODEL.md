# Mateo model — rigged civilian GLB (v3.2)

Mateo is the Mixamo `Xbot.glb` (`game/vendor/Xbot.glb`, 2,930,032
bytes — Mixamo "X Bot" as distributed with the three.js examples,
free for use, see `vendor/THIRD-PARTY.md`), loaded with the UMD
`GLTFLoader` r147 (`game/vendor/GLTFLoader.js`, MIT) + an
`AnimationMixer` with 0.3 s crossfades Idle ↔ Walk ↔ Run (the openvice
`Player.cpp` pattern: `IDLE_STANCE` / `walk_player` / `run_player` /
`SPRINT_civi`, walk speed 2.25 m/s, blend ~0.3 s, bob + run lean —
translated to JS in `game/world.js` `mateoSetSpeed` / `mateoUpdate` and
`game/sim.js` `updateFoot`).

## Why Xbot, not Soldier (v3.2 change)

v3.1 used Three.js example `Soldier.glb`. That model is military: a
backpack and chest plates on its back, so Mateo read as a soldier in
the street screenshot. The make.fun gta6-01 brief asks for an
original character, and the user (18 Nov 2026) directed the lead to
be civilian, not military. Xbot is a plain civilian mannequin — no
backpack, no plates, no weapon, no uniform — with slim civilian
proportions and Mixamo idle/walk/run clips. `Soldier.glb` is no
longer shipped in `game/vendor/`.

## Why vertex colours, not a repainted texture

The GLB has two single-material skinned meshes (Beta_Surface body +
Beta_Joints), so the parts cannot be recoloured with separate
materials. Vertex colours land exactly: each vertex is classified in
the model's local bind-pose space (Y-up, 0–1.81 m, T-pose, face +Z,
toes +Z) — burnt-orange bomber jacket `#B93E0C`, white tee strip on
the front chest, dark jeans `#23233A`, white sneakers, skin hands +
face `#C98A5A`, dark hair on the crown/back of the head. The model
faces local +Z while the game's forward is -Z, so it is turned π
inside its wrapper. Slim proportions: wrapper scale (0.92, 1, 0.94).

## Hair + beard (procedural, on the Head bone)

The mannequin head is smooth, so vertex colour alone cannot give a
hairline silhouette. An undercut hair cap (dark, short on the sides)
and a thin beard are small procedural meshes parented to the
`mixamorig:Head` bone, so they follow every head turn of the
Walk/Run clips (see `makeMateo` in `game/world.js`).

Verify in headless Chromium (front + back renders): orange jacket,
white tee, dark jeans, white sneakers, dark undercut hair, thin
beard, mid-stride Walk animation, no military gear. The street
screenshot (`2-street.jpg`) is the in-game proof.

No Rockstar assets are used anywhere. The background pedestrians and
foot cops stay slim procedural humans (`makePerson` in `game/world.js`)
— only Mateo is the GLB.
