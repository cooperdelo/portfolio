// =====================================================================
// /admin/_shell/motion.js, the admin's motion kit. No dependencies.
// WAAPI + rAF only, transform/clip-path only (compositor friendly, 60fps).
// v6 film (2026-09-29): Cooper's motion rules. One ease everywhere, no opacity
// fades between states: things rise out of a clip, grow from a baseline or scale
// out of their own spot, so nothing appears from nowhere.
// Every effect collapses to the final state under prefers-reduced-motion.
// =====================================================================

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.22,1,.44,1)';
// JS copy of cubic-bezier(.22,1,.44,1) for rAF-driven counters.
function bez(x) {
  const X1 = .22, Y1 = 1, X2 = .44, Y2 = 1;
  const cx = 3 * X1, bx = 3 * (X2 - X1) - cx, ax = 1 - cx - bx;
  const cy = 3 * Y1, by = 3 * (Y2 - Y1) - cy, ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 8; i++) { const f = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(f) < 1e-5 || !d) break; t -= f / d; }
  t = Math.min(1, Math.max(0, t));
  return ((ay * t + by) * t + cy) * t;
}

/** Run fn once when el scrolls into view (immediately if IO is missing). */
export function onVisible(el, fn, { margin = '0px 0px -8% 0px' } = {}) {
  if (!el) return;
  if (REDUCED || !('IntersectionObserver' in window)) return fn(el);
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { io.disconnect(); fn(el); }
  }, { rootMargin: margin });
  io.observe(el);
}

/** Staggered entrance: rise out of a clip (physical, no fade). */
export function reveal(nodes, { y = 14, stagger = 70, delay = 0, dur = 1100 } = {}) {
  const list = [...(nodes instanceof Element ? [nodes] : nodes)];
  if (REDUCED) return;
  y = Math.min(Math.max(y, 10), 18); stagger = Math.min(stagger, 80);
  list.forEach((el, i) => el.animate(
    [{ clipPath: 'inset(-30% -30% 100% -30%)', transform: `translate3d(0,${y}px,0)` },
     { clipPath: 'inset(-30% -30% -30% -30%)', transform: 'translate3d(0,0,0)' }],
    { duration: dur, delay: delay + i * stagger, easing: EASE, fill: 'backwards' }));
}

/** Count a number up from 0. Keeps width steady via tabular numerals in CSS. */
export function countUp(el, to, { dur = 1100, delay = 0, format = (n) => Math.round(n).toLocaleString('en-US') } = {}) {
  if (!el) return;
  if (to == null || isNaN(to)) { el.textContent = '–'; return; }
  if (REDUCED) { el.textContent = format(to); return; }
  el.textContent = format(0);
  const t0 = performance.now() + delay;
  const ease = (t) => (t >= 1 ? 1 : bez(t)); // the one ease, same curve as CSS
  const step = (now) => {
    const t = Math.max(0, (now - t0) / dur);
    el.textContent = format(to * ease(t));
    if (t < 1) requestAnimationFrame(step); else el.textContent = format(to);
  };
  requestAnimationFrame(step);
}

/** Draw-on for every path[data-draw] (pathLength="1") and fade for [data-fade]. */
export function drawOn(root, { delay = 0, dur = 1400 } = {}) {
  if (!root || REDUCED) return;
  root.querySelectorAll('path[data-draw]').forEach((p, i) => {
    p.style.strokeDasharray = '1';
    p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: dur, delay: delay + i * 90, easing: EASE, fill: 'backwards' });
  });
  // area fills grow up from the baseline, end dots scale out of their own point
  root.querySelectorAll('[data-fade]').forEach((p, i) => {
    p.style.transformBox = 'fill-box';
    p.style.transformOrigin = p.tagName.toLowerCase() === 'circle' ? '50% 50%' : '50% 100%';
    p.animate([{ transform: p.tagName.toLowerCase() === 'circle' ? 'scale(0)' : 'scaleY(0)' }, { transform: 'none' }],
      { duration: 1000, delay: delay + 500 + i * 90, easing: EASE, fill: 'backwards' });
  });
}

/** Bars grow from their baseline (CSS gives them transform-box: fill-box). */
export function growBars(root, { delay = 0, stagger = 14, dur = 900 } = {}) {
  if (!root || REDUCED) return;
  root.querySelectorAll('[data-grow]').forEach((b, i) => b.animate(
    [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
    { duration: Math.min(dur, 700), delay: delay + i * Math.min(stagger, 10), easing: EASE, fill: 'backwards' }));
}

/** Horizontal fills (status bar, progress). */
export function growX(root, { delay = 0, stagger = 60 } = {}) {
  if (!root || REDUCED) return;
  root.querySelectorAll('[data-growx]').forEach((b, i) => b.animate(
    [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
    { duration: 1100, delay: delay + i * stagger, easing: EASE, fill: 'backwards' }));
}

/** Pill bars rise out of their track from the baseline. */
export function growPills(root, { delay = 0, stagger = 55 } = {}) {
  if (!root || REDUCED) return;
  root.querySelectorAll('[data-pill]').forEach((b, i) => b.animate(
    [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
    { duration: 1300, delay: delay + i * stagger, easing: EASE, fill: 'backwards' }));
}

/** Small things (delta chips, dots) unfold sideways out of their own spot. */
export function pop(nodes, { delay = 0, stagger = 40 } = {}) {
  if (REDUCED) return;
  [...nodes].forEach((el, i) => el.animate(
    [{ clipPath: 'inset(0 100% 0 0 round 999px)', transform: 'translateX(-4px)' }, { clipPath: 'inset(0 0% 0 0 round 999px)', transform: 'none' }],
    { duration: 800, delay: delay + i * stagger, easing: EASE, fill: 'backwards' }));
}

/** Cursor spotlight + depth on cards: sets --mx/--my, CSS does the rest. */
export function spotlight(root = document) {
  if (REDUCED || matchMedia('(hover: none)').matches) return;
  root.addEventListener('pointermove', (e) => {
    const c = e.target.closest?.('.sv-card, .hero-cell');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

/** Keep "12m ago" style labels fresh without a reload. */
export function liveAgo(root, agoFn, every = 30000) {
  const tick = () => root.querySelectorAll('[data-ago]').forEach(el => { el.textContent = agoFn(el.dataset.ago); });
  tick(); return setInterval(tick, every);
}
