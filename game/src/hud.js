// The HUD: wanted stars, health, cash, clock, speed, mission objective,
// message banner and the minimap. All drawn on the main canvas in screen
// space, after the world is painted.

import { FONT, PALETTE, WORLD } from './config.js';
import { objectiveText, missionMarker } from './missions.js';

export function drawHud(ctx, state, view, screen) {
  const w = view.width;
  const h = view.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textBaseline = 'alphabetic';

  // Top-left: wanted stars + health bar + cash.
  const pad = 16;
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', pad + i * 30, pad + 26);
  }
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(pad, pad + 38, 170, 16);
  ctx.fillStyle = state.player.health > 30 ? '#37c978' : '#e5484d';
  ctx.fillRect(pad + 2, pad + 40, 166 * Math.max(0, state.player.health / 100), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(`HP ${Math.max(0, Math.ceil(state.player.health))}`, pad + 178, pad + 52);
  // Cash.
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, pad, pad + 88);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(state.missions.done ? 'All jobs complete' : `Job ${Math.min(state.missions.index + 1, 5)} of 5`, pad, pad + 110);

  // Top-right: frame rate, so a slow machine can see the cost of the city.
  // Shown only once the loop has measured it — staged screenshot scenes
  // never run the loop, so a "0 FPS" there would read as a broken game.
  if (state.fps > 0) {
    ctx.textAlign = 'right';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = state.fps >= 50 ? '#7dff8a' : state.fps >= 30 ? '#ffd23e' : '#e5484d';
    ctx.fillText(`${state.fps} FPS`, w - pad, pad + 24);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText('Tab — zoom map', w - pad, pad + 44);

  // Top-centre: clock + objective.
  const hours = Math.floor(state.clockMinutes / 60) % 24;
  const mins = Math.floor(state.clockMinutes % 60);
  const clock = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  ctx.textAlign = 'center';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${clock}  ·  Porto Verde`, w / 2, pad + 24);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(objectiveText(state), w / 2, pad + 48);
  // Mission clock: how long the current job has been running.
  if (state.missions.active) {
    const t = Math.max(0, Math.floor(state.elapsed - state.missions.startedAt));
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, w / 2, pad + 68);
  }

  // Message banner.
  if (state.missions.messageTimer > 0 && state.missions.message) {
    ctx.font = `16px ${FONT}`;
    const msg = state.missions.message;
    const tw = ctx.measureText(msg).width + 28;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect((w - tw) / 2, 86, tw, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(msg, w / 2, 109);
  }

  // Bottom-left: speed when driving, controls hint on foot.
  ctx.textAlign = 'left';
  if (!state.player.onFoot && state.player.car) {
    const kmh = Math.round(Math.abs(state.player.car.speed) * 0.36);
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${kmh}`, pad, h - 44);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('km/h  ·  E exit  ·  Space handbrake  ·  H horn', pad, h - 20);
  } else {
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('WASD move · Shift run · E enter car · F punch · Click / G shoot · Q job · P pause', pad, h - 20);
  }

  drawMinimap(ctx, state, w, h);
  ctx.restore();
}

function drawMinimap(ctx, state, w, h) {
  // Tab toggles a big map: same drawing, larger frame, for reading the
  // city at a glance while planning a route.
  const size = state.minimapZoom ? 320 : 190;
  const x0 = w - size - 16;
  const y0 = h - size - 16;
  const scale = size / WORLD.size;
  ctx.fillStyle = PALETTE.minimapBg;
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Water + land.
  ctx.fillStyle = '#274b3f';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(x0 + state.city.water.x * scale, y0, (WORLD.size - state.city.water.x) * scale, size);
  // Roads.
  ctx.strokeStyle = '#5a5f68';
  ctx.lineWidth = 2;
  for (const line of state.city.lines) {
    ctx.beginPath();
    ctx.moveTo(x0 + line * scale, y0);
    ctx.lineTo(x0 + line * scale, y0 + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + line * scale);
    ctx.lineTo(x0 + size, y0 + line * scale);
    ctx.stroke();
  }
  // Buildings as faint blocks.
  ctx.fillStyle = 'rgba(200,190,160,0.5)';
  for (const b of state.city.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // Mission marker.
  const marker = missionMarker(state);
  if (marker) {
    const mx = x0 + marker.x * scale;
    const my = y0 + marker.y * scale;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(mx, my, 9 + 2 * Math.sin(state.elapsed * 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Cars (white), police (blue/red), player (green arrow).
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const car of state.cars) {
    if (car.police) continue;
    ctx.fillRect(x0 + car.x * scale - 1.5, y0 + car.y * scale - 1.5, 3, 3);
  }
  for (const car of state.police) {
    ctx.fillStyle = '#4d9fff';
    ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
  }
  const px = x0 + state.player.x * scale;
  const py = y0 + state.player.y * scale;
  ctx.fillStyle = '#37ff7a';
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#37ff7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
}
