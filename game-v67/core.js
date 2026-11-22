// PIER HEAT — Sunset Bay (v6.6)
// core.js — renderer, sky and sun, lights, materials, texture helpers,
// and a minimal glTF 2.0 loader (no external loader library is vendored).
// Everything here is original code written for this game.
// v6.6: bright cloudy DAY mode (saturated blue sky, procedural clouds,
// drifting cloud shadows), golden-hour SUNSET without the dark magenta,
// Gerstner-style animated ocean with sky reflection and shoreline foam,
// and facade helpers (sky-reflecting glass, contact AO).
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

  // Dark reflective shopfront glass: deep blue-green, high specular, so a
  // wide shop window reads as glass, not a lit yellow billboard.
  core.shopGlassMat = function () {
    return new THREE.MeshPhongMaterial({
      color: 0x2e4a66, shininess: 160, specular: 0xbbddff
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
  var skyMat, sunMesh, sunGlow, starPts, hemi, sunLight, oceanMat, cloudGroup;
  // SUNSET is golden hour: a blue top fading into warm orange, never the
  // dark magenta of v6.5. DAY is bright noon: saturated blue, high sun,
  // sharp shadows, layered procedural clouds.
  var SUNSET = {
    top: 0x1e3a7a, mid: 0xf08a3c, horizon: 0xffb347,
    fog: 0x8a5f6a, hemiSky: 0x8a7fd0, hemiGround: 0x3a2a2a,
    sun: 0xffb36b, sunIntensity: 1.15, hemiIntensity: 0.8,
    exposure: 1.0, cloud: 0.28, oceanSky: 0xff9a5a, oceanDeep: 0x0f5a5e,
    sunPos: [120, 26, 18], sunAt: [400, 34, 26], sunScale: 1
  };
  var DAY = {
    top: 0x1565d8, mid: 0x4aa3e8, horizon: 0xbfe3f7,
    fog: 0x9fc8e8, hemiSky: 0xbfe0ff, hemiGround: 0x8a7a5a,
    sun: 0xfff3c9, sunIntensity: 1.7, hemiIntensity: 1.05,
    exposure: 1.15, cloud: 0.55, oceanSky: 0x7ec0e8, oceanDeep: 0x0a5a7a,
    sunPos: [90, 180, 60], sunAt: [150, 210, 60], sunScale: 0.55
  };
  var NIGHT = {
    top: 0x04040f, mid: 0x0b0b2e, horizon: 0x241640,
    fog: 0x0a0a20, hemiSky: 0x2a2a55, hemiGround: 0x0c0a12,
    sun: 0xffb36b, sunIntensity: 0.25, hemiIntensity: 0.55,
    exposure: 0.9, cloud: 0.0, oceanSky: 0x0a1a3a, oceanDeep: 0x06121f,
    sunPos: [120, 26, 18], sunAt: [400, 34, 26], sunScale: 1
  };

  core.init = function (canvas) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(1280, 720, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Filmic tone mapping keeps the bright day sky from clipping to white
    // while the sunset stays warm; exposure is set per time of day.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    // Sharp sun shadows in daylight: one 2048 shadow map over the city.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    // Fog colours the city, never the sky or the sun (their materials opt
    // out with fog:false — a v6.4 bug where fog washed the sunset out).
    scene.fog = new THREE.Fog(SUNSET.fog, 70, 280);
    var camera = new THREE.PerspectiveCamera(55, 1280 / 720, 0.1, 900);
    camera.position.set(0, 6, -14);

    hemi = new THREE.HemisphereLight(SUNSET.hemiSky, SUNSET.hemiGround, SUNSET.hemiIntensity);
    scene.add(hemi);
    sunLight = new THREE.DirectionalLight(SUNSET.sun, SUNSET.sunIntensity);
    sunLight.position.set(120, 26, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -130; sunLight.shadow.camera.right = 130;
    sunLight.shadow.camera.top = 130; sunLight.shadow.camera.bottom = -130;
    sunLight.shadow.camera.near = 10; sunLight.shadow.camera.far = 520;
    sunLight.shadow.bias = -0.0006;
    scene.add(sunLight);
    scene.add(sunLight.target);
    var fill = new THREE.DirectionalLight(0x66ccff, 0.3);
    fill.position.set(-60, 40, -80);
    scene.add(fill);

    // Sky dome: gradient shader with layered procedural clouds (value-noise
    // fbm, two octaves, drifting with time). BackSide, fog:false so fog
    // can never flatten the sunset colours. Cloud cover is a uniform:
    // heavy at noon, light at golden hour, none at night.
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      uniforms: {
        cTop: { value: new THREE.Color(SUNSET.top) },
        cMid: { value: new THREE.Color(SUNSET.mid) },
        cBot: { value: new THREE.Color(SUNSET.horizon) },
        uCloud: { value: SUNSET.cloud },
        uTime: { value: 0 },
        uCloudTint: { value: new THREE.Color(0xffe8c9) }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; ' +
        'gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cBot;' +
        'uniform float uCloud; uniform float uTime; uniform vec3 uCloudTint;' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
        'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);' +
        ' return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }' +
        'float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.13; a *= 0.5; } return v; }' +
        'void main(){ vec3 d = normalize(vP); float h = d.y;' +
        ' vec3 c = h > 0.12 ? mix(cMid, cTop, smoothstep(0.12, 0.65, h)) : mix(cBot, cMid, smoothstep(-0.08, 0.12, h));' +
        ' if (uCloud > 0.01 && h > 0.02) {' +
        '  vec2 cuv = d.xz / (h + 0.18);' +
        '  float n = fbm(cuv * 1.4 + vec2(uTime * 0.004, uTime * 0.0015));' +
        '  float n2 = fbm(cuv * 3.1 - vec2(uTime * 0.006, 0.0));' +
        '  float cl = smoothstep(1.0 - uCloud - 0.18, 1.0 - uCloud + 0.12, n * 0.75 + n2 * 0.35);' +
        '  vec3 cloudCol = mix(uCloudTint * 0.92, vec3(1.0), clamp(n2 * 1.2, 0.0, 1.0));' +
        '  c = mix(c, cloudCol, cl * smoothstep(0.02, 0.12, h)); }' +
        ' gl_FragColor = vec4(c, 1.0); }'
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(430, 24, 16), skyMat);
    scene.add(sky);

    // Puff clouds: flattened white sphere clusters drifting high above the
    // city, so the sky has real volume, not just a painted dome.
    cloudGroup = new THREE.Group();
    var puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.94 });
    var crng = core.mulberry32(4242);
    for (var ci = 0; ci < 14; ci++) {
      var puff = new THREE.Group();
      var nP = 3 + Math.floor(crng() * 3);
      for (var pi = 0; pi < nP; pi++) {
        var s = core.mesh(core.sphGeo(1, 10, 8), puffMat,
          (pi - 1) * 2.2 + (crng() - 0.5) * 1.5, (crng() - 0.5) * 0.8, (crng() - 0.5) * 2.5);
        s.scale.set(2.2 + crng() * 1.6, 0.9 + crng() * 0.5, 1.8 + crng() * 1.2);
        puff.add(s);
      }
      puff.position.set(-120 + crng() * 360, 55 + crng() * 35, -110 + crng() * 220);
      cloudGroup.add(puff);
    }
    scene.add(cloudGroup);

    // Cloud shadows: big soft dark ellipses drifting across the streets,
    // so part of the city sits in a cloud's shade while the rest is lit.
    core.cloudShadows = [];
    var shTex = core.cloudShadowTexture();
    for (var si = 0; si < 6; si++) {
      var sh = core.mesh(core.planeGeo(26 + crng() * 18, 14 + crng() * 8),
        new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0.16, depthWrite: false }),
        -80 + crng() * 220, 0.12, -80 + crng() * 160);
      sh.rotation.x = -Math.PI / 2;
      scene.add(sh);
      core.cloudShadows.push(sh);
    }

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

    // Ocean: animated waves, sky reflection and shoreline foam, all in
    // one shader. Three travelling sine swells displace the surface and
    // tilt its normals; the fragment mixes deep water into a fresnel sky
    // reflection, adds a sun glint, and lays animated foam lace where the
    // water meets the sand (world x near the 138 waterline).
    oceanMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.9, 0.2, 0.15).normalize() },
        uSky: { value: new THREE.Color(SUNSET.oceanSky) },
        uDeep: { value: new THREE.Color(SUNSET.oceanDeep) },
        uSunCol: { value: new THREE.Color(0xffb347) },
        uFogCol: { value: new THREE.Color(SUNSET.fog) }
      },
      vertexShader:
        'uniform float uTime; varying vec3 vW; varying vec3 vN;' +
        'float wave(vec2 p, vec2 dir, float amp, float len, float speed){' +
        ' float k = 6.28318 / len; return amp * sin(k * (dot(dir, p) - speed * uTime)); }' +
        'void main(){' +
        ' vec2 p = position.xy;' +
        ' float h = wave(p, vec2(1.0, 0.3), 0.35, 26.0, 1.1)' +
        '         + wave(p, vec2(0.7, -0.7), 0.22, 13.0, 1.6)' +
        '         + wave(p, vec2(-0.4, 0.9), 0.12, 7.0, 2.2);' +
        ' float e = 0.6;' +
        ' float hx = wave(p + vec2(e, 0.0), vec2(1.0, 0.3), 0.35, 26.0, 1.1)' +
        '          + wave(p + vec2(e, 0.0), vec2(0.7, -0.7), 0.22, 13.0, 1.6)' +
        '          + wave(p + vec2(e, 0.0), vec2(-0.4, 0.9), 0.12, 7.0, 2.2);' +
        ' float hy = wave(p + vec2(0.0, e), vec2(1.0, 0.3), 0.35, 26.0, 1.1)' +
        '          + wave(p + vec2(0.0, e), vec2(0.7, -0.7), 0.22, 13.0, 1.6)' +
        '          + wave(p + vec2(0.0, e), vec2(-0.4, 0.9), 0.12, 7.0, 2.2);' +
        ' vec3 pos = vec3(position.x, position.y, h);' +
        ' vN = normalize(mat3(modelMatrix) * normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0)));' +
        ' vec4 wp = modelMatrix * vec4(pos, 1.0); vW = wp.xyz;' +
        ' gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader:
        'uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSky; uniform vec3 uDeep;' +
        'uniform vec3 uSunCol; uniform vec3 uFogCol; varying vec3 vW; varying vec3 vN;' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
        'void main(){' +
        ' vec3 V = normalize(cameraPosition - vW);' +
        ' vec3 N = normalize(vN);' +
        ' float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);' +
        ' vec3 col = mix(uDeep, uSky, 0.25 + 0.75 * fres);' +
        ' vec3 R = reflect(-V, N);' +
        ' float glint = pow(max(dot(R, uSunDir), 0.0), 90.0) * 1.6;' +
        ' col += uSunCol * glint;' +
        ' float shore = 1.0 - smoothstep(136.0, 150.0, vW.x);' +
        ' float stripes = 0.5 + 0.5 * sin(vW.x * 2.2 + uTime * 1.4 + sin(vW.z * 0.35) * 1.5);' +
        ' float lace = hash(floor(vW.xz * vec2(2.0, 6.0)) + floor(uTime * 0.7));' +
        ' float foam = shore * smoothstep(0.45, 0.9, stripes * 0.7 + lace * 0.35);' +
        ' col = mix(col, vec3(0.95, 0.98, 0.96), foam * 0.85);' +
        ' float fogF = smoothstep(70.0, 280.0, distance(cameraPosition, vW));' +
        ' col = mix(col, uFogCol, fogF);' +
        ' gl_FragColor = vec4(col, 1.0); }'
    });
    var ocean = new THREE.Mesh(new THREE.PlaneGeometry(220, 340, 44, 60), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(245, 0.0, 0);
    scene.add(ocean);
    core.oceanMat = oceanMat;
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
    var P = mode === 'night' ? NIGHT : (mode === 'day' ? DAY : SUNSET);
    core.mode = mode;
    skyMat.uniforms.cTop.value.setHex(P.top);
    skyMat.uniforms.cMid.value.setHex(P.mid);
    skyMat.uniforms.cBot.value.setHex(P.horizon);
    skyMat.uniforms.uCloud.value = P.cloud;
    skyMat.uniforms.uCloudTint.value.setHex(mode === 'day' ? 0xffffff : 0xffe8c9);
    core.scene.fog.color.setHex(P.fog);
    hemi.color.setHex(P.hemiSky); hemi.groundColor.setHex(P.hemiGround);
    hemi.intensity = P.hemiIntensity;
    sunLight.color.setHex(P.sun);
    sunLight.intensity = P.sunIntensity;
    sunLight.position.set(P.sunPos[0], P.sunPos[1], P.sunPos[2]);
    core.renderer.toneMappingExposure = P.exposure;
    sunMesh.visible = mode !== 'night';
    sunGlow.visible = mode !== 'night';
    sunMesh.position.set(P.sunAt[0], P.sunAt[1], P.sunAt[2]);
    sunMesh.scale.setScalar(P.sunScale);
    sunMesh.material.color.setHex(mode === 'day' ? 0xfff8d0 : 0xffb347);
    sunMesh.lookAt(0, P.sunAt[1], P.sunAt[2]);
    sunGlow.position.set(P.sunAt[0], P.sunAt[1], P.sunAt[2]);
    sunGlow.scale.set(mode === 'day' ? 90 : 190, mode === 'day' ? 90 : 190, 1);
    starPts.visible = mode === 'night';
    // Puff clouds only at noon: in golden hour they rendered as grey
    // floating rocks in the title frame; the shader clouds carry sunset.
    if (cloudGroup) cloudGroup.visible = mode === 'day';
    if (core.cloudShadows) {
      for (var i = 0; i < core.cloudShadows.length; i++) {
        core.cloudShadows[i].visible = mode === 'day';
      }
    }
    if (oceanMat) {
      oceanMat.uniforms.uSky.value.setHex(P.oceanSky);
      oceanMat.uniforms.uDeep.value.setHex(P.oceanDeep);
      oceanMat.uniforms.uSunCol.value.setHex(mode === 'day' ? 0xfff3c9 : 0xffb347);
      oceanMat.uniforms.uFogCol.value.setHex(P.fog);
      oceanMat.uniforms.uSunDir.value.set(
        P.sunPos[0], P.sunPos[1], P.sunPos[2]).normalize();
    }
  };

  // Per-frame animation: ocean time, sky-cloud drift, puff clouds and
  // their ground shadows drifting across the city.
  core.tick = function (dt) {
    if (skyMat) skyMat.uniforms.uTime.value += dt;
    if (oceanMat) oceanMat.uniforms.uTime.value += dt;
    if (cloudGroup && cloudGroup.visible) {
      for (var i = 0; i < cloudGroup.children.length; i++) {
        var p = cloudGroup.children[i];
        p.position.x += dt * 0.6;
        if (p.position.x > 260) p.position.x = -140;
      }
    }
    if (core.cloudShadows) {
      for (var j = 0; j < core.cloudShadows.length; j++) {
        var s = core.cloudShadows[j];
        if (!s.visible) continue;
        s.position.x += dt * 0.8;
        if (s.position.x > 150) s.position.x = -110;
      }
    }
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

  // Building facade: pastel wall, a grid of windows whose glass reflects
  // the sky (a per-pane blue gradient with a diagonal sun streak, not a
  // flat dark slab), frames with sills and centre mullions, lit windows in
  // several different brightnesses, a real door, and a contact-AO gradient
  // darkening the wall where it meets the street.
  core.facadeTexture = function (wallColor, floors, cols, rng, litRatio) {
    var w = 256, h = 256;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    g.fillStyle = wallColor; g.fillRect(0, 0, w, h);
    // faint vertical panel seams + speckle so the wall is not flat colour
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (var px = 0; px < w; px += 32) g.fillRect(px, 0, 2, h);
    for (var sp = 0; sp < 260; sp++) {
      g.fillStyle = 'rgba(0,0,0,' + (rng() * 0.05) + ')';
      g.fillRect(rng() * w, rng() * (h - 34), 2, 2);
    }
    var cw = w / cols, ch = (h - 34) / floors;
    for (var f = 0; f < floors; f++) {
      for (var c = 0; c < cols; c++) {
        var x = c * cw + cw * 0.25, y = 6 + f * ch + ch * 0.18;
        var ww = cw * 0.5, hh = ch * 0.62;
        var r = rng();
        if (r < litRatio * 0.5) g.fillStyle = '#fff2c9';       // bright lit
        else if (r < litRatio) g.fillStyle = '#ffd98a';        // lit warm
        else if (r < litRatio + 0.1) g.fillStyle = '#ff9a5a';  // lit amber
        else if (r < litRatio + 0.22) g.fillStyle = '#7fb8c9'; // curtained
        else {
          // sky-reflecting glass: pale blue at the top, deep blue below,
          // with a diagonal sun streak — the pane mirrors the sky.
          var gr = g.createLinearGradient(x, y, x, y + hh);
          gr.addColorStop(0, '#cfe8ff'); gr.addColorStop(0.45, '#5a8fc9');
          gr.addColorStop(1, '#16283e');
          g.fillStyle = gr;
        }
        g.fillRect(x, y, ww, hh);
        if (r >= litRatio + 0.22) {
          // diagonal sun streak + top glint on the reflective panes
          g.fillStyle = 'rgba(255,255,255,0.4)';
          g.beginPath();
          g.moveTo(x + ww * 0.1, y + hh); g.lineTo(x + ww * 0.55, y);
          g.lineTo(x + ww * 0.72, y); g.lineTo(x + ww * 0.27, y + hh);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.3)';
          g.fillRect(x, y, ww, 3);
          // centre mullion splits the pane in two
          g.fillStyle = 'rgba(20,24,36,0.8)';
          g.fillRect(x + ww / 2 - 1, y, 2, hh);
        }
        // frame + sill: the window sits in the wall, not on it
        g.strokeStyle = '#20242e'; g.lineWidth = 3;
        g.strokeRect(x - 1, y - 1, ww + 2, hh + 2);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x - 3, y + hh + 2, ww + 6, 3);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x - 3, y + hh + 5, ww + 6, 2);
        if (r >= litRatio && r < litRatio + 0.1) {
          g.fillStyle = 'rgba(255,120,160,0.5)';
          g.fillRect(x + ww * 0.15, y + hh * 0.2, ww * 0.7, hh * 0.16);
        }
      }
    }
    // ground floor shopfront: dark band + glass + a real door
    g.fillStyle = '#241a2e'; g.fillRect(0, h - 34, w, 34);
    g.fillStyle = '#3a2f4d'; g.fillRect(6, h - 30, w - 12, 22);
    g.fillStyle = '#9fd8ff'; g.fillRect(10, h - 28, w * 0.55, 18);
    g.fillStyle = '#5a3a22'; g.fillRect(w * 0.68, h - 28, w * 0.2, 18);
    g.strokeStyle = '#c9a86a'; g.lineWidth = 2;
    g.strokeRect(w * 0.68, h - 28, w * 0.2, 18);
    g.fillStyle = '#f2f2f2'; g.fillRect(w * 0.83, h - 20, 3, 4); // handle
    // contact AO: the wall darkens where it meets the pavement
    var ao = g.createLinearGradient(0, h - 16, 0, h);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = ao; g.fillRect(0, h - 16, w, 16);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  // Plain wall (panel seams + base AO, no painted windows) for facades
  // that carry real 3D recessed windows instead.
  core.plainWallTexture = function (wallColor) {
    var w = 256, h = 256;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    g.fillStyle = wallColor; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (var px = 0; px < w; px += 32) g.fillRect(px, 0, 2, h);
    for (var sp = 0; sp < 260; sp++) {
      g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.05) + ')';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    var ao = g.createLinearGradient(0, h - 20, 0, h);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = ao; g.fillRect(0, h - 20, w, 20);
    var tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  // Soft radial shadow blob, used for cloud shadows on the streets and
  // for the dark pool under each building (contact AO on the ground).
  var cloudShadowTex = null;
  core.cloudShadowTexture = function () {
    if (cloudShadowTex) return cloudShadowTex;
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.85)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0.4)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    cloudShadowTex = new THREE.CanvasTexture(cv);
    return cloudShadowTex;
  };

  // Vertical AO strip for the base of a facade: dark at the pavement,
  // fading out as it rises.
  core.aoStripTexture = function () {
    var cv = document.createElement('canvas'); cv.width = 16; cv.height = 64;
    var g = cv.getContext('2d');
    var gr = g.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 64);
    var tex = new THREE.CanvasTexture(cv);
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
