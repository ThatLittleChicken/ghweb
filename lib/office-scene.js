// <office-scene> — a home office seen from inside the room.
//
// Built from scratch with three.js r184 and nothing downloaded: every mesh,
// texture, screen and the painting on the wall is generated on load. Light is
// physically motivated rather than decorative:
//   day   — low afternoon sun through a steel-framed window (shadow-mapped),
//           sky light from the window (a rect area light), and an environment
//           probe rendered from inside this very room for the warm bounce
//   night — the desk lamp (spot, shadowed) is the key light, the monitor and
//           the window act as area lights, with a dim floor lamp, moonlight
//           and a cool ambient fill so the room still reads
// Post: GTAO contact shading (half resolution), bloom at night only, SMAA,
// then one pass for AgX tone mapping and the grade (grain, vignette). The
// monitor's code and network panel are their own small texture layers.
//
// The framed picture on the back wall is painted fresh every time the scene
// appears (each page load, and each return to the page): a seeded window on
// {Shan, Shui}* by Lingdong Huang (MIT, github.com/LingDong-/shan-shui-inf),
// generated in a Web Worker by ./shan-shui.js. Where workers or OffscreenCanvas
// are missing, a generated contour print hangs instead.
//
// When the element leaves the page (client-side navigation), the scene is
// paused and kept for a few minutes rather than torn down, and the next
// <office-scene> to connect takes it over: no second WebGL context, no second
// start-up stall, and the next painting is already being prepared.
//
// Attributes:  dark="0|1"  framing="corner|desk|room"  (optional: fps, lite)
// Sets data-rendered once the first frame is on screen (data-error if WebGL
// could not start, so a page loader never waits on it).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { paintShanShui, randomSeed, shanShuiSupported } from './shan-shui.js';

/* ======================================================================
   Layout (metres). x: left → right, y: up, z: back wall (−) → camera (+)
   ====================================================================== */
const X0 = -2.2, X1 = 2.2, Z0 = -2.7, Z1 = 2.7, H = 2.75, T = 0.2;
// window opening in the right wall, near the back corner
const WIN = { z0: -2.58, z1: -0.98, y0: 0.88, y1: 2.38, cols: 3, rows: 4, frameX: X1 + 0.085 };
const DESK = { x0: 0.46, x1: 2.1, z0: Z0 + 0.03, z1: Z0 + 0.03 + 0.72, top: 0.745, th: 0.032 };
const D2R = Math.PI / 180;
// direction *toward* the sun: low afternoon light raking in from the right
const sunToward = (elev, az) => new THREE.Vector3(Math.cos(elev * D2R) * Math.cos(az * D2R), Math.sin(elev * D2R), Math.cos(elev * D2R) * Math.sin(az * D2R)).normalize();
const SUN = sunToward(27, 20);
const MOON_VIEW = new THREE.Vector3(0.82, 0.3, -0.5).normalize(); // where the moon hangs in the window

// camera framings. Level camera (two-point perspective) + lens shift, the
// way architectural photographers keep verticals straight.
const FRAMINGS = {
  corner: { pos: [-0.8, 1.28, 1.15], yaw: 29, fov: 44, shift: [0.23, 0.035] },
  desk: { pos: [0.1, 1.2, 0.15], yaw: 33, fov: 46, shift: [0.2, 0.05] },
  room: { pos: [-1.6, 1.38, 2.3], yaw: 27, fov: 50, shift: [0.2, 0.025] },
  // phones: aimed at the desk (window to the right), sitting low in the frame
  // where the hero's mask lets the room show
  portrait: { pos: [-0.25, 1.27, 0.95], yaw: 26, fov: 61, shift: [0.0, 0.0] },
};

/* ======================================================================
   Small utilities: seeded RNG, Perlin noise, colour
   ====================================================================== */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function perlin(seed) {
  const r = rng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint16Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const wrap = (v, per) => (per ? ((v % per) + per) % per : v);
  // (x, y, period) → ~[-1, 1]; tileable when period > 0
  return (x, y, per = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = wrap(xi, per) & 255, x1 = wrap(xi + 1, per) & 255;
    const y0 = wrap(yi, per) & 255, y1 = wrap(yi + 1, per) & 255;
    const h00 = perm[x0 + perm[y0]], h10 = perm[x1 + perm[y0]], h01 = perm[x0 + perm[y1]], h11 = perm[x1 + perm[y1]];
    const n00 = gx[h00] * xf + gy[h00] * yf;
    const n10 = gx[h10] * (xf - 1) + gy[h10] * yf;
    const n01 = gx[h01] * xf + gy[h01] * (yf - 1);
    const n11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
    const u = fade(xf), v = fade(yf);
    const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
    return (a + v * (b - a)) * 1.414;
  };
}
const fbm = (n, x, y, oct = 4, per = 0) => {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, per ? per * f : 0); f *= 2; a *= 0.5; }
  return s;
};
const hexRGB = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }; // linear
const srgb = (h) => { const c = new THREE.Color(h); c.convertLinearToSRGB(); return [c.r * 255, c.g * 255, c.b * 255]; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { srgbColor = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgbColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/* ======================================================================
   Procedural textures
   ====================================================================== */
// Oak boards: flat-sawn ring figure (cathedrals), pores, per-board tone, gaps.
// Boards run along the texture's v axis.
function oakBoards({ size = 1024, metres = 2.0, boardW = 0.19, seed = 7, joints = true, light = '#dcb98f', dark = '#b38a5f', gap = 0.55 }) {
  const n = perlin(seed), r = rng(seed * 31 + 5);
  const [c, g] = canvas(size, size);
  const [cr, gr] = canvas(size, size);
  const img = g.createImageData(size, size), rimg = gr.createImageData(size, size);
  const L = srgb(light), Dk = srgb(dark);
  const cols = Math.round(metres / boardW);
  const bw = metres / cols;
  // per column: cut points along the board length (tileable), per board params
  const columns = [];
  for (let i = 0; i < cols; i++) {
    const cuts = [];
    if (joints) {
      let y = r() * metres;
      const k = 1 + Math.floor(r() * 2);
      for (let j = 0; j < k; j++) { cuts.push(y % metres); y += metres / k * (0.7 + r() * 0.6); }
      cuts.sort((a, b) => a - b);
    }
    const boards = [];
    const nb = Math.max(1, cuts.length);
    for (let j = 0; j < nb; j++) boards.push({ tone: r(), ring: 18 + r() * 22, cx: (r() - 0.5) * bw * 3, z0: 0.02 + r() * 0.1, slope: (r() - 0.5) * 0.05, s: r() * 100, hue: (r() - 0.5) * 0.06 });
    columns.push({ cuts, boards });
  }
  for (let py = 0; py < size; py++) {
    const Y = (py / size) * metres;
    for (let px = 0; px < size; px++) {
      const X = (px / size) * metres;
      const ci = Math.min(cols - 1, Math.floor(X / bw));
      const col = columns[ci];
      const lx = X - ci * bw; // 0..bw across the board
      let bi = 0, edgeY = 1e9;
      if (col.cuts.length) {
        bi = col.cuts.length - 1;
        for (let k = 0; k < col.cuts.length; k++) if (Y >= col.cuts[k]) bi = k;
        if (Y < col.cuts[0]) bi = col.cuts.length - 1;
        for (const cy of col.cuts) edgeY = Math.min(edgeY, Math.abs(Y - cy), Math.abs(Y - cy - metres), Math.abs(Y - cy + metres));
      }
      const b = col.boards[bi % col.boards.length];
      // ring figure: rings of a log sliced by a slightly tilted plane
      const warp = 0.006 * n(X * 9 + b.s, Y * 1.2, 0) + 0.0025 * n(X * 30, Y * 4 + b.s, 0);
      const d = lx - bw / 2 - b.cx + warp;
      const zz = b.z0 + Y * b.slope;
      const R = Math.sqrt(d * d * 1.0 + zz * zz) * b.ring * 10;
      const fr = R - Math.floor(R);
      const late = Math.pow(1 - Math.min(1, Math.abs(fr - 0.82) / 0.18), 2.2); // thin dark latewood
      const pores = Math.max(0, n(X * 380, Y * 18 + b.s, 0)) * 0.5 + Math.max(0, n(X * 90 + b.s, Y * 3, 0)) * 0.35;
      const flecks = Math.max(0, n(X * 60 + b.s, Y * 140, 0) - 0.35) * 1.5;
      let t = clamp01(b.tone * 0.75 + 0.12 + 0.08 * n(X * 3 + b.s, Y * 0.5, 0));
      let cr0 = lerp(L[0], Dk[0], t), cg0 = lerp(L[1], Dk[1], t), cb0 = lerp(L[2], Dk[2], t);
      cr0 *= 1 + b.hue; cb0 *= 1 - b.hue;
      const dark = 1 - late * 0.22 - pores * 0.07 + flecks * 0.05;
      // board edges: hairline gap + micro bevel shading
      const ex = Math.min(lx, bw - lx), ey = edgeY;
      const ed = Math.min(ex, ey);
      const gapK = ed < 0.0016 ? gap : ed < 0.004 ? 0.86 + 0.14 * (ed - 0.0016) / 0.0024 : 1;
      const k = dark * gapK;
      const o = (py * size + px) * 4;
      img.data[o] = cr0 * k; img.data[o + 1] = cg0 * k; img.data[o + 2] = cb0 * k; img.data[o + 3] = 255;
      const rough = (0.42 + 0.12 * b.tone + late * 0.06 + pores * 0.1 + (ed < 0.002 ? 0.4 : 0)) * 255;
      rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = Math.min(255, rough); rimg.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); gr.putImageData(rimg, 0, 0);
  return { map: c, rough: cr };
}

// Wool rug: oatmeal field with a hand-knotted diamond lattice and a fibre texture.
function rugCanvas(seed = 3, scale = 1) {
  const W = Math.round(1024 * scale), Hh = Math.round(768 * scale);
  const n = perlin(seed);
  const [c, g] = canvas(W, Hh);
  const img = g.createImageData(W, Hh);
  const base = srgb('#d8d0c2'), ink = srgb('#3a3835');
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / Hh;
    const fib = n(x * 0.9 / scale, y * 0.9 / scale, 0) * 0.5 + n(x * 0.23 / scale, y * 0.23 / scale, 0) * 0.5;
    const mott = n(u * 6, v * 5, 0) * 0.5;
    // lattice
    const wob = n(u * 5, v * 5 + 4, 0) * 0.05;
    const a = (u * 1.333 + v) * 2.5 + wob, b2 = (u * 1.333 - v) * 2.5 + wob * 0.8;
    const la = Math.abs(a - Math.round(a)), lb = Math.abs(b2 - Math.round(b2));
    const lw = 0.022 + 0.008 * n(u * 30, v * 30, 0);
    const line = Math.max(1 - smooth(lw, lw + 0.012, la), 1 - smooth(lw, lw + 0.012, lb));
    const broken = 0.75 + 0.25 * smooth(-0.4, 0.1, n(u * 18, v * 18, 0));
    // border bands
    const bd = Math.min(u, 1 - u, v * 0.75, (1 - v) * 0.75);
    const band = (bd > 0.035 && bd < 0.043) || (bd > 0.055 && bd < 0.06) ? 1 : 0;
    const inField = bd > 0.075 ? 1 : 0;
    const m = Math.min(1, line * broken * inField * 0.85 + band * 0.8);
    const shade = 1 + fib * 0.07 + mott * 0.05;
    const o = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) img.data[o + k] = lerp(base[k], ink[k], m) * shade;
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Topographic print (marching squares over a ridge field) for the wall.
function topoCanvas() {
  const W = 600, Hh = 800;
  const [c, g] = canvas(W, Hh);
  g.fillStyle = '#f2eee6'; g.fillRect(0, 0, W, Hh);
  const n = perlin(41);
  const GX = 150, GY = 170, x0 = 60, y0 = 60, cw = (W - 120) / GX, ch = (Hh - 200) / GY;
  const hgt = (i, j) => {
    const u = i / GX, v = j / GY;
    const ridge = 1 - Math.abs(n(u * 2.2 + 0.3, v * 2.0, 0));
    const peak = Math.exp(-((u - 0.55) ** 2 * 7 + (v - 0.42) ** 2 * 5));
    return ridge * 0.55 + peak * 0.9 + fbm(n, u * 4 + 9, v * 4, 4) * 0.35 - v * 0.25;
  };
  const F = [];
  for (let j = 0; j <= GY; j++) { F[j] = []; for (let i = 0; i <= GX; i++) F[j][i] = hgt(i, j); }
  const levels = 34, lo = -0.4, hi = 1.5;
  for (let L = 0; L < levels; L++) {
    const iso = lo + (hi - lo) * (L / levels);
    const major = L % 5 === 0;
    g.strokeStyle = major ? 'rgba(38,40,44,0.85)' : 'rgba(38,40,44,0.42)';
    g.lineWidth = major ? 1.3 : 0.7;
    g.beginPath();
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const a = F[j][i], b = F[j][i + 1], cc = F[j + 1][i + 1], d = F[j + 1][i];
      const pts = [];
      const edge = (p, q, va, vb) => { if ((va < iso) !== (vb < iso)) { const t = (iso - va) / (vb - va); pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } };
      edge([i, j], [i + 1, j], a, b); edge([i + 1, j], [i + 1, j + 1], b, cc);
      edge([i + 1, j + 1], [i, j + 1], cc, d); edge([i, j + 1], [i, j], d, a);
      for (let k = 0; k + 1 < pts.length; k += 2) {
        g.moveTo(x0 + pts[k][0] * cw, y0 + pts[k][1] * ch);
        g.lineTo(x0 + pts[k + 1][0] * cw, y0 + pts[k + 1][1] * ch);
      }
    }
    g.stroke();
  }
  g.fillStyle = '#26282c';
  g.font = '500 15px "JetBrains Mono", ui-monospace, monospace';
  g.fillText('W A S A T C H   R A N G E', x0, Hh - 92);
  g.font = '400 11px "JetBrains Mono", ui-monospace, monospace';
  g.fillStyle = 'rgba(38,40,44,0.6)';
  g.fillText('contour study · no. 04', x0, Hh - 70);
  return c;
}

// the contour print, drawn once and reused whenever it is the fallback
let topoCache = null;
const topoPrint = () => topoCache || (topoCache = topoCanvas());

// The shan shui as hung: the painting behind a mat with a bevelled opening and
// a deeper bottom margin carrying the credit. With no painting yet, the same
// mat around plain paper, which is what shows while the worker paints.
const PRINT = { W: 768, H: 1024, M: 54, MB: 112 }; // opening 660 x 858 at scale 1
function printCanvas(painting, seed, scale = 1) {
  const W = Math.round(PRINT.W * scale), Hh = Math.round(PRINT.H * scale);
  const m = PRINT.M * scale, mb = PRINT.MB * scale, pw = W - 2 * m, ph = Hh - m - mb, s = scale;
  const [c, g] = canvas(W, Hh);
  g.fillStyle = '#f2eee6'; g.fillRect(0, 0, W, Hh);
  const glow = g.createRadialGradient(W * 0.3, Hh * 0.2, 0, W * 0.3, Hh * 0.2, Hh * 0.75);
  glow.addColorStop(0, 'rgba(255,255,255,0.2)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, Hh);
  // the bevel's pale cut edge, then a hairline where it meets the paper
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(m - 3 * s, m - 3 * s, pw + 6 * s, ph + 6 * s);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(m - 1, m - 1, pw + 2, ph + 2);
  if (painting) {
    const [pc, pg] = canvas(painting.width, painting.height);
    pg.putImageData(painting, 0, 0);
    g.drawImage(pc, m, m, pw, ph);
  } else { g.fillStyle = '#efe3cb'; g.fillRect(m, m, pw, ph); } // the generator's paper, on average
  // the mat's edge casts a little shadow onto the paper
  const top = g.createLinearGradient(0, m, 0, m + 4 * s);
  top.addColorStop(0, 'rgba(0,0,0,0.16)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = top; g.fillRect(m, m, pw, 4 * s);
  const left = g.createLinearGradient(m, 0, m + 3 * s, 0);
  left.addColorStop(0, 'rgba(0,0,0,0.08)'); left.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = left; g.fillRect(m, m, 3 * s, ph);
  g.font = `400 ${(12.8 * s).toFixed(1)}px "JetBrains Mono", ui-monospace, monospace`;
  if ('letterSpacing' in g) g.letterSpacing = `${(0.8 * s).toFixed(2)}px`;
  g.fillStyle = 'rgba(38,40,44,0.58)';
  const y = Hh - mb + 50 * s;
  g.textAlign = 'left'; g.fillText('{Shan, Shui}*', m, y);
  g.textAlign = 'right'; g.fillText(`Lingdong Huang · seed ${seed}`, W - m, y);
  return c;
}

// A painting for the frame, started as early as possible and running in a
// worker: { seed, promise, result (undefined until settled; null = can't), cancel }
function startPainting(lite) {
  const s = lite ? 0.75 : 1;
  const seed = randomSeed();
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const job = { seed, result: undefined, cancel: () => ctrl && ctrl.abort() };
  if (!shanShuiSupported()) { job.result = null; job.promise = Promise.resolve(null); return job; }
  job.promise = paintShanShui({
    seed,
    width: Math.round((PRINT.W - 2 * PRINT.M) * s),
    height: Math.round((PRINT.H - PRINT.M - PRINT.MB) * s),
    signal: ctrl ? ctrl.signal : undefined,
  }).then((r) => { job.result = r; });
  return job;
}

// Open notebook: dot grid, handwriting strokes, a node-link sketch.
function notebookCanvas() {
  const W = 768, Hh = 512;
  const [c, g] = canvas(W, Hh);
  const r = rng(12);
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, W, Hh);
  const grd = g.createLinearGradient(W / 2 - 40, 0, W / 2 + 40, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(60,50,40,0.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(W / 2 - 40, 0, 80, Hh);
  g.fillStyle = 'rgba(80,80,90,0.28)';
  for (let y = 24; y < Hh - 10; y += 18) for (let x = 20; x < W - 10; x += 18) if (Math.abs(x - W / 2) > 14) g.fillRect(x, y, 1.6, 1.6);
  // left page: handwriting
  g.strokeStyle = 'rgba(40,52,82,0.78)'; g.lineWidth = 1.5; g.lineCap = 'round';
  for (let line = 0; line < 15; line++) {
    const y = 52 + line * 27;
    let x = 36 + (line === 0 ? 0 : r() * 6);
    const end = 330 - (line % 4 === 3 ? 120 * r() : 0);
    g.beginPath();
    while (x < end) {
      const wlen = 14 + r() * 38;
      g.moveTo(x, y);
      for (let k = 0; k < wlen; k += 3) g.lineTo(x + k, y + Math.sin(k * 0.9 + r() * 2) * 3.2 - (r() < 0.1 ? 5 : 0));
      x += wlen + 7 + r() * 6;
    }
    g.stroke();
  }
  // right page: graph sketch
  const nodes = [];
  for (let i = 0; i < 11; i++) nodes.push([430 + r() * 290, 70 + r() * 340, 7 + r() * 9]);
  g.strokeStyle = 'rgba(40,40,46,0.7)'; g.lineWidth = 1.3;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
    if (d < 120 && r() < 0.75) { g.beginPath(); g.moveTo(nodes[i][0], nodes[i][1]); g.lineTo(nodes[j][0], nodes[j][1]); g.stroke(); }
  }
  for (const [x, y, rad] of nodes) { g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.stroke(); }
  g.strokeStyle = 'rgba(61,90,138,0.9)'; g.setLineDash([5, 4]); g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(nodes[2][0], nodes[2][1]); g.quadraticCurveTo(600, 40, nodes[7][0], nodes[7][1]); g.stroke();
  g.setLineDash([]);
  return c;
}

function weaveTexture() {
  const S = 64;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#9a9ca0'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#5e6166';
  for (let i = 0; i < S; i += 4) { g.fillRect(i, 0, 1.4, S); g.fillRect(0, i + 2, S, 1.2); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 22);
  t.anisotropy = 4;
  return t;
}

// Books: one atlas holds 32 spine designs over the palette (gilt bands and
// leather labels, paperback blocks, series stripes, plain cloth), a cloth tile
// for the covers (tinted per book by vertex colour) and a page-edge tile for
// the tops. Every book on the shelf and the desk is one merged mesh with it.
const BOOK_COLORS = ['#2f4a6d', '#3d5a8a', '#7d3a2c', '#c9a14a', '#e3dccd', '#2a2a2b', '#5b6b4f', '#b9b2a4', '#1f3b33', '#9a5a3c', '#d9d2c3', '#43464c'];
const BOOK_ATLAS = { cols: 16, rows: 2, cellW: 64, cellH: 448, gutter: 4, size: 1024, tileY: 896 };
const BOOK_SPINES = BOOK_ATLAS.cols * BOOK_ATLAS.rows;
function luma(hex) { const [r, g, b] = srgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
function tone(hex, k) { // k < 0 darker, k > 0 lighter, in sRGB
  const [r, g, b] = srgb(hex);
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function bookAtlas(scale = 1) {
  const A = BOOK_ATLAS, S = scale, N = A.size * S;
  const [c, g] = canvas(N, N);
  const r = rng(77);
  const gold = '#c9a75e';
  // a word down the spine: rotated letters seen as short strokes
  const title = (cx, y, len, size, col) => {
    g.fillStyle = col;
    let yy = y;
    while (yy < y + len) {
      const letters = 2 + Math.floor(r() * 6);
      for (let l = 0; l < letters && yy < y + len; l++) {
        const tall = r() < 0.25, lw = size * (0.3 + r() * 0.2), th = size * (tall ? 0.85 : 0.55);
        g.fillRect(cx - size * 0.31, yy, th, lw);
        yy += lw + size * 0.12;
      }
      yy += size * 0.55;
    }
  };
  const bands = (x, y, w, col) => { g.fillStyle = col; g.fillRect(x, y, w, 1.6 * S); g.fillRect(x, y + 4.5 * S, w, 1.6 * S); };
  for (let i = 0; i < BOOK_SPINES; i++) {
    const col = BOOK_COLORS[i % BOOK_COLORS.length];
    const x0 = (i % A.cols) * A.cellW * S, y0 = Math.floor(i / A.cols) * A.cellH * S;
    const w = A.cellW * S, h = A.cellH * S, cx = x0 + w / 2;
    const ink = luma(col) > 0.55 ? 'rgba(34,31,28,0.78)' : 'rgba(238,230,212,0.8)';
    g.fillStyle = col; g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 260; k++) { // cloth / paper grain
      g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.025 + r() * 0.04})` : `rgba(0,0,0,${0.03 + r() * 0.05})`;
      g.fillRect(x0 + r() * w, y0 + r() * h, S, (2 + r() * 7) * S);
    }
    const style = Math.floor(r() * 4), size = w * 0.36;
    if (style === 0) { // cloth binding: gilt bands, a darker label, gilt title
      bands(x0, y0 + h * 0.05, w, gold); bands(x0, y0 + h * 0.92, w, gold);
      g.fillStyle = tone(col, -0.4); g.fillRect(x0 + w * 0.14, y0 + h * 0.13, w * 0.72, h * 0.27);
      g.strokeStyle = gold; g.lineWidth = S; g.strokeRect(x0 + w * 0.18, y0 + h * 0.135, w * 0.64, h * 0.26);
      title(cx, y0 + h * 0.15, h * 0.22, size * 0.8, gold);
      title(cx, y0 + h * 0.56, h * 0.1, size * 0.6, gold);
    } else if (style === 1) { // paperback: a block of colour behind the title
      const block = r() < 0.3 ? '#ece3d1' : tone(col, luma(col) > 0.55 ? -0.35 : 0.42);
      g.fillStyle = block; g.fillRect(x0, y0 + h * 0.06, w, h * 0.5);
      title(cx, y0 + h * 0.09, h * 0.42, size, luma(block) > 0.55 ? 'rgba(34,31,28,0.78)' : 'rgba(238,230,212,0.8)');
      title(cx, y0 + h * 0.62, h * 0.14, size * 0.7, ink);
      g.fillStyle = ink; g.beginPath(); g.arc(cx, y0 + h * 0.92, w * 0.13, 0, 7); g.fill();
    } else if (style === 2) { // a series: stripes top and bottom
      const band = ['#e4dccb', '#c98652', '#9fb0c2', '#d2b06a'][Math.floor(r() * 4)];
      g.fillStyle = band; g.fillRect(x0, y0, w, h * 0.12); g.fillRect(x0, y0 + h * 0.86, w, h * 0.14);
      g.fillStyle = tone(col, -0.25); g.fillRect(x0, y0 + h * 0.12, w, 2 * S); g.fillRect(x0, y0 + h * 0.86 - 2 * S, w, 2 * S);
      title(cx, y0 + h * 0.18, h * 0.46, size, ink);
      g.fillStyle = ink; g.fillRect(cx - w * 0.12, y0 + h * 0.9, w * 0.24, w * 0.24);
    } else { // plain: title, author, publisher's mark
      title(cx, y0 + h * 0.08, h * 0.44, size, ink);
      title(cx, y0 + h * 0.62, h * 0.16, size * 0.72, ink);
      g.fillStyle = ink; g.fillRect(cx - w * 0.1, y0 + h * 0.9, w * 0.2, w * 0.2);
    }
    // the spine rounds away at its edges
    const sh = g.createLinearGradient(x0, 0, x0 + w, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.32)'); sh.addColorStop(0.2, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = sh; g.fillRect(x0, y0, w, h);
  }
  // cover cloth (tinted per book) and page edges
  const ty = A.tileY * S, th = N - ty, half = N / 2;
  g.fillStyle = '#f4f4f4'; g.fillRect(0, ty, half, th);
  for (let k = 0; k < 2400; k++) { g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.06})` : `rgba(0,0,0,${0.04 + r() * 0.06})`; g.fillRect(r() * half, ty + r() * th, S, (1 + r() * 4) * S); }
  g.fillStyle = '#efe6d2'; g.fillRect(half, ty, half, th);
  for (let x = 0; x < half; x += S) { g.fillStyle = `rgba(90,70,40,${0.04 + r() * 0.1})`; g.fillRect(half + x, ty, S * 0.6, th); }
  const edge = g.createLinearGradient(half, 0, N, 0); // the boards either side
  edge.addColorStop(0, 'rgba(60,45,30,0.45)'); edge.addColorStop(0.05, 'rgba(60,45,30,0)'); edge.addColorStop(0.95, 'rgba(60,45,30,0)'); edge.addColorStop(1, 'rgba(60,45,30,0.45)');
  g.fillStyle = edge; g.fillRect(half, ty, half, th);
  return c;
}

// One mesh for a list of books. Each book is built upright (thickness along
// x, height along y, depth along z, spine facing +z) and then placed with its
// own position and rotation: { x, y, z, t, h, d, spine, rx, ry, rz }.
function booksGeometry(list) {
  const A = BOOK_ATLAS, N = A.size;
  const rect = (x, y, w, h) => [x / N, 1 - (y + h) / N, (x + w) / N, 1 - y / N]; // u0 v0 u1 v1 (canvas y runs down)
  const cover = rect(8, A.tileY + 8, N / 2 - 16, N - A.tileY - 16);
  const pages = rect(N / 2 + 2, A.tileY + 8, N / 2 - 4, N - A.tileY - 16);
  const parts = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const white = new THREE.Color(1, 1, 1), tint = new THREE.Color();
  for (const b of list) {
    const geo = new THREE.BoxGeometry(b.t, b.h, b.d);
    const s = b.spine % BOOK_SPINES;
    const spine = rect((s % A.cols) * A.cellW + A.gutter, Math.floor(s / A.cols) * A.cellH + 2, A.cellW - 2 * A.gutter, A.cellH - 4);
    tint.set(BOOK_COLORS[s % BOOK_COLORS.length]);
    // BoxGeometry builds 4 vertices per face, faces in order +x -x +y -y +z -z:
    // covers either side, page edges top, bottom and fore-edge, the spine at +z
    const faces = [[cover, tint], [cover, tint], [pages, white], [pages, white], [spine, white], [pages, white]];
    const uv = geo.attributes.uv, col = new Float32Array(uv.count * 3);
    for (let vi = 0; vi < uv.count; vi++) {
      const [[u0, v0, u1, v1], c] = faces[Math.floor(vi / 4)];
      uv.setXY(vi, u0 + uv.getX(vi) * (u1 - u0), v0 + uv.getY(vi) * (v1 - v0));
      col[vi * 3] = c.r; col[vi * 3 + 1] = c.g; col[vi * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.applyMatrix4(m4.compose(new THREE.Vector3(b.x, b.y, b.z), q.setFromEuler(e.set(b.rx || 0, b.ry || 0, b.rz || 0)), new THREE.Vector3(1, 1, 1)));
    geo.clearGroups();
    parts.push(geo);
  }
  return mergeGeometries(parts, false);
}

function clockCanvas() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    g.save(); g.rotate((i / 60) * Math.PI * 2);
    g.fillStyle = major ? '#1d1e21' : 'rgba(29,30,33,0.45)';
    g.fillRect(-(major ? 2.2 : 0.8), -S * 0.46, major ? 4.4 : 1.6, major ? 18 : 7);
    g.restore();
  }
  return c;
}

// Tileable noise for the coffee steam (as in Three.js Journey's smoke lesson,
// but generated instead of loaded).
function steamNoiseTexture() {
  const S = 128;
  const n = perlin(77);
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = fbm(n, (x / S) * 4, (y / S) * 4, 4, 4) * 0.5 + 0.5;
    const o = (y * S + x) * 4;
    data[o] = data[o + 1] = data[o + 2] = clamp01(v) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* ======================================================================
   Monitor content: an editor with research code, a terminal and a live
   exchange-network view that rewires an edge every few seconds.
   ====================================================================== */
const CODE = `import torch
import networkx as nx
from torch import nn

class RewireDQN(nn.Module):
    """Scores candidate edge swaps on an exchange network."""

    def __init__(self, n_nodes: int, hidden: int = 128):
        super().__init__()
        self.encode = nn.Linear(n_nodes, hidden)
        self.score = nn.Sequential(
            nn.ReLU(), nn.Linear(hidden, hidden),
            nn.ReLU(), nn.Linear(hidden, 1),
        )

    def forward(self, adj, wealth):
        h = self.encode(adj * wealth.unsqueeze(0))
        return self.score(h).squeeze(-1)


def gini(w: torch.Tensor) -> float:
    w, _ = torch.sort(w)
    n = w.numel()
    i = torch.arange(1, n + 1, dtype=w.dtype)
    return float(((2 * i - n - 1) * w).sum() / (n * w.sum()))


def rewire(env, policy, eps: float = 0.05):
    if torch.rand(()) < eps:
        swap = env.random_swap()
    else:
        swap = policy(env.adj, env.wealth).argmax()
    env.apply(swap)
    return env.exchange_round()


class ExchangeEnv:
    """Agents trade along edges; wealth flows each round."""

    def __init__(self, graph: nx.Graph, rate: float = 0.1):
        self.graph = graph
        self.rate = rate
        self.adj = torch.tensor(nx.to_numpy_array(graph))
        self.wealth = torch.ones(graph.number_of_nodes())

    def exchange_round(self) -> float:
        share = self.rate * self.wealth
        inflow = self.adj @ (share / self.adj.sum(1))
        self.wealth = self.wealth - share + inflow
        return -gini(self.wealth)


def train(env, policy, target, episodes: int = 4000):
    opt = torch.optim.Adam(policy.parameters(), lr=3e-4)
    buffer = ReplayBuffer(50_000)
    for ep in range(episodes):
        state = env.reset()
        for _ in range(env.horizon):
            reward = rewire(env, policy)
            buffer.push(state, env.last_swap, reward, env.state())
            state = env.state()
            if len(buffer) > 1_000:
                loss = td_loss(policy, target, buffer.sample(64))
                opt.zero_grad()
                loss.backward()
                opt.step()
        if ep % 50 == 0:
            target.load_state_dict(policy.state_dict())
`;
const KW = new Set(['import', 'from', 'class', 'def', 'return', 'if', 'else', 'self', 'super', 'float', 'int', 'as', 'for', 'in', 'not', 'None', 'True', 'False']);

// syntax-coloured line, measured with the real font so columns stay true
function paintCode(g, line, x, y) {
  const tokens = line.match(/(\s+|"""[^"]*"""|"[^"]*"|#.*$|[A-Za-z_][A-Za-z_0-9]*|\d+(\.\d+)?|.)/g) || [];
  let cx = x;
  tokens.forEach((tk, i) => {
    let col = '#c9d1d9';
    if (/^"/.test(tk)) col = '#d6bc94';
    else if (/^#/.test(tk)) col = '#6b7380';
    else if (/^\d/.test(tk)) col = '#e2a37f';
    else if (KW.has(tk)) col = '#9cb6e6';
    else if (/^[A-Z]/.test(tk)) col = '#a8cdbd';
    else if (tokens[i + 1] === '(') col = '#e9e4d8';
    g.fillStyle = col;
    g.fillText(tk, cx, y);
    cx += g.measureText(tk).width;
  });
}

// Editor viewport on the 1024x576 screen canvas.
const ED = { x: 228, y: 30, w: 420, h: 300, lh: 17.5, pad: 10, scale: 2, caretLine: 8 };

// The editor's code lives on its own layer: the whole file is drawn once into
// a tall texture and the visible window slides over it, so scrolling is smooth
// at any frame rate and costs no redraws or texture uploads. Motion is paced
// like a person reading: a flick of a few lines that eases out, a pause,
// sometimes a short scroll back up, and a quick jump to the top at the end.
class CodeScroll {
  constructor(lines, still) {
    const S = ED.scale;
    this.H = Math.ceil(ED.pad * 2 + lines.length * ED.lh);
    [this.c, this.g] = canvas(ED.w * S, this.H * S);
    const g = this.g;
    g.scale(S, S);
    g.fillStyle = '#16181c'; g.fillRect(0, 0, ED.w, this.H);
    g.font = '400 12.5px "JetBrains Mono", ui-monospace, monospace';
    lines.forEach((ln, i) => {
      const y = ED.pad + i * ED.lh + 13;
      g.fillStyle = '#4b525c'; g.textAlign = 'right'; g.fillText(String(i + 1), 34, y); g.textAlign = 'left';
      paintCode(g, ln, 48, y);
    });
    this.caretX = 48 + g.measureText(lines[ED.caretLine] || '').width + 1;
    this.tex = tex(this.c, { aniso: 8 });
    this.tex.repeat.set(1, ED.h / this.H);
    this.max = Math.max(0, this.H - ED.h);
    this.still = still;
    this.pos = 0; this.from = 0; this.to = 0; this.t0 = 0; this.dur = 0; this.next = 1.4; this.jump = false;
    this.r = rng(29);
    this.apply();
  }
  apply() { this.tex.offset.y = 1 - (this.pos + ED.h) / this.H; }
  update(t) {
    if (this.still) return;
    if (this.dur > 0) {
      const k = Math.min(1, (t - this.t0) / this.dur);
      const e = this.jump ? k * k * (3 - 2 * k) : 1 - Math.pow(1 - k, 3);
      this.pos = this.from + (this.to - this.from) * e;
      if (k >= 1) { this.dur = 0; this.next = t + (this.jump ? 1.8 : 0.9 + this.r() * 2.4); }
      this.apply();
    } else if (t >= this.next) {
      this.from = this.pos; this.t0 = t;
      this.jump = this.pos >= this.max - 1;
      if (this.jump) { this.to = 0; this.dur = 0.85; }
      else {
        const n = this.r() < 0.18 ? -(2 + this.r() * 4) : 3 + this.r() * 9;
        this.to = Math.min(this.max, Math.max(0, this.pos + n * ED.lh));
        this.dur = 0.32 + (Math.abs(this.to - this.pos) / ED.lh) * 0.045;
      }
    }
  }
}

// The rest of the screen: window chrome, file tree, terminal, status bar. It
// is drawn once; only the terminal's progress line is redrawn, when the
// training step moves on, so the texture is uploaded every few seconds.
const GRAPH = { x: 648, y: 30, w: 376, h: 524 }; // the network panel, its own layer
const mono = (s, w = 400) => `${w} ${s}px "JetBrains Mono", ui-monospace, monospace`;
class ScreenPainter {
  constructor() {
    [this.c, this.g] = canvas(1024, 576);
    this.tex = tex(this.c, { aniso: 4 });
    this.graph = new GraphPanel();
    this.shown = -1;
    this.drawBase();
    this.update(0);
  }

  update(t) {
    this.graph.update(t);
    if (this.graph.step === this.shown) return;
    this.shown = this.graph.step;
    this.drawProgress(this.graph.step);
    this.tex.needsUpdate = true;
  }

  drawBase() {
    const g = this.g, W = 1024, Hh = 576;
    g.fillStyle = '#16181c'; g.fillRect(0, 0, W, Hh);
    // title bar + tabs
    g.fillStyle = '#1d2025'; g.fillRect(0, 0, W, 30);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#3a3f47'; g.beginPath(); g.arc(18 + i * 16, 15, 4.5, 0, 7); g.fill(); }
    g.fillStyle = '#16181c'; g.fillRect(228, 4, 150, 26);
    g.font = mono(12); g.fillStyle = '#d6d9de'; g.fillText('rewire_dqn.py', 244, 21);
    g.fillStyle = '#7d8590'; g.fillText('exchange.ipynb', 396, 21);
    // activity bar + file tree
    g.fillStyle = '#1a1c21'; g.fillRect(0, 30, 44, Hh - 52);
    for (let i = 0; i < 5; i++) { g.fillStyle = i === 0 ? '#9aa4b1' : '#4a515b'; g.fillRect(14, 48 + i * 40, 16, 16); }
    g.fillStyle = '#181a1f'; g.fillRect(44, 30, 184, Hh - 52);
    const files = ['▾ rewiring', '   env.py', '   rewire_dqn.py', '   gini.py', '   train.py', '▸ data', '▸ figures', '  README.md', '  pyproject.toml'];
    g.font = mono(11.5);
    files.forEach((f, i) => { if (i === 2) { g.fillStyle = '#262a31'; g.fillRect(44, 44 + i * 22, 184, 22); } g.fillStyle = i === 2 ? '#e6e8eb' : '#8a929c'; g.fillText(f, 56, 59 + i * 22); });
    // editor area: the scrolling code is its own layer (CodeScroll)
    const ex = ED.x, ty = ED.y + ED.h;
    // terminal
    g.fillStyle = '#121418'; g.fillRect(ex, ty, 420, Hh - 22 - ty);
    g.fillStyle = '#2a2e35'; g.fillRect(ex, ty, 420, 1);
    g.font = mono(11.5); g.fillStyle = '#7d8590'; g.fillText('TERMINAL', ex + 14, ty + 20);
    g.fillStyle = '#c9d1d9'; g.fillText('$ python train.py --nodes 26 --episodes 4000', ex + 14, ty + 44);
    g.fillStyle = '#7d8590'; g.fillText('checkpoint saved · runs/exchange-26', ex + 14, ty + 88);
    // the network panel's backing (the panel itself is GraphPanel's layer)
    g.fillStyle = '#1b1e23'; g.fillRect(GRAPH.x, GRAPH.y, GRAPH.w, GRAPH.h);
    // status bar in the site's accent
    g.fillStyle = '#34507d'; g.fillRect(0, Hh - 22, W, 22);
    g.fillStyle = '#e8eef8'; g.font = mono(11); g.fillText('main   ✓ 0 problems', 12, Hh - 7);
    g.fillText('Python 3.12   Ln 9, Col 27', W - 210, Hh - 7);
  }

  drawProgress(step) {
    const g = this.g, ex = ED.x, ty = ED.y + ED.h;
    g.fillStyle = '#121418'; g.fillRect(ex + 10, ty + 52, 400, 20);
    const prog = ((step - 1800) % 400) / 400;
    g.font = mono(11.5); g.fillStyle = '#7d8590'; g.fillText(`episode ${step}/4000`, ex + 14, ty + 66);
    g.fillStyle = '#2a2e35'; g.fillRect(ex + 160, ty + 58, 220, 8);
    g.fillStyle = '#8fb3e8'; g.fillRect(ex + 160, ty + 58, 220 * (0.46 + prog * 0.5), 8);
  }
}

// The exchange network on the right of the screen, on its own small texture:
// one edge is rewired every few seconds (the old one flashes out, the new one
// lights up in the accent) and the nodes breathe. Redrawn at 12 fps while an
// edge changes and 4 fps otherwise.
class GraphPanel {
  constructor() {
    [this.c, this.g] = canvas(GRAPH.w, GRAPH.h);
    this.tex = tex(this.c, { aniso: 4 });
    const r = rng(5);
    // a small exchange network with a stable spring layout
    const N = 26;
    this.nodes = Array.from({ length: N }, () => ({ x: r(), y: r(), w: 0.3 + r() * 0.7, ph: r() * 6.28 }));
    const E = new Set();
    const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    for (let i = 0; i < N; i++) {
      const near = this.nodes.map((n, j) => [j, Math.hypot(n.x - this.nodes[i].x, n.y - this.nodes[i].y)]).sort((a, b) => a[1] - b[1]);
      for (let k = 1; k <= 2; k++) E.add(key(i, near[k][0]));
    }
    this.edges = [...E].map((s) => s.split('-').map(Number));
    for (let it = 0; it < 160; it++) {
      for (const a of this.nodes) { a.fx = 0; a.fy = 0; }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy + 1e-4;
        const f = 0.0016 / d2; a.fx += dx * f; a.fy += dy * f; b.fx -= dx * f; b.fy -= dy * f;
      }
      for (const [i, j] of this.edges) {
        const a = this.nodes[i], b = this.nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) + 1e-6;
        const f = (d - 0.17) * 0.08; a.fx += dx / d * f; a.fy += dy / d * f; b.fx -= dx / d * f; b.fy -= dy / d * f;
      }
      for (const a of this.nodes) { a.x = clamp01(a.x + a.fx + (0.5 - a.x) * 0.004); a.y = clamp01(a.y + a.fy + (0.5 - a.y) * 0.004); }
    }
    this.r = r;
    this.swap = null;
    this.nextSwap = 2;
    this.step = 1832;
    this.last = -1;
    this.draw(0);
  }

  update(t) {
    const busy = this.swap && t - this.swap.t0 < 1.7;
    if (t - this.last < (busy ? 1 / 12 : 1 / 4)) return false;
    this.last = t;
    if (t > this.nextSwap) {
      const r = this.r;
      const gone = Math.floor(r() * this.edges.length);
      const old = this.edges[gone];
      let a = Math.floor(r() * this.nodes.length), b = Math.floor(r() * this.nodes.length);
      if (a === b) b = (b + 1) % this.nodes.length;
      this.edges.splice(gone, 1, [a, b]);
      this.swap = { old, neu: [a, b], t0: t };
      this.nextSwap = t + 2.6 + r() * 1.8;
      this.step += 1;
    }
    this.draw(t);
    this.tex.needsUpdate = true;
    return true;
  }

  draw(t) {
    const g = this.g, gw = GRAPH.w;
    g.fillStyle = '#1b1e23'; g.fillRect(0, 0, gw, GRAPH.h);
    g.fillStyle = '#2a2e35'; g.fillRect(0, 0, 1, GRAPH.h);
    g.font = mono(11.5); g.fillStyle = '#8a929c'; g.fillText('exchange network', 18, 24);
    g.fillStyle = '#5c6470'; g.fillText(`step ${this.step}`, gw - 92, 24);
    const px = (n) => 30 + n.x * (gw - 60), py = (n) => 48 + n.y * 330;
    const sw = this.swap, age = sw ? t - sw.t0 : 99;
    g.lineWidth = 1.1;
    for (const [i, j] of this.edges) {
      const isNew = sw && i === sw.neu[0] && j === sw.neu[1] && age < 1.6;
      g.strokeStyle = isNew ? `rgba(143,179,232,${0.5 + 0.5 * (1 - age / 1.6)})` : 'rgba(150,160,172,0.38)';
      g.lineWidth = isNew ? 2 : 1.1;
      g.beginPath(); g.moveTo(px(this.nodes[i]), py(this.nodes[i])); g.lineTo(px(this.nodes[j]), py(this.nodes[j])); g.stroke();
    }
    if (sw && age < 1.2) {
      const [i, j] = sw.old;
      g.strokeStyle = `rgba(214,128,104,${1 - age / 1.2})`; g.lineWidth = 2; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(px(this.nodes[i]), py(this.nodes[i])); g.lineTo(px(this.nodes[j]), py(this.nodes[j])); g.stroke();
      g.setLineDash([]);
    }
    for (const n of this.nodes) {
      const w = n.w + 0.12 * Math.sin(t * 0.4 + n.ph);
      g.fillStyle = `rgba(${Math.round(150 + 80 * w)},${Math.round(160 + 70 * w)},${Math.round(175 + 60 * w)},1)`;
      g.beginPath(); g.arc(px(n), py(n), 3 + w * 6, 0, 7); g.fill();
    }
    // a small inequality trace under the graph
    const cy0 = 410, ch = 70;
    g.fillStyle = '#5c6470'; g.fillText('wealth spread', 18, cy0 - 8);
    g.strokeStyle = 'rgba(143,179,232,0.9)'; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; k <= 60; k++) {
      const x = 18 + k * ((gw - 36) / 60);
      const y = cy0 + 10 + ch * (0.25 + 0.5 * Math.exp(-k / 26) + 0.05 * Math.sin(k * 0.9 + t * 0.6) * (k / 60));
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
}

/* ======================================================================
   Geometry helpers
   ====================================================================== */
const rbox = (w, h, d, r = 0.006, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 24) => new THREE.CylinderGeometry(rt, rb, h, s);
const lathe = (pts, s = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s);

function put(parent, geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.s) m.scale.setScalar(o.s);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.dynamic) m.userData.dynamic = true;
  if (o.noAO) m.userData.noAO = true;
  parent.add(m);
  return m;
}

// broad leaf along +y, folded at the midrib and curling down toward the tip
function leafGeometry(len, wid, fiddle = true, curl = 0.22) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
    const prof = fiddle
      ? smooth(0, 0.22, v) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, v * 1.1))) * (1 - smooth(0.86, 1.0, v) * 0.85) + 0.04
      : Math.sin(Math.PI * Math.pow(v, 0.7)) * 0.9 + 0.05;
    const x = u * wid * 0.5 * prof;
    const z = -Math.abs(u) * wid * 0.14 * prof + v * v * len * curl + Math.sin(u * 3 + v * 7) * 0.004;
    p.setXYZ(i, x, v * len, z);
  }
  g.computeVertexNormals();
  return g;
}

/* ======================================================================
   Shaders
   ====================================================================== */
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition * 0.0;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// Outdoor dome seen through the window: sky, sun haze, a hazy Wasatch-like
// range with snow on the peaks, foothills, the valley — and at night stars,
// a moon and the valley's lights.
const SKY_FRAG = /* glsl */ `
  uniform float uNight, uTime, uGain;
  uniform vec3 uSun, uMoon;
  varying vec3 vDir;
  float h1(float n) { return fract(sin(n) * 43758.5453123); }
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  float ridge(float x, float s) { float a = 0.5, r = 0.0, f = 1.0;
    for (int i = 0; i < 6; i++) { r += a * (1.0 - abs(n1(x * f + s) * 2.0 - 1.0)); f *= 2.07; a *= 0.47; } return r; }
  float fbm2(vec2 p) { float a = 0.5, r = 0.0; for (int i = 0; i < 4; i++) { r += a * n2(p); p *= 2.03; a *= 0.5; } return r; }
  // round points on a jittered grid (stars, valley lights)
  float points(vec2 p, float density, float radius, out float seed) {
    vec2 c = floor(p), f = fract(p) - 0.5;
    seed = h2(c);
    vec2 o = vec2(h2(c + 3.1), h2(c + 7.7)) - 0.5;
    return step(1.0 - density, seed) * smoothstep(radius, 0.0, length(f - o * 0.6));
  }
  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.z, d.x);
    float el = asin(clamp(d.y, -1.0, 1.0));
    float day = 1.0 - uNight;
    // sky
    float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
    vec3 skyD = mix(vec3(0.78, 0.84, 0.92), vec3(0.33, 0.5, 0.79), t);
    vec3 skyN = mix(vec3(0.05, 0.068, 0.12), vec3(0.008, 0.013, 0.032), t);
    float sd = max(dot(d, uSun), 0.0);
    skyD += vec3(1.0, 0.8, 0.55) * (pow(sd, 5.0) * 0.3 + pow(sd, 48.0) * 0.5);
    float cl = smoothstep(0.58, 0.9, fbm2(vec2(az * 2.6 + uTime * 0.003, el * 8.0)));
    skyD = mix(skyD, vec3(1.0, 0.97, 0.93), cl * 0.4 * smoothstep(0.03, 0.25, el));
    vec3 col = mix(skyD, skyN, uNight);
    vec3 hazeD = vec3(0.8, 0.84, 0.89), hazeN = vec3(0.055, 0.07, 0.115);
    if (uNight > 0.01) {
      float s0;
      float st = points(vec2(az, el) * 260.0, 0.012, 0.2, s0) * smoothstep(0.04, 0.22, el);
      col += vec3(0.85, 0.9, 1.0) * st * (0.5 + 0.5 * sin(uTime * 1.7 + s0 * 60.0)) * uNight * 1.4;
      float md = dot(d, uMoon);
      col += vec3(0.98, 0.95, 0.86) * smoothstep(0.99962, 0.99972, md) * uNight * 2.4;
      col += vec3(0.22, 0.27, 0.4) * pow(max(md, 0.0), 160.0) * uNight * 0.7;
    }
    // far range: snow on the high ground, cool haze with distance
    float rf = ridge(az * 1.25 + 4.3, 2.0);
    float hf = 0.06 + 0.13 * rf * (0.75 + 0.25 * n1(az * 0.9 + 2.0));
    float slope = ridge(az * 1.25 + 4.31, 2.0) - ridge(az * 1.25 + 4.29, 2.0);
    float edgeAA = fwidth(el - hf) * 1.5;
    float inF = smoothstep(edgeAA, -edgeAA, el - hf);
    if (inF > 0.0) {
      float face = clamp(0.55 + slope * 9.0 + (n2(vec2(az * 26.0, el * 60.0)) - 0.5) * 0.35, 0.0, 1.0);
      vec3 rockD = mix(vec3(0.34, 0.37, 0.45), vec3(0.66, 0.62, 0.58), face);
      float snowLine = hf - 0.028 - 0.03 * n1(az * 14.0);
      float snow = smoothstep(snowLine, snowLine + 0.012, el) * smoothstep(0.1, 0.14, hf);
      rockD = mix(rockD, mix(vec3(0.82, 0.86, 0.92), vec3(1.0, 0.98, 0.95), face), snow);
      vec3 rockN = mix(vec3(0.028, 0.035, 0.06), vec3(0.075, 0.085, 0.11), snow);
      vec3 m = mix(mix(rockD, hazeD, 0.12), mix(rockN, hazeN, 0.2), uNight);
      col = mix(col, m, inF);
    }
    // foothills
    float hm = 0.004 + 0.032 * ridge(az * 3.4 + 1.0, 7.0);
    float inM = smoothstep(edgeAA, -edgeAA, el - hm);
    if (inM > 0.0) {
      vec3 hillD = mix(vec3(0.36, 0.38, 0.3), vec3(0.58, 0.52, 0.4), n2(vec2(az * 14.0, el * 30.0)));
      vec3 m = mix(mix(hillD, hazeD, 0.16), vec3(0.016, 0.02, 0.03), uNight);
      col = mix(col, m, inM);
    }
    // valley floor: soft and out of focus by day, scattered lights by night
    if (el < 0.0) {
      float k = fbm2(vec2(az * 22.0, el * 70.0));
      vec3 vD = mix(vec3(0.34, 0.37, 0.3), vec3(0.62, 0.6, 0.55), smoothstep(0.45, 0.65, k));
      vD = mix(vD, hazeD, 0.22 + 0.25 * smoothstep(-0.05, 0.0, el));
      vec3 vN = vec3(0.01, 0.012, 0.018);
      float cluster = smoothstep(0.42, 0.7, fbm2(vec2(az * 9.0, el * 30.0)));
      float s1;
      float li = points(vec2(az * 520.0, el * 1500.0), 0.03 + 0.12 * cluster, 0.32, s1) * smoothstep(-0.06, -0.006, el);
      vec3 lc = mix(vec3(1.0, 0.7, 0.36), vec3(0.86, 0.9, 1.0), step(0.8, fract(s1 * 13.0)));
      vN += lc * li * (0.75 + 0.25 * sin(uTime * (1.0 + s1 * 3.0) + s1 * 40.0)) * 1.6;
      vN += vec3(1.0, 0.62, 0.3) * cluster * 0.02 * smoothstep(-0.05, -0.005, el);
      col = mix(vD, vN, uNight);
    }
    gl_FragColor = vec4(col * uGain, 1.0);
  }`;

// Shared analytic test: is world point p lit by the sun through the window?
// Projects p back along the sun direction onto the window plane and checks the
// panes (minus steel bars), then checks whether the desk top is in the way.
const BEAM_GLSL = /* glsl */ `
  uniform vec3 uSunTo;
  uniform vec4 uWin;      // z0, z1, y0, y1
  uniform float uWinX;
  uniform vec2 uGrid;     // cols, rows
  uniform vec4 uDesk;     // x0, x1, z0, z1
  uniform float uDeskY;
  float sunLit(vec3 p) {
    float s = (uWinX - p.x) / uSunTo.x;
    if (s < 0.0) return 0.0;
    vec3 q = p + uSunTo * s;
    float inZ = smoothstep(uWin.x + 0.02, uWin.x + 0.035, q.z) * smoothstep(uWin.y - 0.02, uWin.y - 0.035, q.z);
    float inY = smoothstep(uWin.z + 0.02, uWin.z + 0.035, q.y) * smoothstep(uWin.w - 0.02, uWin.w - 0.035, q.y);
    float cw = (uWin.y - uWin.x) / uGrid.x, rh = (uWin.w - uWin.z) / uGrid.y;
    float mz = (q.z - uWin.x) / cw, my = (q.y - uWin.z) / rh;
    float bz = smoothstep(0.012, 0.022, abs(mz - floor(mz + 0.5)) * cw);
    float by = smoothstep(0.012, 0.022, abs(my - floor(my + 0.5)) * rh);
    float lit = inZ * inY * bz * by;
    if (p.y < uDeskY) {
      float sd = (uDeskY - p.y) / uSunTo.y;
      vec3 r = p + uSunTo * sd;
      if (r.x > uDesk.x && r.x < uDesk.y && r.z > uDesk.z && r.z < uDesk.w) lit = 0.0;
    }
    return lit;
  }`;

/* ======================================================================
   The scene
   ====================================================================== */
// Lighter path on phones and low-core machines: smaller textures and shadow
// maps, fewer AO samples, no bloom, 1x pixels and a smaller pixel budget.
const isLite = (forced) => forced ?? (window.matchMedia('(max-width: 860px)').matches || (navigator.hardwareConcurrency || 8) <= 4);

function createApp(el, opts) {
  RectAreaLightUniformsLib.init();
  let host = el;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lite = isLite(opts.lite);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // soft since r182
  renderer.shadowMap.autoUpdate = false;        // nothing that casts shadows moves
  renderer.info.autoReset = false;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(47, 1, 0.08, 260);
  const fx = []; // transparent effects that must not feed AO / env probes
  let disposed = false;

  const T0 = performance.now();
  /* ---------------- materials ---------------- */
  const texSize = lite ? 512 : 768;
  const floorT = oakBoards({ size: texSize, metres: 2.0, boardW: 0.19, seed: 7 });
  const deskT = oakBoards({ size: texSize, metres: 1.0, boardW: 0.09, seed: 19, joints: false, light: '#d9b68c', dark: '#b88f63', gap: 0.82 });
  const floorMap = tex(floorT.map, { repeat: [(X1 - X0 + 2 * T) / 2.0, (Z1 - Z0 + 2 * T) / 2.0], aniso: maxAniso });
  const floorRough = tex(floorT.rough, { srgbColor: false, repeat: [(X1 - X0 + 2 * T) / 2.0, (Z1 - Z0 + 2 * T) / 2.0], aniso: maxAniso });
  const deskMap = tex(deskT.map, { aniso: maxAniso }), deskRough = tex(deskT.rough, { srgbColor: false, aniso: maxAniso });
  deskMap.rotation = deskRough.rotation = Math.PI / 2; // grain along the desk
  deskMap.center.set(0.5, 0.5); deskRough.center.set(0.5, 0.5);
  deskMap.repeat.set(1, 1.6); deskRough.repeat.set(1, 1.6);
  deskMap.wrapS = deskMap.wrapT = deskRough.wrapS = deskRough.wrapT = THREE.RepeatWrapping;

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    wall: std({ color: '#ebe5da', roughness: 0.94 }),
    ceiling: std({ color: '#f5f3ef', roughness: 0.96 }),
    trim: std({ color: '#f3f1ec', roughness: 0.5 }),
    floor: std({ map: floorMap, roughnessMap: floorRough, roughness: 1 }),
    oak: std({ map: deskMap, roughnessMap: deskRough, roughness: 1 }),
    oakEdge: std({ color: '#c39a6c', roughness: 0.55 }),
    shelfOak: std({ color: '#cfa77a', roughness: 0.6 }),
    steel: std({ color: '#1c1d1f', roughness: 0.42, metalness: 0.5 }),
    black: std({ color: '#1f2023', roughness: 0.62 }),
    graphite: std({ color: '#2a2c30', roughness: 0.38, metalness: 0.35 }),
    alu: std({ color: '#c9cbce', roughness: 0.26, metalness: 0.95 }),
    chrome: std({ color: '#e6e7e9', roughness: 0.14, metalness: 1 }),
    brass: std({ color: '#b48f58', roughness: 0.32, metalness: 1 }),
    fabric: new THREE.MeshPhysicalMaterial({ color: '#33363b', roughness: 0.95, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color('#80868f') }),
    keyL: std({ color: '#e7e4dd', roughness: 0.55 }),
    keyD: std({ color: '#a5a6a8', roughness: 0.55 }),
    keyA: std({ color: '#3d5a8a', roughness: 0.5 }),
    kbBase: std({ color: '#d4d0c8', roughness: 0.5 }),
    felt: std({ color: '#4a4e55', roughness: 1 }),
    ceramic: std({ color: '#ebe6dc', roughness: 0.3 }),
    ceramicDark: std({ color: '#3b3d40', roughness: 0.75 }),
    coffee: std({ color: '#2a170c', roughness: 0.08 }),
    soil: std({ color: '#2b211b', roughness: 1 }),
    paper: std({ color: '#f1eee7', roughness: 0.85 }),
    leaf: std({ color: '#ffffff', roughness: 0.52, side: THREE.DoubleSide }),
    stem: std({ color: '#5b4a35', roughness: 0.8 }),
    rug: std({ map: tex(rugCanvas(3, lite ? 0.5 : 1), { aniso: maxAniso }), roughness: 1 }),
    print: std({ color: '#ffffff', roughness: 0.8 }),
    notebook: std({ map: tex(notebookCanvas(), { aniso: maxAniso }), roughness: 0.85 }),
    books: std({ map: tex(bookAtlas(lite ? 0.5 : 1), { aniso: maxAniso }), vertexColors: true, roughness: 0.8 }),
    cover: std({ color: '#2f3a33', roughness: 0.7 }),
    clockFace: std({ map: tex(clockCanvas()), roughness: 0.4 }),
    lantern: std({ color: '#f2ede2', roughness: 0.9, emissive: new THREE.Color('#ffc58a'), emissiveIntensity: 0, side: THREE.DoubleSide }),
    bulb: std({ color: '#fff4e2', emissive: new THREE.Color('#ffd3a0'), emissiveIntensity: 0 }),
    shadeIn: std({ color: '#efe9de', roughness: 0.8, emissive: new THREE.Color('#ffcf98'), emissiveIntensity: 0, side: THREE.BackSide }),
    linen: std({ color: '#f1ede5', roughness: 0.95, side: THREE.DoubleSide, emissive: new THREE.Color('#fff1da'), emissiveIntensity: 0.0 }),
    glass: std({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.02, depthWrite: false }),
    chairBlack: std({ color: '#1b1c1f', roughness: 0.55 }),
    armPad: std({ color: '#232427', roughness: 0.8 }),
    chairMesh: std({ color: '#26282c', roughness: 0.9, transparent: true, opacity: 0.94, side: THREE.DoubleSide, map: weaveTexture() }),
    shadeLinen: std({ color: '#efe8db', roughness: 0.95, side: THREE.DoubleSide, emissive: new THREE.Color('#ffc78f'), emissiveIntensity: 0 }),
  };
  const screen = new ScreenPainter();
  M.screen = std({ color: '#060607', roughness: 0.16, emissive: new THREE.Color('#ffffff'), emissiveMap: screen.tex, emissiveIntensity: 0.9 });

  const T1 = performance.now();
  /* ---------------- room shell ---------------- */
  const room = new THREE.Group();
  scene.add(room);
  const W = X1 - X0, D = Z1 - Z0;
  put(room, box(W + 2 * T, T, D + 2 * T), M.floor, 0, -T / 2, 0, { cast: false });
  put(room, box(W + 2 * T, T, D + 2 * T), M.ceiling, 0, H + T / 2, 0);
  put(room, box(W + 2 * T, H + 2 * T, T), M.wall, 0, H / 2, Z0 - T / 2); // back
  put(room, box(W + 2 * T, H + 2 * T, T), M.wall, 0, H / 2, Z1 + T / 2); // front (behind camera)
  put(room, box(T, H + 2 * T, D + 2 * T), M.wall, X0 - T / 2, H / 2, 0); // left
  // right wall, built around the window opening so its reveals are real
  const rx = X1 + T / 2;
  put(room, box(T, H + 2 * T, WIN.z0 - (Z0 - T)), M.wall, rx, H / 2, (Z0 - T + WIN.z0) / 2);
  put(room, box(T, H + 2 * T, Z1 + T - WIN.z1), M.wall, rx, H / 2, (WIN.z1 + Z1 + T) / 2);
  put(room, box(T, WIN.y0 + T, WIN.z1 - WIN.z0), M.wall, rx, (WIN.y0 - T) / 2, (WIN.z0 + WIN.z1) / 2);
  put(room, box(T, H + T - WIN.y1, WIN.z1 - WIN.z0), M.wall, rx, (WIN.y1 + H + T) / 2, (WIN.z0 + WIN.z1) / 2);
  // skirting
  const sk = 0.085, st = 0.014;
  put(room, rbox(W, sk, st, 0.004), M.trim, 0, sk / 2, Z0 + st / 2);
  put(room, rbox(st, sk, D, 0.004), M.trim, X0 + st / 2, sk / 2, 0);
  put(room, rbox(st, sk, WIN.z0 - Z0, 0.004), M.trim, X1 - st / 2, sk / 2, (Z0 + WIN.z0) / 2);
  put(room, rbox(st, sk, Z1 - WIN.z0, 0.004), M.trim, X1 - st / 2, sk / 2, (WIN.z0 + Z1) / 2);
  // oak sill
  put(room, rbox(T + 0.05, 0.028, WIN.z1 - WIN.z0 + 0.06, 0.005), M.oakEdge, X1 + T / 2 - 0.025, WIN.y0 - 0.012, (WIN.z0 + WIN.z1) / 2);

  /* ---------------- steel window ---------------- */
  const wz = WIN.z1 - WIN.z0, wy = WIN.y1 - WIN.y0, wzc = (WIN.z0 + WIN.z1) / 2, wyc = (WIN.y0 + WIN.y1) / 2;
  const fw = 0.045, fd = 0.05, bw = 0.024, bd = 0.04;
  const frame = new THREE.Group();
  frame.position.x = WIN.frameX;
  room.add(frame);
  put(frame, box(fd, fw, wz), M.steel, 0, WIN.y0 + fw / 2, wzc);
  put(frame, box(fd, fw, wz), M.steel, 0, WIN.y1 - fw / 2, wzc);
  put(frame, box(fd, wy, fw), M.steel, 0, wyc, WIN.z0 + fw / 2);
  put(frame, box(fd, wy, fw), M.steel, 0, wyc, WIN.z1 - fw / 2);
  for (let i = 1; i < WIN.cols; i++) put(frame, box(bd, wy, bw), M.steel, 0, wyc, WIN.z0 + (wz * i) / WIN.cols);
  for (let j = 1; j < WIN.rows; j++) put(frame, box(bd, bw, wz), M.steel, 0, WIN.y0 + (wy * j) / WIN.rows, wzc);
  // casement handle
  put(frame, box(0.02, 0.1, 0.014), M.steel, -0.03, wyc - 0.1, WIN.z0 + wz / WIN.cols - 0.03);
  const glass = put(frame, new THREE.PlaneGeometry(wz, wy), M.glass, 0.012, wyc, wzc, { ry: -Math.PI / 2, cast: false, receive: false, noAO: true });
  glass.renderOrder = 2;
  fx.push(glass);

  // linen curtain gathered at the front edge of the window, on a thin rod
  put(room, cyl(0.008, 0.008, wz + 0.5, 12), M.steel, X1 - 0.07, WIN.y1 + 0.16, wzc + 0.12, { rx: Math.PI / 2 });
  const CW = 0.42;
  const curtainGeo = new THREE.PlaneGeometry(CW, WIN.y1 + 0.14, 64, 24);
  {
    const p = curtainGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / CW + 0.5, v = p.getY(i) / (WIN.y1 + 0.14) + 0.5;
      const ph = u * Math.PI * 2;
      const fold = (Math.sin(ph * 4.3 + Math.sin(ph * 1.7) * 0.9) * 0.016 + Math.sin(ph * 7.9 + 1.3) * 0.006) * (0.85 + 0.3 * (1 - v)) + Math.sin(ph * 1.1) * 0.01;
      p.setXYZ(i, p.getX(i), p.getY(i), fold);
    }
    curtainGeo.computeVertexNormals();
  }
  const curtain = put(room, curtainGeo, M.linen, X1 - 0.075, (WIN.y1 + 0.14) / 2 + 0.01, WIN.z1 + 0.1, { ry: -Math.PI / 2, dynamic: true });
  curtain.userData.base = curtainGeo.attributes.position.array.slice();

  /* ---------------- outside ---------------- */
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uGain: { value: 1.6 }, uSun: { value: SUN.clone() }, uMoon: { value: MOON_VIEW.clone() } },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), skyMat);
  // drawn after the room, so its shader runs only where the window shows it
  sky.renderOrder = 10;
  scene.add(sky);
  // a tree just outside, for parallax through the glass
  const treeMat = new THREE.ShaderMaterial({
    transparent: false,
    uniforms: { uNight: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uNight, uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.55); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
      float fb(vec2 p){ float a=.5,r=0.; for(int i=0;i<5;i++){ r+=a*n(p); p*=2.1; a*=.5;} return r; }
      void main(){
        vec2 p = vUv * vec2(1.0, 1.15);
        float sway = sin(uTime * 0.6 + p.y * 3.0) * 0.004;
        float crown = 1.0 - length((p - vec2(0.42 + sway, 0.72)) * vec2(1.25, 1.6));
        float clump = fb(p * 7.0 + vec2(sway * 20.0, 0.0));
        float a = smoothstep(0.0, 0.05, crown * 0.9 + (clump - 0.5) * 0.9);
        float trunk = (1.0 - smoothstep(0.012, 0.022, abs(p.x - 0.43 - (p.y) * 0.04))) * step(p.y, 0.6);
        a = max(a, trunk);
        if (a < 0.5) discard;
        float lit = smoothstep(0.35, 0.8, fb(p * 5.0 + 3.0)) * smoothstep(0.2, 0.9, p.x + p.y * 0.4);
        vec3 leafD = mix(vec3(0.33, 0.36, 0.17), vec3(0.86, 0.66, 0.26), lit * 0.85 + 0.15 * clump);
        vec3 c = mix(leafD, vec3(0.32, 0.25, 0.2), trunk);
        c = mix(c, vec3(0.8, 0.84, 0.88), 0.2);
        c = mix(c * 1.25, vec3(0.012, 0.014, 0.02), uNight);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const tree = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), treeMat);
  tree.position.set(X1 + 9, 3.2, -4.6);
  tree.rotation.y = -Math.PI / 2 + 0.25;
  tree.visible = false;

  /* ---------------- desk ---------------- */
  const furn = new THREE.Group();
  scene.add(furn);
  const dW = DESK.x1 - DESK.x0, dD = DESK.z1 - DESK.z0, dcx = (DESK.x0 + DESK.x1) / 2, dcz = (DESK.z0 + DESK.z1) / 2;
  put(furn, rbox(dW, DESK.th, dD, 0.006, 3), M.oak, dcx, DESK.top - DESK.th / 2, dcz);
  // black steel trestle legs (two closed frames)
  const legH = DESK.top - DESK.th, lt = 0.03;
  for (const lx of [DESK.x0 + 0.07, DESK.x1 - 0.07]) {
    put(furn, box(lt, legH, lt), M.steel, lx, legH / 2, DESK.z0 + 0.06);
    put(furn, box(lt, legH, lt), M.steel, lx, legH / 2, DESK.z1 - 0.06);
    put(furn, box(lt, lt, dD - 0.12), M.steel, lx, lt / 2 + 0.02, dcz);
    put(furn, box(lt, lt, dD - 0.12), M.steel, lx, legH - lt / 2, dcz);
  }
  put(furn, box(dW - 0.14, 0.02, 0.02), M.steel, dcx, legH - 0.04, DESK.z0 + 0.08);

  /* ---------------- monitor ---------------- */
  const mon = new THREE.Group();
  mon.position.set(1.3, DESK.top, DESK.z0 + 0.27);
  furn.add(mon);
  const mw = 0.615, mh = 0.355;
  put(mon, rbox(0.24, 0.012, 0.18, 0.005), M.alu, 0, 0.006, 0);
  put(mon, rbox(0.045, 0.3, 0.018, 0.006), M.alu, 0, 0.16, -0.045, { rx: -0.08 });
  const panel = new THREE.Group();
  panel.position.set(0, 0.125 + mh / 2, -0.01);
  panel.rotation.x = -0.05;
  mon.add(panel);
  put(panel, rbox(mw + 0.014, mh + 0.016, 0.014, 0.004), M.graphite, 0, 0, 0);
  put(panel, rbox(mw * 0.62, mh * 0.6, 0.03, 0.02), M.graphite, 0, -0.02, -0.02);
  const scr = put(panel, new THREE.PlaneGeometry(mw, mh), M.screen, 0, 0.002, 0.0075, { cast: false });
  scr.userData.dynamic = true;
  const code = new CodeScroll(CODE.split('\n'), reduced);
  const spx = (px) => (px / 1024 - 0.5) * mw, spy = (py) => (0.5 - py / 576) * mh + 0.002;
  M.code = std({ color: '#060607', roughness: 0.16, emissive: new THREE.Color('#ffffff'), emissiveMap: code.tex, emissiveIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  put(panel, new THREE.PlaneGeometry((ED.w / 1024) * mw, (ED.h / 576) * mh), M.code, spx(ED.x + ED.w / 2), spy(ED.y + ED.h / 2), 0.0079, { cast: false, dynamic: true });
  M.graph = std({ color: '#060607', roughness: 0.16, emissive: new THREE.Color('#ffffff'), emissiveMap: screen.graph.tex, emissiveIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  put(panel, new THREE.PlaneGeometry((GRAPH.w / 1024) * mw, (GRAPH.h / 576) * mh), M.graph, spx(GRAPH.x + GRAPH.w / 2), spy(GRAPH.y + GRAPH.h / 2), 0.0079, { cast: false, dynamic: true });
  M.caret = std({ color: '#000000', emissive: new THREE.Color('#8fb3e8'), emissiveIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const caret = put(panel, new THREE.PlaneGeometry((2 / 1024) * mw, (15 / 576) * mh), M.caret, 0, 0, 0.0081, { cast: false, dynamic: true });

  /* ---------------- keyboard, mouse, mat ---------------- */
  const top = DESK.top;
  put(furn, rbox(0.82, 0.003, 0.34, 0.0014), M.felt, 1.28, top + 0.0015, DESK.z1 - 0.21, { cast: false });
  const kb = new THREE.Group();
  kb.position.set(1.22, top + 0.003, DESK.z1 - 0.2);
  kb.rotation.y = 0.03;
  furn.add(kb);
  put(kb, rbox(0.33, 0.018, 0.118, 0.006), M.kbBase, 0, 0.009, 0, { rx: 0.05 });
  {
    const capGeo = rbox(0.0168, 0.009, 0.0168, 0.003, 1);
    const caps = { L: [], D: [], A: [] };
    const pitch = 0.0193;
    const rows = [[15, 0], [15, 0.25], [14, 0.5], [13, 0.75], [10, 1.25]];
    rows.forEach(([cnt, off], r) => {
      for (let c = 0; c < cnt; c++) {
        const x = -0.145 + (c + off) * pitch, z = -0.04 + r * pitch;
        const kind = r === 0 && c === 0 ? 'A' : c === 0 || c === cnt - 1 || r === 4 ? 'D' : 'L';
        caps[kind].push([x, 0.022 + r * 0.0013, z]);
      }
    });
    for (const k of ['L', 'D', 'A']) {
      const im = new THREE.InstancedMesh(capGeo, M['key' + k], caps[k].length);
      const m4 = new THREE.Matrix4();
      caps[k].forEach((p, i) => { m4.makeRotationX(0.05).setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.receiveShadow = true;
      kb.add(im);
    }
    put(kb, rbox(0.105, 0.009, 0.0168, 0.003, 1), M.keyL, -0.02, 0.028, -0.04 + 4 * pitch, { rx: 0.05 });
  }
  const mouse = put(furn, new THREE.SphereGeometry(1, 24, 16), M.keyL, 1.53, top + 0.012, DESK.z1 - 0.2, { ry: 0.12 });
  mouse.scale.set(0.031, 0.016, 0.058);

  /* ---------------- desk lamp (articulated) ---------------- */
  const lamp = new THREE.Group();
  lamp.position.set(0.62, top, DESK.z0 + 0.2);
  lamp.rotation.y = 0.75;
  furn.add(lamp);
  put(lamp, cyl(0.07, 0.075, 0.022, 32), M.black, 0, 0.011, 0);
  const P0 = new THREE.Vector3(0, 0.03, 0);
  const P1 = P0.clone().add(new THREE.Vector3(0, Math.sin(78 * D2R), Math.cos(78 * D2R)).multiplyScalar(0.38));
  const P2 = P1.clone().add(new THREE.Vector3(0, Math.sin(-20 * D2R), Math.cos(-20 * D2R)).multiplyScalar(0.3));
  const rod = (a, b, rad = 0.0065) => {
    const len = a.distanceTo(b);
    const m = put(lamp, cyl(rad, rad, len, 10), M.black, 0, 0, 0);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  };
  for (const s of [-0.012, 0.012]) { rod(P0.clone().setX(s), P1.clone().setX(s)); rod(P1.clone().setX(s), P2.clone().setX(s)); }
  for (const p of [P0, P1, P2]) put(lamp, cyl(0.013, 0.013, 0.036, 16), M.brass, p.x, p.y, p.z, { rz: Math.PI / 2 });
  const head = new THREE.Group();
  head.position.copy(P2);
  head.rotation.x = 2.75; // aims the shade down and forward
  lamp.add(head);
  const shadePts = [[0.014, 0.0], [0.03, 0.01], [0.036, 0.04], [0.05, 0.08], [0.072, 0.13], [0.074, 0.134]];
  put(head, lathe(shadePts, 40), M.black, 0, 0, 0);
  put(head, lathe(shadePts.map(([r, y]) => [r - 0.0025, y]), 40), M.shadeIn, 0, 0, 0, { cast: false });
  const bulb = put(head, new THREE.SphereGeometry(0.022, 20, 14), M.bulb, 0, 0.085, 0, { cast: false });
  const lampLight = new THREE.SpotLight('#ffbf80', 0, 0, 0.95, 0.85, 2);
  lampLight.position.set(0, 0.09, 0);
  head.add(lampLight);
  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, 1.0, 0);
  head.add(lampTarget);
  lampLight.target = lampTarget;
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(lite ? 512 : 1024, lite ? 512 : 1024);
  lampLight.shadow.bias = -0.0004;
  lampLight.shadow.normalBias = 0.004;
  lampLight.shadow.radius = 5;
  lampLight.shadow.camera.near = 0.03;
  lampLight.shadow.camera.far = 4;

  /* ---------------- desk objects ---------------- */
  // closed laptop with notebook in front
  put(furn, rbox(0.304, 0.015, 0.212, 0.006), M.alu, 0.95, top + 0.0075, DESK.z0 + 0.22, { ry: 0.1 });
  const nb = new THREE.Group();
  nb.position.set(0.97, top, DESK.z1 - 0.2);
  nb.rotation.y = -0.18;
  furn.add(nb);
  put(nb, rbox(0.31, 0.006, 0.215, 0.002), M.cover, 0, 0.003, 0);
  {
    const pg = new THREE.PlaneGeometry(0.3, 0.205, 32, 1);
    const p = pg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, 0.006 * Math.exp(-Math.abs(x) / 0.02) + 0.003 * (1 - Math.abs(x) / 0.15)); }
    pg.computeVertexNormals();
    put(nb, pg, M.notebook, 0, 0.0075, 0, { rx: -Math.PI / 2 });
  }
  const pencil = put(nb, cyl(0.0035, 0.0035, 0.17, 6), M.shelfOak, 0.08, 0.013, 0.02, { rz: Math.PI / 2 });
  pencil.rotation.y = 0.6;
  // book stack + a small snake plant on top, by the window
  const deskBooks = [[0, 0.24, 0.032, 0.17], [26, 0.22, 0.026, 0.16], [18, 0.2, 0.022, 0.145]]; // [spine, length, thickness, depth]
  let by = top;
  const stack = deskBooks.map(([spine, len, t, d], i) => {
    const b = { x: 1.86 + (i - 1) * 0.006, y: by + t / 2, z: DESK.z0 + 0.15, t, h: len, d, spine, ry: 0.08 * (i - 1), rz: Math.PI / 2 };
    by += t;
    return b;
  });
  put(furn, booksGeometry(stack), M.books, 0, 0, 0);
  const potS = new THREE.Group();
  potS.position.set(1.86, by, DESK.z0 + 0.15);
  furn.add(potS);
  put(potS, lathe([[0, 0], [0.05, 0], [0.056, 0.01], [0.058, 0.1], [0.05, 0.1], [0.05, 0.088], [0, 0.088]], 32), M.ceramic, 0, 0, 0);
  put(potS, cyl(0.05, 0.05, 0.004, 24), M.soil, 0, 0.088, 0);
  {
    const r = rng(9);
    const snakeMat = std({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const h = 0.2 + r() * 0.17, a = (i / 9) * Math.PI * 2 + r() * 0.4;
      const g = leafGeometry(h, 0.045, false, 0.04);
      const cols = new Float32Array(g.attributes.position.count * 3);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const edge = Math.abs(p.getX(k)) / 0.02;
        const band = 0.5 + 0.5 * Math.sin(p.getY(k) * 90);
        const c = edge > 0.85 ? hexRGB('#b7b45a') : band > 0.6 ? hexRGB('#2f5130') : hexRGB('#3f6a3c');
        cols.set(c, k * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const leaf = put(potS, g, snakeMat, Math.cos(a) * 0.018, 0.085, Math.sin(a) * 0.018, { ry: a + Math.PI / 2 });
      leaf.rotation.order = 'YXZ';
      leaf.rotation.x = 0.08 + r() * 0.16;
    }
  }
  // mug with steam
  const mug = new THREE.Group();
  mug.position.set(1.72, top, DESK.z1 - 0.26);
  furn.add(mug);
  put(mug, lathe([[0, 0.002], [0.036, 0], [0.04, 0.006], [0.042, 0.092], [0.044, 0.096], [0.04, 0.097], [0.038, 0.092], [0.036, 0.012], [0, 0.012]], 40), M.ceramic, 0, 0, 0);
  put(mug, cyl(0.037, 0.037, 0.002, 32), M.coffee, 0, 0.078, 0, { cast: false });
  const handle = put(mug, new THREE.TorusGeometry(0.026, 0.0065, 10, 24, Math.PI), M.ceramic, 0.042, 0.05, 0, { rz: -Math.PI / 2 });
  handle.rotation.y = 0;
  const steamNoise = steamNoiseTexture();
  const steamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uNoise: { value: steamNoise }, uColor: { value: new THREE.Color('#ffffff') }, uOpacity: { value: 0.5 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv;
      vec2 rot(vec2 v, float a){ float s = sin(a), c = cos(a); return mat2(c, s, -s, c) * v; }
      void main(){
        vec3 p = position;
        float tw = texture2D(uNoise, vec2(0.5, uv.y * 0.2 - uTime * 0.005)).r;
        p.xz = rot(p.xz, tw * 10.0);
        vec2 wind = vec2(texture2D(uNoise, vec2(0.25, uTime * 0.01)).r - 0.5, texture2D(uNoise, vec2(0.75, uTime * 0.01)).r - 0.5);
        p.xz += wind * pow(uv.y, 2.0) * 0.12;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        vUv = uv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity; uniform sampler2D uNoise; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 s = vUv; s.x *= 0.5; s.y *= 0.3; s.y -= uTime * 0.03;
        float a = smoothstep(0.42, 1.0, texture2D(uNoise, s).r);
        a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
  });
  const steamGeo = new THREE.PlaneGeometry(0.075, 0.28, 16, 64);
  steamGeo.translate(0, 0.14, 0);
  const steam = put(mug, steamGeo, steamMat, 0, 0.085, 0, { cast: false, receive: false, noAO: true, dynamic: true });
  fx.push(steam);
  // clock (local time), framed print
  const clock = new THREE.Group();
  clock.position.set(0.86, 1.96, Z0 + 0.02);
  scene.add(clock);
  put(clock, cyl(0.15, 0.15, 0.03, 48), M.black, 0, 0, 0.0, { rx: Math.PI / 2 });
  put(clock, new THREE.CircleGeometry(0.138, 48), M.clockFace, 0, 0, 0.0155, { cast: false });
  const hand = (len, wid, mat, z) => {
    const g = new THREE.Group(); g.position.z = z; g.userData.dynamic = true; clock.add(g);
    put(g, box(wid, len, 0.002), mat, 0, len / 2 - 0.015, 0, { cast: false });
    return g;
  };
  const hourH = hand(0.075, 0.007, M.black, 0.018), minH = hand(0.115, 0.005, M.black, 0.02), secH = hand(0.122, 0.0018, M.keyA, 0.022);
  const print = new THREE.Group();
  print.position.set(-0.02, 1.5, Z0 + 0.016);
  scene.add(print);
  put(print, rbox(0.64, 0.84, 0.028, 0.003), M.shelfOak, 0, 0, 0);
  put(print, new THREE.PlaneGeometry(0.6, 0.8), M.print, 0, 0, 0.0145, { cast: false });
  // A new painting fades in on a plane just in front of the mat, then takes
  // its place. That plane is visible (at zero opacity) until the first frame,
  // so its shader compiles with everything else rather than mid-animation.
  const printScale = lite ? 0.75 : 1;
  const firstJob = opts.painting || startPainting(lite);
  M.print.map = tex(printCanvas(null, firstJob.seed, printScale), { aniso: maxAniso });
  const fadeMat = std({ map: M.print.map, roughness: 0.8, transparent: true, opacity: 0, depthWrite: false });
  const fadePlane = put(print, new THREE.PlaneGeometry(0.6, 0.8), fadeMat, 0, 0, 0.0152, { cast: false, dynamic: true, noAO: true });
  fx.push(fadePlane);
  let printJob = null, fade = null;
  // put texture t on the wall; the hidden fade plane mirrors the wall
  function setWall(t) {
    const old = M.print.map;
    if (old === t) return;
    M.print.map = t;
    if (!fade) fadeMat.map = t;
    if (old && old !== fadeMat.map) old.dispose();
  }
  function cancelFade() {
    if (!fade) return;
    fade = null;
    const t = fadeMat.map;
    fadeMat.map = M.print.map;
    if (t !== M.print.map) t.dispose();
    fadePlane.visible = false;
  }
  function showPainting(job, animate) {
    const res = job.result;
    const t = tex(res ? printCanvas(res.image, job.seed, printScale) : topoPrint(), { aniso: maxAniso });
    job.result = res && { seed: res.seed }; // the pixels are in the texture now
    cancelFade();
    if (!animate) { setWall(t); return; }
    fadeMat.map = t; fadeMat.opacity = 0; fadePlane.visible = true;
    fade = { t0: performance.now() };
  }
  function stepFade() {
    if (!fade) return;
    const k = clamp01((performance.now() - fade.t0) / 1400);
    fadeMat.opacity = k * k * (3 - 2 * k);
    if (k < 1) return;
    fade = null;
    setWall(fadeMat.map);
    fadePlane.visible = false;
  }
  // hang the painting from `job` (see startPainting): at once if it is ready,
  // otherwise a blank mat now and the painting fading in when the worker is done
  function hang(job) {
    if (printJob && printJob !== job && printJob.result === undefined) printJob.cancel();
    printJob = job;
    cancelFade();
    if (job.result !== undefined) { showPainting(job, false); return; }
    setWall(tex(printCanvas(null, job.seed, printScale), { aniso: maxAniso }));
    job.promise.then(() => { if (!disposed && printJob === job) showPainting(job, !reduced && frames > 0); });
  }
  printJob = firstJob; // the blank mat for its seed is already up
  if (firstJob.result !== undefined) showPainting(firstJob, false);
  // fade in only if the room is already on screen; before that, just hang it
  else firstJob.promise.then(() => { if (!disposed && printJob === firstJob) showPainting(firstJob, !reduced && frames > 0); });

  /* ---------------- office chair (task chair, mesh back) ---------------- */
  const chair = new THREE.Group();
  chair.position.set(1.22, 0, DESK.z1 + 0.42);
  chair.rotation.y = 0.62; // pulled out and turned, as if someone just got up
  furn.add(chair);
  {
    const seatY = 0.47;
    // five-star base on twin-wheel casters
    put(chair, cyl(0.045, 0.058, 0.07, 28), M.alu, 0, 0.125, 0);
    const legGeo = rbox(0.29, 0.034, 0.048, 0.012, 3);
    {
      const p = legGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = (p.getX(i) + 0.145) / 0.29; // 0 at hub, 1 at tip
        const k = 1 - 0.32 * t;
        p.setY(i, p.getY(i) * k - 0.03 * t);
        p.setZ(i, p.getZ(i) * k);
      }
      legGeo.computeVertexNormals();
    }
    const wheelGeo = cyl(0.026, 0.026, 0.013, 20);
    const r = rng(17);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const ca = Math.cos(a), sa = Math.sin(a);
      put(chair, legGeo, M.alu, ca * 0.175, 0.125, sa * 0.175, { ry: -a });
      const tx = ca * 0.315, tz = sa * 0.315;
      const swivel = r() * Math.PI * 2;
      put(chair, rbox(0.032, 0.03, 0.052, 0.01), M.chairBlack, tx, 0.062, tz, { ry: swivel });
      for (const side of [-1, 1]) {
        const w = put(chair, wheelGeo, M.chairBlack, tx + Math.cos(swivel) * side * 0.012, 0.027, tz - Math.sin(swivel) * side * 0.012, { rz: Math.PI / 2 });
        w.rotation.y = swivel;
        w.rotation.order = 'YXZ';
      }
    }
    // gas lift: black sleeve + chrome piston, tilt mechanism under the seat
    put(chair, cyl(0.032, 0.036, 0.15, 24), M.chairBlack, 0, 0.23, 0);
    put(chair, cyl(0.016, 0.016, 0.12, 20), M.chrome, 0, 0.35, 0);
    put(chair, rbox(0.2, 0.05, 0.24, 0.012), M.chairBlack, 0, seatY - 0.075, 0.02);
    put(chair, cyl(0.007, 0.007, 0.1, 10), M.chairBlack, 0.12, seatY - 0.08, -0.04, { rz: Math.PI / 2 - 0.15 });
    put(chair, rbox(0.46, 0.02, 0.44, 0.008), M.chairBlack, 0, seatY - 0.045, 0.0);
    // upholstered seat: dished top, raised sides, waterfall front edge
    const seatGeo = rbox(0.5, 0.075, 0.48, 0.03, 6);
    {
      const p = seatGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let ny = y;
        if (y > 0) ny -= 0.014 * Math.max(0, 1 - (x * x) / 0.05) * Math.max(0, 1 - (z * z) / 0.05) - 0.008 * Math.pow(Math.abs(x) / 0.25, 4);
        if (z < -0.15) ny -= (z + 0.15) * (z + 0.15) * 1.6;
        p.setY(i, ny);
      }
      seatGeo.computeVertexNormals();
    }
    put(chair, seatGeo, M.fabric, 0, seatY, 0);
    // backrest: S-curved mesh panel in a black frame, on a spine from the mechanism
    const bw = 0.225, bh = 0.54, by0 = seatY + 0.11, bz0 = 0.25;
    const surf = (u, v, out = new THREE.Vector3()) => {
      const hw = bw + 0.022 * v;
      const z = bz0 + 0.1 * v + 0.05 * v * v - 0.032 * Math.exp(-((v - 0.27) * (v - 0.27)) / 0.02) - 0.075 * u * u;
      return out.set(u * hw, by0 + v * bh, z);
    };
    const rim = [];
    const rc = 0.12; // corner rounding in (u, v) space
    const N = 18;
    const corner = (cu, cv, a0) => { for (let k = 0; k <= N; k++) { const a = a0 + (k / N) * (Math.PI / 2); rim.push([cu + Math.cos(a) * rc, cv + Math.sin(a) * rc * 0.5]); } };
    corner(1 - rc, 1 - rc * 0.5, 0); corner(-1 + rc, 1 - rc * 0.5, Math.PI / 2);
    corner(-1 + rc, rc * 0.5, Math.PI); corner(1 - rc, rc * 0.5, Math.PI * 1.5);
    const rimCurve = new THREE.CatmullRomCurve3(rim.map(([u, v]) => surf(u, v)), true);
    put(chair, new THREE.TubeGeometry(rimCurve, 160, 0.013, 10, true), M.chairBlack, 0, 0, 0);
    const meshGeo = new THREE.PlaneGeometry(1, 1, 18, 24);
    {
      const p = meshGeo.attributes.position, tmp = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) * 2 * 0.985, v = 0.006 + (p.getY(i) + 0.5) * 0.988;
        surf(u, v, tmp);
        p.setXYZ(i, tmp.x, tmp.y, tmp.z);
      }
      meshGeo.computeVertexNormals();
    }
    const backMesh = put(chair, meshGeo, M.chairMesh, 0, 0, 0, { cast: false, noAO: true });
    backMesh.renderOrder = 1;
    const spine = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, seatY - 0.06, 0.12), new THREE.Vector3(0, seatY - 0.04, bz0 + 0.06), surf(0, 0.2).add(new THREE.Vector3(0, 0, 0.03)));
    put(chair, new THREE.TubeGeometry(spine, 24, 0.022, 10, false), M.chairBlack, 0, 0, 0);
    put(chair, rbox(0.3, 0.06, 0.035, 0.014), M.chairBlack, 0, by0 + 0.12, surf(0, 0.22).z + 0.03);
    // height-adjustable arms with padded tops
    for (const sx of [-1, 1]) {
      put(chair, rbox(0.06, 0.022, 0.1, 0.008), M.chairBlack, sx * 0.21, seatY - 0.06, 0.05);
      put(chair, rbox(0.032, 0.2, 0.05, 0.01), M.chairBlack, sx * 0.265, seatY + 0.04, 0.05, { rz: sx * 0.04 });
      put(chair, rbox(0.075, 0.03, 0.24, 0.013, 3), M.armPad, sx * 0.27, seatY + 0.15, 0.0, { ry: sx * 0.07 });
    }
  }

  /* ---------------- rug ---------------- */
  put(furn, rbox(2.3, 0.008, 1.6, 0.004), M.rug, 0.95, 0.004, -1.35, { cast: false });

  /* ---------------- bookshelf (back-left) ---------------- */
  const shelf = new THREE.Group();
  shelf.position.set(-1.45, 0, Z0 + 0.17);
  scene.add(shelf);
  const sw = 1.0, sh = 2.02, sd = 0.32, s2 = 0.024;
  for (const s of [-1, 1]) put(shelf, box(s2, sh, sd), M.shelfOak, s * (sw / 2 - s2 / 2), sh / 2, 0);
  const levels = [0.06, 0.45, 0.84, 1.23, 1.62, sh - s2 / 2];
  levels.forEach((y) => put(shelf, box(sw - 2 * s2, s2, sd), M.shelfOak, 0, y, 0));
  put(shelf, box(sw, 0.06, 0.02), M.shelfOak, 0, 0.03, sd / 2 - 0.01);
  {
    const r = rng(23);
    const list = [];
    for (let li = 0; li < 4; li++) {
      const y0 = levels[li] + s2 / 2;
      let x = -sw / 2 + s2 + 0.01;
      const limit = sw / 2 - s2 - 0.01 - (li === 1 ? 0.3 : li === 3 ? 0.36 : 0);
      while (x < limit - 0.03) {
        const w = 0.018 + r() * 0.03, h = 0.2 + r() * 0.12, d = 0.15 + r() * 0.08;
        if (x + w > limit) break;
        const lean = r() < 0.06 && x > -0.3 ? 0.18 : 0;
        // spines near the front edge, a few pushed further in
        const z = sd / 2 - d / 2 - 0.012 - (r() < 0.2 ? 0.02 + r() * 0.03 : r() * 0.008);
        list.push({ x: x + w / 2 + lean * h * 0.5, y: y0 + h / 2 - lean * 0.01, z, t: w, h, d, spine: Math.floor(r() * BOOK_SPINES), rz: -lean });
        x += w + (r() < 0.12 ? 0.02 : 0.001) + lean * h;
      }
    }
    // a lying stack on the second shelf
    let sy = levels[1] + s2 / 2;
    for (let i = 0; i < 4; i++) {
      const t = 0.025 + r() * 0.02;
      list.push({ x: 0.3, y: sy + t / 2, z: 0.01, t, h: 0.22 - i * 0.01, d: 0.16, spine: (i * 5 + 3) % BOOK_SPINES, ry: (r() - 0.5) * 0.08, rz: Math.PI / 2 });
      sy += t;
    }
    put(shelf, booksGeometry(list), M.books, 0, 0, 0);
    // objects
    put(shelf, lathe([[0, 0], [0.045, 0], [0.06, 0.06], [0.04, 0.16], [0.022, 0.2], [0.026, 0.215], [0, 0.215]], 32), M.ceramicDark, -0.24, levels[3] + s2 / 2, 0.02);
    const drone = new THREE.Group();
    drone.position.set(0.28, levels[3] + s2 / 2 + 0.03, 0.0);
    drone.rotation.y = 0.5;
    shelf.add(drone);
    put(drone, rbox(0.08, 0.035, 0.12, 0.01), M.black, 0, 0, 0);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      put(drone, box(0.1, 0.008, 0.012), M.black, sx * 0.05, 0.01, sz * 0.05, { ry: sx * sz * 0.8 });
      put(drone, cyl(0.045, 0.045, 0.003, 24), std({ color: '#9fa3a8', roughness: 0.4, transparent: true, opacity: 0.55 }), sx * 0.085, 0.022, sz * 0.085);
    }
    put(shelf, rbox(0.15, 0.19, 0.012, 0.002), M.black, 0.31, levels[2] + s2 / 2 + 0.095, -0.08, { rx: -0.12 });
    // trophy
    put(shelf, lathe([[0, 0], [0.035, 0], [0.035, 0.02], [0.01, 0.03], [0.008, 0.08], [0.03, 0.1], [0.04, 0.15], [0, 0.15]], 28), M.brass, -0.3, levels[4] + s2 / 2, 0.0);
  }

  /* ---------------- fiddle-leaf fig (front right, by the window) ---------------- */
  const fig = new THREE.Group();
  fig.position.set(1.78, 0, 0.05);
  scene.add(fig);
  put(fig, lathe([[0, 0], [0.16, 0], [0.19, 0.04], [0.2, 0.36], [0.185, 0.36], [0.18, 0.33], [0, 0.33]], 40), M.ceramic, 0, 0, 0);
  put(fig, cyl(0.18, 0.18, 0.01, 32), M.soil, 0, 0.33, 0);
  {
    const r = rng(31);
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.03, 0.8, 0.02), new THREE.Vector3(-0.02, 1.3, -0.03), new THREE.Vector3(0.02, 1.72, 0.0)]);
    put(fig, new THREE.TubeGeometry(trunk, 24, 0.018, 8, false), M.stem, 0, 0, 0);
    const lg = leafGeometry(0.3, 0.22, true);
    const cnt = 30;
    const leafMat = std({ color: '#ffffff', roughness: 0.42, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(lg, leafMat, cnt);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < cnt; i++) {
      const t = 0.18 + (i / cnt) * 0.82;
      const p = trunk.getPoint(t);
      const a = i * 2.39996 + r() * 0.3;
      const out = 0.05 + (1 - t) * 0.08;
      q.setFromEuler(e.set(0.55 + r() * 0.5 - t * 0.25, a, 0, 'YXZ'));
      const s = 0.75 + r() * 0.45 - (t > 0.92 ? 0.3 : 0);
      m4.compose(new THREE.Vector3(p.x + Math.sin(a) * out, p.y, p.z + Math.cos(a) * out), q, new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, m4);
      const k = r();
      im.setColorAt(i, new THREE.Color().setRGB(0.12 + k * 0.05, 0.21 + k * 0.08, 0.1 + k * 0.03));
    }
    im.castShadow = im.receiveShadow = true;
    fig.add(im);
  }

  /* ---------------- floor lamp with a linen drum shade ---------------- */
  const lantern = new THREE.Group();
  lantern.position.set(-0.68, 0, Z0 + 0.3);
  scene.add(lantern);
  put(lantern, cyl(0.12, 0.13, 0.018, 36), M.black, 0, 0.009, 0);
  put(lantern, cyl(0.008, 0.008, 1.42, 10), M.black, 0, 0.72, 0);
  put(lantern, new THREE.CylinderGeometry(0.17, 0.2, 0.28, 48, 1, true), M.shadeLinen, 0, 1.5, 0);
  put(lantern, new THREE.SphereGeometry(0.03, 16, 12), M.bulb, 0, 1.47, 0, { cast: false });
  const lanternLight = new THREE.PointLight('#ffb978', 0, 4.5, 2);
  lanternLight.position.set(0, 1.46, 0);
  lantern.add(lanternLight);

  /* ---------------- lights ---------------- */
  const sun = new THREE.DirectionalLight('#ffe2bf', 0);
  sun.position.copy(SUN).multiplyScalar(9).add(new THREE.Vector3(0, 1.3, 0));
  sun.target.position.set(0, 1.3, 0);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -5.4, right: 5.4, top: 5.4, bottom: -5.4, near: 1, far: 20 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2.2;

  const skyLight = new THREE.RectAreaLight('#dfe8f6', 0, wz, wy);
  skyLight.position.set(X1 + 0.02, wyc, wzc);
  skyLight.lookAt(X1 - 1, wyc, wzc);
  scene.add(skyLight);
  // (the warm bounce off the sunlit floor and wall comes from the room's own
  // environment probe and the hemisphere's ground colour, not extra lights)
  const monLight = new THREE.RectAreaLight('#b9c9ff', 0, mw, mh);
  panel.add(monLight);
  monLight.position.set(0, 0, 0.02);
  monLight.rotation.y = Math.PI;
  const hemi = new THREE.HemisphereLight('#eef2f7', '#bfa98d', 0);
  scene.add(hemi);

  /* ---------------- dust in the sunbeam ---------------- */
  const beamUniforms = {
    uSunTo: { value: SUN.clone() },
    uWin: { value: new THREE.Vector4(WIN.z0, WIN.z1, WIN.y0, WIN.y1) },
    uWinX: { value: WIN.frameX },
    uGrid: { value: new THREE.Vector2(WIN.cols, WIN.rows) },
    uDesk: { value: new THREE.Vector4(DESK.x0, DESK.x1, DESK.z0, DESK.z1) },
    uDeskY: { value: DESK.top },
  };
  const DUST = 220;
  const dustGeo = new THREE.BufferGeometry();
  {
    const r = rng(101);
    const pos = new Float32Array(DUST * 3), seed = new Float32Array(DUST), size = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      pos[i * 3] = lerp(-1.4, X1 - 0.1, r()); pos[i * 3 + 1] = lerp(0.2, WIN.y1, r()); pos[i * 3 + 2] = lerp(Z0 + 0.1, WIN.z1, r());
      seed[i] = r(); size[i] = 1.2 + r() * 1.8;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  }
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...beamUniforms, uTime: { value: 0 }, uPx: { value: 1 }, uAmount: { value: 1 } },
    vertexShader: /* glsl */ `
      ${BEAM_GLSL}
      attribute float aSeed, aSize; uniform float uTime, uPx, uAmount; varying float vA;
      void main(){
        vec3 p = position;
        float s = aSeed * 6.2831;
        p += vec3(sin(uTime * 0.05 + s) * 0.18, sin(uTime * 0.035 + s * 1.7) * 0.14 + cos(uTime * 0.02 + s) * 0.05, cos(uTime * 0.045 + s * 2.3) * 0.18);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx * 7.0 / -mv.z;
        float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + s * 3.0);
        vA = sunLit(p) * tw * uAmount;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = pow(smoothstep(0.5, 0.0, d), 1.6) * vA; if (a < 0.003) discard; gl_FragColor = vec4(vec3(1.0, 0.92, 0.8) * a * 0.4, 1.0); }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.userData.noAO = true;
  scene.add(dust);
  fx.push(dust);

  /* ---------------- static batching: one draw per material ---------------- */
  mergeStatic(scene);

  /* ---------------- day / night rig ---------------- */
  const RIG = {
    day: {
      exposure: 1.28, sun: 11.5, sunColor: '#ffd9ad', sky: 2.8, skyColor: '#e9eef4',
      hemi: 0.44, hemiSky: '#f3f2ee', hemiGround: '#e8cba6', env: 0.74, lamp: 0, lantern: 0, mon: 0.25,
      screen: 0.7, skyGain: 0.5, dust: 1, bloom: 0, steam: 0.5, curtainGlow: 0.08, vignette: 0.12, grain: 0.028,
    },
    night: {
      exposure: 1.24, sun: 0.3, sunColor: '#8aa2d6', sky: 0.95, skyColor: '#4a64a0',
      hemi: 0.44, hemiSky: '#475a85', hemiGround: '#2c251f', env: 0.56, lamp: 0.4, lantern: 0.28, mon: 1.6,
      screen: 1.15, skyGain: 1.0, dust: 0, bloom: 0.2, steam: 0.3, curtainGlow: 0.0, vignette: 0.27, grain: 0.035,
    },
  };
  const cA = new THREE.Color(), cB = new THREE.Color();
  const mixColor = (target, a, b, t) => target.copy(cA.set(a)).lerp(cB.set(b), t);
  let night = opts.dark ? 1 : 0, nightFrom = night, nightTo = night, tStart = 0;

  // Environment probes, one per theme, rendered from inside the room. Until a
  // theme's probe exists an empty one of the same size stands in at zero
  // intensity, so every shader is compiled once, with an environment.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const PROBE = { near: 0.05, far: 220, at: new THREE.Vector3(0.6, 1.25, -1.0) };
  const envNone = pmrem.fromScene(new THREE.Scene(), 0, PROBE.near, PROBE.far);
  const env = { day: null, night: null };

  function applyRig(n) {
    const d = RIG.day, nn = RIG.night;
    const L = (k) => lerp(d[k], nn[k], n);
    const lampOn = smooth(0.35, 0.6, n); // the lamp clicks on as the light goes
    renderer.toneMappingExposure = L('exposure');
    sun.intensity = lerp(d.sun, nn.sun, smooth(0.0, 0.7, n));
    if (n < 0.38) mixColor(sun.color, d.sunColor, '#ff9a5c', smooth(0.0, 0.38, n));
    else mixColor(sun.color, '#ff9a5c', nn.sunColor, smooth(0.38, 0.8, n));
    skyLight.intensity = L('sky'); mixColor(skyLight.color, d.skyColor, nn.skyColor, n);
    hemi.intensity = L('hemi'); mixColor(hemi.color, d.hemiSky, nn.hemiSky, n); mixColor(hemi.groundColor, d.hemiGround, nn.hemiGround, n);
    lampLight.intensity = nn.lamp * lampOn;
    M.bulb.emissiveIntensity = 1.2 * lampOn;
    M.shadeIn.emissiveIntensity = 0.35 * lampOn;
    lanternLight.intensity = nn.lantern * smooth(0.45, 0.75, n);
    M.shadeLinen.emissiveIntensity = 0.16 * smooth(0.45, 0.75, n);
    monLight.intensity = L('mon');
    M.screen.emissiveIntensity = M.code.emissiveIntensity = M.graph.emissiveIntensity = M.caret.emissiveIntensity = L('screen');
    M.linen.emissiveIntensity = lerp(d.curtainGlow, 0, n);
    skyMat.uniforms.uNight.value = n; treeMat.uniforms.uNight.value = n;
    skyMat.uniforms.uGain.value = L('skyGain');
    dustMat.uniforms.uAmount.value = lerp(1, 0, smooth(0, 0.5, n));
    dust.visible = n < 0.5;
    steamMat.uniforms.uOpacity.value = L('steam');
    mixColor(steamMat.uniforms.uColor.value, '#ffffff', '#ffd9b0', n);
    bloom.strength = L('bloom');
    bloom.enabled = !lite && bloom.strength > 0.004; // skipped entirely by day
    finish.uniforms.uVignette.value = L('vignette');
    finish.uniforms.uGrain.value = L('grain');
    finish.uniforms.uNight.value = n;
    const key = n < 0.5 ? 'day' : 'night', probe = env[key];
    scene.environment = (probe || envNone).texture;
    scene.environmentIntensity = probe ? RIG[key].env * Math.abs(n * 2 - 1) : 0;
  }

  /* ---------------- post ---------------- */
  // The scene renders into a half-float target whose depth is a texture, so
  // GTAO can read it instead of drawing the whole room a second time for a
  // normal/depth buffer. AO runs at half resolution and is multiplied
  // straight onto the frame.
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4) });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  class RoomAO extends GTAOPass {
    render(renderer, writeBuffer, readBuffer, dt, mask) {
      const depth = readBuffer.depthTexture;
      if (this.gtaoMaterial.uniforms.tDepth.value !== depth) {
        this.depthTexture = depth;
        this.gtaoMaterial.uniforms.tDepth.value = this.pdMaterial.uniforms.tDepth.value = depth;
      }
      const output = this.output;
      this.output = GTAOPass.OUTPUT.Off; // AO and denoise only, no copy of the frame
      super.render(renderer, writeBuffer, readBuffer, dt, mask);
      this.output = output;
      this.blendMaterial.uniforms.intensity.value = this.blendIntensity;
      this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture;
      this._renderPass(renderer, this.blendMaterial, readBuffer);
    }
  }
  const ao = new RoomAO(scene, camera, 4, 4);
  ao.setGBuffer(rt.depthTexture); // normals are rebuilt from depth
  ao.needsSwap = false;
  ao.blendIntensity = 0.8;
  ao.updateGtaoMaterial({ radius: 0.24, distanceExponent: 1.6, thickness: 1.0, scale: 1.1, samples: lite ? 8 : 12, distanceFallOff: 1 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 2, samples: lite ? 8 : 12 });
  ao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(X0 - 0.1, -0.1, Z0 - 0.1), new THREE.Vector3(X1 + 0.3, H + 0.1, Z1 + 0.1)));
  composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.12, 0.55, 1.0);
  bloom.enabled = false;
  composer.addPass(bloom);
  composer.addPass(new SMAAPass());
  // tone mapping (the renderer's AgX, exactly as OutputPass applies it) and
  // the grade, in one pass: contrast and saturation, split tone, vignette, grain
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGrain: { value: 0.03 }, uVignette: { value: 0.15 }, uNight: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uNight; uniform vec2 uRes; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 c = gl_FragColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.12);
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
        l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // split tone: cool shade, warm light
        vec3 lo = mix(vec3(0.985, 1.0, 1.02), vec3(0.95, 0.985, 1.06), uNight);
        vec3 hi = mix(vec3(1.02, 1.0, 0.975), vec3(1.04, 1.0, 0.95), uNight);
        c *= mix(lo, hi, smoothstep(0.15, 0.85, l));
        vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
        c *= mix(1.0, smoothstep(1.05, 0.25, length(d)), uVignette);
        c += (h(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain * (1.0 - 0.5 * l);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(finish);

  // bake the probe for theme n (0 day, 1 night) if it isn't there yet
  function bakeProbe(n) {
    const key = n >= 0.5 ? 'night' : 'day';
    if (env[key] || disposed) return;
    const keep = night;
    applyRig(key === 'night' ? 1 : 0); // with no probe yet: environment at zero
    const hidden = fx.filter((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    renderer.shadowMap.needsUpdate = true;
    env[key] = pmrem.fromScene(scene, 0.0, PROBE.near, PROBE.far, { position: PROBE.at });
    hidden.forEach((o) => (o.visible = true));
    renderer.shadowMap.needsUpdate = true;
    if (env.day && env.night) { pmrem.dispose(); envNone.dispose(); }
    applyRig(keep);
  }

  /* ---------------- camera framing + motion ---------------- */
  let framing = opts.framing && FRAMINGS[opts.framing] ? opts.framing : 'corner';
  let size = { w: 1, h: 1 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const basePos = new THREE.Vector3();
  let baseYaw = 0, shift = [0, 0];
  function applyFraming() {
    const portrait = size.w / size.h < 0.9;
    const f = framing === 'custom' ? FRAMINGS.custom : FRAMINGS[portrait ? 'portrait' : framing]; // custom: test hook
    basePos.set(...f.pos);
    baseYaw = f.yaw * D2R;
    shift = f.shift;
    camera.fov = f.fov;
    camera.aspect = size.w / size.h;
    camera.setViewOffset(size.w, size.h, -shift[0] * size.w, shift[1] * size.h, size.w, size.h);
    camera.updateProjectionMatrix();
  }
  // pointer parallax, from the window's size (no layout reads per event)
  let lastPointer = 0;
  function onPointer(e) {
    pointer.x = clamp01(e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointer.y = clamp01(e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    lastPointer = performance.now();
  }
  // while the page scrolls, hold the frame and leave the GPU to the browser
  let scrollHold = 0;
  const onScroll = () => { scrollHold = performance.now() + 160; };
  const listen = (on) => {
    const f = on ? window.addEventListener : window.removeEventListener;
    f.call(window, 'pointermove', onPointer, { passive: true });
    f.call(window, 'scroll', onScroll, { passive: true });
  };
  listen(true);

  // Render resolution: device pixels up to 1.5x (1x on the light path) within
  // a pixel budget, times a quality factor that steps down if frames run slow.
  const budget = lite ? 0.75e6 : 1.6e6;
  let quality = 1, dpr = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    size = { w: Math.max(2, Math.round(r.width)), h: Math.max(2, Math.round(r.height)) };
    const cap = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5);
    dpr = Math.max(0.5, Math.min(cap, Math.sqrt(budget / (size.w * size.h))) * quality);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(size.w, size.h);
    const pw = Math.round(size.w * dpr), ph = Math.round(size.h * dpr);
    ao.setSize(Math.max(1, Math.round(pw / 2)), Math.max(1, Math.round(ph / 2)));
    finish.uniforms.uRes.value.set(pw, ph);
    dustMat.uniforms.uPx.value = ph / 900;
    applyFraming();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  resize();

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), steamAt = new THREE.Vector3();
  function updateCamera(t, dt) {
    const k = 1 - Math.exp(-dt * 2.4);
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;
    const drift = reduced ? 0 : 1;
    const yaw = baseYaw + pointer.sx * 0.025 + Math.sin(t * 0.07) * 0.012 * drift;
    const pitch = -pointer.sy * 0.012 + Math.sin(t * 0.05 + 1.3) * 0.004 * drift;
    fwd.set(Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, Math.sin(yaw));
    up.set(0, -pointer.sy * 0.05 + Math.sin(t * 0.13 + 2.0) * 0.012 * drift, 0);
    camera.position.copy(basePos)
      .addScaledVector(right, pointer.sx * 0.1 + Math.sin(t * 0.11) * 0.025 * drift)
      .add(up);
    camera.rotation.set(pitch, -yaw, 0, 'YXZ');
  }

  /* ---------------- animation ---------------- */
  const curtainBase = curtain.userData.base, curtainPos = curtain.geometry.attributes.position;
  let raf = 0, last = 0, t = 0, frames = 0, visible = true, started = false, attached = true, renderedOn = null;
  const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; }, { threshold: 0 });
  io.observe(host);
  const fpsCap = opts.fps || 30;

  function update(dt) {
    t += dt;
    // theme transition ~2.4s
    if (night !== nightTo) {
      const k = clamp01((performance.now() / 1000 - tStart) / 2.4);
      night = lerp(nightFrom, nightTo, k * k * (3 - 2 * k));
      if (k >= 1) night = nightTo;
      applyRig(night);
    }
    updateCamera(t, dt);
    screen.update(t);
    code.update(t);
    stepFade();
    {
      const top = ED.pad + ED.caretLine * ED.lh - code.pos; // caret line, in editor pixels
      const inView = top > 2 && top < ED.h - ED.lh;
      caret.visible = inView && (reduced || Math.floor(t * 2) % 2 === 0);
      if (inView) caret.position.set(spx(ED.x + code.caretX + 1), spy(ED.y + top + 9), 0.0081);
    }
    skyMat.uniforms.uTime.value = t; treeMat.uniforms.uTime.value = t;
    steamMat.uniforms.uTime.value = t;
    dustMat.uniforms.uTime.value = reduced ? 0 : t;
    finish.uniforms.uTime.value = t;
    steam.parent.updateMatrixWorld();
    steam.lookAt(camera.position.x, steam.getWorldPosition(steamAt).y, camera.position.z);
    // a breath of air at the curtain
    if (!reduced) {
      const a = curtainPos.array;
      for (let i = 0; i < a.length; i += 3) {
        const v = (a[i + 1] + (WIN.y1 + 0.14) / 2) / (WIN.y1 + 0.14);
        if (curtainBase[i] === undefined) break;
        const sway = (1 - v) * (1 - v) * (0.012 * Math.sin(t * 0.6 + a[i] * 6) + 0.006 * Math.sin(t * 1.3 + a[i] * 11));
        a[i + 2] = curtainBase[i + 2] + sway;
      }
      curtainPos.needsUpdate = true;
    }
    const now = new Date();
    const sec = now.getSeconds() + now.getMilliseconds() / 1000, min = now.getMinutes() + sec / 60, hr = (now.getHours() % 12) + min / 60;
    secH.rotation.z = -sec / 60 * Math.PI * 2; minH.rotation.z = -min / 60 * Math.PI * 2; hourH.rotation.z = -hr / 12 * Math.PI * 2;
  }

  function renderFrame() {
    renderer.info.reset();
    composer.render();
    frames++;
    if (frames === 1 && !fade) fadePlane.visible = false; // compiled; hidden until a painting fades in
    if (renderedOn !== host) { host.setAttribute('data-rendered', ''); renderedOn = host; }
  }

  let slow = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden || !visible || now < scrollHold) { last = now; return; }
    // full rate while the visitor moves the pointer or something animates;
    // when the room is just idling, 24 fps is plenty
    const busy = now - lastPointer < 3000 || night !== nightTo || fade;
    if (now - last < 1000 / (busy ? fpsCap : Math.min(fpsCap, 24)) - 2) return;
    const gap = now - last;
    const dt = Math.min(0.1, gap / 1000 || 0.016);
    last = now;
    // under ~22 fps for a couple of seconds: step the render resolution down
    if (gap < 500) slow = gap > 46 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 50 && quality > 0.56) { quality = Math.max(0.55, quality * 0.82); resize(); slow = 0; }
    update(dt);
    renderFrame();
  }

  // Bake this theme's probe and draw a frame, then keep drawing. The very
  // first frame has bloom and dust on (at zero strength by day / night) so
  // their shaders compile now, not at a theme switch.
  let warmed = false;
  function draw() {
    bakeProbe(night);
    applyRig(night);
    update(0.016);
    if (!warmed) { bloom.enabled = !lite; dust.visible = true; }
    renderFrame();
    if (!warmed) { warmed = true; applyRig(night); }
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
    // the other theme's probe: when the page is idle (or on demand, in setDark)
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 50));
    setTimeout(() => idle(() => { if (attached && !disposed) bakeProbe(night >= 0.5 ? 0 : 1); }, { timeout: 4000 }), 1500);
  }
  // Start: compile every shader first (in parallel and off the main thread
  // where the browser supports it), then draw, unless the element has left
  // the page meanwhile, in which case adopt() draws when it comes back.
  function start() {
    if (disposed || started) return;
    started = true;
    if (!attached) return;
    draw();
    timing.firstFrame = Math.round(performance.now() - T0);
  }
  const timing = { textures: Math.round(T1 - T0), build: Math.round(performance.now() - T0), compiled: 0, firstFrame: 0 };
  applyRig(night);
  let compiling = Promise.resolve();
  if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) {
    // compile with a render target bound: the scene is only ever drawn into
    // one (the composer's, the probe's), and that picks the shader variant
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    compiling = renderer.compileAsync(scene, camera).catch(() => {});
    renderer.setRenderTarget(prev);
  }
  compiling.then(() => { timing.compiled = Math.round(performance.now() - T0); start(); });

  // free everything on the GPU and release the WebGL context (see dispose)
  function teardown() {
    composer.dispose(); ao.dispose(); bloom.dispose();
    env.day?.dispose(); env.night?.dispose();
    if (!(env.day && env.night)) { pmrem.dispose(); envNone.dispose(); }
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material || [])) {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {
    lite,
    setDark(on) {
      const to = on ? 1 : 0;
      if (to === nightTo) return;
      bakeProbe(to); // needed by the transition's midpoint
      nightFrom = night; nightTo = to; tStart = performance.now() / 1000;
    },
    setFraming(name) { if (FRAMINGS[name]) { framing = name; applyFraming(); } },
    pause() { cancelAnimationFrame(raf); raf = 0; },
    resume() { if (!raf && started) { last = performance.now(); raf = requestAnimationFrame(loop); } },
    // a new painting for the frame (see startPainting)
    hang,
    // Leave the page without tearing down: stop drawing and detach the canvas.
    park() {
      attached = false;
      cancelAnimationFrame(raf); raf = 0;
      ro.disconnect(); io.disconnect();
      listen(false);
      renderer.domElement.remove();
      if (printJob && printJob.result === undefined) printJob.cancel();
      printJob = null; // its callbacks stand down (adopt hangs a new one)
    },
    // Take over a new element: same scene, current theme, a new painting.
    adopt(next, o) {
      attached = true;
      host = next;
      host.appendChild(renderer.domElement);
      ro.observe(host); io.observe(host);
      listen(true);
      if (o.framing && FRAMINGS[o.framing]) framing = o.framing;
      nightFrom = nightTo = night = o.dark ? 1 : 0;
      applyRig(night);
      if (o.painting) hang(o.painting);
      resize();
      visible = true;
      if (started) draw(); // else still compiling: start() draws
    },
    // test hooks
    setCam(f) { FRAMINGS.custom = { ...FRAMINGS[framing], ...f }; framing = 'custom'; applyFraming(); },
    setPointer(x, y) { pointer.x = pointer.sx = x; pointer.y = pointer.sy = y; },
    step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { update(dt); } renderFrame(); },
    jumpTheme(on) { bakeProbe(on ? 1 : 0); nightFrom = nightTo = night = on ? 1 : 0; applyRig(night); },
    setNight(n) { bakeProbe(n); nightFrom = nightTo = night = n; applyRig(n); },
    info() {
      return {
        calls: renderer.info.render.calls, tris: renderer.info.render.triangles, frames, codeScroll: Math.round(code.pos),
        dpr: +dpr.toFixed(3), lite, quality, timing, programs: renderer.info.programs.length, probes: Object.keys(env).filter((k) => env[k]),
        painting: printJob ? { seed: printJob.seed, state: printJob.result === undefined ? 'painting' : printJob.result ? 'hung' : 'fallback', fading: !!fade } : null,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      listen(false);
      if (printJob && printJob.result === undefined) printJob.cancel();
      renderer.domElement.remove();
      // three.js polls a parallel compile until it settles; free the GPU after
      compiling.then(teardown);
    },
  };
}

// Merge every static mesh that shares a material into one draw call.
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic || o.userData.noAO) return;
    if (Array.isArray(o.material) || o.material.isShaderMaterial || o.material.transparent) return;
    let p = o.parent, skip = false;
    while (p) { if (p.userData.dynamic) skip = true; p = p.parent; }
    if (skip) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      return g;
    });
    const hasColor = geos.some((g) => g.attributes.color);
    if (hasColor) geos.forEach((g) => { if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); } });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    root.add(mesh);
    list.forEach((m) => remove.push(m));
  }
  remove.forEach((m) => m.parent && m.parent.remove(m));
}

async function fontsReady() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      Promise.all([document.fonts.load('400 13px "JetBrains Mono"'), document.fonts.load('500 15px "JetBrains Mono"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* fall back to monospace */ }
}

const sceneOptions = (el) => ({
  dark: el.getAttribute('dark') === '1' || el.getAttribute('dark') === 'true',
  framing: el.getAttribute('framing') || 'corner',
  fps: Number(el.getAttribute('fps')) || 30,
  lite: el.hasAttribute('lite') ? el.getAttribute('lite') !== '0' : undefined,
});

// A scene whose element left the page, kept for the next <office-scene> to
// connect (client-side navigation back), with that visit's painting already
// under way. Disposed if nobody comes back for it.
let parked = null;
const KEEP_MS = 3 * 60 * 1000;

class OfficeSceneElement extends HTMLElement {
  static get observedAttributes() { return ['dark', 'framing']; }
  connectedCallback() {
    if (this._booting || this._app) return;
    if (!this.style.display) this.style.display = 'block';
    if (parked) {
      const { app, job, timer } = parked;
      parked = null;
      clearTimeout(timer);
      try {
        app.adopt(this, { ...sceneOptions(this), painting: job });
        this._app = app;
        return;
      } catch (e) {
        console.error('[office-scene]', e);
        job.cancel();
        app.dispose();
      }
    }
    this._booting = true;
    // start the painting before anything else: it runs in a worker while the
    // fonts load and the room is built
    const job = startPainting(isLite(sceneOptions(this).lite));
    fontsReady().then(() => {
      this._booting = false;
      if (!this.isConnected) { job.cancel(); return; }
      try {
        this._app = createApp(this, { ...sceneOptions(this), painting: job });
      } catch (e) {
        job.cancel();
        console.error('[office-scene]', e);
        this.setAttribute('data-error', '');
        this.setAttribute('data-rendered', ''); // never hold the loader hostage
      }
    });
  }
  attributeChangedCallback(name, _o, v) {
    if (!this._app) return;
    if (name === 'dark') this._app.setDark(v === '1' || v === 'true');
    if (name === 'framing') this._app.setFraming(v);
  }
  disconnectedCallback() {
    const app = this._app;
    if (!app) return;
    this._app = null;
    if (parked) { clearTimeout(parked.timer); parked.job.cancel(); parked.app.dispose(); }
    app.park();
    const entry = { app, job: startPainting(app.lite), timer: 0 };
    entry.timer = setTimeout(() => {
      if (parked !== entry) return;
      parked = null;
      entry.job.cancel();
      app.dispose();
    }, KEEP_MS);
    parked = entry;
  }
  get app() { return this._app; }
}
if (!customElements.get('office-scene')) customElements.define('office-scene', OfficeSceneElement);

export { OfficeSceneElement };
