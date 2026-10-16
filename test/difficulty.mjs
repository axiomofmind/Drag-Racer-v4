// Win rate of scripted human-like players against each AI level. Run: node test/difficulty.mjs
//   novice: reacts to the green (~0.3 s), shifts late, still uses nitrous
//   decent: quicker reaction, shifts close to the light
//   expert: anticipates the tree, shifts on the light
import { CARS } from '../src/cars.js';
import { createRace, updateRace, LEVELS } from '../src/race.js';
import { shiftLight } from '../src/physics.js';

const PROFILES = {
  novice: { drop: 0.3, shiftDelay: 0.25, jitter: 0.06 },
  decent: { drop: 0.17, shiftDelay: 0.12, jitter: 0.04 },
  expert: { drop: -0.04, shiftDelay: 0.04, jitter: 0.03 },
};

function play(level, prof, pi, ai) {
  const r = createRace(CARS[pi], CARS[ai], level);
  const car = CARS[pi], dt = 1 / 120;
  const drop = r.greenAt + prof.drop + (Math.random() * 2 - 1) * prof.jitter;
  let lightAt = null;
  while (!r.done && r.t < 40) {
    const s = r.p.s, e = {};
    if (s.gear === 0 && r.t >= drop) e.up = true;
    if (s.gear > 0 && s.gear < car.gears.length) {
      if (shiftLight(s, car)) lightAt ??= r.t; else if (s.shiftT === 0) lightAt = null;
      if (lightAt !== null && r.t - lightAt >= prof.shiftDelay) { e.up = true; lightAt = null; }
    }
    updateRace(r, dt, { gas: true, nitro: s.gear >= 2 }, e);
  }
  return r.result === 'win';
}

const N = +(process.argv[2] || 120);
const rows = [];
for (const level of LEVELS) {
  const row = { level: level.name };
  for (const [name, prof] of Object.entries(PROFILES)) {
    let wins = 0;
    for (let i = 0; i < N; i++) {
      const pi = i % CARS.length, ai = (pi + 1 + (i >> 2) % (CARS.length - 1)) % CARS.length;
      if (play(level, prof, pi, ai)) wins++;
    }
    row[name] = `${Math.round((wins / N) * 100)}%`;
  }
  rows.push(row);
}
console.table(rows);
