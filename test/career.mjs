import assert from 'node:assert/strict';
import { CARS } from '../src/cars.js';
import { newCareer, normalizeCareer, buildCar, buyPart, buyCar, equipRim, settleRace, PARTS, EVENTS, rivalCar } from '../src/career.js';
import { createRace, updateRace, LEVELS } from '../src/race.js';
import { pass } from './sim.mjs';

const original = JSON.stringify(CARS);
const c = newCareer();
assert.equal(buyCar(c, 'kaze'), false);
assert.equal(c.cash, 1500);
assert.equal(buyPart(c, 'engine'), true);
assert.equal(c.cash, 850);
assert.equal(buyPart(c, 'engine'), false);
assert.equal(c.owned.sprint.parts.engine, 1);
assert.equal(buyPart(c, 'unknown'), false);
assert.equal(equipRim(c, 'multi'), true);
assert.equal(c.cash, 500);
assert.equal(equipRim(c, 'stock'), true);
assert.equal(equipRim(c, 'multi'), true);
assert.equal(c.cash, 500, 'Owned wheels never charge twice');
assert.deepEqual(normalizeCareer(JSON.parse(JSON.stringify(c))), normalizeCareer(c));
const bad = normalizeCareer({ ...c, cash: -99, selected: 'toString', owned: { sprint: { parts: { engine: 999 }, color: '<script>', final: 100 } } });
assert.equal(bad.selected, 'sprint'); assert.equal(bad.owned.sprint.parts.engine, 0); assert.equal(bad.owned.sprint.final, 1);

const race = { result: 'win', p: { car: CARS[2], et: 13.5 } };
const first = settleRace(c, race, 0);
assert.equal(first.cash, EVENTS[0].purse + EVENTS[0].bonus);
const paid = c.cash;
settleRace(c, race, 0); assert.equal(c.cash, paid, 'Race settlement is idempotent');
assert.equal(c.unlocked, 1); assert.equal(c.races, 1);
assert.equal(settleRace(c, { result: 'win', p: race.p }, 0).cash, EVENTS[0].purse);
const beforeLoss = c.cash;
assert.equal(settleRace(c, { result: 'lose', p: race.p }, 0).cash, 0);
assert.equal(settleRace(c, { result: 'foul', p: race.p }, 0).cash, 0);
assert.equal(settleRace(c, { result: 'lose', p: { car: CARS[2], et: null } }, 0).cash, 0);
assert.equal(c.cash, beforeLoss, 'Losses, fouls and unfinished passes never increase the balance');
for (let index = 0; index < EVENTS.length; index++) {
  const losingCareer = newCareer();
  const loss = { result: 'lose', p: { car: CARS[2], et: 14 } };
  settleRace(losingCareer, loss, index);
  settleRace(losingCareer, loss, index);
  assert.equal(losingCareer.cash, 1500, 'No consolation payout in any event');
  assert.equal(losingCareer.wins, 0);
  assert.equal(losingCareer.unlocked, 0);
  assert.equal(losingCareer.best.sprint, 14, 'A clean losing pass can still set a personal best');
}

for (const base of CARS) {
  const career = newCareer(); career.cash = 100000;
  if (base.id !== 'sprint') assert(buyCar(career, base.id));
  const stock = pass(buildCar(career), { nitro: true });
  for (const part of PARTS) for (let i = 0; i < 3; i++) assert(buyPart(career, part.id));
  assert.equal(buyPart(career, 'engine'), false);
  const tuned = pass(buildCar(career), { nitro: true });
  assert(tuned.et < stock.et, `${base.name}: upgrades should improve ET`);
  assert(tuned.et > 7 && tuned.et < 20);
  console.log(`${base.name}: career stock ${stock.et.toFixed(2)}s → built ${tuned.et.toFixed(2)}s`);
  for (const ratio of [.9, 1.1]) {
    career.owned[base.id].final = ratio;
    const run = pass(buildCar(career), { nitro: true });
    assert(Number.isFinite(run.et) && run.et < 20, 'Every tune can complete a pass');
  }
}
for (let i = 0; i < EVENTS.length; i++) console.log(`${EVENTS[i].name}: rival ideal ET ${pass(rivalCar(i), { nitro: true }).et.toFixed(2)}s`);
assert.equal(JSON.stringify(CARS), original, 'Upgrades never mutate Quick Race cars');
const stalled = createRace(CARS[2], CARS[0], LEVELS[0]);
for (let i = 0; i < 7200 && !stalled.done; i++) updateRace(stalled, 1 / 120, { gas: false }, { up: i === 400 });
assert(stalled.done, 'A stalled pass must time out');
console.log('Career economy, persistence, build physics, payouts, and timeout: PASS');
