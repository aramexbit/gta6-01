/* PIER HEAT — Sunset Bay. core.js: state, palette, RNG, audio, missions, save.
   Original open-world getaway game, written from scratch for make.fun gta6-01.
   Classic scripts share one global scope: top-level names here are used by
   world.js, sim.js and main.js (no IIFE wrapper, by design). */
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

/* ---------- small math helpers (frame-rate independent damping etc.) ---------- */
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
function angleDelta(a, b) { let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function angleLerp(a, b, t) { return a + angleDelta(a, b) * t; }

/* ---------- state ---------- */
const SAVE_KEY = 'pierheat-save-v1';
const S = {
  started: false, paused: false, over: false,
  mode: 'foot',           // 'foot' | 'car'
  money: 0, wanted: 0, wantedTimer: 0, heat: 0,
  health: 100,            // Mateo's health (foot cops / heli can hurt him)
  busted: false,
  /* Vice City-style police clocks (see sim.js updatePolice):
     footTimer/carTimer = spawn cadence, calmT = seconds with no cop
     within 40 m (decay), foughtT = seconds since the player last
     fought a cop (1★ cops only fight back after this). */
  footTimer: 0, carTimer: 0, calmT: 0, foughtT: 99, heliLockT: 0, heliLock2T: 0,
  aimT: 0, // seconds left of the 0.33 s aim re-entry lock (PedManager.cs)
  aiming: false, // right-mouse hold: aim pose + viewmodel (v3.3)
  missionGlow: false, // staged mission shot: hold the muzzle flash on (v3.3)
  policeStatus: 'PATROL', // PATROL | OBSERVING | PURSUIT | RAMMING | ARREST | HELI LOCK
  mission: 0,             // stage index 0..7
  ammo: 12, emp: 1, smoke: 3,
  carHealth: 100, speedKmh: 0,
  yaw: 0, pitch: 0.18,    // third-person camera orbit (foot)
  carYaw: 0, carSpeed: 0, // driving
  camYaw: 0,              // chase-cam orbit yaw (car mode, mouse can swing it)
  radioTrack: 0, muted: false,
  time: 0, frames: 0,
  drivenCar: null,
  transition: null,       // {phase, side, t, dur, fromX, fromZ, toX, toZ, car} walk-to-door + GetIn
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

/* ---------- helpers ---------- */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function playerPos() { return S.mode === 'car' ? (S.drivenCar || playerCar).position : playerMesh.position; }
function dist2d(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
function toast(msg, ms) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.style.display = 'none'; }, ms || 2400);
}
function say(line) { $('dialog-line').textContent = line; }
/* v3.3.1 — Kira's portrait for the dialog box (top-rank entries all show
   a character portrait in the dialog; v3.3 showed a 🎧 emoji). Painted
   flat on a canvas at boot: pink-haired woman, warm skin, teal jacket
   with headset — simple cel-style shapes, no external asset. */
function paintKiraAvatar() {
  const cv = $('kira-avatar');
  if (!cv) return;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 52, 52);
  // background: sunset gradient
  const bg = g.createLinearGradient(0, 0, 0, 52);
  bg.addColorStop(0, '#FF7A3D'); bg.addColorStop(0.6, '#FF2A6D'); bg.addColorStop(1, '#120458');
  g.fillStyle = bg; g.fillRect(0, 0, 52, 52);
  // pink hair: big rounded mass behind + over the shoulders
  g.fillStyle = '#FF5DA2';
  g.beginPath(); g.ellipse(26, 22, 17, 16, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(10, 38, 6, 12, 0.25, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(42, 38, 6, 12, -0.25, 0, Math.PI * 2); g.fill();
  // shoulders / teal jacket
  g.fillStyle = '#0E7C86';
  g.beginPath(); g.ellipse(26, 52, 19, 10, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#05D9E8'; g.fillRect(24, 44, 4, 8); // jacket zipper
  // neck + face
  g.fillStyle = '#E8B48C'; g.fillRect(23, 34, 6, 8);
  g.beginPath(); g.ellipse(26, 26, 10, 12, 0, 0, Math.PI * 2); g.fill();
  // hair fringe over the forehead
  g.fillStyle = '#FF5DA2';
  g.beginPath(); g.ellipse(26, 16, 10.5, 6, 0, Math.PI, 0); g.fill();
  g.beginPath(); g.ellipse(17, 19, 4, 6, 0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(35, 19, 4, 6, -0.4, 0, Math.PI * 2); g.fill();
  // eyes + brows + smile
  g.fillStyle = '#1A1030';
  g.beginPath(); g.ellipse(22, 26, 1.6, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(30, 26, 1.6, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1A1030'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(20, 22.5); g.lineTo(24, 22); g.moveTo(28, 22); g.lineTo(32, 22.5); g.stroke();
  g.strokeStyle = '#8A2A3A'; g.beginPath(); g.arc(26, 31, 3, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // headset: band over the hair + ear cups
  g.strokeStyle = '#120458'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(26, 24, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  g.fillStyle = '#120458';
  g.beginPath(); g.ellipse(14, 27, 2.5, 4, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(38, 27, 2.5, 4, 0, 0, Math.PI * 2); g.fill();
}
paintKiraAvatar();
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
  const before = S.wanted;
  S.wanted = Math.max(0, Math.min(5, n));
  if (S.wanted !== before) S.calmT = 0;
  if (S.wanted > 0) say(pick([
    'Kira: The whole bay just lit up. Lose them, Mateo!',
    'Kira: Stars on you — keep moving, do not let them box you in!',
    'Kira: Sunset Bay PD is on the radio about you. Drive!',
  ]));
}
/* Damage Mateo on foot (cop punch / cop shot / heli fire). */
function hurtPlayer(dmg) {
  if (S.over || S.busted) return;
  S.health = Math.max(0, S.health - dmg);
  beep(90, 0.15, 'sawtooth', 0.12);
  if (S.health <= 0) wasted();
}
function wasted() {
  S.health = 100;
  S.money = S.money > 100 ? S.money - 100 : 0;
  setWanted(0);
  clearCops();
  playerMesh.position.set(-118, 0, 20);
  if (S.mode === 'car') { S.mode = 'foot'; playerMesh.visible = true; S.drivenCar = null; }
  S.yaw = 0; S.pitch = 0.18;
  say('Mateo, you are patched up. That cost us $100 — stay out of their reach next time.');
  toast('WASTED — TREATED · $100 FEE', 3500);
  saveGame();
}
/* Busted: a 1★ foot cop stood next to Mateo for 2.2 s (Vice City arrest). */
function busted() {
  S.busted = true;
  S.money = S.money > 100 ? S.money - 100 : 0;
  setWanted(0);
  clearCops();
  playerMesh.position.set(-118, 0, 20);
  if (S.mode === 'car') { S.mode = 'foot'; playerMesh.visible = true; S.drivenCar = null; }
  S.yaw = 0; S.pitch = 0.18;
  S.health = 100;
  say('Kira: Busted?! $100 bail, Mateo. Walk it off — and do not let them get that close again.');
  toast('BUSTED — $100 BAIL', 3500);
  saveGame();
  setTimeout(() => { S.busted = false; }, 1000);
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
