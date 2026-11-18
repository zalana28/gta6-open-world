// SOLARA HEAT — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, missions tick, and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, busted, wasted and story-complete. Progress saves to localStorage
// after every job and on demand from the pause menu.
//
// ?seed=N fixes the city. ?shot=start|drive|shootout|complete (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__ready for a screenshot.
'use strict';

import { WORLD, STEP, SAVE_KEY, MONEY } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createWorld, stepWorld, clearPolice, showBanner,
} from './world.js';
import {
  createMissions, startMission, updateMissions, startNextMission,
  failMission, MISSIONS,
} from './missions.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const city = buildCity(rng);
const S = createWorld(city, rng);
const M = createMissions();
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

let cam = { x: 0, y: 0 };
let hintT = 14;
let save = loadSave();
let lostCash = 0;
let accumulator = 0;
let last = performance.now();

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Single-key actions that live outside the input module (menu keys).
const menuPressed = new Set();
window.addEventListener('keydown', (e) => {
  if (!menuPressed.has(e.code)) menuPressed.add(e.code);
  if (e.code === 'KeyM') audio.unlock();
});

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: S.money,
      missionIndex: S.missionIndex,
      missionsDone: S.missionsDone,
      hp: S.player.hp,
      ammo: S.player.ammo,
      reserve: S.player.reserve,
      x: S.player.x,
      y: S.player.y,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit.
  }
}

function applySave(data) {
  S.money = data.money;
  S.missionIndex = data.missionIndex;
  S.missionsDone = data.missionsDone;
  S.player.hp = data.hp || 100;
  S.player.ammo = data.ammo ?? 12;
  S.player.reserve = data.reserve ?? 96;
  S.player.x = data.x ?? 450;
  S.player.y = data.y ?? 520;
  S.player.onFoot = true;
  S.player.car = null;
}

function newGame() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch {}
  save = null;
  S.money = MONEY.start;
  S.missionIndex = 0;
  S.missionsDone = 0;
  S.player.hp = 100;
  S.player.ammo = 12;
  S.player.reserve = 96;
  S.player.x = 450;
  S.player.y = 520;
  S.player.onFoot = true;
  S.player.car = null;
  M.index = -1;
  M.done = false;
}

function cameraFor() {
  const v = renderer.view();
  cam.x = Math.max(0, Math.min(WORLD.width - v.w, S.player.x - v.w / 2));
  cam.y = Math.max(0, Math.min(WORLD.height - v.h, S.player.y - v.h / 2));
}

function announce(message) {
  status.textContent = message;
}

function respawn() {
  lostCash = Math.floor(S.money * 0.10);
  S.money -= lostCash;
  clearPolice(S);
  if (S.player.car) {
    S.player.car.driver = 'parked';
    S.player.car.speed = 0;
    S.player.car = null;
  }
  S.player.onFoot = true;
  S.player.hp = 100;
  S.player.x = 2950;
  S.player.y = 520;
  S.player.angle = -Math.PI / 2;
  S.bustedT = 0;
  S.wastedT = 0;
  saveGame();
  S.screen = 'play';
  announce('Back on the streets of Costa Solara.');
}

function handleEvents() {
  for (const ev of S.events) {
    if (ev === 'busted') {
      lostCash = 0;
      S.screen = 'busted';
      audio.busted();
      audio.siren(false);
      audio.engine(0, false);
      announce('Busted by the Solara PD.');
    } else if (ev === 'wasted') {
      S.screen = 'wasted';
      audio.busted();
      audio.siren(false);
      audio.engine(0, false);
      announce('Wasted. Milo wakes up at Solara General.');
    } else if (ev.startsWith('mission-complete:')) {
      saveGame();
      const mission = MISSIONS.find((m) => ev === 'mission-complete:' + m.id);
      if (mission && S.missionIndex >= MISSIONS.length && M.done) {
        S.screen = 'legend';
      }
      announce(`Job complete: ${mission ? mission.title : ''}.`);
    } else if (ev === 'wanted-up:stolen-car') {
      announce('That car was not yours. The law noticed.');
    }
  }
  S.events.length = 0;
}

function stepPlay(dt) {
  stepWorld(S, dt, input, audio, cam);
  updateMissions(S, M, dt, input, audio);
  handleEvents();
  if (hintT > 0) hintT -= dt;
  if (input.pausePressed()) {
    S.screen = 'pause';
    announce('Paused.');
    audio.engine(0, false);
    return;
  }
  if (input.mutePressed()) {
    const muted = audio.toggleMute();
    showBanner(S, muted ? 'SOUND OFF' : 'SOUND ON', '');
  }
  // Start the next job from free roam.
  if (M.index < 0 && !M.done && input.confirmPressed()) {
    if (startNextMission(S, M, audio)) {
      announce(`Job started: ${MISSIONS[S.missionIndex - 1].title}.`);
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  cameraFor();
  if (S.screen === 'title') {
    renderer.drawWorld(S, M, cam);
    renderer.drawTitle(S, M, save);
    if (input.confirmPressed() || menuPressed.has('Enter')) {
      audio.unlock();
      audio.musicStart();
      if (save) {
        applySave(save);
        S.screen = 'play';
        if (S.missionIndex < MISSIONS.length && !M.done) startNextMission(S, M, audio);
        announce('Continuing the story.');
      } else {
        newGame();
        S.screen = 'play';
        startNextMission(S, M, audio);
        announce('First Pickup: drive to the Marina.');
      }
    } else if (menuPressed.has('KeyN')) {
      audio.unlock();
      audio.musicStart();
      newGame();
      S.screen = 'play';
      startNextMission(S, M, audio);
    }
  } else if (S.screen === 'play') {
    // Fixed 1/60 s steps, several in a slow frame, none in a fast one.
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && S.screen === 'play') {
      stepPlay(STEP);
      accumulator -= STEP;
    }
    if (S.screen !== 'play') accumulator = 0;
    renderer.drawWorld(S, M, cam);
    renderer.drawHUD(S, M, hintT);
  } else if (S.screen === 'pause') {
    renderer.drawWorld(S, M, cam);
    renderer.drawHUD(S, M, 0);
    renderer.drawPause(S);
    if (input.confirmPressed() || input.pausePressed()) {
      S.screen = 'play';
      announce('Playing.');
    } else if (menuPressed.has('KeyS')) {
      saveGame();
      showBanner(S, 'SAVED', 'Progress stored.');
      audio.pickup();
      S.screen = 'play';
    } else if (menuPressed.has('KeyR') && M.index >= 0) {
      const idx = M.index;
      failMission(S, M, 'Job restarted.', audio);
      startMission(S, M, idx, audio);
      S.missionIndex = idx + 1;
      S.screen = 'play';
    } else if (menuPressed.has('KeyQ')) {
      saveGame();
      S.screen = 'title';
    }
  } else if (S.screen === 'busted') {
    renderer.drawWorld(S, M, cam);
    renderer.drawBusted(S, lostCash);
    if (input.confirmPressed()) respawn();
  } else if (S.screen === 'wasted') {
    renderer.drawWorld(S, M, cam);
    renderer.drawWasted(S, lostCash);
    if (input.confirmPressed()) respawn();
  } else if (S.screen === 'legend') {
    renderer.drawWorld(S, M, cam);
    renderer.drawHUD(S, M, 0);
    renderer.drawStoryComplete(S);
    if (input.confirmPressed()) {
      S.screen = 'play';
      saveGame();
    }
  }
  menuPressed.clear();
  input.endFrame();
  void now;
}

// Leaving the tab pauses a running game rather than letting the city run on.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.screen === 'play') {
    S.screen = 'pause';
    announce('Paused.');
  }
});

if (shot) {
  // Screenshot mode: stage one frozen frame, paint it twice, signal ready.
  const staged = stageShot(shot, S, M, audio);
  cameraFor();
  let painted = 0;
  function paintShot() {
    renderer.drawWorld(S, M, cam);
    if (shot === 'start') renderer.drawTitle(S, M, staged ? staged.save : null);
    else renderer.drawHUD(S, M, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintShot);
    else window.__ready = true;
  }
  announce(`Solara Heat — ${shot} scene.`);
  requestAnimationFrame(paintShot);
} else {
  announce('Solara Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}
