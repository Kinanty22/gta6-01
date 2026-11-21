// SOLMARA — shots: the four screenshot scenes behind ?shot=chase|street|
// delivery|beach. Each one plays the real rules forward from a fresh world
// for a fixed number of steps, steered by a simple driving autopilot, so the
// frame is what real play looks like and the same seed always gives the same
// frame. The renderer then paints it until the camera settles and sets
// window.__shotReady.
import { ROADS_X, ROADS_Y, STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

// Steer a car toward (tx, ty): returns {x, y} axes for world.step.
function driveToward(world, tx, ty) {
  const car = world.player.inCar;
  if (!car) return { x: 0, y: -1 };
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { x: d > 0.15 ? 1 : d < -0.15 ? -1 : 0, y: -1 };
}

function nearestRoad(value, roads) {
  let best = roads[0];
  let bestD = Infinity;
  for (const road of roads) {
    const d = Math.abs(value - road);
    if (d < bestD) { bestD = d; best = road; }
  }
  return best;
}

// Manhattan routing on the road grid: stay on a road, turn at the intersection
// nearest the target, never cut across blocks (and buildings).
function roadWaypoint(world, tx, ty) {
  const car = world.player.inCar;
  if (!car) return { x: tx, y: ty };
  const hy = nearestRoad(car.y, ROADS_Y);
  const vx = nearestRoad(car.x, ROADS_X);
  const onH = Math.abs(car.y - hy) < 60;
  const onV = Math.abs(car.x - vx) < 60;
  if (onH && Math.abs(ty - hy) < 70) return { x: tx, y: hy };
  if (onV && Math.abs(tx - vx) < 70) return { x: vx, y: ty };
  if (onH) return { x: nearestRoad(tx, ROADS_X), y: hy };
  if (onV) return { x: vx, y: nearestRoad(ty, ROADS_Y) };
  return { x: vx, y: hy };
}

function autopilotDrive(world, tx, ty) {
  const wp = roadWaypoint(world, tx, ty);
  const axes = driveToward(world, wp.x, wp.y);
  world.step(STEP, axes, false, false, 0);
}

// Put the player in the nearest parked car and drive it along a road.
function getInCar(world) {
  const car = world.nearestCar(400);
  if (car) world.enterCar(car);
}

export function stageShot(name, world) {
  world.reset();
  const city = world.city;
  const s = world.state;

  if (name === 'street') {
    // On foot in downtown, mission 1 offered, peds and traffic around.
    world.player.x = 1800;
    world.player.y = 1220;
    world.player.angle = Math.PI / 4;
    world.startMission(0);
    for (let i = 0; i < 8 * 60; i += 1) world.step(STEP, { x: 0, y: 0 }, false, false, 0);
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'delivery') {
    // Mid package run: package grabbed, timer ticking, driving downtown.
    getInCar(world);
    world.startMission(1);
    world.state.missionHasPackage = true;
    world.state.missionTarget = { ...city.places.downtownTower, label: 'SOLMARA TOWER — DELIVER' };
    world.state.missionTimer = 42;
    world.player.x = 1800;
    world.player.y = 2140;
    if (world.player.inCar) {
      world.player.inCar.x = 1800;
      world.player.inCar.y = 2140;
      world.player.inCar.angle = -Math.PI / 2;
    }
    for (let i = 0; i < 6 * 60; i += 1) autopilotDrive(world, 1800, 1220);
    return { screen: SCREEN_PLAY, best: 600 };
  }

  if (name === 'beach') {
    // Cruise down Palm Beach road with the sea in view; the heat joins late
    // so a star and a cop car are still in the frame.
    getInCar(world);
    world.player.x = 1300;
    world.player.y = 2140;
    if (world.player.inCar) {
      world.player.inCar.x = 1300;
      world.player.inCar.y = 2140;
      world.player.inCar.angle = 0;
      world.player.inCar.speed = 300;
    }
    world.state.cash = 1250;
    for (let i = 0; i < 6 * 60; i += 1) autopilotDrive(world, 3300, 2140);
    world.addHeat(30, 'speeding past a patrol');
    for (let i = 0; i < 2.5 * 60; i += 1) autopilotDrive(world, 3300, 2140);
    return { screen: SCREEN_PLAY, best: 1250 };
  }

  // Default: 'chase' — the cover. Three-star getaway in a stolen car,
  // cop cars on the tail, safehouse mission live, downtown streets.
  // Start far from the safehouse so the mission is still live in the frame.
  getInCar(world);
  world.startMission(2);
  world.state.cash = 900;
  world.player.x = 2800;
  world.player.y = 2140;
  if (world.player.inCar) {
    world.player.inCar.x = 2800;
    world.player.inCar.y = 2140;
    world.player.inCar.angle = Math.PI;
    world.player.inCar.speed = 380;
  }
  for (let i = 0; i < 7 * 60; i += 1) autopilotDrive(world, 480, 1680);
  return { screen: SCREEN_PLAY, best: 900 };
}
