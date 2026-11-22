// PIER HEAT — Sunset Bay v8.0: the street race. Countdown, a chain of checkpoint gates down
// Sunset Boulevard, rival cars on a racing line with rubber-banding (they catch up when behind,
// ease off when far ahead), laps, live position and gap to the car ahead, and an explicit
// race-complete event with a reward.
(function () {
  'use strict';
  var PH = window.PH;

  PH.race = {
    state: 'idle', // idle | countdown | racing | done
    gates: [],
    gateMeshes: [],
    rivals: [],
    currentGate: 0,
    lap: 1,
    laps: 1,
    raceTime: 0,
    countdownT: 0,
    progress: 0, // player progress along the course, for position math
    reward: 1500,
    startedAt: 0,

    gatePositions: [
      { x: -120, z: 0 }, { x: -60, z: 0 }, { x: 0, z: 0 },
      { x: 60, z: 0 }, { x: 120, z: 0 }
    ],

    buildGates: function () {
      var i, g;
      for (i = 0; i < this.gatePositions.length; i++) {
        g = this.gatePositions[i];
        var mesh = new THREE.Group();
        var postMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a00, emissiveIntensity: 0.9 });
        var pL = new THREE.Mesh(PH.boxGeo(0.5, 7, 0.5), postMat);
        pL.position.set(-6.5, 3.5, 0); mesh.add(pL);
        var pR = pL.clone(); pR.position.x = 6.5; mesh.add(pR);
        var banner = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 1.4),
          new THREE.MeshBasicMaterial({ map: PH.labelTexture('GATE ' + (i + 1), { bg: '#1d1a24', fg: '#ffb347', size: 60 }), side: THREE.DoubleSide }));
        banner.position.set(0, 6.4, 0); mesh.add(banner);
        mesh.position.set(g.x, 0, g.z);
        mesh.visible = false;
        PH.scene.add(mesh);
        this.gateMeshes.push(mesh);
        this.gates.push({ x: g.x, z: g.z, passed: false });
      }
    },

    start: function () {
      var i;
      this.state = 'countdown';
      this.countdownT = 3.2;
      this.currentGate = 0;
      this.lap = 1;
      this.raceTime = 0;
      this.progress = 0;
      for (i = 0; i < this.gates.length; i++) {
        this.gates[i].passed = false;
        this.gateMeshes[i].visible = true;
        this.gateMeshes[i].children[0].material.emissiveIntensity = 0.9;
      }
      // rivals line up on the boulevard beside the player
      this._spawnRivals();
      PH.events.emit('race-start', {});
    },

    _spawnRivals: function () {
      var names = ['RICO', 'SABLE', 'VOLT'];
      var colors = [0x9a2a8a, 0x2a8a5a, 0x2a5a8a];
      var i, c;
      // clear any previous rivals first
      for (i = 0; i < this.rivals.length; i++) {
        if (this.rivals[i] && this.rivals[i].group) PH.scene.remove(this.rivals[i].group);
      }
      this.rivals = [];
      for (i = 0; i < 3; i++) {
        var g = PH.sim.buildCar({ color: colors[i] });
        var rx = -100 + i * 6, rz = (i - 1) * 3.5;
        g.position.set(rx, 0, rz);
        PH.scene.add(g);
        c = {
          group: g, name: names[i], x: rx, z: rz, heading: Math.PI / 2,
          speed: 0, baseSpeed: 19 + i * 1.5, progress: 0, gate: 0,
          line: this._racingLine()
        };
        this.rivals.push(c);
      }
    },
    _racingLine: function () {
      // racing line down Sunset Blvd with a gentle weave
      var pts = [], x;
      for (x = -130; x <= 135; x += 10) pts.push({ x: x, z: Math.sin(x * 0.06) * 2.5 });
      return pts;
    },

    _playerProgress: function (player) {
      // progress = gates passed * 1000 + distance along the boulevard
      return this.currentGate * 1000 + (player.x + 130);
    },

    position: function (player) {
      // rank the player against rivals by progress
      var entries = [{ name: 'YOU', progress: this._playerProgress(player), isPlayer: true }];
      var i;
      for (i = 0; i < this.rivals.length; i++) entries.push({ name: this.rivals[i].name, progress: this.rivals[i].progress });
      entries.sort(function (a, b) { return b.progress - a.progress; });
      var pos = 1, gap = 0;
      for (i = 0; i < entries.length; i++) {
        if (entries[i].isPlayer) {
          pos = i + 1;
          if (i > 0) gap = (entries[i - 1].progress - entries[i].progress) / 10;
        }
      }
      var ord = ['1st', '2nd', '3rd', '4th'];
      return { pos: pos, label: ord[pos - 1] + ' of 4', gap: gap };
    },

    update: function (dt, player) {
      var i, r;
      if (this.state === 'countdown') {
        this.countdownT -= dt;
        var n = Math.ceil(this.countdownT);
        if (this.countdownT <= 0) {
          this.state = 'racing';
          this.startedAt = performance.now();
          PH.hud.text('countdown', 'GO!');
          setTimeout(function () { PH.hud.show('countdown', false); }, 600);
          PH.events.emit('race-go', {});
        } else {
          PH.hud.text('countdown', String(n));
          PH.hud.show('countdown', true);
        }
        return;
      }
      if (this.state !== 'racing') return;
      this.raceTime += dt;
      // gate check: player within 8 units of the current gate
      var g = this.gates[this.currentGate];
      if (g && PH.dist2d(player.x, player.z, g.x, g.z) < 9) {
        g.passed = true;
        this.gateMeshes[this.currentGate].children[0].material.emissiveIntensity = 0.15;
        PH.hud.toast('GATE ' + (this.currentGate + 1) + ' / ' + this.gates.length);
        PH.audio.blip();
        this.currentGate++;
        if (this.currentGate >= this.gates.length) { this.complete(player); return; }
      }
      // rivals follow the racing line, rubber-banding to the player
      var pp = this._playerProgress(player);
      for (i = 0; i < this.rivals.length; i++) {
        r = this.rivals[i];
        var behind = pp - r.progress;
        var target = r.baseSpeed + PH.clamp(behind * 0.06, -2.5, 4.5); // catch up when behind
        r.speed = PH.lerp(r.speed, target, dt * 0.8);
        // follow the line: steer toward the next line point ahead
        var lx = r.x + 14;
        var targetZ = Math.sin(lx * 0.06) * 2.5;
        var want = Math.atan2(lx - r.x, targetZ - r.z);
        r.heading = PH.angleLerp(r.heading, want, dt * 1.8);
        r.x += Math.sin(r.heading) * r.speed * dt;
        r.z += Math.cos(r.heading) * r.speed * dt;
        r.progress = r.gate * 1000 + (r.x + 130);
        var col = PH.collideCarCircle(r.x, r.z, 1.7);
        r.x = col.x; r.z = col.z;
        r.group.position.set(r.x, 0, r.z);
        r.group.rotation.y = r.heading;
        var wheels = r.group.userData.wheels;
        for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += r.speed * dt * 2.4;
      }
      // HUD
      var pos = this.position(player);
      PH.hud.show('race-panel', true);
      PH.hud.text('race-position', pos.label);
      PH.hud.text('race-gap', pos.pos === 1 ? 'LEADING THE PACK' : 'GAP +' + pos.gap.toFixed(1) + 's');
      PH.hud.text('race-lap', 'LAP ' + this.lap + '/' + this.laps);
      PH.hud.text('race-time', PH.fmtRaceTime(this.raceTime));
    },

    complete: function (player) {
      this.state = 'done';
      var i;
      for (i = 0; i < this.gateMeshes.length; i++) this.gateMeshes[i].visible = false;
      PH.hud.show('race-panel', false);
      PH.hud.show('countdown', false);
      var pos = this.position(player);
      PH.events.emit('race-complete', { position: pos.pos, time: this.raceTime, reward: this.reward });
    },

    reset: function () {
      this.state = 'idle';
      var i;
      for (i = 0; i < this.gateMeshes.length; i++) this.gateMeshes[i].visible = false;
      PH.hud.show('race-panel', false);
    }
  };
})();
