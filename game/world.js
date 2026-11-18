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
renderer.toneMappingExposure = 1.35;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
/* Golden-hour sky dome: vertical gradient indigo -> magenta -> orange -> sun
   (locked palette; no pure white/black). Rendered on a big backside sphere
   so the horizon always glows like the concept mockups. */
(function buildSky() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0.00, '#120458'); gr.addColorStop(0.38, '#5A1A6E');
  gr.addColorStop(0.58, '#FF2A6D'); gr.addColorStop(0.74, '#FF9900');
  gr.addColorStop(0.88, '#FFB347'); gr.addColorStop(1.00, '#E8D9A0');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(760, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  scene.background = new THREE.Color(C.indigo);
})();
scene.fog = new THREE.Fog(0xE89A6A, 150, 520);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1600);
camera.position.set(-110, 6, 40);

/* Low golden-hour sun: long shadows, warm key light. (v3.1: sun 2.6 +
   hemisphere 1.55 washed every sun-facing surface to near-white —
   the Scarlet Arrow read pale pink, Mateo's orange jacket read beige.) */
const sunLight = new THREE.DirectionalLight(0xFFC46B, 1.6);
sunLight.position.set(-260, 70, -80);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
sunLight.shadow.camera.far = 600;
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(0xC9A8E8, 0x8A5A3A, 1.0));
/* Warm bounce so shadowed faces never go black. */
scene.add(new THREE.AmbientLight(0x8A5A6A, 0.35));

/* 3-step toon gradient map */
const gradData = new Uint8Array([90, 160, 255, 255]);
const gradTex = new THREE.DataTexture(gradData, 4, 1, THREE.RedFormat);
gradTex.minFilter = THREE.NearestFilter; gradTex.magFilter = THREE.NearestFilter;
gradTex.needsUpdate = true;
function toon(color, opts) {
  return new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: gradTex }, opts || {}));
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 60, CITY * 2 + 60), toon(0x8A5A48));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, CITY * 2 + 60), toon(C.pastel));
  beach.rotation.x = -Math.PI / 2; beach.position.set(-CITY - 38, 0.05, 0); beach.receiveShadow = true; world.add(beach);
  /* Ocean Drive sand promenade (v3.1): the beach used to sit 45 m from the
     road behind dark ground. A sand strip now joins Ocean Drive (x=-120)
     to the beach, so the chase/street shots read as a beachfront boulevard
     — sea on one side, art-deco hotels on the other. */
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, CITY * 2 + 60), toon(0xE8C9A0));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-CITY + 4.5, 0.04, 0); sand.receiveShadow = true; world.add(sand);
  /* Wide pale promenade sidewalk on the sea side of Ocean Drive. */
  const prom = new THREE.Mesh(new THREE.PlaneGeometry(10, CITY * 2), toon(0xD8A080));
  prom.rotation.x = -Math.PI / 2; prom.position.set(-131, 0.06, 0); prom.receiveShadow = true; world.add(prom);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, CITY * 2 + 400), toon(C.sea));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-CITY - 190, -0.4, 0); world.add(sea);
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(180, 1.2), new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.35 }));
    s.rotation.x = -Math.PI / 2; s.position.set(-CITY - 120 - rnd() * 120, -0.2, -180 + i * 40 + rnd() * 10); world.add(s);
  }
  const dashCv = document.createElement('canvas'); dashCv.width = 16; dashCv.height = 64;
  const dg = dashCv.getContext('2d');
  dg.clearRect(0, 0, 16, 64);
  dg.fillStyle = '#FFB347'; dg.fillRect(6, 6, 4, 34);
  const dashTex = new THREE.CanvasTexture(dashCv);
  dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping;
  const roadMat = toon(0x6B4A3C);
  const walkMat = toon(0xC99A70); // sidewalks: warm sand-tan so streets read at golden hour
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
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: C.sun, fog: false }));
  sunDisc.position.set(-260, 30, 160); sunDisc.lookAt(0, 20, 0); world.add(sunDisc);
  const sunGlow = glowSprite(C.sun, 150); sunGlow.position.set(-252, 32, 158); world.add(sunGlow);
  const cloudMat = toon(C.pink);
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) box(14 + rnd() * 16, 3 + rnd() * 3, 8, cloudMat, j * 10 - n * 5, 0, rnd() * 4 - 2, cl, true);
    cl.position.set(-260 + rnd() * 480, 70 + rnd() * 40, -220 + rnd() * 380);
    world.add(cl);
  }
  buildBuildings(); buildProps(); buildPier();
}
const NEON_SIGNS = ['NOODLES 24h', 'ARCADE', 'TACOS', 'MART', 'HOTEL BAY', 'NEON ROW', 'PIER BAR', 'SURF SHOP', 'KIRA FM', 'SUNSET MOTEL', 'OCEAN DR', 'DECO HOTEL', 'BAR — OPEN', 'PALM COURT'];
/* Art-deco pastel row (v3.1, Ocean Drive direction): pink / teal / yellow /
   mint / coral / lavender — saturated pastels, never dominant white. The
   row facing the beach (road x=-120, buildings bx≈-96) is always deco. */
const DECO_COLORS = [0xFF9CDA, 0x7FE3D0, 0xFFD166, 0xFF8A7A, 0xC9A8E8, 0x05D9E8, 0xFFB347];
const BUILDING_COLORS = [0xFF9CDA, 0x7FE3D0, 0xFFD166, 0xFF8A7A, 0xC9A8E8, 0x05D9E8, 0xFFB347, 0xFF2A6D];
function buildBuildings() {
  const neonColors = [C.magenta, C.cyan, C.sun, C.pink, C.teal];
  for (const x of ROAD_X) for (const z of ROAD_Z) {
    if (Math.abs(x) > 130 || Math.abs(z) > 130) continue;
    const bx = x + 24 + rnd() * 4, bz = z + 24 + rnd() * 4;
    if (bx < -135 || bx > 140 || bz < -140 || bz > 140) continue;
    if (rnd() < 0.22 && x !== -120) continue; // plaza gaps (never on Ocean Drive)
    const isDeco = x === -120; // the beachfront hotel row: low-rise art deco, always present
    const w = 14 + rnd() * 8, d = 14 + rnd() * 8, h = isDeco ? 8 + rnd() * 10 : 10 + rnd() * 34;
    const col = isDeco ? pick(DECO_COLORS) : pick(BUILDING_COLORS);
    const b = box(w, h, d, toon(col), bx, h / 2, bz);
    b.castShadow = true;
    BUILDINGS.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h });
    box(w + 1, 0.8, d + 1, toon(isDeco ? C.sun : C.magenta), bx, h + 0.4, bz);
    if (isDeco) {
      // deco parapet band + vertical neon edge strips, like the Ocean Drive hotels
      box(w + 0.6, 0.9, d + 0.6, toon(pick(DECO_COLORS)), bx, 3.4, bz);
      for (const ex of [-w / 2 + 0.4, w / 2 - 0.4]) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, h - 4),
          new THREE.MeshBasicMaterial({ color: pick([C.cyan, C.magenta, C.sun]) }));
        strip.position.set(bx + ex, h / 2 + 1, bz + d / 2 + 0.08);
        world.add(strip);
      }
    }
    const winMat = new THREE.MeshBasicMaterial({ color: rnd() < 0.5 ? C.sun : C.cyan });
    const rows = Math.floor(h / 5), cols = Math.floor(w / 4);
    let placed = 0;
    for (let r = 0; r < rows && placed < 10; r++) for (let c = 0; c < cols && placed < 10; c++) {
      if (rnd() < 0.55) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2),
        rnd() < 0.75 ? winMat : new THREE.MeshBasicMaterial({ color: C.indigo }));
      win.position.set(bx - w / 2 + 2 + c * 4, 3 + r * 5, bz + d / 2 + 0.06);
      world.add(win); placed++;
    }
    if (rnd() < (x === -120 ? 0.95 : 0.75)) {
      const signCol = pick(neonColors);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4),
        new THREE.MeshBasicMaterial({ color: signCol }));
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
      sign.material = new THREE.MeshBasicMaterial({ map: tex });
    }
  }
}
function palm(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), toon(0x8a5a3a));
  trunk.position.y = 4.5; trunk.rotation.z = 0.12; trunk.castShadow = true; g.add(trunk);
  const leafMat = toon(0x2a8a5a);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.5, 4), leafMat);
    leaf.position.set(Math.cos(i) * 1.6, 9.2, Math.sin(i) * 1.6);
    leaf.rotation.z = Math.cos(i) * 1.1; leaf.rotation.x = -Math.sin(i) * 1.1;
    g.add(leaf);
  }
  g.position.set(x, 0, z); world.add(g); return g;
}
function buildProps() {
  /* Palms line Ocean Drive on both sides, dense (v3.1: every 16 m, was 22);
     a second row stands on the sand so the beach reads from the road. */
  for (let z = -140; z <= 140; z += 16) { palm(-132, z + 4); palm(-108, z - 6); }
  for (let z = -120; z <= 120; z += 24) palm(-150 + rnd() * 6, z);
  for (let i = 0; i < 12; i++) palm(-60 + rnd() * 190, -140 + rnd() * 280);
  const lampMat = toon(C.asphalt);
  for (const x of ROAD_X) for (let z = -140; z <= 140; z += 40) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), lampMat);
    pole.position.set(x + 7, 3.5, z); pole.castShadow = true; world.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
      new THREE.MeshBasicMaterial({ color: C.sun }));
    bulb.position.set(x + 7, 7.1, z); world.add(bulb);
  }
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
  cop:     { engine: 15, brake: 36, top: 43, reverse: 16, turn: 2.9, grip: 11, gripHB: 0.7, mass: 1700 },
};
function makeCar(color, isPolice, name, profileId) {
  const g = new THREE.Group();
  const bodyMat = toon(isPolice ? 0x2a2a4a : color);
  const body = box(2.1, 0.75, 4.6, bodyMat, 0, 0.75, 0, g);
  addOutline(body, C.asphalt, 1.05);
  const cabin = box(1.8, 0.65, 2.2, toon(isPolice ? 0x3a3a5a : color), 0, 1.4, -0.2, g);
  const glass = box(1.84, 0.5, 2.24, new THREE.MeshBasicMaterial({ color: C.indigo }), 0, 1.42, -0.2, g);
  glass.castShadow = false;
  const wheelMat = toon(C.asphalt);
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); w.castShadow = true; g.add(w); wheels.push(w);
  }
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
  g.userData = { wheels, lightbar, name: name || pick(CAR_NAMES), color, isPolice,
    speed: 0, yaw: 0, health: 100, vx: 0, vz: 0, yawRate: 0,
    profile: PROFILES[profileId || (isPolice ? 'cop' : 'sedan')] };
  scene.add(g);
  return g;
}
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
/* Mateo Vega — RIGGED MIT GLB (v3.1, vendor/Soldier.glb, Three.js
   examples, MIT — see vendor/THIRD-PARTY.md). Loaded via GLTFLoader +
   AnimationMixer with 0.3 s crossfades Idle↔Walk↔Run, the openvice
   Player.cpp pattern (IDLE_STANCE / walk_player / run_player /
   SPRINT_civi, walk speed 2.25 m/s, blend ~0.3 s, bob + lean at a run).
   The GLB is a single-material skinned mesh, so per-part colours come
   from VERTEX COLOURS: each vertex is classified in the model's local
   bind-pose space (Z-up, 0..183, face +Y) — orange bomber jacket,
   white tee strip on the front chest, dark jeans, white sneakers,
   skin hands + face, dark hair. (A repainted texture was tried first:
   the UV atlas overlaps islands, so boot/tee colours bled onto the
   thighs; vertex colours land exactly.) The visor mesh is hidden.
   Slim proportions: wrapper scale (0.88, 1, 0.9). Loads async; the
   street screenshot waits for window.__MATEO_GLB === true. */
function mateoClassify(cx, cy, cz) {
  if (Math.abs(cx) > 55) return [201 / 255, 138 / 255, 90 / 255]; // hands -> skin
  if (cz < 10) return [244 / 255, 236 / 255, 223 / 255]; // boots -> white sneakers
  if (cz < 88) return [35 / 255, 35 / 255, 58 / 255]; // legs -> dark jeans
  if (cz >= 155) return cy > 4 ? [201 / 255, 138 / 255, 90 / 255] : [31 / 255, 26 / 255, 22 / 255]; // face / hair
  if (Math.abs(cx) > 24) return [185 / 255, 62 / 255, 12 / 255]; // sleeves -> deep burnt orange (v3.1: the lighter orange washed to tan under the sunset sun)
  if (cy > 0 && Math.abs(cx) < 8 && cz > 100 && cz < 142) return [244 / 255, 236 / 255, 223 / 255]; // white tee
  return [185 / 255, 62 / 255, 12 / 255]; // bomber jacket
}
/* San Andreas Unity pattern (BaseMovementState): the STATE picks the clip,
   the clip's authored speed moves the ped (Ped.cs:560-576, root motion).
   `ts` is the clip playback rate — SPRINT runs the Run clip at 1.35x. */
function mateoSetSpeed(sp, ts) {
  const mt = playerMesh.userData.mateo;
  if (!mt || !mt.ready) return;
  const name = sp < 0.3 ? 'idle' : sp > 6 ? 'run' : 'walk';
  const rate = ts || 1;
  if (mt.current === name && Math.abs((mt.timeScale || 1) - rate) < 0.01) return;
  const next = mt.actions[name];
  if (!next) return;
  if (mt.currentAction) mt.currentAction.fadeOut(0.3);
  next.reset().setEffectiveTimeScale(rate).setEffectiveWeight(1).fadeIn(0.3).play();
  mt.current = name; mt.currentAction = next; mt.timeScale = rate;
}
function mateoUpdate(dt) {
  const mt = playerMesh.userData.mateo;
  if (mt && mt.ready) mt.mixer.update(dt);
}
function makeMateo() {
  const g = new THREE.Group();
  const root = new THREE.Group(); // bob + run lean live here; facing lives on g
  root.scale.set(0.88, 1, 0.9); // slim proportions (narrower, same height)
  g.add(root);
  const mt = { root, mixer: null, actions: {}, current: '', currentAction: null, ready: false };
  g.userData = { mateo: mt, walkPhase: 0, swing: 0, torso: root, head: root,
    legL: root, legR: root, armL: root, armR: root, shinL: root, shinR: root, foreL: root, foreR: root };
  new THREE.GLTFLoader().load('vendor/Soldier.glb', (gltf) => {
    const model = gltf.scene;
    root.add(model);
    model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      if (o.name.indexOf('visor') !== -1) { o.visible = false; return; } // no face shield
      const posA = o.geometry.attributes.position;
      const colors = new Float32Array(posA.count * 3);
      for (let i = 0; i < posA.count; i++) {
        const c = mateoClassify(posA.getX(i), posA.getY(i), posA.getZ(i));
        colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
      }
      o.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      o.material = o.material.clone();
      o.material.map = null; o.material.vertexColors = true; o.material.color.setHex(0xffffff);
    });
    const mixer = new THREE.AnimationMixer(model);
    const byName = (re) => gltf.animations.find((a) => re.test(a.name));
    mt.mixer = mixer;
    mt.actions = {
      idle: byName(/idle/i) ? mixer.clipAction(byName(/idle/i)) : null,
      walk: byName(/walk/i) ? mixer.clipAction(byName(/walk/i)) : null,
      run: byName(/run/i) ? mixer.clipAction(byName(/run/i)) : null,
    };
    mt.ready = true;
    window.__MATEO_GLB = true;
    mateoSetSpeed(0);
  }, undefined, () => { window.__MATEO_GLB = 'error'; });
  scene.add(g);
  return g;
}

/* ---------- entities ---------- */
buildWorld();
const playerMesh = makeMateo(); // Mateo Vega — slim, orange bomber, white sneakers
playerMesh.position.set(-118, 0, 20);
const playerCar = makeCar(0xD1003F, false, 'SCARLET ARROW', 'sports'); // deep crimson-magenta (v3.1: C.magenta washed to pale pink under the bright sun)
playerCar.position.set(-104, 0, -24); playerCar.rotation.y = Math.PI / 2;
playerCar.userData.health = 100;
const traffic = [];
for (let i = 0; i < 18; i++) {
  const prof = pick(['sedan', 'sedan', 'compact', 'van', 'truck']);
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

/* ---------- viewmodel gun (attached to camera — never floating) ---------- */
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
/* muzzle flash */
const muzzle = new THREE.PointLight(C.sun, 0, 18);
muzzle.position.set(0.34, -0.2, -1.2); camera.add(muzzle);
