// Car artwork. Bodies are SVG paths in centimetres (x from rear bumper, y up = negative,
// ground at y = 0), rendered once per scale into a sprite. Wheels are two cached layers:
// a static tire/brake layer and a rotating rim layer that gets real rotational blur.
import { DISPLAY, shade, clamp } from './gfx.js';

const paths = new Map();
const P = (d) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };

// --------------------------------------------------------------------------- shapes
const SHAPES = {
  muscle: {
    len: 477, wheels: [95, 374], arch: 44, chord: -27, horizon: -78, rim: 'slot', rimRatio: 0.6, letters: 'DRAG  RADIAL',
    body: 'M6,-30 L3,-60 Q1,-82 8,-92 L16,-97 Q38,-99 62,-100 C108,-104 148,-127 172,-134 Q192,-139 232,-139 ' +
      'Q248,-138 257,-131 L297,-104 Q302,-101 312,-100 L440,-96 Q467,-95 473,-86 L477,-70 Q479,-48 474,-36 ' +
      'Q470,-28 456,-27 L417.4,-27 A44 44 0 1 0 330.6,-27 L138.4,-27 A44 44 0 1 0 51.6,-27 L22,-27 Q8,-27 6,-30 Z',
    glass: 'M152,-106 C166,-119 182,-128 198,-131 Q226,-134 244,-131 L284,-106 Z',
    helmet: [236, -118], pipe: [-4, -21], trim: '#dfe2e6',
  },
  rod: {
    len: 392, wheels: [78, 345], arch: 0, fenderless: true, horizon: -100, rim: 'steel', rimRatio: 0.62,
    rearScale: 1.1, frontScale: 0.82,
    body: 'M24,-58 Q4,-60 4,-82 C4,-104 24,-124 52,-134 C78,-146 100,-152 120,-153 L198,-154 Q205,-154 207,-148 ' +
      'L215,-121 L352,-113 L362,-113 L362,-60 L220,-60 L216,-55 L112,-55 Q100,-55 96,-58 Z',
    glass: 'M110,-128 L114,-144 Q116,-148 124,-148 L148,-148 L148,-128 Z M156,-148 L200,-148 L207,-128 L156,-128 Z',
    helmet: [182, -134], pipe: [116, -49], trim: '#dfe2e6',
  },
  compact: {
    len: 400, wheels: [74, 314], arch: 38, chord: -28, horizon: -82, rim: 'minilite', rimRatio: 0.62, flares: true,
    body: 'M4,-30 L2,-70 Q2,-86 12,-92 L52,-96 Q62,-97 68,-102 L96,-132 Q102,-138 114,-138 L206,-138 ' +
      'Q214,-138 220,-133 L264,-100 Q268,-97 276,-97 L376,-92 Q394,-91 398,-82 L400,-40 Q400,-30 392,-28 ' +
      'L351.95,-28 A38 38 0 1 0 276.05,-28 L111.95,-28 A38 38 0 1 0 36.05,-28 L12,-28 Q4,-28 4,-30 Z',
    glass: 'M74,-100 L98,-130 Q102,-134 110,-134 L204,-134 Q210,-134 214,-130 L256,-100 Z',
    helmet: [190, -118], pipe: [-2, -20], trim: '#dfe2e6',
  },
  tuner: {
    len: 446, wheels: [95, 346], arch: 40, chord: -22, horizon: -70, rim: 'multi', rimRatio: 0.74, caliper: '#d81e1e',
    body: 'M6,-26 Q0,-28 0,-40 L2,-62 Q4,-84 14,-94 Q60,-102 92,-104 C130,-108 160,-128 182,-133 ' +
      'Q214,-139 240,-134 C262,-130 286,-112 312,-98 C350,-88 400,-80 432,-70 Q446,-64 446,-52 Q446,-30 432,-24 ' +
      'L384.73,-22 A40 40 0 1 0 307.27,-22 L133.73,-22 A40 40 0 1 0 56.27,-22 L18,-24 Q8,-24 6,-26 Z',
    glass: 'M150,-108 C165,-120 185,-128 205,-131 Q228,-134 240,-131 C256,-127 274,-114 294,-101 Z',
    helmet: [224, -116], pipe: [-8, -21], trim: '#101014', neon: '#33e6ff',
  },
};

const shapeOf = (car) => SHAPES[car.shape];
const rrect = (g, x, y, w, h, r) => (g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h));
export const carLength = (car) => shapeOf(car).len / 100;
export const wheelX = (car) => shapeOf(car).wheels.map((x) => x / 100);
const wheelR = (car, i) => car.tire * 100 * (i ? shapeOf(car).frontScale ?? 1 : shapeOf(car).rearScale ?? 1);

// --------------------------------------------------------------------------- per-car details
function chrome(g, x0, y0, x1, y1) {
  const cg = g.createLinearGradient(0, y0, 0, y1);
  cg.addColorStop(0, '#9aa0a8'); cg.addColorStop(0.45, '#ffffff'); cg.addColorStop(0.55, '#c9cdd3'); cg.addColorStop(1, '#6f747c');
  return cg;
}

const DETAILS = {
  muscle(g, car, col, px) {
    // racing stripes
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(0, -62, 480, 5); g.fillRect(0, -54.5, 480, 2);
    // hood scoop
    g.fillStyle = shade(col, -0.25);
    g.fill(P('M338,-97 Q350,-108 372,-108 L396,-108 Q401,-108 402,-97 Z'));
    g.fillStyle = '#0b0b0d'; g.fill(P('M395,-106 L401,-106 L402,-98 L395,-98 Z'));
    // door gaps + handle + mirror + fuel cap
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = px;
    g.stroke(P('M180,-102 L178,-31 M300,-101 Q306,-64 300,-30'));
    g.fillStyle = chrome(g, 0, -88, 0, -84); g.fillRect(278, -88, 15, 3.5);
    g.fillStyle = '#c9cdd3'; g.fill(P('M294,-103 L304,-112 L313,-112 L313,-106 L301,-103 Z'));
    g.beginPath(); g.arc(40, -86, 4, 0, 7); g.fillStyle = chrome(g, 0, -90, 0, -82); g.fill();
    // grille, headlight, markers
    g.fillStyle = '#0b0b0d'; g.fillRect(474.5, -86, 3, 38);
    g.fillStyle = '#fff4c8'; g.beginPath(); g.ellipse(476, -76, 2.6, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#ff9d1a'; g.fillRect(452, -64, 7, 4);
    g.fillStyle = '#c4141c'; g.fillRect(12, -64, 7, 4);
    g.fillStyle = '#b3121b'; g.fillRect(1.5, -86, 4, 18);
    // bumpers + exhaust tip
    g.fillStyle = chrome(g, 0, -48, 0, -34);
    g.fill(P('M464,-48 L480,-48 L480,-39 Q479,-34 471,-34 L464,-34 Z M-2,-48 L12,-48 L12,-34 L3,-34 Q-2,-35 -2,-40 Z'));
    g.fillStyle = chrome(g, 0, -24, 0, -18); g.fillRect(-6, -24, 14, 5.5);
  },

  rod(g, car, col, px) {
    // flames licking back from the grille
    const fl = g.createLinearGradient(362, 0, 200, 0);
    fl.addColorStop(0, '#fff07a'); fl.addColorStop(0.35, '#ffb21a'); fl.addColorStop(0.7, '#ff5a14'); fl.addColorStop(1, '#c8160f');
    g.fillStyle = fl;
    const flame = P('M362,-113 L300,-115 C276,-114 258,-112 236,-118 C252,-108 266,-106 284,-106 C262,-100 240,-100 222,-104 ' +
      'C238,-94 258,-91 278,-93 C256,-86 238,-84 220,-88 C236,-78 260,-76 282,-80 C268,-72 254,-68 238,-70 ' +
      'C256,-62 280,-64 300,-70 C312,-66 330,-62 362,-62 Z');
    g.fill(flame);
    g.strokeStyle = 'rgba(120,10,0,0.7)'; g.lineWidth = px; g.stroke(flame);
    // hood side louvers
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
      const x = 268 + i * 13 - r * 4, y = -104 + r * 10;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 9, 2.4);
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x, y + 2.4, 9, 0.9);
    }
    // cowl / door gaps, handle
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = px;
    g.stroke(P('M215,-121 L218,-60 M154,-150 L154,-56 M211,-126 L214,-58'));
    g.fillStyle = chrome(g, 0, -114, 0, -110); g.fillRect(190, -114, 12, 3);
    // tail light (blue dot)
    g.beginPath(); g.arc(9, -74, 4.5, 0, 7); g.fillStyle = '#c4141c'; g.fill();
    g.beginPath(); g.arc(9, -74, 1.6, 0, 7); g.fillStyle = '#3a6dff'; g.fill();
  },

  // rails, axle and headers are drawn outside the body clip for the fenderless rod
  rodChassis(g) {
    g.fillStyle = '#18181c'; g.fillRect(16, -58, 372, 10);
    g.strokeStyle = '#26262b'; g.lineWidth = 5; g.beginPath(); g.moveTo(345, -26); g.lineTo(345, -52); g.stroke();
    g.fillStyle = '#26262b'; g.beginPath(); g.ellipse(345, -52, 22, 3.5, 0, 0, 7); g.fill();
  },
  rodFront(g) {
    // grille shell + bars
    g.fillStyle = chrome(g, 0, -122, 0, -60);
    g.fill(P('M359,-118 Q359,-123 366,-123 L384,-123 Q391,-123 390,-116 L382,-64 Q381,-59 374,-59 L364,-59 Q359,-59 359,-64 Z'));
    g.fillStyle = '#121214'; g.fill(P('M363,-118 L386,-118 L378,-64 L363,-64 Z'));
    g.strokeStyle = '#c9cdd3'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(366 + i * 3.6, -117); g.lineTo(365 + i * 2.4, -65); g.stroke(); }
    // headlight bucket on its stalk
    g.strokeStyle = '#2a2a30'; g.lineWidth = 3; g.beginPath(); g.moveTo(392, -94); g.lineTo(380, -62); g.stroke();
    g.beginPath(); g.arc(398, -100, 9, 0, 7); g.fillStyle = chrome(g, 0, -109, 0, -91); g.fill();
    g.beginPath(); g.arc(400, -100, 5.5, 0, 7); g.fillStyle = '#fff4c8'; g.fill();
  },
  rodHeaders(g) {
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = i % 2 ? '#c9cdd3' : '#f2f3f5'; g.lineWidth = 3.6;
      g.beginPath(); g.moveTo(318 - i * 9, -88 + i * 2);
      g.bezierCurveTo(300 - i * 9, -60, 280, -54 + i * 1.5, 250, -54 + i * 1.5);
      g.lineTo(118, -51 + i * 0.8); g.stroke();
    }
    g.fillStyle = '#2a2a30'; g.fillRect(114, -56, 6, 10);
  },

  compact(g, car, col, px) {
    // rally stripes + roundel
    g.fillStyle = '#111'; g.fillRect(0, -48, 410, 4); g.fillRect(0, -42, 410, 1.6);
    g.beginPath(); g.arc(186, -70, 17, 0, 7); g.fillStyle = '#f7f7f2'; g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#111'; g.font = `19px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('71', 186, -69);
    // gaps, handle, filler
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = px;
    g.stroke(P('M150,-100 L148,-30 M258,-98 Q264,-64 258,-30'));
    g.fillStyle = chrome(g, 0, -90, 0, -86); g.fillRect(236, -90, 13, 3.2);
    g.beginPath(); g.arc(56, -84, 3.5, 0, 7); g.fillStyle = chrome(g, 0, -88, 0, -80); g.fill();
    // lights + bumpers
    g.fillStyle = '#fff4c8'; g.beginPath(); g.ellipse(398.5, -70, 2.2, 7.5, 0, 0, 7); g.fill();
    g.fillStyle = '#ff9d1a'; g.fillRect(388, -58, 6, 4);
    g.fillStyle = '#b3121b'; g.fillRect(1.5, -86, 4, 16);
    g.fillStyle = chrome(g, 0, -46, 0, -36);
    g.fill(P('M390,-46 L404,-46 L404,-38 Q403,-35 398,-35 L390,-35 Z M-3,-46 L10,-46 L10,-35 L1,-35 Q-3,-36 -3,-40 Z'));
    g.fillStyle = chrome(g, 0, -23, 0, -17); g.fillRect(-5, -23, 12, 5);
  },
  compactFlares(g, car, col) {
    const sh = shapeOf(car);
    for (const [i, wx] of sh.wheels.entries()) {
      const cy = -wheelR(car, i);
      g.strokeStyle = shade(col, -0.3); g.lineWidth = 6;
      g.beginPath(); g.arc(wx, cy, sh.arch + 2.5, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(wx, cy, sh.arch + 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  },

  tuner(g, car, col, px) {
    // tribal decal
    g.fillStyle = car.decal ?? '#1838b8';
    const d = P('M60,-58 C120,-74 170,-58 230,-72 L214,-63 L262,-74 L246,-65 L300,-76 L282,-65 C340,-72 380,-68 412,-60 ' +
      'C362,-60 322,-56 282,-54 L298,-47 L252,-51 L264,-44 L210,-49 C170,-47 110,-60 60,-58 Z');
    g.fill(d);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = px * 1.2; g.stroke(d);
    // skirt + side intake
    g.fillStyle = shade(col, -0.6); g.fillRect(0, -36, 450, 14);
    g.fillStyle = '#0c0c0f'; g.fill(P('M150,-80 L184,-84 L186,-72 L156,-70 Z'));
    // gaps, handle, mirror
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = px;
    g.stroke(P('M196,-104 Q190,-70 194,-36 M304,-98 Q312,-70 306,-36'));
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(278, -86, 14, 3);
    g.fillStyle = shade(col, -0.15); g.fill(P('M292,-102 L302,-110 L312,-109 L311,-103 L299,-100 Z'));
    // headlight + tail
    const hl = g.createLinearGradient(404, -82, 440, -66);
    hl.addColorStop(0, '#9fb3c4'); hl.addColorStop(0.5, '#ffffff'); hl.addColorStop(1, '#c6d6e4');
    g.fillStyle = hl; g.fill(P('M402,-80 L436,-71 Q442,-69 440,-65 L406,-73 Z'));
    g.fillStyle = '#c4141c'; g.fillRect(0, -86, 7, 14);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, -72, 7, 3);
  },
  tunerWing(g, car, col) {
    g.fillStyle = '#141418';
    g.fillRect(26, -122, 4, 26); g.fillRect(70, -124, 4, 23);
    g.fill(P('M-10,-132 L-3,-132 L-3,-112 L-10,-112 Z'));
    g.fillStyle = shade(col, -0.15);
    const w = P('M-8,-121 Q30,-132 88,-127 L88,-121 Q30,-121 -8,-116 Z');
    g.fill(w); g.strokeStyle = '#0c0c10'; g.lineWidth = 1; g.stroke(w);
  },
};

// --------------------------------------------------------------------------- body sprite
const PAD = 24, TOP = 175;
const bodies = new Map();

function paint(g, sh, col) {
  // polished paint: bright sky band above a dark "horizon" line, falling to a dark rocker
  const y0 = -160, span = 160, at = (y) => clamp((y - y0) / span, 0, 1);
  const bg = g.createLinearGradient(0, y0, 0, 0);
  bg.addColorStop(0, shade(col, 0.55));
  bg.addColorStop(at(sh.horizon - 26), shade(col, 0.22));
  bg.addColorStop(at(sh.horizon - 6), shade(col, 0.4));
  bg.addColorStop(at(sh.horizon - 0.5), shade(col, 0.08));
  bg.addColorStop(at(sh.horizon + 0.5), shade(col, -0.18));
  bg.addColorStop(at(sh.horizon + 18), col);
  bg.addColorStop(at(-28), shade(col, -0.35));
  bg.addColorStop(1, shade(col, -0.6));
  return bg;
}

function buildBody(car, pxPerCm) {
  const sh = shapeOf(car), col = car.color;
  const w = Math.ceil((sh.len + PAD * 2) * pxPerCm), h = Math.ceil((TOP + PAD) * pxPerCm);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.scale(pxPerCm, pxPerCm); g.translate(PAD, TOP);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const px = 1 / pxPerCm; // one device pixel in cm
  const body = P(sh.body), glass = P(sh.glass);

  // wheel wells (only the part above the arch chord shows)
  if (sh.arch) {
    g.save(); g.beginPath(); g.rect(-PAD, -TOP, sh.len + PAD * 2, TOP + sh.chord); g.clip();
    for (const [i, wx] of sh.wheels.entries()) {
      const wg = g.createRadialGradient(wx, -wheelR(car, i), sh.arch * 0.6, wx, -wheelR(car, i), sh.arch);
      wg.addColorStop(0, '#050506'); wg.addColorStop(1, '#1d1d22');
      g.fillStyle = wg; g.beginPath(); g.arc(wx, -wheelR(car, i), sh.arch - 0.5, 0, 7); g.fill();
    }
    g.restore();
  }
  if (sh.fenderless) DETAILS.rodChassis(g);

  // body
  g.fillStyle = paint(g, sh, col); g.fill(body);
  g.save(); g.clip(body);
  DETAILS[car.shape](g, car, col, px);
  // rocker shadow and arch-lip depth
  const rk = g.createLinearGradient(0, -40, 0, 0);
  rk.addColorStop(0, 'rgba(0,0,0,0)'); rk.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = rk; g.fillRect(-PAD, -40, sh.len + PAD * 2, 40);
  if (sh.arch) {
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 5;
    for (const [i, wx] of sh.wheels.entries()) { g.beginPath(); g.arc(wx, -wheelR(car, i), sh.arch + 2, 0, 7); g.stroke(); }
  }
  // shoulder highlight just above the horizon line
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.2 * px;
  g.beginPath(); g.moveTo(8, sh.horizon - 3); g.lineTo(sh.len - 10, sh.horizon - 1); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(8,8,12,0.9)'; g.lineWidth = 1.7 * px; g.stroke(body);

  // glass: tint, interior, driver in a helmet, reflection, trim
  const gg = g.createLinearGradient(0, -150, 0, -100);
  gg.addColorStop(0, '#2e4352'); gg.addColorStop(1, '#141c24');
  g.fillStyle = gg; g.fill(glass);
  g.save(); g.clip(glass);
  const [hx, hy] = sh.helmet;
  g.fillStyle = '#0b0e12'; g.beginPath(); rrect(g, hx - 30, hy - 12, 12, 34, 4); g.fill();
  const hc = car.helmet ?? '#c9ccd2';
  g.fillStyle = '#15181d'; g.beginPath(); g.ellipse(hx - 2, hy + 16, 15, 9, 0, 0, 7); g.fill(); // shoulders
  const hg = g.createLinearGradient(hx - 9, hy - 10, hx + 6, hy + 9);
  hg.addColorStop(0, shade(hc, 0.45)); hg.addColorStop(0.5, hc); hg.addColorStop(1, shade(hc, -0.45));
  g.fillStyle = hg; g.beginPath(); g.arc(hx, hy + 2, 9, 0, 7); g.fill();
  g.fillStyle = '#0a0d12'; g.beginPath(); g.moveTo(hx + 1, hy - 3); g.lineTo(hx + 9.2, hy - 3);
  g.quadraticCurveTo(hx + 10, hy + 3, hx + 7.5, hy + 6); g.lineTo(hx + 1, hy + 6); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(hx + 2, hy - 2, 5, 1.2);
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath(); g.moveTo(hx - 70, -100); g.lineTo(hx - 40, -160); g.lineTo(hx - 22, -160); g.lineTo(hx - 52, -100); g.fill();
  g.beginPath(); g.moveTo(hx + 10, -100); g.lineTo(hx + 40, -160); g.lineTo(hx + 46, -160); g.lineTo(hx + 16, -100); g.fill();
  g.restore();
  g.strokeStyle = sh.trim; g.lineWidth = 1.6 * px; g.stroke(glass);

  if (car.shape === 'compact') DETAILS.compactFlares(g, car, col);
  if (car.shape === 'tuner') DETAILS.tunerWing(g, car, col);
  if (sh.fenderless) { DETAILS.rodFront(g); DETAILS.rodHeaders(g); }
  return c;
}

function bodySprite(car, pxPerCm) {
  const key = `${car.id}:${car.color}:${pxPerCm.toFixed(3)}`;
  let s = bodies.get(key);
  if (!s) {
    if (bodies.size > 24) bodies.clear();
    s = buildBody(car, pxPerCm); bodies.set(key, s);
  }
  return s;
}

// --------------------------------------------------------------------------- wheels
const wheels = new Map();

function textOnArc(g, str, r, mid, size) {
  g.font = `${size}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = (size * 0.78) / r;
  let a = mid - (step * (str.length - 1)) / 2;
  for (const ch of str) {
    g.save(); g.rotate(a); g.translate(0, -r); g.fillText(ch, 0, 0); g.restore();
    a += step;
  }
}

function buildWheel(sh, car, rPx) {
  const R = rPx * sh.rimRatio, size = Math.ceil(rPx * 2 + 4), c0 = size / 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.translate(c0, c0); return [c, g]; };

  // static: tire, barrel, brake
  const [base, b] = mk();
  const tg = b.createRadialGradient(0, 0, R, 0, 0, rPx);
  tg.addColorStop(0, '#09090a'); tg.addColorStop(0.55, '#26262a'); tg.addColorStop(0.85, '#18181b'); tg.addColorStop(1, '#0a0a0b');
  b.fillStyle = tg; b.beginPath(); b.arc(0, 0, rPx, 0, 7); b.fill();
  b.strokeStyle = 'rgba(255,255,255,0.08)'; b.lineWidth = rPx * 0.04;
  b.beginPath(); b.arc(0, 0, rPx * 0.93, Math.PI * 1.1, Math.PI * 1.6); b.stroke();
  b.fillStyle = '#121214'; b.beginPath(); b.arc(0, 0, R, 0, 7); b.fill();
  if (sh.rim !== 'steel') {
    const dg = b.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 0.8);
    dg.addColorStop(0, '#5f6268'); dg.addColorStop(1, '#8c9096');
    b.fillStyle = dg; b.beginPath(); b.arc(0, 0, R * 0.8, 0, 7); b.fill();
    b.fillStyle = '#2a2b2f'; b.beginPath(); b.arc(0, 0, R * 0.3, 0, 7); b.fill();
    if (sh.caliper) {
      b.strokeStyle = sh.caliper; b.lineWidth = R * 0.24; b.lineCap = 'round';
      b.beginPath(); b.arc(0, 0, R * 0.64, -1.35, -0.6); b.stroke();
    }
  }

  // rotating: rim face (+ sidewall lettering)
  const [spin, g] = mk();
  const chromeDisc = (r0, r1, a = '#ffffff', m = '#c3c7cd', z = '#80858d') => {
    const cg = g.createRadialGradient(-r1 * 0.3, -r1 * 0.35, r1 * 0.05, 0, 0, r1);
    cg.addColorStop(0, a); cg.addColorStop(0.6, m); cg.addColorStop(1, z);
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r1, 0, 7); if (r0) g.arc(0, 0, r0, 0, 7, true); g.fill('evenodd');
  };
  const cut = (fn) => { g.save(); g.globalCompositeOperation = 'destination-out'; fn(); g.restore(); };
  const lugs = (n, r, s, col = '#9ea3aa') => { g.fillStyle = col; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, s, 0, 7); g.fill(); } };

  if (sh.rim === 'slot') {
    chromeDisc(0, R);
    cut(() => {
      for (let k = 0; k < 5; k++) {
        g.save(); g.rotate((k / 5) * Math.PI * 2);
        g.beginPath(); rrect(g, R * 0.36, -R * 0.12, R * 0.48, R * 0.24, R * 0.12);
        g.fill(); g.restore();
      }
    });
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, R * 0.03);
    for (let k = 0; k < 5; k++) {
      g.save(); g.rotate((k / 5) * Math.PI * 2);
      g.beginPath(); rrect(g, R * 0.36, -R * 0.12, R * 0.48, R * 0.24, R * 0.12); g.stroke(); g.restore();
    }
    g.strokeStyle = '#f4f5f7'; g.lineWidth = R * 0.07; g.beginPath(); g.arc(0, 0, R * 0.95, 0, 7); g.stroke();
    chromeDisc(0, R * 0.26); lugs(5, R * 0.17, R * 0.03, '#6d7178');
  } else if (sh.rim === 'steel') {
    const sg = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    sg.addColorStop(0, '#f0443a'); sg.addColorStop(1, '#a1150f');
    g.fillStyle = sg; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    cut(() => { for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, R * 0.07, 0, 7); g.fill(); } });
    chromeDisc(R * 0.8, R);
    chromeDisc(0, R * 0.5);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-R * 0.15, -R * 0.2, R * 0.16, R * 0.07, -0.6, 0, 7); g.fill();
  } else if (sh.rim === 'minilite') {
    const mg = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    mg.addColorStop(0, '#9a9ea6'); mg.addColorStop(1, '#4a4e55');
    g.fillStyle = mg; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    cut(() => {
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2 + 0.13, a1 = ((k + 1) / 8) * Math.PI * 2 - 0.13;
        g.beginPath(); g.arc(0, 0, R * 0.82, a0, a1); g.arc(0, 0, R * 0.36, a1 - 0.12, a0 + 0.12, true); g.closePath(); g.fill();
      }
    });
    chromeDisc(R * 0.86, R, '#f6f7f8', '#c9ccd1', '#8a8e95');
    g.fillStyle = '#26282c'; g.beginPath(); g.arc(0, 0, R * 0.24, 0, 7); g.fill();
    lugs(4, R * 0.16, R * 0.035, '#b8bcc2');
  } else if (sh.rim === 'multi') {
    chromeDisc(R * 0.84, R);
    g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      for (const off of [-0.075, 0.075]) {
        const a = (k / 6) * Math.PI * 2 + off;
        g.strokeStyle = '#3a3d42'; g.lineWidth = R * 0.1;
        g.beginPath(); g.moveTo(Math.cos(a - off) * R * 0.2, Math.sin(a - off) * R * 0.2); g.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); g.stroke();
        g.strokeStyle = '#e9ebee'; g.lineWidth = R * 0.06;
        g.beginPath(); g.moveTo(Math.cos(a - off) * R * 0.2, Math.sin(a - off) * R * 0.2); g.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); g.stroke();
      }
    }
    chromeDisc(0, R * 0.24); lugs(5, R * 0.15, R * 0.028, '#5b5f66');
  }
  if (sh.letters) {
    g.fillStyle = 'rgba(245,245,240,0.92)';
    const rr = (R + rPx) / 2;
    textOnArc(g, sh.letters, rr, 0, (rPx - R) * 0.5);
    textOnArc(g, sh.letters, rr, Math.PI, (rPx - R) * 0.5);
  }
  return { base, spin, size };
}

function wheelSprite(car, i, rPx) {
  const original = shapeOf(car);
  const sh = car.rim && car.rim !== 'stock' ? { ...original, rim: car.rim } : original;
  const key = `${car.shape}:${sh.rim}:${i}:${rPx.toFixed(2)}`;
  let w = wheels.get(key);
  if (!w) { if (wheels.size > 48) wheels.clear(); w = buildWheel(sh, car, rPx); wheels.set(key, w); }
  return w;
}

function drawWheel(ctx, car, i, x, y, rL, dev, angle, omega) {
  const w = wheelSprite(car, i, rL * dev);
  const s = w.size / dev;
  ctx.drawImage(w.base, x - s / 2, y - s / 2, s, s);
  // rotational blur: spread copies over the angle travelled in one frame
  const inheritedAlpha = ctx.globalAlpha;
  const spread = clamp(Math.abs(omega) / 60, 0, 1.2);
  const n = spread < 0.03 ? 1 : 6;
  ctx.save(); ctx.translate(x, y);
  for (let k = 0; k < n; k++) {
    ctx.save();
    ctx.rotate(angle - (n > 1 ? (spread * k) / (n - 1) : 0) * Math.sign(omega || 1));
    ctx.globalAlpha = inheritedAlpha * (n > 1 ? 1 / (k + 1) : 1);
    ctx.drawImage(w.spin, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
  ctx.restore();
}

// --------------------------------------------------------------------------- public draw
// sx = rear bumper screen x, groundY = road surface. opts: { ppm, angle, omega, pitch, nitro, pop, line }
export function drawCar(ctx, car, sx, groundY, opts = {}) {
  const sh = shapeOf(car);
  const ppm = opts.ppm ?? 50, k = ppm / 100; // logical px per cm
  const T = ctx.getTransform(), dev = Math.hypot(T.a, T.b) || 1;
  const rr = wheelR(car, 0), rf = wheelR(car, 1);

  if (opts.line) {
    ctx.save();
    ctx.translate(sx, groundY); ctx.scale(k, k);
    ctx.strokeStyle = opts.line; ctx.lineWidth = 1.2 / k; ctx.lineJoin = 'round';
    ctx.stroke(P(sh.body)); ctx.stroke(P(sh.glass));
    sh.wheels.forEach((wx, i) => {
      const r = i ? rf : rr;
      for (const f of [1, sh.rimRatio, 0.22]) { ctx.beginPath(); ctx.arc(wx, -r, r * f, 0, 7); ctx.stroke(); }
    });
    ctx.restore();
    return;
  }

  // ground shadow + tuner underglow
  ctx.save();
  ctx.translate(sx + (sh.len * k) / 2, groundY);
  ctx.scale(sh.len * k * 0.6, 0.16 * ppm);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill();
  if (sh.neon) {
    const ng = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    ng.addColorStop(0, sh.neon); ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55; ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, -0.2, 0.95, 0, 7); ctx.fill();
  }
  ctx.restore();

  // body, pitched about the rear axle
  const sprite = bodySprite(car, (ppm * dev) / 100);
  ctx.save();
  const ax = sx + sh.wheels[0] * k, ay = groundY - rr * k;
  ctx.translate(ax, ay); ctx.rotate(-(opts.pitch ?? 0)); ctx.translate(-ax, -ay);
  ctx.drawImage(sprite, sx - PAD * k, groundY - TOP * k, sprite.width / dev, sprite.height / dev);

  // exhaust flames: blue on nitrous, orange crackle on the limiter
  if (opts.nitro || opts.pop) {
    const [pxc, pyc] = sh.pipe;
    const x = sx + pxc * k, y = groundY + pyc * k;
    const L = (opts.nitro ? 55 + Math.random() * 35 : 18 + Math.random() * 22) * k;
    const fg = ctx.createLinearGradient(x, 0, x - L, 0);
    if (opts.nitro) { fg.addColorStop(0, '#eaf7ff'); fg.addColorStop(0.3, '#4aa8ff'); fg.addColorStop(1, 'rgba(40,80,255,0)'); }
    else { fg.addColorStop(0, '#fff3c0'); fg.addColorStop(0.4, '#ff8a1c'); fg.addColorStop(1, 'rgba(255,60,0,0)'); }
    ctx.fillStyle = fg;
    const hh = (opts.nitro ? 6 : 4.5) * k;
    ctx.beginPath(); ctx.moveTo(x, y - hh); ctx.quadraticCurveTo(x - L * 0.5, y - hh * 1.4, x - L, y); ctx.quadraticCurveTo(x - L * 0.5, y + hh * 1.4, x, y + hh); ctx.fill();
  }
  ctx.restore();

  // wheels stay planted while the body pitches
  const ang = opts.angle ?? 0, om = opts.omega ?? 0;
  drawWheel(ctx, car, 0, sx + sh.wheels[0] * k, groundY - rr * k, rr * k, dev, ang, om);
  drawWheel(ctx, car, 1, sx + sh.wheels[1] * k, groundY - rf * k, rf * k, dev, (ang * rr) / rf, (om * rr) / rf);
}
