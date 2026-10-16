import assert from 'node:assert/strict';
import { CARS } from '../src/cars.js';
import { newCareer, buildCar, settleRace } from '../src/career.js';
import { createRace, updateRace, LEVELS, savedDifficulty } from '../src/race.js';
import { raceFeedback } from '../src/feedback.js';
import { drive, PROFILES, seeded, STAGE_BUILDS } from './drivers.mjs';

for (const parts of [STAGE_BUILDS[0], STAGE_BUILDS[5]]) {
  const c = newCareer(); c.owned.sprint.parts = parts; c.owned.sprint.final = 1.1;
  const before = JSON.stringify(c), car = buildCar(c);
  const r = drive(car, car, LEVELS[1], PROFILES.decent, 42, true);
  const duel = drive(car, car, LEVELS[1], PROFILES.decent, 42);
  assert(r.done && r.result === 'test');
  assert.equal(r.winner, null);
  assert.equal(r.a.fin, null);
  assert.equal(r.a.s.gear, 0);
  assert.equal(r.a.s.x, createRace(car).a.s.x, 'No invisible opponent is simulated');
  assert.equal(r.p.et, duel.p.et, 'Solo uses exactly the same player physics and timing');
  assert.match(raceFeedback(r).summary, /Test pass/);
  assert.equal(settleRace(c, r, 0).cash, 0);
  assert.equal(JSON.stringify(c), before, 'Solo cannot change career cash, records, wins or unlocks');
}
for (const early of [false, true]) {
  const r = createRace(CARS[2], CARS[2], LEVELS[1], CARS[2].launchRpm, { random: seeded(15), solo: true });
  while (!r.done && r.t < 55) updateRace(r, 1 / 120, { gas: early }, { up: early && r.t > 1 && r.p.s.gear === 0 });
  assert(r.done);
  assert.equal(r.result, early ? 'foul' : 'dnf');
  assert.equal(r.winner, null);
}
assert.equal(savedDifficulty({ level: 2 }), 'hard');
assert.equal(savedDifficulty({ level: 3 }), 'pro');
assert.equal(savedDifficulty({ difficulty: 'sport', level: 3 }), 'sport');
assert.equal(savedDifficulty({ difficulty: 'bad', level: 99 }), 'normal');
assert.equal(savedDifficulty({ level: 'map' }), 'normal');

// Force each possible error and check that it affects the simulated pass.
const car = CARS[2], base = { ...LEVELS[4], red: 0, bog: 0, late: 0 };
const clean = drive(car, car, base, PROFILES.decent, 100);
for (const mistake of ['red', 'bog', 'late']) {
  const r = drive(car, car, { ...base, [mistake]: 1 }, PROFILES.decent, 100);
  assert.equal(r.ai.mistake, mistake);
  if (mistake === 'red') assert(r.a.red && r.result === 'win');
  else assert(r.a.et > clean.a.et + .1, `${mistake} costs real track time`);
}
console.log('Solo timing, career isolation, timeouts, saved difficulty and AI mistakes: PASS');
