// Mara Voss on foot and behind the wheel: movement, stealing cars,
// punching, shooting, Heat and the wanted level.

import {
  CAR_CLASSES, WALK_SPEED, RUN_SPEED, PUNCH_RANGE, PUNCH_DAMAGE,
  BULLET_SPEED, BULLET_DAMAGE, BULLET_RANGE, HEAT_MAX, HEAT_SHOOT,
  HEAT_PUNCH_PED, HEAT_ROB_CAR, REP_SPORTS_CAR, starsFromHeat,
} from './config.js';
import { collideCircle, hitBuilding } from './city.js';
import { clamp, normalizeAngle, angleTo, dist2 } from './random.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, // facing up the street
    health: 100, cash: 120, debt: 5000, rep: 0, heat: 0, ammo: 24,
    inCar: false, car: null, speed: 0,
    lastDamageAt: -99, bustedTimer: 0, aimAngle: -Math.PI / 2,
  };
}

// --- Heat and wanted -------------------------------------------------------

export function addHeat(state, amount, reason) {
  const p = state.player;
  const before = p.heat;
  p.heat = clamp(p.heat + amount, 0, HEAT_MAX);
  const starsBefore = starsFromHeat(before);
  const starsAfter = starsFromHeat(p.heat);
  if (starsAfter > starsBefore) {
    state.messages.push({ text: `Wanted level up: ${'★'.repeat(starsAfter)}`, color: '#ff5252', t: state.time });
  }
  if (reason && amount > 0) {
    state.messages.push({ text: reason, color: '#ffb400', t: state.time });
  }
}

export function updateWanted(state, dt) {
  const p = state.player;
  // Heat cools when Mara is not committing crimes. Clean driving cools faster.
  const clean = state.time - state.lastCrimeAt > 4;
  const rate = clean ? 2.2 + 1.6 : 2.2;
  if (p.heat > 0) p.heat = Math.max(0, p.heat - rate * dt);
  p.wanted = starsFromHeat(p.heat);
  // Slow health regen when out of trouble for a while.
  if (state.time - p.lastDamageAt > 6 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 4 * dt);
  }
}

// --- On foot ---------------------------------------------------------------

export function updateOnFoot(state, dt, input, mouseWorld) {
  const p = state.player;
  const axis = input.moveAxis();
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = running ? RUN_SPEED : WALK_SPEED;
  let mx = 0;
  let my = 0;
  if (axis.x !== 0 || axis.y !== 0) {
    const len = Math.hypot(axis.x, axis.y);
    mx = (axis.x / len) * speed;
    my = (axis.y / len) * speed;
    p.angle = Math.atan2(my, mx);
  }
  p.x += mx * dt;
  p.y += my * dt;
  collideCircle(state.city, p, 13);

  // Aim follows the mouse; shots and punches go that way.
  p.aimAngle = angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);

  // Punch.
  if (input.pressed('KeyF')) punch(state);
  // Shoot with Space or mouse click.
  if ((input.pressed('Space') || input.mouseClicked) && p.ammo > 0) shoot(state);
  else if ((input.pressed('Space') || input.mouseClicked) && p.ammo <= 0) {
    state.messages.push({ text: 'Out of ammo!', color: '#ff5252', t: state.time });
  }
}

export function punch(state) {
  const p = state.player;
  state.audio.punch();
  state.effects.burst(p.x + Math.cos(p.aimAngle) * 26, p.y + Math.sin(p.aimAngle) * 26,
    { count: 4, color: '#ffe9a8', speed: 120, life: 0.25, size: 2 });
  let hitAny = false;
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d2 = dist2(p.x, p.y, ped.x, ped.y);
    if (d2 < PUNCH_RANGE * PUNCH_RANGE) {
      const a = angleTo(p.x, p.y, ped.x, ped.y);
      if (Math.abs(a - p.aimAngle) < 1.2 || d2 < 20 * 20) {
        damagePed(state, ped, PUNCH_DAMAGE);
        ped.flee = true;
        ped.fleeX = ped.x - p.x;
        ped.fleeY = ped.y - p.y;
        hitAny = true;
        addHeat(state, HEAT_PUNCH_PED, 'Assault! The street saw that.');
        state.lastCrimeAt = state.time;
        state.effects.floatText(ped.x, ped.y - 18, `-${PUNCH_DAMAGE}`, '#ff8080');
        break;
      }
    }
  }
  if (!hitAny) state.messages.push({ text: 'Mara swings at the air.', color: '#cccccc', t: state.time });
}

export function shoot(state) {
  const p = state.player;
  p.ammo -= 1;
  state.audio.gunshot();
  const gx = p.x + Math.cos(p.aimAngle) * 20;
  const gy = p.y + Math.sin(p.aimAngle) * 20;
  state.effects.muzzle(gx, gy);
  state.bullets.push({
    x: gx, y: gy,
    vx: Math.cos(p.aimAngle) * BULLET_SPEED,
    vy: Math.sin(p.aimAngle) * BULLET_SPEED,
    dist: 0, maxDist: BULLET_RANGE, damage: BULLET_DAMAGE,
    from: 'player',
  });
  addHeat(state, HEAT_SHOOT, '');
  state.lastCrimeAt = state.time;
}

// --- Cars ------------------------------------------------------------------

export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function tryEnterCar(state) {
  const p = state.player;
  const car = nearestCar(state, p.x, p.y, 78);
  if (!car) {
    state.messages.push({ text: 'No car nearby.', color: '#cccccc', t: state.time });
    return;
  }
  if (car.class === 'police') {
    state.messages.push({ text: "Can't steal a police car — too hot.", color: '#ff5252', t: state.time });
    return;
  }
  if (car.class === 'sports' && p.rep < REP_SPORTS_CAR) {
    state.messages.push({ text: `That Getaway GT needs REP ${REP_SPORTS_CAR}. Yours: ${p.rep}.`, color: '#ffb400', t: state.time });
    state.audio.fail();
    return;
  }
  if (car.occupied) {
    // Robbery: the driver flees on foot.
    const driver = car.driverPed;
    if (driver) {
      driver.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      driver.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      driver.flee = true;
      driver.fleeX = driver.x - p.x;
      driver.fleeY = driver.y - p.y;
      driver.down = false;
    }
    car.occupied = false;
    car.driverPed = null;
    addHeat(state, HEAT_ROB_CAR, 'Carjacking! +12 Heat.');
    state.lastCrimeAt = state.time;
    state.messages.push({ text: 'Del: Nice ride. Drive it like you stole it — you did.', color: '#7ee787', t: state.time });
  } else {
    state.messages.push({ text: `Mara takes the ${CAR_CLASSES[car.class].name}.`, color: '#cccccc', t: state.time });
  }
  p.inCar = true;
  p.car = car;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
  state.audio.click();
  state.effects.dust(car.x, car.y);
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  p.inCar = false;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  collideCircle(state.city, p, 13);
  state.audio.click();
}

// Arcade driving: accelerate, brake/reverse, speed-dependent steering,
// handbrake turns. Collisions damage the car.
export function updateDriving(state, dt, input, mouseWorld) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.inCar = false; return; }
  const spec = CAR_CLASSES[car.class];
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const handbrake = input.down('Space');

  if (fwd) car.speed += spec.accel * dt;
  if (back) {
    if (car.speed > 12) car.speed -= spec.accel * 1.4 * dt;
    else car.speed -= spec.accel * 0.55 * dt;
  }
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 60 * dt;
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 420 * dt;
    if (Math.abs(car.speed) > 60) state.effects.dust(car.x, car.y);
  }
  car.speed = clamp(car.speed, -spec.topSpeed * 0.4, spec.topSpeed);
  if (Math.abs(car.speed) < 2 && !fwd && !back) car.speed = 0;
  if (car.wrecked) car.speed = clamp(car.speed, -40, 90);

  // Steering depends on speed; sharper with the handbrake.
  const steerRate = (handbrake ? 3.4 : 2.3) * clamp(Math.abs(car.speed) / 90, 0, 1);
  if (left) car.angle -= steerRate * dt * Math.sign(car.speed || 1);
  if (right) car.angle += steerRate * dt * Math.sign(car.speed || 1);
  car.angle = normalizeAngle(car.angle);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const beforeX = car.x;
  const beforeY = car.y;
  car.x = nx;
  car.y = ny;
  // Two-circle collision against buildings.
  const r = spec.width / 2 + 2;
  const fx = car.x + Math.cos(car.angle) * (spec.length / 2 - 8);
  const fy = car.y + Math.sin(car.angle) * (spec.length / 2 - 8);
  const bx = car.x - Math.cos(car.angle) * (spec.length / 2 - 8);
  const by = car.y - Math.sin(car.angle) * (spec.length / 2 - 8);
  const hitF = hitBuilding(state.city, fx, fy, r);
  const hitB = hitBuilding(state.city, bx, by, r);
  if (hitF || hitB || car.y > 2260 - r || car.x < r || car.x > 3200 - r || car.y < r) {
    const impact = Math.abs(car.speed);
    car.x = beforeX;
    car.y = beforeY;
    car.speed *= -0.25;
    if (impact > 140) {
      damageCar(state, car, Math.floor(impact / 22));
      state.effects.sparks(car.x, car.y);
      state.effects.addShake(Math.min(10, impact / 40));
      state.audio.crash();
      if (car.speed !== 0) state.messages.push({ text: 'Crash!', color: '#ff8080', t: state.time });
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Drive-by shooting with the mouse.
  p.aimAngle = angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);
  if ((input.pressed('KeyF') || input.mouseClicked) && p.ammo > 0 && !handbrake) {
    // F is the horn on wheels; the mouse does the shooting.
  }
  if (input.mouseClicked && p.ammo > 0) shoot(state);
  else if (input.mouseClicked && p.ammo <= 0) {
    state.messages.push({ text: 'Out of ammo!', color: '#ff5252', t: state.time });
  }
  // Wrecked cars smoke and can be abandoned.
  if (car.wrecked && Math.random() < dt * 6) state.effects.smoke(car.x, car.y - 6);
  state.audio.engine(Math.abs(car.speed) / spec.topSpeed, true);
}

export function damageCar(state, car, amount) {
  car.health -= amount;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = Math.min(car.speed, 40);
    state.effects.burst(car.x, car.y, { count: 20, color: '#ff9a3c', speed: 240, life: 0.7, size: 3 });
    state.effects.addShake(8);
    state.messages.push({ text: 'The car is wrecked!', color: '#ff5252', t: state.time });
    if (state.mission && state.mission.id === 2 && state.mission.stage === 'deliver' && state.player.car === car) {
      // The game loop turns this flag into a mission fail.
      state.missionFailReason = 'The package car was wrecked.';
    }
  }
}

// Damage a pedestrian: they fall, then get up and flee.
export function damagePed(state, ped, amount) {
  ped.health -= amount;
  if (ped.health <= 0 && !ped.down) {
    ped.down = true;
    ped.downTimer = 2.2;
    state.effects.burst(ped.x, ped.y, { count: 8, color: '#ff8080', speed: 120, life: 0.5, size: 3 });
  }
}

// Hurt Mara. Returns true when she is WASTED.
export function damagePlayer(state, amount) {
  const p = state.player;
  p.health -= amount;
  p.lastDamageAt = state.time;
  state.effects.addShake(6);
  if (p.health <= 0) {
    p.health = 0;
    return true;
  }
  return false;
}

// Player speed for the speedometer, km/h.
export function playerSpeedKmh(state) {
  if (!state.player.inCar || !state.player.car) return 0;
  return Math.round(Math.abs(state.player.car.speed) * 0.32);
}
