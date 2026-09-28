// /admin/_js/insights.js — follower cards, year heatmap, growth chart,
// milestones, best content to repost.
// Reads: social_account_snapshots, social_posts, social_post_snapshots.
import { mountShell } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtNum, fmtCompact, fmtDay, asOf, deltaChip, platMark, platName, emptyState, sparkline, heatmap, growthChart, postCard, pageHead, ymd, toDate } from '/admin/_shell/ui.js';
import { accountSeries, postsWithMetrics, PERSONAL } from '/admin/_shell/data.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Insights' });
const app = document.getElementById('app');

app.innerHTML = pageHead('Grow', 'Insights') + `
  <section><div class="sv-grid c4" id="followers"><div class="shimmer" style="height:150px"></div></div></section>
  <section class="sv-section"><div class="sv-card pad-lg">
    <div class="sv-h"><div><h2>Growth</h2><div class="sv-sub" id="growth-sub"></div></div><div class="seg" id="growth-seg"></div></div>
    <div id="growth"></div></div></section>
  <section class="sv-section"><div class="sv-card pad-lg">
    <div class="sv-h"><div><h2>Your year</h2><div class="sv-sub" id="hm-sub"></div></div><div class="seg" id="hm-seg"></div></div>
    <div id="hm"></div></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Milestones</h2><span class="sv-sub">Computed from the numbers above, nothing typed in</span></div>
    <div class="sv-grid c4" id="milestones"></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Best content to repost</h2><span class="sv-sub">Top reach, posted 60+ days ago</span></div>
    <div class="sv-grid auto" id="repost"></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Recent posts</h2></div><div class="sv-grid auto" id="recent"></div></section>`;

const [{ list, windows }, posts] = await Promise.all([accountSeries(), postsWithMetrics()]);
const mine = (p) => PERSONAL[p.platform] && String(p.account_handle).toLowerCase() === PERSONAL[p.platform].toLowerCase();
const metricHTML = (p) => p.reach == null ? '<span>no metrics on file</span>'
  : `<span><b>${fmtNum(p.reach)}</b> ${p.reachLabel}</span>${p.m?.likes != null ? `<span><b>${fmtNum(p.m.likes)}</b> ${p.platform === 'linkedin' ? 'reactions' : 'likes'}</span>` : ''}${p.m?.comments != null ? `<span><b>${fmtNum(p.m.comments)}</b> comments</span>` : ''}`;

// ---- follower cards ----
document.getElementById('followers').innerHTML = list.length ? list.map(s => {
  const win = windows.filter(w => w.platform === s.platform && w.handle === s.handle).sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<div class="sv-card">
    ${platMark(s.platform, s.handle)}${s.personal ? '' : /plugverse/i.test(s.handle) ? ' <span class="chip">PlugVerse</span>' : ' <span class="chip quiet">old handle</span>'}
    <div class="sv-num md">${fmtNum(s.latest.followers)}</div>
    <div class="sv-label">${s.platform === 'youtube' ? 'subscribers' : 'followers'} ${deltaChip(s.latest.followers, s.prev?.followers)}</div>
    ${win ? `<div class="sv-meta"><b>${fmtNum(win.impressions)}</b> impressions, past ${win.window_days} days (as of ${esc(fmtDay(win.date))})</div>` : ''}
    <div class="sv-meta">${asOf(s.latest.captured_at || s.latest.date, { source: s.latest.source })}</div>
    <div class="sv-meta">${s.prev ? `change vs ${esc(fmtDay(s.prev.date))} · ${s.rows.length} snapshots` : 'first snapshot, no change yet'}</div>
    ${sparkline(s.rows.slice(0, 60).reverse().map(r => r.followers))}
  </div>`;
}).join('') : emptyState('No follower snapshots', 'Fed by the social-pull task (social_account_snapshots).');

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
  document.getElementById('growth-sub').innerHTML = `${platName(gPlat)} @${esc(PERSONAL[gPlat])}: bars are posts (lifetime ${label}), line is followers. ${ps.length} posts with metrics, ${line.length} follower snapshots. Metrics as of ${esc(fmtDay(ps.map(p => p.as_of).filter(Boolean).sort().pop()) || '—')}.`;
  const host = document.getElementById('growth');
  if (!ps.length && !line.length) { host.innerHTML = emptyState('Nothing to chart yet', `Fed by social_posts + social_post_snapshots for ${platName(gPlat)}.`); return; }
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
  document.getElementById('hm-sub').textContent = `${n} posts in the last 12 months, ${fmtNum(total)} lifetime reach on them (LinkedIn impressions + IG/TikTok/YouTube views). Each square is a day you posted.`;
  document.getElementById('hm').innerHTML = n ? heatmap(byDay, { title: v => fmtNum(v) + ' reach' }) : emptyState('No dated posts', 'Fed by social_posts.posted_at.');
}
drawHeat();

// ---- milestones (computed) ----
const ms = [];
for (const s of list.filter(s => s.personal)) {
  const f = s.latest.followers, step = f >= 1000 ? 500 : 100, mark = Math.floor(f / step) * step;
  if (mark > 0) ms.push({ big: `${fmtNum(mark)}+`, t: `${platName(s.platform)} ${s.platform === 'youtube' ? 'subscribers' : 'followers'}`, m: `${fmtNum(f)} as of ${fmtDay(s.latest.date)}` });
}
for (const pl of plats) {
  const ps = posts.filter(p => p.platform === pl && mine(p) && p.reach != null).sort((a, b) => b.reach - a.reach);
  if (!ps.length) continue;
  ms.push({ big: fmtCompact(ps[0].reach), t: `Best ${platName(pl)} post`, m: `"${String(ps[0].caption || '').split('\n')[0].slice(0, 60)}" · ${fmtDay(ps[0].posted_at)}` });
  const over10 = ps.filter(p => p.reach >= 10000).length;
  if (over10) ms.push({ big: String(over10), t: `${platName(pl)} posts over 10k ${ps[0].reachLabel}`, m: `of ${ps.length} with metrics, as of ${fmtDay(ps[0].as_of)}` });
}
document.getElementById('milestones').innerHTML = ms.map(x => `<div class="sv-card tint"><div class="sv-num md" style="color:var(--accent-ink)">${esc(x.big)}</div><div class="sv-label" style="color:var(--text)">${esc(x.t)}</div><div class="sv-meta">${esc(x.m)}</div></div>`).join('') || emptyState('No milestones yet', 'Computed from follower snapshots and post metrics.');

// ---- repost + recent ----
const old = posts.filter(p => mine(p) && p.reach != null && p.posted_at && toDate(p.posted_at) < Date.now() - 60 * 864e5).sort((a, b) => b.reach - a.reach).slice(0, 8);
document.getElementById('repost').innerHTML = old.map(p => postCard(p, { metric: metricHTML(p) })).join('') || emptyState('Nothing old enough yet', 'Posts older than 60 days with metrics show here.');
const recent = posts.filter(p => mine(p) && p.posted_at).sort((a, b) => toDate(b.posted_at) - toDate(a.posted_at)).slice(0, 8);
document.getElementById('recent').innerHTML = recent.map(p => postCard(p, { metric: metricHTML(p) })).join('') || emptyState('No posts', 'Fed by social_posts.');
