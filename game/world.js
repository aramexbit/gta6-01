// PIER HEAT — Sunset Bay v8.0: the world. Connected road grid, buildings, pier, harbor,
// beach, Sunset Bay Bridge causeway, palms and props. Every solid registers its footprint
// in the collider registry at build time (see core.js) — collision never traverses the scene.
(function () {
  'use strict';
  var PH = window.PH;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  PH.world = {
    roadRects: [],
    tallBuildings: [],
    signs: [],
    spawns: {
      heroCar: { x: -18, z: 0, heading: Math.PI / 2 },   // on Sunset Blvd, facing east (+X)
      kira: { x: 0, z: 152 },                            // mid-pier, on the deck
      boat: { x: 8, z: 152 },                            // moored beside the pier, within boarding reach
      boatTarget: { x: -155, z: 198 },                   // far end of the bridge causeway
      playerStart: { x: -14, z: 3, heading: Math.PI / 2 }
    },

    groundHeight: function (x, z) {
      if (x > -5.4 && x < 5.4 && z > 104 && z < 166) return 1.2;      // pier deck
      if (x > -160.5 && x < -149.5 && z > 104 && z < 211) return 0.3; // bridge causeway deck
      return 0;
    },

    build: function () {
      var scene = PH.scene;
      var rnd = mulberry32(8821);
      var i, j;

      // ----- ground base (dry warm ground under the whole city; sea plane sits above it) -----
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520),
        new THREE.MeshStandardMaterial({ color: 0x7d6f55, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, -0.12, 40);
      ground.receiveShadow = true;
      scene.add(ground);

      // ----- road texture helper: asphalt + lane paint, repeated along the segment -----
      function roadTexture(width, dashes, yellow) {
        return PH.makeCanvas(128, 128, function (g, w, h) {
          g.fillStyle = '#26262d'; g.fillRect(0, 0, w, h); // darker asphalt: sun-bleached no more
          g.fillStyle = 'rgba(255,255,255,0.06)';
          for (i = 0; i < 60; i++) g.fillRect(rnd() * w, rnd() * h, 3, 3);
          g.fillStyle = 'rgba(255,255,255,0.10)';
          for (i = 0; i < 24; i++) g.fillRect(rnd() * w, rnd() * h, 5, 2);
          g.fillStyle = '#d8d8d8';
          g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
          if (yellow) {
            g.fillStyle = '#d8a832';
            g.fillRect(w / 2 - 6, 0, 4, h); g.fillRect(w / 2 + 2, 0, 4, h);
          } else if (dashes) {
            g.fillStyle = '#e8e8e8';
            g.fillRect(w / 2 - 2, 8, 4, 40);
          }
        });
      }
      function addRoad(x0, z0, x1, z1, yellow) {
        var w = x1 - x0, d = z1 - z0;
        var alongX = w >= d;
        var tex = roadTexture(Math.min(w, d), true, yellow);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(alongX ? Math.max(1, Math.round(w / 16)) : 1, alongX ? 1 : Math.max(1, Math.round(d / 16)));
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
        mesh.receiveShadow = true;
        scene.add(mesh);
        PH.world.roadRects.push({ x0: x0, z0: z0, x1: x1, z1: z1 });
        // sidewalks: pale strips just outside the asphalt
        var sw = PH.stdMat(0x9a938a, 0.95, 0);
        var s1, s2;
        if (alongX) {
          s1 = PH.box(w, 0.14, 2.6, 0x9a938a, 0.95, 0); s1.position.set((x0 + x1) / 2, 0.07, z0 - 1.3);
          s2 = PH.box(w, 0.14, 2.6, 0x9a938a, 0.95, 0); s2.position.set((x0 + x1) / 2, 0.07, z1 + 1.3);
        } else {
          s1 = PH.box(2.6, 0.14, d, 0x9a938a, 0.95, 0); s1.position.set(x0 - 1.3, 0.07, (z0 + z1) / 2);
          s2 = PH.box(2.6, 0.14, d, 0x9a938a, 0.95, 0); s2.position.set(x1 + 1.3, 0.07, (z0 + z1) / 2);
        }
        s1.receiveShadow = true; s2.receiveShadow = true;
        scene.add(s1); scene.add(s2);
        return mesh;
      }

      // ----- CONNECTED road grid: every street links to the next, no dead grey ground -----
      addRoad(-150, -7, 150, 7, true);                       // Sunset Boulevard (14 wide, main)
      var crossX = [-110, -60, -10, 40, 90, 140];
      for (i = 0; i < crossX.length; i++) addRoad(crossX[i] - 5, -90, crossX[i] + 5, 95, false);
      var resZ = [-70, -35, 35, 70];
      for (i = 0; i < resZ.length; i++) addRoad(-140, resZ[i] - 4.5, 145, resZ[i] + 4.5, false);
      addRoad(-140, 95.5, 145, 104.5, false);                // beachfront road
      addRoad(-160, 104, -150, 211, false);                  // bridge causeway approach + deck

      // ----- beach sand -----
      var sand = new THREE.Mesh(new THREE.PlaneGeometry(330, 22),
        new THREE.MeshStandardMaterial({ color: 0xd9b380, roughness: 1 }));
      sand.rotation.x = -Math.PI / 2;
      sand.position.set(0, 0.03, 115);
      sand.receiveShadow = true;
      scene.add(sand);
      // umbrellas
      var umbColors = [0xff6b4a, 0x2fb8a6, 0xffd94a, 0x4a7bff, 0xff4a8a];
      for (i = 0; i < 9; i++) {
        var ux = -120 + i * 30 + rnd() * 8, uz = 108 + rnd() * 12;
        var pole = new THREE.Mesh(PH.cylGeo(0.06, 0.06, 2.4, 6), PH.stdMat(0xeeeeee, 0.6, 0.2));
        pole.position.set(ux, 1.2, uz); scene.add(pole);
        var top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 8),
          PH.stdMat(umbColors[i % umbColors.length], 0.7, 0));
        top.position.set(ux, 2.6, uz); top.castShadow = true; scene.add(top);
      }

      // ----- pier: wooden deck on supports, railings, end platform -----
      var pierDeck = PH.box(10, 0.5, 62, 0x8a6a48, 0.9, 0);
      pierDeck.position.set(0, 0.95, 135);
      pierDeck.receiveShadow = true; pierDeck.castShadow = true;
      scene.add(pierDeck);
      for (i = 0; i < 7; i++) {
        var pz = 108 + i * 9;
        var supL = new THREE.Mesh(PH.cylGeo(0.5, 0.6, 2.6, 8), PH.stdMat(0x5a4632, 0.9, 0));
        supL.position.set(-4.2, 0, pz); scene.add(supL);
        var supR = supL.clone(); supR.position.x = 4.2; scene.add(supR);
        PH.addCollider(-4.2, pz, 0.7, 0.7); PH.addCollider(4.2, pz, 0.7, 0.7);
      }
      // railings (colliders keep the player on the deck)
      var railMat = PH.stdMat(0x6b4a2e, 0.8, 0.1);
      var r1 = PH.box(0.3, 1.1, 62, 0x6b4a2e, 0.8, 0.1); r1.position.set(-4.9, 1.75, 135); scene.add(r1);
      var r2 = r1.clone(); r2.position.x = 4.9; scene.add(r2);
      PH.addCollider(-4.9, 135, 0.3, 31); PH.addCollider(4.9, 135, 0.3, 31);
      var r3 = PH.box(10, 1.1, 0.3, 0x6b4a2e, 0.8, 0.1); r3.position.set(0, 1.75, 165.5); scene.add(r3);
      PH.addCollider(0, 165.5, 5, 0.3);
      // bollards across the pier mouth: cars cannot drive onto the wooden pier,
      // pedestrians walk between them (1.4-unit gaps, car is 3.4 wide)
      var bollardXs = [-4.8, -2.4, 0, 2.4, 4.8];
      for (i = 0; i < bollardXs.length; i++) {
        var bol = new THREE.Mesh(PH.cylGeo(0.28, 0.34, 1.1, 8),
          new THREE.MeshStandardMaterial({ color: 0xd8a832, roughness: 0.5, metalness: 0.4 }));
        bol.position.set(bollardXs[i], 0.55, 104);
        bol.castShadow = true; scene.add(bol);
        PH.addCarCollider(bollardXs[i], 104, 0.5);
      }
      // pier lamps + bait shack at the end
      for (i = 0; i < 4; i++) {
        var lamp = PH.box(0.18, 3.2, 0.18, 0x222222, 0.6, 0.4);
        lamp.position.set(-4.4, 2.8, 112 + i * 16); scene.add(lamp);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1.4 }));
        bulb.position.set(-4.4, 4.5, 112 + i * 16); scene.add(bulb);
      }
      var shack = PH.box(6, 3.4, 5, 0x7a5a3a, 0.9, 0);
      shack.position.set(0, 2.9, 161); shack.castShadow = true; scene.add(shack);
      PH.addCollider(0, 161, 3.2, 2.7);
      var shackSign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.1),
        new THREE.MeshBasicMaterial({ map: PH.labelTexture('BAIT & TACKLE', { bg: '#24344a', fg: '#ffd94a', size: 52 }) }));
      shackSign.position.set(0, 3.4, 158.4); shackSign.rotation.y = Math.PI; scene.add(shackSign);

      // ----- harbor: containers + crane (east side) -----
      var contColors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
      var contSpots = [[128, 112], [138, 112], [133, 118], [146, 118], [126, 120], [142, 108]];
      for (i = 0; i < contSpots.length; i++) {
        var cx = contSpots[i][0], cz = contSpots[i][1];
        var cont = PH.box(6, 2.6, 2.6, contColors[i % contColors.length], 0.7, 0.3);
        cont.position.set(cx, 1.3, cz);
        cont.rotation.y = (i % 2) * 0.12;
        cont.castShadow = true; scene.add(cont);
        PH.addCollider(cx, cz, 3.2, 1.6);
      }
      var craneLeg1 = PH.box(1.2, 22, 1.2, 0xd4ac0d, 0.6, 0.4); craneLeg1.position.set(150, 11, 108); scene.add(craneLeg1);
      var craneLeg2 = craneLeg1.clone(); craneLeg2.position.set(150, 11, 122); scene.add(craneLeg2);
      var craneBeam = PH.box(1.4, 1.4, 26, 0xd4ac0d, 0.6, 0.4); craneBeam.position.set(150, 22, 115); scene.add(craneBeam);
      var craneArm = PH.box(16, 1.1, 1.1, 0xd4ac0d, 0.6, 0.4); craneArm.position.set(142, 22.5, 115); scene.add(craneArm);
      PH.addCollider(150, 108, 1, 1); PH.addCollider(150, 122, 1, 1);

      // ----- Sunset Bay Bridge: low causeway deck over the sea (west edge) -----
      var deck = PH.box(10, 0.6, 107, 0x6a6f78, 0.9, 0);
      deck.position.set(-155, 0.05, 157.5); deck.receiveShadow = true; scene.add(deck);
      for (i = 0; i < 6; i++) {
        var bz = 112 + i * 18;
        var pil = new THREE.Mesh(PH.cylGeo(0.9, 1.1, 4, 8), PH.stdMat(0x555a63, 0.9, 0));
        pil.position.set(-158.5, -1, bz); scene.add(pil);
        var pil2 = pil.clone(); pil2.position.x = -151.5; scene.add(pil2);
        PH.addCollider(-158.5, bz, 1.1, 1.1); PH.addCollider(-151.5, bz, 1.1, 1.1);
      }
      var bridgeSign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6),
        new THREE.MeshBasicMaterial({ map: PH.labelTexture('SUNSET BAY BRIDGE', { bg: '#1d5f4a', fg: '#ffffff', size: 44 }) }));
      bridgeSign.position.set(-155, 4.2, 106); scene.add(bridgeSign);
      var bPost1 = PH.box(0.3, 4, 0.3, 0x333333, 0.6, 0.3); bPost1.position.set(-159.5, 2, 106); scene.add(bPost1);
      var bPost2 = bPost1.clone(); bPost2.position.x = -150.5; scene.add(bPost2);

      // ----- buildings: blocks between the streets, real windows + shop signs -----
      var xBands = [[-140, -115], [-105, -65], [-55, -15], [-5, 35], [45, 85], [95, 135]];
      var zBands = [[-90, -74.5], [-65.5, -39.5], [-30.5, -7], [7, 30.5], [39.5, 65.5], [74.5, 95]];
      var wallPals = ['#c98a5a', '#b0703f', '#8a9a8a', '#a8876a', '#7a8aa0', '#c2a06a', '#9a6a7a', '#6a7a8a'];
      var shopNames = ['SUNSET TACOS', 'BAY BURGER', 'MANGO MART', 'WAVE RECORDS', 'PIER DONUTS',
        'PALM MOTEL', 'GOLDEN HOUR GYM', 'TIDE & TACKLE', 'REEF CAFE', 'SUNSET LIQUOR', 'NEON PALMS HOTEL'];
      var shopIdx = 0;
      var winTexes = [
        PH.windowTexture('#c98a5a', '#ffd27a', 6, 5),
        PH.windowTexture('#8a9a8a', '#ffe9a8', 8, 6),
        PH.windowTexture('#7a8aa0', '#ffb36b', 10, 6),
        PH.windowTexture('#a8876a', '#fff0c0', 5, 4)
      ];
      for (i = 0; i < xBands.length; i++) for (j = 0; j < zBands.length; j++) {
        var bx0 = xBands[i][0] + 3, bx1 = xBands[i][1] - 3;
        var bz0 = zBands[j][0] + 3, bz1 = zBands[j][1] - 3;
        if (rnd() < 0.14) continue; // empty lot / parking
        var bw = bx1 - bx0, bd = bz1 - bz0;
        var tall = rnd() < 0.22;
        var bh = tall ? PH.rand(22, 34) : PH.rand(7, 16);
        var nB = (bw > 26 && bd > 18 && rnd() < 0.5) ? 2 : 1;
        for (var k = 0; k < nB; k++) {
          var w2 = nB === 2 ? bw / 2 - 2 : bw;
          var d2 = nB === 2 ? bd : bd;
          var cx2 = nB === 2 ? bx0 + w2 / 2 + k * (w2 + 4) : (bx0 + bx1) / 2;
          var cz2 = (bz0 + bz1) / 2;
          var tex = winTexes[Math.floor(rnd() * winTexes.length)];
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          var bmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
          var b = new THREE.Mesh(new THREE.BoxGeometry(w2, bh, d2), bmat);
          b.position.set(cx2, bh / 2, cz2);
          b.castShadow = true; b.receiveShadow = true;
          scene.add(b);
          PH.addCollider(cx2, cz2, w2 / 2, d2 / 2);
          if (tall) PH.world.tallBuildings.push(b);
          // dark base at the foot of tall buildings
          if (bh > 20) {
            var base = PH.box(w2 + 0.4, 1.2, d2 + 0.4, 0x2a2320, 0.95, 0);
            base.position.set(cx2, 0.6, cz2); scene.add(base);
          }
          // shop sign on boulevard-facing buildings
          if (Math.abs(cz2) < 32 && rnd() < 0.6) {
            var name = shopNames[shopIdx++ % shopNames.length];
            var sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(11, w2 * 0.8), 1.5),
              new THREE.MeshBasicMaterial({ map: PH.labelTexture(name, { bg: '#1d1a24', fg: '#ffb347', border: '#ffb347', size: 46 }) }));
            sign.position.set(cx2, 4.6, cz2 + (cz2 > 0 ? d2 / 2 + 0.15 : -d2 / 2 - 0.15));
            if (cz2 < 0) sign.rotation.y = Math.PI;
            scene.add(sign);
            PH.world.signs.push(sign);
          }
          // rooftop box on some buildings
          if (rnd() < 0.4) {
            var roof = PH.box(w2 * 0.3, 1.6, d2 * 0.3, 0x5a5148, 0.9, 0);
            roof.position.set(cx2 + rnd() * 4 - 2, bh + 0.8, cz2 + rnd() * 4 - 2);
            scene.add(roof);
          }
        }
      }

      // ----- palms along the boulevard + beachfront -----
      function palm(x, z) {
        var trunk = new THREE.Mesh(PH.cylGeo(0.22, 0.34, 6.5, 7), PH.stdMat(0x7a5a3a, 0.95, 0));
        trunk.position.set(x, 3.25, z); trunk.castShadow = true; scene.add(trunk);
        var frondMat = PH.stdMat(0x3f8a4a, 0.85, 0);
        for (var f = 0; f < 5; f++) {
          var fr = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), frondMat);
          var a = (f / 5) * Math.PI * 2;
          fr.position.set(x + Math.cos(a) * 1.1, 6.9, z + Math.sin(a) * 1.1);
          fr.rotation.z = Math.cos(a) * 1.1; fr.rotation.x = -Math.sin(a) * 1.1;
          scene.add(fr);
        }
        PH.addCollider(x, z, 0.45, 0.45);
      }
      for (i = 0; i < 12; i++) {
        palm(-135 + i * 24, -10.2);
        palm(-123 + i * 24, 10.2);
      }
      for (i = 0; i < 6; i++) palm(-120 + i * 48, 107.5);

      // ----- street lamps + traffic lights on the boulevard -----
      function lampPost(x, z) {
        var p = PH.box(0.16, 5.4, 0.16, 0x222222, 0.6, 0.4);
        p.position.set(x, 2.7, z); scene.add(p);
        var head = PH.box(0.9, 0.18, 0.3, 0x222222, 0.6, 0.4);
        head.position.set(x, 5.4, z + (z > 0 ? -0.4 : 0.4)); scene.add(head);
        var glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1.2 }));
        glow.position.set(x, 5.3, z + (z > 0 ? -0.8 : 0.8)); scene.add(glow);
      }
      for (i = 0; i < 10; i++) { lampPost(-130 + i * 28, -9.4); lampPost(-116 + i * 28, 9.4); }
      function trafficLight(x, z) {
        var pole = PH.box(0.22, 6, 0.22, 0x1a1a1a, 0.6, 0.4);
        pole.position.set(x, 3, z); scene.add(pole);
        var box = PH.box(0.5, 1.5, 0.5, 0x111111, 0.6, 0.2);
        box.position.set(x, 6.2, z); scene.add(box);
        var colors = [0xff3b30, 0xffcc00, 0x34c759];
        for (var l = 0; l < 3; l++) {
          var dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
            new THREE.MeshStandardMaterial({ color: colors[l], emissive: colors[l], emissiveIntensity: l === 2 ? 1.6 : 0.25 }));
          dot.position.set(x, 6.7 - l * 0.5, z + 0.28); scene.add(dot);
        }
        PH.addCollider(x, z, 0.4, 0.4);
      }
      trafficLight(-112, -8.5); trafficLight(-62, 8.5); trafficLight(-12, -8.5);
      trafficLight(38, 8.5); trafficLight(88, -8.5); trafficLight(138, 8.5);

      // ----- benches + hydrants -----
      for (i = 0; i < 8; i++) {
        var bx = -120 + i * 34, bz = (i % 2 === 0) ? -9.8 : 9.8;
        var bench = PH.box(2.2, 0.5, 0.7, 0x6b4a2e, 0.9, 0);
        bench.position.set(bx, 0.5, bz); scene.add(bench);
        PH.addCollider(bx, bz, 1.2, 0.5);
      }

      // ----- waterfront edge barrier: no falling into the sea from the beach road -----
      // Two segments with a gap at the pier mouth (x -6..6) so the pier stays walkable.
      var edgeL = PH.box(140, 1.0, 0.5, 0x8a8578, 0.9, 0);
      edgeL.position.set(-76, 0.5, 105.2); scene.add(edgeL);
      var edgeR = PH.box(140, 1.0, 0.5, 0x8a8578, 0.9, 0);
      edgeR.position.set(76, 0.5, 105.2); scene.add(edgeR);
      PH.addCollider(-76, 105.2, 70, 0.4); PH.addCollider(76, 105.2, 70, 0.4);

      PH.minimap.buildBase();
    }
  };
})();
