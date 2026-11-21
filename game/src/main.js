// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between title, play, paused, busted and wasted screens; the
// win is an overlay on play. Sound unlocks on the first gesture.
//
// ?seed=N fixes the city. ?shot=chase|street|delivery|beach (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_PUNCH, EVENT_STEAL, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// A handle for automated playtests (and curious players): the live world.
window.__solmara = world;

function readSave() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? '{}') || {};
  } catch {
    return {};
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const save = readSave();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: save.best || 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  Object.defineProperty(window.__solmara, 'screen', { get: () => screen });
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let interactHeld = false;
  let punchHeld = false;

  function announce(message) {
    status.textContent = message;
  }

  function persist() {
    save = {
      ...save,
      cash: world.state.cash,
      missionsDone: world.state.missionsDone,
      stashesTaken: world.state.stashesTaken,
      best: Math.max(save.best || 0, world.state.cash),
    };
    writeSave(save);
  }

  function startGame() {
    world.reset();
    // A returning player keeps their cash and completed missions.
    world.state.cash = save.cash || 0;
    world.state.missionsDone = [...(save.missionsDone || [false, false, false])];
    if (save.stashesTaken) {
      let taken = 0;
      for (const s of world.state.city.stashes) {
        if (taken >= save.stashesTaken) break;
        s.taken = true;
        taken += 1;
      }
      world.state.stashesTaken = taken;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Mara Voss has work — press ENTER.');
  }

  function firstUndoneMission() {
    return world.state.missionsDone.findIndex((done) => !done);
  }

  function handleEvents(events) {
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CRASH) audio.crash(0.6);
    if (events & EVENT_STEAL) audio.pickup();
    if (events & EVENT_MISSION_DONE) {
      audio.mission();
      persist();
    }
    if (events & EVENT_MISSION_FAIL) audio.busted();
    if (events & EVENT_BUSTED) {
      audio.busted();
      persist();
      screen = SCREEN_BUSTED;
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      persist();
      screen = SCREEN_WASTED;
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
        screen = SCREEN_PLAY;
        announce('Back on the streets.');
      } else if (screen === SCREEN_PLAY && world.state.win) startGame();
      else if (screen === SCREEN_PLAY && !world.state.mission) {
        const next = firstUndoneMission();
        if (next >= 0) {
          world.startMission(next);
          audio.mission();
        }
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_INTERACT) interactHeld = true;
    if (actions & ACTION_PUNCH) punchHeld = true;
  }

  function step() {
    const vector = input.vector();
    const ctrl = {
      x: vector.x,
      y: vector.y,
      run: input.running(),
      brake: input.braking(),
      interact: interactHeld,
      punch: punchHeld,
    };
    interactHeld = false;
    punchHeld = false;
    const events = world.step(STEP, ctrl);
    handleEvents(events);
    const pc = world.state.player.inCar;
    audio.engine(pc ? Math.abs(pc.speed) / 565 : 0, !!pc);
    audio.siren(world.state.heat <= 0 ? 0 : Math.min(5, Math.ceil(world.state.heat / 100)), STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best: save.best || 0 });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmara — Streets of Gold. Press ENTER or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
