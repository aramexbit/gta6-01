// PIER HEAT — Sunset Bay (v6.6)
// sim.js — game state: driving and walking, traffic and pedestrian AI,
// police response and the wanted system, missions, combat, and the four
// staged screenshot framings. No Rockstar assets, names or map: the city,
// the people and the story are original.
// v6.6: hero back to a burnt-orange wedge sports car; chase + street in
// bright cloudy DAY; the mission helicopter big, low and centred in frame.
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
  var heli, roadblocks = [], tracers = [], gates = [], stageExtras = [];
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

  // Shove any pedestrian standing within r metres of the stage camera
  // along their walk, so no giant head photobombs the staged shot.
  function clearPedsNear(cam, r) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      var dx = p.g.position.x - cam.x, dz = p.g.position.z - cam.z;
      if (dx * dx + dz * dz < r * r) p.t += 25;
    }
  }

  // ------------------------------------------------------------ init
  sim.init = function (sc) {
    scene = sc;
    rng = core.mulberry32(777);
    // hero: wedge sports car, vivid orange (never the red wagon of v6.5),
    // plate SUN-8821
    heroCar = world.buildCar({ type: 'sport', color: 0xff7a1a, plate: 'SUN-8821' });
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
    stageExtras.forEach(function (e) { scene.remove(e); });
    stageExtras = [];
    downedEnemy.visible = false;
    downedOfficer.visible = false;
    mateo.visible = false;
    mateoAim.visible = false;
    if (mateoGLB) mateoGLB.visible = false;
    if (world.marketBeacon) world.marketBeacon.visible = true;
    gates.forEach(function (g) { g.visible = false; });
    roadblocks.forEach(function (r) { scene.remove(r); });
    roadblocks = [];
    clearStageLights();
    heroCar.visible = true;
    sim.state.onFoot = false;
    // hide every patrol car; each stage shows only the ones it places, so
    // no unplaced unit sits at the origin and no dispatch row lies
    policeCars.forEach(function (p) { p.car.visible = false; });

    if (name === 'bridge') {
      // v6.7 shot 1 — BRIDGE CHASE: bright cloudy DAY on the Sunset Bay
      // Bridge, a causeway over the open sea. The Scarlet Arrow runs the
      // deck with two PD units on its bumper, a roadblock under the
      // gantry sign ahead, the helicopter low over the water, and the
      // sea on both sides of the railings.
      core.setTimeOfDay('day');
      sim.state.wanted = 4;
      heroPos.set(168, 6, 0); heroHeading = 0; heroSpeed = 12;
      placeHeroCar();
      // police flanking AHEAD of the hero, so the orange wedge stays
      // the subject instead of hiding behind a patrol car (v6.7 pass 1)
      placePolice(0, 172, -3.6, 0);
      placePolice(1, 174, 3.6, 0);
      policeCars[0].car.position.y = 6;
      policeCars[1].car.position.y = 6;
      var rb = world.buildRoadblock();
      rb.position.set(196, 6, 0); rb.rotation.y = Math.PI / 2;
      scene.add(rb); roadblocks.push(rb);
      heli.scale.setScalar(1);
      heli.position.set(186, 15, -9);
      heli.rotation.set(0, -0.6, 0.05);
      heli.visible = true;
      sim.state.mission = { id: 'M2', name: 'THREE GATES', stage: 3, stages: 3, timer: 96 };
      return { cam: new THREE.Vector3(155.5, 8.1, 7.9), look: new THREE.Vector3(181, 6.7, -1.2) };
    }

    if (name === 'marketday') {
      // v6.7 shot 2 — MARKET WALK: bright cloudy DAY in the Little Havana
      // market. Mateo on foot in the aisle between the two stall rows,
      // orange jacket and face to camera, vendors and shoppers pressing
      // in around him, striped awnings and lit signs overhead.
      core.setTimeOfDay('day');
      sim.state.wanted = 2;
      sim.state.onFoot = true;
      heroCar.visible = false;
      heroPos.set(-46.8, 0, 44.5); // dispatch distances measure from Mateo
      heroSpeed = 0;
      // procedural Mateo here, not the GLB: his front (+Z: white tee,
      // zipper, stubble) is documented. The camera sits NORTH of him
      // (z 41 < 44.5), so rotation 2.62 turns that +Z front north
      // toward the camera — 0.25 showed his back in pass 1.
      mateo.position.set(-46.8, 0, 44.5);
      mateo.rotation.y = 2.62;
      mateo.visible = true;
      addStageLight(-46, 3.5, 42, 0xffd98a, 1.0, 16);
      // the mission beacon's tall pillar reads as a white slab in this
      // daylight frame, so it stays hidden for the market walk
      if (world.marketBeacon) world.marketBeacon.visible = false;
      // extra shoppers crowding the aisle BEHIND Mateo (removed with
      // the stage, like tracers) — none between camera and hero
      var mRng = core.mulberry32(20261120);
      var ringSpots = [[-49.5, 47], [-45, 47.5], [-50.5, 46], [-44.2, 47], [-47.5, 48.5], [-43.8, 46.5]];
      for (var mi = 0; mi < ringSpots.length; mi++) {
        var mp2 = world.buildPed(mRng, false);
        mp2.position.set(ringSpots[mi][0], 0, ringSpots[mi][1]);
        mp2.rotation.y = mRng() * Math.PI * 2;
        scene.add(mp2);
        stageExtras.push(mp2);
      }
      // two vendors behind the south-row counters, facing the aisle
      var v1 = world.buildPed(mRng, false);
      v1.position.set(-48, 0, 53.4); v1.rotation.y = Math.PI;
      scene.add(v1); stageExtras.push(v1);
      var v2 = world.buildPed(mRng, false);
      v2.position.set(-40, 0, 53.4); v2.rotation.y = Math.PI;
      scene.add(v2); stageExtras.push(v2);
      // shove any random market shopper off the camera→Mateo sightline,
      // so no giant head photobombs the hero (v6.7 pass 1: one did)
      if (world.marketPeds) {
        var camX = -44.8, camZ = 41.0, tgtX = -46.8, tgtZ = 44.5;
        var dx = tgtX - camX, dz = tgtZ - camZ, segLen = Math.sqrt(dx * dx + dz * dz);
        var nx = -dz / segLen, nz = dx / segLen; // perpendicular
        for (var mpi = 0; mpi < world.marketPeds.length; mpi++) {
          var mpd = world.marketPeds[mpi];
          var rx = mpd.position.x - camX, rz = mpd.position.z - camZ;
          var along = rx * dx / segLen + rz * dz / segLen;
          var perp = rx * nx + rz * nz;
          if (along > 0.5 && along < segLen + 1 && Math.abs(perp) < 2.0) {
            var push = (perp >= 0 ? 1 : -1) * (2.0 - Math.abs(perp) + 1.6);
            mpd.position.x += nx * push;
            mpd.position.z += nz * push;
          }
        }
      }
      // helicopter low over the market's far end, in frame above the stalls
      heli.scale.setScalar(0.9);
      heli.position.set(-52, 12, 58);
      heli.rotation.set(0, 0.6, 0.05);
      heli.visible = true;
      sim.state.mission = { id: 'M3', name: 'MARKET DAY', stage: 1, stages: 3, timer: 301 };
      clearPedsNear({ x: -44.8, z: 41 }, 6);
      return { cam: new THREE.Vector3(-44.8, 1.9, 41.0), look: new THREE.Vector3(-47.2, 1.35, 45.5) };
    }

    if (name === 'harbor') {
      // v6.7 shot 3 — HARBOR CHASE: sunset on the Sunset Harbor quay.
      // The Scarlet Arrow threads the container lane with two PD units
      // flanking ahead, a roadblock ahead, the gantry crane overhead and
      // the moored freighter behind, dock workers in hi-vis at the edges.
      core.setTimeOfDay('sunset');
      sim.state.wanted = 4;
      heroPos.set(108, 0, 61); heroHeading = 0; heroSpeed = 12;
      placeHeroCar();
      placePolice(0, 113, 57.8, 0);
      placePolice(1, 113.5, 64.2, 0);
      var rb3 = world.buildRoadblock();
      rb3.position.set(127, 0, 61); rb3.rotation.y = Math.PI / 2;
      scene.add(rb3); roadblocks.push(rb3);
      heli.scale.setScalar(1);
      heli.position.set(128, 10, 46);
      heli.rotation.set(0, 0.5, 0.04);
      heli.visible = true;
      sim.state.mission = { id: 'M2', name: 'THREE GATES', stage: 3, stages: 3, timer: 88 };
      return { cam: new THREE.Vector3(99.5, 2.1, 61.5), look: new THREE.Vector3(121, 1.5, 60.5) };
    }

    // beachtitle — v6.7 pass 3: hero + Mateo close to the camera, LEFT
    // of the title overlay (pass 2 parked them behind the START button);
    // camera low on the south sand looking north, sea at the right edge,
    // palms and the city edge at the left, beachgoers cleared from the
    // foreground so no giant figure blocks the lower frame.
    core.setTimeOfDay('sunset');
    sim.state.wanted = 2;
    heroPos.set(118, 0, 20); heroHeading = -0.5; heroSpeed = 0;
    placeHeroCar();
    // procedural Mateo: front (+Z) documented, face toward the camera,
    // standing at the Arrow's nose so the two read as one hero cluster
    // (pass 3 had them 23 m away and sunset-muted; now 11–14 m)
    mateo.position.set(120, 0, 22);
    mateo.rotation.y = 0.785;
    mateo.visible = true;
    // shove any beachgoer standing near the camera SOUTH, behind the
    // camera — pass 3 pushed them sideways into the hero's spot
    if (world.beachPeds) {
      for (var bpi = 0; bpi < world.beachPeds.length; bpi++) {
        var bpd = world.beachPeds[bpi];
        var bdx = bpd.position.x - 128, bdz = bpd.position.z - 30;
        if (bdx * bdx + bdz * bdz < 81) {
          bpd.position.z += 10;
        }
      }
    }
    placePolice(0, 124, -8, 0);
    heli.scale.setScalar(0.9);
    if (heli.userData.cone) heli.userData.cone.material.opacity = 0.05;
    if (heli.userData.pool) heli.userData.pool.material.opacity = 0.28;
    heli.position.set(135, 18, -14);
    heli.rotation.set(0, -0.9, 0);
    heli.visible = true;
    sim.state.mission = { id: 'M2', name: 'PIER RUN', stage: 1, stages: 3, timer: 240 };
    return { cam: new THREE.Vector3(128, 2.4, 30), look: new THREE.Vector3(112, 2, -10) };
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
      heroSpeed = sim.state.onFoot ? 0 : (sim.state.stageName === 'beachtitle' ? 0 : 12);
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
