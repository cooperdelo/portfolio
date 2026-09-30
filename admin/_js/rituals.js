// /admin/_js/rituals.js, one card per scheduled agent.
// Reads: task_run_log (runs), vault_documents (what each task wrote, by owner_task).
// Display-only on purpose (open decision: toggles). Missed-run detection is
// inferred from each task's own median gap between runs.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, ago, fmtWhen, emptyState, statusChip, pageHead, ymd, toDate, modal, todayET, statTile } from '/admin/_shell/ui.js';
import { reveal } from '/admin/_shell/motion.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Rituals' });
const app = document.getElementById('app');
app.innerHTML = pageHead('Today', 'Rituals', '<div class="seg" id="seg"></div>') + `
  <section class="stat-row" id="summary" style="--n:4"></section>
  <div class="sv-grid auto" id="cards"><div class="shimmer" style="height:200px"></div></div>`;

const since = new Date(Date.now() - 60 * 864e5).toISOString();
const [{ data: runs, error }, { data: docs, error: e2 }] = await Promise.all([
  sb.from('task_run_log').select('task,ran_at,status,note,wrote').gte('ran_at', since).order('ran_at', { ascending: false }).limit(3000),
  sb.from('vault_documents').select('path,owner_task,updated_at').not('owner_task', 'is', null).order('updated_at', { ascending: false }).limit(1000),
]);
if (error || e2) { document.getElementById('cards').innerHTML = emptyState("Couldn't load runs", esc((error || e2).message)); throw error || e2; }

const byTask = {};
for (const r of runs || []) (byTask[r.task] = byTask[r.task] || []).push(r);
const docsBy = {};
for (const d of docs || []) (docsBy[d.owner_task] = docsBy[d.owner_task] || []).push(d);

const tasks = Object.entries(byTask).map(([task, rs]) => {
  const times = rs.map(r => toDate(r.ran_at).getTime()).sort((a, b) => b - a);
  const gaps = times.slice(0, -1).map((t, i) => t - times[i + 1]).filter(g => g > 3.6e6).sort((a, b) => a - b);
  const median = gaps.length >= 2 ? gaps[Math.floor(gaps.length / 2)] : null;
  const since = Date.now() - times[0];
  const missed = median ? since > Math.max(median * 2, 26 * 3.6e6) : false;
  return { task, rs, last: rs[0], median, missed };
});
const rank = (t) => t.last.status === 'failed' ? 0 : t.missed ? 1 : t.last.status === 'partial' ? 2 : 3;
tasks.sort((a, b) => rank(a) - rank(b) || toDate(b.last.ran_at) - toDate(a.last.ran_at));

const count = (f) => tasks.filter(f).length;
const failedN = count(t => t.last.status === 'failed');
document.getElementById('summary').innerHTML = [
  ['Agents · 60 days', tasks.length, false],
  ['Last run failed', failedN, failedN > 0],
  ['Looks missed', count(t => t.missed), false],
  ['Ran in 24h', count(t => Date.now() - toDate(t.last.ran_at) < 864e5), false],
].map(([k, v, a]) => statTile({ k, v: String(v), accent: a, src: `Agent run log · ${esc(fmtWhen(new Date()))}` })).join('');
reveal(document.querySelectorAll('#summary .stat'), { stagger: 70, y: 14 });

let filter = 'all';
function draw() {
  document.getElementById('seg').innerHTML = [['all', 'All'], ['attention', 'Needs attention'], ['ok', 'Healthy']].map(([k, l]) => `<button class="${k === filter ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
  document.querySelectorAll('#seg button').forEach(b => b.onclick = () => { filter = b.dataset.k; draw(); });
  const vis = tasks.filter(t => filter === 'all' || (filter === 'attention' ? rank(t) < 3 : rank(t) === 3));
  const today = toDate(todayET());
  document.getElementById('cards').innerHTML = vis.map(t => {
    const dots = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i); const k = ymd(d);
      const day = t.rs.filter(r => ymd(toDate(r.ran_at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })) === k);
      const worst = ['failed', 'partial', 'ok', 'quiet'].find(s => day.some(r => r.status === s));
      dots.push(`<i class="${worst || ''}" title="${esc(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}: ${day.length ? day.length + ' run(s), ' + esc(worst) : 'no run'}"></i>`);
    }
    const produced = (docsBy[t.task] || []).slice(0, 3);
    const cadence = t.median ? (t.median < 864e5 * 0.8 ? `every ${Math.round(t.median / 3.6e6)}h` : `every ${Math.round(t.median / 864e5)}d`) : '';
    return `<div class="sv-card" id="${esc(t.task)}">
      <div class="sv-h" style="margin-bottom:6px"><h3 class="code" style="text-transform:none;letter-spacing:0;font-size:13px">${esc(t.task)}</h3>${statusChip(t.last.status)}</div>
      <div class="sv-meta" style="margin-top:0">${esc(ago(t.last.ran_at))}${cadence ? ' · ' + esc(cadence) : ''} ${t.missed ? '<span class="chip stale">missed</span>' : ''}</div>
      <div class="dots" aria-label="Last 14 days">${dots.join('')}</div>
      ${t.last.note ? `<div class="note" title="${esc(t.last.note)}">${esc(t.last.note)}</div>` : ''}
      ${produced.length ? `<div class="produced">${produced.map(d => `<a href="#" data-path="${esc(d.path)}">${esc(d.path.split('/').pop())} <span class="sv-muted">· ${esc(ago(d.updated_at))}</span></a>`).join('')}</div>` : ''}
      <div style="margin-top:12px"><button class="btn small" data-runs="${esc(t.task)}">Runs</button></div>
    </div>`;
  }).join('') || emptyState('No agents match', 'Fed by task_run_log. Each scheduled task writes one row per run.');
  document.querySelectorAll('[data-path]').forEach(a => a.onclick = (e) => { e.preventDefault(); location.href = '/admin/brain/?path=' + encodeURIComponent(a.dataset.path); });
  document.querySelectorAll('[data-runs]').forEach(b => b.onclick = () => {
    const t = tasks.find(x => x.task === b.dataset.runs);
    modal(`<h3 style="margin-bottom:.6rem">${esc(t.task)} · last ${t.rs.length} runs (60 days)</h3><div class="rows" style="max-height:60vh;overflow:auto">${t.rs.map(r => `<div class="row" style="align-items:flex-start"><div class="grow"><div class="t">${esc(fmtWhen(r.ran_at))}</div><div class="sv-text" style="white-space:normal">${esc(r.note || '')}</div>${r.wrote?.length ? `<div class="sv-meta">wrote: ${esc([].concat(...[r.wrote]).flat().join(', '))}</div>` : ''}</div>${statusChip(r.status)}</div>`).join('')}</div>`);
  });
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'center' });
}
draw();
