// PIER HEAT — Sunset Bay v7.1
// main.js — boots the renderer, builds the world and its crowds, stages
// the four screenshot scenes (chase / on foot / mission / combat) and runs
// the playable game: drive the Scarlet Arrow, walk as Mateo, lose the
// Bay City PD, save with P. Shot scenes are chosen with ?shot=1..4.
(function () {
  'use strict';
  var PH = window.PH;

  window.__errors = [];
  window.__ready = false;
  window.__mateoOk = false;
  window.addEventListener('error', function (e) { window.__errors.push(String(e.message || e.error)); });
  window.addEventListener('unhandledrejection', function (e) { window.__errors.push('rejection: ' + String(e.reason)); });

  var params = new URLSearchParams(location.search);
  var shotNum = parseInt(params.get('shot') || '0', 10) || 0;
  var seed = parseInt(params.get('seed') || '1', 10) || 1;
  PH.setSeed(seed);
  var SHOT_MODE = shotNum >= 1 && shotNum <= 4;
  var SAVE_KEY = 'pierheat-save-v69';

  var renderer, scene, camera, clock;
  var world, traffic, cityCrowd, beachCrowd, police, hero, heroState;
  var mateo = null, kira = null, flash = null;
  var wanted = 0, hp = 100, armor = 80, ammo = 12;
  var onFoot = false;
  var keys = {};
  var objective = { x: -58, z: 40 };
  var threat = { active: false, x: 0, z: 0 };
  var elapsed = 0;
  var minimapEl = null;

  function buildRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    PH.el('app').appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);
    camera.position.set(0, 6, 40);
    clock = new THREE.Clock();
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function setObjective(title, text, ox, oz) {
    PH.hud.setObjective(title, text);
    if (ox != null) { objective.x = ox; objective.z = oz; }
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(5, n));
    PH.hud.setWanted(wanted);
    threat.active = wanted >= 1;
    if (wanted >= 1) PH.audio.siren(true); else PH.audio.siren(false);
  }

  // Freeze a traffic car at an exact staged spot (speed 0, custom lane).
  function stageTrafficCar(i, x, z, headingNorth) {
    var rec = traffic.cars[i % traffic.cars.length];
    if (headingNorth == null) headingNorth = true;
    if (headingNorth) {
      rec.route = { axis: 'z', lane: x, from: -1000, to: 1000, dir: 1 };
      rec.pos = z;
    } else {
      rec.route = { axis: 'x', lane: z, from: -1000, to: 1000, dir: 1 };
      rec.pos = x;
    }
    rec.speed = 0;
    traffic.place(rec);
    if (!headingNorth) rec.group.rotation.y = Math.PI / 2;
    return rec;
  }

  // Keep moving traffic off a lane segment: a through car on the hero's
  // own avenue lane can park itself exactly in front of the hero and hide
  // it (shot 4's first v6.9 render). Staged cars already have speed 0,
  // so they are never touched.
  function clearLaneTraffic(laneX, z0, z1) {
    traffic.cars.forEach(function (rec) {
      if (rec.speed > 0 && rec.route.axis === 'z' && rec.route.lane === laneX && rec.pos > z0 && rec.pos < z1) {
        rec.pos = (rec.route.dir > 0) ? -120 : 120;
        rec.speed = 0;
        traffic.place(rec);
      }
    });
  }

  function placePoliceCar(i, x, z, ry) {
    var car = police.cars[i % police.cars.length];
    car.position.set(x, 0, z);
    car.rotation.y = ry;
    return car;
  }
  function placeOfficer(i, x, z, ry) {
    var o = police.officers[i % police.officers.length];
    o.group.position.set(x, 0, z);
    o.group.rotation.y = ry;
    PH.posePerson(o, 0);
    return o;
  }

  // ---------------- shot staging ----------------
  function stageShot1() {
    // COVER — golden-hour chase down Sunset Blvd, beach on the left.
    // Hero big in frame, police cruisers visible around it, the helicopter
    // frozen in the upper sky so it is always in frame.
    setWanted(3);
    setObjective('PIER HEAT — LOSE THE HEAT', 'Lose the Bay City PD and reach the pier.', -58, 40);
    heroState.x = -20; heroState.z = 8; heroState.heading = Math.PI + 0.3; heroState.speed = 26;
    // Cruisers pull alongside / just ahead of the hero, never between the
    // camera and the hero (they would out-size it).
    placePoliceCar(0, -16.5, -2, Math.PI);
    placePoliceCar(1, -23.5, -8, Math.PI);
    placePoliceCar(2, -16.5, -18, Math.PI);
    stageTrafficCar(0, -23.5, -30, true);
    stageTrafficCar(1, -16.5, -42, true);
    stageTrafficCar(2, 8, -40, false);
    stageTrafficCar(3, 30, -40, false);
    police.frozen = true;
    police.heli.position.set(-30, 11, -25);
    police.heli.rotation.y = Math.PI * 0.75;
    camera.fov = 46; camera.updateProjectionMatrix();
    camera.position.set(-15, 3.2, 21);
    camera.lookAt(-20, 1.6, -2);
    PH.hud.setSpeed(96);
    PH.hud.setVitals(100, 80);
    PH.hud.setAmmo(12);
    PH.hud.setCash(1240);
    PH.hud.setMission('STAGE 2/3 — LOSE THE HEAT', 66, '02:41', 'NEXT: Reach the pier — follow the yellow diamond');
    PH.hud.setCarStatus('SCARLET ARROW • 98%');
    PH.hud.setRadioStation('NIGHTWAVE 98.3 — SUNSET DRIVE');
    PH.hud.setDispatch([
      { chip: 'PURSUIT', name: 'PD-104', role: 'CRUISER', dist: '42m' },
      { chip: 'RAMMING', name: 'PD-111', role: 'CRUISER', dist: '68m' },
      { chip: 'SPOTLIGHT', name: 'HELI-1', role: 'AIR UNIT', dist: '91m' }
    ]);
    PH.hud.setWeapons(1, { pistol: '12/12', smg: '0/30', rifle: '0/24' });
    PH.hud.hideDialog();
    clearLaneTraffic(-23.5, -80, 30);
    clearLaneTraffic(-16.5, -80, 30);
    PH.buildForegroundProps(scene, 1);
  }

  function stageShot2() {
    // ON FOOT — Mateo Vega walking the shopfront sidewalk, big in frame.
    // He stands on the east sidewalk (x -10), shops to his right, the road
    // and the beach to his left; the camera stays tight behind him.
    setWanted(0);
    setObjective('PIER HEAT — MEET KIRA', 'Meet Kira at the pier — follow the yellow marker.', -58, 40);
    if (mateo) {
      mateo.setPos(-10, -4, Math.PI / 2);
      mateo.group.visible = true;
      mateo.play('walk');
    }
    heroState.x = -20; heroState.z = -30; heroState.heading = Math.PI; heroState.speed = 0;
    stageTrafficCar(0, -23.5, -34, true);
    stageTrafficCar(1, -16.5, -52, true);
    stageTrafficCar(2, -23.5, 12, true);
    police.frozen = true;
    police.heli.position.set(-20, 10, -30);
    police.heli.rotation.y = Math.PI * 0.6;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.set(-10, 2.0, -0.5);
    camera.lookAt(-10, 1.5, -6);
    PH.hud.setSpeed(0);
    PH.hud.setVitals(100, 80);
    PH.hud.setAmmo(12);
    PH.hud.setCash(1240);
    PH.hud.setMission('STAGE 1/3 — MEET KIRA', 33, '', 'NEXT: Meet Kira at the pier — follow the yellow marker');
    PH.hud.setCarStatus('ON FOOT — MATEO VEGA • HP 100%');
    PH.hud.setRadioStation('NEON STREETS');
    PH.hud.setDispatch([]);
    PH.hud.setWeapons(1, { pistol: '12/12', smg: '0/30', rifle: '0/24' });
    PH.hud.hideDialog();
    PH.buildForegroundProps(scene, 2);
  }

  function stageShot3() {
    // MISSION — Mateo meets handler Kira on the pier, dialogue in-engine.
    // Both stand ON the pier deck (deck top y = 1.35), facing each other.
    setWanted(0);
    setObjective('PIER HEAT — THE PIER JOB', 'Meet Kira at the pier and hear the plan.', -58, 40);
    if (mateo) {
      mateo.setPos(-52, 38.5, Math.PI - 0.15);
      mateo.group.position.y = 1.35;
      mateo.group.visible = true;
      mateo.play('idle');
    }
    if (kira) {
      kira.setPos(-56.5, 38.5, 0.15);
      kira.group.position.y = 1.35;
      kira.group.visible = true;
      kira.play('idle');
    }
    heroState.x = -20; heroState.z = 60; heroState.heading = Math.PI; heroState.speed = 0;
    stageTrafficCar(0, -23.5, 30, true);
    stageTrafficCar(1, -16.5, 44, true);
    // Keep the pier strollers on the deck behind the meeting, spread
    // along both edges, so the pier reads busy without crowding the pair.
    cityCrowd.walkers.forEach(function (p, i) {
      if (p.home && p.home.pier) {
        p.home = { pier: true, x: -64 - (i % 4) * 4, z: (i % 2 === 0) ? 37.2 : 42.8 };
        p.group.position.set(p.home.x, 1.35, p.home.z);
      }
    });
    police.frozen = true;
    police.heli.position.set(-68, 13, 6);
    police.heli.rotation.y = Math.PI * 0.8;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.set(-49.5, 2.0, 43);
    camera.lookAt(-54.2, 1.9, 38.5);
    PH.hud.dialog('KIRA — HANDLER', 'The heat is on every corner of Sunset Bay. Take the Scarlet Arrow, cut through the market, and don\'t stop till the pier.');
    PH.hud.setVitals(100, 80);
    PH.hud.setAmmo(12);
    PH.hud.setSpeed(0);
    PH.hud.setCash(1240);
    PH.hud.setMission('STAGE 1/3 — THE PIER JOB', 20, '', 'NEXT: Take the Scarlet Arrow and lose the heat');
    PH.hud.setCarStatus('ON FOOT — MATEO VEGA • HP 100%');
    PH.hud.setRadioStation('PIER LIGHTS');
    PH.hud.setDispatch([]);
    PH.hud.setWeapons(1, { pistol: '12/12', smg: '0/30', rifle: '0/24' });
    PH.buildForegroundProps(scene, 3);
  }

  function stageShot4() {
    // COMBAT — open-street shootout with the Bay City PD, five stars.
    // Mateo takes cover by the Scarlet Arrow's front fender and fires
    // north at the cruisers; the helicopter holds over the beach.
    setWanted(5);
    setObjective('PIER HEAT — HOLD THE LINE', 'The Bay City PD wants the Scarlet Arrow. Hold the line.', -20, 40);
    heroState.x = -24; heroState.z = 34; heroState.heading = Math.PI; heroState.speed = 0;
    if (mateo) {
      // Mateo faces south (+Z), toward the cruisers; the camera sits north
      // of him and sees his back as he fires. The pair stands south of the
      // camera so both stay left of the minimap (facing south, west is right).
      mateo.setPos(-19.5, 31, -Math.PI / 2);
      mateo.group.visible = true;
      mateo.play('aim');
    }
    placePoliceCar(0, -23.5, 43, Math.PI);
    placePoliceCar(1, -16.5, 49, Math.PI);
    placePoliceCar(2, -23.5, 57, Math.PI);
    placeOfficer(0, -21.5, 39, Math.PI);
    placeOfficer(1, -18, 41.5, Math.PI);
    placeOfficer(2, -23, 36.5, Math.PI);
    stageTrafficCar(0, -16.5, 12, true);
    stageTrafficCar(1, -23.5, -2, true);
    police.frozen = true;
    police.heli.position.set(-26, 7, 58);
    police.heli.rotation.y = Math.PI * 0.7;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.set(-17.5, 2.8, 25.5);
    camera.lookAt(-20.5, 1.5, 36);
    PH.hud.setVitals(82, 65);
    PH.hud.setAmmo(9);
    PH.hud.setSpeed(0);
    PH.hud.setCash(2860);
    PH.hud.setMission('STAGE 3/3 — HOLD THE LINE', 85, '01:12', 'NEXT: Hold the line — protect the Scarlet Arrow');
    PH.hud.setCarStatus('SCARLET ARROW • 76%');
    PH.hud.setRadioStation('SIRENS');
    PH.hud.setDispatch([
      { chip: 'RAMMING', name: 'PD-104', role: 'CRUISER', dist: '18m' },
      { chip: 'PURSUIT', name: 'PD-111', role: 'CRUISER', dist: '24m' },
      { chip: 'PURSUIT', name: 'PD-118', role: 'CRUISER', dist: '31m' },
      { chip: 'SPOTLIGHT', name: 'HELI-1', role: 'AIR UNIT', dist: '55m' }
    ]);
    PH.hud.setWeapons(1, { pistol: '9/12', smg: '0/30', rifle: '0/24' });
    PH.hud.hideDialog();
    // Muzzle flash stays on for the staged combat frame.
    if (flash && mateo) {
      var fwd = mateo.forward();
      var pos = mateo.group.position.clone().addScaledVector(fwd, 0.7);
      pos.y = 1.45;
      flash.showAt(pos);
    }
    clearLaneTraffic(-23.5, -80, 70);
    clearLaneTraffic(-16.5, -80, 70);
    PH.buildForegroundProps(scene, 4);
  }

  function stageShot(n) {
    if (n === 1) stageShot1();
    else if (n === 2) stageShot2();
    else if (n === 3) stageShot3();
    else if (n === 4) stageShot4();
  }

  // ---------------- free play ----------------
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        x: heroState.x, z: heroState.z, heading: heroState.heading,
        wanted: wanted, hp: hp, armor: armor, ammo: ammo, onFoot: onFoot
      }));
      PH.hud.toast('Progress saved — Sunset Bay remembers you.');
    } catch (e) { /* storage may be unavailable */ }
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      if (e.code === 'KeyM') PH.audio.toggleMute();
      if (e.code === 'KeyP' && !SHOT_MODE) saveGame();
      if (e.code === 'KeyF' && !SHOT_MODE) toggleOnFoot();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('#muteBtn')) return;
      if (!SHOT_MODE && onFoot && ammo > 0) shoot();
    });
    var muteBtn = PH.el('muteBtn');
    if (muteBtn) muteBtn.addEventListener('click', function () {
      PH.audio.unlock();
      PH.audio.toggleMute();
    });
    var playBtn = PH.el('playBtn');
    if (playBtn) playBtn.addEventListener('click', function () {
      PH.audio.unlock();
      PH.el('title').style.display = 'none';
      PH.hud.toast('Nightwave 98.3 is on the radio — drive!');
    });
  }

  function toggleOnFoot() {
    onFoot = !onFoot;
    if (mateo) mateo.group.visible = onFoot;
    if (onFoot && mateo) {
      mateo.setPos(heroState.x + 2.5, heroState.z + 1.5, heroState.heading);
      mateo.play('walk');
      PH.audio.engineOff();
    } else if (mateo) {
      mateo.play('idle');
    }
    PH.hud.toast(onFoot ? 'On foot — Mateo Vega' : 'Back in the Scarlet Arrow');
  }

  function shoot() {
    ammo = Math.max(0, ammo - 1);
    PH.hud.setAmmo(ammo);
    PH.audio.shoot();
    if (mateo) {
      mateo.play('fire');
      setTimeout(function () { if (onFoot) mateo.play('aim'); }, 320);
      var fwd = mateo.forward();
      var pos = mateo.group.position.clone().addScaledVector(fwd, 0.7);
      pos.y = 1.45;
      flash.showAt(pos);
    }
  }

  // ---------------- build ----------------
  function build() {
    buildRenderer();
    minimapEl = PH.el('minimap');
    var mode = (shotNum === 1 || shotNum === 4) ? 'sunset' : 'day';
    world = PH.buildWorld(scene, mode);
    traffic = PH.buildTraffic(scene, world, 16);
    cityCrowd = PH.buildCityCrowd(scene, world, 130);
    beachCrowd = PH.buildBeachCrowd(scene, world);
    police = PH.buildPolice(scene, world);
    hero = PH.buildHeroCar();
    scene.add(hero);
    heroState = { x: -20, z: 34, heading: Math.PI, speed: 0 };
    flash = PH.makeMuzzleFlash(scene);
    PH.audio.bindGestures();
    bindInput();
    // Default HUD.
    PH.hud.setVitals(hp, armor);
    PH.hud.setAmmo(ammo);
    setWanted(0);
    setObjective('PIER HEAT — LOSE THE HEAT', 'Lose the Bay City PD and reach the pier.', -58, 40);
    PH.hud.setMission('STAGE 1/3 — LOSE THE HEAT', 0, '', 'NEXT: Lose the Bay City PD and reach the pier.');
    PH.hud.setCash(1240);
    PH.hud.setCarStatus('SCARLET ARROW • 98%');
    PH.hud.setRadioStation('NIGHTWAVE 98.3 — SUNSET DRIVE');
    PH.hud.setDispatch([]);
    PH.hud.setWeapons(1, { pistol: '12/12', smg: '0/30', rifle: '0/24' });
  }

  function loadCharacters() {
    var jobs = [];
    jobs.push(PH.loadMateo('vendor/mateo.glb').then(function (loaded) {
      // Art bible: burnt-orange jacket. #FF9900 was tried first and still
      // rendered amber (sampled hue ~42 deg in daylight), so the jacket
      // uses the same burnt orange as the Scarlet Arrow (#FF7A1A), which
      // renders as burnt orange in this engine's sun.
      PH.retint(loaded.group, { MateoJacket: 0xff7a1a });
      mateo = PH.makeMateo(loaded);
      mateo.group.visible = false;
      scene.add(mateo.group);
      window.__mateo = mateo;
      window.__mateoOk = true;
    }));
    jobs.push(PH.loadMateo('vendor/mateo.glb').then(function (loaded) {
      PH.retint(loaded.group, { MateoJacket: 0x0e7a7a, MateoTee: 0x222831, MateoHair: 0x2a1a12 });
      kira = PH.makeMateo(loaded);
      kira.group.visible = false;
      scene.add(kira.group);
      window.__kira = kira;
    }));
    return Promise.all(jobs.map(function (p) {
      return p.catch(function () { /* stand-in stays hidden; visual check will catch it */ });
    }));
  }

  function heroForward() {
    return new THREE.Vector3(Math.sin(heroState.heading), 0, Math.cos(heroState.heading));
  }

  function updateHero(dt) {
    if (SHOT_MODE) {
      hero.position.set(heroState.x, 0, heroState.z);
      hero.rotation.y = heroState.heading;
      return;
    }
    if (onFoot) {
      var mvx = 0, mvz = 0;
      if (keys.KeyW || keys.ArrowUp) mvz -= 1;
      if (keys.KeyS || keys.ArrowDown) mvz += 1;
      if (keys.KeyA || keys.ArrowLeft) mvx -= 1;
      if (keys.KeyD || keys.ArrowRight) mvx += 1;
      var moving = (mvx !== 0 || mvz !== 0);
      if (moving && mateo) {
        var camA = Math.atan2(camera.position.x - mateo.group.position.x, camera.position.z - mateo.group.position.z);
        var ang = camA + Math.atan2(mvx, -mvz);
        var sp = (keys.ShiftLeft || keys.ShiftRight) ? 6.5 : 3.4;
        mateo.group.position.x += Math.sin(ang) * sp * dt;
        mateo.group.position.z += Math.cos(ang) * sp * dt;
        mateo.group.rotation.y = ang - Math.PI / 2;
        mateo.play(sp > 4 ? 'run' : 'walk');
      } else if (mateo) {
        mateo.play('idle');
      }
      if (mateo) {
        mateo.group.position.x = Math.max(-125, Math.min(165, mateo.group.position.x));
        mateo.group.position.z = Math.max(-165, Math.min(165, mateo.group.position.z));
      }
      return;
    }
    // Driving.
    var accel = 0;
    if (keys.KeyW || keys.ArrowUp) accel = 14;
    if (keys.KeyS || keys.ArrowDown) accel = -9;
    if (keys.Space) accel = (heroState.speed > 0) ? -26 : 0;
    heroState.speed += accel * dt;
    heroState.speed *= (1 - 0.35 * dt);
    heroState.speed = Math.max(-8, Math.min(34, heroState.speed));
    var steer = 0;
    if (keys.KeyA || keys.ArrowLeft) steer = 1;
    if (keys.KeyD || keys.ArrowRight) steer = -1;
    if (Math.abs(heroState.speed) > 0.5) {
      heroState.heading += steer * 1.5 * dt * Math.sign(heroState.speed);
    }
    var fwd = heroForward();
    heroState.x += fwd.x * heroState.speed * dt;
    heroState.z += fwd.z * heroState.speed * dt;
    heroState.x = Math.max(-28, Math.min(166, heroState.x));
    heroState.z = Math.max(-166, Math.min(166, heroState.z));
    hero.position.set(heroState.x, 0, heroState.z);
    hero.rotation.y = heroState.heading;
    PH.hud.setSpeed(Math.abs(heroState.speed) * 3.6);
    PH.audio.engine(Math.abs(heroState.speed) / 34);
    // Wanted heat: police close by raise it, distance cools it.
    var nearest = 1e9;
    police.cars.forEach(function (car) {
      var d = Math.hypot(car.position.x - heroState.x, car.position.z - heroState.z);
      if (d < nearest) nearest = d;
    });
    if (nearest < 18 && wanted < 5) setWanted(wanted + 1);
    else if (nearest > 60 && wanted > 0 && Math.random() < dt * 0.1) setWanted(wanted - 1);
  }

  function updateCamera(dt) {
    if (SHOT_MODE) return; // staged cameras stay put
    var target;
    if (onFoot && mateo) {
      var mp = mateo.group.position;
      var ry = mateo.group.rotation.y;
      var back = new THREE.Vector3(-Math.cos(ry), 0, Math.sin(ry));
      target = mp.clone().addScaledVector(back, 4.2);
      target.y = 2.4;
      camera.position.lerp(target, 1 - Math.pow(0.001, dt));
      camera.lookAt(mp.x, mp.y + 1.4, mp.z);
    } else {
      var fwd = heroForward();
      var behind = hero.position.clone().addScaledVector(fwd, -9);
      behind.y = 4.2;
      camera.position.lerp(behind, 1 - Math.pow(0.001, dt));
      camera.lookAt(hero.position.x + fwd.x * 8, 1.4, hero.position.z + fwd.z * 8);
    }
  }

  function updatePolice(dt) {
    if (SHOT_MODE) return;
    // Police cars cruise toward the hero while the heat is on.
    if (wanted >= 1) {
      police.cars.forEach(function (car, i) {
        var dx = heroState.x - car.position.x, dz = heroState.z - car.position.z;
        var d = Math.hypot(dx, dz) || 1;
        if (d > 10) {
          car.position.x += (dx / d) * 11 * dt;
          car.position.z += (dz / d) * 11 * dt;
          car.rotation.y = Math.atan2(dx, dz);
        }
      });
    }
  }

  function drawMinimap() {
    if (!minimapEl) return;
    var px = onFoot && mateo ? mateo.group.position.x : heroState.x;
    var pz = onFoot && mateo ? mateo.group.position.z : heroState.z;
    var heading = onFoot && mateo ? mateo.group.rotation.y : heroState.heading;
    PH.drawMinimap(minimapEl, {
      bounds: { x0: -110, x1: 120, z0: -130, z1: 130 },
      roads: world.roads,
      player: { x: px, z: pz, heading: heading },
      police: police.cars.map(function (c) { return { x: c.position.x, z: c.position.z }; }),
      objective: objective,
      wanted: wanted,
      time: elapsed
    });
  }

  var frames = 0;
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    world.update(dt, elapsed);
    traffic.update(dt);
    threat.x = heroState.x; threat.z = heroState.z;
    cityCrowd.update(dt, elapsed, threat);
    beachCrowd.update(dt, elapsed, threat);
    police.update(dt, elapsed, { x: heroState.x, z: heroState.z });
    updateHero(dt);
    updatePolice(dt);
    updateCamera(dt);
    if (mateo) mateo.update(dt);
    if (kira) kira.update(dt);
    if (flash) flash.update(dt, shotNum === 4);
    if (shotNum === 4 && flash && mateo && !flash.on) {
      var fwd = mateo.forward();
      var pos = mateo.group.position.clone().addScaledVector(fwd, 0.7);
      pos.y = 1.45;
      flash.showAt(pos);
    }
    drawMinimap();
    renderer.render(scene, camera);
    frames++;
    if (!window.__ready && frames >= 4) {
      window.__ready = true;
      window.__shot = shotNum;
      var loading = PH.el('loading');
      if (loading) loading.style.display = 'none';
      if (!SHOT_MODE) {
        var saved = loadSave();
        if (saved) {
          heroState.x = saved.x; heroState.z = saved.z; heroState.heading = saved.heading;
          setWanted(saved.wanted || 0);
          hp = saved.hp != null ? saved.hp : 100;
          armor = saved.armor != null ? saved.armor : 80;
          ammo = saved.ammo != null ? saved.ammo : 12;
          PH.hud.setVitals(hp, armor);
          PH.hud.setAmmo(ammo);
          PH.hud.toast('Save loaded — welcome back to Sunset Bay.');
        }
        PH.el('title').style.display = 'flex';
      }
    }
  }

  build();
  loadCharacters().then(function () {
    if (SHOT_MODE) stageShot(shotNum);
    loop();
  }).catch(function () {
    if (SHOT_MODE) stageShot(shotNum);
    loop();
  });
})();
