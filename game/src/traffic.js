// Civilian traffic and pedestrians. Cars stay in their lanes, brake for
// each other, and flee gunfire; pedestrians walk the sidewalks, some jog,
// and scatter from gunfire and speeding cars.

import { CAR_CLASSES, ROAD_W, SIDEWALK_W } from './config.js';
import { ROADS_X, ROADS_Y, randomRoadPoint, randomSidewalkPoint, hitBuilding, onRoad } from './city.js';
import { clamp, angleDiff, normalizeAngle, dist2 } from './random.js';
import { damageCar, damagePed } from './player.js';

let nextCarId = 1;
let nextPedId = 1;

const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'];

export function makeCar(x, y, angle, cls, opts = {}) {
  const spec = CAR_CLASSES[cls];
  return {
    id: nextCarId++,
    class: cls,
    x, y, angle,
    speed: opts.speed ?? spec.topSpeed * 0.55,
    color: opts.color || spec.color,
    health: 100,
    wrecked: false,
    driver: opts.driver || 'traffic',
    occupied: opts.occupied !== undefined ? opts.occupied : true,
    driverPed: opts.driverPed || null,
    // Traffic state: which road it follows and which way.
    vertical: opts.vertical ?? true,
    dir: opts.dir ?? 1,
    lane: opts.lane ?? 22,
    parked: opts.parked || false,
    brake: 0,
    // Seconds until this car can take bump damage again (one hit per bump).
    bumpCd: 0,
    // Police wall-slide state: seconds left sliding, and which side.
    slideTimer: 0,
    slideDir: 1,
  };
}

export function makePed(x, y, opts = {}) {
  return {
    id: nextPedId++,
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: opts.jogging ? 150 : 55 + Math.random() * 40,
    jogging: !!opts.jogging,
    color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
    health: 100,
    down: false,
    downTimer: 0,
    flee: false,
    fleeX: 0, fleeY: 0,
    walkPhase: Math.random() * Math.PI * 2,
    // Sidewalk wandering: a target point to walk toward.
    tx: x, ty: y,
  };
}

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(Math.random);
    const cls = Math.random() < 0.14 ? 'taxi' : Math.random() < 0.2 ? 'pickup' : 'sedan';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const car = makeCar(p.x, p.y, p.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      cls, { vertical: p.vertical, dir, lane: 22, occupied: true });
    // Give occupied cars a driver pedestrian (they flee if robbed).
    const driver = makePed(car.x, car.y);
    car.driverPed = driver;
    state.cars.push(car);
  }
}

export function spawnParkedCars(state, count) {
  const classes = ['sedan', 'sedan', 'taxi', 'pickup'];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(Math.random);
    const cls = classes[Math.floor(Math.random() * classes.length)];
    const angle = p.vertical ? Math.PI / 2 : 0;
    const off = (Math.random() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 14);
    const car = makeCar(
      p.vertical ? p.x + off : p.x,
      p.vertical ? p.y : p.y + off,
      angle, cls, { speed: 0, parked: true, occupied: false, driver: null, vertical: p.vertical, dir: 1 });
    state.cars.push(car);
  }
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint(Math.random);
    state.peds.push(makePed(p.x, p.y, { jogging: Math.random() < 0.18 }));
  }
}

// --- Traffic update --------------------------------------------------------

function carAhead(state, car, lookAhead) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  let bestD = lookAhead;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 4 || along > lookAhead) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 26 && along < bestD) { bestD = along; best = other; }
  }
  return best;
}

function nearestIntersection(car) {
  // Distance along the car's road to the next crossing road.
  if (car.vertical) {
    let best = Infinity;
    for (const ry of ROADS_Y) {
      const d = (ry - car.y) * car.dir;
      if (d > 0 && d < best) best = d;
    }
    return best;
  }
  let best = Infinity;
  for (const rx of ROADS_X) {
    const d = (rx - car.x) * car.dir;
    if (d > 0 && d < best) best = d;
  }
  return best;
}

function updateTrafficCar(state, car, dt) {
  // Parked cars, wrecks, the player's car and police cars are driven by
  // their own code, not by traffic.
  if (car.parked || car.wrecked || car.driver === 'player' || car.driver === 'police') return;
  const spec = CAR_CLASSES[car.class];
  // Brake for the car ahead.
  const ahead = carAhead(state, car, 110);
  let target = spec.topSpeed * 0.55;
  if (ahead) {
    const gap = Math.hypot(ahead.x - car.x, ahead.y - car.y);
    target = gap < 55 ? 0 : spec.topSpeed * 0.3;
  }
  // Slow near intersections so turns look deliberate.
  const inter = nearestIntersection(car);
  if (inter < 70 && Math.random() < 0.02) target = Math.min(target, spec.topSpeed * 0.3);
  car.speed += clamp(target - car.speed, -260 * dt, 180 * dt);

  // Follow the road centerline with a lane offset, swerving a little.
  // The pull is a spring: a car shoved off its lane by a bump comes back
  // quickly instead of cutting across a block.
  const lane = car.lane + Math.sin(state.time * 0.7 + car.id) * 4;
  if (car.vertical) {
    const rx = nearestRoadX(car.x);
    const wantX = rx + (car.dir > 0 ? lane : -lane);
    car.x += clamp((wantX - car.x) * 4, -380, 380) * dt;
    const wantAngle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.angle += angleDiff(car.angle, wantAngle) * Math.min(1, 3 * dt);
  } else {
    const ry = nearestRoadY(car.y);
    const wantY = ry + (car.dir > 0 ? lane : -lane);
    car.y += clamp((wantY - car.y) * 4, -380, 380) * dt;
    const wantAngle = car.dir > 0 ? 0 : Math.PI;
    car.angle += angleDiff(car.angle, wantAngle) * Math.min(1, 3 * dt);
  }
  car.angle = normalizeAngle(car.angle);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Turn at an intersection sometimes.
  if (inter < 12 && Math.random() < 0.35) {
    if (car.vertical) {
      const ry = nearestRoadY(car.y);
      car.y = ry;
      car.vertical = false;
      car.dir = Math.random() < 0.5 ? 1 : -1;
    } else {
      const rx = nearestRoadX(car.x);
      car.x = rx;
      car.vertical = true;
      car.dir = Math.random() < 0.5 ? 1 : -1;
    }
  }
  // Wrap around the map edges so traffic never runs out.
  if (car.x < -60) { car.x = 3200 + 50; }
  if (car.x > 3260) { car.x = -50; }
  if (car.y < -60) { car.y = 2120; }
  if (car.y > 2140) { car.y = -50; }

  // Flee gunfire: speed away from the player's shots.
  if (state.lastGunshotAt && state.time - state.lastGunshotAt < 1.2) {
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < 260) car.speed = Math.min(car.speed + 200 * dt, spec.topSpeed);
  }
}

function nearestRoadX(x) {
  let best = ROADS_X[0];
  let bd = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = rx; }
  }
  return best;
}

function nearestRoadY(y) {
  let best = ROADS_Y[0];
  let bd = Infinity;
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = ry; }
  }
  return best;
}

// Car-vs-car bumps: push apart and damage on hard hits. Damage is
// throttled (one hit per bump) so a long overlap cannot shred a car.
function collideCars(state, dt) {
  const cars = state.cars;
  for (const car of cars) car.bumpCd = Math.max(0, (car.bumpCd || 0) - dt);
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (a.driver !== 'player') { a.x -= nx * push; a.y -= ny * push; }
        if (b.driver !== 'player') { b.x += nx * push; b.y += ny * push; }
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 120 && a.bumpCd <= 0 && b.bumpCd <= 0) {
          a.bumpCd = 0.6;
          b.bumpCd = 0.6;
          if (a.driver === 'player') damageCar(state, a, 4);
          else if (b.driver === 'player') damageCar(state, b, 4);
          state.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
          if (a.driver === 'player' || b.driver === 'player') {
            state.audio.crash();
            state.effects.addShake(5);
          }
        }
        // Traffic slows after a bump.
        if (a.driver !== 'player') a.speed *= 0.6;
        if (b.driver !== 'player') b.speed *= 0.6;
      }
    }
  }
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) updateTrafficCar(state, car, dt);
  collideCars(state, dt);
  // Keep the city populated: replace cars that wandered far away.
  const px = state.player.x;
  const py = state.player.y;
  for (let i = state.cars.length - 1; i >= 0; i--) {
    const car = state.cars[i];
    if (car.driver === 'player' || car.driver === 'police' || car.parked) continue;
    const d = Math.hypot(car.x - px, car.y - py);
    if (d > 1500) {
      // Teleport it back onto a road near the player instead of despawning.
      const p = randomRoadPoint(Math.random);
      car.x = p.x;
      car.y = p.y;
      car.vertical = p.vertical;
      car.dir = Math.random() < 0.5 ? 1 : -1;
    }
  }
}

// --- Pedestrians -----------------------------------------------------------

// A new walk target along the SAME road the pedestrian is already on, so
// they stroll down the sidewalk instead of cutting across blocks.
function nearbySidewalkTarget(ped) {
  let bestX = ROADS_X[0];
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(ped.x - rx);
    if (d < bestD) { bestD = d; bestX = rx; }
  }
  let bestY = ROADS_Y[0];
  let bestDY = Infinity;
  for (const ry of ROADS_Y) {
    const d = Math.abs(ped.y - ry);
    if (d < bestDY) { bestDY = d; bestY = ry; }
  }
  const step = 120 + Math.random() * 280;
  const dir = Math.random() < 0.5 ? -1 : 1;
  if (bestD <= bestDY) {
    const side = ped.x < bestX ? -1 : 1;
    return { x: bestX + side * (ROAD_W / 2 + SIDEWALK_W / 2), y: ped.y + dir * step };
  }
  const side = ped.y < bestY ? -1 : 1;
  return { x: ped.x + dir * step, y: bestY + side * (ROAD_W / 2 + SIDEWALK_W / 2) };
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.health = 100;
        ped.flee = true;
        ped.fleeX = ped.x - p.x;
        ped.fleeY = ped.y - p.y;
      }
      continue;
    }
    // Flee gunfire and speeding cars.
    let flee = ped.flee;
    if (state.lastGunshotAt && state.time - state.lastGunshotAt < 1.5) {
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 320) flee = true;
    }
    if (p.inCar && p.car) {
      const d = Math.hypot(ped.x - p.car.x, ped.y - p.car.y);
      if (d < 110 && Math.abs(p.car.speed) > 180) flee = true;
    }
    if (flee) {
      ped.flee = true;
      const len = Math.hypot(ped.fleeX, ped.fleeY) || 1;
      const fx = ped.fleeX / len;
      const fy = ped.fleeY / len;
      ped.x += fx * ped.speed * 1.9 * dt;
      ped.y += fy * ped.speed * 1.9 * dt;
      ped.angle = Math.atan2(fy, fx);
      if (Math.hypot(ped.x - p.x, ped.y - p.y) > 420) ped.flee = false;
    } else {
      // Amble along the sidewalk toward a wandering target.
      if (Math.hypot(ped.tx - ped.x, ped.ty - ped.y) < 20 || Math.random() < dt * 0.05) {
        const sp = nearbySidewalkTarget(ped);
        ped.tx = sp.x;
        ped.ty = sp.y;
      }
      const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
    }
    ped.walkPhase += dt * (ped.jogging ? 11 : 7);
    // Stay out of buildings and water.
    const hit = hitBuilding(state.city, ped.x, ped.y, 10);
    if (hit) {
      ped.x -= Math.cos(ped.angle) * 30 * dt * 10;
      ped.y -= Math.sin(ped.angle) * 30 * dt * 10;
      const sp = nearbySidewalkTarget(ped);
      ped.tx = sp.x;
      ped.ty = sp.y;
    }
    if (ped.y > 2250) ped.y = 2250;
    if (ped.x < 10) ped.x = 10;
    if (ped.x > 3190) ped.x = 3190;
    if (ped.y < 10) ped.y = 10;
    // A speeding car hitting a pedestrian: the pedestrian goes down.
    if (p.inCar && p.car && !ped.down) {
      const d = Math.hypot(ped.x - p.car.x, ped.y - p.car.y);
      if (d < 26 && Math.abs(p.car.speed) > 60) {
        damagePed(state, ped, 100);
        state.effects.burst(ped.x, ped.y, { count: 10, color: '#ff8080', speed: 150, life: 0.5, size: 3 });
        state.audio.crash();
      }
    }
  }
  // Keep pedestrians near the action.
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    if (Math.hypot(ped.x - p.x, ped.y - p.y) > 1300) {
      const sp = randomSidewalkPoint(Math.random);
      ped.x = sp.x;
      ped.y = sp.y;
      ped.tx = sp.x;
      ped.ty = sp.y;
      ped.down = false;
      ped.health = 100;
    }
  }
}
