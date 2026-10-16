import assert from 'node:assert/strict';
import { raceFeedback, nextRivalIndex } from '../src/feedback.js';
import { setSoundSettings } from '../src/audio.js';
import { CARS } from '../src/cars.js';
import { createRace, updateRace, LEVELS } from '../src/race.js';

function sample() {
  return { result: 'lose', p: { et: 12, rt: .7, fin: 12.7, red: false, car: { nitro: 5 }, s: { nitroLeft: 1 },
    telemetry: { wheelspin: 0, bog: 0, limiter: 0, shifts: [] } },
    a: { et: 12.1, rt: .3, fin: 12.4, red: false } };
}
const reaction = raceFeedback(sample(), { et: 12.18 });
assert.match(reaction.tip, /pass was 0.100s quicker/);
assert.match(reaction.tip, /reaction was 0.400s slower/);
assert.match(reaction.comparison, /0.180s quicker/);
for (const [field, expected] of [['wheelspin', /wheelspin/], ['bog', /Revs dropped/], ['limiter', /rev limiter/]]) {
  const r = sample(); r.p.et = 13; r.p.telemetry[field] = .5;
  assert.match(raceFeedback(r).tip, expected);
}
const early = sample(); early.p.et = 13; early.p.telemetry.shifts = [{ rpm: 4000, target: 7000 }];
assert.match(raceFeedback(early).tip, /shifted early/);
const foul = sample(); foul.result = 'foul'; foul.p.red = true; foul.p.rt = -.125;
assert.match(raceFeedback(foul, { et: 13 }).summary, /0.125s early/);
assert.equal(raceFeedback(foul, { et: 13 }).comparison, '');
const dnf = sample(); dnf.p.et = null;
assert.match(raceFeedback(dnf).summary, /No completed/);
const firstPass = sample(); firstPass.result = 'win'; firstPass.p.rt = .3;
assert.equal(raceFeedback(firstPass).comparison, '');
assert.match(raceFeedback(firstPass, { et: 11.8 }).comparison, /0.200s slower/);
assert.match(raceFeedback(firstPass, { et: 12 }).comparison, /Matched/);

assert.equal(nextRivalIndex({ result: 'win' }, { mode: 'career', event: 0 }, { unlocked: 1 }, 6), 1);
assert.equal(nextRivalIndex({ result: 'lose' }, { mode: 'career', event: 0 }, { unlocked: 1 }, 6), null);
assert.equal(nextRivalIndex({ result: 'win' }, { mode: 'career', event: 5 }, { unlocked: 5 }, 6), null);
assert.equal(nextRivalIndex({ result: 'win' }, { mode: 'quick', event: 0 }, { unlocked: 1 }, 6), null);

assert.deepEqual(setSoundSettings({ muted: true, volume: .4 }), { muted: true, volume: .4 });
assert.deepEqual(setSoundSettings({ muted: 'invalid', volume: NaN }), { muted: false, volume: .7 });
assert.equal(setSoundSettings({ volume: 10 }).volume, 1);
assert.equal(setSoundSettings({ volume: -1 }).volume, 0);

// Verify observations come from the running simulation, and reset per attempt.
const r = createRace(CARS[2], CARS[0], LEVELS[0], 2000);
while (r.t < 9) {
  const s = r.p.s, e = {};
  if (s.gear === 0 && r.t >= r.greenAt) e.up = true;
  if (s.gear === 1 && s.rpm > 5500 && s.locked) e.up = true;
  updateRace(r, 1 / 120, { gas: true }, e);
}
assert(r.p.telemetry.launchRpm > 0);
assert(r.p.telemetry.shifts.length > 0);
assert(r.p.telemetry.shifts[0].rpm < r.p.telemetry.shifts[0].target - 700);
const retry = createRace(CARS[2], CARS[0]);
assert.equal(retry.p.telemetry.launchRpm, null);
assert.equal(retry.p.telemetry.shifts.length, 0);
console.log('Measured coaching, run comparisons, next rival, sound settings and fresh telemetry: PASS');
