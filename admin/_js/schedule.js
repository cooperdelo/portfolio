// /admin/_js/schedule.js — Content schedule v2 (2026-09-28 17:35 ruling).
// Rows: Personal (1 short-form a day Mon-Sat), PlugVerse (1 a day Mon-Sat), LinkedIn
// (its own row, Mon + Thu). Sunday is a Film & prep column, no posting.
// Every option carries a reference that performed: tap a chip to see the stats, link,
// framework and how to make it yours, then "Pick this". Nothing is decided until he taps.
// Reads v_content_schedule (this week + next week once the Sunday roll has created it).
// Posts tick themselves (content_schedule_sync, pg_cron every 20 min + on load).
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
const dayKey = (r) => String(r.day).slice(0, 10);
const weekKey = (r) => String(r.week_of).slice(0, 10);
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LANES = [
  { id: 'personal', name: 'Personal', handle: '@cooperdelo', target: 6, sub: 'short-form' },
  { id: 'plugverse', name: 'PlugVerse', handle: '@plugverse.app', target: 6, sub: 'posts' },
  { id: 'linkedin', name: 'LinkedIn', handle: 'Cooper Delo', target: 2, sub: 'posts' },
];
const MARK = { instagram: 'IG', tiktok: 'TT', youtube: 'YT', linkedin: 'in' };
const platKeys = (s) => String(s || '').split(/\s*,\s*/).map(t =>
  /^(ig|insta)/i.test(t) ? 'instagram' : /^tik/i.test(t) ? 'tiktok' : /^(shorts|youtube|yt)/i.test(t) ? 'youtube' : /^linked/i.test(t) ? 'linkedin' : null).filter(Boolean);
const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`; };
const oid = (o) => o.id ?? o.v;
const optOf = (r, v) => (r.options || []).find(o => oid(o) === v);
const optLabel = (r, v) => optOf(r, v)?.label || v;
const hostOf = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, '').slice(0, 44); } catch { return u; } };
const STATUS = {
  posted: 'Posted', ready: 'Ready', 'needs-filming': 'Needs filming', 'needs-confirm': 'Needs your pick',
  missed: 'Missed', blocked: 'Blocked', skipped: 'Skipped',
};

let ALL = [];
let WEEK = null;        // the Monday being shown
const OPEN = new Map(); // row id -> option id whose reference is expanded
const norm = (rows) => rows.map(r => (r.status === 'needs-confirm' && r.answer ? { ...r, status: 'ready' } : r));
const today = todayKey();
const rowsOfWeek = () => ALL.filter(r => weekKey(r) === WEEK);

app.innerHTML = pageHead('', 'Schedule', `<span class="sc-week" id="scWeek"></span><span class="sc-wk-tabs" id="scTabs"></span>`) + `
  <section class="sc-streaks" id="scStreaks" aria-label="Posted this week"></section>
  <section class="sc-grid" id="scGrid" aria-label="Posting schedule"><div class="shimmer" style="height:320px;grid-column:1/-1"></div></section>`;

async function load() {
  await scheduleSync().catch(e => console.warn('schedule sync', e));
  try { ALL = norm(await contentSchedule()); }
  catch (e) { console.error(e); document.getElementById('scGrid').innerHTML = `<p class="sc-empty">Couldn't read the schedule. ${esc(e?.message || '')}</p>`; return; }
  const weeks = [...new Set(ALL.map(weekKey))].sort();
  WEEK = weeks.filter(w => w <= today).pop() || weeks[0] || mondayOf(today);
  paint(true);
}

function paint(first) {
  const days = DOW.map((_, i) => addDays(WEEK, i));
  const mon = (k) => new Date(k + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  document.getElementById('scWeek').textContent = `${mon(days[0])} to ${mon(days[6])}`;
  const weeks = [...new Set(ALL.map(weekKey))].sort();
  const cur = weeks.filter(w => w <= today).pop();
  const next = weeks.find(w => w > (cur || ''));
  const tabs = document.getElementById('scTabs');
  tabs.innerHTML = cur && next ? [[cur, 'This week'], [next, 'Next week']].map(([w, l]) =>
    `<button class="sc-wk${w === WEEK ? ' on' : ''}" data-week="${w}">${l}</button>`).join('') : '';
  tabs.querySelectorAll('[data-week]').forEach(b => b.addEventListener('click', () => { WEEK = b.dataset.week; paint(true); }));
  paintStreaks();
  paintGrid(days);
  if (first) {
    reveal(document.querySelectorAll('.sc-streak, .sc-day'), { stagger: 40, y: 8 });
    const t = document.querySelector('.sc-day.today');
    if (t && innerWidth <= 1100 && t.previousElementSibling?.classList.contains('sc-day')) setTimeout(() => t.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350);
  }
}

function paintStreaks() {
  const el = document.getElementById('scStreaks');
  const ROWS = rowsOfWeek();
  el.innerHTML = LANES.map(l => {
    const rows = ROWS.filter(r => r.lane === l.id);
    const posted = rows.filter(r => r.status === 'posted').length;
    const missed = rows.filter(r => r.status === 'missed').length;
    const left = rows.filter(r => !['posted', 'missed', 'skipped'].includes(r.status)).length;
    const picks = rows.filter(r => r.status === 'needs-confirm' && !r.answer && (r.options || []).length).length;
    const slots = Math.max(l.target, rows.length);
    const segs = [...rows].sort((a, b) => (a.status === 'posted' ? -1 : 0) - (b.status === 'posted' ? -1 : 0) || dayKey(a).localeCompare(dayKey(b)));
    const bar = Array.from({ length: slots }, (_, i) => {
      const r = segs[i];
      const cls = !r ? 'empty' : r.status === 'posted' ? 'on' : r.status === 'missed' ? 'miss' : dayKey(r) === today ? 'now' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
    return `<div class="sc-streak ln-${l.id}">
      <div class="sc-st-top"><span class="sc-lane">${esc(l.name)}</span><span class="sc-handle">${esc(l.handle)}</span></div>
      <div class="sc-st-num"><b class="${posted >= l.target ? 'hit' : ''}">${posted}</b><span>of ${l.target} ${esc(l.sub)} posted</span></div>
      <div class="sc-bar" style="--n:${slots}">${bar}</div>
      <div class="sc-st-foot">${missed ? `<span class="miss">${missed} missed</span>` : ''}${picks ? `<span class="pick">${picks} to pick</span>` : ''}${left ? `<span>${left} to go</span>` : ''}${rows.length < l.target ? `<span>${l.target - rows.length} not planned</span>` : ''}</div>
    </div>`;
  }).join('');
}

function refPanel(r, o, canPick) {
  const pickBtn = canPick ? `<button class="sc-ref-pick" data-act="pick" data-v="${esc(oid(o))}">Pick this</button>` : '';
  const link = o.reference_url ? `<a class="sc-ref-link" href="${esc(o.reference_url)}" target="_blank" rel="noopener">${esc(hostOf(o.reference_url))} ↗</a>` : '<span class="sc-ref-none">No reference link on file</span>';
  return `<div class="sc-ref" role="region" aria-label="Reference for ${esc(o.label)}">
    <div class="sc-ref-h"><b>${esc(o.label)}</b>${o.format ? `<span class="sc-fmt">${esc(o.format)}</span>` : ''}</div>
    ${o.score ? `<div class="sc-ref-score">${esc(o.score)}</div>` : ''}
    ${o.reference_stats ? `<div class="sc-ref-stat">${esc(o.reference_stats)}</div>` : ''}
    ${link}
    ${o.framework ? `<div class="sc-ref-k">Framework</div><p>${esc(o.framework)}</p>` : ''}
    ${o.personalize ? `<div class="sc-ref-k">Make it yours</div><p>${esc(o.personalize)}</p>` : ''}
    ${o.source ? `<div class="sc-ref-src">${esc(o.source)}</div>` : ''}
    ${pickBtn}
  </div>`;
}

function piece(r) {
  const isPv = r.lane === 'plugverse';
  const openRow = isPv || r.flag === 'tonight' || /pick one|fastest/i.test(r.piece);
  const picked = r.answer && r.options ? optLabel(r, r.answer) : '';
  const title = picked && openRow ? picked : r.piece;
  const plats = platKeys(r.platforms);
  const done = (r.posted_platforms || []);
  const marks = plats.map(p => `<span class="sc-pm${done.includes(p) ? ' on' : ''}" title="${esc(p)}${done.includes(p) ? ' · posted' : ''}">${MARK[p]}</span>`).join('');
  const time = fmtTime(r.post_time);
  const st = r.status;
  const takenElsewhere = new Set(ALL.filter(x => x.lane === r.lane && x.id !== r.id && x.answer && x.options).map(x => x.answer));
  const needsPick = (r.options || []).length && !r.answer && st !== 'posted';
  const open = OPEN.get(r.id);
  const openOpt = open ? optOf(r, open) : null;
  let opts = '';
  if (needsPick) {
    opts = `<div class="sc-opts">${r.options.map(o => {
      const taken = takenElsewhere.has(oid(o));
      const on = open === oid(o);
      return `<button class="sc-opt${o.rec ? ' rec' : ''}${on ? ' on' : ''}" data-act="peek" data-v="${esc(oid(o))}" aria-expanded="${on}"${taken ? ' disabled title="Picked for another day"' : o.rec ? ' title="Claude\'s suggestion (input, not a decision)"' : ''}><span>${esc(o.label)}</span>${o.format ? `<small>${esc(o.format)}</small>` : ''}</button>`;
    }).join('')}</div>`;
    opts += openOpt ? refPanel(r, openOpt, !takenElsewhere.has(open)) : `<div class="sc-hint">Tap an option to see its reference</div>`;
  }
  let pickedLine = '';
  if (r.answer && r.options && st !== 'posted') {
    const po = optOf(r, r.answer);
    pickedLine = `<div class="sc-picked">${openRow ? 'Picked' : 'Locked'}${po ? ` · <button data-act="peek" data-v="${esc(r.answer)}">${open === r.answer ? 'Hide reference' : 'Reference'}</button>` : ''}${(r.options || []).length > 1 ? ` · <button data-act="unpick">Change</button>` : ''}</div>`;
    if (po && open === r.answer) pickedLine += refPanel(r, po, false);
  }
  const actions = st === 'posted'
    ? `${r.posted_url ? `<a class="sc-link" href="${esc(r.posted_url)}" target="_blank" rel="noopener">View post</a>` : ''}${r.posted_via === 'manual' ? `<button class="sc-link" data-act="unpost">Undo</button>` : ''}`
    : st === 'skipped' ? '' : `<button class="sc-link" data-act="post">Mark posted</button>`;
  const tonight = r.flag === 'tonight' && st !== 'posted' ? `<span class="sc-tonight">Tonight?</span>` : '';
  return `<article class="sc-piece st-${esc(st)} ln-${esc(r.lane)}${r.flag === 'tonight' ? ' is-tonight' : ''}" data-id="${r.id}">
    <div class="sc-p-top"><span class="sc-pill st-${esc(st)}"${st === 'posted' && r.posted_via === 'auto' ? ' title="Matched automatically from your feed"' : ''}>${esc(STATUS[st] || st)}</span>${tonight}${time ? `<span class="sc-time">${esc(time)}</span>` : ''}</div>
    <div class="sc-p-t">${esc(title)}</div>
    ${r.format ? `<div class="sc-p-meta"><span class="sc-fmt">${esc(r.format)}</span><span class="sc-p-plats">${marks}</span></div>` : `<div class="sc-p-plats">${marks}</div>`}
    ${r.note && needsPick ? `<div class="sc-note">${esc(r.note)}</div>` : ''}
    ${opts}${pickedLine}
    <div class="sc-p-act">${actions}</div>
  </article>`;
}

function prepBlock(k) {
  const r = rowsOfWeek().find(x => x.lane === 'prep' && dayKey(x) === k);
  const tasks = r?.options?.length ? r.options : [{ label: 'Film list for next week' }, { label: 'Batch edit' }, { label: "Pick next week's options" }];
  return `<div class="sc-prep"${r ? ` data-id="${r.id}"` : ''}>
    <span class="sc-prep-k">Film &amp; prep</span>
    <div class="sc-prep-t">${esc(r?.piece || 'Film & prep for next week')}</div>
    <p class="sc-prep-n">No posting on Sundays.</p>
    <ol class="sc-prep-l">${tasks.map(t => `<li>${esc(t.label)}</li>`).join('')}</ol>
  </div>`;
}

function paintGrid(days) {
  const el = document.getElementById('scGrid');
  const ROWS = rowsOfWeek();
  const lanesCol = `<div class="sc-lanes" aria-hidden="true"><div class="sc-dh"></div>${LANES.map(l => `<div class="sc-lh ln-${l.id}"><b>${esc(l.name)}</b><span>${esc(l.handle)}</span></div>`).join('')}</div>`;
  const cols = days.map((k, i) => {
    const isToday = k === today, past = k < today, sun = i === 6;
    const cells = sun ? `<div class="sc-cell sc-cell-prep">${prepBlock(k)}</div>` : LANES.map(l => {
      const rows = ROWS.filter(r => r.lane === l.id && dayKey(r) === k);
      const empty = l.id === 'linkedin' ? '<span class="sc-none">No LinkedIn today</span>' : '<span class="sc-none">Nothing planned</span>';
      return `<div class="sc-cell ln-${l.id}" data-lane="${l.id}"><span class="sc-cell-lane">${esc(l.name)}</span>${rows.length ? rows.map(piece).join('') : empty}</div>`;
    }).join('');
    return `<div class="sc-day${isToday ? ' today' : ''}${past ? ' past' : ''}${sun ? ' sun' : ''}">
      <div class="sc-dh"><span class="sc-dow">${DOW[i]}</span><span class="sc-dnum">${dayNum(k)}</span>${isToday ? '<span class="sc-now">Today</span>' : ''}</div>
      ${cells}
    </div>`;
  }).join('');
  el.innerHTML = lanesCol + cols;
  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(+b.closest('[data-id]').dataset.id, b.dataset.act, b.dataset.v)));
}

async function act(id, what, v) {
  const r = ALL.find(x => x.id === id);
  if (what === 'peek') { OPEN.get(id) === v ? OPEN.delete(id) : OPEN.set(id, v); paint(); return; }
  const prev = { ...r };
  try {
    if (what === 'pick' || what === 'unpick') {
      r.answer = what === 'pick' ? v : null; r.answered_at = r.answer ? new Date().toISOString() : null;
      if (r.status === 'needs-confirm' || r.status === 'ready') r.status = r.answer ? 'ready' : (r.plan_status === 'needs-confirm' ? 'needs-confirm' : r.status);
      OPEN.delete(id);
      paint();
      await answerLadder(id, { answer: r.answer, answered_at: r.answered_at });
      if (r.answer) toast(`Locked: ${optLabel(r, v)}`, 'ok');
    } else {
      const on = what === 'post';
      r.status = on ? 'posted' : (dayKey(r) < today ? 'missed' : (r.plan_status === 'posted' ? 'ready' : r.plan_status));
      r.posted_via = on ? 'manual' : null;
      paint();
      await markPosted(id, on);
      if (on) toast('Marked posted', 'ok');
      ALL = norm(await contentSchedule().catch(() => ALL)); paint();
    }
  } catch (e) { Object.assign(r, prev); paint(); toast(e.message || 'Save failed', 'err'); }
}

load();
