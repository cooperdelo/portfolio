// /admin/_js/decisions.js — decisions waiting on Cooper + locked history.
// Reads/writes: decisions. Go and No lock the row (history, not reopened).
// Later keeps it open-able. Build list: the vault Build List page is not
// mirrored to Supabase yet, so it is shown as an empty state.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast, isLocalDemo } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtDay, fmtWhen, emptyState, pageHead, icon } from '/admin/_shell/ui.js';

if (!isLocalDemo() && !(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Decisions', demo: true });
const app = document.getElementById('app');
app.innerHTML = pageHead('Today', 'Decisions') + `
  <section class="sv-section" style="margin-top:0"><div class="sv-h"><h2>Waiting on you</h2></div><div class="sv-grid c2" id="open"></div></section>
  <section class="sv-section" id="laterSec" hidden><div class="sv-h"><h2>Later</h2></div><div class="sv-grid c2" id="later"></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Decided</h2></div><div class="sv-card"><div class="rows" id="done"></div></div></section>`;

function card(d, withLater = true) {
  const f = (k, v) => v ? `<div class="field-k">${k}</div><div class="field-v">${esc(v)}</div>` : '';
  return `<div class="sv-card dec">
    <h3 style="font-size:1.05rem">${esc(d.title)}</h3>
    ${f('Context', d.context)}${f('Why it matters to you', d.why_it_matters)}${f('Cost', d.cost)}
    ${d.recommendation ? `<div class="field-k">Recommendation</div><div class="field-v" style="color:var(--accent-ink);font-weight:550">${esc(d.recommendation)}</div>` : ''}
    <div class="acts"><button class="btn primary" data-id="${d.id}" data-s="go">${icon('check', { size: 14 })}Go with it</button><button class="btn" data-id="${d.id}" data-s="no">No</button>${withLater ? `<button class="btn" data-id="${d.id}" data-s="later">Later</button>` : `<button class="btn ghost" data-id="${d.id}" data-s="open">Back to open</button>`}</div>
    <div class="sv-meta">Raised ${esc(fmtDay(d.created_at))}${d.source_path ? ` · <span title="${esc(d.source_path)}">${esc(String(d.source_path).split('/').pop())}</span>` : ''}</div>
  </div>`;
}
async function load() {
  const { data, error } = await sb.from('decisions').select('*').order('created_at', { ascending: false });
  if (error) { document.getElementById('open').innerHTML = emptyState("Couldn't load", esc(error.message)); return; }
  const rows = data || [];
  document.getElementById('open').innerHTML = rows.filter(r => r.status === 'open').map(r => card(r)).join('') || emptyState('Nothing waiting on you.', '');
  const later = rows.filter(r => r.status === 'later');
  document.getElementById('laterSec').hidden = !later.length;
  document.getElementById('later').innerHTML = later.map(r => card(r, false)).join('');
  document.getElementById('done').innerHTML = rows.filter(r => ['go', 'no', 'confirmed'].includes(r.status)).map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.decision || '')} · ${esc(fmtWhen(r.decided_at))}</div></div><span class="chip ${r.status === 'no' ? 'quiet' : 'ok'}">${esc(r.status === 'no' ? 'No' : 'Go')}</span></div>`).join('') || emptyState('No decisions recorded yet.', '');
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
    const s = b.dataset.s, d = rows.find(r => r.id === b.dataset.id);
    const patch = { status: s, updated_at: new Date().toISOString() };
    if (s === 'go' || s === 'no') { patch.decided_at = new Date().toISOString(); patch.decision = s === 'go' ? `Go: ${d.recommendation || ''}` : 'No'; }
    const { error } = await sb.from('decisions').update(patch).eq('id', d.id);
    if (error) return toast(error.message, 'err');
    toast('Saved', 'ok'); load();
  });
}
load();
