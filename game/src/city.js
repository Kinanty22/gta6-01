// SOLMARA — city: the whole map of Solmara, generated once from a seed.
// A road grid, five districts, buildings with collision boxes, a park, a beach
// and a marina. Everything is data: world.js moves things, render.js draws them.
import { ROADS_X, ROADS_Y, WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

const DISTRICTS = [
  { name: 'PALM BEACH', x0: 0, y0: 2240, x1: 3600, y1: 2600, tint: '#e8cf9a' },
  { name: 'DOWNTOWN', x0: 1150, y0: 650, x1: 2450, y1: 1800, tint: '#c9ced6' },
  { name: 'MARINA', x0: 2950, y0: 0, x1: 3600, y1: 700, tint: '#bcd8e8' },
  { name: 'OLD TOWN', x0: 0, y0: 0, x1: 1150, y1: 1250, tint: '#d8c9a8' },
  { name: 'SUBURBS', x0: 0, y0: 1250, x1: 3600, y1: 2240, tint: '#bcd2a8' },
];

const ROOF_COLORS = ['#b0563a', '#7a6a8a', '#4a7a8a', '#8a6a4a', '#5a7a4a', '#9a4a5a', '#6a5a7a', '#c08a3a'];
const HOUSE_COLORS = ['#e8d8b0', '#d8b8a0', '#c8d8e8', '#e8c8c8', '#d0e0c0', '#e0d0e8'];

function onRoad(x, y, margin) {
  const m = WORLD.roadWidth / 2 + (margin || 0);
  for (const rx of ROADS_X) if (Math.abs(x - rx) < m) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < m) return true;
  return false;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];

  // One building per block cell between roads; downtown gets towers, suburbs houses.
  for (let gx = 0; gx < ROADS_X.length - 1; gx += 1) {
    for (let gy = 0; gy < ROADS_Y.length - 1; gy += 1) {
      const x0 = ROADS_X[gx] + WORLD.roadWidth / 2 + 14;
      const x1 = ROADS_X[gx + 1] - WORLD.roadWidth / 2 - 14;
      const y0 = ROADS_Y[gy] + WORLD.roadWidth / 2 + 14;
      const y1 = ROADS_Y[gy + 1] - WORLD.roadWidth / 2 - 14;
      if (y0 > WORLD.beachY - 60) continue; // beach blocks stay open
      const downtown = x0 > 1150 && x0 < 2450 && y0 > 650 && y0 < 1800;
      const marina = x0 > 2950 && y0 < 700;
      const count = downtown ? rangeInt(random, 3, 4) : rangeInt(random, 2, 3);
      const cellW = (x1 - x0) / count;
      for (let i = 0; i < count; i += 1) {
        const bw = cellW * range(random, 0.55, 0.85);
        const bh = (y1 - y0) * range(random, 0.4, 0.8);
        const bx = x0 + i * cellW + (cellW - bw) / 2;
        const by = y0 + ((y1 - y0) - bh) / 2 + range(random, -8, 8);
        const tower = downtown && random() < 0.55;
        buildings.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          height: tower ? rangeInt(random, 3, 6) : rangeInt(random, 1, 2),
          roof: tower ? pick(random, ROOF_COLORS) : pick(random, HOUSE_COLORS),
          wall: tower ? '#8a8f98' : '#b8a888',
          kind: tower ? 'tower' : marina ? 'hotel' : downtown ? 'shop' : 'house',
        });
      }
      // A few trees in each block.
      for (let t = 0; t < 3; t += 1) {
        trees.push({ x: range(random, x0, x1), y: range(random, y0, y1), r: range(random, 9, 15) });
      }
    }
  }

  // Park: the block at (1800, 760)-(2300, 1220) is green, no buildings.
  for (let i = buildings.length - 1; i >= 0; i -= 1) {
    const b = buildings[i];
    if (b.x > 1750 && b.x < 2350 && b.y > 700 && b.y < 1280) buildings.splice(i, 1);
  }
  for (let i = 0; i < 26; i += 1) {
    trees.push({ x: range(random, 1830, 2270), y: range(random, 800, 1180), r: range(random, 10, 18) });
  }
  const park = { x: 1800, y: 760, w: 500, h: 460 };

  // Palm trees along the beach road and lamps along every road.
  for (let x = 120; x < WORLD.width; x += 190) {
    trees.push({ x: x + range(random, -20, 20), y: WORLD.beachY - 46, r: 12, palm: true });
  }
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) lamps.push({ x: rx + WORLD.roadWidth / 2 + 6, y: ry - WORLD.roadWidth / 2 - 6 });
  }

  // Named places the missions and HUD point at.
  const places = {
    marina: { x: 3150, y: 420, label: 'MARINA' },
    docks: { x: 3300, y: 2140, label: 'DOCKS' },
    downtownTower: { x: 1800, y: 1220, label: 'SOLMARA TOWER' },
    safehouse: { x: 480, y: 1680, label: 'SAFEHOUSE' },
    hospital: { x: 800, y: 1220, label: 'HOSPITAL' },
    policeStation: { x: 1300, y: 1680, label: 'POLICE HQ' },
    start: { x: 1800, y: 2140, label: 'PALM AVE' },
  };

  function collidesCircle(x, y, r) {
    if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  function collidesRect(x, y, w, h) {
    if (x < 0 || y < 0 || x + w > WORLD.width || y + h > WORLD.height) return true;
    for (const b of buildings) {
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
    }
    return false;
  }

  // Push a circle out of any building it overlaps; returns true if it hit one.
  function resolveCircle(body) {
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < body.r * body.r) {
        hit = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          body.x = cx + (dx / d) * body.r;
          body.y = cy + (dy / d) * body.r;
        } else {
          body.x += body.r;
        }
      }
    }
    body.x = Math.max(body.r, Math.min(WORLD.width - body.r, body.x));
    // The sea is solid ground's edge: nobody walks into the water.
    body.y = Math.max(body.r, Math.min(WORLD.waterY - body.r, body.y));
    return hit;
  }

  function randomRoadPoint(randomFn) {
    if (randomFn() < 0.5) {
      return { x: pick(randomFn, ROADS_X), y: range(randomFn, 120, WORLD.height - 120) };
    }
    return { x: range(randomFn, 120, WORLD.width - 120), y: pick(randomFn, ROADS_Y) };
  }

  // Nearest point on the road network to (x, y): traffic and missions snap to it.
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROADS_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, y }; }
    }
    for (const ry of ROADS_Y) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { x, y: ry }; }
    }
    return best;
  }

  return {
    buildings, trees, lamps, park, places, districts: DISTRICTS,
    onRoad, collidesCircle, collidesRect, resolveCircle,
    randomRoadPoint, nearestRoadPoint,
  };
}
