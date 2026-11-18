/* PIER HEAT — Sunset Bay. main.js: input, enter/exit, shooting, loop, boot, shots.
   Shares globals with core.js / world.js / sim.js (classic scripts, one scope). */
'use strict';

/* ---------- input ---------- */
const keys = {};
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'KeyF') shoot();
  if (e.code === 'KeyR') { S.radioTrack = (S.radioTrack + 1) % RADIO.length;
    $('radio').textContent = '((·)) RADIO: NIGHTWAVE 98.3 — ' + RADIO[S.radioTrack]; beep(520, 0.08, 'square', 0.06); }
  if (e.code === 'KeyM') { S.muted = !S.muted; toast(S.muted ? 'SOUND OFF' : 'SOUND ON', 1200); }
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || S.paused || !S.started) return;
  if (S.mode === 'car') {
    camYawOffset += e.movementX * 0.0022; // swing the chase cam; it re-centers when idle
    camIdle = 0;
  } else {
    S.yaw -= e.movementX * 0.0022;
    S.pitch = clamp(S.pitch + e.movementY * 0.0022, -0.55, 1.2);
  }
});
renderer.domElement.addEventListener('click', () => {
  audioInit();
  if (S.started && !S.paused) {
    if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
    else if (S.mode === 'foot') shoot();
  }
});
function togglePause() {
  if (!S.started || S.over) return;
  S.paused = !S.paused;
  $('pause').style.display = S.paused ? 'flex' : 'none';
  if (!S.paused) audioInit();
}

/* ---------- enter / exit car (walk-to-door transition, step out left) ---------- */
function tryEnterExitCar() {
  if (!S.started || S.paused || S.transition) return;
  audioInit();
  if (S.mode === 'foot') {
    let best = null, bd = 5.5;
    const cands = [playerCar, ...traffic];
    for (const c of cands) {
      const d = dist2d(playerMesh.position, c.position);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      const cy = best.rotation.y;
      // door on the left side of the car
      const doorX = best.position.x - Math.cos(cy) * 2.4;
      const doorZ = best.position.z + Math.sin(cy) * 2.4;
      S.transition = { t: 0, dur: 0.5, fromX: playerMesh.position.x, fromZ: playerMesh.position.z,
        toX: doorX, toZ: doorZ, car: best };
      beep(220, 0.12, 'square', 0.09);
    } else toast('NO CAR NEARBY — GET CLOSER', 1400);
  } else {
    const car = S.drivenCar || playerCar;
    S.mode = 'foot';
    playerMesh.visible = true;
    playerMesh.position.copy(car.position);
    playerMesh.position.x += Math.sin(S.carYaw) * 3; playerMesh.position.z += Math.cos(S.carYaw) * 3;
    S.yaw = S.carYaw; S.pitch = 0.18;
    footSpeed = 0;
    S.carSpeed = 0;
    beep(180, 0.1, 'square', 0.07);
  }
}
function finishEnterCar() {
  const tr = S.transition;
  const best = tr.car;
  const stolen = best !== playerCar || !best.userData.owned;
  S.mode = 'car';
  if (best === playerCar) playerCar.userData.owned = true;
  S.drivenCar = best;
  S.carYaw = best.rotation.y;
  S.carSpeed = 0;
  S.carHealth = Math.max(1, best.userData.health);
  camYawOffset = 0; camIdle = 0;
  playerMesh.visible = false;
  if (best !== playerCar && !best.userData.stolen) {
    best.userData.stolen = true; setWanted(S.wanted + 1); toast('CAR STOLEN — WANTED ★', 2000);
  } else if (best === playerCar && stolen) {
    setWanted(S.wanted + 1); toast('SCARLET ARROW STOLEN', 2000);
  }
  S.transition = null;
  saveGame();
}
function updateTransition(dt) {
  const tr = S.transition;
  if (!tr) return;
  tr.t += dt / tr.dur;
  const k = Math.min(1, tr.t);
  playerMesh.position.x = lerp(tr.fromX, tr.toX, k);
  playerMesh.position.z = lerp(tr.fromZ, tr.toZ, k);
  playerMesh.rotation.y = angleLerp(playerMesh.rotation.y, tr.car.rotation.y, clamp(8 * dt, 0, 1));
  const u = playerMesh.userData;
  u.walkPhase += dt * 9;
  const sw = Math.sin(u.walkPhase) * 0.5;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  if (tr.t >= 1) finishEnterCar();
}
function shoot() {
  if (!S.started || S.paused || S.mode !== 'foot' || S.ammo <= 0) {
    if (S.mode === 'foot' && S.ammo <= 0) toast('OUT OF AMMO — FIND A CAR', 1400);
    return;
  }
  S.ammo--; $('ammo').textContent = '[' + S.ammo + '/12]';
  gunshot(); muzzle.intensity = 6; setTimeout(() => { muzzle.intensity = 0; }, 60);
  S.foughtT = 0; // the player fought first — 1★ cops may now fight back
  // hitscan: nearest police (car or foot cop) in the camera-forward cone within 40 m
  const dir = V3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
  let hit = null, hd = 40, hitCop = null;
  for (const pc of police) {
    if (!pc.visible) continue;
    const d = dist2d(playerMesh.position, pc.position);
    if (d > 40) continue;
    const to = V3(pc.position.x - playerMesh.position.x, 0, pc.position.z - playerMesh.position.z).normalize();
    if (to.dot(dir) > 0.86 && d < hd) { hd = d; hit = pc; hitCop = null; }
  }
  for (const cp of copPeds) {
    if (!cp.visible) continue;
    const d = dist2d(playerMesh.position, cp.position);
    if (d > 40) continue;
    const to = V3(cp.position.x - playerMesh.position.x, 0, cp.position.z - playerMesh.position.z).normalize();
    if (to.dot(dir) > 0.86 && d < hd) { hd = d; hit = null; hitCop = cp; }
  }
  if (hitCop) {
    const u = hitCop.userData;
    u.angry = true; u.hp = (u.hp === undefined ? 100 : u.hp) - 34;
    toast('HIT COP!', 900);
    if (u.hp <= 0) { hitCop.visible = false; hitCop.position.set(200, -50, 200); setWanted(Math.max(S.wanted, 2)); }
    else setWanted(Math.max(S.wanted, 2));
  } else if (hit) {
    hit.userData.health -= 34;
    toast('HIT ' + hit.userData.name + '!', 900);
    if (hit.userData.health <= 0) { hit.visible = false; hit.position.set(200, -50, 200); setWanted(S.wanted + 1); }
    else setWanted(Math.max(S.wanted, 2));
  } else if (S.wanted === 0 && rnd() < 0.5) setWanted(1);
}

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.frames++;
  if (S.frames === 5) { $('loading').style.display = 'none'; window.__PIERHEAT_READY = true; }
  if (!S.started || S.paused) { renderer.render(scene, camera); return; }
  S.time += dt;
  updateTransition(dt);
  updatePlayer(dt, keys);
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateMissions(dt);
  updateCamera(dt, keys);
  updateHUD();
  engineUpdate();
  renderer.render(scene, camera);
}
window.__PIERHEAT = S;
window.__PIERHEAT_CAM = camera;
window.__PIERHEAT_DEBUG = { MISSIONS, BUILDINGS, playerPos, setWanted, completeStage, traffic, police, copPeds, peds, playerCar, playerMesh, heli, heli2, beacon, clearCops, copsNearCount, hurtPlayer, busted };

/* ---------- start / continue / pause wiring ---------- */
function startGame(fromSave) {
  audioInit();
  if (fromSave) {
    const sv = loadSave();
    if (sv) {
      S.money = sv.money || 0; S.mission = Math.min(sv.mission || 0, 7);
      S.wanted = sv.wanted || 0;
      if (sv.x !== undefined) { playerMesh.position.set(sv.x, 0, sv.z); }
      if (sv.car === 'SCARLET ARROW') { playerCar.userData.owned = true; }
    }
  }
  S.started = true; S.paused = false;
  $('start').style.display = 'none';
  $('pause').style.display = 'none';
  updateMissionHUD();
  say(KIRA_LINES[S.mission] || MISSIONS[S.mission].line);
  updateHUD();
  toast('NIGHTWAVE 98.3 — "RUNNING RED"', 2200);
}
$('btn-start').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-resume').addEventListener('click', togglePause);
$('btn-restart').addEventListener('click', () => {
  S.mission = 0; S.money = 0; S.wanted = 0; S.carHealth = 100; S.ammo = 12; S.health = 100;
  clearCops();
  S.mode = 'foot'; playerMesh.visible = true; playerMesh.position.set(-118, 0, 20);
  playerCar.position.set(-104, 0, -24); playerCar.userData.owned = false;
  S.drivenCar = null; S.over = false;
  S.paused = false; $('pause').style.display = 'none';
  updateMissionHUD(); say(KIRA_LINES[0]);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- shot states (?shot=chase|street|mission|start) ---------- */
function snapCamBehindCar(car) {
  const ang = S.carYaw;
  const nudged = roadCenterNudge(car.position.x + Math.sin(ang) * 6.5, car.position.z + Math.cos(ang) * 6.5, car);
  camera.position.set(nudged.x, 3.4, nudged.z);
  camTarget.set(car.position.x - Math.sin(ang) * 6, 1.4, car.position.z - Math.cos(ang) * 6);
  camera.lookAt(camTarget);
}
function stagePoliceAt(spots) {
  for (let i = 0; i < spots.length && i < police.length; i++) {
    const pc = police[i];
    pc.visible = true;
    pc.position.set(spots[i][0], 0, spots[i][1]);
    pc.userData.status = 'PURSUIT'; pc.userData.dist = spots[i][2] || 25;
    pc.userData.speed = 10; pc.userData.vx = 0; pc.userData.vz = 0;
  }
}
function applyShot() {
  if (!SHOT) return;
  if (SHOT === 'start') { updateHUD(); return; } // stay on the start screen, minimap drawn
  S.started = true;
  $('start').style.display = 'none';
  if (SHOT === 'chase') {
    S.mode = 'car'; S.drivenCar = playerCar; playerCar.userData.owned = true;
    playerMesh.visible = false;
    // east lane (x=-37) heading +Z: buildings sit 10 m+ off the camera side, not 3 m
    playerCar.position.set(-37, 0, -40); S.carYaw = Math.PI; playerCar.rotation.y = Math.PI;
    playerCar.userData.vx = 0; playerCar.userData.vz = 20; S.carSpeed = 20;
    S.mission = 2; S.money = 18450; S.wanted = 4; S.carHealth = 72;
    playerCar.userData.health = 72;
    // oncoming traffic in the west lane (x=-43, heading -Z toward the player) + one car far ahead in-lane
    const oncoming = [[-43, -25, -1], [-43, -8, -1], [-37, 12, 1]];
    for (let i = 0; i < oncoming.length; i++) {
      const c = traffic[i], u = c.userData;
      u.vertical = true; u.road = -40; u.along = oncoming[i][1]; u.dir = oncoming[i][2];
      u.speed = u.cruise = 12;
      c.position.set(oncoming[i][0], 0, oncoming[i][1]);
      c.rotation.y = u.dir > 0 ? Math.PI : 0;
      u.vx = 0; u.vz = u.dir * 12;
    }
    // police flank in from the sides, ahead — visible in frame, converging, not head-on
    stagePoliceAt([[-52, -4, 38], [-22, -10, 34]]);
    // heli BIG in frame: close high orbit ahead-right, above the palms
    heli.userData.orbitR = 26; heli.userData.height = 14; heli.userData.angle = 1.2;
    heli.scale.setScalar(1.4);
    snapCamBehindCar(playerCar);
    say('Almost there — left at the pier! We can lose them near the boardwalk.');
  } else if (SHOT === 'street') {
    S.mode = 'foot'; playerMesh.visible = true;
    playerMesh.position.set(-71.5, 0, 0); playerMesh.rotation.y = Math.PI;
    S.yaw = Math.PI; S.pitch = 0.18; // camera looks +Z down the sidewalk
    S.mission = 0; S.money = 1250; S.wanted = 1;
    // a crowd on the sidewalk ahead of the camera
    const crowd = [[-73, 8], [-69, 11], [-74, 14], [-68, 17], [-71, 21]];
    for (let i = 0; i < crowd.length && i < peds.length; i++) {
      const p = peds[i], u = p.userData;
      u.vertical = true; u.road = -80; u.along = crowd[i][1]; u.dir = 1;
      u.side = crowd[i][0] - (-80); u.state = 'walk';
      p.position.set(crowd[i][0], 0, crowd[i][1]);
      p.rotation.y = 0;
    }
    // 1★ foot cop OBSERVING on the sidewalk ahead — walks toward Mateo, never rams.
    // Stands apart from the crowd (right side, 12 m out) so he reads clearly.
    const cop = copPeds[0];
    cop.visible = true;
    cop.position.set(-66, 0, 12);
    cop.rotation.y = Math.PI;
    cop.userData.status = 'OBSERVING'; cop.userData.dist = 12;
    cop.userData.closeT = 0; cop.userData.attackCd = 99; cop.userData.aimT = 0;
    cop.userData.patrol = { vertical: true, road: -80, along: 12, dir: 1, side: 8.5 };
    // one patrol car cruising the road (PATROL ONLY at 1 star — no pursuit)
    const pc0 = police[0];
    pc0.visible = true; pc0.userData.status = 'PATROL';
    pc0.userData.vertical = true; pc0.userData.road = -80; pc0.userData.along = -30;
    pc0.userData.dir = 1; pc0.userData.speed = pc0.userData.cruise = 10;
    pc0.position.set(-77, 0, -30); pc0.rotation.y = Math.PI;
    // traffic passing on the road beside the sidewalk
    for (let i = 0; i < 2; i++) {
      const c = traffic[i], u = c.userData;
      u.vertical = true; u.road = -80; u.along = i === 0 ? 26 : -18; u.dir = i === 0 ? -1 : 1;
      u.speed = u.cruise;
      c.position.set(-80 + (u.dir > 0 ? 3 : -3), 0, u.along);
      c.rotation.y = u.dir > 0 ? Math.PI : 0;
    }
    camera.position.set(-71.5, 2.5, -4.9);
    camTarget.set(-71.5, 1.8, 1.5);
    camera.lookAt(camTarget);
    say('Mateo, I am at the pier gate. Walk over — no car yet, keep it quiet.');
  } else if (SHOT === 'mission') {
    S.mode = 'car'; S.drivenCar = playerCar; playerCar.userData.owned = true;
    playerMesh.visible = false;
    // on road z=40, in the -X lane (z=37), heading west — the pier beacon is ahead-left
    playerCar.position.set(-104, 0, 37); S.carYaw = Math.PI / 2; playerCar.rotation.y = Math.PI / 2;
    playerCar.userData.vx = -Math.sin(Math.PI / 2) * 18; playerCar.userData.vz = -Math.cos(Math.PI / 2) * 18;
    S.carSpeed = 18;
    S.mission = 2; S.money = 18450; S.wanted = 3; S.carHealth = 85;
    playerCar.userData.health = 85;
    // oncoming lane (z=43) streams past; one car far ahead in-lane
    const oncoming = [[-125, 43, 1], [-140, 43, 1], [-150, 37, -1]];
    for (let i = 0; i < oncoming.length; i++) {
      const c = traffic[i], u = c.userData;
      u.vertical = false; u.road = 40; u.along = oncoming[i][0]; u.dir = oncoming[i][2];
      u.speed = u.cruise = 12;
      c.position.set(oncoming[i][0], 0, oncoming[i][1]);
      c.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      u.vx = u.dir * 12; u.vz = 0;
    }
    // police flank in from the sides, ahead of the car
    stagePoliceAt([[-140, 52, 38], [-146, 24, 34]]);
    heli.userData.orbitR = 26; heli.userData.height = 14; heli.userData.angle = 3.5;
    heli.scale.setScalar(1.4);
    snapCamBehindCar(playerCar);
    say('Almost there — left at the pier! We can lose them near the boardwalk.');
  }
  updateMissionHUD();
  updateHUD();
}

/* ---------- boot ---------- */
updateMissionHUD();
applyShot();
loop();
