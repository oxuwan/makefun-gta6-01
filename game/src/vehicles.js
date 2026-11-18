// Cars: creation, arcade driving physics, collisions with buildings and
// other cars, and the traffic/pedestrian damage they cause. A car is a
// small state object; the player's car is just one of them.

import { CAR, WORLD } from './config.js';
import { clamp, pick, range } from './random.js';

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e8e4da',
  '#2c3e50', '#e67e22', '#16a085', '#b03a5b', '#7f8c8d', '#d4ac0d',
];

export const CAR_NAMES = [
  'Comet', 'Vagabond', 'Sunrise', 'Falcon', 'Mule', 'Panther',
  'Dune', 'Marlin', 'Cobra', 'Heron', 'Bison', 'Zephyr',
];

export function makeCar(rng, x, y, angle, opts = {}) {
  return {
    x, y, angle,
    speed: 0,
    color: opts.color || pick(rng, CAR_COLORS),
    name: opts.name || pick(rng, CAR_NAMES),
    police: !!opts.police,
    driver: opts.driver || null, // 'player', a pedestrian object, or null (parked)
    traffic: !!opts.traffic,
    wrecked: false,
    brakeLight: false,
    ramTimer: 0,
    stuckTimer: 0,
  };
}

/** Spawn a parked car beside a road. */
export function spawnParkedCar(state, rng) {
  const pt = state.city.randomRoadPoint();
  const angle = (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() < 0.5 ? 0 : Math.PI);
  const off = (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 - 14);
  const x = pt.x + (angle % Math.PI === 0 ? 0 : off);
  const y = pt.y + (angle % Math.PI === 0 ? off : 0);
  const car = makeCar(rng, x, y, angle, { driver: null });
  state.cars.push(car);
  return car;
}

/** One driving step for a car driven by the player (arcade bicycle-ish model). */
export function driveCar(car, dt, axes, handbrake) {
  const forwardSpeed = car.speed;
  const steerInput = axes.steer;
  // Steering authority grows with speed but vanishes when stopped.
  const steerAuthority = clamp(Math.abs(forwardSpeed) / 120, 0, 1);
  const turnRate = (handbrake ? CAR.handbrakeTurn : CAR.turnRate) * steerAuthority;
  car.angle += steerInput * turnRate * dt * (forwardSpeed >= 0 ? 1 : -1);
  if (axes.forward > 0) car.speed += CAR.accel * dt;
  else if (axes.forward < 0) {
    car.speed -= (forwardSpeed > 20 ? CAR.brake : CAR.reverseAccel) * dt;
  } else {
    // Rolling resistance and drag.
    car.speed -= car.speed * 0.9 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  car.brakeLight = axes.forward < 0 || handbrake;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (car.ramTimer > 0) car.ramTimer -= dt;
  return car;
}

/** Push a car out of buildings and the world edge; returns true on a hit. */
export function collideCarWithWorld(state, car) {
  let hit = false;
  const halfL = CAR.length / 2;
  const halfW = CAR.width / 2;
  // Test the four corners against buildings.
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  for (const [lx, ly] of [[halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW]]) {
    const wx = car.x + lx * cos - ly * sin;
    const wy = car.y + lx * sin + ly * cos;
    if (state.city.buildingAt(wx, wy) || state.city.inWater(wx, wy)) { hit = true; break; }
  }
  if (hit) {
    // Back off along the direction of travel and kill most of the speed.
    car.x -= Math.cos(car.angle) * car.speed * 0.03;
    car.y -= Math.sin(car.angle) * car.speed * 0.03;
    const impactSpeed = Math.abs(car.speed);
    car.speed *= -0.25;
    if (impactSpeed > 120 && car.driver === 'player') {
      state.damagePlayer(2, 'crashed the car');
      state.audio.crash();
      state.particles.push({ kind: 'spark', x: car.x, y: car.y, t: 0, life: 0.4 });
    }
  }
  car.x = clamp(car.x, 30, WORLD.size - 30);
  car.y = clamp(car.y, 30, WORLD.size - 30);
  return hit;
}

/** Simple circle-ish car-vs-car push-apart, with damage when the player is involved. */
export function collideCars(state, dt) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d === 0 || d >= min) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      const aPlayer = a.driver === 'player';
      const bPlayer = b.driver === 'player';
      if (!a.traffic || aPlayer) { a.x -= nx * push; a.y -= ny * push; }
      if (!b.traffic || bPlayer) { b.x += nx * push; b.y += ny * push; }
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 140) {
        a.speed *= 0.6;
        b.speed *= 0.6;
        if ((aPlayer || bPlayer) && impact > 240) {
          state.damagePlayer(4, 'collided with another car');
          state.audio.crash();
        }
        if ((a.police && bPlayer) || (b.police && aPlayer)) {
          state.addWanted(1, 'rammed a police car');
        }
        state.particles.push({ kind: 'spark', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, life: 0.35 });
      }
    }
  }
}

/** Run a car over pedestrians standing in its path. */
export function carHitsPeds(state, car) {
  if (Math.abs(car.speed) < 60) return;
  for (const ped of state.peds) {
    if (ped.health <= 0 || ped.inCar) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30) {
      ped.health = 0;
      ped.flee = 0;
      state.particles.push({ kind: 'hit', x: ped.x, y: ped.y, t: 0, life: 0.4 });
      if (car.driver === 'player') state.addWanted(2, 'ran over a pedestrian');
    }
  }
}

export { range };
