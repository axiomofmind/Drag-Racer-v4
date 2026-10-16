import { createRace, updateRace } from '../src/race.js';
import { shiftLight } from '../src/physics.js';
export const PROFILES = {
  novice: { drop: .3, shiftDelay: .25, jitter: .06 },
  decent: { drop: .17, shiftDelay: .12, jitter: .04 },
  expert: { drop: -.04, shiftDelay: .04, jitter: .03 },
};
export function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function drive(car, opponent, level, profile = PROFILES.decent, seed = 1, solo = false) {
  const random = seeded(seed), r = createRace(car, opponent, level, car.launchRpm, { random, solo });
  const drop = r.greenAt + profile.drop + (random() * 2 - 1) * profile.jitter;
  let lightAt = null;
  while (!r.done && r.t < 55) {
    const s = r.p.s, e = {};
    if (s.gear === 0 && r.t >= drop) e.up = true;
    if (s.gear > 0 && s.gear < car.gears.length) {
      if (shiftLight(s, car)) lightAt ??= r.t; else if (s.shiftT === 0) lightAt = null;
      if (lightAt !== null && r.t - lightAt >= profile.shiftDelay) { e.up = true; lightAt = null; }
    }
    updateRace(r, 1 / 120, { gas: true, nitro: s.gear >= 2 }, e);
  }
  return r;
}
export const STAGE_BUILDS = [
  {},
  { engine: 1, nitrous: 1 },
  { engine: 2, tires: 1, weight: 1, nitrous: 1, gearbox: 1 },
  { engine: 2, tires: 2, weight: 2, nitrous: 2, gearbox: 2 },
  { engine: 3, tires: 2, weight: 3, nitrous: 2, gearbox: 3 },
  { engine: 3, tires: 3, weight: 3, nitrous: 3, gearbox: 3 },
];
