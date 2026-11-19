// Solmar City: a seeded grid of roads, blocks, buildings, parks, a beach
// and a harbor. The layout is deterministic (one fixed seed); only the
// traffic and pedestrians that live in it vary from run to run.

import { CITY_SEED, WORLD_W, WORLD_H, ROAD_W, SIDEWALK_W, COLORS } from './config.js';
import { mulberry32, range, intRange, pick, chance } from './random.js';

// Vertical road centerlines (x) and horizontal road centerlines (y).
export const ROADS_X = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const ROADS_Y = [300, 700, 1100, 1500, 1900];

// Named streets, for the location label in the HUD.
export const STREET_NAMES_X = ['Palm Ave', 'Coral St', 'Marina Blvd', 'Sunset Way', 'Harbor St', 'Breeze Ln', 'Dune Rd'];
export const STREET_NAMES_Y = ['Seaside Dr', 'Orange Row', 'Market St', 'Jacaranda Ave', 'Harbor Row'];

// The beach and water run along the south edge of the map.
export const SAND_TOP = 2120;
export const WATER_TOP = 2260;

const BUILDING_COLORS = ['#e8dcc8', '#d9c9a8', '#cbb59a', '#e5cfc0', '#d3bda6', '#c9a98c'];
const ROOF_COLORS = ['#b5542d', '#4a7a5c', '#7a5a3a', '#5b7a8c', '#8c5b6e', '#6b8c5b'];
const PARK_TREES = 8;

export function buildCity() {
  const rng = mulberry32(CITY_SEED);
  const buildings = [];
  const parks = [];
  const trees = [];
  const palms = [];

  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...ROADS_X, WORLD_W];
  const ys = [0, ...ROADS_Y, SAND_TOP];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + (bi === 0 ? 0 : ROAD_W / 2 + SIDEWALK_W);
      const x1 = xs[bi + 1] - (bi + 1 >= xs.length - 1 ? 0 : ROAD_W / 2 + SIDEWALK_W);
      const y0 = ys[bj] + (bj === 0 ? 0 : ROAD_W / 2 + SIDEWALK_W);
      const y1 = ys[bj + 1] - (bj + 1 >= ys.length - 1 ? 0 : ROAD_W / 2 + SIDEWALK_W);
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      // One park per few blocks, otherwise buildings.
      if (chance(rng, 0.18)) {
        parks.push({ x: x0, y: y0, w, h });
        for (let t = 0; t < PARK_TREES; t++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 15) });
        }
        continue;
      }
      const cols = w > 240 ? 2 : 1;
      const rows = h > 240 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bw = (w / cols) * range(rng, 0.62, 0.8);
          const bh = (h / rows) * range(rng, 0.62, 0.8);
          const bx = x0 + (w / cols) * c + ((w / cols) - bw) / 2 + range(rng, -8, 8);
          const by = y0 + (h / rows) * r + ((h / rows) - bh) / 2 + range(rng, -8, 8);
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            color: pick(rng, BUILDING_COLORS),
            roof: pick(rng, ROOF_COLORS),
            floors: intRange(rng, 1, 4),
            windows: intRange(rng, 2, 5),
          });
        }
      }
    }
  }

  // Palm trees along the beach and a few on sidewalks.
  for (let i = 0; i < 46; i++) {
    palms.push({ x: range(rng, 40, WORLD_W - 40), y: range(rng, SAND_TOP + 16, WATER_TOP - 20), r: 8 });
  }

  // Landmarks with floating labels. Positions are fixed by design.
  const landmarks = [
    { name: 'Sunbeam Motel', x: 600, y: 470, color: '#ffb400', icon: 'motel' },
    { name: "Del's Garage", x: 2380, y: 1680, color: '#ff8c1a', icon: 'garage' },
    { name: 'Solmar PD', x: 1980, y: 470, color: '#4a90d9', icon: 'police' },
    { name: 'Harbor Bank', x: 1180, y: 1280, color: '#7ee787', icon: 'bank' },
    { name: 'Harbor Docks', x: 2620, y: 2190, color: '#2f8fc4', icon: 'docks' },
  ];

  // Keep landmark plots clear of generated buildings.
  for (const lm of landmarks) {
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.x < lm.x + 150 && b.x + b.w > lm.x - 150 && b.y < lm.y + 120 && b.y + b.h > lm.y - 120) {
        buildings.splice(i, 1);
      }
    }
  }
  // Landmark buildings, drawn as distinct blocks.
  const landmarkBuildings = [
    { x: 520, y: 420, w: 160, h: 100, color: '#f2c94c', roof: '#c2244f', floors: 2, windows: 6, name: 'Sunbeam Motel' },
    { x: 2310, y: 1620, w: 150, h: 110, color: '#8c8f96', roof: '#ff8c1a', floors: 1, windows: 3, name: "Del's Garage" },
    { x: 1900, y: 410, w: 170, h: 110, color: '#dfe8f2', roof: '#1e4fa3', floors: 2, windows: 6, name: 'Solmar PD' },
    { x: 1100, y: 1220, w: 160, h: 110, color: '#e8e0c8', roof: '#7a5a3a', floors: 2, windows: 6, name: 'Harbor Bank' },
  ];
  for (const lb of landmarkBuildings) buildings.push(lb);

  return { buildings, parks, trees, palms, landmarks, landmarkBuildings };
}

// --- Queries used by movement, traffic and missions -----------------------

export function isWater(x, y) {
  return y >= WATER_TOP;
}

export function isSand(x, y) {
  return y >= SAND_TOP && y < WATER_TOP;
}

// True when the point is on a road surface (not sidewalk).
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

// True when the point is on a sidewalk strip beside a road.
export function onSidewalk(x, y) {
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d > ROAD_W / 2 && d <= ROAD_W / 2 + SIDEWALK_W) return true;
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d > ROAD_W / 2 && d <= ROAD_W / 2 + SIDEWALK_W) return true;
  }
  return false;
}

// Circle (x, y, r) against every building; returns the building hit or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings and water; returns true when it hit.
export function collideCircle(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    let dx = p.x - cx;
    let dy = p.y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 < 0.0001) {
        // Center inside the rect: push out along the smallest overlap.
        const left = p.x - b.x;
        const right = b.x + b.w - p.x;
        const top = p.y - b.y;
        const bot = b.y + b.h - p.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) p.x = b.x - r;
        else if (m === right) p.x = b.x + b.w + r;
        else if (m === top) p.y = b.y - r;
        else p.y = b.y + b.h + r;
      } else {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      }
    }
  }
  // Water is not drivable or walkable.
  if (p.y > WATER_TOP - r) { p.y = WATER_TOP - r; hit = true; }
  if (p.x < r) { p.x = r; hit = true; }
  if (p.x > WORLD_W - r) { p.x = WORLD_W - r; hit = true; }
  if (p.y < r) { p.y = r; hit = true; }
  if (p.y > WORLD_H - r) { p.y = WORLD_H - r; hit = true; }
  return hit;
}

// Nearest road name for the HUD location label.
export function nearestStreet(x, y) {
  let best = null;
  let bestD = Infinity;
  ROADS_X.forEach((rx, i) => {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = STREET_NAMES_X[i]; }
  });
  ROADS_Y.forEach((ry, i) => {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = STREET_NAMES_Y[i]; }
  });
  return best || 'Solmar City';
}

// Nearest landmark within range, for the location label.
export function nearestLandmark(city, x, y, rangePx = 320) {
  let best = null;
  let bestD = rangePx;
  for (const lm of city.landmarks) {
    const d = Math.hypot(x - lm.x, y - lm.y);
    if (d < bestD) { bestD = d; best = lm; }
  }
  return best;
}

// A random point on a road, for spawning traffic.
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const rx = ROADS_X[Math.floor(rng() * ROADS_X.length)];
    return { x: rx + (rng() < 0.5 ? -22 : 22), y: range(rng, 120, SAND_TOP - 120), vertical: true };
  }
  const ry = ROADS_Y[Math.floor(rng() * ROADS_Y.length)];
  return { x: range(rng, 120, WORLD_W - 120), y: ry + (rng() < 0.5 ? -22 : 22), vertical: false };
}

// A random point on a sidewalk, for spawning pedestrians.
export function randomSidewalkPoint(rng) {
  if (rng() < 0.5) {
    const rx = ROADS_X[Math.floor(rng() * ROADS_X.length)];
    const side = rng() < 0.5 ? -1 : 1;
    return { x: rx + side * (ROAD_W / 2 + SIDEWALK_W / 2), y: range(rng, 120, SAND_TOP - 120) };
  }
  const ry = ROADS_Y[Math.floor(rng() * ROADS_Y.length)];
  const side = rng() < 0.5 ? -1 : 1;
  return { x: range(rng, 120, WORLD_W - 120), y: ry + side * (ROAD_W / 2 + SIDEWALK_W / 2) };
}

export { COLORS };
