// Bullets: flight, building stops, and what they hit — pedestrians,
// cars (traffic and police), and Mara herself when police shoot.

import { hitBuilding } from './city.js';
import { damagePed, damageCar, damagePlayer } from './player.js';

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.dist += Math.hypot(b.vx, b.vy) * dt;
    let dead = b.dist > b.maxDist;
    if (!dead && hitBuilding(state.city, b.x, b.y, 2)) {
      state.effects.sparks(b.x, b.y);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      // Pedestrians.
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
          damagePed(state, ped, b.damage);
          ped.flee = true;
          ped.fleeX = ped.x - state.player.x;
          ped.fleeY = ped.y - state.player.y;
          state.effects.floatText(ped.x, ped.y - 16, `-${b.damage}`, '#ff8080');
          dead = true;
          break;
        }
      }
      // Cars (not Mara's own).
      if (!dead) {
        for (const car of state.cars) {
          if (car.driver === 'player' || car.wrecked) continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
            damageCar(state, car, b.damage);
            state.effects.sparks(b.x, b.y);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'police') {
      const p = state.player;
      const px = p.x;
      const py = p.y;
      const r = p.inCar ? 24 : 13;
      if (Math.hypot(px - b.x, py - b.y) < r) {
        if (p.inCar && p.car) damageCar(state, p.car, b.damage);
        else if (damagePlayer(state, b.damage)) state.wasted = true;
        state.effects.sparks(b.x, b.y);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}
