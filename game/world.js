// PIER HEAT — Sunset Bay (v6.5)
// world.js — the city itself: road grid, pastel buildings with readable
// shop signs, street props, beach, pier and the Little Havana night market.
// Plus the detailed vehicles: every car carries doors, windows, mirrors,
// lights, plates and wheels — no more plain boxes.
(function () {
  var PH = window.PH = window.PH || {};
  var core = PH.core;
  var world = PH.world = {};

  // ------------------------------------------------------------- layout
  // Avenues run north-south (x = -60..60), streets east-west (z = -60..60).
  // Ocean Drive is z = 0, running east to the beach and the pier.
  var AVENUES = [-60, -30, 0, 30, 60];
  var STREETS = [-60, -30, 0, 30, 60];
  var ROAD_W = 10;
  var BEACH_X = 100;   // sand starts here
  var OCEAN_X = 138;   // waterline

  // 60 original shop names, assigned in order to facades and stalls.
  var SHOP_NAMES = [
    'ARCADE', 'PINBALL OPEN', 'TACOS', 'RECORDS', 'DANCE HALL',
    'HOTEL OCEAN', 'PAWN JEWELRY', 'NEWS SMOKE DRINKS', 'CINEMA',
    'SURF SHOP', 'BURGERS', 'CAFE', 'MARKET', 'BAKERY', 'TATTOO',
    'BARBER', 'LAUNDRY', 'PIER GRILL', 'SUNSET MOTEL', 'DONUTS',
    'ICE CREAM', 'SALSA CLUB', 'NEON BOWL', 'FISH TACOS', 'MARINA',
    'PIER 9', 'NEON PALMS', 'VELVET ROOM', 'CORAL BAR', 'SUNSET DIVE',
    'BAY BOOKS', 'OCEAN VIEW', 'PALM COURT', 'TIKI HUT', 'WAVE RIDER',
    'BOARDWALK', 'SALT AIR', 'COCO LOCO', 'MANGO BAY', 'RUM RUNNER',
    'SEASIDE', 'DOLPHIN INN', 'STARFISH', 'SAND DOLLAR', 'CORAL REEF',
    'PELICAN', 'SEAGULL CAFE', 'ANCHOR BAR', 'HARBOR LIGHT', 'TIDE POOL',
    'SUNSET GRILL', 'BAY BURGER', 'NEON TACOS', 'VINYL', 'DISCO',
    'KARAOKE', 'BILLIARDS', 'POOL HALL', '24 HR DINER', 'SUNRISE CAFE'
  ];
  var KIOSK_NAMES = ['JUICE', 'FLOWERS', 'SNACKS', 'SOUVENIR', 'GRILL', 'COCONUTS'];
  var PASTELS = ['#f2a0a8', '#f7c873', '#8fd0c9', '#f9e08a', '#c9a8e8',
    '#ffb08a', '#a8d8a0', '#f2c1d1', '#9fc3e8', '#e8b4d0'];
  var NEON = ['#ff2e88', '#00e5ff', '#ffe14d', '#7CFC00', '#ff7a1a', '#c26bff'];

  var counts = {
    signs: 0, buildings: 0, lamps: 0, palms: 0, props: 0,
    peds: 0, traffic: 0, parked: 0, police: 0, stalls: 0,
    detailedCars: 0, umbrellas: 0, hydrants: 0, bins: 0
  };

  function addSign(parent, tex, w, h, x, y, z, ry) {
    var m = core.mesh(core.planeGeo(w, h),
      new THREE.MeshBasicMaterial({ map: tex }), x, y, z);
    m.rotation.y = ry || 0;
    parent.add(m);
    counts.signs++;
    return m;
  }

  // ------------------------------------------------------- road textures
  function roadTexture() {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    var g = cv.getContext('2d');
    g.fillStyle = '#211d2a'; g.fillRect(0, 0, 256, 256); // dark asphalt
    // speckle
    for (var i = 0; i < 500; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // edge lines
    g.fillStyle = '#e8e4d0';
    g.fillRect(6, 0, 4, 256); g.fillRect(246, 0, 4, 256);
    // dashed yellow centre line
    g.fillStyle = '#f7c948';
    for (var y = 0; y < 256; y += 32) g.fillRect(124, y, 8, 18);
    // manhole + drain
    g.fillStyle = '#191622';
    g.beginPath(); g.arc(64, 190, 16, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a3345'; g.lineWidth = 3;
    g.beginPath(); g.arc(64, 190, 16, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#14111c'; g.fillRect(200, 40, 22, 10);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  var zebraTex = null;
  function zebraTexture() {
    if (zebraTex) return zebraTex;
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    g.fillStyle = '#211d2a'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f2efe2';
    for (var i = 0; i < 6; i++) g.fillRect(8 + i * 20, 10, 10, 108);
    zebraTex = new THREE.CanvasTexture(cv);
    zebraTex.colorSpace = THREE.SRGBColorSpace;
    return zebraTex;
  }

  // ---------------------------------------------------------------- roads
  function buildRoads(scene) {
    var tex = roadTexture();
    var i, r;
    // east-west streets
    for (i = 0; i < STREETS.length; i++) {
      var z = STREETS[i];
      var len = (z === 0) ? 190 : 150; // Ocean Drive runs to the beach
      var cx = (z === 0) ? 20 : 0;
      var t = tex.clone(); t.needsUpdate = true;
      t.repeat.set(len / 24, 1);
      var road = core.mesh(core.planeGeo(len, ROAD_W),
        new THREE.MeshLambertMaterial({ map: t }), cx, 0.02, z);
      road.rotation.x = -Math.PI / 2;
      scene.add(road);
      // sidewalks
      var sw = core.mesh(core.planeGeo(len, 3),
        core.mat(0x6b6570), cx, 0.09, z - ROAD_W / 2 - 1.5);
      sw.rotation.x = -Math.PI / 2; scene.add(sw);
      var sw2 = core.mesh(core.planeGeo(len, 3),
        core.mat(0x6b6570), cx, 0.09, z + ROAD_W / 2 + 1.5);
      sw2.rotation.x = -Math.PI / 2; scene.add(sw2);
    }
    // north-south avenues
    for (i = 0; i < AVENUES.length; i++) {
      var x = AVENUES[i];
      var t2 = tex.clone(); t2.needsUpdate = true;
      t2.repeat.set(150 / 24, 1);
      var road2 = core.mesh(core.planeGeo(ROAD_W, 150),
        new THREE.MeshLambertMaterial({ map: t2 }), x, 0.02, 0);
      road2.rotation.x = -Math.PI / 2;
      road2.rotation.z = Math.PI / 2;
      scene.add(road2);
      var swa = core.mesh(core.planeGeo(3, 150), core.mat(0x6b6570),
        x - ROAD_W / 2 - 1.5, 0.09, 0);
      swa.rotation.x = -Math.PI / 2; scene.add(swa);
      var swb = core.mesh(core.planeGeo(3, 150), core.mat(0x6b6570),
        x + ROAD_W / 2 + 1.5, 0.09, 0);
      swb.rotation.x = -Math.PI / 2; scene.add(swb);
    }
    // zebra crossings at the central intersections
    var zt = zebraTexture();
    for (i = 0; i < AVENUES.length; i++) {
      for (var j = 0; j < STREETS.length; j++) {
        var zx = AVENUES[i], zz = STREETS[j];
        var zb = core.mesh(core.planeGeo(9, 6),
          new THREE.MeshLambertMaterial({ map: zt }), zx, 0.04, zz - ROAD_W / 2 - 0.4);
        zb.rotation.x = -Math.PI / 2;
        scene.add(zb);
        var zb2 = core.mesh(core.planeGeo(9, 6),
          new THREE.MeshLambertMaterial({ map: zt }), zx, 0.04, zz + ROAD_W / 2 + 0.4);
        zb2.rotation.x = -Math.PI / 2;
        scene.add(zb2);
      }
    }
    // stop lines at Ocean Drive intersections
    for (i = 0; i < AVENUES.length; i++) {
      var sl = core.box(3.4, 0.02, 0.7, 0xf2efe2, AVENUES[i] - 2.5, 0.05, -ROAD_W / 2 - 1.2);
      scene.add(sl);
      var sl2 = core.box(3.4, 0.02, 0.7, 0xf2efe2, AVENUES[i] + 2.5, 0.05, ROAD_W / 2 + 1.2);
      scene.add(sl2);
    }
  }

  // -------------------------------------------------------------- buildings
  function buildBuildings(scene, rng) {
    var nameIdx = 0;
    var blockXs = [-45, -15, 15, 45, 75];
    var blockZs = [-45, -15, 15, 45];
    var bi, bj;
    for (bi = 0; bi < blockXs.length; bi++) {
      for (bj = 0; bj < blockZs.length; bj++) {
        var bx = blockXs[bi], bz = blockZs[bj];
        // the south-west blocks are the Little Havana market plaza
        if (bx === -45 && bz === 45) continue;
        // the (75,-15) block is a small park
        if (bx === 75 && bz === -15) continue;
        var tall = (bz === -15 && (bx === 15 || bx === 45)) || (bz === 15 && bx === 0);
        var h = tall ? 18 + rng() * 14 : 6 + rng() * 8;
        var w = 15 + rng() * 3, d = 14 + rng() * 3;
        var wall = core.pick(rng, PASTELS);
        var floors = Math.max(2, Math.round(h / 3.2));
        var facade = core.facadeTexture(wall, floors, 7, rng, 0.3);
        var bmat = new THREE.MeshLambertMaterial({ map: facade });
        var b = core.mesh(core.boxGeo(w, h, d), bmat, bx, h / 2, bz);
        scene.add(b);
        counts.buildings++;
        // flat roof + parapet + AC units + antenna + water tank
        var roof = core.box(w + 0.4, 0.5, d + 0.4, 0x2a2438, bx, h + 0.25, bz);
        scene.add(roof);
        var ac1 = core.box(1.6, 0.9, 1.2, 0x9aa4ae, bx - w / 4, h + 0.9, bz - d / 5);
        scene.add(ac1);
        var ac2 = core.box(1.2, 0.7, 1.0, 0x8a949e, bx + w / 4, h + 0.8, bz + d / 5);
        scene.add(ac2);
        var ant = core.box(0.12, 3.2, 0.12, 0x555560, bx + w / 3, h + 1.8, bz - d / 3);
        scene.add(ant);
        var antTip = core.mesh(core.sphGeo(0.22, 6, 5), core.mat(0xff2e4d, { emissive: true }),
          bx + w / 3, h + 3.5, bz - d / 3);
        scene.add(antTip);
        var tank = core.mesh(core.cylGeo(1.1, 1.1, 2.2, 10), core.mat(0x7a5a3a),
          bx - w / 3, h + 1.4, bz + d / 4);
        scene.add(tank);
        counts.props += 5;

        // ---- signage: fascia + vertical neon, rooftop sign on tall blocks
        var name = SHOP_NAMES[nameIdx % SHOP_NAMES.length]; nameIdx++;
        var neon = NEON[nameIdx % NEON.length];
        var facing = (bz <= 0) ? 0 : Math.PI; // face the nearest street
        var fz = bz + (facing === 0 ? d / 2 + 0.08 : -d / 2 - 0.08);
        // fascia sign above the shopfront
        var fasciaTex = core.textTexture(name, {
          bg: '#191024', fg: '#ffe9b0', glow: neon, size: 64,
          border: neon, borderW: 5, w: 512, h: 112
        });
        var fSign = addSign(scene, fasciaTex, Math.min(11, w - 1), 2.4,
          bx, 3.6, fz, facing === 0 ? 0 : Math.PI);
        fSign.rotation.y = facing === 0 ? 0 : Math.PI;
        // vertical neon blade sign on the corner
        var bladeTex = core.textTexture(name.split(' ')[0], {
          bg: '#120a1e', fg: neon, glow: neon, size: 58, w: 128, h: 384
        });
        var blade = addSign(scene, bladeTex, 1.5, 4.4,
          bx + w / 2 - 0.6, 6.4, fz, facing === 0 ? Math.PI / 2 : -Math.PI / 2);
        blade.rotation.y = facing === 0 ? Math.PI / 2 : -Math.PI / 2;
        if (tall) {
          var roofTex = core.textTexture(name, {
            bg: '#0e0a18', fg: '#fff3c9', glow: '#ff7a1a', size: 72,
            border: '#ff7a1a', borderW: 6, w: 512, h: 128
          });
          addSign(scene, roofTex, 12, 3, bx, h + 2.2, fz, facing === 0 ? 0 : Math.PI);
        }
        // striped awning over the shopfront + menu board on the sidewalk
        var awTex = core.awningTexture(nameIdx % 2 ? '#c22e4d' : '#0e7a6e', '#f4ead2');
        var awn = core.mesh(core.planeGeo(w - 2, 2.2),
          new THREE.MeshLambertMaterial({ map: awTex }),
          bx, 3.0, bz + (facing === 0 ? d / 2 + 1.1 : -d / 2 - 1.1));
        awn.rotation.x = -Math.PI / 2 + 0.5;
        awn.rotation.y = facing === 0 ? 0 : Math.PI;
        scene.add(awn);
        var menuTex = core.textTexture('MENU  $', {
          bg: '#2a1e12', fg: '#ffd98a', size: 44, sub: 'TACOS • DRINKS',
          w: 256, h: 128
        });
        var menu = core.mesh(core.planeGeo(1.1, 0.9),
          new THREE.MeshBasicMaterial({ map: menuTex }),
          bx + w / 2 - 1.2, 0.75, bz + (facing === 0 ? d / 2 + 2.2 : -d / 2 - 2.2));
        menu.rotation.y = facing === 0 ? 0.4 : Math.PI + 0.4;
        menu.rotation.x = -0.12;
        scene.add(menu);
        counts.props += 2;

        // second shop on the wide face: another fascia, so no facade is bare
        if (w >= 16) {
          var name2 = SHOP_NAMES[nameIdx % SHOP_NAMES.length]; nameIdx++;
          var neon2 = NEON[nameIdx % NEON.length];
          var tex2 = core.textTexture(name2, {
            bg: '#14101f', fg: '#ffe9b0', glow: neon2, size: 56,
            border: neon2, borderW: 4, w: 512, h: 112
          });
          var s2 = addSign(scene, tex2, 8, 1.9, bx, 6.8, fz, 0);
          s2.rotation.y = facing === 0 ? 0 : Math.PI;
        }
      }
    }
    // a couple of glass towers on Ocean Drive for the street shot.
    // Their facades carry the same window grid as the other buildings —
    // a flat blue slab reads as an empty wall from the street.
    var towerSpots = [[70, -8], [70, 8]];
    for (var t = 0; t < towerSpots.length; t++) {
      var tx = towerSpots[t][0], tz = towerSpots[t][1];
      var th = 26 + t * 6;
      var towerFacade = core.facadeTexture('#5a8fc9', 8, 6, rng, 0.5);
      var glass = new THREE.MeshLambertMaterial({ map: towerFacade });
      var tower = core.mesh(core.boxGeo(10, th, 10), glass, tx, th / 2, tz);
      scene.add(tower);
      counts.buildings++;
      // horizontal glass banding
      for (var fl = 2; fl < th; fl += 3) {
        var band = core.box(10.2, 0.35, 10.2, 0x2a3a55, tx, fl, tz);
        scene.add(band);
      }
      var tname = SHOP_NAMES[nameIdx % SHOP_NAMES.length]; nameIdx++;
      var ttex = core.textTexture(tname, {
        bg: '#0e0a18', fg: '#fff3c9', glow: '#00e5ff', size: 72,
        border: '#00e5ff', borderW: 6, w: 512, h: 128
      });
      addSign(scene, ttex, 11, 2.8, tx, th + 2.0, tz - 5.1, Math.PI);
      var ttex2 = core.textTexture(tname, {
        bg: '#0e0a18', fg: '#fff3c9', glow: '#ff2e88', size: 72,
        border: '#ff2e88', borderW: 6, w: 512, h: 128
      });
      addSign(scene, ttex2, 11, 2.8, tx, th + 2.0, tz + 5.1, 0);
    }
  }

  // ---------------------------------------------------------- street props
  function buildStreetProps(scene, rng) {
    var i, j;
    // street lamps along every road, alternating sides
    var lampSpots = [];
    for (i = 0; i < STREETS.length; i++) {
      for (var x = -70; x <= 95; x += 22) {
        lampSpots.push([x, STREETS[i] - 7.2, 0]);
        lampSpots.push([x + 11, STREETS[i] + 7.2, 1]);
      }
    }
    for (i = 0; i < AVENUES.length; i++) {
      for (var z = -70; z <= 70; z += 24) {
        lampSpots.push([AVENUES[i] - 7.2, z, 2]);
      }
    }
    for (i = 0; i < lampSpots.length; i++) {
      var lp = lampSpots[i];
      var g = new THREE.Group();
      var pole = core.mesh(core.cylGeo(0.09, 0.12, 5.2, 8), core.mat(0x2c2c38), 0, 2.6, 0);
      g.add(pole);
      var arm = core.box(1.6, 0.1, 0.1, 0x2c2c38, (lp[2] === 1 ? -0.8 : 0.8), 5.1, 0);
      if (lp[2] === 2) { arm.rotation.y = Math.PI / 2; arm.position.set(0, 5.1, 0.8); }
      g.add(arm);
      var headX = lp[2] === 1 ? -1.5 : (lp[2] === 2 ? 0 : 1.5);
      var headZ = lp[2] === 2 ? 1.5 : 0;
      var head = core.box(0.7, 0.16, 0.3, 0x3a3a48, headX, 5.05, headZ);
      g.add(head);
      var bulb = core.mesh(core.boxGeo(0.5, 0.06, 0.2), core.mat(0xffe9a8, { emissive: true }), headX, 4.96, headZ);
      g.add(bulb);
      var glow = core.glowSprite(0xffd98a, 1.4, 0.6);
      glow.position.set(headX, 4.9, headZ);
      g.add(glow);
      g.position.set(lp[0], 0, lp[1]);
      scene.add(g);
      counts.lamps++;
    }
    // traffic lights at the four central intersections
    var tlSpots = [[-30, -30], [-30, 30], [30, -30], [30, 30]];
    for (i = 0; i < tlSpots.length; i++) {
      var tx = tlSpots[i][0] + 6.4, tz = tlSpots[i][1] + 6.4;
      var tpole = core.mesh(core.cylGeo(0.1, 0.12, 4.6, 8), core.mat(0x2c2c38), tx, 2.3, tz);
      scene.add(tpole);
      var tbox = core.box(0.5, 1.3, 0.4, 0x1a1a22, tx, 4.4, tz);
      scene.add(tbox);
      var cols = [0xff2e2e, 0xffc21a, 0x2eff7a];
      for (j = 0; j < 3; j++) {
        var dot = core.mesh(core.sphGeo(0.14, 8, 6),
          core.mat(cols[j], { emissive: j === 0 }), tx, 4.85 - j * 0.4, tz + 0.22);
        scene.add(dot);
      }
      counts.props += 2;
    }
    // hydrants, bins, flower pots, benches along sidewalks
    for (i = 0; i < 14; i++) {
      var hx = -65 + i * 11, hz = (i % 2 ? -7.4 : 7.4);
      var hyd = new THREE.Group();
      hyd.add(core.mesh(core.cylGeo(0.22, 0.26, 0.7, 8), core.mat(0xd22e2e), 0, 0.35, 0));
      hyd.add(core.mesh(core.sphGeo(0.16, 8, 6), core.mat(0xd22e2e), 0, 0.75, 0));
      hyd.add(core.box(0.5, 0.12, 0.12, 0x8a1a1a, 0, 0.5, 0));
      hyd.position.set(hx, 0, hz);
      scene.add(hyd);
      counts.hydrants++; counts.props++;
    }
    for (i = 0; i < 22; i++) {
      var binx = -70 + i * 7.5, binz = (i % 3 === 0 ? -7.6 : 7.6);
      var bin = core.mesh(core.cylGeo(0.34, 0.3, 0.85, 10), core.mat(0x2e3a2e), binx, 0.43, binz);
      scene.add(bin);
      var lid = core.mesh(core.cylGeo(0.36, 0.36, 0.08, 10), core.mat(0x1e2a1e), binx, 0.88, binz);
      scene.add(lid);
      counts.bins++; counts.props += 2;
    }
    for (i = 0; i < 26; i++) {
      var px = -68 + i * 6.2, pz = (i % 2 ? 7.8 : -7.8);
      var pot = core.mesh(core.cylGeo(0.4, 0.3, 0.55, 10), core.mat(0xa85a3a), px, 0.28, pz);
      scene.add(pot);
      var bush = core.mesh(core.sphGeo(0.5, 8, 6), core.mat(0x3a8a4a, { toon: true }), px, 0.85, pz);
      bush.scale.y = 0.75;
      scene.add(bush);
      counts.props += 2;
    }
    // bus stops: shelter + bench + sign
    var busSpots = [[-44, -7.6], [16, 7.6], [44, -7.6]];
    for (i = 0; i < busSpots.length; i++) {
      var bsx = busSpots[i][0], bsz = busSpots[i][1];
      var shelter = new THREE.Group();
      shelter.add(core.box(3.4, 0.12, 1.4, 0x2a4a6a, 0, 2.4, 0));
      shelter.add(core.box(0.1, 2.4, 0.1, 0x2c2c38, -1.6, 1.2, 0));
      shelter.add(core.box(0.1, 2.4, 0.1, 0x2c2c38, 1.6, 1.2, 0));
      shelter.add(core.box(2.6, 0.1, 0.5, 0x8a5a2a, 0, 0.55, 0));
      shelter.add(core.box(0.08, 0.5, 0.08, 0x8a5a2a, -1.2, 0.3, 0));
      shelter.add(core.box(0.08, 0.5, 0.08, 0x8a5a2a, 1.2, 0.3, 0));
      var busTex = core.textTexture('BUS STOP', {
        bg: '#0e2a4a', fg: '#ffffff', size: 52, w: 256, h: 96
      });
      var bs = core.mesh(core.planeGeo(1.6, 0.6),
        new THREE.MeshBasicMaterial({ map: busTex }), 0, 2.0, 0.75);
      shelter.add(bs);
      shelter.position.set(bsx, 0, bsz);
      scene.add(shelter);
      counts.signs++; counts.props += 6;
    }
    // road signs: STOP octagons + ONE WAY + speed limit
    var signSpots = [
      [-36, -6.2, 'STOP', 0xd22e2e], [36, 6.2, 'STOP', 0xd22e2e],
      [-6, -6.2, 'ONE WAY', 0x2a6ad2], [24, 6.2, 'ONE WAY', 0x2a6ad2],
      [54, -6.2, '30', 0xf2f2f2], [-54, 6.2, '30', 0xf2f2f2]
    ];
    for (i = 0; i < signSpots.length; i++) {
      var ss = signSpots[i];
      var spost = core.mesh(core.cylGeo(0.06, 0.06, 2.6, 6), core.mat(0x888888), ss[0], 1.3, ss[1]);
      scene.add(spost);
      var stex = core.textTexture(ss[2], {
        bg: '#' + ss[3].toString(16).padStart(6, '0'), fg: '#ffffff', size: 52, w: 128, h: 128
      });
      var sp = core.mesh(core.planeGeo(0.9, 0.9),
        new THREE.MeshBasicMaterial({ map: stex }), ss[0], 2.6, ss[1]);
      sp.rotation.y = ss[0] > 0 ? Math.PI : 0;
      scene.add(sp);
      counts.props += 2; counts.signs++;
    }
    // power poles + sagging wires along Ocean Drive
    var wirePts = [];
    for (i = 0; i < 8; i++) {
      var wx = -70 + i * 22;
      var pp = core.mesh(core.cylGeo(0.14, 0.18, 7, 8), core.mat(0x5a3a22), wx, 3.5, -7.8);
      scene.add(pp);
      var cross = core.box(2.4, 0.12, 0.12, 0x5a3a22, wx, 6.6, -7.8);
      scene.add(cross);
      wirePts.push(new THREE.Vector3(wx, 6.6, -7.8));
      counts.props += 2;
    }
    var wireMat = new THREE.LineBasicMaterial({ color: 0x111111 });
    for (i = 0; i < wirePts.length - 1; i++) {
      var a = wirePts[i], b = wirePts[i + 1];
      var mid = a.clone().lerp(b, 0.5); mid.y -= 0.9;
      var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      var wgeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(12));
      scene.add(new THREE.Line(wgeo, wireMat));
    }
    // palms along Ocean Drive and the beach road
    for (i = 0; i < 26; i++) {
      var plx = -72 + i * 6.8, plz = (i % 2 ? 8.6 : -8.6);
      buildPalm(scene, plx, plz, 4.5 + rng() * 1.5, rng);
    }
    // small park on the (75,-15) block: grass, trees, benches, path
    var park = core.mesh(core.planeGeo(20, 20), core.mat(0x3a7a3a), 75, 0.07, -15);
    park.rotation.x = -Math.PI / 2;
    scene.add(park);
    for (i = 0; i < 6; i++) {
      var tx2 = 68 + (i % 3) * 7, tz2 = -21 + Math.floor(i / 3) * 11;
      var trunk = core.mesh(core.cylGeo(0.18, 0.25, 2.2, 8), core.mat(0x6a4a2a), tx2, 1.1, tz2);
      scene.add(trunk);
      var crown = core.mesh(core.sphGeo(1.8, 10, 8), core.mat(0x2e7a34, { toon: true }), tx2, 3.4, tz2);
      scene.add(crown);
      counts.props += 2;
    }
    for (i = 0; i < 3; i++) {
      var bx3 = 70 + i * 5;
      var bench = core.box(2.2, 0.1, 0.5, 0x8a5a2a, bx3, 0.5, -10);
      scene.add(bench);
      scene.add(core.box(0.08, 0.5, 0.08, 0x8a5a2a, bx3 - 1, 0.25, -10));
      scene.add(core.box(0.08, 0.5, 0.08, 0x8a5a2a, bx3 + 1, 0.25, -10));
      counts.props += 3;
    }
    // scattered sidewalk litter: newspapers + cans
    for (i = 0; i < 30; i++) {
      var lx = -70 + rng() * 160, lz = (rng() < 0.5 ? -7.5 : 7.5) + (rng() - 0.5) * 1.5;
      var paper = core.box(0.4, 0.02, 0.3, rng() < 0.5 ? 0xf2efe2 : 0xc9c9c9, lx, 0.12, lz);
      paper.rotation.y = rng() * Math.PI;
      scene.add(paper);
      counts.props++;
    }
    // parked scooters and bicycles near shopfronts
    for (i = 0; i < 6; i++) {
      var sx = -50 + i * 18, sz = 7.9;
      var scoot = buildScooter(rng);
      scoot.position.set(sx, 0, sz);
      scoot.rotation.y = (rng() - 0.5) * 0.6;
      scene.add(scoot);
      counts.props++;
    }
    for (i = 0; i < 4; i++) {
      var cx2 = -30 + i * 24, cz2 = -7.9;
      var bike = buildBicycle();
      bike.position.set(cx2, 0, cz2);
      bike.rotation.y = Math.PI / 2 + (rng() - 0.5) * 0.5;
      scene.add(bike);
      counts.props++;
    }
  }

  function buildPalm(scene, x, z, h, rng) {
    var g = new THREE.Group();
    var trunk = core.mesh(core.cylGeo(0.14, 0.24, h, 8), core.mat(0x7a5a38), 0, h / 2, 0);
    trunk.rotation.z = 0.08;
    g.add(trunk);
    for (var i = 0; i < 7; i++) {
      var frond = core.box(2.2, 0.06, 0.5, 0x2e8a4a, 0, 0, 0);
      var a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.0, h + 0.15 - Math.abs(Math.sin(a)) * 0.2, Math.sin(a) * 1.0);
      frond.rotation.y = -a;
      frond.rotation.z = 0.5;
      g.add(frond);
    }
    var nuts = core.mesh(core.sphGeo(0.22, 6, 5), core.mat(0x8a6a2a), 0.2, h - 0.1, 0.1);
    g.add(nuts);
    g.position.set(x, 0, z);
    scene.add(g);
    counts.palms++;
    return g;
  }

  function buildScooter(rng) {
    var g = new THREE.Group();
    var col = core.pick(rng, [0xd22e4d, 0x2a9ad2, 0xf7c948, 0x8a8a8a]);
    g.add(core.box(1.5, 0.35, 0.5, col, 0, 0.55, 0));
    g.add(core.box(0.4, 0.7, 0.4, col, 0.65, 0.7, 0));
    g.add(core.box(1.0, 0.12, 0.35, 0x222222, -0.1, 0.72, 0));
    var wg = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10);
    wg.rotateX(Math.PI / 2);
    g.add(core.mesh(wg, core.mat(0x14141a), -0.62, 0.28, 0));
    g.add(core.mesh(wg, core.mat(0x14141a), 0.62, 0.28, 0));
    return g;
  }

  function buildBicycle() {
    var g = new THREE.Group();
    var wg = new THREE.TorusGeometry(0.34, 0.035, 6, 14);
    var w1 = core.mesh(wg, core.mat(0x1a1a1a), -0.55, 0.34, 0);
    var w2 = core.mesh(wg, core.mat(0x1a1a1a), 0.55, 0.34, 0);
    g.add(w1); g.add(w2);
    g.add(core.box(1.1, 0.05, 0.05, 0xc22e4d, 0, 0.55, 0));
    g.add(core.box(0.05, 0.5, 0.05, 0xc22e4d, -0.3, 0.45, 0));
    g.add(core.box(0.3, 0.05, 0.05, 0x222222, 0.35, 0.75, 0));
    return g;
  }

  // ------------------------------------------------------------ beach & pier
  function buildBeach(scene, rng) {
    // sand
    var sand = core.mesh(core.planeGeo(42, 180), core.mat(0xe8c98a), 119, 0.05, 0);
    sand.rotation.x = -Math.PI / 2;
    scene.add(sand);
    // boardwalk strip along the sand edge
    var walk = core.mesh(core.planeGeo(4, 180), core.mat(0x8a6a4a), 99, 0.06, 0);
    walk.rotation.x = -Math.PI / 2;
    scene.add(walk);
    // umbrellas + beach chairs + towels
    var umCols = [0xff5a5a, 0xffd23e, 0x2ad2c2, 0xff7a1a, 0xc26bff, 0x5a8de8];
    for (var i = 0; i < 8; i++) {
      var ux = 108 + rng() * 22, uz = -70 + i * 19 + rng() * 6;
      var um = new THREE.Group();
      um.add(core.mesh(core.cylGeo(0.05, 0.05, 2.4, 6), core.mat(0xdddddd), 0, 1.2, 0));
      var canopy = core.mesh(new THREE.ConeGeometry(1.9, 0.7, 10),
        core.mat(umCols[i % umCols.length], { toon: true }), 0, 2.6, 0);
      um.add(canopy);
      um.position.set(ux, 0, uz);
      scene.add(um);
      counts.umbrellas++;
      var chair = core.box(0.6, 0.08, 1.4, umCols[(i + 2) % umCols.length], ux + 2.2, 0.3, uz + 1);
      chair.rotation.y = rng();
      scene.add(chair);
      scene.add(core.box(0.5, 0.05, 0.5, 0x8a5a2a, ux + 2.2, 0.12, uz + 1));
      var towel = core.box(0.9, 0.03, 1.8, umCols[(i + 4) % umCols.length], ux - 1.5, 0.09, uz - 1.5);
      towel.rotation.y = rng();
      scene.add(towel);
      counts.props += 3;
    }
    // beach foreground cluster for the title shot: umbrellas, chairs and
    // people close to the boardwalk's south end, so the title frame's
    // lower edge is a beach, not empty sand
    var fgSpots = [[106, 16], [112, 26], [106, 36], [100, 30]];
    for (var fi = 0; fi < fgSpots.length; fi++) {
      var fx = fgSpots[fi][0], fz = fgSpots[fi][1];
      var fum = new THREE.Group();
      fum.add(core.mesh(core.cylGeo(0.05, 0.05, 2.4, 6), core.mat(0xdddddd), 0, 1.2, 0));
      fum.add(core.mesh(new THREE.ConeGeometry(1.9, 0.7, 10),
        core.mat(umCols[(fi + 1) % umCols.length], { toon: true }), 0, 2.6, 0));
      fum.position.set(fx, 0, fz);
      scene.add(fum);
      counts.umbrellas++;
      var fchair = core.box(0.6, 0.08, 1.4, umCols[(fi + 3) % umCols.length], fx + 2.2, 0.3, fz + 1);
      scene.add(fchair);
      var ftowel = core.box(0.9, 0.03, 1.8, umCols[(fi + 5) % umCols.length], fx - 1.6, 0.09, fz - 1.4);
      scene.add(ftowel);
      var fped = world.buildPed(rng, true);
      fped.position.set(fx + 1, 0, fz - 2.5);
      fped.rotation.y = rng() * Math.PI * 2;
      scene.add(fped);
      counts.peds++;
      counts.props += 3;
    }
    // lifeguard tower
    var tower = new THREE.Group();
    for (var l = 0; l < 4; l++) {
      var lx = (l % 2 ? 0.9 : -0.9), lz = (l < 2 ? 0.9 : -0.9);
      var leg = core.box(0.14, 3.4, 0.14, 0xf2f2f2, lx, 1.7, lz);
      leg.rotation.z = lx > 0 ? -0.12 : 0.12;
      leg.rotation.x = lz > 0 ? 0.12 : -0.12;
      tower.add(leg);
    }
    tower.add(core.box(2.4, 0.25, 2.4, 0xf2f2f2, 0, 3.5, 0));
    tower.add(core.box(2.6, 0.14, 2.6, 0xff5a3a, 0, 4.4, 0));
    tower.add(core.box(2.4, 0.7, 0.12, 0xf2f2f2, 0, 3.9, 1.2));
    var ltTex = core.textTexture('BAY WATCH', { bg: '#ff5a3a', fg: '#ffffff', size: 44, w: 256, h: 80 });
    tower.add(core.mesh(core.planeGeo(1.8, 0.6),
      new THREE.MeshBasicMaterial({ map: ltTex }), 0, 3.95, 1.28));
    tower.add(core.box(0.9, 0.1, 2.6, 0x8a5a2a, 0, 1.6, 1.6));
    tower.position.set(116, 0, -34);
    scene.add(tower);
    counts.signs++; counts.props += 8;
    // pier: wooden deck out into the ocean, PIER 9 sign, lamps, posts
    var pier = new THREE.Group();
    pier.add(core.box(34, 0.3, 5, 0x8a6a4a, 0, 0.9, 0));
    for (var p = 0; p < 9; p++) {
      pier.add(core.box(0.3, 1.6, 0.3, 0x5a3a22, -16 + p * 4, 0.1, 2.2));
      pier.add(core.box(0.3, 1.6, 0.3, 0x5a3a22, -16 + p * 4, 0.1, -2.2));
      pier.add(core.box(0.08, 1.0, 4.8, 0x6a4a2a, -16 + p * 4, 1.5, 0));
    }
    var pierTex = core.textTexture('PIER 9', {
      bg: '#0e2a4a', fg: '#ffe9b0', glow: '#00e5ff', size: 72,
      border: '#00e5ff', borderW: 5, w: 512, h: 128
    });
    var pierSign = core.mesh(core.planeGeo(6, 1.5),
      new THREE.MeshBasicMaterial({ map: pierTex }), 12, 3.2, 0);
    pier.add(pierSign);
    pier.add(core.box(0.2, 3.4, 0.2, 0x3a3a48, 9.4, 1.7, 0));
    pier.add(core.box(0.2, 3.4, 0.2, 0x3a3a48, 14.6, 1.7, 0));
    for (var pl = 0; pl < 4; pl++) {
      var plx = -12 + pl * 9;
      pier.add(core.mesh(core.sphGeo(0.2, 8, 6), core.mat(0xffe9a8, { emissive: true }), plx, 2.6, 0));
      var pglow = core.glowSprite(0xffd98a, 1.2, 0.6);
      pglow.position.set(plx, 2.6, 0);
      pier.add(pglow);
    }
    pier.position.set(154, 0, 22);
    scene.add(pier);
    counts.signs++; counts.props += 12;
    // beach people: sunbathers and walkers on the sand
    for (var bp = 0; bp < 10; bp++) {
      var bpx = 106 + rng() * 24, bpz = -75 + rng() * 150;
      var bpfig = world.buildPed(rng, true);
      bpfig.position.set(bpx, 0, bpz);
      if (bp % 3 === 0) { bpfig.rotation.x = -Math.PI / 2 + 0.15; bpfig.position.y = 0.25; }
      scene.add(bpfig);
      counts.peds++;
    }
  }

  // ------------------------------------------------------ night market
  // Little Havana plaza, south-west blocks: six striped stalls, lanterns,
  // string lights, crates and a crowd. Lit by warm stall glow.
  function buildMarket(scene, rng) {
    var plaza = core.mesh(core.planeGeo(34, 34), core.mat(0x4a3a55), -45, 0.07, 45);
    plaza.rotation.x = -Math.PI / 2;
    scene.add(plaza);
    // string-light poles around the plaza
    var polePts = [];
    for (var p = 0; p < 6; p++) {
      var px = -60 + (p % 3) * 15, pz = p < 3 ? 30 : 60;
      var pole = core.mesh(core.cylGeo(0.1, 0.12, 4.6, 8), core.mat(0x2c2c38), px, 2.3, pz);
      scene.add(pole);
      polePts.push(new THREE.Vector3(px, 4.6, pz));
      counts.props++;
    }
    var bulbMat = core.mat(0xffd98a, { emissive: true });
    var wireMat = new THREE.LineBasicMaterial({ color: 0x111111 });
    for (var w = 0; w < polePts.length - 1; w++) {
      var a = polePts[w], b = polePts[w + 1];
      var mid = a.clone().lerp(b, 0.5); mid.y -= 0.8;
      var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(10)), wireMat));
      for (var bi = 1; bi < 6; bi++) {
        var bp2 = curve.getPoint(bi / 6);
        var bulb = core.mesh(core.sphGeo(0.12, 6, 5), bulbMat, bp2.x, bp2.y - 0.1, bp2.z);
        scene.add(bulb);
      }
    }
    // six stalls in two rows
    var stallDefs = [
      [-56, 38, '#c22e4d'], [-48, 38, '#0e7a6e'], [-40, 38, '#e8a020'],
      [-56, 52, '#2a6ad2'], [-48, 52, '#c26bff'], [-40, 52, '#e85a1a']
    ];
    for (var s = 0; s < stallDefs.length; s++) {
      var sd = stallDefs[s];
      var stall = new THREE.Group();
      // counter + goods
      stall.add(core.box(4.2, 1.0, 2.0, 0x6a4a2a, 0, 0.5, 0));
      var goodsCols = [0xff5a3a, 0xffd23e, 0x7CFC00, 0xff7ab8, 0x2ad2c2];
      for (var gi = 0; gi < 8; gi++) {
        var gc = core.box(0.5, 0.4, 0.5, goodsCols[(gi + s) % goodsCols.length],
          -1.7 + (gi % 4) * 1.1, 1.2, (gi < 4 ? -0.4 : 0.4));
        stall.add(gc);
      }
      // striped roof, tilted
      var awTex = core.awningTexture(sd[2], '#f4ead2');
      var roof = core.mesh(core.planeGeo(4.8, 2.8),
        new THREE.MeshLambertMaterial({ map: awTex }), 0, 2.6, 0);
      roof.rotation.x = -Math.PI / 2 + 0.45;
      stall.add(roof);
      stall.add(core.box(0.1, 2.6, 0.1, 0x3a3a48, -2.2, 1.3, -1.2));
      stall.add(core.box(0.1, 2.6, 0.1, 0x3a3a48, 2.2, 1.3, -1.2));
      stall.add(core.box(0.1, 2.6, 0.1, 0x3a3a48, -2.2, 1.3, 1.2));
      stall.add(core.box(0.1, 2.6, 0.1, 0x3a3a48, 2.2, 1.3, 1.2));
      // lit sign
      var kname = KIOSK_NAMES[s];
      var ktex = core.textTexture(kname, {
        bg: '#191024', fg: '#ffe9b0', glow: sd[2], size: 56,
        border: sd[2], borderW: 4, w: 384, h: 112
      });
      var ksign = core.mesh(core.planeGeo(2.6, 0.75),
        new THREE.MeshBasicMaterial({ map: ktex }), 0, 3.3, 1.05);
      stall.add(ksign);
      counts.signs++;
      // paper lanterns hanging from the roof edge
      for (var ln = 0; ln < 3; ln++) {
        var lantern = core.mesh(core.sphGeo(0.18, 10, 8),
          core.mat(ln % 2 ? 0xff5a3a : 0xffd23e, { emissive: true }),
          -1.5 + ln * 1.5, 2.35, 1.3);
        lantern.scale.y = 1.2;
        stall.add(lantern);
        var lglow = core.glowSprite(ln % 2 ? 0xff5a3a : 0xffd23e, 0.4, 0.35);
        lglow.position.set(-1.5 + ln * 1.5, 2.35, 1.3);
        stall.add(lglow);
      }
      // crates + barrels beside the stall
      stall.add(core.box(0.8, 0.8, 0.8, 0x8a6a3a, 2.8, 0.4, 0.6));
      stall.add(core.mesh(core.cylGeo(0.4, 0.4, 0.9, 10), core.mat(0x3a5a8a), -2.8, 0.45, 0.7));
      stall.position.set(sd[0], 0, sd[1]);
      stall.rotation.y = (s < 3 ? 0 : Math.PI);
      scene.add(stall);
      counts.stalls++; counts.props += 6;
    }
    // market crowd: shoppers milling between stalls
    for (var m = 0; m < 26; m++) {
      var mx = -58 + rng() * 26, mz = 34 + rng() * 22;
      var mp = world.buildPed(rng, false);
      mp.position.set(mx, 0, mz);
      mp.rotation.y = rng() * Math.PI * 2;
      scene.add(mp);
      counts.peds++;
    }
    // foreground props at the plaza's north edge: crates, barrels and a
    // toppled fruit cart, so the mission frame's lower edge is not bare
    for (var fp = 0; fp < 5; fp++) {
      var fx2 = -56 + fp * 5.5, fz2 = 32.5 + (fp % 2) * 1.2;
      var crate = core.box(0.9, 0.9, 0.9, fp % 2 ? 0x8a6a3a : 0x6a4a2a, fx2, 0.45, fz2);
      crate.rotation.y = rng() * 0.8;
      scene.add(crate);
      scene.add(core.box(0.5, 0.4, 0.5, [0xff5a3a, 0xffd23e, 0x7CFC00][fp % 3], fx2, 1.1, fz2));
      counts.props += 2;
    }
    var cart = new THREE.Group();
    cart.add(core.box(1.6, 0.25, 1.0, 0x8a5a2a, 0, 0.6, 0));
    cart.add(core.box(0.4, 0.5, 0.4, 0xff5a3a, -0.4, 0.85, 0));
    cart.add(core.box(0.4, 0.5, 0.4, 0xffd23e, 0.3, 0.85, 0.2));
    cart.rotation.z = 0.5; cart.rotation.y = 0.7;
    cart.position.set(-38, 0.2, 33);
    scene.add(cart);
    counts.props += 3;
    // mission beacon: yellow pillar of light at the far end of the market
    var beacon = new THREE.Group();
    var pillar = core.mesh(core.cylGeo(0.9, 1.4, 26, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffd23e, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }), 0, 13, 0);
    beacon.add(pillar);
    var ring = core.mesh(new THREE.TorusGeometry(1.8, 0.16, 8, 24),
      core.mat(0xffd23e, { emissive: true }), 0, 0.3, 0);
    ring.rotation.x = Math.PI / 2;
    beacon.add(ring);
    beacon.position.set(-45, 0, 62);
    scene.add(beacon);
    world.marketBeacon = beacon;
  }

  // ------------------------------------------------------- detailed cars
  // v6.5: a car must read as a car from the side — windshield and side
  // glass, door seams, handles, mirrors, grille, lights, plate, wheels
  // with hubs. Local space: forward is +X, length ~4.4, width 1.9.
  var TRAFFIC_COLORS = [
    0xd23a2e, 0x2a6ad2, 0xf7c948, 0x2ad2c2, 0x8a8a92, 0x3a3f4a,
    0xe8e4d8, 0x7a4ad2, 0x2e8a4a, 0xff7a1a, 0xc26bff, 0x5a8de8,
    0xb8b0a0, 0x4a2a3a
  ];
  world.TRAFFIC_COLORS = TRAFFIC_COLORS;

  function wheelGeo() {
    var k = 'wheelgeo';
    if (!world._wheelGeo) {
      var g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
      g.rotateX(Math.PI / 2);
      world._wheelGeo = g;
    }
    return world._wheelGeo;
  }
  function hubGeo() {
    if (!world._hubGeo) {
      var g = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10);
      g.rotateX(Math.PI / 2);
      world._hubGeo = g;
    }
    return world._hubGeo;
  }

  // Lighten a hex colour by a factor (for door panels that read as doors
  // against the body colour at screenshot distance).
  function lighten(hex, f) {
    var r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
    var g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
    var b = Math.min(255, Math.round((hex & 255) * f));
    return (r << 16) | (g << 8) | b;
  }

  world.buildCar = function (opts) {
    opts = opts || {};
    var color = opts.color !== undefined ? opts.color : 0xd23a2e;
    var type = opts.type || 'sedan';
    var police = !!opts.police;
    if (police) color = 0x14161c;
    var g = new THREE.Group();
    var wheels = [];

    // ---- body: lower slab + skirt + (sport) wedge hood
    var body = core.box(4.4, 0.55, 1.9, color, 0, 0.52, 0, { toon: true });
    g.add(body);
    g.add(core.box(4.3, 0.2, 1.94, 0x1a1a20, 0, 0.3, 0));
    if (type === 'sport') {
      var hood = core.box(1.5, 0.3, 1.8, color, 1.55, 0.62, 0, { toon: true });
      hood.rotation.z = -0.14;
      g.add(hood);
      var deck = core.box(1.1, 0.28, 1.8, color, -1.6, 0.62, 0, { toon: true });
      deck.rotation.z = 0.1;
      g.add(deck);
      // rear spoiler on two struts
      g.add(core.box(0.08, 0.22, 0.08, 0x1a1a20, -2.0, 0.95, 0.6));
      g.add(core.box(0.08, 0.22, 0.08, 0x1a1a20, -2.0, 0.95, -0.6));
      g.add(core.box(0.5, 0.06, 1.7, 0x1a1a20, -2.05, 1.08, 0));
      // hood scoop
      g.add(core.box(0.6, 0.1, 0.7, 0x1a1a20, 1.4, 0.85, 0));
    }
    if (type === 'van') {
      g.add(core.box(2.6, 0.9, 1.85, color, -0.5, 1.2, 0, { toon: true }));
      g.add(core.box(2.4, 0.6, 0.05, 0x1a1a20, -0.5, 1.25, 0.95));
    }
    if (type === 'pickup') {
      g.add(core.box(1.6, 0.5, 1.8, color, -1.3, 0.95, 0, { toon: true }));
      g.add(core.box(0.08, 0.45, 1.8, color, -2.05, 0.95, 0, { toon: true }));
    }

    // ---- cabin: glass box + body-colour roof + pillars, so the glass
    // reads as windows framed by the body, not a bare box
    var glass = core.glassMat();
    var cabin = core.mesh(core.boxGeo(2.3, 0.52, 1.7), glass, -0.15, 1.02, 0);
    g.add(cabin);
    g.add(core.box(2.1, 0.09, 1.62, color, -0.15, 1.31, 0, { toon: true }));
    var pillarCols = [[1.0, 0.85], [1.0, -0.85], [-1.3, 0.85], [-1.3, -0.85]];
    for (var pi = 0; pi < 4; pi++) {
      g.add(core.box(0.09, 0.52, 0.09, color, pillarCols[pi][0], 1.02, pillarCols[pi][1]));
    }
    // windshield (slanted, at the front of the cabin) + rear window.
    // Euler order YXZ: the X tilt leans the top of the pane, then Y
    // turns it to face forward (+X) / backward (-X).
    var shield = core.mesh(core.planeGeo(1.55, 0.5), glass, 1.02, 1.02, 0);
    shield.rotation.order = 'YXZ';
    shield.rotation.y = Math.PI / 2; shield.rotation.x = -0.42;
    g.add(shield);
    var rearWin = core.mesh(core.planeGeo(1.55, 0.5), glass, -1.32, 1.02, 0);
    rearWin.rotation.order = 'YXZ';
    rearWin.rotation.y = -Math.PI / 2; rearWin.rotation.x = -0.42;
    g.add(rearWin);
    // side windows: thin glass panes on both flanks
    g.add(core.mesh(core.boxGeo(1.95, 0.5, 0.04), glass, -0.15, 1.06, 0.87));
    g.add(core.mesh(core.boxGeo(1.95, 0.5, 0.04), glass, -0.15, 1.06, -0.87));
    // B-pillar split on the side glass
    g.add(core.box(0.06, 0.5, 0.05, color, -0.15, 1.06, 0.88));
    g.add(core.box(0.06, 0.5, 0.05, color, -0.15, 1.06, -0.88));

    // ---- doors: seams + handles on both sides. Seams are thick enough
    // to read at screenshot distance; handles are bright chrome.
    var seamMat = core.mat(0x000000);
    var sides = [0.96, -0.96];
    for (var si = 0; si < 2; si++) {
      var sz = sides[si];
      g.add(core.mesh(core.boxGeo(0.05, 0.52, 0.03), seamMat, 0.45, 0.68, sz));
      g.add(core.mesh(core.boxGeo(0.05, 0.52, 0.03), seamMat, -0.62, 0.68, sz));
      g.add(core.mesh(core.boxGeo(2.5, 0.04, 0.03), seamMat, -0.08, 0.44, sz));
      // door panels: a shade lighter than the body, so each door reads as
      // a door instead of one flat flank
      if (!police) {
        g.add(core.mesh(core.boxGeo(1.05, 0.46, 0.02),
          core.mat(lighten(color, 1.22), { toon: true }), 0.32, 0.68, sz));
        g.add(core.mesh(core.boxGeo(1.05, 0.46, 0.02),
          core.mat(lighten(color, 1.22), { toon: true }), -0.72, 0.68, sz));
      }
      // chrome waistline trim along the doors
      g.add(core.mesh(core.boxGeo(2.5, 0.05, 0.02),
        core.mat(0xe8e8e8, { phong: true, shininess: 100 }), -0.08, 0.95, sz * 1.005));
      g.add(core.box(0.24, 0.07, 0.05, 0xf2f2f2, 0.32, 0.82, sz));
      g.add(core.box(0.24, 0.07, 0.05, 0xf2f2f2, -0.5, 0.82, sz));
      // mirrors on stalks at the front doors
      g.add(core.box(0.06, 0.05, 0.16, 0x1a1a20, 0.95, 0.92, sz * 1.0));
      g.add(core.box(0.1, 0.14, 0.2, color, 0.98, 1.0, sz > 0 ? 1.06 : -1.06));
      if (police) {
        // white door panels + POLICE lettering
        g.add(core.box(1.15, 0.5, 0.03, 0xf2f2f2, -0.08, 0.68, sz));
        var pTex = core.textTexture('POLICE', {
          bg: '#f2f2f2', fg: '#14161c', size: 62, w: 256, h: 96
        });
        var pSign = core.mesh(core.planeGeo(1.0, 0.38),
          new THREE.MeshBasicMaterial({ map: pTex }), -0.08, 0.68, sz * 1.02);
        if (sz < 0) pSign.rotation.y = Math.PI;
        g.add(pSign);
      }
    }
    if (police) {
      // white roof + light bar + push bar
      g.add(core.box(2.1, 0.07, 1.62, 0xf2f2f2, -0.15, 1.36, 0));
      g.add(core.box(1.1, 0.12, 0.4, 0x1a1a20, -0.15, 1.44, 0));
      g.add(core.box(0.45, 0.14, 0.42, 0xd21a1a, -0.42, 1.54, 0));
      g.add(core.box(0.45, 0.14, 0.42, 0x1a4ad2, 0.12, 1.54, 0));
      var glR = core.glowSprite(0xff2a2a, 1.4); glR.position.set(-0.42, 1.56, 0); g.add(glR);
      var glB = core.glowSprite(0x2a6aff, 1.4); glB.position.set(0.12, 1.56, 0); g.add(glB);
      g.add(core.box(0.1, 0.35, 1.5, 0x1a1a20, 2.24, 0.5, 0));
      g.add(core.box(0.08, 0.3, 0.08, 0x1a1a20, 2.28, 0.45, 0.6));
      g.add(core.box(0.08, 0.3, 0.08, 0x1a1a20, 2.28, 0.45, -0.6));
    }
    if (opts.taxi) {
      var taxiTex = core.textTexture('TAXI', { bg: '#f7c948', fg: '#14161c', size: 56, w: 192, h: 80 });
      var taxiSign = core.mesh(core.planeGeo(0.7, 0.3),
        new THREE.MeshBasicMaterial({ map: taxiTex }), -0.15, 1.5, 0);
      g.add(core.box(0.8, 0.22, 0.4, 0xf7c948, -0.15, 1.44, 0));
      g.add(taxiSign);
    }

    // ---- face: grille, headlights, taillights, bumpers, plates, exhaust
    g.add(core.box(0.08, 0.26, 1.3, 0x14161c, 2.21, 0.52, 0));
    g.add(core.box(0.04, 0.05, 1.2, 0x9aa4ae, 2.25, 0.58, 0));
    g.add(core.box(0.04, 0.05, 1.2, 0x9aa4ae, 2.25, 0.46, 0));
    var hlMat = core.mat(0xfff2c9, { emissive: true });
    g.add(core.mesh(core.boxGeo(0.07, 0.17, 0.42), hlMat, 2.22, 0.64, 0.62));
    g.add(core.mesh(core.boxGeo(0.07, 0.17, 0.42), hlMat, 2.22, 0.64, -0.62));
    var tlMat = core.mat(0xff2a1a, { emissive: true });
    g.add(core.mesh(core.boxGeo(0.07, 0.15, 0.4), tlMat, -2.22, 0.64, 0.62));
    g.add(core.mesh(core.boxGeo(0.07, 0.15, 0.4), tlMat, -2.22, 0.64, -0.62));
    g.add(core.box(0.14, 0.2, 1.92, 0x22222a, 2.26, 0.32, 0));
    g.add(core.box(0.14, 0.2, 1.92, 0x22222a, -2.26, 0.32, 0));
    var plate = opts.plate || 'SUN-0000';
    var plateTex = core.plateTexture(plate);
    var plateF = core.mesh(core.planeGeo(0.55, 0.14),
      new THREE.MeshBasicMaterial({ map: plateTex }), 2.34, 0.36, 0);
    plateF.rotation.y = Math.PI / 2;
    g.add(plateF);
    var plateR = core.mesh(core.planeGeo(0.55, 0.14),
      new THREE.MeshBasicMaterial({ map: plateTex }), -2.34, 0.36, 0);
    plateR.rotation.y = -Math.PI / 2;
    g.add(plateR);
    var exh = core.mesh(core.cylGeo(0.07, 0.07, 0.25, 8), core.mat(0x888888), -2.28, 0.24, 0.55);
    exh.rotation.z = Math.PI / 2;
    g.add(exh);

    // ---- wheels: tyre + hubcap + spokes
    var wheelPos = [[1.35, 0.88], [1.35, -0.88], [-1.35, 0.88], [-1.35, -0.88]];
    for (var wi = 0; wi < 4; wi++) {
      var wg = new THREE.Group();
      wg.add(core.mesh(wheelGeo(), core.mat(0x14141a), 0, 0, 0));
      wg.add(core.mesh(hubGeo(), core.mat(0xb8bcc2, { phong: true, shininess: 90 }), 0, 0, 0));
      // 3 spokes per face, rotated around the axle (Z)
      for (var sp = 0; sp < 3; sp++) {
        var spoke = core.box(0.06, 0.34, 0.02, 0x3a3f4a, 0, 0, 0.14);
        spoke.rotation.z = sp * Math.PI / 3;
        wg.add(spoke);
        var spoke2 = core.box(0.06, 0.34, 0.02, 0x3a3f4a, 0, 0, -0.14);
        spoke2.rotation.z = sp * Math.PI / 3;
        wg.add(spoke2);
      }
      wg.position.set(wheelPos[wi][0], 0.36, wheelPos[wi][1]);
      g.add(wg);
      wheels.push(wg);
    }
    g.userData.wheels = wheels;
    g.userData.headlights = hlMat;
    counts.detailedCars++;
    return g;
  };

  // ------------------------------------------------------------ helicopter
  world.buildHelicopter = function () {
    var g = new THREE.Group();
    // body: dark blue with white belly band
    g.add(core.box(3.4, 1.4, 1.7, 0x1a2a4a, 0, 0, 0, { toon: true }));
    g.add(core.box(3.42, 0.4, 1.72, 0xf2f2f2, 0, -0.35, 0));
    var nose = core.mesh(core.sphGeo(0.85, 12, 10), core.mat(0x1a2a4a, { toon: true }), 1.7, -0.1, 0);
    nose.scale.set(1.1, 0.9, 1.0);
    g.add(nose);
    // cockpit glass
    var glass = core.glassMat();
    g.add(core.mesh(core.boxGeo(0.9, 0.7, 1.5), glass, 1.5, 0.25, 0));
    // POLICE lettering on both flanks
    var hTex = core.textTexture('POLICE', { bg: '#f2f2f2', fg: '#1a2a4a', size: 64, w: 384, h: 96 });
    var hs1 = core.mesh(core.planeGeo(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: hTex }), -0.2, 0.25, 0.87);
    g.add(hs1);
    var hs2 = core.mesh(core.planeGeo(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: hTex }), -0.2, 0.25, -0.87);
    hs2.rotation.y = Math.PI;
    g.add(hs2);
    // tail boom + fin + tail rotor
    g.add(core.box(3.8, 0.45, 0.45, 0x1a2a4a, -3.4, 0.25, 0));
    g.add(core.box(0.3, 1.3, 0.12, 0x1a2a4a, -5.1, 0.7, 0));
    var tailRotor = new THREE.Group();
    tailRotor.add(core.box(0.06, 1.6, 0.12, 0x888888, 0, 0, 0));
    tailRotor.add(core.box(0.06, 0.12, 1.6, 0x888888, 0, 0, 0));
    tailRotor.position.set(-5.2, 0.7, 0.3);
    g.add(tailRotor);
    // main rotor: mast + two long blades (spun in sim update)
    g.add(core.mesh(core.cylGeo(0.12, 0.12, 0.6, 8), core.mat(0x2c2c38), 0, 0.95, 0));
    var rotor = new THREE.Group();
    rotor.add(core.box(7.6, 0.07, 0.4, 0x1a1a1a, 0, 0, 0));
    rotor.add(core.box(0.4, 0.07, 7.6, 0x1a1a1a, 0, 0, 0));
    rotor.position.y = 1.25;
    g.add(rotor);
    // skids
    g.add(core.box(2.6, 0.08, 0.08, 0x2c2c38, 0, -1.05, 0.6));
    g.add(core.box(2.6, 0.08, 0.08, 0x2c2c38, 0, -1.05, -0.6));
    for (var st = 0; st < 4; st++) {
      g.add(core.box(0.08, 0.4, 0.08, 0x2c2c38, st < 2 ? 0.8 : -0.8, -0.85, st % 2 ? 0.6 : -0.6));
    }
    // searchlight: spotlight + visible cone + ground pool
    var spot = new THREE.SpotLight(0xfff2c9, 3.2, 70, 0.32, 0.45, 1.2);
    spot.position.set(1.6, -0.7, 0);
    g.add(spot);
    var spotTarget = new THREE.Object3D();
    spotTarget.position.set(4, -14, 2);
    g.add(spotTarget);
    spot.target = spotTarget;
    // ConeGeometry already points its apex up (+Y): apex at the heli,
    // wide base on the street below. No flip.
    var cone = core.mesh(new THREE.ConeGeometry(2.0, 15, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2c9, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }), 2.8, -7.6, 1);
    g.add(cone);
    var pool = core.mesh(new THREE.CircleGeometry(3.4, 20),
      new THREE.MeshBasicMaterial({
        color: 0xfff2c9, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false
      }), 0, 0, 0);
    pool.rotation.x = -Math.PI / 2;
    g.add(pool);
    pool.position.set(4, -14.9, 2);
    // red anti-collision beacon
    var beacon = core.mesh(core.sphGeo(0.14, 8, 6), core.mat(0xff2a1a, { emissive: true }), 0, 0.85, 0);
    g.add(beacon);
    g.userData.rotor = rotor;
    g.userData.tailRotor = tailRotor;
    g.userData.spot = spot;
    g.userData.pool = pool;
    g.userData.cone = cone;
    return g;
  };

  // ------------------------------------------------------------ roadblock
  world.buildRoadblock = function () {
    var g = new THREE.Group();
    var c1 = world.buildCar({ police: true, plate: 'PD-1042' });
    c1.position.set(0, 0, 2.6); c1.rotation.y = Math.PI / 2 + 0.5;
    g.add(c1);
    var c2 = world.buildCar({ police: true, plate: 'PD-1077' });
    c2.position.set(0.5, 0, -2.6); c2.rotation.y = Math.PI / 2 - 0.5;
    g.add(c2);
    // striped barrier between them
    var bTex = core.textTexture('POLICE — ROAD CLOSED', {
      bg: '#f7c948', fg: '#14161c', size: 44, w: 512, h: 96
    });
    var barrier = core.mesh(core.planeGeo(4.6, 0.8),
      new THREE.MeshBasicMaterial({ map: bTex }), 0, 1.0, 0);
    g.add(barrier);
    g.add(core.box(4.6, 0.1, 0.1, 0x1a1a20, 0, 1.45, 0));
    g.add(core.box(0.12, 1.0, 0.12, 0x1a1a20, -2.2, 0.5, 0));
    g.add(core.box(0.12, 1.0, 0.12, 0x1a1a20, 2.2, 0.5, 0));
    for (var i = 0; i < 4; i++) {
      var cone = core.mesh(new THREE.ConeGeometry(0.22, 0.6, 10), core.mat(0xff5a1a, { toon: true }),
        -3 + i * 2, 0.3, i % 2 ? 1.6 : -1.6);
      g.add(cone);
      g.add(core.box(0.5, 0.05, 0.5, 0xff5a1a, -3 + i * 2, 0.03, i % 2 ? 1.6 : -1.6));
    }
    counts.police += 2;
    return g;
  };

  // ------------------------------------------------------------- people
  var SKINS = [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6a3a22, 0xd9a06a];
  var SHIRTS = [0xd23a2e, 0x2a6ad2, 0xf7c948, 0x2ad2c2, 0xe8e4d8,
    0x7a4ad2, 0x2e8a4a, 0xff7a1a, 0xc26bff, 0x5a8de8, 0xf2a0a8, 0x3a3f4a];
  var PANTS = [0x2a2f3a, 0x3a4a6a, 0x5a5a5a, 0x6a4a2a, 0x1a1a1a];

  // A pedestrian: legs, torso, arms, head, hair. ~6 meshes, varied colours.
  world.buildPed = function (rng, beach) {
    var g = new THREE.Group();
    var skin = core.pick(rng, SKINS);
    var shirt = core.pick(rng, SHIRTS);
    var pants = core.pick(rng, PANTS);
    if (beach) {
      // shorts + bare chest or bright top
      g.add(core.box(0.42, 0.3, 0.24, pants, 0, 0.75, 0, { toon: true }));
      g.add(core.box(0.18, 0.5, 0.18, skin, -0.12, 0.35, 0, { toon: true }));
      g.add(core.box(0.18, 0.5, 0.18, skin, 0.12, 0.35, 0, { toon: true }));
      g.add(core.box(0.5, 0.55, 0.28, rng() < 0.5 ? skin : shirt, 0, 1.15, 0, { toon: true }));
    } else {
      g.add(core.box(0.18, 0.75, 0.18, pants, -0.12, 0.38, 0, { toon: true }));
      g.add(core.box(0.18, 0.75, 0.18, pants, 0.12, 0.38, 0, { toon: true }));
      g.add(core.box(0.52, 0.62, 0.3, shirt, 0, 1.05, 0, { toon: true }));
      g.add(core.box(0.1, 0.5, 0.1, shirt, -0.32, 1.0, 0, { toon: true }));
      g.add(core.box(0.1, 0.5, 0.1, shirt, 0.32, 1.0, 0, { toon: true }));
    }
    var head = core.mesh(core.sphGeo(0.17, 10, 8), core.mat(skin, { toon: true }), 0, 1.56, 0);
    g.add(head);
    var hairCol = core.pick(rng, [0x1a1a1a, 0x3a2a1a, 0x8a6a2a, 0x5a5a5a]);
    var hair = core.mesh(core.sphGeo(0.175, 10, 8), core.mat(hairCol), 0, 1.6, -0.02);
    hair.scale.set(1, 0.75, 1);
    g.add(hair);
    if (rng() < 0.2) { // hat
      var hat = core.mesh(new THREE.ConeGeometry(0.24, 0.22, 10),
        core.mat(core.pick(rng, [0xf7c948, 0xd23a2e, 0x2ad2c2])), 0, 1.78, 0);
      g.add(hat);
    }
    g.userData.phase = rng() * Math.PI * 2;
    g.userData.speed = 0.8 + rng() * 0.9;
    return g;
  };

  // Mateo Vega, 28, getaway driver: burnt-orange bomber jacket, white tee,
  // dark jeans. Built from rounded shapes (spheres / capsules), not bare
  // boxes. `aiming` gives him a two-handed pistol stance for the mission.
  world.buildMateo = function (aiming) {
    var g = new THREE.Group();
    var skin = 0xc98d64, jacket = 0xd05a1e, jeans = 0x2a2f3a;
    // legs (jeans) + shoes
    var legL = core.box(0.2, 0.8, 0.22, jeans, -0.13, 0.4, 0, { toon: true });
    var legR = core.box(0.2, 0.8, 0.22, jeans, 0.13, 0.4, 0, { toon: true });
    g.add(legL); g.add(legR);
    g.add(core.box(0.2, 0.1, 0.34, 0x1a1a1a, -0.13, 0.05, 0.05));
    g.add(core.box(0.2, 0.1, 0.34, 0x1a1a1a, 0.13, 0.05, 0.05));
    // torso: orange bomber jacket, white tee showing at the chest
    var torso = core.box(0.6, 0.68, 0.34, jacket, 0, 1.14, 0, { toon: true });
    g.add(torso);
    g.add(core.box(0.24, 0.5, 0.05, 0xf2f2f2, 0, 1.18, 0.18));
    g.add(core.box(0.05, 0.62, 0.02, 0x2a2a2a, 0, 1.14, 0.19)); // zipper
    g.add(core.box(0.62, 0.1, 0.36, 0xb84a16, 0, 1.44, 0)); // collar band
    g.add(core.box(0.16, 0.12, 0.02, 0xb84a16, -0.16, 0.95, 0.18)); // pocket
    g.add(core.box(0.16, 0.12, 0.02, 0xb84a16, 0.16, 0.95, 0.18));
    // head: skin sphere + wavy brown-blond hair + stubble jaw
    var head = core.mesh(core.sphGeo(0.19, 12, 10), core.mat(skin, { toon: true }), 0, 1.68, 0);
    g.add(head);
    var hair = core.mesh(core.sphGeo(0.2, 12, 10), core.mat(0x6a4a22), 0, 1.74, -0.03);
    hair.scale.set(1, 0.8, 1);
    g.add(hair);
    g.add(core.box(0.3, 0.08, 0.1, 0x3a2a1a, 0, 1.58, 0.14)); // stubble
    // arms
    var armL = new THREE.Group(), armR = new THREE.Group();
    var sleeveL = core.box(0.15, 0.62, 0.17, jacket, 0, -0.28, 0, { toon: true });
    var sleeveR = core.box(0.15, 0.62, 0.17, jacket, 0, -0.28, 0, { toon: true });
    var handL = core.mesh(core.sphGeo(0.08, 8, 6), core.mat(skin), 0, -0.62, 0);
    var handR = core.mesh(core.sphGeo(0.08, 8, 6), core.mat(skin), 0, -0.62, 0);
    armL.add(sleeveL); armL.add(handL);
    armR.add(sleeveR); armR.add(handR);
    armL.position.set(-0.38, 1.42, 0);
    armR.position.set(0.38, 1.42, 0);
    if (aiming) {
      // two-handed pistol stance, arms forward, slight crouch
      armL.rotation.x = -Math.PI / 2 + 0.12;
      armR.rotation.x = -Math.PI / 2 + 0.05;
      armL.rotation.z = 0.35; armR.rotation.z = -0.18;
      armL.position.set(-0.3, 1.38, 0.1);
      armR.position.set(0.28, 1.38, 0.12);
      legL.rotation.x = -0.25; legR.rotation.x = 0.2;
      torso.rotation.x = 0.12;
      // pistol in both hands + muzzle flash sprite (lit when firing)
      var pistol = new THREE.Group();
      pistol.add(core.box(0.05, 0.14, 0.3, 0x1a1a1a, 0, 0, 0));
      pistol.add(core.box(0.05, 0.12, 0.08, 0x1a1a1a, 0, -0.1, -0.08));
      pistol.position.set(0.05, 1.32, 0.75);
      g.add(pistol);
      var flash = core.glowSprite(0xffd23e, 0.6, 0.85);
      flash.position.set(0.05, 1.34, 0.95);
      flash.visible = false;
      g.add(flash);
      g.userData.flash = flash;
      g.userData.pistol = pistol;
    } else {
      armL.rotation.z = 0.12; armR.rotation.z = -0.12;
    }
    g.add(armL); g.add(armR);
    g.userData.armL = armL; g.userData.armR = armR;
    return g;
  };

  // A body on the ground: enemy (red shirt) or officer (navy, scaled up).
  // The torso is unlit (full colour) so the body still reads as a body at
  // night instead of a black lump on the plaza.
  world.buildDowned = function (shirtColor, scale) {
    var g = new THREE.Group();
    var s = scale || 1;
    g.add(core.box(0.55, 0.3, 1.0, shirtColor, 0, 0.18, 0, { emissive: true }));
    g.add(core.box(0.2, 0.18, 0.8, 0x2a2f3a, -0.15, 0.12, 0.9, { toon: true }));
    g.add(core.box(0.2, 0.18, 0.8, 0x2a2f3a, 0.15, 0.12, 0.9, { toon: true }));
    var head = core.mesh(core.sphGeo(0.19, 10, 8), core.mat(0xc98d64, { toon: true }), 0, 0.2, -0.65);
    g.add(head);
    g.add(core.box(0.12, 0.14, 0.55, shirtColor, -0.38, 0.16, -0.25, { toon: true }));
    g.add(core.box(0.12, 0.14, 0.55, shirtColor, 0.38, 0.16, -0.4, { toon: true }));
    g.scale.setScalar(s);
    return g;
  };

  // ---------------------------------------------------------------- build
  world.build = function (scene) {
    var rng = core.mulberry32(20261120);
    buildRoads(scene);
    buildBuildings(scene, rng);
    buildStreetProps(scene, rng);
    buildBeach(scene, rng);
    buildMarket(scene, rng);
    world.counts = counts;
    return world;
  };
  world.counts = counts;
  world.SHOP_NAMES = SHOP_NAMES;
  world.KIOSK_NAMES = KIOSK_NAMES;
})();
