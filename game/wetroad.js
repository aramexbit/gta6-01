// PIER HEAT — Sunset Bay v7.5
// wetroad.js — the wet road as a mirror, built from how wet asphalt
// works (how-it-works-v75.md §4 + real-refs-v75.md §8).
//
// WHY IT LOOKS THIS WAY: dry asphalt is rough, so it scatters light in
// every direction (diffuse) and looks matte — no reflections. A thin
// film of water fills the asphalt's pits, so the surface turns SMOOTH
// and reflects like a mirror (specular: angle in = angle out). How
// strong the mirror is depends on the ANGLE: looking straight down at
// water, only ~2% of the light comes back; from a shallow angle — a
// low camera, the way a street photo is taken — it becomes tens of
// percent. So the lower the camera, the stronger the mirror. Ripples
// stretch each reflection into a long vertical ribbon pointing at the
// viewer: a red tail light becomes a long red band on the road, a neon
// sign becomes a coloured streak. And a reflection is a second scene,
// always DARKER than its source — never brighter.
//
// WHAT THIS FILE BUILDS, and how world.js / main.js use it:
//   PH.wetAsphalt(sunset) — glossy wet asphalt for the roads (low
//     roughness, so the sun smears across it); world.js uses it for
//     its shared road material when present.
//   PH.layWetReflections(scene, spots) — vertical light ribbons on the
//     road under lamps, traffic lights, neon signs and car tail
//     lights. Each spot is {x, z, color, len, w}; the ribbon is
//     brightest at its source end and fades toward the viewer, and
//     always darker than the light it reflects. world.js lays the
//     static ones (lamps, traffic lights, neon); main.js adds the car
//     ones in the staged shots.
//   PH.updateWetReflections(camY) — the mirror strength follows the
//     camera height: low camera = strong mirror, high camera = faint.
//     Called every frame from the main loop when present.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // Wet asphalt: dark, smooth, a little metallic — the water film
  // turns the road into a dim mirror. At sunset it is wetter (lower
  // roughness, stronger sheen); by day it is only damp.
  // v7.5 rev 2: the first render's road was nearly black — the wet
  // sheen never showed because the base colour was too dark to catch
  // any light. Lifted a touch (0x1e2126 -> 0x2a2e35) and the sunset
  // roughness down (0.32 -> 0.26), so the low sun smears across it.
  PH.wetAsphalt = function (sunset) {
    return new THREE.MeshStandardMaterial({
      color: 0x2a2e35, roughness: sunset ? 0.26 : 0.5, metalness: 0.35
    });
  };

  // One ribbon's texture, cached per colour: bright at the source end
  // (top of the canvas), fading to nothing at the far end, with soft
  // side edges — a reflection stretched by ripples into a vertical
  // band, never a hard rectangle. The canvas is drawn once per colour
  // and shared by every ribbon of that colour.
  var ribbonCache = {};
  function ribbonTexture(color) {
    if (ribbonCache[color]) return ribbonCache[color];
    var tex = PH.canvasTex(64, 256, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // ripples: the band wavers and breaks as it stretches, so it
      // reads as water, not as a painted line
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (var i = 0; i < 14; i++) {
        var y = 20 + PH.R() * (h - 40);
        g.fillRect(8 + PH.R() * 20, y, 12 + PH.R() * 24, 2 + PH.R() * 3);
      }
      var side = g.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, 'rgba(0,0,0,1)');
      side.addColorStop(0.3, 'rgba(0,0,0,0)');
      side.addColorStop(0.7, 'rgba(0,0,0,0)');
      side.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = side; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
    ribbonCache[color] = tex;
    return tex;
  }

  // The ribbons live here, with their base opacity, so the per-frame
  // camera-height update can find them again.
  PH._wetStreaks = [];

  // Lay reflection ribbons on the road. Each ribbon lies flat (y 0.12,
  // just above the asphalt), runs along Z — the boulevard axis, toward
  // and away from the cameras that look down the street — and is
  // brightest at its source end. `spots` is a list of:
  //   { x, z, color, len, w, bright }
  // `color` is the light's colour; the ribbon is tinted with it but
  // kept darker than the source (base opacity 0.5 at most, so the
  // reflection never outshines the lamp it comes from).
  PH.layWetReflections = function (scene, spots) {
    var group = new THREE.Group();
    spots.forEach(function (s) {
      var len = s.len || 8;
      var w = s.w || 0.7;
      // the ribbon's texture fades along its length; the plane is
      // built with its bright end at local +Y, then laid flat with
      // the bright end under the light source
      var mat = new THREE.MeshBasicMaterial({
        map: ribbonTexture(s.color), color: s.color,
        transparent: true, opacity: (s.bright || 0.5),
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var rib = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
      rib.rotation.x = -Math.PI / 2;
      rib.rotation.z = Math.PI; // bright end toward -Z (the light)
      rib.position.set(s.x, 0.12, s.z - len / 2);
      group.add(rib);
      // v7.5: keep the spot's ground position and length with the
      // ribbon, so orientWetReflections can flip it toward the camera
      // (a reflection always runs from its light toward the viewer).
      PH._wetStreaks.push({ mesh: rib, base: s.bright || 0.5, x: s.x, z: s.z, len: len });
    });
    scene.add(group);
    return group;
  };

  // v7.5: point every ribbon toward the camera. A wet-road reflection
  // is a mirror image of its light, so on the ground it runs from the
  // light toward the viewer's feet — the ribbon's bright end stays
  // pinned under its light and the body flips to whichever side of
  // the light the camera stands on. Flipping is a position change
  // plus a rotation.z change: with rotation.z = PI the bright end
  // sits at the +Z edge (ribbon runs north), with rotation.z = 0 at
  // the -Z edge (ribbon runs south). Called every frame from main.js,
  // so it stays right as the chase camera swings round.
  PH.orientWetReflections = function (camX, camZ) {
    PH._wetStreaks.forEach(function (s) {
      if (s.fixed) return; // full-street bands (curb sheen) never flip
      if ((camZ || 0) >= s.z) {
        s.mesh.rotation.z = 0;
        s.mesh.position.z = s.z + s.len / 2;
      } else {
        s.mesh.rotation.z = Math.PI;
        s.mesh.position.z = s.z - s.len / 2;
      }
    });
  };

  // Mirror strength follows the camera: at street level (y ~3) the
  // ribbons are at their strongest; from a high chase camera (y ~4.2)
  // they soften; from the heli's height they nearly vanish. The
  // reflection is always darker than its source, so the factor never
  // pushes a ribbon past its base opacity.
  PH.updateWetReflections = function (camY) {
    var f = PH.clamp(1.15 - (camY || 3) * 0.09, 0.3, 0.9);
    PH._wetStreaks.forEach(function (s) {
      s.mesh.material.opacity = s.base * f;
    });
  };

  // The static spots world.js lays: street lamps along both sidewalks
  // (warm), traffic lights (red / green at the crossings), and the
  // neon shop signs on the east row (pink, cyan, gold). Lamps outside
  // the central stretch are skipped — their ribbons would fall outside
  // every shot's frame anyway.
  PH.wetRoadSpots = function () {
    var spots = [];
    for (var lz = -90; lz <= 120; lz += 30) {
      spots.push({ x: -29.5, z: lz, color: 0xffc860, len: 7, w: 0.6, bright: 0.45 });
      spots.push({ x: -10.5, z: lz, color: 0xffc860, len: 7, w: 0.6, bright: 0.45 });
    }
    // traffic lights at the four crossings: the red lamp's ribbon is
    // the one the eye catches first at dusk
    [[-26.5, -41], [-26.5, -1], [-26.5, 39], [-26.5, 79]].forEach(function (p) {
      spots.push({ x: p[0], z: p[1], color: 0xff2a20, len: 9, w: 0.8, bright: 0.55 });
      spots.push({ x: -13.5, z: p[1] + 4, color: 0x2aff5a, len: 9, w: 0.8, bright: 0.4 });
    });
    // neon shop signs on the east row: their glow spills onto the road
    // in front of the shops
    spots.push({ x: -12, z: -70, color: 0xff6ab0, len: 8, w: 1.0, bright: 0.5 });
    spots.push({ x: -12, z: -30, color: 0x2a9df4, len: 8, w: 1.0, bright: 0.5 });
    spots.push({ x: -12, z: 10, color: 0xffc832, len: 8, w: 1.0, bright: 0.5 });
    return spots;
  };

  // One car's tail-light ribbon, for the staged shots: a long red band
  // stretching back from the car's stern toward the camera, the way a
  // tail light smears on wet asphalt. main.js calls this with the
  // hero's and the cruisers' stern positions.
  // v7.5 rev 2: wider (0.9 -> 1.2) and brighter (0.55 -> 0.65) — the
  // first render's streaks were too thin to read at shot distance.
  // v7.5 rev 3: wider still (1.2 -> 1.5), longer (8 -> 10) and
  // brighter (0.65 -> 0.75) — the second render's streaks were still
  // a whisper on the dark road; a tail light's smear is the thing the
  // eye catches first on wet asphalt at dusk.
  PH.carWetStreak = function (scene, x, z, color) {
    return PH.layWetReflections(scene, [
      { x: x, z: z, color: color || 0xff2010, len: 10, w: 1.5, bright: 0.75 }
    ]);
  };

  // Curb sheen: where the road meets the sidewalk the water is
  // deepest and the kerb itself is wet, so a long faint band of
  // reflected sky runs along each kerb the whole length of the street.
  // It is the road's own glow, not a lamp's — warm gold at sunset,
  // pale blue by day — and it is what makes the street read as wet
  // from a distance, before any single ribbon resolves.
  PH.layCurbSheen = function (scene, sunset) {
    var tex = PH.canvasTex(64, 256, function (g, w, h) {
      // a soft band: strong in the middle, fading at both ends, so
      // the sheen never starts or stops with a hard edge
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.25, sunset ? 'rgba(255,180,100,0.5)' : 'rgba(180,205,230,0.4)');
      grad.addColorStop(0.75, sunset ? 'rgba(255,180,100,0.5)' : 'rgba(180,205,230,0.4)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
    var group = new THREE.Group();
    [-27, -13].forEach(function (x) {
      var mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var band = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 300), mat);
      band.rotation.x = -Math.PI / 2;
      band.position.set(x, 0.1, 0);
      group.add(band);
      // the band runs the whole street, so it never flips toward the
      // camera (fixed: true) — but it still fades with camera height
      // through updateWetReflections, like every other streak.
      PH._wetStreaks.push({ mesh: band, base: 0.35, x: x, z: 0, len: 300, fixed: true });
    });
    scene.add(group);
    return group;
  };

  // Puddles: where the road dips, the water pools deeper and the mirror
  // turns perfect — an elliptical patch that reflects the sky itself
  // (pale blue-grey by day, warm gold at sunset), not a lamp. A few
  // puddles along the kerb and one mid-lane, so the road has mirrors
  // even where no light stands. world.js lays them with the road.
  PH.layPuddles = function (scene, sunset) {
    var tex = PH.canvasTex(128, 128, function (g, w, h) {
      // an ellipse of sky: bright centre fading to nothing at the rim,
      // with a couple of ripple rings breaking the perfect mirror
      var cx = w / 2, cy = h / 2;
      var grad = g.createRadialGradient(cx, cy, 4, cx, cy, 60);
      if (sunset) {
        grad.addColorStop(0, 'rgba(255,190,110,0.75)');
        grad.addColorStop(0.6, 'rgba(255,160,90,0.45)');
        grad.addColorStop(1, 'rgba(255,160,90,0)');
      } else {
        grad.addColorStop(0, 'rgba(190,215,235,0.7)');
        grad.addColorStop(0.6, 'rgba(160,190,215,0.4)');
        grad.addColorStop(1, 'rgba(160,190,215,0)');
      }
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(cx, cy, 60, 44, 0, 0, Math.PI * 2); g.fill();
      // ripple rings: two thin arcs across the puddle
      g.strokeStyle = sunset ? 'rgba(255,220,170,0.4)' : 'rgba(255,255,255,0.4)';
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, cy, 38, 26, 0, 0.4, 2.2); g.stroke();
      g.beginPath(); g.ellipse(cx, cy, 52, 36, 0, 3.6, 5.2); g.stroke();
    });
    var mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.85, depthWrite: false
    });
    var group = new THREE.Group();
    // puddle spots: along the kerbs where water gathers, and one
    // mid-lane where the road dips at the crossing
    [[-25.5, -60, 3.2], [-14.5, -20, 2.4], [-25.5, 18, 2.8], [-14.5, 60, 3.4],
     [-20, 0, 2.0], [-25.5, 100, 2.6]].forEach(function (p) {
      var pud = new THREE.Mesh(new THREE.PlaneGeometry(p[2] * 2, p[2] * 1.4), mat);
      pud.rotation.x = -Math.PI / 2;
      pud.rotation.z = PH.rand(0, 3);
      pud.position.set(p[0], 0.11, p[1]);
      group.add(pud);
    });
    scene.add(group);
    return group;
  };
})();
