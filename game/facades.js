// PIER HEAT — Sunset Bay v7.5
// facades.js — glass that reflects the sky, built from how reflections
// work (how-it-works-v75.md §4 + real-refs-v75.md §6).
//
// WHY IT LOOKS THIS WAY: a glass pane is a mirror, not a painted
// rectangle. What you see in it is the SKY — so a pane facing the low
// sun catches warm gold, a pane facing away catches cool blue, and a
// pane that catches a cloud shows white. No two panes catch the same
// patch of sky, so no two panes share one colour: some are sky-blue,
// some are cloud-white, some are sunset-gold. A reflection is always
// DARKER than the thing it reflects (glass only returns part of the
// light), and it is broken by the mullion grid — the thin dark frame
// bars that divide a real window into panes. The side of a building
// that faces away from the sun goes navy-dark, and the base of every
// building sits in a dark contact shadow where the wall meets the
// pavement.
//
// WHAT THIS FILE BUILDS, and how world.js uses it:
//   PH.facadeGlassSet(sunset) — three warm + three cool reflective
//     pane materials, each with its own sky/cloud reflection and a
//     mullion grid drawn into the texture. world.js's paneMaterials()
//     uses them for its skyWarm / skyCool panes (picked per pane, so
//     neighbours differ), falling back to its own flat materials when
//     this file is absent.
//   PH.storefrontGlassMaterial(sunset) — the big ground-floor glass:
//     a stronger sky reflection with a diagonal sun streak, for the
//     storefront and lobby glass world.js builds.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // One reflective pane texture. `warm` panes face the low sun (gold +
  // orange sky, white cloud blobs); `cool` panes face away (blue sky,
  // pale cloud). `seed` varies the cloud blobs and the warmth so panes
  // differ. The mullion grid (thin dark bars) is drawn into the texture
  // itself, so every pane carries its own frame lines.
  function paneTexture(warm, sunset, seed) {
    return PH.canvasTex(128, 128, function (g, w, h) {
      var r = PH.mulberry32(seed);
      // the sky the pane reflects: a vertical gradient, warm gold near
      // the sun side, cooling to blue-grey away from it. Reflections
      // are always darker than the sky itself, so the gradient is
      // muted, never as bright as the real sky.
      var grad = g.createLinearGradient(0, 0, w, h);
      if (warm) {
        grad.addColorStop(0, '#d8a050');
        grad.addColorStop(0.45, '#a87848');
        grad.addColorStop(1, '#4a3448');
      } else {
        grad.addColorStop(0, '#7a9ab8');
        grad.addColorStop(0.5, '#54749a');
        grad.addColorStop(1, '#22304a');
      }
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // cloud blobs caught in the glass: soft white puffs, placed by
      // the seed so each pane catches a different patch of cloud.
      // v7.5 rev 2: bigger and brighter — the first version's small
      // pale blobs vanished under the sun's specular wash.
      for (var i = 0; i < 4; i++) {
        var cx = 14 + r() * (w - 28);
        var cy = 14 + r() * (h - 28);
        var cr = 14 + r() * 22;
        var blob = g.createRadialGradient(cx, cy, 1, cx, cy, cr);
        blob.addColorStop(0, warm ? 'rgba(255,240,210,0.9)' : 'rgba(255,255,255,0.95)');
        blob.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = blob;
        g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
      }
      // the sun's own glint on the glass: a bright diagonal streak on
      // warm panes, a pale sky-line on cool ones
      if (warm && sunset) {
        var glint = g.createLinearGradient(0, h, w, 0);
        glint.addColorStop(0, 'rgba(255,220,140,0)');
        glint.addColorStop(0.5, 'rgba(255,225,160,0.7)');
        glint.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = glint;
        g.fillRect(0, 0, w, h);
      } else {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(0, 0, w, 8);
      }
      // mullion grid: thin dark bars dividing the pane, the frame that
      // makes a window read as a window instead of a coloured tile.
      // v7.5 rev 2: thicker (6px) — the first version's 4px bars were
      // invisible at street distance, so the panes read as flat tiles.
      g.fillStyle = 'rgba(16,20,28,0.95)';
      g.fillRect(w / 2 - 3, 0, 6, h);
      g.fillRect(0, h / 2 - 3, w, 6);
      g.strokeStyle = 'rgba(16,20,28,0.95)';
      g.lineWidth = 6;
      g.strokeRect(2, 2, w - 4, h - 4);
    });
  }

  // A neon-reflection pane: dark glass with a bright pink or cyan
  // streak — the shop signs' glow caught in a window at dusk. A few
  // panes like this in a facade tell the eye the street has neon, even
  // where no sign mesh is visible.
  function neonTexture(color, seed) {
    return PH.canvasTex(128, 128, function (g, w, h) {
      var r = PH.mulberry32(seed);
      var grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#2a3040');
      grad.addColorStop(0.5, '#1c2230');
      grad.addColorStop(1, '#12161f');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // the neon streak: a bright diagonal band, soft-edged, with a
      // hot core — the sign's reflection smeared by the glass
      var streak = g.createLinearGradient(0, h, w, 0);
      streak.addColorStop(0, 'rgba(0,0,0,0)');
      streak.addColorStop(0.45, color + '55');
      streak.addColorStop(0.5, color + 'cc');
      streak.addColorStop(0.55, color + '55');
      streak.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = streak;
      g.fillRect(0, 0, w, h);
      // a second, fainter streak crossing it (the sign's other tube)
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, 20 + r() * 40, w, 5);
      // mullion grid, same as the plain panes
      g.fillStyle = 'rgba(16,20,28,0.95)';
      g.fillRect(w / 2 - 3, 0, 6, h);
      g.fillRect(0, h / 2 - 3, w, 6);
      g.strokeStyle = 'rgba(16,20,28,0.95)';
      g.lineWidth = 6;
      g.strokeRect(2, 2, w - 4, h - 4);
    });
  }

  // A set of six reflective pane materials: three warm, three cool, each
  // with its own cloud placement. world.js picks one per pane by roll,
  // so a facade's windows vary the way real reflections vary.
  // v7.5 rev 2: metalness down (0.55 -> 0.35) and roughness up
  // (0.12 -> 0.25) — the first version mirrored the bright sky so hard
  // the painted reflection washed white at noon. Plus two neon panes.
  PH.facadeGlassSet = function (sunset) {
    var warm = [], cool = [], neon = [];
    for (var i = 0; i < 3; i++) {
      warm.push(new THREE.MeshStandardMaterial({
        map: paneTexture(true, sunset, 100 + i * 17), roughness: 0.25, metalness: 0.35
      }));
      cool.push(new THREE.MeshStandardMaterial({
        map: paneTexture(false, sunset, 200 + i * 23), roughness: 0.25, metalness: 0.35
      }));
    }
    neon.push(new THREE.MeshStandardMaterial({
      map: neonTexture('#ff4aa8', 301), roughness: 0.2, metalness: 0.4,
      emissive: 0xff4aa8, emissiveIntensity: 0.15
    }));
    neon.push(new THREE.MeshStandardMaterial({
      map: neonTexture('#2ac8f4', 317), roughness: 0.2, metalness: 0.4,
      emissive: 0x2ac8f4, emissiveIntensity: 0.15
    }));
    return { warm: warm, cool: cool, neon: neon };
  };

  // The big ground-floor glass: one wide reflection with a strong
  // diagonal sun streak and a brighter sky band at the top, so a
  // shopfront reads as a sheet of sky at street level. The streak is
  // the low sun itself, smeared across the glass by its angle.
  // v7.5 rev 2: the day gradient is deeper — the first version's pale
  // top (#cfe0f0) washed white under the noon sun, same as the panes.
  PH.storefrontGlassMaterial = function (sunset) {
    var tex = PH.canvasTex(256, 128, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, w, h);
      if (sunset) {
        grad.addColorStop(0, '#ffd9a0');
        grad.addColorStop(0.4, '#d89a62');
        grad.addColorStop(1, '#4a3a5e');
      } else {
        grad.addColorStop(0, '#a8bdd8');
        grad.addColorStop(0.5, '#6a88a8');
        grad.addColorStop(1, '#2e3a50');
      }
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      // two cloud blobs, low in the glass
      var r = PH.mulberry32(77);
      for (var i = 0; i < 2; i++) {
        var cx = 30 + r() * (w - 60);
        var cy = 30 + r() * (h - 50);
        var cr = 18 + r() * 22;
        var blob = g.createRadialGradient(cx, cy, 1, cx, cy, cr);
        blob.addColorStop(0, 'rgba(255,255,255,0.85)');
        blob.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = blob;
        g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
      }
      // the sun streak: a bright diagonal band across the whole pane
      var streak = g.createLinearGradient(0, h, w, 0);
      streak.addColorStop(0, 'rgba(255,225,150,0)');
      streak.addColorStop(0.5, sunset ? 'rgba(255,225,150,0.75)' : 'rgba(255,255,255,0.4)');
      streak.addColorStop(1, 'rgba(255,225,150,0)');
      g.fillStyle = streak;
      g.fillRect(0, 0, w, h);
      // divider posts' shadows: thin vertical dark lines, so the wide
      // glass still reads as divided shopfront panes
      g.fillStyle = 'rgba(20,24,32,0.85)';
      for (var x = w / 4; x < w; x += w / 4) g.fillRect(x - 2, 0, 4, h);
    });
    return new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.2, metalness: 0.35,
      transparent: true, opacity: 0.92
    });
  };

  // Dark building base: where a wall meets the pavement it sits in
  // contact shadow — a dark band that grounds the facade instead of
  // letting the wall float on the sidewalk. Returns a group of four
  // gradient planes (one per side) that world.js's addGroundFloor
  // hangs around the building's foot.
  PH.facadeBaseAO = function (w, d) {
    var tex = PH.canvasTex(128, 32, function (g, cw, ch) {
      var grad = g.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, 'rgba(10,12,16,0)');
      grad.addColorStop(1, 'rgba(10,12,16,0.85)');
      g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
    });
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    var group = new THREE.Group();
    function side(sw, x, z, ry) {
      var p = new THREE.Mesh(new THREE.PlaneGeometry(sw, 0.9), mat);
      p.position.set(x, 0.45, z);
      p.rotation.y = ry;
      group.add(p);
    }
    side(w, 0, d / 2 + 0.03, 0);
    side(w, 0, -d / 2 - 0.03, Math.PI);
    side(d, w / 2 + 0.03, 0, Math.PI / 2);
    side(d, -w / 2 - 0.03, 0, -Math.PI / 2);
    return group;
  };
})();
