# Third-party assets in game/vendor/ (MIT)

- `three.min.js` — Three.js r152, MIT License.
  Copyright (c) 2010-2023 Three.js Authors. SPDX-License-Identifier: MIT.
  https://github.com/mrdoob/three.js
- `GLTFLoader.js` — Three.js r147 GLTFLoader (UMD build), MIT License.
  Copyright (c) 2010-2023 Three.js Authors. SPDX-License-Identifier: MIT.
  https://github.com/mrdoob/three.js/blob/r147/examples/js/loaders/GLTFLoader.js
- `Xbot.glb` — Mixamo "X Bot" character model, as distributed with the
  three.js examples (free for use under Adobe Mixamo's terms; the
  three.js MIT licence covers the loader/example code, the model itself
  is a Mixamo free asset).
  https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Xbot.glb
  Used as Mateo Vega's rigged civilian body (recoloured per-part with
  vertex colours + procedural undercut hair and thin beard on the Head
  bone — see `game/MATEO-MODEL.md`). Animations used: idle, walk, run.
  v3.2 REPLACES `Soldier.glb` (v3.1): the Soldier is a military model
  (backpack + chest plates) and read as a soldier, wrong for this
  game's original civilian lead. Soldier.glb is no longer shipped.
- `kaykit/` — KayKit "City Builder Bits" 1.0, CC0 (public domain).
  https://kaykit.itch.io/city-builder-bits (mirror: BOISSARD /
  KayKit-City-Builder-Bits-1.0 on GitHub). Only the models actually
  used are shipped: `streetlight`, `bench`, `bush`, `firehydrant`,
  `trash_A`, `dumpster`, `watertower` (+ `citybits_texture.png`
  atlas they share). Street furniture in `game/world.js` `kaykitPlace`.
