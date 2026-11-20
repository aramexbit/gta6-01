// PIER HEAT — Sunset Bay (v6.5)
// core.js — renderer, sky and sun, lights, materials, texture helpers,
// and a minimal glTF 2.0 loader (no external loader library is vendored).
// Everything here is original code written for this game.
(function () {
  var PH = window.PH = window.PH || {};
  var core = PH.core = {};

  // ---------------------------------------------------------------- utils
  core.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  core.lerp = function (a, b, t) { return a + (b - a) * t; };
  core.deg = function (d) { return d * Math.PI / 180; };

  // Deterministic seeded random so the city is the same on every load.
  core.mulberry32 = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), s | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  core.pick = function (rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; };

  // ------------------------------------------------------- geometry cache
  var geoCache = {};
  core.boxGeo = function (w, h, d) {
    var k = 'b' + w + ',' + h + ',' + d;
    if (!geoCache[k]) geoCache[k] = new THREE.BoxGeometry(w, h, d);
    return geoCache[k];
  };
  core.cylGeo = function (rt, rb, h, seg) {
    var k = 'c' + rt + ',' + rb + ',' + h + ',' + seg;
    if (!geoCache[k]) geoCache[k] = new THREE.CylinderGeometry(rt, rb, h, seg || 10);
    return geoCache[k];
  };
  core.sphGeo = function (r, w, h) {
    var k = 's' + r + ',' + w + ',' + h;
    if (!geoCache[k]) geoCache[k] = new THREE.SphereGeometry(r, w || 10, h || 8);
    return geoCache[k];
  };
  core.planeGeo = function (w, h) {
    var k = 'p' + w + ',' + h;
    if (!geoCache[k]) geoCache[k] = new THREE.PlaneGeometry(w, h);
    return geoCache[k];
  };

  // ------------------------------------------------------- material cache
  var toonGrad = null;
  core.toonGradient = function () {
    if (toonGrad) return toonGrad;
    // 3-step toon ramp: dark / mid / bright.
    var data = new Uint8Array([110, 175, 235, 255]);
    toonGrad = new THREE.DataTexture(data, 4, 1, THREE.LuminanceFormat);
    toonGrad.minFilter = THREE.NearestFilter;
    toonGrad.magFilter = THREE.NearestFilter;
    toonGrad.needsUpdate = true;
    return toonGrad;
  };
  var matCache = {};
  core.mat = function (color, opts) {
    opts = opts || {};
    var key = color + '|' + (opts.toon ? 't' : (opts.phong ? 'p' : 'l')) + '|' +
      (opts.emissive ? 'e' : '') + '|' + (opts.shininess || 0) + '|' + (opts.opacity || 1);
    if (matCache[key]) return matCache[key];
    var m;
    if (opts.emissive) {
      m = new THREE.MeshBasicMaterial({ color: color });
      if (opts.opacity < 1) { m.transparent = true; m.opacity = opts.opacity; }
    } else if (opts.phong) {
      m = new THREE.MeshPhongMaterial({
        color: color, shininess: opts.shininess || 60,
        specular: opts.specular || 0x334455
      });
    } else if (opts.toon) {
      m = new THREE.MeshToonMaterial({ color: color, gradientMap: core.toonGradient() });
    } else {
      m = new THREE.MeshLambertMaterial({ color: color });
    }
    if (opts.opacity < 1 && !opts.emissive) { m.transparent = true; m.opacity = opts.opacity; }
    matCache[key] = m;
    return m;
  };
  // Dark glass with a painted sky reflection: the windshield gradient is
  // baked into the canvas texture, so it reads as glass from any angle.
  // Kept DARK on purpose — a bright cabin reads as a solid coloured box.
  var glassTex = null;
  core.glassMat = function () {
    if (!glassTex) {
      var cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
      var g = cv.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, '#5a7a9a'); gr.addColorStop(0.45, '#1c3448');
      gr.addColorStop(0.55, '#0c1622'); gr.addColorStop(1, '#04070d');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(18, 52); g.lineTo(58, 8); g.lineTo(76, 8); g.lineTo(40, 52); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(70, 52); g.lineTo(102, 14); g.lineTo(112, 14); g.lineTo(84, 52); g.closePath(); g.fill();
      glassTex = new THREE.CanvasTexture(cv);
      glassTex.colorSpace = THREE.SRGBColorSpace;
    }
    return new THREE.MeshPhongMaterial({
      map: glassTex, shininess: 120, specular: 0x99ccff, color: 0xffffff
    });
  };

  core.mesh = function (geo, material, x, y, z) {
    var m = new THREE.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  };
  core.box = function (w, h, d, color, x, y, z, opts) {
    return core.mesh(core.boxGeo(w, h, d), core.mat(color, opts), x, y, z);
  };

  // ------------------------------------------------------------------ sky
  var skyMat, sunMesh, sunGlow, starPts, hemi, sunLight;
  var DAY = {
    top: 0x241257, mid: 0xb8327f, horizon: 0xff9a3c,
    fog: 0x3a1c52, hemiSky: 0x8a6fd0, hemiGround: 0x2a1a2a,
    sun: 0xffb36b, sunIntensity: 1.15, hemiIntensity: 0.8
  };
  var NIGHT = {
    top: 0x04040f, mid: 0x0b0b2e, horizon: 0x241640,
    fog: 0x0a0a20, hemiSky: 0x2a2a55, hemiGround: 0x0c0a12,
    sun: 0xffb36b, sunIntensity: 0.25, hemiIntensity: 0.55
  };

  core.init = function (canvas) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(1280, 720, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var scene = new THREE.Scene();
    // Fog colours the city, never the sky or the sun (their materials opt
    // out with fog:false — a v6.4 bug where fog washed the sunset out).
    scene.fog = new THREE.Fog(DAY.fog, 70, 280);
    var camera = new THREE.PerspectiveCamera(55, 1280 / 720, 0.1, 900);
    camera.position.set(0, 6, -14);

    hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity);
    scene.add(hemi);
    sunLight = new THREE.DirectionalLight(DAY.sun, DAY.sunIntensity);
    sunLight.position.set(120, 26, 18);
    scene.add(sunLight);
    var fill = new THREE.DirectionalLight(0x66ccff, 0.3);
    fill.position.set(-60, 40, -80);
    scene.add(fill);

    // Sky dome: gradient shader, BackSide, fog:false so fog can never
    // flatten the sunset colours.
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      uniforms: {
        cTop: { value: new THREE.Color(DAY.top) },
        cMid: { value: new THREE.Color(DAY.mid) },
        cBot: { value: new THREE.Color(DAY.horizon) }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; ' +
        'gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cBot;' +
        'void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(cMid, cTop, smoothstep(0.12, 0.65, h)) : mix(cBot, cMid, smoothstep(-0.08, 0.12, h));' +
        ' gl_FragColor = vec4(c, 1.0); }'
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(430, 24, 16), skyMat);
    scene.add(sky);

    // Low sun over the ocean, east (+X). MeshBasicMaterial ignores light
    // and fog, so it stays a hot orange-gold disc.
    sunMesh = core.mesh(new THREE.CircleGeometry(24, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false }), 400, 34, 26);
    sunMesh.lookAt(0, 34, 26);
    scene.add(sunMesh);
    sunGlow = core.glowSprite(0xff8a2a, 190);
    sunGlow.position.set(400, 34, 26);
    scene.add(sunGlow);

    // Stars for the night market shot (hidden in daylight).
    var starGeo = new THREE.BufferGeometry();
    var sp = [];
    var srng = core.mulberry32(99);
    for (var i = 0; i < 420; i++) {
      var a = srng() * Math.PI * 2, e = 0.12 + srng() * 1.2, r = 410;
      sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    starPts = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false,
      transparent: true, opacity: 0.9
    }));
    starPts.visible = false;
    scene.add(starPts);

    // Ocean: teal-green plane east of the beach, plus foam strips.
    var ocean = core.mesh(core.planeGeo(220, 340),
      new THREE.MeshPhongMaterial({ color: 0x0f7a6e, shininess: 90, specular: 0x88ddcc }),
      245, 0.0, 0);
    ocean.rotation.x = -Math.PI / 2;
    scene.add(ocean);
    for (var f = 0; f < 3; f++) {
      var foam = core.box(1.6, 0.06, 300, 0xdff5ee, 137 + f * 3.5, 0.06, 0);
      scene.add(foam);
    }
    // Dark ground base under the whole city.
    var ground = core.mesh(core.planeGeo(420, 420),
      new THREE.MeshLambertMaterial({ color: 0x23202e }), 30, -0.06, 0);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    core.renderer = renderer; core.scene = scene; core.camera = camera;
    core.sunMesh = sunMesh; core.sunGlow = sunGlow;
    core.mode = 'sunset';
    return core;
  };

  core.setTimeOfDay = function (mode) {
    var P = mode === 'night' ? NIGHT : DAY;
    core.mode = mode;
    skyMat.uniforms.cTop.value.setHex(P.top);
    skyMat.uniforms.cMid.value.setHex(P.mid);
    skyMat.uniforms.cBot.value.setHex(P.horizon);
    core.scene.fog.color.setHex(P.fog);
    hemi.color.setHex(P.hemiSky); hemi.groundColor.setHex(P.hemiGround);
    hemi.intensity = P.hemiIntensity;
    sunLight.intensity = P.sunIntensity;
    sunMesh.visible = mode !== 'night';
    sunGlow.visible = mode !== 'night';
    starPts.visible = mode === 'night';
  };

  // ------------------------------------------------------------ glow sprite
  var glowTex = null;
  core.glowTexture = function () {
    if (glowTex) return glowTex;
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(cv);
    return glowTex;
  };
  core.glowSprite = function (color, scale, opacity) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: core.glowTexture(), color: color, transparent: true,
      opacity: opacity === undefined ? 1 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    sp.scale.set(scale, scale, 1);
    return sp;
  };

  // ------------------------------------------------------- canvas textures
  // All signage is painted on canvas at runtime: no image assets, no
  // network, and every shop name stays crisp and readable.
  core.textTexture = function (text, opts) {
    opts = opts || {};
    var w = opts.w || 512, h = opts.h || 128;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    g.fillStyle = opts.bg || '#14101f'; g.fillRect(0, 0, w, h);
    if (opts.border) {
      g.strokeStyle = opts.border; g.lineWidth = opts.borderW || 6;
      g.strokeRect(6, 6, w - 12, h - 12);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var size = opts.size || Math.floor(h * 0.52);
    g.font = '900 ' + size + 'px Arial, sans-serif';
    if (opts.glow) {
      g.shadowColor = opts.glow; g.shadowBlur = opts.glowBlur || 22;
    }
    g.fillStyle = opts.fg || '#ffe9b0';
    g.fillText(text, w / 2, h / 2 - (opts.sub ? size * 0.22 : 0));
    if (opts.sub) {
      g.shadowBlur = 0;
      g.font = '700 ' + Math.floor(size * 0.42) + 'px Arial, sans-serif';
      g.fillStyle = opts.subFg || '#ffb347';
      g.fillText(opts.sub, w / 2, h / 2 + size * 0.42);
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  // Building facade: pastel wall, a grid of windows (some lit warm, some
  // curtained, some dark), a darker ground floor with a shopfront.
  core.facadeTexture = function (wallColor, floors, cols, rng, litRatio) {
    var w = 256, h = 256;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    g.fillStyle = wallColor; g.fillRect(0, 0, w, h);
    // faint vertical panel seams
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (var px = 0; px < w; px += 32) g.fillRect(px, 0, 2, h);
    var cw = w / cols, ch = (h - 34) / floors;
    for (var f = 0; f < floors; f++) {
      for (var c = 0; c < cols; c++) {
        var x = c * cw + cw * 0.25, y = 6 + f * ch + ch * 0.18;
        var ww = cw * 0.5, hh = ch * 0.62;
        var r = rng();
        if (r < litRatio) g.fillStyle = '#ffd98a';            // lit warm
        else if (r < litRatio + 0.12) g.fillStyle = '#7fb8c9'; // curtained
        else g.fillStyle = '#1d2436';                          // dark glass
        g.fillRect(x, y, ww, hh);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x, y, ww, 3); // top glint
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
        g.strokeRect(x, y, ww, hh);
        if (r >= litRatio && r < litRatio + 0.12) {
          g.fillStyle = 'rgba(255,120,160,0.5)';
          g.fillRect(x + ww * 0.15, y + hh * 0.2, ww * 0.7, hh * 0.16);
        }
      }
    }
    // ground floor shopfront: dark band + glass + door
    g.fillStyle = '#241a2e'; g.fillRect(0, h - 34, w, 34);
    g.fillStyle = '#3a2f4d'; g.fillRect(6, h - 30, w - 12, 22);
    g.fillStyle = '#9fd8ff'; g.fillRect(10, h - 28, w * 0.55, 18);
    g.fillStyle = '#5a3a22'; g.fillRect(w * 0.68, h - 28, w * 0.2, 18);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  // Striped awning canvas (red/white, teal/white, etc).
  core.awningTexture = function (c1, c2) {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    var g = cv.getContext('2d');
    for (var i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? c1 : c2;
      g.fillRect(i * 16, 0, 16, 64);
    }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (var s = 0; s < 8; s++) g.fillRect(0, s * 8, 128, 2);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  // License plate: white, dark border, small text.
  core.plateTexture = function (text) {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
    var g = cv.getContext('2d');
    g.fillStyle = '#f4f1de'; g.fillRect(0, 0, 128, 32);
    g.strokeStyle = '#223344'; g.lineWidth = 3; g.strokeRect(2, 2, 124, 28);
    g.fillStyle = '#182438'; g.font = '900 20px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 17);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  // ------------------------------------------------------ minimal GLB loader
  // glTF 2.0, binary container only, no skinning, no animation: the bind
  // pose is rendered as-is. Textures come from embedded bufferViews.
  // Returns a Promise of a THREE.Group, or null when the file is absent
  // or cannot be parsed (the caller falls back to the procedural model).
  core.loadGLB = function (url) {
    return fetch(url).then(function (res) {
      if (!res.ok) return null;
      return res.arrayBuffer();
    }).then(function (buf) {
      if (!buf) return null;
      var dv = new DataView(buf);
      if (dv.getUint32(0, true) !== 0x46546C67) return null; // 'glTF'
      var jsonLen = dv.getUint32(12, true);
      var jsonText = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
      var json = JSON.parse(jsonText.replace(/\0+$/, ''));
      var binOff = 20 + jsonLen + 8;
      var bin = new Uint8Array(buf, binOff);
      var compBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
      function readAcc(ai) {
        var acc = json.accessors[ai];
        var bv = json.bufferViews[acc.bufferView];
        var base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        var nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
        var cb = compBytes[acc.componentType];
        var stride = bv.byteStride || cb * nComp;
        var arr;
        if (acc.componentType === 5126) arr = new Float32Array(acc.count * nComp);
        else if (acc.componentType === 5123) arr = new Uint16Array(acc.count * nComp);
        else if (acc.componentType === 5125) arr = new Uint32Array(acc.count * nComp);
        else arr = new Uint8Array(acc.count * nComp);
        var view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
        for (var i = 0; i < acc.count; i++) {
          for (var c = 0; c < nComp; c++) {
            var p = base + i * stride + c * cb;
            var v;
            if (acc.componentType === 5126) v = view.getFloat32(p, true);
            else if (acc.componentType === 5123) v = view.getUint16(p, true);
            else if (acc.componentType === 5125) v = view.getUint32(p, true);
            else v = view.getUint8(p);
            arr[i * nComp + c] = v;
          }
        }
        return arr;
      }
      function materialFor(mi) {
        var def = (json.materials || [])[mi] || {};
        var pbr = def.pbrMetallicRoughness || {};
        var color = 0xffffff, opacity = 1;
        if (pbr.baseColorFactor) {
          color = new THREE.Color(pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2]);
          opacity = pbr.baseColorFactor[3];
        }
        var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.85, metalness: 0.05 });
        if (opacity < 1) { mat.transparent = true; mat.opacity = opacity; }
        if (pbr.baseColorTexture !== undefined && json.textures && json.images) {
          var texDef = json.textures[pbr.baseColorTexture.index];
          var imgDef = json.images[texDef.source];
          if (imgDef && imgDef.bufferView !== undefined) {
            var ibv = json.bufferViews[imgDef.bufferView];
            var blob = new Blob([bin.slice(ibv.byteOffset || 0, (ibv.byteOffset || 0) + ibv.byteLength)],
              { type: imgDef.mimeType || 'image/png' });
            var img = new Image();
            img.src = URL.createObjectURL(blob);
            mat.map = new THREE.Texture(img);
            mat.map.colorSpace = THREE.SRGBColorSpace;
            img.onload = function () { mat.map.needsUpdate = true; };
          }
        }
        return mat;
      }
      function buildNode(ni) {
        var nd = json.nodes[ni];
        var obj = new THREE.Group();
        obj.name = nd.name || ('node' + ni);
        if (nd.matrix) {
          var m = new THREE.Matrix4();
          m.fromArray(nd.matrix);
          m.decompose(obj.position, obj.quaternion, obj.scale);
        } else {
          if (nd.translation) obj.position.fromArray(nd.translation);
          if (nd.rotation) obj.quaternion.fromArray(nd.rotation);
          if (nd.scale) obj.scale.fromArray(nd.scale);
        }
        if (nd.mesh !== undefined) {
          var meshDef = json.meshes[nd.mesh];
          meshDef.primitives.forEach(function (prim) {
            var geo = new THREE.BufferGeometry();
            var pos = readAcc(prim.attributes.POSITION);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            if (prim.attributes.NORMAL) {
              geo.setAttribute('normal', new THREE.BufferAttribute(readAcc(prim.attributes.NORMAL), 3));
            }
            if (prim.attributes.TEXCOORD_0) {
              geo.setAttribute('uv', new THREE.BufferAttribute(readAcc(prim.attributes.TEXCOORD_0), 2));
            }
            if (prim.indices !== undefined) {
              geo.setIndex(new THREE.BufferAttribute(readAcc(prim.indices), 1));
            }
            var mesh = new THREE.Mesh(geo, materialFor(prim.material || 0));
            obj.add(mesh);
          });
        }
        (nd.children || []).forEach(function (ci) { obj.add(buildNode(ci)); });
        return obj;
      }
      var root = new THREE.Group();
      var sceneDef = json.scenes[json.scene || 0];
      (sceneDef.nodes || []).forEach(function (ni) { root.add(buildNode(ni)); });
      return root;
    }).catch(function () { return null; });
  };
})();
