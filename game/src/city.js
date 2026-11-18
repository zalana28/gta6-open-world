// SOLARA HEAT — the city of Costa Solara, generated once per seed.
// A grid of avenues and streets; every block between them holds buildings,
// a park, a parking lot or a plaza. The south edge is a beach and the sea,
// the east edge a marina. Named places (hospital, safehouse, garage, bank,
// dealership, chop shop, shops) are fixed addresses so missions, the
// minimap and the screenshots always find them in the same spot.
'use strict';

import { WORLD, ROADS_X, ROADS_Y, ROAD_W, PALETTE } from './config.js';

// Fixed addresses — the story's map. x/y are world units.
export const PLACES = {
  safehouse:  { x: 450,  y: 450,  label: 'Safehouse' },
  garage:     { x: 950,  y: 450,  label: "Vera's Garage" },
  hospital:   { x: 2950, y: 450,  label: 'Solara General' },
  bank:       { x: 1700, y: 1700, label: 'Solara Bank' },
  dealership: { x: 2700, y: 1200, label: 'Cometa Motors' },
  chopShop:   { x: 450,  y: 2950, label: 'Chop Shop' },
  marina:     { x: 3350, y: 2200, label: 'Marina' },
  market:     { x: 1200, y: 2200, label: 'Mercado' },
  shopA:      { x: 950,  y: 1700, label: 'Café Luna' },
  shopB:      { x: 2200, y: 950,  label: 'Bar El Faro' },
  shopC:      { x: 1700, y: 2700, label: 'Tienda Rosa' },
  yacht:      { x: 3300, y: 2700, label: 'Yacht Club' },
  beach:      { x: 1700, y: 3450, label: 'Playa Sol' },
};

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const palms = [];

  // Blocks sit between neighbouring roads. The outer ring (beyond the last
  // road) is beach to the south, marina water to the east, grass elsewhere.
  for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy++) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      const roll = rng.next();
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (roll < 0.16) {
        // Park: lawn, paths, trees.
        parks.push({ x0, y0, x1, y1 });
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i++) {
          trees.push({ x: rng.range(x0 + 30, x1 - 30), y: rng.range(y0 + 30, y1 - 30), r: rng.range(14, 22) });
        }
      } else if (roll < 0.28) {
        // Parking lot: flat asphalt with parked cars (spawned by world.js).
        lots.push({ x0, y0, x1, y1 });
      } else {
        // Buildings: 1-4 per block, each a rectangle with a roof colour.
        const cols = rng.chance(0.5) ? 2 : 1;
        const rows = rng.chance(0.5) ? 2 : 1;
        const bw = (x1 - x0) / cols;
        const bh = (y1 - y0) / rows;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (rng.chance(0.12)) continue; // courtyard gap
            const pad = 16;
            const bx0 = x0 + c * bw + pad;
            const by0 = y0 + r * bh + pad;
            const bx1 = x0 + (c + 1) * bw - pad;
            const by1 = y0 + (r + 1) * bh - pad;
            buildings.push({
              x0: bx0, y0: by0, x1: bx1, y1: by1,
              roof: rng.pick(PALETTE.buildingRoof),
              h: rng.int(10, 26), // fake height, for the shadow offset
              windows: rng.chance(0.7),
            });
          }
        }
      }
      // A couple of street trees on the block corners.
      if (rng.chance(0.6)) trees.push({ x: x0 + 8, y: y0 + 8, r: 12 });
      if (rng.chance(0.4)) trees.push({ x: x1 - 8, y: y1 - 8, r: 12 });
      void cx; void cy;
    }
  }

  // Palm-lined beach promenade along the south edge.
  for (let x = 180; x < WORLD.width - 120; x += 130) {
    palms.push({ x: x + rng.range(-20, 20), y: 3380 + rng.range(-8, 8), r: 16 });
  }
  // Marina docks on the east edge.
  const docks = [];
  for (let y = 900; y < 3100; y += 320) docks.push({ x: 3420, y, w: 120, h: 26 });

  // Traffic graph: nodes at every intersection, edges along every road.
  const nodes = [];
  const nodeAt = new Map();
  for (const x of ROADS_X) {
    for (const y of ROADS_Y) {
      const id = nodes.length;
      nodes.push({ x, y, id });
      nodeAt.set(`${x},${y}`, id);
    }
  }
  const edges = [];
  const ny = ROADS_Y.length;
  for (let ix = 0; ix < ROADS_X.length; ix++) {
    for (let iy = 0; iy < ROADS_Y.length; iy++) {
      const id = ix * ny + iy;
      if (ix + 1 < ROADS_X.length) edges.push([id, (ix + 1) * ny + iy]);
      if (iy + 1 < ROADS_Y.length) edges.push([id, ix * ny + iy + 1]);
    }
  }
  const neighbours = nodes.map(() => []);
  for (const [a, b] of edges) {
    neighbours[a].push(b);
    neighbours[b].push(a);
  }

  const city = { buildings, parks, lots, trees, palms, docks, nodes, neighbours, places: PLACES };
  return city;
}

// --- Collision + placement helpers ---------------------------------------

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return b;
  }
  return null;
}

// Push a circle (x, y, r) out of any building it overlaps. Returns true if
// a push happened. Buildings are the only solid obstacles.
export function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x0, Math.min(p.x, b.x1));
    const cy = Math.max(b.y0, Math.min(p.y, b.y1));
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        // Centre inside the rectangle: push out along the smallest axis.
        const left = p.x - b.x0, right = b.x1 - p.x;
        const top = p.y - b.y0, bottom = b.y1 - p.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) p.x = b.x0 - r;
        else if (m === right) p.x = b.x1 + r;
        else if (m === top) p.y = b.y0 - r;
        else p.y = b.y1 + r;
      }
    }
  }
  return hit;
}

// Is this point on a road (drivable)? Used for spawns and AI.
export function onRoad(x, y) {
  const onX = ROADS_X.some((rx) => Math.abs(x - rx) < ROAD_W / 2 - 6);
  const onY = ROADS_Y.some((ry) => Math.abs(y - ry) < ROAD_W / 2 - 6);
  return onX || onY;
}

// A random point on a road, for traffic / ped spawns.
export function randomRoadPoint(city, rng) {
  if (rng.chance(0.5)) {
    const x = rng.pick(ROADS_X) + rng.range(-ROAD_W / 2 + 18, ROAD_W / 2 - 18);
    const y = rng.range(140, WORLD.height - 140);
    return { x, y };
  }
  const y = rng.pick(ROADS_Y) + rng.range(-ROAD_W / 2 + 18, ROAD_W / 2 - 18);
  const x = rng.range(140, WORLD.width - 140);
  return { x, y };
}

// Nearest intersection node to a point (traffic routing).
export function nearestNode(city, x, y) {
  let best = 0;
  let bestD = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) { bestD = d; best = n.id; }
  }
  return best;
}

// A random sidewalk point (peds walk the block edges, just off the road).
export function randomSidewalkPoint(city, rng) {
  const p = randomRoadPoint(city, rng);
  const dx = rng.chance(0.5) ? (ROAD_W / 2 + 12) : -(ROAD_W / 2 + 12);
  if (rng.chance(0.5)) p.x += dx;
  else p.y += dx;
  p.x = Math.max(60, Math.min(WORLD.width - 60, p.x));
  p.y = Math.max(60, Math.min(WORLD.height - 60, p.y));
  if (pointInBuilding(city, p.x, p.y)) return randomSidewalkPoint(city, rng);
  return p;
}
