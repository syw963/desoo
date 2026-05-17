'use strict';

// ════════════════════════════════════════════════════════
//  STATE & NAVIGATION
// ════════════════════════════════════════════════════════
const TOTAL = 18;
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
    drawHxGraph();
    drawHLambdaGraph();
    drawLambertWGraph();
    drawTowerGraph();
    initGraph4();
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
//  SLIDE 4 — Interactive graph  y=aˣ  vs  y=logₐ(x)
// ════════════════════════════════════════════════════════
function initGraph4() {
  const slider = document.getElementById('a-slider');
  if (!slider) return;
  slider.addEventListener('input', () => drawGraph4(+slider.value));
  drawGraph4(+slider.value);
}

function drawGraph4(a) {
  const g = new Graph('canvas-slide4', { xMin: -1.0, xMax: 5.0, yMin: -1.0, yMax: 5.0 });
  if (!g.canvas) return;
  g.clear();
  g.drawGrid();
  g.drawAxes();
  g.ticksX([1,2,3,4,-1], v => v,  24, 20);
  g.ticksY([1,2,3,4,-1], v => v, -8, 20);

  const lna = Math.log(a);
  const eps = 1e-9;

  // y = x  (dashed)
  g.drawDash(x => x, '#aaa', 2.5);

  // y = aˣ  (blue)
  g.drawCurve(x => Math.pow(a, x), '#0066cc', 3.5);

  // y = logₐ(x)  (red, x > 0 only)
  if (Math.abs(lna) > eps) {
    g.drawCurve(x => x > 0.002 ? Math.log(x) / lna : NaN, '#c0392b', 3.5);
  }

  // Intersections of y=aˣ and y=logₐ(x)
  let pts = [];
  if (Math.abs(lna) > eps) {
    const f = x => x <= 0.001 ? NaN : Math.pow(a, x) - Math.log(x) / lna;
    pts = findZeros(f, 0.001, 4.9, 4000);
  }
  pts.forEach(x => g.dot(x, Math.pow(a, x), '#0066cc', 9));

  // Update info bar
  const aElem = document.getElementById('a-value');
  if (aElem) aElem.textContent = `a = ${a.toFixed(3)}`;

  const cntElem   = document.getElementById('intersect-count');
  const infoElem  = document.getElementById('intersect-info');
  const E1E  = Math.exp(-Math.E);   // e^{-e}  ≈ 0.0660
  const Einv = Math.exp(1 / Math.E); // e^{1/e} ≈ 1.4447
  let note = '';
  if (a < 1 - eps) {
    if (a < E1E - 0.002)          note = `← a < e⁻ᵉ ≈ ${E1E.toFixed(4)}: 교점 3개`;
    else if (a < E1E + 0.004)     note = `← a ≈ e⁻ᵉ (경계)`;
    else                          note = `← e⁻ᵉ ≤ a < 1: 교점 1개`;
  } else if (a > 1 + eps) {
    if (a < Einv - 0.002)         note = `← 1 < a < e^{1/e} ≈ ${Einv.toFixed(4)}: 교점 2개`;
    else if (a < Einv + 0.01)     note = `← a ≈ e^{1/e} (접점)`;
    else                          note = `← a > e^{1/e}: 교점 없음`;
  }
  if (cntElem)  cntElem.textContent = `${pts.length}개`;
  if (infoElem) infoElem.innerHTML  =
    `교점 개수: <strong>${pts.length}개</strong>&emsp;<span style="color:#6e6e73;font-size:28px;">${note}</span>`;
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
//  SLIDE 7 — H_λ(u) = λ·exp(−λ·exp(−u)) − u
// ════════════════════════════════════════════════════════
function drawHLambdaGraph() {
  const g = new Graph('canvas-hlambda', { xMin: -0.5, xMax: 5, yMin: -2.2, yMax: 2.2 });
  if (!g.canvas) return;
  g.clear();
  g.drawGrid(1, 1);
  g.drawAxes();

  const H = (lam, u) => lam * Math.exp(-lam * Math.exp(-u)) - u;

  // Three lambda values
  const curves = [
    { lam: 1.5,     color: '#1a7a3c', label: 'λ = 1.5  (< e)' },
    { lam: Math.E,  color: '#0066cc', label: 'λ = e     (경계)' },
    { lam: 4.0,     color: '#c0392b', label: 'λ = 4     (> e)' },
  ];
  curves.forEach(({ lam, color }) => g.drawCurve(u => H(lam, u), color, 2.5, 800));

  // Mark zeros of λ=4 curve
  findZeros(u => H(4, u), -0.2, 4.5, 4000).forEach(u => g.dot(u, 0, '#c0392b', 6));

  // Legend (top-right)
  const { ctx } = g;
  ctx.save();
  curves.forEach(({ color, label }, i) => {
    const y0 = 14 + i * 34;
    ctx.fillStyle = color;
    ctx.fillRect(g.W - 230, y0 - 2, 30, 6);
    ctx.fillStyle = '#333';
    ctx.font = '16px "IBM Plex Sans KR","IBM Plex Sans",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, g.W - 192, y0 + 6);
  });
  ctx.restore();

  g.ticksX([-0, 1, 2, 3, 4], v => v, 22, 17);
  g.ticksY([-2, -1, 1, 2], v => v, -8, 17);
}

// ════════════════════════════════════════════════════════
//  SLIDE 8 — Lambert W graph
// ════════════════════════════════════════════════════════
function drawLambertWGraph() {
  const g = new Graph('canvas-lambertw', { xMin: -0.45, xMax: 4, yMin: -3.8, yMax: 2.6 });
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
  [1, 2, 3].forEach(v => ctx.fillText(v, g.wx(v), g.wy(0) + 22));
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
