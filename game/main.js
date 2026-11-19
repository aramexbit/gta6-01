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
/* v3.5 foot camera: free look. Root causes of "hard to look around on
   foot": (1) foot sensitivity was 0.0022 rad/px — ~714 px of mouse travel
   for a 90° turn; (2) pitch was clamped to [-0.55, +1.2] rad, so looking
   UP stopped at 31°; (3) mouse look only worked while pointer lock was
   held — without a click the camera was locked facing forward. The car
   chase cam is untouched: it was smooth, keep its 0.0022. */
const FOOT_LOOK_SENS = 0.0040; // ~393 px for a 90° turn
const FOOT_PITCH_MIN = -1.05, FOOT_PITCH_MAX = 1.05; // ±60° up/down
let footDrag = null; // {x, y, moved} while the left button is held without pointer lock
let suppressClickShoot = false;
function applyFootLook(dx, dy) {
  S.yaw -= dx * FOOT_LOOK_SENS; // yaw is free, full 360°
  S.pitch = clamp(S.pitch + dy * FOOT_LOOK_SENS, FOOT_PITCH_MIN, FOOT_PITCH_MAX);
}
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || S.paused || !S.started) {
    // no pointer lock: drag to look (foot only)
    if (footDrag && S.mode === 'foot' && S.started && !S.paused) {
      const dx = e.clientX - footDrag.x, dy = e.clientY - footDrag.y;
      footDrag.x = e.clientX; footDrag.y = e.clientY;
      if (dx || dy) { applyFootLook(dx, dy); footDrag.moved = true; }
    }
    return;
  }
  if (S.mode === 'car') {
    camYawOffset += e.movementX * 0.0022; // swing the chase cam; it re-centers when idle
    camIdle = 0;
  } else applyFootLook(e.movementX, e.movementY);
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0 && document.pointerLockElement !== renderer.domElement)
    footDrag = { x: e.clientX, y: e.clientY, moved: false };
});
addEventListener('mouseup', (e) => {
  if (e.button === 0 && footDrag) { suppressClickShoot = footDrag.moved; footDrag = null; }
});
renderer.domElement.addEventListener('click', () => {
  audioInit();
  if (S.started && !S.paused) {
    if (suppressClickShoot) { suppressClickShoot = false; return; } // was a look-drag, not a shot
    if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
    else if (S.mode === 'foot') shoot();
  }
});
/* v3.3 aim: hold right mouse to aim (aim pose + viewmodel), release to
   stand down. The pistol stays in Mateo's hand the whole time. */
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 2 && S.started && !S.paused && S.mode === 'foot') { S.aiming = true; mateoAim(); }
});
addEventListener('mouseup', (e) => {
  if (e.button === 2 && S.aiming) { S.aiming = false; mateoSetSpeed(footSpeed); }
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
    // v3.5: taking a car is not itself a crime the police know about —
    // it only raises heat if someone SAW it (witness rule).
    best.userData.stolen = true;
    if (crimeWitnessed()) { setWanted(S.wanted + 1); toast('CAR STOLEN — WITNESSED ★', 2000); }
    else toast('CAR TAKEN — NO ONE SAW', 2000);
  } else if (best === playerCar && stolen) {
    // v3.6: the Arrow is the mission car Kira sent Mateo to take —
    // taking it is never a witnessed crime by itself (user: entering a
    // car = 0 stars first). The escape heat comes later, as its own
    // story beat (see updateMissions, mission 2).
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
  gunshot(); muzzle.intensity = 6; setTimeout(() => { if (!S.missionGlow) muzzle.intensity = 0; }, 60);
  mateoFire(); // v3.3: fire clip (0.3 s crossfade, returns to aim)
  const mt = playerMesh.userData.mateo;
  if (mt && mt.muzzleSprite) { mt.muzzleSprite.visible = true; setTimeout(() => { if (!S.missionGlow) mt.muzzleSprite.visible = false; }, 90); }
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
  } else if (crimeWitnessed()) {
    // v3.5: a shot nobody saw is just noise — the old 50% random star
    // on a miss is gone. A witness only ever takes wanted to 1 here;
    // hitting police (above) is what escalates to 2.
    if (S.wanted === 0) { setWanted(1); toast('SHOTS FIRED — WITNESSED ★', 1600); }
  }
}

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.frames++;
  if (S.frames === 5) { $('loading').style.display = 'none'; window.__PIERHEAT_READY = true; }
  if (!S.started || S.paused) { renderFrame(); return; }
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
  renderFrame(); // v3.3: bloom + grade composer (falls back to plain render)
}
window.__PIERHEAT = S;
window.__PIERHEAT_CAM = camera;
window.__PIERHEAT_DEBUG = { MISSIONS, BUILDINGS, playerPos, setWanted, completeStage, traffic, police, copPeds, peds, playerCar, playerMesh, heli, heli2, beacon, clearCops, copsNearCount, hurtPlayer, busted, stageChaseTraffic };

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
/* v3.3.1 — re-stage chase traffic RELATIVE to the player car, called by
   the shots script just before the 1-chase screenshot. The car travels
   ~150 m during the SwiftShader load, so any absolute traffic position
   staged at boot is stale by screenshot time; this puts 2 cars ahead
   in-lane (to be overtaken) and 3 oncoming in the west lane, all in
   frame ahead of the camera. Exposed as __PIERHEAT_DEBUG.stageChaseTraffic. */
function stageChaseTraffic() {
  const pz = playerCar.position.z;
  const spots = [
    { along: pz + 22, dir: 1 }, { along: pz + 36, dir: 1 },  // in-lane ahead (east)
    { along: pz + 28, dir: -1 }, { along: pz + 48, dir: -1 }, { along: pz + 68, dir: -1 }, // oncoming (west)
  ];
  for (let i = 0; i < spots.length && i < traffic.length; i++) {
    const c = traffic[i], u = c.userData;
    u.vertical = true; u.road = -120; u.along = spots[i].along; u.dir = spots[i].dir;
    u.speed = u.cruise = 12;
    c.position.set(-120 + (u.dir > 0 ? 3 : -3), 0, u.along);
    c.rotation.y = u.dir > 0 ? Math.PI : 0;
    u.vx = 0; u.vz = u.dir * 12;
  }
}
function applyShot() {
  if (!SHOT) return;
  if (SHOT === 'start') {
    // v3.3.1: the title card sits over a sunset street — camera on Ocean
    // Drive looking +Z toward the sun (was the default boot camera,
    // which faced the buildings and read as night).
    for (const c of traffic) placeCarOnLane(c);
    camera.position.set(-117, 4.5, -10);
    camTarget.set(-122, 3, 80);
    camera.lookAt(camTarget);
    updateHUD(); return; // stay on the start screen, minimap drawn
  }
  S.started = true;
  $('start').style.display = 'none';
  for (const c of traffic) placeCarOnLane(c); // random cars start at the origin; put them on their lanes first
  if (SHOT === 'chase') {
    S.mode = 'car'; S.drivenCar = playerCar; playerCar.userData.owned = true;
    playerMesh.visible = false;
    /* v3.3.1 — OCEAN DRIVE chase (top-rank pattern, 18 Nov 2026): the
       Scarlet Arrow runs +Z TOWARD the sunset (sun disc ahead at
       (-130, 30, 260)), camera pulled back to 7.5 m (sim.js updateCamera)
       so the car + street + sunset all read, speed held at ~150 KM/H
       (S.shotCruise, sim.js updatePlayer), THREE police units in a
       flanking formation that HOLDS its distance (u.shotHold, sim.js
       updatePolice — the v3.3 shot had two units ON the car at 3-4 m),
       heli overhead, traffic ahead in both lanes. Sea + sand on the
       left, art-deco hotel row + neon on the right, palms lining the
       road. */
    playerCar.position.set(-117, 0, -60); S.carYaw = Math.PI; playerCar.rotation.y = Math.PI;
    playerCar.userData.vx = 0; playerCar.userData.vz = 30; S.carSpeed = 30;
    S.shotCruise = true; // hold full throttle for the shot (~150 KM/H)
    S.mission = 2; S.money = 18450; S.wanted = 4; S.carHealth = 72;
    playerCar.userData.health = 72;
    // no spawns during the long SwiftShader load: foot cops + police
    // reinforcements would otherwise drive into the staged frame
    S.footTimer = -1e9; S.carTimer = -1e9;
    // initial traffic (re-staged relative to the car at screenshot time
    // by stageChaseTraffic, called from the shots script — the car
    // travels ~150 m during the load, so absolute positions go stale)
    for (let i = 0; i < 3; i++) {
      const c = traffic[i], u = c.userData;
      u.vertical = true; u.road = -120; u.along = -30 + i * 30; u.dir = i < 2 ? -1 : 1;
      u.speed = u.cruise = 12;
      c.position.set(-120 + (u.dir > 0 ? 3 : -3), 0, u.along);
      c.rotation.y = u.dir > 0 ? Math.PI : 0;
      u.vx = 0; u.vz = u.dir * 12;
    }
    // police in flanking formation (dx = right, dz = ahead of the player
    // car): left-front, right-front, right-rear — they HOLD these offsets
    // (updatePolice shotHold branch) instead of converging to ram.
    // Callsigns are bird/fish names, distinct from the top-rank units.
    const formation = [
      { dx: -9, dz: 16, name: 'PELICAN-4' },
      { dx: 9, dz: 12, name: 'TARPON-9' },
      { dx: 10, dz: -12, name: 'GULL-2' },
    ];
    for (let i = 0; i < formation.length && i < police.length; i++) {
      const pc = police[i], u = pc.userData;
      pc.visible = true;
      u.shotHold = { dx: formation[i].dx, dz: formation[i].dz };
      u.name = formation[i].name;
      u.status = 'PURSUIT';
      u.dist = Math.hypot(formation[i].dx, formation[i].dz);
      u.speed = 30; u.vx = 0; u.vz = 30;
      pc.position.set(-117 + formation[i].dx, 0, -60 + formation[i].dz);
      pc.rotation.y = Math.PI;
    }
    /* Heli FULLY in frame (v3.1: was cut off at the top edge): low wide
       orbit ahead over the sea — angle 1.98 puts it ~20 m ahead and
       ~8 m to the sea side at 7.5 m height, ~19° off centre and ~11°
       above it, inside the vertical FOV with the raised chase
       look-target (see sim.js updateCamera). Orbit + height bob are
       frozen during shots (updateHeli) so it cannot drift out. */
    heli.userData.orbitR = 24; heli.userData.height = 6.5; heli.userData.angle = 1.98;
    heli.scale.setScalar(1.4);
    snapCamBehindCar(playerCar, 2.6);
    clearNearPlayer(-117, -60, 12);
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
    S.mode = 'foot'; playerMesh.visible = true;
    /* v3.3 — FOOT FIRE on the Ocean Drive promenade (was a second car
       chase): Mateo stands in the aim pose, pistol in hand, muzzle
       flash held lit, facing a foot cop 12 m up the sidewalk — the
       frame proves the weapon is visible in his hand, not just a
       sound. */
    playerMesh.position.set(-112, 0, 40); playerMesh.rotation.y = 0; // facing -Z
    S.yaw = 0; S.pitch = 0.16; // camera behind Mateo, looking -Z down the sidewalk
    S.mission = 2; S.money = 18450; S.wanted = 1; S.carHealth = 85;
    // wanted=1 (not 2): at 2 stars EVERY police car pursues the player and
    // parks itself 2 m away — the last shot had two white units flanking
    // the camera. At 1 star the cars stay on patrol (frozen below), the
    // foot cop still freezes via aimT=999, and no reinforcements spawn.
    S.aiming = true; S.missionGlow = true; // hold the aim pose + muzzle glow for the shot
    // the target: a foot cop 12 m ahead, aiming back (FROZEN for the shot:
    // aimT=999 keeps the update loop's aim branch holding him still with
    // sp=0 — the old aimT=0 let him sprint to Mateo in ~3 s, and the
    // ~25 s SwiftShader load gave him plenty of time)
    const cop = copPeds[0];
    cop.visible = true;
    cop.position.set(-112, 0, 28);
    cop.rotation.y = Math.PI;
    cop.userData.status = 'AIMING'; cop.userData.dist = 12;
    cop.userData.closeT = 0; cop.userData.attackCd = 99; cop.userData.aimT = 999;
    cop.userData.patrol = { vertical: true, road: -120, along: 28, dir: -1, side: 8.5 };
    // no second foot cop may spawn during the long load (updateFootCops
    // spawns one every 4 s while below the cap) — freeze the spawn timers
    S.footTimer = -1e9; S.carTimer = -1e9;
    // BOTH patrol cars are PARKED far behind the camera for the shot
    // (cruise=0 + stepPatrolCar holds them at their `along`). At wanted 1
    // the pursuit branch is off, so they stay on patrol and never drive
    // through the frame.
    for (let i = 0; i < 2; i++) {
      const pc = police[i];
      pc.visible = true; pc.userData.status = 'PATROL';
      pc.userData.vertical = true; pc.userData.road = -120;
      pc.userData.along = 70 + i * 15; pc.userData.dir = -1;
      pc.userData.speed = pc.userData.cruise = 0;
      pc.position.set(-117, 0, 70 + i * 15); pc.rotation.y = 0;
    }
    // the Scarlet Arrow waits behind Mateo on the road
    playerCar.position.set(-120, 0, 52); playerCar.rotation.y = 0;
    clearNearPlayer(-112, 40, 12); clearNearPlayer(-112, 28, 12);
    clearNearPlayer(-117, 70, 12); clearNearPlayer(-117, 40, 15);
    camera.position.set(-112, 2.4, 45.2);
    camTarget.set(-112, 1.6, 34);
    camera.lookAt(camTarget);
    // play the fire clip once (animation only — NO live shoot(): the old
    // shoot() hitscan killed a ped and raised wanted 1 -> 2, which sent
    // the police cars swarming the camera). The muzzle glow is held lit
    // by missionGlow via loadPistol's hook.
    setTimeout(() => { if (SHOT === 'mission' && S.started) mateoFire(); }, 500);
    say('Hands where I can see them, Vega — drop the piece!');
  }
  updateMissionHUD();
  updateHUD();
}

/* ---------- boot ---------- */
updateMissionHUD();
applyShot();
loop();
