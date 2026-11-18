// The Porto Verde police: patrol cars that spawn when the wanted level
// rises, chase the player, ram them, and set roadblocks at high wanted
// levels. Lose them by breaking line of sight and staying clear, and the
// wanted level falls star by star.

import { POLICE, WANTED, WORLD } from './config.js';
import { angleDiff, clamp, pick } from './random.js';
import { makeCar } from './vehicles.js';

export function stepPolice(state, dt) {
  const wanted = state.wanted;
  const target = POLICE.unitsForStars[Math.min(wanted, WANTED.max)] || 0;
  // Spawn up to the target number, at road points near the player.
  let active = state.police.filter((c) => !c.wrecked).length;
  while (active < target) {
    const angle = state.rng() * Math.PI * 2;
    const dist = 700 + state.rng() * 300;
    let x = state.player.x + Math.cos(angle) * dist;
    let y = state.player.y + Math.sin(angle) * dist;
    x = clamp(x, 60, WORLD.size - 60);
    y = clamp(y, 60, WORLD.size - 60);
    const snap = state.city.nearestRoadPoint(x, y);
    const car = makeCar(state.rng, snap.x, snap.y, 0, { police: true, driver: 'police', color: '#1c2733' });
    car.speed = 200;
    car.siren = 0;
    state.police.push(car);
    state.cars.push(car);
    active += 1;
  }
  // Despawn extras when the heat dies down.
  if (active > target) {
    for (const car of state.police) {
      if (active <= target) break;
      if (Math.hypot(car.x - state.player.x, car.y - state.player.y) > 900) {
        car.wrecked = true;
        const at = state.cars.indexOf(car);
        if (at !== -1) state.cars.splice(at, 1);
        active -= 1;
      }
    }
  }
  state.police = state.police.filter((c) => !c.wrecked);

  const p = state.player;
  let nearest = Infinity;
  for (const car of state.police) {
    car.siren += dt;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    nearest = Math.min(nearest, d);
    const wantAngle = Math.atan2(dy, dx);
    const diff = angleDiff(car.angle, wantAngle);
    // Steer toward the player, harder the closer they are.
    car.angle += clamp(diff, -2.8 * dt, 2.8 * dt);
    const desired = d > 260 ? POLICE.maxSpeed : POLICE.maxSpeed * 0.75;
    car.speed += clamp(desired - car.speed, -500 * dt, POLICE.accel * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram: damage the player when the police car touches them.
    if (d < 46 && car.ramTimer <= 0) {
      car.ramTimer = POLICE.ramCooldown;
      car.speed *= 0.45;
      if (p.onFoot) {
        state.damagePlayer(POLICE.ramDamage, 'hit by a police car');
        // Knock the player flying a little — but never into a wall or the
        // harbour, where the shove used to trap them.
        const nx = p.x + Math.cos(car.angle) * 26;
        const ny = p.y + Math.sin(car.angle) * 26;
        if (!state.city.buildingAt(nx, ny) && !state.city.inWater(nx, ny)) {
          p.x = clamp(nx, 20, WORLD.size - 20);
          p.y = clamp(ny, 20, WORLD.size - 20);
        }
      } else if (p.car) {
        state.damagePlayer(POLICE.ramDamage, 'rammed by the police');
        p.car.speed *= 0.6;
      }
      state.audio.crash();
      state.particles.push({ kind: 'spark', x: car.x, y: car.y, t: 0, life: 0.3 });
    }
    if (car.ramTimer > 0) car.ramTimer -= dt;
    // Police cars also collide with the world.
    if (state.city.buildingAt(car.x, car.y)) {
      car.speed *= -0.3;
      car.x -= Math.cos(car.angle) * 20;
      car.y -= Math.sin(car.angle) * 20;
    }
  }

  // Evade: no police car near for a while and the stars start to fall.
  if (wanted > 0) {
    if (nearest > 520) {
      state.evadeTimer += dt;
      if (state.evadeTimer > POLICE.evadeSeconds) {
        state.wantedFloat = Math.max(0, state.wantedFloat - WANTED.decayPerSecond * 10 * dt);
        state.wanted = Math.ceil(state.wantedFloat);
        if (state.wanted === 0) state.evadeTimer = 0;
      }
    } else {
      state.evadeTimer = 0;
    }
  }
  state.nearestPolice = nearest;
}

export { pick };
