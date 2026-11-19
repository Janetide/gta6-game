// The game itself: state, the main loop, mode changes, the camera,
// menu actions, and the scripted self-test (?selftest=1).

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, CAR_CLASSES } from './config.js';
import { buildCity } from './city.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Effects } from './effects.js';
import { createPlayer, updateOnFoot, updateDriving, tryEnterCar, exitCar, updateWanted, addHeat } from './player.js';
import { spawnTraffic, spawnParkedCars, spawnPeds, updateTraffic, updatePeds, makeCar } from './traffic.js';
import { updatePolice, respawnAtPD } from './police.js';
import { updateBullets } from './combat.js';
import { createMissionState, startNextMission, retryMission, updateMission, failMission, startMission } from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, clickButtons } from './hud.js';
import { applyShot } from './shots.js';
import { writeSave, readSave, applySave, saveExists } from './save.js';

export function createGame(canvas) {
  const input = new Input(canvas);
  const audio = new AudioEngine();
  const state = {
    canvas,
    input,
    audio,
    effects: new Effects(),
    city: buildCity(),
    player: null,
    cars: [],
    peds: [],
    police: [],
    bullets: [],
    mission: createMissionState(),
    messages: [],
    camera: { x: 600, y: 500 },
    time: 0,
    mode: 'title', // title | playing | paused | busted | wasted | victory
    lastCrimeAt: -99,
    lastGunshotAt: -99,
    busted: false,
    wasted: false,
    missionFailReason: null,
    selftest: null,
    muted: false,
  };

  state.saveGame = function saveGame() {
    writeSave(state);
    state.messages.push({ text: 'Game saved.', color: '#7ee787', t: state.time });
  };

  function resetWorld() {
    state.cars = [];
    state.peds = [];
    state.police = [];
    state.bullets = [];
    state.messages = [];
    state.mission = createMissionState();
    state.busted = false;
    state.wasted = false;
    state.missionFailReason = null;
    state.autopilot = false;
    state.lastCrimeAt = -99;
    state.lastGunshotAt = -99;
    const motel = state.city.landmarks.find((l) => l.name === 'Sunbeam Motel');
    state.player = createPlayer(motel.x, motel.y + 90);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    spawnTraffic(state, 14);
    spawnParkedCars(state, 10);
    spawnPeds(state, 26);
    // A parked sedan right by the motel, so mission 1 can always start.
    const starter = makeCar(motel.x + 70, motel.y + 80, Math.PI / 2, 'sedan',
      { speed: 0, parked: true, occupied: false, driver: null });
    state.cars.push(starter);
  }

  state.newGame = function newGame() {
    resetWorld();
    state.mode = 'playing';
    state.messages.push({ text: "Del: Mara. You owe the Crew $5,000. First job: steal a clean ride. Press M.", color: '#7ee787', t: 0 });
    audio.resume();
  };

  state.continueGame = function continueGame() {
    const data = readSave();
    if (!data) return false;
    resetWorld();
    applySave(state, data, makeCar);
    state.mode = 'playing';
    state.messages.push({ text: 'Welcome back, Mara.', color: '#7ee787', t: state.time });
    audio.resume();
    return true;
  };

  // --- Menu actions (title / pause / busted / victory buttons) -------------
  state.handleAction = function handleAction(id) {
    audio.resume();
    audio.click();
    if (id === 'new') state.newGame();
    else if (id === 'continue') state.continueGame();
    else if (id === 'resume') state.mode = 'playing';
    else if (id === 'save') state.saveGame();
    else if (id === 'restart') {
      if (state.mission.active) state.mission.active = null;
      retryMission(state);
      state.mode = 'playing';
    } else if (id === 'mute') {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    } else if (id === 'quit') {
      state.mode = 'title';
      audio.stopEngine();
    } else if (id === 'respawn') {
      respawnAtPD(state, state.mode === 'wasted' ? 'WASTED' : 'BUSTED');
      state.busted = false;
      state.wasted = false;
      state.mode = 'playing';
    } else if (id === 'freeroam') {
      state.mode = 'playing';
    }
  };

  // --- One frame ------------------------------------------------------------
  state.update = function update(dt) {
    state.time += dt;
    const p = state.player;

    if (state.mode === 'title') {
      // The sunset animates; nothing else runs.
      if (input.mouseClicked) {
        const id = clickButtons(input.mouseX, input.mouseY);
        if (id) state.handleAction(id);
      }
      input.endFrame();
      return;
    }

    if (state.mode === 'paused' || state.mode === 'busted' || state.mode === 'wasted' || state.mode === 'victory') {
      if (input.mouseClicked) {
        const id = clickButtons(input.mouseX, input.mouseY);
        if (id) state.handleAction(id);
      }
      if (input.pressed('Escape') || input.pressed('KeyP')) {
        if (state.mode === 'paused') state.mode = 'playing';
      }
      // The self-test keeps its step machine running through overlays:
      // the BUSTED step only completes once the overlay is showing.
      if (state.selftest) runSelftestStep(state, dt);
      input.endFrame();
      return;
    }

    // Playing. The self-test injects its simulated keys here, before the
    // input handling below reads them. Demo scenes drive with the
    // accelerator held, like a player cruising through the shot.
    if (state.selftest) runSelftestStep(state, dt);
    if (state.autopilot) input.keys.add('KeyW');
    if (input.pressedKeys.size > 0 || input.mouseClicked) audio.resume();
    if (input.pressed('Escape') || input.pressed('KeyP')) {
      state.mode = 'paused';
      audio.stopEngine();
      input.endFrame();
      return;
    }
    if (input.pressed('KeyM')) startNextMission(state);
    if (input.pressed('KeyR')) {
      if (state.mission.active) {
        state.mission.active = null;
        state.messages.push({ text: 'Mission abandoned. Press M for the next job.', color: '#ffb400', t: state.time });
      } else {
        retryMission(state);
      }
    }
    if (input.pressed('KeyK')) state.saveGame();
    if (input.pressed('KeyN')) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
      state.messages.push({ text: state.muted ? 'Sound off.' : 'Sound on.', color: '#cccccc', t: state.time });
    }

    const mouseWorld = {
      x: input.mouseX - VIEW_W / 2 + state.camera.x,
      y: input.mouseY - VIEW_H / 2 + state.camera.y,
    };

    if (input.pressed('KeyE')) {
      if (p.inCar) exitCar(state);
      else tryEnterCar(state);
    }

    if (p.inCar) updateDriving(state, dt, input, mouseWorld);
    else updateOnFoot(state, dt, input, mouseWorld);

    updateWanted(state, dt);
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updatePolice(state, dt);
    updateBullets(state, dt);
    updateMission(state, dt);
    state.effects.update(dt);

    // Mission fail flag raised by combat (wrecked package car).
    if (state.missionFailReason) {
      const r = state.missionFailReason;
      state.missionFailReason = null;
      if (state.mission.active) failMission(state, r);
    }

    // Track gunfire for fleeing traffic and pedestrians.
    if (state.bullets.some((b) => b.from === 'player')) state.lastGunshotAt = state.time;

    // BUSTED / WASTED transitions.
    if (state.busted) {
      state.busted = false;
      state.mode = 'busted';
      audio.stopEngine();
    }
    if (state.wasted) {
      state.wasted = false;
      state.mode = 'wasted';
      audio.stopEngine();
    }

    // Camera follows Mara smoothly, clamped to the city.
    const tx = Math.max(VIEW_W / 2, Math.min(WORLD_W - VIEW_W / 2, p.x));
    const ty = Math.max(VIEW_H / 2, Math.min(WORLD_H - VIEW_H / 2, p.y));
    state.camera.x += (tx - state.camera.x) * Math.min(1, 5 * dt);
    state.camera.y += (ty - state.camera.y) * Math.min(1, 5 * dt);

    // Siren while police chase; engine hum is driven by updateDriving.
    audio.siren(p.wanted > 0 && state.police.length > 0, dt);
    if (!p.inCar) audio.engine(0, false);

    // Prune old messages.
    if (state.messages.length > 24) state.messages.splice(0, state.messages.length - 24);

    input.endFrame();
  };

  state.render = function render() {
    const ctx = canvas.getContext('2d');
    if (state.mode === 'title') {
      drawTitle(ctx, state);
      return;
    }
    drawWorld(ctx, state);
    drawHUD(ctx, state);
  };

  // --- Deterministic scenes and the self-test -------------------------------
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const selftest = params.get('selftest');
  if (shot) {
    resetWorld();
    applyShot(state, shot);
  } else if (selftest) {
    state.newGame();
    state.selftest = { idx: 0, frames: 0, results: [], done: false, scratch: {} };
    console.log('SELFTEST start');
  }
  return state;
}

// --- Scripted self-test ------------------------------------------------------
// Runs the real game code (real input, real missions, real save/load) and
// writes PASS/FAIL lines to the console and the page title.

const STEPS = [
  {
    name: 'move on foot',
    enter(s) { s.selftest.scratch.x0 = s.player.x; s.selftest.scratch.y0 = s.player.y; s.input.keys.add('KeyS'); },
    check(s) {
      s.input.keys.delete('KeyS');
      const d = Math.hypot(s.player.x - s.selftest.scratch.x0, s.player.y - s.selftest.scratch.y0);
      return d > 40 ? null : `moved only ${d.toFixed(0)}px`;
    },
    frames: 45,
  },
  {
    name: 'steal a parked car',
    enter(s) {
      const car = s.cars.find((c) => c.parked && !c.wrecked);
      s.player.x = car.x + 20;
      s.player.y = car.y;
      s.input.pressedKeys.add('KeyE');
    },
    check(s) { return s.player.inCar ? null : 'not in a car after E'; },
    frames: 4,
  },
  {
    name: 'complete mission 1 (cash 120->320, REP 0->10)',
    enter(s) {
      startMission(s, 1);
      const g = s.city.landmarks.find((l) => l.name === "Del's Garage");
      const car = s.player.car;
      car.x = g.x;
      car.y = g.y;
      car.speed = 0;
      s.player.x = g.x;
      s.player.y = g.y;
    },
    check(s) {
      if (s.player.cash !== 320) return `cash ${s.player.cash}, want 320`;
      if (s.player.rep !== 10) return `rep ${s.player.rep}, want 10`;
      if (s.mission.next !== 2) return `next mission ${s.mission.next}, want 2`;
      return null;
    },
    frames: 6,
  },
  {
    name: 'shoot and lose ammo',
    enter(s) {
      // Space is the handbrake while driving, so step out of the car first.
      if (s.player.inCar) exitCar(s);
      s.selftest.scratch.ammo = s.player.ammo;
      s.input.pressedKeys.add('Space');
    },
    check(s) {
      return s.player.ammo === s.selftest.scratch.ammo - 1
        ? null : `ammo ${s.player.ammo}, want ${s.selftest.scratch.ammo - 1}`;
    },
    frames: 3,
  },
  {
    name: 'wanted level 3 and police chase',
    enter(s) { addHeat(s, 60, ''); },
    check(s) {
      if (s.player.wanted !== 3) return `wanted ${s.player.wanted}, want 3`;
      if (s.police.length < 2) return `police ${s.police.length}, want >=2`;
      return null;
    },
    frames: 40,
  },
  {
    name: 'BUSTED loses $150 and respawns at Solmar PD',
    enter(s) {
      if (s.player.inCar) exitCar(s);
      s.player.x = 1980;
      s.player.y = 620;
      const car = s.police[0];
      if (car) { car.x = s.player.x + 20; car.y = s.player.y; car.speed = 0; }
    },
    check(s) {
      if (s.mode !== 'busted') return `mode ${s.mode}, want busted`;
      return null;
    },
    frames: 300,
  },
  {
    name: 'respawn at PD, wanted 0',
    enter(s) {
      s.selftest.scratch.cashBefore = s.player.cash;
      s.handleAction('respawn');
    },
    check(s) {
      if (s.player.cash !== s.selftest.scratch.cashBefore - 150) return `cash ${s.player.cash}, want ${s.selftest.scratch.cashBefore - 150}`;
      if (s.player.wanted !== 0) return `wanted ${s.player.wanted}, want 0`;
      const d = Math.hypot(s.player.x - 1990, s.player.y - 620);
      return d < 120 ? null : `respawn ${d.toFixed(0)}px from PD`;
    },
    frames: 3,
  },
  {
    name: 'save then reload restores cash, mission and position',
    enter(s) {
      s.saveGame();
      s.selftest.scratch.cash = s.player.cash;
      s.selftest.scratch.x = s.player.x;
      s.selftest.scratch.y = s.player.y;
      s.player.cash = 9999;
      s.player.x = 200;
      s.player.y = 200;
      const data = readSave();
      applySave(s, data, makeCar);
    },
    check(s) {
      if (s.player.cash !== s.selftest.scratch.cash) return `cash ${s.player.cash}, want ${s.selftest.scratch.cash}`;
      if (s.mission.next !== 2) return `next mission ${s.mission.next}, want 2`;
      const d = Math.hypot(s.player.x - s.selftest.scratch.x, s.player.y - s.selftest.scratch.y);
      return d < 5 ? null : `position off by ${d.toFixed(0)}px`;
    },
    frames: 3,
  },
];

function runSelftestStep(state, dt) {
  const st = state.selftest;
  if (st.done) return;
  const step = STEPS[st.idx];
  if (!step) {
    st.done = true;
    const fails = st.results.filter((r) => !r.ok);
    const title = fails.length === 0 ? 'SELFTEST PASS' : `SELFTEST FAIL: ${fails.map((f) => f.name).join(', ')}`;
    document.title = title;
    console.log(title);
    for (const r of st.results) console.log(`SELFTEST ${r.ok ? 'PASS' : 'FAIL'}: ${r.name}${r.ok ? '' : ' — ' + r.why}`);
    return;
  }
  if (st.frames === 0) {
    try { step.enter(state); } catch (e) { st.results.push({ name: step.name, ok: false, why: `enter threw: ${e.message}` }); st.idx++; st.frames = 0; return; }
  }
  st.frames++;
  if (st.frames >= step.frames) {
    let why = null;
    try { why = step.check(state); } catch (e) { why = `check threw: ${e.message}`; }
    st.results.push({ name: step.name, ok: why === null, why });
    console.log(`SELFTEST ${why === null ? 'PASS' : 'FAIL'}: ${step.name}${why === null ? '' : ' — ' + why}`);
    st.idx++;
    st.frames = 0;
  }
}
