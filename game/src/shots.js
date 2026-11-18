// SOLARA HEAT — deterministic screenshot states. ?shot=start|drive|shootout|
// complete (with &seed=N) stages one exact, frozen frame for the bounty
// screenshots: the main loop renders the staged frame and flips
// window.__ready on. Nothing here runs the simulation — it only arranges
// the world so the frame shows the game at its most complete.
'use strict';

import { showBanner, setWanted, spawnThugs, spawnCop } from './world.js';
import { startMission } from './missions.js';
import { randomRoadPoint, randomSidewalkPoint } from './city.js';

// Traffic and peds for a staged shot: real cars on real roads near the
// focus point, never parked on a rooftop.
function placeTrafficNear(S, cx, cy, n) {
  let placed = 0;
  for (const car of S.cars) {
    if (car.driver !== 'traffic') continue;
    let p = null;
    for (let tries = 0; tries < 24 && !p; tries++) {
      const cand = randomRoadPoint(S.city, S.rng);
      if (Math.hypot(cand.x - cx, cand.y - cy) < 850) p = cand;
    }
    if (!p) continue;
    car.x = p.x;
    car.y = p.y;
    car.angle = S.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    car.speed = 200 + (placed % 4) * 40;
    placed++;
    if (placed >= n) break;
  }
}

function placePedsNear(S, cx, cy, n) {
  let placed = 0;
  for (const ped of S.peds) {
    if (ped.state === 'thug') continue;
    let p = null;
    for (let tries = 0; tries < 24 && !p; tries++) {
      const cand = randomSidewalkPoint(S.city, S.rng);
      if (Math.hypot(cand.x - cx, cand.y - cy) < 850) p = cand;
    }
    if (!p) continue;
    ped.x = p.x;
    ped.y = p.y;
    placed++;
    if (placed >= n) break;
  }
}

export function stageShot(kind, S, M, audio) {
  S.time = 2.5; // fixed clock so pulsing never varies between runs
  S.screen = 'play';
  if (kind === 'start') {
    S.screen = 'title';
    S.player.x = 1700;
    S.player.y = 1700;
    S.money = 2450;
    S.missionsDone = 2;
    S.missionIndex = 2;
    placeTrafficNear(S, 1700, 1700, 8);
    placePedsNear(S, 1700, 1700, 10);
    return { save: { missionIndex: 2, money: 2450, missionsDone: 2 } };
  }
  if (kind === 'drive') {
    // Mid-chase: Milo in the Cometa GT, three stars, two interceptors on
    // his tail, the getaway job live on the HUD.
    const car = S.cars.find((c) => c.type === 'sports');
    const gt = car || S.cars[0];
    gt.type = 'sports';
    gt.name = 'Cometa GT';
    gt.color = '#d21f3c';
    gt.top = 640; gt.accel = 560; gt.grip = 3.1;
    gt.x = 1700; gt.y = 1700; gt.angle = 0; gt.speed = 520;
    gt.driver = 'player'; gt.hp = 100;
    S.player.car = gt;
    S.player.onFoot = false;
    S.player.x = gt.x; S.player.y = gt.y; S.player.angle = 0;
    S.player.hp = 100;
    S.money = 1850;
    S.missionsDone = 3;
    S.missionIndex = 3;
    setWanted(S, 3);
    startMission(S, M, 3, audio);
    // Two police interceptors in pursuit behind him.
    let placed = 0;
    for (const c of S.cars) {
      if (c.driver !== 'police') continue;
      c.x = 1700 - 260 - placed * 120;
      c.y = 1700 + (placed === 0 ? -50 : 55);
      c.angle = 0;
      c.speed = 480;
      placed++;
      if (placed >= 2) break;
    }
    // If the world spawned no police cars yet, make two from traffic cars.
    if (placed < 2) {
      for (const c of S.cars) {
        if (placed >= 2) break;
        if (c.driver !== 'traffic') continue;
        c.driver = 'police';
        c.type = 'police';
        c.color = '#20242c';
        c.top = 580; c.accel = 540;
        c.x = 1700 - 260 - placed * 120;
        c.y = 1700 + (placed === 0 ? -50 : 55);
        c.angle = 0;
        c.speed = 480;
        placed++;
      }
    }
    placeTrafficNear(S, 1700, 1700, 7);
    placePedsNear(S, 1700, 1700, 8);
    return null;
  }
  if (kind === 'shootout') {
    // On foot outside Solara Bank: Milo mid-gunfight, vault job live,
    // thugs and cops closing in, a bystander running.
    S.player.x = 1700;
    S.player.y = 1900;
    S.player.angle = -Math.PI / 2;
    S.player.onFoot = true;
    S.player.car = null;
    S.player.hp = 68;
    S.player.ammo = 7;
    S.player.reserve = 48;
    S.money = 3200;
    S.missionsDone = 4;
    S.missionIndex = 4;
    setWanted(S, 2);
    startMission(S, M, 4, audio);
    M.stage = 1; // vault-cracking stage, so the HUD shows the channel job
    M.channelT = 2.5;
    // The mission banner would sit on top of the player: clear it — the
    // objective panel already names the job.
    S.banner = null;
    S.bannerT = 0;
    // Muzzle flash + tracers in flight.
    S.bullets.push({
      x: 1700, y: 1870, vx: 0, vy: -900, life: 0.5, from: 'player', damage: 34,
    });
    S.bullets.push({
      x: 1560, y: 1740, vx: 620, vy: 300, life: 0.5, from: 'enemy', damage: 9,
    });
    for (let i = 0; i < 10; i++) {
      S.particles.push({
        x: 1700 + (Math.random() - 0.5) * 40, y: 1870 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 120,
        life: 0.4, maxLife: 0.8, color: '#ffd76a', size: 3,
      });
    }
    spawnThugs(S, 1560, 1700, 2);
    spawnThugs(S, 1840, 1700, 1);
    spawnCop(S, 1700, 2150);
    spawnCop(S, 1420, 1700);
    placeTrafficNear(S, 1700, 1850, 5);
    placePedsNear(S, 1700, 1850, 8);
    return null;
  }
  if (kind === 'complete') {
    // The Big Score, done: banner up, cash in, heat gone, the Cometa GT
    // parked outside Vera's garage.
    const car = S.cars.find((c) => c.type === 'sports');
    const gt = car || S.cars[0];
    gt.type = 'sports';
    gt.name = 'Cometa GT';
    gt.color = '#d21f3c';
    gt.top = 640; gt.accel = 560; gt.grip = 3.1;
    gt.x = 950; gt.y = 560; gt.angle = Math.PI / 2; gt.speed = 0;
    gt.driver = 'player'; gt.hp = 100;
    S.player.car = gt;
    S.player.onFoot = false;
    S.player.x = gt.x; S.player.y = gt.y; S.player.angle = Math.PI / 2;
    S.player.hp = 100;
    S.player.ammo = 12;
    S.money = 7450;
    S.missionsDone = 5;
    S.missionIndex = 5;
    setWanted(S, 0);
    showBanner(S, 'JOB COMPLETE', 'The Big Score — +$5,000');
    S.bannerT = 3.2;
    placeTrafficNear(S, 950, 560, 5);
    placePedsNear(S, 950, 560, 6);
    return null;
  }
  // Unknown shot: the title screen.
  S.screen = 'title';
  return null;
}
