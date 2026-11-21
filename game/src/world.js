// Solmara's rules and state, with no drawing and no browser in it: the player on
// foot and behind the wheel, traffic, pedestrians, the police, the wanted level,
// Mara Voss's three missions and the hidden cash. step() advances one fixed step
// and returns what happened as bit flags, so the caller can play sounds and save
// without the world knowing about screens or audio.
import {
  AVENUES, BEACH_Y, BUST_FINE, CAR_ACCEL, CAR_BRAKE, CAR_GRIP, CAR_HEALTH,
  CAR_LENGTH, CAR_MAX_REVERSE, CAR_MAX_SPEED, CAR_TURN, CAR_WIDTH, COLORS,
  HEAT_DECAY, HEAT_DECAY_SAFEHOUSE, HEAT_HIT_PED, HEAT_MAX, HEAT_PUNCH_COP,
  HEAT_RAM_COP, HEAT_STEAL, MAX_COP_CARS, MAX_FOOT_COPS, MISSIONS, PED_COUNT,
  PLACES, PLAYER_HEALTH, PLAYER_RADIUS, PUNCH_COOLDOWN, PUNCH_DAMAGE,
  PUNCH_RANGE, RUN_SPEED, SEA_Y, STASH_COUNT, STASH_REWARD, STREETS,
  TRAFFIC_COUNT, WALK_SPEED, WASTED_FEE, WORLD,
} from './config.js';
import { buildCity, districtAt, inPond, inSea, nearestIntersection, onBeach, onRoad, pedSpawnPoints } from './city.js';

export const EVENT_PUNCH = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CRASH = 4;
export const EVENT_STEAL = 8;
export const EVENT_MISSION_DONE = 16;
export const EVENT_MISSION_FAIL = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_HIT_PED = 256;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Push a circle out of every building and out of the water; returns true if it hit anything. */
function collideCircle(state, x, y, r) {
  let hit = false;
  for (const b of state.city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
      } else {
        y -= r;
      }
    }
  }
  if (inSea(x, y)) {
    y = SEA_Y - r;
    hit = true;
  }
  if (inPond(x, y)) {
    const dx = x - 1200;
    const dy = y - 925;
    const len = Math.hypot(dx, dy) || 1;
    x = 1200 + (dx / len) * 132;
    y = 925 + (dy / len) * 80;
    hit = true;
  }
  return { x, y, hit };
}

const TRAFFIC_COLORS = ['#d8d8d8', '#c94f4f', '#4f7ec9', '#5aa85a', '#c9a24f', '#8a6fbf', '#d0d0d0', '#3f6f6f'];
const PED_COLORS = ['#e8e0c8', '#7fb2d9', '#d98a7f', '#9fd49f', '#d9c27f', '#b08ac9', '#e0e0e0', '#c98a4f'];
const PED_NAMES = ['Rosa', 'Dario', 'Lena', 'Marco', 'Ivy', 'Tomas', 'Nia', 'Felix', 'Ada', 'Bruno'];

export function createWorld(random) {
  const city = buildCity(random);
  const state = {
    time: 0,
    cash: 0,
    health: PLAYER_HEALTH,
    heat: 0,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    particles: [],
    messages: [],
    missionIndex: 0,
    mission: null,
    missionsDone: [false, false, false],
    stashesTaken: 0,
    city,
    camera: { x: PLACES.start.x, y: PLACES.start.y },
    busted: 0,
    wasted: 0,
    win: false,
    elapsed: 0,
    copRamCooldown: 0,
    copPunchCooldown: 0,
    lastCrime: -100,
  };

  function say(text) {
    state.messages.push({ text, t: state.time });
    if (state.messages.length > 8) state.messages.shift();
  }

  function stars() {
    return state.heat <= 0 ? 0 : Math.min(5, Math.ceil(state.heat / 100));
  }

  function addHeat(amount) {
    state.heat = clamp(state.heat + amount, 0, HEAT_MAX);
    state.lastCrime = state.time;
  }

  function makeCar(x, y, angle, opts) {
    return {
      x, y, angle, speed: 0,
      health: CAR_HEALTH,
      color: opts.color || '#d8d8d8',
      taxi: !!opts.taxi,
      parked: !!opts.parked,
      isCop: !!opts.isCop,
      isPlayer: false,
      wrecked: false,
      smoke: 0,
      target: null,
      stuck: 0,
      kind: opts.kind || 'traffic',
    };
  }

  function randomRoadPoint() {
    if (random.next() < 0.5) {
      return { x: random.pick(AVENUES), y: random.range(300, BEACH_Y - 100) };
    }
    return { x: random.range(120, WORLD.w - 120), y: random.pick(STREETS) };
  }

  function spawnTrafficCar() {
    const p = randomRoadPoint();
    const angle = random.next() < 0.5 ? 0 : Math.PI / 2;
    const car = makeCar(p.x, p.y, angle, {
      color: random.pick(TRAFFIC_COLORS),
      taxi: random.next() < 0.18,
      kind: 'traffic',
    });
    car.target = nearestIntersection(p.x + random.range(-600, 600), p.y + random.range(-600, 600));
    state.cars.push(car);
    return car;
  }

  function spawnParkedCars() {
    const spots = [
      { x: 1440, y: 640, angle: Math.PI / 2 },
      { x: 1560, y: 760, angle: 0 },
      { x: 2040, y: 1540, angle: Math.PI / 2 },
      { x: 2760, y: 1090, angle: 0 },
      { x: 960, y: 1840, angle: Math.PI / 2 },
      { x: 3240, y: 1990, angle: 0 },
    ];
    for (const s of spots) {
      state.cars.push(makeCar(s.x, s.y, s.angle, {
        color: random.pick(TRAFFIC_COLORS),
        parked: true,
        kind: 'parked',
      }));
    }
  }

  function spawnPeds() {
    const points = pedSpawnPoints(random);
    for (let i = 0; i < PED_COUNT; i += 1) {
      const p = points[i];
      state.peds.push({
        x: p.x, y: p.y,
        angle: random.range(0, TAU),
        speed: random.range(42, 72),
        color: random.pick(PED_COLORS),
        name: random.pick(PED_NAMES),
        wander: random.range(1, 4),
        down: 0,
        flee: 0,
      });
    }
  }

  function reset() {
    state.time = 0;
    state.cash = 0;
    state.health = PLAYER_HEALTH;
    state.heat = 0;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.particles = [];
    state.messages = [];
    state.missionIndex = 0;
    state.mission = null;
    state.missionsDone = [false, false, false];
    state.stashesTaken = 0;
    state.busted = 0;
    state.wasted = 0;
    state.win = false;
    state.elapsed = 0;
    state.copRamCooldown = 0;
    state.copPunchCooldown = 0;
    state.lastCrime = -100;
    for (const s of city.stashes) s.taken = false;
    state.player = {
      x: PLACES.start.x, y: PLACES.start.y, angle: -Math.PI / 2,
      inCar: null, punchCooldown: 0, invulnerable: 0, moving: false,
    };
    state.camera = { x: PLACES.start.x, y: PLACES.start.y };
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar();
    spawnParkedCars();
    spawnPeds();
    say('Welcome to Solmara. Mara Voss has work for you — press ENTER.');
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 220) return;
      const a = random.range(0, TAU);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: random.range(0.4, 1.1), max: 1.1,
        color, size: random.range(3, 7),
      });
    }
  }

  function playerCar() {
    return state.player.inCar;
  }

  function carCircles(car) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    return [
      { x: car.x + fx * 15, y: car.y + fy * 15, r: 12 },
      { x: car.x, y: car.y, r: 13 },
      { x: car.x - fx * 15, y: car.y - fy * 15, r: 12 },
    ];
  }

  function pushCarOutOfBuildings(car) {
    let hit = false;
    for (const c of carCircles(car)) {
      for (const b of city.buildings) {
        const cx = clamp(c.x, b.x, b.x + b.w);
        const cy = clamp(c.y, b.y, b.y + b.h);
        const dx = c.x - cx;
        const dy = c.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < c.r * c.r) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const push = (c.r - d) / d;
            car.x += dx * push;
            car.y += dy * push;
          } else {
            car.y -= c.r;
          }
        }
      }
    }
    if (car.y + 14 >= SEA_Y) {
      car.y = SEA_Y - 14;
      hit = true;
    }
    if (inPond(car.x, car.y)) {
      const dx = car.x - 1200;
      const dy = car.y - 925;
      const len = Math.hypot(dx, dy) || 1;
      car.x = 1200 + (dx / len) * 142;
      car.y = 925 + (dy / len) * 88;
      hit = true;
    }
    return hit;
  }

  function damageCar(car, amount, events) {
    if (car.wrecked) return events;
    car.health -= amount;
    if (car.health <= 0) {
      car.health = 0;
      car.wrecked = true;
      car.speed = 0;
      burst(car.x, car.y, '#ff8c1a', 26, 260);
      burst(car.x, car.y, '#333333', 18, 120);
      if (car.isPlayer) {
        const p = state.player;
        p.inCar = null;
        car.isPlayer = false;
        p.x = car.x + 40;
        p.y = car.y;
        say('Your car is wrecked!');
      }
      return events | EVENT_CRASH;
    }
    return events;
  }

  function startMission(index) {
    const def = MISSIONS[index];
    if (!def || state.missionsDone[index]) return;
    state.missionIndex = index;
    state.mission = {
      def, phase: def.startAt ? 'goto' : 'go',
      timer: def.timeLimit || 0,
      active: true,
    };
    if (def.wantedOnStart) addHeat(def.wantedOnStart);
    say(`${def.name}: ${def.brief}`);
  }

  function completeMission() {
    const m = state.mission;
    if (!m) return EVENT_MISSION_DONE;
    const reward = m.def.reward;
    state.cash += reward;
    state.missionsDone[state.missionIndex] = true;
    say(`${m.def.name} complete! +$${reward}`);
    state.mission = null;
    if (state.missionsDone.every(Boolean)) {
      state.win = true;
      say('All missions done — Solmara is yours. You win!');
    } else if (state.missionIndex + 1 < MISSIONS.length) {
      startMission(state.missionIndex + 1);
    }
    return EVENT_MISSION_DONE;
  }

  function failMission(reason) {
    say(`Mission failed: ${reason}. Press ENTER to retry.`);
    state.mission = null;
    return EVENT_MISSION_FAIL;
  }

  function bustPlayer() {
    const fine = Math.min(state.cash, BUST_FINE);
    state.cash -= fine;
    state.heat = 0;
    state.health = PLAYER_HEALTH;
    state.busted = 2.5;
    const p = state.player;
    if (p.inCar) {
      p.inCar.isPlayer = false;
      p.inCar = null;
    }
    p.x = PLACES.policeHq.x;
    p.y = PLACES.policeHq.y;
    state.cops = [];
    state.cars = state.cars.filter((c) => !c.isCop);
    say(`Busted! Fine $${fine}. The cops let you off at HQ.`);
    return EVENT_BUSTED;
  }

  function wastePlayer() {
    const fee = Math.min(state.cash, WASTED_FEE);
    state.cash -= fee;
    state.heat = 0;
    state.health = PLAYER_HEALTH;
    state.wasted = 2.5;
    const p = state.player;
    if (p.inCar) {
      p.inCar.isPlayer = false;
      p.inCar = null;
    }
    p.x = PLACES.hospital.x;
    p.y = PLACES.hospital.y;
    say(`Wasted! Hospital bill $${fee}.`);
    return EVENT_WASTED;
  }

  function driveCar(car, throttle, steer, dt, handbrake) {
    const top = car.isCop ? 540 : CAR_MAX_SPEED;
    if (throttle > 0) car.speed += CAR_ACCEL * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0) car.speed -= CAR_BRAKE * dt;
      else car.speed += CAR_ACCEL * 0.6 * dt;
    }
    if (car.speed > top) car.speed = top;
    if (car.speed < -CAR_MAX_REVERSE) car.speed = -CAR_MAX_REVERSE;
    // Drag and rolling resistance, heavier on sand.
    const sand = onBeach(car.x, car.y) ? 1.6 : 1;
    car.speed -= car.speed * 0.35 * sand * dt;
    if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
    const grip = handbrake ? 1.4 : CAR_GRIP;
    const turnRate = CAR_TURN * clamp(Math.abs(car.speed) / 220, 0, 1) * (handbrake ? 1.5 : 1);
    car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 20, WORLD.w - 20);
    car.y = clamp(car.y, 20, WORLD.h - 20);
    return grip;
  }

  function steerToward(car, tx, ty) {
    const want = Math.atan2(ty - car.y, tx - car.x);
    return clamp(angleDiff(want, car.angle) * 2.2, -1, 1);
  }

  function nextWaypoint(car) {
    // Pick a neighbouring intersection that gets closer to the player's block.
    const ix = nearestIntersection(state.player.x, state.player.y);
    const here = nearestIntersection(car.x, car.y);
    const options = [];
    for (const ax of AVENUES) options.push({ x: ax, y: here.y });
    for (const sy of STREETS) options.push({ x: here.x, y: sy });
    let best = options[0];
    let bestD = Infinity;
    for (const o of options) {
      if (o.x === here.x && o.y === here.y) continue;
      const d = dist(o.x, o.y, ix.x, ix.y) + random.range(0, 120);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    car.target = best;
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.isPlayer || car.wrecked || car.isCop || car.parked) continue;
      if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 70) {
        car.target = nearestIntersection(car.x + random.range(-700, 700), car.y + random.range(-700, 700));
      }
      // Ease off when another car is right ahead.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.wrecked) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        if (ahead > 0 && ahead < 64 && Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle)) < 26) {
          blocked = true;
          break;
        }
      }
      const throttle = blocked ? 0 : 0.55;
      driveCar(car, throttle, steerToward(car, car.target.x, car.target.y), dt, false);
      if (Math.abs(car.speed) < 8) {
        car.stuck += dt;
        if (car.stuck > 4) {
          const p = randomRoadPoint();
          car.x = p.x;
          car.y = p.y;
          car.angle = 0;
          car.speed = 0;
          car.stuck = 0;
        }
      } else {
        car.stuck = 0;
      }
      if (pushCarOutOfBuildings(car)) car.speed *= 0.4;
    }
  }

  function updatePeds(dt, events) {
    const pc = playerCar();
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      ped.wander -= dt;
      // Flee a fast car bearing down on them.
      let fleeX = 0;
      let fleeY = 0;
      if (pc && Math.abs(pc.speed) > 120) {
        const d = dist(ped.x, ped.y, pc.x, pc.y);
        if (d < 130) {
          fleeX = (ped.x - pc.x) / d;
          fleeY = (ped.y - pc.y) / d;
          ped.flee = 1.2;
        }
      }
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.angle = Math.atan2(fleeY, fleeX);
      } else if (ped.wander <= 0) {
        ped.wander = random.range(1.5, 5);
        ped.angle = random.range(0, TAU);
      }
      const speed = ped.flee > 0 ? ped.speed * 2.1 : ped.speed;
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      const fixed = collideCircle(state, nx, ny, 10);
      if (fixed.hit) {
        ped.angle = random.range(0, TAU);
      } else {
        ped.x = nx;
        ped.y = ny;
      }
      ped.x = clamp(ped.x, 20, WORLD.w - 20);
      ped.y = clamp(ped.y, 20, BEACH_Y - 6);
      // Run over by the player's car.
      if (pc && Math.abs(pc.speed) > 80 && dist(ped.x, ped.y, pc.x, pc.y) < 26) {
        ped.down = 2.5;
        burst(ped.x, ped.y, '#ff5d5d', 10, 140);
        addHeat(HEAT_HIT_PED);
        say(`You hit ${ped.name}! The law noticed.`);
        events |= EVENT_HIT_PED | EVENT_CRASH;
      }
    }
    return events;
  }

  function updateCops(dt, events) {
    const want = stars();
    const wantedCars = want > 0 ? Math.min(1 + want, MAX_COP_CARS) : 0;
    const activeCopCars = state.cars.filter((c) => c.isCop && !c.wrecked);
    if (activeCopCars.length < wantedCars) {
      // Spawn on a road far from the player.
      let px;
      let py;
      let guard = 0;
      do {
        const p = randomRoadPoint();
        px = p.x;
        py = p.y;
        guard += 1;
      } while (dist(px, py, state.player.x, state.player.y) < 750 && guard < 12);
      const cop = makeCar(px, py, 0, { color: COLORS.copCar, isCop: true, kind: 'cop' });
      cop.target = nearestIntersection(state.player.x, state.player.y);
      state.cars.push(cop);
      if (want >= 3) say('Police are closing in!');
    }
    const pc = playerCar();
    for (const cop of state.cars) {
      if (!cop.isCop || cop.wrecked) continue;
      const dPlayer = dist(cop.x, cop.y, state.player.x, state.player.y);
      if (want === 0 || dPlayer > 1600) {
        // Called off: drive away and leave.
        if (want === 0) {
          state.cars = state.cars.filter((c) => c !== cop);
          continue;
        }
      }
      if (dPlayer < 170 && pc) {
        // Ram the player's car.
        driveCar(cop, 1, steerToward(cop, state.player.x, state.player.y), dt, false);
      } else {
        if (!cop.target || dist(cop.x, cop.y, cop.target.x, cop.target.y) < 70) nextWaypoint(cop);
        driveCar(cop, 0.9, steerToward(cop, cop.target.x, cop.target.y), dt, false);
      }
      if (pushCarOutOfBuildings(cop)) cop.speed *= 0.5;
      // Ramming the player's car.
      if (pc && dPlayer < 42 && state.copRamCooldown <= 0) {
        state.copRamCooldown = 1.2;
        const impact = Math.abs(cop.speed) + Math.abs(pc.speed);
        events = damageCar(pc, impact / 14, events);
        cop.speed *= -0.3;
        pc.speed *= 0.55;
        burst(pc.x, pc.y, '#ffd94a', 12, 200);
        addHeat(HEAT_RAM_COP);
        say('A cop car rammed you!');
        events |= EVENT_CRASH;
      }
      // Cop cars that are far away and unwanted despawn quietly.
      if (dPlayer > 1700 && want === 0) state.cars = state.cars.filter((c) => c !== cop);
    }
    state.copRamCooldown = Math.max(0, state.copRamCooldown - dt);

    // Foot cops: only once the heat is real, and only up to two at a time.
    if (want >= 2 && state.cops.length < MAX_FOOT_COPS && random.next() < dt * 0.5) {
      state.cops.push({
        x: PLACES.policeHq.x + random.range(-40, 40),
        y: PLACES.policeHq.y + random.range(-40, 40),
        angle: 0, bust: 0, punch: 0,
      });
      say('Foot patrol is on you!');
    }
    const p = state.player;
    for (const cop of state.cops) {
      const d = dist(cop.x, cop.y, p.x, p.y);
      cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
      if (p.inCar) {
        // A foot cop cannot catch a car: jog back toward HQ.
        cop.x += Math.cos(Math.atan2(PLACES.policeHq.y - cop.y, PLACES.policeHq.x - cop.x)) * 120 * dt;
        cop.y += Math.sin(Math.atan2(PLACES.policeHq.y - cop.y, PLACES.policeHq.x - cop.x)) * 120 * dt;
        cop.bust = 0;
        continue;
      }
      const nx = cop.x + Math.cos(cop.angle) * 238 * dt;
      const ny = cop.y + Math.sin(cop.angle) * 238 * dt;
      const fixed = collideCircle(state, nx, ny, 12);
      cop.x = fixed.x;
      cop.y = fixed.y;
      if (d < 30) {
        cop.bust += dt;
        cop.punch -= dt;
        if (cop.punch <= 0) {
          cop.punch = 0.85;
          state.health -= 8;
          burst(p.x, p.y, '#ffffff', 6, 120);
          say('A cop is beating you down!');
          if (state.health <= 0) return { events: wastePlayer(), done: true };
        }
        if (cop.bust > 1.2) return { events: bustPlayer(), done: true };
      } else {
        cop.bust = 0;
      }
    }
    return { events, done: false };
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  function checkStash(events) {
    const p = state.player;
    if (p.inCar) return events;
    for (const s of city.stashes) {
      if (!s.taken && dist(p.x, p.y, s.x, s.y) < 28) {
        s.taken = true;
        state.stashesTaken += 1;
        state.cash += STASH_REWARD;
        burst(s.x, s.y, COLORS.gold, 14, 160);
        say(`Cash stash found! +$${STASH_REWARD}`);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function checkMission(dt, events) {
    const m = state.mission;
    if (!m || !m.active) return events;
    const p = state.player;
    const pc = playerCar();
    if (m.def.timeLimit && m.phase === 'timed') {
      m.timer -= dt;
      if (m.timer <= 0) return failMission('the delivery was too slow');
    }
    if (state.missionIndex === 0) {
      if (pc && dist(p.x, p.y, m.def.target.x, m.def.target.y) < 110) {
        return completeMission();
      }
    } else if (state.missionIndex === 1) {
      if (m.phase === 'goto') {
        if (dist(p.x, p.y, m.def.startAt.x, m.def.startAt.y) < 100) {
          m.phase = 'timed';
          m.timer = m.def.timeLimit;
          say('Package picked up! 100 seconds to the Tower — go!');
        }
      } else if (pc && dist(p.x, p.y, m.def.target.x, m.def.target.y) < 110) {
        return completeMission();
      }
    } else if (state.missionIndex === 2) {
      const nearHouse = dist(p.x, p.y, m.def.target.x, m.def.target.y) < 150;
      if (nearHouse && state.heat <= 0) return completeMission();
    }
    return events;
  }

  function stepPlayer(dt, ctrl, events) {
    const p = state.player;
    const pc = playerCar();
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;

    if (pc) {
      // Driving.
      const throttle = -ctrl.y;
      const steer = ctrl.x;
      const before = pc.speed;
      driveCar(pc, throttle, steer, dt, ctrl.brake);
      // The player rides with the car: missions, the camera and the cops all
      // read the player's position, so it tracks the car while driving.
      p.x = pc.x;
      p.y = pc.y;
      if (Math.abs(pc.speed) > 300 && random.next() < dt * 6) {
        state.particles.push({
          x: pc.x - Math.cos(pc.angle) * 22, y: pc.y - Math.sin(pc.angle) * 22,
          vx: -Math.cos(pc.angle) * 40, vy: -Math.sin(pc.angle) * 40,
          life: 0.5, max: 0.5, color: '#999999', size: 5,
        });
      }
      if (pushCarOutOfBuildings(pc)) {
        const impact = Math.abs(before);
        if (impact > 190) {
          events = damageCar(pc, (impact - 190) / 16, events);
          burst(pc.x, pc.y, '#ffd94a', 10, 180);
          events |= EVENT_CRASH;
          if (impact > 320) {
            state.health -= 6;
            say('That crash hurt!');
          }
        }
        pc.speed *= 0.45;
      }
      // Bump into other cars.
      for (const other of state.cars) {
        if (other === pc || other.wrecked) continue;
        const d = dist(pc.x, pc.y, other.x, other.y);
        if (d < 40 && d > 0.01) {
          const push = (40 - d) / 2;
          const nx = (pc.x - other.x) / d;
          const ny = (pc.y - other.y) / d;
          pc.x += nx * push;
          pc.y += ny * push;
          other.x -= nx * push;
          other.y -= ny * push;
          const closing = Math.abs(pc.speed - other.speed);
          if (closing > 140) {
            events = damageCar(pc, closing / 22, events);
            events = damageCar(other, closing / 22, events);
            if (other.isCop) addHeat(HEAT_RAM_COP);
            burst(pc.x, pc.y, '#ffd94a', 8, 160);
            events |= EVENT_CRASH;
          }
          pc.speed *= 0.7;
          other.speed *= 0.7;
        }
      }
      if (pc.health < 35 && random.next() < dt * 8) {
        state.particles.push({
          x: pc.x, y: pc.y - 8,
          vx: random.range(-12, 12), vy: random.range(-40, -16),
          life: 0.9, max: 0.9, color: '#666666', size: 7,
        });
      }
    } else {
      // On foot.
      const len = Math.hypot(ctrl.x, ctrl.y);
      p.moving = len > 0;
      if (len > 0) {
        const speed = ctrl.run ? RUN_SPEED : WALK_SPEED;
        const nx = p.x + (ctrl.x / len) * speed * dt;
        const ny = p.y + (ctrl.y / len) * speed * dt;
        p.angle = Math.atan2(ctrl.y, ctrl.x);
        const fixed = collideCircle(state, nx, ny, PLAYER_RADIUS);
        p.x = fixed.x;
        p.y = fixed.y;
      }
      // Health comes back when the law is not looking.
      if (state.heat === 0 && state.health < PLAYER_HEALTH) {
        state.health = Math.min(PLAYER_HEALTH, state.health + 1.5 * dt);
      }
    }
    return events;
  }

  function stepInteract(ctrl, events) {
    const p = state.player;
    if (ctrl.interact) {
      if (p.inCar) {
        const car = p.inCar;
        car.isPlayer = false;
        car.parked = true;
        car.speed = 0;
        p.inCar = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        const fixed = collideCircle(state, p.x, p.y, PLAYER_RADIUS);
        p.x = fixed.x;
        p.y = fixed.y;
        say('You left the car.');
      } else {
        let best = null;
        let bestD = 46;
        for (const car of state.cars) {
          if (car.wrecked) continue;
          const d = dist(p.x, p.y, car.x, car.y);
          if (d < bestD) {
            bestD = d;
            best = car;
          }
        }
        if (best) {
          const wasTraffic = best.kind === 'traffic';
          best.isPlayer = true;
          best.parked = false;
          best.kind = 'player';
          p.inCar = best;
          addHeat(HEAT_STEAL);
          burst(best.x, best.y, COLORS.gold, 8, 120);
          say(wasTraffic ? 'You jacked a moving car! The law noticed.' : 'You stole a parked car! The law noticed.');
          events |= EVENT_STEAL;
        }
      }
    }
    if (ctrl.punch && !p.inCar && p.punchCooldown <= 0) {
      p.punchCooldown = PUNCH_COOLDOWN;
      events |= EVENT_PUNCH;
      const fx = p.x + Math.cos(p.angle) * PUNCH_RANGE;
      const fy = p.y + Math.sin(p.angle) * PUNCH_RANGE;
      burst(fx, fy, '#ffffff', 6, 130);
      // A cop in range takes the punch.
      for (const cop of state.cops) {
        if (dist(fx, fy, cop.x, cop.y) < 30) {
          state.cops = state.cops.filter((c) => c !== cop);
          addHeat(HEAT_PUNCH_COP);
          say('You decked a cop! That will cost you.');
          break;
        }
      }
      // A pedestrian in range goes down.
      for (const ped of state.peds) {
        if (ped.down === 0 && dist(fx, fy, ped.x, ped.y) < 28) {
          ped.down = 2.5;
          addHeat(15);
          say(`You punched ${ped.name}!`);
          break;
        }
      }
    }
    return events;
  }

  /**
   * One fixed step. `ctrl` is { x, y, run, brake, interact, punch } from the input
   * layer; one-shot flags are consumed by the caller after this call. Returns the
   * EVENT_* flags for sounds and announcements.
   */
  function step(dt, ctrl) {
    let events = 0;
    state.time += dt;
    state.elapsed += dt;
    if (state.busted > 0) {
      state.busted -= dt;
      updateParticles(dt);
      return events;
    }
    if (state.wasted > 0) {
      state.wasted -= dt;
      updateParticles(dt);
      return events;
    }

    events = stepInteract(ctrl, events);
    events = stepPlayer(dt, ctrl, events);
    updateTraffic(dt);
    events = updatePeds(dt, events);
    const copResult = updateCops(dt, events);
    events = copResult.events;
    if (copResult.done) {
      updateParticles(dt);
      return events;
    }

    // Heat fades when you lay low; faster at the safehouse.
    const p = state.player;
    const nearHouse = dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 150;
    if (state.time - state.lastCrime > 8) {
      state.heat = Math.max(0, state.heat - (nearHouse ? HEAT_DECAY_SAFEHOUSE : HEAT_DECAY) * dt);
    }
    events = checkStash(events);
    events = checkMission(dt, events);
    updateParticles(dt);

    // The camera chases the player, clamped to the world.
    state.camera.x = clamp(p.x, 640, WORLD.w - 640);
    state.camera.y = clamp(p.y, 400, WORLD.h - 400);
    return events;
  }

  reset();
  return {
    state, reset, step, startMission, addHeat, stars, say,
    districtAt: (x, y) => districtAt(x, y),
  };
}
