// Shared drawing helpers. Logical canvas is 960x540; offscreen caches render at 2x.
export const W = 960, H = 540;
export const CACHE_SCALE = 2;
export const DISPLAY = '"Russo One", Impact, "Arial Black", sans-serif';
export const MONO = '"Share Tech Mono", ui-monospace, Consolas, monospace';
export const SANS = '"Chakra Petch", "Segoe UI", system-ui, sans-serif';

export function makeCanvas(w, h, scale = CACHE_SCALE) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  c.lw = w; c.lh = h;
  return [c, g];
}

// Seeded RNG so cached art is identical every load.
export function rng(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// Mix a #rrggbb colour toward white (amt > 0) or black (amt < 0).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

// Closed polygon with a per-corner radius: points are [x, y, radius].
export function roundPoly(ctx, pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m = mid(p, q);
    if (p[2]) ctx.arcTo(p[0], p[1], m[0], m[1], p[2]);
    else ctx.lineTo(p[0], p[1]);
    ctx.lineTo(m[0], m[1]);
  }
  ctx.closePath();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

// Horizontal motion-blurred copy of a tiling canvas (uniform box average).
export function blurX(src, px, steps = 12) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  const d = px * CACHE_SCALE;
  for (let i = 0; i < steps; i++) {
    g.globalAlpha = 1 / (i + 1);
    const o = (d * i) / steps;
    g.drawImage(src, -o, 0);
    g.drawImage(src, src.width - o, 0);
  }
  c.lw = src.lw; c.lh = src.lh;
  return c;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mod = (a, n) => ((a % n) + n) % n;
export const lerp = (a, b, t) => a + (b - a) * t;

export function text(ctx, str, x, y, { font, color = '#fff', align = 'center', base = 'middle', shadow } = {}) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = base;
  if (shadow) { ctx.fillStyle = shadow; ctx.fillText(str, x + 2, y + 2); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
