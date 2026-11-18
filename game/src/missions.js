// SOLARA HEAT — the story. Six jobs for Vera Solano, Milo Reyes' fixer,
// played in order: pickup, car theft, street tax, a getaway, a bank job
// and a finale at the yacht club. Each mission is a list of stages; a
// stage is one job (go somewhere, hold E to work a spot, collect from
// several spots, eliminate a crew, survive, escape). The runner only reads
// and writes the world state — it never draws anything.
'use strict';

import { PLAYER } from './config.js';
import {
  addWanted, setWanted, spawnThugs, showBanner, dropPickup,
} from './world.js';

export const MISSIONS = [
  {
    id: 'first-pickup', title: 'First Pickup', reward: 500,
    brief: 'Vera needs a package from the marina. Drive there, grab it, bring it to her garage.',
    stages: [
      { kind: 'goto', x: 3350, y: 2200, r: 90, label: 'Drive to the Marina pickup' },
      { kind: 'channel', x: 3350, y: 2200, r: 90, seconds: 2, label: 'Hold E — grab the package' },
      { kind: 'goto', x: 950, y: 450, r: 90, label: "Deliver to Vera's Garage" },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 800,
    brief: 'A Cometa GT is sitting at Cometa Motors. Take it. Deliver it to the chop shop.',
    stages: [
      { kind: 'goto', x: 2700, y: 1200, r: 110, label: 'Go to Cometa Motors' },
      { kind: 'steal', type: 'sports', label: 'Steal the Cometa GT (E to get in)' },
      { kind: 'deliver', x: 450, y: 2950, r: 100, type: 'sports', label: 'Deliver the Cometa GT to the Chop Shop' },
    ],
  },
  {
    id: 'street-tax', title: 'Street Tax', reward: 1200,
    brief: 'Three shops owe Vera. Collect on foot. The second shop keeps dogs — armed ones.',
    stages: [
      { kind: 'channel', x: 950, y: 1700, r: 70, seconds: 3, label: 'Hold E — collect from Café Luna' },
      { kind: 'channel', x: 2200, y: 950, r: 70, seconds: 3, label: 'Hold E — collect from Bar El Faro' },
      { kind: 'eliminate', count: 2, x: 2200, y: 950, label: 'Deal with the crew that showed up' },
      { kind: 'channel', x: 1700, y: 2700, r: 70, seconds: 3, label: 'Hold E — collect from Tienda Rosa' },
    ],
  },
  {
    id: 'getaway', title: 'Getaway', reward: 1500,
    brief: 'The cops are on you — three stars. Lose them or outrun them: reach the safehouse in 90 seconds.',
    stages: [
      { kind: 'escape', x: 450, y: 450, r: 110, seconds: 90, label: 'Reach the Safehouse before time runs out' },
    ],
  },
  {
    id: 'big-score', title: 'The Big Score', reward: 5000,
    brief: 'Solara Bank, midday. Crack the vault, then bring the cash to Vera with the whole city chasing you.',
    stages: [
      { kind: 'goto', x: 1700, y: 1700, r: 100, label: 'Get to Solara Bank' },
      { kind: 'channel', x: 1700, y: 1700, r: 100, seconds: 5, label: 'Hold E — crack the vault' },
      { kind: 'deliver', x: 950, y: 450, r: 100, label: 'Escape to the Garage — the heat is on' },
    ],
  },
  {
    id: 'king-of-solara', title: 'King of Solara', reward: 10000,
    brief: 'The Marisol crew wants the docks. End it at the yacht club, then bring Vera the ledger.',
    stages: [
      { kind: 'goto', x: 3300, y: 2700, r: 120, label: 'Go to the Yacht Club' },
      { kind: 'eliminate', count: 6, x: 3300, y: 2700, label: 'Clear the Marisol crew (6 left)' },
      { kind: 'goto', x: 950, y: 450, r: 90, label: 'Bring the ledger to Vera' },
    ],
  },
];

export function createMissions() {
  return {
    index: -1, // -1: no mission active; else index into MISSIONS
    stage: 0,
    stageT: 0, // elapsed in this stage
    channelT: 0, // progress on a channel stage
    spawned: 0, // thugs spawned for an eliminate stage
    killed: 0, // thugs eliminated for an eliminate stage
    done: false, // whole story finished
    failed: false,
    failReason: '',
  };
}

function stageOf(M) {
  if (M.index < 0) return null;
  return MISSIONS[M.index].stages[M.stage] || null;
}

export function startMission(S, M, idx, audio) {
  M.index = idx;
  M.stage = 0;
  M.stageT = 0;
  M.channelT = 0;
  M.spawned = 0;
  M.killed = 0;
  M.failed = false;
  M.failReason = '';
  S.missionActive = true;
  const mission = MISSIONS[idx];
  // Stage-0 setup hooks.
  if (mission.id === 'hot-wheels') {
    // Park a fresh Cometa GT at the dealership lot.
    const exists = S.cars.some((c) => c.type === 'sports' && c.driver === 'parked'
      && Math.hypot(c.x - 2700, c.y - 1200) < 200);
    if (!exists) {
      S.cars.push({
        id: 9000 + idx, type: 'sports', name: 'Cometa GT', color: '#d21f3c',
        x: 2700, y: 1280, angle: Math.PI / 2, speed: 0,
        top: 640, accel: 560, grip: 3.1, driver: 'parked', hp: 100, smoke: 0,
        node: 0, targetNode: 0, waitT: 0, sirenT: 0,
      });
    }
  }
  if (mission.id === 'getaway') setWanted(S, 3);
  if (mission.id === 'big-score') dropPickup(S, 'ammo', 1620, 1780, 48);
  showBanner(S, mission.title.toUpperCase(), mission.brief);
  audio.missionStart();
  S.events.push('mission-started:' + mission.id);
}

export function failMission(S, M, reason, audio) {
  if (M.index < 0) return;
  S.events.push('mission-failed:' + MISSIONS[M.index].id);
  S.missionIndex = M.index; // retry the same job, don't skip it
  M.index = -1;
  M.stage = 0;
  M.failed = false;
  M.failReason = reason;
  S.missionActive = false;
  showBanner(S, 'JOB FAILED', reason);
  audio.busted();
}

export function completeMission(S, M, audio) {
  const mission = MISSIONS[M.index];
  S.money += mission.reward;
  S.missionsDone += 1;
  S.events.push('mission-complete:' + mission.id);
  showBanner(S, 'JOB COMPLETE', `${mission.title} — +$${mission.reward}`);
  audio.missionComplete();
  audio.cash();
  S.missionActive = false;
  if (M.index + 1 >= MISSIONS.length) {
    M.done = true;
    M.index = -1;
    showBanner(S, 'CITY LEGEND', 'Every job done. Costa Solara is yours, Milo.');
  } else {
    M.index = -1; // free roam until the player starts the next job
  }
  M.stage = 0;
}

export function updateMissions(S, M, dt, input, audio) {
  if (M.index < 0 || M.failed) return;
  const mission = MISSIONS[M.index];
  const stage = stageOf(M);
  if (!stage) { completeMission(S, M, audio); return; }
  M.stageT += dt;
  const p = S.player;

  const advance = () => {
    M.stage += 1;
    M.stageT = 0;
    M.channelT = 0;
    M.spawned = 0;
    M.killed = 0;
    audio.pickup();
    if (M.stage >= mission.stages.length) completeMission(S, M, audio);
  };

  const distTo = (x, y) => Math.hypot(p.x - x, p.y - y);

  switch (stage.kind) {
    case 'goto': {
      if (distTo(stage.x, stage.y) < stage.r) advance();
      break;
    }
    case 'escape': {
      if (distTo(stage.x, stage.y) < stage.r) {
        setWanted(S, 0);
        advance();
      } else if (M.stageT > stage.seconds) {
        failMission(S, M, 'Out of time — the safehouse door closed on you.', audio);
      }
      break;
    }
    case 'channel': {
      if (distTo(stage.x, stage.y) < stage.r && input.interactHeld()) {
        M.channelT += dt;
        if (M.channelT >= stage.seconds) {
          if (mission.id === 'big-score' && M.stage === 1) setWanted(S, 4);
          advance();
        }
      } else if (distTo(stage.x, stage.y) >= stage.r) {
        M.channelT = Math.max(0, M.channelT - dt * 2);
      }
      break;
    }
    case 'steal': {
      if (!p.onFoot && p.car && p.car.type === stage.type) advance();
      break;
    }
    case 'deliver': {
      const inRightCar = !stage.type || (!p.onFoot && p.car && p.car.type === stage.type);
      if (inRightCar && distTo(stage.x, stage.y) < stage.r) {
        if (stage.type) {
          // Hand the car over: it leaves the player's hands.
          const car = p.car;
          car.driver = 'parked';
          car.speed = 0;
          p.car = null;
          p.onFoot = true;
          p.x = car.x + 40;
          p.y = car.y + 40;
        }
        advance();
      }
      break;
    }
    case 'eliminate': {
      if (M.spawned < stage.count) {
        const spawned = spawnThugs(S, stage.x, stage.y, stage.count - M.spawned);
        M.spawned += spawned.length;
      }
      // Count kills through events this frame.
      for (const ev of S.events) {
        if (ev === 'thug-down') M.killed += 1;
      }
      if (M.killed >= stage.count) advance();
      break;
    }
    default:
      break;
  }
}

// The current objective line for the HUD, with distance.
export function missionObjective(S, M) {
  if (M.index < 0) {
    if (M.done) return { title: 'FREE ROAM', text: 'Costa Solara is yours. Take fares, steal cars, stay out of trouble.', dist: 0 };
    const next = MISSIONS[S.missionIndex];
    return { title: 'FREE ROAM', text: next ? `Next job: ${next.title} — press ENTER to start` : 'Free roam', dist: 0 };
  }
  const mission = MISSIONS[M.index];
  const stage = stageOf(M);
  if (!stage) return { title: mission.title, text: '', dist: 0 };
  let text = stage.label;
  let dist = 0;
  if (stage.x !== undefined) {
    dist = Math.round(Math.hypot(S.player.x - stage.x, S.player.y - stage.y));
    if (stage.kind === 'channel' && M.channelT > 0) {
      text += ` — ${Math.round((M.channelT / stage.seconds) * 100)}%`;
    }
    if (stage.kind === 'eliminate') {
      text = stage.label.replace(/\(\d+ left\)/, `(${Math.max(0, stage.count - M.killed)} left)`);
    }
  }
  return { title: `${mission.title}  •  ${M.stage + 1}/${mission.stages.length}`, text, dist };
}

// The world position the HUD arrow and minimap should point at, or null.
export function missionMarker(S, M) {
  if (M.index < 0) {
    // Point at the next job's start when idle.
    if (!M.done && S.missionIndex < MISSIONS.length) {
      const next = MISSIONS[S.missionIndex];
      const s0 = next.stages[0];
      if (s0.x !== undefined) return { x: s0.x, y: s0.y, color: '#ffcf3d' };
    }
    if (S.fare) {
      const t = S.fare.stage === 'pickup' ? { x: S.fare.x, y: S.fare.y } : { x: S.fare.tx, y: S.fare.ty };
      return { ...t, color: '#58c96b' };
    }
    return null;
  }
  const stage = stageOf(M);
  if (!stage || stage.x === undefined) return null;
  return { x: stage.x, y: stage.y, color: '#ffcf3d' };
}

// Start the next job from free roam (called from the title screen / HUD).
export function startNextMission(S, M, audio) {
  if (M.index >= 0 || M.done) return false;
  const idx = S.missionIndex;
  if (idx >= MISSIONS.length) return false;
  startMission(S, M, idx, audio);
  S.missionIndex = idx + 1;
  return true;
}
