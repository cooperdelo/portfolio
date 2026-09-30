// /admin/_js/schedule.js, Content schedule v2 (2026-09-28 17:35 ruling).
// Rows: Personal (1 short-form a day Mon-Sat), PlugVerse (1 a day Mon-Sat), LinkedIn
// (its own row, Mon + Thu). Sunday is a Film & prep column, no posting.
// Every option carries a reference that performed: tap a chip to see the stats, link,
// framework and how to make it yours, then "Pick this". Nothing is decided until he taps.
// Reads v_content_schedule (this week + next week once the Sunday roll has created it).
// Posts tick themselves (content_schedule_sync, pg_cron every 20 min + on load).
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, pageHead, icon, pmIcon, platName } from '/admin/_shell/ui.js';
import { contentSchedule, contentPillars, scheduleSync, markPosted, answerLadder, isDemo, optionBank } from '/admin/_shell/live-data.js';
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
let PILLARS = [];      // content_pillars: personal-brand topic mix, weekly targets
let BRAND = {};        // content_brand: why_follow, throughline
let WEEK = null;        // the Monday being shown
const norm = (rows) => rows.map(r => (r.status === 'needs-confirm' && r.answer ? { ...r, status: 'ready' } : r));
const today = todayKey();
const rowsOfWeek = () => ALL.filter(r => weekKey(r) === WEEK);

app.innerHTML = pageHead('', 'Schedule', `<span class="sc-week" id="scWeek"></span><span class="sc-wk-tabs" id="scTabs" role="tablist"></span>`) + `
  <section class="sc-brand" id="scBrand" aria-label="What the personal account is for"></section>
  <section class="sc-streaks" id="scStreaks" aria-label="Posted this week"></section>
  <section class="sc-grid" id="scGrid" aria-label="Posting schedule"><div class="shimmer" style="height:320px;grid-column:1/-1"></div></section>`;

async function load() {
  await scheduleSync().catch(e => console.warn('schedule sync', e));
  try { ({ pillars: PILLARS, brand: BRAND } = await contentPillars()); } catch (e) { console.warn('pillars', e); }
  optionBank().then(b => { BANK = b; if (DRAWER) openDrawer(DRAWER.id, DRAWER.focus); }).catch(e => console.warn('option bank', e));
  try { ALL = norm(await contentSchedule()); }
  catch (e) { console.error(e); document.getElementById('scGrid').innerHTML = `<p class="sc-empty">Couldn't read the schedule. ${esc(e?.message || '')}</p>`; return; }
  const weeks = [...new Set(ALL.map(weekKey))].sort();
  WEEK = weeks.filter(w => w <= today).pop() || weeks[0] || mondayOf(today);
  paint(true);
  const m = location.hash.match(/^#slot-(\d+)$/);
  if (m) { const r = ALL.find(x => x.id === +m[1]); if (r) { WEEK = weekKey(r); paint(); openDrawer(r.id); } }
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
  paintBrand();
  paintStreaks();
  paintGrid(days);
  if (first) {
    reveal(document.querySelectorAll('.sc-streak, .sc-day'), { stagger: 40, y: 8 });
    const t = document.querySelector('.sc-day.today');
    if (t && innerWidth <= 1100 && t.previousElementSibling?.classList.contains('sc-day')) setTimeout(() => t.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350);
  }
}

// Why-follow + throughline + the personal pillar mix for the week shown (planned vs target).
function paintBrand() {
  const el = document.getElementById('scBrand');
  if (!PILLARS.length) { el.hidden = true; return; }
  el.hidden = false;
  const rows = rowsOfWeek().filter(r => r.lane === 'personal' && r.status !== 'skipped');
  const chips = PILLARS.map(p => {
    const mine = rows.filter(r => r.pillar === p.key);
    const n = mine.length, done = mine.filter(r => r.status === 'posted').length, t = p.weekly_target;
    const cls = t === 0 ? (n ? 'hit' : 'rot') : n === 0 ? 'gap' : n > t ? 'over' : n === t ? 'hit' : 'under';
    const tip = `${p.what}. ${p.format_ref || ''}`.trim();
    return `<span class="sc-pil ${cls}" title="${esc(tip)}"><b>${esc(p.label)}</b><span>${n}${t ? '/' + t : ''}${done ? ` · ${done} posted` : ''}</span></span>`;
  }).join('');
  const untagged = rows.filter(r => !r.pillar).length;
  // Numbers only on screen; the brand lines (why they follow, throughline, rules) stay one hover away.
  el.title = [BRAND.throughline, BRAND.why_follow, BRAND.rules].filter(Boolean).join('\n\n');
  el.innerHTML = `<span class="t-label">Pillars · @cooperdelo</span>
    <div class="sc-pils" aria-label="Personal pillars this week, planned of target">${chips}${untagged ? `<span class="sc-pil none"><b>No pillar</b><span>${untagged}</span></span>` : ''}</div>`;
}

const pillarTag = (r) => {
  if (r.lane !== 'personal' || !r.pillar) return '';
  const p = PILLARS.find(x => x.key === r.pillar);
  return `<span class="sc-ptag">${esc(p?.label || r.pillar)}</span>`;
};

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

function piece(r) {
  const isPv = r.lane === 'plugverse';
  const openRow = isPv || r.flag === 'tonight' || /pick one|fastest/i.test(r.piece);
  const picked = r.answer && r.options ? optLabel(r, r.answer) : '';
  const title = picked && openRow ? picked : r.piece;
  const plats = platKeys(r.platforms);
  const done = (r.posted_platforms || []);
  const marks = plats.map(p => `<span class="sc-pm${done.includes(p) ? ' on' : ''}" title="${esc(platName(p))}${done.includes(p) ? ' · posted' : ''}">${pmIcon(p, 11)}</span>`).join('');
  const time = fmtTime(r.post_time);
  const st = r.status;
  const takenElsewhere = new Set(ALL.filter(x => x.lane === r.lane && x.id !== r.id && x.answer && x.options).map(x => x.answer));
  const needsPick = (r.options || []).length && !r.answer && st !== 'posted';
  let opts = '';
  if (needsPick) {
    opts = `<div class="sc-opts">${r.options.map(o => {
      const taken = takenElsewhere.has(oid(o));
      return `<button class="sc-opt${o.rec ? ' rec' : ''}" data-act="open" data-v="${esc(oid(o))}"${taken ? ' disabled title="Picked for another day"' : ''}><span>${esc(o.label)}</span>${o.format && fmtKey(o.format) !== fmtKey(r.format) ? `<small>${esc(fmtName(o.format))}</small>` : ''}</button>`;
    }).join('')}</div>`;
  }
  const pickedLine = r.answer && r.options && st !== 'posted' ? `<div class="sc-picked">${openRow ? 'Picked' : 'Locked'} · <button data-act="open" data-v="${esc(r.answer)}">Details</button></div>` : '';
  const actions = st === 'posted'
    ? `${r.posted_url ? `<a class="sc-link" href="${esc(r.posted_url)}" target="_blank" rel="noopener">View post ${icon('external-link', { size: 13 })}</a>` : ''}${r.posted_via === 'manual' ? `<button class="sc-link" data-act="unpost">Undo</button>` : ''}`
    : st === 'skipped' ? '' : `<button class="sc-link" data-act="post">Mark posted</button>`;
  const tonight = r.flag === 'tonight' && st !== 'posted' ? `<span class="sc-tonight">Tonight?</span>` : '';
  return `<article class="sc-piece st-${esc(st)} ln-${esc(r.lane)}${r.flag === 'tonight' ? ' is-tonight' : ''}" data-id="${r.id}">
    <div class="sc-p-top"><span class="sc-pill st-${esc(st)}"${st === 'posted' && r.posted_via === 'auto' ? ' title="Matched automatically from your feed"' : ''}>${esc(STATUS[st] || st)}</span>${tonight}${time ? `<span class="sc-time">${esc(time)}</span>` : ''}</div>
    <button class="sc-p-t" data-act="open">${esc(title)}</button>
    ${r.format ? `<div class="sc-p-meta">${pillarTag(r)}<span class="sc-fmt" title="${esc(fmtWhy(r.format))}">${esc(fmtName(r.format))}</span><span class="sc-p-plats">${marks}</span></div>` : `<div class="sc-p-plats">${marks}</div>`}
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
  if (what === 'open') { openDrawer(id, v); return; }
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
      r.status = on ? 'posted' : (dayKey(r) < today ? 'missed' : (r.plan_status === 'posted' ? 'ready' : r.plan_status));
      r.posted_via = on ? 'manual' : null;
      paint();
      await markPosted(id, on);
      if (on) toast('Marked posted', 'ok');
      ALL = norm(await contentSchedule().catch(() => ALL)); paint();
    }
  } catch (e) { Object.assign(r, prev); paint(); toast(e.message || 'Save failed', 'err'); }
}

// ---------------------------------------------------------------------------
// Right-side drawer (2026-09-28 v3, Cooper: "the current thing is too small, needs
// an easy way to copy and paste or communicate with you when making it or revising").
// Plain-English formats, full option detail, copy buttons, Tell Claude (claude_inbox).
// ---------------------------------------------------------------------------
const FORMATS = {
  M01: ['Four-beat talking reel', 'Claim, recognition, reframe, one instruction. The format behind your biggest-view references.'],
  M02: ['Negation stack', 'Stack what it is not until the one thing it is lands.'],
  M03: ['Confess, don\'t flex', 'Lead with the weakness, not the win.'],
  M04: ['Age as the opener', 'Your age in the first line sets the stakes.'],
  M05: ['Stolen opening', 'Borrow a familiar first line, then turn it.'],
  M06: ['One-sentence video', 'One compressed line over a simple visual, under 25 seconds.'],
  M07: ['Comment engine', 'One closing line that asks for a reply people can give in a word.'],
  M08: ['Loop named out loud', 'Say the loop, so the ending sends them back to the start.'],
  M09: ['Silent reel', 'Music, a visual, at most one line of on-screen text. Almost no talking.'],
  'TOOL VIDEO': ['Tool video', 'A screen recording of one PlugVerse screen. Captions only, about 10 minutes of work.'],
  'MOTION GRAPHIC': ['Motion graphic', 'A short animated piece built from your real PlugVerse screens.'],
  CAROUSEL: ['Carousel', 'Swipeable slides. Built for saves.'],
  STORY: ['Story', 'You on camera telling one real moment.'],
  'GIG CUT': ['Gig cut', 'Real footage from a gig, cut to one idea.'],
  'VO + B-ROLL': ['Voiceover over b-roll', 'Your voice over everyday footage.'],
  LINKEDIN: ['LinkedIn post', 'Text post. Ten minutes, your words.'],
};
const fmtKey = (f) => String(f || '').toUpperCase().trim();
const fmtName = (f) => (FORMATS[fmtKey(f)] || [f])[0] || '';
const fmtWhy = (f) => (FORMATS[fmtKey(f)] || [null, ''])[1];
const optLine = (o) => (o.payoff || String(o.label || '').replace(/^[A-Z0-9]{1,3}-?[a-z0-9]?\s*·\s*/i, '')).trim();
const dayLong = (k) => new Date(k + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
let BANK = {};
let DRAWER = null; // { id, focus }

function fullOpt(o) { const b = BANK[oid(o)] || {}; const out = { ...b, ...o }; for (const k of ['on_screen', 'payoff', 'caption', 'render_path', 'preview_url']) out[k] = o[k] ?? b[k] ?? null; return out; }

function briefText(r, o) {
  const lane = LANES.find(l => l.id === r.lane);
  const L = [`Schedule slot #${r.id} · ${dayLong(dayKey(r))} · ${lane ? lane.name + ' (' + lane.handle + ')' : r.lane}`,
    `Format: ${fmtName(o?.format || r.format)}${(o?.format || r.format) && /^M\d/.test(o?.format || r.format) ? ' (' + (o?.format || r.format) + ')' : ''}`,
    `Piece: ${r.piece}`];
  if (o) {
    L.push(`Option: ${o.label}`);
    if (o.on_screen) L.push(`On screen: ${o.on_screen}`);
    if (o.payoff) L.push(`Payoff line: ${o.payoff}`);
    if (o.reference_url) L.push(`Reference: ${o.reference_url}${o.reference_stats ? ' (' + o.reference_stats + ')' : ''}`);
    if (o.framework) L.push(`Framework: ${o.framework}`);
    if (o.personalize) L.push(`Make it yours: ${o.personalize}`);
    if (o.render_path) L.push(`Rendered file: ${o.render_path}`);
    if (o.source) L.push(`Source: ${o.source}`);
  }
  if (r.note) L.push(`Note: ${r.note}`);
  return L.join('\n');
}

function optCard(r, o, { canPick, focus, taken }) {
  const link = o.reference_url ? `<a class="dr-link" href="${esc(o.reference_url)}" target="_blank" rel="noopener">${esc(hostOf(o.reference_url))} ${icon('external-link', { size: 12 })}</a>` : '';
  const row = (k, v, cls = '') => v ? `<div class="dr-k">${k}</div><p class="${cls}">${esc(v)}</p>` : '';
  return `<section class="dr-opt${focus ? ' focus' : ''}${r.answer === oid(o) ? ' picked' : ''}" data-opt="${esc(oid(o))}">
    <div class="dr-opt-h"><h3>${esc(o.label)}</h3>${o.rec ? '<span class="dr-rec" title="Claude\'s suggestion, your call">suggested</span>' : ''}${r.answer === oid(o) ? '<span class="dr-rec on">picked</span>' : ''}</div>
    ${o.format && fmtKey(o.format) !== fmtKey(r.format) ? `<div class="dr-fmt">${esc(fmtName(o.format))}</div>` : ''}
    ${o.preview_url ? `<img class="dr-prev" src="${esc(o.preview_url)}" alt="Frame from ${esc(o.label)}" loading="lazy">` : ''}
    ${row("What's on screen", o.on_screen)}
    ${row('The line', o.payoff, 'dr-line')}
    ${(o.reference_stats || link) ? `<div class="dr-k">Reference that performed</div><p>${esc(o.reference_stats || 'No public view count')}</p>${link}` : ''}
    ${row('Framework', o.framework)}
    ${row('Make it yours', o.personalize)}
    ${o.render_path ? `<div class="dr-k">Rendered file</div><p class="dr-path"><code>${esc(o.render_path)}</code><button class="dr-mini" data-copy="${esc(o.render_path)}">${icon('copy', { size: 12 })}Copy path</button></p>` : ''}
    ${o.source ? `<div class="dr-src">${esc(o.source)}</div>` : ''}
    <div class="dr-opt-act">
      ${canPick && !taken ? `<button class="dr-btn pri" data-dact="pick" data-v="${esc(oid(o))}">Pick this</button>` : ''}
      ${taken ? '<span class="dr-muted">Picked for another day</span>' : ''}
      <button class="dr-btn" data-copy="${esc(optLine(o))}">${icon('copy', { size: 13 })}Copy line</button>
      ${o.caption ? `<button class="dr-btn" data-copy="${esc(o.caption)}">${icon('copy', { size: 13 })}Copy caption</button>` : ''}
      <button class="dr-btn" data-dact="brief" data-v="${esc(oid(o))}">${icon('copy', { size: 13 })}Copy brief for Claude</button>
    </div>
  </section>`;
}

function drawerHTML(r, focus) {
  const lane = LANES.find(l => l.id === r.lane);
  const st = r.status;
  const opts = (r.options || []).map(fullOpt);
  const takenElsewhere = new Set(ALL.filter(x => x.lane === r.lane && x.id !== r.id && x.answer && x.options).map(x => x.answer));
  const canPick = st !== 'posted' && opts.length > 0;
  const shown = r.answer && !DRAWER?.all ? opts.filter(o => oid(o) === r.answer) : opts;
  const title = r.answer ? optLabel(r, r.answer) : r.piece;
  return `<header class="dr-head">
      <div class="dr-meta"><span>${esc(dayLong(dayKey(r)))}</span><span>${esc(lane?.name || r.lane)} ${esc(lane?.handle || '')}</span><span class="sc-pill st-${esc(st)}">${esc(STATUS[st] || st)}</span></div>
      <button class="dr-x" data-dact="close" aria-label="Close">${icon('x', { size: 18 })}</button>
    </header>
    <div class="dr-body">
      <h2 class="dr-title" id="drTitle">${esc(title)}</h2>
      ${r.format ? `<div class="dr-format"><b>${esc(fmtName(r.format))}</b>${/^M\d/.test(r.format) ? `<span class="dr-code">${esc(r.format)}</span>` : ''}<p>${esc(fmtWhy(r.format))}</p></div>` : ''}
      ${r.note ? `<p class="dr-note">${esc(r.note)}</p>` : ''}
      ${shown.length ? `<div class="dr-k dr-sec">${r.answer ? 'Your pick' : shown.length > 1 ? `${shown.length} options, pick one` : 'The option'}</div>` : ''}
      ${shown.map(o => optCard(r, o, { canPick: canPick && !r.answer, focus: focus && oid(o) === focus, taken: takenElsewhere.has(oid(o)) })).join('')}
      ${r.answer && opts.length > 1 && st !== 'posted' ? `<div class="dr-row"><button class="dr-btn" data-dact="all">See all ${opts.length} options</button><button class="dr-btn" data-dact="unpick">Change pick</button></div>` : ''}
      ${!shown.length ? `<div class="dr-row"><button class="dr-btn" data-dact="brief">Copy brief for Claude</button></div>` : ''}
      <section class="dr-tell">
        <div class="dr-k dr-sec">Bring it to Claude</div>
        <textarea id="drMsg" rows="3" placeholder="Optional: what you want changed, or what you're doing with it"></textarea>
        <div class="dr-row">
          <button class="dr-btn pri" data-dact="send">${icon('copy', { size: 13 })}Copy with full context</button>
        </div>
              </section>
    </div>
    <footer class="dr-foot">
      ${st === 'posted' ? (r.posted_url ? `<a class="dr-btn" href="${esc(r.posted_url)}" target="_blank" rel="noopener">View post</a>` : '<span class="dr-muted">Posted</span>') : st === 'skipped' ? '' : `<button class="dr-btn" data-dact="post">Mark posted</button>`}
    </footer>`;
}

function ensureDrawer() {
  let wrap = document.getElementById('scDrawer');
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'scDrawer'; wrap.className = 'dr-wrap'; wrap.hidden = true;
  wrap.innerHTML = `<div class="dr-scrim" data-dact="close"></div><aside class="dr" role="dialog" aria-modal="true" aria-labelledby="drTitle" tabindex="-1"></aside>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', onDrawerClick);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    const f = [...wrap.querySelectorAll('.dr button, .dr a, .dr textarea')].filter(x => !x.disabled && x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  return wrap;
}
let lastFocus = null;
function openDrawer(id, focus) {
  const r = ALL.find(x => x.id === id); if (!r) return;
  const wrap = ensureDrawer();
  const again = DRAWER?.id === id;
  DRAWER = { id, focus, all: again ? DRAWER.all : false };
  const aside = wrap.querySelector('.dr');
  const keep = document.getElementById('drMsg')?.value || '';
  aside.innerHTML = drawerHTML(r, focus);
  aside.querySelector('.dr-title')?.setAttribute('id', 'drTitle');
  if (again && keep) document.getElementById('drMsg').value = keep;
  if (wrap.hidden) { lastFocus = document.activeElement; wrap.hidden = false; requestAnimationFrame(() => wrap.classList.add('on')); document.documentElement.classList.add('dr-lock'); aside.focus(); }
  if (focus) aside.querySelector(`.dr-opt[data-opt="${CSS.escape(focus)}"]`)?.scrollIntoView({ block: 'nearest' });
  if (location.hash !== '#slot-' + id) history.replaceState(null, '', '#slot-' + id);
}
function closeDrawer() {
  const wrap = document.getElementById('scDrawer'); if (!wrap || wrap.hidden) return;
  wrap.classList.remove('on'); document.documentElement.classList.remove('dr-lock');
  setTimeout(() => { if (!wrap.classList.contains('on')) wrap.hidden = true; }, 900); // after the slide-out
  DRAWER = null;
  history.replaceState(null, '', location.pathname + location.search);
  lastFocus?.focus?.();
}
async function copy(text, what = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(what, 'ok'); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast(what, 'ok'); }
}
async function onDrawerClick(e) {
  const c = e.target.closest('[data-copy]');
  if (c) { copy(c.dataset.copy); return; }
  const b = e.target.closest('[data-dact]'); if (!b || !DRAWER) return;
  const r = ALL.find(x => x.id === DRAWER.id);
  const a = b.dataset.dact;
  if (a === 'close') return closeDrawer();
  if (a === 'all') { DRAWER.all = true; return openDrawer(r.id); }
  if (a === 'brief') { const o = b.dataset.v ? fullOpt(optOf(r, b.dataset.v)) : (r.answer ? fullOpt(optOf(r, r.answer) || {}) : null); return copy(briefText(r, o), 'Brief copied. Paste it in chat.'); }
  if (a === 'send') {
    const note = document.getElementById('drMsg').value.trim();
    const pick = r.answer || DRAWER.focus;
    const o = pick ? fullOpt(optOf(r, pick) || {}) : null;
    const rest = o ? '' : '\n\nOptions:\n' + (r.options || []).map(fullOpt).map(x => `- ${x.label}${x.payoff ? ': ' + x.payoff : ''}${x.reference_stats ? ' (ref: ' + x.reference_stats + ')' : ''}`).join('\n');
    return copy((note ? 'My note: ' + note + '\n\n' : '') + briefText(r, o) + rest, 'Copied. Paste it in chat.');
  }
  await act(r.id, a, b.dataset.v);
  if (DRAWER) openDrawer(r.id, DRAWER.focus);
}
addEventListener('hashchange', () => { const m = location.hash.match(/^#slot-(\d+)$/); if (m) openDrawer(+m[1]); else closeDrawer(); });

load();
