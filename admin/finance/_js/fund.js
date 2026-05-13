import { sb, fmtUSD, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: '1789 Fund · Finance' });

const AWARD = 1850;

async function load() {
  const { data, error } = await sb.from('financial_transactions').select('*')
    .eq('entity', '1789_fund').is('deleted_at', null).order('date', { ascending: true });
  if (error) { toast('Failed to load', 'err'); return; }
  render(data || []);
}

function render(rows) {
  const spent = rows.filter(r => r.type === 'expense').reduce((a, r) => a + Number(r.amount), 0);
  const remaining = Math.max(0, AWARD - spent);
  const pct = Math.min(100, (spent / AWARD) * 100);

  setK('spent',     fmtUSD(spent));
  setK('spent_pct', `${pct.toFixed(1)}% of $1,850`);
  setK('remaining', fmtUSD(remaining));
  setK('rem_pct',   `${(100 - pct).toFixed(1)}% available`);
  setK('entries',   rows.length);

  document.getElementById('burn-bar').style.width = `${pct}%`;
  document.getElementById('burn-spent').textContent = `${fmtUSD(spent)} spent`;
  document.getElementById('burn-remaining').textContent = `${fmtUSD(remaining)} remaining`;

  const tbody = document.getElementById('fund-tbody');
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty">No fund expenses logged yet</td></tr>`; return; }
  tbody.innerHTML = rows.filter(r => r.type === 'expense').map(r => `
    <tr>
      <td class="mono meta">${new Date(r.date).toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'2-digit' })}</td>
      <td><div class="desc">${escapeHtml(r.description)}</div>${r.notes ? `<div class="meta">${escapeHtml(r.notes)}</div>` : ''}</td>
      <td class="mono meta">${(r.category || '').replace(/_/g, ' ')}</td>
      <td class="mono meta">${escapeHtml(r.merchant || '—')}</td>
      <td class="right mono" style="color: var(--rust, #FF4D2E);">−${fmtUSD(r.amount)}</td>
    </tr>`).join('');
}

function setK(k, v) { const e = document.querySelector(`[data-k="${k}"]`); if (e) e.textContent = v; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

subscribeTransactions(() => load());
await load();
