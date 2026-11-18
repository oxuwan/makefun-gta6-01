// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?selftest=1 simulates 600 frames
// headlessly and writes SELFTEST OK/FAIL into document.title.
import { BEST_KEY, STEP } from './config.js';
import { createGameState, stepGame, loadGame, saveGame } from './game.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_SHOOT, ACTION_INTERACT, ACTION_MINIMAP_ZOOM, ACTION_HORN, ACTION_RESTART } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { enterExitCar, punch, shoot } from './player.js';
import { startMission, restartMission } from './missions.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
// The loading hint goes away once the game boots (it sits above the canvas).
document.getElementById('loading')?.remove();
const audio = createAudio();
const state = createGameState(seed, audio);
const renderer = createRenderer(canvas);
// Exposed for debugging and play-testing from the console: read the live state, never written by the page.
window.__game = state;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best cash then lasts this visit only.
  }
}

function mouseWorld(input) {
  const m = input.mouse();
  const view = renderer.view;
  return {
    x: state.player.x + (m.x - view.width / 2) / view.scale,
    y: state.player.y + (m.y - view.height / 2) / view.scale,
  };
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runSelftest() {
  let result = 'SELFTEST OK';
  try {
    const fake = {
      axes() { return { forward: 1, steer: 0.2 }; },
      running() { return true; },
      handbrake() { return false; },
    };
    for (let i = 0; i < 600; i += 1) {
      if (i === 60) enterExitCar(state);
      if (i === 120) punch(state);
      if (i === 180) shoot(state, state.player.x + 100, state.player.y);
      if (i === 240) startMission(state);
      if (i === 300) state.addWanted(2, 'selftest');
      if (i === 360) { state.minimapZoom = true; restartMission(state); }
      if (i === 420) state.minimapZoom = false;
      stepGame(state, STEP, i < 60 ? fake : fake);
      if (!Number.isFinite(state.player.x) || !Number.isFinite(state.player.y)) throw new Error('player position went non-finite');
    }
    if (state.cars.length < 10) throw new Error('too few cars');
    if (state.peds.length < 10) throw new Error('too few pedestrians');
    if (state.police.length < 1) throw new Error('police never spawned on wanted 2');
    if (!state.missions.active) throw new Error('mission restart did not re-activate the job');
    renderer.draw(state, SCREEN_PLAY, 0);
  } catch (err) {
    result = `SELFTEST FAIL: ${err && err.message ? err.message : String(err)}`;
  }
  document.title = result;
  window.__shotReady = true;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  let fpsFrames = 0;
  let fpsWindowStart = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    const fresh = createGameState(seed, audio);
    Object.assign(state, fresh);
    state.dead = false;
    state.busted = false;
    loadGame(state);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Porto Verde is yours, Rico.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (state.cash > best) {
      best = state.cash;
      saveBest(best);
    }
    saveGame(state);
    announce(state.busted ? 'Busted. Game over.' : 'Wasted. Game over.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      // R restarts the current job from the pause menu; P resumes below.
      if (actions & ACTION_RESTART && restartMission(state)) {
        screen = SCREEN_PLAY;
        announce('Job restarted from the beginning.');
        return;
      }
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Resumed.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_MINIMAP_ZOOM) {
      state.minimapZoom = !state.minimapZoom;
      announce(state.minimapZoom ? 'Big map on.' : 'Big map off.');
    }
    if (actions & ACTION_HORN && !state.player.onFoot) audio.horn();
    if (actions & ACTION_ENTER) {
      const res = enterExitCar(state);
      if (res === 'in') announce('In the car. Drive!');
      else if (res === 'none') announce('No car nearby. Walk up to one and press E.');
    }
    if (actions & ACTION_PUNCH) {
      if (punch(state)) audio.punch();
    }
    if (actions & (ACTION_SHOOT | ACTION_INTERACT)) {
      if (actions & ACTION_INTERACT) startMission(state);
      if (actions & ACTION_SHOOT && state.player.onFoot) {
        const target = mouseWorld(input);
        shoot(state, target.x, target.y);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Rolling frame rate for the HUD: count frames over each second.
    fpsFrames += 1;
    if (now - fpsWindowStart >= 1000) {
      state.fps = Math.round((fpsFrames * 1000) / (now - fpsWindowStart));
      fpsFrames = 0;
      fpsWindowStart = now;
    }
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        stepGame(state, STEP, null);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepGame(state, STEP, input);
        accumulator -= STEP;
        if (state.dead) endGame();
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, best);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) {
      muted = !muted;
      audio.setMuted(muted);
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Porto Verde. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (selftest) runSelftest();
else if (shot) runShot(shot);
else runGame();
