// Drawing only: the world's state and the current screen in, pixels out. The camera
// follows the player across the 3600x2600 city; the HUD, the minimap and the menus
// are drawn in screen space on top. Flat colours and canvas text, no images.
import {
  AVENUES, BEACH_Y, CAR_LENGTH, CAR_WIDTH, COLORS, DISTRICTS, PARK, PLACES,
  POND, ROAD_W, SEA_Y, STREETS, WORLD,
} from './config.js';
import { districtAt, onBeach } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, w: 1280, h: 800, dpr: 1 };
  const fonts = new Map();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    view.scale = Math.min(1, view.w / 1280, view.h / 800);
  }

  function font(size, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    context.font = font(size, bold);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    context.fillStyle = COLORS.hudBg;
    context.beginPath();
    context.roundRect(x, y, w, h, 10);
    context.fill();
  }

  function drawGround(state) {
    // Base ground, then district tints.
    context.fillStyle = '#b3a284';
    context.fillRect(0, 0, WORLD.w, WORLD.h);
    for (const d of DISTRICTS) {
      context.fillStyle = d.ground;
      context.fillRect(d.x, d.y, d.w, d.h);
    }
    // Beach and sea.
    context.fillStyle = COLORS.beach;
    context.fillRect(0, BEACH_Y, WORLD.w, SEA_Y - BEACH_Y);
    context.fillStyle = COLORS.sea;
    context.fillRect(0, SEA_Y, WORLD.w, WORLD.h - SEA_Y);
    context.fillStyle = COLORS.seaDeep;
    for (let x = 0; x < WORLD.w; x += 180) {
      context.fillRect(x, SEA_Y + 60, 120, 6);
      context.fillRect(x + 90, SEA_Y + 150, 120, 6);
    }
    // Park and pond.
    context.fillStyle = COLORS.grass;
    context.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
    context.fillStyle = COLORS.grassDark;
    context.fillRect(PARK.x + 20, PARK.y + 20, PARK.w - 40, 40);
    context.fillStyle = COLORS.pond;
    context.beginPath();
    context.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.beginPath();
    context.ellipse(POND.x - 30, POND.y - 18, 50, 16, -0.3, 0, TAU);
    context.fill();
  }

  function drawRoads() {
    for (const ax of AVENUES) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(ax - ROAD_W / 2 - 10, 0, ROAD_W + 20, BEACH_Y);
      context.fillStyle = COLORS.road;
      context.fillRect(ax - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
      context.strokeStyle = COLORS.dash;
      context.lineWidth = 4;
      context.setLineDash([34, 30]);
      context.beginPath();
      context.moveTo(ax, 0);
      context.lineTo(ax, BEACH_Y);
      context.stroke();
      context.setLineDash([]);
    }
    for (const sy of STREETS) {
      context.fillStyle = COLORS.sidewalk;
      context.fillRect(0, sy - ROAD_W / 2 - 10, WORLD.w, ROAD_W + 20);
      context.fillStyle = COLORS.road;
      context.fillRect(0, sy - ROAD_W / 2, WORLD.w, ROAD_W);
      context.strokeStyle = COLORS.dash;
      context.lineWidth = 4;
      context.setLineDash([34, 30]);
      context.beginPath();
      context.moveTo(0, sy);
      context.lineTo(WORLD.w, sy);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function drawCity(state) {
    const { buildings, trees } = state.city;
    for (const b of buildings) {
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.fillRect(b.x + 7, b.y + 8, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = COLORS.buildingEdge;
      context.lineWidth = 3;
      context.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
      context.fillStyle = 'rgba(255,255,255,0.16)';
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      if (b.tall) {
        context.fillStyle = 'rgba(0,0,0,0.28)';
        context.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 14, 28, 28);
      }
    }
    for (const t of trees) {
      context.fillStyle = '#6b4a2f';
      context.fillRect(t.x - 2, t.y - 2, 4, 5);
      context.fillStyle = t.palm ? '#57a047' : COLORS.tree;
      context.beginPath();
      context.arc(t.x, t.y - 4, t.r, 0, TAU);
      context.fill();
      context.fillStyle = COLORS.treeDark;
      context.beginPath();
      context.arc(t.x - 3, t.y - 7, t.r * 0.5, 0, TAU);
      context.fill();
    }
  }

  function drawStashes(state) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    for (const s of state.city.stashes) {
      if (s.taken) continue;
      context.fillStyle = 'rgba(255,217,74,0.35)';
      context.beginPath();
      context.arc(s.x, s.y, 20 * pulse, 0, TAU);
      context.fill();
      context.fillStyle = COLORS.gold;
      context.beginPath();
      context.arc(s.x, s.y, 11, 0, TAU);
      context.fill();
      text('$', s.x, s.y + 5, 14, '#7a5b00', 'center', true);
    }
  }

  function drawMarker(state) {
    const m = state.mission;
    if (!m || !m.active) return;
    const t = m.def.target;
    const pulse = 1 + Math.sin(state.time * 5) * 0.18;
    context.strokeStyle = COLORS.gold;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(t.x, t.y, 46 * pulse, 0, TAU);
    context.stroke();
    context.fillStyle = COLORS.gold;
    context.beginPath();
    context.arc(t.x, t.y, 14, 0, TAU);
    context.fill();
    text('★', t.x, t.y + 7, 16, '#7a5b00', 'center', true);
    text(m.def.targetName, t.x, t.y - 58, 20, COLORS.gold, 'center', true);
    context.strokeStyle = 'rgba(255,217,74,0.5)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(t.x, t.y - 14);
    context.lineTo(t.x, t.y - 90);
    context.stroke();
  }

  function drawCar(car, state) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.wrecked) {
      context.fillStyle = '#2b2b2b';
      context.beginPath();
      context.roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 6);
      context.fill();
      context.fillStyle = '#555555';
      context.fillRect(-8, -8, 16, 16);
      context.restore();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.roundRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 4, CAR_LENGTH, CAR_WIDTH, 7);
    context.fill();
    // Wheels.
    context.fillStyle = '#161616';
    context.fillRect(-17, -CAR_WIDTH / 2 - 3, 12, 6);
    context.fillRect(-17, CAR_WIDTH / 2 - 3, 12, 6);
    context.fillRect(7, -CAR_WIDTH / 2 - 3, 12, 6);
    context.fillRect(7, CAR_WIDTH / 2 - 3, 12, 6);
    // Body.
    context.fillStyle = car.isCop ? '#e8e8e8' : car.color;
    context.beginPath();
    context.roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 7);
    context.fill();
    if (car.isCop) {
      context.fillStyle = COLORS.copCar;
      context.fillRect(-6, -CAR_WIDTH / 2, 12, CAR_WIDTH);
    }
    // Windshield and roof.
    context.fillStyle = 'rgba(20,30,45,0.85)';
    context.fillRect(6, -CAR_WIDTH / 2 + 4, 8, CAR_WIDTH - 8);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(-8, -CAR_WIDTH / 2 + 4, 12, CAR_WIDTH - 8);
    if (car.taxi) {
      context.fillStyle = COLORS.taxi;
      context.fillRect(-4, -6, 10, 12);
      text('TAXI', 1, 4, 7, '#222', 'center', true);
    }
    if (car.isCop) {
      const flash = Math.floor(state.time * 6) % 2 === 0;
      context.fillStyle = flash ? COLORS.copLightR : COLORS.copLightB;
      context.fillRect(-2, -CAR_WIDTH / 2 - 2, 8, 5);
      context.fillStyle = flash ? COLORS.copLightB : COLORS.copLightR;
      context.fillRect(-2, CAR_WIDTH / 2 - 3, 8, 5);
    }
    if (car.isPlayer) {
      context.strokeStyle = COLORS.gold;
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(-CAR_LENGTH / 2 - 3, -CAR_WIDTH / 2 - 3, CAR_LENGTH + 6, CAR_WIDTH + 6, 9);
      context.stroke();
    }
    // Headlights.
    context.fillStyle = '#fff8c9';
    context.fillRect(CAR_LENGTH / 2 - 2, -CAR_WIDTH / 2 + 3, 3, 5);
    context.fillRect(CAR_LENGTH / 2 - 2, CAR_WIDTH / 2 - 8, 3, 5);
    context.restore();
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      if (ped.down > 0) {
        context.fillStyle = '#888888';
        context.beginPath();
        context.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, TAU);
        context.fill();
        continue;
      }
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, 9, 0, TAU);
      context.fill();
      context.fillStyle = '#e8b98a';
      context.beginPath();
      context.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4, 0, TAU);
      context.fill();
    }
    for (const cop of state.cops) {
      context.fillStyle = '#1d2f57';
      context.beginPath();
      context.arc(cop.x, cop.y, 11, 0, TAU);
      context.fill();
      context.fillStyle = '#dfe6f2';
      context.beginPath();
      context.arc(cop.x, cop.y - 3, 5, 0, TAU);
      context.fill();
      context.fillStyle = '#1d2f57';
      context.fillRect(cop.x - 6, cop.y - 10, 12, 4);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    context.fillStyle = COLORS.player;
    context.beginPath();
    context.arc(p.x, p.y, 13, 0, TAU);
    context.fill();
    context.strokeStyle = COLORS.playerRing;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(p.x, p.y, 16, 0, TAU);
    context.stroke();
    context.fillStyle = '#ffd7e6';
    context.beginPath();
    context.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 5, 0, TAU);
    context.fill();
    if (p.punchCooldown > 0.28) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(p.x, p.y, 30, p.angle - 0.7, p.angle + 0.7);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.max);
      context.globalAlpha = a;
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawMinimap(state) {
    const mw = 232;
    const mh = 168;
    const x0 = view.w - mw - 16;
    const y0 = view.h - mh - 16;
    const sx = mw / WORLD.w;
    const sy = mh / WORLD.h;
    panel(x0 - 8, y0 - 8, mw + 16, mh + 16);
    context.save();
    context.beginPath();
    context.rect(x0, y0, mw, mh);
    context.clip();
    context.fillStyle = '#b3a284';
    context.fillRect(x0, y0, mw, mh);
    context.fillStyle = COLORS.sea;
    context.fillRect(x0, y0 + SEA_Y * sy, mw, (WORLD.h - SEA_Y) * sy);
    context.fillStyle = COLORS.grass;
    context.fillRect(x0 + PARK.x * sx, y0 + PARK.y * sy, PARK.w * sx, PARK.h * sy);
    context.strokeStyle = '#e8e8e8';
    context.lineWidth = 2;
    for (const ax of AVENUES) {
      context.beginPath();
      context.moveTo(x0 + ax * sx, y0);
      context.lineTo(x0 + ax * sx, y0 + BEACH_Y * sy);
      context.stroke();
    }
    for (const sy2 of STREETS) {
      context.beginPath();
      context.moveTo(x0, y0 + sy2 * sy);
      context.lineTo(x0 + WORLD.w * sx, y0 + sy2 * sy);
      context.stroke();
    }
    const m = state.mission;
    if (m && m.active) {
      context.fillStyle = COLORS.gold;
      context.beginPath();
      context.arc(x0 + m.def.target.x * sx, y0 + m.def.target.y * sy, 6, 0, TAU);
      context.fill();
    }
    for (const s of state.city.stashes) {
      if (s.taken) continue;
      context.fillStyle = COLORS.gold;
      context.fillRect(x0 + s.x * sx - 2, y0 + s.y * sy - 2, 4, 4);
    }
    for (const car of state.cars) {
      if (!car.isCop || car.wrecked) continue;
      context.fillStyle = '#ff3b30';
      context.beginPath();
      context.arc(x0 + car.x * sx, y0 + car.y * sy, 3.5, 0, TAU);
      context.fill();
    }
    const p = state.player;
    context.save();
    context.translate(x0 + p.x * sx, y0 + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('SOLMARA', x0 + mw / 2, y0 - 14, 11, COLORS.hudDim, 'center', true);
  }

  function drawHud(state, save) {
    // Top-left: cash, health, district.
    panel(16, 14, 250, 86);
    text(`$${state.cash}`, 30, 46, 30, COLORS.gold, 'left', true);
    text(`HEALTH ${Math.ceil(state.health)}`, 30, 72, 14, COLORS.hudText, 'left');
    context.fillStyle = '#333a45';
    context.fillRect(30, 80, 150, 8);
    context.fillStyle = state.health > 30 ? '#58c96b' : '#e5534b';
    context.fillRect(30, 80, 150 * Math.max(0, state.health / 100), 8);
    text(districtAt(state.player.x, state.player.y), 30, 96, 13, COLORS.hudDim, 'left');
    // Top-right: wanted stars.
    const st = state.heat <= 0 ? 0 : Math.min(5, Math.ceil(state.heat / 100));
    panel(view.w - 236, 14, 220, 54);
    let starsText = '';
    for (let i = 0; i < 5; i += 1) starsText += i < st ? '★' : '☆';
    text(starsText, view.w - 126, 48, 26, st > 0 ? '#ffd94a' : '#8b93a3', 'center', true);
    if (st > 0) text('WANTED', view.w - 126, 64, 12, '#ff6b5e', 'center', true);
    // Top-centre: mission banner.
    const m = state.mission;
    if (m && m.active) {
      const label = m.def.timeLimit && m.phase === 'timed'
        ? `${m.def.name} — ${Math.ceil(m.timer)}s — ${m.def.targetName}`
        : `${m.def.name} — ${m.def.brief}`;
      const w = Math.min(view.w - 560, 640);
      panel((view.w - w) / 2, 14, w, 44);
      text(label, view.w / 2, 42, 16, COLORS.hudText, 'center', true);
    } else if (!state.win && state.missionsDone.some((d) => !d)) {
      panel((view.w - 320) / 2, 14, 320, 44);
      text('Press ENTER for work from Mara Voss', view.w / 2, 42, 15, COLORS.hudDim, 'center');
    }
    // Bottom-left: message feed, kept clear of the controls hint below it.
    const recent = state.messages.filter((msg) => state.time - msg.t < 6).slice(-4);
    let my = view.h - 40 - recent.length * 22;
    for (const msg of recent) {
      text(msg.text, 20, my + 18, 15, COLORS.hudText, 'left');
      my += 22;
    }
    // Bottom-right: minimap, plus speed when driving (kept clear of the map title).
    const pc = state.player.inCar;
    if (pc) {
      const kmh = Math.round(Math.abs(pc.speed) * 0.32);
      panel(view.w - 260, view.h - 268, 244, 40);
      text(`${kmh} km/h`, view.w - 148, view.h - 240, 20, COLORS.hudText, 'center', true);
      context.fillStyle = '#333a45';
      context.fillRect(view.w - 240, view.h - 232, 204, 6);
      context.fillStyle = pc.health > 30 ? '#58c96b' : '#e5534b';
      context.fillRect(view.w - 240, view.h - 232, 204 * Math.max(0, pc.health / 100), 6);
    }
    drawMinimap(state);
    // Controls hint, faint.
    text('WASD move · E car · F punch · Shift run · Space brake · P pause · M mute', 20, view.h - 8, 12, 'rgba(255,255,255,0.55)', 'left');
    if (save && save.best > 0) text(`Best cash $${save.best}`, view.w - 16, view.h - 8, 12, 'rgba(255,255,255,0.55)', 'right');
  }

  function drawPanel(title, lines, prompt) {
    const w = 640;
    const h = 150 + lines.length * 34;
    const x = (view.w - w) / 2;
    const y = (view.h - h) / 2;
    context.fillStyle = 'rgba(10, 12, 18, 0.82)';
    context.beginPath();
    context.roundRect(x, y, w, h, 14);
    context.fill();
    context.strokeStyle = COLORS.gold;
    context.lineWidth = 2;
    context.stroke();
    text(title, view.w / 2, y + 62, 44, COLORS.gold, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.w / 2, y + 108 + i * 34, 19, COLORS.hudText, 'center');
    }
    text(prompt, view.w / 2, y + h - 30, 18, COLORS.gold, 'center', true);
  }

  /** Paint one frame: the city around the camera, then the HUD or a panel. */
  function draw(state, screen, save) {
    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    context.fillStyle = '#10131a';
    context.fillRect(0, 0, view.w, view.h);
    const cam = state.camera;
    const ox = view.w / 2 - cam.x * view.scale;
    const oy = view.h / 2 - cam.y * view.scale;
    context.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * ox, view.dpr * oy);
    drawGround(state);
    drawRoads();
    drawCity(state);
    drawStashes(state);
    drawMarker(state);
    for (const car of state.cars) drawCar(car, state);
    drawPeds(state);
    drawPlayer(state);
    drawParticles(state);
    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMARA', [
        'Streets of Gold — an open-world crime story.',
        'Mara Voss has three jobs for you. Steal cars, outrun the law,',
        'find the hidden cash, and take the city for yourself.',
        `Best cash so far: $${save && save.best ? save.best : 0}   ·   ${state.missionsDone.filter(Boolean).length}/3 missions done`,
        'WASD or arrows to move · E to enter a car · F to punch',
        'Shift to run · Space to handbrake · P to pause · M to mute',
      ], 'Press ENTER or click to start');
      return;
    }
    drawHud(state, save);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Solmara waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmara PD caught up with you.', `Fine paid. Cash now $${state.cash}.`], 'Press ENTER to keep playing');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['You woke up at St. Aurelia Hospital.', `Bill paid. Cash now $${state.cash}.`], 'Press ENTER to keep playing');
    } else if (state.win) {
      drawPanel('SOLMARA IS YOURS', [
        'All three jobs for Mara Voss are done.',
        `You leave with $${state.cash} and the whole city behind you.`,
        'Keep playing, or press ENTER to start a new story.',
      ], 'Press ENTER for a new game');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
