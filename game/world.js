// PIER HEAT v6.4 — world.js
// Builds Sunset Bay: sky, ocean, pier, street grid, pastel towers, palms,
// market stalls, kiosks, park, parking lot — and, the v6.4 headline, the
// signage system: vertical neon blades, horizontal fascia boards, rooftop
// signs and awning lettering, 30+ readable original shop names in neon
// pink / cyan / yellow. Also builds every vehicle and person mesh.
// Written fresh for v6.4; nothing here is copied from an earlier version.
(function () {
  'use strict';

  // ------------------------------------------------------------ utilities
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function srgb(tex) {
    if ('colorSpace' in tex && THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('encoding' in tex && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  function canvasTex(w, h, draw) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(cv);
    return srgb(t);
  }
  function box(w, h, d, color, x, y, z, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    return m;
  }
  function lam(color) { return new THREE.MeshLambertMaterial({ color: color }); }
  function basic(color) { return new THREE.MeshBasicMaterial({ color: color }); }
  function phong(color, shine) {
    return new THREE.MeshPhongMaterial({ color: color, shininess: shine || 60, specular: 0x334455 });
  }

  // ------------------------------------------------------------ textures
  // Facade: pastel base + window grid, a few windows lit warm.
  function facadeTexture(base, seed, floors, cols) {
    var rnd = mulberry32(seed);
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      var cw = w / cols, ch = h / floors;
      for (var f = 0; f < floors; f++) {
        for (var c = 0; c < cols; c++) {
          var lit = rnd() < 0.28;
          g.fillStyle = lit ? '#ffd98a' : (rnd() < 0.5 ? '#1d2f45' : '#274b66');
          g.fillRect(c * cw + cw * 0.18, f * ch + ch * 0.2, cw * 0.64, ch * 0.6);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(c * cw + cw * 0.18, f * ch + ch * 0.2, cw * 0.64, ch * 0.12);
        }
      }
    });
  }

  // Road: dark asphalt, yellow centre dashes, white edge lines.
  function roadTexture() {
    return canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = '#363b45'; g.fillRect(0, 0, w, h); // warm-lit asphalt, not black
      g.fillStyle = '#ffd400'; g.fillRect(w / 2 - 3, 8, 6, 44);
      g.fillStyle = '#e8e8e8'; g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (var i = 0; i < 40; i++) g.fillRect((i * 37) % w, (i * 53) % h, 2, 2);
    });
  }

  // Striped awning canvas with the shop name written across it.
  function awningTexture(text, c1, c2, fg) {
    return canvasTex(512, 128, function (g, w, h) {
      for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * w / 8, 0, w / 8, h); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 26, w, 26);
      g.font = '900 64px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#000'; g.shadowBlur = 10;
      g.fillStyle = fg; g.fillText(text, w / 2, h / 2 - 6);
      g.shadowBlur = 0;
    });
  }

  // Neon sign canvas. kind 'vertical' stacks the letters top to bottom.
  function signTexture(text, opt) {
    var vertical = opt.kind === 'vertical';
    var W = vertical ? 256 : 1024, H = vertical ? 1024 : 256;
    return canvasTex(W, H, function (g, w, h) {
      // Backing panel.
      g.fillStyle = opt.bg || '#12002b'; g.fillRect(0, 0, w, h);
      g.strokeStyle = opt.fg; g.lineWidth = vertical ? 10 : 8;
      g.shadowColor = opt.fg; g.shadowBlur = 28;
      g.strokeRect(10, 10, w - 20, h - 20);
      g.shadowBlur = 0;
      g.fillStyle = opt.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = opt.fg; g.shadowBlur = 26;
      if (vertical) {
        var letters = text.split('');
        var step = (h - 120) / Math.max(letters.length, 1);
        var fs = Math.min(150, Math.floor(step * 0.8));
        g.font = '900 ' + fs + 'px Arial, sans-serif';
        for (var i = 0; i < letters.length; i++) {
          g.fillText(letters[i], w / 2, 90 + step * i + step / 2);
        }
        // Star accents top and bottom, like the concept's ARCADE blade.
        g.font = '900 90px Arial, sans-serif';
        g.fillText('★', w / 2, 62);
        g.fillText('★', w / 2, h - 40);
      } else {
        var size = 150;
        g.font = '900 ' + size + 'px Arial, sans-serif';
        while (g.measureText(text).width > w - 70 && size > 44) {
          size -= 8; g.font = '900 ' + size + 'px Arial, sans-serif';
        }
        g.fillText(text, w / 2, h / 2 + 4);
      }
      g.shadowBlur = 0;
    });
  }

  function textPlateTexture(text, fg, bg, size) {
    return canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.font = '900 ' + (size || 84) + 'px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2);
    });
  }

  function stripeTexture(c1, c2) {
    return canvasTex(256, 128, function (g, w, h) {
      for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * w / 8, 0, w / 8, h); }
    });
  }

  // ------------------------------------------------------------ signage
  // Every sign in the game is registered here so the build can count them
  // and the probe can report them. Kinds: vertical | fascia | roof | awning.
  var signRegistry = [];

  function addSign(parent, spec) {
    // spec: {text, kind, x,y,z, rotY, w,h, bg, fg, awning:[c1,c2]}
    var tex, mat;
    if (spec.kind === 'awning') {
      tex = awningTexture(spec.text, spec.awning[0], spec.awning[1], spec.fg || '#ffffff');
    } else {
      tex = signTexture(spec.text, spec);
    }
    mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    var geo = new THREE.PlaneGeometry(spec.w, spec.h);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.rotation.y = spec.rotY || 0;
    if (spec.kind === 'awning') mesh.rotation.x = -0.5;
    if (spec.kind === 'roof') mesh.rotation.x = -0.12;
    // Dark backing board so the neon reads against any facade.
    var back = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w + 0.3, spec.h + 0.3, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x0d0d18 }));
    back.position.set(spec.x, spec.y, spec.z);
    back.rotation.y = spec.rotY || 0;
    back.position.x -= Math.sin(spec.rotY || 0) * 0.12;
    back.position.z -= Math.cos(spec.rotY || 0) * 0.12;
    parent.add(back);
    parent.add(mesh);
    signRegistry.push({ text: spec.text, kind: spec.kind });
    return mesh;
  }

  // ------------------------------------------------------------ layout
  var CROSS_X = [-200, -140, -80, -20, 40, 100, 160];
  var OCEAN_X0 = -260, OCEAN_X1 = 235;

  // Buildings along Ocean Drive. face: +1 = facade looks +Z (north side),
  // -1 = facade looks -Z (south side). Every building carries 2-3 signs.
  var BUILDINGS = [
    { x: -170, z: -25, w: 44, d: 20, h: 26, base: '#ff9ecf', seed: 11, signs: [
      { kind: 'vertical', text: 'ARCADE', bg: '#1a0033', fg: '#ff2fb3' },
      { kind: 'fascia', text: 'PINBALL OPEN', bg: '#0b1e3a', fg: '#00e5ff' },
      { kind: 'awning', text: 'ARCADE', awning: ['#ff2fb3', '#ffffff'], fg: '#1a0033' } ] },
    { x: -110, z: -25, w: 40, d: 20, h: 18, base: '#ffd166', seed: 12, signs: [
      { kind: 'fascia', text: 'TACOS', bg: '#3a1500', fg: '#ffd400' },
      { kind: 'fascia', text: 'RECORDS', bg: '#001a2e', fg: '#00ffb3' },
      { kind: 'awning', text: 'TACOS', awning: ['#ffd400', '#ff5d00'], fg: '#3a1500' } ] },
    { x: -50, z: -25, w: 44, d: 20, h: 30, base: '#7df9ff', seed: 13, signs: [
      { kind: 'vertical', text: 'CINEMA', bg: '#1a0033', fg: '#ffd400' },
      { kind: 'fascia', text: 'DANCE HALL', bg: '#2b0033', fg: '#ff5df2' },
      { kind: 'roof', text: 'HOTEL OCEAN', bg: '#002b4d', fg: '#7df9ff' } ] },
    { x: 10, z: -25, w: 42, d: 20, h: 15, base: '#c8f7a5', seed: 14, signs: [
      { kind: 'fascia', text: 'SURF SHOP', bg: '#00334d', fg: '#00e5ff' },
      { kind: 'fascia', text: 'BURGERS', bg: '#4d0e00', fg: '#ffb300' },
      { kind: 'awning', text: 'BURGERS', awning: ['#ff5d00', '#ffffff'], fg: '#4d0e00' } ] },
    { x: 70, z: -25, w: 40, d: 20, h: 22, base: '#e6b8ff', seed: 15, signs: [
      { kind: 'fascia', text: 'RECORDS', bg: '#001a2e', fg: '#00ffb3' },
      { kind: 'vertical', text: 'TATTOO', bg: '#111111', fg: '#ff2e63' },
      { kind: 'awning', text: 'RECORDS', awning: ['#00ffb3', '#001a2e'], fg: '#ffffff' } ] },
    { x: 130, z: -25, w: 44, d: 20, h: 34, base: '#9ecfff', seed: 16, signs: [
      { kind: 'roof', text: 'SUNSET MOTEL', bg: '#3a0a4d', fg: '#ff9de2' },
      { kind: 'fascia', text: 'CAFE', bg: '#2b1a00', fg: '#ffd9a0' },
      { kind: 'awning', text: 'CAFE', awning: ['#00e5ff', '#ffffff'], fg: '#00334d' } ] },
    { x: 195, z: -25, w: 42, d: 20, h: 20, base: '#ffb3a0', seed: 17, signs: [
      { kind: 'fascia', text: 'PIER GRILL', bg: '#1a2b00', fg: '#a5ff5e' },
      { kind: 'fascia', text: 'ICE CREAM', bg: '#3a0033', fg: '#ff9de2' },
      { kind: 'awning', text: 'PIER GRILL', awning: ['#a5ff5e', '#ffffff'], fg: '#1a2b00' } ] },
    { x: -170, z: 25, w: 44, d: 20, h: 20, base: '#ffe14d', seed: 21, signs: [
      { kind: 'fascia', text: 'PAWN • JEWELRY', bg: '#2e0033', fg: '#ff9de2' },
      { kind: 'fascia', text: 'NEWS • SMOKE • DRINKS', bg: '#062b1a', fg: '#7dff5e' },
      { kind: 'awning', text: 'PAWN', awning: ['#ff9de2', '#2e0033'], fg: '#ffffff' } ] },
    { x: -110, z: 25, w: 40, d: 20, h: 28, base: '#ff8fa3', seed: 22, signs: [
      { kind: 'vertical', text: 'SALSA', bg: '#2b0033', fg: '#ff5df2' },
      { kind: 'fascia', text: 'DANCE HALL', bg: '#2b0033', fg: '#ffd400' },
      { kind: 'awning', text: 'SALSA CLUB', awning: ['#ff5df2', '#2b0033'], fg: '#ffffff' } ] },
    { x: -50, z: 25, w: 44, d: 20, h: 16, base: '#b8e6ff', seed: 23, signs: [
      { kind: 'fascia', text: 'MARKET', bg: '#0b3a1a', fg: '#7dff5e' },
      { kind: 'fascia', text: 'BAKERY', bg: '#4d2b00', fg: '#ffd9a0' },
      { kind: 'awning', text: 'BAKERY', awning: ['#ffd9a0', '#4d2b00'], fg: '#ffffff' } ] },
    { x: 10, z: 25, w: 42, d: 20, h: 24, base: '#d0b3ff', seed: 24, signs: [
      { kind: 'fascia', text: 'BARBER', bg: '#1a1a2e', fg: '#7df9ff' },
      { kind: 'fascia', text: 'LAUNDRY', bg: '#0b2b4d', fg: '#bfe9ff' },
      { kind: 'vertical', text: 'NEON BOWL', bg: '#12002b', fg: '#00e5ff' } ] },
    { x: 70, z: 25, w: 40, d: 20, h: 18, base: '#a5ffd6', seed: 25, signs: [
      { kind: 'fascia', text: 'DONUTS', bg: '#3a0033', fg: '#ff9de2' },
      { kind: 'fascia', text: 'FISH TACOS', bg: '#00334d', fg: '#ffd400' },
      { kind: 'awning', text: 'DONUTS', awning: ['#ff9de2', '#ffffff'], fg: '#3a0033' } ] },
    { x: 130, z: 25, w: 44, d: 20, h: 26, base: '#ffc2d1', seed: 26, signs: [
      { kind: 'roof', text: 'PIER 9', bg: '#002b4d', fg: '#ffd400' },
      { kind: 'fascia', text: 'MARINA', bg: '#001a2e', fg: '#00e5ff' },
      { kind: 'awning', text: 'MARINA', awning: ['#00e5ff', '#001a2e'], fg: '#ffffff' } ] },
    { x: 195, z: 25, w: 42, d: 20, h: 32, base: '#ffe9a5', seed: 27, signs: [
      { kind: 'fascia', text: 'HOTEL OCEAN', bg: '#002b4d', fg: '#7df9ff' },
      { kind: 'vertical', text: 'HOTEL', bg: '#002b4d', fg: '#ffd400' },
      { kind: 'awning', text: 'HOTEL OCEAN', awning: ['#7df9ff', '#002b4d'], fg: '#ffffff' } ] },
  ];

  // Glass towers set back from the drive, for the shot-2 skyline.
  var TOWERS = [
    { x: -170, z: -70, w: 26, d: 26, h: 52, base: '#8fc7e8' },
    { x: -20, z: -70, w: 30, d: 26, h: 64, base: '#a5b8ff' },
    { x: 100, z: -70, w: 26, d: 26, h: 48, base: '#7fd4c0' },
    { x: -110, z: 70, w: 26, d: 26, h: 58, base: '#e8b8d0' },
    { x: 40, z: 70, w: 30, d: 26, h: 44, base: '#b8d8ff' },
    { x: 160, z: 70, w: 26, d: 26, h: 56, base: '#ffd0a5' },
  ];

  // ------------------------------------------------------------ builders
  function addBuilding(parent, b) {
    var g = new THREE.Group();
    var tex = facadeTexture(b.base, b.seed, Math.max(3, Math.round(b.h / 4)), Math.max(4, Math.round(b.w / 5)));
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    var side = new THREE.MeshLambertMaterial({ map: tex });
    var roof = lam(0x232838);
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d),
      [side, side, roof, roof, side, side]);
    mesh.position.y = b.h / 2;
    g.add(mesh);
    // Shopfront glass: a warm lit band at street level.
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.86, 3.2),
      new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    glass.position.set(0, 1.9, (b.z < 0 ? 1 : -1) * (b.d / 2 + 0.06));
    if (b.z > 0) glass.rotation.y = Math.PI;
    g.add(glass);
    // Signs, placed against the road-facing facade.
    var faceDir = b.z < 0 ? 1 : -1;           // north side faces +Z
    var faceZ = faceDir * (b.d / 2 + 0.15);
    var rotY = faceDir > 0 ? 0 : Math.PI;
    b.signs.forEach(function (s, i) {
      if (s.kind === 'fascia') {
        addSign(g, { text: s.text, kind: 'fascia', x: (i % 2 ? b.w * 0.24 : -b.w * 0.24),
          y: 5.6, z: faceZ, rotY: rotY, w: b.w * 0.44, h: 2.6, bg: s.bg, fg: s.fg });
      } else if (s.kind === 'vertical') {
        addSign(g, { text: s.text, kind: 'vertical', x: -b.w / 2 - 0.4, y: 11, z: faceZ + 1.6,
          rotY: rotY + Math.PI / 2, w: 2.6, h: 11, bg: s.bg, fg: s.fg });
      } else if (s.kind === 'roof') {
        addSign(g, { text: s.text, kind: 'roof', x: 0, y: b.h + 2.2, z: faceZ - faceDir * 1.5,
          rotY: rotY, w: b.w * 0.72, h: 3.4, bg: s.bg, fg: s.fg });
      } else if (s.kind === 'awning') {
        addSign(g, { text: s.text, kind: 'awning', x: 0, y: 3.6, z: faceZ + faceDir * 1.1,
          rotY: rotY, w: b.w * 0.7, h: 1.6, awning: s.awning, fg: s.fg });
      }
    });
    g.position.set(b.x, 0, b.z);
    parent.add(g);
    return g;
  }

  function addPalm(parent, x, z, seed) {
    var rnd = mulberry32(seed);
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 7.5, 7), lam(0x7a5230));
    trunk.position.y = 3.75;
    trunk.rotation.z = (rnd() - 0.5) * 0.12;
    g.add(trunk);
    for (var i = 0; i < 7; i++) {
      var frond = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4),
        new THREE.MeshLambertMaterial({ color: 0x2fae4e, side: THREE.DoubleSide }));
      var a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.1, 7.6, Math.sin(a) * 1.1);
      frond.rotation.set(Math.sin(a) * 1.1, a, Math.cos(a) * -1.1);
      g.add(frond);
    }
    var nuts = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lam(0x8a5a2b));
    nuts.position.y = 7.2; g.add(nuts);
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }

  function addLamp(parent, x, z) {
    var g = new THREE.Group();
    g.add(box(0.18, 6.2, 0.18, 0x1c2430, 0, 3.1, 0));
    g.add(box(1.6, 0.16, 0.16, 0x1c2430, 0.7, 6.1, 0));
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe6a8 }));
    bulb.position.set(1.4, 5.95, 0);
    g.add(bulb);
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }

  // ------------------------------------------------------------ vehicles
  function wheel(x, y, z, parent) {
    var w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12), lam(0x111111));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, y, z);
    parent.add(w);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 8), lam(0xcccccc));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, y, z);
    parent.add(hub);
  }

  // The Scarlet Arrow: orange wedge sports car, extruded side profile.
  function buildHeroCar() {
    var g = new THREE.Group();
    var s = new THREE.Shape();
    s.moveTo(2.30, 0.28); s.lineTo(2.16, 0.55); s.lineTo(1.20, 0.72);
    s.lineTo(0.50, 0.80); s.lineTo(-0.10, 1.15); s.lineTo(-0.90, 1.12);
    s.lineTo(-1.70, 0.90); s.lineTo(-2.25, 0.82); s.lineTo(-2.30, 0.28);
    s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, { depth: 1.86, bevelEnabled: false });
    geo.translate(0, 0, -0.93);
    var body = new THREE.Mesh(geo, phong(0xff7a00, 90));
    g.add(body);
    // Dark glasshouse inset, kept inside the roofline so it reads as glass
    // and not as a black slab stacked on the roof.
    var glass = box(1.2, 0.24, 1.4, 0x101826, -0.35, 0.98, 0, new THREE.MeshPhongMaterial({ color: 0x101826, shininess: 120 }));
    g.add(glass);
    // Rear spoiler, thin and low.
    g.add(box(0.35, 0.06, 1.9, 0x181818, -2.05, 1.06, 0));
    g.add(box(0.08, 0.26, 0.1, 0x181818, -2.0, 0.92, 0.7));
    g.add(box(0.08, 0.26, 0.1, 0x181818, -2.0, 0.92, -0.7));
    // Full-width red tail light bar + headlights.
    g.add(box(0.06, 0.14, 1.7, 0xff1e2d, -2.32, 0.72, 0, basic(0xff1e2d)));
    g.add(box(0.06, 0.12, 0.4, 0xfff6c8, 2.28, 0.55, 0.55, basic(0xfff6c8)));
    g.add(box(0.06, 0.12, 0.4, 0xfff6c8, 2.28, 0.55, -0.55, basic(0xfff6c8)));
    // Plate.
    var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2),
      new THREE.MeshBasicMaterial({ map: textPlateTexture('SUN-8821', '#10243a', '#f2f2f2', 64) }));
    plate.position.set(-2.36, 0.42, 0); plate.rotation.y = -Math.PI / 2;
    g.add(plate);
    wheel(1.45, 0.36, 0.95, g); wheel(1.45, 0.36, -0.95, g);
    wheel(-1.45, 0.36, 0.95, g); wheel(-1.45, 0.36, -0.95, g);
    return g;
  }

  function buildPoliceCar() {
    var g = new THREE.Group();
    g.add(box(4.4, 0.72, 1.9, 0xf2f2f2, 0, 0.62, 0));                 // white body
    g.add(box(1.3, 0.5, 1.86, 0x14181f, 1.55, 0.85, 0));              // black hood
    g.add(box(1.1, 0.5, 1.86, 0x14181f, -1.6, 0.85, 0));              // black trunk
    g.add(box(2.1, 0.62, 1.66, 0x1a2432, -0.25, 1.25, 0, phong(0x1a2432, 110))); // cabin
    g.add(box(0.9, 0.14, 0.5, 0x111111, 0.1, 1.62, 0));               // light bar base
    g.add(box(0.4, 0.16, 0.52, 0xff1e2d, -0.12, 1.66, 0, basic(0xff1e2d)));
    g.add(box(0.4, 0.16, 0.52, 0x2456ff, 0.32, 1.66, 0, basic(0x2456ff)));
    g.add(box(0.5, 0.4, 0.2, 0x14181f, 2.22, 0.55, 0));               // push bar
    var sideTex = textPlateTexture('POLICE', '#10243a', '#f2f2f2', 72);
    [-0.96, 0.96].forEach(function (z) {
      var p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42),
        new THREE.MeshBasicMaterial({ map: sideTex }));
      p.position.set(-0.2, 0.62, z);
      if (z < 0) p.rotation.y = Math.PI;
      g.add(p);
    });
    var rear = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36),
      new THREE.MeshBasicMaterial({ map: textPlateTexture('POLICE', '#f2f2f2', '#14181f', 72) }));
    rear.position.set(-2.22, 0.66, 0); rear.rotation.y = -Math.PI / 2;
    g.add(rear);
    wheel(1.45, 0.36, 0.95, g); wheel(1.45, 0.36, -0.95, g);
    wheel(-1.45, 0.36, 0.95, g); wheel(-1.45, 0.36, -0.95, g);
    return g;
  }

  var CAR_COLORS = [0xff3b30, 0xffcc00, 0x2ec4b6, 0x4361ee, 0xf72585, 0xffffff,
    0x80ed99, 0xff8c42, 0x9b5de5, 0x00bbf9, 0xef476f, 0x06d6a0, 0xc0c0c0, 0x222222];

  function buildTrafficCar(color, style) {
    var g = new THREE.Group();
    var c = color === undefined ? 0xcccccc : color;
    if (style === 'van') {
      g.add(box(4.6, 1.7, 2.0, c, 0, 1.15, 0, phong(c, 40)));
      g.add(box(1.0, 0.7, 1.8, 0x1a2432, 1.9, 1.25, 0, phong(0x1a2432, 110)));
    } else if (style === 'hatch') {
      g.add(box(3.4, 0.68, 1.85, c, 0, 0.6, 0, phong(c, 60)));
      g.add(box(1.9, 0.6, 1.6, 0x1a2432, -0.25, 1.15, 0, phong(0x1a2432, 110)));
    } else {
      g.add(box(4.3, 0.7, 1.9, c, 0, 0.6, 0, phong(c, 60)));
      g.add(box(2.2, 0.58, 1.66, 0x1a2432, -0.25, 1.2, 0, phong(0x1a2432, 110)));
    }
    g.add(box(0.06, 0.1, 1.5, 0xff1e2d, style === 'van' ? -2.32 : -2.16, 0.62, 0, basic(0xff1e2d)));
    g.add(box(0.06, 0.1, 0.35, 0xfff6c8, style === 'van' ? 2.32 : 2.16, 0.55, 0.55, basic(0xfff6c8)));
    g.add(box(0.06, 0.1, 0.35, 0xfff6c8, style === 'van' ? 2.32 : 2.16, 0.55, -0.55, basic(0xfff6c8)));
    if (style === 'taxi') {
      g.add(box(0.9, 0.3, 0.4, 0xffd400, -0.25, 1.62, 0, basic(0xffd400)));
      var t = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3),
        new THREE.MeshBasicMaterial({ map: textPlateTexture('TAXI', '#111111', '#ffd400', 64), side: THREE.DoubleSide }));
      t.position.set(-0.25, 1.62, 0.21); g.add(t);
    }
    var wx = style === 'van' ? 1.55 : 1.4;
    wheel(wx, 0.36, 0.95, g); wheel(wx, 0.36, -0.95, g);
    wheel(-wx, 0.36, 0.95, g); wheel(-wx, 0.36, -0.95, g);
    return g;
  }

  function buildHeli() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), phong(0xf2f2f2, 70));
    body.scale.set(1.5, 0.85, 0.85); body.position.y = 0;
    g.add(body);
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 3.6, 8), lam(0x222222));
    tail.rotation.z = Math.PI / 2; tail.position.set(-3.0, 0.25, 0);
    g.add(tail);
    var fin = box(0.1, 1.2, 0.7, 0x222222, -4.7, 0.7, 0);
    g.add(fin);
    var rotor = new THREE.Group();
    rotor.add(box(7.5, 0.08, 0.34, 0x111111, 0, 0, 0));
    rotor.add(box(0.34, 0.08, 7.5, 0x111111, 0, 0, 0));
    rotor.position.y = 1.35;
    g.add(rotor);
    var skidL = box(3.0, 0.1, 0.12, 0x111111, 0, -1.25, 0.8);
    var skidR = box(3.0, 0.1, 0.12, 0x111111, 0, -1.25, -0.8);
    g.add(skidL); g.add(skidR);
    var side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5),
      new THREE.MeshBasicMaterial({ map: textPlateTexture('POLICE', '#10243a', '#f2f2f2', 72), side: THREE.DoubleSide }));
    side.position.set(0.4, 0.1, 1.32); g.add(side);
    // Searchlight cone + bright disc, aimed straight down.
    var cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 22, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false }));
    cone.rotation.x = Math.PI; cone.position.y = -12;
    g.add(cone);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -22.5;
    g.add(disc);
    g.userData.rotor = rotor;
    return g;
  }

  // ------------------------------------------------------------ people
  var SKIN = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6b4226, 0xf0c8a0, 0xa06a42];
  var SHIRTS = [0xff2fb3, 0x00e5ff, 0xffd400, 0x7dff5e, 0x9b5de5, 0xff5d00,
    0x00ffb3, 0xffffff, 0xff8fa3, 0x2ec4b6, 0xef476f, 0x06d6a0];
  var PANTS = [0x1a2432, 0x3a3a3a, 0x5b4a8a, 0x2b4d2b, 0x6b4226, 0x222222];

  function buildPed(seed) {
    var rnd = mulberry32(seed * 7919 + 13);
    var g = new THREE.Group();
    var shirt = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
    var pants = PANTS[Math.floor(rnd() * PANTS.length)];
    var skin = SKIN[Math.floor(rnd() * SKIN.length)];
    var h = 0.92 + rnd() * 0.16;
    var legL = box(0.17, 0.78, 0.2, pants, -0.11, 0.39, 0);
    var legR = box(0.17, 0.78, 0.2, pants, 0.11, 0.39, 0);
    var torso = box(0.56, 0.66, 0.3, shirt, 0, 1.1, 0);
    var armL = box(0.13, 0.6, 0.15, shirt, -0.36, 1.1, 0);
    var armR = box(0.13, 0.6, 0.15, shirt, 0.36, 1.1, 0);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), lam(skin));
    head.position.y = 1.62;
    g.add(legL); g.add(legR); g.add(torso); g.add(armL); g.add(armR); g.add(head);
    if (rnd() < 0.4) {
      var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 10), lam(0xffd400));
      hat.position.y = 1.78; g.add(hat);
    } else if (rnd() < 0.5) {
      g.add(box(0.4, 0.5, 0.14, 0x8a5a2b, 0, 1.15, -0.24)); // backpack
    }
    g.scale.setScalar(h);
    g.userData = { legL: legL, legR: legR, armL: armL, armR: armR, baseY: 0, phase: rnd() * 6 };
    return g;
  }

  function buildMateo() {
    var g = new THREE.Group();
    g.add(box(0.18, 0.8, 0.22, 0x1a2432, -0.12, 0.4, 0));
    g.add(box(0.18, 0.8, 0.22, 0x1a2432, 0.12, 0.4, 0));
    g.add(box(0.6, 0.68, 0.32, 0xff7a00, 0, 1.12, 0));          // orange jacket
    g.add(box(0.14, 0.62, 0.16, 0xff7a00, -0.38, 1.12, 0));
    var armR = box(0.14, 0.62, 0.16, 0xff7a00, 0.38, 1.12, 0);
    g.add(armR);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lam(0xc98d64));
    head.position.y = 1.66; g.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.09, 10), lam(0x101826));
    cap.position.y = 1.82; g.add(cap);
    // Pistol held in the right hand.
    var gun = box(0.07, 0.12, 0.42, 0x111111, 0.38, 0.86, 0.22);
    gun.name = 'mateo-gun';
    g.add(gun);
    g.userData = { armR: armR, gun: gun };
    return g;
  }

  function buildFallen(shirt) {
    var g = new THREE.Group();
    // Unlit shirts: a fallen figure must read as a body at night, not a
    // black smear on black asphalt.
    g.add(box(0.5, 0.22, 0.85, 0x1a2432, 0, 0.16, -0.55, basic(0x2a3a55)));
    g.add(box(0.6, 0.26, 0.9, shirt, 0, 0.2, 0.3, basic(shirt)));
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lam(0xc98d64));
    head.position.set(0, 0.2, 0.95); g.add(head);
    var arm = box(0.14, 0.14, 0.7, shirt, 0.4, 0.16, 0.3);
    g.add(arm);
    return g;
  }

  // ------------------------------------------------------------ market
  function addMarketStall(parent, x, z, rotY, name, stripeA, stripeB, seed) {
    var rnd = mulberry32(seed);
    var g = new THREE.Group();
    g.add(box(3.2, 1.05, 1.7, 0x6b4226, 0, 0.55, 0));
    g.add(box(3.3, 0.08, 1.8, 0x8a5a2b, 0, 1.12, 0));
    for (var i = 0; i < 4; i++) {
      var px = i < 2 ? -1.5 : 1.5, pz = i % 2 ? -0.8 : 0.8;
      g.add(box(0.09, 2.4, 0.09, 0x3a3a3a, px, 1.2, pz));
    }
    var canopy = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.6),
      // Unlit stripes: at night the kiosk lights carry the frame, so the
      // canopy must stay colourful instead of going black like Lambert.
      new THREE.MeshBasicMaterial({ map: stripeTexture(stripeA, stripeB), side: THREE.DoubleSide }));
    canopy.rotation.x = -Math.PI / 2 + 0.22;
    canopy.position.set(0, 2.55, 0);
    g.add(canopy);
    // Lit name board on the canopy front.
    addSign(g, { text: name, kind: 'fascia', x: 0, y: 2.5, z: 1.28, rotY: 0,
      w: 3.0, h: 0.85, bg: '#12002b', fg: stripeA === '#ffffff' ? '#ffd400' : '#ffffff' });
    // Goods: a row of small bright boxes on the counter (unlit, so the
    // stall still reads as stocked at night).
    for (var k = 0; k < 6; k++) {
      var col = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
      g.add(box(0.34, 0.3 + rnd() * 0.25, 0.34, col, -1.2 + k * 0.48, 1.32, (rnd() - 0.5) * 0.7, basic(col)));
    }
    // Warm bulb string across the front.
    for (var b = 0; b < 7; b++) {
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd98a }));
      bulb.position.set(-1.5 + b * 0.5, 2.28 - Math.sin(b / 6 * Math.PI) * 0.12, 1.15);
      g.add(bulb);
    }
    // Paper lantern.
    var lan = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5d5d }));
    lan.position.set(1.7, 2.0, 0.9);
    g.add(lan);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  }

  function addKiosk(parent, x, z, name, color) {
    var g = new THREE.Group();
    g.add(box(3.0, 2.5, 2.4, color, 0, 1.25, 0));
    g.add(box(3.4, 0.18, 2.8, 0x222222, 0, 2.6, 0));
    g.add(box(2.6, 0.9, 0.1, 0xffd98a, 0, 1.5, 1.22, basic(0xffd98a)));
    addSign(g, { text: name, kind: 'fascia', x: 0, y: 3.15, z: 1.25, rotY: 0,
      w: 2.8, h: 0.8, bg: '#12002b', fg: '#ffd400' });
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }

  // ------------------------------------------------------------ build
  function buildWorld(scene) {
    var world = new THREE.Group();
    scene.add(world);
    var refs = { group: world, signs: signRegistry, lampMats: [] };

    // ---- sky dome (saturated sunset) + night variant
    var skySunset = canvasTex(1024, 512, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0.0, '#0b3d91'); gr.addColorStop(0.45, '#1f6fd6');
      gr.addColorStop(0.72, '#5aa9e6'); gr.addColorStop(0.88, '#ffb347');
      gr.addColorStop(1.0, '#ff7e2e');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (var i = 0; i < 26; i++) {
        var cx = (i * 173) % w, cy = 60 + (i * 97) % 190;
        g.beginPath(); g.ellipse(cx, cy, 34 + (i % 5) * 9, 9 + (i % 3) * 4, 0, 0, Math.PI * 2); g.fill();
      }
    });
    var skyNight = canvasTex(1024, 512, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0.0, '#020617'); gr.addColorStop(0.6, '#0b1530'); gr.addColorStop(1.0, '#241a3d');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      for (var i = 0; i < 140; i++) g.fillRect((i * 137) % w, (i * 89) % (h * 0.6), 2, 2);
    });
    var skyMat = new THREE.MeshBasicMaterial({ map: skySunset, side: THREE.BackSide, fog: false });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(820, 24, 16), skyMat);
    world.add(sky);
    refs.skyMat = skyMat; refs.skySunset = skySunset; refs.skyNight = skyNight;

    // ---- sun disc + glow over the sea (east), moon for night.
    // fog:false on all of them: at 700 m out, scene fog would wash the
    // saturated sunset to pale blue (the v6.4 first-pass bug).
    var sun = new THREE.Mesh(new THREE.CircleGeometry(30, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
    sun.position.set(700, 62, 0); sun.lookAt(0, 62, 0);
    world.add(sun);
    var glowTex = canvasTex(256, 256, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,220,120,0.85)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(260, 260),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false }));
    glow.position.set(690, 62, 0); glow.lookAt(0, 62, 0);
    world.add(glow);
    var moon = new THREE.Mesh(new THREE.CircleGeometry(18, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }));
    moon.position.set(-560, 260, -260); moon.lookAt(0, 0, 0); moon.visible = false;
    world.add(moon);
    refs.sun = sun; refs.sunGlow = glow; refs.moon = moon;

    // ---- ground, ocean, distant skyline across the bay
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 420), lam(0x33383f));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.08, 0);
    world.add(ground);
    var ocean = new THREE.Mesh(new THREE.PlaneGeometry(700, 900),
      new THREE.MeshPhongMaterial({ color: 0x0a6fd6, shininess: 110, specular: 0x99ccff }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(585, -0.4, 0);
    world.add(ocean);
    var distant = new THREE.Group();
    for (var di = 0; di < 9; di++) {
      var dh = 22 + (di * 37) % 46;
      distant.add(box(18, dh, 18, 0x2b4a6b, 520 + (di % 3) * 40, dh / 2 - 0.4, -170 + di * 42));
    }
    world.add(distant);

    // ---- roads
    var roadTex = roadTexture();
    roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(40, 1);
    var oceanRoad = new THREE.Mesh(new THREE.PlaneGeometry(495, 16),
      new THREE.MeshLambertMaterial({ map: roadTex }));
    oceanRoad.rotation.x = -Math.PI / 2; oceanRoad.position.set(-12, 0, 0);
    world.add(oceanRoad);
    CROSS_X.forEach(function (cx) {
      var rt = roadTexture(); rt.wrapS = THREE.RepeatWrapping; rt.wrapT = THREE.RepeatWrapping;
      rt.repeat.set(26, 1);
      var r = new THREE.Mesh(new THREE.PlaneGeometry(300, 12), new THREE.MeshLambertMaterial({ map: rt }));
      r.rotation.x = -Math.PI / 2; r.rotation.z = Math.PI / 2;
      r.position.set(cx, 0.01, 0);
      world.add(r);
    });
    // Sidewalks along Ocean Drive.
    [-11, 11].forEach(function (z) {
      var sw = new THREE.Mesh(new THREE.PlaneGeometry(495, 5.5), lam(0x9aa0a8));
      sw.rotation.x = -Math.PI / 2; sw.position.set(-12, 0.02, z);
      world.add(sw);
    });
    // Park grass + parking asphalt.
    var grass = new THREE.Mesh(new THREE.PlaneGeometry(56, 40), lam(0x3f9e4d));
    grass.rotation.x = -Math.PI / 2; grass.position.set(10, 0.02, 50);
    world.add(grass);
    var lot = new THREE.Mesh(new THREE.PlaneGeometry(56, 44), lam(0x2b2f38));
    lot.rotation.x = -Math.PI / 2; lot.position.set(128, 0.02, 50);
    world.add(lot);

    // ---- buildings + towers (towers carry big fascia signs too, so the
    // northbound shot has readable signage dead ahead, not bare glass)
    BUILDINGS.forEach(function (b) { addBuilding(world, b); });
    var TOWER_SIGNS = ['ARCADE', 'HOTEL OCEAN', 'CINEMA', 'DANCE HALL', 'MARKET', 'PIER 9'];
    TOWERS.forEach(function (t, ti) {
      var tex = facadeTexture(t.base, t.w + t.h, Math.max(4, Math.round(t.h / 5)), 5);
      var m = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d),
        new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(t.x, t.h / 2, t.z);
      world.add(m);
      var faceDir = t.z < 0 ? 1 : -1;
      addSign(world, { text: TOWER_SIGNS[ti % TOWER_SIGNS.length], kind: 'fascia',
        x: t.x, y: 13, z: t.z + faceDir * (t.d / 2 + 0.2), rotY: faceDir > 0 ? 0 : Math.PI,
        w: 19, h: 3.6, bg: '#12002b', fg: ti % 2 ? '#00e5ff' : '#ffd400' });
    });

    // ---- palms, lamps
    for (var pi = 0; pi < 22; pi++) {
      var px = -240 + pi * 22;
      addPalm(world, px, pi % 2 ? -13.8 : 13.8, 100 + pi);
    }
    for (var li = 0; li < 12; li++) addLamp(world, -230 + li * 42, li % 2 ? -8.6 : 8.6);
    addLamp(world, -150, 24); addLamp(world, -130, 24);

    // ---- pier (east end, into the sea)
    var pier = new THREE.Group();
    pier.add(box(70, 1.2, 16, 0x8a5a2b, 0, 0.4, 0));
    for (var pp = 0; pp < 8; pp++) pier.add(box(0.8, 2.4, 0.8, 0x5b3a1a, -32 + pp * 9, -0.6, 7.4));
    pier.add(box(70, 0.9, 0.3, 0xd8d8d8, 0, 1.4, 7.9));
    pier.add(box(70, 0.9, 0.3, 0xd8d8d8, 0, 1.4, -7.9));
    pier.position.set(272, 0, 0);
    world.add(pier);
    addKiosk(world, 258, -5, 'PIER 9', 0x2b6cb0);
    addKiosk(world, 288, 5, 'JUICE', 0x2f9e44);

    // ---- night market street (x = -140, z 30..130)
    var stallNames = [
      ['TACOS', '#ff5d00', '#ffd400'], ['JUICE', '#00e5ff', '#ffffff'],
      ['FLOWERS', '#ff2fb3', '#ffffff'], ['SNACKS', '#ffd400', '#ff5d00'],
      ['SOUVENIR', '#00ffb3', '#001a2e'], ['GRILL', '#ff8c42', '#4d0e00'],
      ['DONUTS', '#ff9de2', '#3a0033'], ['ICE CREAM', '#7df9ff', '#002b4d'],
    ];
    for (var si = 0; si < 8; si++) {
      var sz = 40 + si * 11;
      var sx = si % 2 ? -130 : -150;
      addMarketStall(world, sx, sz, si % 2 ? -Math.PI / 2 : Math.PI / 2,
        stallNames[si][0], stallNames[si][1], stallNames[si][2], 300 + si);
    }

    // ---- park: trees, benches, kiosks, vendor carts
    for (var ti = 0; ti < 7; ti++) {
      var tx = -12 + (ti % 4) * 16, tz = 34 + Math.floor(ti / 4) * 24;
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 7), lam(0x7a5230));
      trunk.position.set(tx, 1.5, tz); world.add(trunk);
      var fol = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), lam(0x2f9e44));
      fol.position.set(tx, 4.2, tz); world.add(fol);
    }
    for (var bi = 0; bi < 4; bi++) {
      world.add(box(2.2, 0.12, 0.6, 0x8a5a2b, -8 + bi * 14, 0.55, 42));
      world.add(box(0.14, 0.55, 0.55, 0x333333, -8.8 + bi * 14, 0.28, 42));
      world.add(box(0.14, 0.55, 0.55, 0x333333, -7.2 + bi * 14, 0.28, 42));
    }
    addKiosk(world, 28, 66, 'JUICE', 0x2f9e44);
    addKiosk(world, -6, 66, 'SNACKS', 0xb03a2e);
    // Vendor carts on the Ocean Drive sidewalks.
    [[-60, -11.5], [30, 11.5], [120, -11.5], [180, 11.5]].forEach(function (p, vi) {
      var cart = new THREE.Group();
      cart.add(box(1.6, 0.9, 1.0, 0xd8d8d8, 0, 0.55, 0));
      var umb = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.8, 8),
        lam(vi % 2 ? 0xff2fb3 : 0x00e5ff));
      umb.position.y = 2.0; cart.add(umb);
      cart.add(box(0.08, 1.2, 0.08, 0x333333, 0, 1.4, 0));
      cart.position.set(p[0], 0, p[1]);
      world.add(cart);
    });

    // ---- parking lot: painted bays + parked cars (filled, no empty rows)
    for (var bl = 0; bl < 12; bl++) {
      world.add(box(0.18, 0.02, 5.4, 0xe8e8e8, 108 + bl * 3.6, 0.06, 50));
    }
    var parked = [];
    for (var pk = 0; pk < 14; pk++) {
      var col = CAR_COLORS[pk % CAR_COLORS.length];
      var style = pk % 5 === 0 ? 'van' : (pk % 3 === 0 ? 'hatch' : 'sedan');
      var car = buildTrafficCar(col, style);
      // Rows at z=36 and z=64 keep the Arrow's bay at (128,40) clear.
      car.position.set(110 + (pk % 7) * 5.6, 0, pk < 7 ? 36 : 64);
      car.rotation.y = pk < 7 ? Math.PI / 2 : -Math.PI / 2;
      world.add(car);
      parked.push(car);
    }
    refs.parkedCars = parked;

    // ---- gates for M2 (glowing rings) + market beacon
    var gates = [];
    [[170, 0], [100, -60], [40, -120]].forEach(function (gp, gi) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.28, 10, 28),
        new THREE.MeshBasicMaterial({ color: 0xffd400 }));
      ring.position.set(gp[0], 3.6, gp[1]);
      ring.rotation.y = Math.PI / 2;
      ring.visible = false;
      world.add(ring);
      gates.push(ring);
    });
    var beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.4,
        side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.set(-140, 17, 132);
    beacon.visible = false;
    world.add(beacon);
    refs.gates = gates; refs.beacon = beacon;

    refs.signCount = signRegistry.length;
    return refs;
  }

  window.PHWORLD = {
    buildWorld: buildWorld,
    buildHeroCar: buildHeroCar,
    buildPoliceCar: buildPoliceCar,
    buildTrafficCar: buildTrafficCar,
    buildHeli: buildHeli,
    buildPed: buildPed,
    buildMateo: buildMateo,
    buildFallen: buildFallen,
    CAR_COLORS: CAR_COLORS,
    CROSS_X: CROSS_X,
    signRegistry: signRegistry,
  };
})();
