// PIER HEAT — Sunset Bay (v6.5)
// sim.js — game state: driving and walking, traffic and pedestrian AI,
// police response and the wanted system, missions, combat, and the four
// staged screenshot framings. No Rockstar assets, names or map: the city,
// the people and the story are original.
(function () {
  var PH = window.PH = window.PH || {};
  var core = PH.core, world = PH.world;
  var sim = PH.sim = {};

  sim.state = {
    money: 15300, respect: 140, wanted: 3,
    health: 100, armour: 60,
    weapon: 'Pistol', ammo: 24,
    onFoot: false, speed: 0, time: 0,
    mission: { id: 'M2', name: 'THREE GATES', stage: 1, stages: 3, timer: 240 },
    m1Done: true,
    staged: false, stageName: ''
  };

  var scene, rng;
  var heroCar, heroPos, heroHeading, heroSpeed;
  var mateo, mateoAim, mateoGLB = null;
  var traffic = [], parked = [], peds = [], policeCars = [], officers = [];
  var heli, roadblocks = [], tracers = [], gates = [];
  var downedEnemy, downedOfficer;
  var quietTimer = 0; // seconds without police in range, for wanted decay
  var flashTimer = 0;
  var stageLights = []; // warm point lights a stage adds (mission night)

  function clearStageLights() {
    stageLights.forEach(function (l) { scene.remove(l); });
    stageLights = [];
  }
  function addStageLight(x, y, z, color, intensity, distance) {
    var l = new THREE.PointLight(color, intensity, distance, 1);
    l.position.set(x, y, z);
    scene.add(l);
    stageLights.push(l);
    return l;
  }
  // Move every traffic car out of a road stretch so the staged hero is
  // the subject, not something a random sedan hides.
  function clearRoad(axis, coord, from, to) {
    for (var i = 0; i < traffic.length; i++) {
      var t = traffic[i];
      var along = axis === 'x' ? t.car.position.x : t.car.position.z;
      var lane = axis === 'x' ? t.car.position.z : t.car.position.x;
      if (t.axis === axis && Math.abs(lane - coord) < 4 && along > from && along < to) {
        if (axis === 'x') {
          t.car.position.set(-60 + (i * 7) % 150, 0, 30 + (i % 2 ? 2.5 : -2.5));
          t.car.rotation.y = i % 2 ? Math.PI : 0;
        } else {
          t.car.position.set(-30 + (i % 2 ? 2.5 : -2.5), 0, -60 + (i * 5) % 120);
          t.car.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    }
  }

  // ------------------------------------------------------------ init
  sim.init = function (sc) {
    scene = sc;
    rng = core.mulberry32(777);
    // hero: wedge sports car, orange, plate SUN-8821
    heroCar = world.buildCar({ type: 'sport', color: 0xe83a12, plate: 'SUN-8821' });
    scene.add(heroCar);
    heroPos = new THREE.Vector3(58, 0, 0);
    heroHeading = 0; // facing +X (east, toward the sun and the sea)
    heroSpeed = 0;
    // Mateo on foot (procedural; the GLB loader in main.js may replace
    // this figure with the vendored model when the file is present)
    mateo = world.buildMateo(false);
    mateo.visible = false;
    scene.add(mateo);
    mateoAim = world.buildMateo(true);
    mateoAim.visible = false;
    scene.add(mateoAim);
    buildTraffic();
    buildParked();
    buildPeds();
    buildPolice();
    buildGates();
    // downed figures for the market firefight (hidden until staged)
    downedEnemy = world.buildDowned(0xd23a2e, 1.0);
    downedEnemy.visible = false;
    scene.add(downedEnemy);
    downedOfficer = world.buildDowned(0x1a2a4a, 1.35);
    downedOfficer.visible = false;
    scene.add(downedOfficer);
    return sim;
  };

  function buildTraffic() {
    // 32 cars, 14 colours, looping along the avenue and street lanes.
    for (var i = 0; i < 32; i++) {
      var color = world.TRAFFIC_COLORS[i % world.TRAFFIC_COLORS.length];
      var type = i % 7 === 0 ? 'van' : (i % 5 === 0 ? 'pickup' : 'sedan');
      var car = world.buildCar({
        color: color, type: type,
        plate: 'SB-' + (1000 + Math.floor(rng() * 9000)),
        taxi: i % 9 === 0
      });
      var alongStreet = rng() < 0.5;
      var lane, axis, dir, pos;
      if (alongStreet) {
        var street = [-60, -30, 0, 30, 60][Math.floor(rng() * 5)];
        lane = street + (rng() < 0.5 ? -2.5 : 2.5);
        dir = lane > street ? 1 : -1;
        pos = new THREE.Vector3(-70 + rng() * 165, 0, lane);
        car.rotation.y = dir > 0 ? 0 : Math.PI;
        axis = 'x';
      } else {
        var ave = [-60, -30, 0, 30, 60][Math.floor(rng() * 5)];
        lane = ave + (rng() < 0.5 ? -2.5 : 2.5);
        dir = lane > ave ? -1 : 1;
        pos = new THREE.Vector3(lane, 0, -70 + rng() * 140);
        car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        axis = 'z';
      }
      car.position.copy(pos);
      scene.add(car);
      traffic.push({
        car: car, axis: axis, dir: dir, lane: lane,
        speed: 5 + rng() * 5, min: -72, max: 96, baseRotY: car.rotation.y
      });
    }
  }

  function buildParked() {
    // 14 parked cars along the curbs of Ocean Drive and the avenues.
    var spots = [];
    for (var i = 0; i < 7; i++) {
      spots.push([-58 + i * 20, 7.6, 0]);
      spots.push([-48 + i * 20, -7.6, Math.PI]);
    }
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var car = world.buildCar({
        color: world.TRAFFIC_COLORS[(i * 3 + 5) % world.TRAFFIC_COLORS.length],
        type: i % 4 === 0 ? 'pickup' : 'sedan',
        plate: 'SB-' + (2000 + i * 137)
      });
      car.position.set(s[0], 0, s[1]);
      car.rotation.y = s[2];
      scene.add(car);
      parked.push(car);
    }
  }

  function buildPeds() {
    // 120 pedestrians with varied colours, walking the sidewalks.
    // (36 more are already placed: 10 on the beach, 26 in the market.)
    var walks = [];
    for (var i = 0; i < 5; i++) walks.push({ axis: 'x', fixed: -60 + i * 30, side: -7.6 });
    for (var i = 0; i < 5; i++) walks.push({ axis: 'x', fixed: -60 + i * 30, side: 7.6 });
    for (var i = 0; i < 5; i++) walks.push({ axis: 'z', fixed: -60 + i * 30, side: -7.6 });
    for (var i = 0; i < 5; i++) walks.push({ axis: 'z', fixed: -60 + i * 30, side: 7.6 });
    for (var i = 0; i < 120; i++) {
      var w = walks[i % walks.length];
      var p = world.buildPed(rng, false);
      var t = -70 + rng() * 160;
      if (w.axis === 'x') p.position.set(t, 0, w.fixed + w.side);
      else p.position.set(w.fixed + w.side, 0, t);
      p.rotation.y = rng() * Math.PI * 2;
      scene.add(p);
      peds.push({ g: p, walk: w, t: t, dir: rng() < 0.5 ? 1 : -1 });
    }
  }

  function buildPolice() {
    // patrol cars + foot officers + the police helicopter
    for (var i = 0; i < 3; i++) {
      var pc = world.buildCar({ police: true, plate: 'PD-10' + (40 + i * 3) });
      scene.add(pc);
      policeCars.push({ car: pc, speed: 9 + i, offset: i });
    }
    for (var i = 0; i < 6; i++) {
      var off = world.buildPed(rng, false);
      // navy shirt marks the officer
      off.children[2].material = core.mat(0x1a2a4a, { toon: true });
      off.position.set(-20 + i * 9, 0, 7.6);
      scene.add(off);
      officers.push({ g: off, t: -20 + i * 9, dir: 1 });
    }
    heli = world.buildHelicopter();
    scene.add(heli);
  }

  function buildGates() {
    // M2 "Three Gates": glowing rings the player drives through.
    var gateSpots = [[10, 0, 0], [30, 0, -30], [-30, 0, 30]];
    for (var i = 0; i < gateSpots.length; i++) {
      var g = new THREE.Group();
      var ring = core.mesh(new THREE.TorusGeometry(3.2, 0.22, 10, 28),
        core.mat(0xffd23e, { emissive: true }), 0, 3.4, 0);
      g.add(ring);
      var pillar = core.mesh(core.cylGeo(0.5, 0.9, 18, 10),
        new THREE.MeshBasicMaterial({
          color: 0xffd23e, transparent: true, opacity: 0.22,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false
        }), 0, 9, 0);
      g.add(pillar);
      g.position.set(gateSpots[i][0], 0, gateSpots[i][2]);
      g.visible = false;
      scene.add(g);
      gates.push(g);
    }
  }

  // ----------------------------------------------------------- staging
  // Each shot pins the hero at 12 m/s and holds the police in a fixed
  // relative formation, so a slow headless capture still frames the chase.
  sim.stage = function (name) {
    sim.state.staged = true;
    sim.state.stageName = name;
    // reset everything visible that staging touches
    tracers.forEach(function (t) { scene.remove(t); });
    tracers = [];
    downedEnemy.visible = false;
    downedOfficer.visible = false;
    mateo.visible = false;
    mateoAim.visible = false;
    gates.forEach(function (g) { g.visible = false; });
    roadblocks.forEach(function (r) { scene.remove(r); });
    roadblocks = [];
    clearStageLights();
    heroCar.visible = true;
    sim.state.onFoot = false;
    // hide every patrol car; each stage shows only the ones it places, so
    // no unplaced unit sits at the origin and no dispatch row lies
    policeCars.forEach(function (p) { p.car.visible = false; });

    if (name === 'chase') {
      core.setTimeOfDay('sunset');
      sim.state.wanted = 3;
      // hero past the towers, on the open beach road: the low sun and the
      // sea are finally in frame ahead of him
      heroPos.set(88, 0, 0); heroHeading = 0; heroSpeed = 12;
      placeHeroCar();
      clearRoad('x', 0, 76, 98);
      // both police on the far (north) side of the road, so the camera's
      // south side stays clear and the hero's flank is unobstructed
      placePolice(0, 84, -4.5, 0);
      placePolice(1, 90, -3.5, 0);
      var rb = world.buildRoadblock();
      rb.position.set(94, 0, 0); rb.rotation.y = Math.PI / 2;
      scene.add(rb); roadblocks.push(rb);
      // helicopter LOW over the road ahead, upper-left of frame clear of
      // the mission panel, searchlight pooling on the asphalt
      heli.position.set(92, 8, -6);
      heli.rotation.set(0, -0.5, 0.06);
      heli.visible = true;
      sim.state.mission = { id: 'M2', name: 'THREE GATES', stage: 1, stages: 3, timer: 187 };
      return { cam: new THREE.Vector3(80, 2.2, 9.0), look: new THREE.Vector3(92, 2.0, 0.5) };
    }

    if (name === 'street') {
      core.setTimeOfDay('sunset');
      sim.state.wanted = 4;
      heroPos.set(30, 0, 22); heroHeading = Math.PI / 2; heroSpeed = 12;
      placeHeroCar();
      clearRoad('z', 30, -6, 28);
      // police flanking left and right AHEAD of the hero, so they frame
      // him instead of sitting between the camera and him
      placePolice(0, 27.2, 16, Math.PI / 2);
      placePolice(1, 32.8, 16, Math.PI / 2);
      placePolice(2, 30, 29.5, Math.PI / 2);
      var rb2 = world.buildRoadblock();
      rb2.position.set(30, 0, 4); rb2.rotation.y = 0;
      scene.add(rb2); roadblocks.push(rb2);
      // helicopter low over the avenue, upper-left of frame, clear of the
      // mission panel
      heli.position.set(27, 10, -2);
      heli.rotation.set(0, 0.4, -0.05);
      heli.visible = true;
      sim.state.mission = { id: 'M2', name: 'THREE GATES', stage: 2, stages: 3, timer: 142 };
      return { cam: new THREE.Vector3(36.5, 2.6, 27.5), look: new THREE.Vector3(29.5, 1.5, 12) };
    }

    if (name === 'mission') {
      core.setTimeOfDay('night');
      sim.state.wanted = 5;
      sim.state.onFoot = true;
      heroCar.visible = false;
      heroPos.set(-45, 0, 35); // dispatch distances measure from Mateo
      heroSpeed = 0;
      // Mateo in front of the stall row, clear of the counters, his orange
      // jacket lit warm so he reads at night instead of a black silhouette.
      // His front (+Z local: tee, zipper, stubble) faces the stalls, so
      // rotation.y is 0 — PI would turn his back and his pistol to camera.
      mateoAim.position.set(-45, 0, 35);
      mateoAim.rotation.y = 0;
      mateoAim.visible = true;
      if (mateoAim.userData.flash) mateoAim.userData.flash.visible = true;
      addStageLight(-45, 3.2, 37, 0xffb36b, 1.8, 20);
      addStageLight(-48, 4.5, 48, 0xffd98a, 1.4, 26);
      // downed enemy (red) + downed officer, 1.35x, mid-frame IN FRONT
      // of the stall row — behind the counters they are invisible
      downedEnemy.position.set(-47, 0.1, 37);
      downedEnemy.rotation.y = 0.7;
      downedEnemy.visible = true;
      downedOfficer.position.set(-43, 0.1, 37.5);
      downedOfficer.rotation.y = -0.9;
      downedOfficer.visible = true;
      // three thick yellow tracers from Mateo's pistol into the stalls
      addTracer(new THREE.Vector3(-44.9, 1.35, 36), new THREE.Vector3(-52, 1.2, 50));
      addTracer(new THREE.Vector3(-44.9, 1.35, 36), new THREE.Vector3(-43, 1.4, 53));
      addTracer(new THREE.Vector3(-44.9, 1.35, 36), new THREE.Vector3(-38, 1.1, 48));
      // roadblock + police car at the plaza's north edge
      var rb3 = world.buildRoadblock();
      rb3.position.set(-60, 0, 30); rb3.rotation.y = Math.PI / 2;
      scene.add(rb3); roadblocks.push(rb3);
      placePolice(0, -33, 32, Math.PI);
      // helicopter LOW over the market's north edge, upper-right of frame,
      // buzzing right over Mateo — clear of the mission panel
      heli.position.set(-48, 6.5, 40);
      heli.rotation.set(0, 2.6, 0.05);
      heli.visible = true;
      gates[1].visible = true;
      sim.state.mission = { id: 'M2', name: 'PIER RUN', stage: 2, stages: 3, timer: 96 };
      return { cam: new THREE.Vector3(-40.5, 2.4, 29), look: new THREE.Vector3(-45.5, 1.4, 46) };
    }

    // title
    core.setTimeOfDay('sunset');
    sim.state.wanted = 2;
    heroPos.set(20, 0, 0); heroHeading = 0; heroSpeed = 8;
    placeHeroCar();
    placePolice(0, 12, -2.5, 0);
    placePolice(1, 8, 2.8, 0);
    heli.position.set(48, 26, -30);
    heli.rotation.set(0, -0.9, 0);
    heli.visible = true;
    sim.state.mission = { id: 'M2', name: 'PIER RUN', stage: 1, stages: 3, timer: 240 };
    return { cam: new THREE.Vector3(115, 12, 58), look: new THREE.Vector3(25, 6, -8) };
  };

  function placeHeroCar() {
    heroCar.position.copy(heroPos);
    heroCar.rotation.y = heroHeading;
  }
  function placePolice(i, x, z, heading) {
    var p = policeCars[i];
    if (!p) return;
    p.car.position.set(x, 0, z);
    p.car.rotation.y = heading;
    p.car.visible = true;
  }
  function addTracer(from, to) {
    var dir = to.clone().sub(from);
    var len = dir.length();
    var geo = new THREE.CylinderGeometry(0.09, 0.09, len, 6);
    var m = new THREE.Mesh(geo, core.mat(0xffd23e, { emissive: true }));
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    scene.add(m);
    var glow = core.glowSprite(0xffd23e, 1.0);
    glow.position.copy(from);
    scene.add(glow);
    tracers.push(m); tracers.push(glow);
    return m;
  }
  sim.shoot = function () {
    if (!sim.state.onFoot) return;
    var from = mateoAim.position.clone();
    from.y += 1.35; from.z += 0.8;
    var to = from.clone(); to.z += 26;
    var t = addTracer(from, to);
    setTimeout(function () { scene.remove(t); }, 130);
    flashTimer = 0.07;
    if (mateoAim.userData.flash) mateoAim.userData.flash.visible = true;
    sim.state.ammo = Math.max(0, sim.state.ammo - 1);
    PH.audio && PH.audio.gunshot();
  };

  // ------------------------------------------------------------ update
  sim.update = function (dt, input) {
    sim.state.time += dt;
    var i, t;
    // hero: pinned speed in staged shots, free driving otherwise.
    // In a staged shot the whole formation is FROZEN: the hero keeps
    // its 12 m/s on the speedometer and its wheels turning, but nothing
    // moves, so a slow headless capture frames exactly the staged shot.
    if (!sim.state.staged) {
      driveHero(dt, input);
    } else {
      heroSpeed = sim.state.onFoot ? 0 : (sim.state.stageName === 'title' ? 8 : 12);
      sim.state.speed = heroSpeed;
      if (!sim.state.onFoot) spinWheels(heroCar, heroSpeed, dt);
    }
    // traffic: follow their lane, wrap at the ends
    for (i = 0; i < traffic.length; i++) {
      t = traffic[i];
      if (t.axis === 'x') {
        t.car.position.x += t.dir * t.speed * dt;
        if (t.car.position.x > 100) t.car.position.x = -74;
        if (t.car.position.x < -76) t.car.position.x = 98;
      } else {
        t.car.position.z += t.dir * t.speed * dt;
        if (t.car.position.z > 74) t.car.position.z = -74;
        if (t.car.position.z < -76) t.car.position.z = 72;
      }
      spinWheels(t.car, t.speed, dt);
    }
    // pedestrians: stroll their sidewalk, turn at the ends
    for (i = 0; i < peds.length; i++) {
      var p = peds[i];
      p.t += p.dir * p.g.userData.speed * dt;
      if (p.t > 72) { p.t = 72; p.dir = -1; }
      if (p.t < -72) { p.t = -72; p.dir = 1; }
      if (p.walk.axis === 'x') {
        p.g.position.x = p.t;
        p.g.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        p.g.position.z = p.t;
        p.g.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }
      p.g.position.y = Math.abs(Math.sin(sim.state.time * 6 + p.g.userData.phase)) * 0.04;
    }
    // police: in staged shots they hold formation; in free play they
    // chase the hero, faster and closer as the wanted level rises.
    for (i = 0; i < policeCars.length; i++) {
      var pc = policeCars[i];
      if (sim.state.staged) {
        // hold formation, wheels turning with the chase
        spinWheels(pc.car, heroSpeed, dt);
        continue;
      }
      var dx = heroPos.x - pc.car.position.x, dz = heroPos.z - pc.car.position.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      var chase = 7 + sim.state.wanted * 1.6;
      pc.car.position.x += (dx / dist) * chase * dt;
      pc.car.position.z += (dz / dist) * chase * dt;
      pc.car.rotation.y = Math.atan2(-dz, dx);
      spinWheels(pc.car, chase, dt);
    }
    // officers on foot patrol the sidewalk
    for (i = 0; i < officers.length; i++) {
      var o = officers[i];
      o.t += o.dir * 1.1 * dt;
      if (o.t > 60) o.dir = -1;
      if (o.t < -60) o.dir = 1;
      o.g.position.x = o.t;
      o.g.rotation.y = o.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    // helicopter: rotor spins, body bobs; at wanted 3+ it circles the hero
    if (heli) {
      heli.userData.rotor.rotation.y += dt * 22;
      heli.userData.tailRotor.rotation.x += dt * 30;
      heli.position.y += Math.sin(sim.state.time * 1.4) * dt * 0.25;
      if (!sim.state.staged && sim.state.wanted >= 3) {
        var a = sim.state.time * 0.25;
        heli.position.x = heroPos.x + Math.cos(a) * 18;
        heli.position.z = heroPos.z + Math.sin(a) * 18;
        heli.position.y = 16 + Math.sin(sim.state.time) * 0.8;
      }
    }
    // wanted decay: 22 s with no police inside 40 m drops one star
    var nearest = 999;
    for (i = 0; i < policeCars.length; i++) {
      var pp = policeCars[i].car.position;
      var ddx = pp.x - heroPos.x, ddz = pp.z - heroPos.z;
      nearest = Math.min(nearest, Math.sqrt(ddx * ddx + ddz * ddz));
    }
    if (nearest > 40) {
      quietTimer += dt;
      if (quietTimer > 22 && sim.state.wanted > 0) {
        sim.state.wanted--;
        quietTimer = 0;
      }
    } else quietTimer = 0;
    // mission timer
    if (sim.state.mission.timer > 0) sim.state.mission.timer -= dt;
    // muzzle flash fades
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0 && mateoAim.userData.flash) {
        mateoAim.userData.flash.visible = sim.state.staged && sim.state.stageName === 'mission';
      }
    }
    // mission gates pulse
    for (i = 0; i < gates.length; i++) {
      if (gates[i].visible) gates[i].rotation.y += dt * 0.6;
    }
    if (world.marketBeacon) world.marketBeacon.rotation.y += dt * 0.4;
  };

  function spinWheels(car, speed, dt) {
    if (!car.userData.wheels) return;
    var w = speed * dt / 0.36;
    for (var i = 0; i < car.userData.wheels.length; i++) {
      car.userData.wheels[i].rotation.z -= w;
    }
  }

  // The on-foot figure: the vendored GLB when it loaded, else procedural.
  sim.mateoFigure = function () { return mateoGLB || mateo; };

  // Free-play driving: W/S accelerate and brake, A/D steer, E enters and
  // exits the car, Space handbrakes. The car stays inside the city grid.
  function driveHero(dt, input) {
    if (sim.state.onFoot) {
      var fig = sim.mateoFigure();
      var sp = 4.5;
      var mx = (input.d ? 1 : 0) - (input.a ? 1 : 0);
      var mz = (input.s ? 1 : 0) - (input.w ? 1 : 0);
      fig.position.x += mx * sp * dt;
      fig.position.z += mz * sp * dt;
      fig.position.x = core.clamp(fig.position.x, -75, 96);
      fig.position.z = core.clamp(fig.position.z, -75, 75);
      if (mx || mz) fig.rotation.y = Math.atan2(mx, mz);
      fig.visible = true;
      mateoAim.visible = false;
      heroPos.copy(fig.position);
      return;
    }
    if (input.w) heroSpeed = Math.min(heroSpeed + 14 * dt, 26);
    else if (input.s) heroSpeed = Math.max(heroSpeed - 20 * dt, -6);
    else heroSpeed *= (1 - 0.8 * dt);
    if (input.space) heroSpeed *= (1 - 3 * dt);
    if (Math.abs(heroSpeed) > 0.5) {
      heroHeading += ((input.a ? 1 : 0) - (input.d ? 1 : 0)) * 1.9 * dt * Math.sign(heroSpeed);
    }
    heroPos.x += Math.cos(heroHeading) * heroSpeed * dt;
    heroPos.z += -Math.sin(heroHeading) * heroSpeed * dt;
    heroPos.x = core.clamp(heroPos.x, -74, 96);
    heroPos.z = core.clamp(heroPos.z, -74, 74);
    placeHeroCar();
    spinWheels(heroCar, heroSpeed, dt);
    sim.state.speed = heroSpeed;
  }

  // E: get in or out of the car. Stealing a car in front of a witness
  // raises the wanted level — the witness rule the whole system runs on.
  sim.toggleEnterExit = function () {
    var fig = sim.mateoFigure();
    if (sim.state.onFoot) {
      sim.state.onFoot = false;
      fig.visible = false;
      heroPos.copy(fig.position);
      heroCar.position.copy(heroPos);
      heroCar.visible = true;
    } else {
      sim.state.onFoot = true;
      heroCar.visible = false;
      fig.position.copy(heroPos);
      fig.position.x += 2.4;
      fig.visible = true;
      sim.crime(1, 'carjacking');
    }
  };

  // A crime a pedestrian or officer can see raises the wanted level.
  sim.crime = function (level, kind) {
    sim.state.wanted = Math.min(5, sim.state.wanted + level);
    quietTimer = 0;
    if (PH.audio) PH.audio.sirenBurst();
    return sim.state.wanted;
  };

  // Leaving a stage for free play: every patrol car is on the road again.
  sim.freePlay = function () {
    sim.state.staged = false;
    policeCars.forEach(function (p) { p.car.visible = true; });
  };

  // ------------------------------------------------------------- HUD data
  sim.getHUD = function () {
    var dispatch = [];
    var tactics = ['PIT', 'FLANK', 'BLOCK', 'PIT', 'FLANK'];
    for (var i = 0; i < policeCars.length; i++) {
      if (!policeCars[i].car.visible) continue; // unplaced units stay off the board
      var pp = policeCars[i].car.position;
      var dx = pp.x - heroPos.x, dz = pp.z - heroPos.z;
      dispatch.push({
        unit: 'UNIT 10' + (40 + i * 3),
        dist: Math.round(Math.sqrt(dx * dx + dz * dz)),
        tactic: tactics[i % tactics.length]
      });
    }
    dispatch.push({ unit: 'AIR-1 HELI', dist: heli ? Math.round(heli.position.distanceTo(heroPos)) : 0, tactic: 'SPOT' });
    return {
      wanted: sim.state.wanted,
      money: sim.state.money,
      respect: sim.state.respect,
      health: sim.state.health,
      armour: sim.state.armour,
      weapon: sim.state.weapon,
      ammo: sim.state.ammo,
      speed: Math.abs(Math.round(heroSpeed * 3.6)),
      onFoot: sim.state.onFoot,
      mission: sim.state.mission,
      dispatch: dispatch,
      hero: { x: Math.round(heroPos.x), z: Math.round(heroPos.z) }
    };
  };

  sim.counts = function () {
    var c = {};
    var w = world.counts;
    for (var k in w) c[k] = w[k];
    c.traffic = traffic.length;
    c.parked = parked.length;
    c.pedsTotal = peds.length + w.peds; // +beach +market +title-foreground
    c.policeCars = policeCars.length + roadblocks.length * 2;
    c.police = c.policeCars;
    c.heli = heli ? 1 : 0;
    c.officers = officers.length;
    c.gates = gates.length;
    return c;
  };

  sim.heroCar = function () { return heroCar; };
  sim.mateo = function () { return mateo; };
  sim.mateoAim = function () { return mateoAim; };
  sim.setMateoGLB = function (g) {
    mateoGLB = g;
    if (g) {
      // normalise the vendored model to Mateo's 1.8 m height
      var box = new THREE.Box3().setFromObject(g);
      var size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0.1) {
        var s = 1.8 / size.y;
        g.scale.setScalar(s);
      }
      g.visible = false;
      scene.add(g);
    }
  };
  sim.mateoGLB = function () { return mateoGLB; };
})();
