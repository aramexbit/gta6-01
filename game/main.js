// PIER HEAT v6.4 — main.js
// Renderer, sun + sky lighting, chase / foot / title cameras, the dense HUD
// (dispatch board, weapon wheel, vitals, minimap, dialogue), keyboard input,
// the four deterministic screenshot stages, day/night switching and the
// main loop. Written fresh for v6.4; nothing here is copied from an earlier
// version.
(function () {
  'use strict';

  var state = window.PH.state;
  var sim = window.PH.sim;

  var scene, camera, renderer, clock;
  var worldRefs;
  var sunLight, hemiLight;
  var cameraMode = 'title';            // title | chase | foot
  var camDist = 8.5, camHeight = 3.4;  // chase/foot framing (v6.4: closer)
  var camSide = 0;                     // v6.4: lateral offset for a rear 3/4 hero view
  var camPos = { x: 0, y: 0, z: 0 };
  var night = false;
  var stagedTracers = [];
  var hudTimer = 0;
  var radioIdx = 0;
  var radioLines = [
    'RADIO SUNSET 98.4 — good evening, Bay City.',
    'RADIO SUNSET 98.4 — traffic heavy on Ocean Drive, drive safe.',
    'SBPD DISPATCH — all units, be advised: orange sports car, Ocean Drive.',
    'RADIO SUNSET 98.4 — tonight: the Neon Bowl all-nighter, Pier 9.',
    'KIRA — Mateo, the gates are lit. Go, go, go!',
  ];

  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------ toast
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = 'none'; }, 2600);
  }
  window.PH.toast = toast;

  // ------------------------------------------------------------ init
  function init() {
    var canvas = $('c');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9fd4ff, 220, 640);
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(120, 30, 80);

    // Saturated golden-hour sun + bright sky fill. No pale wash.
    sunLight = new THREE.DirectionalLight(0xffd9a0, 1.25);
    sunLight.position.set(320, 190, 90);
    scene.add(sunLight);
    hemiLight = new THREE.HemisphereLight(0x7fb8ff, 0x4a3428, 0.95);
    scene.add(hemiLight);

    worldRefs = window.PHWORLD.buildWorld(scene);
    window.PH.initSim(scene, worldRefs);

    bindInput();
    refreshSlots();
    drawPortrait('KIRA');

    clock = new THREE.Clock();
    var params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') startGame();
    else showTitle(); // title screen up, HUD hidden behind it

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.render(scene, camera);
    window.__PIERHEAT_READY = true;
    renderer.setAnimationLoop(loop);
  }

  // ------------------------------------------------------------ input
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      sim.keys[e.code] = true;
      if (e.code === 'KeyE' && !e.repeat && state.started) {
        if (state.inCar) window.PH.sim && exitCarSafe();
        else enterCarSafe();
      }
      if ((e.code === 'KeyF' || e.code === 'Space') && !e.repeat && state.started && !state.inCar) {
        if (e.code === 'KeyF') window.PH.debug.shoot();
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { sim.keys[e.code] = false; });
    window.addEventListener('mousedown', function () {
      if (state.started && !state.inCar) window.PH.debug.shoot();
    });
    $('start-btn').addEventListener('click', function () { startGame(); });
  }

  function enterCarSafe() {
    // sim.enterCar lives in the sim module scope; reach it via debug-free path.
    window.PH.simEnterCar();
    window.PH.setCameraMode('chase', 8.5, 3.4);
  }
  function exitCarSafe() {
    window.PH.simExitCar();
    window.PH.setCameraMode('foot', 5.5, 2.6);
  }

  function startGame() {
    state.started = true;
    var ts = $('title-screen');
    if (ts) ts.style.display = 'none';
    var hud = $('hud');
    if (hud) hud.style.display = 'block';
    cameraMode = state.inCar ? 'chase' : 'foot';
    toast(window.PH.mission().briefing);
  }

  function showTitle() {
    state.started = false;
    var ts = $('title-screen');
    if (ts) ts.style.display = 'flex';
    var hud = $('hud');
    if (hud) hud.style.display = 'none'; // title shot: no HUD panels showing through
    refreshSlots();
    cameraMode = 'title';
  }

  // ------------------------------------------------------------ save slots
  function refreshSlots() {
    var save = window.PH.loadSave();
    var slot = $('slot-1');
    if (!slot) return;
    if (save) {
      var m = window.PH.MISSIONS[save.missionIndex] || window.PH.MISSIONS[0];
      slot.innerHTML = '<b>SLOT 1</b><br>' + m.id + ' ' + m.name + '<br>' +
        window.PH.fmtMoney(save.money) + ' · Respect ' + save.respect;
    } else {
      slot.innerHTML = '<b>SLOT 1</b><br><span class="empty">EMPTY — NEW GAME</span>';
    }
  }

  // ------------------------------------------------------------ portrait
  function drawPortrait(who) {
    var cv = $('dialogue-portrait');
    if (!cv) return;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    var bg = g.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0, '#3a0a4d'); bg.addColorStop(1, '#12002b');
    g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
    if (who === 'KIRA') {
      g.fillStyle = '#1a1a2e';
      g.beginPath(); g.ellipse(64, 62, 34, 42, 0, 0, Math.PI * 2); g.fill(); // hair
      g.fillStyle = '#e8b98a';
      g.beginPath(); g.ellipse(64, 66, 26, 32, 0, 0, Math.PI * 2); g.fill(); // face
      g.fillStyle = '#1a1a2e';
      g.beginPath(); g.ellipse(64, 40, 28, 16, 0, Math.PI, 0); g.fill();     // fringe
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(54, 64, 4, 0, Math.PI * 2); g.arc(74, 64, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111111';
      g.beginPath(); g.arc(54, 64, 2, 0, Math.PI * 2); g.arc(74, 64, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff5d8f'; g.lineWidth = 3;
      g.beginPath(); g.arc(64, 84, 8, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = '#ff2fb3'; g.fillRect(30, 108, 68, 20);                    // jacket
    } else {
      g.fillStyle = '#e8b98a';
      g.beginPath(); g.ellipse(64, 66, 26, 32, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#101826'; g.fillRect(38, 34, 52, 16);                    // cap
      g.fillRect(38, 46, 66, 8);
      g.fillStyle = '#111111';
      g.beginPath(); g.arc(54, 64, 2, 0, Math.PI * 2); g.arc(74, 64, 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff7a00'; g.fillRect(30, 108, 68, 20);
    }
  }

  function showDialogue(name, text) {
    var d = $('dialogue');
    if (!d) return;
    $('dialogue-name').textContent = name;
    $('dialogue-text').textContent = text;
    drawPortrait(name);
    d.style.display = 'flex';
    $('crosshair').style.display = state.inCar ? 'none' : 'block';
  }
  function hideDialogue() {
    var d = $('dialogue');
    if (d) d.style.display = 'none';
    $('crosshair').style.display = 'none';
  }

  // ------------------------------------------------------------ day / night
  function setNight(on) {
    night = !!on;
    if (!worldRefs) return;
    if (night) {
      worldRefs.skyMat.map = worldRefs.skyNight;
      worldRefs.skyMat.needsUpdate = true;
      worldRefs.sun.visible = false;
      worldRefs.sunGlow.visible = false;
      worldRefs.moon.visible = true;
      sunLight.intensity = 0.5;
      sunLight.color.setHex(0x9db8ff);
      hemiLight.intensity = 0.7; // true night, but the kiosks must still read
      scene.fog.color.setHex(0x0a0f1e);
      scene.fog.near = 90; scene.fog.far = 420;
    } else {
      worldRefs.skyMat.map = worldRefs.skySunset;
      worldRefs.skyMat.needsUpdate = true;
      worldRefs.sun.visible = true;
      worldRefs.sunGlow.visible = true;
      worldRefs.moon.visible = false;
      sunLight.intensity = 1.25;
      sunLight.color.setHex(0xffd9a0);
      hemiLight.intensity = 0.95;
      scene.fog.color.setHex(0x9fd4ff);
      scene.fog.near = 220; scene.fog.far = 640;
    }
  }

  // ------------------------------------------------------------ staged tracers
  function clearStagedTracers() {
    stagedTracers.forEach(function (m) {
      scene.remove(m);
      m.geometry.dispose(); m.material.dispose();
    });
    stagedTracers = [];
  }

  function addStagedTracers() {
    clearStagedTracers();
    var p = sim.player;
    var dx = Math.sin(p.camYaw), dz = Math.cos(p.camYaw);
    var ox = p.x + dx * 0.9, oz = p.z + dz * 0.9;
    for (var k = 0; k < 3; k++) {
      var spread = (k - 1) * 0.55;
      var len = 26 - Math.abs(k - 1) * 6;
      var mat = new THREE.MeshBasicMaterial({
        color: k === 1 ? 0xffe14d : 0xff9d00, transparent: true, opacity: k === 1 ? 0.95 : 0.6,
      });
      var tr = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, len), mat);
      tr.position.set(
        ox + dx * len / 2 - Math.cos(p.camYaw) * spread,
        1.35 - k * 0.12,
        oz + dz * len / 2 + Math.sin(p.camYaw) * spread);
      tr.rotation.y = p.camYaw;
      scene.add(tr);
      stagedTracers.push(tr);
    }
    sim.muzzle.position.set(ox, 1.55, oz);
    sim.muzzle.intensity = 4;
  }

  // ------------------------------------------------------------ stages
  function resetStageCommon() {
    clearStagedTracers();
    hideDialogue();
    if (window.PH.debug.hideRoadblock) window.PH.debug.hideRoadblock();
    if (window.PH.debug.hideFallen) window.PH.debug.hideFallen();
    if (worldRefs.beacon) worldRefs.beacon.visible = false;
    sim.autoDrive = false;
    sim.holdPolice = false;
    sim.cruiseSpeed = null;
    camSide = 0;
    setNight(false);
    var ts = $('title-screen');
    if (ts) ts.style.display = 'none';
    var hud = $('hud');
    if (hud) hud.style.display = 'block';
    state.started = true;
  }

  function placeArrow(x, z, yaw, speed) {
    var a = sim.arrowCar;
    a.x = x; a.z = z; a.yaw = yaw; a.speed = speed || 0;
    sim.player.x = x; sim.player.z = z; sim.player.camYaw = yaw;
  }

  function stageChase() {
    resetStageCommon();
    state.inCar = true; state.currentCar = 'arrow';
    state.missionIndex = 1; state.missionStage = 1; state.missionTimeLeft = 240;
    state.money = 15300; state.respect = 140; // M1 is banked in this shot
    placeArrow(30, -4, Math.PI / 2, 12);
    window.PH.debug.setWanted(3);
    // Two police flanking the hero, like the concept: one left-rear, one
    // right-ahead in the oncoming lane — both inside the 3/4 frame.
    var cops = sim.police.filter(function (c) { return c.alive; });
    if (cops[0]) { cops[0].x = 26; cops[0].z = -8.4; cops[0].yaw = Math.PI / 2; cops[0].speed = 12; }
    if (cops[1]) { cops[1].x = 36; cops[1].z = 3.2; cops[1].yaw = Math.PI / 2; cops[1].speed = 12; }
    sim.holdPolice = true;
    sim.cruiseSpeed = 12; // pinned: the frame must survive a slow capture
    window.PH.debug.placeRoadblock(112, 0, Math.PI / 2);
    window.PH.debug.snapHeli(13);
    window.PH.debug.clearCorridor(25, -7, 9);
    window.PH.debug.crowdNear(60, 0, 'x', 24);
    window.PH.debug.stageTraffic(30, -4, Math.PI / 2, 10);
    sim.autoDrive = true;
    cameraMode = 'chase'; camDist = 7.0; camSide = 2.2; camHeight = 2.8; // hero fills ~1/3 frame, whole car in shot
    return { shot: '1-chase', wanted: state.wanted, police: cops.length,
      heli: !!sim.heli, speed: Math.round(state.speedKmh) };
  }

  function stageStreet() {
    resetStageCommon();
    state.inCar = true; state.currentCar = 'arrow';
    state.missionIndex = 1; state.missionStage = 2; state.missionTimeLeft = 200;
    state.money = 15300; state.respect = 140; // M1 is banked in this shot
    placeArrow(97, 40, Math.PI, 12);
    window.PH.debug.setWanted(3);
    var cops = sim.police.filter(function (c) { return c.alive; });
    if (cops[0]) { cops[0].x = 91; cops[0].z = 22; cops[0].yaw = Math.PI; cops[0].speed = 12; }
    if (cops[1]) { cops[1].x = 103; cops[1].z = 22; cops[1].yaw = Math.PI; cops[1].speed = 12; }
    if (cops[2]) { cops[2].x = 97; cops[2].z = 6; cops[2].yaw = 0; cops[2].speed = 0; }
    sim.holdPolice = true;
    sim.cruiseSpeed = 12;
    window.PH.debug.placeRoadblock(97, -40, 0);
    window.PH.debug.snapHeli(13);
    window.PH.debug.clearCorridor(100, 49, 9);
    window.PH.debug.crowdNear(97, 40, 'z', 18);
    window.PH.debug.stageTraffic(97, 40, Math.PI, 6);
    sim.autoDrive = true;
    cameraMode = 'chase'; camDist = 7.0; camSide = 2.2; camHeight = 2.8;
    return { shot: '2-street', wanted: state.wanted, police: cops.length, heli: !!sim.heli };
  }

  function stageMission() {
    resetStageCommon();
    setNight(true); // true night: dark sky, kiosk lights carry the frame
    state.inCar = false; state.currentCar = null;
    state.missionIndex = 2; state.missionStage = 1; state.missionTimeLeft = 280;
    state.money = 20300; state.respect = 200; // M1 + M2 banked in this shot
    // Face SOUTH down the market street (yaw 0): the stalls line z 60..130
    // ahead of Mateo and the yellow beacon stands at the far end (z=132).
    // Facing north put the whole market behind his back in the first pass.
    var p = sim.player;
    p.x = -140; p.z = 58; p.camYaw = 0; p.speed = 0;
    window.PH.debug.setWanted(3);
    var cops = sim.police.filter(function (c) { return c.alive; });
    if (cops[0]) { cops[0].x = -144; cops[0].z = 86; cops[0].yaw = Math.PI; cops[0].speed = 0; }
    if (cops[1]) { cops[1].x = -136; cops[1].z = 86; cops[1].yaw = Math.PI; cops[1].speed = 0; }
    sim.holdPolice = true;
    window.PH.debug.placeRoadblock(-140, 100, 0);
    // Enemy off the tracer line so he reads beside Mateo instead of
    // hiding directly behind him; officer on the other side.
    window.PH.debug.showFallen(-138.2, 64, -142.5, 61.5); // big fallen enemy centre frame, 6 m ahead
    if (worldRefs.beacon) worldRefs.beacon.visible = true;
    window.PH.debug.snapHeli(16);
    window.PH.debug.clearCorridor(-140, 54, 8);
    window.PH.debug.crowdNear(-140, 58, 'z', 16, 1);
    addStagedTracers();
    showDialogue('KIRA', 'Market crew turned on us, Mateo. Cut straight through — the beacon is at the far end. Watch the rooftops.');
    cameraMode = 'foot'; camDist = 3.8; camSide = 0.8; camHeight = 2.0; // player big in frame
    return { shot: '3-mission', wanted: state.wanted, police: cops.length, night: true };
  }

  function stageTitle() {
    clearStagedTracers();
    hideDialogue();
    if (window.PH.debug.hideRoadblock) window.PH.debug.hideRoadblock();
    if (window.PH.debug.hideFallen) window.PH.debug.hideFallen();
    if (worldRefs.beacon) worldRefs.beacon.visible = false;
    setNight(false);
    sim.autoDrive = false;
    sim.holdPolice = false;
    sim.cruiseSpeed = null;
    camSide = 0;
    showTitle();
    // Title camera high in the south-east, looking west-north-west straight
    // down Ocean Drive: the road, its traffic and the sunlit signed
    // facades all read behind the title, no single wall fills the frame.
    camera.position.set(150, 30, 60);
    camera.lookAt(-60, 6, 0);
    return { shot: '4-start', title: true };
  }

  // ------------------------------------------------------------ camera
  function updateCamera(dt) {
    if (cameraMode === 'title') {
      var t = sim.time * 0.03;
      var cx = 150 + Math.sin(t) * 10;
      var cz = 60 + Math.cos(t * 0.7) * 6;
      camera.position.set(cx, 30, cz);
      camera.lookAt(-60, 6, 0);
      return;
    }
    var target, f, yaw;
    if (state.inCar) {
      var a = sim.arrowCar;
      yaw = a.yaw;
      f = { x: Math.sin(yaw), z: Math.cos(yaw) };
      target = { x: a.x, z: a.z };
    } else {
      var p = sim.player;
      yaw = p.camYaw;
      f = { x: Math.sin(yaw), z: Math.cos(yaw) };
      target = { x: p.x, z: p.z };
    }
    // Rear 3/4: behind the target, offset to the side so the hero's flank
    // and length fill the frame instead of a flat rear face.
    var r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    var want = {
      x: target.x - f.x * camDist + r.x * camSide,
      y: camHeight,
      z: target.z - f.z * camDist + r.z * camSide,
    };
    var k = 1 - Math.exp(-7 * dt);
    camPos.x += (want.x - camPos.x) * k;
    camPos.y += (want.y - camPos.y) * k;
    camPos.z += (want.z - camPos.z) * k;
    camera.position.set(camPos.x, camPos.y, camPos.z);
    camera.lookAt(target.x + f.x * 9 + r.x * camSide * 0.4, 1.4, target.z + f.z * 9 + r.z * camSide * 0.4);
  }

  function snapCameraToTarget() {
    var target = state.inCar ? sim.arrowCar : sim.player;
    var yaw = state.inCar ? sim.arrowCar.yaw : sim.player.camYaw;
    var f = { x: Math.sin(yaw), z: Math.cos(yaw) };
    var r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    camPos.x = target.x - f.x * camDist + r.x * camSide;
    camPos.y = camHeight;
    camPos.z = target.z - f.z * camDist + r.z * camSide;
    camera.position.set(camPos.x, camPos.y, camPos.z);
    camera.lookAt(target.x + f.x * 9 + r.x * camSide * 0.4, 1.4, target.z + f.z * 9 + r.z * camSide * 0.4);
  }

  // ------------------------------------------------------------ HUD
  function rankName() {
    if (state.respect < 150) return 'DOCK HAND';
    if (state.respect < 250) return 'STREET HUSTLER';
    if (state.respect < 400) return 'PIER RUNNER';
    return 'BAY KING';
  }

  function updateHUD() {
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    $('wanted-stars').textContent = stars;
    $('money').textContent = window.PH.fmtMoney(state.money);
    $('rank-line').textContent = 'RANK: ' + rankName() + ' · RESPECT ' + Math.round(state.respect);
    var loc = window.PH.locationName(sim.player.x, sim.player.z);
    $('loc-area').textContent = loc.area + ' · ' + loc.district;
    $('air-line').textContent = (sim.heli && sim.heli.visible)
      ? 'AIR: HELI SBPD-9 ON STATION' : 'AIR: CLEAR';
    radioIdx = Math.floor(sim.time / 9) % radioLines.length;
    $('radio-line').textContent = radioLines[radioIdx];
    $('mission-name').textContent = window.PH.missionLabel();
    $('mission-timer').textContent = '⏱ ' + window.PH.fmtClock(state.missionTimeLeft);
    var m = window.PH.mission();
    $('mission-stage').textContent = 'STAGE ' + state.missionStage + '/' + m.totalStages;
    $('mission-next').textContent = window.PH.nextObjective();
    var alive = sim.police.filter(function (c) { return c.alive; });
    $('police-count').textContent = 'POLICE: ' + alive.length + ' UNITS';
    var rows = '';
    alive.slice(0, 5).forEach(function (c) {
      var d = Math.round(Math.hypot(c.x - sim.player.x, c.z - sim.player.z));
      var cls = c.tactic === 'FLANK' ? ' flank' : (c.tactic === 'BLOCK' ? ' block' : '');
      rows += '<div class="p-row"><span>SBPD ' + c.unit + '</span>' +
        '<span class="badge' + cls + '">' + c.tactic + '</span><span>' + d + 'm</span></div>';
    });
    if (!rows) rows = '<div class="p-row"><span>SBPD —</span><span class="badge">CLEAR</span><span>—</span></div>';
    $('police-rows').innerHTML = rows;
    $('health-num').textContent = Math.round(state.health);
    $('armour-num').textContent = Math.round(state.armour);
    $('respect-num').textContent = Math.round(state.respect);
    $('health-fill').style.width = Math.max(0, state.health) + '%';
    $('armour-fill').style.width = Math.max(0, state.armour) + '%';
    $('respect-fill').style.width = Math.min(100, state.respect / 4) + '%';
    $('speedo').textContent = Math.round(state.speedKmh) + ' km/h · ' + (state.inCar ? 'SCARLET ARROW' : 'ON FOOT');
    var slots = document.querySelectorAll('#weapon-slots .w-slot');
    if (slots[1]) slots[1].innerHTML = '🔫<br>PISTOL ' + state.ammo;
    $('car-name').textContent = state.inCar ? 'SCARLET ARROW' : 'ON FOOT';
    $('car-cond').textContent = state.inCar
      ? 'CONDITION ' + Math.round(state.carCondition) + '% · FUEL ' + Math.round(state.carFuel) + '%'
      : 'CONDITION — · FUEL —';
    drawMinimap();
  }

  function drawMinimap() {
    var cv = $('minimap');
    if (!cv) return;
    var g = cv.getContext('2d');
    var W2 = 180, H2 = 180;
    g.fillStyle = '#0a1626'; g.fillRect(0, 0, W2, H2);
    var mx = function (x) { return (x + 260) * 0.29; };
    var my = function (z) { return (z + 160) * 0.29; };
    // Sea on the east.
    g.fillStyle = '#0a6fd6'; g.fillRect(mx(235), 0, W2 - mx(235), H2);
    // Streets.
    g.strokeStyle = '#5a6a7a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(mx(-260), my(0)); g.lineTo(mx(235), my(0)); g.stroke();
    window.PHWORLD.CROSS_X.forEach(function (cx) {
      g.beginPath(); g.moveTo(mx(cx), my(-150)); g.lineTo(mx(cx), my(150)); g.stroke();
    });
    // Gates.
    if (state.missionIndex === 1) {
      var gp = [[170, 0], [100, -60], [40, -120]][Math.min(state.missionStage - 1, 2)];
      g.fillStyle = '#ffd400'; g.fillRect(mx(gp[0]) - 4, my(gp[1]) - 4, 8, 8);
    }
    // Police red, heli white, player yellow.
    sim.police.forEach(function (c) {
      if (!c.alive) return;
      g.fillStyle = '#ff3b30';
      g.beginPath(); g.arc(mx(c.x), my(c.z), 3.5, 0, Math.PI * 2); g.fill();
    });
    if (sim.heli && sim.heli.visible) {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(mx(sim.heli.position.x), my(sim.heli.position.z), 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffe14d';
    g.beginPath(); g.arc(mx(sim.player.x), my(sim.player.z), 4.5, 0, Math.PI * 2); g.fill();
  }

  // ------------------------------------------------------------ loop
  function loop() {
    var dt = Math.min(clock.getDelta(), 0.25);
    if (dt <= 0) dt = 0.016;
    window.PH.simUpdate(dt);
    updateCamera(dt);
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.12; updateHUD(); }
    renderer.render(scene, camera);
  }

  // sim.update is invoked through this indirection so main.js never has to
  // know the sim module's internals beyond one function.
  window.PH.simUpdate = function (dt) { window.PH.sim.update(dt); };
  window.PH.simEnterCar = function () { window.PH.sim.enterCar(); };
  window.PH.simExitCar = function () { window.PH.sim.exitCar(); };

  // Expose the stages on the debug handle the probe and shots scripts use.
  window.PH.debug = Object.assign(window.PH.debug || {}, {
    stageChase: function () { var r = stageChase(); snapCameraToTarget(); updateHUD(); return r; },
    stageStreet: function () { var r = stageStreet(); snapCameraToTarget(); updateHUD(); return r; },
    stageMission: function () { var r = stageMission(); snapCameraToTarget(); updateHUD(); return r; },
    stageTitle: function () { var r = stageTitle(); updateHUD(); return r; },
    setNight: setNight,
  });
  window.PH.setCameraMode = function (mode, dist, height) {
    cameraMode = mode;
    if (dist) camDist = dist;
    if (height) camHeight = height;
    snapCameraToTarget();
  };
  window.PH.startGame = startGame;
  window.PH.showTitle = showTitle;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
