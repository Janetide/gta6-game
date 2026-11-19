// The story: four missions for Del, gated by REP, with briefing panels,
// objective markers, timers, success banners and retryable failure.

import { MISSIONS, PACKAGE_TIMER } from './config.js';
import { addHeat } from './player.js';

function garagePos(state) {
  const lm = state.city.landmarks.find((l) => l.name === "Del's Garage");
  return { x: lm.x, y: lm.y };
}

function docksPos(state) {
  const lm = state.city.landmarks.find((l) => l.name === 'Harbor Docks');
  return { x: lm.x, y: lm.y };
}

function motelPos(state) {
  const lm = state.city.landmarks.find((l) => l.name === 'Sunbeam Motel');
  return { x: lm.x, y: lm.y };
}

export function createMissionState() {
  return {
    next: 1, // next mission number (1..4); 5 means the story is done
    active: null, // the running mission object, or null
    banner: null, // { text, sub, color, until } shown on screen
    briefing: null, // { title, text, until } shown when a mission starts
  };
}

function missionDef(id) {
  return MISSIONS.find((m) => m.id === id);
}

export function missionAvailable(state, id) {
  const def = missionDef(id);
  if (!def) return false;
  if (state.mission.next !== id) return false;
  return state.player.rep >= def.repNeeded;
}

// Press M: start (or check) the next story mission.
export function startNextMission(state) {
  const id = state.mission.next;
  if (id > 4) {
    state.messages.push({ text: 'The Harbor Crew is paid. Solmar is yours, Mara.', color: '#7ee787', t: state.time });
    return;
  }
  const def = missionDef(id);
  if (state.player.rep < def.repNeeded) {
    state.messages.push({
      text: `Next job "${def.name}" needs REP ${def.repNeeded}. Yours: ${state.player.rep}. Finish jobs and clean getaways raise REP.`,
      color: '#ffb400', t: state.time,
    });
    state.audio.fail();
    return;
  }
  startMission(state, id);
}

export function startMission(state, id) {
  const def = missionDef(id);
  const g = garagePos(state);
  const d = docksPos(state);
  const m = motelPos(state);
  let mission = { id, def, stage: '', target: null, timer: 0, startedAt: state.time };
  if (id === 1) {
    mission.stage = 'steal';
    mission.target = { x: g.x, y: g.y, label: "Del's Garage" };
    mission.briefing = "Del needs a clean ride. Steal any car and bring it to Del's Garage on Harbor Row. Parked cars are free — nobody saw a thing.";
    mission.objective = 'Steal a car and drive it to Del\'s Garage';
  } else if (id === 2) {
    mission.stage = 'pickup';
    mission.target = { x: 1180, y: 1280, label: 'Harbor Bank' };
    mission.briefing = 'A package is waiting by Harbor Bank. Grab it, then deliver it to Del — the clock starts the moment you pick it up. 100 seconds.';
    mission.objective = 'Pick up the package at Harbor Bank';
  } else if (id === 3) {
    mission.stage = 'chase';
    mission.target = { x: d.x, y: d.y, label: 'Harbor Docks' };
    mission.briefing = 'The Crew wants the heat off their backs — so put it on you. Get the cops chasing, then lose them completely and reach the docks clean.';
    mission.objective = 'Get a wanted level, then lose it and reach the Harbor Docks';
    addHeat(state, 30, 'Del tips off the cops — they are coming for you.');
    state.lastCrimeAt = state.time;
  } else if (id === 4) {
    mission.stage = 'docks';
    mission.target = { x: d.x, y: d.y, label: 'Harbor Docks' };
    mission.briefing = 'The Harbor Score. Grab the goods at the docks, shake the police that show up, and bring it all home to Del. This one pays the $5,000.';
    mission.objective = 'Go to the Harbor Docks and grab the goods';
  }
  state.mission.active = mission;
  state.mission.briefing = { title: `MISSION ${id}: ${def.name}`, text: mission.briefing, until: state.time + 7 };
  state.audio.pickup();
  state.messages.push({ text: `Mission started: ${def.name}`, color: '#7ee787', t: state.time });
}

export function failMission(state, reason) {
  const m = state.mission.active;
  if (!m) return;
  state.mission.active = null;
  state.mission.banner = { text: 'MISSION FAILED', sub: reason, color: '#ff5252', until: state.time + 4 };
  state.audio.fail();
  state.messages.push({ text: `Mission failed: ${reason} Press R to retry.`, color: '#ff5252', t: state.time });
}

export function completeMission(state) {
  const m = state.mission.active;
  if (!m) return;
  const p = state.player;
  const def = m.def;
  p.cash += def.rewardCash;
  p.rep += def.rewardRep;
  // Heat cools when a job goes clean.
  p.heat = Math.max(0, p.heat - 25);
  state.mission.active = null;
  state.mission.next = m.id + 1;
  state.mission.banner = {
    text: 'MISSION COMPLETE',
    sub: `${def.name} — +$${def.rewardCash} cash, +${def.rewardRep} REP`,
    color: '#7ee787', until: state.time + 4,
  };
  state.audio.jingle();
  state.effects.ring(p.x, p.y);
  state.messages.push({ text: `Del: Clean work, Mara. +$${def.rewardCash}, +${def.rewardRep} REP.`, color: '#7ee787', t: state.time });
  if (m.id === 4) {
    // The finale pays off the debt.
    const paid = Math.min(p.debt, 5000);
    p.debt = Math.max(0, p.debt - paid);
    state.mode = 'victory';
    state.mission.banner = {
      text: 'THE HARBOR SCORE — COMPLETE',
      sub: `Debt paid: $${paid}. Solmar City is yours.`,
      color: '#ffb400', until: state.time + 8,
    };
  }
  saveAfterMission(state);
}

function saveAfterMission(state) {
  try {
    state.saveGame();
  } catch (_e) { /* saving never breaks play */ }
}

// Mission logic, run every frame while a mission is active.
export function updateMission(state, dt) {
  const m = state.mission.active;
  if (!m) return;
  const p = state.player;
  const g = garagePos(state);
  const d = docksPos(state);

  if (m.id === 1) {
    if (m.stage === 'steal' && p.inCar) {
      m.stage = 'deliver';
      m.objective = "Drive the car to Del's Garage";
      state.messages.push({ text: 'Del: Got wheels. Now bring it to the garage.', color: '#7ee787', t: state.time });
    }
    if (m.stage === 'deliver' && p.inCar && Math.hypot(p.x - g.x, p.y - g.y) < 130) {
      completeMission(state);
    }
  } else if (m.id === 2) {
    if (m.stage === 'pickup' && Math.hypot(p.x - 1180, p.y - 1280) < 90) {
      m.stage = 'deliver';
      m.timer = PACKAGE_TIMER;
      m.target = { x: g.x, y: g.y, label: "Del's Garage" };
      m.objective = `Deliver the package to Del's Garage — ${Math.ceil(m.timer)}s left`;
      state.audio.pickup();
      state.messages.push({ text: 'Package grabbed. 100 seconds — move!', color: '#ffb400', t: state.time });
    }
    if (m.stage === 'deliver') {
      m.timer -= dt;
      m.objective = `Deliver the package to Del's Garage — ${Math.max(0, Math.ceil(m.timer))}s left`;
      if (m.timer <= 0) {
        failMission(state, 'The package was late. The buyer walked.');
        return;
      }
      if (Math.hypot(p.x - g.x, p.y - g.y) < 130) completeMission(state);
    }
  } else if (m.id === 3) {
    if (m.stage === 'chase' && p.wanted > 0) {
      m.stage = 'escape';
      m.objective = 'Lose the cops, then reach the Harbor Docks';
      state.messages.push({ text: "They're on you. Lose them!", color: '#ff5252', t: state.time });
    }
    if (m.stage === 'escape' && p.wanted === 0 && Math.hypot(p.x - d.x, p.y - d.y) < 150) {
      completeMission(state);
    }
  } else if (m.id === 4) {
    if (m.stage === 'docks' && Math.hypot(p.x - d.x, p.y - d.y) < 120) {
      m.stage = 'grabbed';
      m.target = { x: g.x, y: g.y, label: "Del's Garage" };
      m.objective = 'Goods grabbed! Lose the police and deliver to Del';
      addHeat(state, 45, 'The harbor alarm is screaming. Police inbound!');
      state.lastCrimeAt = state.time;
      state.audio.pickup();
      state.messages.push({ text: 'Del: Goods in hand. Now run the gauntlet.', color: '#ffb400', t: state.time });
    }
    if (m.stage === 'grabbed' && p.wanted === 0 && Math.hypot(p.x - g.x, p.y - g.y) < 130) {
      completeMission(state);
    }
  }
}

// Retry the failed mission from its start.
export function retryMission(state) {
  const id = state.mission.next;
  if (id >= 1 && id <= 4 && !state.mission.active) startMission(state, id);
}

// One-line objective for the HUD.
export function objectiveText(state) {
  if (state.mission.active) return state.mission.active.objective;
  if (state.mission.next > 4) return 'Story complete — Solmar is yours.';
  const def = missionDef(state.mission.next);
  if (state.player.rep < def.repNeeded) return `Next job "${def.name}" needs REP ${def.repNeeded} (yours: ${state.player.rep})`;
  return 'Press M for the next job';
}
