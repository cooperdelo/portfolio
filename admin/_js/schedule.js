// /admin/_js/schedule.js — Content schedule (2026-09-28).
// One week, two lanes (Personal @cooperdelo, PlugVerse @plugverse.app).
// Reads v_content_schedule: content_plan rows for the current week with posts
// auto-matched from social_posts by platform + ET date, and past unposted days
// flagged "missed". Nothing here needs ticking: posts tick themselves (pg_cron
// runs content_schedule_sync every 20 min, and this page runs it on load).
// "Mark posted" is only the fallback for a post the sync hasn't picked up yet.
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, pageHead } from '/admin/_shell/ui.js';
import { contentSchedule, scheduleSync, markPosted, answerLadder, isDemo } from '/admin/_shell/live-data.js';
import { reveal } from '/admin/_shell/motion.js';

if (!isDemo() && !(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Schedule', demo: true });
const app = document.getElementById('app');

const TZ = 'America/New_York';
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (k) => { const d = new Date(k + 'T12:00:00Z'); return addDays(k, -((d.getUTCDay() + 6) % 7)); };
const dayNum = (k) => +k.slice(8, 10);
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LANES = [
  { id: 'personal', name: 'Personal', handle: '@cooperdelo', target: 7, targetLabel: '7' },
  { id: 'plugverse', name: 'PlugVerse', handle: '@plugverse.app', target: 3, floor: 2, targetLabel: '2 to 3' },
];
const MARK = { instagram: 'IG', tiktok: 'TT', youtube: 'YT', linkedin: 'in' };
const platKeys = (s) => String(s || '').split(/\s*,\s*/).map(t =>
  /^(ig|insta)/i.test(t) ? 'instagram' : /^tik/i.test(t) ? 'tiktok' : /^(shorts|youtube|yt)/i.test(t) ? 'youtube' : /^linked/i.test(t) ? 'linkedin' : null).filter(Boolean);
const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`; };
const optLabel = (r, v) => (r.options || []).find(o => o.v === v)?.label || v;
const STATUS = {
  posted: 'Posted', ready: 'Ready', 'needs-filming': 'Needs filming', 'needs-confirm': 'Needs your pick',
  missed: 'Missed', blocked: 'Blocked', skipped: 'Skipped',
};

let ROWS = [];
// A pick locks the piece: the view already reports it as ready; keep local state the same.
const norm = (rows) => rows.map(r => (r.status === 'needs-confirm' && r.answer ? { ...r, status: 'ready' } : r));
const today = todayKey();

app.innerHTML = pageHead('', 'Schedule', `<span class="sc-week" id="scWeek"></span>`) + `
  <section class="sc-streaks" id="scStreaks" aria-label="Posted this week"></section>
  <section class="sc-grid" id="scGrid" aria-label="This week's posting schedule"><div class="shimmer" style="height:320px;grid-column:1/-1"></div></section>`;

async function load() {
  // Persist auto-matches + today's "do" rows first; a failure here never blocks the page.
  await scheduleSync().catch(e => console.warn('schedule sync', e));
  try { ROWS = norm(await contentSchedule()); }
  catch (e) { console.error(e); document.getElementById('scGrid').innerHTML = `<p class="sc-empty">Couldn't read the schedule. ${esc(e?.message || '')}</p>`; return; }
  paint(true);
}

function paint(first) {
  const week = ROWS[0]?.week_of ? String(ROWS[0].week_of).slice(0, 10) : mondayOf(today);
  const days = DOW.map((_, i) => addDays(week, i));
  const end = days[6];
  const mon = (k) => new Date(k + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  document.getElementById('scWeek').textContent = `${mon(week)} to ${mon(end)}`;
  paintStreaks(days);
  paintGrid(days);
  if (first) {
    reveal(document.querySelectorAll('.sc-streak, .sc-day'), { stagger: 40, y: 8 });
    // Phone: days stack, so jump past finished days to today.
    const t = document.querySelector('.sc-day.today');
    if (t && innerWidth <= 1100 && t.previousElementSibling?.classList.contains('sc-day')) setTimeout(() => t.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350);
  }
}

function paintStreaks(days) {
  const el = document.getElementById('scStreaks');
  el.innerHTML = LANES.map(l => {
    const rows = ROWS.filter(r => r.lane === l.id);
    const posted = rows.filter(r => r.status === 'posted').length;
    const missed = rows.filter(r => r.status === 'missed').length;
    const left = rows.filter(r => !['posted', 'missed', 'skipped'].includes(r.status)).length;
    const slots = Math.max(l.target, rows.length);
    const segs = [...rows].sort((a, b) => (a.status === 'posted' ? -1 : 0) - (b.status === 'posted' ? -1 : 0) || String(a.day).localeCompare(String(b.day)));
    const bar = Array.from({ length: slots }, (_, i) => {
      const r = segs[i];
      const cls = !r ? 'empty' : r.status === 'posted' ? 'on' : r.status === 'missed' ? 'miss' : String(r.day).slice(0, 10) === today ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
    const hit = posted >= (l.floor || l.target);
    return `<div class="sc-streak${l.id === 'plugverse' ? ' pv' : ''}">
      <div class="sc-st-top"><span class="sc-lane">${esc(l.name)}</span><span class="sc-handle">${esc(l.handle)}</span></div>
      <div class="sc-st-num"><b class="${hit ? 'hit' : ''}">${posted}</b><span>of ${esc(l.targetLabel)} posted</span></div>
      <div class="sc-bar" style="--n:${slots}">${bar}</div>
      <div class="sc-st-foot">${missed ? `<span class="miss">${missed} missed</span>` : ''}${left ? `<span>${left} to go</span>` : ''}${rows.length < l.target && l.id === 'personal' ? `<span>${l.target - rows.length} not planned yet</span>` : ''}</div>
    </div>`;
  }).join('');
}

function piece(r) {
  const isPv = r.lane === 'plugverse';
  const picked = r.answer && r.options ? optLabel(r, r.answer) : '';
  const title = isPv && picked ? picked : r.piece;
  const plats = platKeys(r.platforms);
  const done = (r.posted_platforms || []);
  const marks = plats.map(p => `<span class="sc-pm${done.includes(p) ? ' on' : ''}" title="${esc(p)}${done.includes(p) ? ' · posted' : ''}">${MARK[p]}</span>`).join('');
  const time = fmtTime(r.post_time);
  const st = r.status;
  // Beat picks: PlugVerse slots share one pool, so a beat picked elsewhere is greyed out.
  const takenElsewhere = new Set(ROWS.filter(x => x.lane === r.lane && x.id !== r.id && x.answer && x.options).map(x => x.answer));
  const needsPick = r.options && !r.answer && st !== 'posted';
  const opts = needsPick ? `<div class="sc-opts">${r.options.map(o => {
      const taken = isPv && takenElsewhere.has(o.v);
      return `<button class="sc-opt${o.rec ? ' rec' : ''}" data-act="pick" data-v="${esc(o.v)}"${taken ? ' disabled title="Picked for another day"' : o.rec ? ' title="Claude\'s pick"' : ''}>${esc(o.label)}</button>`;
    }).join('')}</div>` : '';
  const pickedLine = r.answer && r.options && st !== 'posted' && !isPv ? `<div class="sc-picked">Picked ${esc(picked)} <button data-act="unpick">Change</button></div>` : '';
  const pvChange = isPv && r.answer && r.options && st !== 'posted' ? `<button class="sc-link" data-act="unpick">Change</button>` : '';
  const actions = st === 'posted'
    ? `${r.posted_url ? `<a class="sc-link" href="${esc(r.posted_url)}" target="_blank" rel="noopener">View post</a>` : ''}${r.posted_via === 'manual' ? `<button class="sc-link" data-act="unpost">Undo</button>` : ''}`
    : st === 'skipped' ? '' : `<button class="sc-link" data-act="post">Mark posted</button>${pvChange}`;
  return `<article class="sc-piece st-${esc(st)}${isPv ? ' pv' : ''}" data-id="${r.id}">
    <div class="sc-p-top"><span class="sc-pill st-${esc(st)}"${st === 'posted' && r.posted_via === 'auto' ? ' title="Matched automatically from your feed"' : ''}>${esc(STATUS[st] || st)}</span>${time ? `<span class="sc-time">${esc(time)}</span>` : ''}</div>
    <div class="sc-p-t">${esc(title)}</div>
    <div class="sc-p-plats">${marks}</div>
    ${opts}${pickedLine}
    <div class="sc-p-act">${actions}</div>
  </article>`;
}

function paintGrid(days) {
  const el = document.getElementById('scGrid');
  const lanesCol = `<div class="sc-lanes" aria-hidden="true"><div class="sc-dh"></div>${LANES.map(l => `<div class="sc-lh${l.id === 'plugverse' ? ' pv' : ''}"><b>${esc(l.name)}</b><span>${esc(l.handle)}</span></div>`).join('')}</div>`;
  const cols = days.map((k, i) => {
    const isToday = k === today, past = k < today;
    const cells = LANES.map(l => {
      const rows = ROWS.filter(r => r.lane === l.id && String(r.day).slice(0, 10) === k);
      return `<div class="sc-cell${l.id === 'plugverse' ? ' pv' : ''}" data-lane="${l.id}"><span class="sc-cell-lane">${esc(l.name)}</span>${rows.length ? rows.map(piece).join('') : `<span class="sc-none">Nothing planned</span>`}</div>`;
    }).join('');
    return `<div class="sc-day${isToday ? ' today' : ''}${past ? ' past' : ''}">
      <div class="sc-dh"><span class="sc-dow">${DOW[i]}</span><span class="sc-dnum">${dayNum(k)}</span>${isToday ? '<span class="sc-now">Today</span>' : ''}</div>
      ${cells}
    </div>`;
  }).join('');
  el.innerHTML = lanesCol + cols;
  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(+b.closest('[data-id]').dataset.id, b.dataset.act, b.dataset.v)));
}

async function act(id, what, v) {
  const r = ROWS.find(x => x.id === id);
  const prev = { ...r };
  try {
    if (what === 'pick' || what === 'unpick') {
      r.answer = what === 'pick' ? v : null; r.answered_at = r.answer ? new Date().toISOString() : null;
      if (r.status === 'needs-confirm' || r.status === 'ready') r.status = r.answer ? 'ready' : (r.plan_status === 'needs-confirm' ? 'needs-confirm' : r.status);
      paint();
      await answerLadder(id, { answer: r.answer, answered_at: r.answered_at });
      if (r.answer) toast(`Locked: ${optLabel(r, v)}`, 'ok');
    } else {
      const on = what === 'post';
      r.status = on ? 'posted' : (String(r.day).slice(0, 10) < today ? 'missed' : (r.plan_status === 'posted' ? 'ready' : r.plan_status));
      r.posted_via = on ? 'manual' : null;
      paint();
      await markPosted(id, on);
      if (on) toast('Marked posted', 'ok');
      ROWS = norm(await contentSchedule().catch(() => ROWS)); paint();
    }
  } catch (e) { Object.assign(r, prev); paint(); toast(e.message || 'Save failed', 'err'); }
}

load();
