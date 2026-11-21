// PIER HEAT — Sunset Bay v7.4
// sim.js — everything that moves: procedural people + poses, cars (hero,
// traffic, police), traffic system, city + beach crowds, police + heli,
// and the muzzle flash. Mateo / Kira are built in mateo.js (primitives,
// no model file). Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // Contact shadow under a car (v7.4): a soft dark ellipse on the road
  // so the car sits ON the asphalt instead of floating above it.
  function carContactShadow(w, l) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
      new THREE.MeshBasicMaterial({ map: PH.contactShadowTexture(), transparent: true, opacity: 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    return m;
  }

  var SKINS = [0xf2c89b, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa0662a];
  var SHIRTS = [0xd83a2a, 0x0e7a7a, 0xffc832, 0x8a5aff, 0x37a05a, 0xff7a1a, 0x2a6fd8, 0xf2f2f2, 0x222222, 0xff6ab0];
  var PANTS = [0x2a3a4a, 0x1a1a1a, 0x4a5a6a, 0x6a4a2a, 0x8a2a3a];
  var HAIRS = [0x1a1a1a, 0x4a2a10, 0x8a6a3a, 0xd8d8d8, 0x2a1a12];

  function mat(color, rough) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough });
  }

  // ---- procedural person (~1.8 units), low-poly face, poseable limbs ----
  PH.makePerson = function (opts) {
    opts = opts || {};
    var skin = opts.skin != null ? opts.skin : PH.pick(SKINS);
    var shirt = opts.shirt != null ? opts.shirt : PH.pick(SHIRTS);
    var pants = opts.pants != null ? opts.pants : PH.pick(PANTS);
    var hair = opts.hair != null ? opts.hair : PH.pick(HAIRS);
    var scale = opts.scale || 1;
    var g = new THREE.Group();
    var legL = new THREE.Group(); legL.position.set(-0.14, 0.85, 0);
    var legR = new THREE.Group(); legR.position.set(0.14, 0.85, 0);
    var legGeo = new THREE.BoxGeometry(0.22, 0.85, 0.24);
    var lm = new THREE.Mesh(legGeo, mat(pants)); lm.position.y = -0.42; lm.castShadow = true;
    var rm = new THREE.Mesh(legGeo, mat(pants)); rm.position.y = -0.42; rm.castShadow = true;
    legL.add(lm); legR.add(rm);
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8), mat(shirt));
    body.position.y = 1.2; body.castShadow = true;
    var headG = new THREE.Group(); headG.position.y = 1.68;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(skin));
    head.castShadow = true; headG.add(head);
    var hairM = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair));
    hairM.position.y = 0.03; headG.add(hairM);
    // low-poly face: two dark eyes + mouth line on the front (+Z)
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x14100c });
    [-0.08, 0.08].forEach(function (ex) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeMat);
      eye.position.set(ex, 0.02, 0.2); headG.add(eye);
    });
    var mouth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.01), eyeMat);
    mouth.position.set(0, -0.09, 0.205); headG.add(mouth);
    var armL = new THREE.Group(); armL.position.set(-0.38, 1.5, 0);
    var armR = new THREE.Group(); armR.position.set(0.38, 1.5, 0);
    var armGeo = new THREE.BoxGeometry(0.16, 0.7, 0.18);
    var al = new THREE.Mesh(armGeo, mat(shirt)); al.position.y = -0.35; al.castShadow = true;
    var ar = new THREE.Mesh(armGeo, mat(shirt)); ar.position.y = -0.35; ar.castShadow = true;
    armL.add(al); armR.add(ar);
    if (opts.hat) {
      var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.1, 10), mat(0x1a2a4a, 0.7));
      hat.position.y = 0.2; headG.add(hat);
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), mat(0x1a2a4a, 0.7));
      brim.position.y = 0.16; headG.add(brim);
    }
    if (opts.cap) {
      // baseball cap: dome + a brim sticking out over the face
      var capDome = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(opts.capColor != null ? opts.capColor : 0xc81e1e, 0.8));
      capDome.position.y = 0.04; headG.add(capDome);
      var capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), mat(opts.capColor != null ? opts.capColor : 0xc81e1e, 0.8));
      capBrim.position.set(0, 0.12, 0.3); headG.add(capBrim);
      var capBtn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(0xf2f2f2, 0.6));
      capBtn.position.y = 0.26; headG.add(capBtn);
    }
    if (opts.helmet) {
      // white PD helmet: bright dome + a clear visor strip, so an
      // officer reads as police from across the street even at dusk
      var helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0xf2f2f2, 0.4));
      helm.position.y = 0.04; headG.add(helm);
      var visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.7 }));
      visor.position.set(0, 0.04, 0.22); headG.add(visor);
      var helmBadge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x2040a0, emissive: 0x2040a0, emissiveIntensity: 0.6 }));
      helmBadge.position.set(0, 0.14, 0.25); headG.add(helmBadge);
    }
    if (opts.sunglasses) {
      [-0.085, 0.085].forEach(function (ex) {
        var lens = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.02),
          new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.1, metalness: 0.7 }));
        lens.position.set(ex, 0.02, 0.21); headG.add(lens);
      });
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.2, metalness: 0.7 }));
      bridge.position.set(0, 0.02, 0.21); headG.add(bridge);
    }
    if (opts.vest) {
      // hi-vis vest: bright panel over the shirt + two silver bands
      var vestF = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.1), mat(0xffc832, 0.7));
      vestF.position.set(0, 1.22, 0.28); g.add(vestF);
      var vestB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.1), mat(0xffc832, 0.7));
      vestB.position.set(0, 1.22, -0.28); g.add(vestB);
      [1.1, 1.35].forEach(function (y) {
        var band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.12),
          new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.8, roughness: 0.3 }));
        band.position.set(0, y, 0.28); g.add(band);
      });
    }
    if (opts.jacket) {
      // open jacket: two dark panels over the shirt, collar up
      [-0.2, 0.2].forEach(function (x) {
        var panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.08), mat(opts.jacketColor != null ? opts.jacketColor : 0x2a3a4a, 0.9));
        panel.position.set(x, 1.22, 0.3); g.add(panel);
      });
    }
    if (opts.backpack) {
      var pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.18), mat(opts.packColor != null ? opts.packColor : 0x8a2a3a, 0.9));
      pack.position.set(0, 1.25, -0.36); g.add(pack);
      var flap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.2), mat(0x2a2a2a, 0.9));
      flap.position.set(0, 1.48, -0.36); g.add(flap);
    }
    g.add(legL, legR, body, headG, armL, armR);
    g.scale.setScalar(scale);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    var P = {
      group: g, legL: legL, legR: legR, armL: armL, armR: armR,
      body: body, head: headG, phase: PH.rand(0, 6.28), scale: scale,
      setPose: function (pose, t, speed) {
        var s = Math.sin(t * (speed || 6) + P.phase);
        var c = Math.cos(t * (speed || 6) + P.phase);
        legL.rotation.x = 0; legR.rotation.x = 0; armL.rotation.x = 0; armR.rotation.x = 0;
        armL.rotation.z = 0.08; armR.rotation.z = -0.08;
        legL.rotation.z = 0; legR.rotation.z = 0;
        body.rotation.x = 0; g.rotation.x = 0; g.position.y = 0;
        if (pose === 'walk') {
          legL.rotation.x = s * 0.55; legR.rotation.x = -s * 0.55;
          armL.rotation.x = -s * 0.45; armR.rotation.x = s * 0.45;
        } else if (pose === 'run') {
          legL.rotation.x = s * 0.95; legR.rotation.x = -s * 0.95;
          armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
          body.rotation.x = 0.18;
        } else if (pose === 'idle') {
          body.scale.y = 1 + Math.sin(t * 1.6 + P.phase) * 0.015; // breathing
          armL.rotation.x = Math.sin(t * 1.6) * 0.05;
          armR.rotation.x = -Math.sin(t * 1.6) * 0.05;
        } else if (pose === 'lying') {
          g.rotation.x = -Math.PI / 2; g.position.y = 0.25;
        } else if (pose === 'sit') {
          legL.rotation.x = -Math.PI / 2 + 0.15; legR.rotation.x = -Math.PI / 2 + 0.15;
          g.position.y = -0.35;
        } else if (pose === 'swim') {
          g.rotation.x = -Math.PI / 2 + 0.25; g.position.y = 0.1;
          armL.rotation.x = s * 0.9; armR.rotation.x = -s * 0.9;
          legL.rotation.x = c * 0.4; legR.rotation.x = -c * 0.4;
        } else if (pose === 'surf') {
          armL.rotation.z = 1.25; armR.rotation.z = -1.25;
          body.rotation.z = Math.sin(t * 1.2) * 0.12;
          legL.rotation.x = 0.3; legR.rotation.x = -0.25;
        } else if (pose === 'volley') {
          armL.rotation.x = -2.6; armR.rotation.x = -2.6;
          g.position.y = Math.max(0, Math.sin(t * 2.2 + P.phase)) * 0.5;
        } else if (pose === 'fish') {
          armL.rotation.x = -1.1; armR.rotation.x = -1.1;
          armL.rotation.z = 0.15; armR.rotation.z = -0.15;
        } else if (pose === 'selfie') {
          armR.rotation.x = -2.7; armR.rotation.z = -0.3;
          armL.rotation.x = 0.2;
        } else if (pose === 'dig') {
          g.position.y = -0.55;
          legL.rotation.x = -1.4; legR.rotation.x = -1.4;
          armL.rotation.x = -0.9 + s * 0.25; armR.rotation.x = -0.9 - s * 0.25;
        } else if (pose === 'kite') {
          // one arm up holding the string, head tilted to the sky
          armR.rotation.x = -2.9; armR.rotation.z = -0.3;
          armL.rotation.x = -0.5;
          headG.rotation.x = -0.35;
          legL.rotation.x = 0.2; legR.rotation.x = -0.15;
        } else if (pose === 'cheer') {
          // both arms up, bouncing — a beachgoer celebrating a catch
          armL.rotation.x = -2.8; armR.rotation.x = -2.8;
          armL.rotation.z = 0.3; armR.rotation.z = -0.3;
          g.position.y = Math.max(0, Math.sin(t * 3 + P.phase)) * 0.25;
          legL.rotation.x = 0.15; legR.rotation.x = -0.15;
        } else if (pose === 'aim') {
          armL.rotation.x = -Math.PI / 2; armR.rotation.x = -Math.PI / 2;
          armL.rotation.z = 0.12; armR.rotation.z = -0.12;
        }
      }
    };
    return P;
  };

  // ---- cars ----
  // Wheel with hub detail (v7.4): five spokes + a centre cap, so the
  // wheel reads as a wheel from the side instead of a flat dark disc.
  function wheel(x, z, rim) {
    var w = new THREE.Group(); w.position.set(x, 0.36, z);
    var tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12), mat(0x141414, 0.9));
    tyre.rotation.z = Math.PI / 2; w.add(tyre);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: rim ? 0xd8d8e0 : 0x888888, metalness: 0.9, roughness: 0.25 }));
    hub.rotation.z = Math.PI / 2; w.add(hub);
    for (var s = 0; s < 5; s++) {
      var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05),
        new THREE.MeshStandardMaterial({ color: rim ? 0xc0c0c8 : 0x666666, metalness: 0.85, roughness: 0.3 }));
      var a = (s / 5) * Math.PI * 2;
      spoke.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.14);
      spoke.rotation.z = a;
      w.add(spoke);
      var spoke2 = spoke.clone(); spoke2.position.z = -0.14; w.add(spoke2);
    }
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0xc85a00, metalness: 0.7, roughness: 0.3 }));
    cap.rotation.z = Math.PI / 2; w.add(cap);
    return w;
  }

  PH.makeCar = function (opts) {
    opts = opts || {};
    var kind = opts.kind || 'traffic';
    var g = new THREE.Group();
    var color = opts.color != null ? opts.color : PH.pick([0xd83a2a, 0x2a6fd8, 0xf2f2f2, 0xffc832, 0x0e7a7a, 0x8a5aff, 0x1a1a1a, 0xff6ab0, 0x37a05a, 0xc0c8d0]);
    if (kind === 'hero') {
      // Scarlet Arrow — wedge coupe, extruded side profile, matte orange.
      var shape = new THREE.Shape();
      shape.moveTo(-2.3, 0.28); shape.lineTo(1.4, 0.28); shape.lineTo(2.25, 0.62);
      shape.lineTo(2.05, 0.78); shape.lineTo(0.9, 1.05); shape.lineTo(-0.7, 1.05);
      shape.lineTo(-1.9, 0.8); shape.lineTo(-2.3, 0.28);
      var geo = new THREE.ExtrudeGeometry(shape, { depth: 1.9, bevelEnabled: false });
      geo.translate(0, 0, -0.95);
      // v7.5: glossy clearcoat paint from herocar.js (the flanks mirror
      // the sky); the old matte material stays as the fallback.
      var bodyMat = PH.heroPaint ? PH.heroPaint() : new THREE.MeshStandardMaterial({ color: 0xc85a00, roughness: 0.62, metalness: 0.05 });
      var body = new THREE.Mesh(geo, bodyMat);
      body.castShadow = true; g.add(body);
      // v7.5: the curved stern from herocar.js replaces the flat rear
      // panel (and, below, the tail bar, fog lamps, strut spoiler,
      // tail handle, old bumper/diffuser, exhausts and rear plate —
      // the rear assembly carries its own versions of all of them, set
      // on the dome's curve). When herocar.js is absent the old flat
      // rear stays exactly as it was.
      if (PH.buildHeroRear) { g.add(PH.buildHeroRear(bodyMat)); }
      else {
        var rear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 1.88), bodyMat);
        rear.position.set(-2.32, 0.62, 0); g.add(rear);
      }
      // dark glass cabin + body-colour roof, slanted windscreens
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.15, metalness: 0.5 }));
      cabin.position.set(0.05, 1.02, 0); g.add(cabin);
      var roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.6), bodyMat);
      roof.position.set(0.05, 1.26, 0); g.add(roof);
      var shield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.12, metalness: 0.5 }));
      shield.position.set(0.85, 0.95, 0); shield.rotation.z = -0.5; g.add(shield);
      var shieldR = shield.clone(); shieldR.position.set(-0.75, 0.95, 0); shieldR.rotation.z = 0.5; g.add(shieldR);
      // door lines + chrome handles + mirrors
      var lineMat = new THREE.MeshBasicMaterial({ color: 0x7a3400 });
      [-0.95, 0.95].forEach(function (z) {
        var line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), lineMat);
        line.position.set(0.35, 0.6, z); g.add(line);
        var handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.04),
          new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 }));
        handle.position.set(0.5, 0.78, z); g.add(handle);
        // v7.5: detailed mirrors from herocar.js (stalk + glass face +
        // amber repeater); the old body-colour box stays the fallback.
        if (PH.buildHeroMirror) g.add(PH.buildHeroMirror(z > 0 ? 1 : -1));
        else {
          var mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), bodyMat);
          mirror.position.set(0.95, 0.95, z * 1.02); g.add(mirror);
        }
      });
      // v7.3: the rear is no longer a flat box — door glass, a rear
      // quarter window, a tailgate handle and a rear bumper break it up.
      var glassMat = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.12, metalness: 0.5 });
      [-0.97, 0.97].forEach(function (z) {
        var doorGlass = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 0.05), glassMat);
        doorGlass.position.set(0.05, 1.0, z); g.add(doorGlass);
        var qtr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.05), glassMat);
        qtr.position.set(-0.95, 1.0, z); g.add(qtr);
      });
      var rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.5),
        new THREE.MeshStandardMaterial({ map: PH.skyGlassTexture(true), roughness: 0.12, metalness: 0.55 }));
      rearWindow.position.set(-0.85, 0.98, 0); rearWindow.rotation.z = 0.5; g.add(rearWindow);
      // v7.5: the tail handle + old bumper live in the flat rear that
      // the curved stern replaces — skipped when herocar.js is loaded.
      if (!PH.buildHeroRear) {
        var tailHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.5),
          new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 }));
        tailHandle.position.set(-2.4, 0.95, 0); g.add(tailHandle);
        var rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.92), mat(0x14181c, 0.5));
        rearBumper.position.set(-2.32, 0.32, 0); g.add(rearBumper);
      }
      // lower door crease + side skirt, so the flank reads as panels
      [-0.97, 0.97].forEach(function (z) {
        var crease = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.02), lineMat);
        crease.position.set(0, 0.42, z); g.add(crease);
        var skirt = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.06), mat(0x14181c, 0.5));
        skirt.position.set(0, 0.24, z); g.add(skirt);
      });
      // v7.5: the nose is rebuilt by herocar.js (round LED DRLs, wide
      // mesh grille, deeper splitter with winglets) — the old flat
      // grille, splitter and rectangular headlights are skipped when
      // it is loaded. The old parts stay as the fallback.
      if (!PH.buildHeroFront) {
      // grille + low front splitter
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 1.4), mat(0x14181c, 0.5)));
      var grille = g.children[g.children.length - 1]; grille.position.set(2.28, 0.45, 0);
      var split = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.9), mat(0x14181c, 0.5));
      split.position.set(2.15, 0.2, 0); g.add(split);
      // headlights + full-width tail light bar + diffuser + twin chrome exhausts
      var headMat = new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffd060, emissiveIntensity: 1.6 });
      [-0.6, 0.6].forEach(function (z) {
        var hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.5), headMat);
        hl.position.set(2.28, 0.62, z); g.add(hl);
      });
      } else {
        g.add(PH.buildHeroFront(bodyMat));
      }
      // v7.5: the full-width tail bar, the diffuser and the exhausts
      // are part of the old flat rear — the rear assembly in herocar.js
      // carries its own round LED lamps, mesh bumper and exhausts on
      // the dome's curve instead. Skipped when it is loaded.
      if (!PH.buildHeroRear) {
        var tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.8),
          new THREE.MeshStandardMaterial({ color: 0xff2a20, emissive: 0xff2010, emissiveIntensity: 1.4 }));
        tailBar.position.set(-2.38, 0.72, 0); g.add(tailBar);
        var diff = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 1.6), mat(0x14181c, 0.5));
        diff.position.set(-2.3, 0.3, 0); g.add(diff);
        [-0.45, 0.45].forEach(function (z) {
          var ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8),
            new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.2 }));
          ex.rotation.z = Math.PI / 2; ex.position.set(-2.42, 0.32, z); g.add(ex);
        });
      }
      // v7.5: the strut spoiler is replaced by the integrated lip on
      // the curved stern (herocar.js) — skipped when it is loaded.
      if (!PH.buildHeroRear) {
        [-0.6, 0.6].forEach(function (z) {
          var strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), bodyMat);
          strut.position.set(-2.05, 1.05, z); g.add(strut);
        });
        var wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 1.9), bodyMat);
        wing.position.set(-2.05, 1.18, 0); wing.castShadow = true; g.add(wing);
      }
      // v7.4: the rear reads from behind (shot 1 is a rear view) —
      // a trunk-lid seam, a rear wiper, a roof antenna and small fog
      // lamps under the tail bar. (The rear glass itself now carries
      // the sky-reflecting texture — see rearWindow above.)
      var trunkSeam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.5),
        new THREE.MeshBasicMaterial({ color: 0x5a2400 }));
      trunkSeam.position.set(-1.55, 1.0, 0); g.add(trunkSeam);
      var wiper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.7), mat(0x14181c, 0.5));
      wiper.position.set(-0.95, 0.82, 0); wiper.rotation.x = 0.4; g.add(wiper);
      var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 6), mat(0x14181c, 0.5));
      antenna.position.set(-0.4, 1.45, 0); antenna.rotation.z = -0.25; g.add(antenna);
      [-0.6, 0.6].forEach(function (z) {
        // v7.5: the old fog lamps sat on the flat rear face — the
        // curved stern's round lamps replace them; the door flap
        // below is part of the flank and stays either way.
        if (!PH.buildHeroRear) {
          var fog = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xff5040, emissive: 0xff3020, emissiveIntensity: 0.8 }));
          fog.position.set(-2.38, 0.5, z); g.add(fog);
        }
        var flap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.16),
          new THREE.MeshBasicMaterial({ color: 0x7a3400 }));
        flap.position.set(-0.6, 0.75, z > 0 ? 0.98 : -0.98); g.add(flap);
      });
      // plates SUN-8821
      var plateTex = PH.plateTexture('SUN-8821');
      var plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 });
      var pf = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), plateMat);
      pf.position.set(2.32, 0.35, 0); pf.rotation.y = Math.PI / 2; g.add(pf);
      // v7.5: the rear plate rides on the curved stern's dome now
      // (herocar.js) — the old flat plate would sink inside the bulge.
      if (!PH.buildHeroRear) {
        var pr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), plateMat);
        pr.position.set(-2.4, 0.35, 0); pr.rotation.y = -Math.PI / 2; g.add(pr);
      }
      // v7.5: black 7-spoke wheels from herocar.js (low-profile
      // stance); the old 5-spoke silver wheels stay the fallback.
      [[-1.55, -1.02], [1.45, -1.02]].forEach(function (p) { g.add((PH.buildHeroWheel || wheel)(p[0], p[1], true)); });
      [[-1.55, 1.02], [1.45, 1.02]].forEach(function (p) { g.add((PH.buildHeroWheel || wheel)(p[0], p[1], true)); });
      // v7.5: side intakes behind the doors (herocar.js) — the
      // mid-engine breathes here; the old flank is untouched.
      if (PH.buildHeroIntake) { g.add(PH.buildHeroIntake(1)); g.add(PH.buildHeroIntake(-1)); }
      // v7.4 rev 2: the wheels sit at the real axles (rear -1.55, front
      // +1.45) and flush with the body (lateral +/-1.02, half-width
      // 0.95) — v7.4 rev 1 had all four clustered at the front and
      // sticking 0.5 out of the flanks, so they read as loose discs
      // v7.4: soft contact shadow grounds the car; warm fog lamps
      // sit low on the front valance under the headlights
      g.add(carContactShadow(2.6, 5.0));
      [-0.65, 0.65].forEach(function (z) {
        var fogl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.28),
          new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffd060, emissiveIntensity: 1.0 }));
        fogl.position.set(2.26, 0.32, z); g.add(fogl);
      });
      // round 2 rear + flank enrichment (shot 1 is a rear view, shot 4
      // a side view — both faces must carry detail, not flat orange):
      // a bigger, taller rear glass with a chrome surround, a third
      // brake light strip across the spoiler, bumper reflectors, a rear
      // badge, side indicators, a fuel cap and a second flank crease
      var rearGlassBig = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 1.55),
        new THREE.MeshStandardMaterial({ map: PH.skyGlassTexture(true), roughness: 0.12, metalness: 0.55 }));
      rearGlassBig.position.set(-0.82, 1.02, 0); rearGlassBig.rotation.z = 0.5; g.add(rearGlassBig);
      var chromeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.6),
        new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.95, roughness: 0.2 }));
      chromeTrim.position.set(-0.55, 1.32, 0); chromeTrim.rotation.z = 0.5; g.add(chromeTrim);
      var brake3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.1),
        new THREE.MeshStandardMaterial({ color: 0xff2a20, emissive: 0xff2010, emissiveIntensity: 2.2 }));
      brake3.position.set(-2.05, 1.23, 0); g.add(brake3);
      [-0.75, 0.75].forEach(function (z) {
        var refl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xff5040, emissive: 0xff3020, emissiveIntensity: 0.9 }));
        refl.position.set(-2.38, 0.42, z); g.add(refl);
        var indicator = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xffc832, emissive: 0xffb030, emissiveIntensity: 1.0 }));
        indicator.position.set(1.05, 0.85, z > 0 ? 0.98 : -0.98); g.add(indicator);
        var crease2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 0.02), lineMat);
        crease2.position.set(-0.1, 0.85, z); g.add(crease2);
      });
      var badgeTex = PH.canvasTex(256, 64, function (ctx, w, h) {
        ctx.fillStyle = '#c85a00'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffd23c'; ctx.font = '900 30px Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SCARLET ARROW', w / 2, h / 2);
      });
      var badge = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.28),
        new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.5 }));
      badge.position.set(-2.4, 0.95, 0); badge.rotation.y = -Math.PI / 2; g.add(badge);
      // fuel cap (driver side) + hood shut lines + rocker extension
      var cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12),
        new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 }));
      cap2.rotation.x = Math.PI / 2; cap2.position.set(-1.5, 0.75, 0.98); g.add(cap2);
      [-0.95, 0.95].forEach(function (z) {
        var hoodLine = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.02), lineMat);
        hoodLine.position.set(1.55, 0.82, z); hoodLine.rotation.z = -0.15; g.add(hoodLine);
        var rocker = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), mat(0x7a3400, 0.5));
        rocker.position.set(0, 0.18, z); g.add(rocker);
      });
      // window chrome trim: a bright line under the door glass, both sides
      [-0.97, 0.97].forEach(function (z) {
        var trim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.03),
          new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.95, roughness: 0.2 }));
        trim.position.set(0.05, 0.78, z); g.add(trim);
      });
      g.userData.length = 4.6;
      return g;
    }

    // traffic / police box-body car: 1.9 x 0.72 x 4.4
    var isPolice = kind === 'police';
    var bodyColor = isPolice ? 0xf2f2f2 : color;
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 4.4), mat(bodyColor, isPolice ? 0.4 : 0.55, 0.15));
    body.position.y = 0.72; body.castShadow = true; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.15, metalness: 0.5 }));
    cabin.position.set(0, 1.35, -0.2); cabin.castShadow = true; g.add(cabin);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.0), mat(bodyColor, 0.55, 0.15));
    roof.position.set(0, 1.68, -0.2); g.add(roof);
    // body variants (v7.4): the same kit, four silhouettes — sedan is
    // the base above; hatch shortens the tail, van grows tall with a
    // long roof, pickup drops the rear roof for an open bed.
    var bodyType = opts.bodyType || 'sedan';
    if (bodyType === 'hatch') {
      body.scale.z = 0.88; cabin.position.z = -0.35; roof.position.z = -0.35;
      var hatchGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.06),
        new THREE.MeshStandardMaterial({ map: PH.skyGlassTexture(false), roughness: 0.12, metalness: 0.55 }));
      hatchGlass.position.set(0, 1.3, -2.05); g.add(hatchGlass);
    } else if (bodyType === 'van') {
      body.scale.y = 1.45; body.position.y = 0.95;
      cabin.scale.y = 1.35; cabin.position.y = 1.55; cabin.scale.z = 1.25;
      roof.position.y = 2.05; roof.scale.z = 1.25;
    } else if (bodyType === 'pickup') {
      cabin.scale.z = 0.6; cabin.position.z = 0.55;
      roof.scale.z = 0.6; roof.position.z = 0.55;
      // open bed: low walls around the rear half
      [-0.9, 0.9].forEach(function (x) {
        var wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 1.8), mat(bodyColor, 0.55, 0.15));
        wall.position.set(x, 1.3, -1.3); g.add(wall);
      });
      var tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), mat(bodyColor, 0.55, 0.15));
      tailgate.position.set(0, 1.3, -2.18); g.add(tailgate);
      var load = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.2), mat(0x8a6a42, 0.95));
      load.position.set(0, 1.35, -1.3); g.add(load);
    } else if (bodyType === 'coupe') {
      // sleek two-door: lower roof, cabin shifted back, longer hood
      cabin.scale.y = 0.8; cabin.position.y = 1.28; cabin.position.z = -0.45;
      roof.scale.y = 0.8; roof.position.y = 1.6; roof.position.z = -0.45;
      roof.scale.z = 0.85;
      var hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.1), mat(bodyColor, 0.55, 0.15));
      hood.position.set(0, 1.06, 1.4); g.add(hood);
      var coupeGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.06),
        new THREE.MeshStandardMaterial({ map: PH.skyGlassTexture(false), roughness: 0.12, metalness: 0.55 }));
      coupeGlass.position.set(0, 1.25, -1.85); g.add(coupeGlass);
    } else if (bodyType === 'wagon') {
      // estate: the roof runs the full length with a tall rear glass
      cabin.scale.z = 1.45; cabin.position.z = -0.35;
      roof.scale.z = 1.45; roof.position.z = -0.35;
      var wagonGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06),
        new THREE.MeshStandardMaterial({ map: PH.skyGlassTexture(false), roughness: 0.12, metalness: 0.55 }));
      wagonGlass.position.set(0, 1.3, -2.2); g.add(wagonGlass);
      var wagonRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.4), mat(0x222222, 0.5, 0.6));
      wagonRail.position.set(-0.6, 1.78, -0.35); g.add(wagonRail);
      var wagonRail2 = wagonRail.clone(); wagonRail2.position.x = 0.6; g.add(wagonRail2);
    } else if (bodyType === 'taxi') {
      // yellow cab: checker band down the flanks + a lit roof sign
      var checker = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 4.0),
        new THREE.MeshStandardMaterial({ map: PH.checkerTexture(), roughness: 0.6 }));
      checker.position.set(0.96, 0.75, 0); g.add(checker);
      var checker2 = checker.clone(); checker2.position.x = -0.96; g.add(checker2);
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xffc832, emissive: 0xffb030, emissiveIntensity: 1.4 }));
      sign.position.set(0, 1.85, -0.2); g.add(sign);
      var signText = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.18),
        new THREE.MeshStandardMaterial({ map: PH.signTexture('TAXI', '#14181c', '#ffd23c'), roughness: 0.5 }));
      signText.position.set(0, 1.85, 0.06); g.add(signText);
    }
    // roof rack on some traffic cars (two rails + two cross bars)
    if (!isPolice && PH.R() < 0.3) {
      [-0.6, 0.6].forEach(function (x) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.8), mat(0x222222, 0.5, 0.6));
        rail.position.set(x, 1.78, -0.2); g.add(rail);
      });
      [-0.8, 0.4].forEach(function (z) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.08), mat(0x222222, 0.5, 0.6));
        bar.position.set(0, 1.78, z); g.add(bar);
      });
    }
    // door lines, chrome handles, mirrors
    var dl = new THREE.MeshBasicMaterial({ color: 0x000000 });
    [-0.96, 0.96].forEach(function (x) {
      var ln = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.02), dl);
      ln.position.set(x, 0.75, 0.5); g.add(ln);
      var hd = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 }));
      hd.position.set(x, 0.95, 0.7); g.add(hd);
      var mr = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.06), mat(bodyColor, 0.5));
      mr.position.set(x * 1.05, 1.15, 0.9); g.add(mr);
    });
    // grille
    var grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.08), mat(0x14181c, 0.5));
    grille.position.set(0, 0.55, 2.22); g.add(grille);
    // headlights (warm) + tail lights (red)
    var hlMat = new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffd060, emissiveIntensity: 1.4 });
    var tlMat = new THREE.MeshStandardMaterial({ color: 0xff2a20, emissive: 0xff2010, emissiveIntensity: 1.2 });
    [-0.6, 0.6].forEach(function (x) {
      var h1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), hlMat);
      h1.position.set(x, 0.75, 2.22); g.add(h1);
      var t1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), tlMat);
      t1.position.set(x, 0.75, -2.22); g.add(t1);
    });
    // plates
    var plateNo = opts.plate || ('SB-' + String(1000 + Math.floor(PH.R() * 9000)));
    var pt = PH.plateTexture(plateNo);
    var pm = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.5 });
    var pf = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), pm);
    pf.position.set(0, 0.4, 2.25); g.add(pf);
    var pr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), pm);
    pr.position.set(0, 0.4, -2.25); pr.rotation.y = Math.PI; g.add(pr);
    if (isPolice) {
      // black doors + BAY CITY PD door stickers + roof light bar
      [-0.96, 0.96].forEach(function (x) {
        var door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.55, 1.6), mat(0x14181c, 0.6));
        door.position.set(x, 0.78, 0.2); g.add(door);
      });
      var stickerTex = PH.canvasTex(512, 128, function (c, w, h) {
        c.fillStyle = '#14181c'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#fff'; c.font = '900 52px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('BAY CITY PD', w / 2, h / 2);
      });
      [-0.98, 0.98].forEach(function (x) {
        var st = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42),
          new THREE.MeshStandardMaterial({ map: stickerTex, roughness: 0.6 }));
        st.position.set(x, 0.8, 0.2); st.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(st);
      });
      var bar = new THREE.Group(); bar.position.set(0, 1.78, 0.1);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 2 }));
      red.position.x = -0.4; bar.add(red);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x1020ff, emissiveIntensity: 2 }));
      blue.position.x = 0.4; bar.add(blue);
      g.add(bar);
      g.userData.lightRed = red; g.userData.lightBlue = blue;
    }
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
      g.add(wheel(p[0], p[1], false));
    });
    g.add(carContactShadow(2.4, 4.8));
    g.userData.length = 4.4;
    return g;
  };

  // ---- traffic system: 16 cars on Sunset Blvd + cross streets ----
  PH.Traffic = function (scene) {
    this.cars = [];
    var routes = [];
    // Sunset Blvd two directions
    routes.push({ axis: 'z', fixed: -16.5, from: -165, to: 165, dir: 1 });
    routes.push({ axis: 'z', fixed: -23.5, from: 165, to: -165, dir: -1 });
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) {
      routes.push({ axis: 'x', fixed: z - 3, from: -5, to: 165, dir: 1 });
      routes.push({ axis: 'x', fixed: z + 3, from: 165, to: -5, dir: -1 });
    });
    for (var i = 0; i < 16; i++) {
      var route = routes[i % routes.length];
      // v7.4 round 2: seven silhouettes now — sedan, hatch, van,
      // pickup, coupe, wagon and a yellow taxi — plus a wider colour
      // roll and per-car speeds from a crawl (5) to a hurry (13), so
      // the street never reads as sixteen identical boxes
      var types = ['sedan', 'sedan', 'hatch', 'van', 'pickup', 'coupe', 'wagon', 'taxi'];
      var carOpts = { kind: 'traffic', bodyType: types[i % types.length] };
      if (types[i % types.length] === 'taxi') carOpts.color = 0xffc832;
      else carOpts.color = PH.pick([0xd83a2a, 0x2a6fd8, 0xf2f2f2, 0xffc832, 0x0e7a7a, 0x8a5aff, 0x1a1a1a, 0xff6ab0, 0x37a05a, 0xc0c8d0, 0x37d67a, 0xff8c42, 0x5a3a8a, 0x2ee6c8]);
      var car = PH.makeCar(carOpts);
      var s = PH.rand(0, 1);
      var pos = route.from + (route.to - route.from) * s;
      if (route.axis === 'z') { car.position.set(route.fixed, 0, pos); car.rotation.y = route.dir > 0 ? 0 : Math.PI; }
      else { car.position.set(pos, 0, route.fixed); car.rotation.y = route.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      scene.add(car);
      this.cars.push({ mesh: car, route: route, speed: PH.rand(5, 13), frozen: false });
    }
  };
  PH.Traffic.prototype.update = function (dt) {
    this.cars.forEach(function (c) {
      if (c.frozen) return;
      var r = c.route;
      var step = c.speed * r.dir * dt;
      if (r.axis === 'z') {
        c.mesh.position.z += step;
        if (c.mesh.position.z > 168) c.mesh.position.z = -168;
        if (c.mesh.position.z < -168) c.mesh.position.z = 168;
      } else {
        c.mesh.position.x += step;
        if (c.mesh.position.x > 168) c.mesh.position.x = -8;
        if (c.mesh.position.x < -8) c.mesh.position.x = 168;
      }
    });
  };
  PH.Traffic.prototype.freeze = function (positions) {
    // positions: [{x,z,heading}] — place cars exactly, stop them.
    this.cars.forEach(function (c, i) {
      var p = positions[i];
      if (!p) { c.frozen = true; return; }
      c.frozen = true;
      c.mesh.position.set(p.x, 0, p.z);
      c.mesh.rotation.y = p.heading || 0;
    });
  };

  // ---- city crowd: 130 sidewalk walkers + 12 on the pier ----
  PH.CityCrowd = function (scene) {
    this.people = [];
    var lanes = [
      { axis: 'z', fixed: -29.2, from: -165, to: 165 },
      { axis: 'z', fixed: -11.2, from: -165, to: 165 }
    ];
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) {
      lanes.push({ axis: 'x', fixed: z - 4.5, from: -8, to: 165 });
      lanes.push({ axis: 'x', fixed: z + 4.5, from: -8, to: 165 });
    });
    for (var i = 0; i < 130; i++) {
      var lane = lanes[i % lanes.length];
      // round 2: one walker in four carries something readable — a
      // cap, a backpack, sunglasses or an open jacket — so the crowd
      // is not 130 identical shirts
      var roll = PH.R();
      var pOpts = {};
      if (roll < 0.12) pOpts.cap = true;
      else if (roll < 0.22) pOpts.backpack = true;
      else if (roll < 0.32) pOpts.sunglasses = true;
      else if (roll < 0.4) pOpts.jacket = true;
      if (roll < 0.12) pOpts.capColor = PH.pick([0xc81e1e, 0x0e7a7a, 0xffc832, 0x2a6fd8, 0x1a1a1a]);
      var p = PH.makePerson(pOpts);
      var s = PH.rand(0, 1);
      var pos = lane.from + (lane.to - lane.from) * s;
      var dir = PH.R() < 0.5 ? 1 : -1;
      if (lane.axis === 'z') { p.group.position.set(lane.fixed, 0, pos); p.group.rotation.y = dir > 0 ? 0 : Math.PI; }
      else { p.group.position.set(pos, 0, lane.fixed); p.group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      scene.add(p.group);
      this.people.push({ p: p, lane: lane, dir: dir, speed: PH.rand(1.1, 1.9), flee: false, home: p.group.position.clone() });
    }
    // 12 pier walkers
    this.pier = [];
    for (var j = 0; j < 12; j++) {
      var pp = PH.makePerson({});
      pp.group.position.set(PH.rand(-84, -32), 1.35, PH.rand(36.5, 43.5));
      pp.group.rotation.y = PH.rand(0, Math.PI * 2);
      scene.add(pp.group);
      this.pier.push({ p: pp, x0: pp.group.position.x, dir: PH.R() < 0.5 ? 1 : -1, speed: PH.rand(1.0, 1.6) });
    }
  };
  PH.CityCrowd.prototype.update = function (dt, t, threat) {
    this.people.forEach(function (w) {
      var pos = w.p.group.position;
      var fleeing = false;
      if (threat && threat.active) {
        var dx = pos.x - threat.x, dz = pos.z - threat.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 26) fleeing = true;
      }
      if (fleeing) {
        var dx2 = pos.x - threat.x, dz2 = pos.z - threat.z;
        var len = Math.max(0.01, Math.sqrt(dx2 * dx2 + dz2 * dz2));
        w.p.group.rotation.y = Math.atan2(dx2 / len, dz2 / len);
        pos.x += (dx2 / len) * 4.4 * dt;
        pos.z += (dz2 / len) * 4.4 * dt;
        w.p.setPose('run', t, 9);
      } else {
        var step = w.speed * w.dir * dt;
        if (w.lane.axis === 'z') {
          pos.z += step;
          if (pos.z > 168) { pos.z = 168; w.dir = -1; w.p.group.rotation.y = Math.PI; }
          if (pos.z < -168) { pos.z = -168; w.dir = 1; w.p.group.rotation.y = 0; }
        } else {
          pos.x += step;
          if (pos.x > 168) { pos.x = 168; w.dir = -1; w.p.group.rotation.y = -Math.PI / 2; }
          if (pos.x < -8) { pos.x = -8; w.dir = 1; w.p.group.rotation.y = Math.PI / 2; }
        }
        w.p.setPose('walk', t, 6);
      }
    });
    this.pier.forEach(function (w) {
      var pos = w.p.group.position;
      pos.x += w.dir * w.speed * dt;
      if (pos.x > -32) w.dir = -1;
      if (pos.x < -84) w.dir = 1;
      w.p.group.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      w.p.setPose('walk', t, 6);
    });
  };

  // ---- beach crowd: ~38 NPCs, 9 activities ----
  PH.BeachCrowd = function (scene) {
    this.members = [];
    var self = this;
    function add(pose, x, z, y, opts) {
      var p = PH.makePerson(opts || {});
      p.group.position.set(x, y || 0, z);
      p.group.rotation.y = PH.rand(0, Math.PI * 2);
      scene.add(p.group);
      var m = { p: p, pose: pose, home: p.group.position.clone(), homeRot: p.group.rotation.y, phase: PH.rand(0, 6.28) };
      self.members.push(m);
      return m;
    }
    // 6 sunbathers on towels (lying) — kept off the waterline
    // (x >= -88): a body lying at the shore's edge read as debris in
    // the shot-3 frame, so the towels sit up the beach with a bright
    // towel under every sunbather
    for (var i = 0; i < 6; i++) {
      var lx = PH.rand(-88, -45), lz = PH.rand(-130, 130);
      var lm = add('lying', lx, lz);
      var ltowel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2),
        mat(PH.pick([0xff3b30, 0xffc832, 0x2a9df4, 0xff6ab0, 0x37d67a]), 0.95));
      ltowel.rotation.x = -Math.PI / 2; ltowel.rotation.z = lm.p.group.rotation.y;
      ltowel.position.set(lx, 0.07, lz);
      scene.add(ltowel);
    }
    // 5 swimmers in the sea — well out from the shore (x <= -118),
    // so no swimmer drifts into the shot-3 foreground as a white blob
    for (var j = 0; j < 5; j++) add('swim', PH.rand(-150, -118), PH.rand(-120, 120), 0.15);
    // 3 surfers with boards
    for (var k = 0; k < 3; k++) {
      var s = add('surf', PH.rand(-160, -115), PH.rand(-100, 100), 0.15);
      var board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 2.4), mat(PH.pick([0xff3b30, 0xffc832, 0x2a9df4]), 0.5));
      board.position.set(0, -0.1, 0);
      s.p.group.add(board);
      s.board = board;
    }
    // 4 volleyball players (2v2) at the court
    [[-61, -10], [-55, -6], [-61, -6], [-55, -10]].forEach(function (pt) { add('volley', pt[0], pt[1]); });
    // 4 joggers on the X -42 path
    for (var jg = 0; jg < 4; jg++) add('run', -42, PH.rand(-140, 140));
    // 6 kids digging at sandcastles (scale ~0.6)
    for (var kd = 0; kd < 6; kd++) add('dig', PH.rand(-90, -50), PH.rand(-120, 120), 0, { scale: 0.6 });
    // 3 fishers at the pier end (rod + line)
    for (var f = 0; f < 3; f++) {
      var fm = add('fish', -84 + f * 2.5, 37.5, 1.35);
      fm.p.group.rotation.y = -Math.PI / 2;
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.6, 6), mat(0x4a2a10, 0.8));
      rod.position.set(0, 1.4, 0.5); rod.rotation.x = 0.9;
      fm.p.group.add(rod);
      var line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.2, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      line.position.set(0, 0.9, 1.4); line.rotation.x = 0.4;
      fm.p.group.add(line);
    }
    // 3 sitters on pier benches
    [[-70, 43.4], [-50, 43.4], [-60, 43.4]].forEach(function (pt) {
      var sm = add('sit', pt[0], pt[1], 1.35);
      sm.p.group.rotation.y = Math.PI;
    });
    // 4 selfie takers at the shore
    for (var sf = 0; sf < 4; sf++) add('selfie', PH.rand(-100, -90), PH.rand(-100, 100));
    // round 2: 2 kids with buckets at the sandcastles + a kite flyer
    // + a beach dog — the sand gets life beyond the towel rows
    for (var kd2 = 0; kd2 < 2; kd2++) {
      var kid = add('dig', PH.rand(-88, -60), PH.rand(-60, 60), 0, { scale: 0.6, cap: true });
      var bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 8), mat(PH.pick([0xff3b30, 0x2a9df4, 0xffc832]), 0.7));
      bucket.position.set(0.5, 0.15, 0.4);
      kid.p.group.add(bucket);
    }
    var kiteMan = add('kite', -82, 30);
    var kite = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshStandardMaterial({ map: PH.kiteTexture(), side: THREE.DoubleSide, roughness: 0.8 }));
    kite.position.set(-82, 7.5, 30);
    kite.rotation.z = Math.PI / 4;
    scene.add(kite);
    this.kite = kite;
    this.kiteHome = { x: -82, z: 30 };
    var dog = PH.makeDog();
    dog.position.set(-70, 0, -20);
    scene.add(dog);
    this.dog = dog;
    this.dogPhase = PH.rand(0, 6.28);
  };
  PH.BeachCrowd.prototype.update = function (dt, t, threat) {
    this.members.forEach(function (m) {
      var pos = m.p.group.position;
      var onLand = m.pose !== 'swim' && m.pose !== 'surf';
      var fleeing = false;
      if (threat && threat.active && onLand) {
        var dx = pos.x - threat.x, dz = pos.z - threat.z;
        if (Math.sqrt(dx * dx + dz * dz) < 45) fleeing = true;
      }
      if (fleeing) {
        // run west, toward the sea / pier
        pos.x -= 4.6 * dt;
        m.p.group.rotation.y = -Math.PI / 2;
        m.p.setPose('run', t, 9);
        return;
      }
      if (m.pose === 'run') {
        pos.z += 3.4 * dt;
        if (pos.z > 150) pos.z = -150;
        m.p.group.rotation.y = 0;
        m.p.setPose('run', t, 8);
      } else if (m.pose === 'swim') {
        pos.x += Math.sin(t * 0.5 + m.phase) * 0.3 * dt;
        pos.z += Math.cos(t * 0.4 + m.phase) * 0.4 * dt;
        m.p.setPose('swim', t, 5);
      } else if (m.pose === 'surf') {
        pos.x += Math.sin(t * 0.3 + m.phase) * 0.5 * dt;
        m.p.setPose('surf', t, 4);
      } else {
        // drift back home after a scare
        var hx = m.home.x - pos.x, hz = m.home.z - pos.z;
        var hd = Math.sqrt(hx * hx + hz * hz);
        if (hd > 0.5) {
          pos.x += (hx / hd) * 1.2 * dt;
          pos.z += (hz / hd) * 1.2 * dt;
          m.p.group.rotation.y = Math.atan2(hx / hd, hz / hd);
          m.p.setPose('walk', t, 6);
        } else {
          m.p.group.rotation.y = m.homeRot;
          m.p.setPose(m.pose, t, 5);
        }
      }
    });
    // the kite bobs and sways above its flyer; the dog trots a loop
    // along the wet sand, tail up, chasing nothing in particular
    if (this.kite) {
      this.kite.position.y = 7.5 + Math.sin(t * 0.9) * 0.7;
      this.kite.position.x = this.kiteHome.x + Math.sin(t * 0.5) * 1.2;
      this.kite.rotation.y = Math.sin(t * 0.7) * 0.4;
    }
    if (this.dog) {
      var da = t * 0.12 + this.dogPhase;
      this.dog.position.set(-70 + Math.cos(da) * 18, 0, -20 + Math.sin(da) * 40);
      this.dog.rotation.y = Math.atan2(Math.cos(da + 0.1) - Math.cos(da), Math.sin(da + 0.1) - Math.sin(da));
      if (this.dog.userData.tail) this.dog.userData.tail.rotation.y = Math.sin(t * 8) * 0.5;
      if (this.dog.userData.legL) this.dog.userData.legL.rotation.x = Math.sin(t * 10) * 0.6;
      if (this.dog.userData.legR) this.dog.userData.legR.rotation.x = -Math.sin(t * 10) * 0.6;
    }
  };

  // ---- beach dog: a small low-poly dog (body, head, ears, tail, legs)
  PH.makeDog = function () {
    var g = new THREE.Group();
    var coat = mat(0x8a5a30, 0.9);
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.28), coat);
    body.position.y = 0.42; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.26), coat);
    head.position.set(0.45, 0.62, 0); g.add(head);
    var snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.14), mat(0x6a4020, 0.9));
    snout.position.set(0.64, 0.56, 0); g.add(snout);
    [-0.09, 0.09].forEach(function (z) {
      var ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.06), mat(0x5a3418, 0.9));
      ear.position.set(0.38, 0.78, z); g.add(ear);
    });
    var tail = new THREE.Group(); tail.position.set(-0.38, 0.52, 0);
    var tailM = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), coat);
    tailM.position.x = -0.15; tail.add(tailM);
    tail.rotation.z = 0.5; g.add(tail);
    var legL = new THREE.Group(); legL.position.set(0.22, 0.3, 0);
    var legR = new THREE.Group(); legR.position.set(-0.22, 0.3, 0);
    [legL, legR].forEach(function (leg) {
      [-0.1, 0.1].forEach(function (z) {
        var lm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.09), coat);
        lm.position.set(0, -0.15, z); leg.add(lm);
      });
    });
    g.add(legL, legR);
    g.userData.tail = tail; g.userData.legL = legL; g.userData.legR = legR;
    return g;
  };

  // ---- police: 3 officers + 3 cruisers ----
  PH.Police = function (scene) {
    this.officers = [];
    this.cruisers = [];
    var plates = ['PD-104', 'PD-111', 'PD-118'];
    for (var i = 0; i < 3; i++) {
      var car = PH.makeCar({ kind: 'police', plate: plates[i] });
      scene.add(car);
      this.cruisers.push(car);
      // round 2: white helmet + hi-vis vest + lighter skin, so an
      // officer is a readable person at dusk instead of a dark blob
      var off = PH.makePerson({ shirt: 0x1a2a4a, pants: 0x1a2a4a, skin: 0xf2c89b, helmet: true, vest: true });
      scene.add(off.group);
      this.officers.push(off);
    }
  };
  PH.Police.prototype.update = function (dt, t, wanted) {
    // light bars flash alternately
    this.cruisers.forEach(function (c, i) {
      var on = Math.floor(t * 4 + i) % 2 === 0;
      if (c.userData.lightRed) {
        c.userData.lightRed.material.emissiveIntensity = on ? 2.5 : 0.2;
        c.userData.lightBlue.material.emissiveIntensity = on ? 0.2 : 2.5;
      }
    });
    this.officers.forEach(function (o, i) {
      o.setPose('aim', t + i, 5);
    });
  };

  // ---- police helicopter ----
  // v7.5: the helicopter is built in heli.js now (rounded body, curved
  // cockpit glass, blur-disc rotors tilted toward travel, tube skids).
  // This function keeps its old contract (userData.rotor / tailRotor /
  // beam) and delegates to the new builder when it is loaded; the mesh
  // code below stays as the fallback when heli.js is absent.
  PH.makeHeli = function () {
    if (PH.makeHeli75) return PH.makeHeli75();
    var g = new THREE.Group();
    var white = mat(0xf2f2f2, 0.4);
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.2, 4, 10), white);
    body.rotation.x = Math.PI / 2; body.castShadow = true; g.add(body);
    var belly = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 3.2), mat(0x2040a0, 0.5));
    belly.position.y = -0.75; g.add(belly);
    var cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.12, metalness: 0.6 }));
    cockpit.position.set(0, -0.15, 2.1); cockpit.scale.set(1, 0.75, 0.9); g.add(cockpit);
    [-0.95, 0.95].forEach(function (x) {
      var win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.12, metalness: 0.6 }));
      win.position.set(x, 0.1, 0.6); g.add(win);
    });
    // tail + fin + tail rotor
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 4.2, 8), white);
    tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.25, -3.4); g.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.9), mat(0x2040a0, 0.5));
    fin.position.set(0, 0.9, -5.3); g.add(fin);
    var tailRotor = new THREE.Group(); tailRotor.position.set(0.35, 0.3, -5.3);
    var tr1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.1), mat(0x222222, 0.5));
    var tr2 = tr1.clone(); tr2.rotation.z = Math.PI / 2;
    tailRotor.add(tr1, tr2); g.add(tailRotor);
    // main rotor, two blue-tipped blades
    var rotor = new THREE.Group(); rotor.position.y = 1.25;
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 8), mat(0x222222, 0.5));
    rotor.add(hub);
    [-1, 1].forEach(function (s) {
      var blade = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.06, 0.45), mat(0x222222, 0.5));
      blade.position.x = s * 3.9; rotor.add(blade);
      var tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.46), mat(0x2040ff, 0.5));
      tip.position.x = s * 7.3; rotor.add(tip);
    });
    g.add(rotor);
    // skids
    [-0.8, 0.8].forEach(function (x) {
      var skid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.2), mat(0x333333, 0.5));
      skid.position.set(x, -1.35, 0); g.add(skid);
      [-1.1, 1.1].forEach(function (z) {
        var strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), mat(0x333333, 0.5));
        strut.position.set(x, -1.1, z); g.add(strut);
      });
    });
    // searchlight + long translucent beam (reaches the ground)
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffee88, emissiveIntensity: 2 }));
    lamp.position.set(0, -1.1, 1.6); g.add(lamp);
    var beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.rotation.x = Math.PI; // cone opens downward
    beam.position.set(0, -18, 1.6);
    g.add(beam);
    // POLICE stickers both sides
    var stTex = PH.canvasTex(512, 128, function (c, w, h) {
      c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2040a0'; c.font = '900 64px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('POLICE', w / 2, h / 2);
    });
    [-1.12, 1.12].forEach(function (x) {
      var st = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55),
        new THREE.MeshStandardMaterial({ map: stTex, roughness: 0.5 }));
      st.position.set(x, 0.1, 0); st.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(st);
    });
    g.userData.rotor = rotor;
    g.userData.tailRotor = tailRotor;
    g.userData.beam = beam;
    return g;
  };

  // ---- muzzle flash: star sprite + white core + warm point light ----
  // v7.4: a short tongue of flame + a small glow, NOT an explosion.
  // The v7.3 flash (3.0-unit star, light 15) filled the middle of
  // shot 4; the new one is ~1/3 the size and fades fast.
  PH.MuzzleFlash = function (scene) {
    var g = new THREE.Group();
    var tex = PH.glowTexture();
    var star = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    star.scale.set(1.1, 1.1, 1);
    var core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffffff }));
    core.scale.set(0.55, 0.55, 1);
    var light = new THREE.PointLight(0xffc060, 6, 5);
    g.add(star, core, light);
    g.visible = false;
    scene.add(g);
    this.group = g; this.star = star; this.core = core; this.light = light;
    this.held = false;
  };
  PH.MuzzleFlash.prototype.place = function (shooterPos, heading, held) {
    this.held = !!held;
    this.group.visible = true;
    // v7.3: the flash sits 1.1 units ahead AND 0.42 to the shooter's
    // right (the gun hand) — dead-centre 0.7 ahead put the star
    // exactly behind the shooter's torso from a rear camera, so the
    // depth test hid the whole flash in shot 4.
    var fx = shooterPos.x + Math.sin(heading) * 1.1 + Math.cos(heading) * 0.42;
    var fz = shooterPos.z + Math.cos(heading) * 1.1 - Math.sin(heading) * 0.42;
    this.group.position.set(fx, 1.45, fz);
  };
  PH.MuzzleFlash.prototype.update = function (t) {
    if (!this.group.visible) return;
    if (this.held) {
      this.star.material.opacity = 0.9; this.core.material.opacity = 0.9;
      this.light.intensity = 6;
      return;
    }
    var flick = (Math.sin(t * 55) > 0) ? 1 : 0.25;
    this.star.material.opacity = flick;
    this.core.material.opacity = flick;
    this.light.intensity = 6 * flick;
  };
  PH.MuzzleFlash.prototype.hide = function () { this.group.visible = false; };

  // ---- Mateo / Kira (v7.3, procedural) ----
  // The GLB loader is gone (see core.js + mateo.js). PH.loadMateo now
  // lives in mateo.js and builds both characters from code primitives;
  // sim.js keeps only this pointer so older call sites stay readable.
  // Characters face +Z, so forwardOffset is 0 everywhere.
})();
