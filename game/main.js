// PIER HEAT — Sunset Bay: boot, input, shooting, main loop, procedural sound.
// Wires the HUD in index.html to the simulation in sim.js and the world in
// world.js. No network, no assets: every sound is a WebAudio oscillator.

(function () {
  'use strict';
  var PH = window.PH;
  var sim = PH.sim;

  var canvas = document.getElementById('game-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(20, 4, 8);

  sim.init(scene);
  sim.updateCamera(0.01, camera);

  // ------------------------------------------------------------ audio
  var AudioSys = {
    ctx: null, engineOsc: null, engineGain: null, musicOsc: [], musicGain: null, sirenOsc: null, sirenGain: null, started: false,
    init: function () {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Engine hum: two detuned saws through a lowpass, gain follows speed.
        this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
        var filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
        this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
        var osc2 = this.ctx.createOscillator(); osc2.type = 'sawtooth'; osc2.frequency.value = 82;
        this.engineOsc.connect(filt); osc2.connect(filt);
        filt.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start(); osc2.start(); this.engineOsc2 = osc2;
        // Siren: two-tone square, quiet until wanted >= 1.
        this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
        this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'square'; this.sirenOsc.frequency.value = 700;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
        this.sirenOsc.start();
        // Radio: original synth loop — a slow minor arpeggio.
        this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.05;
        this.musicGain.connect(this.ctx.destination);
        this.musicStep = 0;
        this.musicTimer = setInterval(this.musicTick.bind(this), 240);
        this.started = true;
      } catch (e) { /* audio unavailable: play silent */ }
    },
    musicTick: function () {
      if (!this.ctx || !PH.state.radioOn) return;
      var scale = PH.state.radio === 0 ? [110, 130.8, 164.8, 196, 220, 261.6] : PH.state.radio === 1 ? [98, 123.5, 146.8, 196, 246.9] : [82.4, 110, 164.8, 220];
      var f = scale[this.musicStep % scale.length];
      this.musicStep++;
      var o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * 2;
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      o.connect(g); g.connect(this.musicGain);
      o.start(); o.stop(this.ctx.currentTime + 0.55);
    },
    gunshot: function () {
      if (!this.ctx) return;
      var dur = 0.14;
      var buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      var src = this.ctx.createBufferSource(); src.buffer = buf;
      var g = this.ctx.createGain(); g.gain.value = 0.5;
      src.connect(g); g.connect(this.ctx.destination); src.start();
    },
    update: function () {
      if (!this.ctx) return;
      var st = PH.state;
      var speed = st.inCar ? Math.abs(sim.playerCarData ? sim.playerCarData.speed : 0) : 0;
      if (this.engineGain) this.engineGain.gain.value = st.inCar ? 0.03 + speed * 0.002 : 0;
      if (this.engineOsc) this.engineOsc.frequency.value = 50 + speed * 4;
      if (this.engineOsc2) this.engineOsc2.frequency.value = 75 + speed * 6;
      if (this.sirenGain) {
        this.sirenGain.gain.value = st.wanted >= 1 ? 0.02 : 0;
        if (this.sirenOsc) this.sirenOsc.frequency.value = 620 + 180 * Math.sin(sim.elapsed * 4);
      }
    },
  };

  // ------------------------------------------------------------ HUD
  var el = {};
  ['mission-title', 'mission-objective', 'mission-progress', 'money', 'stars', 'wanted-label',
   'radio-name', 'radio-desc', 'police-feed', 'ammo', 'items', 'speed', 'health-bar', 'car-bar',
   'health-num', 'car-num', 'dialogue', 'dialogue-name', 'dialogue-text', 'toast',
   'start-screen', 'pause-screen', 'busted-screen', 'busted-text'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });
  var minimap = document.getElementById('minimap');
  var mm = minimap.getContext('2d');

  function updateHUD() {
    var st = PH.state;
    var m = PH.currentMission();
    if (m) {
      el['mission-title'].textContent = m.title;
      var obj = m.objective;
      if (st.missionIndex === 3 && st.missionStage === 1) obj = 'Return Kira’s drop to the pier';
      if (st.missionIndex === 7 && st.missionStage === 1) obj = 'Lose the 3-star tail — stay unseen 22 s';
      if (st.missionIndex === 6) obj = 'Escape through checkpoint ' + (sim.checkpointIndex + 1) + ' of 3';
      el['mission-objective'].textContent = obj;
      el['mission-progress'].style.width = Math.round(PH.clamp(st.missionProgress, 0, 1) * 100) + '%';
    } else {
      el['mission-title'].textContent = 'FREE ROAM — SUNSET BAY';
      el['mission-objective'].textContent = 'All 8 missions complete. The bay is yours, Mateo.';
      el['mission-progress'].style.width = '100%';
    }
    el.money.textContent = PH.fmtMoney(st.money);
    el.stars.textContent = PH.starsText(st.wanted);
    el['wanted-label'].textContent = 'WANTED ' + st.wanted + (st.wanted > 0 ? ' — LOSE THE TAIL' : ' — CLEAN');
    el['wanted-label'].style.color = st.wanted > 0 ? '#ff7070' : '#9dffb0';
    var radio = PH.RADIO_STATIONS[st.radio];
    el['radio-name'].textContent = radio.name;
    el['radio-desc'].textContent = ' — ' + radio.desc + (st.radioOn ? '' : ' (muted)');
    el['police-feed'].innerHTML = PH.feed.map(function (f) { return '<div class="feed-line">▸ ' + f.text + '</div>'; }).join('') ||
      '<div class="feed-line">▸ All quiet on the bay.</div>';
    el.ammo.textContent = '🔫 Pistol — ' + st.ammo + (st.aiming ? '  [AIMING]' : '');
    el.items.textContent = 'EMP ×' + st.emp + '   SMOKE ×' + st.smoke + (st.inCar ? '   🚗 SCARLET ARROW' : '   🚶 ON FOOT');
    el.speed.textContent = Math.round(st.speedKmh);
    el['health-bar'].firstElementChild.style.width = st.health + '%';
    el['car-bar'].firstElementChild.style.width = st.carHealth + '%';
    el['health-num'].textContent = Math.round(st.health);
    el['car-num'].textContent = Math.round(st.carHealth);
    if (PH.dialogue.text && st.timePlayed < PH.dialogue.until) {
      el.dialogue.style.display = 'block';
      el['dialogue-name'].textContent = PH.dialogue.name;
      el['dialogue-text'].textContent = PH.dialogue.text;
    } else el.dialogue.style.display = 'none';
    drawMinimap();
  }

  function drawMinimap() {
    var S = 168, C = S / 2;
    var scale = S / 460; // world -230..230 -> map
    mm.clearRect(0, 0, S, S);
    mm.fillStyle = 'rgba(16,12,40,0.9)';
    mm.beginPath(); mm.arc(C, C, C, 0, Math.PI * 2); mm.fill();
    mm.save();
    mm.beginPath(); mm.arc(C, C, C - 2, 0, Math.PI * 2); mm.clip();
    // Sea (east) and sand.
    mm.fillStyle = '#1d6f8e'; mm.fillRect(C + 150 * scale, 0, S, S);
    mm.fillStyle = '#e8c98f'; mm.fillRect(C + 150 * scale - 14, 0, 14, S);
    // Street grid.
    mm.strokeStyle = 'rgba(255,255,255,0.35)'; mm.lineWidth = 2;
    PH.CITY.streets.forEach(function (s) {
      mm.beginPath(); mm.moveTo(C + s * scale, 0); mm.lineTo(C + s * scale, S); mm.stroke();
      mm.beginPath(); mm.moveTo(0, C + s * scale); mm.lineTo(S, C + s * scale); mm.stroke();
    });
    // Beacon (mission target).
    var m = PH.currentMission();
    if (m && sim.beacon && sim.beacon.visible) {
      var bx = C + sim.beaconPos.x * scale, by = C + sim.beaconPos.z * scale;
      mm.fillStyle = '#ffc93c';
      mm.beginPath(); mm.arc(bx, by, 6, 0, Math.PI * 2); mm.fill();
      mm.strokeStyle = '#fff'; mm.lineWidth = 1.5;
      mm.beginPath(); mm.arc(bx, by, 9 + Math.sin(sim.elapsed * 4) * 2, 0, Math.PI * 2); mm.stroke();
    }
    // Police dots.
    sim.police.forEach(function (cop) {
      if (cop.dead) return;
      mm.fillStyle = cop.kind === 'heli' ? '#ff5a5a' : '#5a8aff';
      mm.beginPath(); mm.arc(C + cop.x * scale, C + cop.z * scale, 3, 0, Math.PI * 2); mm.fill();
    });
    // Player arrow.
    var px = C + sim.player.x * scale, py = C + sim.player.z * scale;
    mm.save();
    mm.translate(px, py); mm.rotate(Math.atan2(Math.sin(sim.player.heading), Math.cos(sim.player.heading)) * 0 + sim.player.heading);
    mm.fillStyle = '#fff';
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
    mm.restore();
    mm.restore();
  }

  function toast(text, ms) {
    el.toast.textContent = text;
    el.toast.style.display = 'block';
    setTimeout(function () { el.toast.style.display = 'none'; }, ms || 2200);
  }

  // ------------------------------------------------------------ input
  var dragging = false, lastX = 0, lastY = 0;

  function keyOf(e) {
    var k = (e.key || '').toLowerCase();
    if (k === ' ') return ' ';
    return k.length === 1 ? k : k;
  }

  window.addEventListener('keydown', function (e) {
    var k = keyOf(e);
    if (['w', 'a', 's', 'd', ' '].indexOf(k) >= 0) e.preventDefault();
    sim.keys[k] = true;
    if (!PH.state.started) return;
    if (k === 'p') togglePause();
    if (k === 'e' && !e.repeat) {
      var r = sim.enterExitCar();
      if (r === 'enter') toast('🚗 In the car — drive!');
      else if (r === 'exit') toast('On foot');
    }
    if (k === 'f' && !e.repeat) {
      PH.state.aiming = true;
      var res = sim.shoot();
      AudioSys.gunshot();
      if (res && res.hit) toast(res.hit === 'cop' ? 'Officer down!' : 'Target down');
      setTimeout(function () { if (!sim.keys['f']) PH.state.aiming = false; }, 350);
    }
    if (k === 'r' && !e.repeat) {
      PH.state.radio = (PH.state.radio + 1) % PH.RADIO_STATIONS.length;
      toast('📻 ' + PH.RADIO_STATIONS[PH.state.radio].name);
    }
    if (k === 'q' && !e.repeat && PH.state.emp > 0) {
      PH.state.emp--;
      PH.setWanted(Math.max(0, PH.state.wanted - 2));
      toast('⚡ EMP pulse — heat dropping');
    }
  });
  window.addEventListener('keyup', function (e) {
    sim.keys[keyOf(e)] = false;
    if (keyOf(e) === 'f') PH.state.aiming = false;
  });

  canvas.addEventListener('mousedown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (err) {} }
  });
  window.addEventListener('mouseup', function () { dragging = false; if (document.pointerLockElement) document.exitPointerLock(); });
  window.addEventListener('mousemove', function (e) {
    var dx, dy;
    if (document.pointerLockElement === canvas) { dx = e.movementX || 0; dy = e.movementY || 0; }
    else if (dragging) { dx = e.clientX - lastX; dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; }
    else return;
    if (PH.state.inCar) return; // driving camera follows the car
    sim.player.camYaw -= dx * 0.0035;
    sim.player.camPitch = PH.clamp(sim.player.camPitch - dy * 0.002, -0.6, 0.5);
    if (PH.state.aiming) sim.player.heading = sim.player.camYaw;
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ------------------------------------------------------------ screens
  function startGame() {
    var save = PH.loadSave();
    if (save && save.missionIndex > 0 && PH.state.missionIndex === 0) {
      PH.applySave(save);
      PH.startMission(PH.state.missionIndex);
    }
    PH.state.started = true;
    PH.state.paused = false;
    document.body.classList.remove('pre-start');
    el['start-screen'].style.display = 'none';
    el['pause-screen'].style.display = 'none';
    el['busted-screen'].style.display = 'none';
    AudioSys.init();
    if (AudioSys.ctx && AudioSys.ctx.resume) AudioSys.ctx.resume();
    PH.sayKira(PH.currentMission() ? PH.currentMission().brief : 'Free roam, Mateo.', 8);
    toast('🌅 Welcome to Sunset Bay');
  }
  function togglePause() {
    if (!PH.state.started || PH.state.over) return;
    PH.state.paused = !PH.state.paused;
    el['pause-screen'].style.display = PH.state.paused ? 'flex' : 'none';
  }
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('resume-btn').addEventListener('click', togglePause);
  document.getElementById('retry-btn').addEventListener('click', function () {
    location.reload();
  });

  PH.onBusted = function () {
    PH.state.over = true;
    PH.state.health = 0;
    el['busted-text'].textContent = 'Sunset Bay PD caught up with Mateo at wanted level ' + PH.state.wanted + '.';
    el['busted-screen'].style.display = 'flex';
    PH.saveGame();
  };
  PH.onWantedChange = function (n) {
    if (n >= 3) toast('★★★ HEAT IS ON — helicopter inbound!');
    else if (n === 2) toast('★★ Police cars inbound!');
    else if (n === 1) toast('★ Police on foot — run or hide');
    else if (n === 0) toast('Clean — heat is off');
  };
  PH.onMissionChange = function () { /* HUD reads state each frame */ };

  // Auto-start for headless screenshots / probes (?autostart=1).
  if (/[?&]autostart=1/.test(location.search)) {
    setTimeout(startGame, 300);
  }

  // ------------------------------------------------------------ main loop
  var last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    sim.update(dt, camera);
    AudioSys.update();
    updateHUD();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  // ------------------------------------------------------------ debug API (probe / screenshots)
  PH.debug = {
    start: startGame,
    state: function () {
      return {
        money: PH.state.money, wanted: PH.state.wanted, health: PH.state.health,
        ammo: PH.state.ammo, mission: PH.state.missionIndex, stage: PH.state.missionStage,
        inCar: PH.state.inCar, started: PH.state.started, completed: PH.state.completed,
        x: sim.player.x, z: sim.player.z, speed: PH.state.speedKmh,
        drivingDistance: PH.state.drivingDistance, heatArmed: PH.state.heatArmed,
        police: sim.police.filter(function (c) { return !c.dead; }).length,
        peds: sim.peds.filter(function (p) { return !p.dead; }).length,
        traffic: sim.traffic.length, beacon: { x: sim.beaconPos.x, z: sim.beaconPos.z },
      };
    },
    teleport: function (x, z) {
      if (PH.state.inCar && sim.playerCarData) { sim.playerCarData.x = x; sim.playerCarData.z = z; }
      sim.player.x = x; sim.player.z = z;
      sim.mateo.position.set(x, 0, z);
    },
    setCamYaw: function (yaw) { sim.player.camYaw = yaw; },
    aim: function (on) { PH.state.aiming = !!on; },
    setMission: function (i) { PH.startMission(i); },
    setWanted: function (n) { PH.setWanted(n); },
    spawnPolice: function (n, kind) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, r = PH.rand(15, 30);
        if (kind === 'foot') sim.spawnPoliceFoot(sim.player.x + Math.cos(a) * r, sim.player.z + Math.sin(a) * r);
        else sim.spawnPoliceCar(sim.player.x + Math.cos(a) * r, sim.player.z + Math.sin(a) * r);
      }
    },
    spawnPedNear: function (n, d) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        sim.spawnPed(sim.player.x + Math.cos(a) * (d || 10), sim.player.z + Math.sin(a) * (d || 10));
      }
    },
    clearPoliceFar: function () {
      // Remove every police unit (used by probes to test decay cleanly).
      sim.police.forEach(function (c) { c.dead = true; c.g.visible = false; });
      sim.police = [];
      sim.heli = null;
    },
    clearWitnesses: function () {
      // Move every pedestrian far away and remove all police: a clean room
      // for witness-rule tests (no witness within 30 m of the player).
      sim.police.forEach(function (c) { c.dead = true; c.g.visible = false; });
      sim.police = [];
      sim.heli = null;
      sim.peds.forEach(function (p) { p.x = 195; p.z = 135; p.g.position.set(195, 0, 135); });
    },
    enterArrow: function () {
      sim.teleport(sim.arrowCar.x - 2, sim.arrowCar.z);
      return sim.enterExitCar();
    },
    driveForward: function (seconds) { sim.keys['w'] = true; },
    stopDriving: function () { sim.keys['w'] = false; sim.keys['s'] = false; },
    shoot: function () { return sim.shoot(); },
    enterCar: function () { return sim.enterExitCar(); },
    setKeys: function (keys) { sim.keys = keys; },
  };

  window.PH = PH;
})();
