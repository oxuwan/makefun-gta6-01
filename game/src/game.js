// The simulation: one shared game state and the fixed-step update that
// advances it — player, cars, traffic, pedestrians, police, missions,
// bullets, pickups and the clock. No drawing and no DOM here except the
// save/load helpers, so the same step runs the live game, the screenshot
// scenes and the self-test.

import { CAR, PLAYER, SAVE_KEY, STEP, WORLD } from './config.js';
import { createRandom, clamp } from './random.js';
import { createCity } from './city.js';
import { createPlayer, stepPlayerOnFoot, syncPlayerToCar } from './player.js';
import { driveCar, collideCarWithWorld, collideCars, carHitsPeds, spawnParkedCar } from './vehicles.js';
import { spawnTraffic, stepTraffic } from './traffic.js';
import { spawnPeds, stepPeds } from './pedestrians.js';
import { stepPolice } from './police.js';
import { createMissions, stepMissions, stepEnemies, restartMission } from './missions.js';
import { createAudio } from './audio.js';

export function createGameState(seed, audio) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const state = {
    rng, city, audio: audio || createAudio(),
    seed,
    elapsed: 0,
    clockMinutes: 8 * 60 + 15, // a bright Porto Verde morning
    cash: 250,
    wanted: 0,
    wantedFloat: 0,
    evadeTimer: 0,
    nearestPolice: Infinity,
    dead: false,
    busted: false,
    saveTimer: 0,
    sirenTimer: 0,
    pickupTimer: 0,
    minimapZoom: false, // Tab toggles the big minimap
    fps: 0,             // filled in by the loop in main.js, shown by the HUD
    cars: [],
    traffic: [],
    peds: [],
    police: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
  };
  state.player = createPlayer(city, WORLD.roadSpacing, WORLD.roadSpacing + 40);
  state.missions = createMissions(state);
  // A few parked cars near the spawn, plus traffic and pedestrians.
  for (let i = 0; i < 10; i += 1) spawnParkedCar(state, rng);
  spawnTraffic(state, rng);
  spawnPeds(state, rng);
  // Cash pickups scattered around the city.
  for (let i = 0; i < 8; i += 1) {
    const pt = city.randomWalkPoint();
    state.pickups.push({ x: pt.x, y: pt.y, amount: 50, t: 0 });
  }
  // Plain functions (not arrows) so `this` is the state object they are
  // called on: startGame() copies a fresh state into the live one with
  // Object.assign, and a closure over the fresh object would write there.
  state.addWanted = function (n, reason) {
    this.wantedFloat = clamp(this.wantedFloat + n, 0, 5);
    this.wanted = Math.ceil(this.wantedFloat);
    if (reason) this.lastCrime = reason;
  };
  state.damagePlayer = function (amount, reason) {
    if (this.dead) return;
    this.player.health -= amount;
    this.player.hurtTimer = 0.8;
    if (reason) this.lastHurt = reason;
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.dead = true;
      this.busted = this.wanted > 0;
      this.audio.busted();
    }
  };
  return state;
}

/** Advance the world one fixed step. `input` may be null (attract mode). */
export function stepGame(state, dt, input) {
  state.elapsed += dt;
  state.clockMinutes += dt * 2.4; // a full day lasts ten minutes of play
  const p = state.player;

  if (input) {
    const axes = input.axes();
    if (p.onFoot) {
      stepPlayerOnFoot(state, dt, axes, input.running());
    } else if (p.car) {
      driveCar(p.car, dt, axes, input.handbrake());
      collideCarWithWorld(state, p.car);
      carHitsPeds(state, p.car);
      syncPlayerToCar(state);
    }
  } else if (!p.onFoot && p.car) {
    // Attract mode: the car idles.
    p.car.speed *= 0.98;
    p.car.x += Math.cos(p.car.angle) * p.car.speed * dt;
    p.car.y += Math.sin(p.car.angle) * p.car.speed * dt;
    syncPlayerToCar(state);
  }

  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepPolice(state, dt);
  stepMissions(state, dt);
  stepEnemies(state, dt);
  collideCars(state, dt);

  // Bullets fly, hit walls, enemies, pedestrians and the player.
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (state.city.buildingAt(b.x, b.y) || b.x < 0 || b.y < 0 || b.x > WORLD.size || b.y > WORLD.size) {
      b.life = 0;
      continue;
    }
    if (b.fromPlayer) {
      for (const e of state.enemies) {
        if (e.health > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 18) {
          e.health -= 34;
          b.life = 0;
          state.particles.push({ kind: 'hit', x: e.x, y: e.y, t: 0, life: 0.3 });
          if (e.health <= 0) state.addWanted(1, 'took down a crew member');
          break;
        }
      }
      if (b.life > 0) {
        for (const ped of state.peds) {
          if (ped.health > 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
            ped.health -= 50;
            b.life = 0;
            ped.flee = 3;
            state.particles.push({ kind: 'hit', x: ped.x, y: ped.y, t: 0, life: 0.3 });
            state.addWanted(ped.health <= 0 ? 2 : 1, 'shot a pedestrian');
            break;
          }
        }
      }
    } else if (Math.hypot(p.x - b.x, p.y - b.y) < 18) {
      b.life = 0;
      state.damagePlayer(8, 'shot by the warehouse crew');
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  // Particles age out.
  for (const pt of state.particles) pt.t += dt;
  state.particles = state.particles.filter((pt) => pt.t < pt.life);

  // Cash pickups.
  for (const pk of state.pickups) {
    pk.t += dt;
    if (Math.hypot(p.x - pk.x, p.y - pk.y) < 30) {
      state.cash += pk.amount;
      state.audio.pickup();
      state.particles.push({ kind: 'cash', x: pk.x, y: pk.y - 10, t: 0, life: 1 });
      pk.taken = true;
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);
  // Fresh cash drops drift in over time, so the streets never run dry.
  state.pickupTimer += dt;
  if (state.pickupTimer > 20 && state.pickups.length < 8) {
    state.pickupTimer = 0;
    const pt = state.city.randomWalkPoint();
    state.pickups.push({ x: pt.x, y: pt.y, amount: 50, t: 0 });
  }

  // Siren wail while police are near.
  state.sirenTimer -= dt;
  if (state.wanted > 0 && state.nearestPolice < 700 && state.sirenTimer <= 0) {
    state.sirenTimer = 0.55;
    state.audio.siren(Math.floor(state.elapsed * 2) % 2 === 0);
  }
  // Engine note follows the player's car.
  state.audio.setEngine(p.car ? Math.abs(p.car.speed) / 560 : 0, !p.onFoot);

  // Autosave every few seconds.
  state.saveTimer += dt;
  if (state.saveTimer > 5) {
    state.saveTimer = 0;
    saveGame(state);
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missions.index,
      health: state.player.health,
      x: state.player.x,
      y: state.player.y,
      clockMinutes: state.clockMinutes,
    }));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

export function loadGame(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return false;
    state.cash = data.cash;
    state.missions.index = Math.min(data.missionIndex || 0, state.missions.list.length - 1);
    state.player.health = data.health || PLAYER.maxHealth;
    if (typeof data.x === 'number' && typeof data.y === 'number') {
      state.player.x = data.x;
      state.player.y = data.y;
    }
    if (typeof data.clockMinutes === 'number') state.clockMinutes = data.clockMinutes;
    return true;
  } catch {
    return false;
  }
}

export { STEP };
