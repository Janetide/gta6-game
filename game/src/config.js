// Solmar Heat — configuration and tuning constants.
// Every number that shapes how the game feels lives here.

export const VIEW_W = 1280;
export const VIEW_H = 800;

// The city is bigger than one screen; the camera follows Mara.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const CITY_SEED = 1337;

export const ROAD_W = 96;
export const SIDEWALK_W = 26;

// Money and progression.
export const START_CASH = 120;
export const START_DEBT = 5000;
export const START_AMMO = 24;
export const START_HEALTH = 100;
export const BUSTED_FINE = 150;

// Heat: 0..100. Wanted stars follow Heat.
export const HEAT_MAX = 100;
export const HEAT_SHOOT = 5;
export const HEAT_PUNCH_PED = 8;
export const HEAT_ROB_CAR = 12;
export const HEAT_STEAL_SEEN = 10;
export const HEAT_RAM_POLICE = 10;
export const HEAT_COOL_PER_SEC = 2.2;
export const HEAT_COOL_CLEAN_BONUS = 1.6;

// Wanted stars from Heat.
export function starsFromHeat(heat) {
  if (heat >= 90) return 5;
  if (heat >= 72) return 4;
  if (heat >= 52) return 3;
  if (heat >= 34) return 2;
  if (heat >= 15) return 1;
  return 0;
}

// REP gates for the story and the fastest cars.
export const REP_MISSION_2 = 10;
export const REP_MISSION_3 = 25;
export const REP_MISSION_4 = 45;
export const REP_SPORTS_CAR = 25;

// Car classes: feel and top speed in px/s.
export const CAR_CLASSES = {
  sedan: { name: 'Sedan', topSpeed: 300, accel: 240, color: '#7d8aa0', length: 46, width: 22 },
  taxi: { name: 'Taxi', topSpeed: 330, accel: 260, color: '#f2b705', length: 46, width: 22 },
  pickup: { name: 'Pickup', topSpeed: 360, accel: 280, color: '#b5542d', length: 52, width: 24 },
  sports: { name: 'Getaway GT', topSpeed: 470, accel: 380, color: '#c2244f', length: 48, width: 22 },
  police: { name: 'Patrol Car', topSpeed: 400, accel: 320, color: '#1e4fa3', length: 48, width: 23 },
};

// On-foot movement.
export const WALK_SPEED = 170;
export const RUN_SPEED = 250;
export const PUNCH_RANGE = 42;
export const PUNCH_DAMAGE = 34;
export const BULLET_SPEED = 760;
export const BULLET_DAMAGE = 26;
export const BULLET_RANGE = 520;

// Police.
export const POLICE_PER_STAR = [0, 1, 2, 3, 4, 5];
export const BUSTED_HOLD_SECONDS = 1.6;
export const BUSTED_RANGE = 46;

// Mission rewards.
export const MISSIONS = [
  { id: 1, name: 'Wheels', rewardCash: 200, rewardRep: 10, repNeeded: 0 },
  { id: 2, name: 'The Package', rewardCash: 300, rewardRep: 15, repNeeded: REP_MISSION_2 },
  { id: 3, name: 'Hot Pursuit', rewardCash: 400, rewardRep: 20, repNeeded: REP_MISSION_3 },
  { id: 4, name: 'The Harbor Score', rewardCash: 1000, rewardRep: 30, repNeeded: REP_MISSION_4 },
];
export const PACKAGE_TIMER = 100;

export const SAVE_KEY = 'solmar-heat-save-v1';

// Palette: bright, warm, sun-soaked.
export const COLORS = {
  grass: '#7fb069',
  park: '#5da24f',
  road: '#3d3a38',
  roadEdge: '#2c2a29',
  sidewalk: '#b8a88f',
  sand: '#f0d9a0',
  water: '#2f8fc4',
  waterDeep: '#1f6da3',
  buildingRoof: '#e8dcc8',
  line: '#f5d76e',
  hudBg: 'rgba(12, 18, 26, 0.72)',
  hudText: '#ffffff',
  accent: '#ffb400',
  danger: '#ff5252',
  ok: '#7ee787',
};
