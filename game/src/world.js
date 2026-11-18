// SOLARA HEAT — the living city: the player, cars, pedestrians, traffic,
// police and combat. One step() advances everything a fixed 1/60 s at a
// time. It pushes plain string events into S.events (car-stolen, ped-down,
// cop-down, busted, wasted, fare-done, ...) for the mission runner and the
// main loop to read; it never touches the screen or the HUD itself.
'use strict';

import {
  WORLD, PLAYER, CAR, CAR_TYPES, TRAFFIC_COUNT, PED_COUNT,
  POLICE_CAR_MAX, WANTED, MONEY,
} from './config.js';
import {
  pointInBuilding, collideBuildings, onRoad, randomRoadPoint,
  randomSidewalkPoint, nearestNode,
} from './city.js';

let nextId = 1;

function makeCar(type, x, y, angle, driver) {
  const spec = CAR_TYPES[type];
  return {
    id: nextId++, type, name: spec.name,
    color: spec.colors[Math.floor(Math.random() * spec.colors.length)],
    x, y, angle, speed: 0,
    top: spec.top, accel: spec.accel, grip: spec.grip,
    driver, // 'traffic' | 'player' | 'police' | 'parked' | null
    hp: 100, smoke: 0,
    node: 0, targetNode: 0, waitT: 0,
    sirenT: Math.random() * 2,
  };
}

function makePed(x, y) {
  const palette = ['#e07b39', '#39a0c9', '#7ec850', '#c95f8a', '#8a6f9e', '#d9a05b', '#4f7ec9'];
  return {
    id: nextId++, x, y, angle: Math.random() * Math.PI * 2,
    speed: 40 + Math.random() * 35,
    color: palette[Math.floor(Math.random() * palette.length)],
    state: 'walk', // walk | flee | down
    tx: x, ty: y, stateT: 0, hp: 34,
  };
}

function burst(S, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    S.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.35 + Math.random() * 0.45, maxLife: 0.8,
      color, size: 2 + Math.random() * 3,
    });
  }
}

export function createWorld(city, rng) {
  const S = {
    city, rng,
    time: 0,
    screen: 'title',
    money: MONEY.start,
    missionIndex: 0,
    missionsDone: 0,
    player: {
      x: 450, y: 520, angle: -Math.PI / 2, hp: PLAYER.health,
      onFoot: true, car: null, ammo: PLAYER.pistolAmmo,
      reserve: PLAYER.pistolReserve, reloadT: 0, fireT: 0, invulnT: 0,
      walkPhase: 0,
    },
    cars: [], peds: [], cops: [],
    bullets: [], particles: [], pickups: [],
    wanted: 0, heatT: 0, seenT: 0,
    bustedT: 0, wastedT: 0,
    fare: null, fareT: 0,
    events: [],
    stats: { kills: 0, carsStolen: 0, shotsFired: 0, shotsHit: 0, faresDone: 0 },
    banner: null, bannerT: 0,
  };

  spawnParkedCars(S);
  spawnTraffic(S, TRAFFIC_COUNT);
  spawnPeds(S, PED_COUNT);
  return S;
}

function spawnParkedCars(S) {
  const spots = [];
  for (const lot of S.city.lots) {
    for (let i = 0; i < 3; i++) {
      spots.push({
        x: S.rng.range(lot.x0 + 40, lot.x1 - 40),
        y: S.rng.range(lot.y0 + 40, lot.y1 - 40),
        angle: S.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      });
    }
  }
  // A few more parked along quiet streets.
  for (let i = 0; i < 8; i++) {
    const p = randomRoadPoint(S.city, S.rng);
    spots.push({ x: p.x, y: p.y, angle: S.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) });
  }
  const types = ['sedan', 'hatch', 'van', 'pickup', 'sedan', 'taxi'];
  for (const s of spots) {
    const car = makeCar(S.rng.pick(types), s.x, s.y, s.angle, 'parked');
    S.cars.push(car);
  }
}

function spawnTraffic(S, n) {
  const types = ['sedan', 'taxi', 'hatch', 'van', 'pickup', 'sedan', 'taxi', 'hatch'];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(S.city, S.rng);
    const car = makeCar(S.rng.pick(types), p.x, p.y, S.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'traffic');
    car.node = nearestNode(S.city, p.x, p.y);
    car.targetNode = S.city.neighbours[car.node][Math.floor(S.rng.next() * S.city.neighbours[car.node].length)];
    car.speed = 180 + S.rng.range(0, 90);
    S.cars.push(car);
  }
}

function spawnPeds(S, n) {
  for (let i = 0; i < n; i++) {
    const p = randomSidewalkPoint(S.city, S.rng);
    const ped = makePed(p.x, p.y);
    ped.tx = p.x; ped.ty = p.y;
    S.peds.push(ped);
  }
}

// --- Public helpers used by missions / main -------------------------------

export function nearestCar(S, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of S.cars) {
    if (car.driver === 'player') continue;
    const d = (car.x - x) ** 2 + (car.y - y) ** 2;
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function addWanted(S, n, reason) {
  if (n <= 0) return;
  const before = S.wanted;
  S.wanted = Math.min(5, S.wanted + n);
  S.heatT = 0;
  if (S.wanted > before) S.events.push('wanted-up:' + reason);
}

export function setWanted(S, n) {
  S.wanted = Math.max(0, Math.min(5, n));
  S.heatT = 0;
}

export function clearPolice(S) {
  S.cars = S.cars.filter((c) => c.driver !== 'police');
  S.cops = [];
  setWanted(S, 0);
}

export function spawnThugs(S, x, y, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ped = makePed(x + S.rng.range(-60, 60), y + S.rng.range(-60, 60));
    ped.state = 'thug';
    ped.hp = 68;
    ped.color = '#7a2e2e';
    ped.speed = 150;
    S.peds.push(ped);
    out.push(ped);
  }
  return out;
}

export function spawnCop(S, x, y) {
  const cop = {
    id: nextId++, x, y, angle: 0, hp: 68, speed: 165,
    shootT: 1 + Math.random(), state: 'chase',
  };
  S.cops.push(cop);
  return cop;
}

export function dropPickup(S, kind, x, y, amount) {
  S.pickups.push({ kind, x, y, amount, t: 0 });
}

export function showBanner(S, title, sub) {
  S.banner = { title, sub: sub || '' };
  S.bannerT = 3.2;
}

// --- The step ---------------------------------------------------------------

function stepPlayerOnFoot(S, dt, input, audio, cam) {
  const p = S.player;
  const ax = input.axis();
  const sprint = input.sprint();
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(ax.x, ax.y) || 1;
  if (ax.x !== 0 || ax.y !== 0) {
    p.x += (ax.x / len) * speed * dt;
    p.y += (ax.y / len) * speed * dt;
    p.walkPhase += dt * 11;
  }
  p.x = Math.max(30, Math.min(WORLD.width - 30, p.x));
  p.y = Math.max(30, Math.min(WORLD.height - 30, p.y));
  collideBuildings(S.city, p, PLAYER.radius);
  // Aim at the mouse (world space).
  const mwx = cam.x + input.mouse.x;
  const mwy = cam.y + input.mouse.y;
  p.angle = Math.atan2(mwy - p.y, mwx - p.x);

  // Shooting.
  p.fireT -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0 && p.reserve > 0) {
      const need = PLAYER.pistolAmmo - p.ammo;
      const take = Math.min(need, p.reserve);
      p.ammo += take;
      p.reserve -= take;
    }
  } else if (input.shooting() && p.fireT <= 0) {
    if (p.ammo > 0) {
      p.ammo -= 1;
      p.fireT = 0.18;
      S.stats.shotsFired += 1;
      S.lastShotT = S.time;
      const a = p.angle + (Math.random() - 0.5) * 0.05;
      S.bullets.push({
        x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
        vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
        life: 0.7, from: 'player', damage: PLAYER.pistolDamage,
      });
      burst(S, p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, '#ffd76a', 3, 120);
      audio.shot();
      if (p.ammo === 0) audio.denied();
    } else if (input.shotPressed()) {
      audio.denied();
      if (p.reserve > 0) p.reloadT = PLAYER.reloadTime;
    }
  }
  if (input.reloadPressed() && p.reserve > 0 && p.ammo < PLAYER.pistolAmmo) {
    p.reloadT = PLAYER.reloadTime;
  }
  if (p.invulnT > 0) p.invulnT -= dt;
}

function stepDriving(S, dt, input, audio) {
  const p = S.player;
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const ax = input.axis();
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const speedAlong = car.speed; // signed: forward positive
  if (ax.y < 0) car.speed += car.accel * dt;
  else if (ax.y > 0) {
    car.speed -= (car.speed > 20 ? CAR.brake : car.accel * 0.7) * dt;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
  }
  if (input.handbrake()) car.speed -= car.speed * 2.2 * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(car.top, car.speed));
  if (Math.abs(car.speed) < 4 && ax.y === 0) car.speed = 0;
  const steerInput = ax.x;
  const steerScale = Math.min(1, Math.abs(car.speed) / 160 + 0.25);
  car.angle += steerInput * car.grip * steerScale * dt * Math.sign(car.speed || 1) * 0.9;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  const before = { x: car.x, y: car.y };
  if (collideBuildings(S.city, car, 26)) {
    if (Math.abs(car.speed) > 240) {
      audio.crash();
      burst(S, car.x, car.y, '#ffb347', 10, 200);
      car.hp -= 12;
    }
    car.speed *= 0.45;
  }
  void before; void forward; void right;
  // Player rides the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Running over pedestrians.
  for (const ped of S.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.stateT = 4;
      burst(S, ped.x, ped.y, '#ff6b5e', 8, 160);
      audio.crash();
      addWanted(S, WANTED.killPed, 'hit-ped');
      S.events.push('ped-down');
    }
  }
  audio.engine(Math.abs(car.speed) / car.top, true);
}

function enterExitCar(S, input, audio) {
  const p = S.player;
  if (!input.interactPressed()) return;
  if (p.onFoot) {
    const car = nearestCar(S, p.x, p.y, 78);
    if (car && car.hp > 0) {
      const wasTraffic = car.driver === 'traffic';
      const wasParked = car.driver === 'parked';
      if (wasTraffic) {
        // The driver bails and runs.
        const ped = makePed(car.x + 30, car.y + 30);
        ped.state = 'flee';
        ped.stateT = 3;
        S.peds.push(ped);
        S.events.push('driver-bailed');
      }
      car.driver = 'player';
      p.car = car;
      p.onFoot = false;
      S.stats.carsStolen += 1;
      S.events.push('car-stolen');
      audio.click();
      if (wasTraffic || wasParked) addWanted(S, WANTED.stealCar, 'stolen-car');
    }
  } else if (p.car) {
    const car = p.car;
    car.driver = 'parked';
    car.speed = 0;
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    collideBuildings(S.city, p, PLAYER.radius);
    p.car = null;
    p.onFoot = true;
    audio.click();
    S.events.push('car-exited');
  }
}

function stepTrafficCar(S, car, dt) {
  if (car.hp <= 0) return;
  const target = S.city.nodes[car.targetNode];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  // Axis-aligned driving: traffic stays on its road. The car heads along
  // the dominant axis toward the next intersection and eases back onto the
  // road's centreline, so it never cuts a corner across a block.
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const wantAngle = horizontal ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  if (horizontal) car.y += (target.y - car.y) * Math.min(1, 2.5 * dt);
  else car.x += (target.x - car.x) * Math.min(1, 2.5 * dt);
  // Slow for the car ahead.
  let ahead = false;
  for (const other of S.cars) {
    if (other === car || other.hp <= 0) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (along > 0 && along < 78 && side < 26) { ahead = true; break; }
  }
  const cruise = 210 + (car.id % 5) * 18;
  const targetSpeed = ahead ? 0 : cruise;
  car.speed += Math.max(-500 * dt, Math.min(260 * dt, targetSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (dist < 46) {
    car.node = car.targetNode;
    const opts = S.city.neighbours[car.node];
    car.targetNode = opts[Math.floor(S.rng.next() * opts.length)];
  }
}

function stepPed(S, ped, dt, audio) {
  if (ped.state === 'down') {
    ped.stateT -= dt;
    if (ped.stateT <= 0) { ped.state = 'flee'; ped.stateT = 2.5; }
    return;
  }
  if (ped.state === 'flee') {
    ped.stateT -= dt;
    const dx = ped.x - S.player.x;
    const dy = ped.y - S.player.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * 1.6 * dt;
    ped.y += (dy / d) * ped.speed * 1.6 * dt;
    if (ped.stateT <= 0) { ped.state = 'walk'; }
  } else if (ped.state === 'thug') {
    // Armed thugs close in and shoot at the player.
    const dx = S.player.x - ped.x;
    const dy = S.player.y - ped.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    if (d > 260) {
      ped.x += (dx / d) * ped.speed * dt;
      ped.y += (dy / d) * ped.speed * dt;
    } else {
      ped.stateT -= dt;
      if (ped.stateT <= 0) {
        ped.stateT = 1.1 + Math.random() * 0.7;
        const a = ped.angle + (Math.random() - 0.5) * 0.22;
        S.bullets.push({
          x: ped.x + Math.cos(a) * 22, y: ped.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          life: 0.8, from: 'enemy', damage: 9,
        });
        audio.enemyShot();
      }
    }
  } else {
    // Strolling: drift to the current target, pick a new one on arrival.
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 24) {
      const p = randomSidewalkPoint(S.city, S.rng);
      ped.tx = p.x; ped.ty = p.y;
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += (dx / d) * ped.speed * dt;
      ped.y += (dy / d) * ped.speed * dt;
    }
    // Flee gunfire and speeding cars.
    const pd = Math.hypot(S.player.x - ped.x, S.player.y - ped.y);
    if (pd < 130 && S.stats.shotsFired > 0 && S.time - (S.lastShotT || 0) < 1.2) {
      ped.state = 'flee';
      ped.stateT = 2;
    }
  }
  ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD.height - 30, ped.y));
  collideBuildings(S.city, ped, 10);
}

function stepBullets(S, dt, audio) {
  for (const b of S.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) { b.life = 0; continue; }
    if (pointInBuilding(S.city, b.x, b.y)) {
      burst(S, b.x, b.y, '#c9c2b2', 4, 90);
      b.life = 0;
      continue;
    }
    if (b.from === 'player') {
      // Hit a ped / thug / cop?
      for (const ped of S.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          ped.hp -= b.damage;
          b.life = 0;
          S.stats.shotsHit += 1;
          burst(S, ped.x, ped.y, '#ff6b5e', 6, 140);
          if (ped.hp <= 0) {
            const wasThug = ped.state === 'thug';
            ped.state = 'down';
            ped.stateT = 999;
            S.stats.kills += 1;
            if (wasThug) {
              S.events.push('thug-down');
            } else {
              S.events.push('ped-down');
              addWanted(S, WANTED.killPed, 'killed-ped');
            }
          } else if (ped.state !== 'thug') {
            ped.state = 'flee';
            ped.stateT = 3;
            addWanted(S, WANTED.shootPed, 'shot-ped');
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of S.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
          cop.hp -= b.damage;
          b.life = 0;
          S.stats.shotsHit += 1;
          burst(S, cop.x, cop.y, '#ff6b5e', 6, 140);
          if (cop.hp <= 0) {
            S.cops.splice(S.cops.indexOf(cop), 1);
            S.stats.kills += 1;
            S.events.push('cop-down');
            addWanted(S, WANTED.killCop, 'killed-cop');
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of S.cars) {
        if (car.driver === 'player' || car.hp <= 0) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.hp -= b.damage * 0.4;
          b.life = 0;
          burst(S, b.x, b.y, '#ffb347', 4, 110);
          if (car.hp <= 0) blowUpCar(S, car, audio);
          break;
        }
      }
    } else {
      // Enemy bullet: the player, on foot or in the car.
      const p = S.player;
      const r = p.onFoot ? 16 : 30;
      if (Math.hypot(p.x - b.x, p.y - b.y) < r) {
        b.life = 0;
        hurtPlayer(S, b.damage, audio);
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
}

function blowUpCar(S, car, audio) {
  burst(S, car.x, car.y, '#ff9a3d', 26, 320);
  burst(S, car.x, car.y, '#3a3f4a', 18, 180);
  audio.crash();
  S.events.push('car-exploded');
  if (car.driver === 'player') {
    S.player.car = null;
    S.player.onFoot = true;
    S.player.x = car.x + 40;
    S.player.y = car.y + 40;
    hurtPlayer(S, 25, audio);
  }
  S.cars.splice(S.cars.indexOf(car), 1);
  // A fresh parked car eventually replaces traffic losses.
  if (S.cars.filter((c) => c.driver === 'traffic').length < TRAFFIC_COUNT - 6) {
    const p = randomRoadPoint(S.city, S.rng);
    const fresh = makeCar(S.rng.pick(['sedan', 'taxi', 'hatch']), p.x, p.y, 0, 'traffic');
    fresh.node = nearestNode(S.city, p.x, p.y);
    fresh.targetNode = S.city.neighbours[fresh.node][0];
    S.cars.push(fresh);
  }
}

function hurtPlayer(S, dmg, audio) {
  const p = S.player;
  if (p.invulnT > 0) return;
  p.hp -= dmg;
  p.invulnT = 0.35;
  if (p.car) {
    p.car.hp -= dmg * 0.5;
    if (p.car.hp <= 0) blowUpCar(S, p.car, audio);
  }
  if (p.hp <= 0) {
    p.hp = 0;
    S.events.push('wasted');
  }
}

function stepPolice(S, dt, audio) {
  // Wanted decay: unseen for a while, one star fades.
  let nearestCopD = Infinity;
  for (const car of S.cars) {
    if (car.driver !== 'police') continue;
    nearestCopD = Math.min(nearestCopD, Math.hypot(car.x - S.player.x, car.y - S.player.y));
  }
  for (const cop of S.cops) {
    nearestCopD = Math.min(nearestCopD, Math.hypot(cop.x - S.player.x, cop.y - S.player.y));
  }
  const seen = nearestCopD < WANTED.sightRange;
  if (S.wanted > 0) {
    if (!seen) {
      S.heatT += dt;
      if (S.heatT >= WANTED.decaySeconds) {
        S.wanted -= 1;
        S.heatT = 0;
        S.events.push('wanted-down');
      }
    } else {
      S.heatT = 0;
    }
  }
  audio.siren(S.wanted > 0);

  // Police cars: one per star, up to the cap.
  const wantCars = Math.min(S.wanted, POLICE_CAR_MAX);
  const haveCars = S.cars.filter((c) => c.driver === 'police').length;
  if (haveCars < wantCars) {
    for (let i = haveCars; i < wantCars; i++) {
      const p = randomRoadPoint(S.city, S.rng);
      // Spawn on a road 500-800 away from the player.
      let tries = 0;
      let spawn = p;
      while (Math.hypot(spawn.x - S.player.x, spawn.y - S.player.y) < 550 && tries < 12) {
        spawn = randomRoadPoint(S.city, S.rng);
        tries++;
      }
      const car = makeCar('police', spawn.x, spawn.y, 0, 'police');
      car.speed = 300;
      S.cars.push(car);
    }
  } else if (haveCars > wantCars) {
    // Stand down the furthest units first.
    const pcs = S.cars.filter((c) => c.driver === 'police')
      .sort((a, b) => Math.hypot(b.x - S.player.x, b.y - S.player.y) - Math.hypot(a.x - S.player.x, a.y - S.player.y));
    for (let i = 0; i < haveCars - wantCars; i++) {
      S.cars.splice(S.cars.indexOf(pcs[i]), 1);
    }
  }

  // Chase: pursuit steering toward the player's predicted position.
  for (const car of S.cars) {
    if (car.driver !== 'police' || car.hp <= 0) continue;
    const px = S.player.x + (S.player.car ? Math.cos(S.player.angle) * S.player.car.speed * 0.4 : 0);
    const py = S.player.y + (S.player.car ? Math.sin(S.player.angle) * S.player.car.speed * 0.4 : 0);
    const dx = px - car.x;
    const dy = py - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const cruise = dist > 300 ? car.top : 430;
    car.speed += Math.max(-700 * dt, Math.min(560 * dt, cruise - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(S.city, car, 26);
    car.sirenT += dt;
    // Ram the player.
    if (dist < 46) {
      if (S.player.onFoot) {
        hurtPlayer(S, 22 * dt * 4, audio);
      } else if (S.player.car) {
        S.player.car.hp -= 14 * dt;
        S.player.car.speed *= 1 - 0.6 * dt;
        if (Math.abs(car.speed) > 200) {
          car.speed *= 0.6;
          if (Math.random() < dt * 2) audio.crash();
        }
        if (S.player.car.hp <= 0) blowUpCar(S, S.player.car, audio);
      }
      // Cops get out when the player is on foot and close.
      if (S.player.onFoot && S.cops.length < 4 && Math.random() < dt * 0.5) {
        spawnCop(S, car.x + 40, car.y + 40);
      }
    }
  }

  // Foot cops: chase and shoot.
  const wantCops = S.wanted >= 3 ? Math.min(4, S.wanted) : S.wanted >= 1 ? 1 : 0;
  if (S.cops.length < wantCops && Math.random() < dt * 0.8) {
    const a = Math.random() * Math.PI * 2;
    spawnCop(S, S.player.x + Math.cos(a) * 380, S.player.y + Math.sin(a) * 380);
  }
  for (const cop of [...S.cops]) {
    const dx = S.player.x - cop.x;
    const dy = S.player.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (d > 300) {
      cop.x += (dx / d) * cop.speed * dt;
      cop.y += (dy / d) * cop.speed * dt;
    } else if (d > 60) {
      cop.x += (dx / d) * cop.speed * 0.7 * dt;
      cop.y += (dy / d) * cop.speed * 0.7 * dt;
    }
    cop.shootT -= dt;
    if (d < 430 && cop.shootT <= 0 && S.player.onFoot) {
      cop.shootT = 1.2 + Math.random() * 0.8;
      const a = cop.angle + (Math.random() - 0.5) * 0.2;
      S.bullets.push({
        x: cop.x + Math.cos(a) * 22, y: cop.y + Math.sin(a) * 22,
        vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
        life: 0.8, from: 'enemy', damage: 8,
      });
      audio.enemyShot();
    }
    collideBuildings(S.city, cop, 12);
    // Busted: a cop stands on the player while wanted.
    if (S.player.onFoot && d < 30 && S.wanted > 0) {
      S.bustedT += dt;
      if (S.bustedT > 1.4) S.events.push('busted');
    }
  }
  if (S.player.onFoot) {
    const anyClose = S.cops.some((c) => Math.hypot(c.x - S.player.x, c.y - S.player.y) < 30);
    if (!anyClose) S.bustedT = Math.max(0, S.bustedT - dt * 2);
  }
}

function stepPickups(S, dt, audio) {
  for (const pk of S.pickups) {
    pk.t += dt;
    const d = Math.hypot(S.player.x - pk.x, S.player.y - pk.y);
    if (d < 34) {
      if (pk.kind === 'health') {
        S.player.hp = Math.min(PLAYER.health, S.player.hp + pk.amount);
        S.events.push('picked-health');
      } else if (pk.kind === 'ammo') {
        S.player.reserve += pk.amount;
        S.events.push('picked-ammo');
      }
      audio.pickup();
      burst(S, pk.x, pk.y, '#58c96b', 8, 120);
      pk.t = 999;
    }
  }
  S.pickups = S.pickups.filter((pk) => pk.t < 60);
  // Keep a health and an ammo pickup on the map near the hospital.
  if (S.time % 1 < dt) {
    const kinds = S.pickups.map((pk) => pk.kind);
    if (!kinds.includes('health')) dropPickup(S, 'health', 2880, 520, 40);
    if (!kinds.includes('ammo')) dropPickup(S, 'ammo', 3020, 520, 48);
  }
}

function stepFare(S, dt, audio) {
  // Free-roam side job: a fare appears while driving with no mission.
  if (S.missionActive) return;
  S.fareT -= dt;
  if (!S.fare && S.fareT <= 0 && !S.player.onFoot) {
    const p = randomSidewalkPoint(S.city, S.rng);
    if (Math.hypot(p.x - S.player.x, p.y - S.player.y) > 500) {
      const dest = randomRoadPoint(S.city, S.rng);
      S.fare = { stage: 'pickup', x: p.x, y: p.y, tx: dest.x, ty: dest.y, timer: 150 };
      S.events.push('fare-offered');
    } else {
      S.fareT = 8;
    }
  }
  if (!S.fare) return;
  S.fare.timer -= dt;
  const tx = S.fare.stage === 'pickup' ? S.fare.x : S.fare.tx;
  const ty = S.fare.stage === 'pickup' ? S.fare.y : S.fare.ty;
  const d = Math.hypot(S.player.x - tx, S.player.y - ty);
  if (S.fare.timer <= 0) {
    S.fare = null;
    S.fareT = 20;
    S.events.push('fare-expired');
    return;
  }
  if (d < 60) {
    if (S.fare.stage === 'pickup') {
      if (S.player.onFoot) return; // they want a ride, not a walk
      S.fare.stage = 'dropoff';
      S.fare.timer = 150;
      audio.pickup();
      S.events.push('fare-picked-up');
    } else {
      S.money += MONEY.fareReward;
      S.stats.faresDone += 1;
      S.events.push('fare-done');
      audio.cash();
      showBanner(S, `FARE +$${MONEY.fareReward}`, 'The passenger tips and walks away.');
      S.fare = null;
      S.fareT = 25;
    }
  }
}

export function stepWorld(S, dt, input, audio, cam) {
  S.time += dt;
  if (S.bannerT > 0) S.bannerT -= dt;
  if (S.bannerT <= 0) S.banner = null;

  const p = S.player;
  if (p.onFoot) stepPlayerOnFoot(S, dt, input, audio, cam);
  else stepDriving(S, dt, input, audio);
  enterExitCar(S, input, audio);

  for (const car of S.cars) {
    if (car.driver === 'traffic') stepTrafficCar(S, car, dt);
  }
  // Car-car collisions: simple circle push-apart.
  for (let i = 0; i < S.cars.length; i++) {
    for (let j = i + 1; j < S.cars.length; j++) {
      const a = S.cars[i], b = S.cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 52) {
        const push = (52 - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        if (a.driver === 'player' || b.driver === 'player') {
          if (Math.abs((a.driver === 'player' ? a.speed : b.speed)) > 200) audio.crash();
        }
      }
    }
  }
  for (const ped of S.peds) stepPed(S, ped, dt, audio);
  S.peds = S.peds.filter((ped) => ped.state !== 'down' || ped.stateT < 900);
  stepBullets(S, dt, audio);
  stepPolice(S, dt, audio);
  stepPickups(S, dt, audio);
  stepFare(S, dt, audio);

  for (const pt of S.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.4 * dt;
    pt.vy *= 1 - 2.4 * dt;
    pt.life -= dt;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  if (!p.onFoot && !p.car) p.onFoot = true;
}
