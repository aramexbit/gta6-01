// PIER HEAT — Sunset Bay v7.3
// core.js — shared foundation: seeded RNG, canvas textures, HUD setters
// and the 2D round minimap painter. All characters, boats and portraits
// are procedural (code primitives + canvas); no model files are loaded.
// Plain script (no modules). Everything lives on window.PH.
(function () {
  'use strict';
  var PH = window.PH = window.PH || {};
  PH.VERSION = '7.3';
  PH.GAME = 'PIER HEAT — Sunset Bay';

  // ---------- seeded random (mulberry32) ----------
  PH.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  PH.R = PH.mulberry32(1);
  PH.seed = function (s) { PH.R = PH.mulberry32(s >>> 0 || 1); };
  PH.rand = function (a, b) { return a + PH.R() * (b - a); };
  PH.randInt = function (a, b) { return Math.floor(PH.rand(a, b + 1)); };
  PH.pick = function (arr) { return arr[Math.floor(PH.R() * arr.length)]; };
  PH.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  PH.lerp = function (a, b, t) { return a + (b - a) * t; };

  // ---------- canvas textures ----------
  PH.canvasTex = function (w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  };

  // Shop sign: bold text on a coloured board with a frame.
  PH.signTexture = function (text, bg, fg) {
    return PH.canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 10;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = fg || '#ffffff';
      g.font = '900 62px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
      var label = text.length > 14 ? text : text;
      var size = text.length > 12 ? 44 : (text.length > 8 ? 54 : 62);
      g.font = '900 ' + size + 'px Arial, sans-serif';
      g.fillText(label, w / 2, h / 2 + 2);
    });
  };

  // Licence plate.
  PH.plateTexture = function (text) {
    return PH.canvasTex(256, 64, function (g, w, h) {
      g.fillStyle = '#f4f1e4'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#1a2a44'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#1a2a44';
      g.font = '900 34px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 1);
    });
  };

  // Soft radial glow (muzzle flash star / light halo).
  PH.glowTexture = function () {
    return PH.canvasTex(128, 128, function (g, w, h) {
      var r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      r.addColorStop(0, 'rgba(255,255,240,1)');
      r.addColorStop(0.18, 'rgba(255,210,100,0.95)');
      r.addColorStop(0.45, 'rgba(255,150,50,0.35)');
      r.addColorStop(1, 'rgba(255,140,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
      // short star spikes (a muzzle flash, not a sun)
      g.fillStyle = 'rgba(255,240,180,0.95)';
      g.beginPath();
      g.moveTo(64, 34); g.lineTo(68, 60); g.lineTo(94, 64); g.lineTo(68, 68);
      g.lineTo(64, 94); g.lineTo(60, 68); g.lineTo(34, 64); g.lineTo(60, 60);
      g.closePath(); g.fill();
    });
  };

  // Sun disc with halo.
  PH.sunTexture = function () {
    return PH.canvasTex(256, 256, function (g, w, h) {
      var r = g.createRadialGradient(128, 128, 4, 128, 128, 126);
      r.addColorStop(0, 'rgba(255,250,220,1)');
      r.addColorStop(0.28, 'rgba(255,214,120,0.95)');
      r.addColorStop(0.55, 'rgba(255,150,60,0.45)');
      r.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
  };

  // Speckled sand.
  PH.sandTexture = function () {
    return PH.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#e3c98f'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var s = PH.R();
        g.fillStyle = s < 0.5 ? 'rgba(190,150,90,0.5)' : 'rgba(255,235,190,0.5)';
        g.fillRect(PH.R() * w, PH.R() * h, 2 + PH.R() * 3, 2 + PH.R() * 2);
      }
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (var j = 0; j < 24; j++) g.fillRect(PH.R() * w, PH.R() * h, 20 + PH.R() * 40, 2);
    });
  };

  // ---------- v7.3: no external models ----------
  // v7.2 loaded a GLB character file; v7.3 builds Mateo and Kira from
  // code primitives in mateo.js instead, so there is no model loader
  // left in the game at all. Anything that asks for a model file gets
  // this explicit refusal instead of a silent fallback.
  PH.loadGLB = null;
  PH.NO_MODEL_FILES = true;

  // v7.3: the binary model builder was removed with the GLB file.
  // Characters are assembled from primitives in mateo.js; nothing in
  // the game parses model containers any more.
  function buildGLTF(json, bin) {
    throw new Error('v7.3: model files are gone — see mateo.js');
  }

  // (rest of the old model builder deleted in v7.3 — see mateo.js)

  // (end of deleted model builder)

  // ---------- retint (v7.3, procedural) ----------
  // Recolour a procedural character by part tag: mateo.js marks the
  // jacket shell, tee panel and hair cap with userData.part, so a tint
  // map like { jacket: 0x0e7a7a } recolours the same rig into Kira.
  PH.retint = function (root, map) {
    if (!root || !map) return;
    root.traverse(function (o) {
      if (!o.isMesh || !o.userData.part) return;
      var col = map[o.userData.part];
      if (col == null) return;
      if (Array.isArray(o.material)) {
        o.material.forEach(function (m) { m.color = new THREE.Color(col); });
      } else if (o.material) {
        o.material.color = new THREE.Color(col);
      }
    });
  };

  // ---------- HUD setters ----------
  function el(id) { return document.getElementById(id); }
  function setText(id, v) { var n = el(id); if (n) n.textContent = v; }
  function setBar(id, pct) { var n = el(id); if (n) n.style.width = PH.clamp(pct, 0, 100) + '%'; }

  PH.hud = {
    setObjective: function (o) {
      if (!o) return;
      setText('obj-title', o.title || '');
      setText('obj-stage', o.stage || '');
      setBar('obj-bar', o.progress != null ? o.progress : 0);
      setText('obj-timer', o.timer || '');
      setText('obj-text', o.text || '');
      setText('obj-next', o.next || '');
    },
    setWanted: function (n) {
      var stars = el('stars'); if (!stars) return;
      var kids = stars.children;
      for (var i = 0; i < kids.length; i++) {
        kids[i].classList.toggle('lit', i < n);
      }
      var w = el('wanted-panel');
      if (w) w.classList.toggle('hot', n >= 3);
    },
    setMoney: function (v) { setText('money', '$' + v.toLocaleString('en-US')); },
    setHealth: function (v) { setBar('health-bar', v); setText('health-num', Math.round(v)); },
    setArmor: function (v) { setBar('armor-bar', v); setText('armor-num', Math.round(v)); },
    setAmmo: function (cur, max) { setText('ammo-pistol', cur + '/' + max); },
    setSpeed: function (kmh) { setText('speed-num', Math.round(kmh)); },
    setCar: function (s) { setText('car-status', s); },
    setRadio: function (s) { setText('radio-text', s); },
    setDispatch: function (rows) {
      var box = el('dispatch-rows'); if (!box) return;
      var panel = el('dispatch-panel');
      if (!rows || !rows.length) { if (panel) panel.style.display = 'none'; box.innerHTML = ''; return; }
      if (panel) panel.style.display = 'block';
      box.innerHTML = rows.map(function (r) {
        return '<div class="drow"><span class="chip">' + r.tactic + '</span>' +
          '<span class="dunit">' + r.unit + '</span>' +
          '<span class="drole">' + r.role + '</span>' +
          '<span class="ddist">' + r.dist + 'm</span></div>';
      }).join('');
    },
    setWeapon: function (active) {
      var slots = document.querySelectorAll('.wslot');
      slots.forEach(function (s) {
        s.classList.toggle('active', s.getAttribute('data-slot') === active);
      });
    },
    setDialog: function (who, name, text) {
      var d = el('dialog'); if (!d) return;
      if (!text) { d.style.display = 'none'; return; }
      d.style.display = 'flex';
      var p = el('dialog-portrait');
      if (p) {
        // v7.3: real canvas portrait, not a letter tile
        if (PH.paintPortrait) PH.paintPortrait(p, who === 'kira' ? 'kira' : 'mateo');
        p.className = 'portrait ' + who;
      }
      setText('dialog-name', name);
      setText('dialog-text', text);
    },
    setCrew: function (who, status) {
      var n = el('crew-status-' + who); if (n) n.textContent = status;
    },
    setRace: function (pos, total, lap, laps, countdown) {
      var n = el('race-pos'); if (n) n.textContent = 'P' + pos + '/' + total;
      var l = el('race-lap'); if (l) l.textContent = 'LAP ' + lap + '/' + laps;
      var c = el('race-countdown');
      if (c) {
        if (countdown != null && countdown > 0) { c.style.display = 'block'; c.textContent = countdown; }
        else if (countdown === 0) { c.style.display = 'block'; c.textContent = 'GO!'; }
        else c.style.display = 'none';
      }
      var rp = el('race-panel'); if (rp) rp.style.display = pos ? 'block' : 'none';
    },
    setBoat: function (speedKmh, dist) {
      var bp = el('boat-panel'); if (bp) bp.style.display = 'block';
      setText('boat-speed', Math.round(speedKmh) + ' KN');
      setText('boat-dist', dist != null ? dist + 'm TO PIER' : '');
    },
    setCarName: function (name, cond) {
      setText('car-name', name);
      setText('car-cond', cond != null ? Math.round(cond) + '%' : '');
      setBar('car-cond-bar', cond != null ? cond : 0);
    },
    toast: function (msg) {
      var t = el('toast'); if (!t) return;
      t.textContent = msg; t.style.opacity = '1';
      clearTimeout(t._tm);
      t._tm = setTimeout(function () { t.style.opacity = '0'; }, 2600);
    }
  };

  // ---------- minimap (round 2D street map, v7.3) ----------
  // Drawn from the same world layout that builds the 3D city (roads,
  // blocks, sea, sand, pier) — never a screenshot. The static layer
  // (water / blocks / roads) is pre-rendered once to an offscreen
  // canvas; each frame only blits it and draws the moving markers.
  // Draw order is deliberate: police dots and the player arrow go down
  // FIRST, labels go on TOP, so a dot can never cover the map label.
  PH._mapBase = null;
  PH._mapBaseSize = 0;
  PH._buildMapBase = function (size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var g = c.getContext('2d');
    var cx = size / 2, cy = size / 2, R = size / 2 - 4;
    var x0 = -110, x1 = 120, z0 = -130, z1 = 130;
    function mx(x) { return cx + ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) * R; }
    function mz(z) { return cy + ((z - (z0 + z1) / 2) / ((z1 - z0) / 2)) * R; }
    g.fillStyle = '#101826'; g.fillRect(0, 0, size, size);
    // sea (west) + sand strip + beach line
    g.fillStyle = '#123a5c'; g.fillRect(0, 0, mx(-102), size);
    g.fillStyle = '#c9a86a'; g.fillRect(mx(-102), 0, mx(-28) - mx(-102), size);
    g.fillStyle = '#e8d5a0'; g.fillRect(mx(-102), 0, 2, size);
    // city blocks (40-unit grid)
    g.fillStyle = '#232f45';
    for (var gx = -20; gx <= 160; gx += 40) {
      for (var gz = -160; gz <= 120; gz += 40) {
        g.fillRect(mx(gx), mz(gz), mx(gx + 32) - mx(gx), mz(gz + 32) - mz(gz));
      }
    }
    // downtown landmark blocks, slightly taller tone
    g.fillStyle = '#2c3a55';
    [[66, -100], [106, 60], [26, 110]].forEach(function (p) {
      g.fillRect(mx(p[0] - 10), mz(p[1] - 10), mx(p[0] + 10) - mx(p[0] - 10), mz(p[1] + 10) - mz(p[1] - 10));
    });
    // roads: dark casing, then bright core, then centre dashes
    function road(xa, za, xb, zb, wdt) {
      g.strokeStyle = '#05070c'; g.lineWidth = wdt + 3;
      g.beginPath(); g.moveTo(mx(xa), mz(za)); g.lineTo(mx(xb), mz(zb)); g.stroke();
      g.strokeStyle = '#8fa3bd'; g.lineWidth = wdt;
      g.beginPath(); g.moveTo(mx(xa), mz(za)); g.lineTo(mx(xb), mz(zb)); g.stroke();
    }
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) { road(-9, z, 170, z, 3); });
    road(-20, -170, -20, 170, 4);
    g.strokeStyle = '#e8c832'; g.lineWidth = 1.4; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(mx(-20), mz(-170)); g.lineTo(mx(-20), mz(170)); g.stroke();
    g.setLineDash([]);
    // pier deck + bait shack dot
    g.fillStyle = '#8a6a42';
    g.fillRect(mx(-88), mz(35.5), mx(-28) - mx(-88), mz(44.5) - mz(35.5));
    g.fillStyle = '#b02020';
    g.fillRect(mx(-42), mz(38), mx(-38) - mx(-42), mz(42) - mz(38));
    // race loop (thin amber trace) so the race route reads on the map
    g.strokeStyle = 'rgba(255,210,60,0.55)'; g.lineWidth = 2; g.setLineDash([4, 4]);
    g.beginPath();
    PH.RACE_LOOP.forEach(function (pt, i) {
      if (i === 0) g.moveTo(mx(pt.x), mz(pt.z)); else g.lineTo(mx(pt.x), mz(pt.z));
    });
    g.closePath(); g.stroke(); g.setLineDash([]);
    return c;
  };
  PH.drawMinimap = function (canvas, st) {
    if (!canvas) return;
    var g = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2, R = W / 2 - 4;
    var x0 = -110, x1 = 120, z0 = -130, z1 = 130;
    function mx(x) { return cx + ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) * R; }
    function mz(z) { return cy + ((z - (z0 + z1) / 2) / ((z1 - z0) / 2)) * R; }
    if (!PH._mapBase || PH._mapBaseSize !== W) {
      PH._mapBase = PH._buildMapBase(W);
      PH._mapBaseSize = W;
    }
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.drawImage(PH._mapBase, 0, 0);
    // --- moving markers, UNDER the labels ---
    // police boats on the water (white hull dots with blue ring)
    if (st && st.boats) {
      st.boats.forEach(function (b) {
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(mx(b.x), mz(b.z), 4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#2040ff'; g.lineWidth = 1.5; g.stroke();
      });
    }
    // police dots (blue, flashing red when wanted)
    if (st && st.police) {
      st.police.forEach(function (p, i) {
        var blink = st.wanted > 0 && (Math.floor((st.time || 0) * 2 + i) % 2 === 0);
        g.fillStyle = blink ? '#ff3b30' : '#3b82f6';
        g.beginPath(); g.arc(mx(p.x), mz(p.z), 4.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
      });
    }
    // next race gate (amber square) + rival cars (small red triangles)
    if (st && st.raceGate) {
      g.fillStyle = '#ffb030';
      var rx = mx(st.raceGate.x), ry = mz(st.raceGate.z);
      g.fillRect(rx - 5, ry - 5, 10, 10);
      g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.strokeRect(rx - 5, ry - 5, 10, 10);
    }
    if (st && st.rivals) {
      st.rivals.forEach(function (r) {
        g.fillStyle = '#ff5a4a';
        g.beginPath(); g.arc(mx(r.x), mz(r.z), 3.5, 0, Math.PI * 2); g.fill();
      });
    }
    // objective diamond + pulsing ring
    if (st && st.objective) {
      var ox = mx(st.objective.x), oy = mz(st.objective.z);
      var pulse = 1 + 0.25 * Math.sin((st.time || 0) * 3);
      g.strokeStyle = 'rgba(255,210,60,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, 11 * pulse, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#ffd23c';
      g.beginPath();
      g.moveTo(ox, oy - 9); g.lineTo(ox + 9, oy); g.lineTo(ox, oy + 9); g.lineTo(ox - 9, oy);
      g.closePath(); g.fill();
      g.strokeStyle = '#7a5b00'; g.lineWidth = 1.5; g.stroke();
    }
    // player arrow (big orange, white frame, rotates with heading)
    if (st && st.player) {
      var px = mx(st.player.x), py = mz(st.player.z);
      var hd = st.player.heading || 0;
      g.save();
      g.translate(px, py); g.rotate(hd);
      g.fillStyle = '#ff7a1a';
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8);
      g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
    // ring border
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // --- labels LAST, on top of every dot ---
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath();
    g.moveTo(cx, 12); g.lineTo(cx + 5, 22); g.lineTo(cx - 5, 22); g.closePath(); g.fill();
    g.fillText('N', cx, 30);
    // label plate: dark chip behind the text so dots can never hide it
    var label = 'SUNSET BAY';
    g.font = 'bold 11px Arial';
    var tw = g.measureText(label).width + 12;
    g.fillStyle = 'rgba(8,12,22,0.8)';
    g.fillRect(cx - tw / 2, H - 22, tw, 16);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillText(label, cx, H - 14);
  };
})();
