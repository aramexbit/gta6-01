// PIER HEAT — sim.js
// The living city: walking and driving, traffic and pedestrians, the police
// response by wanted level, the eight chained missions, and the HUD with its
// minimap. Rendering lives in world.js; input and sound live in main.js.
(function () {
  'use strict';
  var PH = window.PH, G = PH.G, U = PH.utils, THREE = window.THREE;
  var W = PH.world, B = PH.builders;

  var S = {
    mateo: null,            // { group, parts }
    playerCar: null,        // car object the player drives (or null)
    missionCar: null,       // the orange SCARLET ARROW
    traffic: [],            // { mesh, wheels, x, z, heading, speed, axis, dir, lane, color }
    peds: [],               // { group, parts, x, z, heading, speed, fleeing, down, color }
    cops: [],               // { kind:'foot'|'car'|'heli', x, z, heading, speed, mesh, wheels, lightBar, state, lockT, heli }
    courier: null,          // mission 5 target car
    heli: null,             // active helicopter (or null)
    mission: null,          // current mission runtime object
    missionStage: 0,
    stageTimer: 0,
    tailTime: 0,            // mission 5: seconds spent close to the courier
    stakeTime: 0,           // mission 6: seconds inside the stakeout beacon
    checkpoints: [],        // mission 7 checkpoint list
    escapeTimer: 0,         // mission 8 survival timer
    m2: { armed: false, startX: 0, startZ: 0, driven: 0, elapsed: 0, fired: false },
    busted: false,
    bustTimer: 0,
    muzzle: [],             // tracer meshes, short-lived
    smokePuffs: [],
    empUntil: 0,
    smokeUntil: 0,
  };

  // --- missions ---------------------------------------------------------------
  // Eight chained jobs. Each has a Kira briefing, an objective line, a
  // target point, a radius and a cash reward. Some missions have stages.
  var MISSIONS = [
    { title: 'MISSION 1 — THE ARROW', objective: 'Steal the SCARLET ARROW parked on Ocean Drive.', sub: 'Walk up to the orange car and press E. No witnesses, no heat.', target: { x: 44, z: 44 }, radius: 6, reward: 500,
      brief: 'Mateo, it\'s Kira. The Arrow is parked on Ocean Drive, engine warm, owner inside buying coffee. Take it. Quietly.' },
    { title: 'MISSION 2 — PIER SAFEHOUSE', objective: 'Drive the Arrow to the safehouse at the end of the pier.', sub: 'The heat comes on once you\'re rolling — stay ahead of it.', target: { x: 214, z: 0 }, radius: 8, reward: 800,
      brief: 'Nice. Now the bad news: the owner called it in. Get to the pier safehouse before the PD boxes you in.' },
    { title: 'MISSION 3 — PACKAGE RUN', objective: 'Deliver the package to the drop house in Little Havana.', sub: 'Cross the whole city. Fast is fine — reckless is expensive.', target: { x: -110, z: -88 }, radius: 7, reward: 1000,
      brief: 'A friend left a package in the trunk. Little Havana, corner house, blue door. Don\'t open it. Don\'t ask.' },
    { title: 'MISSION 4 — KIRA\'S DROP', objective: 'Pick up Kira\'s drop in Downtown, then bring it back to the pier.', sub: 'Two stops. The drop first, then home.', target: { x: 22, z: -66 }, radius: 7, reward: 1200, stage2: { x: 196, z: 0 }, stage2text: 'Drop secured. Bring it back to the pier.',
      brief: 'Downtown, rooftop garage, black case under the bench. Grab it and bring it to the pier. I\'ll be listening.' },
    { title: 'MISSION 5 — TAIL THE COURIER', objective: 'Tail the courier van — stay within 12 m for 5 seconds. Don\'t spook him.', sub: 'Close is good. Bumping him is not.', target: null, radius: 12, reward: 1500,
      brief: 'A courier is moving something I want to see. Follow him, don\'t touch him. Five seconds close is all I need.' },
    { title: 'MISSION 6 — STAKEOUT', objective: 'Watch the corner from the beacon for 8 seconds. Stay in the zone.', sub: 'Eyes open. If the PD rolls by, stay calm.', target: { x: -22, z: 66 }, radius: 9, reward: 900,
      brief: 'Park on the corner and watch the blue door. Eight seconds of eyes on it and we know the schedule.' },
    { title: 'MISSION 7 — CHECKPOINT DASH', objective: 'Burn through all three checkpoints, in order.', sub: 'The clock is already running.', target: { x: 88, z: -88 }, radius: 8, reward: 1800,
      brief: 'Three checkpoints, one straight line through the city. Show me what the Arrow can do.' },
    { title: 'MISSION 8 — MARINA FINALE', objective: 'Get to the marina, then lose the three-star heat and reach the escape point.', sub: 'Everything you have. Everything you\'ve learned.', target: { x: 196, z: -22 }, radius: 8, reward: 3000,
      brief: 'Last job, Mateo. Marina first — then the whole city is coming for you. Make it to the north gate and you\'re a legend.' },
  ];
  var CHECKPOINTS = [{ x: 88, z: -88 }, { x: -88, z: -44 }, { x: -88, z: 88 }];

  // --- helpers ------------------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function toast(text, ms) {
    var t = el('toast');
    t.textContent = text; t.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.style.display = 'none'; }, ms || 2600);
  }
  function dialog(text, ms) {
    var d = el('dialog');
    el('dialog-text').textContent = text;
    d.classList.remove('hidden');
    clearTimeout(dialog._t);
    dialog._t = setTimeout(function () { d.classList.add('hidden'); }, ms || 7000);
  }
  PH.toast = toast;
  PH.dialog = dialog;

  function collideCircle(x, z, r) {
    // Push a circle out of building AABBs. Returns corrected {x,z}.
    for (var i = 0; i < W.colliders.length; i++) {
      var c = W.colliders[i];
      var nx = U.clamp(x, c.x - c.hw, c.x + c.hw);
      var nz = U.clamp(z, c.z - c.hd, c.z + c.hd);
      var dx = x - nx, dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 0.0001) { x = c.x + c.hw + r; continue; }
        var d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      }
    }
    return { x: x, z: z };
  }

  function inBounds(x, z) {
    return { x: U.clamp(x, -158, 246), z: U.clamp(z, -158, 158) };
  }

  // --- spawning -----------------------------------------------------------------
  function spawnMissionCar() {
    var built = B.makeCar({ color: 0xd8542e });
    built.group.position.set(44, 0, 44);
    built.group.rotation.y = Math.PI / 2;
    W.scene.add(built.group);
    S.missionCar = {
      mesh: built.group, wheels: built.wheels, lightBar: null,
      x: 44, z: 44, heading: Math.PI / 2, speed: 0, hp: 100,
      name: 'SCARLET ARROW', color: 0xd8542e, mission: true, traffic: false,
    };
    return S.missionCar;
  }

  function spawnTrafficCar() {
    var axis = Math.random() < 0.5 ? 'x' : 'z';
    var road = U.roadCoord(U.randInt(0, 6));
    var dir = Math.random() < 0.5 ? 1 : -1;
    var lane = (Math.random() < 0.5 ? 2.2 : -2.2);
    var built = B.makeCar({});
    var x, z, heading;
    if (axis === 'x') { x = U.rand(-140, 140); z = road + lane; heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { x = road + lane; z = U.rand(-140, 140); heading = dir > 0 ? 0 : Math.PI; }
    built.group.position.set(x, 0, z);
    built.group.rotation.y = heading;
    W.scene.add(built.group);
    var car = {
      mesh: built.group, wheels: built.wheels, lightBar: null,
      x: x, z: z, heading: heading, speed: U.rand(6, 11),
      axis: axis, dir: dir, lane: lane, road: road,
      hp: 100, name: 'Traffic', color: built.color, mission: false, traffic: true,
    };
    S.traffic.push(car);
    return car;
  }

  function spawnPed() {
    var built = B.makeMateo();
    // Recolour the figure: random shirt/jacket/jeans via material clones.
    var jacket = new THREE.MeshLambertMaterial({ color: U.pick([0x2a9d8f, 0xe63946, 0x4361ee, 0xf4d35e, 0x9b5de5, 0x06d6a0, 0xef476f]) });
    var jeans = new THREE.MeshLambertMaterial({ color: U.pick([0x2b3a55, 0x4a4a55, 0x6b4a2f, 0x3a3a3a]) });
    // Swap materials by mesh position: torso/arms get jacket, legs get jeans.
    built.parts.torso.children.forEach(function (m) { if (m.material && m.material.color) m.material = jacket; });
    [built.parts.armL, built.parts.armR].forEach(function (a) {
      a.children.forEach(function (m) { if (m.isMesh) m.material = jacket; });
      a.children.forEach(function (e) { if (e.isGroup) e.children.forEach(function (m) { if (m.isMesh && m.position.y > -0.4) m.material = jacket; }); });
    });
    [built.parts.legL, built.parts.legR].forEach(function (l) {
      l.children.forEach(function (m) { if (m.isMesh) m.material = jeans; });
    });
    var road = U.roadCoord(U.randInt(0, 6));
    var x = U.rand(-140, 140), z = road + (Math.random() < 0.5 ? 6.4 : -6.4);
    built.group.position.set(x, 0, z);
    W.scene.add(built.group);
    var ped = {
      group: built.group, parts: built.parts,
      x: x, z: z, heading: U.rand(0, Math.PI * 2), speed: U.rand(1.2, 2.2),
      walkPhase: U.rand(0, 6), fleeing: false, down: false, axis: 'x',
    };
    S.peds.push(ped);
    return ped;
  }

  function spawnFootCop(x, z) {
    var built = B.makeMateo();
    var navy = new THREE.MeshLambertMaterial({ color: 0x1c2f5a });
    built.parts.torso.children.forEach(function (m) { if (m.isMesh) m.material = navy; });
    [built.parts.armL, built.parts.armR].forEach(function (a) {
      a.children.forEach(function (m) { if (m.isMesh) m.material = navy; });
    });
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.12, 12), navy);
    cap.position.y = 0.22;
    built.parts.head.add(cap);
    built.group.position.set(x, 0, z);
    W.scene.add(built.group);
    var cop = {
      kind: 'foot', x: x, z: z, heading: 0, speed: 0,
      mesh: built.group, parts: built.parts, state: 'pursuit',
      walkPhase: U.rand(0, 6), name: 'Unit ' + U.randInt(10, 99),
    };
    S.cops.push(cop);
    return cop;
  }

  function spawnPoliceCar(x, z) {
    var built = B.makeCar({ police: true });
    built.group.position.set(x, 0, z);
    W.scene.add(built.group);
    var cop = {
      kind: 'car', x: x, z: z, heading: 0, speed: 0,
      mesh: built.group, wheels: built.wheels, lightBar: built.lightBar,
      state: 'pursuit', name: 'Cruiser ' + U.randInt(10, 99), hp: 100,
    };
    S.cops.push(cop);
    return cop;
  }

  function spawnHeli() {
    if (S.heli) return S.heli;
    var built = B.makeHeli();
    built.group.position.set(G.player.x + 30, 55, G.player.z - 30);
    W.scene.add(built.group);
    var cop = {
      kind: 'heli', x: built.group.position.x, z: built.group.position.z,
      heading: 0, speed: 0, mesh: built.group, heli: built,
      state: 'pursuit', lockT: 0, name: 'Air-1', shootT: 0,
    };
    S.cops.push(cop);
    S.heli = cop;
    return cop;
  }

  function removeCop(cop) {
    W.scene.remove(cop.mesh);
    var i = S.cops.indexOf(cop);
    if (i >= 0) S.cops.splice(i, 1);
    if (S.heli === cop) S.heli = null;
  }

  // --- police response ------------------------------------------------------------
  function desiredPolice() {
    var w = G.wanted;
    return {
      foot: w >= 1 ? Math.min(1 + w, 4) : 2, // two patrol cops even at 0 stars
      cars: w >= 2 ? Math.min(w - 1, 4) : 0,
      heli: w >= 3 ? 1 : 0,
    };
  }

  function maintainPolice(dt) {
    if (PH.test && PH.test.suppressPolice) return; // probe hook: hold the cavalry
    var want = desiredPolice();
    var foot = 0, cars = 0, heli = 0;
    S.cops.forEach(function (c) {
      if (c.kind === 'foot') foot++;
      else if (c.kind === 'car') cars++;
      else heli++;
    });
    if (foot < want.foot) {
      // Spawn beyond the 40 m decay radius, so a player who flees can
      // actually cool off; the chase still closes in from there.
      var a = U.rand(0, Math.PI * 2), r = U.rand(45, 60);
      spawnFootCop(G.player.x + Math.cos(a) * r, G.player.z + Math.sin(a) * r);
    }
    if (cars < want.cars) {
      var a2 = U.rand(0, Math.PI * 2), r2 = U.rand(45, 60);
      var px = G.player.x + Math.cos(a2) * r2, pz = G.player.z + Math.sin(a2) * r2;
      px = U.nearestRoad(px); pz = U.nearestRoad(pz);
      spawnPoliceCar(px, pz);
    }
    if (heli < want.heli) spawnHeli();
    if (heli > want.heli && S.heli) removeCop(S.heli);
    // Trim extras when wanted falls.
    for (var i = S.cops.length - 1; i >= 0; i--) {
      var c = S.cops[i];
      if (c.kind === 'foot' && foot > want.foot) { removeCop(c); foot--; }
      else if (c.kind === 'car' && cars > want.cars) { removeCop(c); cars--; }
    }
  }

  // --- missions ---------------------------------------------------------------------
  function startMission(idx) {
    var m = MISSIONS[idx];
    if (!m) { finishStory(); return; }
    S.mission = m;
    S.missionStage = 0;
    S.stageTimer = 0;
    S.tailTime = 0;
    S.stakeTime = 0;
    S.escapeTimer = 0;
    S.m2 = { armed: false, startX: G.player.x, startZ: G.player.z, driven: 0, elapsed: 0, fired: false };
    if (idx === 4) spawnCourier();
    if (idx === 6) { S.checkpoints = CHECKPOINTS.map(function (c) { return { x: c.x, z: c.z, done: false }; }); }
    el('mission-title').textContent = m.title;
    el('mission-objective').textContent = m.objective;
    el('mission-sub').textContent = m.sub || '';
    dialog(m.brief, 8000);
    updateBeacon();
    PH.save.saveGame();
  }

  function spawnCourier() {
    if (S.courier) return;
    var built = B.makeCar({ color: 0xf4d35e });
    built.group.position.set(-88, 0, 44);
    W.scene.add(built.group);
    S.courier = {
      mesh: built.group, wheels: built.wheels, x: -88, z: 44,
      heading: Math.PI / 2, speed: 9, axis: 'x', dir: 1, road: 44, lane: 2.2,
      hp: 100, name: 'Courier', traffic: true, courier: true,
    };
  }

  function updateBeacon() {
    var t = currentTarget();
    if (!t) { W.beacon.group.visible = false; return; }
    W.beacon.group.visible = true;
    W.beacon.group.position.set(t.x, 0, t.z);
  }

  function currentTarget() {
    if (!S.mission) return null;
    var idx = G.missionIndex;
    if (idx === 3 && S.missionStage === 1) return S.mission.stage2;
    if (idx === 4 && S.courier) return { x: S.courier.x, z: S.courier.z };
    if (idx === 6) {
      var next = S.checkpoints.find(function (c) { return !c.done; });
      return next ? { x: next.x, z: next.z } : null;
    }
    if (idx === 7 && S.missionStage === 1) return { x: -132, z: 132 };
    return S.mission.target;
  }

  function missionRadius() {
    if (G.missionIndex === 4) return 12;
    return S.mission ? S.mission.radius : 8;
  }

  function completeMission() {
    var m = S.mission;
    G.money += m.reward;
    G.stats.missionsPaid++;
    G.missionDone++;
    toast('JOB DONE  •  +' + U.fmtMoney(m.reward), 3000);
    dialog('Kira: Clean work, Mateo. ' + U.fmtMoney(m.reward) + ' is yours. Next job\'s already on the board.', 6000);
    if (window.PH && window.PH.sfx) window.PH.sfx('cash');
    G.missionIndex++;
    PH.save.saveGame();
    if (G.missionIndex >= MISSIONS.length) { finishStory(); return; }
    startMission(G.missionIndex);
  }

  function finishStory() {
    S.mission = null;
    el('mission-title').textContent = 'SUNSET BAY — COMPLETE';
    el('mission-objective').textContent = 'All eight jobs done. The city is yours, Mateo.';
    el('mission-sub').textContent = 'Free roam: keep driving, keep the heat off, keep the money.';
    W.beacon.group.visible = false;
    dialog('Kira: That\'s all eight, Mateo. Sunset Bay is yours now. Don\'t spend it all in one place.', 9000);
    toast('★ PIER HEAT COMPLETE ★', 5000);
    PH.save.saveGame();
  }

  function updateMissions(dt) {
    if (!S.mission) return;
    var idx = G.missionIndex;
    var px = G.player.x, pz = G.player.z;
    // Mission 2 heat: only after driving 60 m from the pickup, or 12 s.
    if (idx === 1 && !S.m2.fired) {
      if (!G.player.onFoot && S.playerCar) {
        S.m2.driven += Math.abs(S.playerCar.speed) * dt;
      }
      S.m2.elapsed += dt;
      if (S.m2.driven >= 60 || S.m2.elapsed >= 12) {
        S.m2.fired = true;
        PH.crime.setWanted(2, 'mission-2-heat');
        // Police called from 28-42 m away, never beside the car.
        for (var k = 0; k < 2; k++) {
          var a = U.rand(0, Math.PI * 2), r = U.rand(28, 42);
          spawnPoliceCar(U.nearestRoad(px + Math.cos(a) * r), U.nearestRoad(pz + Math.sin(a) * r));
        }
        dialog('Kira: There it is — the PD just lit you up. Two stars. Run for the pier, don\'t stop!', 7000);
        toast('★ WANTED — 2 STARS ★', 3000);
      }
    }
    // Mission 5: tail the courier.
    if (idx === 4 && S.courier) {
      var d = U.dist2(px, pz, S.courier.x, S.courier.z);
      if (d <= 12) {
        S.tailTime += dt;
        el('mission-sub').textContent = 'On his tail: ' + S.tailTime.toFixed(1) + 's / 5s — stay close, don\'t touch.';
      } else {
        el('mission-sub').textContent = 'Get within 12 m of the courier van.';
      }
      if (S.tailTime >= 5) { completeMission(); return; }
    }
    // Mission 6: stakeout.
    if (idx === 5) {
      var t = S.mission.target;
      var dd = U.dist2(px, pz, t.x, t.z);
      if (dd <= S.mission.radius) {
        S.stakeTime += dt;
        el('mission-sub').textContent = 'Watching… ' + S.stakeTime.toFixed(1) + 's / 8s — stay in the zone.';
      } else {
        S.stakeTime = Math.max(0, S.stakeTime - dt * 0.5);
        el('mission-sub').textContent = 'Stand inside the gold beacon zone.';
      }
      if (S.stakeTime >= 8) { completeMission(); return; }
    }
    // Mission 8 stage 2: survive the heat, then reach the escape point.
    if (idx === 7 && S.missionStage === 1) {
      S.escapeTimer += dt;
      el('mission-sub').textContent = 'Heat is on — reach the north gate! (' + Math.ceil(25 - S.escapeTimer) + 's of chaos left)';
      var et = currentTarget();
      if (et && U.dist2(px, pz, et.x, et.z) <= 10 && S.escapeTimer >= 10) { completeMission(); return; }
      if (S.escapeTimer >= 25) { completeMission(); return; }
    }
    // Generic arrival check (skip missions with their own win condition).
    if (idx === 4 || idx === 5 || (idx === 7 && S.missionStage === 1)) { updateBeacon(); return; }
    var target = currentTarget();
    if (!target) { updateBeacon(); return; }
    var dist = U.dist2(px, pz, target.x, target.z);
    if (idx === 6) {
      var next = S.checkpoints.find(function (c) { return !c.done; });
      if (next && U.dist2(px, pz, next.x, next.z) <= 8) {
        next.done = true;
        if (window.PH && window.PH.sfx) window.PH.sfx('checkpoint');
        var left = S.checkpoints.filter(function (c) { return !c.done; }).length;
        toast(left > 0 ? 'CHECKPOINT! ' + left + ' to go' : 'LAST CHECKPOINT!', 2200);
        if (left === 0) { completeMission(); return; }
      }
      updateBeacon();
      return;
    }
    if (idx === 0) {
      // Mission 1 completes by entering the Arrow (handled in enterCar).
      updateBeacon();
      return;
    }
    if (dist <= missionRadius()) {
      if (idx === 3 && S.missionStage === 0) {
        S.missionStage = 1;
        el('mission-objective').textContent = S.mission.stage2text;
        el('mission-sub').textContent = 'Back to the pier, Mateo.';
        dialog('Kira: Got it. Now bring the case home to the pier.', 6000);
        updateBeacon();
        return;
      }
      if (idx === 7 && S.missionStage === 0) {
        S.missionStage = 1;
        S.escapeTimer = 0;
        PH.crime.setWanted(3, 'mission-8-finale');
        el('mission-objective').textContent = 'Lose the heat — reach the north gate escape point!';
        dialog('Kira: The whole PD is coming. Three stars! Get to the north gate and disappear!', 7000);
        toast('★ WANTED — 3 STARS ★', 3000);
        updateBeacon();
        return;
      }
      completeMission();
      return;
    }
    updateBeacon();
  }

  // --- entering / exiting cars ------------------------------------------------
  function nearestCar(maxD) {
    var best = null, bestD = maxD;
    var cars = [S.missionCar].concat(S.traffic);
    if (S.courier) cars.push(S.courier);
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (!c || c === S.playerCar) continue;
      var d = U.dist2(G.player.x, G.player.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function enterCar(car) {
    if (!car) return false;
    // Stealing a traffic car is a crime — but only with a witness.
    if (car.traffic && !car.courier) {
      var rose = PH.crime.commitCrime(1, S.cops, S.peds, 'car theft');
      G.stats.carsStolen++;
      if (rose) toast('STOLEN — WITNESSED! ★', 2500);
      else toast('Car taken — nobody saw a thing.', 2200);
      // Remove it from traffic so it stops following its loop.
      var ti = S.traffic.indexOf(car);
      if (ti >= 0) S.traffic.splice(ti, 1);
    }
    if (car.mission) {
      toast('SCARLET ARROW — yours now.', 2500);
      if (G.missionIndex === 0) {
        G.money += 0;
        completeMission(); // mission 1 done by taking the car
      }
    }
    if (car.courier) { toast('That\'s the courier — don\'t touch him!', 2200); return false; }
    S.playerCar = car;
    G.player.onFoot = false;
    G.player.car = car;
    S.mateo.group.visible = false;
    if (window.PH && window.PH.sfx) window.PH.sfx('door');
    return true;
  }

  function exitCar() {
    if (!S.playerCar) return;
    var car = S.playerCar;
    var side = car.heading + Math.PI / 2;
    var x = car.x + Math.cos(side) * 2.2, z = car.z - Math.sin(side) * 2.2;
    var fixed = collideCircle(x, z, 0.6);
    G.player.x = fixed.x; G.player.z = fixed.z;
    G.player.heading = car.heading;
    G.player.onFoot = true;
    G.player.car = null;
    S.playerCar = null;
    S.mateo.group.visible = true;
    S.mateo.group.position.set(G.player.x, 0, G.player.z);
    if (window.PH && window.PH.sfx) window.PH.sfx('door');
  }

  // --- shooting ------------------------------------------------------------------
  function shoot() {
    if (!G.player.onFoot) return false;
    G.stats.shots++;
    if (window.PH && window.PH.sfx) window.PH.sfx('shot');
    // Muzzle flash tracer.
    var from = { x: G.player.x, z: G.player.z };
    var yaw = G.cam.yaw;
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    var endX = from.x + fx * 40, endZ = from.z + fz * 40;
    var geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, 1.3, from.z),
      new THREE.Vector3(endX, 1.3, endZ),
    ]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    W.scene.add(line);
    S.muzzle.push({ mesh: line, t: 0.08 });
    // Hit test: nearest ped / cop / traffic car inside a narrow cone.
    var best = null, bestD = 42;
    function consider(x, z, obj, kind) {
      var dx = x - from.x, dz = z - from.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > 42 || d < 0.5) return;
      var ang = Math.abs(U.angDiff(Math.atan2(dx, dz), yaw));
      if (ang < 0.22 && d < bestD) { bestD = d; best = { obj: obj, kind: kind }; }
    }
    S.peds.forEach(function (p) { if (!p.down) consider(p.x, p.z, p, 'ped'); });
    S.cops.forEach(function (c) { if (c.kind !== 'heli') consider(c.x, c.z, c, 'cop'); });
    S.traffic.forEach(function (c) { consider(c.x, c.z, c, 'car'); });
    if (best) {
      if (best.kind === 'ped') {
        best.obj.down = true;
        best.obj.group.rotation.x = -Math.PI / 2;
        best.obj.group.position.y = 0.3;
        PH.crime.commitCrime(1, S.cops, S.peds, 'shooting');
        toast('Pedestrian down!', 1800);
      } else if (best.kind === 'cop') {
        if (best.obj.kind === 'foot') {
          best.obj.state = 'down';
          best.obj.mesh.rotation.x = -Math.PI / 2;
          best.obj.mesh.position.y = 0.3;
          setTimeout(function () { removeCop(best.obj); }, 4000);
        } else {
          best.obj.hp -= 50;
          if (best.obj.hp <= 0) removeCop(best.obj);
        }
        PH.crime.commitCrime(1, S.cops, S.peds, 'shooting a cop');
        toast('Officer down!', 1800);
      } else {
        best.obj.hp -= 34;
        best.obj.speed *= 0.4;
        PH.crime.commitCrime(1, S.cops, S.peds, 'shooting a car');
      }
    } else {
      // A shot in the open is still a crime — if anyone sees it.
      PH.crime.commitCrime(1, S.cops, S.peds, 'firing a gun');
    }
    // Nearby peds flee from the shot.
    S.peds.forEach(function (p) {
      if (!p.down && U.dist2(p.x, p.z, from.x, from.z) < 28) p.fleeing = true;
    });
    return true;
  }

  // --- items ------------------------------------------------------------------------
  function useEmp() {
    if (G.emp <= 0) { toast('No EMP left.', 1500); return; }
    G.emp--;
    S.empUntil = G.time + 6;
    S.cops.forEach(function (c) { if (c.kind === 'car') c.speed = 0; });
    toast('EMP BURST — police cars stalled!', 2500);
    if (window.PH && window.PH.sfx) window.PH.sfx('emp');
  }
  function useSmoke() {
    if (G.smoke <= 0) { toast('No smoke left.', 1500); return; }
    G.smoke--;
    S.smokeUntil = G.time + 5;
    // Smoke breaks line of sight: cops lose the trail, wanted drops one.
    if (G.wanted > 0) { G.wanted--; G.wantedTimer = 0; }
    toast('SMOKE — you vanished from the chase!', 2500);
    if (window.PH && window.PH.sfx) window.PH.sfx('smoke');
  }

  // --- per-frame updates -------------------------------------------------------------
  function animateMateo(dt, moving, sprint) {
    var p = S.mateo.parts;
    var phase = G.time * (sprint ? 13 : 9);
    var amp = moving ? (sprint ? 0.75 : 0.55) : 0;
    var swing = Math.sin(phase) * amp;
    if (G.player.aiming) {
      p.armR.rotation.x = -Math.PI / 2 + 0.15;
      p.armL.rotation.x = -Math.PI / 2 + 0.25;
      p.armL.rotation.z = 0.5;
      p.foreR.rotation.x = 0; p.foreL.rotation.x = -0.3;
      p.legL.rotation.x = 0.15; p.legR.rotation.x = -0.15;
      p.pistol.visible = true;
    } else {
      p.armR.rotation.x = swing;
      p.armL.rotation.x = -swing;
      p.armR.rotation.z = 0; p.armL.rotation.z = 0;
      p.foreR.rotation.x = moving ? -0.5 : -0.1;
      p.foreL.rotation.x = moving ? -0.5 : -0.1;
      p.legL.rotation.x = -swing;
      p.legR.rotation.x = swing;
      p.pistol.visible = false;
    }
    p.torso.rotation.x = moving ? 0.08 : 0;
    p.torso.position.y = 0.95 + (moving ? Math.abs(Math.sin(phase)) * 0.05 : 0);
  }

  function updatePlayer(dt, input) {
    var p = G.player;
    if (S.busted) {
      S.bustTimer -= dt;
      if (S.bustTimer <= 0) { S.busted = false; G.health = 100; }
      return;
    }
    if (!p.onFoot) return;
    var fwd = (input.w ? 1 : 0) - (input.s ? 1 : 0);
    var strafe = (input.d ? 1 : 0) - (input.a ? 1 : 0);
    var moving = fwd !== 0 || strafe !== 0;
    var sprint = !!input.shift;
    var speed = sprint ? 10.5 : (p.aiming ? 3.2 : 6.2);
    var yaw = G.cam.yaw;
    var mx = 0, mz = 0;
    if (moving) {
      var len = Math.sqrt(fwd * fwd + strafe * strafe);
      mx = (Math.sin(yaw) * fwd + Math.cos(yaw) * strafe) / len;
      mz = (Math.cos(yaw) * fwd - Math.sin(yaw) * strafe) / len;
      var nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
      var fixed = collideCircle(nx, nz, 0.6);
      var b = inBounds(fixed.x, fixed.z);
      p.x = b.x; p.z = b.z;
      var targetHeading = Math.atan2(mx, mz);
      p.heading += U.angDiff(targetHeading, p.heading) * Math.min(1, dt * 12);
    }
    p.walking = moving && !sprint;
    p.running = moving && sprint;
    p.speed = moving ? speed : 0;
    S.mateo.group.position.set(p.x, 0, p.z);
    S.mateo.group.rotation.y = p.heading;
    animateMateo(dt, moving, sprint);
    // Car collision while on foot: a fast car hitting Mateo hurts.
    S.traffic.concat(S.cops.filter(function (c) { return c.kind === 'car'; }).map(function (c) { return { x: c.x, z: c.z, speed: c.speed }; })).forEach(function (c) {
      if (c.speed > 4 && U.dist2(p.x, p.z, c.x, c.z) < 1.8) {
        damagePlayer(12, 'hit by a car');
        p.x += (p.x - c.x) * 0.6; p.z += (p.z - c.z) * 0.6;
      }
    });
  }

  function updateDriving(dt, input) {
    var car = S.playerCar;
    if (!car) return;
    var accel = (input.w ? 1 : 0) - (input.s ? 1 : 0);
    var steer = (input.a ? 1 : 0) - (input.d ? 1 : 0);
    var boost = input.shift ? 1.35 : 1;
    var drifting = !!input.space;
    var maxSpeed = 34 * boost;
    var maxReverse = 12;
    if (accel > 0) car.speed += 22 * boost * dt;
    else if (accel < 0) car.speed -= (car.speed > 0.5 ? 30 : 14) * dt;
    else car.speed -= Math.sign(car.speed) * 8 * dt;
    if (Math.abs(car.speed) < 0.15 && accel === 0) car.speed = 0;
    car.speed = U.clamp(car.speed, -maxReverse, maxSpeed);
    var turnRate = steer * (drifting ? 2.4 : 1.5) * U.clamp(Math.abs(car.speed) / 10, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.heading += turnRate * dt * (drifting ? 1.15 : 1);
    var nx = car.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.z + Math.cos(car.heading) * car.speed * dt;
    var fixed = collideCircle(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) {
      car.speed *= 0.45;
      car.hp = Math.max(0, car.hp - 2);
      PH.crime.commitCrime(0, S.cops, S.peds, 'crash'); // crash alone: no witness rule trigger
    }
    var b = inBounds(fixed.x, fixed.z);
    car.x = b.x; car.z = b.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = drifting ? -steer * 0.08 : 0;
    car.wheels.forEach(function (w, i) { w.rotation.x += car.speed * dt * 1.4; });
    // Sync the player to the car.
    G.player.x = car.x; G.player.z = car.z;
    G.player.heading = car.heading;
    G.player.speed = Math.abs(car.speed);
    // Run over pedestrians.
    S.peds.forEach(function (ped) {
      if (ped.down) return;
      if (Math.abs(car.speed) > 3 && U.dist2(car.x, car.z, ped.x, ped.z) < 2.0) {
        ped.down = true;
        ped.group.rotation.x = -Math.PI / 2;
        ped.group.position.y = 0.3;
        G.stats.pedsHit++;
        car.hp = Math.max(0, car.hp - 3);
        PH.crime.commitCrime(1, S.cops, S.peds, 'hit a pedestrian');
      }
    });
    // Ram a police car: a crime, witnessed by definition.
    S.cops.forEach(function (c) {
      if (c.kind === 'car' && Math.abs(car.speed) > 5 && U.dist2(car.x, car.z, c.x, c.z) < 3.2) {
        c.hp -= 25;
        car.hp = Math.max(0, car.hp - 6);
        car.speed *= 0.5;
        PH.crime.commitCrime(1, S.cops, S.peds, 'rammed a police car');
        if (c.hp <= 0) removeCop(c);
      }
    });
    // Bump traffic cars.
    S.traffic.forEach(function (t) {
      if (U.dist2(car.x, car.z, t.x, t.z) < 3.4) {
        var push = 3.4 - U.dist2(car.x, car.z, t.x, t.z);
        t.x += (t.x - car.x) * 0.1 + 0.01;
        t.z += (t.z - car.z) * 0.1 + 0.01;
        car.speed *= 0.85;
        car.hp = Math.max(0, car.hp - 1);
      }
    });
    if (car.hp <= 0) {
      toast('The Arrow is wrecked! Get out and find another ride.', 3500);
      exitCar();
      car.hp = 40; // it smoulders on, drivable again later
    }
  }

  function updateTraffic(dt) {
    S.traffic.forEach(function (c) {
      // Simple avoidance: slow down if a car is close ahead.
      var ahead = 99;
      S.traffic.forEach(function (o) {
        if (o === c) return;
        var dx = o.x - c.x, dz = o.z - c.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 12) {
          var ang = Math.abs(U.angDiff(Math.atan2(dx, dz), c.heading));
          if (ang < 0.5) ahead = Math.min(ahead, d);
        }
      });
      var target = ahead < 9 ? 0 : U.rand(6, 11);
      if (S.empUntil > G.time) target = 0;
      c.speed = U.lerp(c.speed, target, Math.min(1, dt * 2));
      var nx = c.x + Math.sin(c.heading) * c.speed * dt;
      var nz = c.z + Math.cos(c.heading) * c.speed * dt;
      // Loop around the city edge, or turn at a random intersection.
      var out = Math.abs(nx) > 148 || Math.abs(nz) > 148;
      if (out) {
        if (c.axis === 'x') { c.x = -c.dir * 145; c.z = c.road + c.lane; }
        else { c.z = -c.dir * 145; c.x = c.road + c.lane; }
      } else {
        c.x = nx; c.z = nz;
        if (Math.random() < dt * 0.02) {
          // Random turn at an intersection onto the crossing road.
          var nr = U.nearestRoad(c.x), nr2 = U.nearestRoad(c.z);
          if (Math.abs(c.x - nr) < 2 && Math.abs(c.z - nr2) < 2) {
            c.axis = c.axis === 'x' ? 'z' : 'x';
            c.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
            c.road = c.axis === 'x' ? c.z : c.x;
          }
        }
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      c.wheels.forEach(function (w) { w.rotation.x += c.speed * dt * 1.4; });
    });
    // The courier drives his loop.
    if (S.courier) {
      var cu = S.courier;
      cu.x += Math.sin(cu.heading) * cu.speed * dt;
      cu.z += Math.cos(cu.heading) * cu.speed * dt;
      if (Math.abs(cu.x) > 140 || Math.abs(cu.z) > 140) {
        cu.heading += Math.PI / 2;
        cu.x = U.clamp(cu.x, -140, 140);
        cu.z = U.clamp(cu.z, -140, 140);
      }
      cu.mesh.position.set(cu.x, 0, cu.z);
      cu.mesh.rotation.y = cu.heading;
    }
  }

  function updatePeds(dt) {
    S.peds.forEach(function (p) {
      if (p.down) return;
      var speed = p.speed;
      if (p.fleeing) {
        speed = 5.5;
        var dx = p.x - G.player.x, dz = p.z - G.player.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        p.heading = Math.atan2(dx / d, dz / d);
        if (d > 45) p.fleeing = false;
      } else if (Math.random() < dt * 0.08) {
        p.heading += U.pick([-Math.PI / 2, Math.PI / 2, 0, 0]);
      }
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      var b = inBounds(p.x, p.z);
      if (b.x !== p.x || b.z !== p.z) { p.heading += Math.PI; p.x = b.x; p.z = b.z; }
      p.walkPhase += dt * (p.fleeing ? 12 : 8);
      var swing = Math.sin(p.walkPhase) * 0.5;
      p.parts.legL.rotation.x = -swing;
      p.parts.legR.rotation.x = swing;
      p.parts.armL.rotation.x = swing * 0.7;
      p.parts.armR.rotation.x = -swing * 0.7;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.heading;
    });
  }

  function updateCops(dt) {
    var px = G.player.x, pz = G.player.z;
    S.cops.forEach(function (c) {
      if (c.kind === 'foot') {
        if (c.state === 'down') return;
        var d = U.dist2(px, pz, c.x, c.z);
        var target = G.wanted >= 1 ? 4.6 : 1.6;
        var heading = Math.atan2(px - c.x, pz - c.z);
        c.heading += U.angDiff(heading, c.heading) * Math.min(1, dt * 6);
        if (G.wanted >= 1) {
          c.speed = U.lerp(c.speed, target, dt * 2);
          c.x += Math.sin(c.heading) * c.speed * dt;
          c.z += Math.cos(c.heading) * c.speed * dt;
          if (d < 1.6) {
            // Caught! Busted: lose cash, wake up at the pier with no heat.
            bustPlayer();
          }
        } else {
          // Patrol: wander the sidewalk.
          c.speed = U.lerp(c.speed, 1.6, dt);
          if (Math.random() < dt * 0.1) c.heading += U.pick([-1, 1]) * Math.PI / 2;
          c.x += Math.sin(c.heading) * c.speed * dt;
          c.z += Math.cos(c.heading) * c.speed * dt;
        }
        c.walkPhase += dt * 9;
        var swing = Math.sin(c.walkPhase) * 0.5;
        c.parts.legL.rotation.x = -swing;
        c.parts.legR.rotation.x = swing;
        c.parts.armL.rotation.x = swing * 0.7;
        c.parts.armR.rotation.x = -swing * 0.7;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
      } else if (c.kind === 'car') {
        var empStalled = G.time < S.empUntil;
        var d2 = U.dist2(px, pz, c.x, c.z);
        var wantSpeed = empStalled ? 0 : (G.wanted >= 2 ? U.clamp(d2 * 0.55, 10, 30) : 8);
        // Roadblock behaviour at 2+ stars: one cruiser cuts across ahead.
        if (G.wanted >= 2 && d2 < 26 && c.state !== 'block') {
          if (Math.random() < dt * 0.05) c.state = 'block';
        }
        if (c.state === 'block') {
          wantSpeed = 0;
          c.heading += U.angDiff(Math.atan2(px - c.x, pz - c.z) + Math.PI / 2, c.heading) * Math.min(1, dt * 2);
          if (d2 > 40) c.state = 'pursuit';
        } else {
          var heading2 = Math.atan2(px - c.x, pz - c.z);
          c.heading += U.angDiff(heading2, c.heading) * Math.min(1, dt * 2.2);
        }
        c.speed = U.lerp(c.speed, wantSpeed, Math.min(1, dt * 1.5));
        var nx = c.x + Math.sin(c.heading) * c.speed * dt;
        var nz = c.z + Math.cos(c.heading) * c.speed * dt;
        var fixed = collideCircle(nx, nz, 1.6);
        c.x = fixed.x; c.z = fixed.z;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
        c.wheels.forEach(function (w) { w.rotation.x += c.speed * dt * 1.4; });
        if (c.lightBar) {
          var blink = Math.floor(G.time * 6) % 2 === 0;
          c.lightBar.red.material.color.setHex(blink ? 0xff2222 : 0x550000);
          c.lightBar.blue.material.color.setHex(blink ? 0x000055 : 0x2244ff);
        }
        // Ram the player on foot.
        if (d2 < 2.2 && c.speed > 4) damagePlayer(10, 'rammed by a cruiser');
      } else if (c.kind === 'heli') {
        // Circle above the player, lock on, then shoot.
        var ang = G.time * 0.35;
        var hx = px + Math.cos(ang) * 26, hz = pz + Math.sin(ang) * 26;
        c.x = U.lerp(c.x, hx, Math.min(1, dt * 0.8));
        c.z = U.lerp(c.z, hz, Math.min(1, dt * 0.8));
        c.mesh.position.set(c.x, 55 + Math.sin(G.time * 0.7) * 2, c.z);
        c.mesh.rotation.y = Math.atan2(px - c.x, pz - c.z);
        c.heli.rotor.rotation.y += dt * 28;
        c.heli.tailRotor.rotation.x += dt * 30;
        c.heli.spotlight.target.position.set(px, 0, pz);
        c.heli.spotlight.target.updateMatrixWorld();
        var hd = U.dist2(px, pz, c.x, c.z);
        if (hd < 34) {
          c.lockT += dt;
          if (c.lockT > 3) {
            c.shootT -= dt;
            if (c.shootT <= 0) {
              c.shootT = 0.7;
              damagePlayer(4, 'heli fire');
              if (window.PH && window.PH.sfx) window.PH.sfx('heliShot');
            }
          }
        } else c.lockT = Math.max(0, c.lockT - dt);
      }
    });
  }

  function damagePlayer(amount, cause) {
    if (S.busted) return;
    G.health -= amount;
    if (window.PH && window.PH.sfx) window.PH.sfx('hurt');
    if (G.health <= 0) {
      G.health = 0;
      bustPlayer();
    }
  }

  function bustPlayer() {
    if (S.busted) return;
    S.busted = true;
    S.bustTimer = 2.2;
    var lost = Math.min(G.money, 200);
    G.money -= lost;
    var wasDriving = !!S.playerCar;
    if (wasDriving) exitCar();
    G.wanted = 0;
    G.wantedTimer = 0;
    // Wake up at the pier safehouse, heat gone.
    G.player.x = 196; G.player.z = 6;
    G.player.heading = -Math.PI / 2;
    S.mateo.group.position.set(196, 0, 6);
    S.cops.slice().forEach(removeCop);
    toast('BUSTED! The PD took $' + lost + '. You wake up at the pier.', 4000);
    dialog('Kira: You\'re awake. Pier safehouse, no heat, no car. Get moving, Mateo.', 6000);
    PH.save.saveGame();
  }

  // --- camera ----------------------------------------------------------------------
  function updateCamera(dt) {
    var cam = W.camera;
    var p = G.player;
    if (!p.onFoot) {
      var car = S.playerCar;
      var back = 11, up = 4.6;
      var tx = car.x - Math.sin(car.heading) * back;
      var tz = car.z - Math.cos(car.heading) * back;
      var k = Math.min(1, dt * 4.5);
      cam.position.x = U.lerp(cam.position.x, tx, k);
      cam.position.y = U.lerp(cam.position.y, up, k);
      cam.position.z = U.lerp(cam.position.z, tz, k);
      cam.lookAt(car.x + Math.sin(car.heading) * 8, 1.6, car.z + Math.cos(car.heading) * 8);
    } else {
      var yaw = G.cam.yaw, pitch = G.cam.pitch;
      var dist = p.aiming ? 5.0 : 7.5;
      var cx = p.x - Math.sin(yaw) * Math.cos(pitch) * dist;
      var cz = p.z - Math.cos(yaw) * Math.cos(pitch) * dist;
      var cy = (p.aiming ? 2.7 : 2.2) + Math.sin(pitch) * dist;
      cam.position.set(cx, Math.max(0.8, cy), cz);
      // Aim further ahead so Mateo sits in the lower third, not dead centre.
      var lookD = p.aiming ? 4 : 2;
      cam.lookAt(p.x + Math.sin(yaw) * lookD, p.aiming ? 1.25 : 1.5, p.z + Math.cos(yaw) * lookD);
    }
  }

  // --- HUD ---------------------------------------------------------------------------
  var mm = null;
  function drawMinimap() {
    if (!mm) mm = el('minimap').getContext('2d');
    var c = mm, S2 = 190, R = S2 / 2;
    c.clearRect(0, 0, S2, S2);
    c.save();
    c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0d0a24'; c.fillRect(0, 0, S2, S2);
    function toMap(x, z) {
      return [R + (x / 260) * S2, R + (z / 260) * S2];
    }
    // Sea + beach on the east.
    c.fillStyle = '#1d6f8e'; c.fillRect(toMap(205, -150)[0], 0, S2, S2);
    c.fillStyle = '#e8c98f'; c.fillRect(toMap(168, -150)[0], 0, toMap(205, -150)[0] - toMap(168, -150)[0], S2);
    // Roads.
    c.strokeStyle = '#5a5a72'; c.lineWidth = 5;
    for (var i = 0; i < 7; i++) {
      var rc = U.roadCoord(i);
      var a = toMap(-150, rc), b = toMap(150, rc);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      var d = toMap(rc, -150), e = toMap(rc, 150);
      c.beginPath(); c.moveTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.stroke();
    }
    // Pier.
    c.strokeStyle = '#8a5f38'; c.lineWidth = 4;
    var p1 = toMap(168, 0), p2 = toMap(240, 0);
    c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke();
    // Mission target.
    var t = currentTarget();
    if (t) {
      var tp = toMap(t.x, t.z);
      var pulse = 5 + Math.sin(G.time * 5) * 2;
      c.fillStyle = '#ffd23e';
      c.beginPath(); c.arc(tp[0], tp[1], pulse + 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a0f2e';
      c.font = 'bold 11px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('★', tp[0], tp[1]);
    }
    // Traffic (white), peds (grey), cops (red/blue), heli (purple).
    c.fillStyle = '#ffffff';
    S.traffic.forEach(function (car) { var q = toMap(car.x, car.z); c.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3); });
    c.fillStyle = '#9a9ab0';
    S.peds.forEach(function (ped) { if (!ped.down) { var q = toMap(ped.x, ped.z); c.fillRect(q[0] - 1, q[1] - 1, 2, 2); } });
    S.cops.forEach(function (cop) {
      var q = toMap(cop.x, cop.z);
      c.fillStyle = cop.kind === 'heli' ? '#c77dff' : (cop.kind === 'car' ? '#ff5555' : '#ff2222');
      c.beginPath(); c.arc(q[0], q[1], cop.kind === 'car' ? 4 : 3, 0, Math.PI * 2); c.fill();
    });
    // Player arrow.
    var pp = toMap(G.player.x, G.player.z);
    c.save();
    c.translate(pp[0], pp[1]);
    c.rotate(Math.PI - G.player.heading);
    c.fillStyle = '#7dff9e';
    c.beginPath(); c.moveTo(0, -8); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    c.restore();
    // Ring label: district name.
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.font = 'bold 10px Arial'; c.textAlign = 'center';
    c.fillText(U.districtAt(G.player.x, G.player.z).toUpperCase(), R, S2 - 8);
  }

  function updateHUD() {
    el('money').textContent = U.fmtMoney(G.money);
    var stars = '';
    for (var i = 0; i < 5; i++) stars += '<span class="' + (i < G.wanted ? 'on' : 'off') + '">★</span>';
    el('stars').innerHTML = stars;
    var list = el('police-list');
    var html = '';
    el('police-panel').querySelector('.p-title').textContent =
      '📻 Sunset Bay PD — ' + U.wantedLabel(G.wanted);
    if (S.cops.length === 0) {
      html = '<div>No units in the area. <span class="st-patrol">All quiet.</span></div>';
    } else {
      S.cops.slice(0, 5).forEach(function (c) {
        var d = Math.round(U.dist2(G.player.x, G.player.z, c.x, c.z));
        var st = G.wanted >= 1 ? '<span class="st-pursuit">PURSUIT</span>' : '<span class="st-patrol">PATROL</span>';
        if (c.kind === 'heli') st = '<span class="st-pursuit">AIR SUPPORT' + (c.lockT > 3 ? ' — FIRING' : ' — LOCKING') + '</span>';
        html += '<div>' + c.name + ' • ' + d + 'm • ' + st + '</div>';
      });
      if (S.cops.length > 5) html += '<div>+' + (S.cops.length - 5) + ' more units…</div>';
    }
    list.innerHTML = html;
    var speedEl = el('speed');
    if (G.player.onFoot) {
      speedEl.innerHTML = Math.round(G.player.speed * 2.2) + ' <small>mph</small>';
      el('car-name').textContent = 'ON FOOT — ' + U.districtAt(G.player.x, G.player.z).toUpperCase();
      el('car-hp').textContent = 'Health ' + Math.round(G.health) + '  •  Vehicle —';
    } else {
      var car = S.playerCar;
      speedEl.innerHTML = Math.round(Math.abs(car.speed) * 2.2) + ' <small>mph</small>';
      el('car-name').textContent = car.name;
      el('car-hp').textContent = 'Health ' + Math.round(G.health) + '  •  Vehicle ' + Math.round(car.hp) + '%';
    }
    el('health-fill').style.width = Math.max(0, G.health) + '%';
    el('emp-count').textContent = '×' + G.emp;
    el('smoke-count').textContent = '×' + G.smoke;
    el('radio-name').textContent = PH.STATIONS[G.radio].name;
    el('radio-track').textContent = PH.STATIONS[G.radio].track;
    el('crosshair').style.display = G.player.aiming ? 'block' : 'none';
    drawMinimap();
  }

  // --- main update ----------------------------------------------------------------------
  function update(dt, input) {
    G.time += dt;
    if (G.started && !G.paused) G.playTime += dt;
    // Tracer cleanup.
    for (var i = S.muzzle.length - 1; i >= 0; i--) {
      S.muzzle[i].t -= dt;
      if (S.muzzle[i].t <= 0) {
        W.scene.remove(S.muzzle[i].mesh);
        S.muzzle.splice(i, 1);
      }
    }
    if (!G.started || G.paused) return;
    updatePlayer(dt, input);
    updateDriving(dt, input);
    updateTraffic(dt);
    updatePeds(dt);
    maintainPolice(dt);
    updateCops(dt);
    PH.crime.tickWantedDecay(dt, S.cops);
    updateMissions(dt);
    updateCamera(dt);
    updateHUD();
    // Sea shimmer.
    if (W.sea) W.sea.position.y = Math.sin(G.time * 0.6) * 0.08;
    // Beacon pulse.
    if (W.beacon.group.visible) {
      var s = 1 + Math.sin(G.time * 4) * 0.15;
      W.beacon.group.scale.set(s, 1, s);
    }
  }

  function initSim() {
    var mateo = B.makeMateo();
    mateo.group.position.set(G.player.x, 0, G.player.z);
    W.scene.add(mateo.group);
    S.mateo = mateo;
    spawnMissionCar();
    for (var i = 0; i < 14; i++) spawnTrafficCar();
    for (var j = 0; j < 26; j++) spawnPed();
    // A few patrol cops already on the street at start (wanted 0: patrol only).
    spawnFootCop(20, 44);
    spawnFootCop(-44, -20);
    var saved = PH.save.loadGame();
    if (saved) {
      toast('Save loaded — ' + U.fmtMoney(G.money) + ', job ' + (G.missionIndex + 1) + ' of 8.', 3500);
    }
    if (G.missionIndex >= MISSIONS.length) finishStory();
    else startMission(G.missionIndex);
    return S;
  }

  PH.sim = S;
  PH.simInit = initSim;
  PH.simUpdate = update;
  PH.missions = MISSIONS;
  PH.simApi = {
    startMission: startMission, enterCar: enterCar, exitCar: exitCar,
    nearestCar: nearestCar, shoot: shoot, useEmp: useEmp, useSmoke: useSmoke,
    spawnPoliceCar: spawnPoliceCar, spawnFootCop: spawnFootCop,
    currentTarget: currentTarget, updateCamera: updateCamera,
  };
  // Probe/debug hooks: read-only state plus small setters the playtest uses.
  PH.test = {
    state: function () {
      return {
        wanted: G.wanted, money: G.money, missionIndex: G.missionIndex,
        x: G.player.x, z: G.player.z, onFoot: G.player.onFoot,
        health: G.health, cops: S.cops.length,
        copsNear40: S.cops.filter(function (c) { return U.dist2(G.player.x, G.player.z, c.x, c.z) <= 40; }).length,
        pedsNear30: S.peds.filter(function (p) { return !p.down && !p.fleeing && U.dist2(G.player.x, G.player.z, p.x, p.z) <= 30; }).length,
        traffic: S.traffic.length, peds: S.peds.length,
        missionTitle: S.mission ? S.mission.title : null,
        m2: S.m2,
      };
    },
    teleport: function (x, z) {
      if (!G.player.onFoot) exitCar();
      G.player.x = x; G.player.z = z;
      S.mateo.group.position.set(x, 0, z);
    },
    setMission: function (i) { G.missionIndex = i; startMission(i); },
    clearCops: function () { S.cops.slice().forEach(removeCop); },
    spawnPedNear: function (x, z) {
      var p = spawnPed();
      p.x = x; p.z = z; p.group.position.set(x, 0, z);
      return p;
    },
    spawnCopNear: function (x, z) { return spawnFootCop(x, z); },
  };
})();
