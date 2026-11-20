# MATEO VEGA — character model

**Mateo Vega, 28, getaway driver.** Burnt-orange bomber jacket over a white
tee, dark jeans, dark shoes, wavy brown-blond hair, light stubble. He is an
original character, built for this game; no likeness of any real person or
of any character from a commercial game.

## The model in this build

`game/core.js` ships a minimal glTF 2.0 loader (`core.loadGLB`) that reads
`game/vendor/mateo.glb` when the file is present: binary container, mesh
primitives (POSITION / NORMAL / TEXCOORD_0 / indices), PBR materials with
embedded base-colour textures, node hierarchy with TRS transforms. Skins
and animations are intentionally not supported — the bind pose is rendered
as-is — because the game needs a readable standing figure, not a rig.

**Status in v6.6: the original model is RESTORED.** `vendor/mateo.glb`
is again the Quaternius Animated Human (CC0, 536,764 bytes), recovered
with `git show` from commit af056b5 (where v3.4 first vendored it) —
replacing the 15,920-byte box-figure stand-in authored in v6.5.
`core.loadGLB` loads it at boot (`window.__MATEO_GLB === 'loaded'`)
and `sim.setMateoGLB` normalises it to Mateo's 1.8 m height. The
procedural Mateo defined in `world.buildMateo` remains the aiming-pose
stand-in for the staged market shot, where the GLB's bind pose cannot aim.

- torso: orange bomber jacket with white tee panel, zipper line, collar
  band and pocket flaps;
- legs: dark jeans with dark shoes;
- head: skin-tone sphere, hair cap, stubble jaw;
- arms: orange sleeves with skin hands;
- aiming variant: two-handed pistol stance, slight crouch, pistol mesh and
  a muzzle-flash sprite lit when firing.

If `vendor/mateo.glb` is replaced later by a richer model, the loader
picks it up automatically: `sim.setMateoGLB` normalises it to Mateo's
1.8 m height and uses it as the on-foot player figure, with the
procedural figure kept as the aiming-pose stand-in for the staged
market shot.

## Where Mateo appears

- On foot in free play (WASD + mouse look, E to enter/exit cars).
- Aiming his pistol in the night-market firefight (screenshot 3).
- As the driver inside the Scarlet Arrow (seen through the windshield in
  the chase shots).
