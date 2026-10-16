// Saved garage, fixed-timestep racing, pause controls and career settlement.
import { CARS } from './cars.js';
import { shiftLight } from './physics.js';
import { createInput } from './input.js';
import { createRace, updateRace, isGreen, staged, LEVELS, savedDifficulty } from './race.js';
import { W, H, drawScene } from './render.js';
import { drawHud, drawTree, drawHint, drawBanner } from './hud.js';
import { drawResults } from './ui.js';
import { newCareer, normalizeCareer, buildCar, rivalCar, rivalLevel, EVENTS, settleRace } from './career.js';
import { createGarage } from './garage.js';
import { raceFeedback, nextRivalIndex } from './feedback.js';
import { initAudio, setEngine, setTires, setNitro, silence, blip, thump, setSoundSettings } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.tabIndex = 0;
const input = createInput();


// Size the backing store to the displayed size x devicePixelRatio for crisp output.
let scale = 1;
function resize() {
  const pad = matchMedia('(any-pointer: coarse), (max-width: 700px)').matches ? 150 : 115;
  const extra = state === 'results' ? document.getElementById('result-actions').offsetHeight : 0;
  const cw = Math.max(180, Math.min(innerWidth, 1280, (innerHeight - pad - extra) * W / H));
  canvas.style.width = `${Math.floor(cw)}px`;
  canvas.style.height = `${Math.floor(cw * H / W)}px`;
  const dpr = Math.min(3, devicePixelRatio || 1);
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(cw * dpr * H / W);
  scale = canvas.width / W;
}
addEventListener('resize', resize);

// ---- persistence (per-car best ET + two-step setting)
const STORE = 'dragracer.v2';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
let garage = null;
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(prefs)); localStorage.setItem('dragracer.career.v1', JSON.stringify(career)); return true; } catch { garage?.toast('Browser storage is unavailable. Export a save to keep your progress.'); return false; } };
const prefs = { best: {}, twoStep: {}, car: 0, level: 1, ...load() };
if (!prefs.best || typeof prefs.best !== 'object') prefs.best = {};
if (!prefs.twoStep || typeof prefs.twoStep !== 'object') prefs.twoStep = {};
prefs.difficulty = savedDifficulty(prefs);
if (!prefs.testBest || typeof prefs.testBest !== 'object') prefs.testBest = {};
for (const car of CARS) if (!Number.isFinite(prefs.testBest[car.id]) || prefs.testBest[car.id] <= 0 || prefs.testBest[car.id] >= 120) delete prefs.testBest[car.id];
prefs.car = Number.isInteger(prefs.car) ? Math.max(0, Math.min(3, prefs.car)) : 0;
for (const car of CARS) if (!Number.isFinite(prefs.best[car.id]) || prefs.best[car.id] <= 0) delete prefs.best[car.id];
if (!prefs.record || typeof prefs.record !== 'object') prefs.record = {};
for (const lv of LEVELS) if (!Array.isArray(prefs.record[lv.id]) || prefs.record[lv.id].length !== 2 || !prefs.record[lv.id].every(Number.isFinite)) delete prefs.record[lv.id];
prefs.sound = setSoundSettings(prefs.sound ?? {});
prefs.lastRuns = Object.fromEntries(Object.entries(prefs.lastRuns ?? {}).filter(([key, run]) =>
  ['career', 'quick', 'test'].some(mode => CARS.some(car => key === `${mode}.${car.id}`)) && Number.isFinite(run?.et) && run.et > 0 && run.et < 120
).map(([key, run]) => [key, { et: run.et }]));
let career;
try { career = normalizeCareer(JSON.parse(localStorage.getItem('dragracer.career.v1'))); } catch { career = newCareer(); }
const level = () => LEVELS.find(l => l.id === prefs.difficulty);
const twoStepFor = (car) => Number.isFinite(prefs.twoStep[car.id]) ? Math.max(2000, Math.min(car.redline - 500, prefs.twoStep[car.id])) : car.launchRpm;

let state = 'garage';
let paused = false;
let config = null;
const bests = () => config?.mode === 'test' ? prefs.testBest : config?.mode === 'career' ? career.best : prefs.best;
let race = null;
let nextEvent = null;
let soundTrigger = null;
let newBest = false;
let stateT = 0;
let banner = null; // { str, color, t }

const SIM_DT = 1 / 120;

function showGarage() {
  closeSound(false); silence(); paused = false; state = 'garage'; input.reset();
  document.getElementById('race-screen').hidden = true;
  garage.show();
}
function setPaused(value) {
  paused = value; input.reset(); silence();
  if (!value) canvas.focus({ preventScroll: true });
  document.getElementById('pause-overlay').hidden = !paused;
  document.getElementById('pause').textContent = paused ? 'Resume' : 'Pause';
}
function startRace(next = config, { keepHeld = false } = {}) {
  closeSound(false); silence(); config = { ...next }; nextEvent = null;
  const built = config.mode !== 'quick';
  const car = built ? buildCar(career) : config.car;
  const others = CARS.filter(c => c.id !== car.id);
  const opp = config.mode === 'test' ? car : config.opponent ?? (config.mode === 'career' ? rivalCar(config.event) : others[(Math.random() * others.length) | 0]);
  config.opponent = opp;
  const difficulty = config.mode === 'career' ? rivalLevel(config.event) : level();
  race = createRace(car, opp, difficulty, built ? car.launchRpm : twoStepFor(car), { solo: config.mode === 'test' });
  race.night = true;
  newBest = false; banner = null; paused = false;
  state = 'race'; stateT = 0; input.reset(keepHeld); initAudio();
  garage.hide();
  document.getElementById('race-screen').hidden = false;
  document.getElementById('pause-overlay').hidden = true;
  document.getElementById('result-actions').hidden = true;
  document.getElementById('pad').hidden = false;
  document.getElementById('race-help').hidden = false;
  document.getElementById('pause').hidden = false;
  document.getElementById('retry').hidden = false;
  document.getElementById('next-rival').hidden = true;
  document.getElementById('pause').textContent = 'Pause';
  document.getElementById('rematch').textContent = race.solo ? 'Test again →' : 'Race again →';
  document.getElementById('result-garage').textContent = race.solo ? 'Back to tune' : 'Garage';
  document.getElementById('race-label').textContent = config.mode === 'test' ? 'SOLO TEST / ' + car.name : config.mode === 'career' ? EVENTS[config.event].name + ' / vs. ' + EVENTS[config.event].rival : 'NIGHTFALL RACEWAY / QUICK RACE';
  resize(); canvas.focus({ preventScroll: true });
}

function retryRace() {
  if (!config || state === 'garage' || (state === 'results' && stateT < .75)) return;
  startRace(config, { keepHeld: state === 'race' && !paused });
}
function updateSoundUI() {
  const muted = prefs.sound.muted;
  document.getElementById('mute').textContent = muted ? 'Unmute' : 'Mute';
  document.getElementById('mute').setAttribute('aria-pressed', String(muted));
  document.getElementById('volume').value = Math.round(prefs.sound.volume * 100);
  document.getElementById('volume-value').textContent = `${Math.round(prefs.sound.volume * 100)}%`;
}
function closeSound(restoreFocus = true) {
  const panel = document.getElementById('sound-panel');
  if (panel.hidden) return;
  panel.hidden = true;
  document.querySelectorAll('[data-sound-toggle]').forEach(el => el.setAttribute('aria-expanded', 'false'));
  if (restoreFocus && soundTrigger?.isConnected) soundTrigger.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const toggle = e.target.closest('[data-sound-toggle]');
  if (!toggle) return;
  if (!document.getElementById('sound-panel').hidden) { closeSound(); return; }
  soundTrigger = toggle;
  if (state === 'race') setPaused(true);
  document.getElementById('sound-panel').hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  updateSoundUI(); document.getElementById('mute').focus();
});
document.getElementById('sound-close').addEventListener('click', () => closeSound());
document.getElementById('sound-panel').addEventListener('keydown', e => {
  if (e.code === 'Escape') { e.stopPropagation(); e.preventDefault(); closeSound(); }
});
document.getElementById('mute').addEventListener('click', () => {
  prefs.sound = setSoundSettings({ ...prefs.sound, muted: !prefs.sound.muted });
  updateSoundUI(); save();
});
document.getElementById('volume').addEventListener('input', e => {
  prefs.sound = setSoundSettings({ ...prefs.sound, volume: Number(e.target.value) / 100 });
  updateSoundUI();
});
document.getElementById('volume').addEventListener('change', save);
updateSoundUI();

garage = createGarage({ career, prefs, save, start: startRace });
document.getElementById('leave').addEventListener('click', showGarage);
document.getElementById('result-garage').addEventListener('click', showGarage);
document.getElementById('pause').addEventListener('click', () => setPaused(!paused));
document.getElementById('resume').addEventListener('click', () => setPaused(false));
document.getElementById('rematch').addEventListener('click', retryRace);
document.getElementById('retry').addEventListener('click', retryRace);
document.getElementById('next-rival').addEventListener('click', () => {
  if (state !== 'results' || stateT < .75 || nextEvent === null) return;
  garage.setEvent(nextEvent);
  startRace({ ...config, event: nextEvent, opponent: undefined });
});
addEventListener('blur', () => { if (state === 'race') setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'race') setPaused(true); });
resize();

function update(dt) {
  const e = input.edges, held = input.held;
  if (e.start || e.up || e.down || e.left || e.right) initAudio();
  if (state === 'results' && stateT < .75) { input.clearEdges(); stateT += dt; return; }
  if (state === 'results') {
    document.getElementById('rematch').disabled = false;
    document.getElementById('next-rival').disabled = false;
  }
  if (e.retry && state !== 'garage') { retryRace(); return; }
  stateT += dt;
  if (banner) banner.t += dt;

  if (state === 'garage') {
    if (e.start) garage.launch();
  } else if (state === 'race') {
    if (e.back) { setPaused(!paused); return; }
    if (paused) { input.clearEdges(); return; }
    const evs = updateRace(race, dt, held, e);
    for (const ev of evs) {
      if (ev === 'amber') blip(520, 0.07, 0.05);
      if (ev === 'green') blip(980, 0.18, 0.06);
      if (ev === 'stage') blip(1400, 0.03, 0.03);
      if (ev === 'twostep') blip(760, 0.03, 0.04);
      if (ev === 'shift') thump(160, 0.09, 0.3);
      if (ev === 'launch') thump(120, 0.12, 0.35);
      if (ev === 'foul') { blip(140, 0.5, 0.12, 'sawtooth'); banner = { str: 'RED LIGHT · RETRY / R', color: '#ff4a3d', t: 0 }; }
      if (ev === 'finish' && race.result !== 'foul') {
        const won = race.winner === 'p';
        banner = { str: race.solo ? 'PASS COMPLETE' : won ? 'WINNER!' : 'TOO SLOW', color: race.solo || won ? '#4cff7a' : '#ff4a3d', t: 0 };
        blip(won ? 1046 : 220, 0.3, 0.08);
      }
    }
    if (race.p.s.gear === 0) {
      const value = race.p.s.twoStep;
      if (config.mode !== 'quick') {
        if (career.owned[race.p.car.id].launch !== value) { career.owned[race.p.car.id].launch = value; save(); }
      } else if (prefs.twoStep[race.p.car.id] !== value) { prefs.twoStep[race.p.car.id] = value; save(); }
    }
    const ps = race.p.s, as = race.a.s;
    setEngine(0, { rpm: ps.rpm, load: ps.throttle, cut: ps.cut && ps.throttle > 0.3, cyl: race.p.car.cyl });
    setEngine(1, { rpm: as.rpm, load: as.throttle, cut: as.cut && as.throttle > 0.3, cyl: race.a.car.cyl,
      vol: race.solo ? 0 : 0.55 / (1 + Math.abs(as.x - ps.x) / 25) });
    setTires(Math.max(ps.spinning ? ps.slip : 0, !race.solo && as.spinning ? as.slip * 0.4 : 0));
    setNitro(ps.nitroOn);
    if (ps.cut && ps.gear === 0 && Math.random() < dt * 6) thump(900, 0.04, 0.12);

    if (race.done) {
      const L = race.p;
      const runKey = `${config.mode}.${L.car.id}`;
      race.feedback = raceFeedback(race, prefs.lastRuns[runKey]);
      if (!L.red && race.result !== 'foul' && L.et != null) prefs.lastRuns[runKey] = { et: L.et };
      document.getElementById('run-feedback').textContent = `${race.feedback.summary} ${race.feedback.tip}`;
      document.getElementById('run-comparison').textContent = race.feedback.comparison;
      document.getElementById('run-comparison').hidden = !race.feedback.comparison;
      if (!L.red && race.result !== 'foul' && L.et != null && (bests()[L.car.id] == null || L.et < bests()[L.car.id])) {
        bests()[L.car.id] = L.et; newBest = true;
      }
      let message = !L.red && L.et != null
        ? 'Quick race complete · Stock-car time saved.'
        : 'Quick race complete · No clean time recorded.';
      if (config.mode === 'career') {
        const reward = settleRace(career, race, config.event);
        message = reward.cash > 0
          ? `+$${reward.cash.toLocaleString()} earned` + (reward.first ? ' · First-win bonus included!' : '') + (reward.completed ? ' · You are king of the strip.' : reward.first ? ' · Next rival unlocked.' : '')
          : 'No payout. Win the race to earn cash.';
      } else if (config.mode === 'test') {
        message = 'Solo test · No cash, wins or losses. Your tune is ready for another pass.';
      } else {
        const rec = (prefs.record ??= {})[race.level.id] ??= [0, 0];
        rec[race.result === 'win' ? 0 : 1]++;
      }
      nextEvent = nextRivalIndex(race, config, career, EVENTS.length);
      document.getElementById('next-rival').hidden = nextEvent === null;
      document.getElementById('rematch').classList.toggle('primary', nextEvent === null);
      document.getElementById('reward').textContent = message;
      save();
      state = 'results'; stateT = 0;
      document.getElementById('rematch').disabled = true;
      document.getElementById('next-rival').disabled = true;
      document.getElementById('result-actions').hidden = false;
      document.getElementById('pad').hidden = true;
      document.getElementById('race-help').hidden = true;
      document.getElementById('pause').hidden = true;
      document.getElementById('retry').hidden = true;
      input.reset(); resize(); silence();
    }
  } else if (state === 'results') {
    if (e.start) retryRace();
    if (e.back) showGarage();
  }
  input.clearEdges();
}

function draw(time) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  if (state === 'garage') return garage.draw(time);
  drawScene(ctx, race, time);
  drawHud(ctx, race, time);
  if (state === 'race') {
    const sinceGreen = race.t - race.greenAt;
    if (sinceGreen < 2) drawTree(ctx, race, sinceGreen < 1.5 ? 1 : 1 - (sinceGreen - 1.5) / 0.5);
    const s = race.p.s;
    const touch = matchMedia('(any-pointer: coarse), (max-width: 700px)').matches;
    if (s.gear === 0 && !race.p.red) {
      if (!staged(race)) drawHint(ctx, 'STAGING…');
      else if (!isGreen(race)) {
        drawHint(ctx, s.throttle > 0.5
          ? (touch ? `TAP SHIFT ON GREEN · LAUNCH ${s.twoStep} RPM` : `↑ DUMP THE CLUTCH ON GREEN   ·   ← → LAUNCH ${s.twoStep} RPM`)
          : (touch ? 'HOLD GAS TO BUILD REVS' : 'HOLD SPACE TO BUILD REVS'));
      } else drawHint(ctx, touch ? 'GO! TAP SHIFT TO LAUNCH' : 'GO!  ↑ TO LAUNCH', undefined, '#5dff86');
    } else if (race.p.fin == null && race.t - race.greenAt < 6 && shiftLight(s, race.p.car)) {
      drawHint(ctx, '↑ SHIFT!', undefined, '#ffd34d');
    }
  }
  if (banner && banner.t < 1.6 && state === 'race') drawBanner(ctx, banner.str, banner.color, banner.t);
  if (state === 'results') drawResults(ctx, race, bests()[race.p.car.id] ?? null, newBest, stateT);
}

let acc = 0, prev = performance.now();
function frame(now) {
  acc += Math.min(0.1, (now - prev) / 1000);
  prev = now;
  // edges are consumed on the first sim step of the frame
  while (acc >= SIM_DT) { update(SIM_DT); acc -= SIM_DT; }
  draw(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
