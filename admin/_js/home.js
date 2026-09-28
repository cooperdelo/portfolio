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
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { esc, fmtNum, fmtCompact, fmtDay, ago, deltaChip, platMark, platName, emptyState, sparkline, statusChip, todayET, toDate, staleChip, asOf } from '/admin/_shell/ui.js';
import { accountSeries, groupAccounts, postsWithMetrics } from '/admin/_shell/data.js';
import { dataFreshness } from '/admin/_shell/live-data.js';
import { freshStrip } from '/admin/_shell/ui.js';
import { mountToday } from '/admin/_js/today.js';
import { REDUCED, reveal, countUp, drawOn, growBars, growX, pop, spotlight, onVisible, liveAgo } from '/admin/_shell/motion.js';

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
reveal(document.querySelectorAll('#mast h1, #mast .quick'), { stagger: 90, y: 22 });
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
async function loadOpen() {
  if (DEMO) return { counts: SNAP?.open || { decisions: 0, opportunities: 0 }, dec: null, opp: null };
  const [{ data: dec, error: e1 }, { data: opp, error: e2 }] = await Promise.all([
    sb.from('decisions').select('id,title,recommendation,created_at').eq('status', 'open').order('created_at', { ascending: false }),
    sb.from('opportunities').select('id,title,fit,time_hours,proof,estimate').eq('status', 'open').order('rank'),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  return { counts: { decisions: dec?.length || 0, opportunities: opp?.length || 0 }, dec: dec || [], opp: opp || [] };
}

if (ctx?.role === 'full') {
  const pAcc = loadAccounts();
  const pOpen = loadOpen();
  const pRuns = loadRuns();
  mountToday().catch(e => fail('tdDo', 'today', e));
  hero(pAcc, pOpen).catch(e => fail('heroGrid', 'today numbers', e));
  heroChart(loadLinkedInPosts()).catch(e => fail('heroChart', 'LinkedIn posts', e));
  system(pRuns).catch(e => fail('system', 'task runs', e));
  audience(pAcc).catch(e => fail('pulse', 'followers', e));
  // TODAY (command_center) replaced the must-dos + "waiting on you" cards and the feed strip.
  if (DEMO) { $('health').innerHTML = privateCard('Body'); }
  else { health().catch(e => fail('health', 'health', e)); }
  vaultCard(pRuns).catch(e => fail('vaultCard', 'vault sync', e));
  document.querySelectorAll('main > .sv-section').forEach(s => onVisible(s, () => reveal(s.querySelectorAll(':scope > .sv-h, :scope > .sv-card, :scope > .sv-grid > *, :scope > .sv-card'), { stagger: 80 })));
}

// ---------- Feed status strip (v_admin_data_freshness_status) ----------
async function freshness() {
  const el = $('fresh');
  el.innerHTML = freshStrip(await dataFreshness(), { link: '/admin/vault/' });
  reveal(el.querySelectorAll('.fs-line'), { stagger: 50, y: 6 });
}

// ---------- HERO: four big numbers ----------
async function hero(pAcc, pOpen) {
  const [list, open] = await Promise.all([pAcc, pOpen.catch(() => null)]);
  const find = (p) => list.find(s => s.personal && s.platform === p);
  const li = find('linkedin'), ig = find('instagram');
  const acctCell = (s, platform) => {
    if (!s) return `<div class="hero-cell off"><div class="hc-top"><span class="hc-label">${esc(platName(platform))}</span></div>
      <div class="hc-num dim">—</div><div class="hc-sub">No follower data yet</div></div>`;
    const L = s.latest;
    return `<a class="hero-cell" href="/admin/insights/">
      <div class="hc-top"><span class="hc-label">${esc(platName(platform))}</span><span class="hc-handle mono">@${esc(s.handle)}</span></div>
      <div class="hc-num" data-count="${Number(L.followers)}">0</div>
      <div class="hc-sub">${platform === 'youtube' ? 'subscribers' : 'followers'} ${deltaChip(L.followers, s.prev?.followers)}</div>
      ${sparkline(s.rows.slice(0, 30).reverse().map(r => r.followers), { w: 220, h: 30 })}
      <div class="hc-meta">${asOfCap(L.captured_at || L.date)}${s.prev ? ` · vs ${esc(fmtDay(s.prev.date))}` : ''}</div>
    </a>`;
  };
  const booking = `<div class="hero-cell off">
      <div class="hc-top"><span class="hc-label">Booking link</span></div>
      <div class="hc-num dim">—</div>
      <div class="hc-sub">Not tracked yet</div>
    </div>`;
  let waiting;
  if (!open) waiting = `<div class="hero-cell off"><div class="hc-top"><span class="hc-label">Waiting on you</span></div><div class="hc-num dim">—</div><div class="hc-sub">Couldn't read decisions</div></div>`;
  else {
    const { decisions: d, opportunities: o } = open.counts, n = d + o;
    waiting = `<a class="hero-cell hot" href="/admin/decisions/">
      <div class="hc-top"><span class="hc-label">Waiting on you</span></div>
      <div class="hc-num" data-count="${n}">0</div>
      <div class="hc-sub">open items</div>
      <div class="split-bar" aria-hidden="true">${n ? `<i class="d" data-growx style="flex:${d || 0}"></i><i class="o" data-growx style="flex:${o || 0}"></i>` : '<i class="z"></i>'}</div>
      <div class="hc-meta"><span class="k d"></span>${d} decision${d === 1 ? '' : 's'} · <span class="k o"></span>${o} opportunit${o === 1 ? 'y' : 'ies'}</div>
    </a>`;
  }
  const grid = $('heroGrid');
  grid.innerHTML = acctCell(li, 'linkedin') + acctCell(ig, 'instagram') + booking + waiting;
  const cells = grid.querySelectorAll('.hero-cell');
  reveal(cells, { stagger: 60, delay: 100 });
  cells.forEach((c, i) => {
    const num = c.querySelector('[data-count]');
    if (num) countUp(num, Number(num.dataset.count), { delay: 200 + i * 60 });
    pop(c.querySelectorAll('.chip'), { delay: 900 + i * 60 });
    drawOn(c, { delay: 400 + i * 60, dur: 1000 });
    growX(c, { delay: 500 + i * 60 });
  });
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
    months += `<span style="left:${X(d).toFixed(2)}%">${d.toLocaleDateString('en-US', { month: 'short' })}</span>`;
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
    reveal(host.querySelectorAll('.hch-peak'), { delay: 900, y: 4 });
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

  // hero pill
  const pill = $('pulsePill');
  pill.classList.toggle('bad', c.failed > 0);
  pill.innerHTML = last
    ? `<i></i><span>${tasks24} agents ran today</span><span class="sep">·</span><span>${c.failed ? `${c.failed} failed` : 'none failed'}</span><span class="sep">·</span><span>last run <b data-ago="${esc(last.ran_at)}">${esc(ago(last.ran_at))}</b></span>`
    : `<i></i><span>No runs in 14 days</span>`;

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
        <div class="sys-sub">${tasks24} agents today · ${byTask.size} in the last 14 days</div>
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

// ---------- Waiting on you ----------
async function decide(pOpen) {
  const open = await pOpen;
  const { decisions: d, opportunities: o } = open.counts, n = d + o;
  const list = open.dec == null
    ? emptyState('Titles show when you sign in.', '')
    : `<div class="rows">
      ${open.dec.slice(0, 3).map(x => `<a class="row" href="/admin/decisions/"><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">Decision${x.recommendation ? ' · ' + esc(x.recommendation) : ''}</div></div></a>`).join('')}
      ${open.opp.slice(0, 3).map(x => `<a class="row" href="/admin/earn/"><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">Opportunity${x.estimate ? ' · ' + esc(x.estimate) : ''}</div></div>${x.fit != null ? `<span class="sv-muted" style="font-size:.8rem">Fit ${esc(x.fit)}</span>` : ''}</a>`).join('')}
    </div>${n ? '' : emptyState('Nothing waiting.', '')}`;
  $('decide').innerHTML = `<div class="sv-h" style="margin-bottom:.2rem"><h2 class="disp">Waiting on you</h2><a href="/admin/decisions/">All decisions</a></div>
    <div class="dec-num"><span class="hc-num md" data-count="${n}">0</span><span class="mono">${d} decision${d === 1 ? '' : 's'}, ${o} opportunit${o === 1 ? 'y' : 'ies'}</span></div>
    ${list}`;
  onVisible($('decide'), () => countUp($('decide').querySelector('[data-count]'), n, { dur: 900 }));
}

// ---------- Must-dos + streaks (signed in only) ----------
async function mustDos() {
  const today = todayET();
  const [{ data: docs, error }, { data: dd, error: e2 }] = await Promise.all([
    sb.from('vault_documents').select('path,content,updated_at').like('path', 'Daily/driver/%').order('path', { ascending: false }).limit(1),
    sb.from('daily_driver').select('*').order('date', { ascending: false }).limit(120),
  ]);
  if (error) throw error; if (e2) throw e2;
  const doc = docs?.[0];
  let body = '';
  // Staleness rule (2026-09-28): an earlier day's driver is never shown as today's list.
  const docDay = doc?.path.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!doc) {
    body = emptyState('No must-dos yet today.', '');
  } else if (docDay && docDay !== today) {
    body = `${emptyState("Today's driver hasn't been written yet.", '')}<div class="sv-meta">Last one was ${esc(fmtDay(docDay, { weekday: 'short', month: 'short', day: 'numeric' }))}, hidden because it's not today's.</div>`;
  } else {
    const lines = doc.content.split('\n').map(s => s.trim()).filter(Boolean).filter(s => !s.startsWith('#'));
    const todos = lines.filter(s => /^\d+\.\s/.test(s)).map(s => s.replace(/^\d+\.\s*/, ''));
    const other = lines.filter(s => !/^\d+\.\s/.test(s));
    const isToday = doc.path.includes(today);
    body = `${todos.map((t, i) => `<div class="todo"><span class="n">${i + 1}</span><div class="x">${esc(t)}</div></div>`).join('') || emptyState('No must-dos listed in today\'s file.', '')}
      ${other.length ? `<div class="sv-meta" style="display:block;line-height:1.55">${other.map(esc).join('<br>')}</div>` : ''}
      <div class="sv-meta">Updated ${esc(ago(doc.updated_at))}${isToday ? '' : ' · <span style="color:var(--amber)">from an earlier day</span>'}</div>`;
  }
  $('mustdos').innerHTML = `<div class="sv-h" style="margin-bottom:.4rem"><h2 class="disp">Today's must-dos</h2><a href="/admin/rituals/#daily-driver">Daily driver</a></div>${body}
    <div class="streaks" id="streaks"></div>`;
  renderStreaks(dd || [], today);
  reveal($('mustdos').querySelectorAll('.todo'), { stagger: 60, delay: 100, y: 10 });
}
function streakFor(rows, key) {
  let n = 0, last = null;
  for (const r of rows) {
    if (last) { const gap = (toDate(last) - toDate(r.date)) / 864e5; if (gap > 1.5) break; }
    last = r.date;
    if (r[key] === true) n++; else if (r[key] === false) break;
  }
  return n;
}
function renderStreaks(rows, today) {
  const todayRow = rows.find(r => r.date === today) || {};
  const defs = [['gym', 'Gym'], ['content', 'Content'], ['sleep_ok', 'Sleep']];
  $('streaks').innerHTML = defs.map(([k, label]) => {
    const n = streakFor(rows, k);
    const on = todayRow[k] === true;
    return `<div class="streak"><div><div class="k">${label}</div><div class="v">${n} day streak${rows.length ? ` · last logged ${esc(fmtDay(rows[0].date))}` : ''}</div></div>
      <button data-k="${k}" class="${on ? 'on' : ''}" aria-pressed="${on}">${on ? 'Done today' : 'Mark done'}</button></div>`;
  }).join('') + (rows.length ? '' : `<div class="sv-meta">Nothing logged yet.</div>`);
  $('streaks').querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.k, val = !(todayRow[k] === true);
    const { error } = await sb.from('daily_driver').upsert({ date: today, [k]: val }, { onConflict: 'date' });
    if (error) return toast(error.message, 'err');
    const idx = rows.findIndex(r => r.date === today);
    if (idx >= 0) rows[idx] = { ...rows[idx], [k]: val }; else rows.unshift({ date: today, [k]: val });
    toast(val ? 'Logged for today' : 'Cleared', 'ok'); renderStreaks(rows, today);
  }));
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

void statusChip; void REDUCED; void freshness; void mustDos; void decide;
