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
      /* GetInLeft / GetInRight (VehicleEnteringState.cs): take the nearer
         door. Car forward = (-sin cy, -cos cy); right side = (cos cy, -sin cy). */
      const rx = Math.cos(cy), rz = -Math.sin(cy);
      const toMateoX = playerMesh.position.x - best.position.x;
      const toMateoZ = playerMesh.position.z - best.position.z;
      const side = (toMateoX * rx + toMateoZ * rz) > 0 ? 'R' : 'L';
      const sgn = side === 'R' ? 1 : -1;
      const doorX = best.position.x + rx * 2.4 * sgn;
      const doorZ = best.position.z + rz * 2.4 * sgn;
      S.transition = { phase: 1, side, t: 0, dur: 0.5, fromX: playerMesh.position.x, fromZ: playerMesh.position.z,
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
/* Vehicle entering (VehicleEnteringState.cs, translated): phase 1 walks
   Mateo to the door (the door offset is the root end of the walk); phase 2
   is the GetInLeft / GetInRight anim — Mateo slides into the driver's seat
   and the game waits for it to finish before he sits (finishEnterCar).
   The GLB has no GetIn clips, so phase 2 is a procedural settle-in slide
   with a sit-down dip; the structure (side-specific door, wait for the
   anim) is the SA Unity one. */
function updateTransition(dt) {
  const tr = S.transition;
  if (!tr) return;
  tr.t += dt / tr.dur;
  const k = Math.min(1, tr.t);
  if (tr.phase === 2) {
    playerMesh.position.x = lerp(tr.fromX, tr.toX, k);
    playerMesh.position.z = lerp(tr.fromZ, tr.toZ, k);
    const mt = playerMesh.userData.mateo;
    if (mt && mt.root) mt.root.position.y = -0.2 * Math.sin(k * Math.PI); // dip into the seat
    mateoSetSpeed(0); // standing GetIn pose, not walking
    if (tr.t >= 1) finishEnterCar();
    return;
  }
  playerMesh.position.x = lerp(tr.fromX, tr.toX, k);
  playerMesh.position.z = lerp(tr.fromZ, tr.toZ, k);
  playerMesh.rotation.y = angleLerp(playerMesh.rotation.y, tr.car.rotation.y, clamp(8 * dt, 0, 1));
  mateoSetSpeed(2.25); // walk-to-door at the openvice walk speed, rigged Walk clip
  if (tr.t >= 1) {
    tr.phase = 2; tr.t = 0; tr.dur = 0.35;
    tr.fromX = playerMesh.position.x; tr.fromZ = playerMesh.position.z;
    tr.toX = tr.car.position.x; tr.toZ = tr.car.position.z;
  }
}
function shoot() {
  if (!S.started || S.paused || S.mode !== 'foot' || S.ammo <= 0) {
    if (S.mode === 'foot' && S.ammo <= 0) toast('OUT OF AMMO — FIND A CAR', 1400);
    return;
  }
  S.ammo--; $('ammo').textContent = '[' + S.ammo + '/12]';
  gunshot(); muzzle.intensity = 6; setTimeout(() => { muzzle.intensity = 0; }, 60);
  S.foughtT = 0; // the player fought first — 1★ cops may now fight back
  S.aimT = 0.33; // aim re-entry lock (PedManager.cs); sprint drops to Run while this is up
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
  mateoUpdate(dt); // rigged Mateo AnimationMixer advance
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateSea(dt);
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
/* Place a traffic car on its lane from its (road, along, dir) data. */
function placeCarOnLane(car) {
  const u = car.userData;
  if (u.vertical) { car.position.set(u.road + (u.dir > 0 ? 3 : -3), 0, u.along); car.rotation.y = u.dir > 0 ? Math.PI : 0; }
  else { car.position.set(u.along, 0, u.road + (u.dir > 0 ? 3 : -3)); car.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
}
/* v3.1: random traffic cars spawn anywhere on the grid — one sat 3 m
   from the staged mission car (seed 7) and the frame-1 collision
   flung the player car backwards. After staging, move any unstaged
   traffic car within r metres of (x, z) far down its own road. */
function clearNearPlayer(x, z, r) {
  for (let i = 3; i < traffic.length; i++) {
    const c = traffic[i], u = c.userData;
    if (dist2d(c.position, { x, z }) < r) {
      u.along = u.along > 0 ? -140 : 140;
      placeCarOnLane(c);
    }
  }
}
function snapCamBehindCar(car, lookY) {
  const ang = S.carYaw;
  const nudged = roadCenterNudge(car.position.x + Math.sin(ang) * 5.5, car.position.z + Math.cos(ang) * 5.5, car);
  camera.position.set(nudged.x, 2.9, nudged.z);
  camTarget.set(car.position.x - Math.sin(ang) * 6, lookY || 1.4, car.position.z - Math.cos(ang) * 6);
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
  for (const c of traffic) placeCarOnLane(c); // random cars start at the origin; put them on their lanes first
  if (SHOT === 'chase') {
    S.mode = 'car'; S.drivenCar = playerCar; playerCar.userData.owned = true;
    playerMesh.visible = false;
    /* v3.1 — OCEAN DRIVE (road x=-120, the beachfront boulevard): the
       Scarlet Arrow runs +Z with the sea + sand on the left and the
       art-deco hotel row + neon on the right, palms lining the road.
       Camera sits closer (5.5 m) so the car is LARGE in the centre. */
    playerCar.position.set(-117, 0, -40); S.carYaw = Math.PI; playerCar.rotation.y = Math.PI;
    playerCar.userData.vx = 0; playerCar.userData.vz = 20; S.carSpeed = 20;
    S.mission = 2; S.money = 18450; S.wanted = 4; S.carHealth = 72;
    playerCar.userData.health = 72;
    // oncoming traffic in the west lane (x=-123, heading -Z toward the player) + one car far ahead in-lane
    const oncoming = [[-123, -25, -1], [-123, -8, -1], [-117, 12, 1]];
    for (let i = 0; i < oncoming.length; i++) {
      const c = traffic[i], u = c.userData;
      u.vertical = true; u.road = -120; u.along = oncoming[i][1]; u.dir = oncoming[i][2];
      u.speed = u.cruise = 12;
      c.position.set(oncoming[i][0], 0, oncoming[i][1]);
      c.rotation.y = u.dir > 0 ? Math.PI : 0;
      u.vx = 0; u.vz = u.dir * 12;
    }
    // police flank in from the sides, ahead — visible in frame, converging, not head-on
    stagePoliceAt([[-126, -4, 38], [-108, -10, 34]]);
    /* Heli FULLY in frame (v3.1: was cut off at the top edge): low wide
       orbit ahead over the sea — angle 1.98 puts it ~20 m ahead and
       ~8 m to the sea side at 7.5 m height, ~19° off centre and ~11°
       above it, inside the vertical FOV with the raised chase
       look-target (see sim.js updateCamera). Orbit + height bob are
       frozen during shots (updateHeli) so it cannot drift out. */
    heli.userData.orbitR = 24; heli.userData.height = 6.5; heli.userData.angle = 1.98;
    heli.scale.setScalar(1.4);
    snapCamBehindCar(playerCar, 2.6);
    clearNearPlayer(-117, -40, 12); clearNearPlayer(-126, -4, 12); clearNearPlayer(-108, -10, 12);
    say('Almost there — left at the pier! We can lose them near the boardwalk.');
  } else if (SHOT === 'street') {
    S.mode = 'foot'; playerMesh.visible = true;
    /* v3.1 — Mateo walks the Ocean Drive promenade (east sidewalk,
       x≈-112): sea + sand on the left, art-deco hotels + neon on the
       right, palms overhead. He auto-walks (sim.js updateFoot) so the
       shot catches him mid-stride, slim and animated. */
    playerMesh.position.set(-112, 0, 0); playerMesh.rotation.y = Math.PI;
    S.yaw = Math.PI; S.pitch = 0.18; // camera looks +Z down the sidewalk
    S.mission = 0; S.money = 1250; S.wanted = 1;
    // a crowd on the sidewalk ahead of the camera
    const crowd = [[-113, 8], [-110, 11], [-114, 14], [-109, 17], [-112, 21]];
    for (let i = 0; i < crowd.length && i < peds.length; i++) {
      const p = peds[i], u = p.userData;
      u.vertical = true; u.road = -120; u.along = crowd[i][1]; u.dir = 1;
      u.side = crowd[i][0] - (-120); u.state = 'walk';
      p.position.set(crowd[i][0], 0, crowd[i][1]);
      p.rotation.y = 0;
    }
    // 1★ foot cop OBSERVING on the sidewalk ahead — walks toward Mateo, never rams.
    // Stands apart from the crowd (right side, 12 m out) so he reads clearly.
    const cop = copPeds[0];
    cop.visible = true;
    cop.position.set(-108, 0, 12);
    cop.rotation.y = Math.PI;
    cop.userData.status = 'OBSERVING'; cop.userData.dist = 12;
    cop.userData.closeT = 0; cop.userData.attackCd = 99; cop.userData.aimT = 0;
    cop.userData.patrol = { vertical: true, road: -120, along: 12, dir: 1, side: 8.5 };
    // one patrol car cruising Ocean Drive (PATROL ONLY at 1 star — no pursuit)
    const pc0 = police[0];
    pc0.visible = true; pc0.userData.status = 'PATROL';
    pc0.userData.vertical = true; pc0.userData.road = -120; pc0.userData.along = -30;
    pc0.userData.dir = 1; pc0.userData.speed = pc0.userData.cruise = 10;
    pc0.position.set(-117, 0, -30); pc0.rotation.y = Math.PI;
    // traffic passing on the road beside the sidewalk
    for (let i = 0; i < 2; i++) {
      const c = traffic[i], u = c.userData;
      u.vertical = true; u.road = -120; u.along = i === 0 ? 26 : -18; u.dir = i === 0 ? -1 : 1;
      u.speed = u.cruise;
      c.position.set(-120 + (u.dir > 0 ? 3 : -3), 0, u.along);
      c.rotation.y = u.dir > 0 ? Math.PI : 0;
    }
    // the Scarlet Arrow waits ahead on the road, like the concept mockup
    playerCar.position.set(-117, 0, 24); playerCar.rotation.y = Math.PI;
    clearNearPlayer(-112, 0, 12); clearNearPlayer(-117, -30, 12);
    camera.position.set(-112, 2.5, -4.9);
    camTarget.set(-112, 1.8, 1.5);
    camera.lookAt(camTarget);
    say('Mateo, I am at the pier gate. Walk over — no car yet, keep it quiet.');
  } else if (SHOT === 'mission') {
    S.mode = 'car'; S.drivenCar = playerCar; playerCar.userData.owned = true;
    playerMesh.visible = false;
    /* v3.1 — re-staged on OCEAN DRIVE (was road z=40, where a building
       face 2 m off the lane ate the right half of the frame): the Arrow
       runs -Z down the beachfront boulevard toward the pier safehouse
       (beacon ahead-left), sea on the left, deco hotels on the right. */
    playerCar.position.set(-123, 0, 80); S.carYaw = 0; playerCar.rotation.y = 0;
    playerCar.userData.vx = 0; playerCar.userData.vz = -18;
    S.carSpeed = 18;
    S.mission = 2; S.money = 18450; S.wanted = 3; S.carHealth = 85;
    playerCar.userData.health = 85;
    // oncoming traffic in the east lane (x=-117, heading +Z); one car far ahead in-lane
    const oncoming = [[-117, 60, 1], [-117, 45, 1], [-123, 30, -1]];
    for (let i = 0; i < oncoming.length; i++) {
      const c = traffic[i], u = c.userData;
      u.vertical = true; u.road = -120; u.along = oncoming[i][1]; u.dir = oncoming[i][2];
      u.speed = u.cruise = 12;
      c.position.set(oncoming[i][0], 0, oncoming[i][1]);
      c.rotation.y = u.dir > 0 ? Math.PI : 0;
      u.vx = 0; u.vz = u.dir * 12;
    }
    // police flank in from the sides, ahead of the car
    stagePoliceAt([[-132, 40, 38], [-108, 46, 34]]);
    /* Heli fully in frame (v3.1): low orbit ahead of the southbound car
       (angle -1.2 ≈ 18 m ahead, 7 m to the side, 7.5 m up), frozen for shots. */
    heli.userData.orbitR = 19.3; heli.userData.height = 7.5; heli.userData.angle = -1.2;
    heli.scale.setScalar(1.4);
    snapCamBehindCar(playerCar, 2.6);
    clearNearPlayer(-123, 80, 12); clearNearPlayer(-132, 40, 12); clearNearPlayer(-108, 46, 12);
    say('Almost there — left at the pier! We can lose them near the boardwalk.');
  }
  updateMissionHUD();
  updateHUD();
}

/* ---------- boot ---------- */
updateMissionHUD();
applyShot();
loop();
