// PIER HEAT — Sunset Bay v7.1
// world.js — builds the whole city of Sunset Bay: the beachfront avenue,
// the gridded downtown blocks with real 3D windows, doors and glass
// shopfronts, the living beach and the wooden pier. All names, signs and
// art are original. No external assets are loaded here.
(function () {
  'use strict';
  var PH = window.PH;

  // Original shop names for the storefront signs (64 of them).
  PH.SHOP_NAMES = [
    'ARCADE', 'TACOS', 'RECORDS', 'DANCE HALL', 'HOTEL OCEAN', 'CINEMA',
    'BURGERS', 'PIER CAFE', 'SURF SHOP', 'SUNSET MOTEL', 'NEON BAR',
    'PIZZA BAY', 'DONUTS', 'LAUNDROMAT', 'BOOKS', 'FLOWERS', 'BARBER',
    'IRON GYM', 'SUSHI WAVE', 'COFFEE ROAST', 'VINTAGE', 'TOYS',
    'PHARMACY', 'BAKERY', 'SEAFOOD', 'JUICE BAR', 'TATTOO', 'BIKES',
    'CAMERA', 'PETS', 'HARDWARE', 'NAILS', 'OPTIC', 'TRAVEL',
    'BANK SUNSET', 'POST', 'MARKET', 'FISH & CHIPS', 'RAMEN', 'GELATO',
    'CANDY', 'MUSIC', 'SKATE', 'DIVING', 'KAYAK', 'HOTEL PALM',
    'HOSTEL', 'SPA', 'KARAOKE', 'BOWLING', 'ESCAPE ROOM', 'GALLERY',
    'THEATER', 'COMICS', 'SNEAKERS', 'WATCHES', 'JEWELS', 'LIQUOR',
    'DELI', 'BUBBLE TEA', 'NOODLES', 'CURRY', 'STEAKHOUSE', 'BRUNCH',
    'ROOFTOP', 'LOBSTER', 'CORNER STORE'
  ];

  var SIGN_COLORS = [
    ['#e63946', '#ffffff'], ['#1d3557', '#ffd23e'], ['#2a9d8f', '#ffffff'],
    ['#f4a261', '#1d3557'], ['#6d28d9', '#ffe66d'], ['#0f766e', '#fef3c7'],
    ['#b91c1c', '#ffffff'], ['#164e63', '#fde68a'], ['#9d174d', '#ffffff'],
    ['#365314', '#fef08a'], ['#7c2d12', '#fdba74'], ['#1e3a8a', '#bfdbfe']
  ];

  PH.buildWorld = function (scene, mode) {
    var isSunset = (mode === 'sunset');
    var world = {
      bounds: { x0: -110, x1: 170, z0: -170, z1: 170 },
      roads: [],
      clouds: [], cloudShadows: [], water: null, foam: [],
      beachSpots: { towels: [], swim: [], surf: [], volley: null, jog: [], sandcastles: [], selfie: [] },
      pierSpots: { fish: [], benches: [], walk: [] },
      update: null
    };

    // ---------- sky, fog, lights ----------
    var skyTex = PH.makeCanvasTexture(16, 256, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      if (isSunset) {
        grad.addColorStop(0, '#2b3a6b'); grad.addColorStop(0.35, '#7a5a9e');
        grad.addColorStop(0.6, '#e8703f'); grad.addColorStop(0.8, '#ffb347');
        grad.addColorStop(1, '#ffd98a');
      } else {
        grad.addColorStop(0, '#1d6fb8'); grad.addColorStop(0.5, '#4da3e0');
        grad.addColorStop(0.8, '#a8d4f0'); grad.addColorStop(1, '#dff0fa');
      }
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    });
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
    );
    scene.add(sky);
    scene.fog = new THREE.Fog(isSunset ? 0xf2a05c : 0xbcd9ea, 120, 520);

    // v7.0: the day sun is weaker and warmer (2.6 white washed the hero
    // car pale cream); golden hour unchanged.
    var sun = new THREE.DirectionalLight(isSunset ? 0xffb066 : 0xffe9c0, isSunset ? 2.4 : 2.0);
    sun.position.set(isSunset ? -160 : 90, isSunset ? 55 : 190, isSunset ? -40 : 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(
      isSunset ? 0xffd9a0 : 0xbfdfff,
      isSunset ? 0x8a5a3a : 0x8a9a7a,
      isSunset ? 0.9 : 0.85
    ));
    world.sun = sun;

    // Sun disc in BOTH modes: low over the ocean at golden hour, high
    // with glare at noon — a soft radial glow, not a star, so the sky
    // never reads flat.
    var sunTex = PH.makeCanvasTexture(128, 128, function (g, w, h) {
      var grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255,244,200,1)');
      grad.addColorStop(0.35, 'rgba(255,205,110,0.95)');
      grad.addColorStop(0.7, 'rgba(255,150,60,0.45)');
      grad.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    });
    var sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, color: 0xffffff, transparent: true, opacity: 0.95, fog: false, depthWrite: false
    }));
    if (isSunset) {
      sunDisc.position.set(-150, 62, -420);
      sunDisc.scale.set(70, 70, 1);
    } else {
      sunDisc.position.set(30, 160, -420);
      sunDisc.scale.set(80, 80, 1);
    }
    scene.add(sunDisc);

    // ---------- shared materials ----------
    var M = {
      asphalt: new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.95 }),
      sidewalk: new THREE.MeshStandardMaterial({ color: 0x9aa0a3, roughness: 0.9 }),
      sand: new THREE.MeshStandardMaterial({ color: 0xdcc08a, roughness: 1.0 }),
      water: new THREE.MeshStandardMaterial({ color: 0x1e7fa8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 }),
      woodDark: new THREE.MeshStandardMaterial({ color: 0x6b4f33, roughness: 0.9 }),
      glassDark: new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 }),
      glassShop: null, // set below (sky-gradient texture)
      frame: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.7 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1.0 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9, side: THREE.DoubleSide }),
      white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 }),
      cloud: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, transparent: true, opacity: 0.92 }),
      shadowBlob: new THREE.MeshBasicMaterial({ color: 0x0a2436, transparent: true, opacity: 0.13, depthWrite: false })
    };
    M.glassShop = new THREE.MeshStandardMaterial({
      map: PH.makeCanvasTexture(64, 128, function (g, w, h) {
        var grad = g.createLinearGradient(0, 0, 0, h);
        if (isSunset) { grad.addColorStop(0, '#ff9a4d'); grad.addColorStop(0.6, '#ffc98a'); grad.addColorStop(1, '#7a5a8a'); }
        else { grad.addColorStop(0, '#7ec3ee'); grad.addColorStop(0.6, '#bfe3f7'); grad.addColorStop(1, '#5b8fb0'); }
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(8, 0, 10, h);
      }),
      roughness: 0.12, metalness: 0.55
    });

    function box(w, h, d, mat, x, y, z, parent) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      (parent || scene).add(m);
      return m;
    }

    // ---------- ground: sand, grass, city slab ----------
    var sandTex = PH.makeCanvasTexture(256, 256, function (g, w, h) {
      g.fillStyle = '#dcc08a'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        g.fillStyle = PH.pick(['#c9a86a', '#e8d09a', '#b89a62', '#f0dcb0']);
        g.fillRect(PH.rand(0, w), PH.rand(0, h), 2, 2);
      }
    });
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(10, 10);
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(80, 340), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-68, 0.02, 0); sand.receiveShadow = true;
    scene.add(sand);

    var citySlab = new THREE.Mesh(new THREE.PlaneGeometry(300, 340), new THREE.MeshStandardMaterial({ color: 0x7d8a76, roughness: 1 }));
    citySlab.rotation.x = -Math.PI / 2; citySlab.position.set(60, 0, 0); citySlab.receiveShadow = true;
    scene.add(citySlab);

    // Ocean + moving foam lines.
    var ocean = new THREE.Mesh(new THREE.PlaneGeometry(200, 340), M.water);
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(-205, 0.05, 0);
    scene.add(ocean);
    world.water = ocean;
    for (var f = 0; f < 4; f++) {
      var foam = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 340),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 + f * 0.08, depthWrite: false })
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(-102 - f * 7, 0.09 + f * 0.01, 0);
      scene.add(foam);
      world.foam.push(foam);
    }

    // ---------- roads ----------
    var roadTex = PH.makeCanvasTexture(128, 512, function (g, w, h) {
      g.fillStyle = '#33383f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8e8e8';
      g.fillRect(6, 0, 4, h); g.fillRect(w - 10, 0, 4, h);
      g.fillStyle = '#ffd23e';
      for (var y = 0; y < h; y += 64) g.fillRect(w / 2 - 3, y + 8, 6, 36);
    });
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;

    function road(x0, z0, x1, z1, w) {
      var len = Math.hypot(x1 - x0, z1 - z0);
      var tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, len / 40);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = (x1 === x0) ? 0 : Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
      m.receiveShadow = true;
      scene.add(m);
      world.roads.push({ x0: x0, z0: z0, x1: x1, z1: z1, w: w });
      return m;
    }
    road(-20, -170, -20, 170, 14); // Sunset Blvd (beachfront avenue)
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) { road(-9, z, 170, z, 12); });

    // Sidewalks along Sunset Blvd + crosswalks.
    box(4, 0.18, 340, M.sidewalk, -29, 0.09, 0).receiveShadow = true;
    box(4, 0.18, 340, M.sidewalk, -11, 0.09, 0).receiveShadow = true;
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) {
      for (var sx = -26; sx < -14; sx += 2.4) box(1.6, 0.02, 3.4, M.white, sx, 0.07, z);
    });

    // ---------- buildings with real 3D windows / doors / shopfronts ----------
    var winGlassMats = [], winFrameMats = [], winLitMats = [];
    var facadeColors = [0xd8c9b8, 0xc4b49a, 0xb8c4cc, 0xd8a08a, 0xa8b89a, 0xe0d4c0, 0x9ab0c0, 0xc9a0a0, 0x8fa8b8, 0xd0b890];
    var signIdx = 0;
    var dummy = new THREE.Object3D();

    function building(cx, cz, w, h, d, facing, isShop, detail) {
      var col = PH.pick(facadeColors);
      var body = box(w, h, d, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }), cx, h / 2, cz);
      body.castShadow = true; body.receiveShadow = true;
      box(w + 0.6, 0.8, d + 0.6, new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.9 }), cx, h + 0.4, cz);
      // Roof props: AC boxes + vents so roofs are not flat slabs.
      if (detail) {
        box(2.2, 1, 1.6, M.frame, cx - w / 4, h + 1.3, cz);
        box(1.2, 1.6, 1.2, M.frame, cx + w / 4, h + 1.6, cz - d / 5);
      }
      var floors = Math.max(1, Math.floor(h / 4.2));
      // Windows run along the facade itself: for a W/E facade the
      // along-axis is z (the building's depth), for N/S it is x (the
      // width). (v6.8 measured the along-axis off the wrong dimension, so
      // the Sunset Blvd frontage windows floated off the wall and the
      // facades read as blank slabs.)
      var span = (facing === 'W' || facing === 'E') ? d : w;
      var cols = Math.max(2, Math.floor(span / 3.4));
      // One window unit: dark frame + glass, or warm lit glass for a
      // random share of rooms, pushed proud of the wall.
      function addWindow(gx, gz, ry, wy) {
        dummy.position.set(gx, wy, gz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
        winFrameMats.push(dummy.matrix.clone());
        dummy.translateZ(0.07); dummy.updateMatrix();
        if (PH.chance(0.22)) winLitMats.push(dummy.matrix.clone());
        else winGlassMats.push(dummy.matrix.clone());
      }
      // Windows on the street-facing facade AND the back one, so every
      // block reads from both sides. Ground floor stays the shopfront /
      // door — no windows there.
      for (var fl = 1; fl < floors; fl++) {
        for (var c = 0; c < cols; c++) {
          var wy = 3.2 + fl * 4.2;
          var along = -span / 2 + 2 + c * ((span - 4) / Math.max(1, cols - 1));
          if (facing === 'W') {
            addWindow(cx - w / 2 - 0.08, cz + along, -Math.PI / 2, wy);
            addWindow(cx + w / 2 + 0.08, cz + along, Math.PI / 2, wy);
          } else if (facing === 'E') {
            addWindow(cx + w / 2 + 0.08, cz + along, Math.PI / 2, wy);
            addWindow(cx - w / 2 - 0.08, cz + along, -Math.PI / 2, wy);
          } else if (facing === 'N') {
            addWindow(cx + along, cz - d / 2 - 0.08, 0, wy);
            addWindow(cx + along, cz + d / 2 + 0.08, Math.PI, wy);
          } else {
            addWindow(cx + along, cz + d / 2 + 0.08, Math.PI, wy);
            addWindow(cx + along, cz - d / 2 - 0.08, 0, wy);
          }
        }
      }
      // Ground floor: real entrance — stone steps, framed door leaf with
      // a chrome handle — plus, for shops, a glass door and slim mullions
      // splitting the big shopfront pane.
      var doorX, doorZ, doorRy;
      if (facing === 'W') { doorX = cx - w / 2 - 0.1; doorZ = cz; doorRy = -Math.PI / 2; }
      else if (facing === 'N') { doorX = cx; doorZ = cz - d / 2 - 0.1; doorRy = 0; }
      else if (facing === 'S') { doorX = cx; doorZ = cz + d / 2 + 0.1; doorRy = Math.PI; }
      else { doorX = cx + w / 2 + 0.1; doorZ = cz; doorRy = Math.PI / 2; }
      var ox = (facing === 'W') ? -1 : (facing === 'E') ? 1 : 0;
      var oz = (facing === 'N') ? -1 : (facing === 'S') ? 1 : 0;
      var ax = (facing === 'W' || facing === 'E') ? 0 : 1;
      var az = (facing === 'W' || facing === 'E') ? 1 : 0;
      var chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 0.9 });
      // Two stone treads up to the entrance.
      var stepGeo = (facing === 'W' || facing === 'E')
        ? new THREE.BoxGeometry(0.7, 0.16, 2.2) : new THREE.BoxGeometry(2.2, 0.16, 0.7);
      var stepMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a4, roughness: 0.95 });
      var st1 = new THREE.Mesh(stepGeo, stepMat);
      st1.position.set(doorX + ox * 0.5, 0.08, doorZ + oz * 0.5); st1.receiveShadow = true; scene.add(st1);
      var st2 = new THREE.Mesh(stepGeo, stepMat);
      st2.position.set(doorX + ox * 0.85, 0.04, doorZ + oz * 0.85); st2.receiveShadow = true; scene.add(st2);
      if (isShop) {
        var name = PH.SHOP_NAMES[signIdx % PH.SHOP_NAMES.length];
        var pair = SIGN_COLORS[signIdx % SIGN_COLORS.length];
        signIdx++;
        var sign = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(11, w - 2), 2.4),
          new THREE.MeshStandardMaterial({ map: PH.signTexture(name, pair[0], pair[1]), roughness: 0.6 })
        );
        sign.position.set(doorX, 4.6, doorZ);
        sign.rotation.y = doorRy + Math.PI;
        if (facing === 'W' || facing === 'E') sign.rotation.y = doorRy;
        sign.position.x += (facing === 'W') ? -0.15 : (facing === 'E') ? 0.15 : 0;
        sign.position.z += (facing === 'N') ? -0.15 : (facing === 'S') ? 0.15 : 0;
        scene.add(sign);
        // Glass shopfront with a sky reflection + door, both proud of the wall.
        var glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 3, 3.1), M.glassShop);
        glass.position.set(doorX, 1.75, doorZ);
        glass.rotation.y = (facing === 'W') ? -Math.PI / 2 : (facing === 'E') ? Math.PI / 2 : (facing === 'N') ? Math.PI : 0;
        glass.position.x += (facing === 'W') ? -0.12 : (facing === 'E') ? 0.12 : 0;
        glass.position.z += (facing === 'N') ? -0.12 : (facing === 'S') ? 0.12 : 0;
        scene.add(glass);
        // Glass door in the middle of the shopfront, with a chrome pull
        // handle, and slim mullions splitting the big pane.
        var shopDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.7, 0.1), M.glassShop);
        shopDoor.position.set(doorX + ox * 0.06, 1.35, doorZ + oz * 0.06);
        shopDoor.rotation.y = glass.rotation.y;
        scene.add(shopDoor);
        var pull = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), chromeMat);
        pull.position.set(doorX + ox * 0.18 + ax * 0.35, 1.3, doorZ + oz * 0.18 + az * 0.35);
        scene.add(pull);
        var mullN = Math.max(2, Math.floor((w - 3) / 3));
        for (var mi = 1; mi <= mullN; mi++) {
          var moff = -((w - 3) / 2) + mi * ((w - 3) / (mullN + 1));
          var mull = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.1, 0.09), M.frame);
          mull.position.set(doorX + ox * 0.14 + ax * moff, 1.75, doorZ + oz * 0.14 + az * moff);
          scene.add(mull);
        }
        // Awning stripes over the shopfront.
        var awn = PH.makeCanvasTexture(128, 32, function (g, w2, h2) {
          for (var i = 0; i < 8; i++) { g.fillStyle = (i % 2) ? '#ffffff' : pair[0]; g.fillRect(i * 16, 0, 16, h2); }
        });
        var awning = new THREE.Mesh(new THREE.PlaneGeometry(w - 2.5, 1.1), new THREE.MeshStandardMaterial({ map: awn, roughness: 0.8, side: THREE.DoubleSide }));
        awning.position.set(doorX, 3.6, doorZ);
        awning.rotation.x = -0.5;
        awning.rotation.y = glass.rotation.y;
        awning.position.x += (facing === 'W') ? -0.5 : (facing === 'E') ? 0.5 : 0;
        awning.position.z += (facing === 'N') ? -0.5 : (facing === 'S') ? 0.5 : 0;
        scene.add(awning);
      } else {
        // Framed door leaf with a chrome knob.
        var dframe = box(1.8, 2.9, 0.14, M.frame, doorX, 1.45, doorZ);
        dframe.rotation.y = doorRy;
        var door = box(1.4, 2.6, 0.18, new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.8 }), doorX + ox * 0.06, 1.3, doorZ + oz * 0.06);
        door.rotation.y = doorRy;
        var knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), chromeMat);
        knob.position.set(doorX + ox * 0.2 + ax * 0.45, 1.05, doorZ + oz * 0.2 + az * 0.45);
        scene.add(knob);
      }
    }

    // Sunset Blvd frontage: shops facing the beach road.
    var bzList = [-150, -110, -70, -30, 10, 50, 90, 130];
    bzList.forEach(function (bz, i) {
      building(2, bz, 16, PH.rand(10, 26), 16, 'W', true, true);
      building(2, bz + 20, 14, PH.rand(8, 18), 14, 'W', i % 2 === 0, true);
    });
    // Downtown blocks behind the frontage.
    for (var bx = 26; bx <= 146; bx += 40) {
      for (var bz2 = -150; bz2 <= 130; bz2 += 40) {
        if (PH.chance(0.18)) continue; // a few open lots with benches / planters
        building(bx, bz2, PH.rand(14, 20), PH.rand(12, 38), PH.rand(12, 18), PH.pick(['N', 'S']), PH.chance(0.5), true);
        building(bx + 2, bz2 + 20, PH.rand(12, 16), PH.rand(8, 20), PH.rand(10, 14), 'S', false, false);
      }
    }
    // A couple of tall landmark towers so the skyline reads.
    building(66, -100, 22, 52, 20, 'S', true, true);
    building(106, 60, 24, 60, 22, 'N', true, true);
    building(26, 110, 20, 44, 18, 'W', true, true);

    // Instanced 3D windows (frames + glass) — real geometry, two draw calls.
    function instanced(mats, geo, mat) {
      var im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach(function (m, i) { im.setMatrixAt(i, m); });
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
      return im;
    }
    instanced(winFrameMats, new THREE.BoxGeometry(1.7, 2.1, 0.1), M.frame);
    instanced(winGlassMats, new THREE.BoxGeometry(1.4, 1.8, 0.14), M.glassDark);
    // Warm lit rooms: a share of the windows glow amber.
    instanced(winLitMats, new THREE.BoxGeometry(1.4, 1.8, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xff9a2e, emissiveIntensity: 0.85, roughness: 0.4 }));

    // ---------- street props: lamps, hydrants, benches, traffic lights ----------
    function lamp(x, z) {
      var g = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 8), M.frame);
      pole.position.y = 2.7; pole.castShadow = true; g.add(pole);
      var arm = box(1.6, 0.1, 0.1, M.frame, 0.7, 5.3, 0, g);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.7 }));
      head.position.set(1.4, 5.2, 0); g.add(head);
      g.position.set(x, 0, z);
      scene.add(g);
    }
    for (var lz = -150; lz <= 150; lz += 30) { lamp(-28.5, lz); lamp(-11.5, lz + 15); }
    function hydrant(x, z) {
      var g = new THREE.Group();
      var b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xc22a2a, roughness: 0.6 }));
      b.position.y = 0.35; g.add(b);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), b.material);
      cap.position.y = 0.78; g.add(cap);
      g.position.set(x, 0, z); scene.add(g);
    }
    hydrant(-12.5, -60); hydrant(-12.5, 20); hydrant(-12.5, 100); hydrant(-28.5, -20); hydrant(-28.5, 80);
    function bench(x, z, ry) {
      var g = new THREE.Group();
      box(2.2, 0.12, 0.6, M.woodDark, 0, 0.5, 0, g);
      box(2.2, 0.5, 0.1, M.woodDark, 0, 0.85, -0.28, g);
      box(0.1, 0.5, 0.5, M.frame, -1, 0.25, 0, g);
      box(0.1, 0.5, 0.5, M.frame, 1, 0.25, 0, g);
      g.position.set(x, 0, z); g.rotation.y = ry || 0; scene.add(g);
      return g;
    }
    bench(-28, -100, Math.PI / 2); bench(-28, 60, Math.PI / 2); bench(-12.5, -140, -Math.PI / 2); bench(-12.5, 140, -Math.PI / 2);
    // Traffic lights at the main intersections.
    function trafficLight(x, z) {
      var g = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 8), M.frame);
      pole.position.y = 2.5; g.add(pole);
      var headBox = box(0.5, 1.3, 0.4, M.frame, 0, 5.2, 0, g);
      [0xff3b30, 0xffcc00, 0x34c759].forEach(function (c, i) {
        var dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshBasicMaterial({ color: c }));
        dot.position.set(0, 5.6 - i * 0.4, 0.21); g.add(dot);
      });
      g.position.set(x, 0, z); scene.add(g);
    }
    // Traffic lights on the WEST side of the avenue so the chase camera
    // (which looks north from the east side) never has a pole in its face.
    trafficLight(-26.5, -41); trafficLight(-26.5, -1); trafficLight(-26.5, 39); trafficLight(-26.5, 79);

    // ---------- palms: tall and broad, about two storeys, lining the
    // beachfront avenue and the sidewalks ----------
    function palm(x, z, s) {
      var g = new THREE.Group();
      var trunkH = 9.0;
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, trunkH, 8), M.trunk);
      trunk.position.y = trunkH / 2; trunk.rotation.z = 0.06; trunk.castShadow = true; g.add(trunk);
      // Coconut clusters under the crown.
      for (var ci2 = 0; ci2 < 3; ci2++) {
        var nut = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 }));
        var na = (ci2 / 3) * Math.PI * 2;
        nut.position.set(Math.cos(na) * 0.5, trunkH - 0.3, Math.sin(na) * 0.5);
        g.add(nut);
      }
      // Nine long fronds drooping out from the crown.
      for (var i = 0; i < 9; i++) {
        var frond = new THREE.Mesh(new THREE.ConeGeometry(0.85, 5.2, 4), M.leaf);
        var a = (i / 9) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 2.1, trunkH + 0.4, Math.sin(a) * 2.1);
        frond.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
        frond.scale.set(1, 1, 0.16);
        g.add(frond);
      }
      g.position.set(x, 0, z); g.scale.setScalar(s || 1);
      scene.add(g);
      return g;
    }
    for (var pz = -155; pz <= 155; pz += 26) { palm(-33.5, pz, PH.rand(0.9, 1.25)); }
    for (var px2 = 8; px2 <= 150; px2 += 44) { palm(px2, -126, 1); palm(px2 + 20, 126, 1.1); }

    // ---------- beach: umbrellas, towels, boards, volleyball, sandcastles ----------
    function umbrella(x, z, color) {
      var g = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), M.white);
      pole.position.y = 1.2; g.add(pole);
      var top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 10), new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, side: THREE.DoubleSide }));
      top.position.y = 2.5; top.castShadow = true; g.add(top);
      g.position.set(x, 0, z); scene.add(g);
      return g;
    }
    var umColors = [0xff5d8f, 0xffd23e, 0x2ec4b6, 0xff7a1a, 0x7b5cff, 0x38b000];
    var umSpots = [[-52, -120], [-58, -90], [-48, -60], [-60, -30], [-50, 0], [-62, 30], [-52, 70], [-58, 110], [-48, 140], [-70, -140], [-70, 60], [-44, -140]];
    umSpots.forEach(function (s, i) {
      umbrella(s[0], s[1], umColors[i % umColors.length]);
      world.beachSpots.towels.push({ x: s[0] + 2.2, z: s[1] + 1.2, color: umColors[(i + 2) % umColors.length] });
    });
    // Extra towels without umbrellas.
    [[-45, -105], [-55, -45], [-47, 18], [-64, 90], [-46, 125]].forEach(function (s, i) {
      world.beachSpots.towels.push({ x: s[0], z: s[1], color: umColors[(i + 4) % umColors.length] });
    });
    // Surfboards stuck in the sand + one rack.
    function surfboard(x, z, ry, color) {
      var b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 }));
      b.scale.set(0.32, 0.05, 1.15);
      b.position.set(x, 0.5, z); b.rotation.set(0.5, ry, 0);
      b.castShadow = true; scene.add(b);
    }
    surfboard(-56, -75, 0.4, 0xff5d8f); surfboard(-54, -72, -0.5, 0x2ec4b6);
    surfboard(-60, 55, 0.9, 0xffd23e); surfboard(-48, 95, -0.3, 0x7b5cff);
    // Volleyball court on the sand.
    (function () {
      var cx = -58, cz = -8;
      var netTex = PH.makeCanvasTexture(128, 32, function (g, w, h) {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (var x = 0; x < w; x += 10) g.fillRect(x, 0, 2, h);
        for (var y = 0; y < h; y += 10) g.fillRect(0, y, w, 2);
      });
      var p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), M.frame);
      p1.position.set(cx, 1.2, cz - 4); scene.add(p1);
      var p2 = p1.clone(); p2.position.z = cz + 4; scene.add(p2);
      var net = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), new THREE.MeshStandardMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, roughness: 0.8 }));
      net.position.set(cx, 1.7, cz); net.rotation.y = Math.PI / 2; scene.add(net);
      var ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
      ball.position.set(cx + 1.5, 2.6, cz + 1); ball.castShadow = true; scene.add(ball);
      world.beachSpots.volley = { x: cx, z: cz, ball: ball };
    })();
    // Sandcastles.
    [[-50, -135], [-66, 22], [-52, 130]].forEach(function (s) {
      var c = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1 }));
      c.position.set(s[0], 0.7, s[1]); c.castShadow = true; scene.add(c);
      var t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 1 }));
      t.position.set(s[0] + 1.4, 0.4, s[1] + 0.5); scene.add(t);
      world.beachSpots.sandcastles.push({ x: s[0], z: s[1] });
    });
    // Activity zones for the crowd system.
    world.beachSpots.swim = [{ x: -112, z: -60 }, { x: -118, z: -20 }, { x: -110, z: 20 }, { x: -116, z: 80 }, { x: -108, z: 120 }];
    world.beachSpots.surf = [{ x: -122, z: -40 }, { x: -126, z: 10 }, { x: -120, z: 60 }];
    world.beachSpots.jog = [{ x: -42, z: -140 }, { x: -42, z: -60 }, { x: -42, z: 20 }, { x: -42, z: 100 }];
    world.beachSpots.selfie = [{ x: -36, z: -75, face: 1 }, { x: -36, z: 45, face: 1 }, { x: -38, z: -10, face: 1 }, { x: -38, z: 25, face: 1 }];

    // ---------- pier (extends west into the ocean at z = 40) ----------
    (function () {
      var pier = new THREE.Group();
      var deckTex = PH.makeCanvasTexture(128, 512, function (g, w, h) {
        g.fillStyle = '#8a6b45'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#6b4f33'; g.lineWidth = 3;
        for (var y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      });
      deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.repeat.set(1, 6);
      var deck = new THREE.Mesh(new THREE.BoxGeometry(60, 0.5, 9), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9 }));
      deck.position.set(-58, 1.1, 40); deck.castShadow = true; deck.receiveShadow = true;
      pier.add(deck);
      for (var px = -86; px <= -32; px += 6) {
        [-1.2, 1.2].forEach(function (dz) {
          var post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.6, 8), M.woodDark);
          post.position.set(px, 0, 40 + dz * 3.6); pier.add(post);
        });
      }
      // Rails.
      [-1, 1].forEach(function (s) {
        var rail = new THREE.Mesh(new THREE.BoxGeometry(58, 0.12, 0.12), M.woodDark);
        rail.position.set(-58, 2.3, 40 + s * 4.3); pier.add(rail);
        for (var rx = -86; rx <= -30; rx += 4) {
          var post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), M.woodDark);
          post.position.set(rx, 1.7, 40 + s * 4.3); pier.add(post);
        }
      });
      // Pier hut: bait & tackle shop with its own sign.
      var hut = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), new THREE.MeshStandardMaterial({ color: 0x2a6f7a, roughness: 0.85 }));
      hut.position.set(-40, 3.3, 40); hut.castShadow = true; pier.add(hut);
      var hutRoof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2, 4), new THREE.MeshStandardMaterial({ color: 0xb3402e, roughness: 0.8 }));
      hutRoof.position.set(-40, 6.2, 40); hutRoof.rotation.y = Math.PI / 4; pier.add(hutRoof);
      var hutSign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), new THREE.MeshStandardMaterial({ map: PH.signTexture('PIER BAIT', '#f4f1de', '#2a6f7a'), roughness: 0.6 }));
      hutSign.position.set(-36.4, 4.6, 40); hutSign.rotation.y = Math.PI / 2; pier.add(hutSign);
      // Lamps + benches on the pier.
      for (var lx = -80; lx <= -44; lx += 12) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), M.frame);
        pole.position.set(lx, 3, 43.4); pier.add(pole);
        var lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.6 }));
        lampHead.position.set(lx, 4.8, 43.4); pier.add(lampHead);
      }
      [[-72, 37.5], [-58, 42.5], [-46, 37.5]].forEach(function (b) {
        var bg = new THREE.Group();
        box(2.2, 0.12, 0.6, M.woodDark, 0, 0.5, 0, bg);
        box(2.2, 0.5, 0.1, M.woodDark, 0, 0.85, -0.28, bg);
        bg.position.set(b[0], 1.35, b[1]); pier.add(bg);
        world.pierSpots.benches.push({ x: b[0], z: b[1] });
      });
      // Fishing spots at the pier end + along the rail.
      [[-84, 37.8], [-82, 42.2], [-76, 37.8]].forEach(function (f) {
        world.pierSpots.fish.push({ x: f[0], z: f[1] });
      });
      scene.add(pier);
      world.pierSpots.walk = [{ x: -50, z: 38.5 }, { x: -62, z: 41.5 }, { x: -74, z: 38.5 }, { x: -84, z: 41 }];
    })();

    // ---------- 3D clouds + drifting cloud shadows (day mode) ----------
    function cloud(x, y, z, s) {
      var g = new THREE.Group();
      var n = PH.randInt(3, 5);
      for (var i = 0; i < n; i++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(PH.rand(4, 8), 10, 8), M.cloud);
        puff.position.set(PH.rand(-6, 6), PH.rand(-1, 1.5), PH.rand(-3, 3));
        puff.scale.y = 0.45;
        g.add(puff);
      }
      g.position.set(x, y, z);
      g.scale.setScalar(s);
      scene.add(g);
      world.clouds.push(g);
      if (!isSunset) {
        var sh = new THREE.Mesh(new THREE.CircleGeometry(PH.rand(14, 22), 20), M.shadowBlob);
        sh.rotation.x = -Math.PI / 2;
        sh.position.set(x * 0.5, 0.06, z * 0.5);
        scene.add(sh);
        world.cloudShadows.push({ mesh: sh, cloud: g });
      }
      return g;
    }
    // v7.1: lower, bigger, more clouds — the old band (y 70–110, small)
    // never entered any staged frame. The random band sits lower now,
    // and hero clouds are parked in each shot's sky so every frame has
    // clouds that read: north (chase / on foot), south (combat), west (pier).
    for (var ci = 0; ci < (isSunset ? 10 : 16); ci++) {
      cloud(PH.rand(-220, 220), PH.rand(45, 80), PH.rand(-220, 220), PH.rand(1.4, 2.4));
    }
    cloud(-60, 52, -190, 2.6); cloud(60, 58, -210, 2.4);
    cloud(-45, 34, 170, 2.4); cloud(-62, 38, 190, 2.2);
    cloud(-195, 52, 30, 2.4); cloud(-200, 58, -40, 2.0);

    // ---------- per-frame world motion ----------
    world.update = function (dt, t) {
      world.clouds.forEach(function (c, i) {
        c.position.x += dt * (1.2 + (i % 3) * 0.5);
        if (c.position.x > 260) c.position.x = -260;
      });
      world.cloudShadows.forEach(function (s) {
        s.mesh.position.x = s.cloud.position.x * 0.5;
        s.mesh.position.z = s.cloud.position.z * 0.5;
      });
      world.foam.forEach(function (f, i) {
        f.position.x = -102 - i * 7 + Math.sin(t * 0.7 + i * 1.3) * 1.6;
        f.material.opacity = 0.3 + 0.12 * Math.sin(t * 0.9 + i);
      });
      if (world.water) world.water.position.y = 0.05 + Math.sin(t * 0.5) * 0.05;
      if (world.beachSpots.volley && world.beachSpots.volley.ball) {
        var b = world.beachSpots.volley.ball;
        b.position.y = 2.4 + Math.abs(Math.sin(t * 2.2)) * 1.6;
        b.position.x = -58 + 1.5 + Math.sin(t * 1.1) * 1.8;
      }
    };

    return world;
  };

  // ---------- near-camera foreground sets (one per staged shot) ----------
  // Each set fills the empty foreground in front of that shot's camera
  // with close props and people, so no frame opens on bare pavement:
  // an overturned fruit cart with scattered fruit, crates, a beach
  // towel + surfboard, a trash can, a hydrant, a bench, and pedestrians
  // close to the lens. Positions are tuned to each staged camera, at the
  // frame edges, so the hero and the action stay clear.
  PH.buildForegroundProps = function (scene, shot) {
    var group = new THREE.Group();
    scene.add(group);
    var wood = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 });
    var woodDark = new THREE.MeshStandardMaterial({ color: 0x6b4f33, roughness: 0.9 });
    var metal = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.6, metalness: 0.4 });
    var chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 0.9 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    function bx(w, h, d, mat, x, y, z, ry) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; group.add(m); return m;
    }
    function cyl(rt, rb, h, mat, x, y, z, seg) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
      m.position.set(x, y, z); m.castShadow = true; group.add(m); return m;
    }
    function crate(x, y, z, ry, s) {
      s = s || 1;
      bx(1.1 * s, 1.1 * s, 1.1 * s, wood, x, y + 0.55 * s, z, ry);
      bx(1.14 * s, 0.1, 1.14 * s, woodDark, x, y + 1.06 * s, z, ry);
    }
    function trashCan(x, y, z) {
      cyl(0.42, 0.36, 1.0, metal, x, y + 0.5, z, 12);
      cyl(0.44, 0.44, 0.08, woodDark, x, y + 1.02, z, 12);
    }
    function hydrantFg(x, y, z) {
      var red = new THREE.MeshStandardMaterial({ color: 0xc22a2a, roughness: 0.6 });
      cyl(0.28, 0.32, 0.7, red, x, y + 0.35, z);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), red);
      cap.position.set(x, y + 0.78, z); group.add(cap);
    }
    function benchFg(x, y, z, ry) {
      var g2 = new THREE.Group();
      g2.position.set(x, y, z); g2.rotation.y = ry || 0; group.add(g2);
      function part(w, h, d, mat, px, py, pz) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(px, py, pz); m.castShadow = true; g2.add(m);
      }
      part(2.2, 0.12, 0.6, woodDark, 0, 0.5, 0);
      part(2.2, 0.5, 0.1, woodDark, 0, 0.85, -0.28);
      part(0.1, 0.5, 0.5, metal, -1, 0.25, 0);
      part(0.1, 0.5, 0.5, metal, 1, 0.25, 0);
    }
    function fruitCart(x, y, z, ry) {
      var g2 = new THREE.Group();
      g2.position.set(x, y, z); g2.rotation.y = ry || 0; group.add(g2);
      // Overturned: the tray tips on its side, wheels in the air.
      var tray = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.0), wood);
      tray.position.set(0, 0.35, 0); tray.rotation.z = 1.15; tray.castShadow = true; g2.add(tray);
      [-0.6, 0.6].forEach(function (dx) {
        var w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), dark);
        w.rotation.x = Math.PI / 2; w.position.set(dx, 0.75, 0.55); w.castShadow = true; g2.add(w);
      });
      var handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), woodDark);
      handle.rotation.z = 1.45; handle.position.set(-1.0, 0.12, 0); g2.add(handle);
      // Spilled fruit rolling away from the cart.
      var fruitCols = [0xff7a1a, 0xe63946, 0xffd23e, 0x38b000, 0xff5d8f];
      for (var i = 0; i < 14; i++) {
        var f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
          new THREE.MeshStandardMaterial({ color: fruitCols[i % fruitCols.length], roughness: 0.5 }));
        var a = PH.rand(0, Math.PI * 2), r = PH.rand(0.8, 2.6);
        f.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r * 0.8);
        f.castShadow = true; g2.add(f);
      }
    }
    function towelSurf(x, y, z, ry, color) {
      var towel = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0),
        new THREE.MeshStandardMaterial({ color: color || 0xff5d8f, roughness: 0.9 }));
      towel.rotation.x = -Math.PI / 2; towel.rotation.z = 0.3;
      towel.position.set(x, y + 0.04, z); towel.castShadow = true; group.add(towel);
      var board = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.4 }));
      board.scale.set(0.32, 0.05, 1.15);
      board.position.set(x + 1.3, y + 0.45, z + 0.4);
      board.rotation.set(0.5, ry || 0.4, 0); board.castShadow = true; group.add(board);
    }
    function walker(x, y, z, ry, state) {
      var p = PH.makePerson({ state: state || 'walk' });
      p.group.position.set(x, y, z);
      p.group.rotation.y = ry || 0;
      p.phase = PH.rand(0, 6.28);
      PH.posePerson(p, 0);
      group.add(p.group);
      return p;
    }
    if (shot === 1) {
      // Chase: props at the ROAD EDGES only — right edge near the lens,
      // left edge further up by the hero — nothing dead-centre in front
      // of the lens hiding the wedge.
      fruitCart(-12.4, 0, 14, 0.5);
      crate(-24.5, 0, 3, 0.4); crate(-25.2, 0, 4.5, -0.3); crate(-24.8, 1.1, 3.8, 0.2);
      trashCan(-11.6, 0, 10.5);
      hydrantFg(-11.8, 0, 8);
      benchFg(-24.8, 0, 6.5, 0.3);
      walker(-24.6, 0, 5.5, Math.PI, 'walk');
      walker(-12, 0, 16, 0, 'walk');
      walker(-24.2, 0, 8, Math.PI * 0.9, 'run');
    } else if (shot === 2) {
      // On foot: props at the SIDEWALK EDGES, ahead of Mateo but never
      // blocking him — shopfront edge west, road edge east.
      fruitCart(-7.6, 0, -2.4, -0.6);
      crate(-12.7, 0, -2.2, 0.3, 0.8); crate(-12.8, 0, -5.2, -0.2, 0.8);
      trashCan(-7.7, 0, -4.2);
      benchFg(-12.9, 0, -3.8, Math.PI / 2);
      hydrantFg(-13, 0, -5.4);
      walker(-7.7, 0, -2.4, Math.PI, 'walk');
      walker(-12.8, 0, -3.0, 0, 'walk');
      walker(-7.8, 0, -5.6, Math.PI, 'walk');
      // v7.1: the right side (cream shopfront wall) was empty — more
      // shoppers walking the east sidewalk, spaced out along it so they
      // read as a street crowd, not a wall of people.
      walker(-7.8, 0, -8.5, 0, 'walk');
      walker(-8.5, 0, -11.5, Math.PI, 'walk');
      walker(-7.7, 0, -14.5, 0, 'walk');
      crate(-8.3, 0, -15.8, 0.2, 0.8); crate(-8.0, 0, -15.2, -0.2, 0.6);
    } else if (shot === 3) {
      // Mission: the pier deck in front of the lens (deck top y=1.35).
      // Props sit on the DECK EDGES — north edge and far west end, the
      // only edges this camera can see — never between lens and pair.
      crate(-58.8, 1.35, 36.7, 0.5, 0.7);
      crate(-54.5, 1.35, 36.8, -0.4, 0.7);
      towelSurf(-63.5, 1.35, 37.2, 0.4, 0xffd23e);
      trashCan(-62.5, 1.35, 37.0);
      cyl(0.22, 0.16, 0.3,
        new THREE.MeshStandardMaterial({ color: 0xff5d5d, roughness: 0.7 }), -60.5, 1.5, 36.8, 10);
      walker(-59.5, 1.35, 36.9, Math.PI * 0.75, 'walk');
      walker(-65.5, 1.35, 39.5, Math.PI * 0.2, 'walk');
      // v7.1: the deck read empty — more strollers along both edges.
      walker(-63.8, 1.35, 41.5, Math.PI * 0.5, 'walk');
      walker(-68.0, 1.35, 38.8, 0, 'walk');
      walker(-64.0, 1.35, 41.8, Math.PI * 0.8, 'walk');
    } else if (shot === 4) {
      // Combat: props at the ROAD EDGES, mid-ground between the lens
      // and the cruisers — nothing dead-centre hiding Mateo or the hero.
      fruitCart(-13.5, 0, 35, 0.4);
      crate(-25.5, 0, 33, 0.3); crate(-25.6, 0, 34.2, -0.3);
      trashCan(-25.3, 0, 32);
      hydrantFg(-25.4, 0, 35.5);
      walker(-25.2, 0, 31, Math.PI, 'run');
      walker(-13.4, 0, 36.5, Math.PI * 0.85, 'run');
      walker(-25.0, 0, 37.5, Math.PI * 1.1, 'walk');
      // v7.1: mid-road was empty — runners crossing between Mateo and
      // the cruisers, so the shootout street reads alive.
      walker(-15.2, 0, 38.5, Math.PI, 'run');
      walker(-24.6, 0, 40, Math.PI * 0.9, 'run');
    }
    return group;
  };
})();
