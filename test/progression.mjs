// Exercise the whole economy with the starter car, including repeat races to fund parts.
import assert from 'node:assert/strict';
import { newCareer, buildCar, buyPart, settleRace, rivalCar, rivalLevel, EVENTS } from '../src/career.js';
import { drive, PROFILES, STAGE_BUILDS } from './drivers.mjs';
for (const seed of [17, 29, 43, 71, 101]) {
  const c = newCareer(); let runs = 0;
  for (let stage = 0; stage < EVENTS.length; stage++) {
    while (!c.cleared.includes(stage) && runs < 60) {
      let ready = true;
      for (const [part, target] of Object.entries(STAGE_BUILDS[stage])) {
        while ((c.owned.sprint.parts[part] || 0) < target) {
          if (!buyPart(c, part)) { ready = false; break; }
        }
      }
      const event = ready ? stage : Math.max(0, stage - 1);
      const r = drive(buildCar(c), rivalCar(event), rivalLevel(event), PROFILES.decent, seed + runs * 7919);
      settleRace(c, r, event); runs++;
      assert(c.cash >= 0);
    }
  }
  assert.equal(c.cleared.length, EVENTS.length, 'A decent driver must be able to finish the starter-car career');
  assert.equal(c.races, runs);
  console.log(`Starter Sprint career, seed ${seed}: completed in ${runs} races`);
}
