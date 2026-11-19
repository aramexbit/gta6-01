// PIER HEAT — core.js
// Global game state, small math/format helpers, the witness rule for crime,
// and the localStorage save. No rendering or simulation lives here.
(function () {
  'use strict';

  // --- tiny utils -----------------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist2(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function angDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function fmtMoney(n) {
    return '$' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function wantedLabel(n) {
    return ['CLEAN', 'HEAT 1 — FOOT PURSUIT', 'HEAT 2 — CRUISERS + ROADBLOCKS',
      'HEAT 3 — HELICOPTER UP', 'HEAT 4 — FULL RESPONSE', 'HEAT 5 — WHOLE CITY'][n] || 'CLEAN';
  }

  // --- city layout constants ------------------------------------------------
  // The city is a 7x7 road grid centred on (0,0). Roads run every 44 m.
  var CITY = {
    half: 150,            // city spans -150..150 m
    pitch: 44,           // spacing between parallel roads
    roads: 7,            // roads per axis
    roadHalf: 4.6,       // half width of a road
    beachX: 168,         // sand starts here (east edge)
    seaX: 205,           // water starts here
    pierX: 196,          // pier deck centre x
    pierZ: 0,
  };
  function roadCoord(i) { return (i - 3) * CITY.pitch; } // i 0..6 -> -132..132
  function nearestRoad(v) { return Math.round(v / CITY.pitch) * CITY.pitch; }
  function onRoad(x, z) {
    var rx = Math.abs(x - nearestRoad(x)), rz = Math.abs(z - nearestRoad(z));
    return rx < CITY.roadHalf + 0.4 || rz < CITY.roadHalf + 0.4;
  }

  // --- districts ------------------------------------------------------------
  var DISTRICTS = [
    { name: 'Ocean Drive', x0: 96, x1: 168, z0: -150, z1: 150, hue: 'pastel deco' },
    { name: 'Little Havana', x0: -150, x1: -44, z0: -150, z1: 150, hue: 'terracotta' },
    { name: 'Downtown', x0: -44, x1: 96, z0: -150, z1: 150, hue: 'glass towers' },
  ];
  function districtAt(x, z) {
    for (var i = 0; i < DISTRICTS.length; i++) {
      var d = DISTRICTS[i];
      if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
    }
    return x >= CITY.beachX ? 'Sunset Beach' : 'Sunset Bay';
  }

  // --- global state ---------------------------------------------------------
  var G = {
    started: false,
    paused: false,
    time: 0,              // seconds since boot
    playTime: 0,
    money: 0,
    missionIndex: 0,      // furthest mission reached (0-based)
    missionDone: 0,
    wanted: 0,            // 0..5
    wantedTimer: 0,       // seconds with no cop within 40 m
    health: 100,
    ammo: Infinity,
    emp: 2,
    smoke: 2,
    player: {
      x: 0, z: 96, heading: 0, speed: 0,
      onFoot: true, aiming: false, walking: false, running: false,
      car: null,           // reference to the car object when driving
    },
    cam: { yaw: 0, pitch: 0.12 },
    radio: 0,              // station index
    flags: {},             // mission scratch flags
    stats: { shots: 0, carsStolen: 0, pedsHit: 0, missionsPaid: 0 },
  };

  // --- the witness rule -----------------------------------------------------
  // A crime only raises the wanted level when someone can see it: a police
  // unit, or a pedestrian still on their feet, within WITNESS_RADIUS metres.
  // No witness, no stars. Entering an ordinary car or a mission car is
  // never a crime at all.
  var WITNESS_RADIUS = 30;
  var DECAY_RADIUS = 40;
  var DECAY_SECONDS = 22;

  function hasWitness(px, pz, cops, peds) {
    var i, d;
    for (i = 0; i < cops.length; i++) {
      d = dist2(px, pz, cops[i].x, cops[i].z);
      if (d <= WITNESS_RADIUS) return { kind: 'cop', dist: d };
    }
    for (i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.fleeing || p.down) continue;
      d = dist2(px, pz, p.x, p.z);
      if (d <= WITNESS_RADIUS) return { kind: 'ped', dist: d };
    }
    return null;
  }

  // Raise wanted by `amount` (capped at 5) only when a witness exists.
  // Returns true when the level actually rose.
  function commitCrime(amount, cops, peds, reason) {
    var w = hasWitness(G.player.x, G.player.z, cops, peds);
    if (!w) return false;
    var before = G.wanted;
    G.wanted = clamp(G.wanted + amount, 0, 5);
    G.wantedTimer = 0;
    if (G.wanted > before && window.PH && window.PH.onWantedRise) {
      window.PH.onWantedRise(G.wanted, reason || 'crime', w.kind);
    }
    return G.wanted > before;
  }

  // Wanted decay: when no police unit is within DECAY_RADIUS for a full
  // DECAY_SECONDS, drop one star. Called every tick with dt and the cops.
  function tickWantedDecay(dt, cops) {
    if (G.wanted <= 0) { G.wantedTimer = 0; return; }
    var near = false;
    for (var i = 0; i < cops.length; i++) {
      if (dist2(G.player.x, G.player.z, cops[i].x, cops[i].z) <= DECAY_RADIUS) { near = true; break; }
    }
    if (near) { G.wantedTimer = 0; return; }
    G.wantedTimer += dt;
    if (G.wantedTimer >= DECAY_SECONDS) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.wantedTimer = 0;
      if (window.PH && window.PH.onWantedFall) window.PH.onWantedFall(G.wanted);
    }
  }

  function setWanted(n, reason) {
    var before = G.wanted;
    G.wanted = clamp(n, 0, 5);
    G.wantedTimer = 0;
    if (G.wanted > before && window.PH && window.PH.onWantedRise) {
      window.PH.onWantedRise(G.wanted, reason || 'set', 'scripted');
    }
    return G.wanted;
  }

  // --- save / load ----------------------------------------------------------
  var SAVE_KEY = 'pierheat-sunsetbay-save-v1';
  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: G.money,
        missionIndex: G.missionIndex,
        missionDone: G.missionDone,
        emp: G.emp,
        smoke: G.smoke,
        radio: G.radio,
        savedAt: Date.now(),
      }));
      return true;
    } catch (e) { return false; }
  }
  function loadGame() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (typeof s.money === 'number') G.money = s.money;
      if (typeof s.missionIndex === 'number') G.missionIndex = s.missionIndex;
      if (typeof s.missionDone === 'number') G.missionDone = s.missionDone;
      if (typeof s.emp === 'number') G.emp = s.emp;
      if (typeof s.smoke === 'number') G.smoke = s.smoke;
      if (typeof s.radio === 'number' && s.radio >= 0 && s.radio < STATIONS.length) G.radio = s.radio;
      return s;
    } catch (e) { return null; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  // --- radio stations (original music, made of oscillators) -----------------
  var STATIONS = [
    { name: 'Nightwave 98.3', track: 'Running Red', bpm: 96, root: 110, minor: true },
    { name: 'Palma FM 104.1', track: 'Café Neon', bpm: 78, root: 130.8, minor: false },
    { name: 'Bay Static 88.9', track: 'Low Tide Drive', bpm: 112, root: 98, minor: true },
  ];

  // --- public namespace -----------------------------------------------------
  window.PH = window.PH || {};
  var PH = window.PH;
  PH.G = G;
  PH.CITY = CITY;
  PH.DISTRICTS = DISTRICTS;
  PH.STATIONS = STATIONS;
  PH.WITNESS_RADIUS = WITNESS_RADIUS;
  PH.DECAY_RADIUS = DECAY_RADIUS;
  PH.DECAY_SECONDS = DECAY_SECONDS;
  PH.utils = { clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, pick: pick, dist2: dist2, angDiff: angDiff, fmtMoney: fmtMoney, fmtTime: fmtTime, wantedLabel: wantedLabel, roadCoord: roadCoord, nearestRoad: nearestRoad, onRoad: onRoad, districtAt: districtAt };
  PH.crime = { hasWitness: hasWitness, commitCrime: commitCrime, tickWantedDecay: tickWantedDecay, setWanted: setWanted };
  PH.save = { saveGame: saveGame, loadGame: loadGame, clearSave: clearSave, SAVE_KEY: SAVE_KEY };
  PH.onWantedRise = null;
  PH.onWantedFall = null;
})();
