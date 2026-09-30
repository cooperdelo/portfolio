// /admin/_js/insights.js — Insights v7: follower hero row, growth chart, year heatmap,
// milestones, best content to repost, recent posts.
// Reads: social_account_snapshots, social_posts, social_post_snapshots.
import { mountShell } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtNum, fmtCompact, fmtDay, deltaChip, platMark, platName, emptyState, sparkline, heatmap, growthChart, postCard, pageHead, ymd, toDate, staleChip, statTile, pmIcon } from '/admin/_shell/ui.js';
import { accountSeries, postsWithMetrics, PERSONAL } from '/admin/_shell/data.js';
import { reveal, drawOn, countUp, onVisible } from '/admin/_shell/motion.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Insights' });
const app = document.getElementById('app');
const short = (x) => fmtDay(x, { month: 'short', day: 'numeric' });

app.innerHTML = pageHead('', 'Insights', '<span class="mono" id="asof"></span>') + `
  <section class="stat-row" id="followers" style="--n:4"><div class="stat"><div class="shimmer" style="height:100%"></div></div><div class="stat"></div><div class="stat"></div><div class="stat"></div></section>
  <section class="grid">
    <div class="sv-card span-12"><div class="sv-h"><h2>Growth</h2><div class="seg" id="growth-seg"></div></div><div class="mono" id="growth-meta" style="margin:-4px 0 14px"></div><div id="growth"></div></div>
  </section>
  <section class="grid">
    <div class="sv-card span-8"><div class="sv-h"><h2>Your year</h2><div class="seg" id="hm-seg"></div></div><div id="hm"></div><div class="mono" id="hm-meta" style="margin-top:10px"></div></div>
    <div class="span-4 col" id="milestones"></div>
  </section>
  <section class="sv-section"><div class="sv-h"><h2>Worth reposting</h2><span class="mono">Top reach · 60+ days old</span></div><div class="pfeed" id="repost"></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Recent</h2></div><div class="pfeed" id="recent"></div></section>
  <section class="sv-section" id="otherSec" hidden><div class="sv-h"><h2>Other accounts</h2></div><div class="sv-grid auto" id="other"></div></section>`;

const [{ list, windows }, posts] = await Promise.all([accountSeries(), postsWithMetrics()]);
const mine = (p) => PERSONAL[p.platform] && String(p.account_handle).toLowerCase() === PERSONAL[p.platform].toLowerCase();
const metricHTML = (p) => p.reach == null ? '<span>no metrics yet</span>'
  : `<span><b>${fmtCompact(p.reach)}</b> ${p.reachLabel}</span>${p.m?.likes != null ? `<span><b>${fmtCompact(p.m.likes)}</b> ${p.platform === 'linkedin' ? 'reactions' : 'likes'}</span>` : ''}`;
const newest = list.map(s => s.latest.captured_at || s.latest.date).filter(Boolean).sort().pop();
document.getElementById('asof').textContent = newest ? `As of ${short(newest)}` : '';

// ---- hero row: the four personal accounts ----
const personal = list.filter(s => s.personal).slice(0, 4);
document.getElementById('followers').style.setProperty('--n', Math.max(1, personal.length));
document.getElementById('followers').innerHTML = personal.length ? personal.map(s => statTile({
  k: `${pmIcon(s.platform, 12)} ${esc(platName(s.platform))}`,
  v: `<span data-count="${Number(s.latest.followers)}">0</span>`, small: s.platform === 'youtube' ? 'subs' : 'followers',
  d: deltaChip(s.latest.followers, s.prev?.followers) + (s.prev ? `<span class="sv-muted">vs ${esc(short(s.prev.date))}</span>` : ''),
  spark: sparkline(s.rows.slice(0, 60).reverse().map(r => r.followers)),
  src: `@${esc(s.handle)} · as of ${esc(short(s.latest.captured_at || s.latest.date))}`,
})).join('') : `<div class="stat">${emptyState('No follower snapshots', '')}</div>`;
document.querySelectorAll('#followers .stat').forEach((c, i) => { const n = c.querySelector('[data-count]'); if (n) countUp(n, Number(n.dataset.count), { delay: i * 90, dur: 1300 }); drawOn(c, { delay: 300 + i * 90 }); });
reveal(document.querySelectorAll('#followers .stat'), { stagger: 80, y: 16 });

// other accounts (PlugVerse, old handles), one compact row
const others = list.filter(s => !s.personal);
if (others.length) {
  document.getElementById('otherSec').hidden = false;
  document.getElementById('other').innerHTML = others.map(s => {
    const win = windows.filter(w => w.platform === s.platform && w.handle === s.handle).sort((a, b) => b.date.localeCompare(a.date))[0];
    return `<div class="sv-card">${platMark(s.platform, s.handle)}
      <span class="num md" style="display:block;margin:14px 0 6px">${fmtNum(s.latest.followers)}</span>
      <div class="sv-label" style="text-transform:none;letter-spacing:0;font-weight:400">${s.platform === 'youtube' ? 'subscribers' : 'followers'} ${deltaChip(s.latest.followers, s.prev?.followers)}</div>
      ${win ? `<div class="sv-meta">${fmtNum(win.impressions)} impressions · ${win.window_days}d</div>` : ''}
      <div class="sv-meta">as of ${esc(short(s.latest.captured_at || s.latest.date))} ${staleChip(s.latest.captured_at || s.latest.date)}</div></div>`;
  }).join('');
}

// ---- growth chart ----
const plats = ['linkedin', 'instagram', 'tiktok', 'youtube'].filter(pl => posts.some(p => p.platform === pl && mine(p)) || list.some(s => s.platform === pl && s.personal));
let gPlat = plats[0] || 'linkedin';
function drawGrowth() {
  document.getElementById('growth-seg').innerHTML = plats.map(pl => `<button class="${pl === gPlat ? 'on' : ''}" data-p="${pl}">${platName(pl)}</button>`).join('');
  document.querySelectorAll('#growth-seg button').forEach(b => b.onclick = () => { gPlat = b.dataset.p; drawGrowth(); });
  const ps = posts.filter(p => p.platform === gPlat && mine(p) && p.posted_at && p.reach != null);
  const s = list.find(x => x.platform === gPlat && x.personal);
  const line = (s?.rows || []).map(r => ({ date: r.date, value: r.followers }));
  const label = gPlat === 'linkedin' ? 'impressions' : 'views';
  const asof = ps.map(p => p.as_of).filter(Boolean).sort().pop();
  document.getElementById('growth-meta').textContent = `@${PERSONAL[gPlat]} · bars ${label} per post · line followers · ${ps.length} posts${asof ? ' · as of ' + short(asof) : ''}`;
  const host = document.getElementById('growth');
  if (!ps.length && !line.length) { host.innerHTML = emptyState('Nothing to chart yet.', ''); return; }
  growthChart(host, { bars: ps.map(p => ({ date: p.posted_at, value: p.reach, label: String(p.caption || '').split('\n')[0], thumb: p.thumb })), line, barLabel: label, lineLabel: 'followers' });
}
drawGrowth();

// ---- heatmap ----
let hPlat = 'all';
function drawHeat() {
  document.getElementById('hm-seg').innerHTML = ['all', ...plats].map(pl => `<button class="${pl === hPlat ? 'on' : ''}" data-p="${pl}">${pl === 'all' ? 'All' : platName(pl)}</button>`).join('');
  document.querySelectorAll('#hm-seg button').forEach(b => b.onclick = () => { hPlat = b.dataset.p; drawHeat(); });
  const byDay = {}; let n = 0, total = 0;
  const cutoff = Date.now() - 365 * 864e5;
  for (const p of posts) {
    if (!mine(p) || !p.posted_at || (hPlat !== 'all' && p.platform !== hPlat)) continue;
    if (toDate(p.posted_at) < cutoff) continue;
    const k = ymd(p.posted_at); byDay[k] = (byDay[k] || 0) + (p.reach || 1); n++; total += p.reach || 0;
  }
  document.getElementById('hm-meta').textContent = `${n} posts · ${fmtNum(total)} reach · 12 months`;
  document.getElementById('hm').innerHTML = n ? heatmap(byDay, { title: v => fmtNum(v) + ' reach' }) : emptyState('No dated posts.', '');
}
drawHeat();

// ---- milestones (computed) ----
const ms = [];
for (const s of list.filter(s => s.personal)) {
  const f = s.latest.followers, step = f >= 1000 ? 500 : 100, mark = Math.floor(f / step) * step;
  if (mark > 0) ms.push({ big: `${fmtNum(mark)}+`, t: `${platName(s.platform)} ${s.platform === 'youtube' ? 'subscribers' : 'followers'}`, m: `@${s.handle} · ${fmtNum(f)} · ${short(s.latest.date)}` });
}
for (const pl of plats) {
  const ps = posts.filter(p => p.platform === pl && mine(p) && p.reach != null).sort((a, b) => b.reach - a.reach);
  if (!ps.length) continue;
  ms.push({ big: fmtCompact(ps[0].reach), t: `Best ${platName(pl)} post`, m: `@${PERSONAL[pl]} · ${short(ps[0].posted_at)} · as of ${short(ps[0].as_of)}` });
}
document.getElementById('milestones').innerHTML = ms.slice(0, 5).map(x => `<div class="sv-card flat" style="padding:14px 16px"><span class="num md">${esc(x.big)}</span><div class="t-label" style="margin-top:8px;color:var(--text)">${esc(x.t)}</div><div class="sv-meta" style="margin-top:4px">${esc(x.m)}</div></div>`).join('') || `<div class="sv-card">${emptyState('No milestones yet.', '')}</div>`;

// ---- repost + recent ----
const card = (p) => postCard(p, { metric: metricHTML(p) });
const old = posts.filter(p => mine(p) && p.reach != null && p.posted_at && toDate(p.posted_at) < Date.now() - 60 * 864e5).sort((a, b) => b.reach - a.reach).slice(0, 8);
document.getElementById('repost').innerHTML = old.map(card).join('') || emptyState('Nothing old enough yet.', '');
const recent = posts.filter(p => mine(p) && p.posted_at).sort((a, b) => toDate(b.posted_at) - toDate(a.posted_at)).slice(0, 8);
document.getElementById('recent').innerHTML = recent.map(card).join('') || emptyState('No posts.', '');
document.querySelectorAll('main .grid, main .sv-section').forEach(g => onVisible(g, () => reveal(g.querySelectorAll(':scope > .sv-card, :scope > .col > *, .pfeed > *, .sv-grid > *'), { stagger: 60, y: 14 })));
