// /admin/_js/today.js — TODAY command center (2026-09-28).
// Replaces the MORNING-*.md files. Agents write rows into command_center and
// content_plan; this page only shows them and takes one-tap answers.
// No file paths on screen: a row's source shows only as a hover title on "source".
import { toast } from '/admin/_shell/admin-shell.js';
import { esc, ago } from '/admin/_shell/ui.js';
import { commandCenter, updateCommand, contentLadder, answerLadder, systemBroken } from '/admin/_shell/live-data.js';
import { reveal } from '/admin/_shell/motion.js';

const $ = (id) => document.getElementById(id);
const TZ = 'America/New_York';
const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(':00', '').replace(' ', '').toLowerCase();
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const src = (r) => r.source_path ? `<span class="td-src" tabindex="0" title="${esc(r.source_path)}">source</span>` : '';
const optLabel = (opts, v) => (opts || []).find(o => o.v === v)?.label || v;

let CC = [], LADDER = [];

export async function mountToday() {
  const [cc, ladder] = await Promise.all([commandCenter(), contentLadder().catch(e => { console.error(e); return null; })]);
  CC = cc; LADDER = ladder;
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

// ---------- Do today ----------
function paintDo() {
  const today = todayKey();
  const rows = CC.filter(r => r.kind === 'do');
  const open = rows.filter(r => !r.done).sort((a, b) => (a.due ? new Date(a.due) : Infinity) - (b.due ? new Date(b.due) : Infinity) || a.priority - b.priority);
  const done = rows.filter(r => r.done && (!r.answered_at || dayKey(r.answered_at) === today || dayKey(r.updated_at || r.created_at) === today));
  const shown = open.slice(0, 5), more = open.length - shown.length;
  const item = (r) => `<li class="td-item${r.done ? ' is-done' : ''}" data-id="${r.id}">
      <button class="td-check" aria-pressed="${r.done}" aria-label="${r.done ? 'Mark not done' : 'Mark done'}: ${esc(r.title)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg></button>
      <div class="td-txt"><div class="td-t">${esc(r.title)}${r.due && !r.done && dayKey(r.due) === today && !r.title.includes(time(r.due).replace(/[ap]m$/, '')) ? `<span class="td-due">by ${esc(time(r.due))}</span>` : ''}</div>
      ${r.body && !r.done ? `<div class="td-b">${esc(r.body)}</div>` : ''}</div>${src(r)}</li>`;
  $('tdDo').innerHTML = `<div class="sv-h"><h2 class="disp">Do today</h2><span class="td-count">${open.length ? `${open.length} left` : 'All done'}</span></div>
    ${shown.length ? `<ul class="td-list">${shown.map(item).join('')}</ul>` : `<p class="td-empty">Nothing on your list.</p>`}
    ${more > 0 ? `<p class="td-more">${more} more after these</p>` : ''}
    ${done.length ? `<details class="td-done"><summary>${done.length} done</summary><ul class="td-list">${done.map(item).join('')}</ul></details>` : ''}`;
  $('tdDo').querySelectorAll('.td-check').forEach(b => b.addEventListener('click', async () => {
    const id = +b.closest('.td-item').dataset.id, r = CC.find(x => x.id === id);
    const val = !r.done;
    r.done = val; r.answered_at = val ? new Date().toISOString() : null; r.updated_at = new Date().toISOString();
    paintDo();
    try { await updateCommand(id, { done: val, answered_at: r.answered_at }); }
    catch (e) { r.done = !val; paintDo(); toast(e.message || 'Save failed', 'err'); }
  }));
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
