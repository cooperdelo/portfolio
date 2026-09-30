// /admin/_js/home.js, Home v7 (2026-09-29): hero row of today's numbers, then a calm grid.
// Reads: v_today_list + command_center (today.js), v_content_schedule (posted this week),
// social_account_snapshots, social_posts + social_post_snapshots (LinkedIn impressions),
// task_run_log (14 days), vault_documents, health_daily/_food_log/_goals/_progress_photo.
// Writes: health_daily weight (one-tap weigh-in), health_progress_photo + storage upload.
// Every number is real or an honest empty state, and carries platform/handle/as-of.
//
// Localhost-only design preview: http://localhost:<port>/admin/?demo renders from
// admin/_dev/snapshot.local.json (gitignored, never deployed). Any other host: auth gate.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { esc, fmtNum, fmtCompact, fmtDay, ago, deltaChip, platMark, emptyState, sparkline, todayET, toDate, staleChip, icon, pillBars, statTile } from '/admin/_shell/ui.js';
import { accountSeries, groupAccounts, postsWithMetrics } from '/admin/_shell/data.js';
import { homeRecommendations, contentSchedule } from '/admin/_shell/live-data.js';
import { mountToday } from '/admin/_js/today.js';
import { reveal, countUp, drawOn, growX, growPills, pop, onVisible, liveAgo } from '/admin/_shell/motion.js';

const ctx = await mountShell({ title: 'Home', demo: true });
const $ = (id) => document.getElementById(id);
const DEMO = !!ctx?.demo;
let SNAP = null;
if (DEMO) {
  try { SNAP = await (await fetch('/admin/_dev/snapshot.local.json', { cache: 'no-store' })).json(); }
  catch (e) { SNAP = null; console.error('demo snapshot missing', e); }
}
const TZ = 'America/New_York';
const short = (x) => fmtDay(x, { month: 'short', day: 'numeric' });
const nowStamp = () => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ });

// ---------- masthead ----------
function paintClock() {
  const now = new Date();
  const h = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }));
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  $('greet').textContent = `${part}, Cooper`;
  $('when').textContent = now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) + ' ET';
}
paintClock(); setInterval(paintClock, 30000);
reveal(document.querySelectorAll('#mast h1'), { y: 14 });
if (DEMO) {
  const flag = document.createElement('div');
  flag.className = 'demo-flag';
  flag.innerHTML = SNAP ? `<b>Demo</b>snapshot ${esc(short(SNAP.captured_at))}` : '<b>Demo</b>snapshot file not found';
  $('mast').after(flag);
}

const fail = (id, what, e) => { console.error(what, e); const el = $(id); if (el) el.innerHTML = emptyState(`Couldn't load ${what}`, esc(e?.message || String(e))); };
const head = (title, right = '') => `<div class="sv-h"><h2 class="disp">${title}</h2>${right}</div>`;

// ---------- data ----------
async function loadAccounts() {
  if (DEMO) return groupAccounts((SNAP?.accounts || []).map(([date, platform, handle, followers, captured_at]) => ({ date, platform, handle, followers, captured_at, window_days: 0 }))).list;
  return (await accountSeries()).list;
}
async function loadLinkedInPosts() {
  if (DEMO) return (SNAP?.linkedin_posts || []).map(([date, value]) => ({ date, value, as_of: SNAP.captured_at }));
  const posts = await postsWithMetrics();
  return posts.filter(p => p.platform === 'linkedin' && String(p.account_handle).toLowerCase() === 'cooperdelo' && p.reach != null && p.posted_at)
    .map(p => ({ date: String(p.posted_at).slice(0, 10), value: p.reach, as_of: p.as_of }));
}
async function loadRuns() {
  if (DEMO) return (SNAP?.runs || []).map(([task, ran_at, status]) => ({ task, ran_at, status }));
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data, error } = await sb.from('task_run_log').select('task,ran_at,status,note').gte('ran_at', since).order('ran_at', { ascending: false }).limit(2000);
  if (error) throw error;
  return data || [];
}

if (ctx?.role === 'full') {
  const pAcc = loadAccounts();
  const pRuns = loadRuns();
  const pLI = loadLinkedInPosts();
  addEventListener('cd:today', (e) => heroToday(e.detail));
  mountToday().catch(e => fail('tdDo', 'today', e));
  heroWeek().catch(e => { console.error(e); $('hsWeek').innerHTML = statInner({ k: 'Posted this week', v: '–', src: "Couldn't read the schedule" }); });
  improve().catch(e => fail('improve', 'recommendations', e));
  liChart(pLI).catch(e => fail('heroChart', 'LinkedIn posts', e));
  system(pRuns).catch(e => fail('system', 'task runs', e));
  audience(pAcc).catch(e => fail('pulse', 'followers', e));
  health().catch(e => fail('health', 'health', e));
  vaultCard(pRuns).catch(e => fail('vaultCard', 'vault sync', e));
  reveal(document.querySelectorAll('#heroRow > .stat'), { stagger: 80, y: 16 });
  document.querySelectorAll('main > .grid').forEach(g => onVisible(g, () => reveal(g.querySelectorAll(':scope > .sv-card, :scope > .col > .sv-card, :scope > .aud > *'), { stagger: 80, y: 16 })));
}

// ---------- hero row ----------
const statInner = (o) => { const t = document.createElement('div'); t.innerHTML = statTile(o); return t.firstElementChild.innerHTML; };
function setStat(id, o) {
  const el = $(id); if (!el) return;
  el.className = 'stat' + (o.accent ? ' is-accent' : '');
  el.innerHTML = statInner(o);
  if (o.href && el.tagName !== 'A') { el.style.cursor = 'pointer'; el.onclick = (e) => { if (!e.target.closest('a,button')) location.href = o.href; }; }
  const n = el.querySelector('[data-count]');
  if (n) countUp(n, Number(n.dataset.count), { dur: 1300 });
  growX(el, { delay: 250 });
}
function heroToday({ done, total, waiting, firstWaiting }) {
  const left = Math.max(0, total - done);
  setStat('hsToday', {
    k: 'Today', v: total ? `<span data-count="${left}">0</span>` : '0', small: total ? `of ${total} left` : 'on the list',
    d: total ? `<div class="meter" style="flex:1"><i data-growx style="--p:${Math.round(done / total * 100)}%"></i></div>` : '',
    src: `Calendar · content · tasks · ${esc(nowStamp())}`, href: '#today',
  });
  setStat('hsDecide', {
    k: 'Decide', v: `<span data-count="${waiting}">0</span>`, small: waiting === 1 ? 'waiting' : 'waiting', accent: waiting > 0,
    d: firstWaiting ? `<span class="sv-muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${esc(firstWaiting)}</span>` : 'Nothing waiting',
    src: `Command center · ${esc(nowStamp())}`, href: '#tdDecide',
  });
}
async function heroWeek() {
  const rows = (await contentSchedule()).map(r => (r.status === 'needs-confirm' && r.answer ? { ...r, status: 'ready' } : r));
  const today = todayET();
  const weeks = [...new Set(rows.map(r => String(r.week_of).slice(0, 10)))].sort();
  const wk = weeks.filter(w => w <= today).pop() || weeks[0];
  const mine = rows.filter(r => String(r.week_of).slice(0, 10) === wk && r.lane !== 'prep');
  const TARGET = { personal: 6, plugverse: 6, linkedin: 2 };
  const target = Object.values(TARGET).reduce((a, b) => a + b, 0);
  const posted = mine.filter(r => r.status === 'posted').length;
  const missed = mine.filter(r => r.status === 'missed').length;
  const lane = (l) => mine.filter(r => r.lane === l && r.status === 'posted').length;
  setStat('hsWeek', {
    k: 'Posted this week', v: `<span data-count="${posted}">0</span>`, small: `of ${target}`,
    d: `<div class="meter" style="flex:1"><i data-growx style="--p:${Math.min(100, Math.round(posted / target * 100))}%"></i></div>`,
    src: `@cooperdelo ${lane('personal')} · @plugverse.app ${lane('plugverse')} · LinkedIn ${lane('linkedin')}${missed ? ` · ${missed} missed` : ''} · wk ${esc(wk ? short(wk) : '')}`,
    href: '/admin/schedule/',
  });
}

// ---------- What to improve (v_home_recommendations) ----------
async function improve() {
  const AREA = { posting: 'Posting', content: 'Content', people: 'People', acquisition: 'Artists' };
  const SEVL = ['On goal', 'Worth a look', 'Behind', 'Far behind'];
  const rows = await homeRecommendations();
  const el = $('improve');
  const clean = (s) => esc(String(s ?? '').replace(/\s*[\u2014\u2013]\s*/g, ', '));
  const item = (r) => `<li class="imp-i sev${Number(r.severity) || 0}">
      <details>
        <summary>
          <span class="imp-area">${esc(AREA[r.area] || r.area)}</span>
          <span class="imp-txt"><span class="imp-h">${clean(r.headline)}</span></span>
          <span class="imp-sev"><i></i>${esc(SEVL[r.severity] || '')}</span>
        </summary>
        <div class="imp-body"><p class="imp-ev">${clean(r.evidence)}</p><a class="imp-act" href="${esc(r.link || '/admin/')}">${clean(r.action)} ${icon('arrow-right', { size: 13 })}</a></div>
      </details></li>`;
  el.innerHTML = head('Improve') + (rows.length ? `<ol class="imp-list">${rows.map(item).join('')}</ol>` : emptyState('Nothing to flag.', ''));
}

// ---------- LinkedIn impressions per month, 12 months, pill bars ----------
async function liChart(pPosts) {
  const posts = (await pPosts).filter(p => p.value != null);
  const host = $('heroChart');
  const end = toDate(todayET());
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(end.getFullYear(), end.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), d }); }
  const key = (y, m) => `${y}-${m}`;
  const sums = {}, counts = {};
  for (const p of posts) { const d = toDate(p.date); const k = key(d.getFullYear(), d.getMonth()); sums[k] = (sums[k] || 0) + p.value; counts[k] = (counts[k] || 0) + 1; }
  const items = months.map((mo, i) => {
    const k = key(mo.y, mo.m), v = sums[k] || 0;
    return { label: mo.d.toLocaleDateString('en-US', { month: 'short' }), value: v, now: i === 11, title: `${mo.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${fmtNum(v)} impressions, ${counts[k] || 0} posts` };
  });
  const total = items.reduce((a, b) => a + b.value, 0);
  const nPosts = months.reduce((a, mo) => a + (counts[key(mo.y, mo.m)] || 0), 0);
  if (!total) { host.innerHTML = head('LinkedIn impressions') + `<div class="hc-empty">No LinkedIn post data in the last 12 months.</div>`; return; }
  const best = items.reduce((a, b) => (b.value > a.value ? b : a));
  const asOfLI = posts.map(p => p.as_of).filter(Boolean).sort().pop() || null;
  host.innerHTML = `
    <div class="sv-h">${platMark('linkedin', 'cooperdelo')}<span class="mono">Impressions per month${asOfLI ? ` · as of ${esc(short(asOfLI))}` : ''}</span></div>
    ${pillBars(items, { height: innerWidth < 600 ? 170 : 230 })}`;
  void best;
  onVisible(host, () => growPills(host, { delay: 200 }));
  // 4th hero tile: the same total, with its source
  const spark = sparkline(items.map(i => i.value));
  setStat('hsReach', {
    k: 'LinkedIn impressions', v: `<span data-count="${total}">0</span>`,
    d: `${nPosts} posts · 12 months`, spark, src: `@cooperdelo${asOfLI ? ` · as of ${esc(short(asOfLI))}` : ''}`, href: '/admin/insights/',
  });
  drawOn($('hsReach'), { delay: 300 });
}

// ---------- System pulse (task_run_log) ----------
const SEV = { failed: 4, partial: 3, ok: 2, quiet: 1 };
async function system(pRuns) {
  const runs = await pRuns;
  const now = Date.now();
  const day = runs.filter(r => now - new Date(r.ran_at).getTime() < 864e5);
  const cnt = (k) => day.filter(r => r.status === k).length;
  const c = { ok: cnt('ok'), partial: cnt('partial'), quiet: cnt('quiet'), failed: cnt('failed') };
  const last = runs[0];
  const tasks24 = new Set(day.map(r => r.task)).size;
  if (!runs.length) { $('system').innerHTML = head('Agents') + emptyState('No runs in the last 14 days.', ''); return; }
  const days = [];
  const today0 = toDate(todayET());
  for (let i = 13; i >= 0; i--) { const d = new Date(today0); d.setDate(d.getDate() - i); days.push(d); }
  const keyET = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
  const dayKeys = days.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  const byTask = new Map();
  for (const r of runs) {
    if (!byTask.has(r.task)) byTask.set(r.task, { last: r, cells: {} });
    const k = keyET(r.ran_at), t = byTask.get(r.task);
    if (!t.cells[k] || SEV[r.status] > SEV[t.cells[k]]) t.cells[k] = r.status;
  }
  const taskRows = [...byTask.entries()]
    .sort((a, b) => (Object.keys(b[1].cells).length - Object.keys(a[1].cells).length) || (new Date(b[1].last.ran_at) - new Date(a[1].last.ran_at)))
    .slice(0, 12);
  const matrix = `<div class="mx" style="--cols:${days.length}">
      <div class="mx-row mx-head"><span class="mx-name"></span>${days.map((d, i) => `<span class="mx-d${i === days.length - 1 ? ' now' : ''}">${i % 2 === (days.length - 1) % 2 ? d.getDate() : ''}</span>`).join('')}<span class="mx-last"></span></div>
      ${taskRows.map(([task, t], ri) => `<a class="mx-row" href="/admin/rituals/#${encodeURIComponent(task)}">
        <span class="mx-name code" title="${esc(task)}">${esc(task)}</span>
        ${dayKeys.map((k, ci) => `<i class="c ${t.cells[k] || ''}" style="--d:${ri + ci}" title="${esc(task)} · ${esc(fmtDay(k))}${t.cells[k] ? ' · ' + esc(t.cells[k]) : ' · no run'}"></i>`).join('')}
        <span class="mx-last" data-ago="${esc(t.last.ran_at)}">${esc(ago(t.last.ran_at))}</span></a>`).join('')}
    </div>`;
  const seg = (k) => c[k] ? `<i class="${k}" data-growx style="flex:${c[k]}" title="${c[k]} ${k}"></i>` : '';
  $('system').innerHTML = head('Agents', '<a href="/admin/rituals/">Rituals</a>') + `<div class="sys-grid">
      <div class="sys-l">
        <span class="t-label" style="color:var(--text-3)">Runs · 24h</span>
        <span class="sys-num" id="runs24">0</span>
        <div class="sys-sub">${tasks24} agents today · ${byTask.size} in 14 days${last ? ` · last <span data-ago="${esc(last.ran_at)}">${esc(ago(last.ran_at))}</span>` : ''}</div>
        <div class="stack" aria-label="Run outcomes, last 24 hours">${day.length ? seg('ok') + seg('partial') + seg('quiet') + seg('failed') : '<i class="z"></i>'}</div>
        <div class="legend"><span><i class="c ok"></i>${c.ok} ok</span><span><i class="c partial"></i>${c.partial} partial</span><span><i class="c quiet"></i>${c.quiet} quiet</span><span><i class="c failed"></i>${c.failed} failed</span></div>
        <div class="sys-last">${runs.slice(0, 5).map(r => `<div class="lr"><i class="c ${esc(r.status)}"></i><span class="t code">${esc(r.task)}</span><span class="a" data-ago="${esc(r.ran_at)}">${esc(ago(r.ran_at))}</span></div>`).join('')}</div>
      </div>
      <div class="sys-r"><span class="t-label">14 days</span>${matrix}</div>
    </div>`;
  const el = $('system');
  onVisible(el, () => { countUp($('runs24'), day.length, { dur: 1300 }); growX(el.querySelector('.stack'), { delay: 200, stagger: 90 }); el.classList.add('in'); });
  liveAgo(document, (x) => ago(x));
}

// ---------- Audience ----------
async function audience(pAcc) {
  const list = await pAcc;
  const mine = list.filter(s => s.personal);
  const card = (s, pv) => `<a class="sv-card aud-card" href="${pv ? '/admin/plugverse/' : '/admin/insights/'}">
      ${platMark(s.platform, s.handle)}
      <span class="num" data-count="${Number(s.latest.followers)}">0</span>
      <div class="sv-label">${s.platform === 'youtube' ? 'subscribers' : 'followers'} ${deltaChip(s.latest.followers, s.prev?.followers)}</div>
      ${sparkline(s.rows.slice(0, 30).reverse().map(r => r.followers))}
      <div class="sv-meta">as of ${esc(short(s.latest.captured_at || s.latest.date))} ${staleChip(s.latest.captured_at || s.latest.date)}</div>
    </a>`;
  const animate = (grid) => onVisible(grid, () => grid.querySelectorAll('.aud-card').forEach((c, i) => {
    countUp(c.querySelector('[data-count]'), Number(c.querySelector('[data-count]').dataset.count), { delay: 150 + i * 90 });
    drawOn(c, { delay: 400 + i * 90 }); pop(c.querySelectorAll('.chip'), { delay: 1100 + i * 90 });
  }));
  // 2x2 next to the chart: the four biggest personal accounts. Everything else (X, PlugVerse) in one row below.
  const top = [...mine].sort((a, b) => b.latest.followers - a.latest.followers).slice(0, 4);
  const rest = [...mine.filter(s => !top.includes(s)).map(s => [s, false]), ...list.filter(s => /plugverse/i.test(s.handle)).map(s => [s, true])];
  $('pulse').innerHTML = top.length ? top.map(s => card(s, false)).join('') : `<div class="sv-card">${emptyState('No follower data yet.', '')}</div>`;
  animate($('pulse'));
  if (rest.length) { $('pvSec').hidden = false; $('pvGrid').style.setProperty('--n', Math.min(4, rest.length)); $('pvGrid').innerHTML = rest.map(([s, pv]) => card(s, pv)).join(''); animate($('pvGrid')); }
}

// ---------- Body ----------
async function health() {
  const { data, error } = await sb.from('health_daily').select('day,sleep_minutes,sleep_score,steps,resting_hr,hrv_ms,body_battery_high,garmin_synced_at').order('day', { ascending: false }).limit(14);
  if (error) throw error;
  const r = (data || []).find(x => x.sleep_minutes != null || x.steps != null || x.resting_hr != null) || data?.[0];
  const [wq, fq, gq, pq] = await Promise.all([
    sb.from('health_daily').select('day,weight_lb').not('weight_lb', 'is', null).order('day', { ascending: false }).limit(30),
    sb.from('health_food_log').select('calories').eq('day', todayET()),
    sb.from('health_goals').select('target_weight_lb').eq('id', 1).maybeSingle(),
    sb.from('health_progress_photo').select('taken_on,photo_path').order('taken_on', { ascending: false }).order('id', { ascending: false }).limit(4),
  ]);
  const wts = wq.data || [];
  const w0 = wts[0], w1 = wts[1], wFirst = wts[wts.length - 1];
  const kcal = (fq.data || []).reduce((a, x) => a + (x.calories || 0), 0);
  const wDelta = w0 && w1 ? w0.weight_lb - w1.weight_lb : null;
  const target = gq.data?.target_weight_lb != null ? Number(gq.data.target_weight_lb) : null;
  const toGoal = w0 && target != null ? Number(w0.weight_lb) - target : null;
  const span = wFirst && target != null ? Number(wFirst.weight_lb) - target : null;
  const pct = span > 0 && toGoal != null ? Math.max(0, Math.min(1, 1 - toGoal / span)) : null;
  const photos = pq.data || [];
  const thumbs = (await Promise.all(photos.map(async p => {
    const { data: s } = await sb.storage.from('health-progress-photos').createSignedUrl(p.photo_path, 3600);
    return s?.signedUrl ? `<figure><img src="${esc(s.signedUrl)}" alt="" loading="lazy"><figcaption class="sv-meta">${esc(short(p.taken_on))}</figcaption></figure>` : '';
  }))).join('');
  const cell = (k, v, unit = '') => `<div><div class="k">${k}</div><div class="v">${v}${unit && v !== '–' ? `<small>${unit}</small>` : ''}</div></div>`;
  const sleep = r?.sleep_minutes != null ? `${Math.floor(r.sleep_minutes / 60)}h ${r.sleep_minutes % 60}m` : '–';
  $('health').innerHTML = head('Body', '<a href="/admin/health/dashboard.html">Health</a>') + `
    <div class="dec-num"><span class="num lg">${w0 ? Number(w0.weight_lb).toFixed(1) : '–'}</span><span class="mono">lb${target != null ? ` · goal ${target}` : ''}${toGoal != null ? ` · ${toGoal > 0 ? toGoal.toFixed(1) : '0'} to go` : ''}</span></div>
    ${pct != null ? `<div class="meter bd-goal" role="img" aria-label="${Math.round(pct * 100)}% of the way to ${target} lb"><i data-growx style="--p:${(pct * 100).toFixed(1)}%"></i></div>` : ''}
    <div class="sv-meta">${w0 ? 'Weigh-in ' + esc(short(w0.day)) + (wDelta != null ? ' · ' + (wDelta > 0 ? '+' : '') + wDelta.toFixed(1) + ' lb' : '') : 'No weigh-ins'}</div>
    <form id="weighForm" class="bd-row">
      <input id="weighIn" type="number" step="0.1" min="50" max="400" inputmode="decimal" placeholder="Weigh-in, lb" required>
      <button class="btn small primary" type="submit">Log</button>
    </form>
    ${thumbs ? `<div class="bd-photos">${thumbs}</div>` : ''}
    <form id="photoForm" class="bd-row">
      <input id="photoIn" type="file" accept="image/*" capture="user" required>
      <button class="btn small" type="submit">Add photo</button>
    </form>
    <div class="health-grid" style="margin-top:18px">
      ${cell('Sleep', sleep)}${cell('Steps', fmtNum(r?.steps))}${cell('Resting HR', r?.resting_hr ?? '–', 'bpm')}
      ${cell('HRV', r?.hrv_ms ?? '–', 'ms')}${cell('Battery', r?.body_battery_high ?? '–')}${cell('Food today', kcal ? fmtNum(kcal) : '–', 'kcal')}
    </div>
    <div class="sv-meta">${r ? `Garmin · ${esc(short(r.day))} · synced ${esc(ago(r.garmin_synced_at || r.day))} ${staleChip(r.garmin_synced_at || r.day)}` : 'No Garmin data'}</div>`;
  onVisible($('health'), () => growX($('health'), { delay: 200 }));
}

// One-tap weigh-in: upserts only weight columns so Garmin/self-report columns on that day are untouched.
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'photoForm') {
    e.preventDefault();
    const f = document.getElementById('photoIn').files[0];
    if (!f) { toast('Pick a photo first', 'err'); return; }
    const day = todayET();
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${day}/${Date.now()}.${ext}`;
    const up = await sb.storage.from('health-progress-photos').upload(path, f, { contentType: f.type || 'image/jpeg' });
    if (up.error) { toast('Upload failed: ' + up.error.message, 'err'); return; }
    const ins = await sb.from('health_progress_photo').insert({ taken_on: day, photo_path: path, kind: 'face' });
    if (ins.error) { toast('Save failed: ' + ins.error.message, 'err'); return; }
    toast('Photo saved', 'ok');
    health().catch(() => {});
    return;
  }
  if (e.target.id !== 'weighForm') return;
  e.preventDefault();
  const v = parseFloat(document.getElementById('weighIn').value);
  if (!(v >= 50 && v <= 400)) { toast('Enter weight in lb', 'err'); return; }
  const { error } = await sb.from('health_daily').upsert({ day: todayET(), weight_lb: v, weight_source: 'manual' }, { onConflict: 'day' });
  if (error) { toast('Save failed: ' + error.message, 'err'); return; }
  toast('Weigh-in logged', 'ok');
  health().catch(() => {});
});

// ---------- Vault mirror freshness ----------
async function vaultCard(pRuns) {
  let docs;
  if (DEMO) docs = (SNAP?.vault?.docs || []).map(([path, updated_at, owner_task]) => ({ path, updated_at, owner_task }));
  else {
    const { data, error } = await sb.from('vault_documents').select('path,updated_at,owner_task').order('updated_at', { ascending: false }).limit(1000);
    if (error) throw error; docs = data || [];
  }
  const runs = await pRuns.catch(() => []);
  const sync = runs.find(r => /vault-sync|supabase-vault-sync/.test(r.task));
  const last = docs[0]?.updated_at;
  const day = docs.filter(d => Date.now() - new Date(d.updated_at) < 864e5).length;
  const total = DEMO && SNAP?.vault?.docs_total ? SNAP.vault.docs_total : docs.length;
  $('vaultCard').innerHTML = head('Vault', '<a href="/admin/vault/">Open</a>') + `
    <div class="dec-num"><span class="num lg" data-count="${total}">0</span><span class="mono">files · ${day} changed 24h</span></div>
    <div class="sv-meta">Last change ${last ? esc(ago(last)) : 'never'} ${last ? staleChip(last, 6) : ''}${sync ? ` · sync ${esc(ago(sync.ran_at))}` : ''}</div>`;
  onVisible($('vaultCard'), () => countUp($('vaultCard').querySelector('[data-count]'), total, { dur: 1100 }));
}
