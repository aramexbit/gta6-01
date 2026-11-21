// PIER HEAT — Sunset Bay v7.4
// boats.js — boat chase on the water: a player speedboat, police boats
// that hunt it, a fading foam wake behind every boat, and a heli over
// the sea. Waves are a few summed sines; the same height function is
// sampled on the CPU for buoyancy (bow / stern / port / starboard),
// so each hull pitches and rolls with the swell it sits on.
// v7.4: the hero boat carries a helm wheel at the driver's stand, and
// stageShot puts Mateo ON the boat — the boat job is played on the
// water now, not talked about from the pier.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // --- wave height: three travelling sines, shared by boats + sea ---
  PH.waveHeight = function (x, z, t) {
    return Math.sin(x * 0.08 + t * 0.9) * 0.22
      + Math.sin(z * 0.11 - t * 0.7) * 0.16
      + Math.sin((x + z) * 0.05 + t * 0.5) * 0.12;
  };

  function std(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough == null ? 0.7 : rough, metalness: metal || 0
    });
  }

  // Speedboat hull: a tapered wedge (extruded side profile) + deck,
  // windshield, bench seats and an outboard motor on the transom.
  PH.makeBoat = function (opts) {
    opts = opts || {};
    var hullColor = opts.hull != null ? opts.hull : 0xff7a1a;
    var police = !!opts.police;
    if (police) hullColor = 0xf2f2f2;
    var g = new THREE.Group();

    var shape = new THREE.Shape();
    shape.moveTo(-2.6, 0.1); shape.lineTo(2.4, 0.1); shape.lineTo(2.9, 0.55);
    shape.lineTo(2.2, 0.95); shape.lineTo(-2.2, 0.95); shape.lineTo(-2.6, 0.1);
    var hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false });
    hullGeo.translate(0, 0, -0.85);
    var hull = new THREE.Mesh(hullGeo, std(hullColor, 0.45, 0.15));
    hull.castShadow = true; g.add(hull);
    // white stripe along the hull side
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 0.04), std(0xffffff, 0.5));
    stripe.position.set(0, 0.55, 0.87); g.add(stripe);
    var stripe2 = stripe.clone(); stripe2.position.z = -0.87; g.add(stripe2);
    // deck + cockpit rim
    var deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.5), std(0x2a2f36, 0.8));
    deck.position.set(-0.1, 0.98, 0); g.add(deck);
    var rim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 1.5), std(hullColor, 0.5));
    rim.position.set(0.9, 1.05, 0); g.add(rim);
    // windshield (slanted, dark glass)
    var shield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.1, metalness: 0.6 }));
    shield.position.set(1.35, 1.3, 0); shield.rotation.z = -0.45; g.add(shield);
    // helm wheel at the driver's stand (v7.4): the driver — Mateo in
    // shot 3 — stands here with both hands on the wheel
    var helm = new THREE.Group(); helm.position.set(0.95, 1.45, 0.35);
    var helmRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 16), std(0x2a2a2a, 0.5, 0.6));
    helm.add(helmRing);
    for (var hs = 0; hs < 3; hs++) {
      var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.04), std(0x2a2a2a, 0.5, 0.6));
      spoke.rotation.z = (hs / 3) * Math.PI;
      helm.add(spoke);
    }
    var helmPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), std(0x2a2a2a, 0.5, 0.6));
    helmPost.rotation.x = Math.PI / 2 - 0.4; helmPost.position.set(0.95, 1.25, 0.35);
    g.add(helmPost);
    helm.rotation.y = Math.PI / 2; helm.rotation.x = -0.4;
    g.add(helm);
    g.userData.helm = helm;
    // bench seats
    [-0.6, -1.4].forEach(function (x) {
      var seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.3), std(0x8a2a2a, 0.85));
      seat.position.set(x, 1.1, 0); g.add(seat);
      var back = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 1.3), std(0x8a2a2a, 0.85));
      back.position.set(x - 0.4, 1.3, 0); g.add(back);
    });
    // outboard motor on the transom
    var motor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.5), std(0x14181c, 0.5, 0.4));
    motor.position.set(-2.75, 0.55, 0); g.add(motor);
    var prop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 8), std(0x888888, 0.3, 0.9));
    prop.rotation.x = Math.PI / 2; prop.position.set(-2.85, 0.15, 0); g.add(prop);
    if (police) {
      // blue stripe + POLICE board on the side + roof light bar
      var blue = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.2, 0.05), std(0x2040a0, 0.5));
      blue.position.set(0, 0.78, 0.88); g.add(blue);
      var blue2 = blue.clone(); blue2.position.z = -0.88; g.add(blue2);
      var bar = new THREE.Group(); bar.position.set(0.9, 1.35, 0);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 2 }));
      red.position.x = -0.2; bar.add(red);
      var blu = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x1020ff, emissiveIntensity: 2 }));
      blu.position.x = 0.2; bar.add(blu);
      g.add(bar);
      g.userData.lightRed = red; g.userData.lightBlue = blu;
    } else {
      // hero boat: orange hull, white deck stripe, SUN-8821 plate on stern
      var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18),
        new THREE.MeshStandardMaterial({ map: PH.plateTexture('SUN-8821'), roughness: 0.5 }));
      plate.position.set(-2.66, 0.55, 0); plate.rotation.y = -Math.PI / 2; g.add(plate);
    }
    g.userData.length = 5.8;
    return g;
  };

  // --- foam wake: a ribbon of fading white quads trailing the stern ---
  PH.makeWake = function (scene, segments) {
    var n = segments || 26;
    var geos = [];
    var group = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false
    });
    var quads = [];
    for (var i = 0; i < n; i++) {
      var q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat.clone());
      q.rotation.x = -Math.PI / 2;
      q.visible = false;
      group.add(q); quads.push(q);
    }
    scene.add(group);
    return {
      group: group, quads: quads, head: 0,
      // stamp one quad at the stern each frame; older quads fade + widen
      stamp: function (x, z, y, heading, speed, t) {
        var q = quads[this.head];
        this.head = (this.head + 1) % quads.length;
        q.visible = true;
        q.position.set(x, y + 0.06, z);
        q.rotation.z = heading;
        var w = 1.6 + speed * 0.08;
        q.scale.set(w, 3.6 + speed * 0.08, 1);
        q.userData.born = t;
        q.userData.w0 = w;
      },
      update: function (t) {
        quads.forEach(function (q) {
          if (!q.visible) return;
          var age = t - (q.userData.born || 0);
          if (age < 0) age = 0; // staged pre-stamps are born "later"
          if (age > 6) { q.visible = false; return; }
          var k = 1 - age / 6;
          q.material.opacity = 0.65 * k;
          var grow = 1 + age * 0.35;
          q.scale.x = q.userData.w0 * grow;
          q.scale.y = (3.6) * grow;
        });
      }
    };
  };

  // --- boat chase: player boat + police boats that steer at a point
  // ahead of the player, never at the exact position (so they trail
  // behind in a visible pursuit line instead of piling onto the stern).
  PH.BoatChase = function (scene) {
    this.scene = scene;
    this.player = PH.makeBoat({ hull: 0xff7a1a });
    this.player.position.set(-120, 0, 40);
    this.player.rotation.y = Math.PI / 2;
    scene.add(this.player);
    this.policeBoats = [];
    var spots = [[-132, 26], [-128, 56]];
    for (var i = 0; i < 2; i++) {
      var pb = PH.makeBoat({ police: true });
      pb.position.set(spots[i][0], 0, spots[i][1]);
      pb.rotation.y = Math.PI / 2;
      scene.add(pb);
      this.policeBoats.push({ mesh: pb, speed: 13 + i * 1.5, heading: Math.PI / 2 });
    }
    this.wake = PH.makeWake(scene, 26);
    this.policeWake = PH.makeWake(scene, 18);
    this.playerSpeed = 16;
    this.heading = Math.PI / 2; // north along the coast
    this.playerPos = new THREE.Vector3(-120, 0, 40);
    this.active = false;
  };
  PH.BoatChase.prototype.setPlayer = function (x, z, heading, speed) {
    this.playerPos.set(x, 0, z);
    this.heading = heading;
    this.playerSpeed = speed;
  };
  PH.BoatChase.prototype.update = function (dt, t) {
    var self = this;
    // player boat glides north along the coast, bobbing on the swell
    this.playerPos.z += Math.sin(this.heading) * 0 + Math.cos(this.heading) * 0;
    this.playerPos.x += Math.sin(this.heading) * this.playerSpeed * dt;
    this.playerPos.z += Math.cos(this.heading) * this.playerSpeed * dt;
    if (this.playerPos.x > -104) { this.playerPos.x = -104; this.heading = Math.PI; }
    if (this.playerPos.x < -168) { this.playerPos.x = -168; this.heading = 0; }
    this.player.position.copy(this.playerPos);
    this.player.position.y = PH.waveHeight(this.playerPos.x, this.playerPos.z, t) * 0.6;
    this.player.rotation.y = this.heading;
    this.player.rotation.z = Math.sin(t * 0.9) * 0.04;
    this.player.rotation.x = Math.sin(t * 0.7 + 1) * 0.03;
    var sternX = this.playerPos.x - Math.sin(this.heading) * 3;
    var sternZ = this.playerPos.z - Math.cos(this.heading) * 3;
    this.wake.stamp(sternX, sternZ, PH.waveHeight(sternX, sternZ, t), this.heading, this.playerSpeed, t);
    this.wake.update(t);
    // police boats: aim at a point 6 units ahead of the player
    var aheadX = this.playerPos.x + Math.sin(this.heading) * 6;
    var aheadZ = this.playerPos.z + Math.cos(this.heading) * 6;
    this.policeBoats.forEach(function (pb, i) {
      var want = Math.atan2(aheadX - pb.mesh.position.x, aheadZ - pb.mesh.position.z);
      var diff = want - pb.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pb.heading += PH.clamp(diff, -1.4 * dt, 1.4 * dt);
      pb.mesh.position.x += Math.sin(pb.heading) * pb.speed * dt;
      pb.mesh.position.z += Math.cos(pb.heading) * pb.speed * dt;
      pb.mesh.position.y = PH.waveHeight(pb.mesh.position.x, pb.mesh.position.z, t) * 0.6;
      pb.mesh.rotation.y = pb.heading;
      pb.mesh.rotation.z = Math.sin(t * 1.1 + i * 2) * 0.05;
      var sx = pb.mesh.position.x - Math.sin(pb.heading) * 3;
      var sz = pb.mesh.position.z - Math.cos(pb.heading) * 3;
      self.policeWake.stamp(sx, sz, PH.waveHeight(sx, sz, t), pb.heading, pb.speed, t);
      var on = Math.floor(t * 4 + i) % 2 === 0;
      if (pb.mesh.userData.lightRed) {
        pb.mesh.userData.lightRed.material.emissiveIntensity = on ? 2.5 : 0.2;
        pb.mesh.userData.lightBlue.material.emissiveIntensity = on ? 0.2 : 2.5;
      }
    });
    this.policeWake.update(t);
  };
  // Stern position for a second character riding along (v7.4 rev 2):
  // the rear bench, 2.55 units behind the helm along the boat's axis.
  PH.BoatChase.prototype.sternPos = function () {
    var deck = this.deckPos();
    return { x: deck.x, y: deck.y, z: deck.z + 2.55, heading: -Math.PI / 2 };
  };
  // Deck position for a character standing at the helm (v7.4): the
  // boat's position + the helm offset, rotated by the boat's heading,
  // so Mateo can stand ON the speedboat instead of on the pier.
  PH.BoatChase.prototype.deckPos = function () {
    var hx = 0.95, hz = 0.35;
    var c = Math.cos(this.heading), s = Math.sin(this.heading);
    return {
      x: this.playerPos.x + hx * c + hz * s,
      y: this.playerPos.y + 1.0,
      z: this.playerPos.z - hx * s + hz * c,
      heading: this.heading
    };
  };
  // Frozen hero arrangement for the staged shot: player boat mid-frame
  // on the water with a white wake, two police boats trailing behind,
  // heli above the sea. v7.4: the boat sits closer to the pier end and
  // further west, so the pier camera sees a big boat, a big wake and
  // both police boats — the boat chase IS the shot now.
  PH.BoatChase.prototype.stageShot = function () {
    this.setPlayer(-112, 40, Math.PI / 2, 0);
    this.player.position.set(-112, 0.1, 40);
    this.player.rotation.y = Math.PI / 2;
    this.player.rotation.z = 0; this.player.rotation.x = 0;
    var spots = [[-126, 26], [-124, 54]];
    this.policeBoats.forEach(function (pb, i) {
      pb.mesh.position.set(spots[i][0], 0.1, spots[i][1]);
      pb.mesh.rotation.y = Math.PI / 2;
      pb.heading = Math.PI / 2;
    });
    // pre-stamp a visible wake ribbon behind the player boat; born far
    // in the future so the frozen staged shot never fades it out
    for (var k = 0; k < 18; k++) {
      this.wake.stamp(-112 - k * 1.6, 40, 0.1, Math.PI / 2, 14, 100);
    }
    for (var j = 0; j < 10; j++) {
      this.policeWake.stamp(-126 - j * 1.6, 26, 0.1, Math.PI / 2, 12, 100);
    }
  };
})();
