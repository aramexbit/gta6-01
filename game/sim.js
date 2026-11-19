// PIER HEAT — Sunset Bay: simulation.
// Player movement and camera, traffic and pedestrians, police and wanted
// response, the 8-mission chain, HUD and minimap. Runs on the state in core.js
// and the builders in world.js.

(function () {
  'use strict';
  var PH = window.PH;
  var W = PH.world;

  var sim = PH.sim = {
    scene: null,
    player: { x: 20, z: 20, heading: 0, camYaw: 0, camPitch: -0.12, speed: 0, moving: false },
    mateo: null,
    playerCar: null,       // the car Mateo is driving (group + data)
    playerCarData: null,
    traffic: [],           // {g, x, z, heading, speed, color, isPolice, stolen}
    peds: [],              // {g, x, z, heading, speed, fleeing, dead}
    police: [],            // {g, x, z, heading, speed, kind:'foot'|'car'|'heli', dead, lockT, car}
    heli: null,
    courier: null,         // mission-5 target car
    beacon: null,
    beaconPos: { x: 0, z: 0 },
    checkpointIndex: 0,
    checkpoints: [],
    mission2Start: null,   // {x, z, t} when mission 2 driving began
    mission6Timer: 0,
    courierNearTimer: 0,
    keys: {},
    elapsed: 0,
  };

  // ------------------------------------------------------------ missions
  // Each mission: title, Kira briefing, objective text, beacon, reward.
  PH.MISSIONS = [
    {
      title: 'M1 — THE SCARLET ARROW',
      brief: 'Mateo, the Scarlet Arrow is parked on Ocean Drive, keys in the sun visor. Take it. No witnesses, no heat.',
      objective: 'Steal the Scarlet Arrow on Ocean Drive',
      beacon: { x: 128, z: 40 }, reward: 500,
    },
    {
      title: 'M2 — PIER RUN',
      brief: 'Drive the Arrow to the safehouse at the end of the pier. Cops will wake up once you are clear — lose them or outrun them.',
      objective: 'Drive to the pier safehouse — escape the heat',
      beacon: { x: 252, z: 0 }, reward: 800,
    },
    {
      title: 'M3 — CROSS-TOWN DROP',
      brief: 'Package in the trunk. Take it to the Little Havana corner, quiet streets if you can. No shooting unless you have to.',
      objective: 'Deliver the package to Little Havana',
      beacon: { x: -100, z: 100 }, reward: 800,
    },
    {
      title: 'M4 — KIRA’S DROP',
      brief: 'I left a bag under the Downtown tower steps. Grab it, then bring it back to the pier. Same rules: witnesses mean stars.',
      objective: 'Pick up Kira’s drop, then return to the pier',
      beacon: { x: -20, z: -20 }, reward: 900,
    },
    {
      title: 'M5 — TAIL THE COURIER',
      brief: 'A courier car is running the coast road. Get on its bumper and stay close for three seconds — do not ram it, just hold it.',
      objective: 'Tail the courier car — stay within 8 m for 3 s',
      beacon: { x: 100, z: -80 }, reward: 1200,
    },
    {
      title: 'M6 — EYES ON THE MARINA',
      brief: 'Park at the marina overlook and watch the gate for ten seconds. Nobody can know you are there.',
      objective: 'Watch the marina gate from the beacon for 10 s',
      beacon: { x: 150, z: -60 }, reward: 700,
    },
    {
      title: 'M7 — THREE GATES',
      brief: 'Three checkpoints, one route, no stopping. The city will try to stop you. Do not let it.',
      objective: 'Escape through 3 checkpoints',
      beacon: { x: -120, z: -120 }, reward: 1500,
    },
    {
      title: 'M8 — THE LAST TIDE',
      brief: 'Final run, Mateo. Reach the marina, then shake a three-star tail and vanish. After tonight, Sunset Bay is ours.',
      objective: 'Reach the marina, then lose a 3-star tail',
      beacon: { x: 160, z: -40 }, reward: 3000,
    },
  ];

  PH.currentMission = function () {
    return PH.MISSIONS[PH.state.missionIndex] || null;
  };

  PH.completeMission = function () {
    var m = PH.currentMission();
    if (!m) return;
    PH.state.money += m.reward;
    PH.pushFeed('Mission complete: ' + m.title + ' +' + PH.fmtMoney(m.reward));
    PH.sayKira('Clean work, Mateo. ' + PH.fmtMoney(m.reward) + ' in your pocket. ' +
      (PH.state.missionIndex + 1 < PH.MISSIONS.length ? 'Next job is on the board.' : 'That is the whole chain. Sunset Bay is yours.'), 7);
    PH.state.missionIndex++;
    PH.state.missionStage = 0;
    PH.state.missionProgress = 0;
    PH.state.missionTimer = 0;
    PH.saveGame();
    if (PH.state.missionIndex >= PH.MISSIONS.length) {
      PH.state.completed = true;
      PH.sayKira('All eight jobs done. Free roam, Mateo — the bay remembers.', 8);
    } else {
      PH.startMission(PH.state.missionIndex);
    }
    if (PH.onMissionChange) PH.onMissionChange();
  };

  PH.startMission = function (i) {
    var m = PH.MISSIONS[i];
    if (!m) return;
    PH.state.missionIndex = i;
    PH.state.missionStage = 0;
    PH.state.missionProgress = 0;
    PH.state.missionTimer = 0;
    PH.state.drivingDistance = 0; // mission-2 heat must measure a fresh drive
    sim.mission2Start = null;
    sim.mission6Timer = 0;
    sim.courierNearTimer = 0;
    sim.checkpointIndex = 0;
    PH.state.heatArmed = false;
    PH.sayKira(m.brief, 8);
    PH.pushFeed(m.title + ' — ' + m.objective);
    sim.setBeacon(m.beacon.x, m.beacon.z);
    if (i === 4) sim.spawnCourier();
    if (i === 6) {
      sim.checkpoints = [{ x: -120, z: -120 }, { x: 120, z: -120 }, { x: 120, z: 120 }];
      sim.setBeacon(sim.checkpoints[0].x, sim.checkpoints[0].z);
    }
    if (i === 7) PH.setWanted(0);
    if (PH.onMissionChange) PH.onMissionChange();
  };

  // ------------------------------------------------------------ spawning
  sim.setBeacon = function (x, z) {
    sim.beaconPos = { x: x, z: z };
    if (sim.beacon) { sim.beacon.position.set(x, 0, z); sim.beacon.visible = true; }
  };

  sim.hideBeacon = function () { if (sim.beacon) sim.beacon.visible = false; };

  sim.spawnTrafficCar = function (x, z, heading, color) {
    var g = W.makeCar(color || PH.pick(W.PALETTE.carColors), { sport: Math.random() < 0.25 });
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    sim.scene.add(g);
    var car = { g: g, x: x, z: z, heading: heading, speed: PH.rand(7, 11), color: color, isPolice: false, stolen: false, targetStreet: null, dir: 1 };
    sim.traffic.push(car);
    return car;
  };

  sim.spawnPed = function (x, z) {
    var g = W.makePed();
    g.position.set(x, 0, z);
    sim.scene.add(g);
    var ped = { g: g, x: x, z: z, heading: PH.rand(0, Math.PI * 2), speed: PH.rand(1.0, 1.8), fleeing: false, dead: false, retarget: 0 };
    sim.peds.push(ped);
    return ped;
  };

  sim.spawnPoliceFoot = function (x, z) {
    var g = W.makePed();
    // Navy shirt + cap so officers read as police at a glance.
    if (g.userData.shirt) g.userData.shirt.material = W.mat(0x1d3a6e);
    var cap = W.box(0.4, 0.12, 0.38, 0x14264a, 0, 2.16, 0);
    g.add(cap);
    g.position.set(x, 0, z);
    sim.scene.add(g);
    var cop = { g: g, x: x, z: z, heading: 0, speed: 0, kind: 'foot', dead: false, lockT: 0, car: null };
    sim.police.push(cop);
    return cop;
  };

  sim.spawnPoliceCar = function (x, z) {
    var g = W.makePoliceCar();
    g.position.set(x, 0, z);
    sim.scene.add(g);
    var cop = { g: g, x: x, z: z, heading: 0, speed: 0, kind: 'car', dead: false, lockT: 0, car: g };
    sim.police.push(cop);
    return cop;
  };

  // Police summoned in a ring 28-42 m from the player (mission-2 heat).
  sim.summonPoliceRing = function (count) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = PH.rand(28, 42);
      var x = PH.clamp(sim.player.x + Math.cos(a) * r, -140, 210);
      var z = PH.clamp(sim.player.z + Math.sin(a) * r, -140, 140);
      sim.spawnPoliceCar(x, z);
      PH.pushFeed('Unit dispatched — ' + Math.round(PH.dist2d(x, z, sim.player.x, sim.player.z)) + ' m out');
    }
  };

  sim.spawnCourier = function () {
    if (sim.courier) return;
    var g = W.makeCar(0x37b268, { sport: true });
    g.position.set(100, 0, -80);
    sim.scene.add(g);
    sim.courier = { g: g, x: 100, z: -80, heading: Math.PI, speed: 12, waypoints: [[100, -80], [100, 80], [-80, 80], [-80, -80]], wp: 0 };
  };

  sim.spawnHeli = function () {
    if (sim.heli) return sim.heli;
    var g = W.makeHelicopter();
    g.position.set(sim.player.x + 40, 32, sim.player.z - 40);
    sim.scene.add(g);
    var h = { g: g, x: g.position.x, z: g.position.z, heading: 0, speed: 0, kind: 'heli', dead: false, lockT: 0, car: null };
    sim.police.push(h);
    sim.heli = h;
    PH.pushFeed('Air unit overhead — helicopter on station');
    return h;
  };

  // ------------------------------------------------------------ world init
  sim.init = function (scene) {
    sim.scene = scene;
    W.buildSky(scene);
    W.buildGroundAndSea(scene);
    W.buildBuildings(scene);
    W.buildStreetProps(scene);
    sim.beacon = W.makeBeacon();
    scene.add(sim.beacon);

    // Mateo.
    sim.mateo = W.makeMateo();
    sim.mateo.position.set(sim.player.x, 0, sim.player.z);
    scene.add(sim.mateo);

    // The Scarlet Arrow — the player's car, parked on Ocean Drive.
    var arrow = W.makeCar(0xe85a17, { sport: true, length: 4.6 });
    arrow.position.set(128, 0, 40);
    arrow.rotation.y = Math.PI / 2;
    scene.add(arrow);
    sim.playerCar = arrow;
    sim.playerCarData = { g: arrow, x: 128, z: 40, heading: Math.PI / 2, speed: 0, color: 0xe85a17, isPolice: false, stolen: false, isArrow: true };
    sim.arrowCar = sim.playerCarData;

    // Traffic: 14 cars cruising the grid.
    var streets = PH.CITY.streets;
    for (var i = 0; i < 14; i++) {
      var horizontal = Math.random() < 0.5;
      var s = PH.pick(streets);
      var t = PH.rand(-120, 120);
      var heading = horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      sim.spawnTrafficCar(horizontal ? t : s, horizontal ? s : t, heading);
    }
    // Pedestrians: 26 on sidewalks and the beach walk.
    for (var p = 0; p < 26; p++) {
      var px, pz;
      if (p < 6) { px = PH.rand(152, 190); pz = PH.rand(-130, 130); }
      else { px = PH.pick(streets) + PH.pick([-7.5, 7.5]); pz = PH.rand(-130, 130); }
      sim.spawnPed(PH.clamp(px, -140, 195), PH.clamp(pz, -140, 140));
    }
    // Two patrol cars at start (wanted 0: they just cruise).
    sim.spawnPoliceCar(-40, 0);
    sim.spawnPoliceCar(40, -80);

    PH.startMission(PH.state.missionIndex);
    // Re-apply saved progress: start screen shows the furthest mission.
    PH.sayKira(PH.MISSIONS[PH.state.missionIndex] ? PH.MISSIONS[PH.state.missionIndex].brief : 'Free roam, Mateo.', 8);
  };

  // ------------------------------------------------------------ player
  sim.nearestCar = function (maxD) {
    var best = null, bestD = maxD || 4;
    var all = sim.traffic.concat([sim.arrowCar]);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (!c || c.g === undefined) continue;
      var d = PH.dist2d(sim.player.x, sim.player.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  };

  // E: enter / exit a car. Entering an ordinary or mission car never adds stars.
  // Stealing a traffic car only adds a star when witnessed.
  sim.enterExitCar = function () {
    if (PH.state.inCar) {
      PH.state.inCar = false;
      sim.player.x = sim.playerCarData.x + Math.sin(sim.playerCarData.heading + Math.PI / 2) * 2.2;
      sim.player.z = sim.playerCarData.z + Math.cos(sim.playerCarData.heading + Math.PI / 2) * 2.2;
      sim.player.heading = sim.playerCarData.heading;
      sim.mateo.visible = true;
      PH.pushFeed('Left the car');
      return 'exit';
    }
    var car = sim.nearestCar(4.5);
    if (!car) return null;
    var isTraffic = sim.traffic.indexOf(car) >= 0;
    if (isTraffic && !car.stolen) {
      car.stolen = true;
      PH.state.carsStolen++;
      // Stealing a traffic car is a crime — but only with a witness.
      var seen = PH.commitCrime('steal', 1, car.x, car.z);
      PH.pushFeed(seen ? 'Car stolen — witnessed! Wanted up' : 'Car stolen — no witnesses');
    }
    // Remove from traffic list so it stops cruising on its own.
    var ti = sim.traffic.indexOf(car);
    if (ti >= 0) sim.traffic.splice(ti, 1);
    sim.playerCarData = car;
    sim.playerCar = car.g;
    PH.state.inCar = true;
    sim.mateo.visible = false;
    sim.player.heading = car.heading;
    PH.pushFeed(car.isArrow ? 'In the Scarlet Arrow' : 'In the car');
    return 'enter';
  };

  // F: shoot. Hitscan: nearest living ped/cop in a cone ahead, or the courier.
  sim.shoot = function () {
    if (PH.state.ammo <= 0) { PH.pushFeed('Out of ammo'); return null; }
    PH.state.ammo--;
    var px = sim.player.x, pz = sim.player.z;
    var dirX = Math.sin(sim.player.heading), dirZ = Math.cos(sim.player.heading);
    if (PH.state.inCar && sim.playerCarData) { px = sim.playerCarData.x; pz = sim.playerCarData.z; dirX = Math.sin(sim.playerCarData.heading); dirZ = Math.cos(sim.playerCarData.heading); }
    var seen = PH.commitCrime('shoot', 1, px, pz);
    // Fleeing peds near the shot.
    sim.peds.forEach(function (ped) {
      if (!ped.dead && PH.dist2d(px, pz, ped.x, ped.z) < 35) ped.fleeing = true;
    });
    // Hit test: closest target within 40 m and ~25 degrees of aim.
    var targets = [];
    sim.peds.forEach(function (ped) { if (!ped.dead) targets.push({ x: ped.x, z: ped.z, ref: ped, kind: 'ped' }); });
    sim.police.forEach(function (cop) { if (!cop.dead && cop.kind !== 'heli') targets.push({ x: cop.x, z: cop.z, ref: cop, kind: 'cop' }); });
    var best = null, bestD = 40;
    targets.forEach(function (t) {
      var dx = t.x - px, dz = t.z - pz;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > bestD || d < 0.5) return;
      var dot = (dx * dirX + dz * dirZ) / d;
      if (dot < 0.9) return;
      bestD = d; best = t;
    });
    var result = { seen: seen, hit: null };
    if (best) {
      if (best.kind === 'ped') {
        best.ref.dead = true;
        best.ref.g.visible = false;
        PH.state.kills++;
        PH.pushFeed('Pedestrian down');
        result.hit = 'ped';
      } else {
        best.ref.dead = true;
        best.ref.g.visible = false;
        PH.state.kills++;
        PH.addWanted(1);
        PH.pushFeed('Officer down — wanted up');
        result.hit = 'cop';
      }
    }
    if (PH.onShoot) PH.onShoot(result);
    return result;
  };

  // ------------------------------------------------------------ per-frame update
  sim.update = function (dt, camera) {
    sim.elapsed += dt;
    PH.state.timePlayed += dt;
    var st = PH.state;
    if (!st.started || st.paused || st.over) return;

    var p = sim.player;
    var k = sim.keys;

    // ---- player on foot
    if (!st.inCar) {
      var walkSpeed = k['shift'] ? 7.5 : 4.2;
      var mx = 0, mz = 0;
      if (k['w']) { mx += Math.sin(p.camYaw); mz += Math.cos(p.camYaw); }
      if (k['s']) { mx -= Math.sin(p.camYaw); mz -= Math.cos(p.camYaw); }
      if (k['a']) { mx -= Math.cos(p.camYaw); mz += Math.sin(p.camYaw); }
      if (k['d']) { mx += Math.cos(p.camYaw); mz -= Math.sin(p.camYaw); }
      var len = Math.sqrt(mx * mx + mz * mz);
      p.moving = len > 0;
      if (p.moving) {
        mx /= len; mz /= len;
        p.x = PH.clamp(p.x + mx * walkSpeed * dt, -145, 205);
        p.z = PH.clamp(p.z + mz * walkSpeed * dt, -145, 145);
        p.heading = Math.atan2(mx, mz);
        p.speed = walkSpeed;
      } else p.speed = 0;
      sim.mateo.position.set(p.x, 0, p.z);
      sim.mateo.rotation.y = p.heading;
      W.poseMateo(sim.mateo, dt, p.speed / 7.5, st.aiming, p.moving);
    }

    // ---- driving
    if (st.inCar && sim.playerCarData) {
      var car = sim.playerCarData;
      var accel = k['w'] ? 14 : k['s'] ? -10 : 0;
      if (k['shift']) accel *= 1.6;
      car.speed += accel * dt;
      car.speed *= Math.pow(0.4, dt); // drag / rolling resistance
      if (Math.abs(car.speed) < 0.05 && accel === 0) car.speed = 0;
      car.speed = PH.clamp(car.speed, -9, k['shift'] ? 34 : 26);
      var steer = 0;
      if (k['a']) steer = 1;
      if (k['d']) steer = -1;
      var drift = k[' '] ? 1.8 : 1;
      car.heading += steer * 1.9 * dt * PH.clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed < 0 ? -1 : 1) * drift;
      var prevX = car.x, prevZ = car.z;
      car.x = PH.clamp(car.x + Math.sin(car.heading) * car.speed * dt, -145, 210);
      car.z = PH.clamp(car.z + Math.cos(car.heading) * car.speed * dt, -145, 145);
      var moved = PH.dist2d(prevX, prevZ, car.x, car.z);
      st.speedKmh = Math.abs(car.speed) * 3.6;
      st.carHealth = PH.clamp(st.carHealth, 0, 100);
      // Mission-2 driving distance (heat trigger).
      if (st.missionIndex === 1 && !st.heatArmed) st.drivingDistance += moved;
      // Pedestrian collision while driving.
      sim.peds.forEach(function (ped) {
        if (ped.dead) return;
        if (PH.dist2d(car.x, car.z, ped.x, ped.z) < 1.9 && Math.abs(car.speed) > 3) {
          ped.dead = true; ped.g.visible = false;
          PH.commitCrime('hit-ped', 2, car.x, car.z);
          PH.pushFeed('Pedestrian hit by car');
          car.speed *= 0.6;
        }
      });
      // Police-car collision.
      sim.police.forEach(function (cop) {
        if (cop.dead || cop.kind !== 'car') return;
        if (PH.dist2d(car.x, car.z, cop.x, cop.z) < 3.2 && Math.abs(car.speed) > 4) {
          PH.commitCrime('hit-police', 2, car.x, car.z);
          PH.pushFeed('Police car rammed');
          car.speed *= 0.5;
        }
      });
      car.g.position.set(car.x, 0, car.z);
      car.g.rotation.y = car.heading;
      // Wheel spin.
      (car.g.userData.wheels || []).forEach(function (w) { w.rotation.z += car.speed * dt * 2; });
      p.x = car.x; p.z = car.z; p.heading = car.heading;
    } else {
      st.speedKmh = 0;
    }

    // ---- camera
    if (camera) sim.updateCamera(dt, camera);

    // ---- traffic, peds, police, missions
    sim.updateTraffic(dt);
    sim.updatePeds(dt);
    sim.updatePolice(dt);
    sim.updateMissions(dt);
    PH.updateWantedDecay(dt);

    // Sea shimmer + sun pulse + beacon spin.
    if (W.sea) W.sea.position.y = 0.02 + Math.sin(sim.elapsed * 0.7) * 0.08;
    if (sim.beacon && sim.beacon.visible) {
      sim.beacon.rotation.y += dt * 0.8;
      sim.beacon.userData.arrow.position.y = 8.5 + Math.sin(sim.elapsed * 3) * 0.4;
    }
  };

  sim.updateCamera = function (dt, camera) {
    var p = sim.player;
    var st = PH.state;
    if (st.inCar && sim.playerCarData) {
      var car = sim.playerCarData;
      var back = 11, up = 5;
      var tx = car.x - Math.sin(car.heading) * back;
      var tz = car.z - Math.cos(car.heading) * back;
      camera.position.x = PH.lerp(camera.position.x, tx, 1 - Math.pow(0.001, dt));
      camera.position.y = PH.lerp(camera.position.y, up, 1 - Math.pow(0.001, dt));
      camera.position.z = PH.lerp(camera.position.z, tz, 1 - Math.pow(0.001, dt));
      camera.lookAt(car.x + Math.sin(car.heading) * 6, 1.4, car.z + Math.cos(car.heading) * 6);
    } else {
      var yaw = st.aiming ? p.heading : p.camYaw;
      var dist = st.aiming ? 4.2 : 6.5;
      var cx = p.x - Math.sin(yaw) * dist;
      var cz = p.z - Math.cos(yaw) * dist;
      var cy = 2.6 - p.camPitch * 4;
      camera.position.x = PH.lerp(camera.position.x, cx, 1 - Math.pow(0.0005, dt));
      camera.position.y = PH.lerp(camera.position.y, cy, 1 - Math.pow(0.0005, dt));
      camera.position.z = PH.lerp(camera.position.z, cz, 1 - Math.pow(0.0005, dt));
      camera.lookAt(p.x + Math.sin(yaw) * 3, 1.5 + p.camPitch * 2, p.z + Math.cos(yaw) * 3);
    }
  };

  // Traffic follows the grid: pick a street line, drive along it, turn at ends.
  sim.updateTraffic = function (dt) {
    sim.traffic.forEach(function (car) {
      if (car.stolen) return;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (car.x > 135 || car.x < -135 || car.z > 135 || car.z < -135) {
        car.heading += Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
        car.x = PH.clamp(car.x, -130, 130); car.z = PH.clamp(car.z, -130, 130);
      }
      // Slow down for the car ahead.
      sim.traffic.forEach(function (other) {
        if (other === car) return;
        var d = PH.dist2d(car.x, car.z, other.x, other.z);
        if (d < 7 && Math.abs(car.heading - other.heading) < 0.5) car.speed = Math.max(4, car.speed - 6 * dt);
      });
      car.g.position.set(car.x, 0, car.z);
      car.g.rotation.y = car.heading;
      (car.g.userData.wheels || []).forEach(function (w) { w.rotation.z += car.speed * dt * 2; });
    });
    // Courier car (mission 5) follows its waypoint loop.
    if (sim.courier) {
      var c = sim.courier;
      var wp = c.waypoints[c.wp];
      var dx = wp[0] - c.x, dz = wp[1] - c.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 4) { c.wp = (c.wp + 1) % c.waypoints.length; }
      else {
        var target = Math.atan2(dx, dz);
        c.heading = PH.angleLerp(c.heading, target, 1 - Math.pow(0.01, dt));
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        c.g.position.set(c.x, 0, c.z);
        c.g.rotation.y = c.heading;
      }
    }
  };

  sim.updatePeds = function (dt) {
    sim.peds.forEach(function (ped) {
      if (ped.dead) return;
      if (ped.fleeing) {
        // Run away from the player.
        var dx = ped.x - sim.player.x, dz = ped.z - sim.player.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        ped.heading = Math.atan2(dx / d, dz / d);
        ped.x = PH.clamp(ped.x + Math.sin(ped.heading) * 5.5 * dt, -145, 200);
        ped.z = PH.clamp(ped.z + Math.cos(ped.heading) * 5.5 * dt, -145, 145);
        if (d > 45) ped.fleeing = false;
        W.posePed(ped.g, dt, 0.9);
      } else {
        ped.retarget -= dt;
        if (ped.retarget <= 0) {
          ped.retarget = PH.rand(3, 8);
          ped.heading = PH.rand(0, Math.PI * 2);
        }
        ped.x = PH.clamp(ped.x + Math.sin(ped.heading) * ped.speed * dt, -145, 200);
        ped.z = PH.clamp(ped.z + Math.cos(ped.heading) * ped.speed * dt, -145, 145);
        W.posePed(ped.g, dt, 0.35);
      }
      ped.g.position.set(ped.x, 0, ped.z);
      ped.g.rotation.y = ped.heading;
    });
  };

  // ------------------------------------------------------------ police AI
  sim.updatePolice = function (dt) {
    var st = PH.state;
    var p = sim.player;
    // Spawn pressure scales with wanted level — but in waves, never on top of
    // the player: a new unit only arrives when the nearest police is already
    // more than 45 m away and 8 s have passed since the last wave, so a
    // player who breaks contact can actually cool down (22 s with no police
    // inside 40 m drops one star).
    var wantCars = st.wanted >= 2 ? Math.min(2 + st.wanted, 6) : 0;
    var wantFoot = st.wanted === 1 ? 3 : (st.wanted >= 2 ? 1 : 0);
    var cars = sim.police.filter(function (c) { return c.kind === 'car' && !c.dead; }).length;
    var foots = sim.police.filter(function (c) { return c.kind === 'foot' && !c.dead; }).length;
    var nearestCop = PH.nearestPoliceDist(p.x, p.z);
    var spawnReady = (sim.elapsed - (sim.lastSpawnT || 0)) >= 8 && nearestCop > 45;
    if (st.wanted >= 2 && cars < wantCars && spawnReady) {
      sim.lastSpawnT = sim.elapsed;
      var a = Math.random() * Math.PI * 2;
      sim.spawnPoliceCar(PH.clamp(p.x + Math.cos(a) * 60, -140, 140), PH.clamp(p.z + Math.sin(a) * 60, -140, 140));
    }
    if (st.wanted === 1 && foots < wantFoot && spawnReady) {
      sim.lastSpawnT = sim.elapsed;
      var b = Math.random() * Math.PI * 2;
      sim.spawnPoliceFoot(PH.clamp(p.x + Math.cos(b) * 45, -140, 140), PH.clamp(p.z + Math.sin(b) * 45, -140, 140));
    }
    if (st.wanted >= 3 && !sim.heli) sim.spawnHeli();
    if (st.wanted < 3 && sim.heli) {
      sim.heli.g.visible = false; sim.heli.dead = true; sim.heli = null;
    }
    // Remove far, dead or idle patrol when wanted is 0 (keep 2 patrol cars).
    sim.police = sim.police.filter(function (cop) {
      if (cop.dead && cop.kind !== 'heli') { return false; }
      return true;
    });

    sim.police.forEach(function (cop) {
      if (cop.dead) return;
      var d = PH.dist2d(p.x, p.z, cop.x, cop.z);
      if (cop.kind === 'foot') {
        if (st.wanted >= 1) {
          var target = Math.atan2(p.x - cop.x, p.z - cop.z);
          cop.heading = PH.angleLerp(cop.heading, target, 1 - Math.pow(0.01, dt));
          cop.speed = 5.2;
          cop.x += Math.sin(cop.heading) * cop.speed * dt;
          cop.z += Math.cos(cop.heading) * cop.speed * dt;
          if (d < 1.6) { // busted
            st.health -= 30 * dt;
            PH.pushFeed('Officer grabbing Mateo!');
            if (st.health <= 0) PH.onBusted && PH.onBusted();
          }
        } else {
          cop.speed = 1.2; // patrol stroll
          cop.heading += Math.sin(sim.elapsed * 0.3 + cop.x) * 0.2 * dt;
          cop.x += Math.sin(cop.heading) * cop.speed * dt;
          cop.z += Math.cos(cop.heading) * cop.speed * dt;
        }
        W.posePed(cop.g, dt, cop.speed / 6);
        cop.g.position.set(cop.x, 0, cop.z);
        cop.g.rotation.y = cop.heading;
      } else if (cop.kind === 'car') {
        // Light bar flash.
        cop.g.userData.lightPhase = (cop.g.userData.lightPhase || 0) + dt * 10;
        var on = Math.sin(cop.g.userData.lightPhase) > 0;
        if (cop.g.userData.lightRed) cop.g.userData.lightRed.material.emissiveIntensity = on ? 2.5 : 0.2;
        if (cop.g.userData.lightBlue) cop.g.userData.lightBlue.material.emissiveIntensity = on ? 0.2 : 2.5;
        if (st.wanted >= 2) {
          var target2 = Math.atan2(p.x - cop.x, p.z - cop.z);
          cop.heading = PH.angleLerp(cop.heading, target2, 1 - Math.pow(0.005, dt));
          cop.speed = PH.lerp(cop.speed, d > 12 ? 24 : 12, dt);
          cop.x = PH.clamp(cop.x + Math.sin(cop.heading) * cop.speed * dt, -145, 205);
          cop.z = PH.clamp(cop.z + Math.cos(cop.heading) * cop.speed * dt, -145, 145);
          if (d < 3 && st.inCar) {
            st.carHealth -= 12 * dt;
            PH.pushFeed('Police ramming the car!');
            if (st.carHealth <= 0) PH.onBusted && PH.onBusted();
          }
          // Roadblock: a parked police car appears ahead of the player.
          sim.roadblockTimer = (sim.roadblockTimer || 0) - dt;
          if (d < 22 && sim.roadblockTimer <= 0) {
            sim.roadblockTimer = 12;
            var aheadX = p.x + Math.sin(p.heading) * 26;
            var aheadZ = p.z + Math.cos(p.heading) * 26;
            var rb = sim.spawnPoliceCar(PH.clamp(aheadX, -140, 140), PH.clamp(aheadZ, -140, 140));
            rb.heading = p.heading + Math.PI / 2;
            rb.g.rotation.y = rb.heading;
            rb.speed = 0;
            PH.pushFeed('Roadblock ahead — find another street');
          }
        } else {
          // Patrol cruise along a street.
          cop.speed = 8;
          cop.x += Math.sin(cop.heading) * cop.speed * dt;
          cop.z += Math.cos(cop.heading) * cop.speed * dt;
          if (cop.x > 135 || cop.x < -135 || cop.z > 135 || cop.z < -135) cop.heading += Math.PI / 2;
        }
        cop.g.position.set(cop.x, 0, cop.z);
        cop.g.rotation.y = cop.heading;
        (cop.g.userData.wheels || []).forEach(function (w) { w.rotation.z += cop.speed * dt * 2; });
      } else if (cop.kind === 'heli') {
        cop.lockT += dt;
        var hx = p.x + 18, hz = p.z - 18;
        cop.x = PH.lerp(cop.x, hx, dt * 0.5);
        cop.z = PH.lerp(cop.z, hz, dt * 0.5);
        cop.g.position.set(cop.x, 32 + Math.sin(sim.elapsed * 1.4) * 2, cop.z);
        cop.g.rotation.y = Math.atan2(p.x - cop.x, p.z - cop.z);
        if (cop.g.userData.rotor) cop.g.userData.rotor.rotation.y += dt * 30;
        if (cop.lockT > 4 && st.wanted >= 3) {
          st.health -= 4 * dt;
          PH.pushFeed('Helicopter firing!');
          if (st.health <= 0) PH.onBusted && PH.onBusted();
        }
      }
    });
  };

  // ------------------------------------------------------------ missions
  sim.updateMissions = function (dt) {
    var st = PH.state;
    var m = PH.currentMission();
    if (!m) { sim.hideBeacon(); return; }
    var p = sim.player;
    var dBeacon = PH.dist2d(p.x, p.z, sim.beaconPos.x, sim.beaconPos.z);
    st.missionTimer += dt;

    // Mission 2 heat: fires only after 60 m driven or 12 s since entering the car.
    if (st.missionIndex === 1 && !st.heatArmed && st.inCar) {
      if (sim.mission2Start === null) sim.mission2Start = { t: st.missionTimer };
      var since = st.missionTimer - sim.mission2Start.t;
      if (st.drivingDistance >= 60 || since >= 12) {
        st.heatArmed = true;
        PH.setWanted(2);
        sim.summonPoliceRing(3);
        PH.sayKira('Heat is on, Mateo — two stars. Get to the pier and do not stop.', 6);
        PH.pushFeed('WANTED 2 — pier run heat');
      }
    }

    switch (st.missionIndex) {
      case 0: // steal the Arrow: reach it and press E
        if (st.inCar && sim.playerCarData && sim.playerCarData.isArrow) PH.completeMission();
        break;
      case 1: // reach the pier safehouse
        if (dBeacon < 6) {
          if (st.wanted > 0) { PH.sayKira('Lose the tail first — the safehouse is hot while they see you.', 5); }
          else PH.completeMission();
        }
        break;
      case 2: // deliver package
        if (dBeacon < 6) PH.completeMission();
        break;
      case 3:
        if (st.missionStage === 0) {
          if (dBeacon < 5) {
            st.missionStage = 1;
            PH.sayKira('Bag secured. Now bring it back to the pier.', 5);
            sim.setBeacon(252, 0);
          }
        } else if (dBeacon < 6) PH.completeMission();
        break;
      case 4: // tail the courier
        if (sim.courier) {
          var dc = PH.dist2d(p.x, p.z, sim.courier.x, sim.courier.z);
          if (dc < 8) {
            sim.courierNearTimer += dt;
            st.missionProgress = sim.courierNearTimer / 3;
            if (sim.courierNearTimer >= 3) {
              sim.courier.g.visible = false;
              sim.courier = null;
              PH.completeMission();
            }
          } else sim.courierNearTimer = Math.max(0, sim.courierNearTimer - dt);
        }
        break;
      case 5: // observe for 10 s inside the beacon
        if (dBeacon < 5) {
          sim.mission6Timer += dt;
          st.missionProgress = sim.mission6Timer / 10;
          if (sim.mission6Timer >= 10) PH.completeMission();
        } else sim.mission6Timer = Math.max(0, sim.mission6Timer - dt * 2);
        break;
      case 6: // three checkpoints
        if (dBeacon < 6) {
          sim.checkpointIndex++;
          if (sim.checkpointIndex >= sim.checkpoints.length) PH.completeMission();
          else {
            var cp = sim.checkpoints[sim.checkpointIndex];
            sim.setBeacon(cp.x, cp.z);
            PH.sayKira('Checkpoint ' + (sim.checkpointIndex + 1) + ' of 3 — keep moving.', 4);
          }
        }
        break;
      case 7: // reach marina, then lose a 3-star tail
        if (st.missionStage === 0) {
          if (dBeacon < 6) {
            st.missionStage = 1;
            PH.setWanted(3);
            sim.summonPoliceRing(3);
            PH.sayKira('Three stars, Mateo. Now vanish — stay out of sight for 22 seconds.', 6);
            sim.setBeacon(0, 0); // beacon moves to a quiet hideout
          }
        } else {
          if (st.wanted === 0) PH.completeMission();
        }
        break;
    }
  };

  window.PH = PH;
})();
