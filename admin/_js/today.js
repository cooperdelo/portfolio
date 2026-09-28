// /admin/_js/today.js — TODAY command center (2026-09-28).
// Replaces the MORNING-*.md files. Agents write rows into command_center and
// content_plan; this page only shows them and takes one-tap answers.
// No file paths on screen: a row's source shows only as a hover title on "source".
import { toast } from '/admin/_shell/admin-shell.js';
import { esc, ago } from '/admin/_shell/ui.js';
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
    el.innerHTML = `<span class="td-dot"></span><span>All systems fine. ${feedsTotal} feeds fresh, ${tasksTotal} agents ran clean in the last 24h.</span>`;
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
  const item = (r) => {
    const w = when(r);
    const sub = r.grp === 'calendar' ? r.location : r.grp === 'content' ? r.sub : (!r.done ? r.sub : '');
    return `<li class="td-item${r.done ? ' is-done' : ''}${r.deferred ? ' is-deferred' : ''}" data-grp="${r.grp}" data-ref="${esc(r.ref)}">
      <button class="td-check" aria-pressed="${!!r.done}" aria-label="${r.done ? 'Mark not done' : 'Mark done'}: ${esc(r.title)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
      <div class="td-txt"><div class="td-t">${r.grp === 'calendar' && w ? `<span class="td-time">${esc(w)}</span>` : ''}${esc(r.title)}${r.grp !== 'calendar' && w ? `<span class="td-due">${esc(w)}</span>` : ''}${r.carried_count ? `<span class="td-carry">carried ${r.carried_count}x</span>` : ''}${r.deferred ? '<span class="td-carry">deferred</span>' : ''}</div>
      ${sub ? `<div class="td-b">${esc(sub)}</div>` : ''}</div></li>`;
  };
  const groups = GROUPS.map(([g, label]) => {
    const rows = live.filter(r => r.grp === g);
    if (g !== 'calendar') rows.sort((a, b) => a.done - b.done); // open first, done sinks (stable)
    return rows.length ? `<div class="td-g"><div class="td-gl">${label}</div><ul class="td-list">${rows.map(item).join('')}</ul></div>` : '';
  }).join('');
  el.innerHTML = `<div class="sv-h"><h2 class="disp">Today</h2><span class="td-count">${total ? `${done} of ${total} done` : 'Nothing today'}</span></div>
    <div class="td-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
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
function paintDecide() {
  const rows = CC.filter(r => r.kind === 'decide' && !r.done);
  const waiting = rows.filter(r => !r.answer).sort((a, b) => a.priority - b.priority);
  const sent = rows.filter(r => r.answer);
  const card = (r) => `<article class="sv-card td-card" data-id="${r.id}">
      <div class="td-t">${esc(r.title)}</div>
      ${r.body ? `<p class="td-b">${esc(r.body)}</p>` : ''}
      <div class="td-opts">${(r.options || []).map(o => `<button class="td-opt${o.rec ? ' rec' : ''}" data-v="${esc(o.v)}"${o.rec ? ' title="Claude\'s pick"' : ''}>${esc(o.label)}</button>`).join('')}</div>
      ${src(r)}
    </article>`;
  const sentRow = (r) => `<li data-id="${r.id}"><span class="td-t">${esc(r.title)}</span><span class="td-pick">${esc(optLabel(r.options, r.answer))}</span><button class="td-undo" aria-label="Undo">Undo</button></li>`;
  $('tdDecide').innerHTML = `<div class="sv-h"><h2 class="disp">Decide</h2><span class="td-count">${waiting.length ? `${waiting.length} waiting` : 'Nothing waiting'}</span></div>
    ${waiting.length ? `<div class="td-cards">${waiting.map(card).join('')}</div>` : ''}
    ${sent.length ? `<ul class="td-sent">${sent.map(sentRow).join('')}</ul>` : ''}`;
  $('tdDecide').querySelectorAll('.td-opt').forEach(b => b.addEventListener('click', () => answer(+b.closest('[data-id]').dataset.id, b.dataset.v)));
  $('tdDecide').querySelectorAll('.td-undo').forEach(b => b.addEventListener('click', () => answer(+b.closest('[data-id]').dataset.id, null)));
}
async function answer(id, v) {
  const r = CC.find(x => x.id === id), prev = { answer: r.answer, answered_at: r.answered_at };
  r.answer = v; r.answered_at = v ? new Date().toISOString() : null;
  paintDecide();
  try { await updateCommand(id, { answer: r.answer, answered_at: r.answered_at }); if (v) toast(`Sent: ${optLabel(r.options, v)}`, 'ok'); }
  catch (e) { Object.assign(r, prev); paintDecide(); toast(e.message || 'Save failed', 'err'); }
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
      <div class="td-txt"><div class="td-t">${esc(r.piece)}</div>${r.note && r.status !== 'posted' ? `<div class="td-b">${esc(r.note)}</div>` : ''}${opts}</div>
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
