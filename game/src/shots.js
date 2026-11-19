// Deterministic demo scenes for screenshots and testing. Each `shot`
// parameter jumps straight into a staged, already-running scene with the
// same seeded city every time — real gameplay renders, not pictures.

import { addHeat, tryEnterCar } from './player.js';
import { startMission } from './missions.js';
import { makeCar } from './traffic.js';
import { CAR_CLASSES } from './config.js';

// Put Mara in a sports car in the middle of a 3-star chase.
export function setupCover(state) {
  const p = state.player;
  p.x = 1600;
  p.y = 1100;
  const car = makeCar(1600, 1100, 0, 'sports', { driver: 'player', occupied: false });
  state.cars.push(car);
  p.inCar = true;
  p.car = car;
  car.speed = 380;
  // Keep the accelerator held so the chase stays a chase.
  state.autopilot = true;
  p.rep = 30;
  p.cash = 320;
  addHeat(state, 60, '');
  state.lastCrimeAt = state.time;
  // Surround her with traffic and police.
  const spots = [
    [1450, 1100, 0, 'sedan'], [1750, 1078, Math.PI, 'taxi'], [1600, 956, Math.PI / 2, 'pickup'],
    [1330, 1122, 0, 'sedan'], [1870, 1122, Math.PI, 'sedan'], [1600, 1240, -Math.PI / 2, 'taxi'],
  ];
  for (const [x, y, a, cls] of spots) {
    const c = makeCar(x, y, a, cls, { speed: 120 });
    state.cars.push(c);
  }
  // Mission 1 in progress, so the objective line shows.
  state.mission.next = 1;
  startMission(state, 1);
  state.mission.active.stage = 'deliver';
  state.mission.active.objective = "Drive the car to Del's Garage";
  state.mission.briefing = null;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.mode = 'playing';
}

// Driving through traffic at 0 stars, in the heart of the city.
export function setupStreet(state) {
  const p = state.player;
  p.x = 1200;
  p.y = 700;
  const car = makeCar(1200, 700, 0, 'taxi', { driver: 'player', occupied: false });
  state.cars.push(car);
  p.inCar = true;
  p.car = car;
  car.speed = 170;
  // Keep the accelerator held so the taxi cruises through traffic.
  state.autopilot = true;
  const spots = [
    [1000, 700, 0, 'sedan'], [1420, 678, Math.PI, 'pickup'], [1200, 520, Math.PI / 2, 'sedan'],
    [880, 722, 0, 'taxi'], [1560, 722, Math.PI, 'sedan'], [980, 1122, 0, 'pickup'],
    [1500, 1078, Math.PI, 'sedan'],
  ];
  for (const [x, y, a, cls] of spots) {
    state.cars.push(makeCar(x, y, a, cls, { speed: 130 }));
  }
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.mode = 'playing';
}

// Mission 1 in progress, with the briefing and the objective arrow.
export function setupMission(state) {
  const p = state.player;
  p.x = 600;
  p.y = 560;
  // A parked sedan right beside the motel for Mara to take.
  const car = makeCar(660, 520, Math.PI / 2, 'sedan', { speed: 0, parked: true, occupied: false, driver: null });
  state.cars.push(car);
  state.mission.next = 1;
  startMission(state, 1);
  state.mission.briefing.until = state.time + 30;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.mode = 'playing';
}

// The title screen.
export function setupStart(state) {
  state.mode = 'title';
}

export function applyShot(state, shot) {
  if (shot === 'cover') setupCover(state);
  else if (shot === 'street') setupStreet(state);
  else if (shot === 'mission') setupMission(state);
  else if (shot === 'start') setupStart(state);
}
