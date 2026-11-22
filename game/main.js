// PIER HEAT — Sunset Bay v8.0: game state and the main loop. Boot (loading -> title -> START
// ENGINE -> play, one authoritative init used by the normal path and any screenshot path),
// fixed-step physics at 60 steps/second with render interpolation, free play (drive / walk /
// boat), the three mission stages, wanted + police, shooting, enter/exit car, save/load.
// Zero console errors is the goal; every system here is reachable by playing, never by teleport.
(function () {
  'use strict';
  var PH = window.PH;
  var STEP = 1 / 60;

  var WEAPONS = [
    { name: 'FISTS', dmg: 15, mag: Infinity, reserve: Infinity, magSize: Infinity, rate: 0.35, range: 2.6, auto: false },
    { name: 'PISTOL', dmg: 34, mag: 12, reserve: 48, magSize: 12, rate: 0.28, range: 60, auto: false },
    { name: 'SMG', dmg: 18, mag: 30, reserve: 90, magSize: 30, rate: 0.09, range: 55, auto: true },
    { name: 'SHOTGUN', dmg: 60, mag: 6, reserve: 24, magSize: 6, rate: 0.85, range: 30, auto: false },
    { name: 'RIFLE', dmg: 45, mag: 30, reserve: 60, magSize: 30, rate: 0.13, range: 90, auto: true },
    { name: 'BAT', dmg: 25, mag: Infinity, reserve: Infinity, magSize: Infinity, rate: 0.45, range: 2.8, auto: false }
  ];

  var game = {
    state: 'loading', // loading | title | play | paused
    mode: 'driving',  // driving | onfoot | boat
    paused: false,
    time: 0,
    missionTime: 0,
    stage: 1,         // 1 meet Kira, 2 race, 3 boat, 4 done
    raceSub: 'toStart', // toStart | racing
    money: 250,
    wantedPts: 0,
    lastCrimeT: -99,
    player: { x: -14, z: 3, heading: Math.PI / 2, health: 100, armor: 50, speed: 0 },
    car: null,        // driven car state {group,name,isHero,x,z,heading,speed,damage}
    heroCar: null,
    heroDamage: 0,
    mateo: null,
    kira: null,
    kiraOnBoat: false,
    boat: { x: 8, z: 152, heading: 0, speed: 0, boarded: false },
    weaponIdx: 1,
    weapons: null,
    fireCooldown: 0,
    keys: {},
    camOrbit: 0,
    camPos: new THREE.Vector3(0, 6, -14),
    marker: null,
    muzzle: null,
    particles: [],
    shootables: [],
    raycaster: new THREE.Raycaster(),
    acc: 0,
    prevCar: { x: 0, z: 0, heading: 0 },
    prevPlayer: { x: 0, z: 0, heading: 0 },
    prevBoat: { x: 0, z: 0, heading: 0 },
    dialogTimer: null,
    saveExists: false,
    perf: { frames: 0, startT: 0, times: [], fps: 0, fpsLow: 0 }
  };
  PH.game = game;
  game.weapons = WEAPONS.map(function (w) {
    return { name: w.name, dmg: w.dmg, mag: w.mag, reserve: w.reserve, magSize: w.magSize, rate: w.rate, range: w.range, auto: w.auto };
  });

  // ---------------- boot ----------------
  function buildAll() {
    PH.world.build();
    PH.sim.initTraffic();
    PH.sim.initPeds();
    PH.race.buildGates();
    PH.sky.init();
    PH.heli.init();
    PH.water.init();
    PH.facades.apply();
    PH.wetroad.init();
    PH.boats.init();
    // hero car
    var hero = PH.buildHeroCar();
    var s = PH.world.spawns.heroCar;
    hero.position.set(s.x, 0, s.z);
    hero.rotation.y = s.heading;
    PH.scene.add(hero);
    game.heroCar = hero;
    game.car = {
      group: hero, name: 'SCARLET ARROW', isHero: true,
      x: s.x, z: s.z, heading: s.heading, speed: 0, damage: 0
    };
    game.prevCar = { x: s.x, z: s.z, heading: s.heading };
    // Mateo
    var mateo = PH.buildMateo();
    mateo.userData.baseY = 0;
    var ps = PH.world.spawns.playerStart;
    mateo.position.set(ps.x, 0, ps.z);
    mateo.rotation.y = ps.heading;
    mateo.visible = false; // starts inside the car
    PH.scene.add(mateo);
    game.mateo = mateo;
    game.player.x = ps.x; game.player.z = ps.z; game.player.heading = ps.heading;
    game.prevPlayer = { x: ps.x, z: ps.z, heading: ps.heading };
    // Kira on the pier
    var kira = PH.buildCrewMember('kira');
    var ks = PH.world.spawns.kira;
    kira.position.set(ks.x, 1.2, ks.z);
    kira.rotation.y = Math.PI; // facing the city
    PH.scene.add(kira);
    game.kira = kira;
    // Dario + Lena waiting near the pier mouth (crew, ambient)
    var dario = PH.buildCrewMember('dario');
    dario.position.set(-8, 0, 102); dario.rotation.y = 1.2; PH.scene.add(dario);
    game.dario = dario;
    var lena = PH.buildCrewMember('lena');
    lena.position.set(8, 0, 102); lena.rotation.y = -1.2; PH.scene.add(lena);
    game.lena = lena;
    // objective marker: floating diamond
    var marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
      new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a00, emissiveIntensity: 1.4 }));
    marker.visible = true;
    PH.scene.add(marker);
    game.marker = marker;
    // muzzle flash light + a visible flash cone (the light alone is invisible
    // in bright sunlight — the cone is what the player actually sees)
    var muzzle = new THREE.PointLight(0xffc860, 0, 18);
    PH.scene.add(muzzle);
    game.muzzle = muzzle;
    var flashGeo = new THREE.ConeGeometry(0.24, 0.85, 8);
    flashGeo.rotateX(Math.PI / 2); // cone axis -> +Z, so lookAt() aims the flash forward
    var flash = new THREE.Mesh(flashGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    flash.visible = false;
    PH.scene.add(flash);
    game.muzzleFlash = flash;
    // a small additive core ball so the flash reads from any angle, not just head-on
    var core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.visible = false;
    PH.scene.add(core);
    game.muzzleCore = core;
    // shootable registry (bounded list, never the whole scene)
    game.shootables = [];
    PH.sim.peds.forEach(function (p) { p.group.userData.shootable = { kind: 'ped', ref: p }; game.shootables.push(p.group); });
    PH.sim.cars.forEach(function (c) { c.group.userData.shootable = { kind: 'traffic', ref: c }; game.shootables.push(c.group); });
    PH.sim.policeCars.forEach(function (c) { c.group.userData.shootable = { kind: 'police', ref: c }; game.shootables.push(c.group); });
    // portraits into crew cards
    PH.portraits.drawInto(document.getElementById('portrait-kira'), 'kira');
    PH.portraits.drawInto(document.getElementById('portrait-dario'), 'dario');
    PH.portraits.drawInto(document.getElementById('portrait-lena'), 'lena');
    // continue button if a save exists
    try {
      if (localStorage.getItem('pierheat-v8-save')) {
        game.saveExists = true;
        document.getElementById('btn-continue').style.display = 'inline-block';
      }
    } catch (e) {}
  }

  // One authoritative init: used by the normal START ENGINE path and any screenshot path.
  function startPlay(opts) {
    opts = opts || {};
    PH.audio.resume();
    PH.audio.startMusic();
    PH.audio.setRadio('NIGHTWAVE 98.3');
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('on');
    game.state = 'play';
    game.paused = false;
    if (opts.loadSave) loadGame();
    updateMissionHUD();
    PH.hud.setMoney(game.money);
    PH.hud.setHealth(game.player.health);
    PH.hud.setArmor(game.player.armor);
    PH.hud.setWanted(wantedStars());
    PH.hud.setWeaponSel(game.weaponIdx);
    updateAmmoHUD();
    PH.hud.toast('PIER HEAT — meet Kira on the pier');
  }

  // ---------------- input ----------------
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') { togglePause(); return; }
    game.keys[e.code] = true;
    if (game.state !== 'play' || game.paused) return;
    if (e.code === 'KeyE') tryInteract();
    if (e.code === 'KeyR') reloadWeapon();
    if (e.code === 'KeyP') saveGame();
    if (e.code === 'KeyL') loadGame();
    if (e.code === 'KeyM') { PH.audio.musicOn = !PH.audio.musicOn; PH.hud.toast(PH.audio.musicOn ? 'NIGHTWAVE 98.3 — ON' : 'RADIO OFF'); }
    if (e.code >= 'Digit1' && e.code <= 'Digit6') selectWeapon(Number(e.code.slice(5)) - 1);
    if (e.code === 'KeyF') shoot();
  });
  window.addEventListener('keyup', function (e) { game.keys[e.code] = false; });
  var dragging = false, lastMX = 0, lastMY = 0;
  var canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', function (e) { dragging = true; lastMX = e.clientX; lastMY = e.clientY; });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    game.camOrbit = PH.clamp(game.camOrbit + (e.clientX - lastMX) * 0.004, -1.4, 1.4);
    lastMX = e.clientX; lastMY = e.clientY;
  });
  window.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('click', function () {
    if (game.state === 'play' && !game.paused && game.mode === 'onfoot') shoot();
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.getElementById('btn-start').addEventListener('click', function () { startPlay({}); });
  document.getElementById('btn-continue').addEventListener('click', function () { startPlay({ loadSave: true }); });
  document.getElementById('btn-respawn').addEventListener('click', respawn);
  document.getElementById('btn-save').addEventListener('click', function () { saveGame(); });
  document.getElementById('btn-load').addEventListener('click', function () { loadGame(); });
  document.getElementById('btn-resume').addEventListener('click', togglePause);

  function togglePause() {
    if (game.state !== 'play') return;
    game.paused = !game.paused;
    document.getElementById('pause-menu').classList.toggle('on', game.paused);
  }

  // ---------------- wanted ----------------
  function wantedStars() {
    return PH.clamp(Math.floor(game.wantedPts / 25), 0, 5);
  }
  function addCrime(pts, reason) {
    game.wantedPts = PH.clamp(game.wantedPts + pts, 0, 125);
    game.lastCrimeT = game.time;
    if (reason) PH.hud.toast(reason);
  }
  PH.events.on('police-ram', function () {
    if (game.mode === 'onfoot') {
      hurtPlayer(12, 'Police rammed you');
    } else if (game.mode === 'driving') {
      game.car.damage = PH.clamp(game.car.damage + 8, 0, 100);
      game.car.speed *= 0.6;
      PH.audio.crash();
      PH.hud.toast('Police rammed your car');
    }
  });
  function hurtPlayer(dmg, why) {
    var p = game.player;
    if (p.armor > 0) {
      var absorbed = Math.min(p.armor, dmg);
      p.armor -= absorbed; dmg -= absorbed;
    }
    p.health = Math.max(0, p.health - dmg);
    PH.hud.setHealth(p.health);
    PH.hud.setArmor(p.armor);
    if (why) PH.hud.toast(why);
    if (p.health <= 0) {
      document.getElementById('downed-overlay').classList.add('on');
    }
  }
  function respawn() {
    var p = game.player;
    p.health = 100; p.armor = 50;
    game.money = Math.max(0, game.money - 50);
    game.wantedPts = 0;
    p.x = -14; p.z = 3; p.heading = Math.PI / 2;
    game.mode = 'onfoot';
    game.mateo.visible = true;
    document.getElementById('downed-overlay').classList.remove('on');
    PH.hud.setHealth(100); PH.hud.setArmor(50); PH.hud.setMoney(game.money); PH.hud.setWanted(0);
    PH.hud.toast('Back on your feet. The job is still on.');
  }

  // ---------------- weapons ----------------
  function selectWeapon(i) {
    if (i < 0 || i >= WEAPONS.length) return;
    game.weaponIdx = i;
    PH.hud.setWeaponSel(i);
    updateAmmoHUD();
  }
  function updateAmmoHUD() {
    var w = game.weapons[game.weaponIdx];
    var label = w.name + ' — ' + (w.mag === Infinity ? '∞' : w.mag + ' / ' + (w.reserve === Infinity ? '∞' : w.reserve));
    PH.hud.setAmmo(label);
  }
  function reloadWeapon() {
    var w = game.weapons[game.weaponIdx];
    if (w.mag === Infinity || w.reserve <= 0 || w.mag >= w.magSize) return;
    var need = w.magSize - w.mag;
    var take = Math.min(need, w.reserve);
    w.mag += take; w.reserve -= take;
    PH.audio.reload();
    updateAmmoHUD();
  }
  function shoot() {
    if (game.state !== 'play' || game.paused) return;
    if (game.mode !== 'onfoot') return;
    if (game.player.health <= 0) return;
    var w = game.weapons[game.weaponIdx];
    var now = game.time;
    if (game.fireCooldown > now) return;
    game.fireCooldown = now + w.rate;
    if (w.mag !== Infinity) {
      if (w.mag <= 0) { PH.hud.toast('Press R to reload'); return; }
      w.mag--;
      updateAmmoHUD();
    }
    PH.audio.shot();
    // muzzle flash at the player's hand: light + visible cone, pointing forward
    game.muzzle.position.set(
      game.player.x + Math.sin(game.player.heading) * 0.8,
      1.4,
      game.player.z + Math.cos(game.player.heading) * 0.8);
    game.muzzle.intensity = 4;
    game.muzzleFlash.position.copy(game.muzzle.position);
    game.muzzleFlash.lookAt(
      game.player.x + Math.sin(game.player.heading) * 4,
      1.4,
      game.player.z + Math.cos(game.player.heading) * 4);
    game.muzzleFlash.scale.set(0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.5);
    game.muzzleFlash.material.opacity = 1;
    game.muzzleFlash.visible = true;
    game.muzzleCore.position.copy(game.muzzle.position);
    game.muzzleCore.material.opacity = 1;
    game.muzzleCore.visible = true;
    // raycast from the camera through the screen centre
    game.raycaster.setFromCamera(new THREE.Vector2(0, 0), PH.camera);
    game.raycaster.far = w.range;
    var hits = game.raycaster.intersectObjects(game.shootables, true);
    var nearPolice = false;
    PH.sim.policeCars.forEach(function (c) {
      if (PH.dist2d(c.x, c.z, game.player.x, game.player.z) < 25) nearPolice = true;
    });
    addCrime(8 + (nearPolice ? 12 : 0), null);
    if (hits.length > 0) {
      var hit = hits[0];
      var obj = hit.object;
      while (obj && !obj.userData.shootable) obj = obj.parent;
      var sp = new THREE.Vector3();
      sp.copy(hit.point).project(PH.camera);
      var sx = (sp.x * 0.5 + 0.5) * window.innerWidth;
      var sy = (-sp.y * 0.5 + 0.5) * window.innerHeight;
      spawnImpact(hit.point);
      PH.hud.hitmarker();
      if (obj && obj.userData.shootable) {
        var s = obj.userData.shootable;
        PH.hud.damageNumber(sx, sy, '-' + w.dmg, '#ffe14a');
        if (s.kind === 'ped') {
          s.ref.health -= w.dmg;
          s.ref.fleeing = 6;
          addCrime(15, 'Civilian hit — wanted up');
          if (s.ref.health <= 0) {
            s.ref.group.rotation.x = -Math.PI / 2 + 0.05;
            s.ref.group.position.y = 0.15;
          }
        } else if (s.kind === 'police') {
          s.ref.hp = (s.ref.hp === undefined ? 100 : s.ref.hp) - w.dmg;
          addCrime(30, 'You shot at the police!');
          if (s.ref.hp <= 0) { s.ref.speed = 0; s.ref.maxSpeed = 0; }
        } else if (s.kind === 'traffic') {
          addCrime(4, null);
        }
      }
    }
  }
  function spawnImpact(point) {
    for (var i = 0; i < 8; i++) {
      var m = new THREE.Mesh(PH.boxGeo(0.09, 0.09, 0.09),
        new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      m.position.copy(point);
      PH.scene.add(m);
      game.particles.push({
        mesh: m, life: 0.5,
        vel: new THREE.Vector3(PH.rand(-2, 2), PH.rand(1, 3.5), PH.rand(-2, 2))
      });
    }
  }

  // ---------------- enter / exit car & boat ----------------
  function nearestCar(maxDist) {
    var best = null, bestD = maxDist;
    var cands = [];
    // the last driven car is only "already driven" while the player is in it
    var heroBusy = game.mode === 'driving' && game.car && game.car.isHero;
    if (game.heroCar) cands.push({ group: game.heroCar, state: heroBusy ? null : { name: 'SCARLET ARROW', isHero: true, group: game.heroCar, damage: game.heroDamage || 0 } });
    PH.sim.cars.forEach(function (c) { cands.push({ group: c.group, state: { name: 'SEDAN', isHero: false, group: c.group, trafficRef: c } }); });
    var i, d;
    for (i = 0; i < cands.length; i++) {
      var g = cands[i].group;
      if (cands[i].state === null) continue; // already the driven car
      d = PH.dist2d(game.player.x, game.player.z, g.position.x, g.position.z);
      if (d < bestD) { bestD = d; best = cands[i].state; best._d = d; }
    }
    return best;
  }
  function enterCar(st) {
    // if it was a traffic car, take it out of the traffic sim
    if (st.trafficRef) {
      var idx = PH.sim.cars.indexOf(st.trafficRef);
      if (idx >= 0) PH.sim.cars.splice(idx, 1);
      var sidx = game.shootables.indexOf(st.trafficRef.group);
      if (sidx >= 0) game.shootables.splice(sidx, 1);
    }
    // park the previous driven car back into traffic (unless it is the hero car)
    if (game.car && !game.car.isHero && game.car.trafficRef) {
      var old = game.car.trafficRef;
      old.x = game.car.x; old.z = game.car.z; old.heading = game.car.heading; old.speed = 0;
      PH.sim.cars.push(old);
      game.shootables.push(old.group);
    }
    game.car = {
      group: st.group, name: st.name, isHero: !!st.isHero,
      x: st.group.position.x, z: st.group.position.z,
      heading: st.group.rotation.y, speed: 0,
      damage: st.damage || 0, trafficRef: st.trafficRef || null
    };
    game.prevCar = { x: game.car.x, z: game.car.z, heading: game.car.heading };
    game.mode = 'driving';
    game.mateo.visible = false;
    PH.hud.setCar(game.car.name, 100 - game.car.damage);
    PH.hud.toast('Driving the ' + game.car.name);
    if (game.stage === 2 && game.raceSub === 'toStart') {
      PH.hud.toast('Drive to the start line on Sunset Blvd');
    }
  }
  function exitCar() {
    var c = game.car;
    if (c.isHero) game.heroDamage = c.damage;
    // place Mateo safely beside the car, on the right side
    var rx = Math.cos(c.heading), rz = -Math.sin(c.heading);
    var px = c.x + rx * 2.4, pz = c.z + rz * 2.4;
    var col = PH.collideCircle(px, pz, 0.5);
    game.player.x = col.x; game.player.z = col.z;
    game.player.heading = c.heading;
    game.mode = 'onfoot';
    game.mateo.visible = true;
    game.mateo.position.set(game.player.x, PH.world.groundHeight(game.player.x, game.player.z), game.player.z);
    game.mateo.rotation.y = game.player.heading;
    game.prevPlayer = { x: game.player.x, z: game.player.z, heading: game.player.heading };
    PH.hud.setCar('ON FOOT', 100 - c.damage);
  }
  function tryInteract() {
    if (game.player.health <= 0) return;
    if (game.mode === 'driving') { exitCar(); return; }
    if (game.mode === 'boat') { exitBoat(); return; }
    // on foot
    if (game.stage === 1) {
      var ks = PH.world.spawns.kira;
      if (PH.dist2d(game.player.x, game.player.z, ks.x, ks.z) < 3.2) {
        talkToKira();
        return;
      }
    }
    if (game.stage === 3 || game.stage === 4) {
      var bs = PH.world.spawns.boat;
      if (PH.dist2d(game.player.x, game.player.z, bs.x, bs.z) < 4.5) { boardBoat(); return; }
    }
    var car = nearestCar(2.5);
    if (car) { enterCar(car); return; }
    if (game.stage === 2) {
      var bs2 = PH.world.spawns.boat;
      if (PH.dist2d(game.player.x, game.player.z, bs2.x, bs2.z) < 4) {
        PH.hud.toast('Finish the race first — the boat comes after');
      }
    }
  }
  function talkToKira() {
    showDialog('kira', 'KIRA',
      'Mateo. The Scarlet Arrow is warmed up and the street is ours tonight. Win the race down ' +
      'Sunset Boulevard — RICO, SABLE and VOLT are already lining up — and then we vanish by boat. ' +
      'Drive to the start line and show them what Sunset Bay is made of.');
    game.stage = 2;
    game.raceSub = 'toStart';
    updateMissionHUD();
    saveGame(true);
  }
  function boardBoat() {
    if (game.stage === 2) { PH.hud.toast('Finish the race first — the boat comes after'); return; }
    var b = game.boat;
    b.boarded = true;
    game.mode = 'boat';
    game.mateo.visible = true;
    game.prevBoat = { x: b.x, z: b.z, heading: b.heading };
    // Kira rides along: she is waiting by the boat
    game.kiraOnBoat = true;
    game.kira.position.set(b.x + 0.45, 1.0, b.z - 1.6);
    game.kira.rotation.y = b.heading;
    PH.boats.spawnPoliceBoat();
    showDialog('kira', 'KIRA', 'Go, Mateo! Across the bay, to the far end of the bridge — and don\'t let the marine unit catch us.');
    updateMissionHUD();
    PH.hud.show('boat-panel', true);
    saveGame(true);
  }
  function exitBoat() {
    var b = game.boat;
    // step out onto the nearest land: bridge deck, pier, or beach
    var onBridge = Math.abs(b.x + 155) < 9 && b.z > 105;
    var nearPier = Math.abs(b.x) < 12 && b.z < 175;
    if (onBridge) {
      game.player.x = PH.clamp(b.x, -159, -151);
      game.player.z = PH.clamp(b.z, 106, 209);
    } else if (nearPier) {
      game.player.x = 0; game.player.z = 158;
    } else {
      game.player.x = PH.clamp(b.x, -140, 140);
      game.player.z = 118;
    }
    game.player.heading = 0;
    b.boarded = false;
    game.mode = 'onfoot';
    game.mateo.visible = true;
    game.mateo.position.set(game.player.x, PH.world.groundHeight(game.player.x, game.player.z), game.player.z);
    game.prevPlayer = { x: game.player.x, z: game.player.z, heading: game.player.heading };
    if (game.kiraOnBoat) {
      game.kiraOnBoat = false;
      game.kira.position.set(10, 1.2, 158);
      game.kira.rotation.y = Math.PI;
    }
    PH.hud.show('boat-panel', false);
  }

  // ---------------- dialogs ----------------
  function showDialog(person, name, text) {
    PH.hud.setDialog(true, name, text, PH.portraits.urlFor(person));
    clearTimeout(game.dialogTimer);
    game.dialogTimer = setTimeout(function () { PH.hud.setDialog(false); }, 8000);
  }

  // ---------------- missions / HUD ----------------
  function updateMissionHUD() {
    var st = game.stage;
    if (st === 1) PH.hud.setObjective('PIER HEAT', 'STAGE 1/3 — MEET KIRA', 'Meet Kira on the pier at the end of Sunset Bay.', 'NEXT: Street race down Sunset Blvd');
    else if (st === 2) PH.hud.setObjective('PIER HEAT', 'STAGE 2/3 — STREET RACE', game.raceSub === 'toStart' ? 'Drive to the start line on Sunset Blvd.' : 'Race! Pass every gate before RICO, SABLE and VOLT.', 'NEXT: Boat escape across the bay');
    else if (st === 3) PH.hud.setObjective('PIER HEAT', 'STAGE 3/3 — BOAT ESCAPE', 'Board the speedboat at the pier and reach the far end of the bridge.', 'NEXT: Finish the job, get paid');
    else PH.hud.setObjective('PIER HEAT', 'JOB DONE', 'Sunset Bay is yours. Free roam, or replay the story from the pause menu.', 'NEXT: Free roam');
  }
  function missionMarkerPos() {
    if (game.stage === 1) { var ks = PH.world.spawns.kira; return { x: ks.x, z: ks.z, y: 3.4 }; }
    if (game.stage === 2) {
      if (game.raceSub === 'toStart') return { x: -130, z: 0, y: 3 };
      var g = PH.race.gates[PH.race.currentGate];
      if (g) return { x: g.x, z: g.z, y: 7.5 };
      return null;
    }
    if (game.stage === 3) {
      if (game.mode === 'boat') { var t = PH.world.spawns.boatTarget; return { x: t.x, z: t.z, y: 3 }; }
      var bs = PH.world.spawns.boat; return { x: bs.x, z: bs.z, y: 3 };
    }
    return null;
  }

  // ---------------- fixed-step physics ----------------
  function stepPhysics(dt) {
    game.time += dt;
    if (game.stage <= 3) game.missionTime += dt;
    var k = game.keys;
    // --- driving ---
    if (game.mode === 'driving' && game.car) {
      var c = game.car;
      game.prevCar = { x: c.x, z: c.z, heading: c.heading };
      var racing = game.stage === 2 && PH.race.state === 'countdown';
      var throttle = racing ? 0 : ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 0.7 : 0);
      var steer = ((k.KeyA || k.ArrowLeft) ? 1 : 0) - ((k.KeyD || k.ArrowRight) ? 1 : 0);
      var brake = k.Space ? 1 : 0;
      var maxSpeed = 32 * (1 - c.damage / 200);
      if (throttle > 0) c.speed += 14 * throttle * dt;
      if (throttle < 0) c.speed += 10 * throttle * dt;
      if (brake) c.speed -= Math.sign(c.speed) * 26 * dt;
      c.speed -= c.speed * 0.35 * dt; // drag
      if (Math.abs(c.speed) < 0.05 && throttle === 0) c.speed = 0;
      c.speed = PH.clamp(c.speed, -9, maxSpeed);
      // speed-sensitive steering + straight-line stability (no steer input = no heading change)
      var turn = steer * (2.2 / (1 + Math.abs(c.speed) * 0.12)) * PH.clamp(Math.abs(c.speed) / 3, 0, 1);
      c.heading += turn * Math.sign(c.speed) * dt;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      // world bounds: the city ends — no driving off into the void
      if (c.x < -250) { c.x = -250; c.speed *= 0.5; }
      if (c.x > 250) { c.x = 250; c.speed *= 0.5; }
      if (c.z < -200) { c.z = -200; c.speed *= 0.5; }
      if (c.z > 210) { c.z = 210; c.speed *= 0.5; }
      var col = PH.collideCarCircle(c.x, c.z, 1.7);
      if (col.hit) {
        if (Math.abs(c.speed) > 12) { PH.audio.crash(); c.damage = PH.clamp(c.damage + Math.abs(c.speed) * 0.5, 0, 100); }
        c.speed *= 0.55;
        c.x = col.x; c.z = col.z;
      }
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
      var wheels = c.group.userData.wheels || [];
      for (var wi = 0; wi < wheels.length; wi++) wheels[wi].rotation.x += c.speed * dt * 2.4;
      // race start line
      if (game.stage === 2 && game.raceSub === 'toStart' && PH.dist2d(c.x, c.z, -130, 0) < 12) {
        game.raceSub = 'racing';
        PH.race.start();
        updateMissionHUD();
      }
      PH.audio.setEngine(Math.abs(c.speed) / 32);
    } else {
      PH.audio.setEngine(0);
    }
    // --- on foot ---
    if (game.mode === 'onfoot') {
      var p = game.player;
      game.prevPlayer = { x: p.x, z: p.z, heading: p.heading };
      var sprint = k.ShiftLeft || k.ShiftRight;
      var speed = sprint ? 7 : 4;
      var mx = ((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0);
      var mz = ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0);
      var moving = (mx !== 0 || mz !== 0);
      if (moving && p.health > 0) {
        // move relative to the camera: W walks away from the camera, A/D strafe
        var moveYaw = p.heading + game.camOrbit;
        var fx = Math.sin(moveYaw), fz = Math.cos(moveYaw);
        var rx2 = Math.cos(moveYaw), rz2 = -Math.sin(moveYaw);
        var dx = fx * mz + rx2 * mx, dz = fz * mz + rz2 * mx;
        var dl = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= dl; dz /= dl;
        p.x += dx * speed * dt;
        p.z += dz * speed * dt;
        p.heading = Math.atan2(dx, dz);
        var col2 = PH.collideCircle(p.x, p.z, 0.45);
        p.x = col2.x; p.z = col2.z;
        p.speed = speed;
      } else p.speed = 0;
      var gy = PH.world.groundHeight(p.x, p.z);
      game.mateo.position.set(p.x, gy, p.z);
      game.mateo.rotation.y = p.heading;
      PH.animateCharacter(game.mateo, game.time, p.speed / 7, moving);
      // Kira idle
      PH.animateCharacter(game.kira, game.time, 0, false);
    }
    // --- boat ---
    if (game.mode === 'boat') {
      var b = game.boat;
      game.prevBoat = { x: b.x, z: b.z, heading: b.heading };
      var bThrottle = ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 0.5 : 0);
      var bSteer = ((k.KeyA || k.ArrowLeft) ? 1 : 0) - ((k.KeyD || k.ArrowRight) ? 1 : 0);
      if (bThrottle > 0) b.speed += 10 * dt;
      if (bThrottle < 0) b.speed -= 6 * dt;
      b.speed -= b.speed * 0.25 * dt;
      b.speed = PH.clamp(b.speed, -4, 24);
      var bTurn = bSteer * (1.6 / (1 + Math.abs(b.speed) * 0.06)) * PH.clamp(Math.abs(b.speed) / 2, 0, 1);
      b.heading += bTurn * Math.sign(b.speed) * dt;
      b.x += Math.sin(b.heading) * b.speed * dt;
      b.z += Math.cos(b.heading) * b.speed * dt;
      // shoreline + world bounds
      if (b.z < 127.5) { b.z = 127.5; b.speed *= 0.6; }
      b.z = PH.clamp(b.z, 127.5, 262);
      b.x = PH.clamp(b.x, -215, 215);
      var col3 = PH.collideCircle(b.x, b.z, 2.2);
      b.x = col3.x; b.z = col3.z;
      PH.boats.hero.position.set(b.x, 0.05 + Math.sin(game.time * 2) * 0.06, b.z);
      PH.boats.hero.rotation.y = b.heading;
      PH.boats.hero.rotation.z = PH.clamp(-bTurn * 0.4, -0.1, 0.1);
      // Mateo at the helm, Kira aboard on the stern bench (local seat coords -> world)
      game.mateo.position.set(
        b.x + Math.sin(b.heading) * 0.2 - Math.cos(b.heading) * 0.45,
        0.9,
        b.z + Math.cos(b.heading) * 0.2 + Math.sin(b.heading) * 0.45);
      game.mateo.rotation.y = b.heading;
      game.mateo.rotation.x = 0;
      game.kira.position.set(
        b.x - Math.sin(b.heading) * 1.6 + Math.cos(b.heading) * 0.45,
        1.0,
        b.z - Math.cos(b.heading) * 1.6 - Math.sin(b.heading) * 0.45);
      game.kira.rotation.y = b.heading;
      PH.audio.setBoatEngine(Math.abs(b.speed) / 24);
      // boat completion
      var tgt = PH.world.spawns.boatTarget;
      if (game.stage === 3 && PH.dist2d(b.x, b.z, tgt.x, tgt.z) < 12) {
        game.stage = 4;
        game.money += 3000;
        PH.hud.setMoney(game.money);
        PH.hud.show('boat-panel', false);
        showDialog('kira', 'KIRA', 'We did it, Mateo. Three thousand, clean, and the bay behind us. Sunset Bay is ours now.');
        PH.hud.toast('BOAT ESCAPE COMPLETE — +$3,000');
        updateMissionHUD();
        saveGame(true);
      }
      // second police boat halfway there
      if (PH.boats.policeBoats.length === 1 && PH.dist2d(b.x, b.z, tgt.x, tgt.z) < 90) PH.boats.spawnPoliceBoat();
    } else {
      PH.audio.setBoatEngine(0);
    }
    // --- sim ---
    PH.sim.updateTraffic(dt);
    PH.sim.updatePeds(dt, game.mode === 'onfoot' ? game.player : (game.car || game.player));
    PH.sim.updatePolice(dt, {
      x: game.mode === 'boat' ? game.boat.x : (game.mode === 'driving' ? game.car.x : game.player.x),
      z: game.mode === 'boat' ? game.boat.z : (game.mode === 'driving' ? game.car.z : game.player.z),
      mode: game.mode,
      heading: game.mode === 'driving' ? game.car.heading : game.player.heading,
      carSpeed: game.mode === 'driving' ? Math.abs(game.car.speed) : 0
    }, wantedStars());
    PH.boats.update(dt, game.time, game.mode === 'boat' ? game.boat : null);
    // --- race ---
    if (game.stage === 2) {
      var racePlayer = game.mode === 'driving' ? game.car : game.player;
      PH.race.update(dt, racePlayer);
    }
    // --- wanted decay ---
    if (game.time - game.lastCrimeT > 6) {
      var nearest = 999;
      PH.sim.policeCars.forEach(function (c) {
        nearest = Math.min(nearest, PH.dist2d(c.x, c.z, game.player.x, game.player.z));
      });
      if (nearest > 45) game.wantedPts = Math.max(0, game.wantedPts - 2.5 * dt);
    }
    // --- particles ---
    for (var pi = game.particles.length - 1; pi >= 0; pi--) {
      var pt = game.particles[pi];
      pt.life -= dt;
      if (pt.life <= 0) { PH.scene.remove(pt.mesh); game.particles.splice(pi, 1); continue; }
      pt.mesh.position.x += pt.vel.x * dt;
      pt.mesh.position.y += pt.vel.y * dt;
      pt.mesh.position.z += pt.vel.z * dt;
      pt.vel.y -= 6 * dt;
      pt.mesh.material.transparent = true;
      pt.mesh.material.opacity = pt.life * 2;
    }
    if (game.muzzle.intensity > 0) game.muzzle.intensity = Math.max(0, game.muzzle.intensity - dt * 40);
    if (game.muzzleFlash.visible) {
      game.muzzleFlash.material.opacity -= dt * 2.5; // ~0.38 s of visible flash
      if (game.muzzleFlash.material.opacity <= 0) game.muzzleFlash.visible = false;
    }
    if (game.muzzleCore.visible) {
      game.muzzleCore.material.opacity -= dt * 2.5;
      if (game.muzzleCore.material.opacity <= 0) game.muzzleCore.visible = false;
    }
    // --- objective marker bob ---
    var mp = missionMarkerPos();
    if (mp && game.marker) {
      game.marker.visible = true;
      game.marker.position.set(mp.x, mp.y + Math.sin(game.time * 2.4) * 0.4, mp.z);
      game.marker.rotation.y += dt * 1.5;
    } else if (game.marker) game.marker.visible = false;
    // --- interact / exit prompts (driven by authoritative state, never by UI text) ---
    var showInteract = false, interactText = '';
    var showExit = false, exitText = '';
    if (game.mode === 'onfoot' && game.player.health > 0) {
      if (game.stage === 1 && PH.dist2d(game.player.x, game.player.z, PH.world.spawns.kira.x, PH.world.spawns.kira.z) < 3.2) {
        showInteract = true; interactText = 'Talk to Kira';
      } else if ((game.stage === 3 || game.stage === 4) && PH.dist2d(game.player.x, game.player.z, PH.world.spawns.boat.x, PH.world.spawns.boat.z) < 4.5) {
        showInteract = true; interactText = 'Board the speedboat';
      } else {
        var nc = nearestCar(2.5);
        if (nc) { showInteract = true; interactText = 'Drive the ' + nc.name; }
      }
    }
    if (game.mode === 'driving') { showExit = true; exitText = 'Exit car'; }
    if (game.mode === 'boat') { showExit = true; exitText = 'Step off the boat'; }
    PH.hud.show('interact-prompt', showInteract);
    if (showInteract) PH.hud.text('interact-prompt-text', interactText);
    PH.hud.show('exit-prompt', showExit);
    if (showExit) PH.hud.text('exit-prompt-text', exitText);
    PH.hud.show('crosshair', game.mode === 'onfoot');
  }

  // ---------------- camera + render loop ----------------
  var clock = { last: performance.now() };
  var hudT = 0;
  function animate() {
    requestAnimationFrame(animate);
    var nowMs = performance.now();
    var dtReal = (nowMs - clock.last) / 1000;
    var dtRaw = Math.min(0.1, dtReal);
    clock.last = nowMs;
    var now = nowMs / 1000;
    // perf ring buffer records REAL frame time (unclamped), not the clamped physics dt
    var pf = game.perf;
    pf.frames++;
    pf.times.push(dtReal * 1000);
    if (pf.times.length > 600) pf.times.shift();
    // title backdrop: the city lives behind the title card, slow orbit over the boulevard
    if (game.state === 'title') {
      PH.sim.updateTraffic(dtRaw);
      PH.sim.updatePeds(dtRaw, { x: 0, z: 0 });
      PH.sky.update(now, dtRaw);
      PH.water.update(now, dtRaw);
      var ta = now * 0.05;
      PH.camera.position.set(Math.sin(ta) * 60, 26, Math.cos(ta) * 60 - 10);
      PH.camera.lookAt(0, 2, 0);
    }
    if (game.state === 'play' && !game.paused) {
      game.acc += dtRaw;
      var steps = 0;
      while (game.acc >= STEP && steps < 5) {
        stepPhysics(STEP);
        game.acc -= STEP;
        steps++;
      }
      if (steps === 5) game.acc = 0;
      var alpha = game.acc / STEP;
      // render interpolation for the main subjects
      if (game.mode === 'driving' && game.car) {
        game.car.group.position.x = PH.lerp(game.prevCar.x, game.car.x, alpha);
        game.car.group.position.z = PH.lerp(game.prevCar.z, game.car.z, alpha);
        game.car.group.rotation.y = PH.angleLerp(game.prevCar.heading, game.car.heading, alpha);
      }
      if (game.mode === 'onfoot') {
        game.mateo.position.x = PH.lerp(game.prevPlayer.x, game.player.x, alpha);
        game.mateo.position.z = PH.lerp(game.prevPlayer.z, game.player.z, alpha);
      }
      if (game.mode === 'boat') {
        PH.boats.hero.position.x = PH.lerp(game.prevBoat.x, game.boat.x, alpha);
        PH.boats.hero.position.z = PH.lerp(game.prevBoat.z, game.boat.z, alpha);
      }
      // camera follow
      var target, heading, dist, height;
      if (game.mode === 'driving' && game.car) {
        target = game.car.group.position; heading = game.car.heading; dist = 10; height = 4.2;
      } else if (game.mode === 'boat') {
        target = PH.boats.hero.position; heading = game.boat.heading; dist = 13; height = 5.5;
      } else {
        target = game.mateo.position; heading = game.player.heading; dist = 6.5; height = 3.0;
      }
      var camAngle = heading + Math.PI + game.camOrbit;
      var cx = target.x + Math.sin(camAngle) * dist;
      var cz = target.z + Math.cos(camAngle) * dist;
      var cy = target.y + height;
      var k2 = 1 - Math.exp(-7 * dtRaw);
      game.camPos.x = PH.lerp(game.camPos.x, cx, k2);
      game.camPos.y = PH.lerp(game.camPos.y, cy, k2);
      game.camPos.z = PH.lerp(game.camPos.z, cz, k2);
      PH.camera.position.copy(game.camPos);
      PH.camera.lookAt(target.x + Math.sin(heading) * 4, target.y + 1.4, target.z + Math.cos(heading) * 4);
      // sun shadow follows the player
      PH.sun.position.set(target.x - 140, 62, target.z - 55);
      PH.sun.target.position.set(target.x, 0, target.z);
      PH.sun.target.updateMatrixWorld();
      // throttled visual hooks (~15-30 Hz, never every frame)
      PH.sky.update(now, dtRaw);
      PH.heli.update(now, dtRaw, { x: target.x, z: target.z }, wantedStars());
      PH.water.update(now, dtRaw);
      PH.wetroad.update(now, PH.camera);
      // throttled HUD
      hudT += dtRaw;
      if (hudT > 0.12) {
        hudT = 0;
        PH.hud.setWanted(wantedStars());
        PH.hud.setTimer(game.missionTime);
        PH.hud.setMoney(game.money);
        if (game.mode === 'driving' && game.car) {
          PH.hud.setSpeed(Math.abs(game.car.speed) * 3.6);
          PH.hud.setCar(game.car.name, 100 - game.car.damage);
        } else if (game.mode === 'boat') {
          PH.hud.setSpeed(Math.abs(game.boat.speed) * 1.94);
          PH.hud.setCar('SPEEDBOAT', 100);
          PH.hud.text('boat-speed', Math.round(Math.abs(game.boat.speed) * 1.94) + ' KN');
          var tgt = PH.world.spawns.boatTarget;
          PH.hud.text('boat-objective', 'Reach the far pier — ' + Math.round(PH.dist2d(game.boat.x, game.boat.z, tgt.x, tgt.z)) + ' m');
        } else {
          PH.hud.setSpeed(Math.abs(game.player.speed || 0) * 3.6);
          PH.hud.setCar('ON FOOT', 100 - (game.car ? game.car.damage : 0));
        }
        // dispatch panel: REAL active police units with live distance
        var w = wantedStars();
        PH.hud.show('dispatch-panel', w > 0 || game.mode === 'boat');
        if (w > 0 || game.mode === 'boat') {
          var px = game.mode === 'boat' ? game.boat.x : (game.mode === 'driving' ? game.car.x : game.player.x);
          var pz = game.mode === 'boat' ? game.boat.z : (game.mode === 'driving' ? game.car.z : game.player.z);
          var lines = '';
          PH.sim.policeCars.forEach(function (c) {
            lines += c.callsign + ' — ' + c.state.toUpperCase() + ' — ' + Math.round(PH.dist2d(c.x, c.z, px, pz)) + ' m<br>';
          });
          if (PH.heli.active) lines += 'AIR-1 HELI — OVERWATCH — ' + Math.round(PH.dist2d(PH.heli.mesh.position.x, PH.heli.mesh.position.z, px, pz)) + ' m<br>';
          PH.boats.policeBoats.forEach(function (b) {
            lines += b.callsign + ' — MARINE PURSUIT — ' + Math.round(PH.dist2d(b.x, b.z, px, pz)) + ' m<br>';
          });
          if (!lines) lines = 'No active units.';
          PH.hud.setDispatch(lines);
        }
        PH.audio.siren(w >= 2);
        // minimap (core throttles to 0.15 s)
        var cars = [];
        PH.sim.cars.forEach(function (c) { cars.push({ x: c.x, z: c.z }); });
        var pol = [];
        PH.sim.policeCars.forEach(function (c) { pol.push({ x: c.x, z: c.z }); });
        var boats = [];
        PH.boats.policeBoats.forEach(function (b) { boats.push({ x: b.x, z: b.z }); });
        if (game.mode === 'boat') boats.push({ x: game.boat.x, z: game.boat.z });
        var mp = missionMarkerPos();
        PH.minimap.draw(now, {
          player: {
            x: game.mode === 'boat' ? game.boat.x : (game.mode === 'driving' ? game.car.x : game.player.x),
            z: game.mode === 'boat' ? game.boat.z : (game.mode === 'driving' ? game.car.z : game.player.z),
            heading: game.mode === 'driving' ? game.car.heading : (game.mode === 'boat' ? game.boat.heading : game.player.heading)
          },
          cars: cars, police: pol, boats: boats,
          marker: mp ? { x: mp.x, z: mp.z } : null
        });
      }
    }
    PH.renderer.render(PH.scene, PH.camera);
  }

  // ---------------- save / load ----------------
  var SAVE_KEY = 'pierheat-v8-save';
  function saveGame(silent) {
    try {
      var data = {
        version: 8,
        mode: game.mode,
        player: { x: game.player.x, z: game.player.z, heading: game.player.heading, health: game.player.health, armor: game.player.armor },
        car: game.car ? { x: game.car.x, z: game.car.z, heading: game.car.heading, damage: game.car.damage, name: game.car.name, isHero: game.car.isHero } : null,
        boat: { x: game.boat.x, z: game.boat.z, heading: game.boat.heading, boarded: game.boat.boarded },
        money: game.money,
        stage: game.stage,
        raceSub: game.raceSub,
        raceGate: PH.race.currentGate,
        missionTime: game.missionTime,
        wantedPts: game.wantedPts,
        weaponIdx: game.weaponIdx,
        ammo: game.weapons.map(function (w) { return { mag: w.mag, reserve: w.reserve }; })
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      game.saveExists = true;
      document.getElementById('btn-continue').style.display = 'inline-block';
      if (!silent) PH.hud.saveToast('Game saved');
      return true;
    } catch (e) { return false; }
  }
  function loadGame() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { PH.hud.toast('No save found'); return false; }
      var d = JSON.parse(raw);
      if (d.version !== 8) { PH.hud.toast('Save is from an older version'); return false; }
      // ACTIVE position: on-foot position when walking, car position when driving
      game.player.x = d.player.x; game.player.z = d.player.z; game.player.heading = d.player.heading;
      game.player.health = d.player.health; // health 0 stays 0 — never reset to 100
      game.player.armor = d.player.armor;
      game.money = d.money;
      game.stage = d.stage;
      game.raceSub = d.raceSub || 'toStart';
      game.missionTime = d.missionTime || 0;
      game.wantedPts = d.wantedPts || 0;
      game.weaponIdx = d.weaponIdx === undefined ? 1 : d.weaponIdx;
      if (d.ammo) d.ammo.forEach(function (a, i) {
        if (game.weapons[i]) { game.weapons[i].mag = a.mag; game.weapons[i].reserve = a.reserve; }
      });
      if (d.car) {
        game.car.x = d.car.x; game.car.z = d.car.z; game.car.heading = d.car.heading;
        game.car.damage = d.car.damage || 0;
        if (d.car.isHero) game.heroDamage = game.car.damage;
        game.car.group.position.set(d.car.x, 0, d.car.z);
        game.car.group.rotation.y = d.car.heading;
      }
      if (d.boat) {
        game.boat.x = d.boat.x; game.boat.z = d.boat.z; game.boat.heading = d.boat.heading;
        PH.boats.hero.position.set(d.boat.x, 0.05, d.boat.z);
        PH.boats.hero.rotation.y = d.boat.heading;
      }
      if (d.mode === 'driving') {
        game.mode = 'driving';
        game.mateo.visible = false;
      } else if (d.mode === 'boat') {
        game.mode = 'boat';
        game.boat.boarded = true;
        game.mateo.visible = true;
      } else {
        game.mode = 'onfoot';
        game.mateo.visible = true;
        game.mateo.position.set(game.player.x, PH.world.groundHeight(game.player.x, game.player.z), game.player.z);
        game.mateo.rotation.y = game.player.heading;
      }
      game.prevPlayer = { x: game.player.x, z: game.player.z, heading: game.player.heading };
      game.prevCar = game.car ? { x: game.car.x, z: game.car.z, heading: game.car.heading } : game.prevCar;
      if (d.raceGate !== undefined && d.stage === 2) PH.race.currentGate = d.raceGate;
      updateMissionHUD();
      PH.hud.setMoney(game.money);
      PH.hud.setHealth(game.player.health);
      PH.hud.setArmor(game.player.armor);
      PH.hud.setWanted(wantedStars());
      PH.hud.setWeaponSel(game.weaponIdx);
      updateAmmoHUD();
      if (game.player.health <= 0) {
        document.getElementById('downed-overlay').classList.add('on');
      } else {
        document.getElementById('downed-overlay').classList.remove('on');
      }
      PH.hud.saveToast('Game loaded');
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // ---------------- race events ----------------
  PH.events.on('race-complete', function (ev) {
    game.money += PH.race.reward;
    game.stage = 3;
    game.raceSub = 'toStart';
    PH.hud.setMoney(game.money);
    showDialog('kira', 'KIRA',
      'You did it, Mateo — ' + ev.position + ' place in ' + PH.fmtRaceTime(ev.time) + '! The boat is waiting at the pier. ' +
      'Get down there before the PD locks the harbour down. +$' + PH.race.reward);
    PH.hud.toast('RACE WON — +$' + PH.race.reward);
    // Kira waits by the boat now
    game.kira.position.set(10, 1.2, 158);
    game.kira.rotation.y = Math.PI;
    updateMissionHUD();
    saveGame(true);
  });

  // ---------------- perf stats for probes ----------------
  PH.perf = {
    stats: function () {
      var t = game.perf.times.slice().sort(function (a, b) { return a - b; });
      if (!t.length) return { fps: 0, avgMs: 0, p95Ms: 0, low1: 0, drawCalls: 0, triangles: 0 };
      var avg = t.reduce(function (a, b) { return a + b; }, 0) / t.length;
      var p95 = t[Math.floor(t.length * 0.95)] || t[t.length - 1];
      var worst = t.slice(0, Math.max(1, Math.floor(t.length * 0.01)));
      var low1 = worst.reduce(function (a, b) { return a + b; }, 0) / worst.length;
      return {
        fps: 1000 / avg, avgMs: avg, p95Ms: p95, low1Fps: 1000 / low1,
        drawCalls: PH.renderer.info.render.calls, triangles: PH.renderer.info.render.triangles
      };
    },
    reset: function () { game.perf.times = []; }
  };

  // ---------------- debug / test hooks (probes and screenshot staging only) ----------------
  PH.debug = {
    start: function (opts) { startPlay(opts || {}); },
    state: function () {
      return {
        state: game.state, mode: game.mode, stage: game.stage,
        player: { x: game.player.x, z: game.player.z, heading: game.player.heading, health: game.player.health, armor: game.player.armor },
        car: game.car ? { x: game.car.x, z: game.car.z, heading: game.car.heading, speed: game.car.speed, damage: game.car.damage, name: game.car.name } : null,
        boat: { x: game.boat.x, z: game.boat.z, heading: game.boat.heading, speed: game.boat.speed, boarded: game.boat.boarded },
        wanted: wantedStars(), wantedPts: game.wantedPts, money: game.money,
        race: { state: PH.race.state, gate: PH.race.currentGate, time: PH.race.raceTime },
        police: PH.sim.policeCars.map(function (c) { return { callsign: c.callsign, x: c.x, z: c.z, state: c.state, speed: c.speed }; }),
        heliActive: PH.heli.active,
        traffic: PH.sim.cars.length, peds: PH.sim.peds.length,
        errors: window.__phErrors || []
      };
    },
    setWanted: function (pts) { game.wantedPts = pts; game.lastCrimeT = game.time; },
    setPlayer: function (x, z) { game.player.x = x; game.player.z = z; game.prevPlayer = { x: x, z: z, heading: game.player.heading }; },
    setCar: function (x, z, heading) {
      if (!game.car) return;
      game.car.x = x; game.car.z = z;
      if (heading !== undefined) game.car.heading = heading;
      game.car.speed = 0;
      game.prevCar = { x: x, z: z, heading: game.car.heading };
    },
    setBoat: function (x, z, heading) {
      game.boat.x = x; game.boat.z = z;
      if (heading !== undefined) game.boat.heading = heading;
      game.boat.speed = 0;
    },
    interact: function () { tryInteract(); },
    enterCar: function () { var c = nearestCar(60); if (c) enterCar(c); },
    exitCar: function () { exitCar(); },
    shootAt: function (x, y, z) {
      // same raycast path as a mouse click, aimed at a world point
      var v = new THREE.Vector3(x, y, z).project(PH.camera);
      game.raycaster.setFromCamera(new THREE.Vector2(v.x, v.y), PH.camera);
      game.raycaster.far = 120;
      var hits = game.raycaster.intersectObjects(game.shootables, true);
      if (!hits.length) return { hit: false };
      var obj = hits[0].object;
      while (obj && !obj.userData.shootable) obj = obj.parent;
      if (!obj || !obj.userData.shootable) return { hit: false };
      var s = obj.userData.shootable;
      var w = game.weapons[game.weaponIdx];
      if (s.kind === 'ped') { s.ref.health -= w.dmg; s.ref.fleeing = 6; addCrime(15, null); }
      if (s.kind === 'police') { s.ref.hp = (s.ref.hp === undefined ? 100 : s.ref.hp) - w.dmg; addCrime(30, null); }
      if (s.kind === 'traffic') addCrime(4, null);
      spawnImpact(hits[0].point);
      PH.hud.hitmarker();
      return { hit: true, kind: s.kind, health: s.ref.health, point: [hits[0].point.x, hits[0].point.y, hits[0].point.z] };
    },
    key: function (code, down) { game.keys[code] = !!down; },
    // Fast-forward: run N seconds of fixed-step physics synchronously (no rendering).
    // Probes only — the shipped game never calls this; it lets logic tests run at full
    // speed on a machine whose software renderer is slow.
    ff: function (seconds) {
      var n = Math.round(seconds * 60), i;
      for (i = 0; i < n; i++) stepPhysics(STEP);
      return this.state();
    },
    save: function () { return saveGame(); },
    load: function () { return loadGame(); },
    setHealth: function (hp) { game.player.health = hp; PH.hud.setHealth(hp); },
    racePosition: function () { return PH.race.position(game.mode === 'driving' ? game.car : game.player); },
    perf: function () { return PH.perf.stats(); }
  };

  // ---------------- go ----------------
  window.addEventListener('error', function (e) {
    (window.__phErrors = window.__phErrors || []).push(String(e.message || e.error));
  });
  window.addEventListener('load', function () {
    try {
      buildAll();
    } catch (e) {
      console.error(e);
      (window.__phErrors = window.__phErrors || []).push(String(e && e.message));
    }
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    game.state = 'title';
    animate();
  });
  // If load already fired (script at end of body), boot now.
  if (document.readyState === 'complete') {
    try { buildAll(); } catch (e) { console.error(e); }
    document.getElementById('loading-overlay').classList.add('hidden');
    game.state = 'title';
    animate();
  }
})();
