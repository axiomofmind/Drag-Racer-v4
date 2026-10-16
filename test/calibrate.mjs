// Development tool: suggest fixed rival power against the documented stage builds.
import { newCareer, buildCar, rivalCar, rivalLevel, EVENTS } from '../src/career.js';
import { drive, PROFILES, STAGE_BUILDS } from './drivers.mjs';
const N = 180;
const rows = [];
for (let i = 0; i < EVENTS.length; i++) {
  const c = newCareer(); c.owned.sprint.parts = STAGE_BUILDS[i]; const car = buildCar(c);
  const rate = (power, profile = PROFILES.decent) => {
    EVENTS[i].power = power;
    const runs = Array.from({ length: N }, (_, n) => drive(car, rivalCar(i), rivalLevel(i), profile, 10001 + n * 7919));
    return { wins: runs.filter(r => r.result === 'win').length / N, et: runs.map(r => r.a.et).sort((a,b)=>a-b)[Math.floor(N/2)], player: runs[0].p.et };
  };
  let lo = .35, hi = 1.8;
  for (let j = 0; j < 10; j++) { const mid = (lo+hi)/2; if (rate(mid).wins > .55) lo=mid; else hi=mid; }
  const power = +((lo+hi)/2).toFixed(4), result = rate(power);
  rows.push({rival:EVENTS[i].rival,power,medianET:result.et.toFixed(3),playerET:result.player.toFixed(3),novice:rate(power,PROFILES.novice).wins.toFixed(2),decent:result.wins.toFixed(2),expert:rate(power,PROFILES.expert).wins.toFixed(2)});
}
console.table(rows);
