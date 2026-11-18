// SOLARA HEAT — every tuning number and colour in one place.
// Costa Solara is a sun-soaked coastal city: 3600 x 3600 world units, a grid
// of avenues and streets, a beach along the south edge and a marina on the
// east edge. The playfield is drawn in world units; the renderer scales it
// to the window, so no rule below depends on the screen size.
'use strict';

export const WORLD = { width: 3600, height: 3600 };

// Roads: avenues run north-south, streets east-west. Intersections are the
// traffic graph's nodes; traffic cars drive node to node along them.
export const ROADS_X = [200, 700, 1200, 1700, 2200, 2700, 3200];
export const ROADS_Y = [200, 700, 1200, 1700, 2200, 2700, 3200];
export const ROAD_W = 132;
export const BLOCK = 368; // gap between road centrelines minus road width

export const STEP = 1 / 60; // fixed simulation step, seconds

export const PLAYER = {
  radius: 14,
  walkSpeed: 235,
  sprintSpeed: 330,
  health: 100,
  punchDamage: 34,
  pistolDamage: 34,
  pistolRange: 520,
  pistolAmmo: 12, // magazine
  pistolReserve: 96,
  reloadTime: 1.1,
};

export const CAR = {
  length: 64,
  width: 30,
  // Arcade handling: acceleration, top speed, reverse, grip.
  accel: 420,
  brake: 700,
  maxSpeed: 520,
  maxReverse: 190,
  steer: 2.6, // rad/s at full lock, scaled down at speed
  drag: 0.55,
};

// Original vehicles of Costa Solara — nothing from any commercial game.
export const CAR_TYPES = {
  sedan:   { name: 'Solano',    top: 470, accel: 400, grip: 2.6, colors: ['#c94f42', '#4f7ec9', '#e8e3d5', '#5a6b52'] },
  taxi:    { name: 'City Cab',  top: 480, accel: 410, grip: 2.6, colors: ['#f2b705'] },
  hatch:   { name: 'Pingo',     top: 430, accel: 430, grip: 2.9, colors: ['#7ec850', '#e07b39', '#39a0c9'] },
  van:     { name: 'Carga',     top: 390, accel: 330, grip: 2.2, colors: ['#d8d2c4', '#8a94a6'] },
  pickup:  { name: 'Rancho',    top: 450, accel: 380, grip: 2.4, colors: ['#a65a2e', '#3e5c43'] },
  sports:  { name: 'Cometa GT', top: 640, accel: 560, grip: 3.1, colors: ['#d21f3c', '#1f2a44', '#f5f0e6'] },
  truck:   { name: 'Hauler',    top: 340, accel: 280, grip: 1.9, colors: ['#6b7c8c', '#b0893c'] },
  police:  { name: 'Interceptor', top: 580, accel: 540, grip: 3.0, colors: ['#20242c'] },
};

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 52;
export const POLICE_CAR_MAX = 5;

export const WANTED = {
  stealCar: 1,
  shootPed: 1,
  killPed: 1,
  killCop: 2,
  shootNearCop: 1,
  decaySeconds: 22, // one star fades after this long unseen
  sightRange: 460, // a cop that can see the player holds the heat
};

export const MONEY = {
  start: 250,
  bustedLoss: 0.10, // 10% of cash on busted / wasted
  fareReward: 120, // side job: taxi-style pickup fares appear in free roam
};

export const SAVE_KEY = 'solara-heat.save.v1';

export const PALETTE = {
  grass: '#79a75c',
  grassDark: '#6b9a50',
  sand: '#e6cf9e',
  sea: '#2b7d9e',
  seaDeep: '#1f6a8c',
  road: '#3b4048',
  roadEdge: '#2f333b',
  lane: '#e8d44f',
  sidewalk: '#b9b3a4',
  curb: '#9a9484',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7fa8a0', '#b0563f', '#e0cfa8', '#8a6f9e', '#5d7d8a', '#c98a7a'],
  buildingWall: '#8a7f70',
  park: '#5f9e4e',
  tree: '#2f6b34',
  treeLight: '#4c8a3f',
  palm: '#3f7d3a',
  player: '#f2c14e',
  playerDark: '#1f2a44',
  cop: '#233246',
  copCar: '#20242c',
  thug: '#7a2e2e',
  text: '#f5f1e6',
  muted: '#b8b2a2',
  hudPanel: 'rgba(16, 20, 28, 0.72)',
  hudAccent: '#f2c14e',
  marker: '#ffcf3d',
  markerBad: '#ff5346',
  health: '#58c96b',
  healthLow: '#ff5346',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Segoe UI", system-ui, sans-serif';
