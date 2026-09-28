// /admin/_js/earn.js — opportunities from the Opportunity Scout.
// Reads: opportunities (seeded from Context/OPPORTUNITIES.md 2026-09-27),
//        vault_documents (Context/OPPORTUNITIES.md for the dropped list).
// Writes: opportunities.status (go / no / later) + decided_at.
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';
import { requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc, ago, fmtDay, emptyState, pageHead } from '/admin/_shell/ui.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('not full admin');
await mountShell({ title: 'Earn' });
const app = document.getElementById('app');
app.innerHTML = pageHead('Grow', 'Earn') + `
  <div class="sv-card tint" style="margin-bottom:1rem"><div class="sv-text"><b>How this works.</b> The Opportunity Scout pitches money ideas with an id. Go, No or Later saves your answer here with a timestamp. Nothing is decided until you press one. <span class="sv-muted" id="srcline"></span></div></div>
  <div class="sv-grid c3" id="stats" style="margin-bottom:1rem"></div>
  <div class="sv-h"><h2>Open</h2></div><div class="sv-grid c2" id="open"></div>
  <section class="sv-section"><div class="sv-h"><h2>Your answers</h2></div><div class="sv-card"><div class="rows" id="done"></div></div></section>
  <section class="sv-section"><div class="sv-h"><h2>Already dropped by the scout</h2><span class="sv-sub">From Context/OPPORTUNITIES.md</span></div><div class="sv-card"><div class="rows" id="dropped"></div></div></section>`;

async function load() {
  const [{ data, error }, { data: doc }] = await Promise.all([
    sb.from('opportunities').select('*').order('rank'),
    sb.from('vault_documents').select('content,updated_at').eq('path', 'Context/OPPORTUNITIES.md').maybeSingle(),
  ]);
  if (error) { document.getElementById('open').innerHTML = emptyState("Couldn't load", esc(error.message)); return; }
  const rows = data || [];
  document.getElementById('srcline').textContent = doc ? `Ledger file last updated ${ago(doc.updated_at)}. Answers are not yet copied back into that file automatically.` : '';
  const open = rows.filter(r => r.status === 'open'), done = rows.filter(r => r.status !== 'open');
  const go = rows.filter(r => r.status === 'go').length;
  document.getElementById('stats').innerHTML = [['Open ideas', open.length], ['You said go', go], ['Fastest to first dollar', open.length ? Math.min(...open.map(o => Number(o.time_hours) || 99)) + 'h' : '—']]
    .map(([k, v]) => `<div class="sv-card"><div class="sv-label">${k}</div><div class="sv-num md">${v}</div><div class="sv-meta">opportunities table</div></div>`).join('');
  const score = (k, v) => `<span class="chip">${k} ${v ?? '—'}</span>`;
  document.getElementById('open').innerHTML = open.map(o => `<div class="sv-card dec">
      <div class="sv-label"><span class="chip accent">${esc(o.id)}</span>${score('FIT', o.fit != null ? o.fit + '/3' : null)}${score('PROOF', o.proof != null ? o.proof + '/3' : null)}${score('TIME', o.time_hours != null ? o.time_hours + 'h' : null)}</div>
      <h3 style="margin-top:.6rem;font-size:1.05rem">${esc(o.title)}</h3>
      <div class="field-k">Evidence</div><div class="field-v">${esc(o.evidence || '—')}</div>
      <div class="field-k">What it could be worth</div><div class="field-v">${esc(o.estimate || '—')}</div>
      <div class="acts"><button class="btn primary" data-id="${esc(o.id)}" data-s="go">Go</button><button class="btn" data-id="${esc(o.id)}" data-s="later">Later</button><button class="btn danger" data-id="${esc(o.id)}" data-s="no">No</button></div>
      <div class="sv-meta">added ${esc(fmtDay(o.created_at))} · source ${esc(o.source_path || '')}</div>
    </div>`).join('') || emptyState('No open ideas', 'Fed by the Opportunity Scout (Context/OPPORTUNITIES.md, mirrored into the opportunities table).');
  document.getElementById('done').innerHTML = done.map(o => `<div class="row"><div class="grow"><div class="t">${esc(o.title)}</div><div class="s">${esc(o.id)} · answered ${esc(fmtDay(o.decided_at))}</div></div><span class="chip ${o.status === 'go' ? 'ok' : o.status === 'no' ? 'fail' : 'partial'}">${esc(o.status)}</span><button class="btn small ghost" data-id="${esc(o.id)}" data-s="open">Undo</button></div>`).join('') || '<div class="sv-meta" style="padding:.6rem 0">No answers yet.</div>';
  const dropped = (doc?.content || '').split(/##\s+Already considered and dropped[^\n]*\n/)[1]?.split(/\n##\s/)[0] || '';
  document.getElementById('dropped').innerHTML = dropped.split('\n').filter(l => l.trim().startsWith('- ')).map(l => `<div class="row"><div class="grow" style="white-space:normal"><div class="sv-text">${esc(l.replace(/^-\s*/, ''))}</div></div></div>`).join('') || '<div class="sv-meta" style="padding:.6rem 0">Nothing dropped yet.</div>';
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
    const s = b.dataset.s;
    const { error } = await sb.from('opportunities').update({ status: s, decided_at: s === 'open' ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', b.dataset.id);
    if (error) return toast(error.message, 'err');
    toast(s === 'open' ? 'Reopened' : `Saved: ${s} ${b.dataset.id}`, 'ok'); load();
  });
}
load();
