import { sb, fmtUSD, subscribeTransactions, getSession } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: '1789 Fund · Finance' });

// Schema note: fund accounting uses funding_source = '1789_fund', not entity.
// An expense paid by the fund stays tagged with its real entity (usually 'plugverse')
// so it counts in that entity's P&L too, AND funding_source = '1789_fund' so it
// counts toward fund burn. Source of truth for headline totals is v_fund_1789.

async function load() {
  const [view, rows] = await Promise.all([
    sb.from('v_fund_1789').select('*').single(),
    sb.from('financial_transactions').select('*')
      .eq('funding_source', '1789_fund')
      .is('deleted_at', null)
      .order('date', { ascending: true }),
  ]);
  if (view.error || rows.error) { toast('Failed to load', 'err'); return; }
  render(view.data, rows.data || []);
}

function render(totals, rows) {
  const award     = Number(totals.total_received) || 0;
  const spent     = Number(totals.total_spent)    || 0;
  const remaining = Number(totals.remaining)      || 0;
  const pct       = award > 0 ? Math.min(100, (spent / award) * 100) : 0;

  setK('spent',     fmtUSD(spent));
  setK('spent_pct', `${pct.toFixed(1)}% of ${fmtUSD(award)}`);
  setK('remaining', fmtUSD(remaining));
  setK('rem_pct', 'Unreconciled - not available cash');
  setK('entries',   rows.length);

  document.getElementById('burn-bar').style.width = `${pct}%`;
  document.getElementById('burn-spent').textContent     = `${fmtUSD(spent)} tagged expenses`;
  document.getElementById('burn-remaining').textContent = `${fmtUSD(remaining)} unmatched ledger remainder`;

  const tbody = document.getElementById('fund-tbody');
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty">No fund expenses logged yet</td></tr>`; return; }
  tbody.innerHTML = rows.filter(r => r.type === 'expense').map(r => `
    <tr>
      <td class="mono meta">${new Date(r.date).toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'2-digit' })}</td>
      <td><div class="desc">${escapeHtml(r.description)}</div>${r.notes ? `<div class="meta">${escapeHtml(r.notes)}</div>` : ''}</td>
      <td class="mono meta">${(r.category || '').replace(/_/g, ' ')}</td>
      <td class="mono meta">${escapeHtml(r.merchant || '–')}</td>
      <td class="right" style="font-family:var(--f-display);font-size:12.5px;white-space:nowrap;color:var(--text-2)">-${fmtUSD(r.amount)}</td>
    </tr>`).join('');
}

function setK(k, v) { const e = document.querySelector(`[data-k="${k}"]`); if (e) e.textContent = v; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

subscribeTransactions(() => load());
await load();

// Confirmation stays in its existing private vault owner, not a public asset.
try {
 const session=await getSession();
 const response=await fetch('/api/money-overview',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
 if(response.ok){const data=await response.json();
  if(/1789 Venture Fund: fully spent; actual remaining allocation is \$0/.test(data.confirmation?.content||''))
   document.querySelector('#fund-confirmation').textContent='Fully spent: $0 remaining, confirmed by Cooper September 30. Tagged ledger coverage below still needs reconciliation.';
 }
} catch { /* Keep explicit unreconciled label; never substitute a cash value. */ }
