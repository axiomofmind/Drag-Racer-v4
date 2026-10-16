import assert from 'node:assert/strict';
import { CARS } from '../src/cars.js';
import { createRace, updateRace, LEVELS } from '../src/race.js';
import { newCareer, settleRace } from '../src/career.js';

const dt = 1 / 120;
const race = createRace(CARS[2], CARS[0], LEVELS[1]);
race.ai.drop = -2; // Opponent clears the starting beam before green.
while (!race.done && race.t < 60) {
  const s = race.p.s, e = {};
  if (s.gear === 0 && race.t >= race.greenAt) e.up = true;
  else if (s.locked && s.rpm >= race.p.car.shiftRpm) e.up = true;
  updateRace(race, dt, { gas: true, nitro: s.gear >= 2 }, e);
}
assert(race.a.red && !race.p.red);
assert.equal(race.result, 'win', 'An opponent false start cannot beat a clean player');
assert.equal(race.winner, 'p');
const completedAt = race.t;
updateRace(race, dt, { gas: true }, {});
assert.equal(race.t, completedAt, 'Completed races cannot keep advancing');

const late = createRace(CARS[2], CARS[0]);
late.t = late.greenAt + 31; late.p.s.gear = 1;
updateRace(late, dt, { gas: true }, {});
assert.equal(late.result, null, 'An active slow pass is not incorrectly marked lost at 30 seconds');
late.p.fin = late.t; late.p.et = 31;
updateRace(late, dt, {}, {});
assert.equal(late.result, 'win');
assert.equal(late.winner, 'p');

for (const launched of [false, true]) {
  const dnf = createRace(CARS[2], CARS[0]);
  dnf.t = dnf.greenAt + 46; dnf.p.s.gear = launched ? 1 : 0;
  updateRace(dnf, dt, {}, {});
  assert(dnf.done);
  assert.equal(dnf.result, 'lose');
  assert.equal(dnf.winner, 'a');
  const c = newCareer(); settleRace(c, dnf, 0);
  assert.equal(c.cash, 1500, 'Timeouts never pay out');
}

for (const [pTime, aTime, winner] of [[10, 10.001, 'p'], [10.001, 10, 'a']]) {
  const close = createRace(CARS[2], CARS[0]);
  close.p.fin = pTime; close.a.fin = aTime;
  updateRace(close, dt, {}, {});
  assert.equal(close.winner, winner, 'Same-frame finishes use interpolated times');
  assert.equal(close.result, winner === 'p' ? 'win' : 'lose');
}
console.log('Opponent fouls, slow finishes, timeouts, photo finishes and completed races: PASS');
