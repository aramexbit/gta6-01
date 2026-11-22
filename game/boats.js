// PIER HEAT — Sunset Bay v8.0: boats. The hero speedboat (white hull, teal stripe, dark
// interior so the orange-jacketed driver stands out), police boats, a planing-hull V-wake that
// narrows at speed plus bow spray, boat driving, police boat chase, explicit completion.
// Also the beach victim: a figure lying on the sand near a sandcastle with a dark red pool.
(function () {
  'use strict';
  var PH = window.PH;

  PH.boats = {
    hero: null,
    policeBoats: [],
    wakeParts: [],

    buildSpeedboat: function (police) {
      var group = new THREE.Group();
      var vis = new THREE.Group();
      group.add(vis);
      var hullMat = new THREE.MeshStandardMaterial({ color: police ? 0xe8e8e8 : 0xf5f5f0, roughness: 0.3, metalness: 0.25 });
      var stripeMat = new THREE.MeshStandardMaterial({ color: police ? 0x1a4fd8 : 0x1a8a7a, roughness: 0.4, metalness: 0.3 });
      // hull: tapered box, bow forward (+Z)
      var hull = new THREE.Mesh(PH.boxGeo(2.2, 0.7, 6.4), hullMat);
      hull.position.y = 0.45; hull.castShadow = true; vis.add(hull);
      var bow = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 4), hullMat);
      bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.45, 4.0); bow.scale.set(1, 1, 0.7); vis.add(bow);
      // teal stripe along the hull
      var stripe = new THREE.Mesh(PH.boxGeo(2.24, 0.22, 6.0), stripeMat);
      stripe.position.y = 0.62; vis.add(stripe);
      // dark interior so the orange driver stands out
      var interior = new THREE.Mesh(PH.boxGeo(1.8, 0.25, 4.6), PH.stdMat(0x14161c, 0.9, 0));
      interior.position.set(0, 0.82, -0.4); vis.add(interior);
      // windshield
      var shield = new THREE.Mesh(PH.boxGeo(1.7, 0.5, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.1, metalness: 0.8 }));
      shield.position.set(0, 1.15, 1.2); shield.rotation.x = -0.25; vis.add(shield);
      // seats
      var seatMat = PH.stdMat(0x2a2f3a, 0.85, 0);
      var seat1 = new THREE.Mesh(PH.boxGeo(0.7, 0.5, 0.6), seatMat);
      seat1.position.set(-0.45, 1.0, 0.2); vis.add(seat1);
      var seat2 = seat1.clone(); seat2.position.x = 0.45; vis.add(seat2);
      var bench = new THREE.Mesh(PH.boxGeo(1.6, 0.45, 0.7), seatMat);
      bench.position.set(0, 1.0, -1.6); vis.add(bench);
      // outboard motor
      var motor = new THREE.Mesh(PH.boxGeo(0.5, 0.9, 0.4), PH.stdMat(0x222222, 0.6, 0.4));
      motor.position.set(0, 0.6, -3.4); vis.add(motor);
      if (police) {
        var bar = new THREE.Mesh(PH.boxGeo(0.8, 0.14, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.8 }));
        bar.position.set(0, 1.6, 0.6); vis.add(bar);
        var sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4),
          new THREE.MeshBasicMaterial({ map: PH.labelTexture('POLICE', { bg: '#1a4fd8', fg: '#ffffff', size: 56, w: 256, h: 64 }) }));
        sign.position.set(0, 0.85, 1.2); sign.rotation.x = -0.15; vis.add(sign);
      }
      group.userData.vis = vis;
      return group;
    },

    init: function () {
      var s = PH.world.spawns.boat;
      this.hero = this.buildSpeedboat(false);
      this.hero.position.set(s.x, 0.05, s.z);
      this.hero.rotation.y = 0; // bow (+Z) pointing out to sea, south
      PH.scene.add(this.hero);
      // wake: pool of fading foam quads trailing the hull
      for (var i = 0; i < 26; i++) {
        var w = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        w.rotation.x = -Math.PI / 2; w.position.y = 0.08;
        w.visible = false;
        PH.scene.add(w);
        this.wakeParts.push({ mesh: w, life: 0, x: 0, z: 0, size: 1 });
      }
      // beach victim: a figure lying on the sand near a sandcastle, dark red pool beside it
      var vx = 34, vz = 114;
      var victim = PH.sim.buildPerson({ shirt: 0xd8d8d8, skin: 0xc98a5a, pants: 0x4a6a8a, hair: 0x3a2a1a });
      victim.position.set(vx, 0.05, vz);
      victim.rotation.set(-Math.PI / 2 + 0.08, 0, 0.4); // lying flat
      victim.scale.y = 0.55;
      PH.scene.add(victim);
      var pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 18),
        new THREE.MeshStandardMaterial({ color: 0x4a0606, roughness: 0.25, metalness: 0.1 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(vx + 1.6, 0.06, vz + 0.4);
      PH.scene.add(pool);
      var pool2 = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a0606, roughness: 0.25 }));
      pool2.rotation.x = -Math.PI / 2; pool2.position.set(vx + 0.4, 0.06, vz + 1.3);
      PH.scene.add(pool2);
      // sandcastle
      var castle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.9, 8), PH.stdMat(0xd9b380, 1, 0));
      castle.position.set(vx - 2.2, 0.45, vz - 1.2); castle.castShadow = true; PH.scene.add(castle);
      var flag = new THREE.Mesh(PH.boxGeo(0.5, 0.3, 0.02), PH.stdMat(0xc0392b, 0.8, 0));
      flag.position.set(vx - 2.0, 1.05, vz - 1.2); PH.scene.add(flag);
      var flagPole = new THREE.Mesh(PH.cylGeo(0.02, 0.02, 0.5, 4), PH.stdMat(0x888888, 0.6, 0.4));
      flagPole.position.set(vx - 2.2, 1.1, vz - 1.2); PH.scene.add(flagPole);
    },

    spawnPoliceBoat: function () {
      var g = this.buildSpeedboat(true);
      var b = { group: g, x: 40, z: 210, heading: 0, speed: 0, callsign: 'MARINE-4' };
      g.position.set(b.x, 0.05, b.z);
      PH.scene.add(g);
      this.policeBoats.push(b);
      return b;
    },

    // V-wake: two trailing foam arms that narrow as speed rises + bow spray
    updateWake: function (boat, dt, now) {
      var speed = boat.speed || 0;
      if (speed < 2) return;
      var bx = boat.x - Math.sin(boat.heading) * 3.2;
      var bz = boat.z - Math.cos(boat.heading) * 3.2;
      var spread = PH.clamp(3.2 - speed * 0.08, 0.9, 3.2); // narrows at speed
      var n = 0;
      for (var i = 0; i < this.wakeParts.length; i++) {
        var p = this.wakeParts[i];
        if (p.life <= 0 && n < 2) {
          n++;
          var side = n === 1 ? -1 : 1;
          var px = bx + Math.cos(boat.heading) * spread * side;
          var pz = bz - Math.sin(boat.heading) * spread * side;
          p.life = 1; p.x = px; p.z = pz; p.size = 0.6 + Math.random() * 0.5;
          p.mesh.visible = true;
        }
      }
      for (i = 0; i < this.wakeParts.length; i++) {
        p = this.wakeParts[i];
        if (p.life <= 0) continue;
        p.life -= dt * 0.55;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.size += dt * 1.0;
        p.mesh.position.set(p.x, 0.08, p.z);
        p.mesh.scale.set(p.size, p.size * 1.6, 1);
        p.mesh.material.opacity = p.life * 0.35;
        p.mesh.rotation.z = boat.heading + (p.x > bx ? 0.35 : -0.35);
      }
    },

    update: function (dt, now, playerBoat) {
      // police boat chase: steer toward the player's boat, faster than the hero at low speed
      var i, b;
      for (i = 0; i < this.policeBoats.length; i++) {
        b = this.policeBoats[i];
        if (!playerBoat) continue;
        var want = Math.atan2(playerBoat.x - b.x, playerBoat.z - b.z);
        var diff = PH.angleWrap(want - b.heading);
        b.heading += PH.clamp(diff, -1.8 * dt, 1.8 * dt);
        b.speed = Math.min(19, b.speed + 6 * dt);
        b.x += Math.sin(b.heading) * b.speed * dt;
        b.z += Math.cos(b.heading) * b.speed * dt;
        b.z = PH.clamp(b.z, 128, 260);
        b.x = PH.clamp(b.x, -220, 220);
        b.group.position.set(b.x, 0.05 + Math.sin(now * 2 + i) * 0.08, b.z);
        b.group.rotation.y = b.heading;
        b.group.rotation.z = PH.clamp(-diff * 0.2, -0.12, 0.12);
        this.updateWake(b, dt, now);
      }
      if (playerBoat) this.updateWake(playerBoat, dt, now);
    }
  };
})();
