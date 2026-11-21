// SOLMARA — world: all the rules and state, no drawing and no browser in it.
// The player on foot and in cars, traffic, pedestrians, police and the wanted
// level, three story missions, cash stashes, combat, particles and the save.
import {
  CAR, COP_CAR_MAX, MISSIONS, PED_COUNT, PLAYER, ROADS_X, ROADS_Y, STASH_COUNT,
  STASH_VALUE, TRAFFIC_COUNT, WANTED, WORLD,
} from './config.js';
import { createCity } from './city.js';
import { pick, range, rangeInt } from './random.js';

export const EVENT_CRASH = 1;
export const EVENT_PICKUP = 2;
export const EVENT_MISSION = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WASTED = 16;
export const EVENT_STAR = 32;
export const EVENT_PUNCH = 64;

const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#8e44ad', '#16a085', '#e67e22', '#ecf0f1', '#2c3e50', '#d35400', '#7f8c8d'];
const PED_SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8'];
const COP_BLUE = '#1f4fd8';
const TAXI_YELLOW = '#f7c948';

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function turnToward(angle, target, maxTurn) {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return angle + Math.max(-maxTurn, Math.min(maxTurn, d));
}

function nearestRoadValue(value, roads) {
  let best = roads[0];
  let bestD = Infinity;
  for (const road of roads) {
    const d = Math.abs(value - road);
    if (d < bestD) { bestD = d; best = road; }
  }
  return best;
}

// Manhattan waypoint for a chasing car: stay on the road grid and turn at
// the intersection nearest the target, instead of cutting across blocks
// (and through buildings). Close in, head straight for the target.
function chaseWaypoint(car, tx, ty) {
  const d = Math.hypot(tx - car.x, ty - car.y);
  if (d < 220) return { x: tx, y: ty };
  const hy = nearestRoadValue(car.y, ROADS_Y);
  const vx = nearestRoadValue(car.x, ROADS_X);
  const onH = Math.abs(car.y - hy) < 60;
  const onV = Math.abs(car.x - vx) < 60;
  if (onH && Math.abs(ty - hy) < 70) return { x: tx, y: hy };
  if (onV && Math.abs(tx - vx) < 70) return { x: vx, y: ty };
  if (onH) return { x: nearestRoadValue(tx, ROADS_X), y: hy };
  if (onV) return { x: vx, y: nearestRoadValue(ty, ROADS_Y) };
  return { x: vx, y: hy };
}

export function createWorld(random, audio) {
  const city = createCity(random);
  const state = {
    time: 0,
    cash: 0,
    health: PLAYER.health,
    wantedHeat: 0,
    stars: 0,
    missionIndex: 0,
    missionState: 'idle', // idle | active | done
    missionTimer: 0,
    missionHasPackage: false,
    missionTarget: null,
    message: '',
    messageTimer: 0,
    stashesFound: 0,
    carsStolen: 0,
    bustedCount: 0,
    wastedCount: 0,
    missionsDone: 0,
    muted: false,
    bustHold: 0,
    stats: { distance: 0, punches: 0 },
  };

  const player = {
    x: city.places.start.x, y: city.places.start.y, r: PLAYER.radius,
    angle: -Math.PI / 2, speed: 0, inCar: null, punchTimer: 0, hurtTimer: 0,
  };

  const cars = [];
  const peds = [];
  const cops = [];
  const particles = [];
  const stashes = [];
  const pickups = [];

  function spawnCar(x, y, angle, opts) {
    const car = {
      x, y, angle, speed: 0, vx: 0, vy: 0, color: pick(random, CAR_COLORS),
      health: CAR.health, isPlayer: false, isCop: false, isTaxi: false,
      driver: null, targetX: x, targetY: y, turnCooldown: 0, dead: false,
      smoke: 0, ...(opts || {}),
    };
    cars.push(car);
    return car;
  }

  function spawnTrafficCar() {
    const p = city.randomRoadPoint(random);
    const vertical = ROADS_X.includes(p.x);
    const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    const car = spawnCar(p.x + range(random, -18, 18), p.y + range(random, -18, 18), angle);
    car.speed = range(random, 130, 210);
    car.isTaxi = random() < 0.12;
    if (car.isTaxi) car.color = TAXI_YELLOW;
    return car;
  }

  function spawnPed(x, y) {
    const ped = {
      x: x ?? range(random, 100, WORLD.width - 100),
      y: y ?? range(random, 100, WORLD.height - 100),
      r: 11, angle: range(random, 0, Math.PI * 2),
      speed: range(random, 45, 75), shirt: pick(random, PED_SHIRTS),
      state: 'walk', // walk | flee | down | fare
      timer: range(random, 1, 4), targetX: 0, targetY: 0, downTimer: 0,
    };
    if (city.collidesCircle(ped.x, ped.y, ped.r)) {
      const road = city.nearestRoadPoint(ped.x, ped.y);
      ped.x = road.x + range(random, -70, 70);
      ped.y = road.y + range(random, -70, 70);
    }
    peds.push(ped);
    return ped;
  }

  function spawnCopCar() {
    const road = city.randomRoadPoint(random);
    const car = spawnCar(road.x, road.y, 0, { isCop: true, color: COP_BLUE });
    car.speed = 240;
    return car;
  }

  function spawnCopFoot() {
    const road = city.nearestRoadPoint(player.x, player.y);
    const cop = {
      x: road.x + range(random, -280, 280), y: road.y + range(random, -280, 280),
      r: 12, angle: 0, speed: 235, shirt: '#16213e', state: 'chase',
      timer: 0, downTimer: 0, punchTimer: 0,
    };
    cops.push(cop);
    return cop;
  }

  function addParticles(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x, y,
        vx: range(random, -speed, speed), vy: range(random, -speed, speed),
        life: range(random, 0.3, 0.8), maxLife: 0.8, color, size: range(random, 2, 5),
      });
    }
  }

  function setMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 3.5;
  }

  function wantedStars() {
    let stars = 0;
    for (let i = 0; i < WANTED.starAt.length; i += 1) {
      if (state.wantedHeat >= WANTED.starAt[i]) stars = i;
    }
    return Math.min(5, stars);
  }

  function addHeat(amount, why) {
    const before = wantedStars();
    state.wantedHeat = Math.min(260, state.wantedHeat + amount);
    const after = wantedStars();
    if (after > before) {
      setMessage(`WANTED LEVEL ${after} — ${why}`, 3);
      if (audio) audio.sirenBlip();
      return EVENT_STAR;
    }
    return 0;
  }

  function resetPositions() {
    cars.length = 0;
    peds.length = 0;
    cops.length = 0;
    particles.length = 0;
    stashes.length = 0;
    pickups.length = 0;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar();
    // A few parked cars near the start for the first mission. Parked cars
    // never move in collisions and traffic stops for them, so they are still
    // there when the player walks over to steal one.
    spawnCar(city.places.start.x + 60, city.places.start.y - 40, 0, { color: '#c0392b', parked: true });
    spawnCar(city.places.start.x - 90, city.places.start.y + 70, Math.PI / 2, { color: '#2980b9', parked: true });
    spawnCar(city.places.start.x + 150, city.places.start.y + 30, -Math.PI / 2, { color: '#f1c40f', parked: true });
    for (let i = 0; i < PED_COUNT; i += 1) spawnPed();
    for (let i = 0; i < STASH_COUNT; i += 1) {
      const road = city.randomRoadPoint(random);
      stashes.push({ x: road.x + range(random, -90, 90), y: road.y + range(random, -90, 90), taken: false });
    }
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    if (!mission) {
      state.missionState = 'done';
      state.missionTarget = null;
      return;
    }
    state.missionIndex = index;
    state.missionState = 'active';
    state.missionTimer = mission.timeLimit || 0;
    state.missionHasPackage = false;
    if (mission.id === 'hot-wheels') {
      state.missionTarget = { ...city.places.marina, label: 'MARINA' };
      setMessage('MISSION: steal a car, drive to the MARINA', 5);
    } else if (mission.id === 'the-package') {
      state.missionTarget = { ...city.places.docks, label: 'DOCKS — PICK UP' };
      setMessage('MISSION: pick up the package at the DOCKS', 5);
    } else if (mission.id === 'heat-wave') {
      state.wantedHeat = Math.max(state.wantedHeat, WANTED.starAt[3]);
      state.missionTarget = { ...city.places.safehouse, label: 'SAFEHOUSE' };
      setMessage('MISSION: 3 stars! Reach the SAFEHOUSE and lose the heat', 5);
      if (audio) audio.sirenBlip();
    }
  }

  function completeMission() {
    const mission = MISSIONS[state.missionIndex];
    state.cash += mission.reward;
    state.missionsDone += 1;
    setMessage(`${mission.title} COMPLETE — +$${mission.reward}`, 4);
    if (audio) audio.missionGood();
    addParticles(player.x, player.y, '#f7c948', 40, 260);
    state.missionIndex += 1;
    state.missionState = 'idle';
    state.missionTarget = null;
    state.missionHasPackage = false;
    if (state.missionIndex < MISSIONS.length) {
      setMessage(`${mission.title} COMPLETE — +$${mission.reward}. Next mission ready: press E at the marker? No — it starts automatically.`, 4);
    }
  }

  function failMission(why) {
    setMessage(`MISSION FAILED — ${why}`, 4);
    if (audio) audio.missionBad();
    state.missionState = 'idle';
    state.missionTarget = null;
    state.missionHasPackage = false;
    state.missionTimer = 0;
  }

  function bustPlayer() {
    state.bustedCount += 1;
    const fine = Math.min(state.cash, 200);
    state.cash -= fine;
    state.wantedHeat = 0;
    state.stars = 0;
    state.bustHold = 0;
    cops.length = 0;
    for (const car of cars) if (car.isCop) car.dead = true;
    player.inCar = null;
    player.x = city.places.policeStation.x;
    player.y = city.places.policeStation.y;
    player.health = PLAYER.health;
    if (state.missionState === 'active') failMission('busted by the cops');
    setMessage(`BUSTED! Fine $${fine}. Released at Police HQ.`, 4);
    if (audio) audio.busted();
    return EVENT_BUSTED;
  }

  function wastePlayer() {
    state.wastedCount += 1;
    const lost = Math.min(state.cash, 150);
    state.cash -= lost;
    state.wantedHeat = Math.max(0, state.wantedHeat - 40);
    player.inCar = null;
    player.x = city.places.hospital.x;
    player.y = city.places.hospital.y;
    player.health = PLAYER.health;
    if (state.missionState === 'active') failMission('you got wasted');
    setMessage(`WASTED! You wake up at the hospital, -$${lost}.`, 4);
    if (audio) audio.busted();
    return EVENT_WASTED;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.dead) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    player.inCar = car;
    car.isPlayer = true;
    car.parked = false;
    car.driver = player;
    if (!car.wasStolen) {
      car.wasStolen = true;
      state.carsStolen += 1;
      return addHeat(WANTED.stealCar, 'car stolen!');
    }
    return 0;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    car.isPlayer = false;
    car.speed = 0;
    const side = player.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 44;
    player.y = car.y + Math.sin(side) * 44;
    city.resolveCircle(player);
    player.inCar = null;
  }

  function punch() {
    if (player.punchTimer > 0) return 0;
    player.punchTimer = PLAYER.punchCooldown;
    state.stats.punches += 1;
    if (audio) audio.punch();
    const px = player.x + Math.cos(player.angle) * 34;
    const py = player.y + Math.sin(player.angle) * 34;
    let events = EVENT_PUNCH;
    addParticles(px, py, '#ffffff', 6, 140);
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (dist(px, py, ped.x, ped.y) < PLAYER.punchRange) {
        ped.state = 'down';
        ped.downTimer = 4;
        ped.x += Math.cos(player.angle) * 26;
        ped.y += Math.sin(player.angle) * 26;
        addParticles(ped.x, ped.y, '#ff7675', 10, 180);
        events |= addHeat(WANTED.punchPed, 'assault!');
      }
    }
    for (const cop of cops) {
      if (cop.downTimer > 0) continue;
      if (dist(px, py, cop.x, cop.y) < PLAYER.punchRange) {
        cop.downTimer = 3;
        addParticles(cop.x, cop.y, '#74b9ff', 10, 180);
        events |= addHeat(WANTED.punchCop, 'you hit a cop!');
      }
    }
    return events;
  }

  function stepPlayer(dt, axes, running, actions) {
    if (actions & 4) { // ACTION_ENTER
      if (player.inCar) exitCar();
      else {
        const car = nearestCar(70);
        if (car) return enterCar(car);
      }
    }
    if (player.inCar) return 0;
    if ((actions & 8) && player.punchTimer <= 0) return punch();
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.hurtTimer > 0) player.hurtTimer -= dt;
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = axes.x;
    const my = axes.y;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      player.angle = Math.atan2(my / len, mx / len);
      player.x += (mx / len) * speed * dt;
      player.y += (my / len) * speed * dt;
      state.stats.distance += speed * dt;
      city.resolveCircle(player);
    }
    if (state.health < PLAYER.health) state.health = Math.min(PLAYER.health, state.health + 2.2 * dt);
    return 0;
  }

  function carPhysics(car, dt, throttle, steer, brake) {
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    const forwardSpeed = car.vx * forwardX + car.vy * forwardY;
    // Steering scales with speed; handbrake lets the tail slide.
    const steerAmount = steer * (brake ? 2.6 : 1.9) * Math.min(1, Math.abs(forwardSpeed) / 120 + 0.25);
    car.angle += steerAmount * dt * (forwardSpeed >= 0 ? 1 : -1) * (brake ? 0.5 : 1);
    const nx = Math.cos(car.angle);
    const ny = Math.sin(car.angle);
    let fSpeed = car.vx * nx + car.vy * ny;
    fSpeed += throttle * CAR.accel * dt;
    if (brake) fSpeed -= Math.sign(fSpeed) * CAR.brake * dt;
    if (throttle === 0 && !brake) fSpeed -= fSpeed * CAR.drag * dt;
    fSpeed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, fSpeed));
    // Lateral grip: kill sideways velocity, less when handbraking.
    const rx = -ny;
    const ry = nx;
    let lat = car.vx * rx + car.vy * ry;
    lat *= Math.exp(-CAR.grip * dt * (brake ? 0.35 : 1));
    car.vx = nx * fSpeed + rx * lat;
    car.vy = ny * fSpeed + ry * lat;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.speed = Math.hypot(car.vx, car.vy);
    if (car.x < 40) { car.x = 40; car.vx = Math.abs(car.vx) * 0.4; }
    if (car.y < 40) { car.y = 40; car.vy = Math.abs(car.vy) * 0.4; }
    if (car.x > WORLD.width - 40) { car.x = WORLD.width - 40; car.vx = -Math.abs(car.vx) * 0.4; }
    // The sea stops cars: they can drive on the sand, not into the water.
    if (car.y > WORLD.waterY - 40) { car.y = WORLD.waterY - 40; car.vy = -Math.abs(car.vy) * 0.4; }
    return fSpeed;
  }

  function collideCarWithBuildings(car) {
    // Sample the car's four corners against buildings; bounce and damage on hit.
    const hx = Math.cos(car.angle) * (CAR.length / 2);
    const hy = Math.sin(car.angle) * (CAR.length / 2);
    const wx = Math.cos(car.angle + Math.PI / 2) * (CAR.width / 2);
    const wy = Math.sin(car.angle + Math.PI / 2) * (CAR.width / 2);
    const corners = [
      [car.x + hx + wx, car.y + hy + wy], [car.x + hx - wx, car.y + hy - wy],
      [car.x - hx + wx, car.y - hy + wy], [car.x - hx - wx, car.y - hy - wy],
    ];
    for (const [cx, cy] of corners) {
      if (city.collidesCircle(cx, cy, 2)) {
        const impact = Math.abs(car.speed);
        car.x -= car.vx * 0.06;
        car.y -= car.vy * 0.06;
        car.vx *= -0.35;
        car.vy *= -0.35;
        if (impact > 180) {
          car.health -= impact * 0.03;
          addParticles(cx, cy, '#fdcb6e', 8, 160);
          if (car.isPlayer && audio) audio.crash();
          return impact;
        }
        return 0;
      }
    }
    return 0;
  }

  function stepPlayerCar(dt, axes, handbrake) {
    const car = player.inCar;
    if (!car) return 0;
    const throttle = axes.y < 0 ? 1 : axes.y > 0 ? -0.55 : 0;
    const steer = axes.x;
    const brake = handbrake || (axes.y > 0 && car.speed > 60);
    const before = car.health;
    carPhysics(car, dt, throttle, steer, brake);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    state.stats.distance += car.speed * dt;
    const impact = collideCarWithBuildings(car);
    let events = 0;
    if (impact > 0 && car.health < before) events |= EVENT_CRASH;
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      addParticles(car.x, car.y, '#ff6b6b', 50, 320);
      addParticles(car.x, car.y, '#2d3436', 30, 160);
      exitCar();
      state.health = Math.max(10, state.health - 30);
      setMessage('Your car is wrecked!', 3);
      if (audio) audio.crash();
      events |= EVENT_CRASH;
    }
    if (car.health < 45) {
      car.smoke += dt;
      if (car.smoke > 0.12) {
        car.smoke = 0;
        particles.push({ x: car.x + range(random, -10, 10), y: car.y + range(random, -10, 10), vx: 0, vy: -40, life: 0.9, maxLife: 0.9, color: '#636e72', size: 7 });
      }
    }
    return events;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.dead || car.isPlayer || car.isCop || car.parked) continue;
      car.turnCooldown -= dt;
      const tx = car.targetX;
      const ty = car.targetY;
      const d = dist(car.x, car.y, tx, ty);
      if (d < 60 || car.turnCooldown <= 0) {
        // Pick a new waypoint: keep driving along the road grid.
        const onV = ROADS_X.some((rx) => Math.abs(car.x - rx) < 70);
        const onH = ROADS_Y.some((ry) => Math.abs(car.y - ry) < 70);
        if (onV && (!onH || random() < 0.5)) {
          const rx = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
          car.targetX = rx;
          car.targetY = car.y + (random() < 0.5 ? -600 : 600);
        } else {
          const ry = ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
          car.targetX = car.x + (random() < 0.5 ? -600 : 600);
          car.targetY = ry;
        }
        car.targetX = Math.max(80, Math.min(WORLD.width - 80, car.targetX));
        car.targetY = Math.max(80, Math.min(WORLD.height - 80, car.targetY));
        car.turnCooldown = 2.5;
      }
      const want = angleTo(car.x, car.y, car.targetX, car.targetY);
      car.angle = turnToward(car.angle, want, 1.6 * dt);
      const targetSpeed = 150 + Math.sin(state.time * 0.3 + car.x) * 20;
      const fwd = Math.cos(car.angle);
      const fwdY = Math.sin(car.angle);
      const cur = car.vx * fwd + car.vy * fwdY;
      const accel = Math.max(-200, Math.min(200, (targetSpeed - cur) * 1.5));
      car.vx += fwd * accel * dt;
      car.vy += fwdY * accel * dt;
      // Slow down if a car is right ahead (including a parked car).
      for (const other of cars) {
        if (other === car || other.dead) continue;
        const ahead = (other.x - car.x) * fwd + (other.y - car.y) * fwdY;
        const side = Math.abs((other.x - car.x) * -fwdY + (other.y - car.y) * fwd);
        if (ahead > 0 && ahead < 110 && side < 55) { car.vx *= 0.9; car.vy *= 0.9; }
      }
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.speed = Math.hypot(car.vx, car.vy);
      if (car.y > WORLD.waterY - 40) car.y = WORLD.waterY - 40;
      collideCarWithBuildings(car);
      if (car.x < 60 || car.y < 60 || car.x > WORLD.width - 60 || car.y > WORLD.height - 60) {
        // Recycle a car that drifted off: respawn it on a road far from the player.
        const p = city.randomRoadPoint(random);
        car.x = p.x; car.y = p.y; car.vx = 0; car.vy = 0;
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) ped.state = 'walk';
        continue;
      }
      ped.timer -= dt;
      const playerCar = player.inCar;
      const threatX = playerCar ? playerCar.x : player.x;
      const threatY = playerCar ? playerCar.y : player.y;
      const threatD = dist(ped.x, ped.y, threatX, threatY);
      const playerSpeed = playerCar ? playerCar.speed : 200;
      if (threatD < 110 && playerSpeed > 120) ped.state = 'flee';
      else if (ped.state === 'flee' && threatD > 260) ped.state = 'walk';
      if (ped.state === 'flee') {
        const away = angleTo(threatX, threatY, ped.x, ped.y);
        ped.angle = turnToward(ped.angle, away, 6 * dt);
        ped.x += Math.cos(ped.angle) * 150 * dt;
        ped.y += Math.sin(ped.angle) * 150 * dt;
      } else if (ped.timer <= 0) {
        ped.timer = range(random, 1.5, 5);
        ped.angle = range(random, 0, Math.PI * 2);
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      if (city.collidesCircle(ped.x, ped.y, ped.r)) {
        ped.x -= Math.cos(ped.angle) * ped.speed * dt * 2;
        ped.y -= Math.sin(ped.angle) * ped.speed * dt * 2;
        ped.angle += Math.PI / 2;
      }
      ped.x = Math.max(20, Math.min(WORLD.width - 20, ped.x));
      ped.y = Math.max(20, Math.min(WORLD.height - 20, ped.y));
    }
  }

  function stepPolice(dt) {
    const stars = state.stars;
    // Desired police presence grows with the wanted level.
    const wantCopCars = stars >= 1 ? Math.min(COP_CAR_MAX, stars) : 0;
    const wantFoot = stars >= 2 && !player.inCar ? Math.min(3, stars - 1) : 0;
    let copCars = 0;
    for (const car of cars) if (car.isCop && !car.dead) copCars += 1;
    if (copCars < wantCopCars && random() < dt * 1.2) spawnCopCar();
    let foot = 0;
    for (const cop of cops) if (cop.downTimer <= 0) foot += 1;
    if (foot < wantFoot && random() < dt * 1.5) spawnCopFoot();

    for (const car of cars) {
      if (!car.isCop || car.dead) continue;
      const wp = chaseWaypoint(car, player.x, player.y);
      const want = angleTo(car.x, car.y, wp.x, wp.y);
      car.angle = turnToward(car.angle, want, 2.4 * dt);
      const targetSpeed = 300 + stars * 45;
      const fwd = Math.cos(car.angle);
      const fwdY = Math.sin(car.angle);
      const cur = car.vx * fwd + car.vy * fwdY;
      const accel = Math.max(-420, Math.min(420, (targetSpeed - cur) * 2));
      car.vx += fwd * accel * dt;
      car.vy += fwdY * accel * dt;
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.speed = Math.hypot(car.vx, car.vy);
      if (car.y > WORLD.waterY - 40) car.y = WORLD.waterY - 40;
      collideCarWithBuildings(car);
      // Ram the player: cop contact hurts and slows.
      const d = dist(car.x, car.y, player.x, player.y);
      if (d < 46) {
        if (player.inCar) {
          player.inCar.health -= 30 * dt;
          player.inCar.vx += (player.x - car.x) * 0.8;
          player.inCar.vy += (player.y - car.y) * 0.8;
          if (random() < dt * 6) addParticles(player.x, player.y, '#fdcb6e', 5, 140);
        } else if (player.hurtTimer <= 0) {
          state.health -= 12;
          player.hurtTimer = 0.7;
          player.x += (player.x - car.x) * 0.4;
          player.y += (player.y - car.y) * 0.4;
          addParticles(player.x, player.y, '#ff7675', 8, 160);
          if (state.health <= 0) return wastePlayer();
        }
      }
      if (d > 2600) car.dead = true; // lost the player far away: despawn
    }

    for (const cop of cops) {
      if (cop.downTimer > 0) {
        cop.downTimer -= dt;
        continue;
      }
      cop.punchTimer -= dt;
      const d = dist(cop.x, cop.y, player.x, player.y);
      // Foot cops give up when the player drives away or gets far.
      if (player.inCar || d > 700) {
        cop.downTimer = -5;
        continue;
      }
      const want = angleTo(cop.x, cop.y, player.x, player.y);
      cop.angle = want;
      cop.x += Math.cos(want) * cop.speed * dt;
      cop.y += Math.sin(want) * cop.speed * dt;
      city.resolveCircle(cop);
      if (d < 34) {
        if (cop.punchTimer <= 0) {
          cop.punchTimer = 0.9;
          if (player.hurtTimer <= 0) {
            state.health -= 9;
            player.hurtTimer = 0.6;
            addParticles(player.x, player.y, '#ff7675', 6, 140);
            if (state.health <= 0) return wastePlayer();
          }
        }
        state.bustHold += dt;
        if (state.bustHold > WANTED.bustHoldSec) return bustPlayer();
      } else {
        state.bustHold = Math.max(0, state.bustHold - dt);
      }
    }
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      if (cops[i].downTimer <= -5) cops.splice(i, 1);
    }
    return 0;
  }

  function stepCarCollisions(dt) {
    let events = 0;
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        if (b.dead) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 52 && d > 0.01) {
          const push = (52 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          // A parked car never moves: the other car takes the whole push.
          if (a.parked) { b.x += nx * (52 - d); b.y += ny * (52 - d); }
          else if (b.parked) { a.x -= nx * (52 - d); a.y -= ny * (52 - d); }
          else {
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
          const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
          if (rel > 120 && !a.parked && !b.parked) {
            a.health -= rel * 0.03;
            b.health -= rel * 0.03;
            addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, '#fdcb6e', 6, 140);
            if ((a.isPlayer || b.isPlayer) && audio) audio.crash();
            events |= EVENT_CRASH;
            if (a.isCop || b.isCop) events |= addHeat(WANTED.crashCopCar, 'you rammed a cop car!');
          }
          if (!a.parked && !b.parked) {
            const swap = 0.5;
            const tvx = a.vx; const tvy = a.vy;
            a.vx = a.vx * (1 - swap) + b.vx * swap;
            a.vy = a.vy * (1 - swap) + b.vy * swap;
            b.vx = b.vx * (1 - swap) + tvx * swap;
            b.vy = b.vy * (1 - swap) + tvy * swap;
          }
          if (a.parked) { a.vx = 0; a.vy = 0; a.speed = 0; }
          if (b.parked) { b.vx = 0; b.vy = 0; b.speed = 0; }
        }
      }
      // Running over pedestrians.
      if (a.speed > 150) {
        for (const ped of peds) {
          if (ped.state === 'down') continue;
          if (dist(a.x, a.y, ped.x, ped.y) < 34) {
            ped.state = 'down';
            ped.downTimer = 6;
            addParticles(ped.x, ped.y, '#ff7675', 14, 220);
            if (a.isPlayer) events |= addHeat(WANTED.hitPed, 'you hit a pedestrian!');
            a.speed *= 0.7;
            a.vx *= 0.7; a.vy *= 0.7;
          }
        }
      }
      if (a.health <= 0 && !a.dead) {
        a.dead = true;
        addParticles(a.x, a.y, '#ff6b6b', 40, 300);
        if (a.isPlayer) {
          exitCar();
          state.health = Math.max(10, state.health - 30);
          events |= EVENT_CRASH;
        }
      }
    }
    // Remove wrecked non-player cars slowly; keep the array bounded.
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      if (cars[i].dead && !cars[i].isPlayer && dist(cars[i].x, cars[i].y, player.x, player.y) > 900) cars.splice(i, 1);
    }
    while (cars.filter((c) => !c.dead && !c.isPlayer && !c.isCop).length < TRAFFIC_COUNT) spawnTrafficCar();
    return events;
  }

  function stepMissions(dt) {
    if (state.missionState !== 'active') return 0;
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return 0;
    if (mission.timeLimit) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        failMission('out of time');
        return EVENT_MISSION;
      }
    }
    const target = state.missionTarget;
    if (!target) return 0;
    const d = dist(player.x, player.y, target.x, target.y);
    if (mission.id === 'hot-wheels') {
      if (player.inCar && d < 90) completeMission();
    } else if (mission.id === 'the-package') {
      if (!state.missionHasPackage) {
        if (!player.inCar && d < 70) {
          state.missionHasPackage = true;
          state.missionTarget = { ...city.places.downtownTower, label: 'SOLMARA TOWER — DELIVER' };
          setMessage('Package grabbed! Deliver it to SOLMARA TOWER — fast!', 4);
          addHeat(WANTED.stealCar, 'the package is hot!');
        }
      } else if (d < 90) {
        completeMission();
      }
    } else if (mission.id === 'heat-wave') {
      if (d < 110) {
        state.wantedHeat = 0;
        state.stars = 0;
        for (const car of cars) if (car.isCop) car.dead = true;
        cops.length = 0;
        completeMission();
      }
    }
    return 0;
  }

  function stepPickups() {
    let events = 0;
    for (const stash of stashes) {
      if (stash.taken) continue;
      if (dist(player.x, player.y, stash.x, stash.y) < 44) {
        stash.taken = true;
        state.cash += STASH_VALUE;
        state.stashesFound += 1;
        setMessage(`Cash stash found! +$${STASH_VALUE} (${state.stashesFound}/${STASH_COUNT})`, 3);
        if (audio) audio.cash();
        addParticles(stash.x, stash.y, '#f7c948', 20, 200);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function reset() {
    state.time = 0;
    state.cash = 0;
    state.health = PLAYER.health;
    state.wantedHeat = 0;
    state.stars = 0;
    state.missionIndex = 0;
    state.missionState = 'idle';
    state.missionTimer = 0;
    state.missionHasPackage = false;
    state.missionTarget = null;
    state.message = '';
    state.messageTimer = 0;
    state.stashesFound = 0;
    state.carsStolen = 0;
    state.bustedCount = 0;
    state.wastedCount = 0;
    state.missionsDone = 0;
    state.bustHold = 0;
    state.stats = { distance: 0, punches: 0 };
    player.x = city.places.start.x;
    player.y = city.places.start.y;
    player.angle = -Math.PI / 2;
    player.inCar = null;
    player.punchTimer = 0;
    player.hurtTimer = 0;
    resetPositions();
  }

  function save() {
    try {
      window.localStorage.setItem('solmara-save-v1', JSON.stringify({
        cash: state.cash, missionIndex: state.missionIndex, missionsDone: state.missionsDone,
        stashesFound: state.stashesFound, carsStolen: state.carsStolen,
        stashes: stashes.map((s) => s.taken),
      }));
    } catch {
      // Storage off: the save lasts this visit only.
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem('solmara-save-v1');
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.cash = data.cash || 0;
      state.missionIndex = data.missionIndex || 0;
      state.missionsDone = data.missionsDone || 0;
      state.carsStolen = data.carsStolen || 0;
      state.stashesFound = 0;
      if (Array.isArray(data.stashes)) {
        data.stashes.forEach((taken, i) => {
          if (taken && stashes[i]) { stashes[i].taken = true; state.stashesFound += 1; }
        });
      }
      return state.missionIndex > 0 || state.cash > 0;
    } catch {
      return false;
    }
  }

  reset();

  return {
    state, player, cars, peds, cops, particles, stashes, pickups, city,
    reset, save, load, startMission, completeMission, failMission,
    enterCar, exitCar, nearestCar, punch, addHeat, setMessage, wantedStars,
    step(dt, axes, running, handbrake, actions) {
      state.time += dt;
      if (state.messageTimer > 0) state.messageTimer -= dt;
      let events = 0;
      events |= stepPlayer(dt, axes, running, actions);
      events |= stepPlayerCar(dt, axes, handbrake);
      stepTraffic(dt);
      stepPeds(dt);
      const policeEvent = stepPolice(dt);
      if (policeEvent) return policeEvent;
      events |= stepCarCollisions(dt);
      events |= stepMissions(dt);
      events |= stepPickups();
      // Wanted decay: slow in the open, fast when no cop can see you.
      const anyCopNear = cars.some((c) => c.isCop && !c.dead && dist(c.x, c.y, player.x, player.y) < 700)
        || cops.some((c) => c.downTimer <= 0 && dist(c.x, c.y, player.x, player.y) < 500);
      if (state.wantedHeat > 0) {
        state.wantedHeat = Math.max(0, state.wantedHeat - (anyCopNear ? WANTED.decayPerSec : WANTED.hideDecayPerSec) * dt);
      }
      const newStars = wantedStars();
      if (newStars !== state.stars) {
        state.stars = newStars;
        if (newStars === 0 && state.wantedHeat === 0 && state.missionState !== 'active') setMessage('You lost the heat. Lay low.', 3);
      }
      state.stars = newStars;
      stepParticles(dt);
      // Autosave every few seconds of play.
      if (Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) save();
      return events;
    },
  };
}
