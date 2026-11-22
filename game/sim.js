// PIER HEAT — Sunset Bay v8.0: simulation. Traffic cars on road waypoints (checking colliders
// and each other before every move), light pedestrians (7 meshes, sliding + bob, distance-tiered
// pose updates), and police with real patrol / investigate / pursuit / intercept states.
// Vehicle factory builds forward = +Z with a permanent inner visual group, so the visible body
// always lines up with +Z.
(function () {
  'use strict';
  var PH = window.PH;

  var CAR_COLORS = [0x3a6fd8, 0xd8d8d8, 0x222222, 0xc0392b, 0x2e8b57, 0xe8c832, 0x8a6fd8, 0x6a7a8a];

  PH.sim = {
    cars: [],        // traffic cars
    peds: [],        // pedestrians
    policeCars: [],
    policeHeliOn: false,

    // ---------- vehicle factory: forward is +Z, body inside a permanent visual pivot ----------
    buildCar: function (opts) {
      opts = opts || {};
      var color = opts.color !== undefined ? opts.color : 0x888888;
      var group = new THREE.Group();
      var vis = new THREE.Group(); // permanent visual pivot: body built to face +Z
      group.add(vis);
      var paint = new THREE.MeshStandardMaterial({ color: color, roughness: 0.35, metalness: 0.55 });
      var glass = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.12, metalness: 0.8 });
      var dark = PH.stdMat(0x181818, 0.7, 0.3);
      var body = new THREE.Mesh(PH.boxGeo(1.9, 0.62, 4.4), paint);
      body.position.y = 0.62; body.castShadow = true; vis.add(body);
      var cabin = new THREE.Mesh(PH.boxGeo(1.7, 0.55, 2.1), glass);
      cabin.position.set(0, 1.18, -0.25); cabin.castShadow = true; vis.add(cabin);
      var hood = new THREE.Mesh(PH.boxGeo(1.86, 0.16, 1.1), paint);
      hood.position.set(0, 0.95, 1.7); vis.add(hood);
      var bumperF = new THREE.Mesh(PH.boxGeo(1.92, 0.28, 0.3), dark);
      bumperF.position.set(0, 0.42, 2.2); vis.add(bumperF);
      var bumperR = bumperF.clone(); bumperR.position.z = -2.2; vis.add(bumperR);
      var hlMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
      var hlL = new THREE.Mesh(PH.boxGeo(0.34, 0.16, 0.08), hlMat);
      hlL.position.set(-0.62, 0.72, 2.24); vis.add(hlL);
      var hlR = hlL.clone(); hlR.position.x = 0.62; vis.add(hlR);
      var tlMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff2020, emissiveIntensity: 0.7 });
      var tlL = new THREE.Mesh(PH.boxGeo(0.34, 0.16, 0.08), tlMat);
      tlL.position.set(-0.62, 0.72, -2.24); vis.add(tlL);
      var tlR = tlL.clone(); tlR.position.x = 0.62; vis.add(tlR);
      var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
      wheelGeo.rotateZ(Math.PI / 2);
      var wheelMat = PH.stdMat(0x111111, 0.9, 0.1);
      var hubMat = PH.stdMat(0xbbbbbb, 0.35, 0.8);
      var wheels = [];
      var wp = [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]];
      for (var i = 0; i < 4; i++) {
        var w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wp[i][0], 0.36, wp[i][1]);
        vis.add(w); wheels.push(w);
        var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 8), hubMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.copy(w.position); vis.add(hub);
      }
      if (opts.police) {
        var stripe = new THREE.Mesh(PH.boxGeo(1.94, 0.2, 4.42),
          new THREE.MeshStandardMaterial({ color: 0x1a4fd8, roughness: 0.4, metalness: 0.3 }));
        stripe.position.y = 0.62; vis.add(stripe);
        var bar = new THREE.Mesh(PH.boxGeo(0.9, 0.16, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.6 }));
        bar.position.set(0, 1.52, -0.25); vis.add(bar);
        var bar2 = new THREE.Mesh(PH.boxGeo(0.9, 0.16, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1.6 }));
        bar2.position.set(0, 1.52, -0.25); bar2.position.x = 0; vis.add(bar2);
        group.userData.lightBar = [bar, bar2];
        var star = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
          new THREE.MeshBasicMaterial({ map: PH.labelTexture('PD', { bg: '#ffffff', fg: '#1a4fd8', size: 90, w: 128, h: 128 }) }));
        star.position.set(0, 0.95, 0.62); star.rotation.x = -Math.PI / 2; vis.add(star);
      }
      group.userData.vis = vis;
      group.userData.wheels = wheels;
      group.userData.paint = paint;
      return group;
    },

    // ---------- person factory: 7 meshes, simple face painted on the head texture ----------
    buildPerson: function (opts) {
      opts = opts || {};
      var skin = opts.skin !== undefined ? opts.skin : 0xc98a5a;
      var shirt = opts.shirt !== undefined ? opts.shirt : 0x3a6fd8;
      var pants = opts.pants !== undefined ? opts.pants : 0x2a2a33;
      var hairC = opts.hair !== undefined ? opts.hair : 0x1a1210;
      var group = new THREE.Group();
      var torso = PH.box(0.52, 0.62, 0.3, shirt, 0.85, 0);
      torso.position.y = 1.12; group.add(torso);
      var legL = PH.box(0.2, 0.72, 0.22, pants, 0.9, 0);
      legL.position.set(-0.14, 0.36, 0); group.add(legL);
      var legR = legL.clone(); legR.position.x = 0.14; group.add(legR);
      var armL = PH.box(0.15, 0.58, 0.16, shirt, 0.85, 0);
      armL.position.set(-0.34, 1.12, 0); group.add(armL);
      var armR = armL.clone(); armR.position.x = 0.34; group.add(armR);
      var faceTex = PH.makeCanvas(64, 64, function (g) {
        g.fillStyle = '#' + ('000000' + skin.toString(16)).slice(-6); g.fillRect(0, 0, 64, 64);
        g.fillStyle = '#1a1210';
        g.fillRect(16, 26, 7, 8); g.fillRect(41, 26, 7, 8); // eyes
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(30, 34, 4, 8); // nose shade
        g.fillStyle = '#8a3a3a'; g.fillRect(24, 48, 16, 3); // mouth
      });
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10),
        new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }));
      head.position.y = 1.62; group.add(head);
      var hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        PH.stdMat(hairC, 0.9, 0));
      hair.position.y = 1.66; group.add(hair);
      if (opts.hat) {
        var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.12, 10), PH.stdMat(opts.hat, 0.8, 0));
        hat.position.y = 1.82; group.add(hat);
      }
      group.userData.parts = { legL: legL, legR: legR, armL: armL, armR: armR, head: head, torso: torso };
      group.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      return group;
    },

    // ---------- traffic: waypoint loops around the blocks ----------
    _loops: [
      // loop A: Sunset Blvd east-west + cross streets
      [[-130, 0], [-60, 0], [0, 0], [60, 0], [130, 0], [140, 40], [140, 70], [90, 70], [40, 70], [-10, 70], [-60, 70], [-110, 70], [-110, 35], [-110, 0]],
      // loop B: northern residential circuit
      [[-130, -35], [-60, -35], [-10, -35], [40, -35], [90, -35], [140, -35], [140, -70], [90, -70], [40, -70], [-10, -70], [-60, -70], [-110, -70], [-130, -70]],
      // loop C: southern circuit via beach road
      [[-130, 100], [-60, 100], [0, 100], [60, 100], [130, 100], [140, 70], [140, 35], [90, 35], [40, 35], [-10, 35], [-60, 35], [-110, 35], [-130, 35], [-130, 70]]
    ],
    initTraffic: function () {
      var i, c;
      for (i = 0; i < 12; i++) {
        var loop = this._loops[i % 3];
        var start = Math.floor(Math.random() * loop.length);
        var g = this.buildCar({ color: CAR_COLORS[i % CAR_COLORS.length] });
        var wp = loop[start];
        g.position.set(wp[0], 0, wp[1]);
        PH.scene.add(g);
        c = {
          group: g, loop: loop, wp: (start + 1) % loop.length,
          speed: PH.rand(7, 12), maxSpeed: PH.rand(10, 14), heading: 0,
          x: wp[0], z: wp[1], stopped: 0, isTraffic: true
        };
        g.position.x = c.x; g.position.z = c.z;
        this.cars.push(c);
      }
    },

    // ---------- pedestrians: sidewalk strollers ----------
    initPeds: function () {
      var shirts = [0xd84a4a, 0x3a6fd8, 0x2e8b57, 0xe8c832, 0x8a6fd8, 0xff8a3a, 0xeeeeee, 0x4a4a4a];
      var skins = [0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x6a4028, 0xd8a070];
      var spots = [];
      var i;
      for (i = 0; i < 18; i++) spots.push([PH.rand(-130, 130), (i % 2 === 0 ? -9.6 : 9.6)]);
      for (i = 0; i < 10; i++) spots.push([PH.rand(-130, 130), (i % 2 === 0 ? 97.5 : 102.5)]);
      for (i = 0; i < 8; i++) spots.push([PH.rand(-130, 130), (i % 2 === 0 ? 106.5 : 122)]);
      for (i = 0; i < spots.length; i++) {
        var g = this.buildPerson({
          shirt: shirts[i % shirts.length], skin: skins[i % skins.length],
          pants: PH.pick([0x2a2a33, 0x4a3a2a, 0x333a4a, 0x6a6a6a]),
          hair: PH.pick([0x1a1210, 0x3a2a1a, 0x888888, 0xd8b060]),
          hat: Math.random() < 0.25 ? PH.pick([0xd84a4a, 0x2e8b57, 0xe8c832]) : 0
        });
        var p = {
          group: g, x: spots[i][0], z: spots[i][1],
          heading: Math.random() * Math.PI * 2, speed: PH.rand(0.8, 1.6),
          phase: Math.random() * Math.PI * 2, dir: Math.random() < 0.5 ? 1 : -1,
          axis: Math.abs(spots[i][1]) > 50 ? 'x' : 'x',
          home: spots[i][1], range: PH.rand(8, 25), t: 0,
          health: 100, fleeing: 0
        };
        g.position.set(p.x, PH.world.groundHeight(p.x, p.z), p.z);
        PH.scene.add(g);
        this.peds.push(p);
      }
    },

    // ---------- police ----------
    CALLSIGNS: ['HARBOR-7', 'PALM-12', 'DUNE-21', 'BRIDGE-3', 'SURF-9', 'PIER-5'],
    spawnPoliceCar: function (i) {
      var g = this.buildCar({ color: 0xf0f0f0, police: true });
      var a = Math.random() * Math.PI * 2;
      var px = PH.clamp((PH.game ? PH.game.player.x : 0) + Math.cos(a) * 45, -140, 140);
      var pz = PH.clamp((PH.game ? PH.game.player.z : 0) + Math.sin(a) * 45, -85, 95);
      if (PH.pointBlocked(px, pz, 2)) { px = -60; pz = 0; }
      g.position.set(px, 0, pz);
      PH.scene.add(g);
      var c = {
        group: g, x: px, z: pz, heading: 0, speed: 0,
        callsign: this.CALLSIGNS[i % this.CALLSIGNS.length],
        state: 'patrol', wp: 0, loop: this._loops[i % 3],
        maxSpeed: 24, ramCooldown: 0, isPolice: true, hp: 100
      };
      // register as a shootable target (bounded list, never the whole scene)
      g.userData.shootable = { kind: 'police', ref: c };
      if (PH.game && PH.game.shootables) PH.game.shootables.push(g);
      this.policeCars.push(c);
      return c;
    },
    policeCountForWanted: function (wanted) {
      if (wanted <= 0) return 0;
      if (wanted === 1) return 1;
      if (wanted === 2) return 2;
      if (wanted === 3) return 3;
      return 4;
    },

    // ---------- per-frame updates ----------
    _carAheadBlocked: function (c, look) {
      var ax = c.x + Math.sin(c.heading) * look, az = c.z + Math.cos(c.heading) * look;
      if (PH.pointBlocked(ax, az, 0.6)) return true;
      var i, o, d;
      var list = this.cars.concat(this.policeCars);
      for (i = 0; i < list.length; i++) {
        o = list[i];
        if (o === c) continue;
        d = PH.dist2d(ax, az, o.x, o.z);
        if (d < 4.5) return true;
      }
      if (PH.game && PH.game.car) {
        d = PH.dist2d(ax, az, PH.game.car.x, PH.game.car.z);
        if (d < 4.5) return true;
      }
      return false;
    },
    _steerToward: function (c, tx, tz, dt, maxTurn) {
      var want = Math.atan2(tx - c.x, tz - c.z);
      var diff = PH.angleWrap(want - c.heading);
      var turn = PH.clamp(diff, -maxTurn * dt, maxTurn * dt);
      c.heading += turn;
      return diff;
    },
    updateTraffic: function (dt) {
      var i, c, wp, dx, dz, d;
      for (i = 0; i < this.cars.length; i++) {
        c = this.cars[i];
        wp = c.loop[c.wp];
        dx = wp[0] - c.x; dz = wp[1] - c.z; d = Math.sqrt(dx * dx + dz * dz);
        if (d < 3) { c.wp = (c.wp + 1) % c.loop.length; continue; }
        if (this._carAheadBlocked(c, 7)) {
          c.speed = Math.max(0, c.speed - 14 * dt);
          c.stoppedT = (c.stoppedT || 0) + dt;
          // unstick: if blocked for 5 s, skip to the next waypoint instead of jamming
          if (c.stoppedT > 5) { c.wp = (c.wp + 1) % c.loop.length; c.stoppedT = 0; }
        } else { c.speed = Math.min(c.maxSpeed, c.speed + 5 * dt); c.stoppedT = 0; }
        this._steerToward(c, wp[0], wp[1], dt, 1.6);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        var col = PH.collideCarCircle(c.x, c.z, 1.7);
        c.x = col.x; c.z = col.z;
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.heading;
        var spin = c.speed * dt * 2.4;
        var wheels = c.group.userData.wheels;
        for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += spin;
      }
    },
    updatePeds: function (dt, playerPos) {
      var i, p, d;
      for (i = 0; i < this.peds.length; i++) {
        p = this.peds[i];
        d = playerPos ? PH.dist2d(p.x, p.z, playerPos.x, playerPos.z) : 999;
        // distance tiers: full pose < 30 m, half-rate 30-80 m, frozen beyond 80 m
        if (d > 80) continue;
        if (d > 30 && (i + Math.floor(performance.now() / 100)) % 2 === 0) continue;
        if (p.fleeing > 0) {
          p.fleeing -= dt;
          var fx = p.x - playerPos.x, fz = p.z - playerPos.z;
          var fl = Math.sqrt(fx * fx + fz * fz) || 1;
          p.x += (fx / fl) * 4.5 * dt; p.z += (fz / fl) * 4.5 * dt;
          p.heading = Math.atan2(fx, fz);
        } else {
          p.t += dt;
          p.x += Math.sin(p.heading) * p.speed * p.dir * dt;
          p.z += Math.cos(p.heading) * p.speed * p.dir * dt;
          if (Math.abs(p.x) > 140 || PH.pointBlocked(p.x + Math.sin(p.heading) * 1.2, p.z + Math.cos(p.heading) * 1.2, 0.4)) {
            p.dir *= -1; p.heading += Math.PI;
          }
          // beach strollers wander along the sand
          if (p.z > 104) p.z = PH.clamp(p.z, 106, 123);
        }
        var col = PH.collideCircle(p.x, p.z, 0.45);
        p.x = col.x; p.z = col.z;
        p.group.position.set(p.x, PH.world.groundHeight(p.x, p.z), p.z);
        p.group.rotation.y = p.heading;
        // sliding + small vertical bob only; no limb animation for the crowd
        p.group.position.y += Math.abs(Math.sin(p.t * 6)) * 0.05;
      }
    },
    updatePolice: function (dt, player, wanted) {
      var want = this.policeCountForWanted(wanted);
      var i, c;
      while (this.policeCars.length < want) this.spawnPoliceCar(this.policeCars.length);
      while (this.policeCars.length > want) {
        var gone = this.policeCars.pop();
        PH.scene.remove(gone.group);
      }
      var inCar = player.mode === 'driving';
      var px = player.x, pz = player.z;
      for (i = 0; i < this.policeCars.length; i++) {
        c = this.policeCars[i];
        c.ramCooldown = Math.max(0, c.ramCooldown - dt);
        if (wanted > 0) {
          c.state = wanted >= 3 ? 'intercept' : 'pursuit';
          var dist = PH.dist2d(c.x, c.z, px, pz);
          var targetSpeed = wanted >= 3 ? 26 : 22;
          if (dist > 6) {
            // lead the target slightly when it is moving fast
            var lx = px, lz = pz;
            if (inCar && player.carSpeed > 8) {
              lx = px + Math.sin(player.heading) * player.carSpeed * 0.4;
              lz = pz + Math.cos(player.heading) * player.carSpeed * 0.4;
            }
            this._steerToward(c, lx, lz, dt, 2.4);
            if (!this._carAheadBlocked(c, 6)) c.speed = Math.min(targetSpeed, c.speed + 9 * dt);
            else c.speed = Math.max(0, c.speed - 10 * dt);
          } else {
            c.speed = Math.max(0, c.speed - 12 * dt);
            if (c.ramCooldown <= 0 && dist < 4.5) {
              c.ramCooldown = 1.2;
              PH.events.emit('police-ram', { car: c, dist: dist });
            }
          }
        } else {
          c.state = 'patrol';
          var wp = c.loop[c.wp];
          var dx = wp[0] - c.x, dz = wp[1] - c.z;
          if (Math.sqrt(dx * dx + dz * dz) < 3) { c.wp = (c.wp + 1) % c.loop.length; }
          else {
            this._steerToward(c, wp[0], wp[1], dt, 1.6);
            c.speed = Math.min(11, c.speed + 4 * dt);
          }
        }
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        c.x = PH.clamp(c.x, -250, 250);
        c.z = PH.clamp(c.z, -200, 210);
        var col = PH.collideCarCircle(c.x, c.z, 1.7);
        c.x = col.x; c.z = col.z;
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = c.heading;
        // flashing light bar
        if (c.group.userData.lightBar) {
          var on = Math.floor(performance.now() / 280) % 2 === 0;
          c.group.userData.lightBar[0].material.emissiveIntensity = on ? 2.2 : 0.15;
          c.group.userData.lightBar[1].material.emissiveIntensity = on ? 0.15 : 2.2;
        }
        var wheels = c.group.userData.wheels;
        for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += c.speed * dt * 2.4;
      }
    }
  };
})();
