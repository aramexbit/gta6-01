// PIER HEAT — Sunset Bay v7.5
// herocar.js — the Scarlet Arrow's rear, built from how the real car
// works (how-it-works-v75.md §5 + real-refs-v75.md §2).
//
// WHY IT LOOKS THIS WAY: a fastback's tail is not a flat wall. The roof
// line curves down into a rounded stern, so the rear reads as one
// continuous curve from the roof to the bumper. The tail lamps are a
// PAIR of round units with red LED rings — they are the car's signature
// from behind, and they signal (brake = bright). The black mesh vent
// on the rear deck lets hot air out of the engine bay; the little lip
// spoiler is part of the tail itself (it presses the rear down at
// speed, like the diffuser under the bumper that speeds the air
// underneath). Glossy clearcoat paint mirrors the sky, so the flanks
// carry the sunset instead of one flat orange. The side intake behind
// the door feeds the mid-engine's air. Black multi-spoke wheels with
// low-profile tyres finish the stance.
//
// WHAT THIS FILE BUILDS, and how sim.js uses it:
//   PH.heroPaint() — glossy clearcoat orange for the hero body.
//   PH.buildHeroRear(bodyMat) — the curved stern: a dome shell, round
//     LED tail lamps, mesh deck vent, integrated spoiler lip, mesh rear
//     bumper, twin exhausts and the rear plate, all placed ON the dome
//     surface by domeX(). sim.js skips its flat rear panel, tail bar,
//     fog lamps, strut spoiler, tail handle, old bumper/diffuser and
//     rear plate when this exists, and adds this group instead.
//   PH.buildHeroWheel(x, z) — black 7-spoke wheel, low-profile tyre.
//   PH.buildHeroIntake(side) — the side intake scoop behind the door.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // Glossy paint: a clearcoat physical material. The clearcoat is the
  // transparent top layer real car paint carries — it is what makes the
  // flanks mirror the sky and the sun instead of going matte orange.
  // (MeshPhysicalMaterial is used when the vendored three.js has it;
  // the fallback keeps the same colour on older builds.)
  PH.heroPaint = function () {
    var Mat = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
    var m = new Mat({ color: 0xd86008, roughness: 0.3, metalness: 0.55 });
    if (m.clearcoat != null) { m.clearcoat = 1; m.clearcoatRoughness = 0.16; }
    return m;
  };

  // Black mesh canvas: a fine dark grid, for the deck vent and the rear
  // bumper — the perforated look of a real vent, not a flat black slab.
  PH.heroMeshTexture = function () {
    return PH.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#101216'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2c3038';
      for (var y = 0; y < h; y += 8) {
        for (var x = 0; x < w; x += 8) {
          g.fillRect(x + 1, y + 1, 5, 5);
        }
      }
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, 0, w, 3);
    });
  };

  // The curved stern. Car-local coords: the rear is -X, the car is
  // 1.9 wide (z +/-0.95), the tail face spans y 0.28..1.05. The dome is
  // a hemisphere with its pole pointing rearward, squashed so it bulges
  // 0.45 out, spans 0.5 up/down from its centre and 1.0 across — one
  // continuous curve from the roofline down to the bumper, exactly the
  // fastback tail the flat panel used to fake.
  PH.buildHeroRear = function (bodyMat) {
    var g = new THREE.Group();
    var meshTex = PH.heroMeshTexture();
    var meshMat = new THREE.MeshStandardMaterial({ map: meshTex, roughness: 0.6, metalness: 0.4 });

    // The dome: a top hemisphere (pole +Y) rotated so the pole points
    // -X (rearward). Scale is local: local X maps to world Y (height),
    // local Y maps to world -X (bulge), local Z stays world Z (width).
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      bodyMat);
    dome.rotation.z = Math.PI / 2;
    dome.scale.set(0.5, 0.45, 1.0);
    dome.position.set(-2.28, 0.62, 0);
    dome.castShadow = true;
    g.add(dome);

    // Where the dome's surface sits at a given (y, z): the dome is an
    // ellipsoid centred at (-2.28, 0.62, 0) with radii 0.45 (x), 0.5
    // (y), 1.0 (z). Every lamp, the plate and the exhausts are placed
    // with this, so they sit ON the curve instead of floating in front
    // of it or sinking into it.
    function domeX(y, z) {
      var dy = (y - 0.62) / 0.5, dz = z / 1.0;
      var q = 1 - dy * dy - dz * dz;
      if (q <= 0) return -2.28;
      return -2.28 - 0.45 * Math.sqrt(q);
    }

    // Round LED tail lamps, one per side: a red ring (the LED halo) + a
    // bright red disc (the lamp) + a soft glow sprite, all tilted to
    // face rearward off the dome's curve. Two round lamps, not a bar —
    // the pair is the car's signature from behind.
    // v7.5 rev 2: the lamps are BRIGHT now — the first render showed
    // the rear as a dark blob from the chase camera (the tail faces
    // away from the sunset, so it lives in shade). The rings and discs
    // are emissive enough to read as lit LEDs even in shade, and the
    // glow sprites are bigger, so the tail signals at dusk.
    var lampRingMat = new THREE.MeshStandardMaterial({
      color: 0xff2a20, emissive: 0xff2010, emissiveIntensity: 2.8, roughness: 0.3
    });
    var lampDiscMat = new THREE.MeshStandardMaterial({
      color: 0xff5040, emissive: 0xff3020, emissiveIntensity: 3.0, roughness: 0.2
    });
    [-0.62, 0.62].forEach(function (z) {
      var lx = domeX(0.72, z) - 0.02;
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), lampRingMat);
      ring.rotation.y = Math.PI / 2; // torus faces -X, rearward
      ring.position.set(lx, 0.72, z);
      g.add(ring);
      var disc = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), lampDiscMat);
      disc.rotation.y = -Math.PI / 2;
      disc.position.set(lx - 0.02, 0.72, z);
      g.add(disc);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: PH.glowTexture(), transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(1.15, 1.15, 1);
      glow.position.set(lx - 0.06, 0.72, z);
      g.add(glow);
      // small round reverse lamp tucked under each tail lamp
      var rev = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10),
        new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0xd8d8d8, emissiveIntensity: 0.7 }));
      rev.rotation.y = -Math.PI / 2;
      rev.position.set(domeX(0.5, z) - 0.02, 0.5, z);
      g.add(rev);
    });

    // Mesh vent on the rear deck: the black perforated panel behind the
    // rear window, sloping down with the fastback line toward the tail.
    // Hot air leaves the engine bay here — that is why it is mesh, and
    // why it sits on the deck instead of the flat tail.
    var vent = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.5), meshMat);
    vent.position.set(-1.3, 0.97, 0);
    vent.rotation.z = 0.2; // follows the deck's downward slope
    g.add(vent);
    // a thin body-colour frame around the vent, so it reads as a fitted
    // panel rather than a black sticker
    var ventFrame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.02, 1.56), bodyMat);
    ventFrame.position.set(-1.3, 0.94, 0);
    ventFrame.rotation.z = 0.2;
    g.add(ventFrame);

    // Integrated spoiler lip: a thin blade growing out of the dome's top
    // edge, no struts — it is part of the tail, pressing the rear down
    // at speed. It sits right where the dome curves over, tilted a
    // touch upward toward the rear.
    var lip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 1.9), bodyMat);
    lip.position.set(-2.42, 1.1, 0);
    lip.rotation.z = 0.12;
    lip.castShadow = true;
    g.add(lip);
    // a dark under-edge on the lip, so its thin profile reads at dusk
    var lipEdge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 1.86),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.5 }));
    lipEdge.position.set(-2.44, 1.06, 0);
    lipEdge.rotation.z = 0.12;
    g.add(lipEdge);

    // Mesh rear bumper: the dark perforated valance tucked under the
    // dome's curve, with the diffuser's job — the air under the car
    // exits here. It sits low, mostly under the bulge, showing at the
    // corners and as a dark line beneath the tail.
    var bumper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 1.9), meshMat);
    bumper.position.set(-2.28, 0.2, 0);
    g.add(bumper);

    // Twin chrome exhausts, poking out of the dome's lower curve.
    [-0.45, 0.45].forEach(function (z) {
      var ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10),
        new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.2 }));
      ex.rotation.z = Math.PI / 2;
      ex.position.set(domeX(0.32, z) - 0.05, 0.32, z);
      g.add(ex);
      var exDark = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10),
        new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.6 }));
      exDark.rotation.z = Math.PI / 2;
      exDark.position.set(domeX(0.32, z) - 0.16, 0.32, z);
      g.add(exDark);
    });

    // Rear plate, on the dome's curve (the old plate at x -2.4 would
    // sink inside the bulge, so the rear assembly carries its own).
    var plateMat = new THREE.MeshStandardMaterial({ map: PH.plateTexture('SUN-8821'), roughness: 0.5 });
    var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), plateMat);
    plate.position.set(domeX(0.35, 0) - 0.02, 0.35, 0);
    plate.rotation.y = -Math.PI / 2;
    g.add(plate);

    // v7.5 rev 2: the tail's extra details, all on the dome's curve.
    // Third brake light: a thin red LED strip across the spoiler lip's
    // rear edge — the high stop lamp every fastback wears, so the car
    // signals from above as well as from its round lamps.
    var thirdBrake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xff2010, emissive: 0xff2010, emissiveIntensity: 2.6, roughness: 0.3 }));
    thirdBrake.position.set(-2.68, 1.14, 0);
    thirdBrake.rotation.z = 0.12;
    g.add(thirdBrake);
    // Tail badge: SCARLET ARROW in small chrome letters across the
    // dome between the lamps — the name the crew calls the car.
    var badgeTex = PH.canvasTex(256, 48, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#e8e8f0';
      c.font = '900 26px Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('SCARLET ARROW', w / 2, h / 2);
    });
    var badge = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.16),
      new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true, depthWrite: false }));
    badge.position.set(domeX(0.72, 0) - 0.02, 0.72, 0);
    badge.rotation.y = -Math.PI / 2;
    g.add(badge);
    // Diffuser fins: three vertical blades under the rear bumper that
    // straighten the air leaving under the car — the race-car tell
    // under the tail, visible from the chase camera at street level.
    [-0.5, 0, 0.5].forEach(function (z) {
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.5, metalness: 0.4 }));
      fin.position.set(-2.32, 0.14, z);
      g.add(fin);
    });
    // Rear window louvre: thin horizontal slats over the rear glass,
    // the 80s fastback detail that breaks the big rear window into
    // bands and shades the cabin from the low sun behind.
    for (var lv = 0; lv < 4; lv++) {
      var slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x1a1e22, roughness: 0.5 }));
      slat.position.set(-1.95 - lv * 0.14, 0.98 + lv * 0.05, 0);
      slat.rotation.z = 0.35;
      g.add(slat);
    }

    return g;
  };

  // Black multi-spoke wheel: seven thin spokes on a dark rim, low-
  // profile tyre, orange centre cap. Seven spokes read as a performance
  // wheel at screenshot distance; five silver spokes read as a hubcap.
  PH.buildHeroWheel = function (x, z) {
    var w = new THREE.Group();
    w.position.set(x, 0.36, z);
    var tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.24, 14),
      new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }));
    tyre.rotation.z = Math.PI / 2;
    w.add(tyre);
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 }));
    rim.rotation.z = Math.PI / 2;
    w.add(rim);
    for (var s = 0; s < 7; s++) {
      var a = (s / 7) * Math.PI * 2;
      var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.85, roughness: 0.3 }));
      spoke.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.13);
      spoke.rotation.z = a;
      w.add(spoke);
      var spoke2 = spoke.clone(); spoke2.position.z = -0.13;
      w.add(spoke2);
    }
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0xc85a00, metalness: 0.7, roughness: 0.3 }));
    cap.rotation.z = Math.PI / 2;
    w.add(cap);
    return w;
  };

  // Side intake behind the door: the mid-engine breathes here. A dark
  // recessed scoop with a mesh grille and a body-colour lip above it,
  // sitting on the flank just ahead of the rear wheel.
  PH.buildHeroIntake = function (side) {
    var g = new THREE.Group();
    var meshMat = new THREE.MeshStandardMaterial({ map: PH.heroMeshTexture(), roughness: 0.6, metalness: 0.4 });
    var scoop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.07), meshMat);
    scoop.position.set(-0.55, 0.78, side * 0.97);
    scoop.rotation.z = -0.12; // slanted, sweeping back toward the wheel
    g.add(scoop);
    var lip = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xd86008, roughness: 0.3, metalness: 0.55 }));
    lip.position.set(-0.55, 0.97, side * 0.97);
    lip.rotation.z = -0.12;
    g.add(lip);
    return g;
  };

  // The front, to match the rear: round LED daytime running lamps (the
  // same round-lamp language as the tail, so the car is recognisable
  // from either end), a wide mesh grille and a deeper front splitter
  // with winglets. A fastback's face is a low nose with round eyes —
  // the old rectangular headlight boxes read as a sedan's.
  PH.buildHeroFront = function (bodyMat) {
    var g = new THREE.Group();
    var meshMat = new THREE.MeshStandardMaterial({ map: PH.heroMeshTexture(), roughness: 0.6, metalness: 0.4 });
    // wide mesh grille across the nose, low and wide — the engine
    // breathes through it, and the mesh is the same perforated panel
    // as the rear deck vent, so the car matches front to back
    var grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 1.5), meshMat);
    grille.position.set(2.3, 0.45, 0);
    g.add(grille);
    // a body-colour frame around the grille, so it reads as a fitted
    // intake rather than a black sticker on the nose
    var grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 1.56), bodyMat);
    grilleFrame.position.set(2.28, 0.45, 0);
    g.add(grilleFrame);
    // deeper front splitter: a wide low blade under the nose with a
    // winglet at each end — it presses the front down at speed and
    // gives the nose its sharp lower edge
    var split = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.5, metalness: 0.4 }));
    split.position.set(2.2, 0.14, 0);
    g.add(split);
    [-0.95, 0.95].forEach(function (z) {
      var winglet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.5, metalness: 0.4 }));
      winglet.position.set(2.2, 0.22, z);
      g.add(winglet);
    });
    // round LED daytime running lamps, one per side: a white ring
    // (the LED halo) + a bright lens + a soft glow, tilted to face
    // forward off the nose's curve — the car's eyes, matching the
    // round tail lamps at the other end
    var drlRingMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c0, emissive: 0xffe6a0, emissiveIntensity: 2.2, roughness: 0.3
    });
    var drlLensMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e0, emissive: 0xfff0b0, emissiveIntensity: 2.6, roughness: 0.2
    });
    [-0.6, 0.6].forEach(function (z) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20), drlRingMat);
      ring.position.set(2.32, 0.64, z);
      ring.rotation.y = Math.PI / 2; // face forward (+X)
      g.add(ring);
      var lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), drlLensMat);
      lens.position.set(2.34, 0.64, z);
      lens.rotation.y = Math.PI / 2;
      g.add(lens);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: PH.glowTexture(), transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(0.9, 0.9, 1);
      glow.position.set(2.38, 0.64, z);
      g.add(glow);
      // small amber indicator tucked under each DRL
      var ind = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10),
        new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff9010, emissiveIntensity: 1.6 }));
      ind.position.set(2.34, 0.44, z);
      ind.rotation.y = Math.PI / 2;
      g.add(ind);
    });
    return g;
  };

  // Detailed side mirror: a stalk, a body-colour housing, a glass
  // face that reflects the sky, and an amber repeater strip on its
  // outer edge — the way a real mirror reads from the side, not a
  // body-colour box pasted on the door.
  PH.buildHeroMirror = function (side) {
    var g = new THREE.Group();
    // stalk from the door out to the housing
    var stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.5 }));
    stalk.position.set(0.95, 0.95, side * 1.0);
    g.add(stalk);
    // housing: a small body-colour shell
    var housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xd86008, roughness: 0.3, metalness: 0.55 }));
    housing.position.set(0.95, 0.97, side * 1.08);
    g.add(housing);
    // glass face: sky-reflecting, on the mirror's rear face (the face
    // the driver sees, and the face the chase camera catches)
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09),
      new THREE.MeshStandardMaterial({
        map: PH.skyGlassTexture(false), roughness: 0.08, metalness: 0.6
      }));
    glass.position.set(0.86, 0.97, side * 1.08);
    glass.rotation.y = -Math.PI / 2;
    g.add(glass);
    // amber repeater strip on the housing's outer edge
    var rep = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff9010, emissiveIntensity: 1.4 }));
    rep.position.set(0.95, 0.97, side * 1.12);
    g.add(rep);
    return g;
  };
})();
