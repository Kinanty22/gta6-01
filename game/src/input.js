// Keyboard input: held keys for movement and driving, and edge-triggered
// actions (enter a car, punch, confirm, pause) consumed once per press.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  Space: ACTION_PUNCH,
  KeyM: ACTION_MUTE,
};

export function createInput(target) {
  const held = new Set();
  let queued = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) {
      queued |= action;
      event.preventDefault();
    }
    if (event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  if (target !== window && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function axis(neg, pos) {
    return (held.has(pos) ? 1 : 0) - (held.has(neg) ? 1 : 0);
  }

  return {
    /** Movement vector for walking: x right, y down, each -1, 0 or 1. */
    direction() {
      const x = axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight');
      const y = axis('KeyW', 'KeyS') + axis('ArrowUp', 'ArrowDown');
      return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    },
    /** Driving controls: throttle -1..1, steering -1..1, handbrake held. */
    drive() {
      const throttle = axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp');
      const steer = axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight');
      return {
        throttle: Math.max(-1, Math.min(1, throttle)),
        steer: Math.max(-1, Math.min(1, steer)),
        handbrake: held.has('Space'),
      };
    },
    run() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** Actions pressed since the last call; each is reported once. */
    takeActions() {
      const out = queued;
      queued = 0;
      return out;
    },
  };
}
