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
- `mateo.glb` — Mateo Vega, v3.4 (18 Nov 2026): Quaternius
  "Animated Human", CC0 1.0 (public domain).
  https://poly.pizza/m/c3Ibh9I3udk
  One skinned mesh, 4,749 verts; the 8 procedural materials (skin,
  hair, eyes, amber jacket, white tee, dark jeans, white sneakers,
  dark soles) were split from the asset's single grey material in
  Blender — no new geometry except dark sole boxes joined to the
  mesh. The idle/walk/run clips are the asset's own clips (in-place);
  the aim/fire clips are `Pistol_Aim_Neutral` / `Pistol_Shoot` from
  the Universal Animation Library, CC0 1.0
  (https://github.com/J-Ponzo/gltf-universal-animation-library),
  retargeted at the glTF level. See `game/MATEO-MODEL.md` for the
  full build recipe. The v3.3 MPFB2 human (MakeHuman system assets,
  CC0) was retired in v3.4 — its mesh was defective (fused arms,
  cube hands, googly eyes) and is no longer shipped.
  NOTE: the Quaternius "Animated Base Character" was evaluated and
  REJECTED for this repo — under the Quaternius Asset License QAL
  v1.0 its raw GLB may not be redistributed as a standalone asset,
  so it must never be committed here. Only CC0 Quaternius assets
  (Animated Human, P226, Palm Tree, rock) are shipped.
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

No Rockstar assets are used anywhere. `Xbot.glb` (v3.2) and the MPFB2
human (v3.3) are no longer shipped — Mateo is the CC0 Animated Human
above.
