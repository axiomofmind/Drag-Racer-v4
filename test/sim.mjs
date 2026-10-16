// Headless physics check: rev, drop the clutch, shift at the shift point, optional nitrous.
// Run: node test/sim.mjs
import { CARS } from '../src/cars.js';
import { newState, step, launch, shift, FINISH, MPH, FT } from '../src/physics.js';

export function pass(car, { launchRpm = car.launchRpm, shiftRpm = car.shiftRpm, nitro = false } = {}) {
  const s = newState(car);
  const dt = 1 / 240;
  // stage at full throttle against the two-step limiter, exactly like the game
  s.twoStep = launchRpm;
  for (let i = 0; i < 480; i++) step(s, car, { gas: true }, dt);
  launch(s);
  let t = 0, t0 = null, t60 = null, peakSlip = 0;
  while (s.x < FINISH && t < 40) {
    if (s.gear < car.gears.length && s.rpm >= shiftRpm && s.locked && !s.spinning) shift(s, car, +1);
    step(s, car, { gas: true, nitro: nitro && s.gear >= 2 }, dt);
    t += dt;
    if (t0 === null && s.x >= 0) t0 = t;
    if (t60 === null && s.x >= 60 * FT) t60 = t;
    peakSlip = Math.max(peakSlip, s.slip);
  }
  return { et: t - t0, t60: t60 - t0, mph: s.v * MPH, peakSlip };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  let ok = true;
  for (const car of CARS) {
    const a = pass(car), b = pass(car, { nitro: true });
    const bog = pass(car, { launchRpm: 1200 }), spin = pass(car, { launchRpm: car.redline });
    console.log(`${car.name.padEnd(13)} ET ${a.et.toFixed(2)}s @ ${a.mph.toFixed(0)}mph 60ft ${a.t60.toFixed(2)} | nitro ${b.et.toFixed(2)} | bog ${bog.et.toFixed(2)} | redline dump ${spin.et.toFixed(2)} (slip ${spin.peakSlip.toFixed(1)} m/s)`);
    if (a.et < 10 || a.et > 15.5) ok = false;          // plausible street-car quarter mile
    if (a.mph < 95 || a.mph > 135) ok = false;
    if (b.et >= a.et) ok = false;                      // nitrous helps
    if (bog.et < a.et + 0.2) ok = false;              // launching too low bogs
    if (spin.et > a.et + 0.3) ok = false;             // a redline dump is not a disaster with a drag clutch
  }
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
}
