// Missions and story: five linked jobs for Rico Alvarez, a getaway driver
// for hire in Porto Verde. Each mission has stages (drive to a marker,
// pick someone up, lose the police, survive a shootout, deliver the goods)
// and pays cash on completion. The story is original: no borrowed names,
// places or characters.

import { MISSIONS, WORLD } from './config.js';

export const STORY = {
  hero: 'Rico Alvarez',
  city: 'Porto Verde',
  intro: 'Rico Alvarez drove getaway cars for the Marisol crew — until a job went wrong and the crew left him holding the bag. Now he drives for anyone who pays, one job at a time, while Detective Maren Voss and the Porto Verde police close in.',
};

const MARKER_R = 46;

function roadPoint(city, rng, minDistFrom, minDist) {
  for (let tries = 0; tries < 60; tries += 1) {
    const pt = city.randomRoadPoint();
    if (!minDistFrom || Math.hypot(pt.x - minDistFrom.x, pt.y - minDistFrom.y) > minDist) return pt;
  }
  return city.randomRoadPoint();
}

export function createMissions(state) {
  const city = state.city;
  const rng = state.rng;
  const home = { x: WORLD.roadSpacing, y: WORLD.roadSpacing };
  const list = [
    {
      id: 1, title: 'The Fare', client: 'Lena Ortiz',
      brief: 'Lena needs a ride across town, fast, no questions. Pick her up at the blue marker, then drop her at the marina.',
      stages: [
        { kind: 'goto', text: 'Pick up Lena at the blue marker', point: roadPoint(city, rng, home, 700) },
        { kind: 'goto', text: 'Drive Lena to the marina drop-off', point: { x: WORLD.size - 420, y: WORLD.size - 480 } },
      ],
    },
    {
      id: 2, title: 'Hot Wheels', client: 'Tomas Rook',
      brief: 'Tomas has a car waiting in the north lot. It is not his. Bring it to the garage on Coral Street — and do not get caught.',
      stages: [
        { kind: 'steal', text: 'Steal the red Comet in the north lot', point: roadPoint(city, rng, home, 900) },
        { kind: 'goto', text: 'Deliver the car to the garage', point: roadPoint(city, rng, home, 700) },
      ],
    },
    {
      id: 3, title: 'Smoke and Sirens', client: 'Lena Ortiz',
      brief: 'A pickup went loud. The police are already on you. Shake them, then meet Lena at the old boatyard.',
      stages: [
        { kind: 'lose', text: 'Lose the police — break line of sight and stay clear', point: null },
        { kind: 'goto', text: 'Meet Lena at the old boatyard', point: { x: 480, y: WORLD.size - 480 } },
      ],
    },
    {
      id: 4, title: 'The Standoff', client: 'Tomas Rook',
      brief: 'Rook\'s rivals are waiting at the warehouse. Take them down, then grab the ledger and get out.',
      stages: [
        { kind: 'goto', text: 'Reach the warehouse on Dock Street', point: { x: WORLD.size - 700, y: 1440 } },
        { kind: 'combat', text: 'Take down the warehouse crew', point: null },
        { kind: 'goto', text: 'Escape with the ledger to the safehouse', point: { x: WORLD.roadSpacing, y: WORLD.size - WORLD.roadSpacing } },
      ],
    },
    {
      id: 5, title: 'The Last Run', client: 'Lena Ortiz',
      brief: 'One last job: the Marisol crew\'s money, a police cordon, and a boat waiting at the harbour. Drive like your life depends on it — it does.',
      stages: [
        { kind: 'goto', text: 'Grab the money at the plaza', point: { x: WORLD.size / 2, y: WORLD.size / 2 } },
        { kind: 'lose', text: 'Break through the cordon — lose the police', point: null },
        { kind: 'goto', text: 'Reach the boat at the harbour', point: null }, // set from city.marina below
      ],
    },
  ];
  // The harbour boat sits at the marina landmark, not a hard-coded corner,
  // so the last job ends exactly where the city says the boats are.
  list[4].stages[2].point = { ...city.marina };
  return {
    list,
    index: 0,           // mission currently offered
    stage: 0,
    active: false,
    done: false,
    startedAt: 0,
    message: '',
    messageTimer: 0,
  };
}

export function currentMission(state) {
  return state.missions.list[state.missions.index] || null;
}

export function currentStage(state) {
  const m = currentMission(state);
  return m ? m.stages[state.missions.stage] : null;
}

export function startMission(state) {
  const m = currentMission(state);
  if (!m || state.missions.active) return false;
  state.missions.active = true;
  state.missions.stage = 0;
  state.missions.startedAt = state.elapsed;
  setMessage(state, `${m.title} — ${m.client}: ${m.brief}`, 6);
  if (m.id === 3) state.addWanted(2, 'the pickup went loud');
  if (m.id === 5) state.addWanted(3, 'the cordon is up');
  if (m.id === 4) spawnEnemies(state);
  if (m.id === 2) {
    // Park the red Comet the job is about at the steal marker.
    const point = m.stages[0].point;
    const car = state.cars.find((c) => !c.police && !c.traffic && !c.driver);
    if (car) {
      car.x = point.x;
      car.y = point.y;
      car.angle = 0;
      car.color = '#c0392b';
      car.name = 'Comet';
    }
  }
  state.audio.mission();
  return true;
}

export function setMessage(state, text, seconds) {
  state.missions.message = text;
  state.missions.messageTimer = seconds;
}

/** Restart the current mission from its first stage (pause-menu "R"). */
export function restartMission(state) {
  const m = currentMission(state);
  if (!m || state.missions.done) return false;
  state.missions.active = false;
  state.missions.stage = 0;
  state.enemies = [];
  // Clear the heat the failed attempt built up, so the retry starts clean.
  state.wantedFloat = 0;
  state.wanted = 0;
  state.evadeTimer = 0;
  startMission(state);
  return true;
}

/** Spawn the warehouse crew for mission 4. */
function spawnEnemies(state) {
  const stage = currentStage(state);
  const base = stage && stage.point ? stage.point : { x: WORLD.size - 700, y: 1440 };
  state.enemies = [];
  for (let i = 0; i < 5; i += 1) {
    state.enemies.push({
      x: base.x + (state.rng() - 0.5) * 260,
      y: base.y + (state.rng() - 0.5) * 260,
      angle: 0, health: 100, shootTimer: 1 + state.rng() * 1.5,
      speed: 90, shirt: '#3a3f4a', skin: '#e0ac69',
    });
  }
}

export function stepEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d > 320) {
      // Walk toward the player until in range.
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 0.9 + state.rng() * 0.8;
        state.bullets.push({
          x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20,
          vx: Math.cos(e.angle) * 620, vy: Math.sin(e.angle) * 620,
          life: 0.9, fromPlayer: false,
        });
        state.audio.enemyShoot();
      }
    }
  }
  // Mission 4 combat stage completes when the crew is down.
  const m = currentMission(state);
  if (state.missions.active && m && m.id === 4) {
    const stage = currentStage(state);
    if (stage && stage.kind === 'combat' && state.enemies.every((e) => e.health <= 0)) {
      advanceStage(state);
    }
  }
}

export function missionMarker(state) {
  const stage = currentStage(state);
  if (!state.missions.active || !stage || !stage.point) return null;
  return stage.point;
}

function advanceStage(state) {
  const m = currentMission(state);
  state.missions.stage += 1;
  if (state.missions.stage >= m.stages.length) {
    completeMission(state);
    return;
  }
  const stage = currentStage(state);
  setMessage(state, stage.text, 4);
  state.audio.mission();
}

function completeMission(state) {
  const m = currentMission(state);
  const reward = MISSIONS.reward[m.id - 1] || 500;
  state.cash += reward;
  state.missions.active = false;
  state.missions.index += 1;
  if (state.missions.index >= state.missions.list.length) state.missions.done = true;
  setMessage(state, `${m.title} complete — earned $${reward}. ${state.missions.done ? 'Porto Verde is yours, Rico.' : 'Next job is waiting. Press Q to take it.'}`, 6);
  state.audio.reward();
  state.particles.push({ kind: 'cash', x: state.player.x, y: state.player.y - 30, t: 0, life: 1.2 });
}

export function stepMissions(state, dt) {
  if (state.missions.messageTimer > 0) state.missions.messageTimer -= dt;
  if (!state.missions.active) return;
  const m = currentMission(state);
  const stage = currentStage(state);
  if (!m || !stage) return;
  const p = state.player;
  if (stage.kind === 'goto' && stage.point) {
    const d = Math.hypot(p.x - stage.point.x, p.y - stage.point.y);
    if (d < MARKER_R) {
      if (m.id === 2 && state.missions.stage === 0) {
        // Stage 0 of mission 2 is a steal: require the player in a car.
        if (p.onFoot) {
          setMessage(state, 'Get in the red Comet first — press E next to it.', 3);
          return;
        }
      }
      advanceStage(state);
    }
  } else if (stage.kind === 'steal') {
    // The steal stage is satisfied by entering any car near the marker.
    if (!p.onFoot && Math.hypot(p.x - stage.point.x, p.y - stage.point.y) < 260) advanceStage(state);
  } else if (stage.kind === 'lose') {
    if (state.wanted === 0) advanceStage(state);
  }
}

/** The objective line the HUD shows. */
export function objectiveText(state) {
  if (state.missions.active) {
    const m = currentMission(state);
    const stage = currentStage(state);
    return `${m.title}: ${stage ? stage.text : ''}`;
  }
  if (state.missions.done) return 'All jobs done — Porto Verde is yours. Free roam!';
  const m = currentMission(state);
  return m ? `Next job: ${m.title} — press Q to take it` : 'Free roam';
}

export { MARKER_R };
