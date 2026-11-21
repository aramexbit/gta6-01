// PIER HEAT — Sunset Bay v7.4
// races.js — street racing on the city road graph: a loop of gates
// (checkpoint arches) along Sunset Blvd and the cross streets, rival
// cars that follow the same loop with their own pace, a start countdown
// and a live race position. Position is computed from checkpoint order
// first, then distance to the next gate — so a rival one gate ahead
// always ranks above the player, however close the gap looks.
// v7.4: in shot 1 the rivals run BIG and CLOSE, one in each lane
// beside the hero, so the frame reads as a race at a glance.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // The loop: down Sunset Blvd south, east along Z 120, back north on
  // the east avenue, west along Z -120. Gates sit at the corners and
  // mid-straights so the player always sees the next arch.
  PH.RACE_LOOP = [
    { x: -20, z: -100 }, { x: -20, z: -40 }, { x: -20, z: 20 },
    { x: -20, z: 80 }, { x: -20, z: 120 }, { x: 40, z: 120 },
    { x: 100, z: 120 }, { x: 140, z: 120 }, { x: 140, z: 60 },
    { x: 140, z: 0 }, { x: 140, z: -60 }, { x: 140, z: -120 },
    { x: 80, z: -120 }, { x: 20, z: -120 }
  ];

  function std(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough == null ? 0.6 : rough, metalness: metal || 0
    });
  }

  // Checkpoint gate: two striped poles + a glowing amber banner across
  // the road, with a floating number board so the gate reads from far.
  PH.makeRaceGate = function (index, total) {
    var g = new THREE.Group();
    var poleMat = std(0x1a1a1a, 0.6, 0.3);
    [-4.2, 4.2].forEach(function (x) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.4, 8), poleMat);
      pole.position.set(x, 3.2, 0); pole.castShadow = true; g.add(pole);
      var base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), std(0xffc832, 0.6));
      base.position.set(x, 0.15, 0); g.add(base);
    });
    var bannerTex = PH.canvasTex(512, 96, function (ctx, w, h) {
      ctx.fillStyle = '#14181c'; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 ? '#f2f2f2' : '#14181c';
        ctx.fillRect(i * 32, 0, 32, 14);
        ctx.fillRect(i * 32, h - 14, 32, 14);
      }
      // round 2: 44px, not 56 — "CHECKPOINT 3/14" at 56px overflowed
      // the 512px board and the "4" was clipped in shot 1
      ctx.fillStyle = '#ffd23c'; ctx.font = '900 44px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('CHECKPOINT ' + (index + 1) + '/' + total, w / 2, h / 2 + 2);
    });
    var banner = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.6, 0.2),
      new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6, emissive: 0x332200, emissiveIntensity: 0.4 }));
    banner.position.y = 5.6; g.add(banner);
    // amber glow strip under the banner
    var glow = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xffc832, emissive: 0xffb030, emissiveIntensity: 1.6 }));
    glow.position.y = 4.7; g.add(glow);
    // countdown lamps: three red lamps under the banner that light up
    // one by one and turn green on GO — the start line reads as a start
    var lampMats = [];
    [-1.2, 0, 1.2].forEach(function (x) {
      var lm = new THREE.MeshStandardMaterial({ color: 0x402020, emissive: 0xff2020, emissiveIntensity: 0.15 });
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lm);
      lamp.position.set(x, 4.1, 0.15);
      g.add(lamp);
      lampMats.push(lm);
      var housing = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10), std(0x14181c, 0.5, 0.4));
      housing.rotation.x = Math.PI / 2;
      housing.position.set(x, 4.1, 0.02);
      g.add(housing);
    });
    g.userData.banner = banner;
    g.userData.lampMats = lampMats;
    return g;
  };
  // Light the countdown lamps: n = 0..3 lit red, 4 = all green (GO).
  PH.makeRaceGate.setLights = function (gate, n) {
    if (!gate || !gate.userData.lampMats) return;
    gate.userData.lampMats.forEach(function (m, i) {
      if (n >= 4) { m.color.setHex(0x20ff60); m.emissive.setHex(0x10ff40); m.emissiveIntensity = 2.2; }
      else if (i < n) { m.color.setHex(0xff2020); m.emissive.setHex(0xff1010); m.emissiveIntensity = 2.2; }
      else { m.color.setHex(0x402020); m.emissive.setHex(0xff2020); m.emissiveIntensity = 0.15; }
    });
  };

  // --- race state machine ---
  PH.Race = function (scene) {
    this.scene = scene;
    this.gates = [];
    this.rivals = [];
    this.nextGate = 0;
    this.lap = 1;
    this.totalLaps = 2;
    this.position = 1;
    this.countdown = -1; // seconds left; -1 = not racing
    this.countdownT = 0;
    this.racing = false;
    this.raceTime = 0;
    this.playerGate = 0;
    this.playerProgress = 0;
    var self = this;
    PH.RACE_LOOP.forEach(function (pt, i) {
      var gate = PH.makeRaceGate(i, PH.RACE_LOOP.length);
      gate.position.set(pt.x, 0, pt.z);
      // gates face along the loop: heading to the next gate
      var nx = PH.RACE_LOOP[(i + 1) % PH.RACE_LOOP.length];
      gate.rotation.y = Math.atan2(nx.x - pt.x, nx.z - pt.z);
      gate.visible = false;
      scene.add(gate);
      self.gates.push(gate);
    });
    // three rivals now, distinct colours AND distinct bodies (v7.4):
    // a blue hatch, a red pickup and a green coupe — round 2 adds the
    // coupe so the race is a three-car fight, not a duel
    var colors = [0x2a6fd8, 0xd83a2a, 0x37a05a];
    var bodies = ['hatch', 'pickup', 'coupe'];
    var names = ['AZUL', 'ROJA', 'VERDE'];
    colors.forEach(function (c, i) {
      var car = PH.makeCar({ kind: 'traffic', color: c, bodyType: bodies[i] });
      car.position.set(-20 + (i === 0 ? 4 : -4), 0, -104 + i * 4);
      scene.add(car);
      self.rivals.push({
        mesh: car, gate: 0, speed: 15 + i * 1.2, color: c, name: names[i],
        pos: new THREE.Vector3(-20 + (i === 0 ? 4 : -4), 0, -104 + i * 4)
      });
    });
    this.gap = 0; // seconds (approx) behind the car ahead of the player
  };
  PH.Race.prototype.showGates = function (on) {
    this.gates.forEach(function (g) { g.visible = on; });
  };
  // Reset a finished (or staged) race back to the start line: gates
  // cleared, lap and clock zeroed, rivals back to their grid spots.
  PH.Race.prototype.reset = function () {
    this.nextGate = 0; this.lap = 1; this.raceTime = 0;
    this.playerGate = 0; this.position = 1; this.gap = 0;
    this.countdown = -1; this.countdownT = 0; this.racing = false;
    this.gates.forEach(function (g) { PH.makeRaceGate.setLights(g, 0); });
    this.rivals.forEach(function (r, i) {
      r.gate = 0;
      r.pos.set(-20 + (i === 0 ? 4 : -4), 0, -104 + i * 4);
      r.mesh.position.copy(r.pos);
      r.mesh.rotation.y = 0;
    });
  };
  PH.Race.prototype.startCountdown = function () {
    this.countdown = 3;
    this.countdownT = 0;
    this.racing = false;
  };
  // Rank: most gates cleared wins; ties break by distance to next gate.
  PH.Race.prototype.computePosition = function (playerPos) {
    var entries = [];
    var next = PH.RACE_LOOP[this.playerGate % PH.RACE_LOOP.length];
    var pd = Math.hypot(playerPos.x - next.x, playerPos.z - next.z);
    entries.push({ who: 'player', gates: this.playerGate, dist: pd });
    this.rivals.forEach(function (r, i) {
      var ng = PH.RACE_LOOP[r.gate % PH.RACE_LOOP.length];
      entries.push({
        who: 'rival' + i, gates: r.gate,
        dist: Math.hypot(r.pos.x - ng.x, r.pos.z - ng.z)
      });
    });
    entries.sort(function (a, b) {
      if (b.gates !== a.gates) return b.gates - a.gates;
      return a.dist - b.dist;
    });
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].who === 'player') {
        this.position = i + 1;
        // gap to the car ahead, in seconds at ~16 u/s — the number the
        // HUD shows next to the position, so P2 always has a chase target
        var ahead = entries[i - 1];
        this.gap = ahead ? Math.max(0, (ahead.dist - entries[i].dist) / 16) : 0;
        break;
      }
    }
    return this.position;
  };
  PH.Race.prototype.update = function (dt, t, playerPos, playerSpeed) {
    if (this.countdown >= 0) {
      this.countdownT += dt;
      var left = 3 - Math.floor(this.countdownT);
      if (left !== this.countdown) {
        this.countdown = left;
        // countdown lamps on the next gate: 3, 2, 1 red, then green GO
        var gate = this.gates[this.playerGate % this.gates.length];
        PH.makeRaceGate.setLights(gate, left <= 0 ? 4 : 3 - left);
        if (left <= 0) { this.racing = true; this.countdown = -1; }
      }
    }
    if (!this.racing) return;
    this.raceTime += dt;
    // player gate: within 7 units of the next gate = cleared
    var next = PH.RACE_LOOP[this.playerGate % PH.RACE_LOOP.length];
    if (playerPos && Math.hypot(playerPos.x - next.x, playerPos.z - next.z) < 7) {
      this.playerGate++;
      if (this.playerGate >= PH.RACE_LOOP.length) {
        this.playerGate = 0; this.lap++;
        if (this.lap > this.totalLaps) { this.racing = false; }
      }
      PH.hud.toast('CHECKPOINT ' + this.playerGate + ' — LAP ' + this.lap + '/' + this.totalLaps);
      // round 2: a checkpoint sounds like a checkpoint — a cheer from
      // the crowd plus dispatch on the radio
      PH.Audio.crowdCheer();
      PH.Audio.radioChatter();
    }
    // rivals: drive toward their next gate, ease off on sharp turns
    this.rivals.forEach(function (r) {
      var target = PH.RACE_LOOP[r.gate % PH.RACE_LOOP.length];
      var dx = target.x - r.pos.x, dz = target.z - r.pos.z;
      var d = Math.hypot(dx, dz);
      if (d < 7) { r.gate++; target = PH.RACE_LOOP[r.gate % PH.RACE_LOOP.length]; dx = target.x - r.pos.x; dz = target.z - r.pos.z; d = Math.hypot(dx, dz); }
      var want = Math.atan2(dx, dz);
      var cur = r.mesh.rotation.y;
      var diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var turn = PH.clamp(diff, -1.8 * dt, 1.8 * dt);
      r.mesh.rotation.y = cur + turn;
      var cornerSlow = 1 - Math.min(0.45, Math.abs(diff) * 0.4);
      var sp = r.speed * cornerSlow;
      r.pos.x += Math.sin(r.mesh.rotation.y) * sp * dt;
      r.pos.z += Math.cos(r.mesh.rotation.y) * sp * dt;
      r.mesh.position.copy(r.pos);
    });
    this.computePosition(playerPos || { x: -20, z: 8 });
  };
  // Frozen hero arrangement for shot 1: the next gate arches over the
  // road ahead of the hero, and ALL THREE rivals run big and close —
  // one in the right lane just ahead of the hero's nose, one in the
  // left lane alongside, the green coupe ahead in the middle — so the
  // race reads at a glance instead of hiding behind the gate. Round 2:
  // the gate sits further ahead (z -24, not -18) and its banner text
  // fits the board, so "CHECKPOINT 3/14" reads whole.
  PH.Race.prototype.stageShot = function () {
    this.showGates(true);
    var gate = this.gates[2];
    gate.position.set(-20, 0, -24);
    gate.rotation.y = 0;
    gate.visible = true;
    this.gates.forEach(function (g, i) { if (i !== 2) g.visible = false; });
    PH.makeRaceGate.setLights(gate, 2);
    var rival = this.rivals[0];
    rival.mesh.position.set(-16.5, 0, 0);
    rival.mesh.rotation.y = Math.PI;
    rival.pos.copy(rival.mesh.position);
    rival.gate = 2;
    var rival2 = this.rivals[1];
    rival2.mesh.position.set(-23.5, 0, -2);
    rival2.mesh.rotation.y = Math.PI;
    rival2.pos.copy(rival2.mesh.position);
    rival2.gate = 2;
    // round 2: the green coupe runs ahead in the middle lane, between
    // the hero and the gate — three cars deep in the frame
    var rival3 = this.rivals[2];
    rival3.mesh.position.set(-20, 0, -10);
    rival3.mesh.rotation.y = Math.PI;
    rival3.pos.copy(rival3.mesh.position);
    rival3.gate = 3;
    // v7.4 rev 2: the red pickup runs further ahead (z -2, not +3) so
    // the hero no longer hides it — both rivals stay readable
    this.playerGate = 2;
    this.lap = 1;
    this.racing = true;
    this.countdown = -1;
    this.position = 2;
    this.gap = 0.4;
  };
})();
