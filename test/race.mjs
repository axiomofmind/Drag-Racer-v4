// Headless race: scripted player stages, launches on green and shifts at the shift rpm.
// Run: node test/race.mjs
import { CARS } from '../src/cars.js';
import { createRace, updateRace, isGreen, staged, LEVELS } from '../src/race.js';

const dt = 1 / 120;
function run(r, { early = false } = {}) {
  const car = r.p.car;
  while (!r.done && r.t < 60) {
    const s = r.p.s, edges = {};
    if (s.gear === 0 && staged(r) && (early ? r.t > r.treeAt : isGreen(r))) edges.up = true;
    else if (s.gear > 0 && s.gear < car.gears.length && s.rpm >= car.shiftRpm && s.locked) edges.up = true;
    updateRace(r, dt, { gas: true, nitro: s.gear >= 2 }, edges);
  }
  return r;
}

let ok = true;
const r = run(createRace(CARS[0], CARS[1], LEVELS[1]));
const L = r.p;
console.log({ result: r.result, rt: L.rt?.toFixed(3), t60: L.splits[60]?.toFixed(3), et: L.et?.toFixed(3), mph: L.mph?.toFixed(1), aET: r.a.et?.toFixed(3), aRT: r.a.rt?.toFixed(3) });
if (!['win', 'lose'].includes(r.result) || !(L.et > 10 && L.et < 15) || !(L.rt > 0 && L.rt < 0.5) || r.a.et == null) ok = false;
if (!(L.splits[60] < L.splits[330] && L.splits[330] < L.splits[660] && L.splits[660] < L.et)) ok = false;

const f = run(createRace(CARS[0], CARS[1], LEVELS[1]), { early: true });
console.log('early launch:', f.result, 'rt', f.p.rt?.toFixed(3));
if (f.result !== 'foul' || !(f.p.rt < 0)) ok = false;

console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
