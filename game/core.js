// PIER HEAT — Sunset Bay v8.0: shared core. Renderer, lights, colliders, HUD helpers, minimap.
// PERF FOUNDATIONS (locked from the first line): render buffer fixed at 1280x720, pixel ratio 1,
// preserveDrawingBuffer off, high-performance preference. No full-scene sweep ever: collision
// comes only from the collider registry + spatial grid built at world-build time.
(function () {
  'use strict';
  var PH = window.PH = window.PH || {};
  PH.VERSION = '8.0';
  PH.GAME_TITLE = 'PIER HEAT — Sunset Bay';

  // ---------- tiny utils ----------
  PH.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  PH.lerp = function (a, b, t) { return a + (b - a) * t; };
  PH.rand = function (a, b) { return a + Math.random() * (b - a); };
  PH.randi = function (a, b) { return Math.floor(PH.rand(a, b + 1)); };
  PH.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  PH.angleWrap = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  PH.angleLerp = function (a, b, t) { return a + PH.angleWrap(b - a) * t; };
  PH.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  };
  PH.fmtRaceTime = function (s) {
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  };
  PH.dist2d = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };

  // ---------- tiny event bus ----------
  PH.events = {
    _l: {},
    on: function (ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
    emit: function (ev, data) {
      var list = this._l[ev] || [], i;
      for (i = 0; i < list.length; i++) { try { list[i](data); } catch (e) { console.error(e); } }
    }
  };

  // ---------- renderer: LOCKED low resolution from the first line ----------
  PH.RENDER_W = 1280;
  PH.RENDER_H = 720;
  var canvas = document.getElementById('game');
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance'
  });
  renderer.setSize(PH.RENDER_W, PH.RENDER_H, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if ('outputEncoding' in renderer && THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  PH.renderer = renderer;

  PH.scene = new THREE.Scene();
  PH.scene.background = new THREE.Color(0xff9e5e);
  PH.scene.fog = new THREE.Fog(0xffb27a, 120, 420);
  PH.camera = new THREE.PerspectiveCamera(62, PH.RENDER_W / PH.RENDER_H, 0.1, 900);
  PH.camera.position.set(0, 6, -14);

  // ---------- golden-hour lights ----------
  var sun = new THREE.DirectionalLight(0xffb36b, 2.6);
  sun.position.set(-140, 62, -55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0006;
  PH.scene.add(sun);
  PH.sun = sun;
  var bounce = new THREE.DirectionalLight(0x8fb8ff, 0.55); // cool sky bounce from the east
  bounce.position.set(120, 40, 80);
  PH.scene.add(bounce);
  var hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2f28, 0.85);
  PH.scene.add(hemi);
  var amb = new THREE.AmbientLight(0x604838, 0.5);
  PH.scene.add(amb);
  PH.lights = { sun: sun, bounce: bounce, hemi: hemi, ambient: amb };

  // Sun helpers: disc + glare sprites live in the sky module; these are the shared maths.
  PH.sunDir = new THREE.Vector3(-140, 62, -55).normalize();
  PH.sunPos = function (dist) { return PH.sunDir.clone().multiplyScalar(dist || 380); };

  // ---------- shared geometry / material caches (reuse, never rebuild per mesh) ----------
  PH.geo = {};
  PH.mat = {};
  PH.boxGeo = function (w, h, d) {
    var k = w + 'x' + h + 'x' + d;
    if (!PH.geo[k]) PH.geo[k] = new THREE.BoxGeometry(w, h, d);
    return PH.geo[k];
  };
  PH.stdMat = function (color, rough, metal) {
    var k = color + '|' + rough + '|' + metal;
    if (!PH.mat[k]) PH.mat[k] = new THREE.MeshStandardMaterial({ color: color, roughness: rough, metalness: metal });
    return PH.mat[k];
  };
  PH.box = function (w, h, d, color, rough, metal) {
    var m = new THREE.Mesh(PH.boxGeo(w, h, d), PH.stdMat(color, rough === undefined ? 0.85 : rough, metal || 0));
    return m;
  };
  PH.cylGeo = function (rt, rb, h, seg) {
    var k = 'c' + rt + 'x' + rb + 'x' + h + 'x' + seg;
    if (!PH.geo[k]) PH.geo[k] = new THREE.CylinderGeometry(rt, rb, h, seg || 10);
    return PH.geo[k];
  };

  // ---------- procedural textures ----------
  PH.makeCanvas = function (w, h, fn) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  };
  PH.labelTexture = function (text, opts) {
    opts = opts || {};
    var w = opts.w || 512, h = opts.h || 128;
    return PH.makeCanvas(w, h, function (g) {
      g.fillStyle = opts.bg || '#1d1a24'; g.fillRect(0, 0, w, h);
      if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
      g.fillStyle = opts.fg || '#ffb347';
      g.font = 'bold ' + (opts.size || 64) + 'px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2);
      if (opts.sub) {
        g.font = 'bold 30px Arial, sans-serif'; g.fillStyle = opts.subColor || '#ffffff';
        g.fillText(opts.sub, w / 2, h - 30);
      }
    });
  };
  // Building window texture: lit windows on a warm wall, one of a few variants.
  PH.windowTexture = function (base, lit, floors, cols) {
    return PH.makeCanvas(256, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var cw = w / cols, ch = h / floors, x, y;
      for (y = 0; y < floors; y++) for (x = 0; x < cols; x++) {
        var warm = Math.random() < 0.55;
        g.fillStyle = warm ? lit : '#2c3440';
        g.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.25, cw * 0.56, ch * 0.5);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.25, cw * 0.56, 3);
      }
    });
  };

  // ---------- colliders: AABB registry + spatial grid (NO scene traversal) ----------
  PH.colliders = []; // {x0,z0,x1,z1}
  PH.grid = new Map();
  PH.CELL = 20;
  PH.addCollider = function (x, z, hx, hz) {
    var c = { x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz };
    var idx = PH.colliders.length;
    PH.colliders.push(c);
    var cx0 = Math.floor(c.x0 / PH.CELL), cx1 = Math.floor(c.x1 / PH.CELL);
    var cz0 = Math.floor(c.z0 / PH.CELL), cz1 = Math.floor(c.z1 / PH.CELL);
    var gx, gz, key;
    for (gx = cx0; gx <= cx1; gx++) for (gz = cz0; gz <= cz1; gz++) {
      key = gx + ',' + gz;
      if (!PH.grid.has(key)) PH.grid.set(key, []);
      PH.grid.get(key).push(idx);
    }
    return idx;
  };
  PH._nearColliders = function (x, z, r, out) {
    out.length = 0;
    var gx = Math.floor(x / PH.CELL), gz = Math.floor(z / PH.CELL);
    var seen = PH._seen || (PH._seen = new Set());
    seen.clear();
    var dx, dz, key, list, i, idx;
    for (dx = -1; dx <= 1; dx++) for (dz = -1; dz <= 1; dz++) {
      key = (gx + dx) + ',' + (gz + dz);
      list = PH.grid.get(key);
      if (!list) continue;
      for (i = 0; i < list.length; i++) {
        idx = list[i];
        if (seen.has(idx)) continue;
        seen.add(idx);
        out.push(PH.colliders[idx]);
      }
    }
    return out;
  };
  // Push a circle out of every nearby solid. Returns {x, z, hit}.
  PH.collideCircle = function (x, z, r) {
    var near = PH._nearColliders(x, z, r, PH._tmpNear || (PH._tmpNear = []));
    var hit = false, i, c, cx, cz, dx, dz, ox, oz;
    for (i = 0; i < near.length; i++) {
      c = near[i];
      cx = PH.clamp(x, c.x0, c.x1); cz = PH.clamp(z, c.z0, c.z1);
      dx = x - cx; dz = z - cz;
      if (dx * dx + dz * dz < r * r) {
        hit = true;
        if (dx === 0 && dz === 0) { dx = 0; dz = 1; }
        var d = Math.sqrt(dx * dx + dz * dz) || 0.001;
        ox = (r - d) * (dx / d); oz = (r - d) * (dz / d);
        // If the centre is inside the box, push along the smallest penetration axis.
        if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) {
          var pl = Math.min(x - c.x0, c.x1 - x), pd = Math.min(z - c.z0, c.z1 - z);
          if (pl < pd) { ox = (x - c.x0 < c.x1 - x) ? -(pl + r) : (pl + r); oz = 0; }
          else { oz = (z - c.z0 < c.z1 - z) ? -(pd + r) : (pd + r); ox = 0; }
        }
        x += ox; z += oz;
      }
    }
    return { x: x, z: z, hit: hit };
  };
  PH.pointBlocked = function (x, z, pad) {
    var near = PH._nearColliders(x, z, pad || 0, PH._tmpNear2 || (PH._tmpNear2 = []));
    var i, c;
    for (i = 0; i < near.length; i++) {
      c = near[i];
      if (x > c.x0 - (pad || 0) && x < c.x1 + (pad || 0) && z > c.z0 - (pad || 0) && z < c.z1 + (pad || 0)) return true;
    }
    return false;
  };
  // Car-only colliders (circles): bollards a car cannot pass but a pedestrian can walk
  // between. Checked only by vehicle physics, never by on-foot movement.
  PH.carOnlyColliders = []; // {x, z, r}
  PH.addCarCollider = function (x, z, r) { PH.carOnlyColliders.push({ x: x, z: z, r: r }); };
  PH.collideCarCircle = function (x, z, r) {
    var res = PH.collideCircle(x, z, r);
    x = res.x; z = res.z;
    var hit = res.hit, i, c, dx, dz, d, min;
    for (i = 0; i < PH.carOnlyColliders.length; i++) {
      c = PH.carOnlyColliders[i];
      dx = x - c.x; dz = z - c.z;
      d = Math.sqrt(dx * dx + dz * dz);
      min = r + c.r;
      if (d < min) {
        hit = true;
        if (d === 0) { dx = 0; dz = 1; d = 1; }
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      }
    }
    return { x: x, z: z, hit: hit };
  };

  // ---------- HUD: every setter writes the DOM ONLY when its value changed ----------
  PH.hud = {
    _last: {},
    _el: function (id) { return document.getElementById(id); },
    text: function (id, v) {
      v = String(v);
      if (this._last[id] === v) return;
      this._last[id] = v;
      var el = this._el(id);
      if (el) el.textContent = v;
    },
    html: function (id, v) {
      if (this._last[id] === v) return;
      this._last[id] = v;
      var el = this._el(id);
      if (el) el.innerHTML = v;
    },
    show: function (id, on) {
      var k = id + ':show';
      if (this._last[k] === on) return;
      this._last[k] = on;
      var el = this._el(id);
      if (el) el.classList.toggle('on', !!on);
    },
    bar: function (id, frac) {
      frac = PH.clamp(frac, 0, 1);
      var key = id + ':bar';
      if (this._last[key] === frac) return;
      this._last[key] = frac;
      var el = this._el(id);
      if (el) el.style.width = (frac * 100).toFixed(1) + '%';
    },
    setObjective: function (name, stage, objective, next) {
      this.text('mission-name', name);
      this.text('mission-stage', stage);
      this.text('mission-objective', objective);
      this.text('mission-next', next);
    },
    setTimer: function (seconds) { this.text('mission-timer', PH.fmtTime(seconds)); },
    setWanted: function (stars) {
      stars = PH.clamp(Math.round(stars), 0, 5);
      if (this._last.wanted === stars) return;
      this._last.wanted = stars;
      var html = '', i;
      for (i = 0; i < 5; i++) html += i < stars ? '&#9733;' : '<span class="off">&#9733;</span>';
      var el = this._el('wanted-stars');
      if (el) el.innerHTML = html;
    },
    setMoney: function (n) { this.text('money', '$' + Math.floor(n).toLocaleString('en-US')); },
    setHealth: function (hp) { this.bar('health-fill', hp / 100); this.text('health-num', Math.max(0, Math.ceil(hp))); },
    setArmor: function (a) { this.bar('armor-fill', a / 100); this.text('armor-num', Math.max(0, Math.ceil(a))); },
    setAmmo: function (label) { this.text('ammo', label); },
    setSpeed: function (kmh) { this.text('speed', Math.round(Math.abs(kmh))); },
    setCar: function (name, cond) {
      this.text('car-name', name);
      this.text('car-condition', 'CONDITION ' + Math.max(0, Math.round(cond)) + '%');
    },
    setRadio: function (name) { this.text('radio-name', name); },
    setDispatch: function (html) { this.html('dispatch-list', html); },
    setDialog: function (on, name, text, portraitUrl) {
      this.show('dialog', on);
      if (!on) return;
      this.text('dialog-name', name);
      this.text('dialog-text', text);
      if (portraitUrl) {
        var c = this._el('dialog-portrait');
        if (c && this._last['dialog-portrait'] !== portraitUrl) {
          this._last['dialog-portrait'] = portraitUrl;
          var ctx = c.getContext('2d');
          var img = new Image();
          img.onload = function () { ctx.clearRect(0, 0, 84, 84); ctx.drawImage(img, 0, 0, 84, 84); };
          img.src = portraitUrl;
        }
      }
    },
    setWeaponSel: function (idx) {
      if (this._last.wpn === idx) return;
      this._last.wpn = idx;
      var i, el;
      for (i = 0; i < 6; i++) {
        el = this._el('wpn-' + i);
        if (el) el.classList.toggle('sel', i === idx);
      }
    },
    toast: function (msg, ms) {
      var el = this._el('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('on');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(function () { el.classList.remove('on'); }, ms || 2600);
    },
    saveToast: function (msg) {
      var el = this._el('save-toast');
      if (!el) return;
      el.textContent = msg || 'Game saved';
      el.classList.add('on');
      clearTimeout(this._saveT);
      this._saveT = setTimeout(function () { el.classList.remove('on'); }, 2200);
    },
    damageNumber: function (x, y, text, color) {
      var layer = this._el('damage-layer');
      if (!layer) return;
      var d = document.createElement('div');
      d.className = 'dmg';
      d.textContent = text;
      d.style.left = x + 'px'; d.style.top = y + 'px';
      if (color) d.style.color = color;
      layer.appendChild(d);
      var t = 0;
      var iv = setInterval(function () {
        t += 50;
        d.style.top = (y - t * 0.7) + 'px';
        d.style.opacity = String(Math.max(0, 1 - t / 700));
        if (t >= 700) { clearInterval(iv); if (d.parentNode) d.parentNode.removeChild(d); }
      }, 50);
    },
    hitmarker: function () {
      var el = this._el('hitmarker');
      if (!el) return;
      el.classList.add('on');
      setTimeout(function () { el.classList.remove('on'); }, 130);
    }
  };

  // ---------- minimap: cached street-map base, redrawn at most every 0.15 s ----------
  PH.minimap = {
    base: null, lastDraw: -1,
    buildBase: function () {
      var c = document.createElement('canvas');
      c.width = 220; c.height = 220;
      var g = c.getContext('2d');
      g.fillStyle = '#232830'; g.fillRect(0, 0, 220, 220);
      // sea
      g.fillStyle = '#1d5f7a'; g.fillRect(0, 168, 220, 52);
      // beach
      g.fillStyle = '#c9a86a'; g.fillRect(0, 158, 220, 10);
      var roads = PH.world && PH.world.roadRects ? PH.world.roadRects : [];
      var i, r, sx = 220 / 380, sz = 220 / 380;
      function X(x) { return 110 + x * sx; }
      function Z(z) { return 110 + z * sz; }
      g.fillStyle = '#4a4f58';
      for (i = 0; i < roads.length; i++) {
        r = roads[i];
        g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sx, (r.z1 - r.z0) * sz);
      }
      g.strokeStyle = '#c9a86a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(-160), Z(150)); g.lineTo(X(160), Z(150)); g.stroke();
      // pier
      g.fillStyle = '#8a6a4a'; g.fillRect(X(-5), Z(105), 10 * sx, 60 * sz);
      // bridge
      g.fillStyle = '#5a5f68'; g.fillRect(X(-160), Z(-5), 10 * sx, 10 * sz);
      this.base = c;
    },
    draw: function (now, state) {
      if (now - this.lastDraw < 0.15) return;
      this.lastDraw = now;
      var cv = document.getElementById('minimap');
      if (!cv || !this.base) return;
      var g = cv.getContext('2d');
      g.clearRect(0, 0, 220, 220);
      g.save();
      g.beginPath(); g.arc(110, 110, 108, 0, Math.PI * 2); g.clip();
      g.drawImage(this.base, 0, 0);
      function X(x) { return 110 + x * (220 / 380); }
      function Z(z) { return 110 + z * (220 / 380); }
      var i, p;
      // mission marker
      if (state && state.marker) {
        g.fillStyle = '#ffb347';
        g.beginPath(); g.arc(X(state.marker.x), Z(state.marker.z), 7, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      }
      // traffic
      if (state && state.cars) for (i = 0; i < state.cars.length; i++) {
        p = state.cars[i];
        g.fillStyle = '#d8d8d8'; g.fillRect(X(p.x) - 2, Z(p.z) - 2, 4, 4);
      }
      // police
      if (state && state.police) for (i = 0; i < state.police.length; i++) {
        p = state.police[i];
        g.fillStyle = '#3a7bff'; g.beginPath(); g.arc(X(p.x), Z(p.z), 4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
      }
      // boats
      if (state && state.boats) for (i = 0; i < state.boats.length; i++) {
        p = state.boats[i];
        g.fillStyle = '#7dd8ff'; g.beginPath(); g.arc(X(p.x), Z(p.z), 3, 0, Math.PI * 2); g.fill();
      }
      // player arrow
      if (state && state.player) {
        var px = X(state.player.x), pz = Z(state.player.z), a = state.player.heading;
        g.save(); g.translate(px, pz); g.rotate(-a);
        g.fillStyle = '#ffb347';
        g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill();
        g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
        g.restore();
      }
      g.restore();
    }
  };

  // Resize: CSS follows the window, the render buffer NEVER follows it.
  PH.fitCanvas = function () {
    var w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    PH.camera.aspect = w / h;
    PH.camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', PH.fitCanvas);
  PH.fitCanvas();
})();
