// The static city: roads, districts, buildings, trees, the park, the beach and the
// hidden cash stashes. Built once from the seed; the world simulation never changes it.
// Every placement is deterministic, so the same seed always builds the same Solmara.
import {
  AVENUES, BEACH_Y, COLORS, DISTRICTS, PARK, PED_COUNT, PLACES, POND, ROAD_W,
  SEA_Y, STASH_COUNT, STREETS, WORLD,
} from './config.js';

/** True when the point is on a road (within half a road width of a centreline). */
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2) return true;
  return false;
}

/** True when the point is in the sea (not on the beach). */
export function inSea(x, y) {
  return y >= SEA_Y;
}

/** True when the point is on sand. */
export function onBeach(x, y) {
  return y >= BEACH_Y && y < SEA_Y;
}

/** True when the point is inside the park (not the pond). */
export function inPark(x, y) {
  return x > PARK.x && x < PARK.x + PARK.w && y > PARK.y && y < PARK.y + PARK.h;
}

/** True when the point is in the pond. */
export function inPond(x, y) {
  const dx = (x - POND.x) / POND.rx;
  const dy = (y - POND.y) / POND.ry;
  return dx * dx + dy * dy < 1;
}

/** The district a point sits in, for the HUD's location line. */
export function districtAt(x, y) {
  if (y >= SEA_Y) return 'The Sea';
  if (y >= BEACH_Y) return 'Palm Beach';
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solmara';
}

function overlapsPark(b) {
  return b.x < PARK.x + PARK.w && b.x + b.w > PARK.x && b.y < PARK.y + PARK.h && b.y + b.h > PARK.y;
}

function overlapsPlace(b, margin) {
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    if (b.x - margin < p.x && b.x + b.w + margin > p.x && b.y - margin < p.y && b.y + b.h + margin > p.y) return true;
  }
  return false;
}

/** Build the whole static city from `random`. Returns plain data, no behaviour. */
export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const stashes = [];

  // Blocks are the rectangles between neighbouring roads. Each block gets one to
  // four buildings, kept clear of the park, the beach and the named places.
  const xs = [0, ...AVENUES, WORLD.w];
  const ys = [0, ...STREETS, BEACH_Y];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + (bi === 0 ? 24 : ROAD_W / 2 + 14);
      const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 24 : ROAD_W / 2 + 14);
      const y0 = ys[bj] + (bj === 0 ? 24 : ROAD_W / 2 + 14);
      const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 24 : ROAD_W / 2 + 14);
      if (x1 - x0 < 90 || y1 - y0 < 70) continue;
      const count = random.int(1, 3);
      for (let k = 0; k < count; k += 1) {
        const w = random.range(70, Math.min(190, x1 - x0 - 20));
        const h = random.range(60, Math.min(150, y1 - y0 - 20));
        const b = {
          x: random.range(x0, x1 - w),
          y: random.range(y0, y1 - h),
          w,
          h,
          roof: random.pick(COLORS.buildingRoof),
          tall: random.chance(0.22),
        };
        if (overlapsPark(b) || overlapsPlace(b, 90)) continue;
        if (inPond(b.x + b.w / 2, b.y + b.h / 2)) continue;
        buildings.push(b);
      }
      // A few trees along the block's edges.
      const treeCount = random.int(0, 4);
      for (let k = 0; k < treeCount; k += 1) {
        const t = { x: random.range(x0, x1), y: random.range(y0, y1), r: random.range(9, 15) };
        if (inPond(t.x, t.y)) continue;
        trees.push(t);
      }
    }
  }

  // Palm trees along the beach and a ring of trees inside the park.
  for (let k = 0; k < 26; k += 1) {
    trees.push({ x: random.range(60, WORLD.w - 60), y: random.range(BEACH_Y + 12, SEA_Y - 12), r: random.range(10, 15), palm: true });
  }
  for (let k = 0; k < 18; k += 1) {
    const angle = random.range(0, Math.PI * 2);
    const rx = PARK.w / 2 - 30;
    const ry = PARK.h / 2 - 30;
    trees.push({
      x: PARK.x + PARK.w / 2 + Math.cos(angle) * rx,
      y: PARK.y + PARK.h / 2 + Math.sin(angle) * ry,
      r: random.range(10, 16),
    });
  }

  // Hidden cash stashes: on sidewalks and open ground, never on a road, in a
  // building, in the pond or in the sea.
  let guard = 0;
  while (stashes.length < STASH_COUNT && guard < 400) {
    guard += 1;
    const x = random.range(120, WORLD.w - 120);
    const y = random.range(300, BEACH_Y - 60);
    if (onRoad(x, y) || inPond(x, y)) continue;
    if (buildings.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) continue;
    if (stashes.some((s) => Math.hypot(s.x - x, s.y - y) < 320)) continue;
    stashes.push({ x, y, taken: false });
  }

  return { buildings, trees, stashes };
}

/** The nearest road intersection to a point: the cop cars' navigation nodes. */
export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      const d = Math.hypot(ax - x, sy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: ax, y: sy };
      }
    }
  }
  return best;
}

/** Pedestrian spawn points: on sidewalks just off the roads. */
export function pedSpawnPoints(random) {
  const points = [];
  for (let k = 0; k < PED_COUNT; k += 1) {
    if (random.chance(0.5)) {
      points.push({ x: random.pick(AVENUES) + random.range(-70, 70), y: random.range(300, BEACH_Y - 80) });
    } else {
      points.push({ x: random.range(120, WORLD.w - 120), y: random.pick(STREETS) + random.range(-70, 70) });
    }
  }
  return points;
}
