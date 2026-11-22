// Canvas painter: the city, its people and cars, the HUD with its live
// minimap, and the title / pause / win screens. Everything drawn comes from
// the world state, so the same state always paints the same frame.
import {
  WORLD, VIEW, PLAYER, CAR, MISSIONS, PLACES, DISTRICTS, ROADS_X, ROADS_Y,
  ROAD_W, SEA_X, BEACH_X, PALETTE, FONT,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';

function hash(x, y) {
  let h = (Math.floor(x) * 73856093) ^ (Math.floor(y) * 19349663);
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = VIEW.width;
  let viewH = VIEW.height;

  function resize() {
    const w = canvas.clientWidth || VIEW.width;
    const h = canvas.clientHeight || VIEW.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    viewW = canvas.width;
    viewH = canvas.height;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
  }

  function drawCity(state, camX, camY) {
    const city = state.cityRef;
    // Ground + district tints.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, viewW, viewH);
    ctx.clip();
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(d.x0 - camX, d.y0 - camY, d.x1 - d.x0, d.y1 - d.y0);
    }
    ctx.globalAlpha = 1;
    // Park + pond.
    const pk = city.park;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(pk.x0 - camX, pk.y0 - camY, pk.x1 - pk.x0, pk.y1 - pk.y0);
    ctx.fillStyle = PALETTE.pond;
    ctx.beginPath();
    ctx.ellipse(pk.pond.x - camX, pk.pond.y - camY, pk.pond.rx, pk.pond.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beach + sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(BEACH_X - camX, 0, SEA_X - BEACH_X, viewH);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(SEA_X - camX, 0, viewW - (SEA_X - camX), viewH);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = ((state.time * 24 + i * 260) % 2600) - camY;
      ctx.beginPath();
      ctx.moveTo(SEA_X - camX + 6, wy);
      ctx.quadraticCurveTo(SEA_X - camX + 40, wy + 12, SEA_X - camX + 70, wy);
      ctx.stroke();
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - camX, -camY, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(-camX, ry - ROAD_W / 2 - camY, WORLD.width, ROAD_W);
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(rx - camX, -camY);
      ctx.lineTo(rx - camX, WORLD.height - camY);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(-camX, ry - camY);
      ctx.lineTo(WORLD.width - camX, ry - camY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Buildings.
    for (const b of city.buildings) {
      const x = b.x - camX;
      const y = b.y - camY;
      ctx.fillStyle = b.downtown ? PALETTE.buildingDowntown : PALETTE.building;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingRoof;
      ctx.fillRect(x + 5, y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(240, 220, 120, 0.75)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (hash(b.x + cx * 31, b.y + cy * 37) < 0.45) {
            ctx.fillRect(x + 10 + cx * 26, y + 10 + cy * 26, 10, 12);
          }
        }
      }
    }
    // Trees.
    for (const t of city.trees) {
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x - camX, t.y - camY, t.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(t.x - camX - 3, t.y - camY - 3, t.s * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(x, y, label, pulse, t) {
    const r = 16 + (pulse ? Math.sin(t * 4) * 3 : 0);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
    star(ctx, x, y, 12, PALETTE.gold);
    if (label) {
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 4;
      ctx.strokeText(label, x + 22, y + 5);
      ctx.fillText(label, x + 22, y + 5);
    }
  }

  function drawCar(car, camX, camY, t) {
    const x = car.x - camX;
    const y = car.y - camY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    ctx.fillStyle = car.wrecked ? '#2a2a2a' : car.color;
    roundRect(ctx, -24, -13, 48, 26, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 240, 0.85)';
    roundRect(ctx, -6, -11, 14, 22, 4);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -24, -13, 12, 26, 5);
      ctx.fill();
      const flash = Math.floor(t * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3a6fd8';
      ctx.fillRect(-4, -15, 8, 5);
      ctx.fillStyle = flash ? '#3a6fd8' : '#ff3b30';
      ctx.fillRect(4, -15, 8, 5);
    }
    if (car.taxi) {
      ctx.fillStyle = '#111111';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(-20 + i * 10, -2, 6, 4);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 9px ' + FONT;
      ctx.fillText('TAXI', -14, -17);
    }
    ctx.restore();
    if (car.wrecked || car.hp < CAR.smokeBelow) {
      ctx.fillStyle = 'rgba(120, 120, 120, 0.6)';
      const puff = (t * 30 + car.id * 37) % 60;
      ctx.beginPath();
      ctx.arc(x - 10, y - 14 - puff * 0.4, 6 + puff * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWorld(state) {
    const p = state.player;
    const camX = Math.max(0, Math.min(WORLD.width - viewW, p.x - viewW / 2));
    const camY = Math.max(0, Math.min(WORLD.height - viewH, p.y - viewH / 2));
    drawCity(state, camX, camY);

    // Mission target marker.
    const m = state.missionIndex <= 2 ? MISSIONS[state.missionIndex] : null;
    if (state.missionActive && m) {
      const target = state.missionIndex === 1 && state.missionStage === 0 ? m.start : m.target;
      drawMarker(target.x - camX, target.y - camY, target.label, true, state.time);
    } else if (!state.missionActive && m && state.missionIndex === 0) {
      drawMarker(PLACES.marina.x - camX, PLACES.marina.y - camY, 'MARINA', false, state.time);
    }
    // Place labels.
    ctx.font = `bold 12px ${FONT}`;
    for (const key of ['tower', 'policeHQ', 'hospital', 'safehouse']) {
      const pl = PLACES[key];
      ctx.fillStyle = 'rgba(238, 241, 245, 0.85)';
      ctx.fillText(pl.label, pl.x - camX - 30, pl.y - camY - 34);
    }
    // Cash stashes.
    for (const s of state.stashes) {
      if (s.taken) continue;
      ctx.fillStyle = PALETTE.stash;
      ctx.beginPath();
      ctx.arc(s.x - camX, s.y - camY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c2b12';
      ctx.font = 'bold 11px ' + FONT;
      ctx.fillText('$', s.x - camX - 3, s.y - camY + 4);
    }
    // Pedestrians.
    for (const ped of state.peds) {
      const x = ped.x - camX;
      const y = ped.y - camY;
      if (ped.down > 0) {
        ctx.fillStyle = '#8a6d3b';
        ctx.beginPath();
        ctx.ellipse(x, y, 14, 7, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = PALETTE.ped;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ped.angle) * 13, y + Math.sin(ped.angle) * 13);
      ctx.stroke();
    }
    // Foot cops.
    for (const cop of state.cops) {
      const x = cop.x - camX;
      const y = cop.y - camY;
      ctx.fillStyle = PALETTE.cop;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0e2a6b';
      ctx.beginPath();
      ctx.arc(x, y - 3, 7, Math.PI, 0);
      ctx.fill();
    }
    // Cars.
    for (const car of state.cars) drawCar(car, camX, camY, state.time);
    // Player.
    const px = p.x - camX;
    const py = p.y - camY;
    if (p.inCar) {
      ctx.strokeStyle = PALETTE.playerRing;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 30, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(px, py, PLAYER.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.playerRing;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, PLAYER.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(p.angle) * 20, py + Math.sin(p.angle) * 20);
      ctx.stroke();
      if (p.punchT > 0.2) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(px + Math.cos(p.angle) * 34, py + Math.sin(p.angle) * 34, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return { camX, camY };
  }

  function drawMinimap(state) {
    const mw = 210;
    const mh = 150;
    const x0 = viewW - mw - 14;
    const y0 = 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    panel(x0, y0, mw, mh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 4, y0 + 4, mw - 8, mh - 8);
    ctx.clip();
    ctx.fillStyle = '#2c4a26';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(x0 + SEA_X * sx, y0, mw - SEA_X * sx, mh);
    ctx.fillStyle = '#d9c27a';
    ctx.fillRect(x0 + BEACH_X * sx, y0, (SEA_X - BEACH_X) * sx, mh);
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.55)';
    ctx.lineWidth = 1;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(x0 + rx * sx, y0);
      ctx.lineTo(x0 + rx * sx, y0 + mh);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + ry * sy);
      ctx.lineTo(x0 + mw, y0 + ry * sy);
      ctx.stroke();
    }
    const m = state.missionIndex <= 2 ? MISSIONS[state.missionIndex] : null;
    if (state.missionActive && m) {
      const target = state.missionIndex === 1 && state.missionStage === 0 ? m.start : m.target;
      star(ctx, x0 + target.x * sx, y0 + target.y * sy, 6, PALETTE.gold);
    }
    for (const s of state.stashes) {
      if (s.taken) continue;
      ctx.fillStyle = PALETTE.stash;
      ctx.fillRect(x0 + s.x * sx - 1, y0 + s.y * sy - 1, 3, 3);
    }
    for (const car of state.cars) {
      if (!car.police) continue;
      ctx.fillStyle = '#6ea8ff';
      ctx.beginPath();
      ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `11px ${FONT}`;
    ctx.fillText('SOLMARA', x0 + 6, y0 + mh - 6);
  }

  function drawHud(state) {
    // Cash, health, wanted stars.
    panel(14, 14, 240, 86);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(`$${state.cash}`, 28, 44);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`Health ${Math.max(0, Math.round(state.player.hp))}`, 28, 66);
    ctx.fillStyle = '#3a2020';
    ctx.fillRect(28, 72, 120, 10);
    ctx.fillStyle = state.player.hp > 30 ? '#39d353' : PALETTE.red;
    ctx.fillRect(28, 72, 120 * Math.max(0, state.player.hp) / 100, 10);
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.stars ? '★' : '☆';
    ctx.fillStyle = state.stars > 0 ? PALETTE.gold : PALETTE.muted;
    ctx.font = '22px ' + FONT;
    ctx.fillText(stars, 28, 96);
    // Mission banner.
    const m = state.missionIndex <= 2 ? MISSIONS[state.missionIndex] : null;
    if (m) {
      const label = state.missionActive
        ? `${m.name} — ${state.missionIndex === 1 && state.missionStage === 0 ? 'Go to the Docks' : state.missionIndex === 1 ? 'Deliver to Solmara Tower' : state.missionIndex === 2 && state.missionStage === 0 ? 'Get 3 stars' : m.target.label}`
        : state.won ? 'All missions complete!' : `${m.name} — press ENTER to start`;
      panel(viewW / 2 - 260, 14, 520, 40);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(label, viewW / 2, 39);
      ctx.textAlign = 'left';
      if (state.missionActive && state.missionIndex === 1 && state.missionStage === 1) {
        ctx.fillStyle = state.missionTimer < 15 ? PALETTE.red : PALETTE.gold;
        ctx.font = `bold 18px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(state.missionTimer)}s`, viewW / 2, 66);
        ctx.textAlign = 'left';
      }
    }
    // Message feed.
    ctx.font = `14px ${FONT}`;
    const feed = state.messages.slice(-4);
    feed.forEach((msg, i) => {
      ctx.fillStyle = 'rgba(12, 16, 24, 0.7)';
      const w = ctx.measureText(msg).width + 16;
      ctx.fillRect(14, viewH - 120 + i * 24, w, 20);
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(msg, 22, viewH - 105 + i * 24);
    });
    // Driving readout.
    if (state.player.inCar) {
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (car) {
        panel(viewW - 240, viewH - 74, 226, 60);
        ctx.fillStyle = PALETTE.text;
        ctx.font = `bold 20px ${FONT}`;
        ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.35)} km/h`, viewW - 226, viewH - 48);
        ctx.font = `13px ${FONT}`;
        ctx.fillText(`Car ${Math.round(car.hp)}%`, viewW - 226, viewH - 26);
        ctx.fillStyle = '#3a2020';
        ctx.fillRect(viewW - 140, viewH - 36, 110, 10);
        ctx.fillStyle = car.hp > 40 ? '#39d353' : PALETTE.red;
        ctx.fillRect(viewW - 140, viewH - 36, 110 * Math.max(0, car.hp) / 100, 10);
      }
    }
    // Context hint.
    let hint = '';
    if (!state.player.inCar) {
      const near = state.cars.some((c) => !c.wrecked && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 70);
      if (near) hint = 'E — steal car';
      else if (!state.missionActive && state.missionIndex <= 2) hint = 'ENTER — start mission';
    } else {
      hint = 'E — exit car · SPACE — handbrake';
    }
    if (hint) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(hint, viewW / 2, viewH - 16);
      ctx.textAlign = 'left';
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = accent || PALETTE.gold;
    ctx.font = `bold 54px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, viewW / 2, viewH / 2 - 90);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, viewW / 2, viewH / 2 - 40 + i * 32);
    });
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best) {
    resize();
    ctx.clearRect(0, 0, viewW, viewH);
    if (screen === SCREEN_TITLE) {
      drawWorld(state);
      overlay('SOLMARA', [
        'Streets of Gold — an open-world crime game',
        'WASD move · SHIFT run · E steal / exit car · SPACE punch / handbrake',
        'ENTER start mission · P pause · M mute',
        `Best cash: $${best}`,
        'Press ENTER to start',
      ]);
      return;
    }
    drawWorld(state);
    drawHud(state);
    drawMinimap(state);
    if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or ENTER to keep playing']);
    } else if (screen === SCREEN_WIN) {
      overlay('SOLMARA IS YOURS', [
        'All three missions complete!',
        `Total cash: $${state.cash}`,
        'Press ENTER to keep cruising the city',
      ], PALETTE.stash);
    }
  }

  return { draw };
}
