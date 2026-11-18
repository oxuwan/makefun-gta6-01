// Pedestrians: ordinary Porto Verde residents who stroll the sidewalks,
// cross roads, flee from gunfire and carjackings, and sometimes flag down
// a ride. They give the city life — and the player something to lose
// wanted stars over.

import { PEDS, WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

const SHIRT_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c'];
const SKIN_COLORS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnPeds(state, rng) {
  state.peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const pt = state.city.randomWalkPoint();
    state.peds.push({
      x: pt.x, y: pt.y,
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, PEDS.walkSpeed * 0.7, PEDS.walkSpeed * 1.3),
      shirt: pick(rng, SHIRT_COLORS),
      skin: pick(rng, SKIN_COLORS),
      health: 100,
      flee: 0,
      wanderTimer: range(rng, 2, 6),
      inCar: false,
      bob: range(rng, 0, Math.PI * 2),
    });
  }
}

export function stepPeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.health <= 0 || ped.inCar) continue;
    ped.bob += dt * 8;
    // Flee from the player when they are violent or very close in a car,
    // and from a police car bearing down with its siren — residents scatter
    // when a chase comes through their street.
    const dPlayer = Math.hypot(ped.x - p.x, ped.y - p.y);
    const policeNear = state.police.some((c) => Math.hypot(ped.x - c.x, ped.y - c.y) < 130);
    const playerDanger = (!p.onFoot && Math.abs(p.car ? p.car.speed : 0) > 200 && dPlayer < 160)
      || (p.onFoot && p.punchTimer > 0.3 && dPlayer < 90)
      || policeNear
      || state.bullets.some((b) => b.fromPlayer && Math.hypot(b.x - ped.x, b.y - ped.y) < 120);
    if (playerDanger) ped.flee = Math.max(ped.flee, 1.5);
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * ped.speed * 2.1 * dt;
      ped.y += Math.sin(away) * ped.speed * 2.1 * dt;
    } else {
      ped.wanderTimer -= dt;
      if (ped.wanderTimer <= 0) {
        ped.wanderTimer = range(state.rng, 2, 7);
        ped.angle = range(state.rng, 0, Math.PI * 2);
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!state.city.buildingAt(nx, ny) && !state.city.inWater(nx, ny)
        && nx > 20 && nx < WORLD.size - 20 && ny > 20 && ny < WORLD.size - 20) {
        ped.x = nx;
        ped.y = ny;
      } else {
        ped.angle += Math.PI / 2;
      }
    }
    // The dead stay down for a while, then the city quietly replaces them
    // (their timer ticks in the replacement loop below).
  }
  // Replace long-dead pedestrians so the streets never empty out.
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.health <= 0) {
      ped.deadTimer = (ped.deadTimer ?? 0) + dt;
      if (ped.deadTimer <= 25) continue;
      const pt = state.city.randomWalkPoint();
      ped.x = pt.x; ped.y = pt.y;
      ped.health = 100;
      ped.deadTimer = 0;
      ped.flee = 0;
    }
  }
}

export { rangeInt };
