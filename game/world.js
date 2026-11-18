/* PIER HEAT — Sunset Bay. world.js: renderer, city, props, vehicles, people.
   Shares globals with core.js / sim.js / main.js (classic scripts, one scope). */
'use strict';

/* ---------- three.js setup ---------- */
const HEADLESS = navigator.webdriver === true;
const renderer = new THREE.WebGLRenderer({ antialias: !HEADLESS, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = !params.has('flat');
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
/* v3.2: exposure 1.35 -> 1.0. The bright sun + high exposure washed
   every sun-facing surface to near-white (sand read as a white sheet
   in the user's image-80.png, the Scarlet Arrow read pale pink).
   Golden hour stays warm, but nothing may clip to white now.
   v3.3.1: 1.0 -> 1.15 — the v3.3 frame read as night; the extra stop
   of exposure lifts the streets and facades back into daylight. */
renderer.toneMappingExposure = 1.15;
$('game').appendChild(renderer.domElement);

/* ---------- v3.3 PBR textures (Poly Haven, CC0) + HDRI environment ----------
   512 px maps, loaded once, shared: asphalt (roads), aerial sand
   (beach + promenade strip), brushed concrete (sidewalks), clay
   plaster (facade bump). The HDRI (bambanani sunset 1K) feeds a PMREM
   environment map so standard materials get a warm sunset reflection
   instead of flat ambient light. */
const PH = {};
(function loadPBR() {
  const tl = new THREE.TextureLoader();
  const mk = (file, rx, ry, srgb) => {
    const t = tl.load('vendor/textures/' + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  PH.asphalt = mk('asphalt_02_diff_512.jpg', 2, 50);
  PH.asphaltRough = mk('asphalt_02_rough_512.jpg', 2, 50, false);
  PH.sand = mk('aerial_sand_diff_512.jpg', 4, 30);
  PH.sandRough = mk('aerial_sand_rough_512.jpg', 4, 30, false);
  PH.concrete = mk('brushed_concrete_diff_512.jpg', 1, 40);
  PH.plaster = mk('clay_plaster_diff_512.jpg', 1, 1, false);
})();
if (window.THREE && THREE.RGBELoader) {
  new THREE.RGBELoader().load('vendor/textures/bambanani_sunset_1k.hdr', (hdr) => {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose(); pmrem.dispose();
      dullEnv(scene);
      window.__HDRI_READY = true;
    } catch (e) { window.__HDRI_READY = 'error'; }
  }, undefined, () => { window.__HDRI_READY = 'error'; });
} else window.__HDRI_READY = 'noloader';
/* v3.3: the HDRI's traverse above only catches meshes that exist when the
   HDRI loads — GLBs arrive later (async), so their materials kept
   envMapIntensity 1.0 and the sunset env painted bright vertical streaks
   on Mateo's jacket (found 18 Nov 2026). Every GLB loader callback below
   calls dullEnv() on its scene so all standard materials sit at 0.5. */
function dullEnv(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = 0.5;
  });
}

/* ---------- v3.3 bloom + grade (lightweight custom composer) ----------
   No EffectComposer in the r152 core build, so the chain is hand-rolled:
   scene -> HalfFloat RT -> bright-pass (max-channel, soft knee) at half
   res -> separable Gaussian blur x2 -> composite (ACES filmic + sRGB +
   lift/gamma/gain + saturation + vignette) + bloom. SMAA is skipped:
   the renderer already runs MSAA (antialias:true). If anything here
   fails, renderFrame() falls back to a plain renderer.render. */
const composer = { ok: false };
function initComposer() {
  try {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const mkRT = (w, h, depth) => new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: depth,
    });
    composer.rtScene = mkRT(size.x, size.y, true);
    composer.rtA = mkRT(size.x >> 1, size.y >> 1, false);
    composer.rtB = mkRT(size.x >> 1, size.y >> 1, false);
    composer.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    composer.quadScene = new THREE.Scene();
    const quad = (frag, uniforms) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ uniforms, vertexShader:
          'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
          fragmentShader: frag, depthTest: false, depthWrite: false }));
      m.frustumCulled = false;
      return m;
    };
    composer.bright = quad(
      'uniform sampler2D tD; uniform float uT; varying vec2 vUv;' +
      'void main(){ vec3 c = texture2D(tD, vUv).rgb;' +
      ' float m = max(max(c.r, c.g), c.b);' +
      ' float k = smoothstep(uT, uT + 0.25, m);' +
      ' gl_FragColor = vec4(c * k, 1.0); }',
      { tD: { value: null }, uT: { value: 0.8 } });
    composer.blur = quad(
      'uniform sampler2D tD; uniform vec2 uDir; varying vec2 vUv;' +
      'void main(){ vec3 c = texture2D(tD, vUv).rgb * 0.227027;' +
      ' vec2 o1 = uDir * 1.3846153846, o2 = uDir * 3.2307692308;' +
      ' c += texture2D(tD, vUv + o1).rgb * 0.3162162162 + texture2D(tD, vUv - o1).rgb * 0.3162162162;' +
      ' c += texture2D(tD, vUv + o2).rgb * 0.0702702703 + texture2D(tD, vUv - o2).rgb * 0.0702702703;' +
      ' gl_FragColor = vec4(c, 1.0); }',
      { tD: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } });
    composer.comp = quad(
      'uniform sampler2D tD; uniform sampler2D tB; uniform float uBloom; varying vec2 vUv;' +
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }' +
      'void main(){ vec3 c = texture2D(tD, vUv).rgb + texture2D(tB, vUv).rgb * uBloom;' +
      ' c = aces(c * 1.0);' +                       // filmic tone map (renderer tonemapping is off while composing)
      ' c = pow(c, vec3(1.0/1.05));' +             // v3.3.1: gentler lift (was 1/1.12) — bright golden hour, not night
      ' float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, 1.08);' + // +saturation
      ' vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.14;' + // v3.3.1 vignette 0.28 -> 0.14 — the heavy corners read as night
      // NO pow(1/2.2) here: the renderer (outputColorSpace srgb) encodes
      // linear -> sRGB once on the final quad. (The old pow() double-encoded
      // and blew the cars/crosswalk out to white — found 18 Nov 2026.)
      ' gl_FragColor = vec4(c, 1.0); }',
      { tD: { value: null }, tB: { value: null }, uBloom: { value: 0.3 } });
    composer.ok = true;
    renderer.toneMapping = THREE.NoToneMapping; // ACES now lives in the composite shader
  } catch (e) { composer.ok = false; }
}
function renderFrame() {
  if (!composer.ok) { renderer.render(scene, camera); return; }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (composer.rtScene.width !== size.x || composer.rtScene.height !== size.y) {
    composer.rtScene.setSize(size.x, size.y);
    composer.rtA.setSize(size.x >> 1, size.y >> 1);
    composer.rtB.setSize(size.x >> 1, size.y >> 1);
  }
  const oldRT = renderer.getRenderTarget();
  // NOTE (bug found 18 Nov 2026, debug-composer2): the uniforms live on
  // the quad MESH's material, not on the mesh — `quad.uniforms` is
  // undefined and threw every frame at the bright pass, stranding the
  // render target on rtScene so the canvas stayed transparent. Always
  // use `.material.uniforms`, and restore the target in a finally.
  try {
    renderer.setRenderTarget(composer.rtScene);
    renderer.render(scene, camera);
    // bright-pass into rtA, blur rtA->rtB (H), rtB->rtA (V), rtA->rtB (H), rtB->rtA (V)
    composer.bright.material.uniforms.tD.value = composer.rtScene.texture;
    composer.quadScene.clear(); composer.quadScene.add(composer.bright);
    renderer.setRenderTarget(composer.rtA); renderer.render(composer.quadScene, composer.cam);
    const blurDir = composer.blur.material.uniforms.uDir.value;
    const blurPass = (src, dst, dx, dy) => {
      composer.blur.material.uniforms.tD.value = src.texture;
      blurDir.set(dx / (size.x >> 1), dy / (size.y >> 1));
      composer.quadScene.clear(); composer.quadScene.add(composer.blur);
      renderer.setRenderTarget(dst); renderer.render(composer.quadScene, composer.cam);
    };
    blurPass(composer.rtA, composer.rtB, 1, 0);
    blurPass(composer.rtB, composer.rtA, 0, 1);
    blurPass(composer.rtA, composer.rtB, 1, 0);
    blurPass(composer.rtB, composer.rtA, 0, 1);
    composer.comp.material.uniforms.tD.value = composer.rtScene.texture;
    composer.comp.material.uniforms.tB.value = composer.rtA.texture;
    composer.quadScene.clear(); composer.quadScene.add(composer.comp);
    renderer.setRenderTarget(null);
    renderer.render(composer.quadScene, composer.cam);
  } catch (e) {
    // A post-processing failure must never black out the game: fall back
    // to a plain render of this frame and disable the composer.
    composer.ok = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // back to the pre-composer grade
    try { renderer.render(scene, camera); } catch (_) { /* keep the last frame */ }
  } finally {
    renderer.setRenderTarget(oldRT);
  }
}
initComposer();

const scene = new THREE.Scene();
/* v3.3.1 GOLDEN HOUR — bright, not night (user, 18 Nov 2026): the v3.3
   grade (deep indigo sky + low sun + heavy vignette) read as night in
   play. The sky is now a bright sunset: soft dusky-blue zenith fading
   through lavender and pink to a warm orange horizon, the sun sits
   higher and stronger, and the haze is pale peach. */
const skyStops = [[0.00, '#2E4A7C'], [0.28, '#6A5AA8'], [0.48, '#C94F7C'],
  [0.66, '#FF7A3D'], [0.84, '#FFB347'], [1.00, '#FFE3A1']];
(function buildSky() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  for (const [at, col] of skyStops) gr.addColorStop(at, col);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(760, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  scene.background = new THREE.Color(0x2E4A7C);
})();
scene.fog = new THREE.Fog(0xF2B183, 180, 620);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1600);
/* v3.2: start-screen camera sits mid-road on Ocean Drive (was -110, 6,
   40 — a palm stood right in front of it and its leaves covered the
   title). Palms line x=-132 and x=-108; the road centre is clear. */
camera.position.set(-116, 5.5, 36);

/* Low golden-hour sun: long shadows, warm key light. v3.3.1: sun 1.25 ->
   1.6 and higher (was 70, now 110) + hemisphere 0.7 -> 0.95 with a
   lighter sky tint + ambient 0.35 -> 0.5 — the v3.3 scene read as night
   because the key/fill were too dim against the dark sky dome. */
const sunLight = new THREE.DirectionalLight(0xFFC46B, 1.6);
sunLight.position.set(-240, 110, -60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
sunLight.shadow.camera.far = 600;
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(0xB9C8F0, 0x9A6A4A, 0.95));
/* Warm bounce so shadowed faces never go black. */
scene.add(new THREE.AmbientLight(0x9A7A7A, 0.5));

/* 3-step toon gradient map */
const gradData = new Uint8Array([90, 160, 255, 255]);
const gradTex = new THREE.DataTexture(gradData, 4, 1, THREE.RedFormat);
gradTex.minFilter = THREE.NearestFilter; gradTex.magFilter = THREE.NearestFilter;
gradTex.needsUpdate = true;
function toon(color, opts) {
  return new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: gradTex }, opts || {}));
}
/* ---------- v3.2 materials: MeshStandardMaterial + window textures ----------
   Leonida Materials.ts pattern: buildings are NOT flat toon boxes — each
   facade is a canvas texture of a window grid (some windows lit warm for
   dusk), used as both map and emissiveMap so lit windows glow; roughness /
   metalness per material (concrete 0.9/0, glass 0.35/0.6). The toon()
   helper stays for cars, people and small props. */
function windowTexture(kind, litRatio) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  const base = kind === 'glass' ? '#2E4A5E' : kind === 'deco' ? '#E8D9C0' : '#8A7A6A';
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  // faint floor slabs so the grid reads even where windows are dark
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 2);
  const em = document.createElement('canvas'); em.width = 128; em.height = 256;
  const eg = em.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 8, ww = 22, wh = 20, gx = 8, gy = 8;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = gx + c * (ww + gx), y = gy + r * (wh + gy);
    const lit = rnd() < litRatio;
    const frame = kind === 'glass' ? '#9AC8E8' : '#3A2A20';
    g.fillStyle = frame; g.fillRect(x - 2, y - 2, ww + 4, wh + 4);
    if (kind === 'glass') g.fillStyle = lit ? '#FFD9A0' : '#1E3A4E';
    else g.fillStyle = lit ? '#FFC46B' : (rnd() < 0.5 ? '#2A2438' : '#4A5A6A');
    g.fillRect(x, y, ww, wh);
    if (lit) { eg.fillStyle = '#FFB347'; eg.fillRect(x, y, ww, wh); }
  }
  const map = new THREE.CanvasTexture(cv);
  const emissiveMap = new THREE.CanvasTexture(em);
  return { map, emissiveMap };
}
const WIN_TEX = {};
function winMat(kind) {
  if (!WIN_TEX[kind]) WIN_TEX[kind] = windowTexture(kind, kind === 'glass' ? 0.28 : 0.20); // v3.3.1: bright golden hour, not dusk (was 0.55/0.45)
  const t = WIN_TEX[kind];
  const glass = kind === 'glass';
  return new THREE.MeshStandardMaterial({
    map: t.map, emissiveMap: t.emissiveMap, emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.6, roughness: glass ? 0.35 : 0.9, metalness: glass ? 0.6 : 0.0,
  });
}
/* Per-building facade material: the shared window canvas is cloned (cheap
   — same image) and repeated so windows stay ~1.5 m wide and floors
   ~3 m tall whatever the building's size, then tinted with the district
   palette so no two buildings share one flat colour. */
function winMatFor(kind, w, h, tint) {
  const t = WIN_TEX[kind] || (WIN_TEX[kind] = windowTexture(kind, kind === 'glass' ? 0.28 : 0.20)); // v3.3.1: bright golden hour (was 0.55/0.45)
  const glass = kind === 'glass';
  const map = t.map.clone(); map.needsUpdate = true;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 24)));
  const em = t.emissiveMap.clone(); em.needsUpdate = true;
  em.wrapS = em.wrapT = THREE.RepeatWrapping;
  em.repeat.copy(map.repeat);
  return new THREE.MeshStandardMaterial({
    map, emissiveMap: em, emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.85, color: tint,
    roughness: glass ? 0.35 : 0.9, metalness: glass ? 0.6 : 0.0,
    bumpMap: PH.plaster, bumpScale: 0.02, // v3.3: clay-plaster relief on facades
  });
}
/* Plain standard material (ground, roads, sand): roughness per surface,
   no flat toon shading — the city reads as built matter, not plastic.
   v3.3: opts.map / opts.roughnessMap take the Poly Haven PBR textures. */
function std(color, roughness, metalness, opts) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: roughness === undefined ? 0.95 : roughness,
    metalness: metalness || 0 });
  if (opts) {
    if (opts.map) m.map = opts.map;
    if (opts.roughnessMap) m.roughnessMap = opts.roughnessMap;
    if (opts.bumpMap) { m.bumpMap = opts.bumpMap; m.bumpScale = opts.bumpScale || 0.03; }
  }
  return m;
}
function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
const glowTex = glowTexture();
function glowSprite(color, scale) {
  const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
  const s = new THREE.Sprite(m); s.scale.set(scale, scale, 1); return s;
}
/* thin inverted-hull outline for hero objects */
function addOutline(mesh, color, scale) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial(
    { color: color || C.asphalt, side: THREE.BackSide }));
  o.scale.setScalar(scale || 1.04); mesh.add(o); return o;
}

/* ---------- world ---------- */
const world = new THREE.Group(); scene.add(world);
const ROAD_X = [-120, -80, -40, 0, 40, 80, 120];
const ROAD_Z = [-120, -80, -40, 0, 40, 80, 120];
const CITY = 150; // half-extent of the road grid
/* building footprints for collision + camera occlusion: {x, z, hw, hd, h} */
const BUILDINGS = [];

function box(w, h, d, mat, x, y, z, parent, noShadow) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = !noShadow; m.receiveShadow = true;
  (parent || world).add(m); return m;
}
function buildWorld() {
  /* Warm terracotta ground (v3.1: was dark brown 0x4A3644 — read as mud
     in chase/street shots). Sunset palette, no pure white/black. */
  /* v3.2 ground: standard materials, deeper tans — the pale sand
     (0xE8C9A0) + pastel beach clipped to white under the v3.1 sun. */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 60, CITY * 2 + 60), std(0x8A5A48));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, CITY * 2 + 60),
    std(0xC9A06A, 0.95, 0, { map: PH.sand, roughnessMap: PH.sandRough }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(-CITY - 38, 0.05, 0); beach.receiveShadow = true; world.add(beach);
  /* Ocean Drive sand promenade (v3.1): the beach used to sit 45 m from the
     road behind dark ground. A sand strip now joins Ocean Drive (x=-120)
     to the beach, so the chase/street shots read as a beachfront boulevard
     — sea on one side, art-deco hotels on the other. */
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, CITY * 2 + 60),
    std(0xC99B62, 0.95, 0, { map: PH.sand, roughnessMap: PH.sandRough }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-CITY + 4.5, 0.04, 0); sand.receiveShadow = true; world.add(sand);
  /* Wide pale promenade sidewalk on the sea side of Ocean Drive. */
  const prom = new THREE.Mesh(new THREE.PlaneGeometry(10, CITY * 2),
    std(0xB98A68, 0.95, 0, { map: PH.concrete }));
  prom.rotation.x = -Math.PI / 2; prom.position.set(-131, 0.06, 0); prom.receiveShadow = true; world.add(prom);
  /* v3.2 sea: gradient texture (deep teal offshore -> turquoise ->
     pale foam at the shore) instead of one flat teal plane, plus
     animated wave stripes rolling toward the beach (updateSea). */
  const seaCv = document.createElement('canvas'); seaCv.width = 256; seaCv.height = 8;
  const sg = seaCv.getContext('2d');
  const sgr = sg.createLinearGradient(0, 0, 256, 0);
  sgr.addColorStop(0.00, '#14384A'); sgr.addColorStop(0.45, '#1E5E70');
  sgr.addColorStop(0.75, '#2E8A9A'); sgr.addColorStop(0.92, '#5EB8A8'); sgr.addColorStop(1.00, '#8FD0C0');
  sg.fillStyle = sgr; sg.fillRect(0, 0, 256, 8);
  const seaTex = new THREE.CanvasTexture(seaCv);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, CITY * 2 + 400),
    new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.55, metalness: 0.15 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-CITY - 190, -0.4, 0); world.add(sea);
  const seaWaves = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(180, 1.2), new THREE.MeshBasicMaterial({ color: 0xCFE8E0, transparent: true, opacity: 0.35 }));
    s.rotation.x = -Math.PI / 2; s.position.set(-CITY - 120 - rnd() * 120, -0.2, -180 + i * 40 + rnd() * 10); world.add(s);
    seaWaves.push({ mesh: s, speed: 1.5 + rnd() * 2 });
  }
  window.__SEA_WAVES = seaWaves;
  /* v3.2 roads: standard asphalt (was flat toon brown) + concrete curbs.
     v3.3: Poly Haven asphalt + roughness maps, concrete sidewalks. */
  const roadMat = std(0x6A5248, 0.95, 0, { map: PH.asphalt, roughnessMap: PH.asphaltRough });
  const walkMat = std(0xB08A62, 0.95, 0, { map: PH.concrete }); // sidewalks: warm sand-tan so streets read at golden hour
  const dashCv = document.createElement('canvas'); dashCv.width = 16; dashCv.height = 64;
  const dg = dashCv.getContext('2d');
  dg.clearRect(0, 0, 16, 64);
  dg.fillStyle = '#FFB347'; dg.fillRect(6, 6, 4, 34);
  const dashTex = new THREE.CanvasTexture(dashCv);
  dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping;
  for (const x of ROAD_X) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(12, CITY * 2), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.1, 0); r.receiveShadow = true; world.add(r);
    for (const s of [-8.4, 8.4]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(4.5, CITY * 2), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(x + s, 0.07, 0); w.receiveShadow = true; world.add(w);
    }
    const dt2 = dashTex.clone(); dt2.needsUpdate = true; dt2.repeat.set(1, 38);
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, CITY * 2),
      new THREE.MeshBasicMaterial({ map: dt2, transparent: true }));
    dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.14, 0); world.add(dash);
  }
  for (const z of ROAD_Z) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 12), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.1, z); r.receiveShadow = true; world.add(r);
    for (const s of [-8.4, 8.4]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 4.5), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(0, 0.07, z + s); w.receiveShadow = true; world.add(w);
    }
    const dt2 = dashTex.clone(); dt2.needsUpdate = true; dt2.repeat.set(38, 1);
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 1.4),
      new THREE.MeshBasicMaterial({ map: dt2, transparent: true }));
    dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.14, z); world.add(dash);
  }
  /* v3.2 crosswalks: zebra planes on Ocean Drive (7) + the z=0 avenue (7),
     so the streets read as real roads, not bare asphalt strips. */
  function zebraTex(horizontal) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
    const zg = cv.getContext('2d');
    zg.clearRect(0, 0, 128, 32);
    zg.fillStyle = 'rgba(244,236,223,0.92)';
    for (let i = 0; i < 5; i++) {
      if (horizontal) zg.fillRect(6 + i * 25, 2, 14, 28);
      else zg.fillRect(2, 2 + i * 6, 124, 3);
    }
    return new THREE.CanvasTexture(cv);
  }
  const crossNS = new THREE.MeshBasicMaterial({ map: zebraTex(true), transparent: true });
  const crossEW = new THREE.MeshBasicMaterial({ map: zebraTex(false), transparent: true });
  for (const z of ROAD_Z) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), crossNS);
    c.rotation.x = -Math.PI / 2; c.position.set(-120, 0.13, z + 10); world.add(c);
  }
  for (const x of ROAD_X) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(4, 12), crossEW);
    c.rotation.x = -Math.PI / 2; c.position.set(x + 10, 0.13, 0); world.add(c);
  }
  /* v3.3.1: the sun sits LOW AHEAD (+Z) so the chase and street shots
     drive/walk toward the sunset, sun near the centre of the frame like
     the top-rank entries (was (-260, 30, 160), off to the side). */
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: C.sun, fog: false }));
  sunDisc.position.set(-130, 30, 260); sunDisc.lookAt(-120, 10, 0); world.add(sunDisc);
  const sunGlow = glowSprite(C.sun, 150); sunGlow.position.set(-128, 32, 255); world.add(sunGlow);
  /* v3.3.1 REALISTIC CLOUDS (user, 18 Nov 2026): the old clouds were
     pink/orange BOXES floating in a purple sky — "aneh malah kotak",
     while the top-rank skies are soft textured clouds. Box/slab clouds
     are GONE. Each cloud is now a sprite of several overlapping soft
     radial-gradient puffs (canvas texture, transparent feathered edges,
     warm sunset tint), scattered naturally high in the sky. No box
     may ever appear in the sky again. */
  const cloudTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    const puff = (x, y, r, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,236,220,${a})`);
      gr.addColorStop(0.55, `rgba(255,205,190,${a * 0.65})`);
      gr.addColorStop(1, 'rgba(255,190,180,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    puff(128, 78, 62, 0.9); puff(82, 88, 44, 0.85); puff(178, 88, 48, 0.85);
    puff(52, 96, 30, 0.7); puff(208, 96, 32, 0.7); puff(128, 58, 40, 0.6);
    return new THREE.CanvasTexture(cv);
  })();
  const cloudTints = [0xFFE8D8, 0xFFD9C4, 0xFFC4C9, 0xFFE0B8];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, fog: false,
      color: pick(cloudTints), opacity: 0.55 + rnd() * 0.25, depthWrite: false });
    const s = new THREE.Sprite(m);
    const w = 60 + rnd() * 70;
    s.scale.set(w, w * 0.28 + 8, 1);
    s.position.set(-320 + rnd() * 640, 75 + rnd() * 60, -260 + rnd() * 520);
    world.add(s);
  }
  buildBuildings(); buildProps(); buildPier();
}
const NEON_SIGNS = ['NOODLES 24h', 'ARCADE', 'TACOS', 'MART', 'HOTEL BAY', 'NEON ROW', 'PIER BAR', 'SURF SHOP', 'KIRA FM', 'SUNSET MOTEL', 'OCEAN DR', 'DECO HOTEL', 'BAR — OPEN', 'PALM COURT'];
/* Art-deco pastel row (v3.1, Ocean Drive direction): pink / teal / yellow /
   mint / coral / lavender — saturated pastels, never dominant white. The
   row facing the beach (road x=-120, buildings bx≈-96) is always deco. */
const DECO_COLORS = [0xFF9CDA, 0x7FE3D0, 0xFFD166, 0xFF8A7A, 0xC9A8E8, 0x05D9E8, 0xFFB347];
const BUILDING_COLORS = [0xFF9CDA, 0x7FE3D0, 0xFFD166, 0xFF8A7A, 0xC9A8E8, 0x05D9E8, 0xFFB347, 0xFF2A6D];
/* v3.2 districts (Leonida Districts.ts pattern): the city is NOT a
   uniform 7x7 grid — three districts with different palettes, heights
   and materials, plus hand-placed variety per plot:
   - OCEAN DRIVE (road x=-120): low pastel art-deco hotels, neon edges.
   - LITTLE HAVANA (x -80..0): low warm terracotta/cream blocks.
   - DOWNTOWN (x 40..120): tall glass + concrete towers.
   Leonida BuildingBuilder.ts pattern per building: podium + tower +
   setback, roof parapet, antenna + red beacon, colourful awning over
   the street door, neon at the roof edge, windows from texture
   (Materials.ts windowTextures + setNight: lit windows at dusk). */
const HAVANA_COLORS = [0xC96A3A, 0xE8D9A0, 0xE8853A, 0xD96A5A, 0xD9A03A, 0xB85A4A];
const DOWNTOWN_COLORS = [0x5A7A8A, 0x3A5A6E, 0x7A8A9A, 0x4A6A7A];
function districtFor(x) {
  if (x === -120) return 'deco';
  if (x >= 40) return 'downtown';
  return 'havana';
}
/* v3.3 roof topologies (osm2threejs pattern): gable (two sloped slabs),
   hip (4-sided pyramid), dome (half sphere), sawtooth (3 sloped slabs),
   tiered (two stacked setbacks), flat (parapet only — nothing added). */
function addRoof(kind, bx, bz, w, d, h) {
  const mat = std(0x8A6A5A, 0.95);
  const mat2 = std(0x6A4A3A, 0.95);
  if (kind === 'gable') {
    for (const s of [-1, 1]) {
      const slab = box(w * 0.62, 0.3, d + 0.4, mat, bx + s * w * 0.22, h + 1.1, bz);
      slab.rotation.z = -s * 0.5;
    }
  } else if (kind === 'hip') {
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.38, 3.2, 4), mat);
    pyr.position.set(bx, h + 2.3, bz); pyr.rotation.y = Math.PI / 4; pyr.castShadow = true; world.add(pyr);
  } else if (kind === 'dome') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(w * 0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat2);
    dome.position.set(bx, h + 0.7, bz); dome.castShadow = true; world.add(dome);
  } else if (kind === 'sawtooth') {
    for (let i = -1; i <= 1; i++) {
      const slab = box(w / 3 + 0.2, 0.25, d, mat, bx + i * w / 3, h + 1.3, bz);
      slab.rotation.z = 0.45;
    }
  } else if (kind === 'tiered') {
    box(w * 0.7, 1.2, d * 0.7, mat, bx, h + 1.3, bz);
    box(w * 0.45, 1.2, d * 0.45, mat2, bx, h + 2.5, bz);
  }
}
function buildBuildings() {
  const neonColors = [C.magenta, C.cyan, C.sun, C.pink, C.teal];
  for (const x of ROAD_X) for (const z of ROAD_Z) {
    if (Math.abs(x) > 130 || Math.abs(z) > 130) continue;
    const bx = x + 24 + rnd() * 4, bz = z + 24 + rnd() * 4;
    if (bx < -135 || bx > 140 || bz < -140 || bz > 140) continue;
    if (rnd() < 0.22 && x !== -120) continue; // plaza gaps (never on Ocean Drive)
    const district = districtFor(x);
    const isDeco = district === 'deco';
    const w = 14 + rnd() * 8, d = 14 + rnd() * 8;
    const h = district === 'downtown' ? 20 + rnd() * 26
      : isDeco ? 8 + rnd() * 10 : 7 + rnd() * 7;
    const kind = district === 'downtown' ? 'glass' : district === 'deco' ? 'deco' : 'concrete';
    const palette = district === 'downtown' ? DOWNTOWN_COLORS : isDeco ? DECO_COLORS : HAVANA_COLORS;
    const tint = pick(palette);
    /* podium (full footprint, 30-40% of the height) + tower (set back
       2 m on each side) — the Leonida podium + tower + setback shape. */
    const ph = Math.max(4, h * (0.3 + rnd() * 0.12));
    const podium = box(w, ph, d, winMatFor(kind, w, ph, tint), bx, ph / 2, bz);
    podium.castShadow = true;
    const tw = w - 4 - rnd() * 2, td = d - 4 - rnd() * 2;
    const th = h - ph;
    const tower = box(tw, th, td, winMatFor(kind, tw, th, tint), bx + (rnd() - 0.5) * 2, ph + th / 2, bz + (rnd() - 0.5) * 2);
    tower.castShadow = true;
    BUILDINGS.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h });
    /* parapet: a thin slab lip around the tower roof edge. */
    box(tw + 0.6, 0.7, td + 0.6, std(district === 'downtown' ? 0x3A4A5A : 0x8A6A5A, 0.95), bx, h + 0.35, bz);
    /* v3.3 hero roofs (osm2threejs pattern — 6 topologies): the tallest
       downtown towers (h>34) and the tallest deco hotels (h>15) get a
       distinct roof on top of the parapet, so the skyline reads from
       the street instead of one flat slab everywhere. */
    if (h > 34 || (isDeco && h > 15)) {
      const kinds = ['gable', 'hip', 'dome', 'sawtooth', 'tiered', 'flat'];
      const kind = kinds[Math.abs(Math.round(bx * 7 + bz * 13)) % kinds.length];
      addRoof(kind, bx, bz, tw, td, h);
    }
    /* roof plant: water tank (havana/deco) or AC boxes (downtown). */
    if (rnd() < 0.4) {
      if (district === 'downtown') {
        box(3, 1.2, 2, std(0x6A7A8A, 0.9), bx + tw / 4, h + 1.2, bz);
        box(2, 1, 2, std(0x5A6A7A, 0.9), bx - tw / 4, h + 1.1, bz - td / 4);
      } else {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 8), std(0x8A5A3A, 0.9));
        tank.position.set(bx + tw / 4, h + 1.8, bz); tank.castShadow = true; world.add(tank);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.2, 8), std(0x5A3A2A, 0.9));
        cone.position.set(bx + tw / 4, h + 3.4, bz); world.add(cone);
      }
    }
    /* antenna + red beacon on the taller roofs (Leonida pattern). */
    if (h > 16 && rnd() < 0.6) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4 + rnd() * 3, 6), std(C.asphalt, 0.7));
      ant.position.set(bx - tw / 4, h + 2.5, bz - td / 4); world.add(ant);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({ color: C.policeRed, toneMapped: false }));
      bc.position.set(bx - tw / 4, h + 4.5, bz - td / 4); world.add(bc);
      const bg = glowSprite(C.policeRed, 3); bg.position.copy(bc.position); world.add(bg);
    }
    if (isDeco) {
      // deco parapet band + vertical neon edge strips, like the Ocean Drive hotels
      box(w + 0.6, 0.9, d + 0.6, std(tint, 0.9), bx, 3.4, bz);
      for (const ex of [-w / 2 + 0.4, w / 2 - 0.4]) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, ph - 2),
          new THREE.MeshBasicMaterial({ color: pick([C.cyan, C.magenta, C.sun]), toneMapped: false }));
        strip.position.set(bx + ex, ph / 2 + 1, bz + d / 2 + 0.08);
        world.add(strip);
      }
    }
    /* awning + door on the street-facing (-X) side: a bright sloped
       canopy over a dark doorway, so every building reads as entered. */
    const awnCol = pick([C.magenta, C.cyan, C.sun, C.teal, 0xFF6A3A, 0x2A8A5A]);
    const awn = box(1.8, 0.22, 5, toon(awnCol), bx - w / 2 - 0.9, 3.1, bz);
    awn.rotation.z = 0.35; awn.castShadow = false;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3),
      new THREE.MeshBasicMaterial({ color: C.indigo }));
    door.position.set(bx - w / 2 - 0.06, 1.5, bz); door.rotation.y = -Math.PI / 2;
    world.add(door);
    if (rnd() < (x === -120 ? 0.95 : 0.75)) {
      const signCol = pick(neonColors);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4),
        new THREE.MeshBasicMaterial({ color: signCol, toneMapped: false }));
      sign.position.set(bx, Math.min(h - 2, 14 + rnd() * 8), bz + d / 2 + 0.15);
      world.add(sign);
      const g = glowSprite(signCol, 12); g.position.copy(sign.position); g.position.z += 0.6; world.add(g);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const g2 = cv.getContext('2d');
      g2.fillStyle = '#120458'; g2.fillRect(0, 0, 256, 64);
      g2.fillStyle = '#' + signCol.toString(16).padStart(6, '0');
      g2.font = 'bold 34px Arial'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText(pick(NEON_SIGNS), 128, 34);
      const tex = new THREE.CanvasTexture(cv);
      sign.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    }
  }
}
/* v3.3 palms: a real Quaternius palm GLB (CC0, vendor/palm.glb), cloned
   with random rotation/scale/lean — the cone-leaf palms are gone from
   the main frame (kept only as palmFallback() if the GLB fails to
   load). The GLB is ~2.7 m tall, so clones scale x3 (~8 m) with
   variation. Placement lives in placePalms(), called once the GLB
   arrives (buildWorld runs before async loads finish). */
const palmTemplate = { scene: null, ready: false };
new THREE.GLTFLoader().load('vendor/palm.glb', (gltf) => {
  dullEnv(gltf.scene);
  palmTemplate.scene = gltf.scene;
  palmTemplate.ready = true;
  placePalms(); placeRocks();
  window.__PALMS_READY = true;
}, undefined, () => { placePalms(); window.__PALMS_READY = 'error'; });
function palm(x, z) {
  if (!palmTemplate.ready) return palmFallback(x, z);
  const c = palmTemplate.scene.clone();
  c.scale.setScalar(3.0 * (0.85 + rnd() * 0.4));
  c.rotation.y = rnd() * Math.PI * 2;
  c.rotation.z = (rnd() - 0.5) * 0.12;
  c.position.set(x, 0, z);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  world.add(c); return c;
}
function palmFallback(x, z) { // cone palm, load-failure fallback only
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 9, 6), std(0x8A5A3A, 0.95));
  trunk.position.y = 4.5; trunk.castShadow = true; g.add(trunk);
  const leafMat = std(0x2A8A5A, 0.9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.5, 4), leafMat);
    leaf.position.set(Math.cos(a) * 1.6, 9.2, Math.sin(a) * 1.6);
    leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
    leaf.castShadow = true; g.add(leaf);
  }
  g.position.set(x, 0, z); world.add(g); return g;
}
function placePalms() {
  /* Palms line Ocean Drive on both sides, dense (every 16 m);
     a second row stands on the sand so the beach reads from the road. */
  for (let z = -140; z <= 140; z += 16) { palm(-132, z + 4); palm(-108, z - 6); }
  for (let z = -120; z <= 120; z += 24) palm(-150 + rnd() * 6, z);
  for (let i = 0; i < 12; i++) palm(-60 + rnd() * 190, -140 + rnd() * 280);
}
/* Quaternius rock (CC0, vendor/rock.glb) scattered on the beach + pier. */
const rockTemplate = { scene: null, ready: false };
new THREE.GLTFLoader().load('vendor/rock.glb', (gltf) => {
  dullEnv(gltf.scene);
  rockTemplate.scene = gltf.scene;
  rockTemplate.ready = true;
  placeRocks();
}, undefined, () => {});
function placeRocks() {
  if (!rockTemplate.ready) return;
  const spots = [[-146, -60], [-142, 20], [-148, 90], [-140, -110], [-224, 22], [-216, 38], [-60, 130], [30, -135]];
  for (const [x, z] of spots) {
    const c = rockTemplate.scene.clone();
    c.scale.setScalar(0.8 + rnd() * 1.4);
    c.rotation.y = rnd() * Math.PI * 2;
    c.position.set(x, 0, z);
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    world.add(c);
  }
}
function buildProps() {
  /* Palms are placed by placePalms() once the GLB template loads
     (see above) — not here, so buildWorld never blocks on async loads. */
  /* Streetlights come from KayKit (see kaykitPlace below) — the v3.1
     procedural poles are the fallback if a KayKit file fails to load. */
  for (let i = 0; i < 8; i++) {
    const ux = -158 - rnd() * 6, uz = -120 + i * 34;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), toon(C.asphalt));
    pole.position.set(ux, 1.5, uz); world.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 8), toon(pick([C.magenta, C.cyan, C.sun])));
    top.position.set(ux, 3.4, uz); world.add(top);
  }
  const tower = new THREE.Group();
  box(3, 6, 3, toon(C.pastel), 0, 3, 0, tower);
  box(4, 0.6, 4, toon(C.magenta), 0, 6.2, 0, tower);
  box(4.4, 1.6, 0.4, toon(C.cyan), 0, 7, 2, tower);
  tower.position.set(-152, 0, -40); world.add(tower);
}
/* ---------- KayKit City Builder Bits props (CC0, see vendor/THIRD-PARTY.md) ----------
   Real low-poly street furniture instead of procedural cylinders: the
   streetlight (arm reaches -X over the road), bench, bush, fire
   hydrant, trash can, dumpster and roof water tower. Each model loads
   once and is CLONED per placement. KayKit units in this export are
   ~0.2 m, so scale x5 = real metres (road tile 2u = 10 m matches our
   12 m roads; bench 0.4u = 2 m; streetlight 1.0u = 5 m). Loads are
   async; the screenshot harness waits for window.__KAYKIT_READY.
   If a file fails, the streetlights fall back to procedural poles. */
const KAYKIT_MODELS = ['streetlight', 'bench', 'bush', 'firehydrant', 'trash_A', 'dumpster', 'watertower'];
const kaykit = { templates: {}, pending: KAYKIT_MODELS.length };
function kaykitPlace() {
  const T = kaykit.templates, K = 5;
  const put = (name, x, y, z, rotY) => {
    const t = T[name];
    if (!t) return null;
    const c = t.clone();
    c.scale.setScalar(K);
    c.position.set(x, y || 0, z);
    if (rotY) c.rotation.y = rotY;
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    world.add(c);
    return c;
  };
  for (const x of ROAD_X) for (let z = -140; z <= 140; z += 40) {
    if (T.streetlight) {
      put('streetlight', x + 7, 0, z, 0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshBasicMaterial({ color: C.sun, toneMapped: false }));
      bulb.position.set(x + 7 - 1.2, 4.85, z); world.add(bulb);
      const bg = glowSprite(C.sun, 4); bg.position.copy(bulb.position); world.add(bg);
    } else {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), toon(C.asphalt));
      pole.position.set(x + 7, 3.5, z); pole.castShadow = true; world.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
        new THREE.MeshBasicMaterial({ color: C.sun }));
      bulb.position.set(x + 7, 7.1, z); world.add(bulb);
    }
  }
  for (let z = -132; z <= 132; z += 24) put('bench', -134, 0, z, Math.PI / 2); // promenade benches, facing the sea
  for (let z = -120; z <= 120; z += 40) put('bench', -110, 0, z + 10, Math.PI / 2); // Ocean Drive east sidewalk
  for (let i = 0; i < 14; i++) { // bushes in the plaza gaps / block interiors
    put('bush', -60 + rnd() * 190, 0, -140 + rnd() * 280, rnd() * Math.PI);
  }
  for (let i = 0; i < 10; i++) { // hydrants + trash cans at sidewalk corners
    const x = pick(ROAD_X) + 8.5, z = pick(ROAD_Z) + 8.5;
    put('firehydrant', x, 0, z, 0);
    put('trash_A', x + 1.5, 0, z + 1.5, 0);
  }
  for (let i = 0; i < 6; i++) { // dumpsters in the alleys behind buildings
    put('dumpster', -60 + rnd() * 190, 0, -140 + rnd() * 280, rnd() * Math.PI);
  }
  let tallest = null; // water tower on the tallest Downtown roof
  for (const b of BUILDINGS) if (b.x >= 40 && (!tallest || b.h > tallest.h)) tallest = b;
  if (tallest) put('watertower', tallest.x, tallest.h, tallest.z, 0);
  window.__KAYKIT_READY = true;
}
KAYKIT_MODELS.forEach((name) => {
  new THREE.GLTFLoader().load('vendor/kaykit/' + name + '.gltf', (gltf) => {
    dullEnv(gltf.scene);
    kaykit.templates[name] = gltf.scene;
    if (--kaykit.pending === 0) kaykitPlace();
  }, undefined, () => { if (--kaykit.pending === 0) kaykitPlace(); });
});

function buildPier() {
  const plankMat = toon(0x8a6a4a);
  for (let x = -168; x >= -228; x -= 3) {
    box(2.6, 0.5, 14, plankMat, x, 0.8, 30, undefined, true);
    box(0.5, 3, 0.5, plankMat, x, -0.5, 24, undefined, true);
    box(0.5, 3, 0.5, plankMat, x, -0.5, 36, undefined, true);
  }
  const shack = new THREE.Group();
  box(8, 5, 7, toon(C.pastel), 0, 2.5, 0, shack);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 3, 4), toon(C.magenta));
  roof.position.y = 6.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true; shack.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.4), new THREE.MeshBasicMaterial({ color: C.teal }));
  door.position.set(0, 1.7, 3.55); shack.add(door);
  const sg = glowSprite(C.cyan, 10); sg.position.set(0, 3, 4.4); shack.add(sg);
  shack.position.set(-222, 1, 30); world.add(shack);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g2 = cv.getContext('2d');
  g2.fillStyle = '#120458'; g2.fillRect(0, 0, 256, 64);
  g2.fillStyle = '#FF2A6D'; g2.font = 'bold 30px Arial'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillText('SAFEHOUSE', 128, 34);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  sign.position.set(-222, 9.5, 30); sign.rotation.y = Math.PI / 2; world.add(sign);
  /* v3.2 pier: more than a flat board — railings on both edges (posts
     + top rail), warm pier lamps, crates + barrels by the shack, and
     an awning over the shack door, so the mission shot reads as a
     working pier, not a plank. */
  const railMat = std(0x6A4A3A, 0.9);
  for (let x = -168; x >= -228; x -= 6) {
    for (const rz of [23.6, 36.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), railMat);
      post.position.set(x, 1.6, rz); world.add(post);
    }
  }
  for (const rz of [23.6, 36.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(62, 0.12, 0.12), railMat);
    rail.position.set(-198, 2.15, rz); world.add(rail);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(62, 0.1, 0.1), railMat);
    rail2.position.set(-198, 1.65, rz); world.add(rail2);
  }
  for (let x = -176; x >= -224; x -= 12) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), std(C.asphalt, 0.7));
    pole.position.set(x, 2.7, 24.4); pole.castShadow = true; world.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ color: C.sun, toneMapped: false }));
    lamp.position.set(x, 4.5, 24.4); world.add(lamp);
    const lg = glowSprite(C.sun, 5); lg.position.copy(lamp.position); world.add(lg);
  }
  const crateMat = std(0xA8763A, 0.95);
  for (const [cx, cz, s] of [[-214, 26, 1.2], [-215.5, 27.5, 0.9], [-214.5, 27.8, 0.8], [-228, 34, 1.1]]) {
    const crate = box(s, s, s, crateMat, cx, 1 + s / 2, cz);
    crate.rotation.y = rnd() * 0.8;
  }
  for (const [bx2, bz2] of [[-216, 33.5], [-217.2, 32.6]]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10), std(0x3A6A8A, 0.8));
    barrel.position.set(bx2, 1.65, bz2); barrel.castShadow = true; world.add(barrel);
  }
  const awn2 = box(4.5, 0.22, 1.8, toon(C.magenta), -222, 4.4, 34.6);
  awn2.rotation.x = -0.3; awn2.castShadow = false;
}

/* v3.2: waves roll toward the beach — called from the main loop. */
function updateSea(dt) {
  const waves = window.__SEA_WAVES;
  if (!waves) return;
  for (const w of waves) {
    w.mesh.position.x += w.speed * dt;
    if (w.mesh.position.x > -CITY - 60) w.mesh.position.x = -CITY - 240;
    w.mesh.material.opacity = 0.25 + 0.15 * Math.sin(S.time * 1.3 + w.speed);
  }
}

/* ---------- vehicles & people ---------- */
const CAR_NAMES = ['SUNSET COUPE', 'BAY SEDAN', 'NEON HATCH', 'PIER PICKUP', 'TIDE TAXI', 'CORAL VAN'];
const CAR_COLORS = [C.magenta, C.cyan, C.sun, C.pink, C.teal, C.pastel, C.orange];
/* Handling profiles (tuned by feel, arcade): engine m/s^2, top m/s, turn rad/s, grip 1/s */
const PROFILES = {
  sports:  { engine: 16, brake: 34, top: 46, reverse: 16, turn: 3.1, grip: 12, gripHB: 0.7, mass: 1200 },
  sedan:   { engine: 13, brake: 34, top: 40, reverse: 16, turn: 2.7, grip: 10, gripHB: 0.7, mass: 1400 },
  compact: { engine: 12, brake: 34, top: 36, reverse: 14, turn: 3.1, grip: 11, gripHB: 0.7, mass: 1000 },
  van:     { engine: 10, brake: 30, top: 33, reverse: 12, turn: 2.1, grip: 8,  gripHB: 0.6, mass: 2400 },
  truck:   { engine: 8,  brake: 26, top: 30, reverse: 10, turn: 1.9, grip: 7,  gripHB: 0.6, mass: 4500 },
  suv:     { engine: 12, brake: 32, top: 38, reverse: 14, turn: 2.5, grip: 9,  gripHB: 0.65, mass: 1800 },
  cop:     { engine: 15, brake: 36, top: 43, reverse: 16, turn: 2.9, grip: 11, gripHB: 0.7, mass: 1700 },
};
/* v3.3 GLB cars (Kenney Car Kit, CC0 — vendor/cars/). The box car below
   is now only the PLACEHOLDER: every car is created with it so the game
   never shows a missing vehicle, then applyCarModel() swaps in the
   cloned Kenney GLB (scale 1.6, rotated π — Kenney front is +Z, game
   forward is -Z) once the templates load. Wheels come from the named
   wheel-* nodes: each is wrapped in a steering pivot (front only) and
   spun around its local X axis; the body leans on turns (stepCar).
   If a GLB fails, that car keeps its box placeholder and the game
   still runs — window.__CARS_READY is set either way. */
const CAR_PROFILES_GLB = { sports: 'sedan-sports', sedan: 'sedan', compact: 'hatchback-sports',
  van: 'van', truck: 'truck', cop: 'police', suv: 'suv' };
const carTemplates = {};
let carTemplatesPending = 0;
const carsToDress = [];
function loadCarTemplates() {
  const names = [...new Set(Object.values(CAR_PROFILES_GLB))];
  carTemplatesPending = names.length;
  for (const n of names) {
    new THREE.GLTFLoader().load('vendor/cars/' + n + '.glb', (gltf) => {
      dullEnv(gltf.scene);
      carTemplates[n] = gltf.scene;
      if (--carTemplatesPending === 0) dressAllCars();
    }, undefined, () => { if (--carTemplatesPending === 0) dressAllCars(); });
  }
}
function dressAllCars() {
  for (const car of carsToDress) applyCarModel(car);
  window.__CARS_READY = true;
}
function applyCarModel(car) {
  const u = car.userData;
  if (u.dressed) return;
  const tpl = carTemplates[CAR_PROFILES_GLB[u.profileId]];
  if (!tpl) return; // keep the box placeholder
  const model = tpl.clone();
  model.scale.setScalar(1.6);
  model.rotation.y = Math.PI;
  const bodyGroup = new THREE.Group();
  bodyGroup.add(model);
  const wheelNodes = [];
  model.traverse((o) => { if (o.name && o.name.indexOf('wheel-') === 0) wheelNodes.push(o); });
  const spin = [], pivots = [];
  for (const node of wheelNodes) {
    const pivot = new THREE.Group();
    pivot.position.copy(node.position);
    pivot.rotation.copy(node.rotation);
    node.position.set(0, 0, 0); node.rotation.set(0, 0, 0);
    const parent = node.parent;
    parent.remove(node); pivot.add(node); parent.add(pivot);
    spin.push(node);
    if (node.name.indexOf('wheel-front-') === 0) pivots.push(pivot);
  }
  if (u.placeholder) { car.remove(u.placeholder); u.placeholder = null; }
  car.add(bodyGroup);
  u.wheels = spin; u.wheelPivots = pivots;
  u.wheelSpinSign = -1; u.wheelRadius = 0.48; u.steerSign = -1; // model rotated π
  u.bodyGroup = bodyGroup; u.dressed = true;
}
function makeCar(color, isPolice, name, profileId) {
  const g = new THREE.Group();
  const pid = profileId || (isPolice ? 'cop' : 'sedan');
  const ph = new THREE.Group(); // box placeholder (swapped out by applyCarModel)
  const bodyMat = toon(isPolice ? 0x2a2a4a : color);
  const body = box(2.1, 0.75, 4.6, bodyMat, 0, 0.75, 0, ph);
  addOutline(body, C.asphalt, 1.05);
  const cabin = box(1.8, 0.65, 2.2, toon(isPolice ? 0x3a3a5a : color), 0, 1.4, -0.2, ph);
  const glass = box(1.84, 0.5, 2.24, new THREE.MeshBasicMaterial({ color: C.indigo }), 0, 1.42, -0.2, ph);
  glass.castShadow = false;
  const wheelMat = toon(C.asphalt);
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); w.castShadow = true; ph.add(w); wheels.push(w);
  }
  g.add(ph);
  const hl = new THREE.MeshBasicMaterial({ color: C.sun });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), hl);
    h.position.set(hx, 0.8, -2.32); g.add(h); // front = local -Z (car forward)
    const gl = glowSprite(C.sun, 2.2); gl.position.set(hx, 0.8, -2.5); g.add(gl);
  }
  const tl = new THREE.MeshBasicMaterial({ color: C.magenta });
  for (const hx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tl);
    t.position.set(hx, 0.85, 2.32); g.add(t); // rear = local +Z
  }
  let lightbar = null;
  if (isPolice) {
    lightbar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: C.policeRed }));
    r.position.x = -0.4; lightbar.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: C.policeBlue }));
    b.position.x = 0.4; lightbar.add(b);
    const rg = glowSprite(C.policeRed, 3); rg.position.set(-0.4, 0.3, 0); lightbar.add(rg);
    const bg = glowSprite(C.policeBlue, 3); bg.position.set(0.4, 0.3, 0); lightbar.add(bg);
    lightbar.position.set(0, 1.85, -0.2); g.add(lightbar);
    lightbar.userData = { r, b, rg, bg };
  }
  g.userData = { wheels, wheelPivots: [wheels[0], wheels[1]], wheelSpinSign: 1, wheelRadius: 0.42,
    steerSign: 1, bodyGroup: ph, placeholder: ph, dressed: false, profileId: pid,
    lightbar, name: name || pick(CAR_NAMES), color, isPolice,
    speed: 0, yaw: 0, health: 100, vx: 0, vz: 0, yawRate: 0,
    profile: PROFILES[pid] };
  scene.add(g);
  carsToDress.push(g);
  if (window.__CARS_READY) applyCarModel(g); // car created after templates loaded
  return g;
}
loadCarTemplates();
/* Slim procedural humanoid v3.1 (NOT a Roblox box) — used for the
   background pedestrians and foot cops. (Mateo himself is the rigged
   GLB now — see makeMateo below.) Narrow shoulders (~0.42 m), tapered
   cylinder torso, slim two-segment cylinder limbs (thigh + shin with a
   working knee, upper + forearm with a bent elbow), small proportional
   head (r 0.145) with dark hair cap, total ~1.85 m. Animation follows
   the openvice Player.cpp pattern (IDLE_STANCE / walk_player /
   run_player / SPRINT_civi, walk speed 2.25 m/s, ~0.3 s crossfade
   blend, bob + forward lean at a run), translated to JS: thigh swing
   drives the stride, the shin counter-bends at the knee, arms
   counter-swing the legs — see sim.js updateFoot/updatePeds. */
function seg(rTop, rBot, len, mat, parent, px, py, pz) {
  const pivot = new THREE.Group();
  pivot.position.set(px, py, pz);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 8), mat);
  m.position.y = -len / 2; m.castShadow = true;
  pivot.add(m); parent.add(pivot);
  return pivot;
}
function makePerson(jacket, pants) {
  const g = new THREE.Group();
  const jacketMat = toon(jacket), pantsMat = toon(pants || C.indigo);
  const skinMat = toon(0xC98a5a);
  // torso: slim tapered cylinder, not a box — narrow shoulders
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.58, 10), jacketMat);
  torso.position.y = 1.22; torso.castShadow = true; g.add(torso);
  // white tee peeking under the open jacket
  const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.13, 0.42, 8), toon(C.cream));
  tee.position.set(0, 1.2, 0.045); g.add(tee);
  // bomber collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.185, 0.09, 10), toon(0x8A4A00));
  collar.position.y = 1.52; g.add(collar);
  // head: proportional, with dark hair cap (top/back only, face stays skin)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), skinMat);
  head.position.y = 1.70; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10, 0, Math.PI * 2, 0, 1.9), toon(0x1F1A16));
  hair.position.y = 1.715; hair.scale.set(1, 0.9, 1); g.add(hair);
  // long legs: thigh pivot at the hip (y 0.88), shin pivot at the knee
  const legL = seg(0.075, 0.062, 0.45, pantsMat, g, -0.09, 0.88, 0);
  const shinL = seg(0.062, 0.05, 0.42, pantsMat, legL, 0, -0.45, 0);
  const legR = seg(0.075, 0.062, 0.45, pantsMat, g, 0.09, 0.88, 0);
  const shinR = seg(0.062, 0.05, 0.42, pantsMat, legR, 0, -0.45, 0);
  // slim arms: upper pivot at the shoulder (y 1.48, ±0.21 — narrow),
  // forearm pivot at the elbow, slight permanent bend
  const armL = seg(0.052, 0.045, 0.32, jacketMat, g, -0.21, 1.48, 0);
  const foreL = seg(0.045, 0.038, 0.30, jacketMat, armL, 0, -0.32, 0);
  const armR = seg(0.052, 0.045, 0.32, jacketMat, g, 0.21, 1.48, 0);
  const foreR = seg(0.045, 0.038, 0.30, jacketMat, armR, 0, -0.32, 0);
  // hands
  for (const a of [foreL, foreR]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinMat);
    h.position.y = -0.32; a.add(h);
  }
  g.userData = { legL, legR, shinL, shinR, armL, armR, foreL, foreR,
    torso, head, walkPhase: rnd() * 6, swing: 0, bobY: 0 };
  scene.add(g);
  return g;
}
/* Mateo Vega — REALISTIC MPFB2 CIVILIAN (v3.3, vendor/mateo.glb).
   Replaces the v3.2 Xbot mannequin + vertex-paint jacket: a MakeHuman
   (MPFB2, GPL-3.0 code, CC0 system assets) male, muscle 0.6, weight
   0.4, ~1.80 m, textured skin, with REAL clothing geometry — a
   burnt-orange bomber jacket shell, white tee shell, dark jeans shell
   and white sneakers, all separate skinned meshes, so the jacket
   reads from the BACK as material, not paint. Short dark crop hair +
   brown eyes are MPFB assets; the thin beard is a procedural mesh on
   the Head bone (MPFB ships no facial hair). Mixamo rig
   (mixamorig:*), so the Xbot idle/walk/run clips transfer verbatim,
   plus authored aim/fire clips. All clips crossfade 0.3 s (the
   openvice Player.cpp pattern: IDLE_STANCE / walk_player /
   run_player / SPRINT_civi, walk speed 2.25 m/s, bob + lean at a
   run). See game/MATEO-MODEL.md. Loads async; the street screenshot
   waits for window.__MATEO_GLB. */
function mateoPlayClip(name, rate) {
  const mt = playerMesh.userData.mateo;
  if (!mt || !mt.ready) return;
  const next = mt.actions[name];
  if (!next) return;
  if (mt.currentAction) mt.currentAction.fadeOut(0.3);
  next.reset().setEffectiveTimeScale(rate || 1).setEffectiveWeight(1).fadeIn(0.3).play();
  mt.current = name; mt.currentAction = next; mt.timeScale = rate || 1;
}
/* San Andreas Unity pattern (BaseMovementState): the STATE picks the clip,
   the clip's authored speed moves the ped (Ped.cs:560-576, root motion).
   `ts` is the clip playback rate — SPRINT runs the Run clip at 1.35x. */
function mateoSetSpeed(sp, ts) {
  const mt = playerMesh.userData.mateo;
  if (!mt || !mt.ready) return;
  if (S.aiming) { mateoAim(); return; } // the aim pose owns the mixer while aiming
  const name = sp < 0.3 ? 'idle' : sp > 6 ? 'run' : 'walk';
  const rate = ts || 1;
  if (mt.current === name && Math.abs((mt.timeScale || 1) - rate) < 0.01) return;
  mateoPlayClip(name, rate);
}
function mateoAim() {
  const mt = playerMesh.userData.mateo;
  if (!mt || !mt.ready || mt.current === 'aim') return;
  mateoPlayClip('aim');
}
function mateoFire() {
  const mt = playerMesh.userData.mateo;
  if (!mt || !mt.ready) return;
  mateoPlayClip('fire');
  setTimeout(() => { if (S.aiming) mateoAim(); else mateoSetSpeed(0); }, 450);
}
function mateoUpdate(dt) {
  const mt = playerMesh.userData.mateo;
  if (mt && mt.ready) mt.mixer.update(dt);
}
function makeMateo() {
  const g = new THREE.Group();
  const root = new THREE.Group(); // bob + run lean live here; facing lives on g
  g.add(root); // v3.3: no slimming scale — Mateo is 1.80 m at realistic proportions
  const mt = { root, mixer: null, actions: {}, current: '', currentAction: null, ready: false,
    pistol: null, muzzleSprite: null };
  g.userData = { mateo: mt, walkPhase: 0, swing: 0, torso: root, head: root,
    legL: root, legR: root, armL: root, armR: root, shinL: root, shinR: root, foreL: root, foreR: root };
  new THREE.GLTFLoader().load('vendor/mateo.glb', (gltf) => {
    const model = gltf.scene;
    model.rotation.y = Math.PI; // MPFB exports facing +Z; the game's forward is -Z
    dullEnv(model); // the HDRI traverse ran before this GLB arrived
    /* v3.3.1: the shells are matte fabric — the sunset HDRI's sun disc
       reflects off the jacket's curved back as vertical white streaks
       (found 18 Nov 2026, debug-lights: stripes survive sun-off, die
       with env-off). v3.3's 0.15 did NOT remove them, so the shells'
       env is now 0 (lit by the sun + hemisphere only). And the shoes:
       the shoes04 texture is nearly black (only 0.2% of pixels >200),
       so the "white sneakers" rendered dark — drop the map so the
       off-white baseColorFactor (#f5f2ed) renders as white sneakers. */
    model.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.material.name && o.material.name.startsWith('Mateo')) o.material.envMapIntensity = 0;
      if (o.material.name === 'Human.shoes04') { o.material.map = null; o.material.needsUpdate = true; }
    });
    root.add(model);
    /* Thin beard only: the short01 crop hair is already in the GLB
       (MPFB asset); MPFB ships no facial hair. Bone-local frame in
       the Mixamo bind pose: +Y up toward the crown, +Z out of the face. */
    /* Bone lookup is colon-tolerant: the GLB file names the bones
       'mixamorig:RightHand', but the loaded THREE.Bone objects are named
       'mixamorigRightHand' (the colon is stripped on load — found
       18 Nov 2026, debug-bone2). The exact-name lookup silently returned
       null, so loadPistol never ran and Mateo had no pistol (and no
       beard). Match with colons stripped on both sides. */
    const findBone = (name) => {
      const want = name.replace(/:/g, '');
      let found = null;
      model.traverse((o) => { if (!found && o.name && o.name.replace(/:/g, '') === want) found = o; });
      return found;
    };
    const headBone = findBone('mixamorig:Head');
    if (headBone) {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), toon(0x2A2018));
      beard.position.set(0, 0.005, 0.07); beard.scale.set(1, 0.5, 0.45);
      headBone.add(beard);
    }
    const handBone = findBone('mixamorig:RightHand');
    if (handBone) loadPistol(handBone, mt);
    const mixer = new THREE.AnimationMixer(model);
    const byName = (re) => gltf.animations.find((a) => re.test(a.name));
    mt.mixer = mixer;
    mt.actions = {
      idle: byName(/^idle$/i) ? mixer.clipAction(byName(/^idle$/i)) : null,
      walk: byName(/^walk$/i) ? mixer.clipAction(byName(/^walk$/i)) : null,
      run: byName(/^run$/i) ? mixer.clipAction(byName(/^run$/i)) : null,
      aim: byName(/^aim$/i) ? mixer.clipAction(byName(/^aim$/i)) : null,
      fire: byName(/^fire$/i) ? mixer.clipAction(byName(/^fire$/i)) : null,
    };
    mt.ready = true;
    window.__MATEO_GLB = true;
    mateoSetSpeed(0);
  }, undefined, () => { window.__MATEO_GLB = 'error'; });
  scene.add(g);
  return g;
}
/* Pistol (Quaternius P226, CC0, vendor/pistol.glb) parented to the
   RightHand bone — fpp-tpp-shooter-starter pattern: the weapon is a
   child of rightHand, the aim clip rotates the spine. The GLB's raw
   units are ~8x real size behind a 100x node scale, so the mesh is
   normalised by bounding box to a 0.28 m barrel and re-centred on
   its middle; the barrel is aligned to the hand bone's +Y (the
   forearm direction when the wrist is straight). */
function loadPistol(handBone, mt) {
  new THREE.GLTFLoader().load('vendor/pistol.glb', (gltf) => {
    const raw = gltf.scene;
    const bb = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3(); bb.getSize(size);
    const center = new THREE.Vector3(); bb.getCenter(center);
    const s = 0.28 / Math.max(size.x, size.y, size.z);
    const inner = new THREE.Group();
    inner.add(raw);
    raw.position.set(-center.x, -center.y, -center.z); // centre the mesh on the grip
    inner.scale.setScalar(s);
    inner.rotation.set(0, 0, Math.PI / 2); // barrel (raw long axis X) -> hand +Y
    const grip = new THREE.Group();
    grip.add(inner);
    grip.position.set(0, -0.02, 0.01);
    handBone.add(grip);
    mt.pistol = grip;
    // lighten the gunmetal so the pistol reads against the dark road at
    // dusk (the stock P226 materials are near-black #28292a/#414241 and
    // vanish in the mission shot). Two-tone: light slide, darker grip.
    // A small emissive lifts the camera-facing shadow side (the barrel
    // points away from the camera, so the visible side is unlit), and
    // 1.15x scale makes the 0.28 m pistol read at 2.4 m.
    raw.traverse((o) => {
      if (o.isMesh && o.material && o.material.color) {
        const c = o.material.color.getHex();
        o.material.color.setHex(c === 0x28292a ? 0x555555 : 0x8f8f8f);
        o.material.emissive = new THREE.Color(0x2a2a2a);
      }
    });
    grip.scale.setScalar(1.15);
    // muzzle flash: a glow sprite at the barrel tip + the shared muzzle light
    const tip = new THREE.Group();
    tip.position.set(0, 0.16, 0); // just past the 0.28 m barrel tip
    grip.add(tip);
    const flash = glowSprite(C.sun, 0.9);
    flash.visible = false;
    tip.add(flash);
    mt.muzzleSprite = flash;
    tip.add(muzzle); // the PointLight now rides the barrel tip, not the camera
    dullEnv(raw);
    // staged mission shot: hold the muzzle glow lit without firing a live
    // round (the old setTimeout(shoot) in main.js killed a ped and raised
    // wanted 1 -> 2, which sent the police cars swarming the camera).
    if (S.missionGlow) { flash.visible = true; muzzle.intensity = 6; }
    window.__PISTOL_READY = true;
  }, undefined, () => { window.__PISTOL_READY = 'error'; });
}

/* ---------- entities ---------- */
buildWorld();
const playerMesh = makeMateo(); // Mateo Vega — realistic MPFB2 civilian, orange bomber, white sneakers
playerMesh.position.set(-118, 0, 20);
const playerCar = makeCar(0xD1003F, false, 'SCARLET ARROW', 'sports'); // deep crimson-magenta (v3.1: C.magenta washed to pale pink under the bright sun)
playerCar.position.set(-104, 0, -24); playerCar.rotation.y = Math.PI / 2;
playerCar.userData.health = 100;
const traffic = [];
for (let i = 0; i < 18; i++) {
  const prof = pick(['sedan', 'sedan', 'compact', 'van', 'truck', 'suv']);
  const car = makeCar(pick(CAR_COLORS), false, undefined, prof);
  const vertical = rnd() < 0.5;
  const road = pick(vertical ? ROAD_X : ROAD_Z);
  car.userData.vertical = vertical; car.userData.road = road;
  car.userData.along = -CITY + rnd() * CITY * 2;
  car.userData.dir = rnd() < 0.5 ? 1 : -1;
  car.userData.cruise = 7 + rnd() * 6;
  car.userData.speed = car.userData.cruise;
  car.userData.turnDecided = false;
  traffic.push(car);
}
const peds = [];
const PED_COLORS = [C.cyan, C.pink, C.sun, C.teal, C.pastel, C.magenta];
for (let i = 0; i < 28; i++) {
  const p = makePerson(pick(PED_COLORS), pick([C.indigo, C.asphalt, C.sea]));
  p.userData.vertical = rnd() < 0.5;
  p.userData.road = pick(p.userData.vertical ? ROAD_X : ROAD_Z);
  p.userData.along = -CITY + rnd() * CITY * 2;
  p.userData.dir = rnd() < 0.5 ? 1 : -1;
  p.userData.speed = 1.2 + rnd() * 1.4;
  p.userData.side = rnd() < 0.5 ? 8.5 : -8.5;
  p.userData.state = 'walk'; p.userData.timer = 0;
  peds.push(p);
}
const police = [];
for (let i = 0; i < 5; i++) {
  const pc = makeCar(0, true, 'UNIT P-' + String(3 + i * 4).padStart(2, '0'), 'cop');
  pc.visible = false; pc.position.set(200, -50, 200);
  pc.userData.status = 'PATROL'; pc.userData.ramTimer = 0;
  pc.userData.speed = 0;
  /* police[0..1] = patrol units: always on the road, lane-following like
     traffic; they only join a pursuit at wanted >= 2.
     police[2..4] = pursuit reinforcements, spawned in at wanted >= 2. */
  pc.userData.patrol = i < 2;
  pc.userData.vertical = false; pc.userData.road = 0; pc.userData.along = 0;
  pc.userData.dir = 1; pc.userData.cruise = 9 + rnd() * 3; pc.userData.turnDecided = false;
  police.push(pc);
}
/* Foot cops (Vice City rules): navy uniform, cap. Pool of 3, spawned in
   28–42 m from the player at wanted >= 1 (max 1/2/3 by wanted level). */
const copPeds = [];
for (let i = 0; i < 3; i++) {
  const cp = makePerson(0x2A3A6E, 0x1F2A4A);
  // police cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), toon(0x1F2A4A));
  cap.position.y = 1.84; cp.add(cap);
  const badge = box(0.1, 0.12, 0.03, toon(C.sun), -0.14, 1.42, 0.17, cp);
  badge.castShadow = false;
  cp.visible = false; cp.position.set(200, -50, 200);
  cp.userData.isCop = true; cp.userData.status = 'PATROL';
  cp.userData.closeT = 0; cp.userData.attackCd = 0; cp.userData.aimT = 0;
  cp.userData.speed = 0; cp.userData.dist = 999;
  copPeds.push(cp);
}
/* helicopter — built by a factory so the 5★ second heli is identical.
   Shaped to read as a heli from below: slate-blue body, glass nose,
   tail boom + fin, skids, and a translucent rotor disc (reads from any
   angle, unlike a single edge-on blade box). */
function makeHeli() {
  const h = new THREE.Group();
  const bodyMat = toon(0x5A6A9A);
  box(2.6, 1.5, 4.2, bodyMat, 0, 0, 0.4, h);
  box(1.7, 1.0, 1.4, new THREE.MeshBasicMaterial({ color: C.indigo }), 0, 0.15, 2.4, h); // glass nose
  box(2.7, 0.35, 4.3, toon(C.sun), 0, -0.45, 0.4, h); // belly stripe
  const rotor = new THREE.Group();
  const bladeMat = toon(C.asphalt);
  box(8.6, 0.1, 0.45, bladeMat, 0, 0, 0, rotor);
  box(0.45, 0.1, 8.6, bladeMat, 0, 0, 0, rotor);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24),
    new THREE.MeshBasicMaterial({ color: 0x8A9AC8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; rotor.add(disc);
  rotor.position.y = 1.15; h.add(rotor);
  box(0.5, 0.5, 4.2, bodyMat, 0, 0.35, -3.6, h); // tail boom
  box(0.18, 1.6, 1.0, toon(C.policeRed), 0, 0.8, -5.4, h); // tail fin
  const skidMat = toon(C.asphalt);
  for (const sx of [-1.1, 1.1]) {
    box(0.12, 0.12, 3.4, skidMat, sx, -1.05, 0.4, h);
    box(0.1, 0.5, 0.1, skidMat, sx, -0.8, 1.4, h);
    box(0.1, 0.5, 0.1, skidMat, sx, -0.8, -0.6, h);
  }
  const lb = new THREE.Group();
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: C.policeRed }));
  r.position.x = -0.5; lb.add(r);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: C.policeBlue }));
  b.position.x = 0.5; lb.add(b);
  lb.position.y = -0.9; h.add(lb);
  h.userData = { rotor, lightbar: lb, angle: 0, orbitR: 40, height: 20 };
  const spot = new THREE.SpotLight(0xFFF2C9, 3.5, 90, 0.28, 0.5);
  spot.position.set(0, -0.5, 0); h.add(spot);
  h.userData.spot = spot;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xFFF2C9, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = -17; cone.rotation.x = Math.PI; h.add(cone);
  h.visible = false; scene.add(h);
  return h;
}
const heli = makeHeli();
const heli2 = makeHeli(); // second heli, wanted >= 5 only
/* mission beacon */
const beacon = new THREE.Group();
const beaconCyl = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 30, 16, 1, true),
  new THREE.MeshBasicMaterial({ color: C.sun, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
beaconCyl.position.y = 15; beacon.add(beaconCyl);
const beaconGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
  new THREE.MeshBasicMaterial({ color: C.sun }));
beaconGem.position.y = 8; beacon.add(beaconGem);
const beaconGlow = glowSprite(C.sun, 16); beaconGlow.position.y = 8; beacon.add(beaconGlow);
scene.add(beacon);

/* ---------- viewmodel gun (attached to camera — never floating) ----------
   v3.3: visible ONLY while aiming (see sim.js updateHUD) — third-person
   play shows the pistol in Mateo's hand instead. */
const viewmodel = new THREE.Group();
(function buildGun() {
  const gunMat = toon(C.pastel), gripMat = toon(C.orange);
  const barrel = box(0.07, 0.08, 0.5, gunMat, 0, 0, -0.28, viewmodel);
  const slide = box(0.08, 0.06, 0.36, toon(C.magenta), 0, 0.04, -0.2, viewmodel);
  const grip = box(0.07, 0.22, 0.11, gripMat, 0, -0.13, 0.02, viewmodel);
  grip.rotation.x = 0.25;
  const sight = box(0.02, 0.05, 0.02, toon(C.cyan), 0, 0.09, -0.4, viewmodel);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), toon(0xC98a5a));
  hand.position.set(0, -0.1, 0.04); viewmodel.add(hand);
  viewmodel.position.set(0.27, -0.24, -0.7);
  viewmodel.scale.setScalar(0.6);
  viewmodel.rotation.y = -0.06;
  viewmodel.visible = false;
  camera.add(viewmodel);
})();
scene.add(camera);
/* muzzle flash — v3.3: the PointLight rides the pistol barrel tip
   (added to the tip group in loadPistol); the camera no longer
   carries it, so third-person shots show the flash at the gun. */
const muzzle = new THREE.PointLight(C.sun, 0, 18);
