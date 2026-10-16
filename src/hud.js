// Dashboard (chrome gauges, H-pattern shifter, LCD logger), christmas tree, hints.
import { W, H, TRACK_BOT } from './render.js';
import { FINISH, MPH, shiftLight } from './physics.js';
import { ambers, isGreen, STAGE_AT } from './race.js';
import { DISPLAY, MONO, SANS, makeCanvas, rng, roundRect, clamp, text } from './gfx.js';

const A0 = Math.PI * 0.75, SWEEP = Math.PI * 1.5;
const DASH_TOP = TRACK_BOT;
const ang = (v, max) => A0 + SWEEP * clamp(v / max, 0, 1.02);

// ---------------------------------------------------------------- gauge faces (cached)
const faces = new Map();
function gaugeFace(key, r, { max, step, minor = 2, label, sub, redFrom, fmt = (n) => n }) {
  if (faces.has(key)) return faces.get(key);
  const pad = 14, size = (r + pad) * 2;
  const [c, g] = makeCanvas(size, size);
  const cx = size / 2, cy = size / 2;
  // recessed pod
  g.fillStyle = '#060608'; g.beginPath(); g.arc(cx, cy, r + 13, 0, 7); g.fill();
  // chrome bezel
  const bz = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  bz.addColorStop(0, '#ffffff'); bz.addColorStop(0.35, '#9da1a8'); bz.addColorStop(0.5, '#eef0f2');
  bz.addColorStop(0.75, '#6c7077'); bz.addColorStop(1, '#c9ccd1');
  g.fillStyle = bz; g.beginPath(); g.arc(cx, cy, r + 9, 0, 7); g.fill();
  g.fillStyle = '#1a1a1e'; g.beginPath(); g.arc(cx, cy, r + 2, 0, 7); g.fill();
  // face
  const fg = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
  fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.75, '#e9eaec'); fg.addColorStop(1, '#bfc1c6');
  g.fillStyle = fg; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  // red zone
  if (redFrom != null) {
    g.lineWidth = r * 0.13;
    const rg = g.createLinearGradient(cx, cy - r, cx + r, cy);
    rg.addColorStop(0, '#ff4a3d'); rg.addColorStop(1, '#a8100c');
    g.strokeStyle = rg;
    g.beginPath(); g.arc(cx, cy, r * 0.86, ang(redFrom, max), A0 + SWEEP); g.stroke();
  }
  // ticks + numerals
  g.strokeStyle = '#141416'; g.fillStyle = '#141416';
  const sub_ = step / minor;
  for (let v = 0; v <= max + 1e-6; v += sub_) {
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    const a = ang(v, max), co = Math.cos(a), si = Math.sin(a);
    const r0 = major ? r * 0.74 : r * 0.82;
    g.lineWidth = major ? Math.max(2, r * 0.03) : 1.2;
    g.beginPath(); g.moveTo(cx + co * r0, cy + si * r0); g.lineTo(cx + co * r * 0.93, cy + si * r * 0.93); g.stroke();
    if (major) {
      g.font = `${Math.round(r * 0.2)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = redFrom != null && v >= redFrom ? '#b3100c' : '#141416';
      g.fillText(String(fmt(v)), cx + co * r * 0.58, cy + si * r * 0.58);
    }
  }
  g.fillStyle = '#2a2a30'; g.font = `${Math.round(r * 0.13)}px ${DISPLAY}`; g.textAlign = 'center';
  g.fillText(label, cx, cy + r * 0.3);
  if (sub) { g.font = `${Math.round(r * 0.09)}px ${SANS}`; g.fillStyle = '#666'; g.fillText(sub, cx, cy + r * 0.43); }
  // inner shadow
  const sh = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sh; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  faces.set(key, c);
  return c;
}

function needle(ctx, cx, cy, r, a, color = '#e0201b') {
  const co = Math.cos(a), si = Math.sin(a), nx = -si, ny = co;
  const tip = r * 0.88, tail = r * 0.2, w = r * 0.035;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const path = (ox, oy) => {
    ctx.beginPath();
    ctx.moveTo(cx + ox - co * tail + nx * w * 1.4, cy + oy - si * tail + ny * w * 1.4);
    ctx.lineTo(cx + ox + co * tip, cy + oy + si * tip);
    ctx.lineTo(cx + ox - co * tail - nx * w * 1.4, cy + oy - si * tail - ny * w * 1.4);
    ctx.closePath();
  };
  path(3, 4); ctx.fill();
  ctx.fillStyle = color; path(0, 0); ctx.fill();
  const cap = ctx.createRadialGradient(cx - r * 0.03, cy - r * 0.03, 1, cx, cy, r * 0.11);
  cap.addColorStop(0, '#6a6d73'); cap.addColorStop(1, '#141416');
  ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(cx, cy, r * 0.11, 0, 7); ctx.fill();
}

function glare(ctx, cx, cy, r) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx, cy);
  g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.02, Math.PI * 1.62); ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.2, cx - r, cy - r * 0.02); ctx.fill();
}

function lcd(ctx, x, y, w, h, str, size = 15, align = 'center') {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = '#121a14'; ctx.fill();
  ctx.strokeStyle = '#5a5e64'; ctx.lineWidth = 1.5; ctx.stroke();
  text(ctx, str, align === 'center' ? x + w / 2 : x + w - 6, y + h / 2 + 1, { font: `${size}px ${MONO}`, color: '#8dff9c', align });
}

function drawGauge(ctx, key, cx, cy, r, val, opts) {
  const face = gaugeFace(key, r, opts);
  ctx.drawImage(face, cx - face.lw / 2, cy - face.lh / 2, face.lw, face.lh);
  if (opts.extra) opts.extra(cx, cy, r);
  needle(ctx, cx, cy, r, ang(val, opts.max), opts.needle);
  glare(ctx, cx, cy, r);
}

// ---------------------------------------------------------------- dash panel (cached)
let panel = null;
function makePanel() {
  const h = H - DASH_TOP;
  const [c, g] = makeCanvas(W, h);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2c2c33'); bg.addColorStop(0.2, '#1b1b20'); bg.addColorStop(1, '#09090b');
  g.fillStyle = bg; g.fillRect(0, 0, W, h);
  // carbon weave
  const rnd = rng(3);
  for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < W; x += 8) {
    g.fillStyle = `rgba(255,255,255,${0.025 + rnd() * 0.015})`; g.fillRect(x, y, 4, 2);
  }
  // sweeping cowl highlight like the original dash
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(250, 6, 710, 6, W, 40); g.stroke();
  g.fillStyle = '#4a4a54'; g.fillRect(0, 0, W, 2);
  g.fillStyle = '#000'; g.fillRect(0, 2, W, 2);
  panel = c;
}

// ---------------------------------------------------------------- shifter
const knob = { x: 0, y: 0 };
function slot(gear, n) {
  if (gear === 0) return [0, 0];
  const cols = Math.ceil(n / 2), col = Math.floor((gear - 1) / 2);
  const x = (col - (cols - 1) / 2) * 34;
  return [x, gear % 2 ? -34 : 34];
}
function drawShifter(ctx, cx, cy, s, car, dt) {
  const n = car.gears.length;
  const pg = ctx.createRadialGradient(cx - 20, cy - 25, 5, cx, cy, 78);
  pg.addColorStop(0, '#3a3a42'); pg.addColorStop(1, '#0d0d10');
  ctx.fillStyle = '#060608'; ctx.beginPath(); ctx.arc(cx, cy, 80, 0, 7); ctx.fill();
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(cx, cy, 74, 0, 7); ctx.fill();
  // engraved gate
  ctx.strokeStyle = '#000'; ctx.lineWidth = 11; ctx.lineCap = 'round';
  const gate = () => {
    ctx.beginPath();
    const cols = Math.ceil(n / 2);
    const xl = slot(1, n)[0], xr = (cols - 1) / 2 * 34;
    ctx.moveTo(xl + cx, cy); ctx.lineTo(xr + cx, cy);
    for (let g = 1; g <= n; g++) { const [x, y] = slot(g, n); ctx.moveTo(cx + x, cy); ctx.lineTo(cx + x, cy + y); }
    ctx.stroke();
  };
  gate();
  ctx.strokeStyle = '#2b2b31'; ctx.lineWidth = 7; gate();
  ctx.lineCap = 'butt';
  for (let g = 1; g <= n; g++) {
    const [x, y] = slot(g, n);
    text(ctx, String(g), cx + x + (y < 0 ? 0 : 0), cy + y + (y < 0 ? -15 : 15), { font: `12px ${DISPLAY}`, color: '#8b8e96' });
  }
  // knob eases toward its slot (through neutral)
  const [tx, ty] = slot(s.gear, n);
  const k = clamp(dt * 22, 0, 1);
  if (Math.abs(knob.x - tx) > 1 && Math.abs(knob.y) > 1) knob.y += (0 - knob.y) * k;
  else { knob.x += (tx - knob.x) * k; knob.y += (ty - knob.y) * k; }
  const kx = cx + knob.x, ky = cy + knob.y;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(kx + 3, ky + 5, 21, 0, 7); ctx.fill();
  const kg = ctx.createRadialGradient(kx - 7, ky - 8, 2, kx, ky, 22);
  kg.addColorStop(0, '#ffffff'); kg.addColorStop(0.7, '#d8d9dd'); kg.addColorStop(1, '#8e9198');
  ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, 21, 0, 7); ctx.fill();
  text(ctx, s.gear === 0 ? 'N' : String(s.gear), kx, ky + 1, { font: `22px ${DISPLAY}`, color: '#111' });
}

// ---------------------------------------------------------------- main HUD
let lastTime = null;
export function drawHud(ctx, race, time) {
  if (!panel) makePanel();
  const dt = lastTime === null ? 0 : clamp(time - lastTime, 0, 0.1);
  lastTime = time;
  const { p, a } = race, s = p.s, car = p.car;
  ctx.drawImage(panel, 0, DASH_TOP, W, H - DASH_TOP);

  // LCD data logger (left)
  const L = p, f = (v, d = 3) => (v == null ? '-.---' : v.toFixed(d));
  const rows = [
    ['R/T', L.rt == null ? '-.---' : (L.red ? 'RED ' : '') + L.rt.toFixed(3)],
    ["60'", f(L.splits[60])], ["330'", f(L.splits[330])], ['1/8', f(L.splits[660])],
    ['1/4', f(L.et)], ['MPH', L.mph == null ? '---.--' : L.mph.toFixed(2)],
  ];
  roundRect(ctx, 16, DASH_TOP + 22, 150, 160, 8);
  ctx.fillStyle = '#0d120e'; ctx.fill(); ctx.strokeStyle = '#4b4f55'; ctx.lineWidth = 2; ctx.stroke();
  rows.forEach(([k, v], i) => {
    const y = DASH_TOP + 42 + i * 24;
    text(ctx, k, 28, y, { font: `15px ${MONO}`, color: '#4fa65c', align: 'left' });
    text(ctx, v, 154, y, { font: `17px ${MONO}`, color: k === 'R/T' && L.red ? '#ff5a4a' : '#8dff9c', align: 'right' });
  });

  // speedometer
  const mph = s.v * MPH;
  drawGauge(ctx, 'speed', 285, 448, 76, mph, {
    max: 160, step: 20, minor: 4, label: 'MPH', needle: '#e0201b',
    extra: (cx, cy, r) => lcd(ctx, cx - 30, cy + r * 0.52, 60, 20, `${Math.round(mph)}`, 15),
  });

  // tachometer
  const redK = Math.ceil(car.redline / 1000);
  drawGauge(ctx, `tach-${car.id}`, 480, 442, 96, s.rpm, {
    max: redK * 1000 + 1000, step: 1000, minor: 4, label: 'RPM', sub: 'x1000', redFrom: car.redline, fmt: (n) => n / 1000,
    extra: (cx, cy, r) => {
      // two-step launch marker while staged
      if (s.gear === 0 && s.twoStep) {
        const a = ang(s.twoStep, redK * 1000 + 1000);
        ctx.strokeStyle = '#18c043'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.94, a - 0.03, a + 0.03); ctx.stroke();
      }
      // shift light
      const on = shiftLight(s, car) && Math.floor(time * 14) % 2 === 0;
      const lx = cx, ly = cy + r * 0.62;
      ctx.fillStyle = '#2a0606'; ctx.beginPath(); ctx.arc(lx, ly, 10, 0, 7); ctx.fill();
      if (on) {
        const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 22);
        lg.addColorStop(0, '#fff'); lg.addColorStop(0.3, '#ff2a1a'); lg.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, 22, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = '#5a0d0a'; ctx.beginPath(); ctx.arc(lx, ly, 7, 0, 7); ctx.fill();
      }
    },
  });

  // nitrous
  drawGauge(ctx, `nos-${car.id}`, 672, 452, 62, s.nitroLeft, {
    max: car.nitro, step: 1, minor: 2, label: 'NOS', sub: 'NITROUS', needle: '#e0201b', redFrom: null,
    extra: (cx, cy, r) => {
      if (s.nitroOn) {
        const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
        g.addColorStop(0, 'rgba(60,150,255,0.0)'); g.addColorStop(1, 'rgba(60,150,255,0.35)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      }
    },
  });

  drawShifter(ctx, 852, 452, s, car, dt);

  // ET clock (top right of dash)
  const et = L.start == null ? 0 : (L.fin ?? race.t) - L.start;
  text(ctx, et.toFixed(2), W - 18, DASH_TOP + 26, { font: `34px ${MONO}`, color: '#f4f4f4', align: 'right', shadow: 'rgba(0,0,0,0.7)' });

  // progress bar
  const bx = 190, bw = W - 380, by = H - 14;
  ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, 4);
  ctx.fillStyle = '#e88a1a'; ctx.fillRect(bx, by + 1, bw, 2);
  for (const ft of [660, 1320]) { ctx.fillStyle = '#e88a1a'; ctx.fillRect(bx + bw * ft / 1320 - 1, by - 5, 2, 12); }
  const marker = (x, col, up) => {
    const px = bx + clamp(x / FINISH, 0, 1) * bw;
    roundRect(ctx, px - 11, by - (up ? 13 : 1), 22, 9, 4);
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  };
  if (!race.solo) marker(a.s.x, a.car.color, false);
  marker(s.x, '#ffffff', true);
}

// ---------------------------------------------------------------- christmas tree
export function drawTree(ctx, race, alpha = 1) {
  const n = ambers(race), green = isGreen(race), stagedOn = race.t >= STAGE_AT;
  const x = 92, y = 6, w = 86, h = 168;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(ctx, x - w / 2 + 4, y + 4, w, h, 8); ctx.fill();
  const hg = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  hg.addColorStop(0, '#2a2a30'); hg.addColorStop(0.5, '#141418'); hg.addColorStop(1, '#25252b');
  ctx.fillStyle = hg; roundRect(ctx, x - w / 2, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = '#46464f'; ctx.lineWidth = 1.5; ctx.stroke();
  const lamp = (cx, cy, r, on, col) => {
    ctx.fillStyle = '#08080a'; ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, 7); ctx.fill();
    if (on) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#26262b'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    }
  };
  const lanes = race.solo ? [[x - 20, race.p]] : [[x - 20, race.p], [x + 20, race.a]];
  for (const [cx, L] of lanes) {
    lamp(cx - 7, y + 14, 4, true, '#fff2b0');
    lamp(cx + 7, y + 14, 4, true, '#fff2b0');
    lamp(cx - 7, y + 27, 4, stagedOn, '#fff2b0');
    lamp(cx + 7, y + 27, 4, stagedOn, '#fff2b0');
    for (let i = 0; i < 3; i++) lamp(cx, y + 50 + i * 24, 9, n > i && !green, '#ffa600');
    lamp(cx, y + 50 + 3 * 24, 9, green && !L.red, '#26e05a');
    lamp(cx, y + 50 + 4 * 24 - 4, 7, L.red, '#ff2a1a');
  }
  text(ctx, 'YOU', x - 20, y + h + 10, { font: `11px ${DISPLAY}`, color: '#fff', shadow: 'rgba(0,0,0,0.8)' });
  if (!race.solo) text(ctx, race.level?.name ?? 'CPU', x + 20, y + h + 10, { font: `11px ${DISPLAY}`, color: '#fff', shadow: 'rgba(0,0,0,0.8)' });
  ctx.restore();
}

export function drawHint(ctx, str, y = 140, color = '#fff') {
  ctx.font = `17px ${DISPLAY}`;
  const w = ctx.measureText(str).width + 36;
  roundRect(ctx, W / 2 - w / 2, y - 18, w, 36, 18);
  ctx.fillStyle = 'rgba(8,8,12,0.72)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  text(ctx, str, W / 2, y + 1, { font: `17px ${DISPLAY}`, color });
}

export function drawBanner(ctx, str, color, t) {
  const s = 1 + Math.max(0, 0.25 - t) * 2;
  ctx.save();
  ctx.translate(W / 2, 140); ctx.scale(s, s);
  ctx.globalAlpha = clamp(1.6 - t, 0, 1);
  text(ctx, str, 0, 0, { font: `italic 56px ${DISPLAY}`, color, shadow: 'rgba(0,0,0,0.75)' });
  ctx.restore();
}
