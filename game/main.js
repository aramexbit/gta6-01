// PIER HEAT — Sunset Bay (v6.6)
// main.js — boot, camera, input, HUD, procedural WebAudio, and the debug
// staging API the screenshot harness uses (?shot=1..4, PH.debug.*).
// v6.6: the loop drives core.tick so the ocean, clouds and cloud shadows move.
(function () {
  var PH = window.PH = window.PH || {};
  var core = PH.core, world = PH.world, sim = PH.sim;

  var params = new URLSearchParams(location.search);
  var shotParam = params.get('shot');
  var autoStart = params.get('autostart') === '1' || !!shotParam;

  var canvas = document.getElementById('game');
  core.init(canvas);
  world.build(core.scene);
  sim.init(core.scene);

  // ------------------------------------------------------------ audio
  // All sound is synthesised in WebAudio: engine hum, two-tone siren,
  // gunshot noise. No audio assets, no network.
  var audio = PH.audio = {
    ctx: null, engineOsc: null, engineGain: null, sirenOsc: null,
    ensure: function () {
      try {
        if (this.ctx) return;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        var lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 320;
        this.engineOsc.connect(lp); lp.connect(this.engineGain);
        this.engineOsc.start();
      } catch (e) { /* silent without audio */ }
    },
    engine: function (speed) {
      if (!this.ctx || !this.engineOsc) return;
      this.engineOsc.frequency.value = 50 + Math.abs(speed) * 4;
      this.engineGain.gain.value = 0.02 + Math.min(0.05, Math.abs(speed) * 0.002);
    },
    gunshot: function () {
      try {
        if (!this.ctx) return;
        var len = this.ctx.sampleRate * 0.12;
        var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = this.ctx.createBufferSource();
        src.buffer = buf;
        var g = this.ctx.createGain(); g.gain.value = 0.25;
        src.connect(g); g.connect(this.ctx.destination);
        src.start();
      } catch (e) {}
    },
    sirenBurst: function () {
      try {
        if (!this.ctx) return;
        var o = this.ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 750;
        var g = this.ctx.createGain(); g.gain.value = 0.05;
        o.connect(g); g.connect(this.ctx.destination);
        o.start();
        var t = 0, self = this;
        var iv = setInterval(function () {
          t++;
          o.frequency.value = t % 2 ? 950 : 750;
          if (t > 5) { clearInterval(iv); try { o.stop(); } catch (e) {} }
        }, 320);
      } catch (e) {}
    }
  };
  window.addEventListener('pointerdown', function () { audio.ensure(); }, { once: true });
  window.addEventListener('keydown', function () { audio.ensure(); }, { once: true });

  // ------------------------------------------------------------ input
  var keys = {};
  var yaw = 0, pitch = 0;
  window.addEventListener('keydown', function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'e' || e.key === 'E') sim.toggleEnterExit();
    if (e.key === ' ') { keys.space = true; e.preventDefault(); }
    if (e.key >= '1' && e.key <= '4') {
      var w = ['Fists', 'Pistol', 'SMG', 'Rifle'][+e.key - 1];
      sim.state.weapon = w;
      sim.state.ammo = w === 'Fists' ? 0 : (w === 'Pistol' ? 24 : (w === 'SMG' ? 60 : 12));
    }
    if (e.key === 'f' || e.key === 'F') sim.shoot();
  });
  window.addEventListener('keyup', function (e) {
    keys[e.key.toLowerCase()] = false;
    if (e.key === ' ') keys.space = false;
  });
  canvas.addEventListener('click', function () {
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (e) {}
    }
  });
  document.addEventListener('mousemove', function (e) {
    if (document.pointerLockElement === canvas) {
      yaw -= e.movementX * 0.0025;
      pitch = core.clamp(pitch - e.movementY * 0.002, -0.5, 0.4);
    }
  });
  canvas.addEventListener('mousedown', function (e) {
    if (e.button === 0) sim.shoot();
  });

  // ------------------------------------------------------------ camera
  var camTarget = { pos: new THREE.Vector3(0, 6, -14), look: new THREE.Vector3(0, 1, 0) };
  var camMode = 'free';
  function setStageCam(stage) {
    camMode = 'stage';
    camTarget.pos.copy(stage.cam);
    camTarget.look.copy(stage.look);
    core.camera.position.copy(stage.cam);
    core.camera.lookAt(stage.look);
  }
  function updateCamera(dt) {
    var cam = core.camera;
    if (camMode === 'stage') {
      cam.position.copy(camTarget.pos);
      cam.lookAt(camTarget.look);
      return;
    }
    // free play: 3/4 chase cam, low and close, so the car's doors and
    // windows stay readable while driving.
    // v6.6 fix: follow the figure actually in use — mateoFigure() is the
    // vendored GLB when it loaded. mateo() is the procedural stand-in,
    // which stays at the origin when the GLB is active, so the old code
    // pointed the camera at an empty intersection 60 m from Mateo.
    var hero = sim.state.onFoot ? sim.mateoFigure().position : null;
    var hx, hz, heading;
    if (sim.state.onFoot) {
      hx = hero.x; hz = hero.z; heading = sim.mateoFigure().rotation.y;
      var bx = hx - Math.sin(heading) * 5.5, bz = hz - Math.cos(heading) * 5.5;
      cam.position.set(bx, 2.4 + pitch * 2, bz);
      cam.lookAt(hx, 1.5, hz);
    } else {
      var hp = sim.heroCar().position;
      heading = sim.heroCar().rotation.y;
      var fx = Math.cos(heading), fz = -Math.sin(heading);
      var rx = -fz, rz = fx; // right side of the car
      var cx = hp.x - fx * 8.5 + rx * 4.5;
      var cz = hp.z - fz * 8.5 + rz * 4.5;
      cam.position.lerp(new THREE.Vector3(cx, 2.6 + pitch * 2, cz), Math.min(1, dt * 5));
      cam.lookAt(hp.x + fx * 4, 1.1, hp.z + fz * 4);
    }
  }

  // ------------------------------------------------------------ HUD
  var el = {};
  ['wanted-stars', 'money', 'mission-name', 'mission-stage', 'mission-timer',
   'dispatch-board', 'weapon-name', 'weapon-ammo', 'health-bar', 'armour-bar',
   'respect-bar', 'speed', 'kira-text', 'hud', 'title-screen', 'crosshair',
   'minimap', 'kira-portrait', 'toast'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });
  var lastHud = '';
  function updateHUD() {
    var h = sim.getHUD();
    var key = h.wanted + '|' + h.money + '|' + h.respect + '|' + h.health + '|' +
      h.armour + '|' + h.weapon + '|' + h.ammo + '|' + h.mission.stage + '|' +
      Math.ceil(h.mission.timer) + '|' + h.speed + '|' + h.onFoot;
    el['wanted-stars'].textContent = '★'.repeat(h.wanted) + '☆'.repeat(5 - h.wanted);
    el['money'].textContent = '$' + h.money.toLocaleString('en-US');
    el['mission-name'].textContent = 'M' + h.mission.id.slice(1) + ' — ' + h.mission.name;
    el['mission-stage'].textContent = 'STAGE ' + h.mission.stage + '/' + h.mission.stages;
    var t = Math.max(0, Math.ceil(h.mission.timer));
    el['mission-timer'].textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    el['weapon-name'].textContent = h.weapon;
    el['weapon-ammo'].textContent = h.weapon === 'Fists' ? '—' : h.ammo;
    el['health-bar'].style.width = h.health + '%';
    el['armour-bar'].style.width = h.armour + '%';
    el['respect-bar'].style.width = Math.min(100, h.respect) + '%';
    el['speed'].textContent = h.speed + ' km/h';
    if (key !== lastHud) {
      lastHud = key;
      var db = h.dispatch.map(function (d) {
        return '<div class="drow"><span>' + d.unit + '</span><span>' + d.dist +
          'm</span><b>' + d.tactic + '</b></div>';
      }).join('');
      el['dispatch-board'].innerHTML = db;
      el['crosshair'].style.display = h.onFoot ? 'block' : 'none';
    }
  }
  // Kira's portrait: painted once on a 2D canvas — headset, dark hair,
  // confident smile. She is the radio handler, not a photograph.
  function drawKira() {
    var cv = el['kira-portrait'];
    if (!cv) return;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, 96, 96);
    g.fillStyle = '#1a2a4a'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#e8b88a';
    g.beginPath(); g.arc(48, 50, 26, 0, Math.PI * 2); g.fill(); // face
    g.fillStyle = '#1a1a1a'; // hair
    g.beginPath(); g.arc(48, 40, 27, Math.PI, 0); g.fill();
    g.fillRect(20, 40, 10, 26); g.fillRect(66, 40, 10, 26);
    g.fillStyle = '#14161c'; // eyes
    g.beginPath(); g.arc(38, 50, 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(58, 50, 3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#14161c'; g.lineWidth = 2; // smile
    g.beginPath(); g.arc(48, 60, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.strokeStyle = '#00e5ff'; g.lineWidth = 4; // headset band
    g.beginPath(); g.arc(48, 48, 29, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.fillStyle = '#00e5ff'; // ear cups
    g.fillRect(16, 46, 6, 12); g.fillRect(74, 46, 6, 12);
    g.fillStyle = '#ffe9b0'; g.font = 'bold 11px Arial';
    g.fillText('KIRA', 38, 90);
  }
  drawKira();
  // Kira's lines rotate with the mission stage.
  var KIRA_LINES = {
    chase: 'Kira: "Sunset\'s on your tail, Mateo. Two units on your bumper — thread the roadblock at the pier end, don\'t stop."',
    street: 'Kira: "They\'re boxing you in — left and right. Punch through the gap before the roadblock closes."',
    mission: 'Kira: "Market\'s hot. Three gates left, Mateo. The beacon marks the drop — clear the stalls and move."',
    title: 'Kira: "Mateo, you\'re live. Sunset Bay is yours — just don\'t let the Bay City PD write the ending."'
  };
  function setKira(stage) {
    if (el['kira-text']) el['kira-text'].textContent = KIRA_LINES[stage] || KIRA_LINES.title;
  }
  setKira('title');

  // ------------------------------------------------------------ minimap
  var mmCtx = el['minimap'] ? el['minimap'].getContext('2d') : null;
  var mmTimer = 0;
  function drawMinimap(dt) {
    if (!mmCtx) return;
    mmTimer += dt;
    if (mmTimer < 0.15) return;
    mmTimer = 0;
    var g = mmCtx, S = 180;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#14101f'; g.fillRect(0, 0, S, S);
    function toMap(x, z) { return [(x + 80) / 220 * S, (z + 80) / 160 * S]; }
    // ocean + beach
    g.fillStyle = '#0f7a6e';
    var oc = toMap(138, -80); g.fillRect(oc[0], 0, S - oc[0], S);
    g.fillStyle = '#e8c98a';
    var bc = toMap(100, -80); g.fillRect(bc[0], 0, oc[0] - bc[0], S);
    // roads
    g.strokeStyle = '#5a5470'; g.lineWidth = 5;
    [-60, -30, 0, 30, 60].forEach(function (v) {
      var a = toMap(v, -75), b = toMap(v, 75);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      var c = toMap(-75, v), d = toMap(100, v);
      g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke();
    });
    // mission beacon
    var bp = toMap(-45, 62);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.arc(bp[0], bp[1], 5, 0, Math.PI * 2); g.fill();
    // police (blue dots) — dispatch order
    var h = sim.getHUD();
    var hp = toMap(h.hero.x, h.hero.z);
    g.fillStyle = '#ff5a1a';
    g.beginPath(); g.arc(hp[0], hp[1], 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(hp[0], hp[1], 5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffe9b0'; g.font = 'bold 11px Arial';
    g.fillText('N', 8, 14);
  }

  // ------------------------------------------------------------ title
  var started = false;
  function startGame() {
    if (started) return;
    started = true;
    if (el['title-screen']) el['title-screen'].style.display = 'none';
    if (el['hud']) el['hud'].style.display = 'block';
    camMode = 'free';
    sim.freePlay();
    setKira('chase');
  }
  var btn = document.getElementById('btn-start');
  if (btn) btn.addEventListener('click', startGame);

  // ------------------------------------------------------------ staging
  var STAGES = { '1': 'chase', '2': 'street', '3': 'mission', '4': 'title' };
  function applyStage(name) {
    var framing = sim.stage(name);
    setStageCam(framing);
    setKira(name);
    if (el['title-screen']) el['title-screen'].style.display = name === 'title' ? 'flex' : 'none';
    if (el['hud']) el['hud'].style.display = name === 'title' ? 'none' : 'block';
    updateHUD();
  }
  PH.debug = {
    stageChase: function () { applyStage('chase'); return sim.counts(); },
    stageStreet: function () { applyStage('street'); return sim.counts(); },
    stageMission: function () { applyStage('mission'); return sim.counts(); },
    stageTitle: function () { applyStage('title'); return sim.counts(); },
    counts: function () { return sim.counts(); },
    hud: function () { return sim.getHUD(); },
    stage: function (n) { applyStage(n); return sim.counts(); }
  };

  // Mateo's vendored GLB, when present: the loader tries vendor/mateo.glb
  // and the game keeps its procedural Mateo when the file is absent.
  var glbSettled = false;
  core.loadGLB('vendor/mateo.glb').then(function (g) {
    window.__MATEO_GLB = g ? 'loaded' : 'absent';
    if (g) sim.setMateoGLB(g);
    glbSettled = true;
  }).catch(function () {
    window.__MATEO_GLB = 'absent';
    glbSettled = true;
  });
  setTimeout(function () { glbSettled = true; }, 4000);

  // ------------------------------------------------------------ main loop
  var clock = new THREE.Clock();
  var frames = 0;
  var input = {
    get w() { return !!keys['w'] || !!keys['arrowup']; },
    get a() { return !!keys['a'] || !!keys['arrowleft']; },
    get s() { return !!keys['s'] || !!keys['arrowdown']; },
    get d() { return !!keys['d'] || !!keys['arrowright']; },
    get space() { return !!keys['space']; }
  };
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    core.tick(dt);
    sim.update(dt, input);
    updateCamera(dt);
    audio.engine(sim.state.onFoot ? 0 : sim.state.speed || 0);
    core.renderer.render(core.scene, core.camera);
    updateHUD();
    drawMinimap(dt);
    frames++;
    if (!window.__PIERHEAT_READY && glbSettled && frames >= 3) {
      window.__PIERHEAT_READY = true;
    }
  }

  // Boot: a ?shot= param stages that shot at once; ?autostart=1 skips the
  // title screen into free play; otherwise the title screen waits.
  if (shotParam && STAGES[shotParam]) {
    applyStage(STAGES[shotParam]);
  } else if (autoStart) {
    startGame();
  }
  loop();
})();
