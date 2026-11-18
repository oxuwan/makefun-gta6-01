// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh state for a fixed number of
// steps, steered by a simple scripted driver, so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { STEP, WORLD } from './config.js';
import { clamp, angleDiff } from './random.js';
import { stepGame } from './game.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A scripted input object shaped like the real one: axes, run, handbrake. */
function scriptedInput(steerFn) {
  return {
    axes() { return { forward: 1, steer: clamp(steerFn(), -1, 1) }; },
    running() { return false; },
    handbrake() { return false; },
  };
}

/** Put the player in a car on the eastbound road at y = roadSpacing. */
function putPlayerInCar(state, x) {
  const car = state.cars.find((c) => !c.police && !c.traffic && !c.driver);
  const use = car || state.cars[0];
  use.x = x;
  use.y = WORLD.roadSpacing;
  use.angle = 0;
  use.speed = 120;
  use.color = '#ffd23e'; // bright cab yellow so the hero car pops in shots
  use.driver = 'player';
  const p = state.player;
  p.car = use;
  p.onFoot = false;
  p.x = use.x;
  p.y = use.y;
  return use;
}

/** Steer toward the road centreline (eastbound lane). */
function laneSteer(state) {
  const car = state.player.car;
  return (WORLD.roadSpacing - car.y) / 60;
}

/** Steer toward a world point. */
function seekSteer(state, tx, ty) {
  const car = state.player.car;
  const want = Math.atan2(ty - car.y, tx - car.x);
  return angleDiff(car.angle, want) / 1.2;
}

function driveSeconds(state, seconds, steerFn) {
  const input = scriptedInput(steerFn);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepGame(state, STEP, input);
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * Unknown names stage the title screen.
 */
export function stageShot(name, state) {
  if (name === 'drive') {
    putPlayerInCar(state, 700);
    driveSeconds(state, 4, () => laneSteer(state));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Golden-hour chase, four stars, on the long eastbound straight past
    // the marina — police lights against the sunset read better than the
    // flat midday frame, and the extra star fills the road with pursuit.
    putPlayerInCar(state, 900);
    state.clockMinutes = 18 * 60 + 20;
    state.addWanted(4, 'staged chase');
    // Four seconds: long enough for the pursuit to close in, short enough
    // that the pile-up of ramming police does not pin the hero car.
    driveSeconds(state, 4, () => laneSteer(state));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    startMission(state);
    putPlayerInCar(state, 700);
    const stage = state.missions.list[0].stages[0];
    driveSeconds(state, 5, () => seekSteer(state, stage.point.x, stage.point.y));
    return { screen: SCREEN_PLAY };
  }
  // Title: let the city live for a few seconds behind the panel.
  for (let i = 0; i < Math.round(6 / STEP); i += 1) stepGame(state, STEP, null);
  return { screen: SCREEN_TITLE };
}
