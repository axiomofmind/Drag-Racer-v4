// Synthesised sound only; nothing to download. Must be started from a user gesture.
let ac = null, master = null, output = null, noiseBuf = null;
let voices = [], squealGain = null, hissGain = null;
let sound = { muted: false, volume: 0.7 };

export function setSoundSettings(settings = {}) {
  sound = { muted: settings.muted === true,
    volume: Number.isFinite(settings.volume) ? Math.max(0, Math.min(1, settings.volume)) : 0.7 };
  if (output) output.gain.setTargetAtTime(sound.muted ? 0 : sound.volume * 0.9, ac.currentTime, 0.02);
  return { ...sound };
}

function noiseSource() {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf; src.loop = true; src.start();
  return src;
}

// One engine: saw at the firing frequency + square sub, soft-clipped and filtered.
function makeVoice() {
  const o1 = ac.createOscillator(); o1.type = 'sawtooth';
  const o2 = ac.createOscillator(); o2.type = 'square';
  const o3 = ac.createOscillator(); o3.type = 'sawtooth'; o3.detune.value = 14;
  const mix = ac.createGain(); mix.gain.value = 0.5;
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4); }
  shaper.curve = curve;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
  const gain = ac.createGain(); gain.gain.value = 0;
  o1.connect(mix); o2.connect(mix); o3.connect(mix);
  mix.connect(shaper); shaper.connect(lp); lp.connect(gain); gain.connect(master);
  o1.start(); o2.start(); o3.start();
  return { o1, o2, o3, lp, gain };
}

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createDynamicsCompressor();
  master.threshold.value = -14; master.ratio.value = 4;
  output = ac.createGain(); output.gain.value = sound.muted ? 0 : sound.volume * 0.9;
  master.connect(output); output.connect(ac.destination);

  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  voices = [makeVoice(), makeVoice()];

  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 6;
  squealGain = ac.createGain(); squealGain.gain.value = 0;
  noiseSource().connect(bp); bp.connect(squealGain); squealGain.connect(master);

  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  hissGain = ac.createGain(); hissGain.gain.value = 0;
  noiseSource().connect(hp); hp.connect(hissGain); hissGain.connect(master);
}

// i: 0 = player, 1 = opponent. vol scales the whole voice (distance falloff).
export function setEngine(i, { rpm = 0, load = 0, cut = false, cyl = 8, vol = 1 } = {}) {
  if (!ac) return;
  const v = voices[i], t = ac.currentTime;
  const f = Math.max(15, (rpm / 60) * (cyl / 2));
  v.o1.frequency.setTargetAtTime(f, t, 0.015);
  v.o3.frequency.setTargetAtTime(f, t, 0.015);
  v.o2.frequency.setTargetAtTime(f * (cyl === 8 ? 0.5 : 1), t, 0.015);
  v.lp.frequency.setTargetAtTime(240 + rpm * (0.18 + 0.22 * load), t, 0.03);
  const g = cut ? 0.015 : 0.035 + 0.075 * load;
  v.gain.gain.setTargetAtTime(g * vol, t, cut ? 0.004 : 0.03);
}

export function setTires(slip) {
  if (!ac) return;
  squealGain.gain.setTargetAtTime(Math.min(0.12, Math.max(0, slip) * 0.012), ac.currentTime, 0.04);
}
export function setNitro(on) {
  if (!ac) return;
  hissGain.gain.setTargetAtTime(on ? 0.06 : 0, ac.currentTime, 0.05);
}
export function silence() {
  if (!ac) return;
  for (let i = 0; i < voices.length; i++) setEngine(i, { vol: 0 });
  setTires(0); setNitro(false);
}

export function blip(freq = 600, dur = 0.06, vol = 0.1, type = 'square') {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ac.currentTime + dur);
}

// Short filtered noise burst: gear clunk, backfire pop.
export function thump(freq = 180, dur = 0.08, vol = 0.25) {
  if (!ac) return;
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start(0, Math.random() * 0.5); src.stop(ac.currentTime + dur);
}
