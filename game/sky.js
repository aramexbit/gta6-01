// PIER HEAT — Sunset Bay v7.5
// sky.js — the golden-hour sky, built from how the real thing works.
//
// WHY IT LOOKS THIS WAY (how-it-works-v75.md §3): at sunset the sun
// sits low, so its light crosses a long stretch of air; Rayleigh
// scattering throws the blue away and only red-orange-yellow survives.
// A cloud is a screen that catches that red light — so a sunset cloud
// is lit from BELOW (the sea bounces the same red light back up at it)
// and from the sun side, while its crown stays dark grey-mauve where
// the thick cloud blocks the light. The sky itself is a gradient for
// the same reason: deep blue overhead where the air is thin, orange
// and red at the horizon where the light has travelled furthest.
// The sun is a low disc with a starburst (the eye's own flare on a
// bright disc) and a soft glare; where its light slips through gaps
// between clouds it lands as slanted shafts — sunbeams.
//
// WHAT THIS FILE BUILDS, and how world.js uses it:
//   PH.buildSunsetSky(scene, sunset, W) — replaces the old flat white
//   cloud blobs: layered cumulus (lit-orange base, gold sun side, dark
//   crown, gold rim), the sun disc + starburst + glare, a warm haze
//   band on the sun side, and slanted sunbeams. Clouds go into
//   W.clouds / W.cloudShadows, so world.js's existing drift code
//   (clouds drift east, shadows travel with them) keeps working.
//   PH.updateSunsetSky(t) — a slow shimmer on the beams + rims.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // The one sun direction the whole scene agrees on (same spot world.js
  // puts its directional light): low over the sea at sunset, high and
  // pale by day.
  function sunPos(sunset) {
    return sunset ? { x: -150, y: 24, z: -420 } : { x: 30, y: 160, z: -420 };
  }

  // Starburst canvas: a bright core disc with eight long thin spikes —
  // the flare a bright low sun throws on a camera lens (and on the eye).
  // The spikes are what make the disc read as "the sun" instead of a
  // pale moon; the core stays warm white-yellow, never pure white.
  function sunburstTexture() {
    return PH.canvasTex(256, 256, function (g, w, h) {
      var cx = w / 2, cy = h / 2;
      // soft halo first, so the spikes sit on glow, not on black sky
      var halo = g.createRadialGradient(cx, cy, 2, cx, cy, 120);
      halo.addColorStop(0, 'rgba(255,230,160,0.9)');
      halo.addColorStop(0.35, 'rgba(255,180,90,0.45)');
      halo.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
      // eight spikes: long, thin, tapering, brightest near the core
      g.fillStyle = 'rgba(255,225,150,0.85)';
      for (var i = 0; i < 8; i++) {
        var a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        var len = i % 2 ? 118 : 96;
        var wd = i % 2 ? 3 : 5;
        g.save();
        g.translate(cx, cy); g.rotate(a);
        g.beginPath();
        g.moveTo(-wd, 0); g.lineTo(0, -wd * 2.2); g.lineTo(len, 0);
        g.lineTo(0, wd * 2.2); g.closePath(); g.fill();
        g.restore();
      }
      // the disc itself: warm white core, gold edge, soft rim
      var core = g.createRadialGradient(cx, cy, 2, cx, cy, 42);
      core.addColorStop(0, 'rgba(255,252,230,1)');
      core.addColorStop(0.55, 'rgba(255,222,130,1)');
      core.addColorStop(0.85, 'rgba(255,170,70,0.95)');
      core.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = core;
      g.beginPath(); g.arc(cx, cy, 42, 0, Math.PI * 2); g.fill();
    });
  }

  // Haze band canvas: warm at the bottom (where the sunlit air is
  // thickest), fading to nothing at the top — the glow that hangs over
  // the sea at golden hour.
  function hazeTexture() {
    return PH.canvasTex(256, 256, function (g, w, h) {
      var grad = g.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, 'rgba(255,170,90,0.55)');
      grad.addColorStop(0.45, 'rgba(255,140,90,0.28)');
      grad.addColorStop(1, 'rgba(255,140,110,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // a few soft horizontal streaks, so the band is air, not a wall
      g.fillStyle = 'rgba(255,220,170,0.18)';
      for (var i = 0; i < 6; i++) g.fillRect(0, 40 + i * 34, w, 5 + PH.R() * 8);
    });
  }

  // Sunbeam canvas: a shaft that is brightest where it leaves the cloud
  // gap and fades as it falls — light spreads and weakens with distance,
  // so a beam never has a hard far edge.
  function beamTexture() {
    return PH.canvasTex(64, 256, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,225,160,0.85)');
      grad.addColorStop(0.5, 'rgba(255,200,120,0.35)');
      grad.addColorStop(1, 'rgba(255,180,100,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // soft side falloff: the shaft is brightest on its centre line
      var side = g.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, 'rgba(0,0,0,1)');
      side.addColorStop(0.25, 'rgba(0,0,0,0)');
      side.addColorStop(0.75, 'rgba(0,0,0,0)');
      side.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = side; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }

  // One cumulus, built the way a real one is lit: three stacked layers
  // plus a gold rim. The base is lit from BELOW by the sea's reflected
  // red light, so it glows orange; the sun side is warm gold; the
  // crown is dark where the cloud is thickest; the rim is the thin
  // bright edge where the low sun catches the cloud's outline.
  // `density` (0..1) drives how dark the ground shadow under it is.
  function makeCumulus(scale, sunset) {
    var g = new THREE.Group();
    // palettes: sunset = fire below, gold on the sun side, dark crown;
    // day = pale cream lit from above, soft grey shade, white crown.
    var baseCol = sunset ? 0xff8a3a : 0xfff2d8;
    var sunCol = sunset ? 0xffc070 : 0xfff6e0;
    var topCol = sunset ? 0xffe8c0 : 0xffffff;
    var shadeCol = sunset ? 0x8a6a92 : 0xb8c8d8;
    var crownCol = sunset ? 0x453448 : 0xd8e2ec;
    var baseMat = new THREE.MeshBasicMaterial({ color: baseCol, transparent: true, opacity: 0.94, fog: true });
    var sunMat = new THREE.MeshBasicMaterial({ color: sunCol, transparent: true, opacity: 0.94, fog: true });
    var topMat = new THREE.MeshBasicMaterial({ color: topCol, transparent: true, opacity: 0.94, fog: true });
    var shadeMat = new THREE.MeshBasicMaterial({ color: shadeCol, transparent: true, opacity: 0.92, fog: true });
    var crownMat = new THREE.MeshBasicMaterial({ color: crownCol, transparent: true, opacity: 0.92, fog: true });
    var density = 0.55 + PH.R() * 0.45;
    g.userData.density = density;
    // wind shear: the crown drifts downwind (+X, the sea breeze) from
    // the base, so the cloud leans instead of stacking straight up.
    var shear = PH.rand(1.5, 3.5);
    // base layer: wide, round-ish puffs — the glowing underside.
    // v7.5 rev 2: the first version squashed the base to scale.y 0.3
    // and the puffs read as flat pancakes from the street. A real
    // cumulus is a pile of ROUND bubbles — the base is only slightly
    // flattened (0.55), and the puffs overlap in a tight pile instead
    // of a wide flat row.
    var nb = 4 + Math.floor(PH.R() * 2);
    for (var b = 0; b < nb; b++) {
      var bp = new THREE.Mesh(new THREE.SphereGeometry(PH.rand(4.5, 7), 10, 8), baseMat);
      bp.scale.y = 0.55;
      bp.position.set(PH.rand(-7, 7), -1.2, PH.rand(-3, 3));
      g.add(bp);
    }
    // mid body: the bulk. Puffs on the sun side (-X) are gold, puffs
    // on the far side are cool shade, the middle is pale cream.
    // v7.5 rev 2: rounder (0.7) and tighter, with more size variety —
    // a couple of big 6.5 bubbles anchoring the pile, small ones
    // filling the gaps, so the outline is lumpy, not a smooth disc.
    var nm = 6 + Math.floor(PH.R() * 3);
    for (var i = 0; i < nm; i++) {
      var px = PH.rand(-7, 7);
      var m = px < -1 ? sunMat : (px > 3 ? shadeMat : topMat);
      var s = new THREE.Mesh(new THREE.SphereGeometry(PH.rand(3, 6.5), 10, 8), m);
      s.scale.y = 0.7;
      s.position.set(px + shear * 0.35, PH.rand(-0.6, 1.4), PH.rand(-3, 3));
      g.add(s);
    }
    // crown: small round puffs on top, sheared furthest downwind —
    // dark at sunset (the thick top blocks the light), pale by day.
    // v7.5 rev 2: the crown is darker now at sunset (0x453448) so it
    // reads as a shadowed top against the gold rim, not another flat
    // pink blob.
    var nc = 5 + Math.floor(PH.R() * 3);
    for (var j = 0; j < nc; j++) {
      var cp = new THREE.Mesh(new THREE.SphereGeometry(PH.rand(2, 3.4), 10, 8), crownMat);
      cp.position.set(PH.rand(-5, 5) + shear, PH.rand(1.4, 2.8), PH.rand(-2.5, 2.5));
      g.add(cp);
    }
    // wisps: tiny puffs fraying the thin edges, so the outline is
    // ragged the way a real cloud edge is, never a smooth balloon.
    for (var k = 0; k < 6; k++) {
      var wisp = new THREE.Mesh(new THREE.SphereGeometry(PH.rand(0.8, 1.8), 8, 6),
        PH.R() < 0.5 ? sunMat : shadeMat);
      wisp.scale.y = 0.6;
      var edge = PH.R() < 0.5 ? -1 : 1;
      wisp.position.set(edge * PH.rand(8, 11), PH.rand(-1, 1.5), PH.rand(-3.5, 3.5));
      g.add(wisp);
    }
    // gold rim: a warm glow sprite hugging the sun side of the cluster
    // — the bright edge the low sun draws around a cloud's outline.
    if (sunset) {
      var rim = new THREE.Sprite(new THREE.SpriteMaterial({
        map: PH.sunTexture(), transparent: true, opacity: 0.35, fog: false, depthWrite: false
      }));
      rim.scale.set(30, 12, 1);
      rim.position.set(-7, -0.5, -2);
      g.add(rim);
      g.userData.rim = rim;
      // v7.5 rev 2: register the rim for the pulse in updateSunsetSky
      if (!PH._sky75Rims) PH._sky75Rims = [];
      PH._sky75Rims.push({ mat: rim.material, phase: PH.R() * 6.28 });
    }
    g.scale.setScalar(scale);
    return g;
  }

  // Soft ground shadow for one cloud: a blurred dark ellipse that
  // travels with the cloud, so streets drift in and out of shade.
  function makeSkyShadow(density) {
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(34, 22),
      new THREE.MeshBasicMaterial({ map: PH.contactShadowTexture(), transparent: true, opacity: 0.10 + density * 0.14, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.rotation.z = PH.rand(0, 3);
    return sh;
  }

  // The sun assembly: starburst disc + wide soft glare, both at the one
  // sun position. Sprites always face the camera, so the disc reads
  // from every street angle — the old flat sun sprite is skipped by
  // world.js when this file is loaded, so there is never two suns.
  function buildSun(scene, sunset) {
    var sp = sunPos(sunset);
    var disc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunburstTexture(), transparent: true, fog: false, depthWrite: false,
      opacity: sunset ? 1 : 0.9
    }));
    disc.position.set(sp.x, sp.y, sp.z);
    disc.scale.set(sunset ? 78 : 66, sunset ? 78 : 66, 1);
    scene.add(disc);
    // wide soft glare around the disc, so the sky near the sun glows
    // instead of cutting off hard at the disc's edge
    var glare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: PH.sunGlareTexture(), transparent: true, fog: false, depthWrite: false,
      opacity: sunset ? 0.55 : 0.3
    }));
    glare.position.set(sp.x, sp.y, sp.z + 5);
    glare.scale.set(sunset ? 260 : 170, sunset ? 260 : 170, 1);
    scene.add(glare);
    // horizontal glare streak across the disc at sunset — the lens
    // flare line a low sun throws across the frame
    if (sunset) {
      var streakTex = PH.canvasTex(512, 64, function (g, w, h) {
        var grad = g.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, 'rgba(255,180,80,0)');
        grad.addColorStop(0.5, 'rgba(255,220,140,0.9)');
        grad.addColorStop(1, 'rgba(255,180,80,0)');
        g.fillStyle = grad; g.fillRect(0, h / 2 - 4, w, 8);
        g.fillStyle = 'rgba(255,240,200,0.9)';
        g.beginPath(); g.arc(w / 2, h / 2, 14, 0, Math.PI * 2); g.fill();
      });
      var streak = new THREE.Sprite(new THREE.SpriteMaterial({
        map: streakTex, transparent: true, fog: false, depthWrite: false, opacity: 0.85
      }));
      streak.position.set(sp.x, sp.y, sp.z + 10);
      streak.scale.set(220, 28, 1);
      scene.add(streak);
    }
    return sp;
  }

  // Haze band: tall soft quads standing on the horizon on the sun side,
  // warm at the bottom. They are the air itself glowing — distant
  // buildings and the sea haze dissolve into them instead of hitting a
  // hard grey fog wall.
  function buildHaze(scene, sunset) {
    if (!sunset) return;
    var tex = hazeTexture();
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.5, fog: false,
      side: THREE.DoubleSide, depthWrite: false
    });
    [[-290, -160], [-295, 40], [-285, 200]].forEach(function (p) {
      var band = new THREE.Mesh(new THREE.PlaneGeometry(180, 70), mat);
      band.position.set(p[0], 26, p[1]);
      band.rotation.y = Math.PI / 2;
      scene.add(band);
    });
  }

  // Distant mountain silhouettes (real-refs-v75.md §7): the bay is
  // ringed by dark jagged ridges that go hazier the further they are.
  // Two layers — a nearer, darker ridge and a farther, paler one —
  // drawn as a jagged canvas silhouette on a huge open cylinder
  // segment, so the horizon has teeth instead of a smooth gradient.
  // The ridges sit inside the sky dome (r 480) at r 440, low on the
  // horizon, and fog hazes them out the way distance hazes real hills.
  function ridgeTexture(color, seed) {
    return PH.canvasTex(1024, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, h);
      var y = h * (0.45 + PH.R() * 0.2);
      var x = 0;
      while (x < w) {
        // jagged peaks: up fast, down slower, never a smooth sine
        var peak = PH.rand(18, 55);
        var step = PH.rand(40, 110);
        g.lineTo(x + step * 0.5, y - peak);
        g.lineTo(x + step, y - PH.rand(0, 18));
        x += step;
        y = h * (0.45 + PH.R() * 0.25);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
      // haze at the foot: the ridge dissolves into the horizon instead
      // of cutting off hard at its base
      var fade = g.createLinearGradient(0, h * 0.55, 0, h);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = fade; g.fillRect(0, h * 0.55, w, h * 0.45);
      g.globalCompositeOperation = 'source-over';
    });
  }

  function buildMountains(scene, sunset) {
    var near = sunset ? '#3a2c48' : '#5a6a7a';
    var far = sunset ? '#6a4a68' : '#8aa0b4';
    // far ridge: taller, paler, behind — drawn first so the near ridge
    // overlaps it
    var farTex = ridgeTexture(far, 7);
    var farRidge = new THREE.Mesh(
      new THREE.CylinderGeometry(440, 440, 90, 48, 1, true, -Math.PI * 0.1, Math.PI * 1.2),
      new THREE.MeshBasicMaterial({ map: farTex, transparent: true, fog: true, side: THREE.DoubleSide, depthWrite: false }));
    farRidge.position.y = 18;
    scene.add(farRidge);
    // near ridge: lower, darker, in front
    var nearTex = ridgeTexture(near, 3);
    var nearRidge = new THREE.Mesh(
      new THREE.CylinderGeometry(430, 430, 64, 48, 1, true, Math.PI * 0.15, Math.PI * 1.1),
      new THREE.MeshBasicMaterial({ map: nearTex, transparent: true, fog: true, side: THREE.DoubleSide, depthWrite: false }));
    nearRidge.position.y = 8;
    scene.add(nearRidge);
  }

  // Second haze layer: a lower, wider band of warm air hugging the
  // horizon all round the city, so the far buildings and the sea edge
  // dissolve into glow instead of standing on a hard line.
  function buildLowHaze(scene, sunset) {
    if (!sunset) return;
    var tex = hazeTexture();
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.35, fog: false,
      side: THREE.DoubleSide, depthWrite: false
    });
    [[-240, -260], [-240, 260], [240, -260], [240, 260]].forEach(function (p) {
      var band = new THREE.Mesh(new THREE.PlaneGeometry(300, 42), mat);
      band.position.set(p[0], 14, p[1]);
      band.rotation.y = Math.PI / 2;
      scene.add(band);
    });
  }

  // Sunbeams: long shallow shafts slanting down from the sun toward the
  // city, fanning slightly. At golden hour the sun is low, so the
  // shafts are nearly horizontal — they rake across the sky instead of
  // falling straight down. Additive, faint; the shimmer in
  // updateSunsetSky keeps them alive instead of painted-on.
  function buildSunbeams(scene, sunset) {
    var beams = [];
    var tex = beamTexture();
    var count = sunset ? 6 : 3;
    for (var i = 0; i < count; i++) {
      var mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: sunset ? 0.13 : 0.07,
        blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide, fog: false
      });
      var shaft = new THREE.Mesh(new THREE.PlaneGeometry(7 + PH.R() * 7, 150), mat);
      // start high near the sun side, slant down toward the city
      shaft.position.set(-190 + i * 34 + PH.rand(-8, 8), 55 + PH.rand(-8, 8), -160 + PH.rand(-40, 60));
      shaft.rotation.z = 1.15 + PH.rand(-0.08, 0.08); // shallow slant
      shaft.rotation.y = PH.rand(-0.25, 0.25);
      scene.add(shaft);
      beams.push({ mesh: shaft, base: mat.opacity, phase: PH.R() * 6.28 });
    }
    PH._sky75Beams = beams;
  }

  // The whole sky. world.js calls this instead of its old cloud block
  // when the file is loaded; the clouds land in W.clouds / W.cloudShadows
  // so the existing drift update keeps working unchanged.
  PH.buildSunsetSky = function (scene, sunset, W) {
    var sp = buildSun(scene, sunset);
    buildHaze(scene, sunset);
    buildLowHaze(scene, sunset);
    buildMountains(scene, sunset);
    buildSunbeams(scene, sunset);
    buildMaresTails(scene, sunset);
    buildAfterglow(scene, sunset);
    // scattered cumulus across the whole sky
    var nClouds = sunset ? 10 : 16;
    for (var ci = 0; ci < nClouds; ci++) {
      var cl = makeCumulus(PH.rand(1.8, 3.0), sunset);
      cl.position.set(PH.rand(-220, 220), PH.rand(28, 58), PH.rand(-220, 220));
      scene.add(cl); W.clouds.push(cl);
      var sh = makeSkyShadow(cl.userData.density);
      sh.position.set(cl.position.x * 0.5, 0.12, cl.position.z * 0.5);
      scene.add(sh); W.cloudShadows.push(sh);
    }
    // six hero clouds, placed to frame the shots: two low over the sea
    // to the west, two high over the city, two guarding the horizon
    [[-80, 36, -180], [40, 44, -200], [-50, 32, 160], [-70, 34, 180], [-185, 40, 20], [-190, 44, -60]].forEach(function (p, i) {
      var hc = makeCumulus(2.6 + (i % 3) * 0.4, sunset);
      hc.position.set(p[0], p[1], p[2]);
      scene.add(hc); W.clouds.push(hc);
      var hs = makeSkyShadow(hc.userData.density);
      hs.position.set(p[0] * 0.5, 0.12, p[2] * 0.5);
      scene.add(hs); W.cloudShadows.push(hs);
    });
    // horizon ring, denser toward the sun: low lit puffs crowding the
    // sunset side of the dome, so the horizon glows with cloud instead
    // of empty gradient
    if (sunset) {
      for (var di = 0; di < 12; di++) {
        var ang = Math.PI + PH.rand(-0.7, 0.7); // around the sun side (-X)
        var dist = 430;
        var dc = makeCumulus(PH.rand(1.2, 2.0), true);
        dc.position.set(Math.cos(ang) * dist, PH.rand(18, 55), Math.sin(ang) * dist * 0.7);
        scene.add(dc);
        W.clouds.push(dc);
      }
    }
    W.sky75 = true;
    W.sunPos = sp;
    return W;
  };

  // Slow shimmer: the beams breathe (clouds drift across the gaps, so
  // the shafts fade in and out) and the gold rims pulse faintly. Called
  // from the main loop when present; harmless if never called.
  // v7.5 rev 2: the cloud rims pulse too — the low sun's edge light
  // strengthens and fades as the cloud drifts, so the gold rim is
  // alive, not a painted halo.
  PH.updateSunsetSky = function (t) {
    var beams = PH._sky75Beams || [];
    beams.forEach(function (b, i) {
      b.mesh.material.opacity = b.base * (0.75 + 0.25 * Math.sin(t * 0.35 + b.phase + i));
    });
    var rims = PH._sky75Rims || [];
    rims.forEach(function (r, i) {
      r.mat.opacity = 0.35 * (0.8 + 0.2 * Math.sin(t * 0.5 + r.phase + i));
    });
  };

  // Afterglow: the horizon itself glows where the sun has gone down —
  // a huge soft warm sprite hugging the western horizon, wider and
  // lower than the sun's own glare, so the sky has a band of fire at
  // its foot even where the sun disc is hidden behind a building.
  function buildAfterglow(scene, sunset) {
    if (!sunset) return;
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: PH.sunGlareTexture(), transparent: true, fog: false,
      depthWrite: false, opacity: 0.4
    }));
    glow.position.set(-320, 12, 0);
    glow.scale.set(420, 110, 1);
    scene.add(glow);
    // a second, smaller afterglow on the eastern side — the sky
    // opposite the sun catches a faint pink echo (the Earth's shadow
    // band), so the horizon glows all round, not only in the west
    var echo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: PH.sunGlareTexture(), transparent: true, fog: false,
      depthWrite: false, opacity: 0.18, color: 0xff9ab0
    }));
    echo.position.set(320, 18, 0);
    echo.scale.set(300, 80, 1);
    scene.add(echo);
  }

  // Mare's tails: thin high streaks of cirrus that the low sun turns
  // pink and gold — the high sky's own decoration, above the cumulus.
  // They are long flat ribbons, not puffs, and they sit high (y 70-90)
  // so they never collide with the cumulus below.
  function buildMaresTails(scene, sunset) {
    var tex = PH.canvasTex(256, 32, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, sunset ? 'rgba(255,190,150,0.8)' : 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, h * 0.3, w, h * 0.4);
      // a second, fainter strand below the first, so the tail looks
      // like combed hair instead of a single line
      g.fillStyle = sunset ? 'rgba(255,170,140,0.35)' : 'rgba(255,255,255,0.35)';
      g.fillRect(w * 0.1, h * 0.65, w * 0.8, h * 0.2);
    });
    var count = sunset ? 8 : 5;
    for (var i = 0; i < count; i++) {
      var mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.5 + PH.R() * 0.3,
        depthWrite: false, fog: false, side: THREE.DoubleSide
      });
      var tail = new THREE.Mesh(new THREE.PlaneGeometry(60 + PH.R() * 60, 3 + PH.R() * 3), mat);
      tail.position.set(PH.rand(-200, 200), PH.rand(70, 95), PH.rand(-220, 220));
      tail.rotation.y = PH.rand(0, Math.PI);
      tail.rotation.z = PH.rand(-0.15, 0.15);
      scene.add(tail);
    }
  }
})();
