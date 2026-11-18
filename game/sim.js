/* PIER HEAT — Sunset Bay. sim.js: driving, walking, traffic, peds, police, camera, HUD.
   Movement model learned from reference repos (see ~/workspace/makefun/gta6-01-STUDY.md)
   and rewritten here in our own code. Shares globals with core.js / world.js / main.js. */
'use strict';

/* ---------- collision helpers ---------- */
const CAR_RADIUS = 1.9;
function crashDamage(impactSpeed) {
  return Math.min(30, Math.max(0, Math.abs(impactSpeed) - 12) * 1);
}
/* Push a circle (x,z,r) out of building AABBs. Returns {x, z, nx, nz, hit}. */
function resolveBuildings(x, z, r) {
  let nx = 0, nz = 0, hit = false;
  for (const b of BUILDINGS) {
    const dx = x - b.x, dz = z - b.z;
    const px = b.hw + r - Math.abs(dx), pz = b.hd + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      hit = true;
      if (px < pz) { x += dx > 0 ? px : -px; nx = dx > 0 ? 1 : -1; }
      else { z += dz > 0 ? pz : -pz; nz = dz > 0 ? 1 : -1; }
    }
  }
  return { x, z, nx, nz, hit };
}
/* March a ray from pivot along dir; shorten it before it enters a building. */
function cameraClearDist(px, py, pz, dx, dy, dz, dist) {
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * dist;
    const x = px + dx * t, y = py + dy * t, z = pz + dz * t;
    for (const b of BUILDINGS) {
      if (Math.abs(x - b.x) < b.hw + 0.6 && Math.abs(z - b.z) < b.hd + 0.6 && y < b.h + 1) {
        return Math.max(0.8, t - 0.6);
      }
    }
  }
  return dist;
}
/* Mass-weighted car-vs-car separation + impulse. a, b are car meshes. */
function collideCars(a, b) {
  const ua = a.userData, ub = b.userData;
  const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
  const d = Math.hypot(dx, dz);
  const min = CAR_RADIUS * 2;
  if (d >= min || d < 1e-4) return 0;
  const nx = dx / d, nz = dz / d, depth = min - d;
  const ma = ua.profile.mass, mb = ub.profile.mass;
  const fa = mb / (ma + mb), fb = ma / (ma + mb);
  a.position.x -= nx * depth * fa; a.position.z -= nz * depth * fa;
  b.position.x += nx * depth * fb; b.position.z += nz * depth * fb;
  let vn = (ua.vx - ub.vx) * nx + (ua.vz - ub.vz) * nz;
  if (vn > 0) {
    /* v3.1: cap the impulse. A traffic car teleporting across the map
       (lane wrap / recycle) gets a derived velocity of ~320 m / dt for
       one frame; uncapped, that impulse flung the player car 280 m
       into the map edge in the mission shot. */
    vn = Math.min(vn, 60);
    const rest = 0.4;
    const imp = -(1 + rest) * vn / (1 / ma + 1 / mb);
    ua.vx += (imp / ma) * nx; ua.vz += (imp / ma) * nz;
    ub.vx -= (imp / mb) * nx; ub.vz -= (imp / mb) * nz;
    return vn;
  }
  return 0;
}
function damageCar(car, impactSpeed) {
  const d = crashDamage(impactSpeed);
  if (d <= 0) return;
  car.userData.health -= d;
  if (car === (S.drivenCar || playerCar)) S.carHealth = Math.max(0, car.userData.health);
}

/* ---------- driving: velocity-vector arcade model ---------- */
function stepCar(car, input, dt) {
  const u = car.userData, cfg = u.profile;
  let yaw = car.rotation.y;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let vf = u.vx * fx + u.vz * fz;
  let vl = u.vx * rx + u.vz * rz;
  const ratio = Math.min(1, Math.abs(vf) / cfg.top);
  if (input.throttle > 0) vf += input.throttle * cfg.engine * (1 - 0.7 * ratio * ratio) * dt;
  if (input.throttle < 0) {
    if (vf > 0.5) vf = Math.max(0, vf - cfg.brake * dt);
    else vf = Math.max(-cfg.reverse, vf - cfg.engine * 0.6 * (1 - Math.min(1, Math.abs(vf) / cfg.reverse)) * dt);
  }
  if (input.handbrake) vf = vf > 0 ? Math.max(0, vf - 6 * dt) : Math.min(0, vf + 6 * dt);
  // rolling + aero drag
  const dragDecel = (0.0004 * vf * vf + 1.5) * dt;
  vf = vf > 0 ? Math.max(0, vf - dragDecel) : Math.min(0, vf + dragDecel);
  const top = input.boost ? cfg.top * 1.15 : cfg.top;
  vf = clamp(vf, -cfg.reverse, top);
  // steering: authority ramps with speed, falls off at high speed; handbrake flicks it
  const authority = Math.min(1, Math.abs(vf) / 4) / (1 + Math.abs(vf) / 25);
  const targetYawRate = input.steer * cfg.turn * authority * (vf >= 0 ? 1 : -1) * (input.handbrake ? 1.35 : 1);
  u.yawRate = damp(u.yawRate, targetYawRate, 9, dt);
  yaw += u.yawRate * dt;
  // grip bleeds lateral velocity; handbrake lets the tail step out (drift)
  const grip = input.handbrake ? cfg.gripHB : cfg.grip;
  vl *= Math.exp(-grip * dt);
  const nfx = -Math.sin(yaw), nfz = -Math.cos(yaw);
  const nrx = Math.cos(yaw), nrz = -Math.sin(yaw);
  u.vx = nfx * vf + nrx * vl;
  u.vz = nfz * vf + nrz * vl;
  car.position.x += u.vx * dt;
  car.position.z += u.vz * dt;
  car.position.x = clamp(car.position.x, -235, 155);
  car.position.z = clamp(car.position.z, -155, 155);
  car.rotation.y = yaw;
  // walls: push out, kill inward velocity, damage by impact speed
  const res = resolveBuildings(car.position.x, car.position.z, CAR_RADIUS);
  if (res.hit) {
    const into = u.vx * res.nx + u.vz * res.nz;
    car.position.x = res.x; car.position.z = res.z;
    if (into < 0) {
      u.vx -= into * res.nx; u.vz -= into * res.nz;
      u.vx *= 0.6; u.vz *= 0.6;
      damageCar(car, -into);
      if (car === (S.drivenCar || playerCar)) beep(120, 0.1, 'sawtooth', 0.1);
    }
  }
  for (const w of u.wheels) w.rotation.x += vf * dt * 1.4;
  if (u.wheels[0]) { u.wheels[0].rotation.y = input.steer * 0.4; u.wheels[1].rotation.y = input.steer * 0.4; }
  return { vf, vl };
}

const footVel = { x: 0, z: 0 };
let footSpeed = 0;
/* ---------- movement state machine (San Andreas Unity, translated) ----------
   BaseMovementState.cs priority: Jump > Walk > Run > Sprint > Panic > Stand.
   PedManager.cs: a state switch is locked 0.166 s after the last switch,
   and re-entering the aim state is locked 0.33 s (minTimeToReturnToAimState).
   Ped.cs:560-576: speed comes from the animation's root motion, not the
   input — the state picks the clip, the clip's authored speed moves Mateo.
   (Soldier.glb clips are in-place Mixamo clips with no root translation to
   extract, so each state's speed is its authored value below — the
   structure is the SA Unity one: input -> state -> clip -> speed.)
   JumpState.cs: jump = JUMP_launch -> JUMP_glide -> JUMP_land, re-entry
   0.4 s, no jump with a heavy weapon or while not grounded, no rotation
   change in the air, glide speed 2. Mateo's pistol is a LIGHT weapon, so
   sprinting and jumping with it are allowed; sprint cannot aim — shooting
   drops Sprint back to Run. Crouch / Roll / Surrender / Panic / DriveBy
   are reference only and are NOT implemented here. */
const MV = { STAND: 0, WALK: 4.2, RUN: 8, SPRINT: 11.5 };
const MV_SWITCH_LOCK = 0.166, MV_AIM_LOCK = 0.33, MV_JUMP_REENTRY = 0.4;
const MV_JUMP_GLIDE = 2; // JumpState.cs glideVelocity

function updateFoot(dt, keys) {
  const u = playerMesh.userData;
  u.mvState = u.mvState || 'STAND';
  u.mvStateT = (u.mvStateT || 0) + dt; // time since the last state switch
  u.jumpLockT = Math.max(0, (u.jumpLockT || 0) - dt);
  if ((S.aimT || 0) > 0) S.aimT -= dt; // aim re-entry lock (0.33 s)
  const shifting = !!(keys.ShiftLeft || keys.ShiftRight);
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz += 1;
  if (keys.KeyS || keys.ArrowDown) mz -= 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  /* Street shot: Mateo walks down Ocean Drive on his own so the shot
     catches him mid-stride, slim and animated — not standing still. */
  if (SHOT === 'street') { mx = 0; mz = 1; }
  // camera-relative: forward/right from the orbit yaw
  const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw);
  const rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw);
  let dx = fx * mz + rx * mx, dz = fz * mz + rz * mx;
  const len = Math.hypot(dx, dz);
  if (len > 0) { dx /= len; dz /= len; }
  const moving = len > 0;

  /* --- jump (Space on foot; Space is the handbrake in a car) --- */
  const spaceDown = !!keys.Space;
  if (spaceDown && !u.spacePrev && !u.jump && u.jumpLockT <= 0) {
    // CanJump(): light weapon (pistol) + grounded (always, on foot here)
    u.jump = { t: 0, dirX: moving ? dx : -Math.sin(playerMesh.rotation.y), dirZ: moving ? dz : -Math.cos(playerMesh.rotation.y) };
  }
  u.spacePrev = spaceDown;

  /* --- pick the target state from input (priority Jump > Walk > Run > Sprint) --- */
  let want = 'STAND';
  if (u.jump) want = 'JUMP';
  else if (moving) {
    if (shifting) {
      u.runHoldT = (u.runHoldT || 0) + dt; // hold Shift to build into a sprint
      want = (u.runHoldT > 1.0 && (S.aimT || 0) <= 0) ? 'SPRINT' : 'RUN'; // sprint cannot aim
    } else { u.runHoldT = 0; want = 'WALK'; }
  } else u.runHoldT = 0;
  /* state switch locked 0.166 s (PedManager.cs) — except INTO Jump, which
     must answer the button press at once (JumpState re-entry is its own lock) */
  if (want !== u.mvState && (want === 'JUMP' || u.mvStateT >= MV_SWITCH_LOCK)) {
    u.mvState = want; u.mvStateT = 0;
  }
  const state = u.mvState;

  /* --- root-motion speed: the state's clip speed moves Mateo --- */
  const target = state === 'JUMP' ? MV_JUMP_GLIDE : (moving ? (MV[state] || 0) : 0);
  const rate = target > footSpeed ? 20 : 28; // accel / decel (m/s^2)
  footSpeed = Math.abs(target - footSpeed) <= rate * dt ? target : footSpeed + Math.sign(target - footSpeed) * rate * dt;
  /* --- move: in the air the glide carries Mateo along the launch
     direction at 2 m/s and the heading is frozen (JumpState.cs: no
     rotation change in the air) --- */
  const jx = u.jump ? u.jump.dirX : dx, jz = u.jump ? u.jump.dirZ : dz;
  playerMesh.position.x += jx * footSpeed * dt;
  playerMesh.position.z += jz * footSpeed * dt;
  footVel.x = jx * footSpeed; footVel.z = jz * footSpeed;
  playerMesh.position.x = clamp(playerMesh.position.x, -235, 155);
  playerMesh.position.z = clamp(playerMesh.position.z, -155, 155);
  const res = resolveBuildings(playerMesh.position.x, playerMesh.position.z, 0.4);
  playerMesh.position.x = res.x; playerMesh.position.z = res.z;
  // never walk through a car
  for (const c of [...traffic, ...police, playerCar]) {
    if (c === (S.drivenCar || playerCar) && S.mode === 'car') continue;
    if (!c.visible && police.includes(c)) continue;
    const d = dist2d(playerMesh.position, c.position);
    if (d < CAR_RADIUS + 0.4 && d > 1e-3) {
      const push = (CAR_RADIUS + 0.4 - d);
      playerMesh.position.x += (playerMesh.position.x - c.position.x) / d * push;
      playerMesh.position.z += (playerMesh.position.z - c.position.z) / d * push;
    }
  }
  if (len > 0 && !u.jump) {
    const targetYaw = Math.atan2(-dx, -dz);
    playerMesh.rotation.y = angleLerp(playerMesh.rotation.y, targetYaw, clamp(12 * dt, 0, 1));
  }
  S.speedKmh = footSpeed * 3.6;

  /* --- jump phases: launch (0.18 s) -> glide (0.37 s) -> land (0.15 s) ---
     The GLB has no JUMP_launch/glide/land clips, so the three phases are
     driven on the model root (rise / tucked glide / crouch recover) while
     the mixer holds the Idle clip — the timing and the rules are the
     JumpState.cs ones. */
  let jumpY = 0, jumpLean = 0;
  if (u.jump) {
    const j = u.jump; j.t += dt;
    const LAUNCH = 0.18, GLIDE = 0.37, LAND = 0.15, TOTAL = LAUNCH + GLIDE + LAND;
    if (j.t < LAUNCH) { // JUMP_launch: crouch, then rise
      const k = j.t / LAUNCH;
      jumpY = k * k * 0.35; jumpLean = -0.08 * k;
    } else if (j.t < LAUNCH + GLIDE) { // JUMP_glide: tucked, peak 0.9 m
      const k = (j.t - LAUNCH) / GLIDE;
      jumpY = 0.35 + Math.sin(k * Math.PI) * 0.55; jumpLean = -0.16;
    } else if (j.t < TOTAL) { // JUMP_land: settle, no upward movement
      const k = (j.t - LAUNCH - GLIDE) / LAND;
      jumpY = Math.max(0, 0.35 * (1 - k)); jumpLean = -0.08 * (1 - k);
    } else { // landed: back to Stand/Walk, 0.4 s before the next jump
      u.jump = null; u.jumpLockT = MV_JUMP_REENTRY;
      if (u.mvState === 'JUMP') { u.mvState = moving ? 'WALK' : 'STAND'; u.mvStateT = 0; }
    }
  }

  const moving2 = footSpeed > 0.3;
  // eased swing: amplitude ramps toward walk/run target instead of snapping
  // (crossfade-style blend, ~0.3 s) — drives the walk-phase bob timing.
  const targetSwing = moving2 ? (footSpeed > 6 ? 0.62 : 0.48) : 0;
  u.swing = damp(u.swing, targetSwing, 6, dt);
  u.walkPhase += dt * (moving2 ? (footSpeed > 6 ? 12 : 9) : 0);
  /* v3.1: rigged GLB Mateo — AnimationMixer crossfades Idle/Walk/Run
     (0.3 s), the openvice IDLE_STANCE / walk_player / run_player /
     SPRINT_civi pattern. Bob + forward lean live on the model wrapper. */
  mateoSetSpeed(u.jump ? 0 : footSpeed, state === 'SPRINT' ? 1.35 : 1);
  const bob = u.jump ? 0 : (moving2 ? Math.abs(Math.sin(u.walkPhase)) * 0.05 : Math.sin(S.time * 1.6) * 0.012);
  const mt = u.mateo;
  if (mt && mt.root) {
    mt.root.position.y = u.jump ? jumpY : bob;
    const lean = u.jump ? jumpLean : (footSpeed > 6 ? -0.10 : 0);
    mt.root.rotation.x = damp(mt.root.rotation.x || 0, lean, 6, dt);
  }
}

function updatePlayer(dt, keys) {
  if (S.transition) return; // walk-to-door animation owns the player
  if (S.mode === 'car') {
    const car = S.drivenCar || playerCar;
    const input = {
      throttle: ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0),
      steer: ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0),
      handbrake: !!keys.Space,
      boost: !!(keys.ShiftLeft || keys.ShiftRight),
    };
    const { vf } = stepCar(car, input, dt);
    S.carYaw = car.rotation.y;
    S.carSpeed = vf;
    S.speedKmh = Math.abs(vf) * 3.6;
    if (S.carHealth <= 0) {
      toast('CAR WRECKED — GET OUT!', 3000);
      S.carHealth = 100; car.userData.health = 100;
      tryEnterExitCar();
    }
  } else {
    updateFoot(dt, keys);
  }
}

/* ---------- traffic: lane following + IDM-lite car following + turns ---------- */
function laneAlong(car, x, z) { return car.userData.vertical ? z : x; }
function laneFixed(car, x, z) { return car.userData.vertical ? x : z; }
function updateTraffic(dt) {
  const allCars = [...traffic, ...police.filter((p) => p.visible), playerCar];
  if (S.drivenCar && S.drivenCar !== playerCar) allCars.push(S.drivenCar);
  for (const car of traffic) {
    if (S.drivenCar === car) continue;
    const u = car.userData;
    // --- leader: nearest car ahead in the same lane (IDM) ---
    let gap = Infinity, leaderSpeed = 0;
    for (const o of allCars) {
      if (o === car) continue;
      const of = laneFixed(o, o.position.x, o.position.z);
      if (Math.abs(of - u.road) > 6) continue;
      const oa = laneAlong(o, o.position.x, o.position.z);
      const ahead = (oa - u.along) * u.dir;
      if (ahead <= 0 || ahead > 40) continue;
      const g = ahead - 4;
      if (g < gap) { gap = g; leaderSpeed = Math.abs(o.userData.vertical !== undefined && o.userData.along !== undefined ? (o.userData.vertical ? o.userData.vz : o.userData.vx) : 0) || Math.hypot(o.userData.vx || 0, o.userData.vz || 0); }
    }
    // --- pedestrian in the path: brake so we can stop in time ---
    let pedGap = Infinity;
    for (const p of peds) {
      if (p.userData.state !== 'walk') continue;
      const pf = laneFixed(p, p.position.x, p.position.z);
      if (Math.abs(pf - u.road) > 2.6) continue;
      const pa = laneAlong(p, p.position.x, p.position.z);
      const ahead = (pa - u.along) * u.dir;
      if (ahead > 0 && ahead < 22) pedGap = Math.min(pedGap, ahead - 5);
    }
    // IDM: a=1.5, T=1.2s, s0=2, b=2.5 — crash-free by construction
    let target = u.cruise;
    if (gap < Infinity) {
      const v = u.speed, dv = v - leaderSpeed;
      const sStar = 2 + Math.max(0, v * 1.2 + (v * dv) / (2 * Math.sqrt(1.5 * 2.5)));
      const accel = 1.5 * (1 - Math.pow(v / u.cruise, 4) - Math.pow(sStar / Math.max(0.5, gap), 2));
      target = clamp(v + accel * dt * 4, 0, u.cruise);
    }
    if (pedGap < Infinity) target = Math.min(target, Math.sqrt(2 * 7 * Math.max(0, pedGap)));
    // --- intersection turns: slow down, sometimes turn onto the cross street ---
    const cross = u.vertical ? ROAD_Z : ROAD_X;
    let nearX = null;
    for (const c of cross) if (Math.abs(u.along - c) < 16) { nearX = c; break; }
    if (nearX !== null && Math.abs(u.along - nearX) < 3) {
      if (!u.turnDecided) {
        u.turnDecided = true;
        u.willTurn = rnd() < 0.3;
        u.turnAt = nearX;
      }
      if (u.willTurn) target = Math.min(target, 7);
    } else if (nearX === null) u.turnDecided = false;
    if (u.willTurn && u.turnAt !== undefined && Math.abs(u.along - u.turnAt) < 1.5) {
      const wasVertical = u.vertical;
      const pos = wasVertical ? car.position.x : car.position.z;
      u.vertical = !wasVertical;
      u.road = u.turnAt;
      u.along = pos;
      u.dir = rnd() < 0.5 ? 1 : -1;
      u.willTurn = false; u.turnAt = undefined;
    }
    u.speed = damp(u.speed, target, target < u.speed ? 5 : 2.6, dt);
    u.along += u.speed * u.dir * dt;
    if (u.along > CITY + 10) u.along = -CITY - 10;
    if (u.along < -CITY - 10) u.along = CITY + 10;
    if (u.vertical) { car.position.set(u.road + (u.dir > 0 ? 3 : -3), 0, u.along); car.rotation.y = u.dir > 0 ? Math.PI : 0; }
    else { car.position.set(u.along, 0, u.road + (u.dir > 0 ? 3 : -3)); car.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    /* v3.1: velocity IS the lane velocity — never the position delta.
       Deriving it from deltas exploded whenever a car was pushed,
       wrapped (~320 m / dt) or turned, and the feedback loop kept
       collided cars grinding with vn ~55 every frame (mission shot:
       the player car was flung 280 m into the map edge on frame 1). */
    if (u.vertical) { u.vx = 0; u.vz = u.dir * u.speed; }
    else { u.vx = u.dir * u.speed; u.vz = 0; }
    for (const w of u.wheels) w.rotation.x += u.speed * dt * 1.2;
  }
  // --- car-vs-car collisions (player car, traffic, police) ---
  const solids = [S.drivenCar || playerCar, ...traffic, ...police.filter((p) => p.visible)];
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    const a = solids[i], b = solids[j];
    if (a === b) continue;
    if (S.drivenCar === b && traffic.includes(b)) continue; // driven car is not traffic
    const vn = collideCars(a, b);
    if (vn > 0) {
      // a ramming police car damages the player through the ram push, not here too
      const driven = S.drivenCar || playerCar;
      const policeHit = (a.userData.isPolice && b === driven) || (b.userData.isPolice && a === driven);
      if (!policeHit) { damageCar(a, vn); damageCar(b, vn); }
      if (a === driven || b === driven) beep(120, 0.1, 'sawtooth', 0.1);
      if (a.userData.health <= 0) recycleCar(a);
      if (b.userData.health <= 0) recycleCar(b);
    }
  }
}
function recycleCar(car) {
  if (car === (S.drivenCar || playerCar)) return;
  if (car.userData.isPolice) { car.visible = false; car.position.set(200, -50, 200); car.userData.health = 100; return; }
  const vertical = rnd() < 0.5;
  const road = pick(vertical ? ROAD_X : ROAD_Z);
  car.userData.vertical = vertical; car.userData.road = road;
  car.userData.along = -CITY + rnd() * CITY * 2;
  car.userData.dir = rnd() < 0.5 ? 1 : -1;
  car.userData.health = 100; car.userData.speed = car.userData.cruise;
  car.userData.vx = 0; car.userData.vz = 0;
}

/* ---------- pedestrians: wander, flee, shoved / gibbed ---------- */
function updatePeds(dt) {
  const pp = playerPos();
  const threat = S.mode === 'car'
    ? { x: pp.x, z: pp.z, vx: (S.drivenCar || playerCar).userData.vx, vz: (S.drivenCar || playerCar).userData.vz, speed: Math.abs(S.carSpeed) }
    : { x: pp.x, z: pp.z, vx: footVel.x, vz: footVel.z, speed: footSpeed };
  for (const p of peds) {
    const u = p.userData;
    if (u.state === 'gone') {
      u.timer -= dt;
      if (u.timer <= 0) {
        u.state = 'walk'; u.timer = 0; p.visible = true; p.rotation.x = 0;
        p.position.set(-CITY + rnd() * CITY * 2, 0, -CITY + rnd() * CITY * 2);
        u.vertical = rnd() < 0.5; u.road = pick(u.vertical ? ROAD_X : ROAD_Z);
        u.along = -CITY + rnd() * CITY * 2; u.dir = rnd() < 0.5 ? 1 : -1;
      }
      continue;
    }
    if (u.state === 'down') {
      u.timer -= dt;
      p.rotation.x = u.timer > 0.5 ? Math.min(Math.PI / 2, p.rotation.x + dt * 9) : (u.timer / 0.5) * (Math.PI / 2);
      if (u.timer <= 0) { u.state = 'walk'; p.rotation.x = 0; }
      continue;
    }
    // fear: close proximity, or a fast threat bearing down on a path to hit them
    let scared = false, fx = 0, fz = 0;
    const dx = p.position.x - threat.x, dz = p.position.z - threat.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5.5) {
      scared = true; fx = dist > 1e-3 ? dx / dist : 1; fz = dist > 1e-3 ? dz / dist : 0;
    } else if (threat.speed > 8 && dist < 18) {
      const ts = Math.hypot(threat.vx, threat.vz) || 1;
      const tnx = threat.vx / ts, tnz = threat.vz / ts;
      const ahead = dx * tnx + dz * tnz;
      const lateral = dx * tnz - dz * tnx;
      if (ahead > 0 && Math.abs(lateral) < 3.6) {
        scared = true;
        const side = lateral >= 0 ? 1 : -1;
        fx = tnz * side; fz = -tnx * side;
      }
    }
    if (scared) {
      p.rotation.y = Math.atan2(-fz, fx);
      p.position.x += fx * 5 * dt; p.position.z += fz * 5 * dt;
      // keep the lane data in sync so they don't snap back when calm
      u.along = laneAlong(p, p.position.x, p.position.z);
      u.side = clamp(laneFixed(p, p.position.x, p.position.z) - u.road, -12, 12);
    } else {
      u.along += u.speed * u.dir * dt;
      if (u.along > CITY + 10) u.along = -CITY - 10;
      if (u.along < -CITY - 10) u.along = CITY + 10;
      if (u.vertical) { p.position.set(u.road + u.side, 0, u.along); p.rotation.y = u.dir > 0 ? 0 : Math.PI; }
      else { p.position.set(u.along, 0, u.road + u.side); p.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    }
    u.walkPhase += dt * 7;
    const targetSwing = u.state === 'walk' ? 0.42 : 0;
    u.swing = damp(u.swing, targetSwing, 6, dt);
    const sw = Math.sin(u.walkPhase) * u.swing;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.shinL.rotation.x = -Math.max(0, -sw) * 1.1;
    u.shinR.rotation.x = -Math.max(0, sw) * 1.1;
    u.armL.rotation.x = -sw * 0.6; u.armR.rotation.x = sw * 0.6;
    u.foreL.rotation.x = -0.3 - Math.abs(sw) * 0.3;
    u.foreR.rotation.x = -0.3 - Math.abs(sw) * 0.3;
    // hit by a car: shoved (<9 m/s) or gibbed (>=9 m/s)
    const cars = S.mode === 'car' ? [(S.drivenCar || playerCar)] : [...traffic, ...police.filter((pc) => pc.visible)];
    for (const c of cars) {
      if (dist2d(p.position, c.position) < 2.2) {
        const sp = Math.hypot(c.userData.vx || 0, c.userData.vz || 0);
        const byPlayer = c === (S.drivenCar || playerCar) && S.mode === 'car';
        if (sp >= 9) {
          u.state = 'gone'; u.timer = 3.5; p.visible = false;
          if (byPlayer) { setWanted(S.wanted + 1); toast('PEDESTRIAN DOWN — WANTED ★', 1800); beep(90, 0.2, 'sawtooth', 0.14); }
        } else if (sp >= 2) {
          u.state = 'down'; u.timer = 1.6;
          if (byPlayer) { setWanted(S.wanted + 1); beep(90, 0.15, 'sawtooth', 0.12); }
        }
        break;
      }
    }
  }
}

/* ---------- police AI: Vice City rules, translated to JS ----------
   Logic learned from gtavc-j2me-ref World.java (updateWanted, spawnCop,
   spawnPoliceCar, copsNear) and Ped.java (cop chase / arrest / shoot) —
   rewritten here in our own code, distances in metres (1 unit = 1 m):
   - wanted 0: PATROL ONLY — no pursuit. 2 foot cops walk beats, 2 cars cruise.
   - 1 star: max 1 foot cop, walks 3.6 m/s to arrest (2.2 s within 1.5 m);
     fights back ONLY if the player fights first; NO ram, NO shots, NO car spawn.
   - 2+ stars: police cars spawn (1; 2 at 4+), every 9 s, 28–42 m away;
     foot cops max 2 (3 at 3+), run 4.6 m/s, shoot on foot at 2.5–16 m
     after a 0.6 s aim (55% hit, 4–8 dmg); lead car may ram.
   - 3+ stars: heli; spotlight locks ~3 s, then it fires. 2nd heli at 5 stars.
   - Decay: no cop within 40 m for 22 s -> wanted -1; at 0: "You lost the cops." */
function copsNearCount(range) {
  const pp = playerPos();
  let n = 0;
  for (const cp of copPeds) if (cp.visible && dist2d(cp.position, pp) < range) n++;
  for (const pc of police) if (pc.visible && dist2d(pc.position, pp) < range) n++;
  return n;
}
function clearCops() {
  for (const cp of copPeds) { cp.visible = false; cp.position.set(200, -50, 200); cp.userData.status = 'PATROL'; cp.userData.closeT = 0; }
  for (const pc of police) {
    if (pc.userData.patrol) { pc.userData.status = 'PATROL'; }
    else { pc.visible = false; pc.position.set(200, -50, 200); pc.userData.status = 'PATROL'; }
  }
  heli.visible = false; heli2.visible = false;
  S.heliLockT = 0; S.heliLock2T = 0; S.calmT = 0;
}
/* Spawn a foot cop 28–42 m from the player, on a sidewalk. */
function spawnFootCop() {
  const cp = copPeds.find((c) => !c.visible);
  if (!cp) return;
  const pp = playerPos();
  const a = rnd() * Math.PI * 2, d = 28 + rnd() * 14;
  let x = pp.x + Math.cos(a) * d, z = pp.z + Math.sin(a) * d;
  let rx = ROAD_X[0], rd = Infinity;
  for (const v of ROAD_X) if (Math.abs(x - v) < rd) { rd = Math.abs(x - v); rx = v; }
  let rz = ROAD_Z[0]; rd = Infinity;
  for (const v of ROAD_Z) if (Math.abs(z - v) < rd) { rd = Math.abs(z - v); rz = v; }
  if (Math.abs(x - rx) <= Math.abs(z - rz)) x = rx + (x > rx ? 8.5 : -8.5);
  else z = rz + (z > rz ? 8.5 : -8.5);
  const res = resolveBuildings(clamp(x, -150, 150), clamp(z, -150, 150), 0.5);
  cp.position.set(res.x, 0, res.z);
  cp.visible = true;
  const u = cp.userData;
  u.status = 'OBSERVING'; u.closeT = 0; u.attackCd = 1.5; u.aimT = 0; u.angry = false;
  const pv = rnd() < 0.5;
  u.patrol = { vertical: pv, road: pv ? rx : rz, along: pv ? cp.position.z : cp.position.x,
    dir: rnd() < 0.5 ? 1 : -1, side: 8.5 };
}
/* Spawn a pursuit police car 28–42 m from the player, snapped onto a road. */
function placePoliceCarNear(pc) {
  const pp = playerPos();
  const a = rnd() * Math.PI * 2, d = 28 + rnd() * 14;
  const x = pp.x + Math.cos(a) * d, z = pp.z + Math.sin(a) * d;
  let nx = ROAD_X[0], nd = Infinity;
  for (const rx of ROAD_X) if (Math.abs(x - rx) < nd) { nd = Math.abs(x - rx); nx = rx; }
  let nz = ROAD_Z[0]; nd = Infinity;
  for (const rz of ROAD_Z) if (Math.abs(z - rz) < nd) { nd = Math.abs(z - rz); nz = rz; }
  if (Math.abs(x - nx) <= Math.abs(z - nz)) pc.position.set(nx + (rnd() < 0.5 ? 3 : -3), 0, clamp(z, -150, 150));
  else pc.position.set(clamp(x, -150, 150), 0, nz + (rnd() < 0.5 ? 3 : -3));
  pc.userData.vx = 0; pc.userData.vz = 0; pc.userData.speed = 0;
}
/* Lane-following patrol cruise for a police car (no pursuit). */
function stepPatrolCar(pc, dt) {
  const u = pc.userData;
  const oldX = pc.position.x, oldZ = pc.position.z;
  let target = u.cruise;
  for (const o of [...traffic, ...police]) {
    if (o === pc || !o.visible) continue;
    if (o.userData.along === undefined || o.userData.vertical === undefined) continue;
    const of = o.userData.vertical ? o.position.x : o.position.z;
    if (Math.abs(of - u.road) > 6) continue;
    const oa = o.userData.vertical ? o.position.z : o.position.x;
    const ahead = (oa - u.along) * u.dir;
    if (ahead > 0 && ahead < 14) target = Math.min(target, Math.max(0, (ahead - 5) * 0.8));
  }
  u.speed = damp(u.speed, target, 3, dt);
  u.along += u.speed * u.dir * dt;
  if (u.along > CITY + 10) u.along = -CITY - 10;
  if (u.along < -CITY - 10) u.along = CITY + 10;
  if (u.vertical) { pc.position.set(u.road + (u.dir > 0 ? 3 : -3), 0, u.along); pc.rotation.y = u.dir > 0 ? Math.PI : 0; }
  else { pc.position.set(u.along, 0, u.road + (u.dir > 0 ? 3 : -3)); pc.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
  if (u.vertical) { u.vx = 0; u.vz = u.dir * u.speed; } // v3.1: lane velocity, never delta (see updateTraffic)
  else { u.vx = u.dir * u.speed; u.vz = 0; }
  for (const w of u.wheels) w.rotation.x += u.speed * dt * 1.2;
  u.status = 'PATROL';
}
function updateFootCops(dt, pp) {
  const want = S.wanted;
  const maxFoot = want === 0 ? 2 : want === 1 ? 1 : want === 2 ? 2 : 3;
  // spawn cadence: every 4 s while below the cap (Vice City: time % 4000 < dt)
  S.footTimer += dt;
  let activeFoot = copPeds.filter((c) => c.visible).length;
  if (activeFoot < maxFoot && S.footTimer >= 4) { S.footTimer = 0; spawnFootCop(); activeFoot++; }
  for (const cp of copPeds) {
    const u = cp.userData;
    if (!cp.visible) continue;
    const dx = pp.x - cp.position.x, dz = pp.z - cp.position.z;
    const gap = Math.hypot(dx, dz) || 1e-3;
    u.dist = gap;
    if (gap > 160) { cp.visible = false; cp.position.set(200, -50, 200); continue; }
    if (want === 0) {
      // patrol beat: walk the sidewalk, turn at intersections
      const pt = u.patrol || { vertical: true, road: -80, along: cp.position.z, dir: 1, side: 8.5 };
      u.patrol = pt;
      pt.along += 1.6 * pt.dir * dt;
      if (pt.along > CITY) pt.along = -CITY;
      if (pt.along < -CITY) pt.along = CITY;
      if (pt.vertical) { cp.position.set(pt.road + pt.side, 0, pt.along); cp.rotation.y = pt.dir > 0 ? 0 : Math.PI; }
      else { cp.position.set(pt.along, 0, pt.road + pt.side); cp.rotation.y = pt.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      u.status = 'PATROL';
      u.swing = damp(u.swing, 0.4, 6, dt);
      u.walkPhase += dt * 7;
      const sw = Math.sin(u.walkPhase) * u.swing;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
      u.shinL.rotation.x = -Math.max(0, -sw) * 1.1;
      u.shinR.rotation.x = -Math.max(0, sw) * 1.1;
      u.armL.rotation.x = -sw * 0.6; u.armR.rotation.x = sw * 0.6;
      u.foreL.rotation.x = -0.3 - Math.abs(sw) * 0.3;
      u.foreR.rotation.x = -0.3 - Math.abs(sw) * 0.3;
      continue;
    }
    // --- wanted >= 1: close in on the player ---
    /* v3.1: 1-star foot cops run 4.6 m/s (was 3.6 — slower than Mateo's
       4.2 walk, so a walking player could NEVER be arrested: the cop met
       him head-on, then fell behind at 0.6 m/s and closeT kept resetting.
       4.6 still loses to Mateo's run (8) and sprint (11.5), so escape by
       running is always possible — the arrest rule just works now. */
    const runSpeed = 4.6;
    const dirX = dx / gap, dirZ = dz / gap;
    let sp = runSpeed;
    if (u.aimT > 0) { u.aimT -= dt; sp = 0; u.status = 'AIMING'; }
    else if (want === 1) u.status = gap < 2.5 ? 'ARREST' : 'OBSERVING';
    else u.status = gap < 16 ? 'PURSUIT' : 'EN ROUTE';
    cp.position.x += dirX * sp * dt;
    cp.position.z += dirZ * sp * dt;
    const res = resolveBuildings(cp.position.x, cp.position.z, 0.4);
    cp.position.x = res.x; cp.position.z = res.z;
    if (sp > 0.3) cp.rotation.y = Math.atan2(-dirX, -dirZ);
    u.swing = damp(u.swing, sp > 0.3 ? (want === 1 ? 0.45 : 0.55) : 0, 6, dt);
    u.walkPhase += dt * (sp > 0.3 ? 9 : 0);
    const sw = Math.sin(u.walkPhase) * u.swing;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.shinL.rotation.x = -Math.max(0, -sw) * 1.1;
    u.shinR.rotation.x = -Math.max(0, sw) * 1.1;
    u.armL.rotation.x = -sw * 0.6; u.armR.rotation.x = sw * 0.6;
    u.foreL.rotation.x = -0.3 - Math.abs(sw) * 0.3;
    u.foreR.rotation.x = -0.3 - Math.abs(sw) * 0.3;
    // 1 star: arrest after 2.2 s within 1.5 m (player on foot only)
    if (want === 1 && S.mode === 'foot') {
      if (gap < 1.5) { u.closeT += dt; if (u.closeT > 2.2) { busted(); return; } }
      else u.closeT = 0;
    }
    if (u.attackCd > 0) u.attackCd -= dt;
    // 1 star: fights back ONLY if the player fought first (or shot this cop)
    if (want === 1 && (S.foughtT < 5 || u.angry) && S.mode === 'foot' && gap <= 1.6 && u.attackCd <= 0) {
      u.attackCd = 2.2;
      hurtPlayer(5 + Math.floor(rnd() * 4));
      toast('COP FIGHTS BACK!', 900);
    }
    // 2+ stars: shoot on foot, 2.5–16 m, after a 0.6 s aim (55% hit, 4–8 dmg)
    if (want >= 2 && S.mode === 'foot' && gap > 2.5 && gap < 16 && u.attackCd <= 0 && u.aimT <= 0) {
      u.attackCd = 1.6 + rnd() * 1.2; u.aimT = 0.6;
      beep(1200, 0.08, 'square', 0.05);
      setTimeout(() => {
        if (S.wanted >= 2 && cp.visible && S.mode === 'foot') {
          gunshot();
          if (rnd() < 0.55) hurtPlayer(4 + Math.floor(rnd() * 4));
        }
      }, 600);
    }
    // melee at any wanted >= 2 when point blank
    if (want >= 2 && S.mode === 'foot' && gap <= 1.6 && u.attackCd <= 0) {
      u.attackCd = 1.6 + rnd() * 0.9;
      hurtPlayer(5 + Math.floor(rnd() * 4));
    }
  }
}
function updateHeli(h, lockKey, dt, pp, want) {
  h.visible = true;
  /* In a staged shot the heli holds its framed position (v3.1: the orbit
     drifted it out of frame / cut off at the top edge between staging
     and the screenshot). In live play it keeps orbiting. */
  if (!SHOT) h.userData.angle += dt * 0.28;
  const a = h.userData.angle;
  const r = h.userData.orbitR, ht = h.userData.height;
  /* In staged shots the heli also holds a fixed height (v3.1: the ±2 m
     bob pushed the rotor out of the top of the frame). */
  const bobH = SHOT ? 0 : Math.sin(S.time * 0.7) * 2;
  h.position.set(pp.x + Math.cos(a) * r, ht + bobH, pp.z + Math.sin(a) * r);
  h.lookAt(pp.x, 0, pp.z);
  h.userData.rotor.rotation.y += dt * 22;
  h.userData.spot.target.position.set(pp.x - h.position.x, -ht, pp.z - h.position.z);
  h.userData.spot.target.updateMatrixWorld();
  const on = Math.floor(S.time * 5) % 2 === 0;
  h.userData.lightbar.children[0].material.color.setHex(on ? C.policeRed : 0x550000);
  h.userData.lightbar.children[1].material.color.setHex(on ? 0x220044 : C.policeBlue);
  // spotlight lock: ~3 s overhead, then it fires (Vice City heli behaviour)
  S[lockKey] += dt;
  if (S[lockKey] > 3) {
    S.policeStatus = 'HELI LOCK';
    h.userData.spot.intensity = 6;
    if (Math.floor(S.time * 1.2) !== Math.floor((S.time - dt) * 1.2) && rnd() < 0.45) {
      hurtPlayer(3);
      toast('HELI FIRE!', 700);
    }
  } else h.userData.spot.intensity = 3.5;
}
function updatePolice(dt) {
  const pp = playerPos();
  const car = S.drivenCar || playerCar;
  const pvx = S.mode === 'car' ? car.userData.vx : footVel.x;
  const pvz = S.mode === 'car' ? car.userData.vz : footVel.z;
  const pSpeed = Math.hypot(pvx, pvz);
  const want = S.wanted;
  S.foughtT += dt;
  updateFootCops(dt, pp);

  // --- police cars ---
  // patrol units always exist; reinforcements spawn at wanted >= 2
  // (1 car; 2 at wanted >= 4), every 9 s, 28–42 m away.
  const reinfWant = want >= 2 ? (want >= 4 ? 2 : 1) : 0;
  S.carTimer += dt;
  let reinfActive = police.filter((p, i) => i >= 2 && p.visible).length;
  if (reinfActive < reinfWant && S.carTimer >= 9) {
    S.carTimer = 0;
    const pc = police.find((p, i) => i >= 2 && !p.visible);
    if (pc) { placePoliceCarNear(pc); pc.visible = true; pc.userData.health = 100; pc.userData.status = 'EN ROUTE'; reinfActive++; }
  }
  if (want < 2) { // stand the reinforcements down when the heat drops
    for (let i = 2; i < police.length; i++) {
      const pc = police[i];
      if (pc.visible) { pc.visible = false; pc.position.set(200, -50, 200); pc.userData.status = 'PATROL'; }
    }
  }
  // make sure the two patrol cars are on the road
  for (let i = 0; i < 2; i++) {
    const pc = police[i];
    if (!pc.visible) {
      const vertical = rnd() < 0.5;
      pc.userData.vertical = vertical;
      pc.userData.road = pick(vertical ? ROAD_X : ROAD_Z);
      pc.userData.along = -CITY + rnd() * CITY * 2;
      pc.userData.dir = rnd() < 0.5 ? 1 : -1;
      pc.userData.speed = pc.userData.cruise;
      pc.visible = true; pc.userData.status = 'PATROL';
    }
  }
  let worst = want === 0 ? 'PATROL' : 'OBSERVING';
  let idx = 0;
  for (const pc of police) {
    const u = pc.userData;
    if (!pc.visible) continue;
    const pursuing = want >= 2;
    if (!pursuing) {
      stepPatrolCar(pc, dt);
      /* v3.1 panel bug: patrol cars never wrote userData.dist, so the
         Police Response panel showed "UNIT P-03 0m". Distance is now
         computed for real every frame (and updateHUD recomputes live). */
      u.dist = dist2d(pc.position, pp);
      continue;
    }
    idx++;
    let dx = pp.x - pc.position.x, dz = pp.z - pc.position.z;
    let gap = Math.hypot(dx, dz) || 1e-3;
    if (gap > 150) { // leash: re-summon near the player
      placePoliceCarNear(pc);
      dx = pp.x - pc.position.x; dz = pp.z - pc.position.z;
      gap = Math.hypot(dx, dz) || 1e-3;
    }
    let targetSpeed = Math.min(40, 26 + gap * 0.35);
    const lead = Math.min(1.2, gap / Math.max(1e-3, targetSpeed + pSpeed));
    let dirX = (pp.x + pvx * lead) - pc.position.x;
    let dirZ = (pp.z + pvz * lead) - pc.position.z;
    /* De-escalation (user, 18 Nov): ram ONLY at wanted 3+, ONLY the lead
       unit, and ONLY in short bursts — 2 s of ramming, then a 4 s cooldown
       back to PURSUIT. At 2 stars the units chase without ramming; at 1
       star they only observe / arrest on foot. The panel therefore shows
       PURSUIT most of the time, RAMMING only while a burst is actually on. */
    u.ramCd = Math.max(0, (u.ramCd || 0) - dt);
    if ((u.ramT || 0) > 0) { // a ram burst already in progress: keep it up
      u.ramT -= dt;
      u.status = 'RAMMING'; targetSpeed = Math.min(16 + want * 3, pSpeed + 4);
      if (u.ramT <= 0) u.ramCd = 4;
    }
    // roadblock: the 2nd unit cuts ahead of a fast-moving player car
    else if (idx === 2 && S.mode === 'car' && Math.abs(S.carSpeed) > 8 && gap > 30) {
      u.status = 'ROADBLOCK';
      const aheadX = pp.x - Math.sin(S.carYaw) * 26, aheadZ = pp.z - Math.cos(S.carYaw) * 26;
      dirX = aheadX - pc.position.x; dirZ = aheadZ - pc.position.z;
      targetSpeed = 20;
      if (dist2d(pc.position, { x: aheadX, z: aheadZ }) < 6) {
        targetSpeed = 0;
        pc.rotation.y = S.carYaw + Math.PI / 2;
      }
    } else if (gap < 8 && idx === 1 && want >= 3 && u.ramCd <= 0) {
      // start a ram burst: lead unit only, 3+ stars, close range
      u.status = 'RAMMING'; u.ramT = 2.0; targetSpeed = Math.min(16 + want * 3, pSpeed + 4);
    } else if (gap < 45) u.status = 'PURSUIT';
    else u.status = 'EN ROUTE';
    if (u.status === 'RAMMING') worst = 'RAMMING';
    else if (worst !== 'RAMMING' && u.status === 'PURSUIT') worst = 'PURSUIT';
    // separation: fan out instead of stacking (1/d^2, radius 14 m)
    let sx = 0, sz = 0;
    for (const o of police) {
      if (o === pc || !o.visible) continue;
      const ax = pc.position.x - o.position.x, az = pc.position.z - o.position.z;
      const d = Math.hypot(ax, az);
      if (d > 1e-3 && d < 14) { sx += ax / (d * d); sz += az / (d * d); }
    }
    const sl = Math.hypot(sx, sz);
    if (sl > 1e-3) { dirX += (sx / sl) * 1.7; dirZ += (sz / sl) * 1.7; }
    const dl = Math.hypot(dirX, dirZ) || 1e-3;
    dirX /= dl; dirZ /= dl;
    u.speed = damp(u.speed, targetSpeed, 5, dt);
    u.vx = damp(u.vx, dirX * u.speed, 5, dt);
    u.vz = damp(u.vz, dirZ * u.speed, 5, dt);
    pc.position.x += u.vx * dt;
    pc.position.z += u.vz * dt;
    if (Math.hypot(u.vx, u.vz) > 0.5) pc.rotation.y = Math.atan2(-u.vz, u.vx);
    const res = resolveBuildings(pc.position.x, pc.position.z, CAR_RADIUS);
    if (res.hit) {
      const into = u.vx * res.nx + u.vz * res.nz;
      pc.position.x = res.x; pc.position.z = res.z;
      if (into < 0) { u.vx -= into * res.nx; u.vz -= into * res.nz; }
    }
    for (const w of u.wheels) w.rotation.x += u.speed * dt * 1.3;
    u.dist = gap;
    // ram: shove the player's car + damage on contact (3+ stars, lead unit, burst only)
    if (u.status === 'RAMMING' && S.mode === 'car' && gap < 3.6) {
      car.position.x += (car.position.x - pc.position.x) * 0.02;
      car.position.z += (car.position.z - pc.position.z) * 0.02;
      S.carHealth = Math.max(0, S.carHealth - 6 * dt);
      car.userData.health = S.carHealth;
    }
    if (u.lightbar) {
      const on = Math.floor(S.time * 6) % 2 === 0;
      u.lightbar.userData.r.material.color.setHex(on ? C.policeRed : 0x550000);
      u.lightbar.userData.b.material.color.setHex(on ? 0x220044 : C.policeBlue);
      u.lightbar.userData.rg.material.opacity = on ? 0.95 : 0.15;
      u.lightbar.userData.bg.material.opacity = on ? 0.15 : 0.95;
    }
  }
  // overall status: the honest headline for the Police Response panel
  if (want === 0) S.policeStatus = 'PATROL';
  else if (want === 1) {
    const arresting = copPeds.some((c) => c.visible && c.userData.status === 'ARREST');
    S.policeStatus = arresting ? 'ARREST' : 'OBSERVING';
  } else S.policeStatus = worst;
  // wanted decay: no cop within 40 m for 22 s -> wanted -1
  if (want > 0) {
    if (copsNearCount(40) === 0) {
      S.calmT += dt;
      if (S.calmT > 22) {
        setWanted(want - 1);
        S.calmT = 0;
        if (S.wanted === 0) { toast('You lost the cops.', 3000); say('Kira: Clean. They lost you — breathe, Mateo.'); }
      }
    } else S.calmT = 0;
  } else S.calmT = 0;
  // helicopters: wanted >= 3 (2nd at 5 stars)
  if (want >= 3) updateHeli(heli, 'heliLockT', dt, pp, want);
  else { heli.visible = false; S.heliLockT = 0; }
  if (want >= 5) updateHeli(heli2, 'heliLock2T', dt, pp, want);
  else { heli2.visible = false; S.heliLock2T = 0; }
  if (want > 0 && AC && !S.muted && Math.floor(S.time * 2) !== Math.floor((S.time - dt) * 2)) {
    beep(Math.floor(S.time * 2) % 2 === 0 ? 720 : 540, 0.42, 'sine', 0.035);
  }
}

/* ---------- camera: close chase cam + third-person foot orbit ---------- */
/* Nudge a chase-cam eye position toward the road centerline so a building
   face right beside the camera doesn't eat half the frame. */
function roadCenterNudge(x, z, car) {
  let rx = ROAD_X[0], d = Infinity;
  for (const v of ROAD_X) if (Math.abs(car.position.x - v) < d) { d = Math.abs(car.position.x - v); rx = v; }
  let rz = ROAD_Z[0]; d = Infinity;
  for (const v of ROAD_Z) if (Math.abs(car.position.z - v) < d) { d = Math.abs(car.position.z - v); rz = v; }
  // the road the car travels on follows its heading, not its exact position
  const fwdX = -Math.sin(car.rotation.y), fwdZ = -Math.cos(car.rotation.y);
  if (Math.abs(fwdZ) >= Math.abs(fwdX)) { // moving along Z: nudge x toward the road center
    return { x: x + Math.sign(rx - x) * Math.min(3.0, Math.abs(rx - x)), z };
  }
  return { x, z: z + Math.sign(rz - z) * Math.min(3.0, Math.abs(rz - z)) };
}
const camTarget = new THREE.Vector3();
let camYawOffset = 0, camIdle = 0;
function updateCamera(dt, keys) {
  if (S.mode === 'car') {
    const car = S.drivenCar || playerCar;
    const speed = Math.abs(S.carSpeed);
    // mouse swings the chase cam; it auto-centers behind the car when idle
    if (Math.abs(camYawOffset) > 0.001) camIdle += dt; else camIdle = 0;
    if (camIdle > 1.5) camYawOffset = damp(camYawOffset, 0, 1.2, dt);
    const ang = S.carYaw + camYawOffset;
    const fx = -Math.sin(ang), fz = -Math.cos(ang);
    const rx = Math.cos(ang), rz = -Math.sin(ang);
    // pull in as speed rises; v3.1 chase cam sits closer (was 7.5 m) so
    // the player car is LARGE in the centre of the frame, like the mockup
    const dist = Math.max(5.0, 6.2 - speed * 0.04);
    const pivot = V3(car.position.x, 1.4, car.position.z);
    const eyeDir = V3(Math.sin(ang), 0, Math.cos(ang)); // behind the car
    const clear = cameraClearDist(car.position.x, 2.9, car.position.z, eyeDir.x, 0, eyeDir.z, dist);
    const nudged = roadCenterNudge(car.position.x + Math.sin(ang) * clear, car.position.z + Math.cos(ang) * clear, car);
    const want = V3(nudged.x, 2.9, nudged.z);
    camera.position.x = damp(camera.position.x, want.x, 4, dt);
    camera.position.y = damp(camera.position.y, want.y, 4, dt);
    camera.position.z = damp(camera.position.z, want.z, 4, dt);
    // look-at leads along velocity: forward fully, lateral only 70% (bounded slide swing)
    const vf = S.carSpeed;
    const vl = car.userData.vx * rx + car.userData.vz * rz;
    const leadF = vf / 4;
    const leadL = clamp((vl / 4) * 0.7, -2, 2);
    /* v3.1: in chase/mission shots the camera looks a touch higher so the
       helicopter fits fully in frame (body + tail + rotor). */
    const lookY = SHOT === 'chase' ? 2.6 : SHOT === 'mission' ? 2.6 : 1.4;
    const look = V3(
      car.position.x + fx * leadF + rx * leadL,
      lookY,
      car.position.z + fz * leadF + rz * leadL);
    camTarget.x = damp(camTarget.x, look.x, 4, dt);
    camTarget.y = damp(camTarget.y, look.y, 4, dt);
    camTarget.z = damp(camTarget.z, look.z, 4, dt);
    camera.lookAt(camTarget);
    camera.fov = damp(camera.fov, clamp(56 + speed * 0.35, 56, 66), 3, dt);
    camera.updateProjectionMatrix();
  } else {
    // third-person orbit: mouse yaw/pitch around the avatar
    const pivot = V3(playerMesh.position.x, 1.6, playerMesh.position.z);
    const cp = Math.cos(S.pitch);
    const dirX = Math.sin(S.yaw) * cp, dirY = Math.sin(S.pitch), dirZ = Math.cos(S.yaw) * cp;
    const clear = cameraClearDist(pivot.x, pivot.y, pivot.z, dirX, dirY, dirZ, 5);
    const eye = V3(pivot.x + dirX * clear, Math.max(1.0, pivot.y + dirY * clear), pivot.z + dirZ * clear);
    camera.position.x = damp(camera.position.x, eye.x, 7, dt);
    camera.position.y = damp(camera.position.y, eye.y, 7, dt);
    camera.position.z = damp(camera.position.z, eye.z, 7, dt);
    const look = V3(pivot.x - Math.sin(S.yaw) * 1.5, pivot.y + 0.2, pivot.z - Math.cos(S.yaw) * 1.5);
    camTarget.x = damp(camTarget.x, look.x, 7, dt);
    camTarget.y = damp(camTarget.y, look.y, 7, dt);
    camTarget.z = damp(camTarget.z, look.z, 7, dt);
    camera.lookAt(camTarget);
    camera.fov = damp(camera.fov, 60, 3, dt);
    camera.updateProjectionMatrix();
  }
}

/* ---------- HUD & minimap ---------- */
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const W = 210, R = 105, scale = W / 520;
  const pp = playerPos();
  const toMap = (x, z) => [W / 2 + (x - pp.x) * scale * 1.6, W / 2 + (z - pp.z) * scale * 1.6];
  mm.fillStyle = CSS.indigo; mm.fillRect(0, 0, W, W);
  mm.save();
  mm.beginPath(); mm.arc(R, R, R, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = CSS.sea; mm.fillRect(0, 0, W / 2 + (-CITY - 38 - pp.x) * scale * 1.6 + 60, W);
  mm.strokeStyle = '#3a2a3a'; mm.lineWidth = 7;
  for (const x of ROAD_X) { const [ax] = toMap(x, 0); mm.beginPath(); mm.moveTo(ax, -10); mm.lineTo(ax, W + 10); mm.stroke(); }
  for (const z of ROAD_Z) { const [, az] = toMap(0, z); mm.beginPath(); mm.moveTo(-10, az); mm.lineTo(W + 10, az); mm.stroke(); }
  mm.strokeStyle = CSS.sun; mm.lineWidth = 1;
  for (const x of ROAD_X) { const [ax] = toMap(x, 0); mm.beginPath(); mm.moveTo(ax, -10); mm.lineTo(ax, W + 10); mm.stroke(); }
  for (const z of ROAD_Z) { const [, az] = toMap(0, z); mm.beginPath(); mm.moveTo(-10, az); mm.lineTo(W + 10, az); mm.stroke(); }
  mm.strokeStyle = CSS.pastel; mm.lineWidth = 5;
  { const [ax, az] = toMap(-198, 30); mm.beginPath(); mm.moveTo(ax + 32, az); mm.lineTo(ax - 32, az); mm.stroke(); }
  const m = MISSIONS[S.mission];
  const [mx, mz] = toMap(m.target[0], m.target[2]);
  mm.fillStyle = CSS.sun;
  mm.beginPath(); mm.moveTo(mx, mz - 9); mm.lineTo(mx + 8, mz); mm.lineTo(mx, mz + 9); mm.lineTo(mx - 8, mz); mm.closePath(); mm.fill();
  mm.strokeStyle = CSS.magenta; mm.lineWidth = 2; mm.stroke();
  mm.fillStyle = CSS.cream;
  for (const t of traffic) { const [tx, tz] = toMap(t.position.x, t.position.z); mm.fillRect(tx - 1.5, tz - 1.5, 3, 3); }
  for (const pc of police) {
    if (!pc.visible) continue;
    const [px, pz] = toMap(pc.position.x, pc.position.z);
    mm.fillStyle = (Math.floor(S.time * 4) % 2 === 0) ? '#FF2244' : '#2244FF';
    mm.beginPath(); mm.arc(px, pz, 4, 0, Math.PI * 2); mm.fill();
  }
  const yaw = S.mode === 'car' ? S.carYaw : S.yaw;
  mm.save(); mm.translate(R, R); mm.rotate(Math.PI - yaw);
  mm.fillStyle = CSS.magenta;
  mm.beginPath(); mm.moveTo(0, -11); mm.lineTo(8, 8); mm.lineTo(0, 4); mm.lineTo(-8, 8); mm.closePath(); mm.fill();
  mm.restore();
  mm.restore();
  mm.strokeStyle = CSS.cyan; mm.lineWidth = 3;
  mm.beginPath(); mm.arc(R, R, R - 2, 0, Math.PI * 2); mm.stroke();
}
function updateHUD() {
  $('money').textContent = '$' + S.money.toLocaleString();
  let html = '';
  for (let i = 0; i < 5; i++) html += '<span class="' + (i < S.wanted ? 'on' : '') + '">★</span>';
  $('stars').innerHTML = html;
  $('speed').innerHTML = Math.round(S.speedKmh) + ' <small>KM/H</small>';
  const car = S.mode === 'car' ? (S.drivenCar || playerCar) : null;
  $('car-name').textContent = car ? car.userData.name + (car === playerCar ? ' ★' : '') : 'ON FOOT — MATEO VEGA';
  const cond = car ? Math.round(S.carHealth) : 100;
  $('car-cond-fill').style.width = cond + '%';
  $('cond-label').textContent = 'CONDITION ~' + cond + '%';
  // third-person foot cam: the avatar is on screen, so no floating gun viewmodel
  viewmodel.visible = false;
  $('crosshair').style.display = S.mode === 'foot' && S.started && !S.paused ? 'block' : 'none';
  $('health-fill').style.width = Math.max(0, S.health) + '%';
  $('health-label').textContent = 'MATEO HEALTH ~' + Math.round(S.health) + '%';
  const list = $('police-list');
  const act = police.filter((p) => p.visible);
  const foot = copPeds.filter((c) => c.visible);
  // honest headline: PATROL / OBSERVING / PURSUIT / RAMMING / ARREST / HELI LOCK
  const statusEl = $('police-status');
  const statusText = { PATROL: 'PATROL ONLY — NO PURSUIT', OBSERVING: 'OBSERVING — FOOT UNIT CLOSING IN',
    PURSUIT: 'PURSUIT — UNITS CHASING', RAMMING: 'RAMMING — LEAD UNIT ATTACKING',
    ARREST: 'ARREST IMMINENT — MOVE!', 'HELI LOCK': 'HELI SPOTLIGHT LOCKED — TAKE COVER' }[S.policeStatus] || S.policeStatus;
  statusEl.textContent = '▸ ' + statusText;
  statusEl.style.color = S.wanted === 0 ? '#01CDFE' : S.wanted === 1 ? '#FFB347' : '#FF2A6D';
  let plist = '';
  /* v3.1: distances are computed LIVE from real positions every frame.
     A unit with no valid position yet shows "--", never "0m". */
  const pp = playerPos();
  const distStr = (pos) => {
    const d = Math.round(dist2d(pos, pp));
    return (isFinite(d) && d >= 0 && d < 900) ? d + 'm' : '--';
  };
  for (const c of foot) {
    plist += '<li><span>👮 COP · ' + distStr(c.position) + '</span><span class="st">' + c.userData.status + '</span><span class="dot">●</span></li>';
  }
  for (const p of act.slice(0, 4)) {
    plist += '<li><span>🚔 ' + p.userData.name + ' · ' + distStr(p.position) + '</span><span class="st">' + p.userData.status + '</span><span class="dot">●</span></li>';
  }
  if (heli.visible) plist += '<li><span>🚁 HELI H-1 · OVERHEAD</span><span class="st">' + (S.heliLockT > 3 ? 'LOCKED — FIRING' : 'SPOTLIGHT') + '</span><span class="dot">●</span></li>';
  if (heli2.visible) plist += '<li><span>🚁 HELI H-2 · OVERHEAD</span><span class="st">' + (S.heliLock2T > 3 ? 'LOCKED — FIRING' : 'SPOTLIGHT') + '</span><span class="dot">●</span></li>';
  list.innerHTML = plist || '<li><span>NO UNITS NEARBY</span><span class="st">CLEAR</span></li>';
  const m = MISSIONS[S.mission];
  const d = dist2d(playerPos(), V3(m.target[0], 0, m.target[2]));
  $('mission-fill').style.width = Math.max(0, Math.min(100, 100 - d / 2.2)) + '%';
  drawMinimap();
}

/* ---------- mission logic ---------- */
function updateMissions(dt) {
  if (S.over) return;
  const m = MISSIONS[S.mission];
  const pp = playerPos();
  const d = dist2d(pp, V3(m.target[0], 0, m.target[2]));
  beaconGem.rotation.y += dt * 2; beaconGem.position.y = 8 + Math.sin(S.time * 2) * 0.8;
  beaconCyl.material.opacity = 0.25 + Math.sin(S.time * 3) * 0.1;
  if (d < m.r) {
    if (S.mission === 0) { completeStage(); return; }
    if (S.mission === 1) {
      if (S.mode === 'car' && S.drivenCar === playerCar) { setWanted(3); completeStage(); return; }
      if (S.mode === 'foot') { toast('GET IN THE SCARLET ARROW — PRESS E', 1600); return; }
    }
    if (S.mission === 2) { setWanted(0); completeStage(); return; }
    if (S.mission === 3) { if (S.mode === 'car') completeStage(); else { toast('DELIVER BY CAR', 1400); return; } return; }
    if (S.mission === 4) { if (S.wanted === 0) completeStage(); else { toast('STILL WANTED — HIDE!', 1400); return; } return; }
    if (S.mission === 5) { completeStage(); return; }
    if (S.mission === 6) { completeStage(); return; }
    if (S.mission === 7) { completeStage(); return; }
  }
  if (S.mission === 4 && S.wanted === 0 && d < m.r) completeStage();
}
