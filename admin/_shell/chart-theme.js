// /admin/_shell/chart-theme.js — Chart.js in the admin's mono film look (v7, 2026-09-29).
// Bone for the thing being measured, silver for its counterpart, hairline grids,
// capsule bars, Geist Mono ticks, Nimbus tooltips, the one ease. No hues.
export const C = {
  bone: '#F4F1EA', silver: '#A8A29E', dim: 'rgba(244,241,234,.42)', faint: 'rgba(244,241,234,.16)',
  grid: 'rgba(244,241,234,.06)', ink: '#0C0B0A',
};
// Legacy keys pages still read: income = bone, expense = dim silver, highlight = bone.
Object.assign(C, { ink2: C.silver, muted: C.silver, rust: C.dim, sage: C.bone, crimson: C.faint, stage: C.faint, pink: C.faint, cyan: C.faint, lavender: C.faint, cream: C.faint });
// Shades for multi-part charts: most important = solid bone, then fading.
export const MONO = ['#F4F1EA', 'rgba(244,241,234,.72)', 'rgba(244,241,234,.52)', 'rgba(244,241,234,.36)', 'rgba(244,241,234,.24)', 'rgba(244,241,234,.16)', 'rgba(244,241,234,.1)', 'rgba(244,241,234,.07)'];

export function applyChartTheme() {
  const Ch = window.Chart; if (!Ch) return;
  const d = Ch.defaults;
  d.color = C.silver;
  d.font.family = '"Geist Mono", ui-monospace, monospace';
  d.font.size = 10;
  d.borderColor = C.grid;
  // the admin's one ease, cubic-bezier(.22,1,.44,1), registered as a Chart.js effect
  const bez = (x) => { const cx = .66, bx = 3 * (.44 - .22) - cx, ax = 1 - cx - bx, cy = 3, by = -3, ay = 1; let t = x; for (let i = 0; i < 8; i++) { const f = ((ax * t + bx) * t + cx) * t - x, dd = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(f) < 1e-5 || !dd) break; t -= f / dd; } t = Math.min(1, Math.max(0, t)); return ((ay * t + by) * t + cy) * t; };
  const fx = Ch.helpers?.easingEffects; if (fx) fx.cdEase = bez;
  d.animation = matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 1300, easing: fx ? 'cdEase' : 'easeOutQuart' };
  d.plugins.legend.labels.color = C.silver;
  d.plugins.legend.labels.usePointStyle = true;
  d.plugins.legend.labels.pointStyle = 'circle';
  d.plugins.legend.labels.boxWidth = 6;
  d.plugins.legend.labels.boxHeight = 6;
  Object.assign(d.plugins.tooltip, {
    backgroundColor: C.bone, titleColor: C.ink, bodyColor: C.ink, borderWidth: 0, padding: 10, cornerRadius: 10,
    titleFont: { family: '"Nimbus Sans", sans-serif', weight: '700', size: 12 }, bodyFont: { family: '"Nimbus Sans", sans-serif', size: 12 },
    displayColors: false,
  });
  d.elements.bar.borderRadius = 999;
  d.elements.bar.borderSkipped = false;
  d.elements.line.tension = 0.34;
  d.elements.point.radius = 0;
  d.datasets.bar.barPercentage = 0.62;
  d.datasets.bar.categoryPercentage = 0.7;
}
// Soft vertical fill under a line (bone fading to nothing).
export function fillUnder(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  g.addColorStop(0, 'rgba(244,241,234,.22)');
  g.addColorStop(1, 'rgba(244,241,234,0)');
  return g;
}
