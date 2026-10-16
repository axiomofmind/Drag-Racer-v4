// Car definitions. All data; bodies are drawn procedurally from `shape` in render.js.
// mass includes driver. torque = full-throttle flywheel curve [rpm, Nm].
// launchRpm / shiftRpm are the tuned optimum (see test/tune.mjs) and drive the AI.
const V8 = [[1000, 300], [2000, 390], [3000, 470], [4000, 520], [5000, 535], [6000, 505], [7000, 425]];

const BASE = {
  eff: 0.86, engInertia: 0.22, wheelInertia: 2.4, shiftTime: 0.16,
  rearBias: 0.46, cgHeight: 0.52, wheelbase: 2.75, nitro: 5,
};

export const CARS = [
  {
    ...BASE,
    id: 'brawler', name: "Brawler '69", blurb: 'Big-block fastback. Heavy, torquey, hooks hard.',
    color: '#c8202a', shape: 'muscle', cyl: 8, helmet: '#f2f2f2',
    mass: 1620, torque: V8.map(([r, t]) => [r, t * 1.14]), idle: 850, redline: 6800,
    gears: [2.52, 1.80, 1.30, 1.0], final: 3.73, tire: 0.345, mu: 1.9, cdA: 0.78,
    nitroTq: 170, rearBias: 0.44, wheelbase: 2.79, cgHeight: 0.55,
    launchRpm: 4500, shiftRpm: 6750,
  },
  {
    ...BASE,
    id: 'roadster', name: "Deuce '32", blurb: 'Chopped, fenderless hot rod. Light, loose, easy to spin.',
    color: '#1f63c4', shape: 'rod', cyl: 8, helmet: '#e8c547',
    mass: 1195, torque: V8.map(([r, t]) => [r, t * 0.855]), idle: 850, redline: 6600,
    gears: [2.78, 1.98, 1.36, 1.0], final: 3.55, tire: 0.35, mu: 1.75, cdA: 0.82,
    nitroTq: 150, rearBias: 0.5, wheelbase: 2.67, cgHeight: 0.6, engInertia: 0.2,
    launchRpm: 5000, shiftRpm: 6550,
  },
  {
    ...BASE,
    id: 'sprint', name: "Sprint '71", blurb: 'Lightweight compact. A rev-happy engine with five well-spaced gears.',
    color: '#f2a20c', shape: 'compact', cyl: 4, helmet: '#3b6fd8',
    mass: 960, torque: [[1000, 150], [2500, 205], [4000, 250], [5500, 282], [7000, 268], [8200, 220]],
    idle: 1000, redline: 8200,
    gears: [3.36, 2.20, 1.48, 1.08, 0.84], final: 4.1, tire: 0.30, mu: 1.95, cdA: 0.62,
    nitroTq: 75, rearBias: 0.47, wheelbase: 2.4, cgHeight: 0.5, engInertia: 0.12, wheelInertia: 1.6,
    launchRpm: 4500, shiftRpm: 8100,
  },
  {
    ...BASE,
    id: 'kaze', name: "Kaze '99", blurb: 'Turbo import. Laggy down low, screams up top.',
    color: '#2fbf5a', shape: 'tuner', cyl: 4, helmet: '#2a2a30',
    mass: 1280, torque: [[1000, 160], [2500, 218], [3500, 322], [4500, 397], [6000, 407], [7200, 360], [8000, 303]],
    idle: 900, redline: 7800,
    gears: [3.08, 2.05, 1.40, 1.03, 0.80], final: 4.1, tire: 0.32, mu: 1.85, cdA: 0.66,
    nitroTq: 110, rearBias: 0.48, wheelbase: 2.51, cgHeight: 0.48, engInertia: 0.16, wheelInertia: 1.9,
    launchRpm: 4500, shiftRpm: 7700,
  },
];
