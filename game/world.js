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
    skyTop: 0x6fa8dc, skyMid: 0xffab7a, skyLow: 0xffc46b,
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

  // East-west road: dashes and edge lines run ALONG the road (horizontal in
  // texture space). The original texture drew them across it, and the 340 m
  // plane stretched the whole tile, so no marking was ever visible.
  W.roadTextureH = function () {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#33333e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a3a46';
      for (var i = 0; i < 900; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      g.fillStyle = '#e8c33c';
      g.fillRect(0, h / 2 - 4, 46, 8); g.fillRect(90, h / 2 - 4, 46, 8); g.fillRect(180, h / 2 - 4, 46, 8);
      g.fillStyle = '#d8d8d8';
      g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4);
    });
  };

  // Zebra crossing tile: five white stripes on a transparent tile, so the
  // asphalt shows between them.
  W.zebraTexture = function () {
    return canvasTex(128, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(240,240,240,0.92)';
      for (var i = 0; i < 5; i++) g.fillRect(8 + i * 24, 6, 14, h - 12);
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
    // Big gradient dome: bright blue top, warm peach middle, golden low —
    // a bright warm late afternoon, sun still low, horizon still orange.
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
    sun.scale.set(150, 150, 1);
    scene.add(sun);
    W.sun = sun;

    // A few flat sunset clouds.
    W.clouds = [];
    for (var k = 0; k < 14; k++) {
      var cl = new THREE.Mesh(new THREE.BoxGeometry(PH.rand(60, 150), PH.rand(4, 9), PH.rand(14, 26)),
        new THREE.MeshBasicMaterial({ color: k % 3 === 0 ? 0xffe0b8 : 0xffc9a0, transparent: true, opacity: 0.7, fog: false }));
      cl.position.set(PH.rand(-700, 700), PH.rand(120, 260), PH.rand(-700, 300));
      scene.add(cl); W.clouds.push(cl);
    }

    var hemi = new THREE.HemisphereLight(0xfff2d8, 0x8a6a55, 1.5);
    scene.add(hemi);
    var sunLight = new THREE.DirectionalLight(0xffd9a0, 2.7);
    sunLight.position.set(300, 140, -60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -220; sunLight.shadow.camera.right = 220;
    sunLight.shadow.camera.top = 220; sunLight.shadow.camera.bottom = -220;
    sunLight.shadow.camera.far = 900;
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffe0c0, 1.15));
    scene.fog = new THREE.Fog(0xf0c39a, 420, 1400);
  };

  W.buildGroundAndSea = function (scene) {
    var roadTexH = W.roadTextureH();
    roadTexH.wrapS = roadTexH.wrapT = THREE.RepeatWrapping;
    roadTexH.repeat.set(34, 1); // one tile per 10 m along the road
    var roadTexV = W.roadTexture();
    roadTexV.wrapS = roadTexV.wrapT = THREE.RepeatWrapping;
    roadTexV.repeat.set(1, 34);

    // City base slab.
    var base = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), mat(0x8a7f70));
    base.rotation.x = -Math.PI / 2; base.position.set(0, 0, 0); base.receiveShadow = true;
    scene.add(base);

    // Roads: dark strips along every grid line, both directions, with real
    // centre dashes and edge lines (the tile repeats every 10 m now).
    var streets = PH.CITY.streets;
    streets.forEach(function (s) {
      var r1 = new THREE.Mesh(new THREE.PlaneGeometry(340, 9), new THREE.MeshLambertMaterial({ map: roadTexH }));
      r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.02, s); r1.receiveShadow = true;
      scene.add(r1);
      var r2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 340), new THREE.MeshLambertMaterial({ map: roadTexV }));
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

    // Zebra crossings at every grid intersection: one striped plane per
    // intersection, stripes across the east-west road. (A second plane
    // rotated 90 degrees used to overlap it and read as a chessboard.)
    var zebraTex = W.zebraTexture();
    var zebraMat = new THREE.MeshBasicMaterial({ map: zebraTex, transparent: true, opacity: 0.8 });
    streets.forEach(function (sx) {
      streets.forEach(function (sz) {
        var z1 = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), zebraMat);
        z1.rotation.x = -Math.PI / 2; z1.position.set(sx, 0.05, sz); scene.add(z1);
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
      // Every block builds two buildings now: downtown gets a tower plus a
      // low annex, so the block is not one slab in a 40 m empty lot.
      var count = 2;
      for (var k = 0; k < count; k++) {
        var ox = count === 1 ? 0 : (k === 0 ? -8 : 8);
        var oz = count === 1 ? 0 : (k === 0 ? -8 : 8);
        var h, w, d, color, tex = null;
        var litRatio = PH.rand(0.15, 0.55); // lit-window share varies per building
        if (district === 'downtown' && k === 1) {
          // Low annex beside the tower: glass, but short and narrow.
          h = PH.rand(8, 16); w = PH.rand(10, 14); d = PH.rand(10, 14);
          color = PH.pick(W.PALETTE.glass);
          tex = W.windowTexture('#' + new THREE.Color(color).getHexString(), litRatio);
        } else if (district === 'downtown') {
          h = PH.rand(18, 58); w = PH.rand(16, 24); d = PH.rand(16, 24);
          color = PH.pick(W.PALETTE.glass);
          tex = W.windowTexture('#' + new THREE.Color(color).getHexString(), litRatio);
        } else if (district === 'ocean') {
          h = PH.rand(6, 18); w = PH.rand(12, 18); d = PH.rand(12, 18);
          color = PH.pick(W.PALETTE.deco);
          tex = W.windowTexture('#' + new THREE.Color(color).getHexString(), litRatio);
        } else if (district === 'havana') {
          h = PH.rand(5, 14); w = PH.rand(12, 18); d = PH.rand(12, 16);
          color = PH.pick(W.PALETTE.havana);
          tex = W.windowTexture('#' + new THREE.Color(color).getHexString(), litRatio);
        } else {
          h = PH.rand(7, 22); w = PH.rand(12, 18); d = PH.rand(12, 18);
          color = PH.pick(W.PALETTE.deco.concat(W.PALETTE.havana));
          tex = W.windowTexture('#' + new THREE.Color(color).getHexString(), litRatio);
        }
        // The window texture is also the emissive map, so lit windows glow
        // warm at golden hour while dark ones stay dark.
        var material = tex
          ? new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffb060, emissiveMap: tex, emissiveIntensity: 0.35 })
          : mat(color);
        // Tiered massing: the base rises to 62% of the height, then two
        // setback storeys step in (76%, then 52% of the footprint), so the
        // silhouette tapers instead of rising as one flat slab.
        var b = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.62, d), material);
        b.position.set(bx + ox, h * 0.31, bz + oz);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        b.userData.fullH = h; b.userData.fullW = w; b.userData.fullD = d;
        W.buildings.push(b);
        var midH = h * 0.24, topH = h * 0.14;
        var mid = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, midH, d * 0.76), mat(color));
        mid.position.set(bx + ox, h * 0.62 + midH / 2, bz + oz);
        mid.castShadow = true; scene.add(mid);
        var top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.52, topH, d * 0.52), mat(color));
        top.position.set(bx + ox, h * 0.86 + topH / 2, bz + oz);
        top.castShadow = true; scene.add(top);
        // Roof variety by deterministic hash: parapet, pyramid, dome, crown.
        var roofKind = (idx * 7 + k * 3) % 4;
        if (roofKind === 0) {
          var roof = box(w * 0.42, 0.8, d * 0.42, PH.pick([0x444455, 0x7a5a8a, 0x4a7a8a, 0x8a6a5a, 0xc96f3f, 0x3a6a5a]), bx + ox, h + 0.4, bz + oz);
          scene.add(roof);
        } else if (roofKind === 1) {
          var pyr = cyl(0.01, w * 0.34, PH.rand(2.5, 4.5), PH.pick([0xc96f3f, 0x3a6a5a, 0x7a5a8a]), bx + ox, h + 1.6, bz + oz, 4);
          pyr.rotation.y = Math.PI / 4; scene.add(pyr);
        } else if (roofKind === 2) {
          // Small muted dome: terracotta or grey, never a giant pink ball.
          var dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w * 0.16, 3), 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(PH.pick([0xc96f3f, 0x8a6a5a, 0x5a5a6a])));
          dome.position.set(bx + ox, h, bz + oz); scene.add(dome);
        } else {
          var crown = box(w * 0.45, PH.rand(3, 7), d * 0.45, PH.pick(W.PALETTE.glass), bx + ox, h + 2.8, bz + oz);
          scene.add(crown);
        }
        // Rooftop water tank on a terracotta block.
        if (district === 'havana' && Math.random() < 0.5) {
          scene.add(cyl(1.1, 1.1, 2.2, 0x6b4a28, bx + ox + w * 0.2, h + 1.9, bz + oz, 8));
        }
        // Shop awning over the street-facing ground floor: a slanted bright
        // slab so the base of every low building reads as a storefront.
        if (district !== 'downtown' && Math.random() < 0.75) {
          var awn = box(w * 0.8, 0.18, 2.2, PH.pick([0xff5a8a, 0x37e0c0, 0xffc93c, 0xffffff, 0x2e7fd8]), bx + ox, 3.1, bz + oz + d / 2 + 0.9);
          awn.rotation.x = 0.22;
          scene.add(awn);
        }
        // Glowing signage: a tall vertical neon strip on downtown towers,
        // a horizontal band on deco / havana fronts.
        if (district === 'downtown' && Math.random() < 0.5) {
          var neon = box(0.3, h * 0.55, 0.5, PH.pick([0xff5a8a, 0x37e0c0, 0xffc93c, 0x8fd0ff]), bx + ox + w / 2 + 0.25, h * 0.5, bz + oz,
            { emissive: 0xffffff, ei: 0.9 });
          scene.add(neon);
        } else if (district !== 'downtown' && Math.random() < 0.65) {
          var sign = box(w * 0.6, 1.1, 0.3, PH.pick([0xff5a8a, 0x37e0c0, 0xffc93c, 0x2e7fd8]), bx + ox, h - 0.6, bz + oz + d / 2 + 0.2,
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
    // Palm rows along Ocean Drive and the beach walk, closer together now
    // (every 14 m) so the coast road reads as a palm-lined boulevard.
    for (var z = -140; z <= 140; z += 14) {
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
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), mat(0xffe08a, { emissive: 0xffc040, ei: 2.0 }));
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
    // Beach umbrellas and towels — twelve now, so the sand reads busy.
    for (var u = 0; u < 12; u++) {
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
    // Pistol, hidden unless aiming / shooting. Hero scale (about 2.5x true
    // size), two-tone so it reads against ANY background: a dark frame
    // against light cars and sky, a bright steel slide against dark
    // asphalt and the orange jacket. A bright-only pistol vanished against
    // the Arrow's pale glass in the mission shot; a dark-only one would
    // vanish against the road.
    var pistol = new THREE.Group();
    pistol.add(box(0.14, 0.24, 0.66, 0x1a1a22, 0, 0, 0.16));
    pistol.add(box(0.12, 0.09, 0.6, 0xd8d8e0, 0, 0.1, 0.16, { emissive: 0x666677, ei: 0.6 }));
    pistol.add(box(0.09, 0.26, 0.13, 0x4a4a58, 0, -0.16, -0.03));
    // Sits well forward of the chest (z 0.95, not 0.58) and at hand height
    // (y 1.45): the aiming arms reach ~0.9 m, so a pistol at 0.58 hides
    // behind the hands — this one sticks out past them and reads as a gun.
    pistol.position.set(0.17, 1.45, 0.95);
    pistol.scale.set(1.3, 1.3, 1.3);
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
  // Procedural car from boxes + cylinders: body, glass cabin with real
  // windshield / side / rear windows, grille, plates, 4 wheels with rims.
  // Returns {group, wheels[], body}.
  W.makeCar = function (color, opts) {
    var o = opts || {};
    var g = new THREE.Group();
    var len = o.length || 4.4, wid = o.width || 1.9;
    var body = box(len, 0.62, wid, color, 0, 0.55, 0);
    g.add(body);
    // Cabin in body colour; glass sits proud of it so the car reads as
    // having windows instead of one dark slab.
    var cabin = box(len * 0.52, 0.55, wid * 0.86, color, -len * 0.05, 1.12, 0);
    g.add(cabin);
    var glassMat = mat(0x9fd4e8, { transparent: true, opacity: 0.78, emissive: 0x2a4a5a, ei: 0.5 });
    var shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, wid * 0.78), glassMat);
    shield.position.set(len * 0.2, 1.12, 0); shield.rotation.z = -0.32; g.add(shield);
    [-1, 1].forEach(function (s) {
      var side = new THREE.Mesh(new THREE.BoxGeometry(len * 0.38, 0.38, 0.05), glassMat);
      side.position.set(-len * 0.05, 1.16, s * (wid * 0.44)); g.add(side);
    });
    var rear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, wid * 0.7), glassMat);
    rear.position.set(-len * 0.3, 1.12, 0); g.add(rear);
    // Two-tone roof: a third of traffic cars get a contrasting roof —
    // unless the caller opts out (the Scarlet Arrow and police cars keep
    // their own roof colour).
    var twoTone = o.twoTone === undefined ? Math.random() < 0.3 : !!o.twoTone;
    var roofColor = twoTone ? PH.pick([0x222831, 0xf2f2f2, 0x1a1a1a]) : color;
    var roof = box(len * 0.5, 0.08, wid * 0.8, roofColor, -len * 0.05, 1.42, 0);
    g.add(roof);
    // Headlights / taillights.
    var hl = mat(0xfff2b0, { emissive: 0xffedb0, ei: 0.9 });
    [-1, 1].forEach(function (s) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.3), hl);
      h.position.set(len / 2, 0.6, s * 0.6); g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.3), mat(0xff2a2a, { emissive: 0xcc0000, ei: 0.8 }));
      t.position.set(-len / 2, 0.6, s * 0.6); g.add(t);
    });
    // Grille: dark slot + two chrome slats between the headlights.
    g.add(box(0.06, 0.28, wid * 0.55, 0x14141a, len / 2 + 0.01, 0.55, 0));
    g.add(box(0.03, 0.05, wid * 0.5, 0xcccccc, len / 2 + 0.05, 0.48, 0));
    g.add(box(0.03, 0.05, wid * 0.5, 0xcccccc, len / 2 + 0.05, 0.62, 0));
    // Licence plates, front and rear, with a dark registration stripe.
    g.add(box(0.04, 0.22, 0.62, 0xf2f2f2, len / 2 + 0.03, 0.3, 0));
    g.add(box(0.02, 0.07, 0.5, 0x2244aa, len / 2 + 0.06, 0.3, 0));
    g.add(box(0.04, 0.22, 0.62, 0xf2f2f2, -len / 2 - 0.03, 0.3, 0));
    g.add(box(0.02, 0.07, 0.5, 0x2244aa, -len / 2 - 0.06, 0.3, 0));
    if (o.sport) {
      g.add(box(0.5, 0.08, wid * 0.9, 0x222222, -len / 2 + 0.1, 1.0, 0)); // spoiler
      g.add(box(len * 0.3, 0.1, wid * 0.5, 0x222222, len * 0.2, 0.28, 0));
      // Hood stripe down the centre of a sports car.
      g.add(box(len * 0.42, 0.03, 0.34, 0x222831, len * 0.22, 0.87, 0));
    }
    // Bumpers + side mirrors so cars read as cars from behind and the side.
    g.add(box(0.22, 0.22, wid * 0.96, 0x222831, len / 2 - 0.05, 0.42, 0));
    g.add(box(0.22, 0.22, wid * 0.96, 0x222831, -len / 2 + 0.05, 0.42, 0));
    [-1, 1].forEach(function (s) {
      g.add(box(0.16, 0.1, 0.14, 0x222222, len * 0.14, 1.05, s * (wid / 2 + 0.06)));
    });
    var wheels = [];
    [[len * 0.32, wid / 2], [len * 0.32, -wid / 2], [-len * 0.32, wid / 2], [-len * 0.32, -wid / 2]].forEach(function (p) {
      var w = cyl(0.36, 0.36, 0.26, 0x181818, p[0], 0.36, p[1], 12);
      w.rotation.x = Math.PI / 2;
      g.add(w); wheels.push(w);
      var hub = cyl(0.24, 0.24, 0.28, 0xd8d8d8, p[0], 0.36, p[1], 10);
      hub.rotation.x = Math.PI / 2; g.add(hub);
      var cap = cyl(0.09, 0.09, 0.3, 0x222222, p[0], 0.36, p[1], 8);
      cap.rotation.x = Math.PI / 2; g.add(cap);
    });
    g.userData = { wheels: wheels, body: body, length: len };
    return g;
  };

  W.makePoliceCar = function () {
    var g = W.makeCar(0xf2f2f2, { length: 4.5, twoTone: false });
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
    // Spotlight cone: narrow at the belly, wide on the street below, so the
    // air unit reads as "searching" even from far away. Tilted toward the
    // player each frame by the sim (heli-local +z faces the player).
    // 13 m tall: the heli flies at 13 m, so the cone just reaches the road.
    // Narrow (4.5 m) and faint: a wide cone reads as a pink kite in the sky.
    var cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 13, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.set(0, -6.5, 0);
    g.add(cone);
    g.userData.rotor = rotor;
    g.userData.spotCone = cone;
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
      new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
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

// ---- PIER HEAT v6.2 fidelity pass (written fresh in this session) ----
// Sports-car body: sloped hood, arched fenders, sloping roofline, low stance.
// Contract kept from v6.1 makeCar: returns a THREE.Group; userData.wheels holds
// the four tyre meshes, userData.body is the main lower-body mesh (first child),
// userData.length is the body length. Local axes: +x = front, y = up, z = width.
function makeCar_v62(color, opts) {
  var L = (opts && opts.length) || 4.4;
  var wx = L * 0.32; // wheelbase half-length
  var g = new THREE.Group();
  function lam(c, e) {
    var m = new THREE.MeshLambertMaterial({ color: c });
    if (e !== undefined && e !== null) m.emissive = new THREE.Color(e);
    return m;
  }
  var bodyMat = lam(typeof color === 'number' ? color : 0xcccccc);
  var glassMat = lam(0x9fd4e8, 0x2a4a5a);
  var darkMat = lam(0x14141a);
  var tyreMat = lam(0x181818);
  var hubMat = lam(0xd8d8d8);
  var headMat = lam(0xfff2b0, 0xffedb0);
  var tailMat = lam(0xff2a2a, 0xcc0000);
  function add(geo, material, x, y, z, rz) {
    var m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (rz) m.rotation.z = rz;
    g.add(m);
    return m;
  }
  function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  // 0: main lower body slab (userData.body) — low and long.
  var body = add(box(L, 0.5, 1.86), bodyMat, 0, 0.52, 0, 0);
  // lower valance + side skirts
  add(box(L * 0.92, 0.12, 1.88), darkMat, 0, 0.3, 0, 0);
  add(box(L * 0.5, 0.1, 0.07), darkMat, 0, 0.32, 0.94, 0);
  add(box(L * 0.5, 0.1, 0.07), darkMat, 0, 0.32, -0.94, 0);
  // sloped hood: nose lower than cowl
  add(box(1.35, 0.09, 1.68), bodyMat, L / 2 - 0.72, 0.8, 0, -0.13);
  // front splitter + grille + bumpers
  add(box(0.3, 0.08, 1.7), darkMat, L / 2 - 0.1, 0.28, 0, 0);
  add(box(0.06, 0.18, 1.15), darkMat, L / 2 + 0.08, 0.52, 0, 0);
  add(box(0.2, 0.3, 1.84), bodyMat, L / 2 - 0.02, 0.44, 0, 0);
  add(box(0.2, 0.3, 1.84), bodyMat, -L / 2 + 0.02, 0.44, 0, 0);
  // headlights / taillights
  add(box(0.08, 0.15, 0.44), headMat, L / 2 + 0.05, 0.66, 0.58, 0);
  add(box(0.08, 0.15, 0.44), headMat, L / 2 + 0.05, 0.66, -0.58, 0);
  add(box(0.08, 0.15, 0.44), tailMat, -L / 2 - 0.05, 0.66, 0.58, 0);
  add(box(0.08, 0.15, 0.44), tailMat, -L / 2 - 0.05, 0.66, -0.58, 0);
  // arched fenders over each wheel (torus half-arch, body colour)
  var fenderGeo = new THREE.TorusGeometry(0.48, 0.1, 8, 14, Math.PI);
  [wx, -wx].forEach(function (fx) {
    [0.97, -0.97].forEach(function (fz) {
      var f = new THREE.Mesh(fenderGeo, bodyMat);
      f.position.set(fx, 0.36, fz);
      g.add(f);
    });
  });
  // cabin: dark interior core, then sloped glass + roof sloping down to the rear
  add(box(1.9, 0.42, 1.4), darkMat, -0.15, 1.0, 0, 0);
  add(box(0.07, 0.55, 1.5), glassMat, 0.72, 1.03, 0, 0.45);
  add(box(0.07, 0.42, 1.42), glassMat, -1.0, 1.03, 0, -0.38);
  add(box(1.45, 0.32, 0.05), glassMat, -0.15, 1.06, 0.78, 0);
  add(box(1.45, 0.32, 0.05), glassMat, -0.15, 1.06, -0.78, 0);
  add(box(1.8, 0.07, 1.42), bodyMat, -0.18, 1.3, 0, 0.08);
  // mirrors
  add(box(0.14, 0.09, 0.12), darkMat, 0.55, 1.02, 1.0, 0);
  add(box(0.14, 0.09, 0.12), darkMat, 0.55, 1.02, -1.0, 0);
  // spoiler: small lip always; full wing when opts.sport
  add(box(0.5, 0.06, 1.5), bodyMat, -L / 2 + 0.18, 0.84, 0, 0);
  if (opts && opts.sport) {
    add(box(0.55, 0.05, 1.62), bodyMat, -L / 2 + 0.12, 1.04, 0, 0);
    add(box(0.07, 0.2, 0.07), darkMat, -L / 2 + 0.12, 0.93, 0.55, 0);
    add(box(0.07, 0.2, 0.07), darkMat, -L / 2 + 0.12, 0.93, -0.55, 0);
  }
  // wheels: tyre (spun by sim) + hub + cap
  var wheels = [];
  [wx, -wx].forEach(function (fx) {
    [0.95, -0.95].forEach(function (fz) {
      var tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tyreMat);
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(fx, 0.36, fz);
      g.add(tyre);
      wheels.push(tyre);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.28, 10), hubMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(fx, 0.36, fz);
      g.add(hub);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), darkMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(fx, 0.36, fz);
      g.add(cap);
    });
  });
  g.userData.wheels = wheels;
  g.userData.body = body;
  g.userData.length = L;
  return g;
}
if (window.PH && window.PH.world) window.PH.world.makeCar = makeCar_v62;

// ---- PIER HEAT v6.2: Mateo proportions + window variation + signed skyline ----
// Mateo: head a touch smaller vs the body, arms angled slightly away from the
// torso, jacket widened so it covers the torso fully from every angle.
(function () {
  var W = window.PH && window.PH.world;
  if (!W || !W.makeMateo) return;
  var _makeMateo = W.makeMateo;
  W.makeMateo = function () {
    var g = _makeMateo();
    try {
      var kids = g.children || [];
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (!k || !k.position) continue;
        if (k.position.y > 1.7 && k.position.x === 0 && k.position.z === 0) {
          k.scale.set(0.88, 0.88, 0.88); // head group
          k.position.y = 1.8;
        } else if (k.userData && k.userData.upper) {
          k.rotation.z = k.position.x < 0 ? 0.07 : -0.07; // arms hang clear
        } else if (Math.abs(k.position.y - 0.95) < 0.01 && k.position.x === 0) {
          k.scale.x = 1.04; k.scale.z = 1.04; // jacket torso group
        }
      }
    } catch (e) { /* keep the original Mateo on any surprise */ }
    return g;
  };
})();

// Windows: repeat the facade texture per building size (tall = smaller, denser
// windows; low = bigger windows), randomise the pattern phase, and vary the
// warm lit-vs-dark emissive per building instead of one flat pattern.
function v62TowerWindows(seed) {
  var c = document.createElement('canvas'); c.width = 128; c.height = 256;
  var x = c.getContext('2d');
  x.fillStyle = '#3a3348'; x.fillRect(0, 0, 128, 256);
  var s = seed || 12345;
  var rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (var r = 0; r < 8; r++) {
    for (var col = 0; col < 4; col++) {
      var lit = rnd();
      x.fillStyle = lit < 0.45 ? '#ffd9a0' : lit < 0.7 ? '#ff9a50' : '#1c2030';
      x.fillRect(10 + col * 30, 10 + r * 30, 20, 20);
    }
  }
  var t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}
function v62SignTexture(text) {
  var c = document.createElement('canvas'); c.width = 1024; c.height = 192;
  var x = c.getContext('2d');
  x.fillStyle = '#101018'; x.fillRect(0, 0, 1024, 192);
  x.strokeStyle = '#ff9a3c'; x.lineWidth = 10; x.strokeRect(10, 10, 1004, 172);
  x.fillStyle = '#ffd9a0'; x.font = 'bold 96px Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 512, 100);
  return new THREE.CanvasTexture(c);
}
function v62RoofSign(scene, x, y, z, w, text) {
  var tex = v62SignTexture(text);
  var face = new THREE.MeshBasicMaterial({ map: tex });
  var dark = new THREE.MeshLambertMaterial({ color: 0x14141c });
  var sign = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, 0.9), [dark, dark, dark, dark, face, face]);
  sign.position.set(x, y + 1.8, z);
  sign.rotation.y = Math.atan2(-x, -z);
  scene.add(sign);
  var legMat = new THREE.MeshLambertMaterial({ color: 0x22222c });
  [-w / 3, w / 3].forEach(function (off) {
    var leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), legMat);
    leg.position.set(x + Math.cos(sign.rotation.y) * off, y + 0.1, z - Math.sin(sign.rotation.y) * off);
    scene.add(leg);
  });
  return sign;
}
(function () {
  var W = window.PH && window.PH.world;
  if (!W || !W.buildBuildings) return;
  var _buildBuildings = W.buildBuildings;
  W.buildBuildings = function (scene) {
    _buildBuildings(scene);
    try {
      var list = W.buildings || [];
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        if (!b || !b.geometry || !b.geometry.parameters || !b.material) continue;
        var p = b.geometry.parameters;
        var map = b.material.map;
        if (map) {
          map.wrapS = THREE.RepeatWrapping;
          map.wrapT = THREE.RepeatWrapping;
          map.repeat.set(Math.max(1, Math.min(3, Math.round(p.width / 7))), Math.max(1, Math.min(4, Math.round(p.height / 7))));
          map.offset.set((((i * 37) % 10) / 10) * 0.5, 0);
          map.needsUpdate = true;
        }
        var pick = (i * 2654435761) % 100;
        var em = pick < 45 ? 0xffb060 : pick < 70 ? 0xff9a40 : pick < 88 ? 0x8a6a44 : 0x2a1e12;
        if (b.material.emissive) b.material.emissive.setHex(em);
      }
      // named rooftop signs on the four downtown towers (h >= 30)
      var names = ['HOTEL SERIWA', 'LAGUNA RASI', 'PIRA PALACE', 'SUNSET PIER'];
      var ni = 0;
      for (var j = 0; j < list.length; j++) {
        var t = list[j];
        if (!t || !t.geometry || !t.geometry.parameters) continue;
        if ((t.userData.fullH || t.geometry.parameters.height) >= 30 && ni < names.length) {
          v62RoofSign(scene, t.position.x, (t.userData.fullH || t.geometry.parameters.height), t.position.z, 17, names[ni++]);
        }
      }
      // denser skyline: extra towers around the outer edges, each signed
      var towers = [
        [-90, -140, 20, 34, 18, 'MARINA BAY HOTEL'], [-30, -140, 22, 44, 20, 'CASA DEL SOL'],
        [30, -140, 20, 30, 18, 'THE MERIDIAN'], [90, -140, 22, 40, 20, 'PALM COURT'],
        [-60, 140, 20, 28, 18, 'CORAL ARCADE'], [0, 140, 22, 38, 20, 'VISTA LUMINA'],
        [60, 140, 20, 32, 18, 'BAHIA GRANDE'], [-140, -60, 18, 30, 20, 'TORRE AURORA'],
        [-140, 60, 18, 36, 20, 'SELAT SUITES'], [142, -100, 18, 26, 18, 'PIER 9 RESIDENCES'],
        [142, 100, 18, 30, 18, 'CASA MARINA']
      ];
      for (var k = 0; k < towers.length; k++) {
        var tw = towers[k];
        var mat = new THREE.MeshLambertMaterial({ map: v62TowerWindows(1000 + k * 7919), emissive: 0x3a2818 });
        var mesh = new THREE.Mesh(new THREE.BoxGeometry(tw[2], tw[3], tw[4]), mat);
        mesh.position.set(tw[0], tw[3] / 2, tw[1]);
        scene.add(mesh);
        // Setback cap on every skyline tower, so the outer ring tapers too.
        var cap = new THREE.Mesh(new THREE.BoxGeometry(tw[2] * 0.6, 4, tw[4] * 0.6),
          new THREE.MeshLambertMaterial({ color: 0x3a3348 }));
        cap.position.set(tw[0], tw[3] + 2, tw[1]);
        scene.add(cap);
        v62RoofSign(scene, tw[0], tw[3], tw[1], 15, tw[5]);
      }
    } catch (e) { /* skyline extras are cosmetic; never break the build */ }
  };
})();

// ---- PIER HEAT v6.2: fill the empty block quadrants (park / parking / stall) ----
// Every 40 m block holds two buildings on one diagonal; the other diagonal's
// quadrants are bare cream ground. Fill a third of the blocks (deterministic
// hash, tower blocks skipped) with a pocket park, a marked parking bay with a
// parked car, or a street-food stall.
(function () {
  var W = window.PH && window.PH.world;
  if (!W || !W.buildStreetProps) return;
  var _buildStreetProps = W.buildStreetProps;
  function lam(c, e) {
    var m = new THREE.MeshLambertMaterial({ color: c });
    if (e !== undefined && e !== null) m.emissive = new THREE.Color(e);
    return m;
  }
  function bx(scene, mat, w, h, d, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  function v62Park(scene, x, z) {
    bx(scene, lam(0x4a7c3a), 6, 0.15, 6, x, 0.08, z, 0);
    var bush = lam(0x2e5a2e);
    [-1.9, 1.9].forEach(function (off, i) {
      var b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bush);
      b.position.set(x + off, 0.6, z + (i === 0 ? -1.9 : 1.9));
      scene.add(b);
    });
    var wood = lam(0x8a5a2e);
    bx(scene, wood, 1.8, 0.12, 0.5, x, 0.45, z - 1.2, 0);
    bx(scene, wood, 1.8, 0.5, 0.1, x, 0.7, z - 1.42, 0);
    try {
      if (W.makePalm) { var p = W.makePalm(); p.position.set(x + 1.8, 0, z + 1.8); scene.add(p); }
    } catch (e) { /* palm optional */ }
  }
  function v62Parking(scene, x, z, seed) {
    bx(scene, lam(0x2c2c34), 7, 0.1, 5, x, 0.06, z, 0);
    var line = lam(0xf2f2f2);
    [-2.3, 0, 2.3].forEach(function (off) { bx(scene, line, 0.12, 0.02, 4.5, x + off, 0.12, z, 0); });
    var colors = [0x3c78d8, 0xd8b13c, 0x7a4a9a, 0x4a9a6a];
    var car = makeCar_v62(colors[seed % colors.length], { length: 4.4 });
    car.position.set(x - 1.15, 0, z);
    car.rotation.y = 0;
    scene.add(car);
  }
  function v62Stall(scene, x, z, seed) {
    var canopies = [0xff7a3c, 0xffd23c, 0x3cc8ff];
    var pole = lam(0x3a3a44);
    [[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.2], [1.5, 1.2]].forEach(function (c) {
      var p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), pole);
      p.position.set(x + c[0], 1.2, z + c[1]);
      scene.add(p);
    });
    bx(scene, lam(canopies[seed % canopies.length]), 3.2, 0.12, 2.7, x, 2.45, z, 0);
    bx(scene, lam(0x6a4a2e), 2.6, 0.9, 1.1, x, 0.45, z, 0);
    bx(scene, lam(0xf2f2f2), 2.7, 0.08, 1.2, x, 0.95, z, 0);
    var crate = lam(0x9a7a3c);
    bx(scene, crate, 0.6, 0.6, 0.6, x - 1.9, 0.3, z + 0.8, 0.3);
    bx(scene, crate, 0.6, 0.6, 0.6, x + 1.9, 0.3, z - 0.8, 0);
    var bulb = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    [-1.2, 0, 1.2].forEach(function (off) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), bulb);
      s.position.set(x + off, 2.3, z + 1.25);
      scene.add(s);
    });
  }
  W.buildStreetProps = function (scene) {
    _buildStreetProps(scene);
    try {
      var centers = [-100, -60, -20, 20, 60, 100];
      var towerBlocks = { '-20,-20': 1, '-20,20': 1, '20,-20': 1, '20,20': 1 };
      for (var i = 0; i < centers.length; i++) {
        for (var j = 0; j < centers.length; j++) {
          var cx = centers[i], cz = centers[j];
          if (towerBlocks[cx + ',' + cz]) continue;
          var h = ((cx * 31 + cz * 17) % 3 + 3) % 3;
          if (h !== 0) continue;
          var quads = [[cx - 8, cz + 8], [cx + 8, cz - 8]];
          for (var q = 0; q < quads.length; q++) {
            var qx = quads[q][0], qz = quads[q][1];
            var kind = ((qx * 13 + qz * 29) % 3 + 3) % 3;
            if (kind === 0) v62Park(scene, qx, qz);
            else if (kind === 1) v62Parking(scene, qx, qz, qx + qz);
            else v62Stall(scene, qx, qz, qx + qz);
          }
        }
      }
    } catch (e) { /* block fills are cosmetic; never break the build */ }
  };
})();

// ---- PIER HEAT v6.2: facade marquee signs on the tall towers ----
// The roof signs sit above the title camera's frame, so the four downtown
// towers (and the four north-edge skyline towers) also get a lit marquee on
// their north face, which is the face the title camera looks at.
(function () {
  var W = window.PH && window.PH.world;
  if (!W || !W.buildBuildings) return;
  var _bb = W.buildBuildings;
  function marquee(scene, x, y, z, w, text) {
    var tex = v62SignTexture(text);
    var face = new THREE.MeshBasicMaterial({ map: tex });
    var dark = new THREE.MeshLambertMaterial({ color: 0x14141c });
    var sign = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, 0.6), [dark, dark, dark, dark, face, face]);
    sign.position.set(x, y, z);
    scene.add(sign);
  }
  W.buildBuildings = function (scene) {
    _bb(scene);
    try {
      var list = W.buildings || [];
      var names = ['HOTEL SERIWA', 'LAGUNA RASI', 'PIRA PALACE', 'SUNSET PIER'];
      var ni = 0;
      for (var j = 0; j < list.length; j++) {
        var t = list[j];
        if (!t || !t.geometry || !t.geometry.parameters) continue;
        var p = t.geometry.parameters;
        var fullH = t.userData.fullH || p.height;
        var fullD = t.userData.fullD || p.depth;
        if (fullH >= 30 && ni < names.length) {
          marquee(scene, t.position.x, fullH * 0.62, t.position.z + fullD / 2 + 0.35, 20, names[ni++]);
        }
      }
      var north = [[-90, -140, 34, 'MARINA BAY HOTEL'], [-30, -140, 44, 'CASA DEL SOL'], [30, -140, 30, 'THE MERIDIAN'], [90, -140, 40, 'PALM COURT']];
      for (var k = 0; k < north.length; k++) {
        marquee(scene, north[k][0], north[k][2] * 0.62, north[k][1] + 10.35, 16, north[k][3]);
      }
    } catch (e) { /* marquee signs are cosmetic */ }
  };
})();

// ---- PIER HEAT v6.3: night-market street + gunfight dressing ----
// A dense market row built on demand for the mission shot: striped stalls
// with lit name boards on both sidewalks of the x = 0 street, strings of
// warm bulbs sagging across the street, paper lanterns, crates and barrels.
// Plus two small helpers the staging uses for the firefight read: a glowing
// tracer bar between two points and a muzzle flash with a warm point light.
(function () {
  var W = window.PH && window.PH.world;
  if (!W) return;
  function lam(c, e) {
    var m = new THREE.MeshLambertMaterial({ color: c });
    if (e !== undefined && e !== null) m.emissive = new THREE.Color(e);
    return m;
  }
  function bx(scene, material, w, h, d, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  W.buildNightMarket = function (scene, cx, cz) {
    if (!scene) return;
    if (scene.userData.marketBuilt) return;
    scene.userData.marketBuilt = true;
    var canopyPairs = [[0xff5a3c, 0xfff2d8], [0xffc93c, 0x2e5a8a], [0x2ec8ff, 0xfff2d8], [0xff5a8a, 0xffc93c], [0x37e0a0, 0xfff2d8], [0xff8a3c, 0x2e5a8a]];
    var names = ['SATE BAY', 'TACO LUNA', 'MIE PANAS', 'JUS SEGAR', 'JAGUNG BAKAR', 'KOPI SENJA'];
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    var stallZ = [78, 82, 89, 93, 100, 104, 111, 115];
    for (var s = 0; s < 8; s++) {
      var side = s % 2 === 0 ? -1 : 1;
      var z = stallZ[s];
      var x = cx + side * 5.6;
      var pair = canopyPairs[s % canopyPairs.length];
      var pole = lam(0x3a3a44);
      [[-1.7, -1.4], [1.7, -1.4], [-1.7, 1.4], [1.7, 1.4]].forEach(function (c) {
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 6), pole);
        p.position.set(x + c[0], 1.4, z + c[1]);
        scene.add(p);
      });
      // Striped canopy: five slats alternating the pair's two colours.
      for (var sl = 0; sl < 5; sl++) {
        bx(scene, lam(pair[sl % 2]), 0.72, 0.1, 3.0, x - 1.44 + sl * 0.72, 2.75, z, 0);
      }
      bx(scene, lam(0x6a4a2e), 3.0, 0.9, 1.2, x, 0.45, z, 0);
      bx(scene, lam(0xf2f2f2), 3.1, 0.08, 1.3, x, 0.95, z, 0);
      var crate = lam(0x9a7a3c);
      bx(scene, crate, 0.6, 0.6, 0.6, x - side * 2.1, 0.3, z + 0.8, 0.3);
      bx(scene, crate, 0.6, 0.6, 0.6, x + side * 2.1, 0.3, z - 0.8, 0);
      var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 10), lam(0x5a7a8a));
      barrel.position.set(x + side * 2.1, 0.45, z + 0.9);
      scene.add(barrel);
      // Warm bulbs along the stall's front edge + a lit name board.
      [-1.3, 0, 1.3].forEach(function (off) {
        var b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), bulbMat);
        b.position.set(x + off, 2.6, z - side * 1.45);
        scene.add(b);
      });
      try {
        var tex = v62SignTexture(names[s % names.length]);
        var board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.75, 0.12),
          [lam(0x14141c), lam(0x14141c), lam(0x14141c), lam(0x14141c),
           new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
        board.position.set(x, 3.3, z - side * 1.5);
        scene.add(board);
      } catch (e) { /* name board is cosmetic */ }
      // Paper lanterns hanging at the stall corners.
      [[-1.7, -1.45], [1.7, -1.45]].forEach(function (c, li) {
        var lan = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6),
          new THREE.MeshBasicMaterial({ color: li === 0 ? 0xff7a3c : 0xff3c5a }));
        lan.position.set(x + c[0], 2.2, z + c[1]);
        scene.add(lan);
      });
    }
    // Strings of warm bulbs sagging across the street between the rows.
    [cz - 12, cz - 2, cz + 8, cz + 16].forEach(function (z) {
      for (var b = 0; b <= 8; b++) {
        var t = b / 8;
        var bx0 = cx - 5.6 + t * 11.2;
        var sag = 3.1 - Math.sin(t * Math.PI) * 0.5;
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), bulbMat);
        bulb.position.set(bx0, sag, z);
        scene.add(bulb);
      }
    });
  };
  // Glowing tracer bar from (x0,y0,z0) to (x1,y1,z1).
  W.addTracer = function (scene, x0, y0, z0, x1, y1, z1) {
    var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, len),
      new THREE.MeshBasicMaterial({ color: 0xff4a00 }));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.lookAt(x1, y1, z1);
    scene.add(m);
    return m;
  };
  // Muzzle flash: a bright core sphere plus a warm point light.
  W.muzzleFlash = function (scene, x, y, z) {
    var f = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb020 }));
    f.position.set(x, y, z);
    scene.add(f);
    var l = new THREE.PointLight(0xffc070, 22, 10);
    l.position.set(x, y, z);
    scene.add(l);
    return f;
  };
})();
