// /admin/_js/home.js — Home (v6 "signature" pass, 2026-09-28).
// Reads: social_account_snapshots, social_posts + social_post_snapshots (LinkedIn
// impressions per post), task_run_log (14 days), decisions, opportunities,
// vault_documents (Daily/driver/<date>.md), daily_driver, health_daily.
// Every number is real or an honest empty state. No placeholder figures.
//
// Localhost-only design preview: http://localhost:<port>/admin/?demo renders the
// same layout from admin/_dev/snapshot.local.json (gitignored, never deployed).
// On any other host ?demo is ignored and the normal auth gate applies.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';
import { esc, fmtNum, fmtCompact, fmtDay, ago, deltaChip, platMark, emptyState, sparkline, todayET, toDate, staleChip, asOf, icon } from '/admin/_shell/ui.js';
import { accountSeries, groupAccounts, postsWithMetrics } from '/admin/_shell/data.js';
import { homeRecommendations } from '/admin/_shell/live-data.js';
import { mountToday } from '/admin/_js/today.js';
import { reveal, countUp, drawOn, growBars, growX, pop, spotlight, onVisible, liveAgo } from '/admin/_shell/motion.js';

const ctx = await mountShell({ title: 'Home', demo: true });
const $ = (id) => document.getElementById(id);
const DEMO = !!ctx?.demo;
let SNAP = null;
if (DEMO) {
  try { SNAP = await (await fetch('/admin/_dev/snapshot.local.json', { cache: 'no-store' })).json(); }
  catch (e) { SNAP = null; console.error('demo snapshot missing', e); }
}

// ---------- masthead ----------
function paintClock() {
  const now = new Date();
  const h = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }));
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  $('greet').textContent = `${part}, Cooper`;
}
paintClock(); setInterval(paintClock, 30000);
reveal(document.querySelectorAll('#mast h1'), { y: 8 });
spotlight(document);

if (DEMO) {
  const flag = document.createElement('div');
  flag.className = 'demo-flag';
  flag.innerHTML = SNAP
    ? `<b>Demo</b> · snapshot from ${esc(fmtDay(SNAP.captured_at, { month: 'short', day: 'numeric' }))}, ${esc(new Date(SNAP.captured_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }))}`
    : '<b>Demo</b> · snapshot file not found';
  document.querySelector('main').prepend(flag);
}
// "as of Sep 27, 4:00 PM" -> "As of Sep 27, 4:00 PM"
const asOfCap = (x) => asOf(x).replace('<span>as of', '<span>As of');

const fail = (id, what, e) => { console.error(what, e); const el = $(id); if (el) el.innerHTML = emptyState(`Couldn't load ${what}`, esc(e?.message || String(e))); };
const privateCard = (title) => `<div class="sv-h" style="margin-bottom:.4rem"><h2 class="disp">${esc(title)}</h2></div>
  ${emptyState('Private. Shows when you sign in.', '')}`;

// ---------- data ----------
async function loadAccounts() {
  if (DEMO) return groupAccounts((SNAP?.accounts || []).map(([date, platform, handle, followers, captured_at]) => ({ date, platform, handle, followers, captured_at, window_days: 0 }))).list;
  return (await accountSeries()).list;
}
async function loadLinkedInPosts() {
  if (DEMO) return (SNAP?.linkedin_posts || []).map(([date, value]) => ({ date, value }));
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
  mountToday().catch(e => fail('tdDo', 'today', e));
  improve().catch(e => fail('improve', 'recommendations', e));
  heroChart(loadLinkedInPosts()).catch(e => fail('heroChart', 'LinkedIn posts', e));
  system(pRuns).catch(e => fail('system', 'task runs', e));
  audience(pAcc).catch(e => fail('pulse', 'followers', e));
  // 2026-09-28 design audit: the hero follower cells (duplicated Audience), the "Booking link"
  // placeholder, the "Waiting on you" count (duplicated Decide) and the runs pill (duplicated
  // System pulse) were removed. Each number now has one home on this page.
  if (DEMO) { $('health').innerHTML = privateCard('Body'); }
  else { health().catch(e => fail('health', 'health', e)); }
  vaultCard(pRuns).catch(e => fail('vaultCard', 'vault sync', e));
  document.querySelectorAll('main > .sv-section').forEach(s => onVisible(s, () => reveal(s.querySelectorAll(':scope > .sv-h, :scope > .sv-card, :scope > .sv-grid > *, :scope > .sv-card'), { stagger: 80 })));
}

// ---------- What to improve (v_home_recommendations) ----------
// Rules live in SQL so every number is computed from the same rows the rest of the admin
// reads. Tap a row to see the detail; the action goes to the page where you fix it.
async function improve() {
  const AREA = { posting: 'Posting', content: 'Content', people: 'People', acquisition: 'Artists' };
  const SEVL = ['On goal', 'Worth a look', 'Behind', 'Far behind'];
  const rows = await homeRecommendations();
  const el = $('improve');
  const clean = (s) => esc(String(s ?? '').replace(/\s*[—–]\s*/g, ', '));
  const item = (r, i) => `<li class="imp-i sev${Number(r.severity) || 0}">
      <details${i === 0 ? ' open' : ''}>
        <summary>
          <span class="imp-area">${esc(AREA[r.area] || r.area)}</span>
          <span class="imp-txt"><span class="imp-h">${clean(r.headline)}</span><span class="imp-ev">${clean(r.evidence)}</span></span>
          <span class="imp-sev" title="${esc(SEVL[r.severity] || '')}"><i></i>${esc(SEVL[r.severity] || '')}</span>
        </summary>
        <div class="imp-body">
          ${r.detail ? `<p>${clean(r.detail)}</p>` : ''}
          <a class="imp-act" href="${esc(r.link || '/admin/')}">${clean(r.action)} ${icon('arrow-right', { size: 14 })}</a>
        </div>
      </details></li>`;
  el.innerHTML = `<div class="sv-h"><h2 class="disp">What to improve</h2></div>
    ${rows.length ? `<ol class="imp-list">${rows.map(item).join('')}</ol>` : emptyState('Nothing to flag right now.', '')}`;
  reveal(el.querySelectorAll('.imp-i'), { stagger: 50, y: 8 });
}

// ---------- HERO: LinkedIn impressions per post, last 12 months ----------
async function heroChart(pPosts) {
  const posts = (await pPosts).filter(p => p.value != null);
  const host = $('heroChart');
  const end = toDate(todayET()).getTime() + 864e5, start = end - 365 * 864e5;
  const inWin = posts.filter(p => { const t = toDate(p.date).getTime(); return t >= start && t <= end; }).sort((a, b) => toDate(a.date) - toDate(b.date));
  if (!inWin.length) { host.innerHTML = `<div class="hc-empty">No LinkedIn post data in the last 12 months.</div>`; return; }
  const max = Math.max(...inWin.map(p => p.value));
  const total = inWin.reduce((a, p) => a + p.value, 0);
  const peak = inWin.find(p => p.value === max);
  const X = (d) => (toDate(d).getTime() - start) / (end - start) * 100;
  const H = 100;
  const bars = inWin.map((p, i) => {
    const h = Math.max(1.2, p.value / max * H);
    return `<rect data-grow data-i="${i}" class="${p === peak ? 'peak' : ''}" x="${(X(p.date) * 10 - 3).toFixed(1)}" y="${(H - h).toFixed(2)}" width="6" height="${h.toFixed(2)}" rx="1"/>`;
  }).join('');
  let months = '';
  for (let m = 0; m < 12; m++) {
    const d = new Date(end - 365 * 864e5); d.setDate(1); d.setMonth(d.getMonth() + m + 1);
    if (d.getTime() > end) break;
    months += `<span class="${m % 2 ? 'odd' : ''}" style="left:${X(d).toFixed(2)}%">${d.toLocaleDateString('en-US', { month: 'short' })}</span>`;
  }
  const px = X(peak.date);
  host.innerHTML = `
    <div class="hch-head">
      <div><div class="eyebrow">LinkedIn impressions per post, last 12 months</div>
        <div class="hch-total"><span class="hc-num sm" id="liTotal">0</span><span class="mono">across ${inWin.length} posts</span></div></div>
    </div>
    <div class="hch-plot">
      <div class="hch-rule" style="bottom:100%"><span>${fmtCompact(max)}</span></div>
      <div class="hch-rule" style="bottom:50%"><span>${fmtCompact(Math.round(max / 2))}</span></div>
      <svg viewBox="0 0 1000 ${H}" preserveAspectRatio="none" role="img" aria-label="LinkedIn impressions per post, last 12 months">${bars}</svg>
      <div class="hch-peak${px > 82 ? ' r' : px < 10 ? ' l' : ''}" style="left:${px.toFixed(2)}%"><span>Best: ${fmtNum(max)} <em>· ${esc(fmtDay(peak.date, { month: 'short', day: 'numeric' }))}</em></span></div>
      <div class="hch-tip" hidden></div>
    </div>
    <div class="hch-months">${months}</div>`;
  const svg = host.querySelector('svg'), tip = host.querySelector('.hch-tip'), plot = host.querySelector('.hch-plot');
  svg.querySelectorAll('rect').forEach(r => {
    r.addEventListener('pointerenter', () => {
      const p = inWin[+r.dataset.i];
      tip.hidden = false; tip.innerHTML = `<b>${fmtNum(p.value)}</b> impressions · ${esc(fmtDay(p.date, { month: 'short', day: 'numeric', year: 'numeric' }))}`;
      const pr = plot.getBoundingClientRect(), rr = r.getBoundingClientRect();
      tip.style.left = Math.min(pr.width - 220, Math.max(0, rr.left - pr.left - 90)) + 'px';
      r.classList.add('on');
    });
    r.addEventListener('pointerleave', () => { tip.hidden = true; r.classList.remove('on'); });
  });
  onVisible(host, () => {
    growBars(svg, { delay: 300, stagger: 8 });
    countUp($('liTotal'), total, { delay: 300, dur: 1200 });
    // animate the label, not .hch-peak itself: its CSS transform keeps it inside the card
    reveal(host.querySelectorAll('.hch-peak span'), { delay: 900, y: 4 });
  });
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


  if (!runs.length) { $('system').innerHTML = emptyState('No runs in the last 14 days.', ''); return; }

  // matrix: 14 days x tasks (most recently run first)
  const days = [];
  const today0 = toDate(todayET());
  for (let i = 13; i >= 0; i--) { const d = new Date(today0); d.setDate(d.getDate() - i); days.push(d); }
  const keyET = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const dayKeys = days.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  const byTask = new Map();
  for (const r of runs) {
    if (!byTask.has(r.task)) byTask.set(r.task, { last: r, cells: {} });
    const k = keyET(r.ran_at), t = byTask.get(r.task);
    if (!t.cells[k] || SEV[r.status] > SEV[t.cells[k]]) t.cells[k] = r.status;
  }
  // Rows: the agents with the most active days first (shows rhythm and repeat
  // failures), ties broken by most recent run.
  const taskRows = [...byTask.entries()]
    .sort((a, b) => (Object.keys(b[1].cells).length - Object.keys(a[1].cells).length) || (new Date(b[1].last.ran_at) - new Date(a[1].last.ran_at)))
    .slice(0, 14);
  const matrix = `<div class="mx" style="--cols:${days.length}">
      <div class="mx-row mx-head"><span class="mx-name"></span>${days.map((d, i) => `<span class="mx-d${i === days.length - 1 ? ' now' : ''}">${i % 2 === (days.length - 1) % 2 ? d.toLocaleDateString('en-US', { day: 'numeric' }) : ''}</span>`).join('')}<span class="mx-last"></span></div>
      ${taskRows.map(([task, t], ri) => `<a class="mx-row" href="/admin/rituals/#${encodeURIComponent(task)}">
        <span class="mx-name code" title="${esc(task)}">${esc(task)}</span>
        ${dayKeys.map((k, ci) => `<i class="c ${t.cells[k] || ''}" style="--d:${ri + ci}" title="${esc(task)} · ${esc(fmtDay(k))}${t.cells[k] ? ' · ' + esc(t.cells[k]) : ' · no run'}"></i>`).join('')}
        <span class="mx-last" data-ago="${esc(t.last.ran_at)}">${esc(ago(t.last.ran_at))}</span></a>`).join('')}
    </div>`;
  const total = day.length || 1;
  const seg = (k) => c[k] ? `<i class="${k}" data-growx style="flex:${c[k]}" title="${c[k]} ${k}"></i>` : '';
  $('system').innerHTML = `<div class="sys-grid">
      <div class="sys-l">
        <div class="eyebrow">Runs in the last 24 hours</div>
        <div class="hc-num sys-num" id="runs24" data-count="${day.length}">0</div>
        <div class="sys-sub">${tasks24} agents today · ${byTask.size} in 14 days${last ? ` · last run <span data-ago="${esc(last.ran_at)}">${esc(ago(last.ran_at))}</span>` : ''}</div>
        <div class="stack" aria-label="Run outcomes, last 24 hours">${day.length ? seg('ok') + seg('partial') + seg('quiet') + seg('failed') : '<i class="z"></i>'}</div>
        <div class="legend">
          <span><i class="c ok"></i>${c.ok} ok</span><span><i class="c partial"></i>${c.partial} partial</span>
          <span><i class="c quiet"></i>${c.quiet} quiet</span><span><i class="c failed"></i>${c.failed} failed</span>
        </div>
        <div class="sys-last">
          ${runs.slice(0, 5).map(r => `<div class="lr"><i class="c ${esc(r.status)}"></i><span class="t code">${esc(r.task)}</span><span class="a" data-ago="${esc(r.ran_at)}">${esc(ago(r.ran_at))}</span></div>`).join('')}
        </div>
      </div>
      <div class="sys-r">
        <div class="eyebrow">Last 14 days</div>
        ${matrix}
      </div>
    </div>`;
  const el = $('system');
  onVisible(el, () => {
    countUp($('runs24'), day.length, { dur: 1200 });
    growX(el.querySelector('.stack'), { delay: 200, stagger: 90 });
    el.classList.add('in');
  });
  liveAgo(document, (x) => ago(x));
  void total;
}

// ---------- Audience ----------
async function audience(pAcc) {
  const list = await pAcc;
  const mine = list.filter(s => s.personal);
  const card = (s, pv) => `<a class="sv-card aud-card${pv ? ' pvc' : ''}" href="${pv ? '/admin/plugverse/' : '/admin/insights/'}">
      ${platMark(s.platform, s.handle)}
      <div class="hc-num md" data-count="${Number(s.latest.followers)}">0</div>
      <div class="sv-label">${s.platform === 'youtube' ? 'subscribers' : 'followers'} ${deltaChip(s.latest.followers, s.prev?.followers)}</div>
      ${sparkline(s.rows.slice(0, 30).reverse().map(r => r.followers))}
      <div class="sv-meta">${asOfCap(s.latest.captured_at || s.latest.date)}${s.prev ? ` · vs ${esc(fmtDay(s.prev.date))}` : ''}</div>
    </a>`;
  const animate = (grid) => onVisible(grid, () => grid.querySelectorAll('.aud-card').forEach((c, i) => {
    countUp(c.querySelector('[data-count]'), Number(c.querySelector('[data-count]').dataset.count), { delay: 150 + i * 90 });
    drawOn(c, { delay: 400 + i * 90 }); pop(c.querySelectorAll('.chip'), { delay: 1100 + i * 90 });
  }));
  $('pulse').innerHTML = mine.length ? mine.map(s => card(s, false)).join('') : emptyState('No follower data yet.', '');
  animate($('pulse'));
  const pv = list.filter(s => /plugverse/i.test(s.handle));
  if (pv.length) { $('pvSec').hidden = false; $('pvGrid').innerHTML = pv.map(s => card(s, true)).join(''); animate($('pvGrid')); }
}

// ---------- Body (signed in only) ----------
async function health() {
  const { data, error } = await sb.from('health_daily').select('day,sleep_minutes,sleep_score,steps,resting_hr,hrv_ms,body_battery_high,garmin_synced_at').order('day', { ascending: false }).limit(14);
  if (error) throw error;
  const r = (data || []).find(x => x.sleep_minutes != null || x.steps != null || x.resting_hr != null) || data?.[0];
  if (!r) { $('health').innerHTML = `<div class="sv-h"><h2 class="disp">Body</h2></div>` + emptyState('No Garmin data yet.', ''); return; }
  const cell = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const sleep = r.sleep_minutes != null ? `${Math.floor(r.sleep_minutes / 60)}h ${r.sleep_minutes % 60}m` : '—';
  $('health').innerHTML = `<div class="sv-h" style="margin-bottom:.2rem"><h2 class="disp">Body</h2><a href="/admin/health/dashboard.html">Health insights</a></div>
    <div class="health-grid">
      ${cell('Sleep', sleep)}${cell('Sleep score', r.sleep_score ?? '—')}${cell('Steps', fmtNum(r.steps))}
      ${cell('Resting HR', r.resting_hr ?? '—')}${cell('HRV', r.hrv_ms != null ? r.hrv_ms + ' ms' : '—')}${cell('Body battery', r.body_battery_high ?? '—')}
    </div>
    <div class="sv-meta">Garmin · day ${esc(fmtDay(r.day, { weekday: 'short', month: 'short', day: 'numeric' }))} · synced ${esc(ago(r.garmin_synced_at || r.day))} ${staleChip(r.garmin_synced_at || r.day)}</div>`;
}

// ---------- Vault sync (freshness of the vault mirror in Supabase) ----------
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
  const total = DEMO && SNAP?.vault?.docs_total ? SNAP.vault.docs_total : docs.length; // demo slice is partial
  $('vaultCard').innerHTML = `<div class="sv-h" style="margin-bottom:.2rem"><h2 class="disp">Vault</h2><a href="/admin/vault/">Open</a></div>
    <div class="dec-num"><span class="hc-num md" data-count="${total}">0</span><span class="mono">files mirrored · ${day} changed in 24h</span></div>
    <div class="sv-meta">Last change ${last ? esc(ago(last)) : 'never'} ${last ? staleChip(last, 6) : ''}${sync ? ` · sync ran ${esc(ago(sync.ran_at))}` : ''}</div>`;
  onVisible($('vaultCard'), () => countUp($('vaultCard').querySelector('[data-count]'), total, { dur: 900 }));
}

