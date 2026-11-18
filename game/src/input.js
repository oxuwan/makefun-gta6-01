// Keyboard and mouse input. Held keys give movement and driving axes;
// one-shot presses (start, pause, enter car, punch, shoot, interact) are
// queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_INTERACT = 32;
export const ACTION_MINIMAP_ZOOM = 64;
export const ACTION_HORN = 128;
export const ACTION_RESTART = 256;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const SHOOT = new Set(['KeyG']);
const INTERACT = new Set(['KeyQ']);
const MINIMAP_ZOOM = new Set(['Tab']);
const HORN = new Set(['KeyH']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (SHOOT.has(event.code)) actions |= ACTION_SHOOT;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (MINIMAP_ZOOM.has(event.code)) actions |= ACTION_MINIMAP_ZOOM;
    else if (HORN.has(event.code)) actions |= ACTION_HORN;
    else if (RESTART.has(event.code)) actions |= ACTION_RESTART;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || HANDBRAKE.has(event.code) || CONFIRM.has(event.code) || PAUSE.has(event.code)
      || MINIMAP_ZOOM.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    actions |= ACTION_SHOOT;
  });
  target.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Driving / walking axes: forward -1..1, steer -1..1. */
    axes() {
      const forward = (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0);
      const steer = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      return { forward, steer };
    },
    running() { return has(RUN); },
    handbrake() { return has(HANDBRAKE); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
