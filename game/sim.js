// PIER HEAT — Sunset Bay v6.8
// sim.js — everything that moves: procedural cars (hero wedge, traffic,
// police), the pedestrian crowds, the living beach with its activities and
// its run-for-cover behaviour during a chase, the police helicopter and
// the Mateo character wrapper around the real GLB model.
(function () {
  'use strict';
  var PH = window.PH;

  // ---------- shared person geometry / materials ----------
  var _boxGeo = null, _sphereGeo = null, _capsuleGeo = null;
  function personGeos() {
    if (!_boxGeo) {
      _boxGeo = new THREE.BoxGeometry(1, 1, 1);
      _sphereGeo = new THREE.SphereGeometry(1, 12, 10);
      _capsuleGeo = new THREE.CapsuleGeometry(1, 1, 4, 10);
    }
    return { box: _boxGeo, sphere: _sphereGeo, capsule: _capsuleGeo };
  }
  var _matCache = {};
  function stdMat(color, rough) {
    var key = color + '/' + (rough || 0.85);
    if (!_matCache[key]) _matCache[key] = new THREE.MeshStandardMaterial({ color: color, roughness: rough || 0.85 });
    return _matCache[key];
  }
  var SKINS = [0xc98d64, 0x8a5a3b, 0xe0ac82, 0x6b4426, 0xd9a066];
  var SHIRTS = [0xe63946, 0x2a9d8f, 0xffd23e, 0x7b5cff, 0x38b000, 0xff7a1a, 0x1d3557, 0xf4a261, 0xffffff, 0x222222, 0x2ec4b6, 0xff5d8f];
  var PANTS = [0x2b2d42, 0x4a3220, 0x1d3557, 0x555555, 0x8a6b45, 0x333333];

  // Procedural person. States: walk, run, idle, lie, sit, swim, surf,
  // volley, fish, selfie, dig, aim. The inner group carries the pose so
  // the outer group only handles position and heading.
  PH.makePerson = function (opts) {
    opts = opts || {};
    var G = personGeos();
    var outer = new THREE.Group();
    var inner = new THREE.Group();
    outer.add(inner);
    var skin = stdMat(PH.pick(SKINS));
    var shirt = stdMat(opts.shirt != null ? opts.shirt : PH.pick(SHIRTS));
    var pants = stdMat(opts.pants != null ? opts.pants : PH.pick(PANTS));
    var hair = stdMat(opts.hair != null ? opts.hair : PH.pick([0x1a1a1a, 0x3a2a18, 0x6b4426, 0x888888, 0xd8b25a]));
    function part(geo, mat, sx, sy, sz, x, y, z) {
      var m = new THREE.Mesh(geo, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    }
    // Legs pivot at the hip: geometry shifted so the top is at the pivot.
    var legGeoL = new THREE.BoxGeometry(0.17, 0.78, 0.17);
    legGeoL.translate(0, -0.39, 0);
    var legL = new THREE.Mesh(legGeoL, pants); legL.position.set(-0.11, 0.8, 0); legL.castShadow = true;
    var legR = new THREE.Mesh(legGeoL, pants); legR.position.set(0.11, 0.8, 0); legR.castShadow = true;
    inner.add(legL); inner.add(legR);
    var torso = part(G.capsule, shirt, 0.24, 0.32, 0.15, 0, 1.18, 0);
    inner.add(torso);
    var head = part(G.sphere, skin, 0.17, 0.19, 0.17, 0, 1.66, 0);
    inner.add(head);
    var hairM = part(G.sphere, hair, 0.18, 0.12, 0.18, 0, 1.76, -0.02);
    inner.add(hairM);
    if (opts.cap) {
      var cap = part(G.box, stdMat(0x1d3557), 0.34, 0.08, 0.34, 0, 1.82, 0);
      inner.add(cap);
    }
    var armGeo = new THREE.BoxGeometry(0.12, 0.64, 0.12);
    armGeo.translate(0, -0.32, 0);
    var armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.32, 1.48, 0); armL.castShadow = true;
    var armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.32, 1.48, 0); armR.castShadow = true;
    inner.add(armL); inner.add(armR);
    if (opts.scale) outer.scale.setScalar(opts.scale);
    var p = {
      group: outer, inner: inner, legL: legL, legR: legR, armL: armL, armR: armR,
      head: head, torso: torso, state: opts.state || 'idle', phase: PH.rand(0, 6.28),
      speed: 0, heading: opts.heading || 0, home: opts.home || null,
      activity: opts.activity || 'walk', extra: null
    };
    return p;
  };

  // Pose the person for one frame. `phase` advances with speed.
  PH.posePerson = function (p, dt) {
    var ph = p.phase;
    var L = p.legL, R = p.legR, aL = p.armL, aR = p.armR, inner = p.inner;
    L.rotation.set(0, 0, 0); R.rotation.set(0, 0, 0);
    aL.rotation.set(0, 0, 0); aR.rotation.set(0, 0, 0);
    inner.rotation.set(0, 0, 0);
    inner.position.y = 0;
    var s = Math.sin(ph), c = Math.cos(ph);
    switch (p.state) {
      case 'walk':
        L.rotation.x = s * 0.55; R.rotation.x = -s * 0.55;
        aL.rotation.x = -s * 0.45; aR.rotation.x = s * 0.45;
        inner.position.y = Math.abs(c) * 0.04;
        break;
      case 'run':
        L.rotation.x = s * 1.05; R.rotation.x = -s * 1.05;
        aL.rotation.x = -s * 0.95; aR.rotation.x = s * 0.95;
        aL.rotation.z = 0.25; aR.rotation.z = -0.25;
        inner.rotation.x = 0.22;
        inner.position.y = Math.abs(c) * 0.09;
        break;
      case 'idle':
        aL.rotation.x = s * 0.05; aR.rotation.x = -s * 0.05;
        inner.position.y = Math.sin(ph * 0.5) * 0.012;
        break;
      case 'lie': // sunbathing on a towel
        inner.rotation.x = -Math.PI / 2 + 0.06;
        inner.position.y = 0.22;
        aL.rotation.x = 0.2; aR.rotation.x = 0.2;
        L.rotation.x = 0.05; R.rotation.x = -0.05;
        break;
      case 'sit':
        L.rotation.x = -1.35; R.rotation.x = -1.35;
        inner.position.y = -0.34;
        aL.rotation.x = -0.3; aR.rotation.x = -0.3;
        break;
      case 'swim':
        inner.position.y = -0.85 + Math.sin(ph * 0.8) * 0.06;
        aL.rotation.x = -1.2 + s * 0.7; aR.rotation.x = -1.2 - s * 0.7;
        L.rotation.x = s * 0.35; R.rotation.x = -s * 0.35;
        break;
      case 'surf':
        aL.rotation.z = 1.15; aR.rotation.z = -1.15;
        aL.rotation.x = -0.3; aR.rotation.x = -0.3;
        inner.rotation.z = Math.sin(ph * 0.6) * 0.12;
        inner.rotation.x = 0.08;
        break;
      case 'volley':
        aL.rotation.x = -2.5; aR.rotation.x = -2.5;
        inner.position.y = Math.max(0, Math.sin(ph)) * 0.45;
        L.rotation.x = -0.4; R.rotation.x = 0.3;
        break;
      case 'fish':
        aL.rotation.x = -1.05; aR.rotation.x = -1.05;
        aL.rotation.z = 0.15; aR.rotation.z = -0.15;
        break;
      case 'selfie':
        aR.rotation.x = -2.5; aR.rotation.z = -0.2;
        aL.rotation.x = 0.25;
        inner.rotation.y = Math.sin(ph * 0.4) * 0.15;
        break;
      case 'dig':
        inner.position.y = -0.28;
        aL.rotation.x = -0.9; aR.rotation.x = -0.9;
        L.rotation.x = -1.2; R.rotation.x = -1.2;
        break;
      case 'aim':
        aL.rotation.x = -1.45; aR.rotation.x = -1.45;
        aL.rotation.z = 0.12; aR.rotation.z = -0.12;
        inner.rotation.y = 0;
        break;
    }
  };

  // ---------- cars ----------
  function wheel(x, z) {
    var w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), stdMat(0x141414, 0.9));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    w.castShadow = true;
    return w;
  }
  function plateMesh(text) {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.16),
      new THREE.MeshStandardMaterial({ map: PH.plateTexture(text), roughness: 0.5 })
    );
    return m;
  }

  // General traffic car: dark glass, door seams, handles, mirrors, grille,
  // plate and wheels. Faces +Z (forward = rotation.y heading).
  PH.buildCar = function (opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var color = opts.color != null ? opts.color : 0xb03030;
    var paint = new THREE.MeshStandardMaterial({ color: color, roughness: 0.35, metalness: 0.55 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.12, metalness: 0.8 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 4.4), paint);
    body.position.y = 0.62; body.castShadow = true; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.3), glass);
    cabin.position.set(0, 1.28, -0.25); cabin.castShadow = true; g.add(cabin);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.0), paint);
    roof.position.set(0, 1.6, -0.25); g.add(roof);
    // Door seams + handles + mirrors.
    [-1, 1].forEach(function (s) {
      var seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.03), stdMat(0x111111));
      seam.position.set(s * 0.96, 0.72, 0.35); g.add(seam);
      var seam2 = seam.clone(); seam2.position.z = -0.75; g.add(seam2);
      var handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.3), stdMat(0xdddddd, 0.4));
      handle.position.set(s * 0.97, 0.95, 0.35); g.add(handle);
      var handle2 = handle.clone(); handle2.position.z = -0.75; g.add(handle2);
      var mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), stdMat(0x222222));
      mirror.position.set(s * 1.02, 1.12, 0.85); g.add(mirror);
    });
    var grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.06), stdMat(0x181818));
    grille.position.set(0, 0.55, 2.21); g.add(grille);
    [-1, 1].forEach(function (s) {
      var hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 0.9 }));
      hl.position.set(s * 0.62, 0.78, 2.21); g.add(hl);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xcc2222, emissiveIntensity: 0.7 }));
      tl.position.set(s * 0.62, 0.78, -2.21); g.add(tl);
    });
    var plate = plateMesh(opts.plate || ('SB-' + PH.randInt(1000, 9999)));
    plate.position.set(0, 0.42, 2.24); g.add(plate);
    var plateR = plateMesh(opts.plate || 'SB-0000');
    plateR.position.set(0, 0.42, -2.24); plateR.rotation.y = Math.PI; g.add(plateR);
    [[-0.82, 1.45], [0.82, 1.45], [-0.82, -1.45], [0.82, -1.45]].forEach(function (p) { g.add(wheel(p[0], p[1])); });
    if (opts.police) {
      // Black doors + white body livery.
      [-1, 1].forEach(function (s) {
        var door = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 1.7), stdMat(0x14181d));
        door.position.set(s * 0.96, 0.72, -0.2); g.add(door);
        var decal = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 0.4),
          new THREE.MeshStandardMaterial({ map: PH.makeCanvasTexture(256, 64, function (ctx, w, h) {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#14181d'; ctx.font = '900 30px Arial Black, Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('BAY CITY PD', w / 2, h / 2);
          }), roughness: 0.5 })
        );
        decal.position.set(s * 0.985, 0.72, -0.2);
        decal.rotation.y = s * Math.PI / 2;
        g.add(decal);
      });
      // Flashing light bar.
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.34), stdMat(0x222222));
      bar.position.set(0, 1.72, -0.25); g.add(bar);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
      red.position.set(-0.28, 1.8, -0.25); g.add(red);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 2 }));
      blue.position.set(0.28, 1.8, -0.25); g.add(blue);
      g.userData.lightBar = { red: red, blue: blue };
    }
    return g;
  };

  // The hero: Scarlet Arrow, an orange wedge coupe, plate SUN-8821.
  PH.buildHeroCar = function () {
    var g = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.3, metalness: 0.6 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x0e1a24, roughness: 0.1, metalness: 0.85 });
    // Wedge side profile, extruded across the width, then turned to face +Z.
    var s = new THREE.Shape();
    s.moveTo(-2.15, 0.28); s.lineTo(2.2, 0.28); s.lineTo(2.28, 0.52);
    s.lineTo(1.55, 0.72); s.lineTo(0.85, 1.02); s.lineTo(0.1, 1.08);
    s.lineTo(-0.95, 1.02); s.lineTo(-1.95, 0.78); s.lineTo(-2.2, 0.5);
    s.closePath();
    var body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }), paint);
    body.rotation.y = Math.PI / 2;
    body.position.set(0, 0, 0);
    body.castShadow = true;
    g.add(body);
    // Glasshouse.
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.5), glass);
    cabin.position.set(0, 1.08, -0.35); cabin.rotation.x = -0.06; cabin.castShadow = true; g.add(cabin);
    // Spoiler, stripe, lights, plate.
    var spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.4), stdMat(0x1a1a1a, 0.4));
    spoiler.position.set(0, 1.02, -2.05); g.add(spoiler);
    [-1, 1].forEach(function (s2) {
      var strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), stdMat(0x1a1a1a));
      strut.position.set(s2 * 0.6, 0.9, -2.05); g.add(strut);
      var hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 1.2 }));
      hl.position.set(s2 * 0.6, 0.5, 2.32); g.add(hl);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xdd2222, emissive: 0xff3333, emissiveIntensity: 1 }));
      tl.position.set(s2 * 0.6, 0.62, -2.28); g.add(tl);
    });
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 4.3), stdMat(0xfff2d8, 0.5));
    stripe.position.set(0, 0.86, 0); stripe.rotation.x = 0.02; g.add(stripe);
    var plate = plateMesh('SUN-8821');
    plate.position.set(0, 0.42, -2.32); plate.rotation.y = Math.PI; g.add(plate);
    var plateF = plateMesh('SUN-8821');
    plateF.position.set(0, 0.4, 2.33); g.add(plateF);
    [[-0.82, 1.45], [0.82, 1.45], [-0.82, -1.45], [0.82, -1.45]].forEach(function (p) { g.add(wheel(p[0], p[1])); });
    return g;
  };

  // ---------- traffic ----------
  PH.buildTraffic = function (scene, world, count) {
    var cars = [];
    var colors = [0xb03030, 0x2a6fdb, 0xe8e8e8, 0xffd23e, 0x2a9d8f, 0x7b5cff, 0x333333, 0xff8fab, 0x38b000, 0xc0c0c0];
    var routes = [];
    // Sunset Blvd, both directions.
    routes.push({ axis: 'z', lane: -23.5, from: -165, to: 165, dir: 1 });
    routes.push({ axis: 'z', lane: -16.5, from: 165, to: -165, dir: -1 });
    // Cross streets, both directions.
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) {
      routes.push({ axis: 'x', lane: z - 3, from: -5, to: 165, dir: 1 });
      routes.push({ axis: 'x', lane: z + 3, from: 165, to: -5, dir: -1 });
    });
    for (var i = 0; i < count; i++) {
      var route = routes[i % routes.length];
      var car = PH.buildCar({ color: PH.pick(colors) });
      var t = PH.rand(0, 1);
      var pos = route.from + (route.to - route.from) * t;
      var rec = { group: car, route: route, pos: pos, speed: PH.rand(6, 11) };
      scene.add(car);
      cars.push(rec);
    }
    function place(rec) {
      if (rec.route.axis === 'z') {
        rec.group.position.set(rec.route.lane, 0, rec.pos);
        rec.group.rotation.y = (rec.route.dir > 0) ? 0 : Math.PI;
      } else {
        rec.group.position.set(rec.pos, 0, rec.route.lane);
        rec.group.rotation.y = (rec.route.dir > 0) ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    cars.forEach(place);
    return {
      cars: cars,
      place: place,
      update: function (dt) {
        cars.forEach(function (rec) {
          rec.pos += rec.route.dir * rec.speed * dt;
          if (rec.route.dir > 0 && rec.pos > rec.route.to) rec.pos = rec.route.from;
          if (rec.route.dir < 0 && rec.pos < rec.route.to) rec.pos = rec.route.from;
          place(rec);
        });
      }
    };
  };

  // ---------- city crowd ----------
  PH.buildCityCrowd = function (scene, world, count) {
    var walkers = [];
    var lanes = [];
    [-29.2, -11.2].forEach(function (x) {
      lanes.push({ axis: 'z', lane: x, from: -165, to: 165 });
    });
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) {
      lanes.push({ axis: 'x', lane: z - 7.5, from: 0, to: 165 });
      lanes.push({ axis: 'x', lane: z + 7.5, from: 165, to: 0 });
    });
    for (var i = 0; i < count; i++) {
      var lane = lanes[i % lanes.length];
      var p = PH.makePerson({ state: 'walk' });
      var t = PH.rand(0, 1);
      var pos = lane.from + (lane.to - lane.from) * t;
      var dir = (lane.to > lane.from) ? 1 : -1;
      p.home = { axis: lane.axis, lane: lane.lane, from: lane.from, to: lane.to };
      p.pos = pos; p.dir = dir;
      p.speed = PH.rand(1.1, 1.9);
      p.phase = PH.rand(0, 6.28);
      scene.add(p.group);
      walkers.push(p);
    }
    // A dozen strollers on the pier itself.
    world.pierSpots.walk.forEach(function (spot) {
      var p = PH.makePerson({ state: 'walk' });
      p.group.position.set(spot.x + PH.rand(-2, 2), 1.35, spot.z + PH.rand(-1, 1));
      p.home = { pier: true, x: spot.x, z: spot.z };
      p.speed = PH.rand(0.9, 1.4);
      p.phase = PH.rand(0, 6.28);
      scene.add(p.group);
      walkers.push(p);
    });
    return {
      walkers: walkers,
      update: function (dt, t, threat) {
        walkers.forEach(function (p) {
          var gx = p.group.position.x, gz = p.group.position.z;
          var fleeing = false;
          if (threat && threat.active) {
            var dx = gx - threat.x, dz = gz - threat.z;
            var d = Math.hypot(dx, dz);
            if (d < 26) {
              fleeing = true;
              p.state = 'run';
              var away = Math.atan2(dx, dz);
              p.heading = away;
              p.group.position.x += Math.sin(away) * 4.4 * dt;
              p.group.position.z += Math.cos(away) * 4.4 * dt;
              p.phase += dt * 11;
              p.group.rotation.y = away;
              PH.posePerson(p, dt);
              return;
            }
          }
          if (!fleeing) {
            p.state = 'walk';
            if (p.home && p.home.pier) {
              p.group.position.x += Math.sin(p.heading) * p.speed * dt;
              p.group.position.z += Math.cos(p.heading) * p.speed * dt;
              if (Math.hypot(p.group.position.x - p.home.x, p.group.position.z - p.home.z) > 14) p.heading += Math.PI;
              p.group.rotation.y = p.heading;
            } else if (p.home) {
              p.pos += p.dir * p.speed * dt;
              if (p.dir > 0 && p.pos > p.home.to) { p.dir = -1; }
              if (p.dir < 0 && p.pos < p.home.from) { p.dir = 1; }
              if (p.home.axis === 'z') {
                p.group.position.set(p.home.lane, 0, p.pos);
                p.group.rotation.y = (p.dir > 0) ? 0 : Math.PI;
              } else {
                p.group.position.set(p.pos, 0, p.home.lane);
                p.group.rotation.y = (p.dir > 0) ? Math.PI / 2 : -Math.PI / 2;
              }
            }
            p.phase += dt * p.speed * 4.4;
          }
          PH.posePerson(p, dt);
        });
      }
    };
  };

  // ---------- living beach: 34 NPCs, nine different activities ----------
  PH.buildBeachCrowd = function (scene, world) {
    var spots = world.beachSpots;
    var npcs = [];
    function add(activity, x, z, opts) {
      opts = opts || {};
      var p = PH.makePerson({
        state: opts.state || activity,
        shirt: opts.shirt, pants: opts.pants,
        scale: opts.scale || 1
      });
      p.activity = activity;
      p.group.position.set(x, opts.y || 0, z);
      p.home = { x: x, z: z };
      p.heading = opts.heading != null ? opts.heading : PH.rand(0, Math.PI * 2);
      p.group.rotation.y = p.heading;
      p.phase = PH.rand(0, 6.28);
      p.speed = opts.speed || 0;
      p.fleeing = false;
      // Props per activity, all procedural.
      if (activity === 'lie') {
        var towel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9),
          new THREE.MeshStandardMaterial({ color: opts.towelColor || 0xff5d8f, roughness: 0.9 }));
        towel.rotation.x = -Math.PI / 2; towel.rotation.z = 0.4;
        towel.position.set(x, 0.06, z);
        scene.add(towel);
        p.group.position.y = 0.05;
      }
      if (activity === 'surf') {
        var board = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8),
          new THREE.MeshStandardMaterial({ color: opts.boardColor || 0xffd23e, roughness: 0.4 }));
        board.scale.set(0.32, 0.05, 1.15);
        board.position.set(0, -0.55, 0);
        p.group.add(board);
        p.group.position.y = 0.35;
      }
      if (activity === 'fish') {
        var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 2.2, 6), stdMat(0x8a6b45));
        rod.position.set(0.15, 1.5, 0.55);
        rod.rotation.x = -0.9;
        p.group.add(rod);
        var line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.6, 4),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
        line.position.set(0.15, 1.1, 1.35);
        line.rotation.x = 0.35;
        p.group.add(line);
      }
      if (activity === 'selfie') {
        var phone = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.02), stdMat(0x111111, 0.4));
        phone.position.set(0.42, 1.95, 0.15);
        phone.rotation.x = -0.5;
        p.group.add(phone);
      }
      if (activity === 'dig') {
        var bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 10),
          new THREE.MeshStandardMaterial({ color: 0xff5d5d, roughness: 0.7 }));
        bucket.position.set(0.5, 0.12, 0.4);
        p.group.add(bucket);
      }
      scene.add(p.group);
      npcs.push(p);
      return p;
    }

    spots.towels.slice(0, 6).forEach(function (s, i) {
      add('lie', s.x, s.z, { towelColor: s.color, shirt: PH.pick([0xff5d8f, 0x2ec4b6, 0xffd23e, 0x7b5cff]) });
    });
    spots.swim.forEach(function (s) {
      add('swim', s.x, s.z, { shirt: PH.pick(SHIRTS) });
    });
    spots.surf.forEach(function (s, i) {
      add('surf', s.x, s.z, { boardColor: [0xff5d8f, 0x2ec4b6, 0xff7a1a][i % 3], shirt: PH.pick(SHIRTS) });
    });
    // Volleyball: two a side around the net.
    if (spots.volley) {
      var v = spots.volley;
      add('volley', v.x - 3.2, v.z - 2.2, { shirt: 0xff5d8f });
      add('volley', v.x - 3.2, v.z + 2.2, { shirt: 0x2ec4b6 });
      add('volley', v.x + 3.2, v.z - 2.2, { shirt: 0xffd23e });
      add('volley', v.x + 3.2, v.z + 2.2, { shirt: 0x7b5cff });
    }
    spots.jog.forEach(function (s) {
      var p = add('walk', s.x, s.z, { shirt: PH.pick(SHIRTS) });
      p.activity = 'jog';
      p.state = 'run';
      p.speed = 3.4;
      p.heading = (PH.randInt(0, 1) === 0) ? 0 : Math.PI;
      p.home = { axis: 'z', lane: s.x, from: -150, to: 150 };
      p.pos = s.z;
    });
    spots.sandcastles.forEach(function (s) {
      add('dig', s.x + 1.8, s.z + 1.2, { scale: 0.62, shirt: PH.pick([0xff5d8f, 0xffd23e, 0x2ec4b6]) });
      add('dig', s.x - 1.5, s.z + 2, { scale: 0.58, shirt: PH.pick([0x7b5cff, 0xff7a1a, 0x38b000]) });
    });
    world.pierSpots.fish.forEach(function (s) {
      add('fish', s.x, s.z, { y: 1.35, shirt: PH.pick([0x2a9d8f, 0xe63946, 0x1d3557]) });
    });
    world.pierSpots.benches.forEach(function (s) {
      add('sit', s.x, s.z + 0.1, { y: 1.35, shirt: PH.pick(SHIRTS) });
    });
    spots.selfie.forEach(function (s) {
      add('selfie', s.x, s.z, { shirt: PH.pick([0xff5d8f, 0xffffff, 0x2ec4b6]) });
    });

    return {
      npcs: npcs,
      update: function (dt, t, threat) {
        npcs.forEach(function (p) {
          var gx = p.group.position.x, gz = p.group.position.z;
          var flee = false;
          if (threat && threat.active && p.activity !== 'swim' && p.activity !== 'surf') {
            var dx = gx - threat.x, dz = gz - threat.z;
            var d = Math.hypot(dx, dz);
            if (d < 45) flee = true;
          }
          if (flee) {
            // Run away from the chase: beach folk sprint for the water.
            if (!p.fleeing) { p.fleeing = true; p.state = 'run'; }
            var away = Math.atan2(gx - threat.x, gz - threat.z);
            // Bias the escape westward, toward the ocean and the pier.
            var ax = Math.sin(away) - 0.7, az = Math.cos(away);
            var len = Math.hypot(ax, az) || 1;
            p.heading = Math.atan2(ax / len, az / len);
            p.group.position.x += (ax / len) * 4.6 * dt;
            p.group.position.z += (az / len) * 4.6 * dt;
            p.group.position.x = Math.max(-125, Math.min(-30, p.group.position.x));
            p.group.rotation.y = p.heading;
            p.phase += dt * 11;
          } else {
            if (p.fleeing) {
              p.fleeing = false;
              p.state = p.activity === 'jog' ? 'run' : p.activity;
              // Walk back toward the home spot.
              p.group.position.x += (p.home.x - gx) * dt * 0.25;
              p.group.position.z += (p.home.z - gz) * dt * 0.25;
              if (Math.hypot(p.home.x - gx, p.home.z - gz) < 1.5) p.state = p.activity;
              else p.state = 'walk';
            }
            if (p.activity === 'jog' && !p.fleeing) {
              p.state = 'run';
              p.pos += (p.heading === 0 ? 1 : -1) * p.speed * dt;
              if (p.pos > 150) { p.pos = 150; p.heading = Math.PI; }
              if (p.pos < -150) { p.pos = -150; p.heading = 0; }
              p.group.position.set(p.home.lane, 0, p.pos);
              p.group.rotation.y = p.heading;
              p.phase += dt * 10;
            } else if (p.activity === 'swim') {
              p.phase += dt * 2.2;
              p.group.position.y = 0.05 + Math.sin(t * 1.4 + p.phase) * 0.12;
              p.group.position.x = p.home.x + Math.sin(t * 0.5 + p.phase) * 1.2;
            } else if (p.activity === 'surf') {
              p.phase += dt * 1.6;
              p.group.position.y = 0.35 + Math.sin(t * 1.1 + p.phase) * 0.18;
              p.group.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.08;
            } else if (p.activity === 'volley') {
              p.phase += dt * 3.2;
            } else {
              p.phase += dt * 1.2;
            }
          }
          PH.posePerson(p, dt);
        });
      }
    };
  };

  // ---------- police: cars, officers, helicopter ----------
  PH.buildPolice = function (scene, world) {
    var cars = [];
    // Parked at their staging spots on the avenue — never at the origin,
    // where they would photobomb a shot.
    var parkSpots = [[-16.5, 90, Math.PI], [-23.5, 100, Math.PI], [-16.5, 110, Math.PI]];
    for (var i = 0; i < 3; i++) {
      var car = PH.buildCar({ color: 0xf2f2f2, police: true, plate: 'PD-' + (104 + i * 7) });
      car.position.set(parkSpots[i][0], 0, parkSpots[i][1]);
      car.rotation.y = parkSpots[i][2];
      scene.add(car);
      cars.push(car);
    }
    var officers = [];
    for (var j = 0; j < 3; j++) {
      var o = PH.makePerson({ shirt: 0x1d3557, pants: 0x1d3557, cap: true, state: 'aim' });
      scene.add(o.group);
      officers.push(o);
    }
    // Police helicopter with spinning rotors and a searchlight cone.
    var heli = new THREE.Group();
    var hBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.4, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.4, metalness: 0.4 }));
    hBody.rotation.z = Math.PI / 2; hBody.castShadow = true; heli.add(hBody);
    var hGlass = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.7 }));
    hGlass.scale.set(1, 0.8, 0.9); hGlass.position.set(1.6, -0.1, 0); heli.add(hGlass);
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 3.4, 8), hBody.material);
    tail.rotation.z = Math.PI / 2; tail.position.set(-2.8, 0.3, 0); heli.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.7), hBody.material);
    fin.position.set(-4.4, 0.8, 0); heli.add(fin);
    var rotor = new THREE.Group();
    var blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 7.5), stdMat(0x222222));
    rotor.add(blade);
    var blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
    rotor.position.y = 1.15; heli.add(rotor);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), stdMat(0x222222));
    mast.position.y = 0.9; heli.add(mast);
    var spot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2b0, emissiveIntensity: 2 }));
    spot.position.set(1.8, -0.7, 0); heli.add(spot);
    scene.add(heli);
    return {
      cars: cars, officers: officers, heli: heli, rotor: rotor, frozen: false,
      update: function (dt, t, focus) {
        rotor.rotation.y += dt * 22;
        if (!this.frozen) {
          var cx = focus ? focus.x : 0, cz = focus ? focus.z : 0;
          var a = t * 0.12;
          heli.position.set(cx + Math.cos(a) * 26, 34 + Math.sin(t * 0.8) * 1.5, cz + Math.sin(a) * 26 - 10);
          heli.rotation.y = -a - Math.PI / 2 + Math.PI;
          heli.rotation.z = Math.sin(t * 0.6) * 0.05;
        }
        cars.forEach(function (car, i) {
          var bar = car.userData.lightBar;
          if (bar) {
            var on = Math.floor(t * 4 + i) % 2 === 0;
            bar.red.material.emissiveIntensity = on ? 3 : 0.2;
            bar.blue.material.emissiveIntensity = on ? 0.2 : 3;
          }
        });
      }
    };
  };

  // ---------- Mateo wrapper (real GLB) ----------
  PH.makeMateo = function (loaded) {
    var group = loaded.group;
    var mixer = new THREE.AnimationMixer(group);
    var actions = {};
    Object.keys(loaded.clips || {}).forEach(function (name) {
      var clip = loaded.clips[name];
      var act = mixer.clipAction(clip);
      actions[name.toLowerCase()] = act;
    });
    var current = null;
    // Normalise the model to a 1.8 m tall person standing on the ground.
    group.updateMatrixWorld(true);
    var bbox = new THREE.Box3().setFromObject(group);
    var size = new THREE.Vector3();
    bbox.getSize(size);
    if (size.y > 0.01) {
      var s = 1.8 / size.y;
      group.scale.setScalar(s);
      group.updateMatrixWorld(true);
      bbox = new THREE.Box3().setFromObject(group);
      group.position.y -= bbox.min.y;
    }
    return {
      group: group, mixer: mixer, actions: actions,
      play: function (name) {
        var key = (name || 'idle').toLowerCase();
        var next = actions[key] || actions.idle;
        if (!next) return;
        if (current === next) return;
        if (current) current.fadeOut(0.18);
        next.reset().setEffectiveTimeScale(1).fadeIn(0.18).play();
        current = next;
      },
      update: function (dt) { mixer.update(dt); },
      setPos: function (x, z, heading) {
        group.position.x = x;
        group.position.z = z;
        if (heading != null) group.rotation.y = heading;
      },
      forward: function () {
        // The GLB faces +X at rotation 0, so its facing is (cos ry, -sin ry).
        return new THREE.Vector3(Math.cos(group.rotation.y), 0, -Math.sin(group.rotation.y));
      }
    };
  };

  // ---------- muzzle flash ----------
  PH.makeMuzzleFlash = function (scene) {
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: PH.flashTexture(), color: 0xffd27a, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sprite.scale.set(1.4, 1.4, 1);
    sprite.visible = false;
    scene.add(sprite);
    var light = new THREE.PointLight(0xffc860, 0, 14, 1.6);
    scene.add(light);
    return {
      sprite: sprite, light: light, on: false, timer: 0,
      showAt: function (pos) {
        sprite.position.copy(pos);
        light.position.copy(pos);
        sprite.visible = true;
        light.intensity = 60;
        this.on = true; this.timer = 0;
      },
      hide: function () { sprite.visible = false; light.intensity = 0; this.on = false; },
      update: function (dt, hold) {
        if (!this.on) return;
        this.timer += dt;
        var flick = 0.85 + Math.sin(this.timer * 47) * 0.15;
        sprite.material.opacity = flick;
        sprite.scale.set(1.3 + Math.sin(this.timer * 31) * 0.2, 1.3 + Math.cos(this.timer * 29) * 0.2, 1);
        if (!hold && this.timer > 0.09) this.hide();
      }
    };
  };
})();
