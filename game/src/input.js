// SOLMARA — input: keyboard state plus one-shot action edges (confirm, pause,
// enter/exit car, punch, mute). Mouse click also confirms on menu screens.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_NEWGAME = 32;
export const ACTION_START = 64;

const KEY_ACTIONS = {
  Enter: ACTION_START,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyJ: ACTION_PUNCH,
  KeyM: ACTION_MUTE,
  KeyN: ACTION_NEWGAME,
};

export function createInput(canvas) {
  const down = new Set();
  let actions = 0;
  let clicked = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (!event.repeat) {
      const action = KEY_ACTIONS[event.code] ?? KEY_ACTIONS[event.key];
      if (action) actions |= action;
      if (event.code === 'Space') actions |= ACTION_PUNCH;
    }
    down.add(event.code);
    down.add(event.key);
  }
  function onKeyUp(event) {
    down.delete(event.code);
    down.delete(event.key);
  }
  function onClick() {
    clicked = true;
  }
  function onBlur() {
    down.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onClick);

  function held(...codes) {
    return codes.some((code) => down.has(code));
  }

  return {
    // -1/0/1 steering and throttle axes for this frame.
    axes() {
      const x = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (held('KeyS', 'ArrowDown') ? 1 : 0) - (held('KeyW', 'ArrowUp') ? 1 : 0);
      return { x, y };
    },
    running() {
      return held('ShiftLeft', 'ShiftRight');
    },
    handbrake() {
      return held('Space');
    },
    takeActions() {
      const taken = actions | (clicked ? ACTION_CONFIRM : 0);
      actions = 0;
      clicked = false;
      return taken;
    },
  };
}
