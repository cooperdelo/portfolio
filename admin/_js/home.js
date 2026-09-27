// /admin/_js/home.js — "Good morning" home (v5).
// Reads: vault_documents (Daily/driver/<date>.md), daily_driver, decisions,
// opportunities, social_account_snapshots, health_daily, task_run_log.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { esc, fmtNum, fmtDay, ago, asOf, deltaChip, platMark, emptyState, sparkline, statusChip, todayET, toDate, staleChip } from '/admin/_shell/ui.js';
import { accountSeries } from '/admin/_shell/data.js';

const ctx = await mountShell({ title: 'Home' });
const $ = (id) => document.getElementById(id);

const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }));
$('greet').textContent = (h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', Cooper';
$('today').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' });

const fail = (id, what, e) => { console.error(what, e); $(id).innerHTML = emptyState(`Couldn't load ${what}`, esc(e?.message || String(e))); };

if (ctx?.role === 'full') {
  mustDos().catch(e => fail('mustdos', 'must-dos', e));
  decide().catch(e => fail('decide', 'decisions', e));
  pulse().catch(e => fail('pulse', 'followers', e));
  health().catch(e => fail('health', 'health', e));
  overnight().catch(e => fail('overnight', 'overnight runs', e));
}

// ---------- Must-dos + streaks ----------
async function mustDos() {
  const today = todayET();
  const [{ data: docs, error }, { data: dd, error: e2 }] = await Promise.all([
    sb.from('vault_documents').select('path,content,updated_at').like('path', 'Daily/driver/%').order('path', { ascending: false }).limit(1),
    sb.from('daily_driver').select('*').order('date', { ascending: false }).limit(120),
  ]);
  if (error) throw error; if (e2) throw e2;
  const doc = docs?.[0];
  let body = '';
  if (!doc) {
    body = emptyState('No must-dos yet today', 'Fed by the daily-driver scheduled task, which writes <b>Daily/driver/&lt;date&gt;.md</b> each morning.');
  } else {
    const lines = doc.content.split('\n').map(s => s.trim()).filter(Boolean).filter(s => !s.startsWith('#'));
    const todos = lines.filter(s => /^\d+\.\s/.test(s)).map(s => s.replace(/^\d+\.\s*/, ''));
    const other = lines.filter(s => !/^\d+\.\s/.test(s));
    const isToday = doc.path.includes(today);
    body = `${todos.map((t, i) => `<div class="todo"><span class="n">${i + 1}</span><div class="x">${esc(t)}</div></div>`).join('') || emptyState('No numbered must-dos in today\'s file', 'The daily-driver file exists but has no numbered list.')}
      ${other.length ? `<div class="sv-meta" style="display:block;line-height:1.55">${other.map(esc).join('<br>')}</div>` : ''}
      <div class="sv-meta">from <b>${esc(doc.path)}</b> · updated ${esc(ago(doc.updated_at))}${isToday ? '' : ' <span class="chip stale">not today\'s file</span>'}</div>`;
  }
  $('mustdos').innerHTML = `<div class="sv-h" style="margin-bottom:.4rem"><h2>Today's must-dos</h2><a href="/admin/rituals/#daily-driver">Daily driver</a></div>${body}
    <div class="streaks" id="streaks"></div>`;
  renderStreaks(dd || [], today);
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
  }).join('') + (rows.length ? '' : `<div class="sv-meta">Streaks are fed by the daily-driver task (daily_driver table). Nothing logged yet.</div>`);
  $('streaks').querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.k, val = !(todayRow[k] === true);
    const { error } = await sb.from('daily_driver').upsert({ date: today, [k]: val }, { onConflict: 'date' });
    if (error) return toast(error.message, 'err');
    const idx = rows.findIndex(r => r.date === today);
    if (idx >= 0) rows[idx] = { ...rows[idx], [k]: val }; else rows.unshift({ date: today, [k]: val });
    toast(val ? 'Logged for today' : 'Cleared', 'ok'); renderStreaks(rows, today);
  }));
}

// ---------- Decisions waiting ----------
async function decide() {
  const [{ data: dec, error: e1 }, { data: opp, error: e2 }] = await Promise.all([
    sb.from('decisions').select('id,title,recommendation,created_at').eq('status', 'open').order('created_at', { ascending: false }),
    sb.from('opportunities').select('id,title,fit,time_hours,proof,estimate').eq('status', 'open').order('rank'),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  const n = (dec?.length || 0) + (opp?.length || 0);
  $('decide').innerHTML = `<div class="sv-h" style="margin-bottom:.2rem"><h2>Waiting on you</h2></div>
    <div class="sv-num">${n}<small>open</small></div>
    <div class="rows">
      ${(dec || []).slice(0, 3).map(d => `<a class="row" href="/admin/decisions/"><div class="grow"><div class="t">${esc(d.title)}</div><div class="s">Decision · ${esc(d.recommendation || '')}</div></div><span class="chip accent">decide</span></a>`).join('')}
      ${(opp || []).slice(0, 3).map(o => `<a class="row" href="/admin/earn/"><div class="grow"><div class="t">${esc(o.title)}</div><div class="s">${esc(o.id)} · ${esc(o.estimate || '')}</div></div><span class="chip">FIT ${o.fit ?? '—'}</span></a>`).join('')}
    </div>
    ${n ? '' : emptyState('Nothing waiting', 'Fed by the decisions and opportunities tables (Opportunity Scout).')}
    <div class="sv-meta"><a href="/admin/decisions/" style="color:var(--accent-ink)">All decisions</a> · <a href="/admin/earn/" style="color:var(--accent-ink)">All opportunities</a></div>`;
}

// ---------- Pulse ----------
async function pulse() {
  const { list } = await accountSeries();
  const mine = list.filter(s => s.personal);
  if (!mine.length) { $('pulse').innerHTML = emptyState('No follower snapshots', 'Fed by the social-pull task (social_account_snapshots).'); return; }
  $('pulse').innerHTML = mine.slice(0, 4).map(s => `<a class="sv-card" href="/admin/insights/">
      ${platMark(s.platform, s.handle)}
      <div class="sv-num md">${fmtNum(s.latest.followers)}</div>
      <div class="sv-label">${s.platform === 'youtube' ? 'subscribers' : 'followers'} ${deltaChip(s.latest.followers, s.prev?.followers)}</div>
      <div class="sv-meta">${asOf(s.latest.captured_at || s.latest.date)}${s.prev ? `<span>· change vs ${esc(fmtDay(s.prev.date))}</span>` : '<span>· first snapshot</span>'}</div>
      ${sparkline(s.rows.slice(0, 30).reverse().map(r => r.followers))}
    </a>`).join('');
}

// ---------- Health ----------
async function health() {
  const { data, error } = await sb.from('health_daily').select('day,sleep_minutes,sleep_score,steps,resting_hr,hrv_ms,body_battery_high,garmin_synced_at').order('day', { ascending: false }).limit(1);
  if (error) throw error;
  const r = data?.[0];
  if (!r) { $('health').innerHTML = `<div class="sv-h"><h2>Body</h2></div>` + emptyState('No health data', 'Fed by the Garmin sync (health_daily).'); return; }
  const cell = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const sleep = r.sleep_minutes != null ? `${Math.floor(r.sleep_minutes / 60)}h ${r.sleep_minutes % 60}m` : '—';
  $('health').innerHTML = `<div class="sv-h" style="margin-bottom:.2rem"><h2>Body</h2><a href="/admin/health/dashboard.html">Health insights</a></div>
    <div class="health-grid">
      ${cell('Sleep', sleep)}${cell('Sleep score', r.sleep_score ?? '—')}${cell('Steps', fmtNum(r.steps))}
      ${cell('Resting HR', r.resting_hr ?? '—')}${cell('HRV', r.hrv_ms != null ? r.hrv_ms + ' ms' : '—')}${cell('Body battery', r.body_battery_high ?? '—')}
    </div>
    <div class="sv-meta">Garmin · day ${esc(fmtDay(r.day, { weekday: 'short', month: 'short', day: 'numeric' }))} · synced ${esc(ago(r.garmin_synced_at || r.day))} ${staleChip(r.garmin_synced_at || r.day)}</div>`;
}

// ---------- Overnight ----------
async function overnight() {
  const since = new Date(Date.now() - 18 * 3.6e6).toISOString();
  const { data, error } = await sb.from('task_run_log').select('task,ran_at,status,note').gte('ran_at', since).order('ran_at', { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const bad = rows.filter(r => r.status === 'failed').length;
  $('overnight').innerHTML = `<div class="sv-h" style="margin-bottom:.2rem"><h2>While you were out</h2><a href="/admin/rituals/">Rituals</a></div>
    <div class="sv-label">${rows.length} runs in the last 18 hours ${bad ? `<span class="chip fail">${bad} failed</span>` : '<span class="chip ok">no failures</span>'}</div>
    <div class="rows" style="margin-top:.4rem">${rows.slice(0, 7).map(r => `<a class="row" href="/admin/rituals/#${encodeURIComponent(r.task)}"><div class="grow"><div class="t">${esc(r.task)}</div><div class="s">${esc((r.note || '').slice(0, 110))}</div></div><span class="sv-muted" style="font-size:.76rem;white-space:nowrap">${esc(ago(r.ran_at))}</span>${statusChip(r.status)}</a>`).join('')
      || emptyState('No runs logged overnight', 'Fed by task_run_log. Every scheduled task writes one row per run.')}</div>`;
}
