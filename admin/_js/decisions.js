// /admin/_js/decisions.js — decisions waiting on Cooper + locked history (v7 layout).
// Reads/writes: decisions. Go and No lock the row (history, not reopened). Later parks it.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast, isLocalDemo } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, fmtDay, emptyState, pageHead, icon, statTile } from '/admin/_shell/ui.js';
import { reveal } from '/admin/_shell/motion.js';

if (!isLocalDemo() && !(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Decisions', demo: true });
const app = document.getElementById('app');
app.innerHTML = pageHead('', 'Decisions') + `
  <section class="stat-row" id="stats" style="--n:3"></section>
  <section class="grid">
    <div class="span-8 col" id="open"></div>
    <div class="span-4 col"><div class="sv-card" id="laterCard" hidden><div class="sv-h"><h2>Later</h2></div><div class="rows" id="later"></div></div>
      <div class="sv-card"><div class="sv-h"><h2>Decided</h2></div><div class="rows" id="done"></div></div></div>
  </section>`;

function card(d) {
  const f = (k, v) => v ? `<div class="field-k">${k}</div><div class="field-v">${esc(v)}</div>` : '';
  return `<div class="sv-card dec pad-lg">
    <div class="sv-h" style="margin-bottom:4px"><h3 style="font-size:15px;text-transform:none;letter-spacing:0">${esc(d.title)}</h3><span class="mono">${esc(fmtDay(d.created_at))}</span></div>
    ${f('Context', d.context)}${f('Why it matters', d.why_it_matters)}${f('Cost', d.cost)}
    ${d.recommendation ? `<div class="field-k">Claude's pick</div><div class="field-v" style="color:var(--text);font-weight:700">${esc(d.recommendation)}</div>` : ''}
    <div class="acts"><button class="btn primary" data-id="${d.id}" data-s="go">${icon('check', { size: 14 })}Go</button><button class="btn" data-id="${d.id}" data-s="no">No</button><button class="btn ghost" data-id="${d.id}" data-s="later">Later</button></div>
    ${d.source_path ? `<div class="sv-meta" title="${esc(d.source_path)}">${esc(String(d.source_path).split('/').pop())}</div>` : ''}
  </div>`;
}
async function load() {
  const { data, error } = await sb.from('decisions').select('*').order('created_at', { ascending: false });
  if (error) { document.getElementById('open').innerHTML = `<div class="sv-card">${emptyState("Couldn't load", esc(error.message))}</div>`; return; }
  const rows = data || [];
  const open = rows.filter(r => r.status === 'open'), later = rows.filter(r => r.status === 'later'), done = rows.filter(r => ['go', 'no', 'confirmed'].includes(r.status));
  const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('stats').innerHTML = [
    statTile({ k: 'Waiting', v: String(open.length), accent: open.length > 0, src: `Decision ledger · ${stamp}` }),
    statTile({ k: 'Later', v: String(later.length), src: `Decision ledger · ${stamp}` }),
    statTile({ k: 'Decided', v: String(done.length), src: `Decision ledger · ${stamp}` }),
  ].join('');
  document.getElementById('open').innerHTML = open.map(card).join('') || `<div class="sv-card pad-lg">${emptyState('Nothing waiting.', '')}</div>`;
  document.getElementById('laterCard').hidden = !later.length;
  document.getElementById('later').innerHTML = later.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.title)}</div></div><button class="btn small" data-id="${r.id}" data-s="open">Reopen</button></div>`).join('');
  document.getElementById('done').innerHTML = done.map(r => `<div class="row"><div class="grow"><div class="t" title="${esc(r.decision || '')}">${esc(r.title)}</div><div class="s">${esc(fmtDay(r.decided_at))}</div></div><span class="chip ${r.status === 'no' ? 'quiet' : 'ok'}">${esc(r.status === 'no' ? 'No' : 'Go')}</span></div>`).join('') || emptyState('None yet.', '');
  reveal(document.querySelectorAll('#stats .stat, #open > .sv-card'), { stagger: 70, y: 14 });
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
