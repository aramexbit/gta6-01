# Mateo model — rigged MIT GLB (v3.1)

Mateo is the Three.js example `Soldier.glb` (`game/vendor/Soldier.glb`,
2,160,468 bytes, MIT — see `vendor/THIRD-PARTY.md`), loaded with the
UMD `GLTFLoader` r147 (`game/vendor/GLTFLoader.js`, MIT) + an
`AnimationMixer` with 0.3 s crossfades Idle ↔ Walk ↔ Run (the openvice
`Player.cpp` pattern: `IDLE_STANCE` / `walk_player` / `run_player` /
`SPRINT_civi`, walk speed 2.25 m/s, blend ~0.3 s, bob + run lean —
translated to JS in `game/world.js` `mateoSetSpeed` / `mateoUpdate` and
`game/sim.js` `updateFoot`).

## Why vertex colours, not a repainted texture

The GLB is a single-material skinned mesh: the whole body (head,
jacket, jeans, boots) shares one material (`VanguardBodyMat`), so the
parts cannot be recoloured with separate materials. A repainted texture
was tried first (per-triangle UV rasterisation from the bind-pose
positions): it mostly worked, but the UV atlas has overlapping islands,
so boot/tee colours bled onto the thighs. Vertex colours land exactly:
each vertex is classified in the model's local bind-pose space (Z-up,
0–183, face +Y) — burnt-orange bomber jacket `#C85A1E`, white tee
strip on the front chest, dark jeans `#23233A`, white sneakers, skin
hands + face `#C98A5A`, dark hair `#1F1A16`. The visor mesh is hidden.
Slim proportions: wrapper scale (0.88, 1, 0.9).

Verified in headless Chromium (front + back renders): orange jacket,
white tee, dark jeans, white sneakers, dark hair, mid-stride Walk
animation. The street screenshot (`2-street.jpg`) is the in-game proof.

No Rockstar assets are used anywhere. The background pedestrians and
foot cops stay slim procedural humans (`makePerson` in `game/world.js`)
— only Mateo is the GLB.
