// PIER HEAT — world.js
// Builds all of Sunset Bay procedurally from boxes, cylinders and spheres:
// the golden-hour sky and round sun sprite, the sea, beach and pier, the
// 7x7 road grid, three districts of buildings, palms and street furniture,
// plus the procedural builders for Mateo, cars and the police helicopter.
// Nothing here is loaded from a file: every texture is drawn on a canvas.
(function () {
  'use strict';
  var PH = window.PH, G = PH.G, U = PH.utils;
  var THREE = window.THREE;

  // --- canvas texture helpers ----------------------------------------------
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function skyTexture() {
    return canvasTex(16, 512, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0.0, '#1b1445');  // indigo zenith
      gr.addColorStop(0.35, '#5b2a6e'); // purple
      gr.addColorStop(0.62, '#c94b7c'); // magenta
      gr.addColorStop(0.82, '#ff8c4a'); // orange horizon
      gr.addColorStop(1.0, '#ffd23e');  // gold at the sea line
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }

  function sunTexture() {
    // A perfect circle drawn on canvas: the sprite that wears it stays
    // round from every camera angle, because a sprite always faces us.
    return canvasTex(256, 256, function (g) {
      var gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
      gr.addColorStop(0.0, 'rgba(255,255,240,1)');
      gr.addColorStop(0.25, 'rgba(255,236,160,1)');
      gr.addColorStop(0.55, 'rgba(255,178,80,0.95)');
      gr.addColorStop(0.8, 'rgba(255,110,60,0.45)');
      gr.addColorStop(1.0, 'rgba(255,110,60,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fffbe8';
      g.beginPath(); g.arc(128, 128, 62, 0, Math.PI * 2); g.fill();
    });
  }

  function roadTexture() {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#2c2c38'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a3a48';
      for (var i = 0; i < 500; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      g.fillStyle = '#e8c33a';
      g.fillRect(w / 2 - 3, 0, 6, 64); g.fillRect(w / 2 - 3, 128, 6, 64);
      g.fillStyle = '#e8e8e8';
      g.fillRect(8, 0, 3, h); g.fillRect(w - 11, 0, 3, h);
    });
  }

  function sidewalkTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#8f8a96'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7c7787';
      g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
      g.fillStyle = '#9d98a8';
      for (var i = 0; i < 120; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });
  }

  function facadeTexture(base, win, lit) {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, h - 14, w, 14);
      for (var y = 14; y < h - 20; y += 30) {
        for (var x = 10; x < w - 16; x += 26) {
          var on = Math.random() < lit;
          // Deep dark glass when unlit so windows read against pastel walls.
          g.fillStyle = on ? '#ffd98a' : '#20242e';
          g.fillRect(x, y, 16, 20);
          g.fillStyle = on ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)';
          g.fillRect(x, y, 16, 3);
        }
      }
    });
  }

  function sandTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#e8c98f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d9b878';
      for (var i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      g.fillStyle = '#f2dcae';
      for (var j = 0; j < 60; j++) g.fillRect(Math.random() * w, Math.random() * h, 3, 1);
    });
  }

  function woodTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#7a5230'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#8a5f38';
      for (var y = 0; y < h; y += 16) g.fillRect(0, y, w, 9);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (var k = 0; k < h; k += 16) g.fillRect(0, k + 14, w, 2);
    });
  }

  // --- materials ------------------------------------------------------------
  var MAT = {};
  function buildMaterials() {
    MAT.road = new THREE.MeshLambertMaterial({ map: roadTexture() });
    MAT.road.wrapS = MAT.road.wrapT = THREE.RepeatWrapping;
    MAT.sidewalk = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
    MAT.sand = new THREE.MeshLambertMaterial({ map: sandTexture() });
    MAT.wood = new THREE.MeshLambertMaterial({ map: woodTexture() });
    MAT.sea = new THREE.MeshPhongMaterial({ color: 0x1d6f8e, shininess: 120, specular: 0xffb060, transparent: true, opacity: 0.94 });
    MAT.trunk = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    MAT.frond = new THREE.MeshLambertMaterial({ color: 0x2f9e4f, side: THREE.DoubleSide });
    MAT.pole = new THREE.MeshLambertMaterial({ color: 0x22242e });
    MAT.lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
    MAT.glass = new THREE.MeshPhongMaterial({ color: 0x1c2f4a, shininess: 160, specular: 0x88bbff });
    MAT.skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3b });
    MAT.jacket = new THREE.MeshLambertMaterial({ color: 0xd8542e }); // burnt-orange bomber
    MAT.shirt = new THREE.MeshLambertMaterial({ color: 0xf5f2ea });
    MAT.jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
    MAT.shoe = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    MAT.hair = new THREE.MeshLambertMaterial({ color: 0x14100c });
    MAT.gunmetal = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
    MAT.tire = new THREE.MeshLambertMaterial({ color: 0x14141a });
    MAT.hub = new THREE.MeshLambertMaterial({ color: 0x9aa2b0 });
  }

  // --- world root -----------------------------------------------------------
  var W = {
    scene: null, camera: null, renderer: null, sun: null, sea: null,
    beacon: null, beaconLight: null, colliders: [], buildings: [],
    palms: [], lamps: [], trafficLights: [],
  };

  function box(w, h, d, mat, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || W.scene).add(m);
    return m;
  }

  // --- sky, sun, sea --------------------------------------------------------
  function buildSky() {
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
    );
    W.scene.add(sky);
    // The sun is a sprite, so it is always a perfect circle from any angle.
    var sm = new THREE.SpriteMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false });
    W.sun = new THREE.Sprite(sm);
    W.sun.position.set(430, 46, -60);
    W.sun.scale.set(120, 120, 1);
    W.scene.add(W.sun);
    // A second, smaller glow sprite for the halo.
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    halo.position.copy(W.sun.position);
    halo.scale.set(260, 260, 1);
    W.scene.add(halo);
    W.scene.fog = new THREE.Fog(0x8a4a6e, 180, 620);
    var hemi = new THREE.HemisphereLight(0xffc890, 0x3a2a5a, 0.85);
    W.scene.add(hemi);
    var sunLight = new THREE.DirectionalLight(0xffb060, 1.15);
    sunLight.position.set(300, 90, -40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -200; sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200; sunLight.shadow.camera.bottom = -200;
    sunLight.shadow.camera.far = 700;
    W.scene.add(sunLight);
    W.scene.add(new THREE.AmbientLight(0x604a80, 0.5));
  }

  function buildGroundAndSea() {
    var C = PH.CITY;
    // Base ground slab (grass-ish dark, mostly covered by roads/sidewalks).
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: 0x3d5a3a }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(60, -0.05, 0);
    ground.receiveShadow = true;
    W.scene.add(ground);
    // Sand beach east of the city.
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 340), MAT.sand);
    sand.rotation.x = -Math.PI / 2; sand.position.set(C.beachX + 18, 0.02, 0);
    sand.receiveShadow = true;
    W.scene.add(sand);
    // Sea.
    W.sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 700), MAT.sea);
    W.sea.rotation.x = -Math.PI / 2; W.sea.position.set(C.seaX + 190, 0.0, 0);
    W.scene.add(W.sea);
    // Wet sand line where waves meet the beach.
    var wet = new THREE.Mesh(new THREE.PlaneGeometry(6, 340), new THREE.MeshLambertMaterial({ color: 0xc9a86e }));
    wet.rotation.x = -Math.PI / 2; wet.position.set(C.seaX - 3, 0.03, 0);
    W.scene.add(wet);
  }

  function buildRoads() {
    var C = PH.CITY;
    var roadMat = MAT.road.clone();
    roadMat.map = MAT.road.map.clone();
    roadMat.map.needsUpdate = true;
    for (var i = 0; i < C.roads; i++) {
      var c = U.roadCoord(i);
      // East-west road (along x).
      var ew = new THREE.Mesh(new THREE.PlaneGeometry(C.half * 2 + 20, C.roadHalf * 2), MAT.road);
      ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.05, c);
      ew.receiveShadow = true;
      W.scene.add(ew);
      // North-south road (along z).
      var ns = new THREE.Mesh(new THREE.PlaneGeometry(C.roadHalf * 2, C.half * 2 + 20), MAT.road);
      ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0.06, 0);
      ns.receiveShadow = true;
      W.scene.add(ns);
      // Sidewalk strips flanking each road.
      var sw = new THREE.Mesh(new THREE.PlaneGeometry(C.half * 2 + 20, 3.2), MAT.sidewalk);
      sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.08, c + C.roadHalf + 1.6);
      sw.receiveShadow = true;
      W.scene.add(sw);
      var sw2 = sw.clone(); sw2.position.z = c - C.roadHalf - 1.6; W.scene.add(sw2);
      var sv = new THREE.Mesh(new THREE.PlaneGeometry(3.2, C.half * 2 + 20), MAT.sidewalk);
      sv.rotation.x = -Math.PI / 2; sv.position.set(c + C.roadHalf + 1.6, 0.08, 0);
      sv.receiveShadow = true;
      W.scene.add(sv);
      var sv2 = sv.clone(); sv2.position.x = c - C.roadHalf - 1.6; W.scene.add(sv2);
    }
    // Centre dashes: small bright strips on each road (cheap, reads as lanes).
    for (var j = 0; j < C.roads; j++) {
      var cc = U.roadCoord(j);
      for (var x = -140; x <= 140; x += 12) {
        box(4, 0.02, 0.35, new THREE.MeshBasicMaterial({ color: 0xe8c33a }), x, 0.09, cc, W.scene).castShadow = false;
        box(0.35, 0.02, 4, new THREE.MeshBasicMaterial({ color: 0xe8c33a }), cc, 0.09, x, W.scene).castShadow = false;
      }
    }
  }

  // --- buildings ------------------------------------------------------------
  var PASTEL = [0xffb3a7, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xbdb2ff, 0xffc6ff, 0xf1fa8c];
  var TERRA = [0xc96f3f, 0xd98a4b, 0xb85c38, 0xe0a458, 0xa34d2d, 0xcf7a45];

  function makeBuilding(x, z, w, d, h, palette, glassy) {
    var base = U.pick(palette);
    var tex = facadeTexture('#' + base.toString(16).padStart(6, '0'), glassy ? '#274b6d' : '#2a2a3a', glassy ? 0.55 : 0.35);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
    var mat = glassy
      ? new THREE.MeshPhongMaterial({ map: tex, shininess: 140, specular: 0x99ccff })
      : new THREE.MeshLambertMaterial({ map: tex });
    var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    b.castShadow = true; b.receiveShadow = true;
    W.scene.add(b);
    // Rooftop rim + a little AC box so roofs are not flat slabs.
    box(w + 0.4, 0.5, d + 0.4, new THREE.MeshLambertMaterial({ color: 0x4a3a52 }), x, h + 0.25, z);
    box(2.2, 1.1, 2.2, new THREE.MeshLambertMaterial({ color: 0x6a6a72 }), x + w * 0.2, h + 1.0, z - d * 0.15);
    // Deco awning on pastel low-rises.
    if (!glassy && h < 16) {
      box(w * 0.7, 0.35, 2.2, new THREE.MeshLambertMaterial({ color: U.pick([0xff5d8f, 0x2ec4b6, 0xffd23e]) }), x, 3.4, z + d / 2 + 0.9);
    }
    W.colliders.push({ x: x, z: z, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });
    W.buildings.push(b);
    return b;
  }

  function buildCity() {
    var blockCenters = [-110, -66, -22, 22, 66, 110];
    for (var bi = 0; bi < blockCenters.length; bi++) {
      for (var bj = 0; bj < blockCenters.length; bj++) {
        var bx = blockCenters[bi], bz = blockCenters[bj];
        // Keep the central plaza (0,0 block) open as a small park.
        if (bx === -22 && bz === -22) { buildPark(bx, bz); continue; }
        var dist = PH.utils.districtAt(bx, bz);
        if (dist === 'Ocean Drive') {
          makeBuilding(bx - 6, bz - 6, 14, 13, U.rand(8, 14), PASTEL, false);
          makeBuilding(bx + 8, bz + 7, 12, 12, U.rand(8, 13), PASTEL, false);
        } else if (dist === 'Little Havana') {
          makeBuilding(bx, bz - 7, 20, 11, U.rand(6, 11), TERRA, false);
          makeBuilding(bx - 7, bz + 8, 11, 11, U.rand(6, 10), TERRA, false);
          makeBuilding(bx + 9, bz + 8, 9, 10, U.rand(5, 9), TERRA, false);
        } else {
          // Downtown towers, 20-46 m.
          makeBuilding(bx, bz, 16, 16, U.rand(20, 46), [0x8fb8d8, 0x7aa8cc, 0xa8c8e8], true);
          if (Math.random() < 0.5) makeBuilding(bx + 0, bz + 0, 10, 10, U.rand(12, 20), [0x6a94b8], true);
        }
      }
    }
    // Ocean Drive hotel row facing the beach.
    for (var z = -110; z <= 110; z += 44) {
      makeBuilding(150, z, 14, 16, U.rand(10, 16), PASTEL, false);
    }
  }

  function buildPark(cx, cz) {
    var lawn = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshLambertMaterial({ color: 0x4a8a4a }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, 0.1, cz);
    lawn.receiveShadow = true;
    W.scene.add(lawn);
    for (var i = 0; i < 5; i++) {
      makePalm(cx + U.rand(-12, 12), cz + U.rand(-12, 12), U.rand(0.9, 1.2));
    }
    box(8, 0.5, 8, new THREE.MeshLambertMaterial({ color: 0x9a8a7a }), cx, 0.3, cz);
    box(2, 2.2, 2, new THREE.MeshLambertMaterial({ color: 0x6a7a8a }), cx, 1.6, cz);
  }

  // --- palms, lamps, benches, hydrants --------------------------------------
  function makePalm(x, z, s) {
    s = s || 1;
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 7 * s, 7), MAT.trunk);
    trunk.position.y = 3.5 * s;
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    g.add(trunk);
    for (var i = 0; i < 7; i++) {
      var frond = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 3.4 * s, 4), MAT.frond);
      frond.position.y = 7 * s;
      frond.rotation.z = Math.PI / 2 - 0.5;
      frond.rotation.y = (i / 7) * Math.PI * 2;
      frond.translateY(1.2 * s);
      frond.castShadow = true;
      g.add(frond);
    }
    var coco = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s, 8, 6), new THREE.MeshLambertMaterial({ color: 0x5a3a22 }));
    coco.position.set(0.3 * s, 6.7 * s, 0);
    g.add(coco);
    g.position.set(x, 0, z);
    W.scene.add(g);
    W.palms.push(g);
    return g;
  }

  function makeLamp(x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 8), MAT.pole);
    pole.position.y = 3.2; pole.castShadow = true;
    g.add(pole);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), MAT.pole);
    arm.position.set(0.6, 6.3, 0);
    g.add(arm);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), MAT.lampGlow);
    bulb.position.set(1.25, 6.2, 0);
    g.add(bulb);
    g.position.set(x, 0, z);
    W.scene.add(g);
    W.lamps.push(g);
    return g;
  }

  function makeBench(x, z, rot) {
    var g = new THREE.Group();
    var wood = new THREE.MeshLambertMaterial({ color: 0x8a5f38 });
    var seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), wood);
    seat.position.y = 0.55; seat.castShadow = true;
    g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.1), wood);
    back.position.set(0, 1.0, -0.28); back.rotation.x = -0.15;
    g.add(back);
    for (var s = -1; s <= 1; s += 2) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.5), MAT.pole);
      leg.position.set(s * 0.95, 0.28, 0);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot || 0;
    W.scene.add(g);
    return g;
  }

  function makeHydrant(x, z) {
    var g = new THREE.Group();
    var red = new THREE.MeshLambertMaterial({ color: 0xd43a2a });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.8, 10), red);
    body.position.y = 0.4; body.castShadow = true;
    g.add(body);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), red);
    cap.position.y = 0.85;
    g.add(cap);
    g.position.set(x, 0, z);
    W.scene.add(g);
    return g;
  }

  function buildStreetFurniture() {
    // Palm rows along Ocean Drive and the beachfront, lamps and benches
    // scattered along the sidewalks, hydrants near intersections.
    for (var z = -132; z <= 132; z += 22) {
      makePalm(160, z + 6, U.rand(0.9, 1.25));
      if (Math.random() < 0.7) makePalm(138, z - 4, U.rand(0.85, 1.1));
    }
    for (var x = -132; x <= 132; x += 44) {
      for (var zz = -132; zz <= 132; zz += 44) {
        if (Math.random() < 0.6) makeLamp(x + 6.4, zz + 6.4);
        if (Math.random() < 0.4) makeBench(x + 6.4, zz - 6.4, Math.PI / 2);
        if (Math.random() < 0.35) makeHydrant(x - 6.4, zz + 6.4);
        if (Math.random() < 0.3) makePalm(x - 9, zz - 9, U.rand(0.8, 1.1));
      }
    }
    // Beach umbrellas: striped cones on poles.
    for (var i = 0; i < 8; i++) {
      var ux = 178 + Math.random() * 14, uz = -120 + i * 34 + Math.random() * 10;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), MAT.pole);
      pole.position.set(ux, 1.2, uz);
      W.scene.add(pole);
      var umb = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.0, 8), new THREE.MeshLambertMaterial({ color: U.pick([0xff5d8f, 0xffd23e, 0x2ec4b6, 0xff8c42]) }));
      umb.position.set(ux, 2.8, uz);
      umb.castShadow = true;
      W.scene.add(umb);
    }
  }

  // --- pier ------------------------------------------------------------------
  function buildPier() {
    var C = PH.CITY;
    var deck = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 10), MAT.wood);
    deck.position.set(C.pierX + 22, 1.4, C.pierZ);
    deck.castShadow = true; deck.receiveShadow = true;
    W.scene.add(deck);
    for (var x = C.pierX; x <= C.pierX + 44; x += 4) {
      for (var s = -1; s <= 1; s += 2) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.6, 6), MAT.trunk);
        post.position.set(x, 0.4, C.pierZ + s * 5.4);
        W.scene.add(post);
      }
      var rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.12), MAT.wood);
      rail.position.set(x + 2, 2.4, C.pierZ + 4.8);
      W.scene.add(rail);
      var rail2 = rail.clone(); rail2.position.z = C.pierZ - 4.8; W.scene.add(rail2);
    }
    // Bait shack at the pier end + a neon sign post.
    box(5, 3.2, 4, new THREE.MeshLambertMaterial({ color: 0x2ec4b6 }), C.pierX + 40, 3.2, C.pierZ - 1);
    box(5.4, 0.3, 4.4, new THREE.MeshLambertMaterial({ color: 0xd8542e }), C.pierX + 40, 5.0, C.pierZ - 1);
    var sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 3.4), new THREE.MeshBasicMaterial({ color: 0xff5d8f }));
    sign.position.set(C.pierX + 40, 6.2, C.pierZ - 1);
    W.scene.add(sign);
    // String lights along the pier.
    for (var lx = C.pierX + 2; lx <= C.pierX + 42; lx += 6) {
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), MAT.lampGlow);
      bulb.position.set(lx, 3.4, C.pierZ + 4.8);
      W.scene.add(bulb);
    }
  }

  // --- Mateo (procedural figure) ---------------------------------------------
  // Parts are named so sim.js can animate them: armL/armR (upper), foreL/
  // foreR (lower arm + hand), legL/legR, head, torso, pistol (hidden unless
  // aiming or firing). Burnt-orange bomber jacket, white tee, dark jeans,
  // white sneakers, black hair.
  function makeMateo() {
    var g = new THREE.Group();
    var parts = {};
    // Legs (jeans), separate so they can swing.
    function leg(side) {
      var hip = new THREE.Group();
      hip.position.set(side * 0.22, 0.95, 0);
      var thigh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.3), MAT.jeans);
      thigh.position.y = -0.25; thigh.castShadow = true;
      hip.add(thigh);
      var shin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.28), MAT.jeans);
      shin.position.y = -0.72; shin.castShadow = true;
      hip.add(shin);
      var shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.5), MAT.shoe);
      shoe.position.set(0, -0.98, 0.08); shoe.castShadow = true;
      hip.add(shoe);
      g.add(hip);
      return hip;
    }
    parts.legL = leg(-1); parts.legR = leg(1);
    // Torso: white tee under an open orange bomber jacket.
    var torso = new THREE.Group();
    torso.position.y = 0.95;
    var chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.36), MAT.shirt);
    chest.position.y = 0.31; chest.castShadow = true;
    torso.add(chest);
    var jacketL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.4), MAT.jacket);
    jacketL.position.set(-0.38, 0.31, 0); jacketL.castShadow = true;
    torso.add(jacketL);
    var jacketR = jacketL.clone(); jacketR.position.x = 0.38; torso.add(jacketR);
    var jacketB = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.6, 0.08), MAT.jacket);
    jacketB.position.set(0, 0.31, -0.2); jacketB.castShadow = true;
    torso.add(jacketB);
    var zipper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.02), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    zipper.position.set(0, 0.31, 0.19);
    torso.add(zipper);
    g.add(torso);
    parts.torso = torso;
    // Arms: orange upper arm, orange forearm, skin hand.
    function arm(side) {
      var shoulder = new THREE.Group();
      shoulder.position.set(side * 0.42, 1.52, 0);
      var upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), MAT.jacket);
      upper.position.y = -0.21; upper.castShadow = true;
      shoulder.add(upper);
      var elbow = new THREE.Group();
      elbow.position.y = -0.44;
      var fore = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.2), MAT.jacket);
      fore.position.y = -0.2; fore.castShadow = true;
      elbow.add(fore);
      var hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), MAT.skin);
      hand.position.y = -0.46; hand.castShadow = true;
      elbow.add(hand);
      shoulder.add(elbow);
      g.add(shoulder);
      return { shoulder: shoulder, elbow: elbow };
    }
    var aL = arm(-1), aR = arm(1);
    parts.armL = aL.shoulder; parts.foreL = aL.elbow;
    parts.armR = aR.shoulder; parts.foreR = aR.elbow;
    // Head: skin sphere, black hair cap + fringe, simple face hint.
    var head = new THREE.Group();
    head.position.y = 1.78;
    var skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), MAT.skin);
    skull.castShadow = true;
    head.add(skull);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), MAT.hair);
    hair.position.y = 0.03;
    head.add(hair);
    var fringe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.12), MAT.hair);
    fringe.position.set(0, 0.16, 0.2);
    head.add(fringe);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), MAT.skin);
    nose.position.set(0, -0.02, 0.24);
    head.add(nose);
    g.add(head);
    parts.head = head;
    // Pistol: small dark box, hidden unless aiming/firing.
    var pistol = new THREE.Group();
    var pg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.3), MAT.gunmetal);
    pg.castShadow = true;
    pistol.add(pg);
    pistol.position.set(0.12, 1.18, 0.32);
    pistol.visible = false;
    g.add(pistol);
    parts.pistol = pistol;
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { group: g, parts: parts };
  }

  // --- cars (procedural) ------------------------------------------------------
  var CAR_COLORS = [0xe63946, 0x2a9d8f, 0xf4d35e, 0x4361ee, 0x9b5de5, 0x06d6a0, 0xff9f1c, 0xef476f, 0x118ab2, 0xadb5bd];
  function makeCar(opts) {
    opts = opts || {};
    var color = opts.color !== undefined ? opts.color : U.pick(CAR_COLORS);
    var police = !!opts.police;
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshPhongMaterial({ color: police ? 0xf2f2f2 : color, shininess: 90, specular: 0x888888 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
    body.position.y = 0.62; body.castShadow = true;
    g.add(body);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 0.7), bodyMat);
    nose.position.set(0, 0.5, 2.3); nose.castShadow = true;
    g.add(nose);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), MAT.glass);
    cabin.position.set(0, 1.18, -0.2); cabin.castShadow = true;
    g.add(cabin);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.0), bodyMat);
    roof.position.set(0, 1.48, -0.2);
    g.add(roof);
    // Headlights + taillights.
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (var s = -1; s <= 1; s += 2) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), hl);
      h.position.set(s * 0.62, 0.62, 2.66);
      g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
      t.position.set(s * 0.62, 0.62, -2.22);
      g.add(t);
    }
    // Wheels.
    var wheels = [];
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    var positions = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
    for (var i = 0; i < 4; i++) {
      var wg = new THREE.Group();
      var tire = new THREE.Mesh(wheelGeo, MAT.tire);
      tire.castShadow = true;
      wg.add(tire);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10), MAT.hub);
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);
      wg.position.set(positions[i][0], 0.36, positions[i][1]);
      g.add(wg);
      wheels.push(wg);
    }
    var lightBar = null;
    if (police) {
      var bar = new THREE.Group();
      var r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      r.position.x = -0.3;
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      b.position.x = 0.3;
      bar.add(r); bar.add(b);
      bar.position.set(0, 1.58, -0.2);
      g.add(bar);
      lightBar = { red: r, blue: b };
      var door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      door.position.set(-1.01, 0.7, 0.1); door.rotation.y = -Math.PI / 2;
      g.add(door);
      var door2 = door.clone(); door2.position.x = 1.01; door2.rotation.y = Math.PI / 2;
      g.add(door2);
    }
    return { group: g, wheels: wheels, lightBar: lightBar, color: color, police: police };
  }

  // --- police helicopter -------------------------------------------------------
  function makeHeli() {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshPhongMaterial({ color: 0xf2f2f2, shininess: 80 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.2), bodyMat);
    body.position.y = 0; body.castShadow = true;
    g.add(body);
    var nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), MAT.glass);
    nose.scale.set(1.0, 0.8, 1.1);
    nose.position.set(0, -0.1, 2.2);
    g.add(nose);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), bodyMat);
    tail.position.set(0, 0.3, -4.0);
    g.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.0), bodyMat);
    fin.position.set(0, 0.9, -6.0);
    g.add(fin);
    var rotor = new THREE.Group();
    rotor.position.y = 1.1;
    for (var i = 0; i < 2; i++) {
      var blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.5), MAT.gunmetal);
      blade.rotation.y = i * Math.PI / 2;
      rotor.add(blade);
    }
    g.add(rotor);
    var tailRotor = new THREE.Group();
    tailRotor.position.set(0.4, 0.9, -6.2);
    var tb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.3), MAT.gunmetal);
    tailRotor.add(tb);
    g.add(tailRotor);
    var spot = new THREE.SpotLight(0xffffff, 0, 120, 0.35, 0.5);
    spot.position.set(0, -0.8, 1);
    g.add(spot);
    var skids = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.4), MAT.pole);
    skids.position.set(-0.9, -1.1, 0); g.add(skids);
    var skids2 = skids.clone(); skids2.position.x = 0.9; g.add(skids2);
    return { group: g, rotor: rotor, tailRotor: tailRotor, spotlight: spot };
  }

  // --- mission beacon ----------------------------------------------------------
  function makeBeacon() {
    var g = new THREE.Group();
    var cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 26, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    cyl.position.y = 13;
    g.add(cyl);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15;
    g.add(ring);
    var light = new THREE.PointLight(0xffd23e, 1.2, 30);
    light.position.y = 3;
    g.add(light);
    W.scene.add(g);
    return { group: g, light: light };
  }

  // --- init -------------------------------------------------------------------
  function initWorld(canvas) {
    buildMaterials();
    W.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    W.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    W.renderer.setSize(window.innerWidth, window.innerHeight);
    W.renderer.shadowMap.enabled = true;
    W.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    W.scene = new THREE.Scene();
    W.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    W.camera.position.set(-20, 8, 110);
    buildSky();
    buildGroundAndSea();
    buildRoads();
    buildCity();
    buildStreetFurniture();
    buildPier();
    W.beacon = makeBeacon();
    window.addEventListener('resize', function () {
      W.camera.aspect = window.innerWidth / window.innerHeight;
      W.camera.updateProjectionMatrix();
      W.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    return W;
  }

  PH.world = W;
  PH.builders = {
    makeMateo: makeMateo, makeCar: makeCar, makeHeli: makeHeli,
    makePalm: makePalm, makeLamp: makeLamp, makeBench: makeBench,
    makeHydrant: makeHydrant, makeBeacon: makeBeacon, CAR_COLORS: CAR_COLORS,
  };
  PH.worldInit = initWorld;
})();
