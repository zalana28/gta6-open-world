// SOLARA HEAT — everything the player sees: the city from above, cars,
// people, bullets and particles, the HUD (money, health, wanted stars,
// ammo, objective, minimap), the mission marker and arrow, and the
// title / pause / busted / wasted screens. It draws; it never simulates.
'use strict';

import {
  WORLD, ROADS_X, ROADS_Y, ROAD_W, PALETTE, FONT, FONT_DISPLAY, PLAYER,
} from './config.js';
import { missionObjective, missionMarker, MISSIONS } from './missions.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  // The static city (ground, roads, buildings, trees) is painted once onto
  // a world-sized offscreen canvas; each frame blits only the visible
  // region. That keeps the frame cheap even on software rendering.
  let staticCanvas = null;

  function buildStatic(S) {
    const c = document.createElement('canvas');
    c.width = WORLD.width;
    c.height = WORLD.height;
    const g = c.getContext('2d');
    drawGroundStatic(g, S);
    drawRoadsStatic(g, S);
    drawBuildingsStatic(g, S);
    return c;
  }

  function view() {
    return { w: canvas.width, h: canvas.height, s: canvas.width / 1280 };
  }

  // --- World (static layers, painted once in world space) ---------------

  function drawGroundStatic(g, S) {
    // Grass base.
    g.fillStyle = PALETTE.grass;
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach + sea along the south edge.
    g.fillStyle = PALETTE.sand;
    g.fillRect(0, 3340, WORLD.width, WORLD.height - 3340);
    const grad = g.createLinearGradient(0, 3400, 0, WORLD.height);
    grad.addColorStop(0, PALETTE.sea);
    grad.addColorStop(1, PALETTE.seaDeep);
    g.fillStyle = grad;
    g.fillRect(0, 3400, WORLD.width, WORLD.height - 3400);
    // Marina water on the east edge.
    g.fillStyle = PALETTE.sea;
    g.fillRect(3360, 0, WORLD.width - 3360, WORLD.height);
    // Parks.
    for (const park of S.city.parks) {
      g.fillStyle = PALETTE.park;
      g.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(park.x0, (park.y0 + park.y1) / 2);
      g.lineTo(park.x1, (park.y0 + park.y1) / 2);
      g.moveTo((park.x0 + park.x1) / 2, park.y0);
      g.lineTo((park.x0 + park.x1) / 2, park.y1);
      g.stroke();
    }
    // Parking lots.
    for (const lot of S.city.lots) {
      g.fillStyle = '#4a4d52';
      g.fillRect(lot.x0, lot.y0, lot.x1 - lot.x0, lot.y1 - lot.y0);
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 2;
      for (let x = lot.x0 + 40; x < lot.x1 - 20; x += 56) {
        g.beginPath();
        g.moveTo(x, lot.y0 + 14);
        g.lineTo(x, lot.y0 + 44);
        g.stroke();
      }
    }
  }

  // The one animated thing in the static layer: wave lines on the sea.
  function drawWaves(S, cam, v) {
    const seaY = 3400 - cam.y;
    if (seaY < -40 || seaY > v.h + 40) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const wy = seaY + 6 + i * 14 + Math.sin(S.time * 1.4 + i * 2) * 3;
      ctx.beginPath();
      ctx.moveTo(0, wy);
      for (let x = 0; x <= v.w; x += 40) ctx.lineTo(x, wy + Math.sin(x * 0.02 + S.time + i) * 2);
      ctx.stroke();
    }
  }

  function drawRoadsStatic(g, S) {
    g.fillStyle = PALETTE.road;
    for (const x of ROADS_X) g.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const y of ROADS_Y) g.fillRect(0, y - ROAD_W / 2, WORLD.width, ROAD_W);
    // Sidewalk edges.
    g.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS_X) {
      g.fillRect(x - ROAD_W / 2, 0, 10, WORLD.height);
      g.fillRect(x + ROAD_W / 2 - 10, 0, 10, WORLD.height);
    }
    for (const y of ROADS_Y) {
      g.fillRect(0, y - ROAD_W / 2, WORLD.width, 10);
      g.fillRect(0, y + ROAD_W / 2 - 10, WORLD.width, 10);
    }
    // Centre dashes.
    g.fillStyle = PALETTE.lane;
    for (const x of ROADS_X) {
      for (let y = 0; y < WORLD.height; y += 64) {
        if (ROADS_Y.some((ry) => Math.abs(y - ry) < ROAD_W / 2 + 20)) continue;
        g.fillRect(x - 3, y, 6, 30);
      }
    }
    for (const y of ROADS_Y) {
      for (let x = 0; x < WORLD.width; x += 64) {
        if (ROADS_X.some((rx) => Math.abs(x - rx) < ROAD_W / 2 + 20)) continue;
        g.fillRect(x, y - 3, 30, 6);
      }
    }
    void S;
  }

  function drawBuildingsStatic(g, S) {
    for (const b of S.city.buildings) {
      const x = b.x0, y = b.y0;
      const w = b.x1 - b.x0, h = b.y1 - b.y0;
      // Shadow: the sun is high and to the south-west.
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x + 8, y + 10, w, h);
      g.fillStyle = b.roof;
      g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = 3;
      g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      // Roof detail: inner court + vents.
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x + 10, y + 10, w - 20, h - 20);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x + w / 2 - 8, y + h / 2 - 8, 16, 16);
      if (b.windows) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let wx = x + 16; wx < x + w - 12; wx += 26) {
          for (let wy = y + 16; wy < y + h - 12; wy += 26) {
            g.fillRect(wx, wy, 10, 10);
          }
        }
      }
    }
    // Docks + boats at the marina.
    for (const d of S.city.docks) {
      g.fillStyle = '#7a5c38';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = '#f5f0e6';
      g.beginPath();
      g.ellipse(d.x + d.w / 2, d.y + d.h + 26, 34, 12, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Trees and palms.
    for (const t of S.city.trees) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = PALETTE.tree;
      g.beginPath(); g.arc(t.x, t.y, t.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = PALETTE.treeLight;
      g.beginPath(); g.arc(t.x - 4, t.y - 4, t.r * 0.6, 0, Math.PI * 2); g.fill();
    }
    for (const t of S.city.palms) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = PALETTE.palm;
      g.beginPath(); g.arc(t.x, t.y, t.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = PALETTE.palm;
      g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        g.beginPath();
        g.moveTo(t.x, t.y);
        g.lineTo(t.x + Math.cos(a) * (t.r + 10), t.y + Math.sin(a) * (t.r + 10));
        g.stroke();
      }
    }
  }

  function drawCarShape(car, cam, isPlayer) {
    const x = car.x - cam.x, y = car.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, -30, -13, 64, 30, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-24, -17, 12, 6);
    ctx.fillRect(-24, 11, 12, 6);
    ctx.fillRect(14, -17, 12, 6);
    ctx.fillRect(14, 11, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    rr(ctx, -32, -15, 64, 30, 9);
    ctx.fill();
    // Roof + windshield.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, -8, -12, 22, 24, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.75)';
    ctx.fillRect(8, -12, 6, 24);
    ctx.fillRect(-26, -12, 5, 24);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(30, -12, 3, 6);
    ctx.fillRect(30, 6, 3, 6);
    if (car.driver === 'police') {
      // Flashing light bar.
      const phase = Math.floor(car.sirenT * 4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-6, -14, 12, 5);
      ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-6, 9, 12, 5);
      ctx.fillStyle = '#f5f0e6';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 26);
    }
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.hudAccent;
      ctx.lineWidth = 3;
      rr(ctx, -34, -17, 68, 34, 10);
      ctx.stroke();
    }
    if (car.hp < 55 && car.hp > 0) {
      // Smoke from a dying car.
      ctx.fillStyle = `rgba(60,60,60,${0.5 * (1 - car.hp / 55)})`;
      ctx.beginPath();
      ctx.arc(-10 + Math.random() * 8, -6 + Math.random() * 12, 8 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPersonShape(x, y, angle, color, cam, opts = {}) {
    const sx = x - cam.x, sy = y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (opts.down) {
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    // Body: shoulders + head, facing the angle.
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(5, 0, 6, 0, Math.PI * 2); ctx.fill();
    if (opts.gun) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(24, 0); ctx.stroke();
    }
    if (opts.cap) {
      ctx.fillStyle = '#1d2c44';
      ctx.beginPath(); ctx.arc(5, 0, 6.5, Math.PI, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(S, M, cam, v) {
    const marker = missionMarker(S, M);
    if (!marker) return;
    const mx = marker.x - cam.x, my = marker.y - cam.y;
    const inView = mx > 40 && mx < v.w - 40 && my > 40 && my < v.h - 40;
    const pulse = 1 + Math.sin(S.time * 4) * 0.12;
    if (inView) {
      // Beam + diamond + ring on the ground.
      const grad = ctx.createLinearGradient(mx, my - 160, mx, my);
      grad.addColorStop(0, 'rgba(255,207,61,0)');
      grad.addColorStop(1, 'rgba(255,207,61,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(mx - 8, my - 160, 16, 160);
      ctx.save();
      ctx.translate(mx, my - 46);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = marker.color;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      ctx.strokeStyle = marker.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Edge arrow pointing at the target.
      const cx = v.w / 2, cy = v.h / 2;
      const dx = mx - cx, dy = my - cy;
      const a = Math.atan2(dy, dx);
      const ex = cx + Math.cos(a) * (Math.min(v.w, v.h) / 2 - 46);
      const ey = cy + Math.sin(a) * (Math.min(v.w, v.h) / 2 - 46);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = marker.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(26, 0); ctx.lineTo(-16, -18); ctx.lineTo(-8, 0); ctx.lineTo(-16, 18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // --- HUD -----------------------------------------------------------------

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.hudPanel;
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
  }

  function drawStars(S, v) {
    const n = 5;
    const size = 30 * v.s;
    const gap = 34 * v.s;
    const x0 = v.w - 230 * v.s - (n - 1) * gap;
    const y0 = 16 * v.s;
    ctx.font = `${size}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < S.wanted ? '#ffcf3d' : 'rgba(255,255,255,0.28)';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      const x = x0 + i * gap;
      ctx.strokeText('★', x, y0);
      ctx.fillText('★', x, y0);
    }
  }

  function drawMinimap(S, M, v) {
    const size = 200 * v.s;
    const x0 = v.w - size - 16 * v.s;
    const y0 = 52 * v.s;
    const k = size / WORLD.width;
    ctx.save();
    panel(x0 - 6, y0 - 6, size + 12, size + 12);
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#6b9a50';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#2b7d9e';
    ctx.fillRect(x0 + 3360 * k, y0, size - 3360 * k, size);
    ctx.fillRect(x0, y0 + 3340 * k, size, size - 3340 * k);
    ctx.fillStyle = '#e6cf9e';
    ctx.fillRect(x0, y0 + 3340 * k, size, 12 * k * 40);
    ctx.strokeStyle = '#3b4048';
    ctx.lineWidth = Math.max(2, 84 * k);
    for (const x of ROADS_X) {
      ctx.beginPath(); ctx.moveTo(x0 + x * k, y0); ctx.lineTo(x0 + x * k, y0 + size); ctx.stroke();
    }
    for (const y of ROADS_Y) {
      ctx.beginPath(); ctx.moveTo(x0, y0 + y * k); ctx.lineTo(x0 + size, y0 + y * k); ctx.stroke();
    }
    const dot = (x, y, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x0 + x * k, y0 + y * k, r, 0, Math.PI * 2); ctx.fill();
    };
    const marker = missionMarker(S, M);
    if (marker) {
      const pulse = 5 + Math.sin(S.time * 5) * 2;
      dot(marker.x, marker.y, pulse, marker.color);
      ctx.strokeStyle = marker.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x0 + marker.x * k, y0 + marker.y * k, pulse + 4, 0, Math.PI * 2); ctx.stroke();
    }
    for (const car of S.cars) {
      if (car.driver === 'police') dot(car.x, car.y, 3.5, '#2d6bff');
    }
    if (S.fare) dot(S.fare.stage === 'pickup' ? S.fare.x : S.fare.tx, S.fare.stage === 'pickup' ? S.fare.y : S.fare.ty, 4, '#58c96b');
    // Player arrow.
    const px = x0 + S.player.x * k, py = y0 + S.player.y * k;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(S.player.angle);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${11 * v.s}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('N', x0 + 4, y0 + 12 * v.s);
    ctx.restore();
  }

  function drawHUD(S, M, v, hintT) {
    const s = v.s;
    ctx.textBaseline = 'alphabetic';
    // Money + health, top-left.
    panel(16 * s, 14 * s, 250 * s, 84 * s);
    ctx.fillStyle = '#58c96b';
    ctx.font = `bold ${30 * s}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${S.money.toLocaleString('en-US')}`, 30 * s, 46 * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${13 * s}px ${FONT}`;
    ctx.fillText(S.missionActive || M.index >= 0 ? MISSIONS[M.index]?.title.toUpperCase() || '' : 'FREE ROAM', 30 * s, 68 * s);
    const hpW = 222 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rr(ctx, 30 * s, 76 * s, hpW, 10 * s, 5);
    ctx.fill();
    ctx.fillStyle = S.player.hp > 30 ? PALETTE.health : PALETTE.healthLow;
    rr(ctx, 30 * s, 76 * s, hpW * Math.max(0, S.player.hp / PLAYER.health), 10 * s, 5);
    ctx.fill();
    // Wanted stars + minimap, top-right.
    drawStars(S, v);
    drawMinimap(S, M, v);
    // Objective, top-centre.
    const obj = missionObjective(S, M);
    const ow = 520 * s;
    panel((v.w - ow) / 2, 14 * s, ow, 64 * s);
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = `bold ${15 * s}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(obj.title, v.w / 2, 38 * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${15 * s}px ${FONT}`;
    const dist = obj.dist > 0 ? `  •  ${obj.dist}m` : '';
    ctx.fillText(obj.text + dist, v.w / 2, 60 * s);
    // Weapon + ammo, bottom-left.
    panel(16 * s, v.h - 64 * s, 220 * s, 48 * s);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${16 * s}px ${FONT}`;
    ctx.textAlign = 'left';
    const reloading = S.player.reloadT > 0;
    ctx.fillText(
      reloading ? 'RELOADING…' : `PISTOL   ${S.player.ammo} / ${S.player.reserve}`,
      30 * s, v.h - 34 * s,
    );
    // Controls hint, bottom-centre, fades.
    if (hintT > 0) {
      ctx.globalAlpha = Math.min(1, hintT);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const hint = S.player.onFoot
        ? 'WASD move  •  Mouse aim  •  Click shoot  •  E enter car  •  Shift sprint  •  R reload'
        : 'W/S drive  •  A/D steer  •  Space handbrake  •  E get out  •  P pause  •  M mute';
      ctx.font = `${14 * s}px ${FONT}`;
      const tw = ctx.measureText(hint).width;
      rr(ctx, (v.w - tw) / 2 - 14 * s, v.h - 40 * s, tw + 28 * s, 28 * s, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(hint, v.w / 2, v.h - 21 * s);
      ctx.globalAlpha = 1;
    }
    // Enter-to-start-next-job prompt in free roam.
    if (M.index < 0 && !M.done && S.screen === 'play') {
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = `bold ${15 * s}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`Press ENTER to start the next job: ${MISSIONS[S.missionIndex]?.title || ''}`, v.w / 2, v.h - 76 * s);
    }
    // Banner.
    if (S.banner && S.bannerT > 0) {
      const a = Math.min(1, S.bannerT);
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = `${44 * s}px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 6;
      ctx.strokeText(S.banner.title, v.w / 2, v.h * 0.32);
      ctx.fillText(S.banner.title, v.w / 2, v.h * 0.32);
      if (S.banner.sub) {
        ctx.fillStyle = '#fff';
        ctx.font = `${18 * s}px ${FONT}`;
        ctx.fillText(S.banner.sub, v.w / 2, v.h * 0.32 + 30 * s);
      }
      ctx.globalAlpha = 1;
    }
    // Low-health vignette.
    if (S.player.hp < 35 && S.screen === 'play') {
      const pulse = 0.25 + Math.sin(S.time * 5) * 0.1;
      const g = ctx.createRadialGradient(
        v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.35,
        v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7,
      );
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, v.w, v.h);
    }
  }

  // --- Screens -------------------------------------------------------------

  function dim(v, alpha) {
    ctx.fillStyle = `rgba(8, 10, 16, ${alpha})`;
    ctx.fillRect(0, 0, v.w, v.h);
  }

  function bigText(text, y, size, color, v) {
    ctx.font = `${size * v.s}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 8;
    ctx.strokeText(text, v.w / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, v.w / 2, y);
  }

  function line(text, y, size, color, v, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size * v.s}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, v.w / 2, y);
  }

  return {
    view,
    drawWorld(S, M, cam) {
      const v = view();
      ctx.clearRect(0, 0, v.w, v.h);
      if (!staticCanvas) staticCanvas = buildStatic(S);
      ctx.drawImage(staticCanvas, cam.x, cam.y, v.w, v.h, 0, 0, v.w, v.h);
      drawWaves(S, cam, v);
      // Pickups.
      for (const pk of S.pickups) {
        const x = pk.x - cam.x, y = pk.y - cam.y;
        const bob = Math.sin(S.time * 3 + pk.x) * 3;
        ctx.save();
        ctx.translate(x, y + bob);
        ctx.fillStyle = pk.kind === 'health' ? '#fff' : '#ffcf3d';
        rr(ctx, -13, -13, 26, 26, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (pk.kind === 'health') {
          ctx.fillStyle = '#e23b3b';
          ctx.fillRect(-3, -9, 6, 18);
          ctx.fillRect(-9, -3, 18, 6);
        } else {
          ctx.fillStyle = '#222';
          ctx.font = 'bold 13px ' + FONT;
          ctx.textAlign = 'center';
          ctx.fillText('AMMO', 0, 5);
        }
        ctx.restore();
      }
      drawMarker(S, M, cam, v);
      // Fare pedestrian.
      if (S.fare && S.fare.stage === 'pickup') {
        const x = S.fare.x - cam.x, y = S.fare.y - cam.y;
        ctx.fillStyle = '#58c96b';
        ctx.font = `bold ${22 * v.s}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('$', x, y - 22 + Math.sin(S.time * 4) * 4);
        drawPersonShape(S.fare.x, S.fare.y, 0, '#58c96b', cam, {});
      }
      // Pedestrians.
      for (const ped of S.peds) {
        drawPersonShape(ped.x, ped.y, ped.angle, ped.color, cam, {
          gun: ped.state === 'thug',
          down: ped.state === 'down',
        });
      }
      // Foot cops.
      for (const cop of S.cops) {
        drawPersonShape(cop.x, cop.y, cop.angle, '#233246', cam, { gun: true, cap: true });
      }
      // Cars (player's car last so it sits on top).
      const sorted = [...S.cars].sort((a, b) => (a.driver === 'player' ? 1 : 0) - (b.driver === 'player' ? 1 : 0));
      for (const car of sorted) drawCarShape(car, cam, car.driver === 'player');
      // The player on foot.
      if (S.player.onFoot) {
        const p = S.player;
        const blink = p.invulnT > 0 && Math.floor(S.time * 12) % 2 === 0;
        if (!blink) {
          drawPersonShape(p.x, p.y, p.angle, PALETTE.player, cam, { gun: true });
          // Aim line.
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(p.angle) * 26 - cam.x, p.y + Math.sin(p.angle) * 26 - cam.y);
          ctx.lineTo(p.x + Math.cos(p.angle) * 46 - cam.x, p.y + Math.sin(p.angle) * 46 - cam.y);
          ctx.stroke();
        }
      }
      // Bullets.
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      for (const b of S.bullets) {
        ctx.beginPath();
        ctx.moveTo(b.x - cam.x, b.y - cam.y);
        ctx.lineTo(b.x - b.vx * 0.02 - cam.x, b.y - b.vy * 0.02 - cam.y);
        ctx.stroke();
      }
      // Particles.
      for (const pt of S.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    drawHUD(S, M, hintT) {
      drawHUD(S, M, view(), hintT);
    },
    drawTitle(S, M, save) {
      const v = view();
      dim(v, 0.45);
      bigText('SOLARA HEAT', v.h * 0.24, 84, '#ffcf3d', v);
      line('An open-city story  •  Costa Solara', v.h * 0.24 + 44 * v.s, 20, '#fff', v);
      line('Steal cars. Outrun the law. Run the jobs. Own the city.', v.h * 0.24 + 74 * v.s, 16, PALETTE.muted, v);
      const y0 = v.h * 0.44;
      if (save) {
        line(`ENTER — Continue: Job ${Math.min(save.missionIndex + 1, 6)}/6  •  $${save.money.toLocaleString('en-US')}  •  ${save.missionsDone} job${save.missionsDone === 1 ? '' : 's'} done`, y0, 19, '#fff', v, true);
      } else {
        line('ENTER — Start the story', y0, 19, '#fff', v, true);
      }
      line('N — New game', y0 + 34 * v.s, 16, PALETTE.muted, v);
      line('WASD move / drive   •   Mouse aim, Click shoot   •   E enter car / work a spot', y0 + 84 * v.s, 15, '#d8d2c4', v);
      line('Shift sprint   •   Space handbrake   •   R reload   •   P pause   •   M mute', y0 + 110 * v.s, 15, '#d8d2c4', v);
      line('Progress saves automatically after every job. Free roam never ends — take fares,', y0 + 158 * v.s, 14, PALETTE.muted, v);
      line('steal a Cometa GT, and keep the Solara PD guessing.', y0 + 180 * v.s, 14, PALETTE.muted, v);
      void M; void S;
    },
    drawPause(S) {
      const v = view();
      dim(v, 0.6);
      bigText('PAUSED', v.h * 0.34, 64, '#fff', v);
      line('ENTER — Resume', v.h * 0.46, 18, '#fff', v, true);
      line('S — Save now', v.h * 0.46 + 32 * v.s, 16, PALETTE.muted, v);
      line('R — Restart current job', v.h * 0.46 + 58 * v.s, 16, PALETTE.muted, v);
      line('Q — Quit to title', v.h * 0.46 + 84 * v.s, 16, PALETTE.muted, v);
      line(`Cash $${S.money.toLocaleString('en-US')}   •   Jobs done ${S.missionsDone}/6`, v.h * 0.46 + 124 * v.s, 15, PALETTE.muted, v);
    },
    drawBusted(S, lost) {
      const v = view();
      dim(v, 0.55);
      bigText('BUSTED', v.h * 0.36, 72, '#7fb2ff', v);
      line('The Solara PD caught up with you.', v.h * 0.36 + 44 * v.s, 18, '#fff', v);
      line(`You lost $${lost.toLocaleString('en-US')} in fines.`, v.h * 0.36 + 74 * v.s, 16, PALETTE.muted, v);
      line('ENTER — Walk out of Solara General', v.h * 0.52, 18, '#fff', v, true);
      void S;
    },
    drawWasted(S, lost) {
      const v = view();
      dim(v, 0.55);
      bigText('WASTED', v.h * 0.36, 72, '#ff5346', v);
      line('Milo wakes up at Solara General, lighter in the pocket.', v.h * 0.36 + 44 * v.s, 18, '#fff', v);
      line(`You lost $${lost.toLocaleString('en-US')} in hospital bills.`, v.h * 0.36 + 74 * v.s, 16, PALETTE.muted, v);
      line('ENTER — Get back on your feet', v.h * 0.52, 18, '#fff', v, true);
      void S;
    },
    drawStoryComplete(S) {
      const v = view();
      dim(v, 0.5);
      bigText('CITY LEGEND', v.h * 0.34, 72, '#ffcf3d', v);
      line('Every job done. Vera owns the docks, Milo owns the streets,', v.h * 0.34 + 44 * v.s, 18, '#fff', v);
      line('and Costa Solara will never be the same.', v.h * 0.34 + 72 * v.s, 18, '#fff', v);
      line(`Final tally: $${S.money.toLocaleString('en-US')}  •  ${S.stats.kills} taken down  •  ${S.stats.carsStolen} cars borrowed`, v.h * 0.34 + 116 * v.s, 16, PALETTE.muted, v);
      line('ENTER — Keep playing in free roam', v.h * 0.52, 18, '#fff', v, true);
    },
  };
}
