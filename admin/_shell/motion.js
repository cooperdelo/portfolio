// =====================================================================
// /admin/_shell/motion.js — the admin's motion kit. No dependencies.
// WAAPI + rAF only, transform/opacity only (compositor friendly, 60fps).
// Every effect collapses to the final state under prefers-reduced-motion.
// =====================================================================

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.16,1,.3,1)';

/** Run fn once when el scrolls into view (immediately if IO is missing). */
export function onVisible(el, fn, { margin = '0px 0px -8% 0px' } = {}) {
  if (!el) return;
  if (REDUCED || !('IntersectionObserver' in window)) return fn(el);
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { io.disconnect(); fn(el); }
  }, { rootMargin: margin });
  io.observe(el);
}

/** Staggered entrance: fade + rise + de-blur. */
export function reveal(nodes, { y = 18, stagger = 70, delay = 0, dur = 820 } = {}) {
  const list = [...(nodes instanceof Element ? [nodes] : nodes)];
  if (REDUCED) return;
  list.forEach((el, i) => el.animate(
    [{ opacity: 0, transform: `translate3d(0,${y}px,0)`, filter: 'blur(6px)' },
     { opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0)' }],
    { duration: dur, delay: delay + i * stagger, easing: EASE, fill: 'backwards' }));
}

/** Count a number up from 0. Keeps width steady via tabular numerals in CSS. */
export function countUp(el, to, { dur = 1600, delay = 0, format = (n) => Math.round(n).toLocaleString('en-US') } = {}) {
  if (!el) return;
  if (to == null || isNaN(to)) { el.textContent = '—'; return; }
  if (REDUCED) { el.textContent = format(to); return; }
  el.textContent = format(0);
  const t0 = performance.now() + delay;
  const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)); // expo out
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
      { duration: dur, delay: delay + i * 90, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
  });
  root.querySelectorAll('[data-fade]').forEach((p, i) => p.animate([{ opacity: 0 }, { opacity: 1 }],
    { duration: 900, delay: delay + 500 + i * 90, easing: EASE, fill: 'backwards' }));
}

/** Bars grow from their baseline (CSS gives them transform-box: fill-box). */
export function growBars(root, { delay = 0, stagger = 14, dur = 900 } = {}) {
  if (!root || REDUCED) return;
  root.querySelectorAll('[data-grow]').forEach((b, i) => b.animate(
    [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
    { duration: dur, delay: delay + i * stagger, easing: EASE, fill: 'backwards' }));
}

/** Horizontal fills (status bar, progress). */
export function growX(root, { delay = 0, stagger = 60 } = {}) {
  if (!root || REDUCED) return;
  root.querySelectorAll('[data-growx]').forEach((b, i) => b.animate(
    [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
    { duration: 1000, delay: delay + i * stagger, easing: EASE, fill: 'backwards' }));
}

/** Pop in small things (delta chips, dots) with a soft overshoot. */
export function pop(nodes, { delay = 0, stagger = 40 } = {}) {
  if (REDUCED) return;
  [...nodes].forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(4px) scale(.86)' }, { opacity: 1, transform: 'none' }],
    { duration: 620, delay: delay + i * stagger, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' }));
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
