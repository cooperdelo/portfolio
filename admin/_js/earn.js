// /admin/_js/earn.js — money ideas from the Opportunity Scout (v7 layout).
// Reads: opportunities (seeded from Context/OPPORTUNITIES.md), vault_documents (dropped list).
// Writes: opportunities.status (go / no / later) + decided_at.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, ago, fmtDay, emptyState, pageHead, statTile } from '/admin/_shell/ui.js';
import { reveal } from '/admin/_shell/motion.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Earn' });
const app = document.getElementById('app');
app.innerHTML = pageHead('', 'Earn', '<span class="mono" id="srcline"></span>') + `
  <section class="stat-row" id="stats" style="--n:3"></section>
  <section class="grid">
    <div class="span-8"><div class="sv-grid c2" id="open"></div></div>
    <div class="span-4 col">
      <div class="sv-card"><div class="sv-h"><h2>Your answers</h2></div><div class="rows" id="done"></div></div>
      <div class="sv-card"><div class="sv-h"><h2>Dropped by the scout</h2></div><div class="rows" id="dropped"></div></div>
    </div>
  </section>`;

async function load() {
  const [{ data, error }, { data: doc }] = await Promise.all([
    sb.from('opportunities').select('*').order('rank'),
    sb.from('vault_documents').select('content,updated_at').eq('path', 'Context/OPPORTUNITIES.md').maybeSingle(),
  ]);
  if (error) { document.getElementById('open').innerHTML = emptyState("Couldn't load", esc(error.message)); return; }
  const rows = data || [];
  document.getElementById('srcline').textContent = doc ? `Scout ledger · ${ago(doc.updated_at)}` : '';
  const open = rows.filter(r => r.status === 'open'), done = rows.filter(r => r.status !== 'open');
  const go = rows.filter(r => r.status === 'go').length;
  const fastest = open.length ? Math.min(...open.map(o => Number(o.time_hours) || 99)) : null;
  document.getElementById('stats').innerHTML = [
    statTile({ k: 'Open ideas', v: String(open.length), src: 'opportunities · Opportunity Scout' }),
    statTile({ k: 'You said go', v: String(go), src: 'opportunities' }),
    statTile({ k: 'Fastest to first dollar', v: fastest == null ? '–' : String(fastest), small: fastest == null ? '' : 'hours', src: 'Opportunity Scout · open ideas' }),
  ].join('');
  const score = (k, v) => v == null ? '' : `<span class="chip">${k} ${v}</span>`;
  document.getElementById('open').innerHTML = open.map(o => `<div class="sv-card dec">
      <div class="sv-label">${score('Fit', o.fit != null ? o.fit + '/3' : null)}${score('Proof', o.proof != null ? o.proof + '/3' : null)}${score('Time', o.time_hours != null ? o.time_hours + 'h' : null)}<span class="mono" style="margin-left:auto">${esc(o.id)}</span></div>
      <h3 style="margin-top:12px;font-size:15px;text-transform:none;letter-spacing:0">${esc(o.title)}</h3>
      ${o.estimate ? `<div class="num sm" style="margin-top:12px;white-space:normal;line-height:1.1">${esc(o.estimate.replace(/^est\.\s*/i, ''))}</div>` : ''}
      ${o.evidence ? `<div class="sv-meta" style="text-transform:none;font-family:var(--f-ui);font-size:12px">${esc(o.evidence)}</div>` : ''}
      <div class="acts"><button class="btn primary" data-id="${esc(o.id)}" data-s="go">Go</button><button class="btn" data-id="${esc(o.id)}" data-s="later">Later</button><button class="btn ghost" data-id="${esc(o.id)}" data-s="no">No</button></div>
    </div>`).join('') || `<div class="sv-card">${emptyState('No open ideas.', '')}</div>`;
  document.getElementById('done').innerHTML = done.map(o => `<div class="row"><div class="grow"><div class="t">${esc(o.title)}</div><div class="s">${esc(fmtDay(o.decided_at))}</div></div><span class="chip ${o.status === 'go' ? 'ok' : o.status === 'no' ? 'quiet' : 'partial'}">${esc(o.status)}</span><button class="btn small ghost" data-id="${esc(o.id)}" data-s="open">Undo</button></div>`).join('') || emptyState('No answers yet.', '');
  const dropped = (doc?.content || '').split(/##\s+Already considered and dropped[^\n]*\n/)[1]?.split(/\n##\s/)[0] || '';
  document.getElementById('dropped').innerHTML = dropped.split('\n').filter(l => l.trim().startsWith('- ')).map(l => `<div class="row"><div class="grow"><div class="s" style="white-space:normal;color:var(--text-2)">${esc(l.replace(/^-\s*/, ''))}</div></div></div>`).join('') || emptyState('Nothing dropped yet.', '');
  reveal(document.querySelectorAll('#stats .stat, #open > .sv-card'), { stagger: 70, y: 14 });
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
    const s = b.dataset.s;
    const { error } = await sb.from('opportunities').update({ status: s, decided_at: s === 'open' ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', b.dataset.id);
    if (error) return toast(error.message, 'err');
    toast(s === 'open' ? 'Reopened' : `Saved: ${s} ${b.dataset.id}`, 'ok'); load();
  });
}
load();
