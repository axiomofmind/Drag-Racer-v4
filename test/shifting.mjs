import assert from 'node:assert/strict';
import { CARS } from '../src/cars.js';
import { newCareer, buildCar, buyCar, PARTS } from '../src/career.js';
import { newState, step, launch, shift, ratioOf, rpmInGear, FINISH } from '../src/physics.js';

const RPM = 60 / (2 * Math.PI), dt = 1 / 240;
function inGear(car, gear, rpm = car.shiftRpm) {
  const s = newState(car);
  Object.assign(s, { gear, we: rpm / RPM, locked: true, clutch: 1, throttle: 1 });
  s.ww = s.we / ratioOf(car, gear); s.v = s.ww * car.tire;
  return s;
}

for (const base of CARS) {
  const career = newCareer(); career.cash = 100000;
  if (base.id !== 'sprint') buyCar(career, base.id);
  for (const p of PARTS) career.owned[base.id].parts[p.id] = 3;
  for (const car of [base, buildCar(career)]) {
    for (let gear = 1; gear < car.gears.length; gear++) {
      const s = inGear(car, gear), before = s.rpm, speed = s.v, nitro = s.nitroLeft;
      assert(shift(s, car, 1));
      assert.equal(s.rpm, before, 'Selecting a gear cannot teleport the engine RPM');
      assert.equal(s.v, speed, 'Selecting a gear cannot change road speed');
      assert.equal(s.locked, false, 'Clutch opens before the gear ratio changes');
      assert.equal(shift(s, car, 1), false, 'No second shift during the first clutch operation');
      for (let i = 0; i < 12; i++) step(s, car, { gas: true, nitro: true }, dt);
      assert.equal(s.nitroLeft, nitro, 'Nitrous is cut while the clutch is open');
      assert(s.rpm < before, 'Holding gas must still allow an upshift RPM drop');
      for (let i = 0; i < 108; i++) step(s, car, { gas: true, nitro: true }, dt);
      assert(!s.shifting && s.locked, 'The clutch reconnects after the shift');
      assert(s.rpm < before * .93, `${car.id} ${gear}: a clear RPM drop survives throttle reapplication`);
      assert(Math.abs(s.rpm - rpmInGear(s, car, s.gear)) < 2, 'Engine RPM follows wheel speed and ratio');
    }
  }
  const down = inGear(base, 3, base.redline * .45);
  const before = down.rpm;
  assert(shift(down, base, -1));
  for (let i = 0; i < 144; i++) step(down, base, { gas: false }, dt);
  assert(down.rpm > before && down.locked, 'A safe downshift matches the higher engine speed');
  const unsafe = inGear(base, 3, base.redline * .95);
  assert.equal(shift(unsafe, base, -1), false, 'Over-rev protection still rejects unsafe downshifts');
}

// The player's fully upgraded compact should pull through third, not demand
// another shift immediately. Exercise both normal and short final-drive tunes.
for (const final of [1, 1.1]) {
  const c = newCareer();
  for (const p of PARTS) c.owned.sprint.parts[p.id] = 3;
  c.owned.sprint.final = final;
  const car = buildCar(c), s = newState(car); s.twoStep = car.launchRpm;
  for (let i = 0; i < 480; i++) step(s, car, { gas: true }, dt);
  launch(s);
  let thirdAt = null, thirdDuration = null;
  for (let t = 0; t < 30 && s.x < FINISH; t += dt) {
    if (s.gear < car.gears.length && s.rpm >= car.shiftRpm && s.locked && !s.spinning && !s.shifting) {
      if (s.gear === 3) thirdDuration = t - thirdAt;
      if (shift(s, car, 1) && s.gear === 3) thirdAt = t;
    }
    step(s, car, { gas: true, nitro: s.gear >= 2 }, dt);
  }
  assert(thirdDuration >= 1.8, `Third gear needs a useful pull even with full upgrades (${thirdDuration}s)`);
  console.log(`Built Sprint, ${final === 1 ? 'balanced' : 'short'} gearing: third lasts ${thirdDuration.toFixed(2)}s`);
}
console.log('RPM drop, clutch transition, nitrous cut, downshifts and gear duration: PASS');
