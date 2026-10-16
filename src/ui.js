// Title, garage car select and time-slip results.
import { W, H, drawCar, carLength } from './render.js';
import { peakHp, peakTorque } from './physics.js';
import { DISPLAY, MONO, SANS, roundRect, text, clamp, makeCanvas, rng } from './gfx.js';

const BLUE = '#2a7dff';

// ---------------------------------------------------------------- shared bits
function checkerFlag(ctx, x, y, size, time) {
  // waving 6x4 flag on a pole
  const cols = 7, rows = 5, cw = size / cols, chh = size * 0.62 / rows;
  ctx.fillStyle = '#cfd2d6'; ctx.fillRect(x - 4, y - 6, 4, size * 0.95);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const wave = (k) => Math.sin(time * 4 - (c + k) * 0.7) * size * 0.04 * ((c + k) / cols);
    const x0 = x + c * cw, x1 = x0 + cw, y0 = y + r * chh, y1 = y0 + chh;
    ctx.fillStyle = (c + r) % 2 ? '#111' : '#f4f4f4';
    ctx.beginPath();
    ctx.moveTo(x0, y0 + wave(0)); ctx.lineTo(x1, y0 + wave(1)); ctx.lineTo(x1, y1 + wave(1)); ctx.lineTo(x0, y1 + wave(0));
    ctx.fill();
  }
}

function logo(ctx, cx, cy, scale, time) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(scale, scale);
  // swoosh ellipse
  ctx.fillStyle = '#26262c';
  ctx.beginPath(); ctx.ellipse(10, 6, 250, 70, -0.08, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 3; ctx.stroke();
  checkerFlag(ctx, -250, -70, 90, time);
  text(ctx, 'DRAG', -40, -22, { font: `italic 88px ${DISPLAY}`, color: BLUE, shadow: '#000' });
  const g = ctx.createLinearGradient(0, 10, 0, 80);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b9bcc2'); g.addColorStop(1, '#6f737a');
  ctx.font = `italic 88px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000'; ctx.fillText('RACER', 84, 48);
  ctx.fillStyle = g; ctx.fillText('RACER', 80, 44);
  ctx.restore();
}

function speedLines(ctx, time, alpha = 0.06) {
  const r = rng(9);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < 40; i++) {
    const y = r() * H, len = 80 + r() * 240, sp = 300 + r() * 700;
    const x = W - ((time * sp + r() * 2000) % (W + len + 200));
    ctx.fillRect(x, y, len, 1 + r() * 1.5);
  }
}

function arrow(ctx, x, y, dir, size, hot) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir * size / 40, size / 40);
  const g = ctx.createLinearGradient(-20, 0, 22, 0);
  g.addColorStop(0, hot ? '#ffef5a' : '#ffd23a'); g.addColorStop(1, hot ? '#ff4d1a' : '#e6731a');
  ctx.beginPath();
  ctx.moveTo(-20, -9); ctx.lineTo(2, -9); ctx.lineTo(2, -20); ctx.lineTo(24, 0); ctx.lineTo(2, 20); ctx.lineTo(2, 9); ctx.lineTo(-20, 9);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#2a1500'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}

export function keycap(ctx, label, x, y) {
  ctx.font = `13px ${DISPLAY}`;
  const w = Math.max(26, ctx.measureText(label).width + 16);
  roundRect(ctx, x, y - 13, w, 26, 5);
  ctx.fillStyle = '#e9eaec'; ctx.fill();
  ctx.strokeStyle = '#7a7d84'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 2, y + 9, w - 4, 3);
  text(ctx, label, x + w / 2, y, { font: `13px ${DISPLAY}`, color: '#1a1a1e' });
  return w;
}

// ---------------------------------------------------------------- title
export function drawTitle(ctx, time, best, cars) {
  ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, W, H);
  speedLines(ctx, time);
  // wireframe car drifting past, like the original intro line art
  const car = cars[Math.floor(time / 6) % cars.length];
  const t = (time % 6) / 6;
  ctx.globalAlpha = Math.sin(t * Math.PI) * 0.5;
  drawCar(ctx, car, W * (1.05 - t * 1.5), 520, { ppm: 78, line: '#ffffff', angle: time * 6 });
  ctx.globalAlpha = 1;

  logo(ctx, W / 2 + 10, 150, 1, time);

  if (Math.floor(time * 1.6) % 2 === 0) {
    text(ctx, 'PRESS ENTER', W / 2, 300, { font: `italic 32px ${DISPLAY}`, color: '#fff', shadow: '#000' });
  }
  text(ctx, 'or tap to start', W / 2, 330, { font: `14px ${SANS}`, color: '#8a8d94' });

  // controls card
  const cy = 400;
  roundRect(ctx, W / 2 - 330, cy - 34, 660, 104, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();
  const items = [
    [['SPACE'], 'Gas / rev'], [['↑'], 'Launch / upshift'], [['↓'], 'Downshift'],
    [['N'], 'Nitrous'], [['←', '→'], 'Launch rpm'], [['ESC'], 'Quit race'],
  ];
  items.forEach(([keys, label], i) => {
    const x = W / 2 - 312 + i * 106;
    let kx = x;
    for (const k of keys) kx += keycap(ctx, k, kx, cy - 6) + 4;
    text(ctx, label, x, cy + 24, { font: `13px ${SANS}`, color: '#b7bac1', align: 'left' });
  });
  text(ctx, 'Rev against the two-step, dump the clutch as the last amber fades, shift on the light.',
    W / 2, cy + 52, { font: `13px ${SANS}`, color: '#6f727a' });

  if (best) text(ctx, `BEST ET  ${best.toFixed(3)}s`, W / 2, H - 20, { font: `16px ${MONO}`, color: '#ffd34d' });
}

// ---------------------------------------------------------------- garage / select
let garage = null;
function makeGarage() {
  const [c, g] = makeCanvas(W, H);
  const wall = g.createLinearGradient(0, 0, 0, 330);
  wall.addColorStop(0, '#8d8f95'); wall.addColorStop(1, '#c7c9cd');
  g.fillStyle = wall; g.fillRect(0, 0, W, 330);
  // roof beam
  g.fillStyle = '#5b3a1f'; g.fillRect(0, 0, W, 26); g.fillStyle = '#3a2412'; g.fillRect(0, 26, W, 6);
  // night window
  g.fillStyle = '#4a4b50'; g.fillRect(300, 60, 300, 160);
  const sky = g.createLinearGradient(0, 66, 0, 214);
  sky.addColorStop(0, '#071436'); sky.addColorStop(1, '#14307a');
  g.fillStyle = sky; g.fillRect(306, 66, 288, 148);
  const r = rng(4);
  g.fillStyle = '#fff'; for (let i = 0; i < 26; i++) g.fillRect(306 + r() * 288, 66 + r() * 110, 1.5, 1.5);
  g.fillStyle = '#4a4b50'; g.fillRect(447, 66, 6, 148);
  // tool chest
  g.fillStyle = '#a8141b'; g.fillRect(40, 120, 150, 220);
  g.fillStyle = '#6d0b10'; for (let y = 140; y < 330; y += 22) g.fillRect(48, y, 134, 3);
  g.fillStyle = '#dcdcdc'; for (let y = 128; y < 330; y += 22) g.fillRect(90, y, 50, 3);
  // nitrous bottle on top
  g.fillStyle = '#1f47c4'; g.beginPath(); g.roundRect ? g.roundRect(60, 98, 90, 22, 10) : g.rect(60, 98, 90, 22); g.fill();
  g.fillStyle = '#c9ccd1'; g.fillRect(150, 104, 14, 10);
  // floor
  const fl = g.createLinearGradient(0, 330, 0, H);
  fl.addColorStop(0, '#9a9ca1'); fl.addColorStop(1, '#5d5f64');
  g.fillStyle = fl; g.fillRect(0, 330, W, H - 330);
  g.fillStyle = '#6d6f74'; g.fillRect(0, 328, W, 3);
  garage = c;
}

function statBar(ctx, label, frac, x, y, w) {
  text(ctx, label, x, y, { font: `15px ${DISPLAY}`, color: '#ffe066', align: 'left' });
  roundRect(ctx, x + 96, y - 7, w, 14, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  roundRect(ctx, x + 96, y - 7, Math.max(14, w * clamp(frac, 0, 1)), 14, 7);
  const g = ctx.createLinearGradient(x + 96, 0, x + 96 + w, 0);
  g.addColorStop(0, '#ffd23a'); g.addColorStop(1, '#ff6a1a');
  ctx.fillStyle = g; ctx.fill();
}

export function drawSelect(ctx, cars, idx, time, bests, twoStep, levels = [], levelIdx = 0, record = {}) {
  if (!garage) makeGarage();
  ctx.drawImage(garage, 0, 0, W, H);
  const car = cars[idx];

  // spotlight + car
  const sp = ctx.createRadialGradient(330, 440, 10, 330, 440, 330);
  sp.addColorStop(0, 'rgba(255,255,255,0.35)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.fillRect(0, 0, 680, H);
  const ppm = 118;
  const len = carLength(car);
  drawCar(ctx, car, 330 - len * ppm / 2, 455, { ppm, angle: 0, pitch: Math.sin(time * 2.2) * 0.004 });

  // spec panel (the original's red tuning panel)
  const px = 680, pw = 262;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + 6, 16, pw, H - 32);
  const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
  pg.addColorStop(0, '#8e1218'); pg.addColorStop(1, '#6a0c11');
  ctx.fillStyle = pg; ctx.fillRect(px, 10, pw, H - 32);
  ctx.fillStyle = '#c41a22'; ctx.fillRect(px, 10, pw, 34);
  ctx.strokeStyle = '#2a0406'; ctx.lineWidth = 3; ctx.strokeRect(px, 10, pw, H - 32);
  text(ctx, 'CHOOSE YOUR RIDE', px + pw / 2, 28, { font: `italic 18px ${DISPLAY}`, color: '#fff' });

  text(ctx, car.name, px + 16, 76, { font: `italic 28px ${DISPLAY}`, color: '#fff', align: 'left', shadow: 'rgba(0,0,0,0.5)' });
  // blurb, wrapped
  ctx.font = `14px ${SANS}`;
  const words = car.blurb.split(' '); let line = '', ly = 106;
  for (const w of words) {
    if (ctx.measureText(line + w).width > pw - 32) { text(ctx, line.trim(), px + 16, ly, { font: `14px ${SANS}`, color: '#ffd6d6', align: 'left' }); line = ''; ly += 18; }
    line += w + ' ';
  }
  text(ctx, line.trim(), px + 16, ly, { font: `14px ${SANS}`, color: '#ffd6d6', align: 'left' });

  const hp = peakHp(car), tq = peakTorque(car);
  const maxHp = Math.max(...cars.map(peakHp)), maxTq = Math.max(...cars.map(peakTorque));
  const sy = 170;
  statBar(ctx, 'POWER', hp / maxHp, px + 16, sy, 140);
  statBar(ctx, 'TORQUE', tq / maxTq, px + 16, sy + 30, 140);
  statBar(ctx, 'WEIGHT', car.mass / 1700, px + 16, sy + 60, 140);
  statBar(ctx, 'GRIP', (car.mu - 1.2) / 0.6, px + 16, sy + 90, 140);
  statBar(ctx, 'REVS', car.redline / 8500, px + 16, sy + 120, 140);

  const spec = [
    ['Engine', `${car.cyl === 8 ? 'V8' : 'I4'} · ${hp} hp · ${Math.round(tq)} Nm`],
    ['Weight', `${car.mass} kg`],
    ['Gearbox', `${car.gears.length}-speed manual`],
    ['Redline', `${car.redline.toLocaleString()} rpm`],
    ['Launch', `${twoStep.toLocaleString()} rpm two-step`],
    ['Best ET', bests[car.id] ? `${bests[car.id].toFixed(3)} s` : '—'],
  ];
  spec.forEach(([k, v], i) => {
    const y = 324 + i * 23;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; if (i % 2 === 0) ctx.fillRect(px + 8, y - 12, pw - 16, 24);
    text(ctx, k, px + 16, y, { font: `14px ${DISPLAY}`, color: '#ffe066', align: 'left' });
    text(ctx, v, px + pw - 14, y, { font: `14px ${SANS}`, color: '#fff', align: 'right' });
  });

  // change car arrows
  text(ctx, 'CHANGE CAR', 40, 460, { font: `italic 20px ${DISPLAY}`, color: '#1a1a1e', align: 'left' });
  const pulse = Math.sin(time * 5) > 0.6;
  arrow(ctx, 70, 502, -1, 44, pulse);
  arrow(ctx, 130, 502, 1, 44, pulse);
  text(ctx, `${idx + 1} / ${cars.length}`, 190, 502, { font: `16px ${DISPLAY}`, color: '#2a2a30', align: 'left' });

  // opponent difficulty
  if (levels.length) {
    const lx = 262, ly = 500, lw = 94;
    text(ctx, 'OPPONENT', lx, 466, { font: `italic 20px ${DISPLAY}`, color: '#1a1a1e', align: 'left' });
    text(ctx, '▲ ▼', lx + 122, 467, { font: `13px ${DISPLAY}`, color: '#4a4a52', align: 'left' });
    const rec = record[levels[levelIdx].id];
    if (rec) text(ctx, `W ${rec[0]}  ·  L ${rec[1]}`, lx + 4 * lw - 6, 467, { font: `14px ${MONO}`, color: '#2a2a30', align: 'right' });
    const tint = ['#3fcf5e', '#ffd23a', '#ff8a1a', '#ff3b30'];
    levels.forEach((lv, i) => {
      const x = lx + i * lw, on = i === levelIdx;
      roundRect(ctx, x, ly - 16, lw - 6, 32, 6);
      ctx.fillStyle = on ? tint[i % tint.length] : 'rgba(20,20,26,0.55)'; ctx.fill();
      ctx.strokeStyle = on ? '#1a1a1e' : 'rgba(0,0,0,0.3)'; ctx.lineWidth = on ? 2.5 : 1; ctx.stroke();
      text(ctx, lv.name, x + (lw - 6) / 2, ly + 1, { font: `italic 15px ${DISPLAY}`, color: on ? '#1a1a1e' : '#c9cbd0' });
    });
  }

  // go button
  const bx = px + 16, by = H - 70, bw = pw - 32;
  roundRect(ctx, bx, by, bw, 40, 6);
  ctx.fillStyle = Math.floor(time * 2) % 2 ? '#ffd23a' : '#ffe066'; ctx.fill();
  ctx.strokeStyle = '#2a1500'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, 'ENTER TO RACE', bx + bw / 2, by + 21, { font: `italic 20px ${DISPLAY}`, color: '#8e1218' });
}

// ---------------------------------------------------------------- results / time slip
export function drawResults(ctx, race, best, isNewBest, t) {
  const k = clamp(t * 3, 0, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.7 * k})`; ctx.fillRect(0, 0, W, H);
  const title = { win: 'YOU WIN!', lose: 'YOU LOSE', foul: 'RED LIGHT!', test: 'TEST PASS', dnf: 'NO TIME' }[race.result];
  const color = race.result === 'test' ? '#ffd34d' : race.result === 'win' ? '#4cff7a' : '#ff4a3d';
  text(ctx, title, 250, 90, { font: `italic 60px ${DISPLAY}`, color, shadow: '#000' });
  const p = race.p, a = race.a;
  const margin = p.fin != null && a.fin != null ? Math.abs(p.fin - a.fin) : null;
  if (race.result === 'foul') text(ctx, 'Left the line before the green.', 250, 140, { font: `16px ${SANS}`, color: '#ddd' });
  else if (race.solo) text(ctx, 'Solo tune test · No opponent', 250, 140, { font: `18px ${SANS}`, color: '#ddd' });
  else if (a.red && race.result === 'win') text(ctx, 'Opponent false start', 250, 140, { font: `18px ${SANS}`, color: '#ddd' });
  else if (margin != null) text(ctx, `by ${margin.toFixed(3)} s`, 250, 140, { font: `20px ${MONO}`, color: '#ddd' });
  if (isNewBest) text(ctx, 'NEW PERSONAL BEST!', 250, 190, { font: `italic 24px ${DISPLAY}`, color: '#ffd34d', shadow: '#000' });
  else if (best) text(ctx, `Best ET ${best.toFixed(3)} s`, 250, 190, { font: `16px ${MONO}`, color: '#ffd34d' });


  let kx = 120;
  kx += keycap(ctx, 'ENTER', kx, 300) + 8;
  text(ctx, race.solo ? 'test again' : 'race again', kx, 300, { font: `14px ${SANS}`, color: '#ccc', align: 'left' });
  kx = 120;
  kx += keycap(ctx, 'ESC', kx, 336) + 8;
  text(ctx, 'garage', kx, 336, { font: `14px ${SANS}`, color: '#ccc', align: 'left' });

  // thermal-paper time slip slides up
  const sx = 520, sw = 380, sh = 470;
  const sy = 40 + (1 - k) * 500;
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(0.015);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(6, 8, sw, sh);
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (let x = 0; x <= sw; x += 10) ctx.lineTo(x, (x / 10) % 2 ? 4 : 0);
  ctx.lineTo(sw, sh);
  for (let x = sw; x >= 0; x -= 10) ctx.lineTo(x, sh - ((x / 10) % 2 ? 4 : 0));
  ctx.closePath();
  const pg = ctx.createLinearGradient(0, 0, sw, sh);
  pg.addColorStop(0, '#f6f3ea'); pg.addColorStop(1, '#e4dfd2');
  ctx.fillStyle = pg; ctx.fill();

  const ink = '#26262a', dim = '#7a776f';
  const mono = (s, x, y, al = 'left', c = ink, sz = 16) => text(ctx, s, x, y, { font: `${sz}px ${MONO}`, color: c, align: al });
  mono('QUARTER MILE DRAGWAY', sw / 2, 30, 'center', ink, 19);
  mono('* OFFICIAL TIME SLIP *', sw / 2, 52, 'center', dim, 13);
  ctx.fillStyle = ink; ctx.fillRect(20, 68, sw - 40, 1);
  const c1 = 210, c2 = sw - 24;
  mono('LEFT', c1, 84, 'right', dim, 12); mono(race.solo ? 'SOLO TEST' : 'RIGHT', c2, 84, 'right', dim, 12);
  mono(p.car.name, c1, 100, 'right', ink, 13); mono(race.solo ? '' : a.car.name, c2, 100, 'right', ink, 13);
  mono('YOU', c1, 115, 'right', dim, 11); mono(race.solo ? '' : `CPU · ${race.level?.name ?? ''}`, c2, 115, 'right', dim, 11);
  const f = (v, d = 3) => (v == null ? '  -.---' : v.toFixed(d));
  const rows = [
    ['R/T', (L) => (L.rt == null ? '  -.---' : L.rt.toFixed(3))],
    ["60'", (L) => f(L.splits[60])], ["330'", (L) => f(L.splits[330])],
    ["1/8", (L) => f(L.splits[660])], ['MPH', (L) => f(L.mph8, 2)],
    ["1000'", (L) => f(L.splits[1000])],
    ['1/4', (L) => f(L.et)], ['MPH', (L) => f(L.mph, 2)],
  ];
  rows.forEach(([label, fn], i) => {
    const y = 140 + i * 30;
    const big = label === '1/4';
    mono(label, 24, y, 'left', ink, big ? 18 : 16);
    mono(fn(p), c1, y, 'right', p.red && label === 'R/T' ? '#b3100c' : ink, big ? 18 : 16);
    mono(race.solo ? '—' : fn(a), c2, y, 'right', ink, big ? 18 : 16);
  });
  ctx.fillStyle = ink; ctx.fillRect(20, 140 + rows.length * 30 - 8, sw - 40, 1);
  const yW = 140 + rows.length * 30 + 22;
  const pWin = race.winner === 'p';
  mono(race.solo ? (p.red ? 'RED' : p.et == null ? 'DNF' : 'TEST') : pWin ? 'WIN' : (p.red ? 'RED' : '—'), c1, yW, 'right', pWin ? '#127a2c' : '#b3100c', 18);
  mono(race.solo ? '' : !pWin ? 'WIN' : '—', c2, yW, 'right', !pWin ? '#127a2c' : ink, 18);
  mono(`LANE TEMP 31C  ·  DA 1200FT`, sw / 2, sh - 26, 'center', dim, 12);
  ctx.restore();
}

