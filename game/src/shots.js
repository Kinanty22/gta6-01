// The screenshot scenes behind ?shot=chase|street|delivery|beach. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// small autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The cover is the chase: a stolen car at speed,
// police behind it, the safehouse star ahead, the minimap full of cop blips.
import { PLACES, STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

const IDLE = { x: 0, y: 0, run: false, brake: false, interact: false, punch: false };

function driveEast(car, targetY) {
  const want = Math.atan2(targetY - car.y, 300);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { x: Math.max(-1, Math.min(1, d * 2.2)), y: -1, run: false, brake: false, interact: false, punch: false };
}

function driveNorthAvenue(car, avenueX) {
  const want = Math.atan2(-300, avenueX - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { x: Math.max(-1, Math.min(1, d * 2.2)), y: -1, run: false, brake: false, interact: false, punch: false };
}

function putPlayerInCar(world, car, x, y, angle, speed) {
  const state = world.state;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.parked = false;
  car.isPlayer = true;
  car.kind = 'player';
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.camera.x = x;
  state.camera.y = y;
}

function parkedCar(world) {
  return world.state.cars.find((c) => c.parked && !c.wrecked);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any other name stages the chase.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  const steps = (seconds) => Math.round(seconds / STEP);

  if (name === 'street') {
    // On foot downtown by the park, Mission 1 on the banner, traffic rolling past.
    world.startMission(0);
    state.player.x = 1650;
    state.player.y = 950;
    state.player.angle = 0;
    for (let i = 0; i < steps(3); i += 1) {
      world.step(STEP, { x: 1, y: 0, run: true, brake: false, interact: false, punch: false });
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'delivery') {
    // Mission 2 in its timed leg: 37 seconds left, the Tower star ahead.
    state.missionsDone = [true, false, false];
    world.startMission(1);
    state.mission.phase = 'timed';
    state.mission.timer = 37;
    const car = parkedCar(world);
    putPlayerInCar(world, car, 1500, 700, 0, 330);
    for (let i = 0; i < steps(1.0); i += 1) {
      world.step(STEP, driveEast(world.state.player.inCar, 700));
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'beach') {
    // A cruise on the Palm Beach sand, the sea beside the car, two stars up.
    world.addHeat(120);
    const car = parkedCar(world);
    putPlayerInCar(world, car, 2300, 2340, 0, 260);
    for (let i = 0; i < steps(1.5); i += 1) {
      world.step(STEP, { x: 0, y: -1, run: false, brake: false, interact: false, punch: false });
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // chase (the cover): Heat Wave, three stars, a stolen car at speed on the
  // 1600 street, cop cars behind, the safehouse star ahead.
  state.missionsDone = [true, true, false];
  world.startMission(2);
  const car = parkedCar(world);
  putPlayerInCar(world, car, 2400, 1600, 0, 420);
  const cop1 = { x: 2050, y: 1600, angle: 0, speed: 420, health: 100, color: '#20242e', taxi: false, parked: false, isCop: true, isPlayer: false, wrecked: false, smoke: 0, target: null, stuck: 0, kind: 'cop' };
  const cop2 = { x: 2180, y: 1696, angle: 0, speed: 400, health: 100, color: '#20242e', taxi: false, parked: false, isCop: true, isPlayer: false, wrecked: false, smoke: 0, target: null, stuck: 0, kind: 'cop' };
  state.cars.push(cop1, cop2);
  for (let i = 0; i < steps(0.8); i += 1) {
    world.step(STEP, driveEast(world.state.player.inCar, 1600));
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
