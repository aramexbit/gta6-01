// PIER HEAT — Sunset Bay: the world.
// Everything visible is built here from basic shapes and canvas textures:
// the golden-hour sky and round sun, the 7x7 street grid, three districts,
// the beach, the sea and the wooden pier, palms and street furniture,
// procedural Mateo, procedural cars, police cars and the helicopter.

(function () {
  'use strict';
  var PH = window.PH;
  var W = PH.world = {};

  // ------------------------------------------------------------ palette
  W.PALETTE = {
    skyTop: 0x2b1e63, skyMid: 0xb83a6e, skyLow: 0xff9a4d,
    sunCore: 0xffd27a, sunGlow: 0xff7a3c,
    asphalt: 0x2e2e38, sidewalk: 0x9a8f80, sand: 0xe8c98f, sea: 0x1d6f8e,
    deco: [0xffb3c1, 0x7fd4c1, 0xffe08a, 0xb5a7f5, 0xff9d7a, 0x8fd0ff],
    havana: [0xc96f3f, 0xd98a4a, 0xb85c38, 0xe0a45c, 0x9c5a34],
    glass: [0x6fb7d6, 0x8fc7e8, 0x5a9ec4, 0x9fd4e8],
    carColors: [0xd83a2e, 0x2e7fd8, 0xf2c230, 0x37b268, 0x8a5fd0, 0xe8e8e8, 0x222831, 0xff7ab8],
    pedColors: [0xe84a5f, 0x2fa36b, 0xf2a541, 0x4a7de8, 0x9b59d0, 0xefefef, 0x222222, 0x18b5a6],
  };

  // ------------------------------------------------------------ canvas textures
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Round sun disc: a soft radial glow with a hard bright core, so the sprite
  // reads as a circle from every angle (a flat disc would foreshorten).
  W.sunTexture = function () {
    return canvasTex(256, 256, function (g) {
      var grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,236,180,1)');
      grad.addColorStop(0.28, 'rgba(255,205,110,1)');
      grad.addColorStop(0.42, 'rgba(255,140,60,0.95)');
      grad.addColorStop(0.62, 'rgba(255,110,60,0.35)');
      grad.addColorStop(1, 'rgba(255,110,60,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    });
  };

  W.roadTexture = function () {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#33333e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a3a46';
      for (var i = 0; i < 900; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      g.fillStyle = '#e8c33c';
      g.fillRect(w / 2 - 4, 0, 8, 46); g.fillRect(w / 2 - 4, 90, 8, 46); g.fillRect(w / 2 - 4, 180, 8, 46);
      g.fillStyle = '#d8d8d8';
      g.fillRect(6, 0, 4, h); g.fillRect(w - 10, 0, 4, h);
    });
  };

  W.sandTexture = function () {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#e8c98f'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 1400; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(190,150,90,0.5)' : 'rgba(255,230,180,0.5)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
  };

  W.windowTexture = function (base, lit) {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (var y = 10; y < h - 10; y += 22) {
        for (var x = 10; x < w - 10; x += 18) {
          g.fillStyle = Math.random() < lit ? '#ffd98a' : '#1d2f45';
          g.fillRect(x, y, 12, 14);
        }
      }
    });
  };

  // ------------------------------------------------------------ materials
  function mat(color, opts) {
    var o = opts || {};
    return new THREE.MeshLambertMaterial({
      color: color, emissive: o.emissive || 0x000000,
      emissiveIntensity: o.ei || 1, transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity,
    });
  }
  W.mat = mat;

  function box(w, h, d, color, x, y, z, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, color, x, y, z, seg, opts) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  W.box = box; W.cyl = cyl;

  // ------------------------------------------------------------ sky, sun, sea
  W.buildSky = function (scene) {
    // Big gradient dome: indigo top, magenta middle, warm orange low.
    var geo = new THREE.SphereGeometry(900, 24, 16);
    var colors = [];
    var top = new THREE.Color(W.PALETTE.skyTop), mid = new THREE.Color(W.PALETTE.skyMid), low = new THREE.Color(W.PALETTE.skyLow);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 900;
      var c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(low, 1 - (y + 0.2) / 0.45);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    var dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    scene.add(dome);

    // Sun: a sprite, so it always faces the camera and stays round.
    var sunMat = new THREE.SpriteMaterial({ map: W.sunTexture(), transparent: true, fog: false, depthWrite: false });
    var sun = new THREE.Sprite(sunMat);
    sun.position.set(620, 95, -40);
    sun.scale.set(190, 190, 1);
    scene.add(sun);
    W.sun = sun;

    // A few flat sunset clouds.
    W.clouds = [];
    for (var k = 0; k < 14; k++) {
      var cl = new THREE.Mesh(new THREE.BoxGeometry(PH.rand(60, 150), PH.rand(4, 9), PH.rand(14, 26)),
        new THREE.MeshBasicMaterial({ color: k % 3 === 0 ? 0xffb08a : 0xd97a9e, transparent: true, opacity: 0.55, fog: false }));
      cl.position.set(PH.rand(-700, 700), PH.rand(120, 260), PH.rand(-700, 300));
      scene.add(cl); W.clouds.push(cl);
    }

    var hemi = new THREE.HemisphereLight(0xffc9a0, 0x3a2a55, 0.85);
    scene.add(hemi);
    var sunLight = new THREE.DirectionalLight(0xffb060, 1.6);
    sunLight.position.set(300, 140, -60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -220; sunLight.shadow.camera.right = 220;
    sunLight.shadow.camera.top = 220; sunLight.shadow.camera.bottom = -220;
    sunLight.shadow.camera.far = 900;
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x805080, 0.5));
    scene.fog = new THREE.Fog(0xc96a7a, 260, 850);
  };

  W.buildGroundAndSea = function (scene) {
    var roadTex = W.roadTexture();
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;

    // City base slab.
    var base = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), mat(0x8a7f70));
    base.rotation.x = -Math.PI / 2; base.position.set(0, 0, 0); base.receiveShadow = true;
    scene.add(base);

    // Roads: dark strips along every grid line, both directions.
    var streets = PH.CITY.streets;
    streets.forEach(function (s) {
      var r1 = new THREE.Mesh(new THREE.PlaneGeometry(340, 9), new THREE.MeshLambertMaterial({ map: roadTex }));
      r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.02, s); r1.receiveShadow = true;
      scene.add(r1);
      var r2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 340), new THREE.MeshLambertMaterial({ map: roadTex }));
      r2.rotation.x = -Math.PI / 2; r2.position.set(s, 0.02, 0); r2.receiveShadow = true;
      scene.add(r2);
      // Sidewalks: pale strips flanking each road.
      [-6.2, 6.2].forEach(function (off) {
        var sw1 = new THREE.Mesh(new THREE.PlaneGeometry(340, 2.6), mat(0xa89a86));
        sw1.rotation.x = -Math.PI / 2; sw1.position.set(0, 0.03, s + off); sw1.receiveShadow = true; scene.add(sw1);
        var sw2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 340), mat(0xa89a86));
        sw2.rotation.x = -Math.PI / 2; sw2.position.set(s + off, 0.03, 0); sw2.receiveShadow = true; scene.add(sw2);
      });
    });

    // Beach sand east of the city, then the sea.
    var sandTex = W.sandTexture();
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(6, 6);
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 340), new THREE.MeshLambertMaterial({ map: sandTex }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(178, 0.04, 0); sand.receiveShadow = true;
    scene.add(sand);
    var seaMat = new THREE.MeshLambertMaterial({ color: W.PALETTE.sea, transparent: true, opacity: 0.92 });
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 700), seaMat);
    sea.rotation.x = -Math.PI / 2; sea.position.set(460, 0.02, 0);
    scene.add(sea);
    W.sea = sea; W.seaMat = seaMat;

    // Wooden pier reaching into the sea at z = 0, with posts and lamps.
    var pier = new THREE.Group();
    var deck = box(70, 0.6, 8, 0x8a6238, 0, 0.5, 0);
    pier.add(deck);
    for (var px = -32; px <= 32; px += 8) {
      pier.add(cyl(0.35, 0.35, 2.4, 0x6b4a28, px, -0.6, 3.4, 8));
      pier.add(cyl(0.35, 0.35, 2.4, 0x6b4a28, px, -0.6, -3.4, 8));
      var lamp = cyl(0.08, 0.12, 3.2, 0x333333, px, 2.2, 3.2, 6);
      pier.add(lamp);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), mat(0xffe08a, { emissive: 0xffc040, ei: 1.4 }));
      bulb.position.set(px, 3.9, 3.2); pier.add(bulb);
    }
    pier.position.set(228, 0, 0);
    scene.add(pier);
    W.pier = pier;

    // Boardwalk strip along the sand.
    var walk = box(4, 0.3, 320, 0xb08a5a, 152, 0.15, 0);
    scene.add(walk);
  };

  // ------------------------------------------------------------ districts
  // Ocean Drive (x > 80): pastel deco, 2-4 storeys. Little Havana (z > 60,
  // x < 40): terracotta, 2-3 storeys. Downtown (centre): glass towers 20-46 m.
  W.districtOf = function (x, z) {
    if (x > 80) return 'ocean';
    if (z > 60 && x < 40) return 'havana';
    if (Math.abs(x) <= 40 && Math.abs(z) <= 40) return 'downtown';
    return 'mixed';
  };

  W.buildBuildings = function (scene) {
    var streets = PH.CITY.streets;
    var blockCenters = [];
    for (var i = 0; i < streets.length - 1; i++) {
      for (var j = 0; j < streets.length - 1; j++) {
        blockCenters.push([(streets[i] + streets[i + 1]) / 2, (streets[j] + streets[j + 1]) / 2]);
      }
    }
    W.buildings = [];
    blockCenters.forEach(function (bc, idx) {
      var bx = bc[0], bz = bc[1];
      var district = W.districtOf(bx, bz);
      var count = district === 'downtown' ? 1 : 2;
      for (var k = 0; k < count; k++) {
        var ox = count === 1 ? 0 : (k === 0 ? -8 : 8);
        var oz = count === 1 ? 0 : (k === 0 ? -8 : 8);
        var h, w, d, color, tex = null;
        if (district === 'downtown') {
          h = PH.rand(20, 46); w = PH.rand(16, 24); d = PH.rand(16, 24);
          color = PH.pick(W.PALETTE.glass);
          tex = W.windowTexture('#' + new THREE.Color(color).getHexString(), 0.35);
        } else if (district === 'ocean') {
          h = PH.rand(7, 14); w = PH.rand(12, 18); d = PH.rand(12, 18);
          color = PH.pick(W.PALETTE.deco);
        } else if (district === 'havana') {
          h = PH.rand(6, 11); w = PH.rand(12, 18); d = PH.rand(12, 16);
          color = PH.pick(W.PALETTE.havana);
        } else {
          h = PH.rand(8, 18); w = PH.rand(12, 18); d = PH.rand(12, 18);
          color = PH.pick(W.PALETTE.deco.concat(W.PALETTE.havana));
        }
        var material = tex
          ? new THREE.MeshLambertMaterial({ map: tex })
          : mat(color);
        var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        b.position.set(bx + ox, h / 2, bz + oz);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        W.buildings.push(b);
        // Roof box / parapet and a glowing sign for deco blocks.
        var roof = box(w * 0.7, 0.8, d * 0.7, 0x444455, bx + ox, h + 0.4, bz + oz);
        scene.add(roof);
        if (district === 'ocean' && Math.random() < 0.6) {
          var sign = box(w * 0.6, 1.1, 0.3, PH.pick([0xff5a8a, 0x37e0c0, 0xffc93c]), bx + ox, h - 0.6, bz + oz + d / 2 + 0.2,
            { emissive: 0xff5a8a, ei: 0.7 });
          scene.add(sign);
        }
        if (district === 'downtown') {
          var antenna = cyl(0.15, 0.3, PH.rand(4, 9), 0x888888, bx + ox, h + 4, bz + oz, 6);
          scene.add(antenna);
          var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), mat(0xff4040, { emissive: 0xff2020, ei: 2 }));
          beacon.position.set(bx + ox, h + 8, bz + oz); scene.add(beacon);
        }
      }
    });
    // Marina sheds near the pier.
    for (var s = 0; s < 3; s++) {
      var shed = box(10, 4, 7, 0x7a9ab0, 158, 2, -30 + s * 14);
      scene.add(shed);
    }
    // Small moored boats bobbing by the pier — white hulls, coloured sails.
    for (var b = 0; b < 6; b++) {
      var boat = new THREE.Group();
      boat.add(box(5, 0.9, 1.8, 0xf2f2f2, 0, 0.4, 0));
      boat.add(cyl(0.06, 0.06, 4.5, 0x8a6a45, 0, 2.6, 0, 6));
      var sail = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), new THREE.MeshBasicMaterial({ color: PH.pick([0xff5a8a, 0xffffff, 0x37e0c0, 0xffc93c]), side: THREE.DoubleSide }));
      sail.position.set(0.8, 2.8, 0); boat.add(sail);
      boat.position.set(PH.rand(215, 260), 0, PH.rand(-90, 90));
      boat.rotation.y = PH.rand(0, Math.PI * 2);
      scene.add(boat);
    }
  };

  // ------------------------------------------------------------ palms & props
  W.makePalm = function () {
    var g = new THREE.Group();
    var h = PH.rand(6, 9);
    var trunk = cyl(0.22, 0.38, h, 0x8a6a45, 0, h / 2, 0, 7);
    trunk.rotation.z = PH.rand(-0.08, 0.08);
    g.add(trunk);
    for (var i = 0; i < 7; i++) {
      var leaf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.7), mat(0x2fae5f));
      var a = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.5, h + 0.3, Math.sin(a) * 1.5);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.5;
      leaf.castShadow = true;
      g.add(leaf);
    }
    var nuts = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat(0x6b4a28));
    nuts.position.set(0, h - 0.2, 0); g.add(nuts);
    return g;
  };

  W.buildStreetProps = function (scene) {
    W.palms = [];
    // Palm rows along Ocean Drive and the beach walk.
    for (var z = -140; z <= 140; z += 20) {
      [146, 128].forEach(function (x) {
        var p = W.makePalm();
        p.position.set(x + PH.rand(-1, 1), 0, z + PH.rand(-2, 2));
        scene.add(p); W.palms.push(p);
      });
    }
    // Street lights, benches, hydrants scattered on sidewalks.
    var streets = PH.CITY.streets;
    streets.forEach(function (s) {
      for (var t = -120; t <= 120; t += 40) {
        var lamp = cyl(0.09, 0.13, 5.2, 0x2c2c34, s + 7.5, 2.6, t, 6);
        scene.add(lamp);
        var arm = box(1.6, 0.12, 0.12, 0x2c2c34, s + 6.7, 5.1, t);
        scene.add(arm);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), mat(0xffe08a, { emissive: 0xffc040, ei: 1.2 }));
        bulb.position.set(s + 5.9, 5.0, t); scene.add(bulb);
        if (Math.random() < 0.5) {
          var bench = new THREE.Group();
          bench.add(box(2.2, 0.12, 0.6, 0x7a5230, 0, 0.5, 0));
          bench.add(box(2.2, 0.7, 0.1, 0x7a5230, 0, 0.9, -0.28));
          bench.add(box(0.12, 0.5, 0.5, 0x333333, -0.9, 0.25, 0));
          bench.add(box(0.12, 0.5, 0.5, 0x333333, 0.9, 0.25, 0));
          bench.position.set(s - 7.5, 0, t + 12);
          scene.add(bench);
        }
        if (Math.random() < 0.4) {
          var hyd = cyl(0.28, 0.32, 0.9, 0xd83a2e, s + 7.5, 0.45, t + 20, 8);
          scene.add(hyd);
        }
      }
    });
    // Beach umbrellas and towels.
    for (var u = 0; u < 8; u++) {
      var ux = PH.rand(158, 188), uz = PH.rand(-120, 120);
      var pole = cyl(0.06, 0.06, 2.4, 0xeeeeee, ux, 1.2, uz, 6);
      scene.add(pole);
      var top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 10), mat(PH.pick([0xff5a8a, 0x37e0c0, 0xffc93c, 0xffffff])));
      top.position.set(ux, 2.7, uz); top.castShadow = true; scene.add(top);
      var towel = box(1.8, 0.06, 0.8, PH.pick(W.PALETTE.pedColors), ux + 2, 0.1, uz + 1);
      scene.add(towel);
    }
  };

  // ------------------------------------------------------------ Mateo (player)
  // Procedural figure: burnt-orange bomber jacket, white tee, dark jeans,
  // white sneakers, black hair. Separate upper/lower arms (jacket sleeves to
  // the wrist, skin hands), separate legs, so walk/run/aim animate cleanly.
  W.SKIN = 0xc98a5e;
  W.makeMateo = function () {
    var g = new THREE.Group();
    var skin = W.SKIN, jacket = 0xc65a28, tee = 0xf2f2f2, jeans = 0x2a3248, shoe = 0xf5f5f5;
    // Legs (separate, jeans) + white sneakers.
    var legL = new THREE.Group(); legL.position.set(-0.22, 0.95, 0);
    legL.add(box(0.3, 0.95, 0.34, jeans, 0, -0.47, 0));
    legL.add(box(0.32, 0.16, 0.55, shoe, 0, -0.92, 0.08));
    var legR = new THREE.Group(); legR.position.set(0.22, 0.95, 0);
    legR.add(box(0.3, 0.95, 0.34, jeans, 0, -0.47, 0));
    legR.add(box(0.32, 0.16, 0.55, shoe, 0, -0.92, 0.08));
    g.add(legL); g.add(legR);
    // Torso: jacket body + white tee chest + zipper line.
    var torso = new THREE.Group(); torso.position.set(0, 0.95, 0);
    torso.add(box(0.78, 0.85, 0.42, jacket, 0, 0.42, 0));
    torso.add(box(0.34, 0.7, 0.06, tee, 0, 0.42, 0.22));
    torso.add(box(0.05, 0.8, 0.03, 0x333333, 0, 0.42, 0.24));
    torso.add(box(0.8, 0.1, 0.44, 0x8a3a18, 0, 0.02, 0)); // hem band
    g.add(torso);
    // Head + black hair + cap-less hair cap.
    var head = new THREE.Group(); head.position.set(0, 1.82, 0);
    head.add(box(0.42, 0.46, 0.4, skin, 0, 0.22, 0));
    head.add(box(0.46, 0.16, 0.44, 0x1a1a1a, 0, 0.48, 0)); // hair top
    head.add(box(0.46, 0.3, 0.1, 0x1a1a1a, 0, 0.32, -0.18)); // hair back
    head.add(box(0.1, 0.06, 0.05, 0x1a1a1a, -0.1, 0.28, 0.21)); // eyes
    head.add(box(0.1, 0.06, 0.05, 0x1a1a1a, 0.1, 0.28, 0.21));
    g.add(head);
    // Arms: upper + forearm, jacket sleeves to wrist, skin hands.
    function arm(side) {
      var shoulder = new THREE.Group();
      shoulder.position.set(side * 0.5, 1.72, 0);
      var upper = new THREE.Group();
      upper.add(box(0.24, 0.5, 0.26, jacket, 0, -0.25, 0));
      upper.position.set(0, 0, 0);
      var fore = new THREE.Group(); fore.position.set(0, -0.5, 0);
      fore.add(box(0.22, 0.45, 0.24, jacket, 0, -0.2, 0));
      fore.add(box(0.2, 0.16, 0.22, skin, 0, -0.48, 0)); // hand
      upper.add(fore);
      shoulder.add(upper);
      shoulder.userData = { upper: upper, fore: fore };
      return shoulder;
    }
    var armL = arm(-1), armR = arm(1);
    g.add(armL); g.add(armR);
    // Small pistol, hidden unless aiming / shooting.
    var pistol = new THREE.Group();
    pistol.add(box(0.06, 0.12, 0.34, 0x1c1c22, 0, 0, 0.1));
    pistol.add(box(0.05, 0.14, 0.08, 0x1c1c22, 0, -0.1, -0.02));
    pistol.position.set(0.12, 1.28, 0.35);
    pistol.visible = false;
    g.add(pistol);
    g.userData = { legL: legL, legR: legR, torso: torso, head: head, armL: armL, armR: armR, pistol: pistol, walkPhase: 0 };
    return g;
  };

  // Walk / run / aim pose for Mateo. `speed` 0..1, `aiming` bool.
  W.poseMateo = function (fig, dt, speed, aiming, moving) {
    var u = fig.userData;
    if (aiming) {
      u.armR.rotation.x = -Math.PI / 2 + 0.15; u.armR.rotation.z = -0.25;
      u.armL.rotation.x = -Math.PI / 2 + 0.35; u.armL.rotation.z = 0.55;
      u.legL.rotation.x = 0.12; u.legR.rotation.x = -0.18;
      u.torso.rotation.x = 0.08;
      u.pistol.visible = true;
      return;
    }
    u.pistol.visible = false;
    if (moving && speed > 0.05) {
      u.walkPhase += dt * (6 + speed * 10);
      var s = Math.sin(u.walkPhase), c = Math.cos(u.walkPhase);
      var amp = 0.55 + speed * 0.35;
      u.legL.rotation.x = s * amp; u.legR.rotation.x = -s * amp;
      u.armL.rotation.x = -s * amp * 0.8; u.armR.rotation.x = s * amp * 0.8;
      u.armL.rotation.z = 0.08; u.armR.rotation.z = -0.08;
      u.torso.rotation.x = 0.08 + speed * 0.08;
      u.torso.position.y = 0.95 + Math.abs(c) * 0.05;
    } else {
      u.walkPhase = 0;
      u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8;
      u.armL.rotation.x *= 0.8; u.armR.rotation.x *= 0.8;
      u.armL.rotation.z = 0.12; u.armR.rotation.z = -0.12;
      u.torso.rotation.x = 0; u.torso.position.y = 0.95;
    }
  };

  // ------------------------------------------------------------ cars
  // Procedural car from boxes + cylinders: body, cabin, dark glass, 4 wheels,
  // headlights and taillights. Returns {group, wheels[], body}.
  W.makeCar = function (color, opts) {
    var o = opts || {};
    var g = new THREE.Group();
    var len = o.length || 4.4, wid = o.width || 1.9;
    var body = box(len, 0.62, wid, color, 0, 0.55, 0);
    g.add(body);
    var cabin = box(len * 0.52, 0.55, wid * 0.86, 0x14181f, -len * 0.05, 1.12, 0);
    g.add(cabin);
    var roof = box(len * 0.5, 0.08, wid * 0.8, color, -len * 0.05, 1.42, 0);
    g.add(roof);
    // Headlights / taillights.
    var hl = mat(0xfff2b0, { emissive: 0xffedb0, ei: 0.9 });
    [-1, 1].forEach(function (s) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.3), hl);
      h.position.set(len / 2, 0.6, s * 0.6); g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.3), mat(0xff2a2a, { emissive: 0xcc0000, ei: 0.8 }));
      t.position.set(-len / 2, 0.6, s * 0.6); g.add(t);
    });
    if (o.sport) {
      g.add(box(0.5, 0.08, wid * 0.9, 0x222222, -len / 2 + 0.1, 1.0, 0)); // spoiler
      g.add(box(len * 0.3, 0.1, wid * 0.5, 0x222222, len * 0.2, 0.28, 0));
    }
    var wheels = [];
    [[len * 0.32, wid / 2], [len * 0.32, -wid / 2], [-len * 0.32, wid / 2], [-len * 0.32, -wid / 2]].forEach(function (p) {
      var w = cyl(0.36, 0.36, 0.26, 0x181818, p[0], 0.36, p[1], 12);
      w.rotation.x = Math.PI / 2;
      g.add(w); wheels.push(w);
      var hub = cyl(0.18, 0.18, 0.28, 0xbbbbbb, p[0], 0.36, p[1], 8);
      hub.rotation.x = Math.PI / 2; g.add(hub);
    });
    g.userData = { wheels: wheels, body: body, length: len };
    return g;
  };

  W.makePoliceCar = function () {
    var g = W.makeCar(0xf2f2f2, { length: 4.5 });
    // Black-and-white doors + light bar.
    g.add(box(1.6, 0.5, 1.92, 0x1a1a22, -0.2, 0.62, 0));
    var bar = box(1.1, 0.16, 0.5, 0x222222, -0.2, 1.55, 0);
    g.add(bar);
    var red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), mat(0xff2020, { emissive: 0xff0000, ei: 2 }));
    red.position.set(-0.2, 1.62, -0.28); g.add(red);
    var blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), mat(0x2040ff, { emissive: 0x0022ff, ei: 2 }));
    blue.position.set(-0.2, 1.62, 0.28); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
    g.userData.lightPhase = 0;
    return g;
  };

  W.makeHelicopter = function () {
    var g = new THREE.Group();
    var body = box(3.2, 1.1, 1.6, 0x223344, 0, 0, 0);
    g.add(body);
    var glass = box(1.0, 0.8, 1.5, 0x9fd4e8, 1.4, 0.1, 0);
    g.add(glass);
    var tail = box(3.4, 0.4, 0.4, 0x223344, -3.0, 0.3, 0);
    g.add(tail);
    var fin = box(0.3, 1.2, 0.1, 0xcc2222, -4.6, 0.8, 0);
    g.add(fin);
    var rotor = new THREE.Group(); rotor.position.set(0, 0.75, 0);
    rotor.add(box(5.6, 0.08, 0.3, 0x111111, 0, 0, 0));
    rotor.add(box(0.3, 0.08, 5.6, 0x111111, 0, 0, 0));
    g.add(rotor);
    var skidL = box(2.6, 0.08, 0.12, 0x444444, 0, -0.8, 0.7);
    var skidR = box(2.6, 0.08, 0.12, 0x444444, 0, -0.8, -0.7);
    g.add(skidL); g.add(skidR);
    var spot = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat(0xfff2b0, { emissive: 0xffedb0, ei: 2 }));
    spot.position.set(1.6, -0.5, 0); g.add(spot);
    g.userData.rotor = rotor;
    return g;
  };

  // ------------------------------------------------------------ pedestrians
  W.makePed = function () {
    var g = new THREE.Group();
    var shirt = PH.pick(W.PALETTE.pedColors);
    var pants = PH.pick([0x2a3248, 0x5a4a3a, 0x333333, 0x7a2a2a]);
    var skin = PH.pick([0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6b4423]);
    var legL = new THREE.Group(); legL.position.set(-0.16, 0.85, 0);
    legL.add(box(0.24, 0.85, 0.28, pants, 0, -0.42, 0));
    var legR = new THREE.Group(); legR.position.set(0.16, 0.85, 0);
    legR.add(box(0.24, 0.85, 0.28, pants, 0, -0.42, 0));
    g.add(legL); g.add(legR);
    var shirtMesh = box(0.66, 0.75, 0.36, shirt, 0, 1.22, 0);
    g.add(shirtMesh);
    g.add(box(0.36, 0.4, 0.34, skin, 0, 1.85, 0));
    var hairC = PH.pick([0x1a1a1a, 0x5a3a1a, 0x888888, 0xc9a227]);
    g.add(box(0.4, 0.14, 0.38, hairC, 0, 2.08, 0));
    var armL = new THREE.Group(); armL.position.set(-0.42, 1.55, 0);
    armL.add(box(0.18, 0.6, 0.2, shirt, 0, -0.3, 0));
    var armR = new THREE.Group(); armR.position.set(0.42, 1.55, 0);
    armR.add(box(0.18, 0.6, 0.2, shirt, 0, -0.3, 0));
    g.add(armL); g.add(armR);
    g.userData = { legL: legL, legR: legR, armL: armL, armR: armR, shirt: shirtMesh, phase: Math.random() * 6 };
    return g;
  };

  W.posePed = function (fig, dt, speed) {
    var u = fig.userData;
    if (speed > 0.05) {
      u.phase += dt * (5 + speed * 6);
      var s = Math.sin(u.phase);
      u.legL.rotation.x = s * 0.5; u.legR.rotation.x = -s * 0.5;
      u.armL.rotation.x = -s * 0.4; u.armR.rotation.x = s * 0.4;
    } else {
      u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8;
      u.armL.rotation.x *= 0.8; u.armR.rotation.x *= 0.8;
    }
  };

  // ------------------------------------------------------------ mission beacon
  W.makeBeacon = function () {
    var g = new THREE.Group();
    var cylMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    cylMesh.position.y = 3.5;
    g.add(cylMesh);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15;
    g.add(ring);
    var arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }));
    arrow.rotation.x = Math.PI; arrow.position.y = 8.5;
    g.add(arrow);
    g.userData = { ring: ring, arrow: arrow, cyl: cylMesh };
    return g;
  };

  window.PH = PH;
})();
