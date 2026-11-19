// World rendering: the city, the beach, the harbor, cars, pedestrians,
// Mara, bullets, particles and mission markers, seen through a camera
// that follows her smoothly.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_W, SIDEWALK_W, COLORS, CAR_CLASSES } from './config.js';
import { ROADS_X, ROADS_Y, SAND_TOP, WATER_TOP, isWater, isSand } from './city.js';

export function drawWorld(ctx, state) {
  const cam = state.camera;
  const shake = state.effects.shakeOffset();
  const ox = -cam.x + VIEW_W / 2 + shake.x;
  const oy = -cam.y + VIEW_H / 2 + shake.y;
  ctx.save();
  ctx.translate(ox, oy);

  // Ground: grass everywhere, then parks, sand and water.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(cam.x - VIEW_W / 2 - 40, cam.y - VIEW_H / 2 - 40, VIEW_W + 80, VIEW_H + 80);
  drawGround(ctx, state, cam);

  // Roads and sidewalks.
  drawRoads(ctx, state, cam);

  // Buildings, parks, trees, palms.
  drawCity(ctx, state);

  // Mission target marker and world arrow.
  drawMissionMarker(ctx, state);

  // Pedestrians, cars, Mara, bullets, particles.
  drawPeds(ctx, state);
  drawCars(ctx, state);
  drawPlayer(ctx, state);
  drawBullets(ctx, state);
  state.effects.draw(ctx);

  // Landmark labels float above the city.
  drawLabels(ctx, state);

  ctx.restore();
}

function visible(ctx, cam, x, y, w, h) {
  return x + w > cam.x - VIEW_W / 2 - 60 && x < cam.x + VIEW_W / 2 + 60 &&
    y + h > cam.y - VIEW_H / 2 - 60 && y < cam.y + VIEW_H / 2 + 60;
}

function drawGround(ctx, state, cam) {
  const city = state.city;
  for (const park of city.parks) {
    if (!visible(ctx, cam, park.x, park.y, park.w, park.h)) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Beach sand and harbor water along the south edge.
  const sandY = Math.max(SAND_TOP, cam.y - VIEW_H / 2 - 40);
  if (sandY < cam.y + VIEW_H / 2 + 40) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(cam.x - VIEW_W / 2 - 40, sandY, VIEW_W + 80, WATER_TOP - sandY);
  }
  const waterY = Math.max(WATER_TOP, cam.y - VIEW_H / 2 - 40);
  if (waterY < cam.y + VIEW_H / 2 + 40) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(cam.x - VIEW_W / 2 - 40, waterY, VIEW_W + 80, WORLD_H - waterY + 40);
    // Gentle wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const wy = WATER_TOP + 18 + i * 26 + Math.sin(state.time * 1.2 + i * 2) * 4;
      ctx.beginPath();
      for (let x = cam.x - VIEW_W / 2; x < cam.x + VIEW_W / 2; x += 46) {
        const yy = wy + Math.sin(x * 0.02 + state.time + i) * 3;
        if (x === cam.x - VIEW_W / 2) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Harbor docks: wooden piers reaching into the water.
    ctx.fillStyle = '#8a6b46';
    for (let i = 0; i < 4; i++) {
      const dx = 2380 + i * 130;
      ctx.fillRect(dx, WATER_TOP - 60, 26, 150);
      ctx.fillRect(dx - 14, WATER_TOP - 60, 54, 12);
    }
  }
}

function drawRoads(ctx, state, cam) {
  // Sidewalks first (a wider light band), then asphalt, then dashes.
  for (const rx of ROADS_X) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(rx - ROAD_W / 2 - SIDEWALK_W, 0, ROAD_W + SIDEWALK_W * 2, SAND_TOP);
  }
  for (const ry of ROADS_Y) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(0, ry - ROAD_W / 2 - SIDEWALK_W, WORLD_W, ROAD_W + SIDEWALK_W * 2);
  }
  ctx.fillStyle = COLORS.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, SAND_TOP);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Dashed center lines.
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, SAND_TOP);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(WORLD_W, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalk stripes at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(rx + i * 14 - 4, ry - ROAD_W / 2 - 8, 8, 16);
        ctx.fillRect(rx + i * 14 - 4, ry + ROAD_W / 2 - 8, 8, 16);
      }
    }
  }
}

function drawCity(ctx, state) {
  const city = state.city;
  const cam = state.camera;
  for (const b of city.buildings) {
    if (!visible(ctx, cam, b.x, b.y, b.w, b.h)) continue;
    // Soft shadow, then the block, then a roof edge and windows.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, Math.min(12, b.h * 0.18));
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = 'rgba(40,60,90,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(b.x + 8 + c * 26, b.y + 18 + r * 30, 12, 14);
      }
    }
  }
  // Trees and palms.
  for (const t of city.trees) {
    if (!visible(ctx, cam, t.x - 20, t.y - 20, 40, 40)) continue;
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c5a24';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const palm of city.palms) {
    if (!visible(ctx, cam, palm.x - 20, palm.y - 20, 40, 40)) continue;
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y + 8);
    ctx.lineTo(palm.x + 3, palm.y - 8);
    ctx.stroke();
    ctx.fillStyle = '#4da34d';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 10, palm.y - 8 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMissionMarker(ctx, state) {
  const m = state.mission.active;
  if (!m || !m.target) return;
  const t = m.target;
  const pulse = 1 + Math.sin(state.time * 5) * 0.18;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.strokeStyle = '#ffb400';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffb400';
  ctx.beginPath();
  ctx.moveTo(0, -52 * pulse);
  ctx.lineTo(10, -30);
  ctx.lineTo(-10, -30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Off-screen arrow at the screen edge pointing at the target.
  const p = state.player;
  const dx = t.x - p.x;
  const dy = t.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 500) {
    const a = Math.atan2(dy, dx);
    const ex = state.camera.x + Math.cos(a) * 300;
    const ey = state.camera.y + Math.sin(a) * 210;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = '#ffb400';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawPeds(ctx, state) {
  for (const ped of state.peds) {
    const bob = ped.down ? 0 : Math.sin(ped.walkPhase) * 1.5;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob * 0.3);
    if (ped.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.fillRect(-11, -6, 22, 12);
    } else {
      ctx.rotate(ped.angle);
      // Little walking figure: body, head, swinging legs.
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.arc(3, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      const swing = Math.sin(ped.walkPhase) * 4;
      ctx.beginPath();
      ctx.moveTo(-6, -3);
      ctx.lineTo(-6 - swing, -3);
      ctx.moveTo(-6, 3);
      ctx.lineTo(-6 + swing, 3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCars(ctx, state) {
  for (const car of state.cars) {
    drawCar(ctx, car, state.time);
  }
}

export function drawCar(ctx, car, time) {
  const spec = CAR_CLASSES[car.class];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = spec.length;
  const W = spec.width;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  // Body.
  ctx.fillStyle = car.wrecked ? '#4a4a4a' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = car.wrecked ? '#333' : 'rgba(180,220,240,0.9)';
  roundRect(ctx, -L / 2 + 12, -W / 2 + 4, L / 2 - 6, W - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,40,60,0.85)';
  ctx.fillRect(-L / 2 + 12, -W / 2 + 4, 5, W - 8);
  // Headlights and taillights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff4040';
  ctx.fillRect(-L / 2, -W / 2 + 3, 3, 5);
  ctx.fillRect(-L / 2, W / 2 - 8, 3, 5);
  if (car.class === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.class === 'police') {
    // Livery stripe and flashing light bar.
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L - 8, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, W / 2 - 4);
    const phase = Math.floor((car.sirenPhase || 0)) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-6, -W / 2 - 3, 12, 5);
    ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(-6, -W / 2 - 3, 6, 5);
  }
  if (car.wrecked) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-L / 2 + 6, -W / 2 + 4);
    ctx.lineTo(L / 2 - 8, W / 2 - 4);
    ctx.moveTo(L / 2 - 6, -W / 2 + 4);
    ctx.lineTo(-L / 2 + 8, W / 2 - 4);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  // Mara: red jacket, dark hair, a pistol when she has ammo.
  ctx.fillStyle = '#c2244f';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (p.ammo > 0) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();
  }
  ctx.restore();
  // Aim line, faint, while on foot.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.aimAngle) * 46, p.y + Math.sin(p.aimAngle) * 46);
  ctx.stroke();
  ctx.restore();
}

function drawBullets(ctx, state) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLabels(ctx, state) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px system-ui, sans-serif';
  for (const lm of state.city.landmarks) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const w = ctx.measureText(lm.name).width + 16;
    roundRect(ctx, lm.x - w / 2, lm.y - 96, w, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(lm.name, lm.x, lm.y - 81);
    ctx.fillStyle = lm.color;
    ctx.beginPath();
    ctx.arc(lm.x, lm.y - 74, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
