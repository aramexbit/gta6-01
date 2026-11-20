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
  ['mission-title', 'mission-timer', 'mission-stage', 'mission-objective', 'mission-progress', 'mission-next',
   'money', 'stars', 'wanted-label', 'air-line', 'radio-name', 'radio-desc', 'radio-line',
   'police-feed', 'police-count', 'loc-area', 'loc-sub',
   'health-bar', 'car-bar', 'health-num', 'car-num',
   'health-bar2', 'armour-bar', 'respect-bar', 'health-num2', 'armour-num', 'respect-num', 'rank-line',
   'weapon-slots', 'car-name', 'car-cond', 'speed',
   'dialogue', 'dialogue-name', 'dialogue-role', 'dialogue-text', 'dialogue-portrait', 'toast',
   'start-screen', 'pause-screen', 'busted-screen', 'busted-text'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });
  var minimap = document.getElementById('minimap');
  var mm = minimap.getContext('2d');

  function fmtClock(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var mm = Math.floor(s / 60), ss = s % 60;
    return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  // Kira's portrait, drawn procedurally on a small canvas (no photo, no
  // download): dark bob hair, warm skin, teal jacket, radio headset.
  var portraitDrawnFor = '';
  function drawPortrait() {
    var c = el['dialogue-portrait'];
    if (!c) return;
    var key = PH.dialogue.name + '|' + PH.dialogue.text.slice(0, 12);
    if (portraitDrawnFor === key) return;
    portraitDrawnFor = key;
    var g = c.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, 64);
    bg.addColorStop(0, '#3a2a6e'); bg.addColorStop(1, '#b83a6e');
    g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1d7a6e'; // shoulders / teal jacket
    g.beginPath(); g.moveTo(6, 64); g.quadraticCurveTo(10, 46, 32, 46); g.quadraticCurveTo(54, 46, 58, 64); g.closePath(); g.fill();
    g.fillStyle = '#f2f2f2'; g.fillRect(29, 46, 6, 18); // tee sliver
    g.fillStyle = '#c98a5e'; g.fillRect(27, 38, 10, 10); // neck
    g.fillStyle = '#e8b88a'; // face
    g.beginPath(); g.ellipse(32, 27, 12, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1a1a'; // bob hair: cap + side falls
    g.beginPath(); g.ellipse(32, 15, 13, 8, 0, Math.PI, 0); g.fill();
    g.fillRect(19, 14, 5, 18); g.fillRect(40, 14, 5, 18);
    g.fillStyle = '#1a1a1a'; // eyes
    g.fillRect(24, 25, 4, 2); g.fillRect(36, 25, 4, 2);
    g.fillStyle = '#8a3a3a'; // smile
    g.beginPath(); g.arc(32, 34, 3, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 2; // headset band + mic boom
    g.beginPath(); g.arc(32, 22, 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.moveTo(45, 30); g.quadraticCurveTo(44, 36, 38, 36); g.stroke();
    g.fillStyle = '#ffc93c'; g.beginPath(); g.arc(38, 36, 2, 0, Math.PI * 2); g.fill();
  }

  function updateHUD() {
    var st = PH.state;
    var m = PH.currentMission();
    var si = PH.missionStageInfo();
    if (m) {
      el['mission-title'].textContent = m.title;
      el['mission-timer'].textContent = '⏱ ' + fmtClock(st.missionTimer);
      el['mission-stage'].textContent = 'STAGE ' + si.cur + '/' + si.total;
      var obj = m.objective;
      if (st.missionIndex === 3 && st.missionStage === 1) obj = 'Return Kira’s drop to the pier';
      if (st.missionIndex === 7 && st.missionStage === 1) obj = 'Lose the 3-star tail — stay unseen 22 s';
      if (st.missionIndex === 6) obj = 'Escape through checkpoint ' + (sim.checkpointIndex + 1) + ' of 3';
      el['mission-objective'].textContent = obj;
      // Progress: real mission progress when the mission tracks it, else
      // proximity to the beacon (1 at the beacon, 0 far away).
      var prog = st.missionProgress;
      if (prog <= 0 && sim.beacon) {
        var dB = PH.dist2d(sim.player.x, sim.player.z, sim.beaconPos.x, sim.beaconPos.z);
        prog = PH.clamp(1 - dB / 220, 0, 1);
      }
      el['mission-progress'].style.width = Math.round(PH.clamp(prog, 0, 1) * 100) + '%';
      var next = PH.MISSIONS[st.missionIndex + 1];
      el['mission-next'].innerHTML = next ? '<b>NEXT</b> ' + next.title.replace(/^M\d+ — /, '') : '<b>NEXT</b> Free roam — Sunset Bay is yours';
    } else {
      el['mission-title'].textContent = 'FREE ROAM — SUNSET BAY';
      el['mission-timer'].textContent = '⏱ ' + fmtClock(st.missionTimer);
      el['mission-stage'].textContent = '8/8 DONE';
      el['mission-objective'].textContent = 'All 8 missions complete. The bay is yours, Mateo.';
      el['mission-progress'].style.width = '100%';
      el['mission-next'].innerHTML = '<b>NEXT</b> Free roam — Sunset Bay is yours';
    }
    el.money.textContent = PH.fmtMoney(st.money);
    el.stars.textContent = PH.starsText(st.wanted);
    el['wanted-label'].textContent = 'WANTED ' + st.wanted + (st.wanted > 0 ? ' — LOSE THE TAIL' : ' — CLEAN');
    el['wanted-label'].style.color = st.wanted > 0 ? '#ff7070' : '#9dffb0';
    var heliUp = !!sim.heli;
    el['air-line'].textContent = heliUp ? '🚁 AIR UNIT DEPLOYED — SPOTLIGHT ON YOU'
      : (st.wanted > 0 ? '👁 IN SIGHT — BREAK LINE OF SIGHT' : '');
    var radio = PH.RADIO_STATIONS[st.radio];
    el['radio-name'].textContent = radio.name;
    el['radio-desc'].textContent = ' — ' + radio.desc + (st.radioOn ? '' : ' (muted)');
    el['radio-line'].textContent = '♪ ' + radio.name + ' — ' + radio.desc.split(' — ')[1];
    // Dispatch board: every live police unit, name + real distance + tactic.
    var units = sim.police.filter(function (c) { return !c.dead; });
    units.sort(function (a, b) {
      return PH.dist2d(sim.player.x, sim.player.z, a.x, a.z) - PH.dist2d(sim.player.x, sim.player.z, b.x, b.z);
    });
    el['police-count'].textContent = units.length + (units.length === 1 ? ' UNIT' : ' UNITS');
    var rows = units.slice(0, 5).map(function (c) {
      var d = Math.round(PH.dist2d(sim.player.x, sim.player.z, c.x, c.z));
      var icon = c.kind === 'heli' ? '🚁' : c.kind === 'foot' ? '🚶' : '🚔';
      return '<div class="p-row"><span>' + icon + '</span><span class="p-name">' + c.name + '</span>' +
        '<span class="badge badge-' + c.tactic + '">' + c.tactic + '</span>' +
        '<span class="p-dist">' + d + ' m</span></div>';
    }).join('');
    if (units.length > 5) rows += '<div class="feed-line">▸ +' + (units.length - 5) + ' more units responding</div>';
    if (!units.length) rows = '<div class="feed-line">▸ All quiet on the bay.</div>';
    var feed = PH.feed.slice(0, 2).map(function (f) { return '<div class="feed-line">▸ ' + f.text + '</div>'; }).join('');
    el['police-feed'].innerHTML = rows + feed;
    // Location, vitals, respect rank — all live.
    var loc = PH.locationName(sim.player.x, sim.player.z);
    el['loc-area'].textContent = loc.area;
    el['loc-sub'].textContent = loc.sub;
    el['health-bar'].firstElementChild.style.width = st.health + '%';
    el['car-bar'].firstElementChild.style.width = st.carHealth + '%';
    el['health-num'].textContent = Math.round(st.health);
    el['car-num'].textContent = Math.round(st.carHealth);
    el['health-bar2'].firstElementChild.style.width = st.health + '%';
    el['armour-bar'].firstElementChild.style.width = st.armour + '%';
    var respectCap = st.respect < 100 ? 100 : st.respect < 250 ? 250 : st.respect < 500 ? 500 : 800;
    el['respect-bar'].firstElementChild.style.width = Math.round(PH.clamp(st.respect / respectCap, 0, 1) * 100) + '%';
    el['health-num2'].textContent = Math.round(st.health);
    el['armour-num'].textContent = Math.round(st.armour);
    el['respect-num'].textContent = Math.round(st.respect);
    el['rank-line'].textContent = PH.respectTitle(st.respect) + ' · ' + Math.round(st.respect) + ' / ' + respectCap + ' RP';
    // Weapon wheel: fists + pistol are real (pistol ammo = state.ammo);
    // SMG / rifle are locked — no fake ammo numbers on guns Mateo owns not.
    var wheel = [
      { key: 1, icon: '✊', name: 'FISTS', ammo: '∞', owned: true, active: st.weapon === 'fists' },
      { key: 2, icon: '🔫', name: 'PISTOL', ammo: String(st.ammo), owned: true, active: st.weapon === 'pistol' },
      { key: 3, icon: '🔫', name: 'SMG', ammo: 'LOCKED', owned: false, active: false },
      { key: 4, icon: '🔫', name: 'RIFLE', ammo: 'LOCKED', owned: false, active: false },
    ];
    el['weapon-slots'].innerHTML = wheel.map(function (w) {
      return '<div class="w-slot' + (w.active ? ' active' : '') + (w.owned ? '' : ' locked') + '">' +
        '<div class="w-key">' + w.key + '</div><div class="w-icon">' + w.icon + '</div>' +
        '<div class="w-name">' + w.name + '</div><div class="w-ammo">' + w.ammo + '</div></div>';
    }).join('');
    // Car card: name + condition + big speed.
    if (st.inCar && sim.playerCarData) {
      el['car-name'].textContent = '🚗 ' + (sim.playerCarData.name || 'STOLEN CAR');
      el['car-cond'].textContent = 'CONDITION ' + Math.round(st.carHealth) + '% · ' + (sim.playerCarData.isArrow ? 'SPORTS · V8' : 'STREET CAR');
    } else {
      el['car-name'].textContent = '🚶 ON FOOT';
      el['car-cond'].textContent = st.aiming ? 'AIMING — ' + st.ammo + ' ROUNDS' : 'EMP ×' + st.emp + ' · SMOKE ×' + st.smoke;
    }
    el.speed.textContent = Math.round(st.speedKmh);
    if (PH.dialogue.text && st.timePlayed < PH.dialogue.until) {
      el.dialogue.style.display = 'block';
      drawPortrait();
      el['dialogue-name'].textContent = PH.dialogue.name.split(' — ')[0];
      el['dialogue-role'].textContent = '— radio · fixer';
      el['dialogue-text'].textContent = PH.dialogue.text;
    } else el.dialogue.style.display = 'none';
    drawMinimap();
  }

  function drawMinimap() {
    var S = 168, C = S / 2;
    var scale = S / 460; // world -230..230 -> map
    mm.clearRect(0, 0, S, S);
    mm.save();
    mm.beginPath(); mm.arc(C, C, C - 2, 0, Math.PI * 2); mm.clip();
    // Land base, then city blocks as filled rectangles (roads are the gaps
    // between them) — a real street map, not a grid of lines.
    mm.fillStyle = '#2a2140'; mm.fillRect(0, 0, S, S);
    mm.fillStyle = '#1d6f8e'; mm.fillRect(C + 150 * scale, 0, S, S); // sea
    mm.fillStyle = '#e8c98f'; mm.fillRect(C + 150 * scale - 12, 0, 12, S); // sand
    var streets = PH.CITY.streets;
    mm.fillStyle = '#5a4f8e'; // blocks — lighter than the base so streets read
    for (var i = 0; i < streets.length - 1; i++) {
      for (var j = 0; j < streets.length - 1; j++) {
        var bx = C + (streets[i] + 5) * scale, by = C + (streets[j] + 5) * scale;
        var bw = (streets[i + 1] - streets[i] - 10) * scale;
        mm.fillRect(bx, by, bw, bw);
      }
    }
    // Roads: pale lines over the block field, plus the pier into the sea.
    mm.strokeStyle = 'rgba(255,255,255,0.55)'; mm.lineWidth = 2.5;
    streets.forEach(function (s) {
      mm.beginPath(); mm.moveTo(C + s * scale, 0); mm.lineTo(C + s * scale, S); mm.stroke();
      mm.beginPath(); mm.moveTo(0, C + s * scale); mm.lineTo(S, C + s * scale); mm.stroke();
    });
    mm.strokeStyle = '#8a6238'; mm.lineWidth = 3;
    mm.beginPath(); mm.moveTo(C + 196 * scale, C); mm.lineTo(C + 262 * scale, C); mm.stroke();
    // North marker.
    mm.fillStyle = '#ffc93c'; mm.font = 'bold 11px sans-serif'; mm.textAlign = 'center';
    mm.fillText('N', C, 13);
    // Beacon (mission target) with pulse ring.
    var m = PH.currentMission();
    if (m && sim.beacon && sim.beacon.visible) {
      var bx2 = C + sim.beaconPos.x * scale, by2 = C + sim.beaconPos.z * scale;
      mm.fillStyle = '#ffc93c';
      mm.beginPath(); mm.arc(bx2, by2, 5, 0, Math.PI * 2); mm.fill();
      mm.strokeStyle = '#fff'; mm.lineWidth = 1.5;
      mm.beginPath(); mm.arc(bx2, by2, 8 + Math.sin(sim.elapsed * 4) * 2, 0, Math.PI * 2); mm.stroke();
    }
    // Police dots (blue cars, red heli) and the player arrow.
    sim.police.forEach(function (cop) {
      if (cop.dead) return;
      mm.fillStyle = cop.kind === 'heli' ? '#ff5a5a' : '#5a8aff';
      mm.beginPath(); mm.arc(C + cop.x * scale, C + cop.z * scale, 3, 0, Math.PI * 2); mm.fill();
    });
    var px = C + sim.player.x * scale, py = C + sim.player.z * scale;
    mm.save();
    mm.translate(px, py); mm.rotate(sim.player.heading);
    mm.fillStyle = '#fff';
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
    mm.strokeStyle = '#000'; mm.lineWidth = 1; mm.stroke();
    mm.restore();
    mm.restore();
    // Rim ring.
    mm.strokeStyle = 'rgba(255,180,90,0.7)'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(C, C, C - 1, 0, Math.PI * 2); mm.stroke();
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
    if (!window.__PIERHEAT_READY) window.__PIERHEAT_READY = true;
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
    snapHeli: function (alt) {
      // Put the helicopter exactly on its station (24 m ahead of the
      // player, `alt` m up — 13 default, 22 for the mission shot so it
      // clears the Little Havana rooftops) right before the shutter: the
      // heli lerps to its station over ~1 s, and at headless frame rates
      // it would otherwise still be climbing into frame when the
      // screenshot fires.
      if (!sim.heli) return null;
      var h = sim.heli;
      h.x = sim.player.x + Math.sin(sim.player.heading) * 24;
      h.z = sim.player.z + Math.cos(sim.player.heading) * 24;
      h.g.position.set(h.x, alt || 13, h.z);
      return { x: Math.round(h.x), z: Math.round(h.z) };
    },
    setCamera: function (x, y, z, lx, ly, lz) {
      // Direct camera placement for the title shot (the loop does not move
      // the camera before the game starts, and the boot view sits inside a
      // building block). Camera is the closure camera from boot.
      camera.position.set(x, y, z);
      camera.lookAt(lx, ly, lz);
    },
    // ---- deterministic shot staging (v6): place the city around the
    // camera so every one of the four shots is a busy action frame.
    // All positions are relative to the player/car, so the frame reads the
    // same on every run; distances and tactics on the HUD stay live.
    stageChase: function () {
      // Mission 2 pier run, 3 stars, on Ocean Drive heading east into the
      // low sun: police tight behind, roadblock ahead, heli spotlighting,
      // traffic in the lane, peds on the sidewalks. The Arrow starts
      // already rolling at 22 m/s (~79 km/h): headless SwiftShader runs
      // the sim at ~5 fps, so a standing start would still read 9 km/h
      // when the shutter fires — a chase frame needs a moving car.
      PH.startMission(1);
      PH.state.money = 15300; // $12,800 start + M1 reward $2,500
      PH.state.respect = 140;
      PH.state.health = 76; PH.state.armour = 58; PH.state.carHealth = 88;
      PH.state.missionTimer = 161; // 02:41 on the job clock
      PH.state.heatArmed = true; // the pier-run heat is already on: STAGE 2/2
      sim.playerCarData.x = 100; sim.playerCarData.z = 40;
      sim.playerCarData.heading = Math.PI / 2; // east, into the sun + sea
      sim.playerCarData.speed = 26; // ~94 km/h rolling; headless drag bleeds it slowly
      sim.playerCarData.g.position.set(100, 0, 40);
      sim.playerCarData.g.rotation.y = Math.PI / 2;
      sim.player.x = 100; sim.player.z = 40; sim.player.heading = Math.PI / 2;
      PH.state.inCar = true; sim.mateo.visible = false;
      PH.debug.clearPoliceFar();
      PH.setWanted(3); // spawns the heli on the next update
      // Pursuit cars FLANKING the Arrow (ahead-left, ahead-right, ahead
      // centre) — a chase camera looks forward, so cars directly behind the
      // player sit behind the camera and cars level with it sit at the
      // extreme frame edges. Ahead-side slots stay clearly in frame.
      // Each holds its formation slot (see the slot branch in updatePolice)
      // instead of piling onto the bumper, and starts at the player's
      // speed so it does not lag into the Arrow. Spawned on their slots.
      var c1 = sim.spawnPoliceCar(114, 32); c1.heading = Math.PI / 2; c1.slot = { a: 14, s: -8 }; c1.speed = 26;
      var c2 = sim.spawnPoliceCar(114, 48); c2.heading = Math.PI / 2; c2.slot = { a: 14, s: 8 }; c2.speed = 26;
      var c3 = sim.spawnPoliceCar(122, 40); c3.heading = Math.PI / 2; c3.slot = { a: 22, s: 0 }; c3.speed = 26;
      // The 40 ambient pedestrians include some standing ON the road: the
      // Arrow at 26 m/s would hit one and spike the wanted level mid-shot.
      // Move every ped in the road corridor to the open beach instead.
      sim.peds.forEach(function (ped) {
        if (!ped.dead && Math.abs(ped.z - 40) < 6 && ped.x > 85 && ped.x < 175) {
          ped.x = PH.rand(155, 175); ped.z = PH.rand(10, 70);
          ped.g.position.set(ped.x, 0, ped.z);
        }
      });
      // Roadblock parked across the road ahead.
      var rb = sim.spawnPoliceCar(160, 40);
      rb.heading = Math.PI; rb.g.rotation.y = Math.PI; rb.roadblock = true; rb.tactic = 'ROADBLOCK';
      // Traffic in the lane ahead + one car overtaking on the left.
      sim.spawnTrafficCar(138, 40, Math.PI / 2, 0xf2c230);
      sim.spawnTrafficCar(148, 44, Math.PI / 2, 0x2e7fd8);
      sim.spawnTrafficCar(132, 36, Math.PI / 2, 0x37b268);
      sim.spawnTrafficCar(168, 40, Math.PI / 2, 0xe8e8e8);
      // Peds on the Ocean Drive sidewalks, close to the camera — on the
      // north sidewalk (z = 47) and east of the deco block (x >= 122) so
      // none stands inside a building footprint.
      sim.spawnPed(112, 47); sim.spawnPed(120, 47); sim.spawnPed(130, 47);
      sim.spawnPed(126, 33); sim.spawnPed(138, 33); sim.spawnPed(146, 47);
      PH.sayKira('Heat is on, Mateo — two stars. Get to the pier and do not stop.', 8);
      sim.keys['w'] = true; // rolling: speed holds for the shot
      return { money: PH.state.money, wanted: PH.state.wanted, police: sim.police.length };
    },
    stageStreet: function () {
      // Mateo on foot on the north sidewalk of the z = 40 road, eight metres
      // from the Scarlet Arrow: the camera is close (dist 5.5) and slid to
      // his right (side 3), so he stands at the right third instead of
      // blocking the middle — the Arrow and its yellow beacon column fill
      // the centre-left, palms and the beach and low sun beyond. The
      // camera sits at (120.5, 41), east of the (108, 28) deco block and
      // clear of both palm rows, so no building or trunk fills the lens.
      // The default pitch (-0.12) stays: pitching the camera up pulled the
      // near palm fronds across the top of the frame.
      PH.feed.length = 0; // init already logged M1 once; no duplicate line
      PH.startMission(0);
      PH.state.money = 12800;
      PH.state.missionTimer = 45; // 00:45 on the job clock
      sim.shotCamDist = 6.5; // close: Mateo at the right third, Arrow big
      sim.shotCamSide = 3; // toward his right: he slides right in frame
      sim.player.x = 126; sim.player.z = 44; sim.player.heading = Math.PI / 2;
      sim.player.camYaw = Math.PI / 2; // looking east: road, palms, sand, sea
      sim.mateo.position.set(126, 0, 44); sim.mateo.rotation.y = Math.PI / 2;
      PH.debug.clearPoliceFar();
      PH.setWanted(0);
      // Ambient traffic wanders the grid: clear any car that drifted into
      // the hero area (within 26 m of the Arrow) to the far west end of
      // this road, so no random car parks on Mateo or crowds the Arrow.
      // This runs BEFORE the staged traffic below, so those stay put.
      sim.traffic.forEach(function (car) {
        if (PH.dist2d(car.x, car.z, 128, 40) < 26) {
          car.x = PH.rand(45, 75); car.z = 40; car.heading = Math.PI / 2;
          car.g.position.set(car.x, 0, car.z); car.g.rotation.y = car.heading;
        }
      });
      // Crowd on the sidewalks around the Arrow and the beacon — nobody
      // between the camera and the car, nobody standing on the road. The
      // green car that used to be staged at (140, 40) is gone: from this
      // camera it always landed right behind Mateo's shoulder.
      sim.spawnPed(118, 50); sim.spawnPed(126, 50); sim.spawnPed(132, 46);
      sim.spawnPed(134, 34); sim.spawnPed(124, 33); sim.spawnPed(140, 47);
      sim.spawnPed(118, 33); sim.spawnPed(146, 44);
      sim.spawnTrafficCar(120, 20, 0, 0xd83a2e);
      sim.spawnTrafficCar(120, 62, Math.PI, 0x2e7fd8);
      sim.spawnTrafficCar(120, 85, 0, 0xf2c230);
      PH.sayKira('Mateo, the Scarlet Arrow is parked on Ocean Drive, keys in the sun visor. Take it. No witnesses, no heat.', 8);
      return { peds: sim.peds.length, traffic: sim.traffic.length };
    },
    stageMission: function () {
      // Mission 3 cross-town drop, restaged on Ocean Drive: Mateo on foot
      // on the north sidewalk of the z = 40 road at (126, 44), aiming EAST
      // into the low sun — no building stands ahead of him on this
      // sightline (the deco blocks end at x = 117, the boardwalk and sand
      // open up past x = 150), so the frame is road, police, beacon and
      // sea instead of flat orange slabs. He stands on the sidewalk on
      // purpose: the third pass put him at (126, 40) and he clipped
      // INSIDE the parked Arrow (its footprint is x 125.7–130.3), so his
      // legs vanished into the car. With the camera 7.5 m back and 5 m to
      // his right it sits at (118.5, 39), east of every building footprint
      // and north of the (108, 28) block's south face. He reads in
      // three-quarter view at the right third with the pistol in his right
      // hand visible, the Arrow parked at his front-right; two pursuit
      // cars close in from ~19 m, the roadblock auto-spawns at (140, 40)
      // — the spawn clamps x to 140, so it sits 14 m ahead, parked across
      // the road — the heli holds station above the beacon, and the beacon
      // column stands on the sand at (152, 44) with the sea behind it.
      // Headless dt is clamped at 0.1 s and the frame rate varies run to
      // run, so the cops close anywhere from ~1 m (slow run) to ~9 m
      // (fast run) before the shutter: spawned at ~19 m they end up
      // 10–19 m out, tight but never on top of him.
      PH.startMission(2);
      PH.state.money = 19500; // start + M1 + M2 rewards
      PH.state.respect = 180;
      PH.state.missionTimer = 94; // 01:34 on the job clock
      sim.player.x = 126; sim.player.z = 44; sim.player.heading = Math.PI / 2;
      sim.player.camYaw = Math.PI / 2; // looking east: road, palms, sand, sea
      sim.player.camPitch = 0.25; // lift the view: the heli must read in frame
      sim.shotCamDist = 7.5; // pull the aim camera back: Mateo + street, not just his back
      sim.shotCamSide = 5; // toward his right: three-quarter aim, pistol visible
      sim.mateo.position.set(126, 0, 44); sim.mateo.rotation.y = Math.PI / 2;
      PH.state.aiming = true;
      PH.debug.clearPoliceFar();
      PH.setWanted(3);
      // Two pursuit cars on the road ahead, facing Mateo (headlights and
      // light bars toward the camera). Spawned at ~19 m: they close 1–9 m
      // before the shutter depending on the headless frame rate, so they
      // end up 10–19 m out — tight, but not on top of him.
      var p1 = sim.spawnPoliceCar(144, 37); p1.heading = -Math.PI / 2;
      var p2 = sim.spawnPoliceCar(145, 43); p2.heading = -Math.PI / 2;
      // The drop beacon, moved onto the sand for the shot: the yellow
      // column stands against the sea, 12 m past the roadblock so the
      // parked car does not hide its base.
      sim.setBeacon(152, 44);
      // Peds on the sidewalks flanking the road — none closer than 12 m
      // to the camera (the first pass parked one 6 m from the lens and it
      // filled the frame edge), none of them on the road or on Mateo, and
      // none of them in his line of fire: the fourth pass parked a ped
      // 6 m ahead of him and it stood exactly where his aiming arm and
      // pistol point, hiding both.
      sim.spawnPed(142, 46); sim.spawnPed(148, 46); sim.spawnPed(154, 46);
      sim.spawnPed(132, 34); sim.spawnPed(140, 34); sim.spawnPed(150, 34);
      // Ambient traffic wanders the grid: clear any car that drifted into
      // the hero area (within 26 m of Mateo) to the far west end of this
      // road, so no random car parks on Mateo or the Arrow.
      sim.traffic.forEach(function (car) {
        if (PH.dist2d(car.x, car.z, 126, 44) < 26) {
          car.x = PH.rand(45, 75); car.z = 40; car.heading = Math.PI / 2;
          car.g.position.set(car.x, 0, car.z); car.g.rotation.y = car.heading;
        }
      });
      PH.sayKira('Package in the trunk. The drop beacon is on Ocean Drive — but SBPD is already on you. Get to it, and no shooting unless you have to.', 8);
      return { wanted: PH.state.wanted, police: sim.police.length };
    },
    stageTitle: function () {
      // Title screen: the city behind the overlay is busy — traffic on the
      // grid street in front of the camera, a patrol car, peds on the walk.
      // Camera sits high north-west, looking south-east across the grid
      // toward Ocean Drive, the beach and the low sun.
      PH.debug.setCamera(0, 30, -70, 110, 2, 30);
      sim.spawnTrafficCar(8, 40, 0, 0xd83a2e);
      sim.spawnTrafficCar(32, 40, 0, 0x2e7fd8);
      sim.spawnTrafficCar(-8, 40, Math.PI, 0xf2c230);
      sim.spawnTrafficCar(48, 40, 0, 0x37b268);
      sim.spawnTrafficCar(88, 40, 0, 0xe8e8e8);
      sim.spawnTrafficCar(104, 40, Math.PI, 0xff7ab8);
      sim.spawnTrafficCar(20, 0, Math.PI / 2, 0xe8e8e8);
      sim.spawnTrafficCar(120, 10, 0, 0x37b268);
      var pc = sim.spawnPoliceCar(56, 40); pc.heading = 0;
      sim.spawnPed(14, 47); sim.spawnPed(26, 33); sim.spawnPed(38, 47);
      sim.spawnPed(2, 33); sim.spawnPed(44, 33);
      return { traffic: sim.traffic.length, police: sim.police.length };
    },
    driveForward: function (seconds) { sim.keys['w'] = true; },
    stopDriving: function () { sim.keys['w'] = false; sim.keys['s'] = false; },
    shoot: function () { return sim.shoot(); },
    enterCar: function () { return sim.enterExitCar(); },
    setKeys: function (keys) { sim.keys = keys; },
  };

  window.PH = PH;
})();
