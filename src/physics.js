// Drivetrain + tire simulation. Pure functions, SI units, no DOM access.
//
// Two rotating bodies (engine, rear axle) and the car body, joined by a friction
// clutch and a tire contact patch. Each joint is either locked (bodies share one
// speed, solved together) or slipping (it passes its friction limit as torque /
// force). Joints lock when slip speed crosses zero and unlock when the torque
// needed to hold them exceeds their capacity. This handles bog, wheelspin and
// clutch slip without stiff spring constants.
export const FINISH = 402.336;   // quarter mile (m)
export const ROLLOUT = 0.29;     // front tire travel before it clears the stage beam (m)
export const MPH = 2.23694;
export const FT = 0.3048;
const RHO = 1.2, G = 9.81, CRR = 0.012;
const RPM = 60 / (2 * Math.PI);
const SUB = 1 / 960;             // internal substep (s)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function newState(car) {
  return {
    x: -ROLLOUT, v: 0, acc: 0,
    we: car.idle / RPM,       // engine speed (rad/s)
    ww: 0,                    // rear wheel speed (rad/s)
    gear: 0, shiftT: 0, shifting: false, clutch: 0, locked: false, clutchRate: 8,
    throttle: 0, cut: false, twoStep: null,
    nitroLeft: car.nitro, nitroOn: false,
    tireLocked: true, slip: 0, spinning: false, rpmRate: 0,
    wheelAngle: 0, braking: false,
    get rpm() { return this.we * RPM; },
  };
}

export function torqueAt(car, rpm) {
  const c = car.torque;
  if (rpm <= c[0][0]) return c[0][1] * Math.max(0, rpm / c[0][0]);
  for (let i = 1; i < c.length; i++) {
    if (rpm <= c[i][0]) {
      const [r0, t0] = c[i - 1], [r1, t1] = c[i];
      return t0 + (t1 - t0) * (rpm - r0) / (r1 - r0);
    }
  }
  return c[c.length - 1][1];
}

export const ratioOf = (car, gear) => (gear > 0 ? car.gears[gear - 1] * car.final : 0);
export const peakTorque = (car) => Math.max(...car.torque.map((p) => p[1]));
export const peakHp = (car) => Math.round(Math.max(...car.torque.map(([r, t]) => t * r / 7121)));

// Engine rpm the drivetrain would force in `gear` at the current road speed.
// Predictive shift light: leads the shift point by how fast the revs are climbing, so a human
// reacting to it (~0.15 s) shifts on the number rather than on the limiter.
export const SHIFT_LEAD = 0.15;
export function shiftLight(s, car) {
  if (s.gear === 0 || s.gear >= car.gears.length || !s.locked || s.spinning || s.shiftT > 0) return false;
  return s.cut || s.rpm + Math.max(0, s.rpmRate) * SHIFT_LEAD >= car.shiftRpm; // stays lit on the limiter
}
export const rpmInGear = (s, car, gear) => (s.v / car.tire) * ratioOf(car, gear) * RPM;

// Driver actions. Return true if the action happened.
export function launch(s) {
  if (s.gear !== 0) return false;
  s.gear = 1; s.clutchRate = 1 / 0.18; // drop the clutch over ~0.18 s
  return true;
}
export function shift(s, car, dir) {
  if (s.gear === 0 || s.shiftT > 0 || s.shifting) return false;
  const g = s.gear + dir;
  if (g < 1 || g > car.gears.length) return false;
  if (dir < 0 && rpmInGear(s, car, g) > car.redline + 300) return false; // would over-rev
  // Open the clutch before changing ratio. Otherwise the still-locked engine
  // snaps to the new ratio for one substep, then flares back to the limiter.
  s.locked = false; s.clutch = 0; s.shifting = true; s.rpmRate = 0;
  s.gear = g; s.shiftT = car.shiftTime; s.clutchRate = 1 / 0.10;
  return true;
}

// inp: { gas:boolean, nitro:boolean }
export function step(s, car, inp, dt) {
  const n = Math.max(1, Math.round(dt / SUB));
  for (let i = 0; i < n; i++) substep(s, car, inp, dt / n);
  return s;
}

function substep(s, car, inp, h) {
  const m = car.mass, r = car.tire;
  const R = ratioOf(car, s.gear);
  const rpm = s.we * RPM;

  // --- driver pedals ---
  const gas = inp.gas && !s.braking;
  // The shift button includes the driver's throttle lift and clutch operation.
  s.throttle += clamp((gas && !s.shifting ? 1 : 0) - s.throttle, -h / 0.03, h / 0.08);
  if (s.shiftT > 0) s.shiftT = Math.max(0, s.shiftT - h);
  const clutchWant = s.gear > 0 && s.shiftT === 0 ? 1 : 0;
  s.clutch += clamp(clutchWant - s.clutch, -h / 0.03, h * s.clutchRate);

  // --- engine; staged in neutral the two-step limiter holds launch rpm ---
  const limit = s.gear === 0 && s.twoStep ? s.twoStep : car.redline;
  if (rpm > limit) s.cut = true;
  else if (rpm < limit - (s.gear === 0 ? 150 : 250)) s.cut = false;
  const thr = s.cut ? 0 : s.throttle;
  s.nitroOn = !!inp.nitro && gas && !s.shifting && s.gear > 0 && s.nitroLeft > 0 && rpm > 2500 && !s.cut;
  if (s.nitroOn) s.nitroLeft = Math.max(0, s.nitroLeft - h);
  let Te = thr * (torqueAt(car, rpm) + (s.nitroOn ? car.nitroTq : 0))
         - (1 - thr) * (12 + 0.011 * rpm);              // pumping + friction losses
  if (rpm < car.idle) Te += Math.min(0.15 * peakTorque(car), 0.4 * (car.idle - rpm)); // idle control
  const Ie = car.engInertia;
  if (s.shifting) {
    // A bounded engine-braking torque lets revs fall toward road-speed RPM;
    // a small throttle blip matches revs on downshifts. No instantaneous snap.
    const target = Math.max(car.idle / RPM, s.ww * R);
    Te = clamp((target - s.we) * Ie / 0.065, -peakTorque(car) * 0.55, peakTorque(car) * 0.3);
  }

  // --- clutch capacity; the driver feathers it rather than stall ---
  const antiStall = clamp((rpm - 500) / (car.idle - 500), 0.05, 1);
  // drag-style lock-up clutch: slips at about peak torque off the line so the launch can't shock
  // the tires loose, then clamps harder with speed so nitrous and shifts don't slip it
  const lockup = 1 + 0.8 * clamp(s.v / 15, 0, 1);
  const cap = s.clutch * (car.clutchCap ?? peakTorque(car)) * lockup * antiStall;

  // --- external forces ---
  let Fres = 0.5 * RHO * car.cdA * s.v * s.v + (s.v > 0.01 ? CRR * m * G : 0);
  if (s.braking) Fres += m * 0.9 * G * Math.min(1, s.v / 2);
  // rear axle load with longitudinal weight transfer
  const Nr = clamp(m * G * car.rearBias + m * s.acc * car.cgHeight / car.wheelbase, 0.15 * m * G, m * G);
  const muS = car.mu, slipSpeed = Math.abs(s.ww * r - s.v);
  // sliding grip falls off with slip ratio: a little slip keeps near-peak grip, a burnout doesn't
  const kappa = slipSpeed / Math.max(s.v, 3);
  const muK = car.mu * (0.95 - 0.3 * clamp((kappa - 0.1) / 0.5, 0, 1));
  const Iw = car.wheelInertia;

  // Solve wheel side given drive torque Td and rotating inertia I.
  // Returns { a, dww, F, tireLocked }.
  const solveWheel = (Td, I, tireLocked) => {
    if (tireLocked) {
      const meff = m + I / (r * r);
      let a = (Td / r - Fres) / meff;
      if (s.v <= 0 && a < 0) a = 0;
      const F = m * a + Fres;
      if (Math.abs(F) <= muS * Nr) return { a, dww: a / r, F, tireLocked: true };
    }
    const dir = Math.sign(s.ww * r - s.v) || Math.sign(Td) || 1;
    const F = dir * muK * Nr;
    let a = (F - Fres) / m;
    if (s.v <= 0 && a < 0) a = 0;
    return { a, dww: (Td - F * r) / I, F, tireLocked: false };
  };

  let res, dwe;
  const engaged = R > 0 && cap > 0;
  if (engaged && s.locked) {
    // engine + wheels as one body
    const eta = Te >= 0 ? car.eff : 1 / car.eff;
    res = solveWheel(Te * R * eta, Iw + Ie * R * R, s.tireLocked);
    dwe = res.dww * R;
    const Tc = Te - Ie * dwe; // torque the clutch must carry to stay locked
    if (Math.abs(Tc) > cap) s.locked = false;
  }
  if (!engaged || !s.locked) {
    s.locked = false;
    const diff = s.we - s.ww * R;
    const Tc = engaged ? (Math.sign(diff) || 1) * cap : 0;
    res = solveWheel(Tc * R * car.eff, Iw, s.tireLocked);
    dwe = (Te - Tc) / Ie;
  }

  // --- integrate ---
  const prevDiff = s.we - s.ww * R, prevSlip = s.ww * r - s.v;
  s.acc = res.a;
  s.v = Math.max(0, s.v + res.a * h);
  s.x += s.v * h;
  s.ww = Math.max(res.tireLocked ? 0 : -1e9, s.ww + res.dww * h);
  if (res.tireLocked) s.ww = s.v / r;
  s.we = Math.max(300 / RPM, s.we + dwe * h);
  s.tireLocked = res.tireLocked;

  // tire regains grip when slip speed crosses zero
  if (!s.tireLocked && prevSlip * (s.ww * r - s.v) <= 0) { s.tireLocked = true; s.ww = s.v / r; }
  // clutch locks when slip crosses zero
  if (engaged && !s.locked) {
    const d = s.we - s.ww * R;
    if (prevDiff * d <= 0 || Math.abs(d) < 0.5) { s.locked = true; s.we = s.ww * R; }
  }
  if (s.locked) s.we = s.ww * R;
  if (s.shifting && s.shiftT === 0 && s.locked) {
    s.shifting = false;
    s.rpmRate = 0;
  }

  s.slip = s.ww * r - s.v;
  // real wheelspin, not the few percent of slip a hooked drag tire always runs
  s.spinning = !s.tireLocked && s.slip > Math.max(1, 0.12 * s.v);
  s.rpmRate += ((s.we * RPM - rpm) / h - s.rpmRate) * Math.min(1, h * 20);
  s.wheelAngle += s.ww * h;
}
