import { sb, fmtUSD, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Tax Prep · Finance' });

let activeYear = new Date().getFullYear();
let rowsAll = [];

async function load() {
  const { data, error } = await sb.from('financial_transactions').select('*')
    .eq('is_tax_deductible', true).is('deleted_at', null).order('date', { ascending: false });
  if (error) { toast('Failed to load', 'err'); return; }
  rowsAll = data || [];
  populateYears();
  render();
}

function populateYears() {
  const yrs = new Set();
  for (const r of rowsAll) yrs.add(new Date(r.date).getFullYear());
  yrs.add(activeYear);
  const sorted = [...yrs].sort((a,b)=>b-a);
  const sel = document.getElementById('year-pick');
  sel.innerHTML = sorted.map(y => `<option value="${y}" ${y === activeYear ? 'selected' : ''}>${y}</option>`).join('');
  sel.onchange = () => { activeYear = Number(sel.value); render(); };
}

function render() {
  const rows = rowsAll.filter(r => new Date(r.date).getFullYear() === activeYear);
  const gross = rows.reduce((a, r) => a + Number(r.amount), 0);
  const ded = rows.reduce((a, r) => a + Number(r.amount) * (Number(r.deductible_pct ?? 100) / 100), 0);
  const cpaRows = rows.filter(r => r.cpa_review_needed);
  const cpaAmt = cpaRows.reduce((a, r) => a + Number(r.amount), 0);

  setK('ded_total',  fmtUSD(ded));
  setK('gross_total', fmtUSD(gross));
  setK('entries',    rows.length);
  setK('cpa_count',  cpaRows.length);
  setK('cpa_amt',    `${fmtUSD(cpaAmt)} at risk`);

  // Group by tax_category
  const cats = {};
  for (const r of rows) {
    const k = r.tax_category || 'uncategorized';
    if (!cats[k]) cats[k] = { count: 0, gross: 0, ded: 0 };
    cats[k].count += 1;
    cats[k].gross += Number(r.amount);
    cats[k].ded   += Number(r.amount) * (Number(r.deductible_pct ?? 100) / 100);
  }
  const catRows = Object.entries(cats).sort((a,b) => b[1].ded - a[1].ded);

  const catTbody = document.getElementById('cat-tbody');
  catTbody.innerHTML = catRows.length
    ? catRows.map(([k, v]) => `
        <tr>
          <td class="mono">${k.replace(/_/g, ' ')}</td>
          <td class="right mono">${v.count}</td>
          <td class="right mono">${fmtUSD(v.gross)}</td>
          <td class="right mono"><strong>${fmtUSD(v.ded)}</strong></td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="empty">No deductible entries this year</td></tr>`;

  // Full list
  const tbody = document.getElementById('ded-tbody');
  tbody.innerHTML = rows.length
    ? rows.map(r => {
        const pct = Number(r.deductible_pct ?? 100);
        const dedAmt = Number(r.amount) * pct / 100;
        const flags = [
          r.cpa_review_needed ? '<span class="pill" style="color:#ff6b6b">cpa</span>' : '',
          r.is_food_log       ? '<span class="pill food">food</span>' : '',
          r.entity            ? `<span class="pill ${r.entity === 'plugverse' ? 'plugverse' : (r.entity === '1789_fund' ? 'fund1789' : 'personal')}">${(r.entity || '').replace('_',' ')}</span>` : '',
        ].filter(Boolean).join(' ');
        return `
          <tr>
            <td class="mono meta">${new Date(r.date).toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'2-digit' })}</td>
            <td><div class="desc">${escapeHtml(r.description)}</div>${r.writeoff_notes ? `<div class="meta">${escapeHtml(r.writeoff_notes)}</div>` : ''}</td>
            <td class="mono meta">${(r.tax_category || '—').replace(/_/g, ' ')}</td>
            <td class="mono">${pct}%</td>
            <td class="right mono">${fmtUSD(r.amount)}</td>
            <td class="right mono"><strong>${fmtUSD(dedAmt)}</strong></td>
            <td style="display:flex; gap:0.3rem; flex-wrap:wrap;">${flags}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="7" class="empty">No deductible entries this year</td></tr>`;
}

function setK(k, v) { const e = document.querySelector(`[data-k="${k}"]`); if (e) e.textContent = v; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

subscribeTransactions(() => load());
await load();
