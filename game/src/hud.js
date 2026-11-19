// HUD, minimap, menus and overlays. Everything the player reads is drawn
// here: cash, debt, REP, ammo, health, wanted stars, HEAT, the objective
// line, the speedometer, the location label, the message feed, and the
// title, pause, BUSTED/WASTED and victory screens.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, COLORS, CAR_CLASSES } from './config.js';
import { ROADS_X, ROADS_Y, WATER_TOP, SAND_TOP } from './city.js';
import { objectiveText } from './missions.js';
import { playerSpeedKmh } from './player.js';
import { nearestStreet, nearestLandmark } from './city.js';
import { saveExists } from './save.js';

// Buttons drawn this frame; game.js asks this module what was clicked.
let currentButtons = [];
export function clickButtons(x, y) {
  for (const b of currentButtons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

function button(ctx, id, x, y, w, h, label, opts = {}) {
  const hover = false;
  ctx.fillStyle = opts.accent ? '#ffb400' : 'rgba(20,26,34,0.92)';
  ctx.strokeStyle = opts.accent ? '#ffd76e' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = opts.accent ? '#1a1200' : '#ffffff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  currentButtons.push({ id, x, y, w, h });
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

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

export function drawHUD(ctx, state) {
  currentButtons = [];
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // --- Top-left: money, REP, ammo -----------------------------------------
  panel(ctx, 14, 12, 250, 96);
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillStyle = '#7ee787';
  ctx.fillText(`$${p.cash}`, 26, 38);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ff8080';
  ctx.fillText(`Debt: $${p.debt}`, 26, 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`REP ${p.rep}`, 140, 60);
  ctx.fillStyle = '#ffd76e';
  ctx.fillText(`Ammo ${p.ammo}`, 26, 84);
  ctx.fillStyle = '#9ecbff';
  ctx.fillText(p.inCar && p.car ? CAR_CLASSES[p.car.class].name : 'On foot', 140, 84);

  // --- Top-right: wanted stars, HEAT bar, health bar ----------------------
  panel(ctx, VIEW_W - 264, 12, 250, 96);
  ctx.font = 'bold 22px system-ui, sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = p.wanted > 0 ? '#ff5252' : '#888888';
  ctx.fillText(stars, VIEW_W - 252, 40);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HEAT', VIEW_W - 252, 62);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(VIEW_W - 200, 50, 176, 12);
  const heatColor = p.heat > 70 ? '#ff5252' : p.heat > 35 ? '#ffb400' : '#ffb400';
  ctx.fillStyle = heatColor;
  ctx.fillRect(VIEW_W - 200, 50, 176 * (p.heat / 100), 12);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HEALTH', VIEW_W - 252, 88);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(VIEW_W - 200, 76, 176, 12);
  ctx.fillStyle = p.health > 35 ? '#7ee787' : '#ff5252';
  ctx.fillRect(VIEW_W - 200, 76, 176 * (p.health / 100), 12);

  // --- Objective line, top center ------------------------------------------
  const obj = objectiveText(state);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = Math.min(560, ctx.measureText(obj).width + 28);
  panel(ctx, (VIEW_W - ow) / 2, 12, ow, 34);
  ctx.fillStyle = '#ffb400';
  ctx.textAlign = 'center';
  ctx.fillText(obj, VIEW_W / 2, 35);
  ctx.textAlign = 'left';

  // --- Message feed, bottom-left -------------------------------------------
  const recent = state.messages.slice(-4);
  ctx.font = '14px system-ui, sans-serif';
  let my = VIEW_H - 92;
  for (const msg of recent) {
    const age = state.time - msg.t;
    if (age > 7) continue;
    ctx.globalAlpha = age > 5 ? Math.max(0, 1 - (age - 5) / 2) : 1;
    ctx.fillStyle = msg.color || '#ffffff';
    ctx.fillText(msg.text, 16, my);
    my += 20;
  }
  ctx.globalAlpha = 1;

  // --- Location label -------------------------------------------------------
  const lm = nearestLandmark(state.city, p.x, p.y, 320);
  const loc = lm ? lm.name : nearestStreet(p.x, p.y);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`📍 ${loc}`, 16, VIEW_H - 118);

  // --- Speedometer while driving --------------------------------------------
  if (p.inCar && p.car) {
    const kmh = playerSpeedKmh(state);
    panel(ctx, VIEW_W - 294, VIEW_H - 258, 150, 58);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW_W - 210, VIEW_H - 222);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('km/h', VIEW_W - 202, VIEW_H - 222);
    ctx.textAlign = 'left';
    if (p.car.wrecked) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('WRECKED', VIEW_W - 282, VIEW_H - 208);
    }
  }

  // --- Minimap --------------------------------------------------------------
  drawMinimap(ctx, state);

  // --- Low-health vignette ---------------------------------------------------
  if (p.health < 35 && p.health > 0) {
    const a = (0.35 - p.health / 100) * (0.7 + Math.sin(state.time * 6) * 0.2);
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${Math.max(0, a)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // --- Briefing panel ---------------------------------------------------------
  const br = state.mission.briefing;
  if (br && state.time < br.until) {
    const bw = 620;
    panel(ctx, (VIEW_W - bw) / 2, 96, bw, 108);
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(br.title, VIEW_W / 2, 124);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, br.text, VIEW_W / 2, 148, bw - 36, 20);
    ctx.textAlign = 'left';
  }

  // --- Mission banner -----------------------------------------------------------
  const bn = state.mission.banner;
  if (bn && state.time < bn.until) {
    const bw = 560;
    panel(ctx, (VIEW_W - bw) / 2, VIEW_H / 2 - 90, bw, 84);
    ctx.fillStyle = bn.color;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bn.text, VIEW_W / 2, VIEW_H / 2 - 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(bn.sub, VIEW_W / 2, VIEW_H / 2 - 28);
    ctx.textAlign = 'left';
  }

  // --- Paused / BUSTED / WASTED / victory overlays ------------------------------
  if (state.mode === 'paused') drawPause(ctx, state);
  if (state.mode === 'busted') drawBusted(ctx, state, 'BUSTED', 'The cops caught you. $150 fine, and you wake up outside Solmar PD.');
  if (state.mode === 'wasted') drawBusted(ctx, state, 'WASTED', 'Mara is down. $150 fine, and you wake up outside Solmar PD.');
  if (state.mode === 'victory') drawVictory(ctx, state);
}

function drawMinimap(ctx, state) {
  const mw = 220;
  const mh = 150;
  const mx = VIEW_W - mw - 14;
  const my = VIEW_H - mh - 14;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  panel(ctx, mx - 6, my - 26, mw + 12, mh + 32);
  ctx.fillStyle = '#123';
  ctx.fillRect(mx, my, mw, mh);
  // Grass, water, roads.
  ctx.fillStyle = '#5da24f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2f8fc4';
  ctx.fillRect(mx, my + (WATER_TOP * sy), mw, mh - WATER_TOP * sy);
  ctx.fillStyle = '#f0d9a0';
  ctx.fillRect(mx, my + (SAND_TOP * sy), mw, (WATER_TOP - SAND_TOP) * sy);
  ctx.strokeStyle = '#3d3a38';
  ctx.lineWidth = 3;
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + SAND_TOP * sy);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = '#ffb400';
  for (const lm of state.city.landmarks) {
    ctx.fillRect(mx + lm.x * sx - 2, my + lm.y * sy - 2, 4, 4);
  }
  // Mission target.
  const m = state.mission.active;
  if (m && m.target) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(mx + m.target.x * sx, my + m.target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police dots, then the player dot on top.
  for (const car of state.police) {
    ctx.fillStyle = '#2d6bff';
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', mx, my - 10);
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

// --- Title screen -------------------------------------------------------------

export function drawTitle(ctx, state) {
  currentButtons = [];
  drawSunset(ctx, state.time);
  // Skyline silhouettes.
  ctx.fillStyle = '#2b1d3a';
  const base = 560;
  let x = 0;
  const rngHeights = [120, 180, 150, 220, 170, 200, 140, 190, 160, 210, 130, 175];
  for (let i = 0; i < rngHeights.length; i++) {
    const w = 110;
    ctx.fillRect(x, base - rngHeights[i], w - 8, rngHeights[i]);
    x += w;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 560, VIEW_W, 240);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255,140,0,0.8)';
  ctx.shadowBlur = 30;
  ctx.fillText('SOLMAR HEAT', VIEW_W / 2, 210);
  ctx.shadowBlur = 0;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#ffd76e';
  ctx.fillText('Mara Voss owes the Harbor Crew $5,000.', VIEW_W / 2, 258);

  button(ctx, 'new', VIEW_W / 2 - 130, 330, 260, 54, 'NEW GAME', { accent: true });
  if (saveExists()) {
    button(ctx, 'continue', VIEW_W / 2 - 130, 398, 260, 54, 'CONTINUE');
  }
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const controls = [
    'WASD / Arrows — move & drive    E — enter / exit car    F — punch',
    'Space — shoot / handbrake    Mouse — aim, Click — shoot    M — next job',
    'Esc / P — pause    R — retry mission    K — save    N — mute',
  ];
  let cy = 500;
  for (const line of controls) {
    ctx.fillText(line, VIEW_W / 2, cy);
    cy += 24;
  }
  ctx.fillStyle = '#ffd76e';
  ctx.font = 'italic 15px system-ui, sans-serif';
  ctx.fillText('Tip: a parked empty car is free — nobody saw a thing. A car with a driver inside is a robbery.', VIEW_W / 2, 610);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Solmar City — a sun-soaked open world. Steal cars, dodge the law, pay off the $5,000.', VIEW_W / 2, 660);
  ctx.textAlign = 'left';
}

function drawSunset(ctx, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff9a3c');
  grad.addColorStop(0.45, '#ff6b6b');
  grad.addColorStop(0.75, '#8c4a7a');
  grad.addColorStop(1, '#2b1d3a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sun.
  const sunX = VIEW_W * 0.68;
  const sunY = 330 + Math.sin(t * 0.3) * 4;
  const sg = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 150);
  sg.addColorStop(0, 'rgba(255,240,180,0.95)');
  sg.addColorStop(0.4, 'rgba(255,200,100,0.5)');
  sg.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 62, 0, Math.PI * 2);
  ctx.fill();
  // Sea at the bottom.
  ctx.fillStyle = '#1f6da3';
  ctx.fillRect(0, 560, VIEW_W, 240);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const wy = 590 + i * 32;
    ctx.beginPath();
    for (let x = 0; x <= VIEW_W; x += 40) {
      const yy = wy + Math.sin(x * 0.015 + t + i) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

// --- Pause menu -----------------------------------------------------------------

function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 180);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#cccccc';
  ctx.fillText('The city waits. Mara does not.', VIEW_W / 2, 212);
  const labels = [
    ['resume', 'RESUME'],
    ['save', 'SAVE GAME'],
    ['restart', 'RESTART MISSION'],
    ['mute', state.audio.muted ? 'SOUND: OFF' : 'SOUND: ON'],
    ['quit', 'QUIT TO TITLE'],
  ];
  let y = 260;
  for (const [id, label] of labels) {
    button(ctx, id, VIEW_W / 2 - 130, y, 260, 48, label, { accent: id === 'resume' });
    y += 60;
  }
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#cccccc';
  ctx.fillText('WASD move · E car · F punch · Space shoot · M job · K save · N mute', VIEW_W / 2, y + 16);
  ctx.textAlign = 'left';
}

// --- BUSTED / WASTED ---------------------------------------------------------------

function drawBusted(ctx, state, title, sub) {
  ctx.fillStyle = 'rgba(10,8,12,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5252';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(sub, VIEW_W / 2, 350);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#ffd76e';
  ctx.fillText(`Cash now: $${state.player.cash}  ·  Debt: $${state.player.debt}  ·  REP: ${state.player.rep}`, VIEW_W / 2, 388);
  button(ctx, 'respawn', VIEW_W / 2 - 130, 430, 260, 54, 'WAKE UP', { accent: true });
  ctx.textAlign = 'left';
}

// --- Victory -------------------------------------------------------------------------

function drawVictory(ctx, state) {
  ctx.fillStyle = 'rgba(10,16,10,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb400';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('THE HARBOR SCORE', VIEW_W / 2, 220);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('Mara paid the $5,000. Solmar City is hers.', VIEW_W / 2, 280);
  const p = state.player;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#7ee787';
  ctx.fillText(`Final stats — Cash: $${p.cash}   Debt: $${p.debt}   REP: ${p.rep}   Health: ${p.health}`, VIEW_W / 2, 330);
  ctx.fillStyle = '#cccccc';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Del: You did it, kid. The Crew owns the harbor — and you own the city.', VIEW_W / 2, 368);
  button(ctx, 'freeroam', VIEW_W / 2 - 130, 420, 260, 54, 'KEEP DRIVING', { accent: true });
  button(ctx, 'quit', VIEW_W / 2 - 130, 488, 260, 54, 'QUIT TO TITLE');
  ctx.textAlign = 'left';
}
