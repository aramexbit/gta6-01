// PIER HEAT v6.4 — sim.js
// The living city: Mateo on foot and in the Scarlet Arrow, traffic lanes,
// sidewalk crowds, police pursuit, the police helicopter, mission gates,
// the heat system that fires the first chase, shooting and the save.
// Written fresh for v6.4; nothing here is copied from an earlier version.
(function () {
  'use strict';

  var W = window.PHWORLD;
  var state = window.PH.state;

  var sim = {
    player: null,       // {x, z, yaw, speed, mesh}
    arrowCar: null,     // {x, z, yaw, speed, mesh}
    stolenCar: null,    // traffic car currently driven, if any
    traffic: [],        // {mesh, axis, fixed, pos, dir, speed, yaw}
    peds: [],           // {mesh, axis, fixed, pos, dir, speed, static, x, z, yaw}
    police: [],         // {mesh, x, z, yaw, speed, unit, tactic, alive, lateral}
    heli: null,
    roadblock: null,
    fallenEnemy: null,
    fallenOfficer: null,
    tracers: [],
    keys: {},
    autoDrive: false,
    holdPolice: false,  // staged shots hold police in place (see update)
    cruiseSpeed: null,  // staged shots pin the hero car to one speed
    drivenDistance: 0,
    time: 0,
    muzzle: null,
    scene: null,
    refs: null,
  };

  var UNIT_NUMBERS = [17, 42, 9, 23, 31, 7, 55, 12];
  var TACTICS = ['PIT', 'FLANK', 'BLOCK'];

  function fwd(yaw) { return { x: Math.sin(yaw), z: Math.cos(yaw) }; }

  // ------------------------------------------------------------ init
  function initSim(scene, refs) {
    sim.scene = scene;
    sim.refs = refs;

    // Mateo starts in the park, ~115 m from the Arrow in the Marina lot.
    // NOTE: the heading field is camYaw — the screenshot scripts steer the
    // player by writing sim.player.camYaw every tick, and walking follows it.
    var mateo = W.buildMateo();
    scene.add(mateo);
    sim.player = { x: 40, z: 120, camYaw: Math.atan2(128 - 40, 40 - 120), speed: 0, mesh: mateo };

    // The Scarlet Arrow, parked in the Marina lot.
    var arrow = W.buildHeroCar();
    scene.add(arrow);
    sim.arrowCar = { x: 128, z: 40, yaw: Math.PI / 2, speed: 0, mesh: arrow };

    // Muzzle flash light (one light, reused, decays fast).
    var mz = new THREE.PointLight(0xffd98a, 0, 30);
    scene.add(mz);
    sim.muzzle = mz;

    buildTraffic(scene);
    buildPeds(scene);
    buildPolicePool(scene);
    buildRoadblock(scene);
    buildFallen(scene);
    syncMeshes();
    return sim;
  }

  function buildTraffic(scene) {
    var styles = ['sedan', 'sedan', 'hatch', 'sedan', 'van', 'sedan', 'taxi', 'hatch'];
    // Ocean Drive: 8 eastbound (z=-4), 8 westbound (z=+4).
    for (var i = 0; i < 16; i++) {
      var east = i < 8;
      var style = styles[i % styles.length];
      var color = style === 'taxi' ? 0xffd400 : W.CAR_COLORS[(i * 3) % W.CAR_COLORS.length];
      var mesh = W.buildTrafficCar(color, style);
      scene.add(mesh);
      sim.traffic.push({
        mesh: mesh, axis: 'x', fixed: east ? -4 : 4,
        pos: -250 + i * 31 + (east ? 0 : 15), dir: east ? 1 : -1,
        speed: 8 + (i % 5) * 1.6, yaw: east ? Math.PI / 2 : -Math.PI / 2,
      });
    }
    // Cross streets: 4 northbound, 4 southbound on each of 4 streets.
    var streets = [-140, -20, 40, 100];
    for (var s = 0; s < streets.length; s++) {
      for (var k = 0; k < 4; k++) {
        var north = k < 2;
        var st = styles[(s + k) % styles.length];
        var col = st === 'taxi' ? 0xffd400 : W.CAR_COLORS[(s * 5 + k * 2) % W.CAR_COLORS.length];
        var m2 = W.buildTrafficCar(col, st);
        scene.add(m2);
        sim.traffic.push({
          mesh: m2, axis: 'z', fixed: streets[s] + (north ? -3 : 3),
          pos: -140 + k * 70 + s * 7, dir: north ? -1 : 1,
          speed: 7 + (k % 4) * 1.8, yaw: north ? Math.PI : 0,
        });
      }
    }
  }

  function buildPeds(scene) {
    // Ocean Drive sidewalks: the big crowd, both sides.
    for (var i = 0; i < 64; i++) {
      var side = i % 2 ? -11 : 11;
      var mesh = W.buildPed(1000 + i);
      scene.add(mesh);
      sim.peds.push({
        mesh: mesh, axis: 'x', fixed: side,
        pos: -248 + i * 7.8, dir: (i % 3 === 0) ? -1 : 1,
        speed: 0.9 + (i % 5) * 0.35, yaw: 0, static: false,
      });
    }
    // Cross-street sidewalks.
    var streets = [-140, -20, 40, 100];
    for (var s = 0; s < streets.length; s++) {
      for (var k = 0; k < 8; k++) {
        var m2 = W.buildPed(2000 + s * 10 + k);
        scene.add(m2);
        sim.peds.push({
          mesh: m2, axis: 'z', fixed: streets[s] + (k % 2 ? 9 : -9),
          pos: -135 + k * 34 + (s % 2) * 11, dir: (k % 2 ? 1 : -1),
          speed: 0.8 + (k % 4) * 0.4, yaw: 0, static: false,
        });
      }
    }
    // Standing crowds: market browsers, park visitors, pier strollers.
    var spots = [];
    for (var a = 0; a < 10; a++) spots.push([-150 + (a % 2) * 18, 42 + a * 9]);
    for (var b = 0; b < 8; b++) spots.push([-8 + b * 7, 46 + (b % 2) * 14]);
    for (var c = 0; c < 6; c++) spots.push([250 + c * 7, -4 + (c % 2) * 8]);
    spots.forEach(function (p, i) {
      var m3 = W.buildPed(3000 + i);
      scene.add(m3);
      sim.peds.push({
        mesh: m3, axis: 'x', fixed: p[1], pos: p[0], dir: 1,
        speed: 0, yaw: (i * 1.3) % (Math.PI * 2), static: true, x: p[0], z: p[1],
      });
    });
  }

  function buildPolicePool(scene) {
    for (var i = 0; i < 8; i++) {
      var mesh = W.buildPoliceCar();
      mesh.visible = false;
      scene.add(mesh);
      sim.police.push({
        mesh: mesh, x: 0, z: 0, yaw: 0, speed: 0,
        unit: UNIT_NUMBERS[i], tactic: TACTICS[i % 3],
        alive: false, dead: true, lateral: (i % 2 ? 1 : -1) * (3 + (i % 3) * 2),
      });
    }
  }

  function buildRoadblock(scene) {
    var g = new THREE.Group();
    var c1 = W.buildPoliceCar();
    c1.position.set(-3.4, 0, 0); c1.rotation.y = 0.5;
    var c2 = W.buildPoliceCar();
    c2.position.set(3.4, 0, 0); c2.rotation.y = -0.5;
    g.add(c1); g.add(c2);
    var stripe = (function () {
      var cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
      var gg = cv.getContext('2d');
      for (var i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? '#ffd400' : '#111111'; gg.fillRect(i * 16, 0, 16, 32); }
      return new THREE.CanvasTexture(cv);
    })();
    [-5.5, 5.5].forEach(function (x) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.2),
        new THREE.MeshBasicMaterial({ map: stripe }));
      bar.position.set(x, 0.9, 0);
      g.add(bar);
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      post.position.set(x, 0.45, 0);
      g.add(post);
    });
    for (var i = 0; i < 4; i++) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8),
        new THREE.MeshLambertMaterial({ color: 0xff5d00 }));
      cone.position.set(-7 + i * 4.6, 0.35, 2.6);
      g.add(cone);
    }
    g.visible = false;
    scene.add(g);
    sim.roadblock = g;
  }

  function buildFallen(scene) {
    var e = W.buildFallen(0xff3b30);
    e.visible = false; scene.add(e);
    sim.fallenEnemy = e;
    var o = W.buildFallen(0x1a2f5e);
    o.visible = false; scene.add(o);
    sim.fallenOfficer = o;
  }

  // ------------------------------------------------------------ mesh sync
  function syncMeshes() {
    var p = sim.player;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.camYaw;
    // Mateo rides inside the car: hide his on-foot mesh while driving, or
    // his head pokes through the hero car's roof in every chase shot.
    p.mesh.visible = !state.inCar;
    var a = sim.arrowCar;
    a.mesh.position.set(a.x, 0, a.z);
    a.mesh.rotation.y = a.yaw - Math.PI / 2; // extruded profile faces +X at yaw 0
  }

  // ------------------------------------------------------------ police
  function alivePolice() { return sim.police.filter(function (c) { return c.alive; }); }

  function spawnPolice(n, rMin, rMax) {
    var pp = sim.player;
    var cx = state.inCar ? sim.arrowCar.x : pp.x;
    var cz = state.inCar ? sim.arrowCar.z : pp.z;
    var spawned = 0;
    for (var i = 0; i < sim.police.length && spawned < n; i++) {
      var c = sim.police[i];
      if (c.alive) continue;
      var ang = (spawned / Math.max(n, 1)) * Math.PI * 2 + 0.7;
      var r = rMin + (spawned * 3.7) % (rMax - rMin);
      c.x = cx + Math.cos(ang) * r;
      c.z = cz + Math.sin(ang) * r;
      c.yaw = Math.atan2(cx - c.x, cz - c.z);
      c.speed = 10;
      c.alive = true;
      c.dead = false;
      c.mesh.visible = true;
      spawned++;
    }
    return spawned;
  }

  function ensurePoliceCount(n) {
    var alive = alivePolice().length;
    if (alive < n) spawnPolice(n - alive, 30, 42);
    return alivePolice().length;
  }

  function ensureHeli() {
    if (sim.heli) { sim.heli.visible = true; return sim.heli; }
    var h = W.buildHeli();
    sim.scene.add(h);
    sim.heli = h;
    h.visible = true;
    return h;
  }

  function snapHeli(dist) {
    var h = ensureHeli();
    var pp = sim.player;
    var cx = state.inCar ? sim.arrowCar.x : pp.x;
    var cz = state.inCar ? sim.arrowCar.z : pp.z;
    var yaw = state.inCar ? sim.arrowCar.yaw : pp.camYaw;
    var d = dist || 13;
    var hx = cx + Math.sin(yaw + 0.7) * d;
    var hz = cz + Math.cos(yaw + 0.7) * d;
    h.position.set(hx, 23, hz);
    h.lookAt(cx, 0, cz);
    return { x: Math.round(hx), z: Math.round(hz), dist: d };
  }

  function hideHeli() { if (sim.heli) sim.heli.visible = false; }

  function setWanted(n) {
    window.PH.setWantedStars(n);
    if (n <= 0) {
      sim.police.forEach(function (c) { c.alive = false; c.dead = true; c.mesh.visible = false; });
      hideHeli();
      return { wanted: 0, police: 0, heli: false };
    }
    var count = ensurePoliceCount(2 + n);
    if (n >= 3) ensureHeli();
    return { wanted: state.wanted, police: count, heli: !!sim.heli && sim.heli.visible };
  }

  // ------------------------------------------------------------ heat
  function fireHeat() {
    if (state.heatArmed) return false;
    state.heatArmed = true;
    window.PH.setWantedStars(2);
    spawnPolice(4, 30, 42);
    if (window.PH.toast) window.PH.toast('SBPD ON YOUR TAIL — 2 STARS');
    return true;
  }

  // ------------------------------------------------------------ car / foot
  function nearestCar(x, z, maxD) {
    var best = null, bd = maxD;
    var d = Math.hypot(sim.arrowCar.x - x, sim.arrowCar.z - z);
    if (d < bd) { best = { kind: 'arrow', car: sim.arrowCar, d: d }; bd = d; }
    for (var i = 0; i < sim.traffic.length; i++) {
      var t = sim.traffic[i];
      var tx = t.axis === 'x' ? t.pos : t.fixed;
      var tz = t.axis === 'x' ? t.fixed : t.pos;
      var td = Math.hypot(tx - x, tz - z);
      if (td < bd) { best = { kind: 'traffic', car: t, d: td }; bd = td; }
    }
    return best;
  }

  function enterCar() {
    if (state.inCar) return false;
    var p = sim.player;
    // The Arrow always wins when it is in reach: M1 must complete on it.
    var da = Math.hypot(sim.arrowCar.x - p.x, sim.arrowCar.z - p.z);
    if (da < 4) {
      state.inCar = true;
      state.currentCar = 'arrow';
      if (state.missionIndex === 0) {
        var res = window.PH.completeMission();
        if (window.PH.toast) window.PH.toast('M1 COMPLETE — +' + window.PH.fmtMoney(res.paid) + ' · ' + res.next);
      }
      return true;
    }
    var near = nearestCar(p.x, p.z, 4);
    if (near && near.kind === 'traffic') {
      // Stealing a street car: the traffic car stays parked (hidden) and
      // Mateo drives the hero body from that spot.
      near.car.mesh.visible = false;
      sim.arrowCar.x = p.x; sim.arrowCar.z = p.z; sim.arrowCar.yaw = p.camYaw;
      sim.arrowCar.speed = 0;
      state.inCar = true;
      state.currentCar = 'stolen';
      return true;
    }
    return false;
  }

  function exitCar() {
    if (!state.inCar) return false;
    var a = sim.arrowCar;
    var f = fwd(a.yaw);
    sim.player.x = a.x - f.x * 2.5;
    sim.player.z = a.z - f.z * 2.5;
    sim.player.camYaw = a.yaw;
    state.inCar = false;
    state.currentCar = null;
    a.speed = 0;
    return true;
  }

  // ------------------------------------------------------------ shooting
  function shoot() {
    if (state.ammo <= 0) return { fired: false, ammo: 0 };
    state.ammo -= 1;
    var ox, oz, oy, yaw;
    if (state.inCar) {
      var a = sim.arrowCar;
      var f = fwd(a.yaw);
      ox = a.x + f.x * 2.4; oz = a.z + f.z * 2.4; oy = 1.1; yaw = a.yaw;
    } else {
      var p = sim.player;
      var pf = fwd(p.camYaw);
      ox = p.x + pf.x * 0.7; oz = p.z + pf.z * 0.7; oy = 1.35; yaw = p.camYaw;
    }
    var dir = fwd(yaw);
    var len = 42;
    for (var k = 0; k < 2; k++) {
      var off = k === 0 ? 0 : 0.22;
      var geo = new THREE.BoxGeometry(0.14, 0.14, len);
      var mat = new THREE.MeshBasicMaterial({
        color: k === 0 ? 0xffe14d : 0xff9d00, transparent: true, opacity: k === 0 ? 0.95 : 0.55,
      });
      var tr = new THREE.Mesh(geo, mat);
      tr.position.set(ox + dir.x * len / 2 - Math.cos(yaw) * off, oy, oz + dir.z * len / 2 + Math.sin(yaw) * off);
      tr.rotation.y = yaw;
      sim.scene.add(tr);
      sim.tracers.push({ mesh: tr, mat: mat, ttl: 0.28 });
    }
    sim.muzzle.position.set(ox, oy + 0.2, oz);
    sim.muzzle.intensity = 4;
    return { fired: true, ammo: state.ammo };
  }

  // ------------------------------------------------------------ gates
  function currentGatePos() {
    var gates = [[170, 0], [100, -60], [40, -120]];
    var i = Math.min(state.missionStage - 1, gates.length - 1);
    return { x: gates[i][0], z: gates[i][1], index: i };
  }

  function updateGates() {
    var refs = sim.refs;
    if (!refs || !refs.gates) return;
    if (state.missionIndex === 1) {
      var g = currentGatePos();
      refs.gates.forEach(function (ring, i) { ring.visible = i === g.index; });
      var a = sim.arrowCar;
      if (state.inCar && Math.hypot(a.x - g.x, a.z - g.z) < 9) {
        state.gatesPassed += 1;
        if (state.missionStage >= 3) {
          var res = window.PH.completeMission();
          if (window.PH.toast) window.PH.toast('M2 COMPLETE — +' + window.PH.fmtMoney(res.paid) + ' · ' + res.next);
        } else {
          state.missionStage += 1;
          if (window.PH.toast) window.PH.toast('GATE ' + state.gatesPassed + ' CLEAR — NEXT GATE MARKED');
        }
      }
    } else {
      refs.gates.forEach(function (ring) { ring.visible = false; });
    }
  }

  // ------------------------------------------------------------ update
  function update(dt) {
    sim.time += dt;
    var p = sim.player;
    var a = sim.arrowCar;
    var keys = sim.keys;

    if (state.started) {
      if (state.inCar) {
        // Driving: W/S throttle, A/D steer, Space handbrake. A staged
        // cruise speed pins the car so a screenshot stays framed for the
        // seconds a slow capture takes.
        var throttle = (keys.KeyW || sim.autoDrive) ? 1 : 0;
        if (keys.KeyS) throttle = -0.6;
        var steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
        if (sim.cruiseSpeed != null) {
          a.speed = sim.cruiseSpeed;
        } else {
          if (throttle !== 0) a.speed += throttle * 9 * dt;
          else a.speed -= Math.sign(a.speed) * Math.min(Math.abs(a.speed), 6 * dt);
          if (keys.Space) a.speed -= Math.sign(a.speed) * Math.min(Math.abs(a.speed), 22 * dt);
          a.speed = Math.max(-8, Math.min(27, a.speed));
        }
        if (Math.abs(a.speed) > 0.3) a.yaw += steer * 1.5 * dt * Math.sign(a.speed);
        var f = fwd(a.yaw);
        var nx = a.x + f.x * a.speed * dt;
        var nz = a.z + f.z * a.speed * dt;
        sim.drivenDistance += Math.hypot(nx - a.x, nz - a.z);
        a.x = nx; a.z = nz;
        state.speedKmh = Math.abs(a.speed) * 3.6;
        p.x = a.x; p.z = a.z; p.camYaw = a.yaw;
        if (!state.heatArmed && sim.drivenDistance >= 70) fireHeat();
      } else {
        // On foot: W forward along camYaw, A/D turn, Shift run.
        var run = keys.ShiftLeft || keys.ShiftRight;
        var walk = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 0.55 : 0);
        var turn = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
        p.camYaw += turn * 2.4 * dt;
        var spd = run ? 7 : 4;
        p.speed = walk * spd;
        var pf = fwd(p.camYaw);
        p.x += pf.x * p.speed * dt;
        p.z += pf.z * p.speed * dt;
        state.speedKmh = Math.abs(p.speed) * 3.6;
      }
      // Mission clock counts down while playing.
      state.missionTimeLeft -= dt;
      if (state.missionTimeLeft <= 0) {
        state.missionTimeLeft = window.PH.mission().timeLimit;
      }
      updateGates();
    }

    // Traffic always rolls, even behind the title screen.
    for (var i = 0; i < sim.traffic.length; i++) {
      var t = sim.traffic[i];
      t.pos += t.dir * t.speed * dt;
      if (t.axis === 'x') {
        if (t.pos > 238) t.pos = -258;
        if (t.pos < -258) t.pos = 238;
        t.mesh.position.set(t.pos, 0, t.fixed);
      } else {
        if (t.pos > 152) t.pos = -148;
        if (t.pos < -148) t.pos = 152;
        t.mesh.position.set(t.fixed, 0, t.pos);
      }
      t.mesh.rotation.y = t.yaw - Math.PI / 2; // car bodies face +X at yaw 0
    }

    // Pedestrians walk their sidewalk, bobbing as they go.
    for (var j = 0; j < sim.peds.length; j++) {
      var pd = sim.peds[j];
      if (pd.static) {
        pd.mesh.position.set(pd.x, Math.sin(sim.time * 1.4 + j) * 0.015, pd.z);
        pd.mesh.rotation.y = pd.yaw + Math.sin(sim.time * 0.7 + j) * 0.1;
        continue;
      }
      pd.pos += pd.dir * pd.speed * dt;
      var lo = pd.axis === 'x' ? -250 : -138, hi = pd.axis === 'x' ? 232 : 138;
      if (pd.pos > hi) { pd.pos = hi; pd.dir = -1; }
      if (pd.pos < lo) { pd.pos = lo; pd.dir = 1; }
      var pyaw = pd.axis === 'x' ? (pd.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (pd.dir > 0 ? 0 : Math.PI);
      if (pd.axis === 'x') pd.mesh.position.set(pd.pos, Math.abs(Math.sin(sim.time * 7 + j)) * 0.05, pd.fixed);
      else pd.mesh.position.set(pd.fixed, Math.abs(Math.sin(sim.time * 7 + j)) * 0.05, pd.pos);
      pd.mesh.rotation.y = pyaw;
      var u = pd.mesh.userData;
      if (u.legL) {
        var sw = Math.sin(sim.time * 7 + j) * 0.45;
        u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
        u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
      }
    }

    // Police pursuit: steer at the player, keep a loose tail, never stack.
    // Staged shots hold the police in FORMATION with the hero: the offsets
    // recorded when the hold starts are re-applied every frame, so the
    // flankers stay flanking while the hero rolls — without this they fall
    // behind during a slow screenshot capture and loom over the lens.
    var tx = state.inCar ? a.x : p.x;
    var tz = state.inCar ? a.z : p.z;
    if (sim.holdPolice) {
      var hx = tx, hz = tz;
      if (!sim._formation) {
        sim._formation = sim.police.map(function (pc) {
          return pc.alive ? { dx: pc.x - hx, dz: pc.z - hz, yaw: pc.yaw } : null;
        });
      }
      sim.police.forEach(function (pc, i) {
        if (!pc.alive) return;
        var off = sim._formation[i];
        if (!off) return;
        pc.x = hx + off.dx; pc.z = hz + off.dz; pc.yaw = off.yaw;
        pc.mesh.position.set(pc.x, 0, pc.z);
        pc.mesh.rotation.y = pc.yaw - Math.PI / 2;
      });
    } else {
      sim._formation = null;
      for (var c = 0; c < sim.police.length; c++) {
      var pc = sim.police[c];
      if (!pc.alive) continue;
      var gx = tx + Math.cos(pc.yaw) * pc.lateral * 0.4;
      var gz = tz + Math.sin(pc.yaw) * pc.lateral * 0.4;
      var dx = gx - pc.x, dz = gz - pc.z;
      var dist = Math.hypot(dx, dz);
      var want = Math.atan2(dx, dz);
      var diff = want - pc.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pc.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      var target = dist > 60 ? 23 : dist < 9 ? Math.max(2, Math.abs(a.speed) * 0.9) : 19;
      pc.speed += (target - pc.speed) * Math.min(1, 1.6 * dt);
      var cf = fwd(pc.yaw);
      pc.x += cf.x * pc.speed * dt;
      pc.z += cf.z * pc.speed * dt;
      pc.mesh.position.set(pc.x, 0, pc.z);
      pc.mesh.rotation.y = pc.yaw - Math.PI / 2; // police body faces +X at yaw 0
      }
    }

    // Helicopter hovers above the player, rotor spinning, light on target.
    if (sim.heli && sim.heli.visible) {
      var hx = tx + Math.sin(sim.time * 0.25) * 8;
      var hz = tz + Math.cos(sim.time * 0.25) * 8;
      sim.heli.position.x += (hx - sim.heli.position.x) * Math.min(1, 1.2 * dt);
      sim.heli.position.z += (hz - sim.heli.position.z) * Math.min(1, 1.2 * dt);
      sim.heli.position.y = 23 + Math.sin(sim.time * 0.5) * 1.2;
      sim.heli.lookAt(tx, 0, tz);
      if (sim.heli.userData.rotor) sim.heli.userData.rotor.rotation.y += dt * 22;
    }

    // Tracer fade + muzzle decay.
    for (var t2 = sim.tracers.length - 1; t2 >= 0; t2--) {
      var tr = sim.tracers[t2];
      tr.ttl -= dt;
      tr.mat.opacity = Math.max(0, tr.ttl / 0.28);
      if (tr.ttl <= 0) {
        sim.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mat.dispose();
        sim.tracers.splice(t2, 1);
      }
    }
    if (sim.muzzle.intensity > 0) sim.muzzle.intensity = Math.max(0, sim.muzzle.intensity - dt * 22);

    syncMeshes();
  }

  // ------------------------------------------------------------ counts
  function counts() {
    return {
      signs: sim.refs ? sim.refs.signCount : 0,
      peds: sim.peds.length,
      trafficCars: sim.traffic.length,
      parkedCars: sim.refs && sim.refs.parkedCars ? sim.refs.parkedCars.length : 0,
      police: alivePolice().length,
      heli: sim.heli && sim.heli.visible ? 1 : 0,
    };
  }

  // ------------------------------------------------------------ debug
  var debug = {
    teleport: function (x, z) {
      sim.player.x = x; sim.player.z = z;
      sim.player.camYaw = Math.atan2(sim.arrowCar.x - x, sim.arrowCar.z - z);
      return { x: sim.player.x, z: sim.player.z };
    },
    driveForward: function () { sim.autoDrive = true; return { autoDrive: true }; },
    stopDriving: function () { sim.autoDrive = false; return { autoDrive: false }; },
    setWanted: setWanted,
    shoot: shoot,
    counts: counts,
    spawnPolice: spawnPolice,
    ensureHeli: ensureHeli,
    snapHeli: snapHeli,
    placeRoadblock: function (x, z, yaw) {
      if (!sim.roadblock) return null;
      sim.roadblock.position.set(x, 0, z);
      sim.roadblock.rotation.y = yaw || 0;
      sim.roadblock.visible = true;
      return { x: x, z: z };
    },
    hideRoadblock: function () { if (sim.roadblock) sim.roadblock.visible = false; },
    showFallen: function (ex, ez, ox, oz) {
      // Scaled up: a fallen figure must read as a body from 10+ m away.
      if (sim.fallenEnemy) { sim.fallenEnemy.position.set(ex, 0, ez); sim.fallenEnemy.scale.setScalar(1.35); sim.fallenEnemy.visible = true; }
      if (sim.fallenOfficer) { sim.fallenOfficer.position.set(ox, 0, oz); sim.fallenOfficer.scale.setScalar(1.35); sim.fallenOfficer.visible = true; }
      return true;
    },
    hideFallen: function () {
      if (sim.fallenEnemy) sim.fallenEnemy.visible = false;
      if (sim.fallenOfficer) sim.fallenOfficer.visible = false;
    },
    // Move every pedestrian out of a circle (the camera corridor): a ped
    // standing next to the lens reads as a giant in the screenshot.
    clearCorridor: function (x, z, r) {
      var moved = 0;
      sim.peds.forEach(function (pd, i) {
        var px = pd.static ? pd.x : (pd.axis === 'x' ? pd.pos : pd.fixed);
        var pz = pd.static ? pd.z : (pd.axis === 'x' ? pd.fixed : pd.pos);
        if (Math.hypot(px - x, pz - z) < r) {
          pd.static = false; pd.axis = 'x'; pd.fixed = pd.fixed > 0 ? 11 : -11;
          pd.pos = x + (i % 2 ? 90 : -90); pd.dir = 1; pd.speed = 1;
          moved++;
        }
      });
      return { moved: moved };
    },
    // Pack walking pedestrians onto the sidewalks around a point so the
    // frame reads as a crowd. axis 'x' = Ocean Drive sidewalks (z +/-11),
    // axis 'z' = a cross street / market sidewalks (x = cx +/- 9).
    // dir -1 packs them behind the point (northbound shots), dir +1 ahead
    // of it (the south-facing night market).
    crowdNear: function (cx, cz, axis, n, dir) {
      var placed = 0;
      var d = dir === 1 ? 1 : -1;
      for (var i = 0; i < sim.peds.length && placed < n; i++) {
        var pd = sim.peds[i];
        if (pd.static) continue;
        if (axis === 'x') {
          pd.axis = 'x'; pd.fixed = (placed % 2 ? -11 : 11);
          pd.pos = d > 0 ? cx + 12 + placed * 4.5 : cx - 12 + placed * 4.5;
          pd.dir = placed % 2 ? 1 : -1;
        } else {
          pd.axis = 'z'; pd.fixed = cx + (placed % 2 ? 9 : -9);
          pd.pos = d > 0 ? cz + 8 + placed * 4.5 : cz - 8 - placed * 4.5;
          pd.dir = placed % 2 ? 1 : -1;
        }
        pd.speed = 0.9 + (placed % 4) * 0.3;
        placed++;
      }
      return { placed: placed };
    },
    // Line traffic cars up in the lanes ahead of a point, along a heading,
    // so the road ahead of the hero is full in the shot.
    stageTraffic: function (cx, cz, yaw, n) {
      var f = fwd(yaw);
      var r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      var placed = 0;
      for (var i = 0; i < sim.traffic.length && placed < n; i++) {
        var t = sim.traffic[i];
        var lane = (placed % 2 ? -3.5 : 3.5);
        var d = 25 + Math.floor(placed / 2) * 13;
        var x = cx + f.x * d + r.x * lane;
        var z = cz + f.z * d + r.z * lane;
        if (Math.abs(f.x) > Math.abs(f.z)) {
          t.axis = 'x'; t.pos = x; t.fixed = z; t.dir = f.x > 0 ? 1 : -1;
        } else {
          t.axis = 'z'; t.pos = z; t.fixed = x; t.dir = f.z > 0 ? 1 : -1;
        }
        t.yaw = yaw; t.speed = 8 + (placed % 3);
        t.mesh.position.set(x, 0, z);
        t.mesh.rotation.y = yaw - Math.PI / 2;
        placed++;
      }
      return { placed: placed };
    },
  };

  // Public surface: the loop and main.js call these through window.PH.sim.
  sim.update = update;
  sim.enterCar = enterCar;
  sim.exitCar = exitCar;
  sim.spawnPolice = spawnPolice;
  sim.ensureHeli = ensureHeli;
  sim.snapHeli = snapHeli;
  sim.setWanted = setWanted;
  sim.shoot = shoot;
  sim.counts = counts;

  window.PH.sim = sim;
  window.PH.initSim = initSim;
  window.PH.debug = Object.assign(window.PH.debug || {}, debug);
})();
