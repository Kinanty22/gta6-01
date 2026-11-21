// SOLMARA — main: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between title, play, paused, busted/wasted and win screens.
//
// ?seed=N fixes the city and traffic. ?shot=chase|street|delivery|beach (with
// &seed=N) stages that scene instead of running the loop, paints it until the
// camera settles and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_NEWGAME, ACTION_PAUSE, ACTION_START, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);
// Read-only handle for playtesting and debugging (the finalist review can
// inspect the live state the same way); the game never reads it back.
window.__solmara = world;

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
    // Storage off: the best cash lasts this visit only.
  }
}

function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, false);
    painted += 1;
    // The follow camera eases toward the player; give it frames to settle
    // so the screenshot is centred on the action, not mid-pan.
    if (painted < 40) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saved = hasSave();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      saved = false;
    } else if (saved) {
      world.reset();
      world.load();
    }
    if (world.state.missionIndex === 0 && world.state.missionState === 'idle') {
      world.setMessage('Mara Voss: welcome to Solmara, Dax. Press ENTER to take the first job.', 5);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Solmara. Steal a car, run missions, dodge the cops.');
  }

  // Busted or wasted is a setback, not the end: the player is released and
  // play continues (GTA-style), minus the fine. The run only ends in glory
  // on the win screen after all three missions.
  function endGame(busted) {
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    announce(busted ? 'Busted — released, keep playing.' : 'Wasted — patched up, keep playing.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      world.state.muted = muted;
      world.setMessage(muted ? 'Sound off (M to turn back on)' : 'Sound on', 2);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEWGAME) startGame(true);
      else if (actions & (ACTION_CONFIRM | ACTION_START)) startGame(false);
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_START)) {
        world.reset();
        if (saved) world.load();
        screen = SCREEN_PLAY;
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // ENTER (not click, not Space) starts the next story mission.
    if (screen === SCREEN_PLAY && world.state.missionState === 'idle' && world.state.missionIndex < 3) {
      if (actions & ACTION_START) {
        world.startMission(world.state.missionIndex);
      }
    }
    if (screen === SCREEN_PLAY && world.state.missionState === 'done' && world.state.missionIndex >= 3) {
      screen = SCREEN_WIN;
    }
  }

  function step(actions) {
    if (screen !== SCREEN_PLAY) return;
    const axes = input.axes();
    const events = world.step(STEP, axes, input.running(), input.handbrake(), actions);
    if (events & EVENT_BUSTED) endGame(true);
    else if (events & EVENT_WASTED) endGame(false);
    else if (world.state.missionIndex >= 3 && world.state.missionState !== 'active') {
      screen = SCREEN_WIN;
      if (world.state.cash > best) {
        best = world.state.cash;
        saveBest(best);
      }
    }
    const car = world.player.inCar;
    audio.update(car ? car.speed / 560 : 0, world.state.stars);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Actions are taken once per frame: menus consume them, the first world
    // step of the frame gets the gameplay ones (E to enter a car, punch).
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    if (screen === SCREEN_TITLE) renderer.drawTitle(world, saved);
    else renderer.draw(world, screen, best, false);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmara. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
