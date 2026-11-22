// SOLMARA's world: the city, its people and cars, the wanted system, the
// missions, and the fixed-step simulation. The city is built once per world;
// reset() only deals a fresh set of people, cars and missions, so a restart
// keeps the same streets.
import {
  WORLD, PLAYER, CAR, PED, TRAFFIC, PARKED, TAXI, PED_COUNT, COP_CAR_MAX,
  STAR_HEAT, HEAT_MAX, HEAT_DECAY, HEAT, FINES, STASH_VALUE, MISSIONS,
  PLACES, ROADS_X, ROADS_Y, ROAD_W, SEA_X, BEACH_X,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_WIN = 8;

export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;

const TAU = Math.PI * 2;
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

function buildCity(rng) {
  const park = { x0: 550, y0: 1500, x1: 1100, y1: 2000, pond: { x: 825, y: 1750, rx: 120, ry: 70 } };
  const buildings = [];
  for (let i = 0; i < ROADS_X.length - 1; i += 1) {
    for (let j = 0; j < ROADS_Y.length - 1; j += 1) {
      const x0 = ROADS_X[i] + ROAD_W / 2 + 24;
      const x1 = ROADS_X[i + 1] - ROAD_W / 2 - 24;
      const y0 = ROADS_Y[j] + ROAD_W / 2 + 24;
      const y1 = ROADS_Y[j + 1] - ROAD_W / 2 - 24;
      if (x1 - x0 < 90 || y1 - y0 < 80) continue;
      if (x1 > park.x0 && x0 < park.x1 && y1 > park.y0 && y0 < park.y1) continue;
      if (x0 > BEACH_X - 60) continue;
      const n = rng.int(1, 2);
      for (let k = 0; k < n; k += 1) {
        const w = rng.range(70, 150);
        const h = rng.range(60, 120);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const x = rng.range(x0, Math.max(x0, x1 - w));
          const y = rng.range(y0, Math.max(y0, y1 - h));
          if (buildings.some((o) => x < o.x + o.w + 20 && x + w + 20 > o.x && y < o.y + o.h + 20 && y + h + 20 > o.y)) continue;
          buildings.push({ x, y, w, h, downtown: x > 1100 && x < 2300 && y > 650 && y < 1350 });
          break;
        }
      }
    }
  }
  const trees = [];
  for (let i = 0; i < 130; i += 1) {
    const x = rng.range(80, WORLD.width - 80);
    const y = rng.range(80, WORLD.height - 80);
    if (x > SEA_X - 40) continue;
    trees.push({ x, y, s: rng.range(10, 18) });
  }
  return { buildings, trees, park };
}

function roadPoint(rng) {
  if (rng.chance(0.5)) return { x: rng.pick(ROADS_X), y: rng.range(200, WORLD.height - 200) };
  return { x: rng.range(200, BEACH_X - 100), y: rng.pick(ROADS_Y) };
}

export function createWorld(rng) {
  const city = buildCity(rng);
  const state = {
    time: 0,
    cityRef: city,
    cash: 0,
    heat: 0,
    stars: 0,
    lastCrime: -99,
    player: { x: PLACES.spawn.x, y: PLACES.spawn.y, angle: 0, hp: PLAYER.maxHealth, inCar: false, carId: -1, punchT: 0, running: false },
    cars: [],
    peds: [],
    cops: [],
    stashes: [],
    missionIndex: 0,
    missionActive: false,
    missionStage: 0,
    missionTimer: 0,
    missionDone: [false, false, false],
    won: false,
    messages: [],
    sound: null,
    copSpawnT: 0,
    footSpawnT: 0,
  };
  let nextCarId = 1;

  function addMessage(text) {
    state.messages.push(text);
    if (state.messages.length > 6) state.messages.shift();
  }
  function playSound(name) {
    state.sound = name;
  }
  function starsFor(heat) {
    let s = 0;
    for (let i = 0; i < STAR_HEAT.length; i += 1) if (heat >= STAR_HEAT[i]) s = i + 1;
    return s;
  }

  function blocked(x, y, r) {
    if (x < r || x > WORLD.width - r || y < r || y > WORLD.height - r) return true;
    if (x > SEA_X - r) return true;
    const p = city.park.pond;
    const px = (x - p.x) / (p.rx + r);
    const py = (y - p.y) / (p.ry + r);
    if (px * px + py * py < 1) return true;
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
    }
    return false;
  }

  function moveCircle(e, dx, dy, r) {
    let hit = false;
    const nx = e.x + dx;
    if (!blocked(nx, e.y, r)) e.x = nx;
    else hit = true;
    const ny = e.y + dy;
    if (!blocked(e.x, ny, r)) e.y = ny;
    else hit = true;
    return hit;
  }

  function spawnCar(kind) {
    const p = roadPoint(rng);
    const alongX = rng.chance(0.5);
    const car = {
      id: nextCarId,
      x: p.x,
      y: p.y,
      angle: alongX ? (rng.chance(0.5) ? 0 : Math.PI) : rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2,
      speed: 0,
      color: '',
      parked: false,
      taxi: false,
      police: false,
      hp: CAR.maxHealth,
      wrecked: false,
      driver: 'traffic',
      cruise: rng.range(TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
      tx: p.x,
      ty: p.y,
      dmgT: 0,
      ramT: 0,
      hitT: 0,
    };
    nextCarId += 1;
    if (kind === 'parked') {
      car.parked = true;
      car.driver = null;
      car.x = rng.pick(ROADS_X) + (rng.chance(0.5) ? 46 : -46);
      car.y = rng.range(200, WORLD.height - 200);
      car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else if (kind === 'taxi') {
      car.taxi = true;
      car.cruise = TRAFFIC.maxSpeed;
    }
    const palette = ['#e8b73a', '#c94f43', '#4f8ac9', '#7a9a4f', '#b8bcc2', '#8a5fc9', '#d97b2f'];
    car.color = car.taxi ? '#f2c94c' : rng.pick(palette);
    car.tx = rng.pick(ROADS_X);
    car.ty = rng.pick(ROADS_Y);
    state.cars.push(car);
    return car;
  }

  function spawnPed() {
    const p = roadPoint(rng);
    state.peds.push({
      x: clamp(p.x + rng.range(-50, 50), 40, BEACH_X - 40),
      y: clamp(p.y + rng.range(-50, 50), 40, WORLD.height - 40),
      angle: rng.range(0, TAU),
      speed: rng.range(PED.minSpeed, PED.maxSpeed),
      tx: p.x,
      ty: p.y,
      down: 0,
      flee: 0,
    });
  }

  function spawnStashes() {
    state.stashes = [];
    for (let i = 0; i < 10; i += 1) {
      const onX = rng.chance(0.5);
      const x = onX ? rng.pick(ROADS_X) + (rng.chance(0.5) ? 46 : -46) : rng.range(200, BEACH_X - 100);
      const y = onX ? rng.range(200, WORLD.height - 200) : rng.pick(ROADS_Y) + (rng.chance(0.5) ? 46 : -46);
      state.stashes.push({ x: clamp(x, 60, BEACH_X - 60), y: clamp(y, 60, WORLD.height - 60), taken: false });
    }
  }

  function reset() {
    state.time = 0;
    state.cash = 0;
    state.heat = 0;
    state.stars = 0;
    state.lastCrime = -99;
    state.player = { x: PLACES.spawn.x, y: PLACES.spawn.y, angle: 0, hp: PLAYER.maxHealth, inCar: false, carId: -1, punchT: 0, running: false };
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.missionIndex = 0;
    state.missionActive = false;
    state.missionStage = 0;
    state.missionTimer = 0;
    state.missionDone = [false, false, false];
    state.won = false;
    state.messages = [];
    state.sound = null;
    state.copSpawnT = 0;
    state.footSpawnT = 0;
    nextCarId = 1;
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnCar('traffic');
    for (let i = 0; i < PARKED.count; i += 1) spawnCar('parked');
    for (let i = 0; i < TAXI.count; i += 1) spawnCar('taxi');
    for (let i = 0; i < PED_COUNT; i += 1) spawnPed();
    spawnStashes();
    addMessage('Welcome to Solmara. Press ENTER to take a job from Mara Voss.');
  }

  function addHeat(n) {
    state.heat = clamp(state.heat + n, 0, HEAT_MAX);
    state.lastCrime = state.time;
    state.stars = starsFor(state.heat);
  }

  function playerCar() {
    return state.cars.find((c) => c.id === state.player.carId) ?? null;
  }

  function damageCar(car, n) {
    if (car.wrecked) return;
    car.hp -= n;
    if (car.hp <= 0) {
      car.hp = 0;
      car.wrecked = true;
      car.speed = 0;
      if (state.player.inCar && state.player.carId === car.id) {
        state.player.inCar = false;
        state.player.carId = -1;
        state.player.x = clamp(car.x + 40, 30, WORLD.width - 30);
        state.player.y = clamp(car.y, 30, WORLD.height - 30);
      }
      playSound('crash');
      addMessage('Car wrecked!');
    }
  }

  function startMission() {
    if (state.missionActive || state.missionIndex > 2 || state.won) return false;
    const m = MISSIONS[state.missionIndex];
    state.missionActive = true;
    state.missionStage = 0;
    state.missionTimer = 0;
    addMessage(`${m.name} — ${m.brief}`);
    playSound('jingle');
    return true;
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    state.cash += m.reward;
    state.missionDone[state.missionIndex] = true;
    state.missionActive = false;
    state.missionIndex += 1;
    addMessage(`${m.name} complete! +$${m.reward}`);
    playSound('jingle');
    if (state.missionIndex > 2) {
      state.won = true;
      addMessage('ALL MISSIONS COMPLETE — Solmara is yours!');
      return EVENT_MISSION | EVENT_WIN;
    }
    return EVENT_MISSION;
  }

  function failMission(text) {
    state.missionActive = false;
    addMessage(text);
  }

  function busted() {
    state.cash = Math.max(0, state.cash - FINES.busted);
    state.player.hp = PLAYER.maxHealth;
    state.player.inCar = false;
    state.player.carId = -1;
    state.player.x = PLACES.policeHQ.x;
    state.player.y = PLACES.policeHQ.y;
    state.heat = 0;
    state.stars = 0;
    state.cars = state.cars.filter((c) => !c.police);
    state.cops = [];
    addMessage(`BUSTED! -$${FINES.busted} fine. Released at Police HQ.`);
    playSound('busted');
    return EVENT_BUSTED;
  }

  function wasted() {
    state.cash = Math.max(0, state.cash - FINES.wasted);
    state.player.hp = PLAYER.maxHealth;
    state.player.inCar = false;
    state.player.carId = -1;
    state.player.x = PLACES.hospital.x;
    state.player.y = PLACES.hospital.y;
    state.heat = Math.floor(state.heat / 2);
    state.stars = starsFor(state.heat);
    state.cars = state.cars.filter((c) => !c.police);
    state.cops = [];
    addMessage(`WASTED! -$${FINES.wasted} fine. You wake up at the hospital.`);
    playSound('wasted');
    return EVENT_WASTED;
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of state.cars) {
      if (c.wrecked) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function updatePlayer(dt, controls) {
    const p = state.player;
    if (p.punchT > 0) p.punchT -= dt;
    if (p.inCar) {
      const car = playerCar();
      if (!car) {
        p.inCar = false;
        p.carId = -1;
        return;
      }
      const d = controls.drive;
      if (d.throttle > 0) car.speed += CAR.accel * dt;
      else if (d.throttle < 0) {
        if (car.speed > 10) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.accel * 0.5 * dt;
      }
      if (d.handbrake) car.speed -= Math.sign(car.speed) * 900 * dt;
      car.speed -= car.speed * 0.5 * dt;
      let max = CAR.maxSpeed;
      if (car.x > BEACH_X) max = 260;
      car.speed = clamp(car.speed, -CAR.reverseMax, max);
      const steerAuthority = clamp(Math.abs(car.speed) / 200, 0, 1) * (car.speed < 0 ? -1 : 1);
      car.angle += d.steer * CAR.steer * dt * steerAuthority * (d.handbrake ? 1.6 : 1);
      const hit = moveCircle(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, CAR.radius);
      if (hit && Math.abs(car.speed) > 180) {
        damageCar(car, (Math.abs(car.speed) - 180) / 12);
        playSound('crash');
        car.speed *= 0.4;
      } else if (hit) {
        car.speed *= 0.5;
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      return;
    }
    const mv = controls.move;
    const len = Math.hypot(mv.x, mv.y);
    if (len > 0) {
      const sp = controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.running = controls.run;
      p.angle = Math.atan2(mv.y, mv.x);
      moveCircle(p, (mv.x / len) * sp * dt, (mv.y / len) * sp * dt, PLAYER.radius);
    } else {
      p.running = false;
    }
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.driver !== 'traffic' && car.driver !== 'taxi') continue;
      if (car.wrecked) continue;
      const dx = car.tx - car.x;
      const dy = car.ty - car.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
        car.tx = rng.pick(ROADS_X);
        car.ty = rng.pick(ROADS_Y);
        continue;
      }
      let blockedAhead = false;
      for (const other of state.cars) {
        if (other === car || other.wrecked) continue;
        const ox = other.x - car.x;
        const oy = other.y - car.y;
        const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
        const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
        if (along > 0 && along < 64 && side < 30) {
          blockedAhead = true;
          break;
        }
      }
      const speed = blockedAhead ? 0 : car.cruise;
      let stepX = 0;
      let stepY = 0;
      if (Math.abs(dx) > 24) {
        stepX = Math.sign(dx) * speed * dt;
        car.angle = angleLerp(car.angle, dx > 0 ? 0 : Math.PI, 0.2);
      } else {
        stepY = Math.sign(dy) * speed * dt;
        car.angle = angleLerp(car.angle, dy > 0 ? Math.PI / 2 : -Math.PI / 2, 0.2);
      }
      const hit = moveCircle(car, stepX, stepY, CAR.radius);
      if (hit) {
        car.tx = rng.pick(ROADS_X);
        car.ty = rng.pick(ROADS_Y);
      }
      car.speed = speed;
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    const pc = p.inCar ? playerCar() : null;
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      let tx = ped.tx;
      let ty = ped.ty;
      let speed = ped.speed;
      if (pc && Math.abs(pc.speed) > 200 && dist(ped.x, ped.y, pc.x, pc.y) < 110) {
        const a = angleTo(pc.x, pc.y, ped.x, ped.y);
        tx = ped.x + Math.cos(a) * 200;
        ty = ped.y + Math.sin(a) * 200;
        speed = ped.speed * 2.2;
      } else if (p.inCar === false && dist(ped.x, ped.y, p.x, p.y) < 60 && Math.abs(p.x - ped.x) + Math.abs(p.y - ped.y) < 90) {
        const a = angleTo(p.x, p.y, ped.x, ped.y);
        tx = ped.x + Math.cos(a) * 200;
        ty = ped.y + Math.sin(a) * 200;
        speed = ped.speed * 2;
      }
      const dx = tx - ped.x;
      const dy = ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 16) {
        const np = roadPoint(rng);
        ped.tx = clamp(np.x + rng.range(-50, 50), 40, BEACH_X - 40);
        ped.ty = clamp(np.y + rng.range(-50, 50), 40, WORLD.height - 40);
        continue;
      }
      ped.angle = angleLerp(ped.angle, Math.atan2(dy, dx), 0.15);
      moveCircle(ped, (dx / d) * speed * dt, (dy / d) * speed * dt, PED.radius);
    }
  }

  function nearestRoadPoint(x, y) {
    let bx = ROADS_X[0];
    let bd = Math.abs(x - bx);
    for (const rx of ROADS_X) if (Math.abs(x - rx) < bd) {
      bd = Math.abs(x - rx);
      bx = rx;
    }
    let by = ROADS_Y[0];
    bd = Math.abs(y - by);
    for (const ry of ROADS_Y) if (Math.abs(y - ry) < bd) {
      bd = Math.abs(y - ry);
      by = ry;
    }
    return { x: bx, y: by };
  }

  function spawnCopCar() {
    const p = state.player;
    const spots = [];
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        const d = dist(rx, ry, p.x, p.y);
        if (d > 420 && d < 900) spots.push({ x: rx, y: ry });
      }
    }
    if (spots.length === 0) return;
    const s = spots[Math.floor(rng.next() * spots.length)];
    const car = {
      id: nextCarId,
      x: s.x,
      y: s.y,
      angle: 0,
      speed: 0,
      color: '#3a6fd8',
      parked: false,
      taxi: false,
      police: true,
      hp: CAR.maxHealth,
      wrecked: false,
      driver: 'cop',
      cruise: 380,
      tx: p.x,
      ty: p.y,
      repick: 0,
      dmgT: 0,
      ramT: 0,
      hitT: 0,
    };
    nextCarId += 1;
    state.cars.push(car);
  }

  function updateCopCars(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.driver !== 'cop' || car.wrecked) continue;
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const d = Math.hypot(dx, dy);
      car.repick -= dt;
      if (d < 170) {
        // Close in: ram the player straight on.
        car.angle = angleLerp(car.angle, Math.atan2(dy, dx), 0.25);
        car.speed = 430;
        moveCircle(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, CAR.radius);
      } else {
        if (car.repick <= 0) {
          const near = nearestRoadPoint(p.x, p.y);
          car.tx = near.x;
          car.ty = near.y;
          car.repick = 2;
        }
        const tdx = car.tx - car.x;
        const tdy = car.ty - car.y;
        let stepX = 0;
        let stepY = 0;
        if (Math.abs(tdx) > 24) {
          stepX = Math.sign(tdx) * car.cruise * dt;
          car.angle = angleLerp(car.angle, tdx > 0 ? 0 : Math.PI, 0.2);
        } else {
          stepY = Math.sign(tdy) * car.cruise * dt;
          car.angle = angleLerp(car.angle, tdy > 0 ? Math.PI / 2 : -Math.PI / 2, 0.2);
        }
        const hit = moveCircle(car, stepX, stepY, CAR.radius);
        if (hit) car.repick = 0;
        car.speed = car.cruise;
      }
      // Ramming the player: damage is rate-limited, or a touch would shred
      // a car in under a second of contact.
      if (p.inCar) {
        const pc = playerCar();
        if (pc && dist(car.x, car.y, pc.x, pc.y) < 46 && car.ramT <= 0) {
          damageCar(pc, 5);
          damageCar(car, 3);
          car.speed *= 0.5;
          car.ramT = 0.6;
        }
      } else if (dist(car.x, car.y, p.x, p.y) < 40 && car.hitT <= 0) {
        p.hp -= 12;
        playSound('crash');
        const a = angleTo(car.x, car.y, p.x, p.y);
        moveCircle(p, Math.cos(a) * 60, Math.sin(a) * 60, PLAYER.radius);
        car.speed *= 0.3;
        car.hitT = 0.8;
      }
      if (car.hp <= 0 && !car.wrecked) {
        car.wrecked = true;
        car.speed = 0;
      }
    }
  }

  function updateFootCops(dt) {
    const p = state.player;
    for (const cop of state.cops) {
      if (cop.stagger > 0) {
        cop.stagger -= dt;
        continue;
      }
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d < 26) {
        cop.bustT += dt;
        if (cop.bustT > 0.7) {
          cop.bustT = -99;
          cop.triggerBust = true;
        }
      } else {
        cop.bustT = 0;
        const speed = state.stars >= 4 ? 300 : 260;
        const a = angleTo(cop.x, cop.y, p.x, p.y);
        cop.angle = a;
        moveCircle(cop, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, PED.radius);
      }
    }
  }

  function updatePolice(dt) {
    const wanted = state.stars;
    const copCars = state.cars.filter((c) => c.police && !c.wrecked).length;
    const wantedCars = wanted > 0 ? Math.min(wanted, COP_CAR_MAX) : 0;
    state.copSpawnT -= dt;
    if (copCars < wantedCars && state.copSpawnT <= 0) {
      spawnCopCar();
      state.copSpawnT = 1.5;
    }
    if (wanted === 0) {
      state.cars = state.cars.filter((c) => !c.police);
      state.cops = [];
    }
    const wantedFoot = wanted >= 2 ? Math.min(wanted - 1, 4) : 0;
    state.footSpawnT -= dt;
    if (state.cops.length < wantedFoot && state.footSpawnT <= 0) {
      const a = rng.range(0, TAU);
      state.cops.push({
        x: clamp(state.player.x + Math.cos(a) * 320, 40, WORLD.width - 40),
        y: clamp(state.player.y + Math.sin(a) * 320, 40, WORLD.height - 40),
        angle: 0,
        bustT: 0,
        stagger: 0,
        triggerBust: false,
      });
      state.footSpawnT = 1.2;
    }
  }

  function updateCollisions() {
    const p = state.player;
    const pc = p.inCar ? playerCar() : null;
    // Player's car vs pedestrians.
    if (pc && Math.abs(pc.speed) > 60) {
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (dist(ped.x, ped.y, pc.x, pc.y) < 34) {
          ped.down = 3;
          const a = angleTo(pc.x, pc.y, ped.x, ped.y);
          moveCircle(ped, Math.cos(a) * 50, Math.sin(a) * 50, PED.radius);
          addHeat(HEAT.hitPed);
          playSound('crash');
          pc.speed *= 0.85;
        }
      }
    }
    // Traffic cars hitting the player on foot (rate-limited per car).
    if (!p.inCar) {
      for (const car of state.cars) {
        if (car.wrecked || Math.abs(car.speed) < 40 || car.hitT > 0) continue;
        if (dist(car.x, car.y, p.x, p.y) < 34) {
          p.hp -= 20;
          playSound('crash');
          const a = angleTo(car.x, car.y, p.x, p.y);
          moveCircle(p, Math.cos(a) * 70, Math.sin(a) * 70, PLAYER.radius);
          car.speed *= 0.5;
          car.hitT = 1;
        }
      }
    }
    // Car vs car: push apart, damage by impact.
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        if (a.wrecked && b.wrecked) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 42 && d > 0.01) {
          const push = (42 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          moveCircle(a, -nx * push, -ny * push, CAR.radius);
          moveCircle(b, nx * push, ny * push, CAR.radius);
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 200 && a.dmgT <= 0 && b.dmgT <= 0) {
            damageCar(a, (impact - 200) / 20);
            damageCar(b, (impact - 200) / 20);
            if (a.police || b.police) addHeat(HEAT.ramCopCar);
            playSound('crash');
            a.dmgT = 0.5;
            b.dmgT = 0.5;
          }
          a.speed *= 0.8;
          b.speed *= 0.8;
        }
      }
    }
  }

  function updateMissions(dt) {
    if (!state.missionActive || state.won) return 0;
    const m = MISSIONS[state.missionIndex];
    const p = state.player;
    if (state.missionIndex === 0) {
      if (p.inCar && dist(p.x, p.y, m.target.x, m.target.y) < 100) return completeMission();
    } else if (state.missionIndex === 1) {
      if (state.missionStage === 0) {
        if (dist(p.x, p.y, m.start.x, m.start.y) < 90) {
          state.missionStage = 1;
          state.missionTimer = m.timeLimit;
          addMessage('Package collected! Deliver to Solmara Tower — fast!');
          playSound('pickup');
        }
      } else {
        state.missionTimer -= dt;
        if (dist(p.x, p.y, m.target.x, m.target.y) < 100) return completeMission();
        if (state.missionTimer <= 0) {
          failMission('Delivery failed — too slow. Press ENTER to retry.');
          return 0;
        }
      }
    } else if (state.missionIndex === 2) {
      if (state.missionStage === 0) {
        if (state.stars >= m.needStars) {
          state.missionStage = 1;
          addMessage('3 stars! Now lose the cops at the safehouse.');
        }
      } else if (dist(p.x, p.y, m.target.x, m.target.y) < 100) {
        return completeMission();
      }
    }
    return 0;
  }

  function updateStashes() {
    const p = state.player;
    for (const s of state.stashes) {
      if (s.taken) continue;
      if (dist(p.x, p.y, s.x, s.y) < 32) {
        s.taken = true;
        state.cash += STASH_VALUE;
        addMessage(`Cash stash found! +$${STASH_VALUE}`);
        playSound('pickup');
      }
    }
  }

  function step(dt, controls) {
    let events = EVENT_NONE;
    state.time += dt;
    for (const c of state.cars) {
      if (c.dmgT > 0) c.dmgT -= dt;
      if (c.ramT > 0) c.ramT -= dt;
      if (c.hitT > 0) c.hitT -= dt;
    }
    const p = state.player;
    if (p.punchT > 0) p.punchT -= dt;

    if (controls.actions & ACTION_ENTER_CAR) {
      if (p.inCar) {
        const car = playerCar();
        p.inCar = false;
        p.carId = -1;
        if (car) {
          car.driver = null;
          car.speed = 0;
          p.x = clamp(car.x + 42, 30, WORLD.width - 30);
          p.y = clamp(car.y + 10, 30, WORLD.height - 30);
        }
      } else {
        const car = nearestCar(p.x, p.y, 70);
        if (car) {
          p.inCar = true;
          p.carId = car.id;
          car.driver = 'player';
          if (car.parked) car.parked = false;
          addHeat(HEAT.stealCar);
          addMessage(car.police ? 'You stole a police car!' : 'Car stolen! The law is coming.');
          playSound('pickup');
        }
      }
    }

    if (controls.actions & ACTION_PUNCH && !p.inCar && p.punchT <= 0) {
      p.punchT = PLAYER.punchCooldown;
      let hitSomething = false;
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (dist(ped.x, ped.y, p.x, p.y) < PLAYER.punchRange) {
          ped.down = 3;
          const a = angleTo(p.x, p.y, ped.x, ped.y);
          moveCircle(ped, Math.cos(a) * 46, Math.sin(a) * 46, PED.radius);
          addHeat(HEAT.hitPed);
          hitSomething = true;
        }
      }
      for (const cop of state.cops) {
        if (dist(cop.x, cop.y, p.x, p.y) < PLAYER.punchRange) {
          cop.stagger = 1;
          addHeat(HEAT.punchCop);
          hitSomething = true;
        }
      }
      if (hitSomething) playSound('punch');
    }

    updatePlayer(dt, controls);
    updateTraffic(dt);
    updatePeds(dt);
    updateCopCars(dt);
    updateFootCops(dt);
    updateCollisions();
    updatePolice(dt);
    updateStashes();
    events |= updateMissions(dt);

    if (state.time - state.lastCrime > 5 && state.heat > 0) {
      state.heat = Math.max(0, state.heat - HEAT_DECAY * dt * (state.stars >= 3 ? 0.5 : 1));
      state.stars = starsFor(state.heat);
    }

    for (const cop of state.cops) {
      if (cop.triggerBust) return events | busted();
    }
    if (p.hp <= 0) return events | wasted();
    return events;
  }

  reset();

  return {
    state,
    city,
    reset,
    step,
    addHeat,
    startMission,
    playerCar,
    save() {
      return {
        cash: state.cash,
        missions: [...state.missionDone],
        missionIndex: state.missionIndex,
        stashes: state.stashes.filter((s) => s.taken).length,
      };
    },
    load(save) {
      if (!save) return;
      state.cash = save.cash || 0;
      if (Array.isArray(save.missions)) {
        state.missionDone = [!!save.missions[0], !!save.missions[1], !!save.missions[2]];
        state.missionIndex = state.missionDone.filter(Boolean).length;
        if (state.missionIndex > 2) state.won = true;
      }
    },
  };
}
