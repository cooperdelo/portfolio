// /admin/_js/today.js, TODAY command center (2026-09-28).
// Replaces the MORNING-*.md files. Agents write rows into command_center and
// content_plan; this page only shows them and takes one-tap answers.
// No file paths on screen: a row's source shows only as a hover title on "source".
import { toast } from '/admin/_shell/admin-shell.js';
import { esc, ago, icon } from '/admin/_shell/ui.js';
import { commandCenter, updateCommand, contentLadder, answerLadder, systemBroken, todayList, checkToday, setFeeling } from '/admin/_shell/live-data.js';
import { reveal } from '/admin/_shell/motion.js';

const $ = (id) => document.getElementById(id);
const TZ = 'America/New_York';
const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(':00', '').replace(' ', '').toLowerCase();
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const src = (r) => r.source_path ? `<span class="td-src" tabindex="0" title="${esc(r.source_path)}">source</span>` : '';
const optLabel = (opts, v) => (opts || []).find(o => o.v === v)?.label || v;

let CC = [], LADDER = [], LIST = null;
// Home's hero row listens for this: { done, total, waiting, firstWaiting }.
const STATE = { done: 0, total: 0, waiting: 0, firstWaiting: '' };
const emit = (patch) => { Object.assign(STATE, patch); dispatchEvent(new CustomEvent('cd:today', { detail: { ...STATE } })); };

export async function mountToday() {
  const [cc, ladder, list] = await Promise.all([commandCenter(), contentLadder().catch(e => { console.error(e); return null; }), todayList().catch(e => { console.error(e); return null; })]);
  CC = cc; LADDER = ladder; LIST = list;
  status().catch(e => { console.error(e); $('tdStatus').innerHTML = `<span class="td-dot bad"></span><span>Couldn't read system status</span>`; });
  paintDo(); paintDecide(); paintLadder();
  reveal(document.querySelectorAll('#today .td-do, #today .td-decide > *, #today .td-ladder'), { stagger: 60, y: 10 });
}

// ---------- System status: one green line, or red lines for what's broken ----------
async function status() {
  const { feeds, tasks, feedsTotal, tasksTotal } = await systemBroken();
  const el = $('tdStatus');
  const ccStatus = CC.filter(r => r.kind === 'status' && !r.done);
  const n = feeds.length + tasks.length + ccStatus.length;
  if (!n) {
    el.className = 'td-status ok';
    el.innerHTML = `<span class="td-dot"></span><span>All systems fine</span>`;
    el.title = `${feedsTotal} feeds fresh, ${tasksTotal} agents ran clean in the last 24h`;
    return;
  }
  const line = (t, s) => `<li><span class="td-dot bad"></span><b>${esc(t)}</b><span>${esc(s)}</span></li>`;
  const age = (f) => f.status === 'empty' ? 'no data yet' : `last data ${ago(f.last_at)}`;
  el.className = 'td-status bad';
  el.innerHTML = `<ul>
    ${ccStatus.map(r => line(r.title, r.body || '')).join('')}
    ${feeds.map(f => line(f.label, age(f))).join('')}
    ${tasks.filter(t => t.status === 'failed').map(t => line(t.task, `failed ${ago(t.ran_at)}`)).join('')}
    ${(() => { const p = tasks.filter(t => t.status === 'partial'); return p.length ? line(`${p.length} agent${p.length === 1 ? '' : 's'} finished partly`, p.map(t => t.task).join(', ')) : ''; })()}
  </ul>`;
}

// ---------- Today: one live list (v_today_list = calendar, content, tasks) ----------
// Order, carry-over and the "drained" collapse are decided in SQL so the page and the
// 7:52am email always show the same list.
const GROUPS = [['calendar', 'Calendar'], ['content', 'Content'], ['task', 'Tasks']];
const FEEL = [['energized', 'Energized'], ['normal', 'Normal'], ['drained', 'Drained']];
const isEod = (iso) => /11:59\s?pm/i.test(new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }));
function when(r) {
  if (r.grp === 'calendar') return r.all_day ? 'All day' : `${time(r.at_time)}${r.end_at ? `–${time(r.end_at)}` : ''}`;
  if (!r.at_time || r.done || dayKey(r.at_time) !== todayKey() || isEod(r.at_time)) return '';
  return r.grp === 'content' ? `at ${time(r.at_time)}` : `by ${time(r.at_time)}`;
}
function paintDo() {
  const el = $('tdDo');
  if (LIST == null) { el.innerHTML = `<div class="sv-h"><h2 class="disp">Today</h2></div><p class="td-empty">Couldn't read today's list.</p>`; return; }
  const feeling = LIST[0]?.feeling || 'normal';
  const live = LIST.filter(r => !r.deferred), deferred = LIST.filter(r => r.deferred);
  const done = live.filter(r => r.done).length, total = live.length;
  emit({ done, total });
  const item = (r) => {
    const w = when(r);
    // Names and actions only on the row; the agent's longer note lives in the hover title.
    const sub = r.grp === 'calendar' ? r.location : r.grp === 'content' ? r.sub : '';
    return `<li class="td-item${r.done ? ' is-done' : ''}${r.deferred ? ' is-deferred' : ''}" data-grp="${r.grp}" data-ref="${esc(r.ref)}"${r.sub && r.grp === 'task' ? ` title="${esc(r.sub)}"` : ''}>
      <button class="td-check" aria-pressed="${!!r.done}" aria-label="${r.done ? 'Mark not done' : 'Mark done'}: ${esc(r.title)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
      <div class="td-txt"><div class="td-t">${r.grp === 'calendar' && w ? `<span class="td-time">${esc(w)}</span>` : ''}${esc(r.title)}${r.grp !== 'calendar' && w ? `<span class="td-due">${esc(w)}</span>` : ''}${r.carried_count > 1 ? `<span class="td-carry">carried ${r.carried_count}x</span>` : ''}${r.deferred ? '<span class="td-carry">deferred</span>' : ''}</div>
      ${sub ? `<div class="td-b">${esc(sub)}</div>` : ''}</div></li>`;
  };
  const groups = GROUPS.map(([g, label]) => {
    const rows = live.filter(r => r.grp === g);
    if (g !== 'calendar') rows.sort((a, b) => a.done - b.done); // open first, done sinks (stable)
    return rows.length ? `<div class="td-g"><div class="td-gl">${label}</div><ul class="td-list">${rows.map(item).join('')}</ul></div>` : '';
  }).join('');
  el.innerHTML = `<div class="sv-h"><h2 class="disp">Today</h2><span class="td-count">${total ? `${done} of ${total} done` : 'Nothing today'}</span></div>
    <div class="td-prog meter thin" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="--p:${total ? Math.round(done / total * 100) : 0}%;transition:width var(--t) var(--ease)"></i></div>
    <div class="td-feel" role="group" aria-label="How are you feeling today">${FEEL.map(([v, l]) => `<button class="td-fb" data-v="${v}" aria-pressed="${feeling === v}">${l}</button>`).join('')}</div>
    ${groups || `<p class="td-empty">Nothing on your list.</p>`}
    ${deferred.length ? `<details class="td-done"><summary>${deferred.length} deferred to tomorrow</summary><ul class="td-list">${deferred.map(item).join('')}</ul></details>` : ''}`;
  el.querySelectorAll('.td-check').forEach(b => b.addEventListener('click', async () => {
    const li = b.closest('.td-item'), r = LIST.find(x => x.grp === li.dataset.grp && String(x.ref) === li.dataset.ref);
    const val = !r.done; r.done = val; paintDo();
    try { await checkToday(r.grp, r.ref, val); refreshList(); }
    catch (e) { r.done = !val; paintDo(); toast(e.message || 'Save failed', 'err'); }
  }));
  el.querySelectorAll('.td-fb').forEach(b => b.addEventListener('click', async () => {
    const v = b.dataset.v; if (v === feeling) return;
    LIST.forEach(r => { r.feeling = v; }); paintDo();
    try { await setFeeling(v); await refreshList(); if (v === 'drained') toast('Cut to your top 3. The rest waits for tomorrow.', 'ok'); }
    catch (e) { LIST.forEach(r => { r.feeling = feeling; }); paintDo(); toast(e.message || 'Save failed', 'err'); }
  }));
}
async function refreshList() {
  try { LIST = await todayList(); paintDo(); } catch (e) { console.error(e); }
}

// ---------- Decide ----------
// Each card opens a side drawer with the full context (what it is, why it matters, cost,
// recommendation), every option's detail and preview, and the source file's full path.
// "Already done" / "Not needed" close a row without picking an option.
const CLOSE = { 'already done': 'Already done', 'not needed': 'Not needed' };
const VAULT = 'C:\\Users\\coope\\Desktop\\Claude\\';
const noDash = (s) => String(s ?? '').replace(/\s*[\u2014\u2013]\s*/g, ', ');
const pickLabel = (r) => CLOSE[r.answer] || optLabel(r.options, r.answer);
const isRecent = (iso) => iso && Date.now() - new Date(iso).getTime() < 864e5;
let DECIDE_ALL = false;
function paintDecide() {
  const open = CC.filter(r => r.kind === 'decide' && !r.done);
  const waiting = open.filter(r => !r.answer).sort((a, b) => a.priority - b.priority);
  const sent = [...open.filter(r => r.answer), ...CC.filter(r => r.kind === 'decide' && r.done && CLOSE[r.answer] && isRecent(r.answered_at))];
  emit({ waiting: waiting.length, firstWaiting: waiting[0] ? noDash(waiting[0].title) : '' });
  const card = (r) => `<article class="sv-card td-card is-click" data-id="${r.id}" tabindex="0" role="button" aria-label="More about: ${esc(r.title)}">
      <div class="td-t">${esc(noDash(r.title))}</div>
      ${r.body ? `<p class="td-b">${esc(noDash(r.body))}</p>` : ''}
      <div class="td-opts">${(r.options || []).map(o => `<button class="td-opt${o.rec ? ' rec' : ''}" data-v="${esc(o.v)}"${o.rec ? ' title="Claude\'s pick"' : ''}>${esc(o.label)}</button>`).join('')}<button class="td-close" data-close="already done">Already done</button></div>
    </article>`;
  const sentRow = (r) => `<li data-id="${r.id}"><span class="td-t">${esc(noDash(r.title))}</span><span class="td-pick">${esc(pickLabel(r))}</span><button class="td-undo" aria-label="Undo">Undo</button></li>`;
  const SHOW = 4, extra = Math.max(0, waiting.length - SHOW);
  $('tdDecide').innerHTML = `<div class="sv-h"><h2 class="disp">Decide</h2><span class="td-count">${waiting.length ? `${waiting.length} waiting` : 'Nothing waiting'}</span></div>
    ${waiting.length ? `<div class="td-cards${DECIDE_ALL ? ' all' : ''}">${waiting.map(card).join('')}</div>` : ''}
    ${extra && !DECIDE_ALL ? `<button class="td-all btn small ghost">${extra} more</button>` : ''}
    ${sent.length ? `<ul class="td-sent">${sent.map(sentRow).join('')}</ul>` : ''}`;
  const root = $('tdDecide');
  root.querySelector('.td-all')?.addEventListener('click', () => { DECIDE_ALL = true; paintDecide(); });
  root.querySelectorAll('.td-opt').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); answer(+b.closest('[data-id]').dataset.id, b.dataset.v); }));
  root.querySelectorAll('.td-close').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); closeRow(+b.closest('[data-id]').dataset.id, b.dataset.close); }));
  root.querySelectorAll('.td-undo').forEach(b => b.addEventListener('click', () => undo(+b.closest('[data-id]').dataset.id)));
  root.querySelectorAll('.td-card.is-click').forEach(c => {
    c.addEventListener('click', () => openDrawer(+c.dataset.id));
    c.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); openDrawer(+c.dataset.id); } });
  });
}
async function save(id, patch, msg) {
  const r = CC.find(x => x.id === id), prev = { answer: r.answer, answered_at: r.answered_at, done: r.done };
  Object.assign(r, patch); paintDecide();
  try { await updateCommand(id, patch); if (msg) toast(msg, 'ok'); }
  catch (e) { Object.assign(r, prev); paintDecide(); toast(e.message || 'Save failed', 'err'); }
}
function answer(id, v) {
  const r = CC.find(x => x.id === id);
  return save(id, { answer: v, answered_at: v ? new Date().toISOString() : null }, v ? `Sent: ${optLabel(r.options, v)}` : '');
}
function closeRow(id, how) { closeDrawer(); return save(id, { answer: how, answered_at: new Date().toISOString(), done: true }, `Closed: ${CLOSE[how]}`); }
function undo(id) { return save(id, { answer: null, answered_at: null, done: false }, ''); }

// ---------- Decide drawer ----------
const srcHtml = (p) => {
  if (!p) return '';
  if (/^https?:\/\//.test(p)) return `<a href="${esc(p)}" target="_blank" rel="noopener">${esc(p)} ${icon('external-link', { size: 12 })}</a>`;
  if (/^content_plan#/.test(p)) return `<a href="/admin/schedule/">This week's schedule</a>`;
  const full = VAULT + p.replace(/\//g, '\\');
  return `<code class="dr-path">${esc(full)}</code><button class="dr-copy" data-copy="${esc(full)}">${icon('copy', { size: 13 })}<span>Copy path</span></button>`;
};
const previewHtml = (o) => {
  const u = o.preview_url;
  if (!u) return '';
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u)) return `<a class="dr-prev" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Preview of ${esc(o.label)}" loading="lazy"></a>`;
  if (/\.(webm|mp4|mov)(\?|$)/i.test(u)) return `<video class="dr-prev" src="${esc(u)}" controls muted loop playsinline preload="metadata"></video>`;
  return `<a class="dr-link" href="${esc(u)}" target="_blank" rel="noopener">Open preview ${icon('external-link', { size: 13 })}</a>`;
};
let DRAWER = null, LAST_FOCUS = null;
function ensureDrawer() {
  if (DRAWER) return DRAWER;
  DRAWER = document.createElement('div');
  DRAWER.className = 'dr-wrap'; DRAWER.hidden = true;
  DRAWER.innerHTML = `<div class="dr-scrim" data-x></div><aside class="dr" role="dialog" aria-modal="true" aria-labelledby="drTitle" tabindex="-1"></aside>`;
  document.body.appendChild(DRAWER);
  DRAWER.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && DRAWER && !DRAWER.hidden) closeDrawer(); });
  return DRAWER;
}
function openDrawer(id) {
  const r = CC.find(x => x.id === id); if (!r) return;
  const w = ensureDrawer(), el = w.querySelector('.dr');
  LAST_FOCUS = document.activeElement;
  const opts = r.options || [];
  el.innerHTML = `<header class="dr-h"><div class="eyebrow">Decide</div><button class="dr-x" data-x aria-label="Close">${icon('x', { size: 18 })}</button></header>
    <h2 id="drTitle" class="dr-t">${esc(noDash(r.title))}</h2>
    ${r.context ? `<p class="dr-ctx">${esc(noDash(r.context))}</p>` : r.body ? `<p class="dr-ctx">${esc(noDash(r.body))}</p><p class="dr-miss">No extra context was written for this one yet.</p>` : `<p class="dr-miss">No context was written for this one yet.</p>`}
    ${opts.length ? `<div class="eyebrow dr-sub">Options</div><ol class="dr-opts">${opts.map(o => `<li class="dr-opt${o.rec ? ' rec' : ''}${r.answer === o.v ? ' on' : ''}">
        <div class="dr-oh"><b>${esc(o.label)}</b>${o.rec ? '<span class="dr-rec">Claude\'s pick</span>' : ''}${r.answer === o.v ? '<span class="dr-rec on">Your pick</span>' : ''}</div>
        ${o.detail ? `<p>${esc(noDash(o.detail))}</p>` : ''}
        ${previewHtml(o)}
        ${o.file ? `<div class="dr-file">File: ${srcHtml(o.file)}</div>` : ''}
        <button class="td-opt${o.rec ? ' rec' : ''}" data-v="${esc(o.v)}">Pick ${esc(o.label)}</button></li>`).join('')}</ol>` : ''}
    ${r.source_path ? `<div class="eyebrow dr-sub">Source</div><div class="dr-src">${srcHtml(r.source_path)}</div>` : ''}
    <footer class="dr-f"><button class="btn ghost" data-close="already done">Already done</button><button class="btn ghost" data-close="not needed">Not needed</button></footer>`;
  el.querySelectorAll('.td-opt').forEach(b => b.addEventListener('click', () => { answer(id, b.dataset.v); closeDrawer(); }));
  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeRow(id, b.dataset.close)));
  el.querySelectorAll('.dr-copy').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Path copied', 'ok'); } catch { toast('Copy failed', 'err'); }
  }));
  w.hidden = false; document.documentElement.classList.add('dr-open');
  requestAnimationFrame(() => { w.classList.add('in'); el.focus(); });
}
function closeDrawer() {
  if (!DRAWER || DRAWER.hidden) return;
  DRAWER.classList.remove('in'); document.documentElement.classList.remove('dr-open');
  setTimeout(() => { if (!DRAWER.classList.contains('in')) DRAWER.hidden = true; }, 900); // after the slide-out finishes
  if (LAST_FOCUS && document.contains(LAST_FOCUS)) LAST_FOCUS.focus();
}

// ---------- This week's content ladder ----------
const STATUS = { ready: ['Ready', 'ok'], 'needs-confirm': ['Needs your pick', 'ask'], 'needs-filming': ['Needs filming', 'film'], blocked: ['Blocked', 'bad'], posted: ['Posted', 'done'], skipped: ['Skipped', 'done'] };
function paintLadder() {
  const el = $('tdLadder');
  if (LADDER == null) { el.innerHTML = `<div class="sv-h"><h2 class="disp">This week</h2></div><p class="td-empty">Couldn't read the posting plan.</p>`; return; }
  if (!LADDER.length) { el.innerHTML = `<div class="sv-h"><h2 class="disp">This week</h2></div><p class="td-empty">No posting plan for this week yet.</p>`; return; }
  const today = todayKey();
  const posted = LADDER.filter(r => r.status === 'posted').length;
  const row = (r) => {
    const [label, cls] = r.answer && r.status === 'needs-confirm' ? ['Picked', 'ok'] : (STATUS[r.status] || [r.status, '']);
    const isToday = r.day && String(r.day).slice(0, 10) === today;
    const opts = r.options && !r.answer && r.status !== 'posted'
      ? `<div class="td-opts sm">${r.options.map(o => `<button class="td-opt${o.rec ? ' rec' : ''}" data-v="${esc(o.v)}"${o.rec ? ' title="Claude\'s pick"' : ''}>${esc(o.label)}</button>`).join('')}</div>`
      : r.answer ? `<div class="td-picked">You picked <b>${esc(optLabel(r.options, r.answer))}</b> <button class="td-undo">Undo</button></div>` : '';
    return `<li class="td-rung${isToday ? ' now' : ''}${r.status === 'posted' ? ' is-done' : ''}" data-id="${r.id}">
      <span class="td-day">${esc(r.day_label || 'Any day')}</span>
      <div class="td-txt"><div class="td-t"${r.note ? ` title="${esc(r.note)}"` : ''}>${esc(r.piece)}</div>${opts}</div>
      <span class="td-pill ${cls}">${esc(label)}</span></li>`;
  };
  el.innerHTML = `<div class="sv-h"><h2 class="disp">This week</h2><span class="td-count">${posted} of ${LADDER.length} posted · <a href="/admin/schedule/">Schedule</a></span></div>
    <ol class="td-ladder-list">${LADDER.map(row).join('')}</ol>`;
  el.querySelectorAll('.td-opt').forEach(b => b.addEventListener('click', () => pickRung(+b.closest('[data-id]').dataset.id, b.dataset.v)));
  el.querySelectorAll('.td-undo').forEach(b => b.addEventListener('click', () => pickRung(+b.closest('[data-id]').dataset.id, null)));
}
async function pickRung(id, v) {
  const r = LADDER.find(x => x.id === id), prev = { answer: r.answer, answered_at: r.answered_at };
  r.answer = v; r.answered_at = v ? new Date().toISOString() : null;
  paintLadder();
  try { await answerLadder(id, { answer: r.answer, answered_at: r.answered_at }); if (v) toast(`Locked: ${optLabel(r.options, v)}`, 'ok'); }
  catch (e) { Object.assign(r, prev); paintLadder(); toast(e.message || 'Save failed', 'err'); }
}
