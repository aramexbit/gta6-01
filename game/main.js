// PIER HEAT — Sunset Bay v7.4
// main.js — boot, input, save/load, the 4 staged shots, the free-play
// loop and the minimap update. Wires the procedural Mateo/Kira
// (mateo.js), the boat chase (boats.js), the street race (races.js)
// and the canvas portraits (portraits.js). Plain script; uses window.PH.
// v7.4: shot 3 stages Mateo AT THE HELM of the speedboat on the water
// (police boats + heli in pursuit), and shot 1 runs both rivals big
// and close beside the hero.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  window.__errors = [];
  window.__ready = false;
  window.__mateoLoaded = false;
  window.addEventListener('error', function (e) { window.__errors.push(String(e.message || e.error)); });
  window.addEventListener('unhandledrejection', function (e) { window.__errors.push('promise: ' + String(e.reason)); });

  var params = new URLSearchParams(location.search);
  var shotNum = parseInt(params.get('shot') || '0', 10) || 0;
  var seed = parseInt(params.get('seed') || '1', 10) || 1;
  var isShot = shotNum >= 1 && shotNum <= 4;
  var mode = (shotNum === 1 || shotNum === 4) ? 'sunset' : 'day';
  PH.seed(seed);

  // ---------- renderer ----------
  var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'webgl';
  document.getElementById('app').prepend(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);

  // ---------- world + sim ----------
  var world = PH.buildWorld(scene, mode);
  var traffic = new PH.Traffic(scene);
  var cityCrowd = new PH.CityCrowd(scene);
  var beachCrowd = new PH.BeachCrowd(scene);
  var police = new PH.Police(scene);
  var heli = PH.makeHeli();
  scene.add(heli);
  var hero = PH.makeCar({ kind: 'hero' });
  scene.add(hero);
  var flash = new PH.MuzzleFlash(scene);
  // v7.3 systems: boat chase on the water + street race on the roads
  var boatChase = new PH.BoatChase(scene);
  var race = new PH.Race(scene);
  // crew cards (canvas portraits) are built once the HUD exists
  if (PH.buildCrewCards) PH.buildCrewCards();

  // ---------- game state ----------
  var S = {
    wanted: 0, health: 100, armor: 80, ammo: 12, money: 24750,
    speed: 0, // units/s of the hero car
    onFoot: false, heading: 0, // hero heading (radians, 0 = +Z south)
    heroPos: new THREE.Vector3(-20, 0, 8),
    mateoPos: new THREE.Vector3(-10, 0, -4),
    mateoHeading: 0, // face direction: 0 = south (+Z), PI/2 = east, -PI/2 = north; procedural rig faces +Z, offset 0
    objective: { x: -58, z: 40 },
    radio: 'NIGHTWAVE 98.3 — SUNSET DRIVE',
    started: false, time: 0, frames: 0
  };
  var mateo = null, kira = null;

  // ---------- shot-3 beach foreground (round 2) ----------
  // The v7.4 shot 3 frame was half empty sand: the boat sat 38 units
  // away and the bottom of the frame was bare beach. The new camera
  // sits ~15 units from the boat, and this foreground fills the sand
  // between lens and boat — one umbrella, towels, sunbathers and a
  // sandcastle, all LOW (lying / flat) except the umbrella, which
  // frames the left edge instead of covering the boat.
  function beachForeground3() {
    var g = new THREE.Group();
    var cols = [0xff3b30, 0xffc832, 0x2a9df4, 0xff6ab0];
    function umbrella(x, z, color, scale) {
      var ug = new THREE.Group(); ug.position.set(x, 0, z);
      ug.scale.setScalar(scale || 1);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.7 }));
      pole.position.y = 1.3; ug.add(pole);
      var canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 10),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 }));
      canopy.position.y = 2.8; canopy.castShadow = true; ug.add(canopy);
      g.add(ug);
    }
    function towel(x, z, color, ry) {
      var tw = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.95 }));
      tw.rotation.x = -Math.PI / 2; tw.rotation.z = ry || 0;
      tw.position.set(x, 0.08, z); g.add(tw);
    }
    function sunbather(x, z, ry, shirt) {
      var p = PH.makePerson({ shirt: shirt });
      p.group.position.set(x, 0, z);
      p.group.rotation.y = ry;
      p.setPose('lying', 0, 5);
      g.add(p.group);
      towel(x, z, 0xffc832, ry);
    }
    function sandcastle(x, z) {
      var c = new THREE.Group(); c.position.set(x, 0, z);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 1 }));
      base.position.y = 0.45; c.add(base);
      var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 1 }));
      tower.position.set(0.3, 1.0, 0.2); c.add(tower);
      var flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.8 }));
      flag.position.set(0.3, 1.9, 0.2); c.add(flag);
      g.add(c);
    }
    // round 2b: every foreground prop sits OFF the lens-to-boat line
    // (the first layout put the umbrella + cooler dead centre and hid
    // the boat). The umbrella frames the left edge, the sunbathers lie
    // low left, the cooler + bag sit at the far left edge.
    umbrella(-109, 47, cols[0], 0.8);
    towel(-106, 42, cols[1], 0.4);
    towel(-105, 45, cols[2], -0.3);
    sunbather(-106, 41.5, 0.6, 0xd83a2a);
    sunbather(-105, 44.5, -0.4, 0x0e7a7a);
    sandcastle(-104, 41);
    // a cooler + beach bag at the towel line, so the foreground has
    // small props as well as people
    var cooler = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x2a9df4, roughness: 0.6 }));
    cooler.position.set(-109, 0.25, 48.5); g.add(cooler);
    var bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff6ab0, roughness: 0.9 }));
    bag.position.set(-107, 0.3, 49.5); bag.rotation.y = 0.5; g.add(bag);
    scene.add(g);
    return g;
  }

  // Push any beach NPC that would drift into the shot-3 frame (within
  // `radius` of the camera) out of the way: swimmers go further west
  // into deep water, land NPCs go east up the beach. Staged shots only.
  function clearBeachNearCamera(camPos, radius) {
    beachCrowd.members.forEach(function (m) {
      var pos = m.p.group.position;
      var dx = pos.x - camPos.x, dz = pos.z - camPos.z;
      if (dx * dx + dz * dz < radius * radius) {
        if (m.pose === 'swim' || m.pose === 'surf') { pos.x = -150; pos.z = PH.clamp(pos.z + 40, -120, 120); }
        else { pos.x = -60; pos.z = PH.clamp(pos.z - 30, -130, 130); }
        m.home.copy(pos);
      }
    });
  }

  // ---------- foreground prop sets (frame edges, hero + action stay clear) ----
  function foregroundSet(n) {
    var g = new THREE.Group();
    function crate(x, y, z, s) {
      var c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
        new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 }));
      c.position.set(x, y + s / 2, z); c.rotation.y = PH.rand(0, 1); c.castShadow = true;
      g.add(c);
    }
    function bin(x, z) {
      var b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 1.0, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.7, metalness: 0.3 }));
      b.position.set(x, 0.5, z); b.castShadow = true; g.add(b);
    }
    function hydrant(x, z) {
      var h = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.6 }));
      h.position.set(x, 0.45, z); g.add(h);
    }
    function bench(x, z, ry) {
      var b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry || 0;
      var seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 0.9 }));
      seat.position.y = 0.55; b.add(seat);
      g.add(b);
    }
    function cart(x, z, ry) {
      // tipped fruit cart — v7.4: the fruit stays IN the tray and in
      // two crates beside it; the v7.3 scatter of 14 loose fruit read
      // as litter across the road
      var c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry || 0;
      var tray = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x8a4a20, roughness: 0.9 }));
      tray.position.y = 0.5; tray.rotation.z = 0.9; c.add(tray);
      var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }));
      wheel.rotation.x = Math.PI / 2; wheel.position.set(0.7, 0.35, 0); c.add(wheel);
      g.add(c);
      var fruitCols = [0xff7a1a, 0xff3b30, 0xffc832, 0x37d67a];
      for (var i = 0; i < 4; i++) {
        var f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
          new THREE.MeshStandardMaterial({ color: fruitCols[i % 4], roughness: 0.5 }));
        f.position.set(x + PH.rand(-0.5, 0.5), 0.62, z + PH.rand(-0.3, 0.3));
        g.add(f);
      }
      [-1.2, 1.2].forEach(function (dx) {
        var crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7),
          new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 }));
        crate.position.set(x + dx, 0.25, z + 0.8); g.add(crate);
        for (var j = 0; j < 3; j++) {
          var cf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6),
            new THREE.MeshStandardMaterial({ color: fruitCols[(i + j) % 4], roughness: 0.5 }));
          cf.position.set(x + dx - 0.18 + (j % 2) * 0.36, 0.55, z + 0.8 + (j < 2 ? -0.15 : 0.15));
          g.add(cf);
        }
      });
    }
    function towelSurf(x, z) {
      var tw = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0),
        new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.95 }));
      tw.rotation.x = -Math.PI / 2; tw.position.set(x, 0.08, z); g.add(tw);
      var bd = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.55, 2.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a9df4, roughness: 0.5 }));
      bd.scale.z = 0.28; bd.position.set(x + 1.6, 1.1, z); g.add(bd);
    }
    function bucket(x, z) {
      var b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 10),
        new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.7 }));
      b.position.set(x, 0.22, z); g.add(b);
    }
    function edgeWalkers(n, spots) {
      for (var i = 0; i < n; i++) {
        var sp = spots[i % spots.length];
        var p = PH.makePerson({});
        p.group.position.set(sp[0] + PH.rand(-1, 1), sp[2] || 0, sp[1] + PH.rand(-1, 1));
        p.group.rotation.y = PH.rand(0, Math.PI * 2);
        p.setPose('walk', 0, 6);
        g.add(p.group);
      }
    }
    if (n === 1) { // chase: cart + crate + bin + hydrant + bench + 3 walkers, road edge
      cart(-27.5, 14, 0.4); crate(-28.6, 0, 17, 0.9); bin(-11.8, 16); hydrant(-28.4, 10); bench(-12, 18, 0.2);
      edgeWalkers(3, [[-28.8, 12, 0], [-11.5, 13, 0], [-28.8, 20, 0]]);
    } else if (n === 2) { // on foot: props + 6 walkers along the frame EDGES of the east sidewalk, 9-13 units out (rev 5: at 3-6 units they filled half the frame)
      cart(-14.2, -10, -0.3); crate(-5.6, -12, 0.9); bin(-14.2, -12); bench(-5.6, -9, 0); hydrant(-14.2, -8.5);
      edgeWalkers(6, [[-14.5, -9, 0], [-14.5, -12, 0], [-5.5, -10, 0], [-5.5, -13, 0], [-14.5, -11, 0], [-5.5, -8.5, 0]]);
    } else if (n === 3) { // mission: pier end — props on the NEAR rail
      // (z 43.4, the rail closest to the shot-3 camera) and the west
      // deck end, so the bottom-right wood is dressed, not bare
      crate(-78, 1.35, 43.4, 0.9); towelSurf(-84, 43.4); bin(-86, 43.4); bucket(-72, 43.4);
      edgeWalkers(5, [[-76, 43.4, 1.35], [-68, 43.4, 1.35], [-72, 37, 1.35], [-80, 37, 1.35], [-66, 43.4, 1.35]]);
    } else { // combat: cart + crate + bin + hydrant + 5 walkers/runners, road edges only (rev 3: the old mid-road walker at (-20,24) stood 1.5 units from the lens)
      cart(-27.5, 28, 0.5); crate(-28.6, 0, 24, 0.9); bin(-11.8, 30); hydrant(-28.4, 33);
      edgeWalkers(5, [[-28.8, 26, 0], [-11.5, 28, 0], [-27, 33, 0], [-28.8, 38, 0], [-11.5, 36, 0]]);
    }
    scene.add(g);
    return g;
  }

  // ---------- HUD helpers ----------
  function applyHUD(cfg) {
    PH.hud.setObjective(cfg.objective);
    PH.hud.setWanted(cfg.wanted);
    PH.hud.setMoney(cfg.money);
    PH.hud.setHealth(cfg.health);
    PH.hud.setArmor(cfg.armor);
    PH.hud.setAmmo(cfg.ammo, 12);
    PH.hud.setSpeed(cfg.speedKmh || 0);
    PH.hud.setCar(cfg.carStatus);
    PH.hud.setRadio(cfg.radio);
    PH.hud.setDispatch(cfg.dispatch || null);
    PH.hud.setWeapon('pistol');
    if (cfg.ammoSmg != null) { var s = document.getElementById('ammo-smg'); if (s) s.textContent = cfg.ammoSmg + '/30'; }
    if (cfg.ammoRifle != null) { var r = document.getElementById('ammo-rifle'); if (r) r.textContent = cfg.ammoRifle + '/24'; }
    if (cfg.ammoShotgun != null) { var sg = document.getElementById('ammo-shotgun'); if (sg) sg.textContent = cfg.ammoShotgun + '/6'; }
    if (cfg.carName) PH.hud.setCarName(cfg.carName, cfg.carCond);
    if (cfg.race) { PH.hud.setRace(cfg.race.pos, cfg.race.total, cfg.race.lap, cfg.race.laps, cfg.race.countdown); PH.hud.setRaceGap(cfg.race.gap); }
    else { PH.hud.setRace(0, 0, 0, 0, null); PH.hud.setRaceGap(null); }
    if (cfg.boat) PH.hud.setBoat(cfg.boat.speedKn, cfg.boat.dist, cfg.boat.police, cfg.boat.pos, cfg.boat.total);
    if (cfg.crew) cfg.crew.forEach(function (c) { PH.hud.setCrew(c.who, c.status); });
    if (cfg.dialog) PH.hud.setDialog(cfg.dialog.who, cfg.dialog.name, cfg.dialog.text);
    else PH.hud.setDialog(null);
  }

  // Keep staged shots clear: push any crowd walker that would drift in
  // front of the lens (within `radius` of the camera) 40 units along its
  // lane. Walkers move ~2 u/s and the screenshot comes ~5 s after staging,
  // so a 14-unit radius keeps the frame clear. Free play is untouched.
  function clearCrowdNearCamera(camPos, radius) {
    cityCrowd.people.forEach(function (w) {
      var pos = w.p.group.position;
      var dx = pos.x - camPos.x, dz = pos.z - camPos.z;
      if (dx * dx + dz * dz < radius * radius) {
        if (w.lane.axis === 'z') pos.z = PH.clamp(pos.z + (pos.z > camPos.z ? 40 : -40), -165, 165);
        else pos.x = PH.clamp(pos.x + (pos.x > camPos.x ? 40 : -40), -8, 165);
      }
    });
    cityCrowd.pier.forEach(function (w) {
      var pos = w.p.group.position;
      var dx = pos.x - camPos.x, dz = pos.z - camPos.z;
      if (dx * dx + dz * dz < 36) pos.x = PH.clamp(pos.x - 20, -84, -32);
    });
  }

  // ---------- staging ----------
  function stageShot() {
    var cfg;
    if (shotNum === 1) {
      // COVER — sunset chase, wanted 3
      S.wanted = 3; S.health = 100; S.armor = 80; S.ammo = 12; S.money = 24750;
      S.speed = 26; S.onFoot = false; S.objective = { x: -58, z: 40 };
      S.heroPos.set(-20, 0, 8); S.heading = THREE.MathUtils.degToRad(198);
      hero.position.copy(S.heroPos); hero.rotation.y = S.heading;
      var cruisers1 = [[-16.5, -2], [-23.5, -8], [-16.5, -18]];
      police.cruisers.forEach(function (c, i) {
        c.position.set(cruisers1[i][0], 0, cruisers1[i][1]);
        c.rotation.y = Math.PI; // facing south
      });
      police.officers.forEach(function (o, i) { o.group.position.set(-30 + i * 3, 0, -30); });
      traffic.freeze([
        { x: -23.5, z: -30, heading: 0 }, { x: -16.5, z: -42, heading: 0 },
        { x: 8, z: -40, heading: Math.PI / 2 }, { x: 30, z: -40, heading: Math.PI / 2 }
      ]);
      heli.position.set(-30, 11, -25); heli.rotation.y = THREE.MathUtils.degToRad(135);
      camera.fov = 46; camera.updateProjectionMatrix();
      camera.position.set(-15, 3.2, 21);
      camera.lookAt(-20, 1.6, -2);
      foregroundSet(1);
      // v7.3: street race is live in shot 1 — the next checkpoint gate
      // arches over the road ahead and a rival car runs alongside.
      race.stageShot();
      // v7.5: wet-road taillight streaks (wetroad.js) — the hero's red
      // lamps and the cruisers' lights smear on the wet asphalt
      // toward the camera. Hero rear = hero (-20,8) minus 2.4 along
      // forward (sin 198°, cos 198°); cruisers face south, so their
      // rears sit 2.4 north of their positions.
      if (PH.carWetStreak) {
        PH.carWetStreak(scene, -19.3, 10.3, 0xff2a1a);
        PH.carWetStreak(scene, -16.5, 0.4, 0xff5040);
        PH.carWetStreak(scene, -23.5, -5.6, 0xff5040);
        PH.carWetStreak(scene, -16.5, -15.6, 0xff5040);
      }
      cfg = {
        objective: { title: 'PIER HEAT — STREET RACE', stage: 'STAGE 2/3 — LOSE THE HEAT', progress: 66, timer: '02:41', text: 'Beat the rival through the checkpoints and lose the PD.', next: 'NEXT: Checkpoint 3/14 — follow the amber gate' },
        wanted: 3, money: 24750, health: 100, armor: 80, ammo: 12, speedKmh: 96,
        carStatus: 'SCARLET ARROW — READY', carName: 'SCARLET ARROW', carCond: 98,
        radio: 'NIGHTWAVE 98.3 — SUNSET DRIVE',
        race: { pos: 2, total: 4, lap: 1, laps: 2, countdown: null, gap: 0.4 },
        crew: [
          { who: 'mateo', status: 'RACING' },
          { who: 'kira', status: 'ON THE RADIO' },
          { who: 'dario', status: 'IN THE PIT' },
          { who: 'lena', status: 'ON CALL' }
        ],
        dispatch: [
          { tactic: 'PURSUIT', unit: 'PD-104', role: 'CRUISER', dist: 42 },
          { tactic: 'RAMMING', unit: 'PD-111', role: 'CRUISER', dist: 68 },
          { tactic: 'SPOTLIGHT', unit: 'HELI-1', role: 'AIR UNIT', dist: 91 },
          { tactic: 'ROADBLOCK', unit: 'PD-125', role: 'CRUISER', dist: 120 },
          { tactic: 'PURSUIT', unit: 'PD-130', role: 'CRUISER', dist: 155 },
          { tactic: 'SPOTLIGHT', unit: 'HELI-2', role: 'AIR UNIT', dist: 210 }
        ]
      };
    } else if (shotNum === 2) {
      // ON FOOT — day, Mateo faces the camera, big in frame
      S.wanted = 0; S.health = 100; S.armor = 80; S.ammo = 12; S.money = 48250;
      S.onFoot = true; S.objective = { x: -58, z: 40 };
      S.mateoPos.set(-10, 0, -4); S.mateoHeading = 0; // facing south, toward the camera (camera is south of Mateo)
      hero.position.set(-20, 0, -30); hero.rotation.y = Math.PI;
      police.cruisers.forEach(function (c, i) { c.position.set(-60 + i * 6, 0, -60); c.rotation.y = Math.PI; });
      police.officers.forEach(function (o, i) { o.group.position.set(-40 + i * 3, 0, -70); });
      traffic.freeze([
        { x: -23.5, z: -34, heading: 0 }, { x: -16.5, z: -52, heading: 0 },
        { x: -23.5, z: 12, heading: 0 }
      ]);
      heli.position.set(-27, 8, -38); heli.rotation.y = THREE.MathUtils.degToRad(108); // round 2: pulled in + down (was (-30,9,-42)) — the rotor brushed the top frame edge in the v7.4 shot; now the whole heli sits inside the frame with margin
      camera.fov = 50; camera.updateProjectionMatrix();
      camera.position.set(-10, 2.0, -0.5);
      camera.lookAt(-10, 1.5, -6); // camera restored to the v7.2 spot; the lamp pole that blocked it is skipped in world.js instead
      // v7.5: Mateo's heading is derived from the camera, not a
      // constant, so he can never face away again if the camera moves
      // — he looks straight down the lens. (The v7.4 render already
      // showed his face; this makes it structural, not luck.)
      S.mateoHeading = Math.atan2(camera.position.x - S.mateoPos.x, camera.position.z - S.mateoPos.z);
      foregroundSet(2);
      cfg = {
        objective: { title: 'PIER HEAT — MEET KIRA', stage: 'STAGE 1/3 — MEET KIRA', progress: 33, timer: '', text: 'Meet Kira at the pier — follow the yellow marker.', next: 'NEXT: Meet Kira at the pier — follow the yellow marker' },
        wanted: 0, money: 48250, health: 100, armor: 80, ammo: 12, speedKmh: 0,
        carStatus: 'ON FOOT — MATEO VEGA', carName: 'MATEO VEGA', carCond: null,
        radio: 'NEON STREETS', dispatch: null,
        crew: [
          { who: 'mateo', status: 'ON FOOT' },
          { who: 'kira', status: 'WAITING AT PIER' },
          { who: 'dario', status: 'IN THE PIT' },
          { who: 'lena', status: 'ON CALL' }
        ]
      };
    } else if (shotNum === 3) {
      // MISSION — day, ON THE WATER (v7.4): Mateo stands AT THE HELM
      // of the speedboat in his life vest, both hands on the wheel,
      // wake behind him and two police boats + the heli in pursuit.
      // Kira stays on the pier end, waving him off. The boat chase is
      // the shot now — a gameplay scene the top entries do not show.
      S.wanted = 0; S.health = 100; S.armor = 80; S.ammo = 12; S.money = 36900;
      S.onFoot = true; S.objective = { x: -112, z: 40 };
      boatChase.stageShot();
      var deck = boatChase.deckPos();
      S.mateoPos.set(deck.x, deck.y, deck.z); S.mateoHeading = deck.heading; // facing the bow (east), hands on the helm
      hero.position.set(-20, 0, 60); hero.rotation.y = Math.PI;
      police.cruisers.forEach(function (c, i) { c.position.set(-60 + i * 6, 0, 80); c.rotation.y = Math.PI; });
      police.officers.forEach(function (o, i) { o.group.position.set(-40 + i * 3, 0, 90); });
      traffic.freeze([
        { x: -23.5, z: 30, heading: 0 }, { x: -16.5, z: 44, heading: 0 }
      ]);
      // heli over the water, spotlight toward the boats — round 2b:
      // lowered to y 7 so the whole heli AND its rotor sit inside the
      // closer shot-3 frame instead of brushing its top edge
      // v7.5: lowered again, 7 -> 5.2 — the v7.4 render still had the
      // rotor blades ~60 px from the top edge, so the heli drops until
      // the whole disc has clear sky above it.
      heli.position.set(-114, 5.2, 30); heli.rotation.y = THREE.MathUtils.degToRad(144);
      camera.fov = 50; camera.updateProjectionMatrix();
      // round 2: the camera moves in from 38 units to ~15, so the boat
      // + Mateo fill a third of the frame instead of a tenth — and the
      // sand between lens and boat is dressed with beachgoers, not bare
      camera.position.set(-99, 3.0, 50);
      camera.lookAt(-111, 1.0, 40.5);
      foregroundSet(3);
      beachForeground3();
      clearBeachNearCamera(camera.position, 22);
      cfg = {
        objective: { title: 'PIER HEAT — THE BOAT JOB', stage: 'STAGE 1/3 — THE BOAT JOB', progress: 20, timer: '', text: 'You are at the helm — police boats are already on the water. Cut across the bay and don\'t look back.', next: 'NEXT: Outrun the police boats across the bay' },
        wanted: 0, money: 36900, health: 100, armor: 80, ammo: 12, speedKmh: 0,
        carStatus: 'AT THE HELM — SPEEDBOAT', carName: 'SPEEDBOAT', carCond: 100,
        radio: 'PIER LIGHTS', dispatch: null,
        boat: { speedKn: 32, dist: 120, police: 38, pos: 1, total: 2 },
        crew: [
          { who: 'mateo', status: 'AT THE HELM' },
          { who: 'kira', status: 'ON THE BOAT' },
          { who: 'dario', status: 'FUELLED THE BOAT' },
          { who: 'lena', status: 'ON CALL' }
        ],
        dialog: { who: 'kira', name: 'KIRA — HANDLER', text: 'Hold on — police boats closing in from behind. Keep her straight and don\'t look back.' }
      };
    } else {
      // COMBAT — sunset, wanted 5, Mateo shooting
      S.wanted = 5; S.health = 82; S.armor = 65; S.ammo = 9; S.money = 84300;
      S.speed = 0; S.onFoot = true; S.objective = { x: -20, z: 40 };
      S.mateoPos.set(-19.5, 0, 31); S.mateoHeading = 0; // facing south (back to camera)
      hero.position.set(-24, 0, 34); hero.rotation.y = Math.PI;
      var cruisers4 = [[-23.5, 43], [-16.5, 49], [-23.5, 57]];
      police.cruisers.forEach(function (c, i) {
        c.position.set(cruisers4[i][0], 0, cruisers4[i][1]);
        c.rotation.y = Math.PI;
      });
      var offs = [[-21.5, 39], [-18, 41.5], [-23, 36.5]];
      police.officers.forEach(function (o, i) {
        o.group.position.set(offs[i][0], 0, offs[i][1]);
        // round 2: officers face SOUTH (rotation 0) — toward Mateo and
        // the camera — so their white helmets, hi-vis vests and faces
        // read. The old rotation (PI, facing north) showed only their
        // dark backs, and they read as black blobs.
        o.group.rotation.y = 0;
        o.setPose('aim', 0, 5);
      });
      traffic.freeze([
        { x: -16.5, z: 12, heading: 0 }, { x: -23.5, z: -2, heading: 0 }
      ]);
      heli.position.set(-26, 7, 58); heli.rotation.y = THREE.MathUtils.degToRad(126);
      camera.fov = 50; camera.updateProjectionMatrix();
      camera.position.set(-17.5, 2.8, 25.5);
      camera.lookAt(-20.5, 1.5, 36);
      foregroundSet(4);
      // v7.5: wet-road taillight streaks (wetroad.js) — the hero and
      // the three cruisers all face north (heading PI), so their rears
      // sit 2.4 south of their positions and the red smears run toward
      // the camera, which stands north of them.
      if (PH.carWetStreak) {
        PH.carWetStreak(scene, -24, 36.4, 0xff2a1a);
        PH.carWetStreak(scene, -23.5, 45.4, 0xff5040);
        PH.carWetStreak(scene, -16.5, 51.4, 0xff5040);
        PH.carWetStreak(scene, -23.5, 59.4, 0xff5040);
      }
      cfg = {
        objective: { title: 'PIER HEAT — HOLD THE LINE', stage: 'STAGE 3/3 — HOLD THE LINE', progress: 85, timer: '01:12', text: 'The Bay City PD wants the Scarlet Arrow. Hold the line.', next: 'NEXT: Hold the line — protect the Scarlet Arrow' },
        wanted: 5, money: 84300, health: 82, armor: 65, ammo: 9, speedKmh: 0,
        carStatus: 'SCARLET ARROW — BATTLE-WORN', carName: 'SCARLET ARROW', carCond: 76,
        radio: 'SIRENS', ammoSmg: 0, ammoRifle: 0, ammoShotgun: 0,
        crew: [
          { who: 'mateo', status: 'HOLDING THE LINE' },
          { who: 'kira', status: 'ON THE RADIO' },
          { who: 'dario', status: 'IN THE PIT' },
          { who: 'lena', status: 'ON CALL' }
        ],
        dispatch: [
          { tactic: 'RAMMING', unit: 'PD-104', role: 'CRUISER', dist: 18 },
          { tactic: 'PURSUIT', unit: 'PD-111', role: 'CRUISER', dist: 24 },
          { tactic: 'PURSUIT', unit: 'PD-118', role: 'CRUISER', dist: 31 },
          { tactic: 'SPOTLIGHT', unit: 'HELI-1', role: 'AIR UNIT', dist: 55 },
          { tactic: 'ROADBLOCK', unit: 'PD-122', role: 'CRUISER', dist: 74 },
          { tactic: 'K9', unit: 'PD-127', role: 'K9 UNIT', dist: 96 }
        ]
      };
    }
    clearCrowdNearCamera(camera.position, 14);
    applyHUD(cfg);
    return cfg;
  }

  // ---------- Mateo + Kira loading ----------
  function placeMateo() {
    if (!mateo) return;
    mateo.root.position.copy(S.mateoPos);
    mateo.root.rotation.y = S.mateoHeading + (mateo.forwardOffset || 0);
    if (shotNum === 3) {
      // v7.4: Mateo stands at the helm of the speedboat, life vest on,
      // both hands on the wheel — the drive pose, not idle
      mateo.setBoatGear(true);
      mateo.setAnim('drive');
    } else {
      mateo.setBoatGear(false);
      if (shotNum === 2) mateo.setAnim('walk');
      else if (shotNum === 4) mateo.setAnim('aim');
      else mateo.setAnim('idle');
    }
  }
  function placeKira() {
    if (!kira) return;
    if (shotNum === 3) {
      // v7.4 rev 2: Kira rides along on the stern bench, life vest on,
      // facing back toward the police boats — the pier-end spot put
      // her behind the minimap, so she joins the boat instead
      var stern = boatChase.sternPos();
      kira.root.position.set(stern.x, stern.y, stern.z);
      kira.root.rotation.y = stern.heading + (kira.forwardOffset || 0);
      kira.setBoatGear(true);
      kira.setAnim('point'); // round 2: Kira points at the police boats closing in, instead of waving — the chase reads as a chase
    } else {
      kira.root.position.set(-14, 0, -60);
      kira.root.rotation.y = (kira.forwardOffset || 0);
      kira.setAnim('idle');
    }
  }
  PH.loadMateo(scene, { MateoJacket: 0xff7a1a }, function (api) {
    mateo = api;
    window.__mateoLoaded = api.loaded;
    placeMateo();
    if (shotNum === 4) flash.place(S.mateoPos, S.mateoHeading, true);
  });
  PH.loadMateo(scene, { MateoJacket: 0x0e7a7a, MateoTee: 0x222831, MateoHair: 0x2a1a12 }, function (api) {
    kira = api;
    placeKira();
  });

  // ---------- input (free play) ----------
  var keys = {};
  addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'KeyM') PH.Audio.toggleMute();
    if (e.code === 'KeyP' && !isShot) saveGame();
    if (e.code === 'KeyF' && !isShot) toggleFoot();
  });
  addEventListener('keyup', function (e) { keys[e.code] = false; });
  addEventListener('mousedown', function () {
    PH.Audio.init();
    if (!isShot && S.onFoot && S.ammo > 0) shoot();
  });
  document.getElementById('mute-btn').addEventListener('click', function () {
    PH.Audio.init(); PH.Audio.toggleMute();
  });
  document.getElementById('start-btn').addEventListener('click', function () {
    PH.Audio.init();
    document.getElementById('title-screen').style.display = 'none';
    S.started = true;
    PH.hud.toast('Engine started — lose the heat, reach the pier.');
  });

  function toggleFoot() {
    S.onFoot = !S.onFoot;
    if (S.onFoot) {
      S.mateoPos.copy(S.heroPos);
      S.mateoHeading = S.heading;
      if (mateo) { mateo.root.position.copy(S.mateoPos); mateo.root.rotation.y = S.mateoHeading + (mateo.forwardOffset || 0); }
      PH.hud.setCar('ON FOOT — MATEO VEGA • HP ' + Math.round(S.health) + '%');
    } else {
      S.heroPos.copy(S.mateoPos);
      hero.position.copy(S.heroPos);
      PH.hud.setCar('SCARLET ARROW • 98%');
    }
  }
  function shoot() {
    S.ammo = Math.max(0, S.ammo - 1);
    PH.hud.setAmmo(S.ammo, 12);
    if (mateo) flash.place(S.mateoPos, S.mateoHeading, false);
    PH.Audio.gunshot();
    setTimeout(function () { flash.hide(); }, 120);
  }

  // ---------- save / load ----------
  function saveGame() {
    try {
      localStorage.setItem('pierheat-save-v69', JSON.stringify({
        pos: [S.heroPos.x, S.heroPos.z], heading: S.heading, wanted: S.wanted,
        health: S.health, armor: S.armor, ammo: S.ammo, onFoot: S.onFoot
      }));
      PH.hud.toast('Progress saved.');
    } catch (e) {}
  }
  function loadGame() {
    try {
      var raw = localStorage.getItem('pierheat-save-v69');
      if (!raw) return;
      var d = JSON.parse(raw);
      S.heroPos.set(d.pos[0], 0, d.pos[1]);
      S.heading = d.heading || 0;
      S.wanted = d.wanted || 0; S.health = d.health || 100;
      S.armor = d.armor || 0; S.ammo = d.ammo != null ? d.ammo : 12;
      S.onFoot = !!d.onFoot;
    } catch (e) {}
  }

  // ---------- boot ----------
  var shotCfg = null;
  if (isShot) {
    shotCfg = stageShot();
    // v7.3: characters load synchronously now (procedural, no fetch),
    // so the loader callbacks ran BEFORE stageShot set the shot
    // positions — re-place both characters (and the shot-4 flash)
    // here, after staging, or Mateo stands at the default spawn.
    placeMateo();
    placeKira();
    if (shotNum === 4) flash.place(S.mateoPos, S.mateoHeading, true);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    S.started = true;
  } else {
    loadGame();
    hero.position.copy(S.heroPos);
    hero.rotation.y = S.heading;
    police.cruisers.forEach(function (c, i) {
      c.position.set(-16.5 - (i % 2) * 7, 0, -20 - i * 25);
      c.rotation.y = Math.PI;
    });
    police.officers.forEach(function (o, i) { o.group.position.set(-30 + i * 4, 0, -40); });
    heli.position.set(-30, 34, -20);
    applyHUD({
      objective: { title: 'PIER HEAT — MEET KIRA', stage: 'STAGE 1/3 — MEET KIRA', progress: 33, timer: '', text: 'Meet Kira at the pier — follow the yellow marker.', next: 'NEXT: Meet Kira at the pier — follow the yellow marker' },
      wanted: S.wanted, money: S.money, health: S.health, armor: S.armor, ammo: S.ammo,
      speedKmh: 0, carStatus: S.onFoot ? 'ON FOOT — MATEO VEGA • HP 100%' : 'SCARLET ARROW • 98%',
      radio: 'NIGHTWAVE 98.3 — SUNSET DRIVE', dispatch: null
    });
    document.getElementById('loading').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('title-screen').style.display = 'flex';
    if (mateo) placeMateo();
  }

  // ---------- free-play update ----------
  function freePlay(dt) {
    if (!S.started) return;
    var accel = 0;
    if (keys.KeyW || keys.ArrowUp) accel += 1;
    if (keys.KeyS || keys.ArrowDown) accel -= 0.6;
    if (keys.Space) accel -= Math.sign(S.speed) * 1.6;
    if (!S.onFoot) {
      var steer = 0;
      if (keys.KeyA || keys.ArrowLeft) steer += 1;
      if (keys.KeyD || keys.ArrowRight) steer -= 1;
      S.speed = PH.clamp(S.speed + accel * 14 * dt, -10, 30);
      S.speed *= (1 - 0.4 * dt);
      if (Math.abs(S.speed) > 0.2) S.heading += steer * 1.6 * dt * Math.sign(S.speed);
      S.heroPos.x += Math.sin(S.heading) * S.speed * dt;
      S.heroPos.z += Math.cos(S.heading) * S.speed * dt;
      S.heroPos.x = PH.clamp(S.heroPos.x, -100, 168);
      S.heroPos.z = PH.clamp(S.heroPos.z, -168, 168);
      hero.position.copy(S.heroPos);
      hero.rotation.y = S.heading;
      PH.hud.setSpeed(Math.abs(S.speed) * 3.6);
      PH.Audio.setEngine(Math.abs(S.speed) / 30);
      // chase camera: 9 back, 4.2 up, look 8 ahead
      var bx = S.heroPos.x - Math.sin(S.heading) * 9;
      var bz = S.heroPos.z - Math.cos(S.heading) * 9;
      camera.position.set(bx, 4.2, bz);
      camera.lookAt(S.heroPos.x + Math.sin(S.heading) * 8, 1.5, S.heroPos.z + Math.cos(S.heading) * 8);
      // wanted: rises near police, falls when far
      var near = police.cruisers.some(function (c) {
        return c.position.distanceTo(S.heroPos) < 18;
      });
      if (near && S.wanted < 5) { S.wanted = Math.min(5, S.wanted + dt * 0.2); }
      else if (!near && S.wanted > 0) { S.wanted = Math.max(0, S.wanted - dt * 0.08); }
      var w = Math.round(S.wanted);
      PH.hud.setWanted(w);
      PH.Audio.startSiren(w >= 2);
      // heli orbits the hero
      var ha = S.time * 0.25;
      heli.position.set(S.heroPos.x + Math.cos(ha) * 26, 34 + Math.sin(S.time * 0.5) * 1.5, S.heroPos.z + Math.sin(ha) * 26);
      heli.rotation.y = -ha;
    } else {
      var mv = (keys.ShiftLeft || keys.ShiftRight) ? 6 : 3.2;
      var fx = 0, fz = 0;
      if (keys.KeyW || keys.ArrowUp) fz += 1;
      if (keys.KeyS || keys.ArrowDown) fz -= 1;
      if (keys.KeyA || keys.ArrowLeft) fx -= 1;
      if (keys.KeyD || keys.ArrowRight) fx += 1;
      var moving = fx !== 0 || fz !== 0;
      if (moving) {
        var len = Math.hypot(fx, fz);
        S.mateoHeading = Math.atan2(fx / len, fz / len);
        S.mateoPos.x += Math.sin(S.mateoHeading) * mv * dt;
        S.mateoPos.z += Math.cos(S.mateoHeading) * mv * dt;
        S.mateoPos.x = PH.clamp(S.mateoPos.x, -100, 168);
        S.mateoPos.z = PH.clamp(S.mateoPos.z, -168, 168);
      }
      if (mateo) {
        mateo.root.position.copy(S.mateoPos);
        mateo.root.rotation.y = S.mateoHeading + (mateo.forwardOffset || 0);
        mateo.setAnim(moving ? ((keys.ShiftLeft || keys.ShiftRight) ? 'run' : 'walk') : 'idle');
      }
      PH.hud.setSpeed(0);
      var cx = S.mateoPos.x - Math.sin(S.mateoHeading) * 6;
      var cz = S.mateoPos.z - Math.cos(S.mateoHeading) * 6;
      camera.position.set(cx, 3.2, cz);
      camera.lookAt(S.mateoPos.x + Math.sin(S.mateoHeading) * 6, 1.5, S.mateoPos.z + Math.cos(S.mateoHeading) * 6);
    }
  }

  // ---------- main loop ----------
  // Debug handle for headless probes (scene inspection, no gameplay effect).
  window.__PH_DEBUG = { scene: scene, camera: camera, state: S, boats: boatChase, race: race, get mateo() { return mateo; }, get kira() { return kira; } };
  var clock = new THREE.Clock();
  var minimap = document.getElementById('minimap');
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    S.time += dt;
    world.update(dt, S.time);
    if (!isShot) {
      traffic.update(dt);
      freePlay(dt);
    } else {
      // staged shots: keep the world alive but frozen in place.
      // Race rivals and boats are staged statically — their live
      // update would drive them out of frame before the screenshot.
      if (shotNum === 4) flash.update(S.time);
      if (shotNum === 2 && mateo) mateo.setAnim('walk');
      if (shotNum === 3) {
        // only the foam wakes shimmer; the boats hold their marks
        boatChase.wake.update(0.5);
        boatChase.policeWake.update(0.5);
        // v7.4 rev 2: the outboard hums under the staged boat shot
        // (no-op until the player enables audio with a gesture)
        PH.Audio.startBoatEngine();
        PH.Audio.setBoatEngine(0.6);
      }
    }
    var threat = S.wanted >= 1 ? { active: true, x: S.onFoot ? S.mateoPos.x : S.heroPos.x, z: S.onFoot ? S.mateoPos.z : S.heroPos.z } : null;
    cityCrowd.update(dt, S.time, threat);
    beachCrowd.update(dt, S.time, threat);
    police.update(dt, S.time, S.wanted);
    if (heli.userData.rotor) heli.userData.rotor.rotation.y += dt * 22;
    if (heli.userData.tailRotor) heli.userData.tailRotor.rotation.x += dt * 30;
    // v7.5: per-frame hooks for the new visual systems — the wet-road
    // ribbons strengthen as the camera drops and always point toward
    // the camera, the sunset sky's sunbeams and cloud rims breathe,
    // and the police heli's rotor disc leans into its motion.
    if (PH.updateWetReflections) PH.updateWetReflections(camera.position.y);
    if (PH.orientWetReflections) PH.orientWetReflections(camera.position.x, camera.position.z);
    if (PH.updateSunsetSky) PH.updateSunsetSky(S.time);
    if (PH.poseHeli75) PH.poseHeli75(heli);
    if (mateo) mateo.update(dt);
    if (kira) kira.update(dt);
    // minimap (v7.3: boats + race rivals ride along with police dots)
    var playerPos = S.onFoot ? S.mateoPos : S.heroPos;
    var playerHeading = S.onFoot ? S.mateoHeading : S.heading;
    PH.drawMinimap(minimap, {
      time: S.time, wanted: Math.round(S.wanted), objective: S.objective,
      player: { x: playerPos.x, z: playerPos.z, heading: playerHeading },
      police: police.cruisers.map(function (c) { return { x: c.position.x, z: c.position.z }; }),
      boats: shotNum === 3 ? boatChase.policeBoats.map(function (pb) { return { x: pb.mesh.position.x, z: pb.mesh.position.z }; }) : null,
      raceGate: shotNum === 1 ? { x: -20, z: -6 } : null,
      rivals: shotNum === 1 ? race.rivals.map(function (r) { return { x: r.pos.x, z: r.pos.z }; }) : null
    });
    renderer.render(scene, camera);
    S.frames++;
    if (S.frames === 5) {
      window.__ready = true;
      var ld = document.getElementById('loading');
      if (ld) ld.style.display = 'none';
    }
  }
  animate();

  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();
