'use strict';

// ════════════════════════════════════════════════════════
//  STATE & NAVIGATION
// ════════════════════════════════════════════════════════
const TOTAL = 19;
let current = 1;

function showSlide(n) {
  document.getElementById(`slide-${current}`).classList.remove('active');
  current = Math.max(1, Math.min(TOTAL, n));
  document.getElementById(`slide-${current}`).classList.add('active');
  document.getElementById('slide-counter').textContent = `${current} / ${TOTAL}`;
  document.getElementById('btn-prev').disabled = current === 1;
  document.getElementById('btn-next').disabled = current === TOTAL;
}

function navigate(dir) { showSlide(current + dir); }

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(-1);
});
document.getElementById('btn-prev').addEventListener('click', () => navigate(-1));
document.getElementById('btn-next').addEventListener('click', () => navigate(1));

// ════════════════════════════════════════════════════════
//  VIEWPORT SCALING
// ════════════════════════════════════════════════════════
function scaleViewport() {
  const vp = document.getElementById('slide-viewport');
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const ox = (window.innerWidth  - 1920 * scale) / 2;
  const oy = (window.innerHeight - 1080 * scale) / 2;
  vp.style.transform = `scale(${scale})`;
  vp.style.position  = 'absolute';
  vp.style.left      = `${ox}px`;
  vp.style.top       = `${oy}px`;
}

window.addEventListener('resize', scaleViewport);
scaleViewport();

// ════════════════════════════════════════════════════════
//  KATEX
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  renderMathInElement(document.body, {
    delimiters: [
      { left: '\\(',  right: '\\)',  display: false },
      { left: '\\[',  right: '\\]',  display: true  },
    ],
    throwOnError: false,
    strict: false,
  });

  // Draw all graphs after math rendering
  requestAnimationFrame(() => {
    drawSlide3Graph();
    drawHxGraph();
    drawLambertWGraph();
    drawTowerGraph();
    initGraph4();
    initGraph9();
  });
});

// ════════════════════════════════════════════════════════
//  LAMBERT W  (numerical, principal branch W₀ and W₋₁)
// ════════════════════════════════════════════════════════
function lambertW0(x) {
  if (x < -1 / Math.E - 1e-14) return NaN;
  if (Math.abs(x) < 1e-15) return 0;
  // Initial guess
  let w;
  if (x >= 0) {
    w = x < 1 ? x * (1 - x * 0.5) : Math.log(x) - Math.log(Math.log(x + 1) + 1);
  } else {
    const p = Math.sqrt(2 * (Math.E * x + 1));
    w = -1 + p - p * p / 3 + (11 / 72) * p * p * p;
  }
  // Halley iterations
  for (let i = 0; i < 80; i++) {
    const ew  = Math.exp(w);
    const wew = w * ew;
    const f   = wew - x;
    const df  = ew * (w + 1);
    const d2f = ew * (w + 2);
    const dw  = f / (df - f * d2f / (2 * df));
    w -= dw;
    if (!isFinite(w)) break;
    if (Math.abs(dw) < 1e-12 * (1 + Math.abs(w))) break;
  }
  return w;
}

function lambertWm1(x) {
  if (x >= 0 || x < -1 / Math.E - 1e-14) return NaN;
  let w;
  if (x > -0.1) {
    const p = Math.sqrt(2 * (Math.E * x + 1));
    w = -1 - p - (p * p) / 3;
  } else {
    const ml = Math.log(-x);
    w = ml - Math.log(-ml + 1e-200);
  }
  for (let i = 0; i < 100; i++) {
    const ew  = Math.exp(w);
    const wew = w * ew;
    const f   = wew - x;
    const df  = ew * (w + 1);
    const d2f = ew * (w + 2);
    const denom = df - f * d2f / (2 * df);
    if (!isFinite(denom) || Math.abs(denom) < 1e-15) break;
    const dw = f / denom;
    w -= dw;
    if (!isFinite(w)) break;
    if (Math.abs(dw) < 1e-12 * (1 + Math.abs(w))) break;
  }
  return w;
}

// ════════════════════════════════════════════════════════
//  GRAPH HELPER CLASS
// ════════════════════════════════════════════════════════
class Graph {
  constructor(id, { xMin, xMax, yMin, yMax }) {
    this.canvas = document.getElementById(id);
    if (!this.canvas) return;
    this.ctx  = this.canvas.getContext('2d');
    this.W    = this.canvas.width;
    this.H    = this.canvas.height;
    this.xMin = xMin; this.xMax = xMax;
    this.yMin = yMin; this.yMax = yMax;
  }

  wx(x) { return (x - this.xMin) / (this.xMax - this.xMin) * this.W; }
  wy(y) { return (this.yMax - y) / (this.yMax - this.yMin) * this.H; }

  clear(bg = '#ffffff') {
    const { ctx, W, H } = this;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  drawGrid(stepX = 1, stepY = 1) {
    const { ctx, W, H } = this;
    ctx.beginPath();
    ctx.strokeStyle = '#ebebed';
    ctx.lineWidth = 1;
    for (let x = Math.floor(this.xMin); x <= this.xMax + 0.01; x += stepX) {
      const cx = this.wx(x);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    }
    for (let y = Math.floor(this.yMin); y <= this.yMax + 0.01; y += stepY) {
      const cy = this.wy(y);
      ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    }
    ctx.stroke();
  }

  drawAxes(color = '#bbb') {
    const { ctx, W, H } = this;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (this.yMin <= 0 && this.yMax >= 0) {
      ctx.moveTo(0, this.wy(0));  ctx.lineTo(W, this.wy(0));
    }
    if (this.xMin <= 0 && this.xMax >= 0) {
      ctx.moveTo(this.wx(0), 0);  ctx.lineTo(this.wx(0), H);
    }
    ctx.stroke();
  }

  drawCurve(f, color, lw = 2.5, steps = 800) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    let pen = false;
    for (let i = 0; i <= steps; i++) {
      const x  = this.xMin + (this.xMax - this.xMin) * i / steps;
      const y  = f(x);
      const ok = isFinite(y) && y >= this.yMin - 0.8 && y <= this.yMax + 0.8;
      if (!ok) { pen = false; continue; }
      const cx = this.wx(x), cy = this.wy(y);
      pen ? ctx.lineTo(cx, cy) : (ctx.moveTo(cx, cy), (pen = true));
    }
    ctx.stroke();
  }

  drawDash(f, color, lw = 2) {
    this.ctx.setLineDash([12, 8]);
    this.drawCurve(f, color, lw);
    this.ctx.setLineDash([]);
  }

  dot(x, y, color, r = 7) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(this.wx(x), this.wy(y), r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  text(x, y, str, color = '#333', dx = 10, dy = -10, size = 18) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `${size}px "IBM Plex Sans KR","IBM Plex Sans",sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(str, this.wx(x) + dx, this.wy(y) + dy);
  }

  ticksX(vals, labelFn, dy = 22, size = 18) {
    const { ctx } = this;
    ctx.fillStyle = '#999';
    ctx.font = `${size}px "IBM Plex Sans",sans-serif`;
    ctx.textAlign = 'center';
    for (const v of vals) ctx.fillText(labelFn(v), this.wx(v), this.wy(0) + dy);
  }

  ticksY(vals, labelFn, dx = -8, size = 18) {
    const { ctx } = this;
    ctx.fillStyle = '#999';
    ctx.font = `${size}px "IBM Plex Sans",sans-serif`;
    ctx.textAlign = 'right';
    for (const v of vals) ctx.fillText(labelFn(v), this.wx(0) + dx, this.wy(v) + 6);
  }
}

// ════════════════════════════════════════════════════════
//  NUMERIC ZERO-FINDING  (sign-change bisection)
// ════════════════════════════════════════════════════════
function findZeros(f, xMin, xMax, steps = 3000) {
  const zeros = [];
  const dx = (xMax - xMin) / steps;
  let px = xMin, pf = f(xMin);
  for (let i = 1; i <= steps; i++) {
    const x  = xMin + i * dx;
    const fx = f(x);
    if (isFinite(pf) && isFinite(fx) && pf * fx < 0) {
      let lo = px, hi = x;
      for (let j = 0; j < 60; j++) {
        const m = (lo + hi) / 2;
        (f(lo) * f(m) <= 0) ? (hi = m) : (lo = m);
      }
      zeros.push((lo + hi) / 2);
    }
    px = x; pf = fx;
  }
  return zeros;
}

// ════════════════════════════════════════════════════════
//  SLIDE 3 — Four piecewise functions f(x), g(x)
// ════════════════════════════════════════════════════════
function drawSlide3Graph() {
  // Find k ∈ (-2,-1): continuity requires 2^(-(k+2)) = -log₂(k+2)
  // Let t = k+2 ∈ (0,1): solve 2^(-t) = log₂(1/t) by bisection
  let lo = 0.01, hi = 0.99;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    (Math.pow(2, -m) - Math.log2(1 / m) > 0) ? (hi = m) : (lo = m);
  }
  const K  = (lo + hi) / 2 - 2;  // ≈ −1.358
  const NK = -K;                   // ≈ +1.358

  const g = new Graph('canvas-slide3', { xMin: -6.5, xMax: 6.5, yMin: -6.5, yMax: 6.5 });
  if (!g.canvas) return;

  g.clear('#fafafa');
  g.drawGrid(1, 1);
  g.drawAxes('#bbb');

  const BLUE      = '#0066cc';
  const RED       = '#c0392b';
  const BLUE_DASH = 'rgba(0,102,204,0.42)';
  const RED_DASH  = 'rgba(192,57,43,0.42)';

  // f₁(x) = 2^(−x−2) − 2
  const f1 = x => Math.pow(2, -x - 2) - 2;
  // f₂(x) = −log₂(x+2) − 2  [x > −2]
  const f2 = x => x > -2 ? -Math.log2(x + 2) - 2 : NaN;
  // g₁(x) = log₂(2−x) + 2   [x < 2]
  const g1 = x => x < 2 ? Math.log2(2 - x) + 2 : NaN;
  // g₂(x) = −2^(x−2) + 2
  const g2 = x => -Math.pow(2, x - 2) + 2;

  // Dashed: outside piecewise domain
  g.drawDash(x => x >= K            ? f1(x) : NaN, BLUE_DASH, 2.5);
  g.drawDash(x => x < K && x > -2  ? f2(x) : NaN, BLUE_DASH, 2.5);
  g.drawDash(x => x >= NK && x < 2 ? g1(x) : NaN, RED_DASH,  2.5);
  g.drawDash(x => x < NK           ? g2(x) : NaN, RED_DASH,  2.5);

  // Solid: within piecewise domain
  g.drawCurve(x => x < K  ? f1(x) : NaN, BLUE, 3.5);
  g.drawCurve(x => x >= K ? f2(x) : NaN, BLUE, 3.5);
  g.drawCurve(x => x < NK ? g1(x) : NaN, RED,  3.5);
  g.drawCurve(x => x >= NK ? g2(x) : NaN, RED, 3.5);

  const { ctx } = g;

  // Vertical guide lines at x = K and x = NK
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.strokeStyle = '#d0d0d4';
  ctx.lineWidth = 1;
  ctx.moveTo(g.wx(K),  0); ctx.lineTo(g.wx(K),  g.H);
  ctx.moveTo(g.wx(NK), 0); ctx.lineTo(g.wx(NK), g.H);
  ctx.stroke();
  ctx.restore();

  // Integer tick labels (skip ±1 — too close to k labels)
  ctx.save();
  ctx.fillStyle = '#aaa';
  ctx.font = '18px "IBM Plex Sans",sans-serif';
  ctx.textAlign = 'center';
  [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6].forEach(v => {
    ctx.fillText(v, g.wx(v), g.wy(0) + 24);
  });
  ctx.textAlign = 'right';
  [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].forEach(v => {
    ctx.fillText(v, g.wx(0) - 7, g.wy(v) + 6);
  });
  ctx.restore();

  // k and −k labels + small tick marks
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.moveTo(g.wx(K),  g.wy(0) - 6); ctx.lineTo(g.wx(K),  g.wy(0) + 6);
  ctx.moveTo(g.wx(NK), g.wy(0) - 6); ctx.lineTo(g.wx(NK), g.wy(0) + 6);
  ctx.stroke();
  ctx.fillStyle = '#555';
  ctx.font = '20px "IBM Plex Sans KR","IBM Plex Sans",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('k',  g.wx(K),  g.wy(0) + 26);
  ctx.fillText('−k', g.wx(NK), g.wy(0) + 26);
  ctx.restore();
}

// ════════════════════════════════════════════════════════
//  SLIDE 4 — Interactive graph  y=aˣ  vs  y=logₐ(x)
//  Equal-scale axes, auto-adjusting view
// ════════════════════════════════════════════════════════

const CANVAS_W4 = 1200, CANVAS_H4 = 500;
const ASPECT4   = CANVAS_W4 / CANVAS_H4;   // 2.4
const CANVAS_W9 = 690, CANVAS_H9 = 360;
const ASPECT9   = CANVAS_W9 / CANVAS_H9;
const SPECIAL_A_LOWER4 = Math.exp(-Math.E);
const SPECIAL_A_UPPER4 = Math.exp(1 / Math.E);

/** Compute a nice grid step for a given axis range */
function niceStep(range) {
  if (range <= 0) return 1;
  const raw  = range / 7;                         // aim ~7 gridlines
  const exp  = Math.floor(Math.log10(raw));
  const norm = raw / Math.pow(10, exp);
  const step = norm <= 1.5 ? 1 : norm <= 3.5 ? 2 : norm <= 7.5 ? 5 : 10;
  return step * Math.pow(10, exp);
}

/** Format a tick label: trim trailing zeros, avoid -0 */
function fmtTick(v, step) {
  if (Math.abs(v) < step * 1e-9) return '0';
  const dec = Math.max(0, -Math.floor(Math.log10(step)) + 0);
  return v.toFixed(dec);
}

/** Draw adaptive axis tick labels directly on a Graph canvas */
function drawTicks4(g, step) {
  const { ctx, W, H } = g;
  ctx.save();
  ctx.fillStyle = '#888';
  ctx.font = '19px "IBM Plex Sans",sans-serif';

  // Positions of axes on canvas
  const axY = (g.yMin <= 0 && g.yMax >= 0) ? Math.min(g.wy(0) + 22, H - 8) : H - 8;
  const axX = (g.xMin <= 0 && g.xMax >= 0) ? Math.max(g.wx(0) - 9, 42) : 42;

  // X ticks
  ctx.textAlign = 'center';
  let x = Math.ceil(g.xMin / step) * step;
  while (x <= g.xMax + step * 1e-9) {
    const px = g.wx(x);
    if (px > 22 && px < W - 10) {
      ctx.fillText(fmtTick(x, step), px, axY);
    }
    x += step;
    if (x > 1e9) break; // safety
  }

  // Y ticks
  ctx.textAlign = 'right';
  let y = Math.ceil(g.yMin / step) * step;
  while (y <= g.yMax + step * 1e-9) {
    const py = g.wy(y);
    if (py > 10 && py < H - 5) {
      ctx.fillText(fmtTick(y, step), axX, py + 7);
    }
    y += step;
    if (y > 1e9) break;
  }
  ctx.restore();
}

function drawPositiveCurveNearZero(g, f, color, lw = 3, steps = 1600) {
  const { ctx } = g;
  const lo = Math.max(1e-10, g.xMin > 0 ? g.xMin : 1e-10);
  const hi = g.xMax;
  if (hi <= lo) return;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  let pen = false;
  const logLo = Math.log(lo);
  const logHi = Math.log(hi);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.exp(logLo + (logHi - logLo) * t);
    const y = f(x);
    const ok = isFinite(y) && y >= g.yMin - 0.8 && y <= g.yMax + 0.8;
    if (!ok) { pen = false; continue; }
    const cx = g.wx(x), cy = g.wy(y);
    pen ? ctx.lineTo(cx, cy) : (ctx.moveTo(cx, cy), (pen = true));
  }
  ctx.stroke();
}

/** Fixed-point intersections for a > 1 using Lambert W. */
function increasingIntersections4(a) {
  const lna = Math.log(a);
  if (lna <= 0) return [];
  const eta = -lna;
  if (eta < -1 / Math.E - 1e-12 || eta >= 0) return [];

  const pts = [];
  const w0 = lambertW0(eta);
  if (isFinite(w0)) {
    const x = -w0 / lna;
    pts.push({ x, y: x });
  }

  const wm1 = lambertWm1(eta);
  if (isFinite(wm1)) {
    const x = -wm1 / lna;
    if (!pts.some(p => Math.abs(p.x - x) < 1e-6 * Math.max(1, Math.abs(x)))) {
      pts.push({ x, y: x });
    }
  }

  return pts.sort((p, q) => p.x - q.x);
}

function intersectionPointsForA(a) {
  const lna = Math.log(a);
  const eps = 1e-8;
  if (Math.abs(lna) <= eps) return [];

  if (a > 1) return increasingIntersections4(a);

  const lo = 5e-5;
  const hi = 1.05; // for a<1, all intersections are in (0,1)
  const f = x => x > lo ? Math.pow(a, x) - Math.log(x) / lna : NaN;
  const zeros = findZeros(f, lo, hi, 12000);
  const pts = zeros.map(x => ({ x, y: Math.pow(a, x) }));

  if (Math.abs(a - SPECIAL_A_LOWER4) < 1e-10) {
    return [{ x: 1 / Math.E, y: 1 / Math.E }];
  }
  return pts;
}

/** Compute auto-view for the graph so intersections are comfortably framed.
 *  Returns {xMin,xMax,yMin,yMax} with equal scale (xRange/yRange = ASPECT4). */
function autoView4(a, intPts, aspect = ASPECT4) {
  const hy0 = 2.5; // fallback half-size in y

  if (intPts.length === 0) {
    let cx = 2, cy = 2, hy = hy0;
    if (a < 1) { cx = 0.5; cy = 0.5; hy = 1.2; }
    return { xMin: cx - hy*aspect, xMax: cx + hy*aspect, yMin: cy-hy, yMax: cy+hy };
  }

  const xs  = intPts.map(p => p.x);
  const ys  = intPts.map(p => p.y);
  const mnX = Math.min(...xs), mxX = Math.max(...xs);
  const mnY = Math.min(...ys), mxY = Math.max(...ys);
  const cx  = (mnX + mxX) / 2;
  const cy  = (mnY + mxY) / 2;
  const dX  = mxX - mnX, dY = mxY - mnY;

  // Required half-sizes with 55% padding on each side of span
  const rHX = Math.max(dX / 2, 0.25) * 1.55;
  const rHY = Math.max(dY / 2, 0.25) * 1.55;

  // Choose hy so both axes fit with equal scale: hx = hy * ASPECT4
  const hy  = Math.max(rHY, rHX / aspect, 0.4);
  const hx  = hy * aspect;

  return { xMin: cx-hx, xMax: cx+hx, yMin: cy-hy, yMax: cy+hy };
}

function initGraph4() {
  const slider = document.getElementById('a-slider');
  if (!slider) return;
  slider.addEventListener('input', () => drawGraph4(+slider.value));
  document.querySelectorAll('.special-point-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.specialA === 'lower' ? SPECIAL_A_LOWER4 : SPECIAL_A_UPPER4;
      slider.value = String(a);
      drawGraph4(a);
    });
  });
  drawGraph4(+slider.value);
}

function drawGraph4(a) {
  const lna = Math.log(a);
  const eps = 1e-8;

  /* ── 1. Find all intersections of y=aˣ and y=logₐ(x) ── */
  const intPts = intersectionPointsForA(a);

  /* ── 2. Auto view with equal scale ── */
  const view = autoView4(a, intPts);
  const g    = new Graph('canvas-slide4', view);
  if (!g.canvas) return;

  /* ── 3. Draw ── */
  g.clear('#fafafa');

  const xRange = view.xMax - view.xMin;
  const yRange = view.yMax - view.yMin;
  const unitStep = niceStep(Math.min(xRange, yRange));
  g.drawGrid(unitStep, unitStep);
  g.drawAxes('#ccc');

  // y = x  (dashed gray)
  g.drawDash(x => x, '#bbb', 2);

  // y = aˣ  (blue, 1000 samples for smooth render)
  g.drawCurve(x => Math.pow(a, x), '#0066cc', 3.5, 1000);

  // y = logₐ(x)  (red)
  if (Math.abs(lna) > eps) {
    drawPositiveCurveNearZero(g, x => Math.log(x) / lna, '#c0392b', 3.5, 1800);
  }

  // Intersection dots + coordinate labels
  intPts.forEach((p, i) => {
    g.dot(p.x, p.y, '#ff6b00', 10);
    // Small coordinate label
    if (intPts.length <= 4) {
      const xs = p.x, ys = p.y;
      const lx = Math.abs(xs) < 10 ? xs.toFixed(3) : xs.toFixed(1);
      const ly = Math.abs(ys) < 10 ? ys.toFixed(3) : ys.toFixed(1);
      const dx = 14, dy = p.y > (view.yMin + view.yMax) / 2 ? -18 : 26;
      g.text(p.x, p.y, `(${lx}, ${ly})`, '#cc4400', dx, dy, 19);
    }
  });

  // Adaptive tick labels
  drawTicks4(g, unitStep);

  /* ── 4. Update UI ── */
  const aElem   = document.getElementById('a-value');
  const infoElem = document.getElementById('intersect-info');
  document.querySelectorAll('.special-point-btn').forEach(btn => {
    const isLower = btn.dataset.specialA === 'lower';
    const isActive = Math.abs(a - (isLower ? SPECIAL_A_LOWER4 : SPECIAL_A_UPPER4)) < 1e-10;
    btn.classList.toggle('active', isActive);
  });
  if (aElem) aElem.textContent =
    Math.abs(a - SPECIAL_A_LOWER4) < 1e-10 ? SPECIAL_A_LOWER4.toFixed(4) :
    Math.abs(a - SPECIAL_A_UPPER4) < 1e-10 ? SPECIAL_A_UPPER4.toFixed(4) :
    a.toFixed(3);

  let note = '';
  if (Math.abs(a - 1) < 1e-4) {
    note = '— a = 1 (퇴화)';
  } else if (a < 1) {
    if      (Math.abs(a - SPECIAL_A_LOWER4) < 1e-10) note = `— a = e⁻ᵉ ≈ ${SPECIAL_A_LOWER4.toFixed(4)}: 접점 (1/e, 1/e)`;
    else if (a < SPECIAL_A_LOWER4 - 0.001)  note = `— a < e⁻ᵉ ≈ ${SPECIAL_A_LOWER4.toFixed(4)}: 교점 3개`;
    else if (a < SPECIAL_A_LOWER4 + 0.002)  note = `— a ≈ e⁻ᵉ (경계, 1→3)`;
    else                        note = `— e⁻ᵉ ≤ a < 1: 교점 1개`;
  } else {
    if      (Math.abs(a - SPECIAL_A_UPPER4) < 1e-10) note = `— a = e^(1/e) ≈ ${SPECIAL_A_UPPER4.toFixed(4)}: 접점 (e, e)`;
    else if (a < SPECIAL_A_UPPER4 - 0.003) note = `— 1 < a < e^(1/e) ≈ ${SPECIAL_A_UPPER4.toFixed(4)}: 교점 2개`;
    else if (a < SPECIAL_A_UPPER4 + 0.01)  note = `— a ≈ e^(1/e) (접점)`;
    else                        note = `— a > e^(1/e): 교점 없음`;
  }
  if (infoElem) infoElem.innerHTML =
    `교점 개수: <strong>${intPts.length}개</strong>&emsp;<span style="color:#6e6e73;font-size:27px;">${note}</span>`;
}

function initGraph9() {
  const slider = document.getElementById('a-slider-9');
  if (!slider) return;
  slider.addEventListener('input', () => drawGraph9(+slider.value));
  document.querySelectorAll('.slide9-special-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.getAttribute('data-special-a-9') === 'lower' ? SPECIAL_A_LOWER4 : SPECIAL_A_UPPER4;
      slider.value = String(a);
      drawGraph9(a);
    });
  });
  drawGraph9(+slider.value);
}

function drawGraph9(a) {
  const lna = Math.log(a);
  const eps = 1e-8;
  const intPts = intersectionPointsForA(a);
  const view = autoView4(a, intPts, ASPECT9);
  const g = new Graph('canvas-slide9', view);
  if (!g.canvas) return;

  g.clear('#fafafa');
  const unitStep = niceStep(Math.min(view.xMax - view.xMin, view.yMax - view.yMin));
  g.drawGrid(unitStep, unitStep);
  g.drawAxes('#ccc');
  g.drawDash(x => x, '#bbb', 1.8);
  g.drawCurve(x => Math.pow(a, x), '#0066cc', 2.8, 900);
  if (Math.abs(lna) > eps) {
    drawPositiveCurveNearZero(g, x => Math.log(x) / lna, '#c0392b', 2.8, 1500);
  }
  intPts.forEach(p => g.dot(p.x, p.y, '#ff6b00', 8));
  drawTicks4(g, unitStep);

  const aElem = document.getElementById('a-value-9');
  const infoElem = document.getElementById('intersect-info-9');
  document.querySelectorAll('.slide9-special-btn').forEach(btn => {
    const isLower = btn.getAttribute('data-special-a-9') === 'lower';
    const isActive = Math.abs(a - (isLower ? SPECIAL_A_LOWER4 : SPECIAL_A_UPPER4)) < 1e-10;
    btn.classList.toggle('active', isActive);
  });
  if (aElem) aElem.textContent =
    Math.abs(a - SPECIAL_A_LOWER4) < 1e-10 ? SPECIAL_A_LOWER4.toFixed(4) :
    Math.abs(a - SPECIAL_A_UPPER4) < 1e-10 ? SPECIAL_A_UPPER4.toFixed(4) :
    a.toFixed(3);
  if (infoElem) {
    const region =
      Math.abs(a - 1) < 1e-4 ? 'a = 1' :
      Math.abs(a - SPECIAL_A_LOWER4) < 1e-10 ? 'a = e⁻ᵉ' :
      a < SPECIAL_A_LOWER4 ? '0 < a < e⁻ᵉ' :
      a < 1 ? 'e⁻ᵉ ≤ a < 1' :
      Math.abs(a - SPECIAL_A_UPPER4) < 1e-10 ? 'a = e^(1/e)' :
      a < SPECIAL_A_UPPER4 ? '1 < a < e^(1/e)' :
      Math.abs(a - SPECIAL_A_UPPER4) < 0.001 ? 'a ≈ e^(1/e)' :
      'a > e^(1/e)';
    infoElem.innerHTML = `교점 <strong>${intPts.length}개</strong><span style="font-size:22px;"> &nbsp;${region}</span>`;
  }
}

// ════════════════════════════════════════════════════════
//  SLIDE 6 — h(x) = ln(x)/x
// ════════════════════════════════════════════════════════
function drawHxGraph() {
  const g = new Graph('canvas-hx', { xMin: 0.05, xMax: 8, yMin: -0.18, yMax: 0.58 });
  if (!g.canvas) return;
  g.clear();
  g.drawGrid(1, 0.1);

  // Axes
  const { ctx, W, H } = g;
  ctx.beginPath(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.5;
  ctx.moveTo(g.wx(0.05), g.wy(0)); ctx.lineTo(W, g.wy(0));
  ctx.stroke();

  // h(x)
  g.drawCurve(x => x > 0.05 ? Math.log(x) / x : NaN, '#0066cc', 3);

  // Max at (e, 1/e)
  g.dot(Math.E, 1 / Math.E, '#c0392b', 7);

  // Dashed guide at y = 1/e
  ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
  ctx.moveTo(g.wx(0.05), g.wy(1 / Math.E)); ctx.lineTo(W, g.wy(1 / Math.E));
  ctx.stroke(); ctx.setLineDash([]);

  // Labels
  ctx.fillStyle = '#c0392b'; ctx.font = '18px "IBM Plex Sans",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('1/e', g.wx(0.2), g.wy(1 / Math.E) - 6);
  ctx.fillText('(e, 1/e)', g.wx(Math.E) + 10, g.wy(1 / Math.E) - 8);

  // x ticks
  g.ticksX([1, 2, 3, 4, 5, 6, 7], v => v === 3 ? 'e≈2.72' : v, 22, 16);
}

// ════════════════════════════════════════════════════════
//  SLIDE 8 — Lambert W graph
// ════════════════════════════════════════════════════════
function drawLambertWGraph() {
  const g = new Graph('canvas-lambertw', { xMin: -0.95, xMax: 2.5, yMin: -3.8, yMax: 2.6 });
  if (!g.canvas) return;
  g.clear();
  g.drawGrid(1, 1);
  g.drawAxes('#bbb');

  // W₀ branch
  g.drawCurve(x => x >= -1 / Math.E ? lambertW0(x)  : NaN, '#0066cc', 3.5, 1200);

  // W₋₁ branch
  g.drawCurve(x => (x >= -1/Math.E && x < 0) ? lambertWm1(x) : NaN, '#c0392b', 3.5, 1200);

  // Branch point (-1/e, -1)
  g.dot(-1 / Math.E, -1, '#1d1d1f', 8);

  // Origin
  g.dot(0, 0, '#0066cc', 6);

  // Dashed vertical at x = -1/e
  const { ctx } = g;
  ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
  ctx.moveTo(g.wx(-1 / Math.E), 0); ctx.lineTo(g.wx(-1 / Math.E), g.H);
  ctx.stroke(); ctx.setLineDash([]);

  // Labels
  ctx.fillStyle = '#555'; ctx.font = '17px "IBM Plex Sans",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('-1/e', g.wx(-1 / Math.E), g.wy(0) + 22);
  [1, 2].forEach(v => ctx.fillText(v, g.wx(v), g.wy(0) + 22));
  ctx.textAlign = 'right';
  [-1, -2, -3, 1, 2].forEach(v => ctx.fillText(v, g.wx(0) - 7, g.wy(v) + 6));

  // Branch point label
  g.text(-1/Math.E, -1, '(-1/e, -1)', '#444', -115, -10, 17);
}

// ════════════════════════════════════════════════════════
//  SLIDE 14 — Infinite tower: √2ˣ vs √3ˣ vs y=x
// ════════════════════════════════════════════════════════
function drawTowerGraph() {
  const g = new Graph('canvas-tower', { xMin: -0.2, xMax: 6.5, yMin: -0.2, yMax: 6.5 });
  if (!g.canvas) return;
  g.clear();
  g.drawGrid(1, 1);
  g.drawAxes();

  const sq2 = Math.SQRT2;      // √2 ≈ 1.4142
  const sq3 = Math.sqrt(3);    // √3 ≈ 1.7321

  // y = x
  g.drawDash(x => x, '#bbb', 2.5);

  // y = √2ˣ  (blue, two fixed points: x=2 and x=4)
  g.drawCurve(x => Math.pow(sq2, x), '#0066cc', 3.5);

  // y = √3ˣ  (red, always above y=x)
  g.drawCurve(x => Math.pow(sq3, x), '#c0392b', 3.5);

  // Mark fixed points of √2ˣ
  g.dot(2, 2, '#0066cc', 9);
  g.dot(4, 4, '#0066cc', 9);
  g.text(2, 2, '(2, 2) — 안정 (tower = 2)', '#0066cc', 12, -14, 19);
  g.text(4, 4, '(4, 4) — 불안정', '#0066cc', 12, -14, 19);

  // Curve labels
  const { ctx } = g;
  ctx.fillStyle = '#0066cc'; ctx.font = '20px "IBM Plex Sans KR","IBM Plex Sans",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('y = √2ˣ', g.wx(1.0), g.wy(Math.pow(sq2, 1.0)) - 14);
  ctx.fillStyle = '#c0392b';
  ctx.fillText('y = √3ˣ', g.wx(2.5), g.wy(Math.pow(sq3, 2.5)) + 26);

  // Ticks
  g.ticksX([1,2,3,4,5,6], v => v, 24, 19);
  g.ticksY([1,2,3,4,5,6], v => v, -8, 19);
}
