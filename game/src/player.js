// The player on foot: walking, running, punching, shooting, and getting
// in and out of cars. The player object lives in the shared game state;
// this module steps it and resolves its collisions with buildings.

import { CAR, PLAYER, WORLD } from './config.js';
import { angleDiff, clamp, dist2 } from './random.js';

export function createPlayer(city, x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: PLAYER.maxHealth, onFoot: true, car: null,
    punchTimer: 0, shootTimer: 0, hurtTimer: 0,
    moving: false, running: false,
  };
}

/** Move the player one step on foot; returns true when a wall blocked the move. */
export function stepPlayerOnFoot(state, dt, axes, running) {
  const p = state.player;
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let dx = axes.steer;
  let dy = -axes.forward; // screen up is -y; forward key moves up on screen
  // Movement is relative to the camera, which is north-up, so axes map directly.
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  p.running = running && len > 0;
  if (len > 0) {
    dx /= len;
    dy /= len;
    p.angle = Math.atan2(dy, dx);
    const nx = p.x + dx * speed * dt;
    const ny = p.y + dy * speed * dt;
    if (!state.city.buildingAt(nx, p.y) && !state.city.inWater(nx, p.y) && nx > 20 && nx < WORLD.size - 20) p.x = nx;
    if (!state.city.buildingAt(p.x, ny) && !state.city.inWater(p.x, ny) && ny > 20 && ny < WORLD.size - 20) p.y = ny;
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
}

/** Punch: hurt the nearest pedestrian or enemy in front of the player. */
export function punch(state) {
  const p = state.player;
  if (!p.onFoot || p.punchTimer > 0) return false;
  p.punchTimer = PLAYER.punchCooldown;
  const reach = PLAYER.punchRange + PLAYER.radius;
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  let hit = null;
  let hitKind = '';
  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < reach && (ped.x - p.x) * fx + (ped.y - p.y) * fy > 0) { hit = ped; hitKind = 'ped'; break; }
  }
  if (!hit) {
    for (const e of state.enemies) {
      if (e.health <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < reach && (e.x - p.x) * fx + (e.y - p.y) * fy > 0) { hit = e; hitKind = 'enemy'; break; }
    }
  }
  if (!hit) return true; // swung at air
  hit.health -= PLAYER.punchDamage;
  hit.flee = 2.5;
  state.particles.push({ kind: 'hit', x: hit.x, y: hit.y, t: 0, life: 0.3 });
  if (hitKind === 'ped') {
    if (hit.health <= 0) state.addWanted(2, 'knocked out a pedestrian');
    else state.addWanted(1, 'assault');
  }
  return true;
}

/** Shoot toward a world point: spawn a bullet and raise the alarm. */
export function shoot(state, targetX, targetY) {
  const p = state.player;
  if (!p.onFoot || p.shootTimer > 0) return false;
  p.shootTimer = PLAYER.shootCooldown;
  const angle = Math.atan2(targetY - p.y, targetX - p.x);
  p.angle = angle;
  state.bullets.push({
    x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: 0.9, fromPlayer: true,
  });
  state.audio.shoot();
  state.addWanted(1, 'fired a shot');
  return true;
}

/** Find the nearest drivable car within enter range of the player. */
export function nearestCar(state, maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Enter a car (stealing it if it has a driver) or step out of one. */
export function enterExitCar(state) {
  const p = state.player;
  if (!p.onFoot && p.car) {
    const car = p.car;
    car.driver = null;
    p.car = null;
    p.onFoot = true;
    // Step out to the side of the car, clear of traffic — and try the other
    // side if the first would drop the player inside a building or the water.
    const side = Math.PI / 2;
    let ex = car.x + Math.cos(car.angle + side) * 34;
    let ey = car.y + Math.sin(car.angle + side) * 34;
    if (state.city.buildingAt(ex, ey) || state.city.inWater(ex, ey)) {
      ex = car.x + Math.cos(car.angle - side) * 34;
      ey = car.y + Math.sin(car.angle - side) * 34;
    }
    p.x = ex;
    p.y = ey;
    p.angle = car.angle;
    state.audio.door();
    return 'out';
  }
  const car = nearestCar(state, 70);
  if (!car) return 'none';
  if (car.driver && typeof car.driver === 'object') {
    // Yank the driver out: they flee, the car is yours, the law notices.
    car.driver.flee = 4;
    car.driver = null;
    state.addWanted(1, 'carjacked a driver');
    state.audio.carjack();
  } else if (car.driver) {
    // A traffic car with an abstract driver: take it, the law still notices.
    car.driver = null;
    state.addWanted(1, 'stole a car');
    state.audio.carjack();
  }
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  state.audio.door();
  return 'in';
}

/** Keep the player's position glued to the car they drive. */
export function syncPlayerToCar(state) {
  const p = state.player;
  if (p.car) {
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.speed = Math.abs(p.car.speed);
  }
}

export { CAR, clamp, angleDiff };
