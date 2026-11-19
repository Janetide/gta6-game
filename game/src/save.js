// Save and load. One localStorage slot holds cash, debt, REP, Heat,
// wanted level, mission progress, Mara's position and her vehicle, so
// CONTINUE on the title screen restores the game exactly.

import { SAVE_KEY } from './config.js';

export function saveExists() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (_e) {
    return false;
  }
}

export function writeSave(state) {
  const p = state.player;
  const data = {
    v: 1,
    cash: p.cash,
    debt: p.debt,
    rep: p.rep,
    heat: p.heat,
    wanted: p.wanted,
    ammo: p.ammo,
    health: p.health,
    x: p.x,
    y: p.y,
    angle: p.angle,
    inCar: p.inCar,
    car: p.car ? { class: p.car.class, x: p.car.x, y: p.car.y, angle: p.car.angle, health: p.car.health, color: p.car.color } : null,
    missionNext: state.mission.next,
    time: state.time,
  };
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (_e) {
    return null;
  }
}

// Apply a save to a live state. The saved car is re-created and Mara is
// put back in it, exactly where she left it.
export function applySave(state, data, makeCar) {
  const p = state.player;
  p.cash = data.cash;
  p.debt = data.debt;
  p.rep = data.rep;
  p.heat = data.heat;
  p.wanted = data.wanted;
  p.ammo = data.ammo;
  p.health = data.health;
  p.x = data.x;
  p.y = data.y;
  p.angle = data.angle;
  state.mission.next = data.missionNext;
  state.mission.active = null;
  if (data.inCar && data.car) {
    const car = makeCar(data.car.x, data.car.y, data.car.angle, data.car.class, {
      driver: 'player', occupied: false, color: data.car.color,
    });
    car.health = data.car.health;
    state.cars.push(car);
    p.inCar = true;
    p.car = car;
  } else {
    p.inCar = false;
    p.car = null;
  }
  state.camera.x = p.x;
  state.camera.y = p.y;
}
