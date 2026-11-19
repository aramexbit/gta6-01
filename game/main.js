// PIER HEAT — main.js
// Boot, keyboard/mouse input, shooting and car entry, the main loop, and
// all procedural WebAudio: engine hum, two-tone siren, gunshots and the
// original Nightwave radio loop (oscillators only — no recorded music).
(function () {
  'use strict';
  var PH = window.PH, G = PH.G, U = PH.utils;
  var W = PH.world;

  var input = { w: false, a: false, s: false, d: false, shift: false, space: false };
  var mouse = { down: false, aiming: false };
  var lastE = 0, lastF = 0;
  var clock = { last: performance.now() };
  var idleAngle = 0;

  // --- audio ---------------------------------------------------------------
  var AC = null, master = null, engineOsc = null, engineGain = null,
      sirenOsc = null, sirenGain = null, radioTimer = null, radioStep = 0;

  function ensureAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.5;
      master.connect(AC.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = AC.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = AC.createGain();
      engineGain.gain.value = 0.0;
      var engineFilter = AC.createBiquadFilter();
      engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that alternates between two notes.
      sirenOsc = AC.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = AC.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startRadioLoop();
    } catch (e) { AC = null; }
  }

  function startRadioLoop() {
    if (radioTimer || !AC) return;
    radioTimer = setInterval(function () {
      if (!G.started || G.paused) return;
      var st = PH.STATIONS[G.radio];
      var beat = 60 / st.bpm / 2; // eighth notes
      var step = radioStep++;
      var scale = st.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
      var deg = scale[step % scale.length];
      var freq = st.root * Math.pow(2, deg / 12) * (step % 16 < 8 ? 1 : 2);
      // Bass on the beat.
      if (step % 2 === 0) {
        var bass = AC.createOscillator();
        bass.type = 'triangle';
        bass.frequency.value = st.root / 2;
        var bg = AC.createGain();
        bg.gain.setValueAtTime(0.16, AC.currentTime);
        bg.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + beat * 1.8);
        bass.connect(bg); bg.connect(master);
        bass.start(); bass.stop(AC.currentTime + beat * 2);
      }
      // Plucky lead note.
      var lead = AC.createOscillator();
      lead.type = 'square';
      lead.frequency.value = freq;
      var lg = AC.createGain();
      lg.gain.setValueAtTime(0.05, AC.currentTime);
      lg.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + beat * 0.9);
      lead.connect(lg); lg.connect(master);
      lead.start(); lead.stop(AC.currentTime + beat);
      // Hat tick.
      if (step % 2 === 1) {
        var hat = AC.createOscillator();
        hat.type = 'sine'; hat.frequency.value = 6000;
        var hg = AC.createGain();
        hg.gain.setValueAtTime(0.02, AC.currentTime);
        hg.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.03);
        hat.connect(hg); hg.connect(master);
        hat.start(); hat.stop(AC.currentTime + 0.04);
      }
    }, 60 / PH.STATIONS[G.radio].bpm * 500);
  }

  function sfx(name) {
    if (!AC) return;
    var t = AC.currentTime;
    function blip(freq, dur, type, vol, slideTo) {
      var o = AC.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      var g = AC.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, vol, freq) {
      var len = Math.floor(AC.sampleRate * dur);
      var buf = AC.createBuffer(1, len, AC.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = AC.createBufferSource();
      src.buffer = buf;
      var f = AC.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 3000;
      var g = AC.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    }
    if (name === 'shot') noise(0.14, 0.5, 2400);
    else if (name === 'heliShot') noise(0.1, 0.18, 1800);
    else if (name === 'door') blip(180, 0.12, 'triangle', 0.25, 90);
    else if (name === 'cash') { blip(880, 0.12, 'sine', 0.25); setTimeout(function () { if (AC) blip(1320, 0.2, 'sine', 0.25); }, 110); }
    else if (name === 'checkpoint') { blip(660, 0.1, 'square', 0.18); setTimeout(function () { if (AC) blip(990, 0.16, 'square', 0.18); }, 100); }
    else if (name === 'hurt') blip(140, 0.25, 'sawtooth', 0.25, 60);
    else if (name === 'emp') { noise(0.5, 0.3, 900); blip(1200, 0.4, 'sine', 0.2, 100); }
    else if (name === 'smoke') noise(0.6, 0.2, 600);
  }
  PH.sfx = sfx;

  function updateAudio(dt) {
    if (!AC) return;
    var speed = G.player.onFoot ? G.player.speed : (PH.sim.playerCar ? Math.abs(PH.sim.playerCar.speed) : 0);
    var target = G.started && !G.paused ? U.clamp(0.03 + speed * 0.004, 0, 0.16) : 0;
    engineGain.gain.setTargetAtTime(target, AC.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(50 + speed * 6, AC.currentTime, 0.1);
    // Two-tone siren while wanted.
    if (G.wanted >= 1 && G.started && !G.paused) {
      sirenGain.gain.setTargetAtTime(0.045, AC.currentTime, 0.2);
      var phase = Math.floor(G.time * 1.6) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(phase ? 720 : 960, AC.currentTime, 0.05);
    } else {
      sirenGain.gain.setTargetAtTime(0, AC.currentTime, 0.2);
    }
  }

  // --- input ---------------------------------------------------------------
  function keyCode(e) { return e.code || e.key; }

  window.addEventListener('keydown', function (e) {
    var c = keyCode(e);
    if (c === 'KeyW' || c === 'ArrowUp') input.w = true;
    else if (c === 'KeyA' || c === 'ArrowLeft') input.a = true;
    else if (c === 'KeyS' || c === 'ArrowDown') input.s = true;
    else if (c === 'KeyD' || c === 'ArrowRight') input.d = true;
    else if (c === 'ShiftLeft' || c === 'ShiftRight') input.shift = true;
    else if (c === 'Space') { input.space = true; e.preventDefault(); }
    else if (c === 'KeyE') {
      var now = performance.now();
      if (now - lastE > 350) { lastE = now; toggleCar(); }
    }
    else if (c === 'KeyF') {
      var nowF = performance.now();
      if (nowF - lastF > 260) { lastF = nowF; tryShoot(); }
    }
    else if (c === 'KeyR') {
      G.radio = (G.radio + 1) % PH.STATIONS.length;
      radioStep = 0;
      PH.toast('📻 ' + PH.STATIONS[G.radio].name + ' — ' + PH.STATIONS[G.radio].track, 2000);
    }
    else if (c === 'KeyP') togglePause();
    else if (c === 'Digit1') PH.simApi.useEmp();
    else if (c === 'Digit2') PH.simApi.useSmoke();
  });
  window.addEventListener('keyup', function (e) {
    var c = keyCode(e);
    if (c === 'KeyW' || c === 'ArrowUp') input.w = false;
    else if (c === 'KeyA' || c === 'ArrowLeft') input.a = false;
    else if (c === 'KeyS' || c === 'ArrowDown') input.s = false;
    else if (c === 'KeyD' || c === 'ArrowRight') input.d = false;
    else if (c === 'ShiftLeft' || c === 'ShiftRight') input.shift = false;
    else if (c === 'Space') input.space = false;
  });

  var canvas = document.getElementById('game-canvas');
  canvas.addEventListener('click', function () {
    if (G.started && !G.paused && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (e) {}
    }
  });
  document.addEventListener('mousemove', function (e) {
    if (!G.started || G.paused) return;
    var dx = 0, dy = 0;
    if (document.pointerLockElement === canvas) {
      dx = e.movementX || 0; dy = e.movementY || 0;
    } else if (mouse.down) {
      dx = (e.clientX - (mouse.lx || e.clientX));
      dy = (e.clientY - (mouse.ly || e.clientY));
      mouse.lx = e.clientX; mouse.ly = e.clientY;
    } else return;
    G.cam.yaw -= dx * 0.0032;
    G.cam.pitch = U.clamp(G.cam.pitch + dy * 0.0026, -1.05, 1.05); // ±60°
  });
  canvas.addEventListener('mousedown', function (e) {
    mouse.down = true; mouse.lx = e.clientX; mouse.ly = e.clientY;
    if (e.button === 2) { mouse.aiming = true; G.player.aiming = true; }
    if (e.button === 0 && G.player.aiming) tryShoot();
  });
  window.addEventListener('mouseup', function (e) {
    mouse.down = false;
    if (e.button === 2) { mouse.aiming = false; G.player.aiming = false; }
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function toggleCar() {
    if (!G.started || G.paused) return;
    if (G.player.onFoot) {
      var car = PH.simApi.nearestCar(4.5);
      if (car) PH.simApi.enterCar(car);
      else PH.toast('No car close by — walk up to one and press E.', 1800);
    } else {
      PH.simApi.exitCar();
    }
  }

  function tryShoot() {
    if (!G.started || G.paused || !G.player.onFoot) return;
    G.player.aiming = true;
    setTimeout(function () { if (!mouse.aiming) G.player.aiming = false; }, 350);
    PH.simApi.shoot();
  }

  function togglePause() {
    if (!G.started) return;
    G.paused = !G.paused;
    document.getElementById('pause-screen').style.display = G.paused ? 'flex' : 'none';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // --- scene presets (for screenshots and playtests) ------------------------
  function applyScene(name) {
    if (name === 'chase') {
      // Player in the Arrow, mid-chase toward the sunset: wanted 3, two
      // cruisers close behind, the heli overhead, traffic ahead.
      var car = PH.sim.missionCar;
      PH.simApi.enterCar(car);
      car.x = 60; car.z = 44; car.heading = Math.PI / 2; car.speed = 22;
      G.player.x = car.x; G.player.z = car.z;
      PH.crime.setWanted(3, 'scene-chase');
      PH.simApi.spawnPoliceCar(52, 44);
      PH.simApi.spawnPoliceCar(44, 44);
      // One cruiser ahead on the road, in frame, lights flashing.
      var ahead = PH.simApi.spawnPoliceCar(96, 44);
      ahead.heading = Math.PI / 2;
      PH.simApi.spawnFootCop(70, 52);
      PH.sim.heli = null;
      var heli = PH.builders.makeHeli();
      heli.group.position.set(95, 32, 58);
      W.scene.add(heli.group);
      var cop = { kind: 'heli', x: 80, z: 20, heading: 0, speed: 0, mesh: heli.group, heli: heli, state: 'pursuit', lockT: 4, name: 'Air-1', shootT: 0 };
      PH.sim.cops.push(cop);
      PH.sim.heli = cop;
      G.cam.yaw = Math.PI / 2;
      PH.simApi.updateCamera(1);
      // Face the sun: the camera sits behind the car looking east.
      G.cam.yaw = Math.PI / 2;
    } else if (name === 'street') {
      PH.test.teleport(120, 44);
      G.cam.yaw = -Math.PI / 2;
      G.player.heading = -Math.PI / 2;
      PH.simApi.updateCamera(1);
    } else if (name === 'mission') {
      // Mateo on the road north of the Arrow, aiming straight at it and the
      // gold beacon — no palm or building between camera and target.
      PH.test.teleport(44, 28);
      G.player.heading = 0;
      G.player.aiming = true;
      G.cam.yaw = 0;
      G.cam.pitch = 0.1;
      PH.simApi.updateCamera(1);
    }
  }

  // --- boot -----------------------------------------------------------------
  function boot() {
    var loading = document.getElementById('loading');
    try {
      PH.worldInit(canvas);
      PH.simInit();
      // Idle camera framing for the start screen.
      W.camera.position.set(-60, 26, 150);
      W.camera.lookAt(40, 4, 0);
      loading.style.display = 'none';
    } catch (err) {
      loading.textContent = 'Could not start the game: ' + err.message;
      window.__PH_ERROR__ = String(err && err.stack || err);
      return;
    }
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    var params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') startGame();
    if (params.get('scene')) setTimeout(function () { applyScene(params.get('scene')); }, 600);
    requestAnimationFrame(loop);
  }

  function startGame() {
    if (G.started) return;
    ensureAudio();
    G.started = true;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('hud').classList.remove('hidden');
    PH.simApi.updateCamera(1);
    PH.toast('Welcome to Sunset Bay, Mateo.', 3000);
  }
  PH.startGame = startGame;
  PH.applyScene = applyScene;

  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - clock.last) / 1000 || 0.016);
    clock.last = now;
    if (!G.started) {
      // Slow cinematic orbit behind the start screen.
      idleAngle += dt * 0.03;
      W.camera.position.set(Math.sin(idleAngle) * 170, 42 + Math.sin(idleAngle * 0.6) * 8, Math.cos(idleAngle) * 170);
      W.camera.lookAt(20, 6, 0);
      W.renderer.render(W.scene, W.camera);
      return;
    }
    if (!G.paused) {
      PH.simUpdate(dt, input);
      updateAudio(dt);
    }
    W.renderer.render(W.scene, W.camera);
  }

  window.addEventListener('error', function (e) {
    window.__PH_ERROR__ = String(e.message);
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__PH_ERROR__ = String(e.reason);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
