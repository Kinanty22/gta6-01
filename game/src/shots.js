// The screenshot scenes behind ?shot=chase|street|delivery|beach. Each one
// sets the world to a real moment of play — a mission in progress, a chase,
// a delivery on the clock — then plays the real rules forward for a fixed
// number of steps with scripted inputs, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
import { STEP, MISSIONS, PLACES } from './config.js';
import { SCREEN_PLAY } from './render.js';

const IDLE = { move: { x: 0, y: 0 }, run: false, drive: { throttle: 0, steer: 0, handbrake: false }, actions: 0 };

function driveForward(seconds, world) {
  const controls = { move: { x: 0, y: 0 }, run: false, drive: { throttle: 1, steer: 0, handbrake: false }, actions: 0 };
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, controls);
}

function walk(seconds, world, mx, my) {
  const controls = { move: { x: mx, y: my }, run: false, drive: { throttle: 0, steer: 0, handbrake: false }, actions: 0 };
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, controls);
}

function putPlayerInCar(world, x, y, angle) {
  const s = world.state;
  let car = null;
  let best = Infinity;
  for (const c of s.cars) {
    if (c.wrecked || c.driver === 'cop') continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < best) {
      best = d;
      car = c;
    }
  }
  if (!car) return null;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  car.parked = false;
  car.driver = 'player';
  s.player.inCar = true;
  s.player.carId = car.id;
  s.player.x = x;
  s.player.y = y;
  s.player.angle = angle;
  return car;
}

function stageChase(world) {
  const s = world.state;
  s.missionDone = [true, true, false];
  s.missionIndex = 2;
  s.missionActive = true;
  s.missionStage = 1;
  s.cash = 900;
  s.heat = 90;
  s.stars = 2;
  s.lastCrime = s.time;
  putPlayerInCar(world, 1900, 2050, 0);
  // The chase is already at speed when the frame is taken, but not so fast
  // it reaches the safehouse before the picture.
  const stagedCar = world.playerCar();
  if (stagedCar) stagedCar.speed = 400;
  // A police car already on the same road, behind the player (never the
  // player's own car).
  const playerCar = world.playerCar();
  // Clear the road ahead of the chase (y=2050, x 1850..2800) so the player
  // car can actually run: move any traffic or pedestrians on that stretch
  // onto the y=1700 road.
  let cleared = 0;
  for (const c of s.cars) {
    if (playerCar && c.id === playerCar.id) continue;
    if (c.driver === 'cop') continue;
    if (Math.abs(c.y - 2050) < 70 && c.x > 1800 && c.x < 2850) {
      c.y = 1700;
      c.x = 400 + cleared * 260;
      cleared += 1;
    }
  }
  for (const ped of s.peds) {
    if (Math.abs(ped.y - 2050) < 60 && ped.x > 1800 && ped.x < 2850) {
      ped.y = 1700;
      ped.x = 500 + cleared * 90;
      ped.tx = ped.x;
      ped.ty = ped.y;
      cleared += 1;
    }
  }
  const spots = s.cars.filter((c) => c.driver === 'traffic' && (!playerCar || c.id !== playerCar.id));
  if (spots.length > 0) {
    const cop = spots[0];
    cop.x = 1680;
    cop.y = 2050;
    cop.angle = 0;
    cop.police = true;
    cop.color = '#3a6fd8';
    cop.driver = 'cop';
    cop.cruise = 380;
    cop.tx = 2700;
    cop.ty = 2050;
    cop.repick = 2;
  }
  driveForward(1.1, world);
  // Pose the HUD exactly: the chase is at 2 stars whatever the drive
  // knocked over on the way here.
  s.heat = 90;
  s.stars = 2;
  s.lastCrime = s.time;
  return { screen: SCREEN_PLAY };
}

function stageStreet(world) {
  const s = world.state;
  s.player.x = 900;
  s.player.y = 1600;
  s.player.angle = 0;
  walk(1.2, world, 1, 0.2);
  return { screen: SCREEN_PLAY };
}

function stageDelivery(world) {
  const s = world.state;
  s.missionDone = [true, false, false];
  s.missionIndex = 1;
  s.missionActive = true;
  s.missionStage = 1;
  s.missionTimer = 37;
  s.cash = 300;
  putPlayerInCar(world, 1150, 1000, 0);
  driveForward(1.0, world);
  return { screen: SCREEN_PLAY };
}

function stageBeach(world) {
  const s = world.state;
  s.cash = 900;
  s.heat = 20;
  s.stars = 1;
  s.lastCrime = s.time;
  putPlayerInCar(world, 3360, 1800, -Math.PI / 2);
  driveForward(1.5, world);
  return { screen: SCREEN_PLAY };
}

/**
 * Set `world` to the named scene (chase, street, delivery or beach; any other
 * name is street) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'chase') return stageChase(world);
  if (name === 'delivery') return stageDelivery(world);
  if (name === 'beach') return stageBeach(world);
  return stageStreet(world);
}
