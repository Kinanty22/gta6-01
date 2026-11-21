// SOLMARA — render: everything the player sees. A smooth follow camera, the
// sun-soaked city (roads, towers, park, beach), cars, people, particles, and
// the full HUD: cash, health, wanted stars, mission banner and minimap.
import { CAR, MISSIONS, ROADS_X, ROADS_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const MINIMAP_W = 208;
const MINIMAP_H = 152;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let camX = 0;
  let camY = 0;
  let zoom = 1;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawCar(x, y, angle, color, opts) {
    const o = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, -CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#141414';
    const wy = CAR.width / 2 - 2;
    ctx.fillRect(-CAR.length / 2 + 8, -wy - 4, 14, 8);
    ctx.fillRect(-CAR.length / 2 + 8, wy - 4, 14, 8);
    ctx.fillRect(CAR.length / 2 - 22, -wy - 4, 14, 8);
    ctx.fillRect(CAR.length / 2 - 22, wy - 4, 14, 8);
    // Body.
    ctx.fillStyle = color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    roundRect(ctx, -10, -CAR.width / 2 + 5, 22, CAR.width - 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(CAR.length / 2 - 12, -CAR.width / 2 + 5, 4, CAR.width - 10);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 9, 3, 6);
    if (o.isCop) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      const t = performance.now() / 180;
      ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#ff2d2d' : '#2d7dff';
      ctx.beginPath();
      ctx.arc(-4, -CAR.width / 2 + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#2d7dff' : '#ff2d2d';
      ctx.beginPath();
      ctx.arc(6, -CAR.width / 2 + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (o.isTaxi) {
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.restore();
  }

  function drawPed(x, y, angle, shirt, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCity(world, view) {
    const { city } = world;
    const { x0, y0, x1, y1 } = view;
    // Ground, clamped to the map: beyond the edge the sea-blue backdrop shows.
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(Math.max(x0, 0), Math.max(y0, 0), Math.min(x1, WORLD.width) - Math.max(x0, 0), Math.min(y1, WORLD.height) - Math.max(y0, 0));
    // Block interiors: paved lots and lawns so the city reads as built-up,
    // not empty grass, between the roads.
    const blockTones = ['#a9a58c', '#7fae62', '#b5ac90', '#8d8d84', '#9aa78a'];
    for (let gx = 0; gx < ROADS_X.length - 1; gx += 1) {
      for (let gy = 0; gy < ROADS_Y.length - 1; gy += 1) {
        const bx0 = ROADS_X[gx] + WORLD.roadWidth / 2 + 10;
        const bx1 = ROADS_X[gx + 1] - WORLD.roadWidth / 2 - 10;
        const by0 = ROADS_Y[gy] + WORLD.roadWidth / 2 + 10;
        const by1 = ROADS_Y[gy + 1] - WORLD.roadWidth / 2 - 10;
        if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue;
        if (by0 > WORLD.beachY - 60) continue;
        ctx.fillStyle = blockTones[(gx * 3 + gy * 5) % blockTones.length];
        ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      }
    }
    // Beach + sea.
    ctx.fillStyle = '#ecd29a';
    ctx.fillRect(Math.max(x0, 0), WORLD.beachY, Math.min(x1, WORLD.width) - Math.max(x0, 0), WORLD.height - WORLD.beachY);
    ctx.fillStyle = '#3a9bc2';
    ctx.fillRect(Math.max(x0, 0), WORLD.waterY, Math.min(x1, WORLD.width) - Math.max(x0, 0), WORLD.height - WORLD.waterY);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let x = 0; x < WORLD.width; x += 90) {
      const wx = x + Math.sin(world.state.time * 0.7 + x) * 8;
      if (wx > x0 - 40 && wx < x1 + 40) ctx.fillRect(wx, WORLD.waterY + 6 + (x % 180 === 0 ? 14 : 0), 46, 3);
    }
    // Park.
    ctx.fillStyle = '#5d9e4d';
    ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    ctx.fillStyle = '#6fb3d8';
    ctx.beginPath();
    ctx.ellipse(city.park.x + 250, city.park.y + 230, 90, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sidewalks + roads.
    for (const rx of ROADS_X) {
      ctx.fillStyle = '#b9b3a4';
      ctx.fillRect(rx - WORLD.roadWidth / 2 - 10, Math.max(y0, 0), WORLD.roadWidth + 20, Math.min(y1, WORLD.height) - Math.max(y0, 0));
      ctx.fillStyle = '#3d3d46';
      ctx.fillRect(rx - WORLD.roadWidth / 2, Math.max(y0, 0), WORLD.roadWidth, Math.min(y1, WORLD.height) - Math.max(y0, 0));
    }
    for (const ry of ROADS_Y) {
      ctx.fillStyle = '#b9b3a4';
      ctx.fillRect(Math.max(x0, 0), ry - WORLD.roadWidth / 2 - 10, Math.min(x1, WORLD.width) - Math.max(x0, 0), WORLD.roadWidth + 20);
      ctx.fillStyle = '#3d3d46';
      ctx.fillRect(Math.max(x0, 0), ry - WORLD.roadWidth / 2, Math.min(x1, WORLD.width) - Math.max(x0, 0), WORLD.roadWidth);
    }
    // Lane dashes.
    ctx.fillStyle = '#e8d44d';
    for (const rx of ROADS_X) {
      for (let y = 0; y < WORLD.height; y += 64) {
        if (y > y0 - 32 && y < y1 + 32) ctx.fillRect(rx - 2, y, 4, 30);
      }
    }
    for (const ry of ROADS_Y) {
      for (let x = 0; x < WORLD.width; x += 64) {
        if (x > x0 - 32 && x < x1 + 32) ctx.fillRect(x, ry - 2, 30, 4);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        if (rx < x0 - 80 || rx > x1 + 80 || ry < y0 - 80 || ry > y1 + 80) continue;
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx - WORLD.roadWidth / 2 + 8 + (i + 3) * 14, ry - WORLD.roadWidth / 2 - 8, 8, 16);
        }
      }
    }
    // Buildings (culled to the view), with a sun shadow and lit windows.
    for (const b of city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      const sh = b.height * 6;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(255,240,180,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3 + b.height) % 4 === 0) {
            ctx.fillRect(b.x + 9 + c * 26, b.y + 9 + r * 26, 10, 12);
          }
        }
      }
      if (b.kind === 'shop') {
        ctx.fillStyle = '#f7c948';
        ctx.fillRect(b.x + 6, b.y + b.h - 16, b.w - 12, 10);
      }
    }
    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 - 20 || t.x > x1 + 20 || t.y < y0 - 20 || t.y > y1 + 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? '#2f9e44' : '#3d8b40';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      if (t.palm) {
        ctx.strokeStyle = '#8a6d3b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + 3, t.y + 12);
        ctx.stroke();
      }
    }
    // District labels on the ground.
    ctx.fillStyle = 'rgba(20,30,44,0.5)';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    for (const d of city.districts) {
      const cx = (d.x0 + d.x1) / 2;
      const cy = (d.y0 + d.y1) / 2;
      if (cx > x0 - 200 && cx < x1 + 200 && cy > y0 - 100 && cy < y1 + 100) {
        ctx.fillText(d.name, cx, cy);
      }
    }
  }

  function drawMarker(world) {
    const target = world.state.missionTarget;
    if (!target) return;
    const pulse = 1 + Math.sin(world.state.time * 5) * 0.15;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.fillStyle = world.state.missionIndex === 2 ? 'rgba(46,204,113,0.9)' : 'rgba(247,201,72,0.95)';
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, 5);
    ctx.strokeStyle = 'rgba(247,201,72,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 44 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Off-screen arrow pointing at the target.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sx = (target.x - camX) * zoom + vw / 2;
    const sy = (target.y - camY) * zoom + vh / 2;
    if (sx < 60 || sx > vw - 60 || sy < 60 || sy > vh - 60) {
      const cx = Math.max(60, Math.min(vw - 60, sx));
      const cy = Math.max(60, Math.min(vh - 60, sy));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(sy - vh / 2, sx - vw / 2));
      ctx.fillStyle = '#f7c948';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMinimap(world) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mx = vw - MINIMAP_W - 16;
    const my = vh - MINIMAP_H - 16;
    const sx = MINIMAP_W / WORLD.width;
    const sy = MINIMAP_H / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,28,0.82)';
    roundRect(ctx, mx - 6, my - 6, MINIMAP_W + 12, MINIMAP_H + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(mx, my, MINIMAP_W, MINIMAP_H);
    ctx.clip();
    ctx.fillStyle = '#5d8a4d';
    ctx.fillRect(mx, my, MINIMAP_W, MINIMAP_H);
    ctx.fillStyle = '#ecd29a';
    ctx.fillRect(mx, my + WORLD.beachY * sy, MINIMAP_W, MINIMAP_H - WORLD.beachY * sy);
    ctx.fillStyle = '#3a9bc2';
    ctx.fillRect(mx, my + WORLD.waterY * sy, MINIMAP_W, MINIMAP_H - WORLD.waterY * sy);
    ctx.strokeStyle = '#3d3d46';
    ctx.lineWidth = 3;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + MINIMAP_H);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + MINIMAP_W, my + ry * sy);
      ctx.stroke();
    }
    const target = world.state.missionTarget;
    if (target) {
      ctx.fillStyle = '#f7c948';
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of world.cars) {
      if (car.dead) continue;
      if (car.isCop) {
        ctx.fillStyle = '#2d7dff';
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(mx + world.player.x * sx, my + world.player.y * sy);
    ctx.rotate(world.player.angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMARA', mx, my - 10);
  }

  function drawHud(world, best) {
    const s = world.state;
    const vw = window.innerWidth;
    // Top-left: cash, health, stats.
    ctx.fillStyle = 'rgba(10,16,28,0.78)';
    roundRect(ctx, 14, 14, 250, 86, 10);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${s.cash.toLocaleString('en-US')}`, 28, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Missions ${s.missionsDone}/${MISSIONS.length}   Stashes ${s.stashesFound}/10`, 28, 68);
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(28, 76, 120, 10);
    ctx.fillStyle = s.health > 30 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(28, 76, 120 * (s.health / 100), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.fillText('HEALTH', 154, 85);
    // Top-right: wanted stars.
    ctx.fillStyle = 'rgba(10,16,28,0.78)';
    roundRect(ctx, vw - 224, 14, 210, 52, 10);
    ctx.fill();
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < s.stars ? '#f7c948' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', vw - 210 + i * 34, 48);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.fillText(s.stars > 0 ? 'WANTED' : 'CLEAN', vw - 210, 60);
    // Top-center: mission banner.
    const mission = MISSIONS[s.missionIndex];
    if (mission && s.missionState === 'active') {
      const text = `${mission.title}  •  ${mission.brief}`;
      ctx.font = 'bold 13px sans-serif';
      const w = Math.min(vw - 500, ctx.measureText(text).width + 28);
      ctx.fillStyle = 'rgba(10,16,28,0.82)';
      roundRect(ctx, (vw - w) / 2, 14, w, 44, 10);
      ctx.fill();
      ctx.fillStyle = '#f7c948';
      ctx.textAlign = 'center';
      ctx.fillText(text, vw / 2, 33);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      const sub = mission.timeLimit
        ? `Time left: ${Math.max(0, Math.ceil(s.missionTimer))}s${s.missionHasPackage ? ' — deliver it!' : ' — get the package'}`
        : s.missionTarget ? `Follow the ★ marker — ${s.missionTarget.label}` : '';
      ctx.fillText(sub, vw / 2, 51);
    } else if (mission && s.missionState === 'idle') {
      ctx.fillStyle = 'rgba(10,16,28,0.72)';
      roundRect(ctx, vw / 2 - 190, 14, 380, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Next: ${mission.title} — press ENTER to start`, vw / 2, 36);
    }
    // Message feed.
    if (s.messageTimer > 0 && s.message) {
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(s.message).width + 28;
      ctx.fillStyle = 'rgba(10,16,28,0.8)';
      roundRect(ctx, (vw - w) / 2, 74, w, 32, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(s.message, vw / 2, 95);
    }
    // Bottom-left: speed + controls.
    const car = world.player.inCar;
    ctx.fillStyle = 'rgba(10,16,28,0.72)';
    roundRect(ctx, 14, window.innerHeight - 86, 310, 72, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(car ? `${Math.round(car.speed * 0.22)} km/h` : 'ON FOOT', 28, window.innerHeight - 52);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#dfe6e9';
    ctx.fillText(car ? 'W/S drive • A/D steer • SPACE handbrake • E exit' : 'WASD move • SHIFT run • SPACE punch • E enter car', 28, window.innerHeight - 32);
    if (car) {
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(28, window.innerHeight - 26, 120, 8);
      ctx.fillStyle = car.health > 30 ? '#00b894' : '#e74c3c';
      ctx.fillRect(28, window.innerHeight - 26, 120 * Math.max(0, car.health / 100), 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.fillText('CAR', 154, window.innerHeight - 18);
    }
    drawMinimap(world);
  }

  function drawOverlay(title, lines, accent) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    ctx.fillStyle = 'rgba(8,12,24,0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#f7c948';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(title, vw / 2, vh / 2 - 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, vw / 2, vh / 2 - 70 + i * 28);
    });
  }

  function drawTitle(world, hasSave) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Paint the city behind the title so the menu already shows the world.
    draw(world, SCREEN_PLAY, 0, true);
    ctx.fillStyle = 'rgba(8,12,24,0.55)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMARA', vw / 2, vh / 2 - 130);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('STREETS OF GOLD — an open-world crime game', vw / 2, vh / 2 - 96);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#dfe6e9';
    const lines = [
      'Explore Solmara on foot or by car. Steal cars, dodge the cops, run three missions for Mara Voss.',
      'WASD / arrows — move & drive • SHIFT — run • E — enter / exit car • SPACE — punch / handbrake',
      'P — pause • M — mute • your cash, missions and stashes save automatically',
      '',
      hasSave ? 'ENTER — continue your story        N — start a new game' : 'ENTER or CLICK — start the game',
    ];
    lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh / 2 - 40 + i * 26));
    ctx.fillStyle = '#f7c948';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('A fully original game — its own city, names and story. No network needed: it runs offline.', vw / 2, vh / 2 + 130);
  }

  function draw(world, screen, best, backdropOnly) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const p = world.player;
    const targetZoom = p.inCar ? 0.92 : 1.05;
    zoom += (targetZoom - zoom) * 0.05;
    camX += (p.x - camX) * 0.12;
    camY += (p.y - camY) * 0.12;
    if (screen === SCREEN_TITLE && !backdropOnly) {
      camX = p.x;
      camY = p.y;
    }
    const view = {
      x0: camX - vw / 2 / zoom - 80,
      y0: camY - vh / 2 / zoom - 80,
      x1: camX + vw / 2 / zoom + 80,
      y1: camY + vh / 2 / zoom + 80,
    };
    // Sky-tinted backdrop beyond the map edge.
    ctx.fillStyle = '#2c6e8f';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawCity(world, view);
    // Cash stashes sparkle.
    for (const stash of world.stashes) {
      if (stash.taken) continue;
      if (stash.x < view.x0 || stash.x > view.x1 || stash.y < view.y0 || stash.y > view.y1) continue;
      const bob = Math.sin(world.state.time * 4 + stash.x) * 4;
      ctx.fillStyle = '#f7c948';
      ctx.beginPath();
      ctx.arc(stash.x, stash.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', stash.x, stash.y + bob + 4);
    }
    drawMarker(world);
    // Cars, sorted so nearer ones draw later (cheap painter's order by y).
    const drawCars = world.cars.filter((c) => !c.dead).slice().sort((a, b) => a.y - b.y);
    for (const car of drawCars) {
      if (car.x < view.x0 - 80 || car.x > view.x1 + 80 || car.y < view.y0 - 80 || car.y > view.y1 + 80) continue;
      drawCar(car.x, car.y, car.angle, car.color, car);
    }
    for (const ped of world.peds) {
      if (ped.x < view.x0 - 30 || ped.x > view.x1 + 30 || ped.y < view.y0 - 30 || ped.y > view.y1 + 30) continue;
      drawPed(ped.x, ped.y, ped.angle, ped.shirt, ped.state === 'down');
    }
    for (const cop of world.cops) {
      if (cop.downTimer > 0 && cop.downTimer < -4) continue;
      if (cop.x < view.x0 - 30 || cop.x > view.x1 + 30 || cop.y < view.y0 - 30 || cop.y > view.y1 + 30) continue;
      drawPed(cop.x, cop.y, cop.angle, '#16213e', cop.downTimer > 0);
      ctx.fillStyle = '#1f4fd8';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', cop.x, cop.y - 1);
    }
    // Player on foot (in a car he is the car).
    if (!p.inCar) {
      const blink = p.hurtTimer > 0 && Math.floor(p.hurtTimer * 12) % 2 === 0;
      if (!blink) {
        drawPed(p.x, p.y, p.angle, '#e84393', false);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Particles.
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Warm sun vignette.
    const grad = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    grad.addColorStop(0, 'rgba(255,200,90,0)');
    grad.addColorStop(1, 'rgba(255,170,60,0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    if (backdropOnly) return;
    if (screen === SCREEN_PLAY) drawHud(world, best);
    else if (screen === SCREEN_PAUSED) {
      drawHud(world, best);
      drawOverlay('PAUSED', ['Press P or ENTER to keep playing', 'M — mute • your progress is saved'], '#ffffff');
    } else if (screen === SCREEN_OVER) {
      drawOverlay('BUSTED / WASTED', ['The streets of Solmara are unforgiving.', 'ENTER — back on the streets'], '#e74c3c');
    } else if (screen === SCREEN_WIN) {
      drawOverlay('KING OF SOLMARA', [`All three missions done. Cash: $${world.state.cash.toLocaleString('en-US')}`, 'ENTER — keep playing free roam'], '#2ecc71');
    }
  }

  return {
    draw,
    drawTitle,
    SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN,
  };
}
