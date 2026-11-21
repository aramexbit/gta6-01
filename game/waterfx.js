// PIER HEAT — Sunset Bay v7.5
// waterfx.js — fast-boat water, built from how a planing hull works
// (how-it-works-v75.md §2 + real-refs-v75.md §4).
//
// WHY IT LOOKS THIS WAY: a planing hull at rest floats like any boat,
// but at speed the water pressure under the V lifts the hull OUT of
// the water — only a small patch of hull still touches, so drag falls
// and the boat goes faster. While it accelerates the bow rises steeply,
// then settles into a shallow bow-up glide. The water the hull shoves
// aside and down is the WAKE: two arms forming a V behind the boat,
// and the faster the boat goes the NARROWER the V gets (a narrow-V,
// not the wide Kelvin angle of a slow ship). The transom — the flat
// stern — runs DRY at planing speed: the water breaks cleanly off its
// edge instead of clinging to it. The bow throws white spray where it
// cuts the water, and foam rings the hull at the waterline. The sea
// itself is two colours: deep blue far out, turquoise in the shallows
// near the sand.
//
// WHAT THIS FILE BUILDS, and how boats.js / world.js use it:
//   PH.seaMaterial(sunset) — two-tone sea (deep blue far, turquoise
//     near) with a warm sun-path tint at sunset; world.js uses it for
//     the sea plane when present.
//   PH.makeVWake(scene) — one boat's V-wake: two foam arms whose angle
//     narrows with speed, a foam ring at the hull waterline, and bow
//     spray puffs. boats.js creates one per boat (player + 3 police)
//     and calls .update(x, z, heading, speed, t) every frame, or
//     .stage(x, z, heading, speed) for the frozen staged shot.
//   PH.planingPose(mesh, speed, t) — lifts the hull and raises the bow
//     a touch at speed; called after the boat's own pose is set, once
//     per frame, so it never accumulates.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // Two-tone sea canvas: deep blue far west, turquoise near the shore
  // (east), with long soft wave streaks running along the shore and a
  // warm sun-path glow at sunset. The sea plane is 200 wide (x -305..
  // -105), so U runs west-to-east: far water on the left of the canvas,
  // shallow water on the right.
  PH.seaMaterial = function (sunset) {
    var tex = PH.canvasTex(512, 512, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#0a3a6e');   // deep water, far out
      grad.addColorStop(0.55, '#146a96'); // mid bay
      grad.addColorStop(0.85, '#1f8a9e'); // shallows
      grad.addColorStop(1, '#2a9db0');    // turquoise at the sand
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // long soft wave streaks along the shore
      for (var i = 0; i < 60; i++) {
        var y = PH.R() * h;
        var light = PH.R() < 0.5;
        g.fillStyle = light ? 'rgba(255,255,255,0.06)' : 'rgba(0,20,50,0.10)';
        g.fillRect(PH.R() * w * 0.5, y, 60 + PH.R() * 180, 2 + PH.R() * 3);
      }
      // foam flecks near the shore edge (right side of the canvas)
      for (var j = 0; j < 120; j++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.08 + PH.R() * 0.2).toFixed(2) + ')';
        g.fillRect(w * 0.86 + PH.R() * w * 0.13, PH.R() * h, 2 + PH.R() * 6, 1 + PH.R() * 2);
      }
      // warm sun-path tint at sunset: the low sun's gold road on the
      // water, strongest on the western (left) half
      if (sunset) {
        var sun = g.createLinearGradient(0, 0, w * 0.5, 0);
        sun.addColorStop(0, 'rgba(255,180,90,0.28)');
        sun.addColorStop(1, 'rgba(255,180,90,0)');
        g.fillStyle = sun; g.fillRect(0, 0, w * 0.5, h);
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // v7.5 rev 2: roughness up, metalness down — the first version
    // (0.22 / 0.25) mirrored the bright sky so hard the sea washed
    // pale, and white wake foam had no contrast on it. A rougher sea
    // shows its own painted blue instead of the sky.
    // v7.5 rev 3: the sea STILL washed pale in the renders — the day
    // hemisphere light is strong, so the canvas alone cannot hold the
    // blue. A colour multiplier (0x8a8a8a) pulls the whole sea down
    // almost a stop, so the deep blue finally reads and white foam
    // has something dark to sit on.
    return new THREE.MeshStandardMaterial({
      map: tex, color: 0x8a8a8a, roughness: 0.45, metalness: 0.05,
      transparent: true, opacity: 0.95
    });
  };

  // Foam canvas: white streaks that fade along the arm's length — a
  // wake arm is brightest where it leaves the hull and dissolves into
  // the sea behind the boat. The texture fades along U (length).
  // v7.5 rev 2: the first version was too thin — a soft gradient plus
  // a soft side falloff averages to a faint smear, and white foam on
  // pale water vanished. Now the arm has a SOLID CORE: full alpha for
  // the first half of its length, a hard-ish centre band, and the side
  // falloff only eats the outer 15% each side, so the wake reads as a
  // real trail of churned water instead of a watermark.
  function foamTexture() {
    return PH.canvasTex(256, 64, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // streaks of denser foam, running along the arm
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (var i = 0; i < 40; i++) {
        var y = PH.R() * h;
        g.fillRect(PH.R() * w * 0.7, y, 20 + PH.R() * 60, 2 + PH.R() * 4);
      }
      // soft side falloff: the arm is foam in the middle, water at its
      // edges — so it reads as a trail, not a painted stripe
      var side = g.createLinearGradient(0, 0, 0, h);
      side.addColorStop(0, 'rgba(0,0,0,1)');
      side.addColorStop(0.15, 'rgba(0,0,0,0)');
      side.addColorStop(0.85, 'rgba(0,0,0,0)');
      side.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = side; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }

  // Soft white blob for bow spray and hull foam: a radial puff with no
  // hard edge, so spray reads as water in the air, not as a white ball.
  function puffTexture() {
    return PH.canvasTex(64, 64, function (g, w, h) {
      var r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      r.addColorStop(0, 'rgba(255,255,255,0.9)');
      r.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
  }

  // One boat's V-wake. The two arms are tapered ribbons: narrow where
  // they leave the stern, widening as they fall behind — the foam a
  // hull throws sideways. Their half-angle narrows with speed (fast =
  // narrow V), their length and opacity grow with speed, and a foam
  // ring hugs the hull at the waterline. Bow spray puffs burst off the
  // bow quarters while the boat is at speed.
  PH.makeVWake = function (scene) {
    var group = new THREE.Group();
    var foamTex = foamTexture();
    var puffTex = puffTexture();

    function makeArm() {
      // a tapered ribbon: PlaneGeometry(14 long, 1 wide), then the far
      // end's verts are spread apart so the arm widens as it trails.
      // v7.5 rev 2: the stern end is wider now (1.2, not 0.5) — a real
      // wake leaves the hull as a broad sheet of churn, not a thread,
      // and the narrow thread was invisible at shot distance.
      var geo = new THREE.PlaneGeometry(14, 1, 8, 1);
      var pos = geo.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i); // -7 (stern) .. +7 (far end)
        var k = (x + 7) / 14; // 0 at the stern, 1 at the far end
        pos.setY(i, pos.getY(i) * (1.2 + k * 1.6));
      }
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: foamTex, transparent: true, opacity: 0.9,
        side: THREE.DoubleSide, depthWrite: false
      }));
      m.rotation.x = -Math.PI / 2;
      group.add(m);
      // bright core: a second, narrower ribbon along the arm's middle,
      // almost solid white, so the wake has a spine even where the
      // outer foam has dissolved — the eye follows the spine.
      // v7.5 rev 3: the core is wider now (0.45 -> 0.7) — the first
      // renders' wake vanished on the pale sea, and the spine is what
      // the eye catches first at shot distance.
      var coreGeo = new THREE.PlaneGeometry(14, 0.7, 8, 1);
      var core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
        map: foamTex, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false
      }));
      core.rotation.x = -Math.PI / 2;
      core.position.y = 0.01;
      group.add(core);
      return { mesh: m, core: core };
    }
    var armL = makeArm();
    var armR = makeArm();
    // hull foam ring: a soft ellipse of foam at the waterline, so the
    // hull looks wet where it meets the sea instead of sitting on top
    // of a flat blue sheet
    var ring = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.2),
      new THREE.MeshBasicMaterial({
        map: puffTex, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false
      }));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    // bow spray: six puffs that burst off the bow quarters
    var sprays = [];
    for (var s = 0; s < 6; s++) {
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puffTex, transparent: true, opacity: 0, depthWrite: false
      }));
      group.add(spr);
      sprays.push({ spr: spr, side: s % 2 ? 1 : -1, phase: s * 1.1, where: 'bow' });
    }
    // transom spray: four puffs at the stern quarters — at planing
    // speed the water breaks off the transom's edge in a low white
    // fan, so the stern throws spray sideways as well as a wake
    for (var ts = 0; ts < 4; ts++) {
      var tsp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puffTex, transparent: true, opacity: 0, depthWrite: false
      }));
      group.add(tsp);
      sprays.push({ spr: tsp, side: ts % 2 ? 1 : -1, phase: ts * 1.7 + 0.5, where: 'transom' });
    }
    // prop wash: three churning puffs right behind the transom, where
    // the propeller boils the water white. They pulse with time — the
    // wash never sits still — and grow with speed, so a boat at full
    // throttle leaves a boiling patch, not a clean V.
    var churn = [];
    for (var c = 0; c < 3; c++) {
      var ch = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puffTex, transparent: true, opacity: 0, depthWrite: false
      }));
      group.add(ch);
      churn.push({ spr: ch, off: (c - 1) * 0.9, phase: c * 2.1 });
    }
    scene.add(group);

    // Place the arms behind a boat at (x, z) on heading h, at speed v:
    // the arms start at the stern and run back-out at the V half-angle.
    // Half-angle: ~24 deg crawling, ~12 deg at full speed — fast boats
    // throw a narrow V. The arms' centre line sits 7 units behind the
    // stern, so the V opens behind the boat, never under it.
    function placeArms(x, z, heading, speed) {
      var k = PH.clamp(speed / 16, 0, 1);
      var half = (24 - 12 * k) * Math.PI / 180; // narrow-V with speed
      var len = 10 + k * 6;
      [-1, 1].forEach(function (side, i) {
        var pair = side < 0 ? armL : armR;
        // the arm's own heading: backwards, slewed outward by half
        var ah = heading + Math.PI + side * half;
        var ax = Math.sin(ah), az = Math.cos(ah);
        // centre of the arm: 7 units back along its own direction
        var cx = x + ax * 7, cz = z + az * 7;
        // the core rides a hair above the outer ribbon (0.13 vs 0.12)
        // so the two never z-fight where they overlap
        [pair.mesh, pair.core].forEach(function (part) {
          part.position.set(cx, part === pair.core ? 0.13 : 0.12, cz);
          // rotation.z = ah - PI/2: with rotation.x = -PI/2 the plane's
          // local X (its long axis) lands on (sin ah, 0, cos ah) — the
          // arm's heading. (rotation.z = ah would point it sideways.)
          part.rotation.z = ah - Math.PI / 2;
          // the ribbon's long axis runs along its heading: the plane was
          // built 14 long, so scale it to the speed-length
          part.scale.set(len / 14, 1, 1);
        });
        pair.mesh.material.opacity = 0.6 + k * 0.4;
        pair.core.material.opacity = 0.6 + k * 0.4;
        // keep the far end off the hull: the ribbon's near tip sits at
        // the stern because its centre is 7 back and it is `len` long
      });
      ring.position.set(x, 0.1, z);
      ring.rotation.z = heading;
      ring.scale.setScalar(0.8 + k * 0.5);
      ring.material.opacity = 0.35 + k * 0.4;
    }

    return {
      group: group,
      // live update: arms + ring follow the boat, spray bursts with
      // speed and shimmers with time
      update: function (x, z, heading, speed, t) {
        placeArms(x, z, heading, speed);
        var k = PH.clamp(speed / 16, 0, 1);
        sprays.forEach(function (sp, i) {
          // bow spray bursts off the bow quarters; transom spray off
          // the stern quarters, lower and wider — two different fans
          var along = sp.where === 'transom' ? -2.9 : 2.9;
          var bx = x + Math.sin(heading) * along;
          var bz = z + Math.cos(heading) * along;
          var off = Math.sin(t * 3 + sp.phase) * 0.5;
          var spread = sp.where === 'transom' ? 1.3 : 1.0;
          var sx = bx - Math.cos(heading) * sp.side * (spread + off * 0.4);
          var sz = bz + Math.sin(heading) * sp.side * (spread + off * 0.4);
          var sy = sp.where === 'transom' ? 0.35 : 0.5 + Math.abs(Math.sin(t * 2 + sp.phase)) * 0.4;
          sp.spr.position.set(sx, sy, sz);
          var sc = (0.5 + k * 1.1) * (0.8 + 0.2 * Math.sin(t * 4 + i));
          sp.spr.scale.set(sc, sc * 0.8, 1);
          sp.spr.material.opacity = k * 0.75 * (0.6 + 0.4 * Math.sin(t * 5 + sp.phase));
        });
        // prop wash: boils right behind the transom, pulsing with time
        churn.forEach(function (ch, i) {
          var tx = x - Math.sin(heading) * 3.4 - Math.cos(heading) * ch.off;
          var tz = z - Math.cos(heading) * 3.4 + Math.sin(heading) * ch.off;
          ch.spr.position.set(tx, 0.25, tz);
          var csc = (1.0 + k * 1.2) * (0.9 + 0.25 * Math.sin(t * 6 + ch.phase));
          ch.spr.scale.set(csc, csc * 0.7, 1);
          ch.spr.material.opacity = k * 0.85 * (0.7 + 0.3 * Math.sin(t * 7 + ch.phase));
        });
      },
      // frozen arrangement for the staged shot: the V is laid out once
      // and never moves, so the screenshot always shows a full wake
      stage: function (x, z, heading, speed) {
        placeArms(x, z, heading, speed);
        sprays.forEach(function (sp, i) {
          var along = sp.where === 'transom' ? -2.9 : 2.9;
          var bx = x + Math.sin(heading) * along;
          var bz = z + Math.cos(heading) * along;
          var spread = sp.where === 'transom' ? 1.3 : 1.1;
          var sx = bx - Math.cos(heading) * sp.side * spread;
          var sz = bz + Math.sin(heading) * sp.side * spread;
          sp.spr.position.set(sx, sp.where === 'transom' ? 0.35 : 0.55, sz);
          sp.spr.scale.set(1.1, 0.9, 1);
          sp.spr.material.opacity = 0.7;
        });
        churn.forEach(function (ch, i) {
          var tx = x - Math.sin(heading) * 3.4 - Math.cos(heading) * ch.off;
          var tz = z - Math.cos(heading) * 3.4 + Math.sin(heading) * ch.off;
          ch.spr.position.set(tx, 0.25, tz);
          ch.spr.scale.set(1.8, 1.2, 1);
          ch.spr.material.opacity = 0.8;
        });
      }
    };
  };

  // Drifting foam patches on the bay: soft white blobs left behind by
  // boats that have already passed, and foam that gathers where the
  // swell breaks near the sand. They drift slowly with the swell, so
  // the water is never a flat blue sheet even where no boat is running.
  // world.js creates one set for the whole bay and calls .update(t)
  // from W.update every frame.
  PH.makeDriftingFoam = function (scene) {
    var puffTex = puffTexture();
    var patches = [];
    var group = new THREE.Group();
    // 8 patches: 5 out in the bay where boats run, 3 near the sand
    // where the swell breaks
    var spots = [
      [-150, 10, 2.2], [-180, -30, 1.8], [-140, 70, 2.6], [-200, 50, 2.0],
      [-165, 110, 1.6], [-112, 18, 1.4], [-118, 96, 1.8], [-130, -60, 1.5]
    ];
    spots.forEach(function (sp, i) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(sp[2] * 3, sp[2] * 2),
        new THREE.MeshBasicMaterial({
          map: puffTex, transparent: true, opacity: 0.35,
          side: THREE.DoubleSide, depthWrite: false
        }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(sp[0], 0.08, sp[1]);
      group.add(m);
      patches.push({ mesh: m, x: sp[0], z: sp[1], phase: i * 1.3, amp: 1.5 + (i % 3) });
    });
    scene.add(group);
    return {
      group: group,
      update: function (t) {
        // slow drift with the swell: each patch wanders a couple of
        // units east-west and breathes in size, never leaving the bay
        patches.forEach(function (p) {
          p.mesh.position.x = p.x + Math.sin(t * 0.12 + p.phase) * p.amp;
          p.mesh.position.z = p.z + Math.cos(t * 0.09 + p.phase) * p.amp * 0.6;
          var s = 1 + 0.12 * Math.sin(t * 0.25 + p.phase);
          p.mesh.scale.set(s, s, 1);
        });
      }
    };
  };

  // A sailboat's wake: slow boats barely disturb the water — a short,
  // faint, wide trail and a soft ring at the hull, nothing like a
  // planing hull's sharp V. The trail is a single centre ribbon (at
  // 1-2 knots the Kelvin arms are too faint to see) whose bright end
  // sits at the hull and fades behind the boat.
  PH.makeSailboatWake = function (scene) {
    var foamTex = foamTexture();
    var puffTex = puffTexture();
    var group = new THREE.Group();
    var trail = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6),
      new THREE.MeshBasicMaterial({
        map: foamTex, transparent: true, opacity: 0.4,
        side: THREE.DoubleSide, depthWrite: false
      }));
    trail.rotation.x = -Math.PI / 2;
    group.add(trail);
    var ring = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.2),
      new THREE.MeshBasicMaterial({
        map: puffTex, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, depthWrite: false
      }));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    scene.add(group);
    function place(x, z, heading) {
      var bx = Math.sin(heading), bz = Math.cos(heading);
      // centre 4.5 behind the hull, long axis along the heading —
      // rotation.z = heading + PI/2 puts the texture's bright end
      // (local -X) toward the boat, fading astern
      trail.position.set(x - bx * 4.5, 0.1, z - bz * 4.5);
      trail.rotation.z = heading + Math.PI / 2;
      ring.position.set(x, 0.09, z);
      ring.rotation.z = heading;
    }
    return {
      group: group,
      update: function (x, z, heading, t) {
        place(x, z, heading);
        trail.material.opacity = 0.3 + 0.1 * Math.sin(t * 0.5);
      },
      stage: function (x, z, heading) {
        place(x, z, heading);
        trail.material.opacity = 0.4;
      }
    };
  };

  // Harbour buoys: small orange cones bobbing in the bay, marking the
  // boat lane the player races down. They bob with the swell and
  // drift a touch with it, so the water has foreground objects that
  // prove it moves. world.js creates one set for the bay and calls
  // .update(t) from W.update every frame.
  PH.makeBuoys = function (scene) {
    var group = new THREE.Group();
    var buoys = [];
    // a loose line of buoys down the boat lane, plus two near the pier
    var spots = [
      [-130, 20], [-140, 40], [-150, 60], [-160, 80], [-170, 100],
      [-120, 55], [-125, 75]
    ];
    spots.forEach(function (sp, i) {
      var b = new THREE.Group();
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.6 }));
      cone.position.y = 0.55;
      b.add(cone);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.3, 8),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }));
      base.position.y = 0.15;
      b.add(base);
      // a white band around the cone, so the buoy reads at distance
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.25, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
      band.position.y = 0.6;
      b.add(band);
      // a tiny top light, so the lane reads at dusk
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffc860, emissive: 0xffa020, emissiveIntensity: 1.5 }));
      lamp.position.y = 1.2;
      b.add(lamp);
      b.position.set(sp[0], 0, sp[1]);
      group.add(b);
      buoys.push({ g: b, x: sp[0], z: sp[1], phase: i * 1.7 });
    });
    scene.add(group);
    return {
      group: group,
      update: function (t) {
        // bob with the swell: each buoy rides the same three sines
        // the boats ride (PH.waveHeight), plus a slow drift
        buoys.forEach(function (by) {
          by.g.position.y = PH.waveHeight(by.x, by.z, t) * 0.7;
          by.g.position.x = by.x + Math.sin(t * 0.15 + by.phase) * 0.8;
          by.g.rotation.z = Math.sin(t * 0.9 + by.phase) * 0.08;
          by.g.rotation.x = Math.cos(t * 0.7 + by.phase) * 0.06;
        });
      }
    };
  };

  // Planing pose: at speed the hull rides HIGH (lift) with the bow a
  // touch up, and the transom runs dry. Called once per frame AFTER
  // the boat's own position/rotation are set, so it adds to the base
  // pose instead of accumulating. k = 0 at rest, 1 at full speed.
  // The pitch axis is horizontal and perpendicular to the heading —
  // rotating around it lifts the bow without turning the boat.
  PH.planingPose = function (mesh, speed, t) {
    if (!mesh) return;
    var k = PH.clamp(speed / 16, 0, 1);
    if (k <= 0.01) return;
    var lift = k * 0.45;          // hull rides clear of the water
    var pitch = k * 0.07;         // bow up a touch, then settled
    mesh.position.y += lift;
    var h = mesh.rotation.y;
    var axis = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    mesh.rotateOnWorldAxis(axis, -pitch);
    // a whisper of extra roll with the swell, so the lifted hull still
    // feels like it is on water, not on rails
    mesh.rotation.z += Math.sin(t * 1.3) * 0.012 * k;
  };
})();
