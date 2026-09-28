// =====================================================================
// /admin/_shell/ui.js — shared render helpers for the v5 (Stanley) pages.
// Pure functions that return HTML strings, so pages stay small and every
// number is rendered the same way: value, platform, handle, as-of, stale.
// =====================================================================

export const STALE_HOURS = 36;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const fmtNum = (n) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US');
export function fmtCompact(n) {
  if (n == null || isNaN(n)) return '—';
  const v = Number(n), a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return Math.round(v / 1e3) + 'k';
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}
// Parse a date-only string as local midnight (avoids the UTC off-by-one).
export function toDate(x) {
  if (!x) return null;
  if (x instanceof Date) return x;
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) { const [y, m, d] = x.split('-').map(Number); return new Date(y, m - 1, d); }
  return new Date(x);
}
export function ymd(d) {
  const x = toDate(d); if (!x) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
export function fmtDay(x, opts = { month: 'short', day: 'numeric' }) {
  const d = toDate(x); return d ? d.toLocaleDateString('en-US', opts) : '—';
}
export function fmtWhen(x) {
  const d = toDate(x); if (!d) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function ago(x) {
  const d = toDate(x); if (!d) return 'never';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  const days = Math.round(s / 86400);
  return days === 1 ? '1 day ago' : days + ' days ago';
}
export function hoursSince(x) { const d = toDate(x); return d ? (Date.now() - d.getTime()) / 3.6e6 : Infinity; }
export function isStale(x, hours = STALE_HOURS) { return hoursSince(x) > hours; }
export function staleChip(x, hours = STALE_HOURS) {
  return isStale(x, hours) ? `<span class="chip stale" title="Last pull ${esc(fmtWhen(x))}">stale · ${esc(ago(x))}</span>` : '';
}
// "as of Sep 27, 2:00 PM · stale" line for any number.
export function asOf(x, { source } = {}) {
  const t = toDate(x);
  const when = t ? (typeof x === 'string' && x.length === 10 ? fmtDay(x, { month: 'short', day: 'numeric', year: 'numeric' }) : fmtWhen(x)) : 'unknown';
  return `<span>as of ${esc(when)}</span>${staleChip(x)}${source ? `<span title="${esc(source)}">· ${esc(shortSource(source))}</span>` : ''}`;
}
function shortSource(s) { s = String(s); return s.length > 38 ? s.slice(0, 36) + '…' : s; }

export function deltaChip(cur, prev, { pct = true } = {}) {
  if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return '';
  const d = cur - prev;
  if (d === 0) return `<span class="chip">0</span>`;
  const p = prev ? ` · ${Math.abs(d / prev * 100).toFixed(1)}%` : '';
  return `<span class="chip delta ${d > 0 ? 'up' : 'down'}"><i aria-hidden="true">${d > 0 ? '&#9650;' : '&#9660;'}</i>${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d))}${pct ? p : ''}</span>`;
}

const PLAT = { linkedin: ['in', 'LinkedIn'], instagram: ['IG', 'Instagram'], tiktok: ['TT', 'TikTok'], youtube: ['YT', 'YouTube'], x: ['X', 'X'], spotify: ['SP', 'Spotify'] };
export const platName = (p) => (PLAT[p] || [null, p])[1];
export function platMark(p, handle) {
  const [m, name] = PLAT[p] || ['·', p];
  return `<span class="plat"><span class="pm ${PLAT[p] ? esc(p) : 'other'}">${esc(m)}</span>${esc(name)}${handle ? `<span class="sv-muted" style="font-weight:500">@${esc(handle)}</span>` : ''}</span>`;
}

// Title only. The second line is kept only for load errors (so a failure says why).
export function emptyState(title, feeds) {
  const err = /^couldn't|^could not|error/i.test(String(title));
  return `<div class="sv-empty"><div class="e1">${esc(title)}</div>${err && feeds ? `<div class="e2">${feeds}</div>` : ''}</div>`;
}
export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

export function sparkline(values, { w = 220, h = 40 } = {}) {
  const v = values.filter(x => x != null && !isNaN(x)).map(Number);
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((y, i) => [i / (v.length - 1) * w, h - 4 - (y - min) / span * (h - 8)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const [ex, ey] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="a" data-fade d="${line} L${w} ${h} L0 ${h} Z"/><path class="l" data-draw pathLength="1" vector-effect="non-scaling-stroke" d="${line}"/><circle class="end" data-fade cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="2.6" vector-effect="non-scaling-stroke"/></svg>`;
}

// GitHub-style year heatmap. `byDay` maps 'YYYY-MM-DD' -> number.
export function heatmap(byDay, { days = 364, title = v => v } = {}) {
  const end = toDate(todayET());
  const start = new Date(end); start.setDate(end.getDate() - days);
  start.setDate(start.getDate() - start.getDay()); // back to Sunday
  const vals = Object.values(byDay).filter(v => v > 0).sort((a, b) => a - b);
  const q = (p) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0;
  const cuts = [q(.25), q(.5), q(.75)];
  const lvl = (v) => !v ? '' : v <= cuts[0] ? 'l1' : v <= cuts[1] ? 'l2' : v <= cuts[2] ? 'l3' : 'l4';
  let cells = '', months = '', lastM = -1, col = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = ymd(d), v = byDay[k] || 0;
    if (d.getDay() === 0) {
      const m = d.getMonth();
      months += `<span style="width:11px">${m !== lastM ? d.toLocaleDateString('en-US', { month: 'short' }) : ''}</span>`;
      lastM = m; col++;
    }
    cells += `<i class="${lvl(v)}" title="${esc(fmtDay(k, { month: 'short', day: 'numeric', year: 'numeric' }))}${v ? ' · ' + esc(title(v)) : ''}"></i>`;
  }
  return `<div class="hm-wrap"><div class="hm-months">${months}</div><div class="hm">${cells}</div></div>
    <div class="hm-legend">Less <i style="background:var(--surface-3)"></i><i class="l1" style="background:color-mix(in srgb,var(--accent) 25%,var(--surface-3))"></i><i style="background:color-mix(in srgb,var(--accent) 50%,var(--surface-3))"></i><i style="background:color-mix(in srgb,var(--accent) 75%,var(--surface-3))"></i><i style="background:var(--accent)"></i> More</div>`;
}

// Bars = posts (value at post date), line = follower snapshots. Tooltip on bars.
export function growthChart(host, { bars = [], line = [], barLabel = 'impressions', lineLabel = 'followers' }) {
  const W = 760, H = 240, P = { l: 44, r: 44, t: 12, b: 26 };
  const all = [...bars.map(b => toDate(b.date)), ...line.map(p => toDate(p.date))].filter(Boolean);
  if (!all.length) { host.innerHTML = ''; return; }
  let t0 = Math.min(...all), t1 = Math.max(...all, toDate(todayET()).getTime());
  if (t1 - t0 < 864e5 * 14) t0 = t1 - 864e5 * 14;
  const x = (d) => P.l + (toDate(d) - t0) / (t1 - t0) * (W - P.l - P.r);
  const bmax = Math.max(1, ...bars.map(b => b.value || 0));
  const lvals = line.map(p => p.value).filter(v => v != null);
  const lmin = lvals.length ? Math.min(...lvals) * 0.95 : 0, lmax = lvals.length ? Math.max(...lvals) * 1.02 : 1;
  const yb = (v) => H - P.b - (v / bmax) * (H - P.t - P.b);
  const yl = (v) => H - P.b - ((v - lmin) / ((lmax - lmin) || 1)) * (H - P.t - P.b);
  let g = '<g class="grid">';
  for (let i = 0; i <= 3; i++) { const y = P.t + i * (H - P.t - P.b) / 3; g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/>`; }
  g += '</g><g class="axis">';
  for (let i = 0; i <= 3; i++) { const v = bmax * (3 - i) / 3; g += `<text x="${P.l - 6}" y="${P.t + i * (H - P.t - P.b) / 3 + 4}" text-anchor="end">${fmtCompact(Math.round(v))}</text>`; }
  if (lvals.length) for (let i = 0; i <= 3; i++) { const v = lmax - (lmax - lmin) * i / 3; g += `<text x="${W - P.r + 6}" y="${P.t + i * (H - P.t - P.b) / 3 + 4}">${fmtCompact(Math.round(v))}</text>`; }
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) { const t = new Date(t0 + (t1 - t0) * i / ticks); g += `<text x="${x(t)}" y="${H - 6}" text-anchor="middle">${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>`; }
  g += '</g>';
  const bw = Math.max(4, Math.min(14, (W - P.l - P.r) / Math.max(bars.length, 1) * 0.6));
  const rects = bars.map((b, i) => `<rect class="bar" data-i="${i}" x="${(x(b.date) - bw / 2).toFixed(1)}" y="${yb(b.value || 0).toFixed(1)}" width="${bw}" height="${(H - P.b - yb(b.value || 0)).toFixed(1)}" rx="3"/>`).join('');
  const lp = line.filter(p => p.value != null).sort((a, b) => toDate(a.date) - toDate(b.date));
  const path = lp.map((p, i) => (i ? 'L' : 'M') + x(p.date).toFixed(1) + ' ' + yl(p.value).toFixed(1)).join(' ');
  const dots = lp.map(p => `<circle cx="${x(p.date).toFixed(1)}" cy="${yl(p.value).toFixed(1)}" r="3.5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"><title>${esc(fmtNum(p.value))} ${esc(lineLabel)} · ${esc(fmtDay(p.date))}</title></circle>`).join('');
  host.style.position = 'relative';
  host.innerHTML = `<svg class="gchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Posts (${esc(barLabel)}) and ${esc(lineLabel)} over time">${g}${rects}${path ? `<path class="ln" d="${path}"/>` : ''}${dots}</svg><div class="gtip"></div>`;
  const tip = host.querySelector('.gtip');
  host.querySelectorAll('rect.bar').forEach(r => {
    r.addEventListener('pointerenter', () => {
      const b = bars[+r.dataset.i];
      tip.innerHTML = `${b.thumb ? `<img src="${esc(b.thumb)}" alt="" style="width:100%;border-radius:8px;margin-bottom:.4rem" onerror="this.remove()">` : ''}<b>${fmtNum(b.value)} ${esc(barLabel)}</b>${esc(fmtDay(b.date, { month: 'short', day: 'numeric', year: 'numeric' }))}<div style="margin-top:.3rem;color:var(--text)">${esc(b.label || '')}</div>`;
      const hb = host.getBoundingClientRect(), rb = r.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = Math.min(hb.width - 270, Math.max(0, rb.left - hb.left - 120)) + 'px';
      tip.style.top = Math.max(0, rb.top - hb.top - tip.offsetHeight - 8) + 'px';
      r.classList.add('on');
    });
    r.addEventListener('pointerleave', () => { tip.style.display = 'none'; r.classList.remove('on'); });
  });
}

// Real image when we have one; otherwise the post's first line on a tint card.
export function postCard(p, { metric } = {}) {
  const first = String(p.caption || '').split('\n').find(s => s.trim()) || '(no caption on file)';
  // If the CDN image has expired, onerror removes it and the first-line card shows.
  const img = (p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.remove()">` : '') + `<div class="firstline">${esc(first)}</div>`;
  const href = p.permalink ? ` href="${esc(p.permalink)}" target="_blank" rel="noopener"` : '';
  return `<a class="sv-card post"${href}>
    <div class="media">${img}</div>
    <div>${platMark(p.platform, p.account_handle)}</div>
    <div class="stats">${metric || ''}</div>
    <div class="cap">${esc(first)}</div>
    <div class="sv-meta">${esc(fmtDay(p.posted_at, { month: 'short', day: 'numeric', year: 'numeric' }))}${p.as_of ? ` · metrics as of ${esc(fmtDay(p.as_of))}` : ''}</div>
  </a>`;
}

// THE STALENESS RULE (admin-stale-sweep 2026-09-28): anything past-dated or older than
// its cadence is shown as stale, never as current. Pages that still embed a hand-written
// snapshot call this with the snapshot date + how often it is supposed to refresh.
// Past the cadence: the "Auto-synced" label is replaced with the real age, a banner says
// the data is history, and the content is dimmed so it can't be read as current.
export function staleSnapshot(asOfDate, cadenceDays, { what = 'This page' } = {}) {
  const d = toDate(asOfDate); if (!d) return false;
  const age = Math.floor((Date.now() - d.getTime()) / 864e5);
  const label = document.getElementById('synced');
  const when = fmtDay(d, { month: 'short', day: 'numeric', year: 'numeric' });
  if (age <= cadenceDays) { if (label) label.textContent = `Snapshot · ${when}`; return false; }
  if (label) { label.textContent = `Stale · ${when} · ${age}d old`; label.style.color = 'var(--rust)'; label.classList.remove('live-dot'); }
  const head = document.querySelector('main .page-head');
  if (head && !document.getElementById('stale-banner')) {
    head.insertAdjacentHTML('afterend', `<div id="stale-banner" class="err-banner" style="font-family:'Geist Mono',monospace;font-size:.72rem;letter-spacing:.06em;color:var(--rust);padding:.75rem 1rem;border:1px solid rgba(255,77,46,.4);border-radius:10px;background:rgba(255,77,46,.05);margin-bottom:1.2rem"><strong>Out of date.</strong> ${esc(what)} is a snapshot from ${esc(when)} (${age} days old; it should refresh every ${cadenceDays} days). Nothing below is current. Kept greyed out as history until an automatic feed replaces it.</div>`);
    let n = document.getElementById('stale-banner').nextElementSibling;
    while (n) { n.style.opacity = '0.4'; n.style.filter = 'grayscale(1)'; n = n.nextElementSibling; }
  }
  return true;
}

export function statusChip(s) {
  const k = { ok: 'ok', failed: 'fail', partial: 'partial', quiet: 'quiet' }[s] || 'quiet';
  return `<span class="chip ${k}">${esc(s || 'no runs')}</span>`;
}

export function pageHead(_eyebrow, title, right = '') {
  return `<header class="page-head"><div><h1>${title}</h1></div><div class="actions">${right}</div></header>`;
}

export function modal(html) {
  const m = document.createElement('div');
  m.className = 'cmdk show';
  m.innerHTML = `<div class="cmdk-box" style="width:min(860px,100%);padding:1.2rem" role="dialog" aria-modal="true">${html}<div style="margin-top:1rem;text-align:right"><button class="btn" data-close>Close</button></div></div>`;
  const close = () => m.remove();
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', k); } });
  document.body.appendChild(m);
  return m;
}

// Data freshness strip (v_admin_data_freshness_status via live-data.js dataFreshness()).
// One line per stale/empty feed; a single green line when every feed is fresh.
export function freshStrip(rows, { link = '/admin/vault/' } = {}) {
  const bad = (rows || []).filter(r => r.status !== 'fresh').sort((a, b) => (Number(b.age_hours) || 1e9) - (Number(a.age_hours) || 1e9));
  const age = (h) => h == null ? 'no data' : h < 1 ? 'under 1h ago' : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)} days ago`;
  const vault = link ? `<a class="fs-link" href="${esc(link)}">Vault</a>` : '';
  if (!rows?.length) return `<div class="fstrip"><div class="fs-line bad"><i></i><span>Feed status unavailable</span>${vault}</div></div>`;
  if (!bad.length) return `<div class="fstrip"><div class="fs-line ok"><i></i><span>All ${rows.length} feeds fresh</span>${vault}</div></div>`;
  return `<div class="fstrip">${bad.map((r, i) => `<div class="fs-line bad"><i></i><span><b>${esc(r.label)}</b> ${r.status === 'empty' ? 'empty' : 'stale'} · last update ${esc(age(r.age_hours == null ? null : Number(r.age_hours)))}${r.max_age_days ? ` · expected every ${r.max_age_days}d` : ''}</span>${i === 0 ? vault : ''}</div>`).join('')}
    <div class="fs-line ok dim"><i></i><span>${rows.length - bad.length} of ${rows.length} feeds fresh</span></div></div>`;
}
