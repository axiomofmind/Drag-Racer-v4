import { CARS } from './cars.js';
import { LEVELS } from './race.js';

export const PRICES = { sprint: 0, roadster: 4800, brawler: 8500, kaze: 11500 };
const STOCK = { sprint: 0.68, roadster: 0.82, brawler: 1, kaze: 1.07 };
export const PARTS = [
  { id: 'engine', name: 'Engine & ECU', cost: 650, detail: '+12% stock torque per stage. More power demands more grip.' },
  { id: 'tires', name: 'Drag tires', cost: 450, detail: '+9% grip per stage. Put your power on the pavement.' },
  { id: 'gearbox', name: 'Race transmission', cost: 550, detail: '25 ms faster shifts per stage. Keep the engine pulling.' },
  { id: 'weight', name: 'Weight reduction', cost: 500, detail: 'Remove 5% of stock mass per stage. Every kilo counts.' },
  { id: 'nitrous', name: 'Nitrous system', cost: 600, detail: '+25% nitrous torque and +0.5 seconds per stage.' },
];
export const PAINTS = ['#f2a20c', '#c8202a', '#297bdf', '#32bd8c', '#dce4ed', '#343843', '#a66ce8', '#f17aaf'];
export const RIMS = [{ id: 'stock', name: 'Factory' }, { id: 'slot', name: 'Drag slots' }, { id: 'multi', name: 'Split spokes' }, { id: 'minilite', name: 'Classic eight' }];
export const EVENTS = [
  { name: 'First light', rival: 'Jules', pace: 12.6, car: 'roadster', power: 0.7075, level: 'normal', purse: 700, bonus: 600, description: 'Your first invitation. Learn the tree and make a clean pass.' },
  { name: 'After hours', rival: 'Mika', pace: 12.1, car: 'sprint', power: 0.814, level: 'sport', purse: 950, bonus: 900, description: 'A lightweight local with quick hands. Keep your launch and shifts tidy.' },
  { name: 'Heavy hitters', rival: 'Duke', pace: 11.4, car: 'brawler', power: 0.9582, level: 'sport', purse: 1300, bonus: 1300, description: 'Big torque under the floodlights. A clean launch matters.' },
  { name: 'Boost district', rival: 'Ren', pace: 11.1, car: 'kaze', power: 1.0072, level: 'hard', purse: 1800, bonus: 1800, description: 'The imports own this strip. Bring power and well-timed nitrous.' },
  { name: 'Midnight finals', rival: 'Vega', pace: 10.5, car: 'brawler', power: 1.1932, level: 'hard', purse: 2400, bonus: 2600, description: 'A built muscle car and a driver who rarely misses a shift.' },
  { name: 'King of the strip', rival: 'Ghost', pace: 10.5, car: 'kaze', power: 1.25, level: 'pro', purse: 3200, bonus: 5000, description: 'One final rival. Build your best car and earn the crown.' },
];
const setup = (id) => ({ color: CARS.find(c => c.id === id).color, rim: 'stock', rims: ['stock'], parts: {}, launch: null, final: 1 });
export function newCareer() {
  return { version: 1, cash: 1500, selected: 'sprint', owned: { sprint: setup('sprint') }, unlocked: 0, wins: 0, races: 0, cleared: [], best: {} };
}
const integer = (n, lo, hi, fallback = lo) => Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
export function normalizeCareer(raw) {
  if (!raw || raw.version !== 1 || !raw.owned || typeof raw.owned !== 'object') return newCareer();
  const c = newCareer();
  c.cash = integer(raw.cash, 0, 100000000, 1500);
  c.unlocked = integer(raw.unlocked, 0, EVENTS.length - 1);
  c.wins = integer(raw.wins, 0, 10000000); c.races = integer(raw.races, 0, 10000000);
  c.cleared = [...new Set((Array.isArray(raw.cleared) ? raw.cleared : []).filter(n => Number.isInteger(n) && n >= 0 && n <= c.unlocked))];
  for (const car of CARS) {
    const s = raw.owned[car.id]; if (!s || typeof s !== 'object') continue;
    const v = setup(car.id);
    if (PAINTS.includes(s.color) || s.color === car.color) v.color = s.color;
    v.rims = [...new Set(['stock', ...(Array.isArray(s.rims) ? s.rims : []).filter(r => RIMS.some(x => x.id === r))])];
    v.rim = v.rims.includes(s.rim) ? s.rim : 'stock';
    for (const part of PARTS) v.parts[part.id] = integer(s.parts?.[part.id], 0, 3);
    v.launch = integer(s.launch, 2000, car.redline - 500, car.launchRpm);
    v.final = [0.9, 1, 1.1].includes(s.final) ? s.final : 1;
    c.owned[car.id] = v;
    const best = raw.best?.[car.id]; if (Number.isFinite(best) && best > 0 && best < 120) c.best[car.id] = best;
  }
  c.selected = Object.hasOwn(c.owned, raw.selected) ? raw.selected : 'sprint';
  return c;
}
export function buildCar(career, id = career.selected) {
  const base = CARS.find(c => c.id === id), s = career.owned[id] ?? setup(id), p = s.parts;
  const power = STOCK[id] * (1 + (p.engine || 0) * 0.12);
  return { ...base, color: s.color, rim: s.rim, torque: base.torque.map(([r, t]) => [r, t * power]),
    mass: Math.round(base.mass * (1 - (p.weight || 0) * 0.05)), mu: base.mu * (1 + (p.tires || 0) * 0.09),
    shiftTime: base.shiftTime - (p.gearbox || 0) * 0.025,
    nitroTq: base.nitroTq * (1 + (p.nitrous || 0) * 0.25), nitro: base.nitro + (p.nitrous || 0) * 0.5,
    final: base.final * s.final, launchRpm: s.launch ?? base.launchRpm,
  };
}
export function rivalLevel(index) {
  return { ...LEVELS.find(l => l.id === EVENTS[index].level), ...EVENTS[index].driver };
}
export function rivalCar(index) {
  const e = EVENTS[index], base = CARS.find(c => c.id === e.car);
  return { ...base, torque: base.torque.map(([r, t]) => [r, t * e.power]), mu: base.mu * (1 + index * 0.025) };
}
export function partPrice(career, id) {
  const part = PARTS.find(p => p.id === id);
  return part ? part.cost * ((career.owned[career.selected].parts[id] || 0) + 1) : Infinity;
}
export function buyPart(career, id) {
  const s = career.owned[career.selected], price = partPrice(career, id);
  if ((s.parts[id] || 0) >= 3 || career.cash < price) return false;
  career.cash -= price; s.parts[id] = (s.parts[id] || 0) + 1; return true;
}
export function buyCar(career, id) {
  if (!Object.hasOwn(PRICES, id) || Object.hasOwn(career.owned, id) || career.cash < PRICES[id]) return false;
  career.cash -= PRICES[id]; career.owned[id] = setup(id); career.selected = id; return true;
}
export function equipRim(career, id) {
  if (!RIMS.some(r => r.id === id)) return false;
  const s = career.owned[career.selected];
  if (!s.rims.includes(id)) { if (career.cash < 350) return false; career.cash -= 350; s.rims.push(id); }
  s.rim = id; return true;
}
// One settlement per race; abandoning a race never calls this function.
export function settleRace(career, race, index) {
  if (race.solo) return { cash: 0, first: false, completed: false };
  if (race.settled) return race.reward;
  race.settled = true;
  const e = EVENTS[index], won = race.result === 'win';
  const finished = race.p.et != null && !race.p.red && race.result !== 'foul';
  const first = won && !career.cleared.includes(index);
  const reward = won ? e.purse + (first ? e.bonus : 0) : 0;
  career.cash += reward; career.races++;
  if (won) { career.wins++; if (first) career.cleared.push(index); career.unlocked = Math.max(career.unlocked, Math.min(EVENTS.length - 1, index + 1)); }
  if (finished) career.best[race.p.car.id] = Math.min(career.best[race.p.car.id] ?? Infinity, race.p.et);
  race.reward = { cash: reward, first, completed: career.cleared.length === EVENTS.length };
  return race.reward;
}
