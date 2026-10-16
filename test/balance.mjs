// Seeded simulations, separate from the calibration seeds. No wall-clock randomness.
import assert from 'node:assert/strict';
import { CARS } from '../src/cars.js';
import { LEVELS } from '../src/race.js';
import { newCareer, buildCar, rivalCar, rivalLevel, EVENTS } from '../src/career.js';
import { drive, PROFILES, STAGE_BUILDS } from './drivers.mjs';

const N = 240, rows = [];
for (let stage = 0; stage < EVENTS.length; stage++) {
  const c = newCareer(); c.owned.sprint.parts = STAGE_BUILDS[stage];
  const car = buildCar(c), rival = rivalCar(stage), level = rivalLevel(stage);
  const counts = { novice: 0, decent: 0, expert: 0 }, ets = [];
  let close = 0;
  for (let i = 0; i < N; i++) {
    for (const [name, profile] of Object.entries(PROFILES)) {
      if (name !== 'decent' && i >= 80) continue;
      const r = drive(car, rival, level, profile, 740003 + i * 3571);
      assert(r.done && r.p.et > 0);
      if (r.result === 'win') counts[name]++;
      if (name === 'decent') {
        if (!r.a.red) ets.push(r.a.et);
        if (Math.abs(r.p.fin - r.a.fin) < .4) close++;
      }
    }
  }
  const rate = counts.decent / N, novice = counts.novice / 80, expert = counts.expert / 80;
  const median = ets.sort((a,b)=>a-b)[Math.floor(ets.length / 2)];
  rows.push({ rival: EVENTS[stage].rival, novice: Math.round(novice*100), decent: Math.round(rate*100), expert: Math.round(expert*100), close: Math.round(close/N*100), medianET: median.toFixed(2) });
  assert(rate >= .43 && rate <= .67, `${EVENTS[stage].rival}: matched build should stay competitive (${rate})`);
  assert(expert > rate + .15 && rate > novice + .15, 'Better driving must matter');
  assert(close / N > .6, 'Most matched-build races should finish within 0.4 seconds');
  assert(Math.abs(median - EVENTS[stage].pace) < .12, 'Displayed pace must match measured typical ET');
  console.log(`${EVENTS[stage].rival}: ${Math.round(rate*100)}% decent wins, ${Math.round(close/N*100)}% close finishes`);
}
console.table(rows);

const quick = [];
for (const level of LEVELS) {
  const row = { level: level.id };
  for (const [name, profile] of Object.entries(PROFILES)) {
    let wins = 0;
    for (let i = 0; i < 120; i++) {
      const pi = i % 4, ai = (pi + 1 + (i >> 2) % 3) % 4;
      if (drive(CARS[pi], CARS[ai], level, profile, 98173 + i * 3571).result === 'win') wins++;
    }
    row[name] = wins / 120;
  }
  quick.push(row);
  console.log(`${level.name}: novice ${Math.round(row.novice*100)}%, decent ${Math.round(row.decent*100)}%, expert ${Math.round(row.expert*100)}%`);
}
for (let i = 1; i < quick.length; i++) {
  for (const name of Object.keys(PROFILES)) assert(quick[i][name] <= quick[i-1][name] + .03, 'Difficulty should increase consistently');
  assert(quick[i-1].novice - quick[i].novice < .5, 'Avoid a cliff between adjacent levels');
}
assert(quick[1].novice > .4 && quick[1].novice < .85);
assert(quick[2].novice > .1 && quick[2].novice < .6);
assert(quick[4].decent > .05 && quick[4].decent < .5, 'Pro must allow underdog wins');

// The reported hard wall: stock Brawler versus Ren should allow upset wins.
const c = newCareer(); c.selected = 'brawler';
let wins = 0, reds = 0;
for (let i = 0; i < 120; i++) {
  const r = drive(buildCar(c), rivalCar(3), rivalLevel(3), PROFILES.decent, 44201 + i * 7919);
  if (r.result === 'win') wins++;
  if (drive(CARS[0], CARS[1], LEVELS[4], PROFILES.decent, 44201 + i * 7919).a.red) reds++;
}
assert(wins > 0 && wins < 120);
assert(reds > 0 && reds < 12, 'Pro red lights should be possible and rare');
console.log(`Stock Brawler / Ren: ${Math.round(wins/120*100)}% wins; Pro red lights: ${reds}/120. Balance PASS`);
