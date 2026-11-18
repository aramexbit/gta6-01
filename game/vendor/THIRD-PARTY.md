# Third-party assets in game/vendor/ (MIT)

- `three.min.js` — Three.js r152, MIT License.
  Copyright (c) 2010-2023 Three.js Authors. SPDX-License-Identifier: MIT.
  https://github.com/mrdoob/three.js
- `GLTFLoader.js` — Three.js r147 GLTFLoader (UMD build), MIT License.
  Copyright (c) 2010-2023 Three.js Authors. SPDX-License-Identifier: MIT.
  https://github.com/mrdoob/three.js/blob/r147/examples/js/loaders/GLTFLoader.js
- `RGBELoader.js` — Three.js r147 RGBELoader (UMD build), MIT License.
  Same source as GLTFLoader above. Loads the sunset HDRI for the
  environment map (see `textures/bambanani_sunset_1k.hdr`).
- `mateo.glb` — Mateo Vega, built 18 Nov 2026 with MPFB2
  (https://github.com/makehumancommunity/mpfb2, GPL-3.0 code) from the
  MakeHuman system assets pack (CC0 1.0 Universal):
  skin `young_caucasian_male`, eyes `low-poly`, eyebrows `eyebrow001`,
  eyelashes `eyelashes01`, hair `short01`, shoes `shoes04`. The
  bomber jacket / white tee / dark jeans are procedural shells built
  in Blender from the body mesh (no third-party clothing). The
  idle/walk/run clips are the Mixamo "X Bot" clips (free for use
  under Adobe Mixamo's terms, as distributed with the three.js
  examples); the aim/fire clips were authored for this game. The
  MPFB2 addon code is GPL-3.0 but is NOT shipped — only its CC0
  output (the generated human + CC0 assets) is in this repo.
  See `game/MATEO-MODEL.md` for the full build recipe. v3.3.1 (18 Nov
  2026): the idle/walk/run clips were WORLD-SPACE DELTA RETARGETED
  from the same Mixamo Xbot clips onto the MPFB rig (same clips, no
  new asset — the verbatim bone-name paste deformed the mesh; see
  `MATEO-MODEL.md` v3.3.1). The shoes map is dropped at runtime in
  `world.js` so the off-white base colour renders as white sneakers.
  The sky clouds are a procedural canvas texture (no asset).
  v3.3.1 GLB surgery (same file, no new asset): jeans crotch-web
  triangles degenerated, jacket centre-front pushed out 32 mm radial,
  jacket back pushed out 32 mm radial, body nipple tips flattened,
  body neck/face Laplacian-smoothed (gore lines), jeans base colour
  corrected to the documented #23233A (it had shipped near-black
  #04040B) — see `MATEO-MODEL.md` "v3.3.1 — GLB surgery".
- `pistol.glb` — Quaternius "P226" from the Ultimate Guns Pack, CC0 1.0.
  https://poly.pizza/bundle/Ultimate-Guns-Pack-cpgUfI4t2F
  968 tris. Parented to Mateo's RightHand bone (see `world.js`
  `loadPistol`); normalised by bounding box to a 0.28 m barrel.
- `palm.glb` — Quaternius "Palm Tree", CC0 1.0.
  https://poly.pizza/m/A6cKJYFsIb
  Cloned with random rotation/scale/lean (see `world.js` `placePalms`).
- `rock.glb` — Quaternius rock, CC0 1.0. Scattered on the beach + pier.
- `cars/` — Kenney Car Kit 3.1, CC0 1.0 (public domain).
  https://kenney.nl/assets/car-kit (mirror: Arslan12216775 /
  kenney_car-kit on GitHub). Only the models actually used are
  shipped: `sedan`, `sedan-sports`, `hatchback-sports`, `suv`, `van`,
  `truck`, `police`. See `world.js` `makeCar` / `applyCarModel`.
- `textures/` — Poly Haven, CC0 1.0 (public domain).
  https://polyhaven.com — `asphalt_02` (diffuse + roughness, 512 px),
  `aerial_sand` (diffuse + roughness, 512 px), `brushed_concrete`
  (diffuse, 512 px), `clay_plaster` (diffuse, 512 px, facade bump),
  `bambanani_sunset_1k.hdr` (1K sunset HDRI, environment map).
- `kaykit/` — KayKit "City Builder Bits" 1.0, CC0 (public domain).
  https://kaykit.itch.io/city-builder-bits (mirror: BOISSARD /
  KayKit-City-Builder-Bits-1.0 on GitHub). Only the models actually
  used are shipped: `streetlight`, `bench`, `bush`, `firehydrant`,
  `trash_A`, `dumpster`, `watertower` (+ `citybits_texture.png`
  atlas they share). Street furniture in `game/world.js` `kaykitPlace`.

No Rockstar assets are used anywhere. `Xbot.glb` (v3.2) is no longer
shipped — Mateo is the MPFB2 human above.
