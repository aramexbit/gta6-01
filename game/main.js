/* PIER HEAT — Sunset Bay. Original open-world getaway game.
   Written from scratch for the make.fun gta6-01 bounty. Three.js r152 (vendored).
   City, characters, vehicles, story, radio and sounds are all original. */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = parseInt(params.get('seed') || '7', 10) || 7;

/* ---------- locked 12-color palette (art bible) ---------- */
const C = {
  indigo: 0x120458, magenta: 0xFF2A6D, cyan: 0x05D9E8, sun: 0xFFB347,
  orange: 0xFF9900, pink: 0xFF9CDA, teal: 0x01CDFE, asphalt: 0x1F1A16,
  cream: 0xF4ECDF, pastel: 0xE8D9A0, sea: 0x2E5E6E, policeRed: 0xFF2244, policeBlue: 0x2244FF,
};
const CSS = { indigo:'#120458', magenta:'#FF2A6D', cyan:'#05D9E8', sun:'#FFB347',
  orange:'#FF9900', pink:'#FF9CDA', teal:'#01CDFE', asphalt:'#1F1A16',
  cream:'#F4ECDF', pastel:'#E8D9A0', sea:'#2E5E6E' };

/* ---------- seeded RNG ---------- */
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(SEED * 7919 + 13);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/* ---------- state ---------- */
const SAVE_KEY = 'pierheat-save-v1';
const S = {
  started: false, paused: false, over: false,
  mode: 'foot',           // 'foot' | 'car'
  money: 0, wanted: 0, wantedTimer: 0, heat: 0,
  mission: 0,             // stage index 0..7
  ammo: 12, emp: 1, smoke: 3,
  carHealth: 100, speedKmh: 0,
  yaw: 0, pitch: 0,       // on-foot look
  carYaw: 0, carSpeed: 0, // driving
  radioTrack: 0, muted: false,
  time: 0, frames: 0,
};
const RADIO = ['"RUNNING RED"', '"SUNSET FREEWAY"', '"NEON TIDE"', '"PIER LIGHTS"'];
const MISSIONS = [
  { title: 'MEET KIRA AT THE PIER', obj: 'Walk to the pier gate and meet Kira', target: [-128, 0, 8], r: 9, pay: 250,
    line: 'Mateo, I am at the pier gate. Walk over — no car yet, keep it quiet.' },
  { title: 'STEAL THE SCARLET ARROW', obj: 'Steal the red sports car on Ocean Drive (press E)', target: [-104, 0, -24], r: 7, pay: 500,
    line: 'There it is — the Scarlet Arrow. Take it. The owner will not miss it tonight.' },
  { title: 'ESCAPE TO THE PIER SAFEHOUSE', obj: 'Lose the police tail — reach the marina checkpoint', target: [-150, 0, 60], r: 10, pay: 1500,
    line: 'Almost there — left at the pier! We can lose them near the boardwalk.' },
  { title: 'DELIVER THE PACKAGE', obj: 'Drive the package to Neon Row, east side', target: [108, 0, -84], r: 9, pay: 1200,
    line: 'Package is in the trunk. Neon Row, the pink shop. Do not scratch the paint.' },
  { title: 'LOSE THE HEAT', obj: 'Stay out of sight until your wanted level drops', target: [40, 0, 100], r: 12, pay: 800,
    line: 'Lay low in the side streets. When the stars fade, come back to me.' },
  { title: 'PICK UP KIRA', obj: 'Pick Kira up at the beach kiosk', target: [-120, 0, -80], r: 8, pay: 1000,
    line: 'I am at the beach kiosk, Mateo. Hurry — the sun is almost gone.' },
  { title: 'THE LAST RUN', obj: 'Race to the marina checkpoint with Kira aboard', target: [-150, 0, 60], r: 10, pay: 2500,
    line: 'Floor it! One last run down Ocean Drive and we are free!' },
  { title: 'SAFEHOUSE — JOB DONE', obj: 'Park at the pier safehouse to finish the job', target: [-150, 0, 60], r: 10, pay: 5000,
    line: 'We made it, Mateo. Sunset Bay is ours tonight.' },
];
const KIRA_LINES = [
  'Mateo, you made it. Sunset Bay is hot tonight — keep it smooth.',
  'Nice. The Arrow is yours now. Drive like the tide is chasing you.',
  'Police on your tail — do not stop for anything. Pier, Mateo, the pier!',
  'Neon Row is waiting. Easy does it through the traffic.',
  'Breathe. The city forgets fast if you give it a quiet corner.',
  'I see you. Beach kiosk, pink umbrella. Let us go!',
  'Hold on tight — this is the run they will sing about on Nightwave!',
  'Park it by the safehouse. Job done, Mateo. Job done.',
];

/* ---------- audio: procedural WebAudio, no files ---------- */
let AC = null, engineOsc = null, engineGain = null, radioTimer = null;
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = AC.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    engineGain = AC.createGain(); engineGain.gain.value = 0.0;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(AC.destination);
    engineOsc.start();
    // radio: simple synth loop — bass + bright arp, Nightwave 98.3
    const notes = [110, 130.8, 164.8, 196, 164.8, 130.8];
    let step = 0;
    radioTimer = setInterval(() => {
      if (!AC || S.muted || !S.started || S.paused) return;
      const t = AC.currentTime;
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'triangle'; o.frequency.value = notes[step % notes.length] * (step % 8 < 4 ? 1 : 2);
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.3);
      step++;
    }, 300);
  } catch (e) { AC = null; }
}
function beep(freq, dur, type, vol) {
  if (!AC || S.muted) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.08, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch (e) {}
}
function sirenTick(t) { /* two-tone siren handled in loop via beep scheduling */ }
function gunshot() {
  if (!AC || S.muted) return;
  try {
    const len = AC.sampleRate * 0.12, buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = AC.createBufferSource(); src.buffer = buf;
    const g = AC.createGain(); g.gain.value = 0.25;
    src.connect(g); g.connect(AC.destination); src.start();
  } catch (e) {}
}
function engineUpdate() {
  if (!AC || !engineGain) return;
  const target = S.started && !S.paused ? (S.mode === 'car' ? 0.05 + Math.abs(S.carSpeed) * 0.0022 : 0.015) : 0;
  engineGain.gain.setTargetAtTime(S.muted ? 0 : target, AC.currentTime, 0.1);
  if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + Math.abs(S.carSpeed) * 2.2, AC.currentTime, 0.1);
}

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

function box(w, h, d, mat, x, y, z, parent, noShadow) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = !noShadow; m.receiveShadow = true;
  (parent || world).add(m); return m;
}
function buildWorld() {
  // ground: city slab + beach + sea
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2 + 60, CITY * 2 + 60), toon(0x3a2a3a));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, CITY * 2 + 60), toon(C.pastel));
  beach.rotation.x = -Math.PI / 2; beach.position.set(-CITY - 38, 0.05, 0); beach.receiveShadow = true; world.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, CITY * 2 + 400), toon(C.sea));
  sea.rotation.x = -Math.PI / 2; sea.position.set(-CITY - 190, -0.4, 0); world.add(sea);
  // sea shimmer strips
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(180, 1.2), new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.35 }));
    s.rotation.x = -Math.PI / 2; s.position.set(-CITY - 120 - rnd() * 120, -0.2, -180 + i * 40 + rnd() * 10); world.add(s);
  }
  // roads (center dashes baked into one repeating texture per road)
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
  // sun disc + glow on the horizon (west, over the sea)
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(15, 32),
    new THREE.MeshBasicMaterial({ color: C.sun, fog: false }));
  sunDisc.position.set(-320, 30, -40); sunDisc.lookAt(0, 20, 0); world.add(sunDisc);
  const sunGlow = glowSprite(C.sun, 110); sunGlow.position.set(-310, 32, -40); world.add(sunGlow);
  // low-poly clouds, warm lit
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
    // one building per block corner, skip road-adjacent pier strip
    const bx = x + 24 + rnd() * 4, bz = z + 24 + rnd() * 4;
    if (bx < -135 || bx > 140 || bz < -140 || bz > 140) continue;
    if (rnd() < 0.22) continue; // plaza gaps
    const w = 14 + rnd() * 8, d = 14 + rnd() * 8, h = 10 + rnd() * 34;
    const col = pick(BUILDING_COLORS);
    const b = box(w, h, d, toon(col), bx, h / 2, bz);
    b.castShadow = true;
    // roof rim
    box(w + 1, 0.8, d + 1, toon(C.magenta), bx, h + 0.4, bz);
    // windows: capped at 10 lit panes per building, front face only
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
    // neon sign on some buildings
    if (rnd() < 0.55) {
      const signCol = pick(neonColors);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.4),
        new THREE.MeshBasicMaterial({ color: signCol }));
      sign.position.set(bx, Math.min(h - 2, 14 + rnd() * 8), bz + d / 2 + 0.15);
      world.add(sign);
      const g = glowSprite(signCol, 12); g.position.copy(sign.position); g.position.z += 0.6; world.add(g);
      // sign text via canvas texture
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
  // palms along Ocean Drive (x=-120) and beach
  for (let z = -140; z <= 140; z += 22) { palm(-132, z + 4); palm(-108, z - 6); }
  for (let z = -120; z <= 120; z += 30) palm(-160 + rnd() * 8, z);
  for (let i = 0; i < 12; i++) palm(-60 + rnd() * 190, -140 + rnd() * 280);
  // street lamps
  const lampMat = toon(C.asphalt);
  for (const x of ROAD_X) for (let z = -140; z <= 140; z += 40) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), lampMat);
    pole.position.set(x + 7, 3.5, z); pole.castShadow = true; world.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
      new THREE.MeshBasicMaterial({ color: C.sun }));
    bulb.position.set(x + 7, 7.1, z); world.add(bulb);
  }
  // beach umbrellas + lifeguard tower
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
  // wooden pier jutting into the sea at z=0..60, x from -165 to -230
  const plankMat = toon(0x8a6a4a);
  for (let x = -168; x >= -228; x -= 3) {
    box(2.6, 0.5, 14, plankMat, x, 0.8, 30, undefined, true);
    box(0.5, 3, 0.5, plankMat, x, -0.5, 24, undefined, true);
    box(0.5, 3, 0.5, plankMat, x, -0.5, 36, undefined, true);
  }
  // safehouse shack at the pier end
  const shack = new THREE.Group();
  box(8, 5, 7, toon(C.pastel), 0, 2.5, 0, shack);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 3, 4), toon(C.magenta));
  roof.position.y = 6.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true; shack.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.4), new THREE.MeshBasicMaterial({ color: C.teal }));
  door.position.set(0, 1.7, 3.55); shack.add(door);
  const sg = glowSprite(C.cyan, 10); sg.position.set(0, 3, 4.4); shack.add(sg);
  shack.position.set(-222, 1, 30); world.add(shack);
  // pier neon sign
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
function makeCar(color, isPolice, name) {
  const g = new THREE.Group();
  const bodyMat = toon(isPolice ? 0x2a2a4a : color);
  const body = box(2.1, 0.75, 4.6, bodyMat, 0, 0.75, 0, g);
  addOutline(body, C.asphalt, 1.05);
  const cabin = box(1.8, 0.65, 2.2, toon(isPolice ? 0x3a3a5a : color), 0, 1.4, -0.2, g);
  const glass = box(1.84, 0.5, 2.24, new THREE.MeshBasicMaterial({ color: C.indigo }), 0, 1.42, -0.2, g);
  glass.castShadow = false;
  // wheels
  const wheelMat = toon(C.asphalt);
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); w.castShadow = true; g.add(w); wheels.push(w);
  }
  // headlights + taillights
  const hl = new THREE.MeshBasicMaterial({ color: C.sun });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), hl);
    h.position.set(hx, 0.8, 2.32); g.add(h);
    const gl = glowSprite(C.sun, 2.2); gl.position.set(hx, 0.8, 2.5); g.add(gl);
  }
  const tl = new THREE.MeshBasicMaterial({ color: C.magenta });
  for (const hx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tl);
    t.position.set(hx, 0.85, -2.32); g.add(t);
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
    speed: 0, yaw: 0, health: 100 };
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
const playerCar = makeCar(C.magenta, false, 'SCARLET ARROW');
playerCar.position.set(-104, 0, -24); playerCar.rotation.y = Math.PI / 2;
playerCar.userData.health = 100;
const traffic = [];
for (let i = 0; i < 14; i++) {
  const car = makeCar(pick(CAR_COLORS), false);
  const vertical = rnd() < 0.5;
  const road = pick(vertical ? ROAD_X : ROAD_Z);
  car.userData.vertical = vertical; car.userData.road = road;
  car.userData.along = -CITY + rnd() * CITY * 2;
  car.userData.dir = rnd() < 0.5 ? 1 : -1;
  car.userData.cruise = 7 + rnd() * 6;
  traffic.push(car);
}
const peds = [];
const PED_COLORS = [C.cyan, C.pink, C.sun, C.teal, C.pastel, C.magenta];
for (let i = 0; i < 20; i++) {
  const p = makePerson(pick(PED_COLORS), pick([C.indigo, C.asphalt, C.sea]));
  p.userData.vertical = rnd() < 0.5;
  p.userData.road = pick(p.userData.vertical ? ROAD_X : ROAD_Z);
  p.userData.along = -CITY + rnd() * CITY * 2;
  p.userData.dir = rnd() < 0.5 ? 1 : -1;
  p.userData.speed = 1.2 + rnd() * 1.4;
  p.userData.side = rnd() < 0.5 ? 8.5 : -8.5;
  peds.push(p);
}
const police = [];
for (let i = 0; i < 5; i++) {
  const pc = makeCar(0, true, 'UNIT P-' + String(3 + i * 4).padStart(2, '0'));
  pc.visible = false; pc.position.set(200, -50, 200);
  pc.userData.status = 'EN ROUTE'; pc.userData.ramTimer = 0;
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

/* ---------- helpers ---------- */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function playerPos() { return S.mode === 'car' ? playerCar.position : playerMesh.position; }
function dist2d(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
function toast(msg, ms) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.style.display = 'none'; }, ms || 2400);
}
function say(line) { $('dialog-line').textContent = line; }
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: S.money, mission: S.mission, car: S.mode === 'car' ? 'SCARLET ARROW' : null,
      wanted: S.wanted, x: playerPos().x, z: playerPos().z }));
  } catch (e) {}
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s; } catch (e) { return null; }
}
function setWanted(n) {
  S.wanted = Math.max(0, Math.min(5, n));
  if (S.wanted > 0) say(pick([
    'Kira: The whole bay just lit up. Lose them, Mateo!',
    'Kira: Stars on you — keep moving, do not let them box you in!',
    'Kira: Sunset Bay PD is on the radio about you. Drive!',
  ]));
}
function completeStage() {
  const m = MISSIONS[S.mission];
  S.money += m.pay;
  toast('MISSION ' + (S.mission + 1) + '/8 COMPLETE  +$' + m.pay.toLocaleString(), 3000);
  beep(660, 0.15, 'square', 0.1); setTimeout(() => beep(880, 0.25, 'square', 0.1), 160);
  saveGame();
  if (S.mission >= MISSIONS.length - 1) {
    S.over = true;
    say('We made it, Mateo. Sunset Bay is ours tonight. Job complete — $' + S.money.toLocaleString() + ' earned.');
    toast('★ JOB COMPLETE ★  $' + S.money.toLocaleString(), 6000);
    setWanted(0);
    return;
  }
  S.mission++;
  say(KIRA_LINES[S.mission] || MISSIONS[S.mission].line);
  updateMissionHUD();
}
function updateMissionHUD() {
  const m = MISSIONS[S.mission];
  $('mission-title').textContent = 'MISSION ' + (S.mission + 1) + '/8';
  $('mission-obj').textContent = m.obj;
  $('mission-stage').textContent = 'STAGE ' + (S.mission + 1) + '/8';
  beacon.position.set(m.target[0], 0, m.target[2]);
}

/* ---------- input ---------- */
const keys = {};
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'KeyF') shoot();
  if (e.code === 'KeyR') { S.radioTrack = (S.radioTrack + 1) % RADIO.length;
    $('radio').textContent = '((·)) RADIO: NIGHTWAVE 98.3 — ' + RADIO[S.radioTrack]; beep(520, 0.08, 'square', 0.06); }
  if (e.code === 'KeyM') { S.muted = !S.muted; toast(S.muted ? 'SOUND OFF' : 'SOUND ON', 1200); }
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || S.paused || !S.started) return;
  S.yaw -= e.movementX * 0.0026;
  S.pitch = Math.max(-1.2, Math.min(1.2, S.pitch - e.movementY * 0.0026));
});
renderer.domElement.addEventListener('click', () => {
  audioInit();
  if (S.started && !S.paused) {
    if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
    else if (S.mode === 'foot') shoot();
  }
});
function togglePause() {
  if (!S.started || S.over) return;
  S.paused = !S.paused;
  $('pause').style.display = S.paused ? 'flex' : 'none';
  if (!S.paused) audioInit();
}
function tryEnterExitCar() {
  if (!S.started || S.paused) return;
  audioInit();
  if (S.mode === 'foot') {
    // nearest stealable car: the Scarlet Arrow first, then traffic
    let best = null, bd = 5.5;
    const cands = [playerCar, ...traffic];
    for (const c of cands) {
      const d = dist2d(playerMesh.position, c.position);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      const stolen = best !== playerCar || !best.userData.owned;
      S.mode = 'car';
      if (best === playerCar) { playerCar.userData.owned = true; }
      // swap: player takes this car; if traffic car, keep its mesh as the driven car
      if (best !== playerCar) { window.__drivenTraffic = best; }
      S.drivenCar = best;
      S.carYaw = best.rotation.y;
      playerMesh.visible = false;
      viewmodel.visible = false;
      $('crosshair').style.display = 'none';
      beep(220, 0.12, 'square', 0.09);
      if (stolen && S.mission === 1) { /* stealing is the mission; completion checked at target */ }
      if (best !== playerCar && !best.userData.stolen) { best.userData.stolen = true; setWanted(S.wanted + 1); toast('CAR STOLEN — WANTED ★', 2000); }
      else if (best === playerCar && stolen) { setWanted(S.wanted + 1); toast('SCARLET ARROW STOLEN', 2000); }
      saveGame();
    } else toast('NO CAR NEARBY — GET CLOSER', 1400);
  } else {
    S.mode = 'foot';
    const car = S.drivenCar || playerCar;
    playerMesh.visible = true;
    playerMesh.position.copy(car.position);
    playerMesh.position.x += Math.sin(S.carYaw) * 3; playerMesh.position.z += Math.cos(S.carYaw) * 3;
    S.yaw = S.carYaw;
    viewmodel.visible = true;
    $('crosshair').style.display = 'block';
    S.carSpeed = 0;
    beep(180, 0.1, 'square', 0.07);
  }
}
function shoot() {
  if (!S.started || S.paused || S.mode !== 'foot' || S.ammo <= 0) {
    if (S.mode === 'foot' && S.ammo <= 0) toast('OUT OF AMMO — FIND A CAR', 1400);
    return;
  }
  S.ammo--; $('ammo').textContent = '[' + S.ammo + '/12]';
  gunshot(); muzzle.intensity = 6; setTimeout(() => { muzzle.intensity = 0; }, 60);
  viewmodel.position.z = -0.48; setTimeout(() => { viewmodel.position.z = -0.55; }, 70);
  // hitscan: nearest police/ped in front cone within 40m
  const dir = V3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
  let hit = null, hd = 40;
  for (const pc of police) {
    if (!pc.visible) continue;
    const d = dist2d(playerMesh.position, pc.position);
    if (d > 40) continue;
    const to = V3(pc.position.x - playerMesh.position.x, 0, pc.position.z - playerMesh.position.z).normalize();
    if (to.dot(dir) > 0.86 && d < hd) { hd = d; hit = pc; }
  }
  if (hit) {
    hit.userData.health -= 34;
    toast('HIT ' + hit.userData.name + '!', 900);
    if (hit.userData.health <= 0) { hit.visible = false; hit.position.set(200, -50, 200); setWanted(S.wanted + 1); }
    else setWanted(Math.max(S.wanted, 2));
  } else if (S.wanted === 0 && rnd() < 0.5) setWanted(1);
}

/* ---------- driving & walking ---------- */
function updatePlayer(dt) {
  if (S.mode === 'car') {
    const car = S.drivenCar || playerCar;
    const fwd = (keys.KeyW || keys.ArrowUp) ? 1 : 0;
    const back = (keys.KeyS || keys.ArrowDown) ? 1 : 0;
    const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    const boost = keys.ShiftLeft || keys.ShiftRight;
    const top = (boost ? 46 : 34) * (car === playerCar ? 1.25 : 1);
    if (fwd) S.carSpeed += (boost ? 26 : 17) * dt;
    if (back) S.carSpeed -= 20 * dt;
    if (keys.Space) S.carSpeed *= Math.pow(0.02, dt);
    if (!fwd && !back) S.carSpeed *= Math.pow(0.35, dt);
    S.carSpeed = Math.max(-12, Math.min(top, S.carSpeed));
    const spd = Math.abs(S.carSpeed);
    if (spd > 0.3) S.carYaw += steer * (S.carSpeed > 0 ? 1 : -1) * 1.9 * dt * Math.min(1, spd / 12);
    car.rotation.y = S.carYaw;
    car.position.x -= Math.sin(S.carYaw) * S.carSpeed * dt;
    car.position.z -= Math.cos(S.carYaw) * S.carSpeed * dt;
    // stay in the bay
    car.position.x = Math.max(-235, Math.min(155, car.position.x));
    car.position.z = Math.max(-155, Math.min(155, car.position.z));
    S.speedKmh = Math.abs(S.carSpeed) * 3.6;
    // wheel spin
    for (const w of car.userData.wheels) w.rotation.x += S.carSpeed * dt * 1.4;
    // collisions with traffic: bump + damage + wanted if police
    for (const t of traffic) {
      if (t === car) continue;
      if (dist2d(car.position, t.position) < 3.4) {
        S.carSpeed *= 0.55; S.carHealth = Math.max(0, S.carHealth - 2);
        t.position.x += (t.position.x - car.position.x) * 0.3;
        t.position.z += (t.position.z - car.position.z) * 0.3;
        beep(120, 0.1, 'sawtooth', 0.1);
      }
    }
    for (const pc of police) {
      if (!pc.visible) continue;
      if (dist2d(car.position, pc.position) < 3.6) {
        S.carSpeed *= 0.7; S.carHealth = Math.max(0, S.carHealth - 3);
        beep(110, 0.12, 'sawtooth', 0.12);
      }
    }
    if (S.carHealth <= 0) {
      toast('CAR WRECKED — GET OUT!', 3000);
      S.carHealth = 100; tryEnterExitCar();
    }
  } else {
    const sp = (keys.ShiftLeft || keys.ShiftRight) ? 9 : 5.2;
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz += 1;
    if (keys.KeyS || keys.ArrowDown) mz -= 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    const len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
    const sin = Math.sin(S.yaw), cos = Math.cos(S.yaw);
    playerMesh.position.x += (-sin * mz + -cos * mx * -1) * 0; // placeholder, replaced below
    playerMesh.position.x += (-sin * mz - cos * mx) * sp * dt * -1 * -1;
    playerMesh.position.x += 0; // (kept simple: recompute properly)
    // correct strafe: forward = (-sin, -cos), right = (cos, -sin)
    playerMesh.position.x -= (-sin * mz - cos * mx) * sp * dt * -1 * -1; // undo double-add
    playerMesh.position.x += (-sin * mz + cos * mx) * sp * dt;
    playerMesh.position.z += (-cos * mz - sin * mx) * sp * dt;
    playerMesh.position.x = Math.max(-235, Math.min(155, playerMesh.position.x));
    playerMesh.position.z = Math.max(-155, Math.min(155, playerMesh.position.z));
    playerMesh.rotation.y = S.yaw + Math.PI;
    S.speedKmh = Math.hypot(mx, mz) * sp * 3.6;
    // walk cycle
    const u = playerMesh.userData;
    const moving = (mx !== 0 || mz !== 0);
    u.walkPhase += dt * (moving ? 9 : 0);
    const sw = moving ? Math.sin(u.walkPhase) * 0.5 : 0;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7;
  }
}

/* ---------- traffic & pedestrians ---------- */
function updateTraffic(dt) {
  for (const car of traffic) {
    if (S.drivenCar === car) continue;
    const u = car.userData;
    u.along += u.cruise * u.dir * dt;
    if (u.along > CITY + 10) u.along = -CITY - 10;
    if (u.along < -CITY - 10) u.along = CITY + 10;
    if (u.vertical) { car.position.set(u.road + (u.dir > 0 ? 3 : -3), 0, u.along); car.rotation.y = u.dir > 0 ? Math.PI : 0; }
    else { car.position.set(u.along, 0, u.road + (u.dir > 0 ? 3 : -3)); car.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    for (const w of u.wheels) w.rotation.x += u.cruise * dt * 1.2;
  }
  for (const p of peds) {
    const u = p.userData;
    u.along += u.speed * u.dir * dt;
    if (u.along > CITY + 10) u.along = -CITY - 10;
    if (u.along < -CITY - 10) u.along = CITY + 10;
    if (u.vertical) { p.position.set(u.road + u.side, 0, u.along); p.rotation.y = u.dir > 0 ? 0 : Math.PI; }
    else { p.position.set(u.along, 0, u.road + u.side); p.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    u.walkPhase += dt * 7;
    const sw = Math.sin(u.walkPhase) * 0.45;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.6; u.armR.rotation.x = sw * 0.6;
    // player runs over a ped: wanted up
    if (S.mode === 'car' && dist2d(playerPos(), p.position) < 2.2) {
      p.position.set(200, -50, 200); p.userData.along = -CITY; // respawn far away
      setWanted(S.wanted + 1); beep(90, 0.2, 'sawtooth', 0.14);
      toast('PEDESTRIAN DOWN — WANTED ★', 1800);
    }
  }
}

/* ---------- police AI ---------- */
function updatePolice(dt) {
  const pp = playerPos();
  const want = S.wanted;
  const active = want === 0 ? 0 : Math.min(5, 1 + want);
  let idx = 0;
  for (const pc of police) {
    const u = pc.userData;
    if (idx >= active) { pc.visible = false; continue; }
    idx++;
    if (!pc.visible) {
      // spawn ahead of the player, on a road
      const a = rnd() * Math.PI * 2;
      pc.position.set(pp.x + Math.cos(a) * 70, 0, pp.z + Math.sin(a) * 70);
      pc.position.x = Math.max(-150, Math.min(150, pc.position.x));
      pc.position.z = Math.max(-150, Math.min(150, pc.position.z));
      pc.visible = true; u.health = 100; u.status = 'EN ROUTE';
    }
    const d = dist2d(pc.position, pp);
    // steering toward player with pursuit speed scaling by wanted
    const targetYaw = Math.atan2(-(pp.x - pc.position.x), -(pp.z - pc.position.z));
    let dy = targetYaw - pc.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    pc.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
    let speed = (10 + want * 4.5);
    if (d < 12) { u.status = 'RAMMING'; speed = 16 + want * 3;
      // ram: push player car
      if (S.mode === 'car') {
        const car = S.drivenCar || playerCar;
        car.position.x += (car.position.x - pc.position.x) * 0.02;
        car.position.z += (car.position.z - pc.position.z) * 0.02;
        S.carHealth = Math.max(0, S.carHealth - 6 * dt);
      }
    } else if (d < 45) u.status = 'PURSUI' + 'T';
    else u.status = 'EN ROUTE';
    // one unit tries a roadblock ahead of the player
    if (idx === 2 && S.mode === 'car' && Math.abs(S.carSpeed) > 8 && d > 30) {
      u.status = 'ROADBLOCK';
      const ahead = V3(pp.x - Math.sin(S.carYaw) * 26, 0, pp.z - Math.cos(S.carYaw) * 26);
      const ty = Math.atan2(-(ahead.x - pc.position.x), -(ahead.z - pc.position.z));
      let dy2 = ty - pc.rotation.y;
      while (dy2 > Math.PI) dy2 -= Math.PI * 2;
      while (dy2 < -Math.PI) dy2 += Math.PI * 2;
      pc.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy2));
      speed = 20;
      if (dist2d(pc.position, ahead) < 6) speed = 0;
    }
    pc.position.x -= Math.sin(pc.rotation.y) * speed * dt;
    pc.position.z -= Math.cos(pc.rotation.y) * speed * dt;
    for (const w of u.wheels) w.rotation.x += speed * dt * 1.3;
    u.dist = d;
    // flashing lightbar
    if (u.lightbar) {
      const on = Math.floor(S.time * 6) % 2 === 0;
      u.lightbar.userData.r.material.color.setHex(on ? C.policeRed : 0x550000);
      u.lightbar.userData.b.material.color.setHex(on ? 0x220044 : C.policeBlue);
      u.lightbar.userData.rg.material.opacity = on ? 0.95 : 0.15;
      u.lightbar.userData.bg.material.opacity = on ? 0.15 : 0.95;
    }
  }
  // wanted decay: out of sight for a while
  if (want > 0) {
    let nearest = 999;
    for (const pc of police) if (pc.visible) nearest = Math.min(nearest, pc.userData.dist || 999);
    if (nearest > 70) { S.wantedTimer += dt; if (S.wantedTimer > 8) { setWanted(want - 1); S.wantedTimer = 0; } }
    else S.wantedTimer = 0;
  }
  // helicopter at wanted >= 3
  if (want >= 3) {
    heli.visible = true;
    heli.userData.angle += dt * 0.45;
    const a = heli.userData.angle;
    heli.position.set(pp.x + Math.cos(a) * 26, 34 + Math.sin(S.time * 0.7) * 2, pp.z + Math.sin(a) * 26);
    heli.lookAt(pp.x, 0, pp.z);
    heli.userData.rotor.rotation.y += dt * 22;
    heli.userData.spot.target.position.set(pp.x - heli.position.x, -34, pp.z - heli.position.z);
    heli.userData.spot.target.updateMatrixWorld();
    const on = Math.floor(S.time * 5) % 2 === 0;
    heli.userData.lightbar.children[0].material.color.setHex(on ? C.policeRed : 0x550000);
    heli.userData.lightbar.children[1].material.color.setHex(on ? 0x220044 : C.policeBlue);
  } else heli.visible = false;
  // siren wail while wanted
  if (want > 0 && AC && !S.muted && Math.floor(S.time * 2) !== Math.floor((S.time - dt) * 2)) {
    beep(Math.floor(S.time * 2) % 2 === 0 ? 720 : 540, 0.42, 'sine', 0.035);
  }
}

/* ---------- camera ---------- */
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (S.mode === 'car') {
    const car = S.drivenCar || playerCar;
    const back = 9.5 + Math.abs(S.carSpeed) * 0.12;
    const up = 3.6 + Math.abs(S.carSpeed) * 0.02;
    const want = V3(
      car.position.x + Math.sin(S.carYaw) * back,
      up,
      car.position.z + Math.cos(S.carYaw) * back);
    camera.position.lerp(want, 1 - Math.pow(0.001, dt));
    camTarget.lerp(V3(car.position.x - Math.sin(S.carYaw) * 6, 1.6, car.position.z - Math.cos(S.carYaw) * 6), 1 - Math.pow(0.0005, dt));
    camera.lookAt(camTarget);
    camera.fov += ((62 + Math.abs(S.carSpeed) * 0.55) - camera.fov) * dt * 3;
    camera.updateProjectionMatrix();
  } else {
    camera.position.set(playerMesh.position.x, 2.1, playerMesh.position.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = S.yaw; camera.rotation.x = S.pitch; camera.rotation.z = 0;
    camera.fov += (68 - camera.fov) * dt * 3; camera.updateProjectionMatrix();
  }
}

/* ---------- HUD & minimap ---------- */
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const W = 210, R = 105, scale = W / 520;
  const pp = playerPos();
  const toMap = (x, z) => [W / 2 + (x - pp.x) * scale * 1.6, W / 2 + (z - pp.z) * scale * 1.6];
  mm.fillStyle = CSS.indigo; mm.fillRect(0, 0, W, W);
  mm.save();
  mm.beginPath(); mm.arc(R, R, R, 0, Math.PI * 2); mm.clip();
  // sea west
  mm.fillStyle = CSS.sea; mm.fillRect(0, 0, W / 2 + (-CITY - 38 - pp.x) * scale * 1.6 + 60, W);
  // roads
  mm.strokeStyle = '#3a2a3a'; mm.lineWidth = 7;
  for (const x of ROAD_X) { const [ax] = toMap(x, 0); mm.beginPath(); mm.moveTo(ax, -10); mm.lineTo(ax, W + 10); mm.stroke(); }
  for (const z of ROAD_Z) { const [, az] = toMap(0, z); mm.beginPath(); mm.moveTo(-10, az); mm.lineTo(W + 10, az); mm.stroke(); }
  mm.strokeStyle = CSS.sun; mm.lineWidth = 1;
  for (const x of ROAD_X) { const [ax] = toMap(x, 0); mm.beginPath(); mm.moveTo(ax, -10); mm.lineTo(ax, W + 10); mm.stroke(); }
  for (const z of ROAD_Z) { const [, az] = toMap(0, z); mm.beginPath(); mm.moveTo(-10, az); mm.lineTo(W + 10, az); mm.stroke(); }
  // pier
  mm.strokeStyle = CSS.pastel; mm.lineWidth = 5;
  { const [ax, az] = toMap(-198, 30); mm.beginPath(); mm.moveTo(ax + 32, az); mm.lineTo(ax - 32, az); mm.stroke(); }
  // mission marker
  const m = MISSIONS[S.mission];
  const [mx, mz] = toMap(m.target[0], m.target[2]);
  mm.fillStyle = CSS.sun;
  mm.beginPath(); mm.moveTo(mx, mz - 9); mm.lineTo(mx + 8, mz); mm.lineTo(mx, mz + 9); mm.lineTo(mx - 8, mz); mm.closePath(); mm.fill();
  mm.strokeStyle = CSS.magenta; mm.lineWidth = 2; mm.stroke();
  // traffic dots
  mm.fillStyle = CSS.cream;
  for (const t of traffic) { const [tx, tz] = toMap(t.position.x, t.position.z); mm.fillRect(tx - 1.5, tz - 1.5, 3, 3); }
  // police dots
  for (const pc of police) {
    if (!pc.visible) continue;
    const [px, pz] = toMap(pc.position.x, pc.position.z);
    mm.fillStyle = (Math.floor(S.time * 4) % 2 === 0) ? '#FF2244' : '#2244FF';
    mm.beginPath(); mm.arc(px, pz, 4, 0, Math.PI * 2); mm.fill();
  }
  // player arrow
  const yaw = S.mode === 'car' ? S.carYaw : S.yaw;
  mm.save(); mm.translate(R, R); mm.rotate(Math.PI - yaw);
  mm.fillStyle = CSS.magenta;
  mm.beginPath(); mm.moveTo(0, -11); mm.lineTo(8, 8); mm.lineTo(0, 4); mm.lineTo(-8, 8); mm.closePath(); mm.fill();
  mm.restore();
  mm.restore();
  // ring
  mm.strokeStyle = CSS.cyan; mm.lineWidth = 3;
  mm.beginPath(); mm.arc(R, R, R - 2, 0, Math.PI * 2); mm.stroke();
}
function updateHUD() {
  $('money').textContent = '$' + S.money.toLocaleString();
  const stars = $('stars').children;
  // rebuild stars (5 spans)
  let html = '';
  for (let i = 0; i < 5; i++) html += '<span class="' + (i < S.wanted ? 'on' : '') + '">★</span>';
  $('stars').innerHTML = html;
  $('speed').innerHTML = Math.round(S.speedKmh) + ' <small>KM/H</small>';
  const car = S.mode === 'car' ? (S.drivenCar || playerCar) : null;
  $('car-name').textContent = car ? car.userData.name + (car === playerCar ? ' ★' : '') : 'ON FOOT — MATEO VEGA';
  const cond = car ? Math.round(S.carHealth) : 100;
  $('car-cond-fill').style.width = cond + '%';
  $('cond-label').textContent = 'CONDITION ~' + cond + '%';
  viewmodel.visible = S.mode === 'foot' && S.started && !S.paused;
  $('crosshair').style.display = S.mode === 'foot' && S.started && !S.paused ? 'block' : 'none';
  // police panel
  const list = $('police-list');
  const act = police.filter((p) => p.visible);
  if (act.length === 0) list.innerHTML = '<li><span>NO UNITS NEARBY</span><span class="st">CLEAR</span></li>';
  else {
    list.innerHTML = act.slice(0, 4).map((p) => {
      const d = Math.round(p.userData.dist || 0);
      return '<li><span>🚔 ' + p.userData.name + ' · ' + d + 'm</span><span class="st">' + p.userData.status + '</span><span class="dot">●</span></li>';
    }).join('');
    if (heli.visible) list.innerHTML += '<li><span>🚁 HELI H-1 · OVERHEAD</span><span class="st">SPOTLIGHT</span><span class="dot">●</span></li>';
  }
  // mission progress bar: distance to target
  const m = MISSIONS[S.mission];
  const d = dist2d(playerPos(), V3(m.target[0], 0, m.target[2]));
  $('mission-fill').style.width = Math.max(0, Math.min(100, 100 - d / 2.2)) + '%';
  drawMinimap();
}

/* ---------- mission logic ---------- */
function updateMissions(dt) {
  if (S.over) return;
  const m = MISSIONS[S.mission];
  const pp = playerPos();
  const d = dist2d(pp, V3(m.target[0], 0, m.target[2]));
  beaconGem.rotation.y += dt * 2; beaconGem.position.y = 8 + Math.sin(S.time * 2) * 0.8;
  beaconCyl.material.opacity = 0.25 + Math.sin(S.time * 3) * 0.1;
  if (S.mission === 1 && S.mode === 'car' && (S.drivenCar === playerCar)) {
    // stole the Arrow: objective becomes drive to the pier (stage 3 target is next)
  }
  if (d < m.r) {
    if (S.mission === 0) { completeStage(); return; }
    if (S.mission === 1) {
      if (S.mode === 'car' && S.drivenCar === playerCar) { setWanted(3); completeStage(); return; }
      if (S.mode === 'foot') { toast('GET IN THE SCARLET ARROW — PRESS E', 1600); return; }
    }
    if (S.mission === 2) { setWanted(0); completeStage(); return; }
    if (S.mission === 3) { if (S.mode === 'car') completeStage(); else { toast('DELIVER BY CAR', 1400); return; } return; }
    if (S.mission === 4) { if (S.wanted === 0) completeStage(); else { toast('STILL WANTED — HIDE!', 1400); return; } return; }
    if (S.mission === 5) { completeStage(); return; }
    if (S.mission === 6) { completeStage(); return; }
    if (S.mission === 7) { if (S.mode === 'car') completeStage(); else completeStage(); return; }
  }
  // stage 5 helper: if wanted already 0 when arriving, it completes above; nudge
  if (S.mission === 4 && S.wanted === 0 && d < m.r) completeStage();
}

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
let sirenPhase = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.frames++;
  if (S.frames === 5) { $('loading').style.display = 'none'; window.__PIERHEAT_READY = true; }
  if (!S.started || S.paused) { renderer.render(scene, camera); return; }
  S.time += dt;
  updatePlayer(dt);
  updateTraffic(dt);
  updatePolice(dt);
  updateMissions(dt);
  updateCamera(dt);
  updateHUD();
  engineUpdate();
  renderer.render(scene, camera);
}
window.__PIERHEAT = S;
window.__PIERHEAT_DEBUG = { MISSIONS, playerPos, setWanted, completeStage };

/* ---------- start / continue / pause wiring ---------- */
function startGame(fromSave) {
  audioInit();
  if (fromSave) {
    const sv = loadSave();
    if (sv) {
      S.money = sv.money || 0; S.mission = Math.min(sv.mission || 0, 7);
      S.wanted = sv.wanted || 0;
      if (sv.x !== undefined) { playerMesh.position.set(sv.x, 0, sv.z); }
      if (sv.car === 'SCARLET ARROW') { playerCar.userData.owned = true; }
    }
  }
  S.started = true; S.paused = false;
  $('start').style.display = 'none';
  $('pause').style.display = 'none';
  updateMissionHUD();
  say(KIRA_LINES[S.mission] || MISSIONS[S.mission].line);
  updateHUD();
  toast('NIGHTWAVE 98.3 — "RUNNING RED"', 2200);
}
$('btn-start').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-resume').addEventListener('click', togglePause);
$('btn-restart').addEventListener('click', () => {
  S.mission = 0; S.money = 0; S.wanted = 0; S.carHealth = 100; S.ammo = 12;
  S.mode = 'foot'; playerMesh.visible = true; playerMesh.position.set(-118, 0, 20);
  playerCar.position.set(-104, 0, -24); playerCar.userData.owned = false;
  S.drivenCar = null; S.over = false;
  S.paused = false; $('pause').style.display = 'none';
  updateMissionHUD(); say(KIRA_LINES[0]);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- shot states (?shot=chase|street|mission|start) ---------- */
function applyShot() {
  if (!SHOT) return;
  if (SHOT === 'start') { return; } // stay on the start screen
  S.started = true;
  $('start').style.display = 'none';
  if (SHOT === 'chase') {
    S.mode = 'car'; S.drivenCar = playerCar; playerCar.userData.owned = true;
    playerMesh.visible = false;
    playerCar.position.set(-40, 0, -80); S.carYaw = Math.PI; S.carSpeed = 30;
    S.mission = 2; S.money = 18450; S.wanted = 4; S.carHealth = 72;
    say('Almost there — left at the pier! We can lose them near the boardwalk.');
  } else if (SHOT === 'street') {
    S.mode = 'foot'; playerMesh.visible = true;
    playerMesh.position.set(-80, 0, 0); S.yaw = -Math.PI / 2;
    S.mission = 0; S.money = 1250; S.wanted = 1;
    say('Mateo, I am at the pier gate. Walk over — no car yet, keep it quiet.');
  } else if (SHOT === 'mission') {
    S.mode = 'car'; S.drivenCar = playerCar; playerCar.userData.owned = true;
    playerMesh.visible = false;
    playerCar.position.set(-60, 0, 40); S.carYaw = Math.PI / 2; S.carSpeed = 22;
    S.mission = 2; S.money = 18450; S.wanted = 3; S.carHealth = 85;
    say('Almost there — left at the pier! We can lose them near the boardwalk.');
  }
  updateMissionHUD();
  updateHUD();
}

/* ---------- boot ---------- */
updateMissionHUD();
applyShot();
loop();
})();
