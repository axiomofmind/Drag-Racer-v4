// Sweep launch / shift rpm per car and print the optimum. Run: node test/tune.mjs
import { CARS } from '../src/cars.js';
import { pass } from './sim.mjs';

for (const car of CARS) {
  let best = null;
  const launchRow = [];
  for (let l = 1500; l <= car.redline; l += 250) {
    const r = pass(car, { launchRpm: l, shiftRpm: car.shiftRpm });
    launchRow.push(`${l}:${r.et.toFixed(2)}`);
  }
  for (let l = 1500; l <= car.redline; l += 100) {
    for (let sh = car.redline - 1500; sh <= car.redline; sh += 50) {
      const r = pass(car, { launchRpm: l, shiftRpm: sh });
      if (!best || r.et < best.et) best = { ...r, l, sh };
    }
  }
  console.log(`${car.name}: best ET ${best.et.toFixed(3)} @ ${best.mph.toFixed(1)} mph, 60ft ${best.t60.toFixed(3)}  launch ${best.l} shift ${best.sh}`);
  console.log('  launch sweep:', launchRow.join(' '));
}
