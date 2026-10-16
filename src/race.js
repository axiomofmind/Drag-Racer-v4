// Race flow: staging, sportsman tree, beam timing (rollout, splits, trap speeds), AI driver.
import { newState, step, launch, shift, MPH, FT, SHIFT_LEAD } from './physics.js';

export const STAGE_AT = 0.7;
export const AMBER_GAP = 0.5;
export const TWO_STEP_MIN = 2000;

// Timing beams, in feet from the starting line, like a real time slip.
const SPLITS = [60, 330, 594, 660, 1000, 1254, 1320];

function newLane(car, twoStep) {
  const s = newState(car);
  s.twoStep = twoStep;
  return { car, s, start: null, splits: {}, fin: null, et: null, mph8: null, mph: null, rt: null, red: false,
    telemetry: { launchRpm: null, wheelspin: 0, bog: 0, limiter: 0, shifts: [] } };
}

// Fixed skill profiles: no catch-up power or adjustments based on the player.
// Shift delays are measured from the same predictive shift light the player sees.
export const LEVELS = [
  { id: 'easy', name: 'Easy', drop: [.35, .7], launchErr: 1000, shiftEarly: [400, 900], shiftDelay: [.2, .4], nitroFrom: 3, bog: .14, late: .18, red: 0 },
  { id: 'normal', name: 'Normal', drop: [.22, .45], launchErr: 700, shiftEarly: [100, 350], shiftDelay: [.16, .28], nitroFrom: 2, bog: .12, late: .16, red: 0 },
  { id: 'sport', name: 'Sport', drop: [.14, .35], launchErr: 450, shiftEarly: [0, 160], shiftDelay: [.1, .24], nitroFrom: 2, bog: .1, late: .14, red: .005 },
  { id: 'hard', name: 'Hard', drop: [.06, .25], launchErr: 250, shiftEarly: [0, 80], shiftDelay: [.07, .19], nitroFrom: 2, bog: .08, late: .12, red: .01 },
  { id: 'pro', name: 'Pro', drop: [-.06, .14], launchErr: 150, shiftEarly: [0, 30], shiftDelay: [.03, .15], nitroFrom: 2, bog: .06, late: .1, red: .02 },
];

// Old saves used numeric Easy / Normal / Hard / Pro indices.
export function savedDifficulty(prefs) {
  const legacy = Number.isInteger(prefs.level) ? ['easy', 'normal', 'hard', 'pro'][prefs.level] : null;
  return LEVELS.find(l => l.id === prefs.difficulty)?.id
    ?? legacy ?? 'normal';
}

export function createRace(pCar, aCar = pCar, level = LEVELS[1], pTwoStep = pCar.launchRpm, { random = Math.random, solo = false } = {}) {
  const rand = ([lo, hi]) => lo + random() * (hi - lo);
  const treeAt = 1.6 + random() * 1.2;
  const roll = random(), red = level.red ?? 0, bog = level.bog ?? 0, late = level.late ?? 0;
  const mistake = roll < red ? 'red' : roll < red + bog ? 'bog' : roll < red + bog + late ? 'late' : null;
  const launchRpm = Math.max(1800, aCar.launchRpm + (random() * 2 - 1) * level.launchErr - (mistake === 'bog' ? 1800 : 0));
  return {
    t: 0, level, solo,
    treeAt, greenAt: treeAt + 3 * AMBER_GAP,
    p: newLane(pCar, pTwoStep), a: newLane(aCar, launchRpm),
    done: false, result: null, endAt: null, winner: null,
    ai: {
      mistake, drop: mistake === 'red' ? -.65 : rand(level.drop),
      shiftRpm: aCar.shiftRpm - rand(level.shiftEarly),
      delays: aCar.gears.map(() => rand(level.shiftDelay ?? [0, 0])),
      lateGear: mistake === 'late' ? 1 + Math.floor(random() * Math.min(3, aCar.gears.length - 1)) : 0,
      lateDelay: rand([.35, .85]), shiftAt: null,
      nitroFrom: level.nitroFrom,
    },
  };
}

// Back-compat helpers for HUD / audio
export const pState = (r) => r.p.s;
export function ambers(r) {
  if (r.t < r.treeAt) return 0;
  return Math.min(3, 1 + Math.floor((r.t - r.treeAt) / AMBER_GAP));
}
export const isGreen = (r) => r.t >= r.greenAt;
export const staged = (r) => r.t >= STAGE_AT;

function timeLane(r, L, prevX, dt) {
  const x = L.s.x, cross = (mark) => r.t - dt * (x - mark) / Math.max(1e-9, x - prevX);
  if (L.start === null && x >= 0 && prevX < 0) {
    L.start = cross(0);
    L.rt = L.start - r.greenAt;
    if (L.rt < 0) L.red = true;
  }
  if (L.start === null) return false;
  for (const ft of SPLITS) {
    const m = ft * FT;
    if (L.splits[ft] == null && x >= m && prevX < m) L.splits[ft] = cross(m) - L.start;
  }
  const sp = L.splits;
  if (L.mph8 == null && sp[660] != null) L.mph8 = (66 * FT) / (sp[660] - sp[594]) * MPH;
  if (L.fin === null && sp[1320] != null) {
    L.fin = L.start + sp[1320];
    L.et = sp[1320];
    L.mph = (66 * FT) / (sp[1320] - sp[1254]) * MPH; // trap: average over the last 66 ft
    L.s.braking = true;
    return true;
  }
  return false;
}

// held: { gas, nitro }  edges: { up, down, left, right } (one-shot)
// Returns an events array: 'stage','amber','green','launch','shift','foul','finish','twostep'.
export function updateRace(r, dt, held, edges) {
  const ev = [];
  if (r.done) return ev;
  const t0 = r.t;
  r.t += dt;
  const { p, a } = r;
  if (t0 < STAGE_AT && r.t >= STAGE_AT) ev.push('stage');
  if (ambers({ t: t0, treeAt: r.treeAt }) !== ambers(r) && !isGreen(r)) ev.push('amber');
  if (t0 < r.greenAt && r.t >= r.greenAt) ev.push('green');

  // --- player ---
  const ps = p.s;
  if (p.fin === null) {
    if (ps.gear === 0) {
      if (edges.left) { ps.twoStep = Math.max(TWO_STEP_MIN, ps.twoStep - 250); ev.push('twostep'); }
      if (edges.right) { ps.twoStep = Math.min(p.car.redline - 500, ps.twoStep + 250); ev.push('twostep'); }
      if (edges.up && staged(r) && launch(ps)) { p.telemetry.launchRpm = ps.rpm; ev.push('launch'); }
    } else {
      if (edges.up && shift(ps, p.car, +1)) {
        p.telemetry.shifts.push({ gear: ps.gear, rpm: ps.rpm, target: p.car.shiftRpm });
        ev.push('shift');
      }
      if (edges.down && shift(ps, p.car, -1)) ev.push('shift');
    }
  }

  // --- AI driver ---
  const as = a.s, ai = r.ai;
  if (!r.solo) {
    if (as.gear === 0 && r.t >= r.greenAt + ai.drop) launch(as);
    if (as.gear > 0 && as.gear < a.car.gears.length && as.locked && !as.spinning && as.shiftT === 0) {
      if (as.cut || as.rpm + Math.max(0, as.rpmRate) * SHIFT_LEAD >= ai.shiftRpm) {
        ai.shiftAt ??= r.t + ai.delays[as.gear - 1] + (as.gear === ai.lateGear ? ai.lateDelay : 0);
      }
      if (ai.shiftAt !== null && r.t >= ai.shiftAt && shift(as, a.car, +1)) ai.shiftAt = null;
    }
  }

  // --- physics ---
  const px = ps.x, ax = as.x;
  step(ps, p.car, { gas: held.gas && staged(r) && p.fin === null, nitro: held.nitro }, dt);
  if (!r.solo) step(as, a.car, { gas: staged(r) && a.fin === null, nitro: ai.nitroFrom > 0 && as.gear >= ai.nitroFrom }, dt);
  if (p.fin === null && ps.gear > 0 && ps.throttle > 0.5 && !ps.shifting) {
    if (ps.x < 60 * FT) {
      if (ps.spinning) p.telemetry.wheelspin += dt;
      if (ps.gear === 1 && ps.rpm < p.car.launchRpm * 0.45) p.telemetry.bog += dt;
    }
    if (ps.cut && ps.locked) p.telemetry.limiter += dt;
  }

  const pWasRed = p.red;
  if (timeLane(r, p, px, dt)) ev.push('finish');
  if (!r.solo) timeLane(r, a, ax, dt);
  if (p.red && !pWasRed) ev.push('foul');

  // A test pass has timing and launch rules, but no opponent or win/loss.
  if (r.solo) {
    if (p.red) r.result = 'foul';
    if (p.fin !== null && r.endAt === null) { r.result ??= 'test'; r.endAt = r.t + 1.2; }
    if (r.t > r.greenAt + 45 && r.endAt === null) { r.result ??= 'dnf'; r.endAt = r.t; }
    if (r.endAt !== null && r.t >= r.endAt) r.done = true;
    return ev;
  }

  // --- result ---
  // a red light loses outright; otherwise first across the finish line wins
  if (r.winner === null) {
    if (p.red || a.red) {
      // The first lane to foul loses, including simultaneous simulation steps.
      r.winner = p.red && (!a.red || p.start <= a.start) ? 'a' : 'p';
    }
    else if (p.fin !== null) r.winner = a.fin === null || p.fin <= a.fin ? 'p' : 'a';
    else if (a.fin !== null) r.winner = 'a';
  }
  if (r.result === null) {
    if (p.red && r.winner === 'a') r.result = 'foul';
    else if (p.fin !== null) r.result = r.winner === 'p' ? 'win' : 'lose';
    else if (r.t > r.greenAt + 30 && ps.gear === 0) { r.result = 'lose'; r.winner = 'a'; } // never launched
  }
  // keep running until both slips fill in (or the AI is hopelessly behind)
  if (r.endAt === null && r.result !== null) {
    const pDone = p.fin !== null || p.s.gear === 0;
    if (pDone && (a.fin !== null || r.t > (p.fin ?? r.t) + 4)) r.endAt = r.t + 1.2;
  }
  // A stalled or abandoned pass must still reach a result screen.
  if (r.t > r.greenAt + 45 && r.endAt === null) {
    if (r.result === null) { r.result = 'lose'; r.winner = 'a'; }
    r.endAt = r.t;
  }
  if (r.endAt !== null && r.t >= r.endAt) r.done = true;
  return ev;
}
