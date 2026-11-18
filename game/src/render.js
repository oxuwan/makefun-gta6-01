// Drawing only: the city, the actors and the screens, pixels out. The
// camera follows the player; a warm day/sunset tint follows the clock.
// Panels carry the title, story, controls, pause and game-over screens.

import { CAR, FONT, PALETTE, WORLD } from './config.js';
import { missionMarker } from './missions.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function daylightTint(minutes) {
  // Morning gold -> midday bright -> sunset orange -> night blue.
  const h = (minutes / 60) % 24;
  if (h < 8) return 'rgba(70, 90, 140, 0.18)';
  if (h < 17) return 'rgba(255, 240, 200, 0.05)';
  if (h < 19.5) return 'rgba(255, 140, 60, 0.16)';
  return 'rgba(20, 30, 80, 0.28)';
}

/** True once the sun is down (or not yet up) — headlights on. */
function isNight(minutes) {
  const h = (minutes / 60) % 24;
  return h >= 19.5 || h < 8;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 1280, height: 800, scale: 1, camX: 0, camY: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);
    canvas.style.width = `${view.width}px`;
    canvas.style.height = `${view.height}px`;
    view.scale = Math.min(view.width / 1150, view.height / 820);
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}|${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  function worldToScreen(x, y) {
    return {
      x: (x - view.camX) * view.scale + view.width / 2,
      y: (y - view.camY) * view.scale + view.height / 2,
    };
  }

  function drawCity(state) {
    const city = state.city;
    const s = view.scale;
    // Ground: grass everywhere, then water, roads, sidewalks, blocks.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, view.width, view.height);
    const w0 = worldToScreen(city.water.x, 0);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(w0.x, 0, view.width - w0.x, view.height);
    // Sand along the harbour.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(w0.x - 18 * s, 0, 18 * s, view.height);
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const line of city.lines) {
      const v = worldToScreen(line, 0);
      ctx.fillRect(v.x - (WORLD.roadWidth / 2) * s, 0, WORLD.roadWidth * s, view.height);
      const h = worldToScreen(0, line);
      ctx.fillRect(0, h.y - (WORLD.roadWidth / 2) * s, view.width, WORLD.roadWidth * s);
    }
    // Lane dashes.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = Math.max(1, 3 * s);
    ctx.setLineDash([18 * s, 22 * s]);
    for (const line of city.lines) {
      const v = worldToScreen(line, 0);
      ctx.beginPath();
      ctx.moveTo(v.x, 0);
      ctx.lineTo(v.x, view.height);
      ctx.stroke();
      const h = worldToScreen(0, line);
      ctx.beginPath();
      ctx.moveTo(0, h.y);
      ctx.lineTo(view.width, h.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Blocks: sidewalk, then parks/plazas/buildings.
    for (const block of city.blocks) {
      const p = worldToScreen(block.x, block.y);
      const bw = block.w * s;
      const bh = block.h * s;
      if (p.x > view.width || p.y > view.height || p.x + bw < 0 || p.y + bh < 0) continue;
      if (block.kind === 'park') {
        ctx.fillStyle = PALETTE.park;
        ctx.fillRect(p.x, p.y, bw, bh);
        for (const t of block.trees) drawTree(t.x, t.y, t.r);
      } else if (block.kind === 'plaza') {
        ctx.fillStyle = '#b8a888';
        ctx.fillRect(p.x, p.y, bw, bh);
        ctx.fillStyle = '#7fb2c9';
        ctx.beginPath();
        ctx.arc(p.x + bw / 2, p.y + bh / 2, 22 * s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(p.x, p.y, bw, bh);
        for (const b of block.buildings) {
          const bp = worldToScreen(b.x, b.y);
          ctx.fillStyle = b.wall;
          ctx.fillRect(bp.x, bp.y, b.w * s, b.h * s);
          ctx.fillStyle = b.roof;
          ctx.fillRect(bp.x + 4 * s, bp.y + 4 * s, b.w * s - 8 * s, b.h * s - 8 * s);
          // Windows: small lighter squares on the roof face.
          ctx.fillStyle = 'rgba(255, 244, 200, 0.75)';
          const cols = Math.max(1, Math.floor(b.w / 46));
          const rows = Math.max(1, Math.floor(b.h / 46));
          for (let cx = 0; cx < cols; cx += 1) {
            for (let cy = 0; cy < rows; cy += 1) {
              ctx.fillRect(bp.x + (10 + cx * 40) * s, bp.y + (10 + cy * 40) * s, 12 * s, 12 * s);
            }
          }
        }
      }
    }
  }

  function drawTree(x, y, r) {
    const p = worldToScreen(x, y);
    const s = view.scale;
    ctx.fillStyle = '#3d6b2f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5da244';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.25 * s, p.y - r * 0.25 * s, r * 0.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCar(car) {
    const p = worldToScreen(car.x, car.y);
    const s = view.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    const L = CAR.length * s;
    const W = CAR.width * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-L / 2 + 3 * s, -W / 2 + 4 * s, L, W);
    ctx.fillStyle = car.police ? '#20262e' : car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 7 * s);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-L * 0.1, -W / 2, L * 0.2, W);
      // Flashing light bar.
      const flash = Math.floor(state_time() * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2f6fd0';
      ctx.fillRect(-6 * s, -W / 2 - 2 * s, 12 * s, 5 * s);
      ctx.fillStyle = flash ? '#2f6fd0' : '#ff2d2d';
      ctx.fillRect(-6 * s, W / 2 - 3 * s, 12 * s, 5 * s);
    }
    // Windshield + rear window.
    ctx.fillStyle = 'rgba(180, 220, 235, 0.85)';
    ctx.fillRect(L * 0.18, -W / 2 + 3 * s, L * 0.16, W - 6 * s);
    ctx.fillRect(-L * 0.36, -W / 2 + 3 * s, L * 0.12, W - 6 * s);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(L / 2 - 2 * s, -W / 2 + 2 * s, 3 * s, 5 * s);
    ctx.fillRect(L / 2 - 2 * s, W / 2 - 7 * s, 3 * s, 5 * s);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(-L / 2 - 1 * s, -W / 2 + 2 * s, 3 * s, 5 * s);
      ctx.fillRect(-L / 2 - 1 * s, W / 2 - 7 * s, 3 * s, 5 * s);
    }
    ctx.restore();
  }

  function drawHeadlights(state) {
    const car = state.player.car;
    const p = worldToScreen(car.x, car.y);
    const s = view.scale;
    const reach = 260 * s;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    const grad = ctx.createLinearGradient(0, 0, reach, 0);
    grad.addColorStop(0, 'rgba(255, 248, 192, 0.20)');
    grad.addColorStop(1, 'rgba(255, 248, 192, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -8 * s);
    ctx.lineTo(reach, -70 * s);
    ctx.lineTo(reach, 70 * s);
    ctx.lineTo(0, 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Set once per frame so the police light bar can flash.
  let nowSeconds = 0;
  function state_time() { return nowSeconds; }

  function drawPerson(x, y, angle, shirt, skin, bob, scaleMul) {
    const p = worldToScreen(x, y);
    const s = view.scale * (scaleMul || 1);
    const bounce = Math.sin(bob) * 1.5 * s;
    ctx.save();
    ctx.translate(p.x, p.y + bounce);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(7 * s, 0, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(9 * s, 0, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWorld(state) {
    drawCity(state);
    const s = view.scale;
    // Mission marker: pulsing beacon + ring on the ground.
    const marker = missionMarker(state);
    if (marker) {
      const p = worldToScreen(marker.x, marker.y);
      const pulse = 1 + 0.18 * Math.sin(state.elapsed * 4);
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 40 * s * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 210, 62, 0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      // A light pillar so the marker reads from far away.
      const grad = ctx.createLinearGradient(p.x, p.y - 180 * s, p.x, p.y);
      grad.addColorStop(0, 'rgba(255, 210, 62, 0)');
      grad.addColorStop(1, 'rgba(255, 210, 62, 0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - 10 * s, p.y - 180 * s, 20 * s, 180 * s);
    }
    // Pickups (cash drops).
    for (const pk of state.pickups) {
      const p = worldToScreen(pk.x, pk.y);
      ctx.fillStyle = '#7dff8a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0e5c1a';
      ctx.font = `bold ${Math.round(13 * s)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + 5 * s);
    }
    // Parked + traffic + police cars, then people, then bullets and particles.
    for (const car of state.cars) drawCar(car);
    // At night the player's headlights throw a cone of light ahead.
    if (state.player.car && isNight(state.clockMinutes)) drawHeadlights(state);
    for (const ped of state.peds) {
      if (ped.health <= 0 || ped.inCar) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.bob, 1);
    }
    for (const e of state.enemies) {
      if (e.health <= 0) continue;
      drawPerson(e.x, e.y, e.angle, e.shirt, e.skin, 0, 1.1);
      // Health bar above enemies.
      const p = worldToScreen(e.x, e.y);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - 16 * s, p.y - 24 * s, 32 * s, 5 * s);
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(p.x - 15 * s, p.y - 23 * s, 30 * s * (e.health / 100), 3 * s);
    }
    // The player (on foot only — in a car the car is the player).
    const pl = state.player;
    if (pl.onFoot) {
      const blink = pl.hurtTimer > 0 && Math.floor(pl.hurtTimer * 12) % 2 === 0;
      if (!blink) drawPerson(pl.x, pl.y, pl.angle, '#ffcf3f', '#f1c27d', pl.moving ? state.elapsed * 10 : 0, 1.05);
      // Facing tick.
      const p = worldToScreen(pl.x, pl.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(pl.angle) * 20 * s, p.y + Math.sin(pl.angle) * 20 * s);
      ctx.stroke();
    }
    // Bullets.
    ctx.fillStyle = '#ffe66d';
    for (const b of state.bullets) {
      const p = worldToScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles.
    for (const pt of state.particles) {
      const p = worldToScreen(pt.x, pt.y);
      const age = pt.t / pt.life;
      if (pt.kind === 'spark') {
        ctx.fillStyle = `rgba(255, 220, 80, ${1 - age})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * s * (1 - age * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'hit') {
        ctx.fillStyle = `rgba(229, 72, 77, ${1 - age})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 * s * (1 - age * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'cash') {
        ctx.fillStyle = `rgba(125, 255, 138, ${1 - age})`;
        ctx.font = `bold ${Math.round(22 * s)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('+$', p.x, p.y - age * 40 * s);
      }
    }
    // Day/sunset tint over everything.
    ctx.fillStyle = daylightTint(state.clockMinutes);
    ctx.fillRect(0, 0, view.width, view.height);
    drawOffscreenArrow(state);
  }

  function drawOffscreenArrow(state) {
    const marker = missionMarker(state);
    if (!marker) return;
    const p = worldToScreen(marker.x, marker.y);
    const margin = 60;
    if (p.x > margin && p.x < view.width - margin && p.y > margin && p.y < view.height - margin) return;
    const cx = Math.max(margin, Math.min(view.width - margin, p.x));
    const cy = Math.max(margin, Math.min(view.height - 120, p.y));
    const angle = Math.atan2(p.y - cy, p.x - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const d = Math.round(Math.hypot(marker.x - state.player.x, marker.y - state.player.y));
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(`${d}m`, cx, cy - 26);
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = Math.min(680, view.width - 40);
    const lineH = 26;
    const height = 120 + lines.length * lineH + 64;
    const x = (view.width - w) / 2;
    const y = (view.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, height, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(title, view.width / 2, y + 58, 40, PALETTE.text, 'center', true);
    lines.forEach((line, i) => {
      text(line, view.width / 2, y + 108 + i * lineH, 17, PALETTE.muted, 'center', false);
    });
    text(prompt, view.width / 2, y + height - 26, 20, accent || PALETTE.accent, 'center', true);
  }

  function draw(state, screen, best) {
    nowSeconds = state.elapsed;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Camera: follow the player (title screen drifts over the city).
    if (screen === SCREEN_TITLE) {
      view.camX = WORLD.size / 2 + Math.sin(state.elapsed * 0.05) * 500;
      view.camY = WORLD.size / 2 + Math.cos(state.elapsed * 0.04) * 400;
    } else {
      view.camX = state.player.x;
      view.camY = state.player.y;
    }
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      // The story intro is wrapped by hand: one long line overflows the
      // 680 px panel, so it is split into three short centred lines.
      const lines = [
        'Rico Alvarez drove getaway cars for the Marisol crew — until a job',
        'went wrong and the crew left him holding the bag. Now he drives',
        'for anyone who pays, while Detective Maren Voss closes in.',
        '',
        'WASD / arrows — move & drive   ·   Shift — run   ·   Space — handbrake',
        'E — steal / exit car   ·   F — punch   ·   Click or G — shoot   ·   Q — take a job',
        'H — horn   ·   Tab — zoom the minimap   ·   P — pause (R restarts the job)',
        'M — mute   ·   Progress saves automatically',
        '',
        best > 0 ? `Best cash earned: $${best.toLocaleString('en-US')}` : 'A sun-soaked city, five jobs, and the whole police force.',
      ];
      drawPanel('PORTO VERDE', lines, 'Press Enter or click to start', PALETTE.accent);
      return;
    }
    drawHud(ctx, state, view, screen);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Take a breath, Rico. The city waits.', '', `Cash $${state.cash.toLocaleString('en-US')}  ·  Jobs done ${state.missions.index} of 5`, 'R — restart the current job from the beginning'], 'Press P to resume', PALETTE.accent);
    } else if (screen === SCREEN_OVER) {
      const lines = [
        state.busted ? 'Detective Voss finally caught up with you.' : 'Porto Verde is not kind to the careless.',
        '',
        `Cash earned: $${state.cash.toLocaleString('en-US')}   ·   Jobs finished: ${state.missions.index} of 5`,
        `Best cash: $${Math.max(best, state.cash).toLocaleString('en-US')}`,
      ];
      drawPanel(state.busted ? 'BUSTED' : 'WASTED', lines, 'Press Enter to start over', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
