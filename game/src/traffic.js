// Traffic: civilian cars that cruise the road lattice, slow for the car
// ahead, and pick a new direction at each intersection. They are the
// city's moving furniture — and the cars the player steals.

import { TRAFFIC, WORLD } from './config.js';
import { makeCar } from './vehicles.js';
import { chance, clamp, pick, range } from './random.js';

const DIRECTIONS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function spawnTraffic(state, rng) {
  state.traffic = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const pt = state.city.randomRoadPoint();
    const angle = pick(rng, DIRECTIONS);
    const car = makeCar(rng, pt.x, pt.y, angle, { driver: 'civilian', traffic: true });
    car.speed = range(rng, TRAFFIC.speed - TRAFFIC.speedJitter, TRAFFIC.speed + TRAFFIC.speedJitter);
    car.cruise = car.speed;
    car.lane = (rng() < 0.5 ? -1 : 1) * 22;
    state.traffic.push(car);
    state.cars.push(car);
  }
}

/** Is the road ahead of this car clear for `dist` units? */
function roadClear(state, car, dist) {
  const ax = car.x + Math.cos(car.angle) * dist;
  const ay = car.y + Math.sin(car.angle) * dist;
  for (const other of state.cars) {
    if (other === car) continue;
    if (Math.hypot(other.x - ax, other.y - ay) < 42) return false;
  }
  const p = state.player;
  if (p.onFoot && Math.hypot(p.x - ax, p.y - ay) < 30) return false;
  return true;
}

export function stepTraffic(state, dt) {
  for (const car of state.traffic) {
    if (car.driver !== 'civilian') continue; // stolen: the player owns it now
    // Keep to the right-hand lane of the road we are on.
    const laneX = car.x + Math.cos(car.angle + Math.PI / 2) * car.lane * 0.15;
    const laneY = car.y + Math.sin(car.angle + Math.PI / 2) * car.lane * 0.15;
    car.x += (laneX - car.x) * 0.4 * dt * 10 * 0.1;
    car.y += (laneY - car.y) * 0.4 * dt * 10 * 0.1;
    // Slow for traffic ahead, stop for a pedestrian in the way.
    const target = roadClear(state, car, 70) ? car.cruise : 0;
    car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection (near both a vertical and a horizontal road),
    // sometimes turn. A car that leaves the road lattice is put back on it.
    const nearV = state.city.lines.some((l) => Math.abs(car.x - l) < 14);
    const nearH = state.city.lines.some((l) => Math.abs(car.y - l) < 14);
    if (nearV && nearH && chance(state.rng, dt * 0.5)) {
      // Turn left, right or straight on — never a U-turn, which looked
      // like the car had lost its mind in traffic.
      const opposite = (car.angle + Math.PI) % (Math.PI * 2);
      const choices = DIRECTIONS.filter((d) => Math.abs(((d - opposite) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) > 0.5);
      car.angle = pick(state.rng, choices.length ? choices : DIRECTIONS);
      const snap = state.city.nearestRoadPoint(car.x, car.y);
      car.x = snap.x;
      car.y = snap.y;
    }
    if (car.x < 40 || car.x > WORLD.size - 40 || car.y < 40 || car.y > WORLD.size - 40) {
      const pt = state.city.randomRoadPoint();
      car.x = pt.x;
      car.y = pt.y;
      car.angle = pick(state.rng, DIRECTIONS);
    }
  }
}
