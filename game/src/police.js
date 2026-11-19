// Solmar PD: police cars that scale with the wanted level. One patrol
// car follows at 1 star; several chase, ram and try to box Mara in at
// 2–3 stars; at 4–5 stars they are faster and officers shoot at her.
// Getting caught on foot, or boxed in at low speed, means BUSTED.

import { CAR_CLASSES, POLICE_PER_STAR, BUSTED_HOLD_SECONDS, BUSTED_RANGE, HEAT_RAM_POLICE } from './config.js';
import { collideCircle } from './city.js';
import { clamp, angleDiff, normalizeAngle, angleTo } from './random.js';
import { damagePlayer, damageCar, addHeat } from './player.js';
import { makeCar } from './traffic.js';
import { randomRoadPoint } from './city.js';

export function spawnPolice(state) {
  const want = POLICE_PER_STAR[state.player.wanted] || 0;
  while (state.police.length < want) {
    const p = state.player;
    // Spawn on a road 380-800px from Mara, so the chase starts on
    // drivable streets instead of inside a block.
    let x = p.x + 520;
    let y = p.y;
    let tries = 0;
    let d = 520;
    while (tries < 30 && (d < 380 || d > 800)) {
      const pt = randomRoadPoint(Math.random);
      x = pt.x;
      y = pt.y;
      d = Math.hypot(x - p.x, y - p.y);
      tries++;
    }
    const car = makeCar(x, y, angleTo(x, y, p.x, p.y), 'police', { driver: 'police', occupied: true });
    car.speed = 200;
    state.police.push(car);
    state.cars.push(car);
  }
  while (state.police.length > want) {
    const car = state.police.pop();
    const idx = state.cars.indexOf(car);
    if (idx >= 0) state.cars.splice(idx, 1);
  }
}

// A police car chases Mara: steer toward her, ram, and try to box her in.
function updatePoliceCar(state, car, dt) {
  const p = state.player;
  const spec = CAR_CLASSES.police;
  const boost = p.wanted >= 4 ? 1.15 : 1.0;
  const targetSpeed = spec.topSpeed * boost;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  // Box-in: if another police car is close to Mara, this one aims slightly
  // ahead of her path instead of straight at her.
  const othersNear = state.police.filter((c) => c !== car && Math.hypot(c.x - p.x, c.y - p.y) < 160).length;
  let aim = othersNear > 0 ? wantAngle + 0.5 : wantAngle;
  // Wall-slide: when a building stops the car, it slides along the wall
  // for a moment instead of grinding against it forever.
  if (car.slideTimer > 0) {
    car.slideTimer -= dt;
    aim = wantAngle + car.slideDir * 1.15;
  }
  car.angle += clamp(angleDiff(car.angle, aim), -2.6 * dt, 2.6 * dt);
  car.angle = normalizeAngle(car.angle);
  if (dist > 70) car.speed += 300 * dt;
  else car.speed -= 200 * dt;
  car.speed = clamp(car.speed, -60, targetSpeed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Police cars do not drive through buildings either.
  if (collideCircle(state.city, car, 14)) {
    car.speed *= 0.5;
    if (car.slideTimer <= 0) {
      car.slideTimer = 0.7;
      car.slideDir = car.id % 2 === 0 ? 1 : -1;
    }
  }

  // Ramming Mara's car damages it; ramming police adds Heat. Throttled
  // with the car's bump cooldown so one long shove is one hit, not many.
  if (p.inCar && p.car) {
    const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
    if (d < 46 && Math.abs(car.speed - p.car.speed) > 60 && car.bumpCd <= 0) {
      car.bumpCd = 0.5;
      damageCar(state, p.car, 3);
      state.effects.sparks(p.car.x, p.car.y);
      state.audio.crash();
      if (Math.random() < 0.5) {
        addHeat(state, HEAT_RAM_POLICE, 'You rammed a police car!');
        state.lastCrimeAt = state.time;
      }
    }
  }
  // Officers shoot at 4–5 stars.
  if (p.wanted >= 4 && dist < 420 && Math.random() < dt * 1.4) {
    const a = angleTo(car.x, car.y, p.x, p.y) + (Math.random() - 0.5) * 0.35;
    state.bullets.push({
      x: car.x, y: car.y,
      vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
      dist: 0, maxDist: 460, damage: 8, from: 'police',
    });
    state.audio.gunshot();
  }
  // Siren lights blink via the car's own timer.
  car.sirenPhase = (car.sirenPhase || 0) + dt * 6;
}

export function updatePolice(state, dt) {
  const p = state.player;
  spawnPolice(state);
  for (const car of state.police) updatePoliceCar(state, car, dt);

  // BUSTED: on foot with an officer right next to Mara for a moment, or
  // boxed in while driving at low speed with police beside her.
  if (p.wanted > 0 && p.health > 0) {
    let near = false;
    for (const car of state.police) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < BUSTED_RANGE + 30) { near = true; break; }
    }
    if (near) {
      const boxed = !p.inCar || (p.car && Math.abs(p.car.speed) < 40);
      if (boxed) {
        p.bustedTimer += dt;
        if (p.bustedTimer >= BUSTED_HOLD_SECONDS) {
          p.bustedTimer = 0;
          state.busted = true;
        }
      } else {
        p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
      }
    } else {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
  } else {
    p.bustedTimer = 0;
  }
}

// Send Mara to Solmar PD after BUSTED or WASTED: lose $150, wanted 0,
// Heat drops sharply, and she wakes up outside the station.
export function respawnAtPD(state, reason) {
  const p = state.player;
  const pd = state.city.landmarks.find((lm) => lm.name === 'Solmar PD');
  const fine = Math.min(150, p.cash);
  p.cash -= fine;
  p.health = 100;
  p.wanted = 0;
  p.heat = Math.max(0, p.heat - 60);
  p.bustedTimer = 0;
  if (p.inCar && p.car) {
    p.car.driver = null;
    p.car.speed = 0;
    p.car = null;
    p.inCar = false;
  }
  p.x = pd.x + 10;
  p.y = pd.y + 150;
  p.angle = -Math.PI / 2;
  state.camera.x = p.x;
  state.camera.y = p.y;
  // Police stand down.
  for (const car of state.police) {
    const idx = state.cars.indexOf(car);
    if (idx >= 0) state.cars.splice(idx, 1);
  }
  state.police = [];
  state.messages.push({ text: `${reason} — $${fine} lost.`, color: '#ff5252', t: state.time });
  state.audio.fail();
}
