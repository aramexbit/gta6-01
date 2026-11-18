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
renderer.toneMappingExposure = 1.15;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.indigo);
scene.fog = new THREE.Fog(0x8a5a8a, 120, 420);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 900);
camera.position.set(-110, 6, 40);

const sunLight = new THREE.DirectionalLight(0xFFB347, 1.6);
sunLight.position.set(-180, 55, -60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(512, 512);
sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
sunLight.shadow.camera.far = 500;
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(0x8a7bd8, 0x2E5E6E, 0.75));

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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 60, CITY * 2 + 60), toon(0x3a2a3a));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, CITY * 2 + 60), toon(C.pastel));
  beach.rotation.x = -Math.PI / 2; beach.position.set(-CITY - 38, 0.05, 0); beach.receiveShadow = true; world.add(beach);
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
  const roadMat = toon(C.asphalt);
  for (const x of ROAD_X) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(12, CITY * 2), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.1, 0); r.receiveShadow = true; world.add(r);
    const dt2 = dashTex.clone(); dt2.needsUpdate = true; dt2.repeat.set(1, 38);
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, CITY * 2),
      new THREE.MeshBasicMaterial({ map: dt2, transparent: true }));
    dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.14, 0); world.add(dash);
  }
  for (const z of ROAD_Z) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 12), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.1, z); r.receiveShadow = true; world.add(r);
    const dt2 = dashTex.clone(); dt2.needsUpdate = true; dt2.repeat.set(38, 1);
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 1.4),
      new THREE.MeshBasicMaterial({ map: dt2, transparent: true }));
    dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.14, z); world.add(dash);
  }
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(15, 32),
    new THREE.MeshBasicMaterial({ color: C.sun, fog: false }));
  sunDisc.position.set(-320, 30, -40); sunDisc.lookAt(0, 20, 0); world.add(sunDisc);
  const sunGlow = glowSprite(C.sun, 110); sunGlow.position.set(-310, 32, -40); world.add(sunGlow);
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
const NEON_SIGNS = ['NOODLES 24h', 'ARCADE', 'TACOS', 'MART', 'HOTEL BAY', 'NEON ROW', 'PIER BAR', 'SURF SHOP', 'KIRA FM', 'SUNSET MOTEL'];
const BUILDING_COLORS = [C.pastel, 0xE8A0B8, 0xA0D8E8, 0xE8C9A0, 0xD8A0E8, C.pink, 0xA0E8C9];
function buildBuildings() {
  const neonColors = [C.magenta, C.cyan, C.sun, C.pink, C.teal];
  for (const x of ROAD_X) for (const z of ROAD_Z) {
    if (Math.abs(x) > 130 || Math.abs(z) > 130) continue;
    const bx = x + 24 + rnd() * 4, bz = z + 24 + rnd() * 4;
    if (bx < -135 || bx > 140 || bz < -140 || bz > 140) continue;
    if (rnd() < 0.22) continue; // plaza gaps
    const w = 14 + rnd() * 8, d = 14 + rnd() * 8, h = 10 + rnd() * 34;
    const col = pick(BUILDING_COLORS);
    const b = box(w, h, d, toon(col), bx, h / 2, bz);
    b.castShadow = true;
    BUILDINGS.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h });
    box(w + 1, 0.8, d + 1, toon(C.magenta), bx, h + 0.4, bz);
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
    if (rnd() < 0.55) {
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
  for (let z = -140; z <= 140; z += 22) { palm(-132, z + 4); palm(-108, z - 6); }
  for (let z = -120; z <= 120; z += 30) palm(-160 + rnd() * 8, z);
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
function makePerson(jacket, pants) {
  const g = new THREE.Group();
  const body = box(0.9, 1.1, 0.5, toon(jacket), 0, 1.35, 0, g);
  addOutline(body, C.asphalt, 1.06);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), toon(0xC98a5a));
  head.position.y = 2.15; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8, 0, Math.PI * 2, 0, 1.4), toon(C.asphalt));
  hair.position.y = 2.2; g.add(hair);
  const legL = box(0.32, 0.85, 0.32, toon(pants || C.indigo), -0.22, 0.43, 0, g);
  const legR = box(0.32, 0.85, 0.32, toon(pants || C.indigo), 0.22, 0.43, 0, g);
  const armL = box(0.24, 0.9, 0.24, toon(jacket), -0.58, 1.35, 0, g);
  const armR = box(0.24, 0.9, 0.24, toon(jacket), 0.58, 1.35, 0, g);
  g.userData = { legL, legR, armL, armR, walkPhase: rnd() * 6 };
  scene.add(g);
  return g;
}

/* ---------- entities ---------- */
buildWorld();
const playerMesh = makePerson(C.orange, C.indigo); // Mateo, orange bomber jacket
playerMesh.position.set(-118, 0, 20);
const playerCar = makeCar(C.magenta, false, 'SCARLET ARROW', 'sports');
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
  pc.userData.status = 'EN ROUTE'; pc.userData.ramTimer = 0;
  pc.userData.speed = 0;
  police.push(pc);
}
/* helicopter */
const heli = new THREE.Group();
(function buildHeli() {
  const body = box(3.2, 1.6, 5.5, toon(0xD8D8E8), 0, 0, 0, heli);
  box(1.6, 1.0, 1.6, new THREE.MeshBasicMaterial({ color: C.indigo }), 0, 0.2, 2.2, heli);
  const rotor = box(9, 0.12, 0.5, toon(C.asphalt), 0, 1.2, 0, heli);
  const tail = box(0.5, 0.5, 4, toon(0xD8D8E8), 0, 0.3, -4.2, heli);
  const lb = new THREE.Group();
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: C.policeRed }));
  r.position.x = -0.5; lb.add(r);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: C.policeBlue }));
  b.position.x = 0.5; lb.add(b);
  lb.position.y = -0.9; heli.add(lb);
  heli.userData = { rotor, lightbar: lb, angle: 0 };
  const spot = new THREE.SpotLight(0xFFF2C9, 3.5, 90, 0.28, 0.5);
  spot.position.set(0, -0.5, 0); heli.add(spot);
  heli.userData.spot = spot;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xFFF2C9, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = -17; cone.rotation.x = Math.PI; heli.add(cone);
  heli.visible = false; scene.add(heli);
})();
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
