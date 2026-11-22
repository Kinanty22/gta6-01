// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens:
// title, play, paused and win. Sound is WebAudio synth only, no audio files.
//
// ?seed=N fixes the city. ?shot=chase|street|delivery|beach (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_BUSTED, EVENT_WASTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_ENTER_CAR, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const IDLE = { move: { x: 0, y: 0 }, run: false, drive: { throttle: 0, steer: 0, handbrake: false }, actions: 0 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

// A handle for automated playtests: read the state, add heat, start missions.
window.__game = {
  world,
  state: world.state,
  addHeat(n) {
    world.addHeat(n);
  },
  startMission() {
    return world.startMission();
  },
};

function readSave() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch {
    return null;
  }
}
function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

// --- Sound: WebAudio synth only. ---
let audioCtx = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let muted = false;

function ensureAudio() {
  if (audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
    sirenOsc = audioCtx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = audioCtx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(audioCtx.destination);
    sirenOsc.start();
  } catch {
    audioCtx = null;
  }
}
function beep(freq, dur, type, vol, when = 0) {
  if (!audioCtx || muted) return;
  try {
    const t0 = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // Sound is garnish: never let it break the game.
  }
}
function playSound(name) {
  if (!audioCtx || muted) return;
  if (name === 'pickup') {
    beep(660, 0.12, 'sine', 0.1);
    beep(880, 0.16, 'sine', 0.1, 0.1);
  } else if (name === 'punch') {
    beep(180, 0.09, 'square', 0.12);
  } else if (name === 'crash') {
    beep(90, 0.25, 'sawtooth', 0.14);
    beep(60, 0.3, 'square', 0.1, 0.05);
  } else if (name === 'jingle') {
    [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.16, 'sine', 0.1, i * 0.11));
  } else if (name === 'busted' || name === 'wasted') {
    [392, 330, 262, 196].forEach((f, i) => beep(f, 0.2, 'triangle', 0.12, i * 0.13));
  }
}
function updateAudio() {
  if (!audioCtx) return;
  const s = world.state;
  const car = s.player.inCar ? world.playerCar() : null;
  const speed = car ? Math.abs(car.speed) : 0;
  if (engineGain) engineGain.gain.value = muted ? 0 : car ? 0.02 + (speed / 560) * 0.05 : 0;
  if (engineOsc) engineOsc.frequency.value = 55 + speed * 0.22;
  if (sirenGain) sirenGain.gain.value = muted || s.stars === 0 ? 0 : 0.03;
  if (sirenOsc) sirenOsc.frequency.value = Math.floor(s.time * 1.6) % 2 === 0 ? 700 : 950;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let saved = readSave() || { cash: 0, missions: [false, false, false], best: 0 };
  let best = saved.best || 0;
  let lastSavedCash = -1;
  let accumulator = 0;
  let last = performance.now();
  let pendingActions = 0;

  world.load(saved);

  function save() {
    const s = world.save();
    if (s.cash > best) best = s.cash;
    writeSave({ cash: s.cash, missions: s.missions, best });
    lastSavedCash = s.cash;
  }

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.load(readSave());
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Drive with WASD, steal cars with E, missions with ENTER.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = !muted;
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN)) {
      ensureAudio();
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_PLAY) {
      ensureAudio();
      if (world.startMission()) announce('Mission started.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, IDLE);
      return;
    }
    const controls = {
      move: input.direction(),
      run: input.run(),
      drive: input.drive(),
      actions: pendingActions,
    };
    pendingActions = 0;
    const events = world.step(STEP, controls);
    if (world.state.sound) {
      playSound(world.state.sound);
      world.state.sound = null;
    }
    if (events & EVENT_MISSION) save();
    if (world.state.cash !== lastSavedCash) save();
    if (events & EVENT_BUSTED) announce('Busted! Fine paid. Released at Police HQ.');
    if (events & EVENT_WASTED) announce('Wasted! Fine paid. You wake up at the hospital.');
    if (events & EVENT_WIN) {
      screen = SCREEN_WIN;
      save();
      announce('All missions complete! Solmara is yours.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    pendingActions |= actions & (ACTION_ENTER_CAR | ACTION_PUNCH);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    updateAudio();
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  document.addEventListener('pointerdown', ensureAudio, { once: true });

  announce('Solmara. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
