// Side-view scene: grandstand, wall, strip, cars, smoke. Logical canvas 960x540.
import { FINISH, FT } from './physics.js';
import { W, H, DISPLAY, makeCanvas, rng, blurX, clamp, mod } from './gfx.js';
import { drawCar, carLength, wheelX } from './carart.js';

export { W, H, drawCar, carLength };
export const PPM = 50;              // pixels per metre
export const PLAYER_X = 600;        // player front-bumper screen x
export const WALL_TOP = 100, TRACK_TOP = 178, TRACK_BOT = 338;
export const FAR_Y = 252, NEAR_Y = 324, CENTER_Y = 276;

// ---------------------------------------------------------------- cached backdrops
let crowd = null, crowdBlur = null, asphalt = null, asphaltBlur = null, puff = null;

function makeCrowd() {
  const w = 480, h = WALL_TOP;
  const [c, g] = makeCanvas(w, h);
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2a2a33'); bg.addColorStop(1, '#3b3b45');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const rnd = rng(11);
  const shirts = ['#e6e6e6', '#c22d2d', '#8c1f24', '#f2f2f2', '#3e5f8f', '#d9d9d9', '#c98a3a', '#5a5a62', '#e0c040', '#2d2d33', '#b03a5a', '#7a9fc4'];
  const skin = ['#f1c9a5', '#d9a47e', '#a8714f', '#6b4430', '#e8b98f'];
  for (let y = 4, row = 0; y < h - 4; y += 8, row++) {
    g.fillStyle = '#4c4c57'; g.fillRect(0, y + 7, w, 1);
    for (let x = (row % 2) * 3; x < w; x += 6 + rnd() * 1.5) {
      if (rnd() < 0.07) continue;
      g.fillStyle = shirts[(rnd() * shirts.length) | 0];
      g.beginPath(); g.roundRect ? g.roundRect(x, y + 3.2, 4.6, 4.2, 1.4) : g.rect(x, y + 3.2, 4.6, 4.2); g.fill();
      g.fillStyle = skin[(rnd() * skin.length) | 0];
      g.beginPath(); g.arc(x + 2.3, y + 1.8 + (rnd() < 0.15 ? -1.2 : 0), 1.7, 0, 7); g.fill();
    }
  }
  // stair aisles
  for (let x = 70; x < w; x += 160) {
    g.fillStyle = '#6a6a74'; g.fillRect(x, 0, 12, h);
    g.fillStyle = '#55555e'; for (let y = 2; y < h; y += 4) g.fillRect(x, y, 12, 1);
    g.fillStyle = '#9a9aa4'; g.fillRect(x - 1, 0, 1, h); g.fillRect(x + 12, 0, 1, h);
  }
  // roof shadow and haze for depth
  const sg = g.createLinearGradient(0, 0, 0, 34);
  sg.addColorStop(0, 'rgba(0,0,0,0.75)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sg; g.fillRect(0, 0, w, 34);
  g.fillStyle = 'rgba(120,130,150,0.12)'; g.fillRect(0, 0, w, h);
  return c;
}

function makeAsphalt() {
  const w = 480, h = TRACK_BOT - TRACK_TOP;
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#5d5e64'; g.fillRect(0, 0, w, h);
  const rnd = rng(5);
  for (let i = 0; i < 2600; i++) {
    const v = rnd();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.12 + rnd() * 0.15})` : `rgba(255,255,255,${0.05 + rnd() * 0.1})`;
    g.fillRect(rnd() * w, rnd() * h, 0.6 + rnd() * 1.2, 0.6 + rnd() * 0.8);
  }
  // a few tar-sealed cracks
  g.strokeStyle = 'rgba(25,25,30,0.45)'; g.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    let x = rnd() * w, y = rnd() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += 4 + rnd() * 10; y += (rnd() - 0.5) * 5; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

function makePuff() {
  const [c, g] = makeCanvas(64, 64, 1);
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(235,235,240,0.9)'); rg.addColorStop(0.5, 'rgba(220,220,228,0.45)'); rg.addColorStop(1, 'rgba(210,210,220,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return c;
}

function ensureCaches() {
  if (crowd) return;
  crowd = makeCrowd(); crowdBlur = blurX(crowd, 26);
  asphalt = makeAsphalt(); asphaltBlur = blurX(asphalt, 46);
  puff = makePuff();
}

function tileX(ctx, img, blurImg, off, y, blurAmt) {
  const w = img.lw, h = img.lh;
  const o = mod(off, w);
  for (let x = -o; x < W; x += w) {
    ctx.drawImage(img, x, y, w, h);
    if (blurAmt > 0) { ctx.globalAlpha = blurAmt; ctx.drawImage(blurImg, x, y, w, h); ctx.globalAlpha = 1; }
  }
}

// ---------------------------------------------------------------- per-race effects
function fxOf(race) {
  return (race.fx ??= { smoke: [], pitch: { p: 0, a: 0 }, lastT: race.t, popP: 0, popA: 0 });
}

function emitSmoke(fx, lane, carLen, groundY, dt) {
  const s = lane.s;
  const slip = s.slip;
  // real wheelspin smokes hard; a clean clutch dump still chirps out a little haze
  const chirp = s.gear === 1 && !s.locked && s.v < 10 && s.throttle > 0.5;
  if ((!s.spinning && !chirp) || dt <= 0) return;
  const rate = s.spinning ? clamp(slip / 4, 0.5, 4) * 40 : 14; // puffs per second
  let n = rate * dt;
  while (n > 0) {
    if (Math.random() < n) {
      const wx = s.x - carLen + wheelX(lane.car)[0];
      fx.smoke.push({
        lane: groundY, x: wx - 0.2, y: groundY - 4, vx: -1 - Math.random() * 3 + s.v * 0.15, vy: -6 - Math.random() * 10,
        r: 10 + Math.random() * 8, grow: 22 + Math.random() * 18, age: 0, life: 1.4 + Math.random() * 1.2,
      });
    }
    n -= 1;
  }
}

function updateSmoke(fx, dt) {
  for (const p of fx.smoke) { p.age += dt; p.x += p.vx * dt; p.vx *= 1 - 0.8 * dt; p.y += p.vy * dt; p.vy *= 1 - 0.6 * dt; p.r += p.grow * dt; }
  fx.smoke = fx.smoke.filter((p) => p.age < p.life);
  if (fx.smoke.length > 400) fx.smoke.splice(0, fx.smoke.length - 400);
}

function drawSmoke(ctx, fx, wx, laneY) {
  for (const p of fx.smoke) {
    if (p.lane !== laneY) continue;
    const a = (1 - p.age / p.life) * 0.7;
    ctx.globalAlpha = a;
    ctx.drawImage(puff, wx(p.x) - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- scene
const BANNERS = [
  ['HIGH OCTANE', '#c4161c', '#fff'], ['1320 FT', '#111', '#f5c518'], ['NITRO X', '#1d4fbf', '#fff'],
  ['STAGE 3', '#f5c518', '#111'], ['BURNOUT', '#e8e8e8', '#c4161c'], ['DRAG RACER', '#111', '#3d8bff'],
];
const MARKERS = [[60, "60'"], [330, "330'"], [660, '1/8'], [1000, "1000'"]];

export function drawScene(ctx, race, time) {
  ensureCaches();
  const fx = fxOf(race);
  const dt = clamp(race.t - fx.lastT, 0, 0.1);
  fx.lastT = race.t;
  const { p, a } = race;
  const camX = p.s.x;
  const wx = (m) => (m - camX) * PPM + PLAYER_X;
  const blur = clamp((p.s.v - 6) / 30, 0, 1);

  // subtle camera shake on wheelspin / nitrous
  const shake = (p.s.spinning ? 1.2 : 0) + (p.s.nitroOn ? 0.8 : 0);
  ctx.save();
  if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // grandstand
  if (race.night) drawNightSky(ctx, camX);
  else tileX(ctx, crowd, crowdBlur, camX * PPM * 0.35, 0, blur);

  // wall
  const wg = ctx.createLinearGradient(0, WALL_TOP, 0, TRACK_TOP);
  wg.addColorStop(0, race.night ? '#3b4957' : '#c4c5c9'); wg.addColorStop(1, race.night ? '#202d39' : '#8f9096');
  ctx.fillStyle = wg; ctx.fillRect(0, WALL_TOP, W, TRACK_TOP - WALL_TOP);
  ctx.fillStyle = race.night ? '#8cbccf' : '#e4e5e8'; ctx.fillRect(0, WALL_TOP, W, 4);
  ctx.fillStyle = '#5c5d63'; ctx.fillRect(0, WALL_TOP + 4, W, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let m = Math.floor((camX - 20) / 4) * 4; wx(m) < W + 4; m += 4) ctx.fillRect(wx(m), WALL_TOP + 6, 1.5, TRACK_TOP - WALL_TOP - 6);
  // sponsor banners every 36 m
  for (let k = Math.floor((camX - 30) / 36); wx(k * 36) < W + 10; k++) {
    const m = k * 36 + 14;
    if (m > FINISH - 20 && m < FINISH + 10) continue;
    const [label, bgc, fg] = BANNERS[mod(k, BANNERS.length)];
    const x = wx(m);
    ctx.fillStyle = bgc; ctx.fillRect(x, WALL_TOP + 18, 210, 40);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(x, WALL_TOP + 18, 210, 40);
    ctx.fillStyle = fg; ctx.font = `italic 24px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 105, WALL_TOP + 39);
  }
  // distance boards
  for (const [ft, label] of MARKERS) {
    const x = wx(ft * FT);
    if (x < -60 || x > W + 60) continue;
    ctx.fillStyle = '#f5c518'; ctx.fillRect(x - 28, WALL_TOP + 14, 56, 30);
    ctx.fillStyle = '#111'; ctx.font = `20px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, WALL_TOP + 30);
    ctx.fillStyle = '#111'; ctx.fillRect(x - 1.5, WALL_TOP + 44, 3, TRACK_TOP - WALL_TOP - 44);
  }
  // starting line tower
  {
    const x = wx(0);
    if (x > -80 && x < W + 80) {
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 3, 70, 6, WALL_TOP - 70);
      ctx.fillStyle = '#1a1a1f'; ctx.fillRect(x - 44, 44, 88, 30);
      ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 2; ctx.strokeRect(x - 44, 44, 88, 30);
      ctx.fillStyle = '#f5f5f5'; ctx.font = `18px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('START', x, 60);
    }
  }

  // track
  tileX(ctx, asphalt, asphaltBlur, camX * PPM, TRACK_TOP, blur);
  if (race.night) {
    ctx.fillStyle = '#03112688'; ctx.fillRect(0, TRACK_TOP, W, TRACK_BOT - TRACK_TOP);
    for (let x = -mod(camX * PPM, 750); x < W; x += 750) {
      const pool = ctx.createRadialGradient(x + 250, CENTER_Y, 10, x + 250, CENTER_Y, 260);
      pool.addColorStop(0, '#b9dbff22'); pool.addColorStop(1, '#b9dbff00');
      ctx.fillStyle = pool; ctx.fillRect(x - 10, TRACK_TOP, 520, TRACK_BOT - TRACK_TOP);
    }
  }
  // wall shadow on the track
  const ws = ctx.createLinearGradient(0, TRACK_TOP, 0, TRACK_TOP + 14);
  ws.addColorStop(0, 'rgba(0,0,0,0.45)'); ws.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ws; ctx.fillRect(0, TRACK_TOP, W, 14);
  // laid-down rubber in each lane's tire path, heaviest at the launch
  const rubber = ctx.createLinearGradient(wx(-6), 0, wx(140), 0);
  rubber.addColorStop(0, 'rgba(15,15,18,0)'); rubber.addColorStop(0.05, 'rgba(15,15,18,0.6)');
  rubber.addColorStop(0.3, 'rgba(15,15,18,0.28)'); rubber.addColorStop(1, 'rgba(15,15,18,0.08)');
  ctx.fillStyle = rubber;
  ctx.fillRect(wx(-6), FAR_Y - 8, Math.max(0, wx(FINISH + 40) - wx(-6)), 10);
  ctx.fillRect(wx(-6), NEAR_Y - 8, Math.max(0, wx(FINISH + 40) - wx(-6)), 10);
  // lane lines
  ctx.fillStyle = '#e8e8ea'; ctx.fillRect(0, TRACK_TOP + 6, W, 2); ctx.fillRect(0, TRACK_BOT - 6, W, 2);
  ctx.fillStyle = '#f2c200'; ctx.fillRect(0, CENTER_Y - 2, W, 4);
  // starting line + stage beam marks
  {
    const x = wx(0);
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(x - 2, TRACK_TOP + 8, 4, TRACK_BOT - TRACK_TOP - 16);
    ctx.fillStyle = '#d33'; ctx.fillRect(x - 3, CENTER_Y - 10, 6, 20);
  }
  // finish: checkered strip
  const fx0 = wx(FINISH);
  if (fx0 > -40 && fx0 < W + 40) {
    for (let y = TRACK_TOP + 8, i = 0; y < TRACK_BOT - 8; y += 8, i++) {
      for (let c = 0; c < 3; c++) { ctx.fillStyle = (i + c) % 2 ? '#fafafa' : '#141414'; ctx.fillRect(fx0 + c * 8, y, 8, 8); }
    }
  }

  // far gantry post (behind the far car) + finish banner
  const gantry = (front) => {
    if (fx0 < -120 || fx0 > W + 120) return;
    ctx.fillStyle = '#d7d8dc';
    if (!front) ctx.fillRect(fx0 + 8, 30, 8, TRACK_TOP + 8 - 30);
    else ctx.fillRect(fx0 + 8, 30, 8, TRACK_BOT - 30);
    if (!front) {
      ctx.fillStyle = '#111'; ctx.fillRect(fx0 - 70, 22, 164, 36);
      for (let i = 0; i < 20; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#111'; ctx.fillRect(fx0 - 70 + i * 8.2, 22, 8.2, 5); ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(fx0 - 70 + i * 8.2, 53, 8.2, 5); }
      ctx.fillStyle = '#fff'; ctx.font = `italic 22px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('FINISH', fx0 + 12, 40);
    }
  };
  gantry(false);

  // cars + smoke
  updateSmoke(fx, dt);
  const lenA = carLength(a.car), lenP = carLength(p.car);
  if (!race.solo) emitSmoke(fx, a, lenA, FAR_Y, dt);
  emitSmoke(fx, p, lenP, NEAR_Y, dt);
  const pitchOf = (key, s) => {
    const target = clamp(s.acc * 0.0065, -0.05, 0.06);
    fx.pitch[key] += (target - fx.pitch[key]) * clamp(dt * 8, 0, 1);
    return fx.pitch[key];
  };
  const pop = (s) => s.cut && s.throttle > 0.5 && Math.random() < 0.6;
  const carOpts = (s, key) => ({ angle: s.wheelAngle, omega: s.ww, pitch: pitchOf(key, s), nitro: s.nitroOn, pop: pop(s) });
  const aOpts = carOpts(a.s, 'a'), pOpts = carOpts(p.s, 'p');

  if (!race.solo) drawCar(ctx, a.car, wx(a.s.x - lenA), FAR_Y, aOpts);
  drawSmoke(ctx, fx, wx, FAR_Y);
  drawCar(ctx, p.car, wx(p.s.x - lenP), NEAR_Y, pOpts);
  drawSmoke(ctx, fx, wx, NEAR_Y);
  gantry(true);

  // opponent off-screen marker
  const ax = wx(a.s.x), gap = a.s.x - p.s.x;
  if (!race.solo && (ax < 0 || ax - lenA * PPM > W)) {
    const right = ax - lenA * PPM > W;
    const x = right ? W - 14 : 14, y = FAR_Y - 34;
    ctx.fillStyle = a.car.color;
    ctx.beginPath();
    if (right) { ctx.moveTo(x, y); ctx.lineTo(x - 14, y - 10); ctx.lineTo(x - 14, y + 10); }
    else { ctx.moveTo(x, y); ctx.lineTo(x + 14, y - 10); ctx.lineTo(x + 14, y + 10); }
    ctx.fill();
    ctx.font = `15px ${DISPLAY}`; ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(`${Math.abs(gap).toFixed(0)} m`, right ? x - 19 : x + 21, y + 1);
    ctx.fillStyle = '#fff'; ctx.fillText(`${Math.abs(gap).toFixed(0)} m`, right ? x - 20 : x + 20, y);
  }
  ctx.restore();
}

// A parallax skyline and track floodlights, drawn entirely in the browser.
function drawNightSky(ctx, camX) {
  const sky = ctx.createLinearGradient(0, 0, 0, WALL_TOP);
  sky.addColorStop(0, '#070e21'); sky.addColorStop(1, '#233349');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, WALL_TOP);
  ctx.fillStyle = '#bbcddb';
  for (let i = 0; i < 24; i++) ctx.fillRect(mod(i * 173.7 - camX * .4, W), (i * 13.9) % 48 + 3, 1, 1);
  ctx.fillStyle = '#dfe9eb'; ctx.beginPath(); ctx.arc(805 - camX * .015, 23, 10, 0, 7); ctx.fill();
  for (let i = -1; i < 22; i++) {
    const x = i * 58 - mod(camX * 2, 58), height = 20 + mod(i * 17 + 200, 37);
    ctx.fillStyle = '#0a1424'; ctx.fillRect(x, WALL_TOP - height, 48, height);
    ctx.fillStyle = '#c6ba7844';
    for (let j = 0; j < 5; j++) for (let row = 0; row < 4; row++) {
      if ((j + row + i) % 3) ctx.fillRect(x + 7 + j * 8, WALL_TOP - height + 8 + row * 9, 2, 3);
    }
  }
  for (let x = -mod(camX * 6, 320); x < W; x += 320) {
    ctx.fillStyle = '#8195aa'; ctx.fillRect(x + 90, 18, 3, 82);
    ctx.fillStyle = '#dceeff'; ctx.fillRect(x + 70, 15, 43, 4);
    const glow = ctx.createRadialGradient(x + 91, 18, 1, x + 91, 18, 65);
    glow.addColorStop(0, '#c2e2ff66'); glow.addColorStop(1, '#c2e2ff00');
    ctx.fillStyle = glow; ctx.fillRect(x + 26, 0, 130, 85);
  }
  ctx.fillStyle = '#111c29'; ctx.fillRect(0, WALL_TOP - 10, W, 10);
  ctx.fillStyle = '#a8c7da77';
  for (let x = -mod(camX * 10, 12); x < W; x += 12) ctx.fillRect(x, WALL_TOP - 8, 2, 8);
}
