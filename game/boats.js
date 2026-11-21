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
    // swim platform + boarding ladder on the transom, so the stern is
    // a place people climb aboard instead of a flat wall
    var platform = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.5), std(0x8a6a42, 0.9));
    platform.position.set(-2.85, 0.3, 0); g.add(platform);
    [-0.5, 0.5].forEach(function (z) {
      var rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), std(0xd8d8e0, 0.3, 0.9));
      rail.position.set(-3.1, 0.0, z); g.add(rail);
      var rung = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), std(0xd8d8e0, 0.3, 0.9));
      rung.position.set(-3.1, -0.25, 0); g.add(rung);
    });
    // navigation lights: red port, green starboard, white stern — the
    // three dots that read as "boat" from across the bay at dusk
    var navRed = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 1.6 }));
    navRed.position.set(2.6, 0.75, 0.88); g.add(navRed);
    var navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x20ff60, emissive: 0x10ff40, emissiveIntensity: 1.6 }));
    navGreen.position.set(2.6, 0.75, -0.88); g.add(navGreen);
    var navWhite = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffee88, emissiveIntensity: 1.2 }));
    navWhite.position.set(-2.6, 1.0, 0); g.add(navWhite);
    // deck cleats + anchor + coiled rope on the foredeck
    [-1, 1].forEach(function (s) {
      var cleat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.08), std(0xd8d8e0, 0.3, 0.9));
      cleat.position.set(1.9, 1.0, s * 0.6); g.add(cleat);
    });
    var anchor = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12), std(0x666666, 0.5, 0.7));
    anchor.position.set(2.2, 0.65, 0); anchor.rotation.y = Math.PI / 2; g.add(anchor);
    var coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 14), std(0xc8a860, 0.95));
    coil.rotation.x = Math.PI / 2; coil.position.set(1.7, 1.02, -0.4); g.add(coil);
    // dashboard: two round gauges + a throttle lever at the helm
    [-0.18, 0.18].forEach(function (z) {
      var gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10),
        new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3, metalness: 0.4 }));
      gauge.rotation.x = Math.PI / 2 - 0.4; gauge.position.set(1.15, 1.35, 0.35 + z); g.add(gauge);
    });
    var throttle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), std(0x14181c, 0.4, 0.6));
    throttle.position.set(0.85, 1.2, 0.75); throttle.rotation.z = -0.3; g.add(throttle);
    // orange life ring on the port side + registration on the bow
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), std(0xff6a00, 0.7));
    ring.position.set(-0.4, 0.7, 0.9); g.add(ring);
    var ring2 = ring.clone(); ring2.position.z = -0.9; g.add(ring2);
    var regTex = PH.canvasTex(256, 64, function (ctx, w, h) {
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#14181c'; ctx.font = '900 40px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(police ? 'BAY CITY PD' : 'SUN-8821', w / 2, h / 2);
    });
    [0.9, -0.9].forEach(function (z) {
      var reg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25),
        new THREE.MeshStandardMaterial({ map: regTex, roughness: 0.5 }));
      reg.position.set(2.2, 0.6, z); reg.rotation.y = z > 0 ? 0 : Math.PI; g.add(reg);
    });
    // rub rail: a dark bumper strip around the hull sheer line
    var railMat = std(0x14181c, 0.6);
    [0.87, -0.87].forEach(function (z) {
      var rub = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.06), railMat);
      rub.position.set(0, 0.92, z); g.add(rub);
    });
    if (police) {
      // blue stripe + POLICE board on the side + roof light bar
      var blue = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.2, 0.05), std(0x2040a0, 0.5));
      blue.position.set(0, 0.78, 0.88); g.add(blue);
      var blue2 = blue.clone(); blue2.position.z = -0.88; g.add(blue2);
      // POLICE boards on both flanks, so a pursuit boat reads as PD
      // from either side instead of a plain white hull
      var pdTex = PH.canvasTex(512, 96, function (ctx, w, h) {
        ctx.fillStyle = '#2040a0'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff'; ctx.font = '900 56px Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('POLICE', w / 2, h / 2);
      });
      [0.92, -0.92].forEach(function (z) {
        var board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45),
          new THREE.MeshStandardMaterial({ map: pdTex, roughness: 0.5 }));
        board.position.set(-0.3, 0.5, z); if (z < 0) board.rotation.y = Math.PI;
        g.add(board);
      });
      // bow searchlight on a small mast, aimed forward
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), std(0x2a2a2a, 0.5, 0.6));
      mast.position.set(2.2, 1.3, 0); g.add(mast);
      var spot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffee88, emissiveIntensity: 2 }));
      spot.position.set(2.2, 1.7, 0); g.add(spot);
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

  // --- bow spray: small white puffs thrown off the bow at speed ---
  // Short-lived quads stamped at the bow each frame; they burst outward
  // and fade in under a second, so a fast boat throws spray while a
  // slow one stays clean. Same ribbon trick as the wake, smaller scale.
  PH.makeSpray = function (scene, segments) {
    var n = segments || 14;
    var group = new THREE.Group();
    var quads = [];
    for (var i = 0; i < n; i++) {
      var q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      q.rotation.x = -Math.PI / 2;
      q.visible = false;
      group.add(q); quads.push(q);
    }
    scene.add(group);
    return {
      group: group, quads: quads, head: 0,
      stamp: function (x, z, y, heading, speed, t) {
        if (speed < 6) return;
        var q = quads[this.head];
        this.head = (this.head + 1) % quads.length;
        q.visible = true;
        // spray lands off the bow quarter, alternating sides
        var side = (this.head % 2 ? 1 : -1) * (0.9 + PH.R() * 0.7);
        var fx = x + Math.sin(heading) * 2.6 - Math.cos(heading) * side;
        var fz = z + Math.cos(heading) * 2.6 + Math.sin(heading) * side;
        q.position.set(fx, y + 0.08, fz);
        q.rotation.z = heading + PH.rand(-0.6, 0.6);
        var s = 0.5 + speed * 0.05;
        q.scale.set(s, s * 1.6, 1);
        q.userData.born = t;
      },
      update: function (t) {
        quads.forEach(function (q) {
          if (!q.visible) return;
          var age = t - (q.userData.born || 0);
          if (age < 0) age = 0;
          if (age > 0.9) { q.visible = false; return; }
          var k = 1 - age / 0.9;
          q.material.opacity = 0.7 * k;
          q.scale.x *= 1 + 0.02;
        });
      }
    };
  };

  // --- civilian sailboat: a slow white hull, one mast, one striped sail
  // drifting across the bay for depth — the sea is not only police boats
  PH.makeSailboat = function (opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 1.4), std(opts.hull != null ? opts.hull : 0xf2f2f2, 0.5));
    hull.position.y = 0.35; hull.castShadow = true; g.add(hull);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.05), std(opts.stripe != null ? opts.stripe : 0x2a6fd8, 0.5));
    stripe.position.set(0, 0.55, 0.72); g.add(stripe);
    var stripe2 = stripe.clone(); stripe2.position.z = -0.72; g.add(stripe2);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 6), std(0x8a8a92, 0.5, 0.6));
    mast.position.set(0.3, 3.2, 0); g.add(mast);
    var sailTex = PH.canvasTex(128, 256, function (ctx, w, h) {
      for (var i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#f2f2f2' : (opts.sail != null ? opts.sail : '#ff7a1a');
        ctx.fillRect(0, i * (h / 6), w, h / 6);
      }
    });
    var sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4),
      new THREE.MeshStandardMaterial({ map: sailTex, roughness: 0.85, side: THREE.DoubleSide }));
    sail.position.set(-0.9, 3.4, 0); sail.rotation.y = Math.PI / 2; g.add(sail);
    var boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), std(0x6a4a20, 0.8));
    boom.rotation.z = Math.PI / 2; boom.position.set(-0.9, 1.2, 0); g.add(boom);
    // tiny crew figure at the tiller
    var crew = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), std(0xffc832, 0.85));
    crew.position.set(-1.3, 1.1, 0); g.add(crew);
    g.userData.length = 3.4;
    return g;
  };
  // ahead of the player, never at the exact position (so they trail
  // behind in a visible pursuit line instead of piling onto the stern).
  PH.BoatChase = function (scene) {
    this.scene = scene;
    this.player = PH.makeBoat({ hull: 0xff7a1a });
    this.player.position.set(-120, 0, 40);
    this.player.rotation.y = Math.PI / 2;
    scene.add(this.player);
    this.policeBoats = [];
    var spots = [[-132, 26], [-128, 56], [-136, 40]];
    for (var i = 0; i < 3; i++) {
      var pb = PH.makeBoat({ police: true });
      pb.position.set(spots[i][0], 0, spots[i][1]);
      pb.rotation.y = Math.PI / 2;
      scene.add(pb);
      this.policeBoats.push({ mesh: pb, speed: 13 + i * 1.5, heading: Math.PI / 2 });
    }
    // two civilian sailboats drifting across the bay for depth
    this.sailboats = [];
    var sailSpots = [[-150, 10, 0xff7a1a], [-145, 70, 0x2a9df4]];
    for (var s = 0; s < 2; s++) {
      var sb = PH.makeSailboat({ sail: sailSpots[s][2] });
      sb.position.set(sailSpots[s][0], 0, sailSpots[s][1]);
      sb.rotation.y = Math.PI / 2;
      scene.add(sb);
      this.sailboats.push({ mesh: sb, x: sailSpots[s][0], z: sailSpots[s][1], speed: 1.2 + s * 0.5, phase: s * 2.1 });
    }
    this.wake = PH.makeWake(scene, 40);
    this.policeWake = PH.makeWake(scene, 24);
    this.spray = PH.makeSpray(scene, 14);
    // v7.5: V-wakes from waterfx.js — one per boat (player + 3 police):
    // two foam arms whose angle narrows with speed, a foam ring at the
    // hull waterline and bow spray. The old ribbon wakes above stay as
    // the fallback when waterfx.js is absent.
    this.vWakes = [];
    if (PH.makeVWake) {
      for (var vi = 0; vi < 4; vi++) this.vWakes.push(PH.makeVWake(scene));
    }
    // v7.5: faint trailing wakes for the two sailboats (waterfx.js) —
    // slow boats barely disturb the water, so these are short, wide
    // and faint, nothing like the planing hulls' sharp V.
    this.sailWakes = [];
    if (PH.makeSailboatWake) {
      for (var sw = 0; sw < 2; sw++) this.sailWakes.push(PH.makeSailboatWake(scene));
    }
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
    // v7.5: the player boat's wake. When waterfx.js is loaded the
    // V-wake follows the boat and the hull planes high (planing pose);
    // the old ribbon wake + spray below are then skipped for the player
    // boat (they stay as the fallback when waterfx.js is absent, and
    // wake.update still runs so staged pre-stamps keep fading).
    var vWake0 = this.vWakes.length ? this.vWakes[0] : null;
    if (vWake0) vWake0.update(this.playerPos.x, this.playerPos.z, this.heading, this.playerSpeed, t);
    if (vWake0 && PH.planingPose) PH.planingPose(this.player, this.playerSpeed, t);
    var sternX = this.playerPos.x - Math.sin(this.heading) * 3;
    var sternZ = this.playerPos.z - Math.cos(this.heading) * 3;
    if (!vWake0) this.wake.stamp(sternX, sternZ, PH.waveHeight(sternX, sternZ, t), this.heading, this.playerSpeed, t);
    this.wake.update(t);
    // bow spray while the boat is at speed + sailboats drifting slowly
    var bowX = this.playerPos.x + Math.sin(this.heading) * 2.9;
    var bowZ = this.playerPos.z + Math.cos(this.heading) * 2.9;
    if (!vWake0) this.spray.stamp(bowX, bowZ, PH.waveHeight(bowX, bowZ, t), this.heading, this.playerSpeed, t);
    this.spray.update(t);
    this.sailboats.forEach(function (sb, sbi) {
      sb.x += sb.speed * dt;
      if (sb.x > -104) sb.x = -168;
      sb.mesh.position.set(sb.x, PH.waveHeight(sb.x, sb.z, t) * 0.6, sb.z + Math.sin(t * 0.2 + sb.phase) * 2);
      sb.mesh.rotation.y = Math.PI / 2;
      sb.mesh.rotation.z = Math.sin(t * 0.8 + sb.phase) * 0.05;
      // v7.5: the sailboat's faint trailing wake follows its hull
      if (self.sailWakes[sbi]) self.sailWakes[sbi].update(sb.mesh.position.x, sb.mesh.position.z, Math.PI / 2, t);
    });
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
      // v7.5: police boats plane and throw their own V-wakes too (one
      // V-wake each); the old ribbon stamp below is the fallback.
      if (self.vWakes[i + 1]) self.vWakes[i + 1].update(pb.mesh.position.x, pb.mesh.position.z, pb.heading, pb.speed, t);
      if (PH.planingPose) PH.planingPose(pb.mesh, pb.speed, t);
      var sx = pb.mesh.position.x - Math.sin(pb.heading) * 3;
      var sz = pb.mesh.position.z - Math.cos(pb.heading) * 3;
      if (!self.vWakes[i + 1]) self.policeWake.stamp(sx, sz, PH.waveHeight(sx, sz, t), pb.heading, pb.speed, t);
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
  // on the water with a white wake, THREE police boats trailing behind,
  // heli above the sea. v7.4 round 2: the boat sits closer to the pier
  // end and further west, so the pier camera sees a big boat, a big wake
  // and all three police boats — the boat chase IS the shot now. The
  // third boat closes from the south lane, so the pursuit reads as a
  // pincer instead of a single file line.
  PH.BoatChase.prototype.stageShot = function () {
    this.setPlayer(-112, 40, Math.PI / 2, 0);
    this.player.position.set(-112, 0.1, 40);
    this.player.rotation.y = Math.PI / 2;
    this.player.rotation.z = 0; this.player.rotation.x = 0;
    var spots = [[-126, 26], [-120, 50], [-122, 34]];
    this.policeBoats.forEach(function (pb, i) {
      pb.mesh.position.set(spots[i][0], 0.1, spots[i][1]);
      pb.mesh.rotation.y = Math.PI / 2;
      pb.heading = Math.PI / 2;
    });
    // sailboats hold their marks at the frame edges for depth
    this.sailboats.forEach(function (sb, i) {
      var sx = i === 0 ? -138 : -136;
      var sz = i === 0 ? 14 : 66;
      sb.x = sx; sb.z = sz;
      sb.mesh.position.set(sx, 0.1, sz);
      sb.mesh.rotation.y = Math.PI / 2;
      // v7.5: the sailboats' faint trailing wakes, staged with them
      if (this.sailWakes[i]) this.sailWakes[i].stage(sx, sz, Math.PI / 2);
    }, this);
    // pre-stamp a visible wake ribbon behind the player boat; born far
    // in the future so the frozen staged shot never fades it out.
    // Round 2: a longer, wider ribbon (26 stamps) + a second, fainter
    // V-arm either side of the stern, so the wake reads as a real V.
    // v7.5: when waterfx.js is loaded the V-wake stages itself (arms +
    // hull foam + bow spray, hull planing high) and the old ribbon
    // stamps below are skipped — the old system is the fallback.
    if (!this.vWakes.length) {
    for (var k = 0; k < 26; k++) {
      this.wake.stamp(-112 - k * 1.6, 40, 0.1, Math.PI / 2, 14, 100);
    }
    for (var a = 0; a < 12; a++) {
      this.wake.stamp(-112 - a * 1.8, 40 + 1.2 + a * 0.55, 0.1, Math.PI / 2, 10, 100);
      this.wake.stamp(-112 - a * 1.8, 40 - 1.2 - a * 0.55, 0.1, Math.PI / 2, 10, 100);
    }
    } else {
      this.vWakes[0].stage(-112, 40, Math.PI / 2, 14);
      if (PH.planingPose) PH.planingPose(this.player, 14, 0);
    }
    if (!this.vWakes.length) {
    for (var j = 0; j < 10; j++) {
      this.policeWake.stamp(-126 - j * 1.6, 26, 0.1, Math.PI / 2, 12, 100);
      this.policeWake.stamp(-120 - j * 1.6, 50, 0.1, Math.PI / 2, 12, 100);
      this.policeWake.stamp(-122 - j * 1.6, 34, 0.1, Math.PI / 2, 12, 100);
    }
    } else {
      // police V-wakes + planing poses for the staged shot, same spots
      // as the old pre-stamps above.
      this.vWakes[1].stage(-126, 26, Math.PI / 2, 12);
      this.vWakes[2].stage(-120, 50, Math.PI / 2, 12);
      this.vWakes[3].stage(-122, 34, Math.PI / 2, 12);
      if (PH.planingPose) {
        PH.planingPose(this.policeBoats[0].mesh, 12, 0);
        PH.planingPose(this.policeBoats[1].mesh, 12, 0);
        PH.planingPose(this.policeBoats[2].mesh, 12, 0);
      }
    }
    // a few frozen spray puffs at the bow, so the boat reads as moving
    for (var p = 0; p < 6; p++) {
      this.spray.stamp(-109 + p * 0.4, 40 + (p % 2 ? 1.4 : -1.4), 0.1, Math.PI / 2, 14, 100);
    }
  };
})();
