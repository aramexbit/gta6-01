// PIER HEAT — Sunset Bay v7.3
// world.js — builds Sunset Bay: sky, low sun + long shadows, haze,
// glare, ground, sea, roads, buildings, street props, palms, beach,
// pier and big low lit clouds. Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  var SHOP_NAMES = ['ARCADE','TACOS','RECORDS','DANCE HALL','HOTEL OCEAN','CINEMA','BURGERS','PIER CAFE','SURF SHOP','SUNSET MOTEL','NEON BAR','PIZZA BAY','DONUTS','LAUNDROMAT','BOOKS','FLOWERS','BARBER','IRON GYM','SUSHI WAVE','COFFEE ROAST','VINTAGE','TOYS','PHARMACY','BAKERY','SEAFOOD','JUICE BAR','TATTOO','BIKES','CAMERA','PETS','HARDWARE','NAILS','OPTIC','TRAVEL','BANK SUNSET','POST','MARKET','FISH & CHIPS','RAMEN','GELATO','CANDY','MUSIC','SKATE','DIVING','KAYAK','HOTEL PALM','HOSTEL','SPA','KARAOKE','BOWLING','ESCAPE ROOM','GALLERY','THEATER','COMICS','SNEAKERS','WATCHES','JEWELS','LIQUOR','DELI','BUBBLE TEA','NOODLES','CURRY','STEAKHOUSE','BRUNCH','ROOFTOP','LOBSTER','CORNER STORE'];
  var SIGN_COLORS = ['#b02020','#1a3a6e','#0e7a7a','#c85a00','#6a2a8a','#204060','#8a5a00'];
  var FACADE_COLORS = [0xf2e3c8, 0xaebfd0, 0xd9a08a, 0xcfe0c0, 0xe8dcc0, 0xb8c8d8, 0xe0b090];

  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: metal || 0 });
  }
  function box(w, h, d, color, x, y, z, rough, metal) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, metal));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // Real 3D windows on front AND back facades; ~22% lit warm yellow.
  function addWindows(group, w, h, d, face) {
    var floors = Math.max(1, Math.floor((h - 3.2) / 4.2));
    var cols = Math.max(2, Math.floor(w / 3.4));
    var winGeo = new THREE.BoxGeometry(1.5, 1.9, 0.14);
    var frameMat = mat(0x1c222c, 0.9);
    var litMat = new THREE.MeshStandardMaterial({ color: 0xffc860, emissive: 0xffb030, emissiveIntensity: 0.9, roughness: 0.4 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.25, metalness: 0.4 });
    var zf = face === 'front' ? d / 2 + 0.08 : -d / 2 - 0.08;
    for (var f = 0; f < floors; f++) {
      for (var c = 0; c < cols; c++) {
        var x = -w / 2 + (c + 0.5) * (w / cols);
        var y = 3.2 + f * 4.2 + 1.4;
        if (y + 1 > h - 0.6) continue;
        var frame = new THREE.Mesh(winGeo, frameMat);
        frame.position.set(x, y, zf);
        group.add(frame);
        var glass = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.65, 0.06),
          PH.R() < 0.22 ? litMat : darkMat);
        glass.position.set(x, y, zf + (face === 'front' ? 0.05 : -0.05));
        group.add(glass);
      }
    }
  }

  // Ground-floor storefront: big glass, glass door + chrome handle,
  // divider posts, striped awning and a name board.
  function addStorefront(group, w, d, name, signBg) {
    var zf = d / 2;
    var glass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 2.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.55 }));
    glass.position.set(0, 1.5, zf + 0.06);
    group.add(glass);
    // divider posts
    for (var i = -2; i <= 2; i++) {
      group.add(box(0.14, 2.6, 0.14, 0x2a2a2a, i * w * 0.2, 1.5, zf + 0.1, 0.5, 0.6));
    }
    // glass door + chrome handle
    var door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xbfe0ee, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.5 }));
    door.position.set(w * 0.28, 1.45, zf + 0.12);
    group.add(door);
    group.add(box(0.07, 0.9, 0.07, 0xc0c8d0, w * 0.28 + 0.55, 1.45, zf + 0.2, 0.3, 0.9));
    // striped awning
    var awn = PH.canvasTex(256, 64, function (g, ww, hh) {
      for (var s = 0; s < 8; s++) { g.fillStyle = s % 2 ? '#f2f2f2' : signBg; g.fillRect(s * 32, 0, 32, hh); }
    });
    var aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.12, 1.1),
      new THREE.MeshStandardMaterial({ map: awn, roughness: 0.8 }));
    aw.position.set(0, 3.15, zf + 0.55);
    group.add(aw);
    // name board
    var sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.9, 9), 1.5, 0.18),
      new THREE.MeshStandardMaterial({ map: PH.signTexture(name, signBg), roughness: 0.7 }));
    sign.position.set(0, 4.1, zf + 0.12);
    group.add(sign);
  }

  // Solid door entrance with two stone steps + chrome handle.
  function addDoorEntrance(group, w, d) {
    var zf = d / 2;
    group.add(box(1.6, 0.35, 1.2, 0x8a8a92, 0, 0.18, zf + 0.6, 0.9));
    group.add(box(1.6, 0.35, 0.9, 0x9a9aa2, 0, 0.5, zf + 0.45, 0.9));
    group.add(box(1.7, 2.6, 0.14, 0x2c3844, 0, 1.9, zf + 0.08, 0.7));
    group.add(box(0.07, 0.9, 0.07, 0xc0c8d0, 0.6, 1.5, zf + 0.2, 0.3, 0.9));
  }

  function addRoofProps(group, w, h, d) {
    var n = 1 + Math.floor(PH.R() * 2);
    for (var i = 0; i < n; i++) {
      group.add(box(1.6, 0.8, 1.2, 0x6a7078, PH.rand(-w / 4, w / 4), h + 0.4, PH.rand(-d / 4, d / 4), 0.9));
    }
    group.add(box(0.5, 1.0, 0.5, 0x8a8a92, PH.rand(-w / 3, w / 3), h + 0.5, PH.rand(-d / 3, d / 3), 0.9));
    // roof slab lip
    var lip = box(w + 0.3, 0.25, d + 0.3, 0x3a3f46, 0, h + 0.12, 0, 0.9);
    group.add(lip);
  }

  function makeBuilding(x, z, w, d, h, faceNorth, isShop, signIdx) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var facade = PH.pick(FACADE_COLORS);
    var body = box(w, h, d, facade, 0, h / 2, 0, 0.9);
    g.add(body);
    var face = faceNorth ? 'front' : 'front';
    // windows on front (facing the street) and back
    addWindows(g, w, h, d, 'front');
    var back = new THREE.Group();
    back.rotation.y = Math.PI;
    addWindows(back, w, h, d, 'front');
    g.add(back);
    // side windows: the street cameras often see a building's flank,
    // and a blank flank reads as an empty wall (v7.2 rev 1, shot 2).
    var sideL = new THREE.Group();
    sideL.rotation.y = -Math.PI / 2;
    addWindows(sideL, d, h, w, 'front');
    g.add(sideL);
    var sideR = new THREE.Group();
    sideR.rotation.y = Math.PI / 2;
    addWindows(sideR, d, h, w, 'front');
    g.add(sideR);
    if (isShop) {
      var name = SHOP_NAMES[signIdx % SHOP_NAMES.length];
      addStorefront(g, w, d, name, PH.pick(SIGN_COLORS));
    } else {
      addDoorEntrance(g, w, d);
    }
    addRoofProps(g, w, h, d);
    if (!faceNorth) g.rotation.y = Math.PI;
    return g;
  }

  function makePalm(x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 9, 7), mat(0x7a5a38, 0.95));
    trunk.position.y = 4.5; trunk.castShadow = true;
    trunk.rotation.z = PH.rand(-0.06, 0.06);
    g.add(trunk);
    var leafMat = mat(0x2e8a3e, 0.85);
    for (var i = 0; i < 9; i++) {
      var leaf = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 3.4), leafMat);
      var a = (i / 9) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.5, 9.1 - Math.abs(Math.sin(a)) * 0.4, Math.sin(a) * 1.5);
      leaf.rotation.y = -a;
      leaf.rotation.x = 0.55;
      leaf.castShadow = true;
      g.add(leaf);
    }
    var nutMat = mat(0x6a4a20, 0.9);
    for (var j = 0; j < 4; j++) {
      var nut = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), nutMat);
      nut.position.set(Math.cos(j * 1.7) * 0.45, 8.55, Math.sin(j * 1.7) * 0.45);
      g.add(nut);
    }
    return g;
  }

  // Clouds (v7.3): bigger, lower, sun-kissed. Each cloud is a cluster
  // of puffs — white on top, warm orange-pink underneath where the low
  // sun hits it — so they read as sunset clouds, not flat white blobs.
  // Unlit basic materials keep them bright from every angle.
  function makeCloud(scale, opacity, sunset) {
    var g = new THREE.Group();
    var topMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0, transparent: true, opacity: opacity == null ? 0.92 : opacity, fog: true });
    var lowMat = new THREE.MeshBasicMaterial({ color: sunset ? 0xffb070 : 0xffe8c8, transparent: true, opacity: opacity == null ? 0.92 : opacity, fog: true });
    var n = 5 + Math.floor(PH.R() * 3);
    for (var i = 0; i < n; i++) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(PH.rand(4, 7.5), 10, 8), i < 2 ? lowMat : topMat);
      s.scale.y = 0.38;
      s.position.set(PH.rand(-9, 9), PH.rand(-1.5, 1.5) - (i < 2 ? 1.2 : 0), PH.rand(-4, 4));
      g.add(s);
    }
    // soft warm halo behind the cluster at sunset
    if (sunset) {
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: PH.sunTexture(), transparent: true, opacity: 0.35, fog: false, depthWrite: false
      }));
      halo.scale.set(34, 16, 1);
      halo.position.z = -2;
      g.add(halo);
    }
    g.scale.setScalar(scale);
    return g;
  }

  PH.buildWorld = function (scene, mode) {
    var sunset = mode === 'sunset';
    var W = { clouds: [], cloudShadows: [], update: null, mode: mode };
    var rng = PH.R;

    // ---- sky dome (gradient vertex colours) ----
    var skyGeo = new THREE.SphereGeometry(480, 24, 16);
    var top = sunset ? new THREE.Color(0x1a2350) : new THREE.Color(0x1e6fd8);
    var mid = sunset ? new THREE.Color(0x7a4a8a) : new THREE.Color(0x7ec3ee);
    var bot = sunset ? new THREE.Color(0xffb347) : new THREE.Color(0xd8ecf7);
    var cols = [];
    var pos = skyGeo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 480;
      var c = y > 0.35 ? top.clone().lerp(mid, 1 - (y - 0.35) / 0.65) : mid.clone().lerp(bot, 1 - (y + 1) / 1.35);
      cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    var sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    scene.add(sky);

    // ---- fog + lights (v7.3: low sun, long shadows, horizon haze) ----
    // One sun direction drives everything: the directional light, the
    // sky gradient and the glare sprite below. At sunset the sun sits
    // barely above the sea, so shadows stretch long across the road.
    // The fog colour matches the horizon band, so distant buildings
    // dissolve into the sunset instead of being cut by grey fog.
    scene.fog = new THREE.Fog(sunset ? 0xff9a5a : 0xc8d8e8, 120, 520);
    var hemi = new THREE.HemisphereLight(sunset ? 0xffd9a0 : 0xbfdfff, sunset ? 0x4a2a4a : 0x4a6a4a, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(sunset ? 0xffc080 : 0xfff2dd, sunset ? 2.6 : 2.0);
    sun.position.set(sunset ? -260 : 90, sunset ? 26 : 190, sunset ? -60 : 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 700;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    W.sun = sun;
    // warm bounce light from the sea side, so shadow faces are not dead
    var bounce = new THREE.DirectionalLight(sunset ? 0xff8a50 : 0x9fc4e8, 0.5);
    bounce.position.set(200, 40, 0);
    scene.add(bounce);

    // ---- sun disc sprite + glare streak (v7.3) ----
    var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: PH.sunTexture(), transparent: true, fog: false, depthWrite: false
    }));
    if (sunset) { sunSprite.position.set(-150, 30, -420); sunSprite.scale.set(90, 90, 1); }
    else { sunSprite.position.set(30, 160, -420); sunSprite.scale.set(80, 80, 1); }
    scene.add(sunSprite);
    // horizontal glare streak across the sun at sunset (canvas texture)
    if (sunset) {
      var glareTex = PH.canvasTex(512, 64, function (g, w, h) {
        var grad = g.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, 'rgba(255,180,80,0)');
        grad.addColorStop(0.5, 'rgba(255,220,140,0.9)');
        grad.addColorStop(1, 'rgba(255,180,80,0)');
        g.fillStyle = grad; g.fillRect(0, h / 2 - 4, w, 8);
        g.fillStyle = 'rgba(255,240,200,0.9)';
        g.beginPath(); g.arc(w / 2, h / 2, 14, 0, Math.PI * 2); g.fill();
      });
      var glare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glareTex, transparent: true, fog: false, depthWrite: false, opacity: 0.85
      }));
      glare.position.set(-150, 30, -410);
      glare.scale.set(220, 28, 1);
      scene.add(glare);
      // sun path glitter on the sea: a warm streak of flat quads
      var glitterMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.5 });
      for (var gi = 0; gi < 14; gi++) {
        var gl = new THREE.Mesh(new THREE.PlaneGeometry(10 + gi * 2, 1.2), glitterMat);
        gl.rotation.x = -Math.PI / 2;
        gl.position.set(-150 + gi * 3, 0.06, 40 + gi * 6);
        scene.add(gl);
      }
    }

    // ---- ground: city slab, sand, sea ----
    var city = new THREE.Mesh(new THREE.PlaneGeometry(300, 360),
      new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.95 }));
    city.rotation.x = -Math.PI / 2; city.position.set(30, 0, 0);
    city.receiveShadow = true;
    scene.add(city);

    var sandTex = PH.sandTexture();
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(6, 20);
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(80, 340),
      new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-68, 0.05, 0);
    sand.receiveShadow = true;
    scene.add(sand);

    var sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 360),
      new THREE.MeshStandardMaterial({ color: 0x1a6a9a, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.85 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-205, 0.02, 0);
    scene.add(sea);

    // foam lines drifting on the shore
    var foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    var foams = [];
    for (var fi = 0; fi < 4; fi++) {
      var foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 340), foamMat);
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(-102 + fi * 4.5, 0.06 + fi * 0.01, 0);
      scene.add(foam); foams.push(foam);
    }
    W.foams = foams;

    // ---- roads ----
    var roadMat = mat(0x23262c, 0.95);
    function road(x, z, w, d) {
      var r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, z);
      r.receiveShadow = true; scene.add(r);
    }
    road(-20, 0, 14, 340); // Sunset Blvd
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) { road(80.5, z, 179, 12); });
    // sidewalks
    var walkMat = mat(0x9aa0a8, 0.95);
    [-29, -11].forEach(function (x) {
      var w = new THREE.Mesh(new THREE.PlaneGeometry(4, 340), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(x, 0.09, 0);
      w.receiveShadow = true; scene.add(w);
    });
    // centre line dashes on Sunset Blvd
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xe8c832 });
    for (var dz = -165; dz <= 165; dz += 8) {
      var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.5), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(-20, 0.1, dz);
      scene.add(dash);
    }
    // zebra crossings at every cross street (v7.3: narrower — 5 slim
    // stripes over 7 units instead of a 12-unit white slab, so the
    // middle of the road stays open for the action)
    var zebraMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) {
      for (var zx = -24; zx <= -16; zx += 2) {
        var zb = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 5.5), zebraMat);
        zb.rotation.x = -Math.PI / 2; zb.position.set(zx, 0.1, z);
        scene.add(zb);
      }
    });

    // ---- buildings ----
    var signIdx = 0;
    // Sunset Blvd shop row, x = 2, facing west
    [-150, -110, -70, -30, 10, 50, 90, 130].forEach(function (z) {
      var h = PH.rand(10, 26);
      var b = makeBuilding(2, z, 16, 16, h, false, true, signIdx++);
      scene.add(b);
    });
    // second row, z+20
    [-130, -90, -50, -10, 30, 70, 110, 150].forEach(function (z) {
      var h2 = PH.rand(8, 18);
      var b2 = makeBuilding(2, z, 14, 14, h2, false, PH.R() < 0.7, signIdx++);
      scene.add(b2);
    });
    // downtown grid
    for (var gx = 26; gx <= 146; gx += 40) {
      for (var gz = -150; gz <= 130; gz += 40) {
        if (PH.R() < 0.18) continue; // open lot
        var w = PH.rand(14, 20), d = PH.rand(12, 18), h = PH.rand(12, 38);
        var b3 = makeBuilding(gx, gz, w, d, h, PH.R() < 0.5, PH.R() < 0.5, signIdx++);
        scene.add(b3);
      }
    }
    // landmark towers
    [[66, -100, 22, 20, 52], [106, 60, 24, 22, 60], [26, 110, 20, 18, 44]].forEach(function (t) {
      scene.add(makeBuilding(t[0], t[1], t[2], t[3], t[4], true, false, signIdx++));
    });

    // ---- street props ----
    var lampMat = mat(0x2c2f34, 0.6, 0.5);
    var lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: sunset ? 0xffc860 : 0x000000, emissiveIntensity: sunset ? 1.2 : 0 });
    for (var lz = -165; lz <= 165; lz += 30) {
      [-29.5, -10.5].forEach(function (lx) {
        // v7.3: skip the lamp at (-10.5, 0) — it stands half a unit
        // from the shot-2 camera and reads as a black bar in frame.
        if (lx === -10.5 && lz === 0) return;
        var g = new THREE.Group();
        g.position.set(lx, 0, lz);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), lampMat);
        pole.position.y = 3.5; pole.castShadow = true; g.add(pole);
        var arm = box(1.4, 0.12, 0.12, 0x2c2f34, lx < -20 ? 0.7 : -0.7, 6.9, 0, 0.6, 0.5);
        g.add(arm);
        var head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4), lampHeadMat);
        head.position.set(lx < -20 ? 1.35 : -1.35, 6.85, 0);
        g.add(head);
        scene.add(g);
      });
    }
    // hydrants
    [[-12.5, -60], [-12.5, 20], [-12.5, 100], [-28.5, -20], [-28.5, 80]].forEach(function (p) {
      var g = new THREE.Group(); g.position.set(p[0], 0, p[1]);
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8), mat(0xc02020, 0.6));
      body.position.y = 0.45; body.castShadow = true; g.add(body);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0xc02020, 0.6));
      cap.position.y = 0.95; g.add(cap);
      scene.add(g);
    });
    // benches
    [[-28, -100], [-28, 60], [-12.5, -140], [-12.5, 140]].forEach(function (p) {
      var g = new THREE.Group(); g.position.set(p[0], 0, p[1]);
      g.add(box(2.2, 0.12, 0.6, 0x7a5a30, 0, 0.55, 0, 0.9));
      g.add(box(2.2, 0.7, 0.1, 0x7a5a30, 0, 1.0, -0.28, 0.9));
      g.add(box(0.12, 0.55, 0.5, 0x333333, -0.9, 0.28, 0, 0.6, 0.5));
      g.add(box(0.12, 0.55, 0.5, 0x333333, 0.9, 0.28, 0, 0.6, 0.5));
      scene.add(g);
    });
    // traffic lights, west side of Sunset Blvd
    [[-26.5, -41], [-26.5, -1], [-26.5, 39], [-26.5, 79]].forEach(function (p) {
      var g = new THREE.Group(); g.position.set(p[0], 0, p[1]);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.5, 8), lampMat);
      pole.position.y = 2.75; pole.castShadow = true; g.add(pole);
      var headBox = box(0.7, 1.9, 0.5, 0x14181c, 0.4, 5.2, 0, 0.6);
      g.add(headBox);
      var cols3 = [0xff2a20, 0xffc832, 0x2aff5a];
      cols3.forEach(function (c, i) {
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6),
          new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i === 0 ? 1.4 : 0.15 }));
        lamp.position.set(0.4, 5.8 - i * 0.6, 0.26);
        g.add(lamp);
      });
      scene.add(g);
    });

    // ---- street market stalls (v7.3): the east sidewalk in shot 2
    // was a blank wall — now it is a row of stalls with striped
    // awnings, crates, fruit and a vendor NPC each, so the right side
    // of the frame has life instead of empty facade.
    function makeMarketStall(x, z, awnColor, goodsColor) {
      var g = new THREE.Group();
      g.position.set(x, 0, z);
      var counter = box(2.4, 1.0, 1.2, 0x7a5a30, 0, 0.5, 0, 0.9);
      g.add(counter);
      var awnTex = PH.canvasTex(256, 64, function (ctx, ww, hh) {
        for (var s = 0; s < 8; s++) { ctx.fillStyle = s % 2 ? '#f2f2f2' : awnColor; ctx.fillRect(s * 32, 0, 32, hh); }
      });
      var awn = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.6),
        new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.8 }));
      awn.position.set(0, 2.4, 0); awn.rotation.x = 0.15; g.add(awn);
      [-1.1, 1.1].forEach(function (px) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), mat(0x4a4a4a, 0.6, 0.5));
        pole.position.set(px, 1.2, 0.6); g.add(pole);
      });
      for (var i = 0; i < 8; i++) {
        var fruit = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(goodsColor, 0.5));
        fruit.position.set(-0.9 + (i % 4) * 0.6, 1.12, (i < 4 ? -0.25 : 0.25));
        g.add(fruit);
      }
      var crate = box(0.7, 0.7, 0.7, 0x8a6a42, 1.8, 0.35, 0.4, 0.95);
      g.add(crate);
      var sign = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.1),
        new THREE.MeshStandardMaterial({ map: PH.signTexture('FRESH', awnColor), roughness: 0.7 }));
      sign.position.set(0, 2.0, 0.75); g.add(sign);
      return g;
    }
    var stallCols = ['#c81e1e', '#0e7a7a', '#c85a00', '#6a2a8a'];
    var stallGoods = [0xff7a1a, 0xff3b30, 0xffc832, 0x37d67a];
    [-32, -18, 14, 28].forEach(function (z, i) {
      // v7.3: no stall at z -2 — it stood 1.5 units from the shot-2
      // camera and its FRESH sign filled the whole frame.
      scene.add(makeMarketStall(-8.6, z, stallCols[i % 4], stallGoods[i % 4]));
    });

    // ---- palms ----
    for (var pz = -155; pz <= 155; pz += 26) scene.add(makePalm(-33.5, pz));
    [[40, -100], [80, 20], [120, -60], [60, 100], [140, 40]].forEach(function (p) { scene.add(makePalm(p[0], p[1])); });

    // ---- pier (Z 40, X -28 to -88, deck Y 1.35) ----
    var pier = new THREE.Group();
    var deck = box(60, 0.4, 9, 0x8a6a42, -58, 1.15, 40, 0.95);
    pier.add(deck);
    // deck planks
    for (var px = -86; px <= -30; px += 3) {
      pier.add(box(0.25, 0.06, 9, 0x6a4e2e, px, 1.38, 40, 0.95));
    }
    // posts + rails + lamps + benches
    for (var px2 = -86; px2 <= -30; px2 += 7) {
      pier.add(box(0.4, 2.4, 0.4, 0x5a4026, px2, 0.2, 35.8, 0.95));
      pier.add(box(0.4, 2.4, 0.4, 0x5a4026, px2, 0.2, 44.2, 0.95));
      pier.add(box(0.4, 2.4, 0.4, 0x5a4026, px2, 0.2, 35.8, 0.95));
    }
    [-86, -72, -58, -44, -30].forEach(function (x) {
      pier.add(box(0.14, 0.1, 9, 0x7a5a30, x, 2.4, 40, 0.9));
    });
    [-80, -68, -40].forEach(function (x) {
      // v7.3: the middle lamp moved from -60 to -68 — at -60 its bulb
      // hung directly above Kira's head in shot 3 (the white ball).
      var lp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 8), lampMat);
      lp.position.set(x, 2.6, 36); lp.castShadow = true; pier.add(lp);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffc860, emissiveIntensity: 1.2 }));
      bulb.position.set(x, 4.0, 36); pier.add(bulb);
    });
    [-70, -50].forEach(function (x) {
      pier.add(box(2.2, 0.12, 0.6, 0x7a5a30, x, 1.9, 43.4, 0.9));
    });
    // PIER BAIT shack at X -40, red cone roof, own sign
    var shack = new THREE.Group(); shack.position.set(-40, 1.35, 40);
    shack.add(box(5, 3.2, 4.5, 0xe8dcc0, 0, 1.6, 0, 0.9));
    var cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 4), mat(0xb02020, 0.8));
    cone.position.y = 4.3; cone.rotation.y = Math.PI / 4; cone.castShadow = true;
    shack.add(cone);
    var shackSign = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 0.16),
      new THREE.MeshStandardMaterial({ map: PH.signTexture('PIER BAIT', '#b02020'), roughness: 0.7 }));
    shackSign.position.set(0, 2.9, 2.35); shack.add(shackSign);
    pier.add(shack);
    scene.add(pier);
    W.pier = pier;

    // ---- beach props ----
    var umbrellaColors = [0xff3b30, 0xffc832, 0x2a9df4, 0xff6ab0, 0x37d67a, 0xff7a1a, 0x8a5aff, 0x2ee6c8];
    var umbrellas = [];
    for (var u = 0; u < 12; u++) {
      var ux = PH.rand(-95, -40), uz = PH.rand(-140, 140);
      var ug = new THREE.Group(); ug.position.set(ux, 0, uz);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), mat(0xd8d0c0, 0.7));
      pole.position.y = 1.3; ug.add(pole);
      var canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 10), mat(umbrellaColors[u % umbrellaColors.length], 0.7));
      canopy.position.y = 2.8; canopy.castShadow = true; ug.add(canopy);
      scene.add(ug); umbrellas.push(ug);
      // towel beside
      var towel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0),
        mat(umbrellaColors[(u + 3) % umbrellaColors.length], 0.95));
      towel.rotation.x = -Math.PI / 2; towel.rotation.z = PH.rand(0, 3);
      towel.position.set(ux + PH.rand(1.5, 3), 0.08, uz + PH.rand(-1, 1));
      scene.add(towel);
    }
    W.umbrellas = umbrellas;
    // 5 extra towels
    for (var t = 0; t < 5; t++) {
      var tw = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), mat(PH.pick(umbrellaColors), 0.95));
      tw.rotation.x = -Math.PI / 2; tw.rotation.z = PH.rand(0, 3);
      tw.position.set(PH.rand(-95, -40), 0.08, PH.rand(-140, 140));
      scene.add(tw);
    }
    // 4 surfboards stuck in sand
    for (var sb = 0; sb < 4; sb++) {
      var board = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.55, 2.6, 8), mat(PH.pick(umbrellaColors), 0.5));
      board.scale.z = 0.28;
      board.position.set(PH.rand(-90, -50), 1.1, PH.rand(-100, 100));
      board.rotation.z = PH.rand(-0.2, 0.2);
      board.castShadow = true;
      scene.add(board);
    }
    // volleyball court at (-58,-8): posts + net + bouncing ball
    var vc = new THREE.Group(); vc.position.set(-58, 0, -8);
    vc.add(box(0.12, 2.6, 0.12, 0xd8d8d8, -4, 1.3, 0, 0.5, 0.6));
    vc.add(box(0.12, 2.6, 0.12, 0xd8d8d8, 4, 1.3, 0, 0.5, 0.6));
    var net = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
    net.position.y = 2.0; vc.add(net);
    var vball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    vball.position.set(0, 2.5, 0); vball.castShadow = true; vc.add(vball);
    scene.add(vc);
    W.volleyball = vball;
    // 3 sandcastles
    for (var sc = 0; sc < 3; sc++) {
      var castle = new THREE.Group();
      var cxp = PH.rand(-90, -50), czp = PH.rand(-120, 120);
      castle.position.set(cxp, 0, czp);
      var base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 8), mat(0xd8b878, 1));
      base.position.y = 0.45; castle.add(base);
      var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), mat(0xd8b878, 1));
      tower.position.set(0.3, 1.0, 0.2); castle.add(tower);
      var flag = box(0.05, 0.7, 0.05, 0x8a5a20, 0.3, 1.9, 0.2, 0.8);
      castle.add(flag);
      scene.add(castle);
    }

    // ---- clouds: random + 6 fixed hero clouds (v7.3: lower, bigger) ----
    var nClouds = sunset ? 10 : 16;
    for (var ci = 0; ci < nClouds; ci++) {
      var cl = makeCloud(PH.rand(1.8, 3.0), null, sunset);
      cl.position.set(PH.rand(-220, 220), PH.rand(28, 58), PH.rand(-220, 220));
      scene.add(cl); W.clouds.push(cl);
      if (!sunset) {
        var sh = new THREE.Mesh(new THREE.CircleGeometry(9, 16),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.10 }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.set(cl.position.x * 0.5, 0.12, cl.position.z * 0.5);
        scene.add(sh); W.cloudShadows.push(sh);
      }
    }
    [[-60, 38, -190], [60, 42, -210], [-45, 30, 170], [-62, 32, 190], [-195, 38, 30], [-200, 42, -40]].forEach(function (p, i) {
      var hc = makeCloud(2.6 + (i % 3) * 0.4, null, sunset);
      hc.position.set(p[0], p[1], p[2]);
      scene.add(hc); W.clouds.push(hc);
      if (!sunset) {
        var hs = new THREE.Mesh(new THREE.CircleGeometry(12, 16),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.10 }));
        hs.rotation.x = -Math.PI / 2;
        hs.position.set(p[0] * 0.5, 0.12, p[2] * 0.5);
        scene.add(hs); W.cloudShadows.push(hs);
      }
    });

    W.update = function (dt, t) {
      // foam drift
      W.foams.forEach(function (f, i) {
        f.position.x = -102 + i * 4.5 + Math.sin(t * 0.25 + i * 1.3) * 1.6;
        f.material.opacity = 0.4 + 0.2 * Math.sin(t * 0.4 + i);
      });
      // clouds drift east, wrap at the edge
      W.clouds.forEach(function (c, i) {
        c.position.x += dt * (1.2 + (i % 3) * 0.4);
        if (c.position.x > 240) c.position.x = -240;
      });
      // volleyball bounce
      if (W.volleyball) {
        var bt = (t % 1.2) / 1.2;
        W.volleyball.position.y = 0.5 + Math.abs(Math.sin(bt * Math.PI)) * 2.2;
        W.volleyball.position.x = Math.sin(t * 1.4) * 2.5;
      }
    };
    return W;
  };
})();
