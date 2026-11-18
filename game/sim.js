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
  const vn = (ua.vx - ub.vx) * nx + (ua.vz - ub.vz) * nz;
  if (vn > 0) {
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
function updateFoot(dt, keys) {
  const running = keys.ShiftLeft || keys.ShiftRight;
  const maxSp = running ? 8 : 4.2;
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz += 1;
  if (keys.KeyS || keys.ArrowDown) mz -= 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  // camera-relative: forward/right from the orbit yaw
  const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw);
  const rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw);
  let dx = fx * mz + rx * mx, dz = fz * mz + rz * mx;
  const len = Math.hypot(dx, dz);
  if (len > 0) { dx /= len; dz /= len; }
  const target = len > 0 ? maxSp : 0;
  const rate = target > footSpeed ? 20 : 28; // accel / decel (m/s^2)
  footSpeed = Math.abs(target - footSpeed) <= rate * dt ? target : footSpeed + Math.sign(target - footSpeed) * rate * dt;
  playerMesh.position.x += dx * footSpeed * dt;
  playerMesh.position.z += dz * footSpeed * dt;
  footVel.x = dx * footSpeed; footVel.z = dz * footSpeed;
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
  if (len > 0) {
    const targetYaw = Math.atan2(-dx, -dz);
    playerMesh.rotation.y = angleLerp(playerMesh.rotation.y, targetYaw, clamp(12 * dt, 0, 1));
  }
  S.speedKmh = footSpeed * 3.6;
  const u = playerMesh.userData;
  const moving = footSpeed > 0.3;
  u.walkPhase += dt * (moving ? 9 : 0);
  const sw = moving ? Math.sin(u.walkPhase) * 0.5 : 0;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7;
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
    const oldX = car.position.x, oldZ = car.position.z;
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
    u.vx = (car.position.x - oldX) / Math.max(dt, 1e-4);
    u.vz = (car.position.z - oldZ) / Math.max(dt, 1e-4);
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
    const sw = Math.sin(u.walkPhase) * 0.45;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.6; u.armR.rotation.x = sw * 0.6;
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

/* ---------- police AI: pursuit lead + separation + rubber-band + roadblock ---------- */
function placePoliceNear(pc, pp) {
  const a = rnd() * Math.PI * 2;
  let x = pp.x + Math.cos(a) * 72, z = pp.z + Math.sin(a) * 72;
  // snap onto a road (never on top of the player, never inside a block)
  let nx = ROAD_X[0], nd = Infinity;
  for (const rx of ROAD_X) if (Math.abs(x - rx) < nd) { nd = Math.abs(x - rx); nx = rx; }
  let nz = ROAD_Z[0]; nd = Infinity;
  for (const rz of ROAD_Z) if (Math.abs(z - rz) < nd) { nd = Math.abs(z - rz); nz = rz; }
  if (Math.abs(x - nx) <= Math.abs(z - nz)) x = nx + (rnd() < 0.5 ? 3 : -3);
  else z = nz + (rnd() < 0.5 ? 3 : -3);
  pc.position.set(clamp(x, -150, 150), 0, clamp(z, -150, 150));
  pc.userData.vx = 0; pc.userData.vz = 0; pc.userData.speed = 0;
}
function updatePolice(dt) {
  const pp = playerPos();
  const car = S.drivenCar || playerCar;
  const pvx = S.mode === 'car' ? car.userData.vx : footVel.x;
  const pvz = S.mode === 'car' ? car.userData.vz : footVel.z;
  const pSpeed = Math.hypot(pvx, pvz);
  const want = S.wanted;
  const active = want === 0 ? 0 : Math.min(5, 1 + want);
  let idx = 0;
  for (const pc of police) {
    const u = pc.userData;
    if (idx >= active) { pc.visible = false; continue; }
    idx++;
    if (!pc.visible) {
      placePoliceNear(pc, pp);
      pc.visible = true; u.health = 100; u.status = 'EN ROUTE';
    }
    let dx = pp.x - pc.position.x, dz = pp.z - pc.position.z;
    let gap = Math.hypot(dx, dz) || 1e-3;
    if (gap > 150) { // leash: re-summon near the player, reads as a fresh interceptor
      placePoliceNear(pc, pp);
      dx = pp.x - pc.position.x; dz = pp.z - pc.position.z;
      gap = Math.hypot(dx, dz) || 1e-3;
    }
    // rubber-band chase speed: ramps with the gap, capped under the player's top speed
    let targetSpeed = Math.min(40, 26 + gap * 0.35);
    // pursuit: aim where the player WILL be (lead <= 1.2 s)
    const lead = Math.min(1.2, gap / Math.max(1e-3, targetSpeed + pSpeed));
    let dirX = (pp.x + pvx * lead) - pc.position.x;
    let dirZ = (pp.z + pvz * lead) - pc.position.z;
    // roadblock: the 2nd unit cuts ahead of a fast-moving player car
    if (idx === 2 && S.mode === 'car' && Math.abs(S.carSpeed) > 8 && gap > 30) {
      u.status = 'ROADBLOCK';
      const aheadX = pp.x - Math.sin(S.carYaw) * 26, aheadZ = pp.z - Math.cos(S.carYaw) * 26;
      dirX = aheadX - pc.position.x; dirZ = aheadZ - pc.position.z;
      targetSpeed = 20;
      if (dist2d(pc.position, { x: aheadX, z: aheadZ }) < 6) {
        targetSpeed = 0;
        pc.rotation.y = S.carYaw + Math.PI / 2; // park across the road
      }
    } else if (gap < 12 && idx === 1) {
      // only the lead unit rams; close in just above the player's speed (a nudge, not a smash)
      u.status = 'RAMMING'; targetSpeed = Math.min(16 + want * 3, pSpeed + 4);
    } else if (gap < 12) {
      u.status = 'PURSUIT'; targetSpeed = Math.min(targetSpeed, pSpeed + 2);
    } else if (gap < 45) u.status = 'PURSUIT';
    else u.status = 'EN ROUTE';
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
    // don't grind buildings: push out, kill inward velocity
    const res = resolveBuildings(pc.position.x, pc.position.z, CAR_RADIUS);
    if (res.hit) {
      const into = u.vx * res.nx + u.vz * res.nz;
      pc.position.x = res.x; pc.position.z = res.z;
      if (into < 0) { u.vx -= into * res.nx; u.vz -= into * res.nz; }
    }
    for (const w of u.wheels) w.rotation.x += u.speed * dt * 1.3;
    u.dist = gap;
    // ram: shove the player's car + damage on contact
    if (u.status === 'RAMMING' && S.mode === 'car' && gap < 3.6) {
      car.position.x += (car.position.x - pc.position.x) * 0.02;
      car.position.z += (car.position.z - pc.position.z) * 0.02;
      S.carHealth = Math.max(0, S.carHealth - 6 * dt);
      car.userData.health = S.carHealth;
    }
    // flashing lightbar
    if (u.lightbar) {
      const on = Math.floor(S.time * 6) % 2 === 0;
      u.lightbar.userData.r.material.color.setHex(on ? C.policeRed : 0x550000);
      u.lightbar.userData.b.material.color.setHex(on ? 0x220044 : C.policeBlue);
      u.lightbar.userData.rg.material.opacity = on ? 0.95 : 0.15;
      u.lightbar.userData.bg.material.opacity = on ? 0.15 : 0.95;
    }
  }
  // wanted decay: out of sight for a while
  if (want > 0) {
    let nearest = 999;
    for (const pc of police) if (pc.visible) nearest = Math.min(nearest, pc.userData.dist || 999);
    if (nearest > 70) { S.wantedTimer += dt; if (S.wantedTimer > 8) { setWanted(want - 1); S.wantedTimer = 0; } }
    else S.wantedTimer = 0;
  }
  // helicopter at wanted >= 3
  if (want >= 3) {
    heli.visible = true;
    heli.userData.angle += dt * 0.28;
    const a = heli.userData.angle;
    heli.position.set(pp.x + Math.cos(a) * 40, 20 + Math.sin(S.time * 0.7) * 2, pp.z + Math.sin(a) * 40);
    heli.lookAt(pp.x, 0, pp.z);
    heli.userData.rotor.rotation.y += dt * 22;
    heli.userData.spot.target.position.set(pp.x - heli.position.x, -20, pp.z - heli.position.z);
    heli.userData.spot.target.updateMatrixWorld();
    const on = Math.floor(S.time * 5) % 2 === 0;
    heli.userData.lightbar.children[0].material.color.setHex(on ? C.policeRed : 0x550000);
    heli.userData.lightbar.children[1].material.color.setHex(on ? 0x220044 : C.policeBlue);
  } else heli.visible = false;
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
    if (Math.abs(S.camYawOffset) > 0.001) camIdle += dt; else camIdle = 0;
    if (camIdle > 1.5) camYawOffset = damp(camYawOffset, 0, 1.2, dt);
    const ang = S.carYaw + camYawOffset;
    const fx = -Math.sin(ang), fz = -Math.cos(ang);
    const rx = Math.cos(ang), rz = -Math.sin(ang);
    // pull in as speed rises so damping lag doesn't widen the framing
    const dist = Math.max(6.5 * 0.5, 6.5 - speed * 0.08);
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
    const look = V3(
      car.position.x + fx * leadF + rx * leadL,
      1.4,
      car.position.z + fz * leadF + rz * leadL);
    camTarget.x = damp(camTarget.x, look.x, 4, dt);
    camTarget.y = damp(camTarget.y, look.y, 4, dt);
    camTarget.z = damp(camTarget.z, look.z, 4, dt);
    camera.lookAt(camTarget);
    camera.fov = damp(camera.fov, clamp(58 + speed * 0.5, 58, 72), 3, dt);
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
  const list = $('police-list');
  const act = police.filter((p) => p.visible);
  if (act.length === 0) list.innerHTML = '<li><span>NO UNITS NEARBY</span><span class="st">CLEAR</span></li>';
  else {
    list.innerHTML = act.slice(0, 4).map((p) => {
      const d = Math.round(p.userData.dist || 0);
      return '<li><span>🚔 ' + p.userData.name + ' · ' + d + 'm</span><span class="st">' + p.userData.status + '</span><span class="dot">●</span></li>';
    }).join('');
    if (heli.visible) list.innerHTML += '<li><span>🚁 HELI H-1 · OVERHEAD</span><span class="st">SPOTLIGHT</span><span class="dot">●</span></li>';
  }
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
