// =====================================================================
// /admin/finance/_js/transactions.js
// =====================================================================
import { sb, fmtUSD, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Transactions · Finance' });

const state = { rows: [], filters: {} };

const tbody     = document.getElementById('tx-tbody');
const countEl   = document.getElementById('tx-count');
const totalEl   = document.getElementById('tx-total');
const liveEl    = document.getElementById('live-indicator');

const filters = {
  search:  document.getElementById('f-search'),
  entity:  document.getElementById('f-entity'),
  type:    document.getElementById('f-type'),
  range:   document.getElementById('f-range'),
  special: document.getElementById('f-special'),
};
Object.values(filters).forEach(el => el.addEventListener('input', () => render()));

async function load() {
  const { data, error } = await sb
    .from('financial_transactions')
    .select('*')
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(2000);
  if (error) { toast('Failed to load', 'err'); console.error(error); return; }
  state.rows = data || [];
  render();
}

function filterRows() {
  let rows = state.rows;
  const q = filters.search.value.trim().toLowerCase();
  if (q) rows = rows.filter(r =>
    (r.description || '').toLowerCase().includes(q) ||
    (r.merchant    || '').toLowerCase().includes(q) ||
    (r.notes       || '').toLowerCase().includes(q) ||
    (r.category    || '').toLowerCase().includes(q));
  if (filters.entity.value) rows = rows.filter(r => r.entity === filters.entity.value);
  if (filters.type.value)   rows = rows.filter(r => r.type   === filters.type.value);
  if (filters.range.value !== 'all') {
    const days = Number(filters.range.value);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    rows = rows.filter(r => new Date(r.date) >= cutoff);
  }
  const s = filters.special.value;
  if (s === 'food')   rows = rows.filter(r => r.is_food_log);
  if (s === 'deduct') rows = rows.filter(r => r.is_tax_deductible);
  if (s === 'cpa')    rows = rows.filter(r => r.cpa_review_needed);
  return rows;
}

function render() {
  const rows = filterRows();
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">No matching transactions</td></tr>`;
    countEl.textContent = '0 rows';
    totalEl.textContent = 'Total · $0';
    return;
  }
  tbody.innerHTML = rows.map(rowHTML).join('');
  const total = rows.reduce((acc, r) => acc + (r.type === 'income' ? +Number(r.amount) : -Number(r.amount)), 0);
  countEl.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
  totalEl.textContent = `Net · ${total >= 0 ? '+' : '−'}${fmtUSD(Math.abs(total))}`;

  // Wire row actions
  tbody.querySelectorAll('button[data-del]').forEach(b => {
    b.addEventListener('click', () => deleteRow(b.dataset.del));
  });
  tbody.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      location.href = `/admin/finance/entry.html?id=${tr.dataset.id}`;
    });
  });
}

function rowHTML(r) {
  const ent = entityPill(r.entity);
  const typ = `<span class="pill ${r.type === 'income' ? 'income' : 'expense'}">${r.type}</span>`;
  const sign = r.type === 'income' ? '+' : '−';
  const color = r.type === 'income' ? 'var(--good)' : 'var(--rust, #FF4D2E)';
  const tags = [
    r.is_food_log         ? '<span class="pill food">food</span>' : '',
    r.is_tax_deductible   ? '<span class="pill deduct">deduct</span>' : '',
    r.cpa_review_needed   ? '<span class="pill" style="color:#ff6b6b">cpa</span>' : '',
  ].filter(Boolean).join(' ');

  return `
    <tr data-id="${r.id}" style="cursor:pointer;">
      <td class="mono meta">${new Date(r.date).toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'2-digit' })}</td>
      <td>
        <div class="desc">${escapeHtml(r.description)}</div>
        ${r.merchant ? `<div class="meta">${escapeHtml(r.merchant)}</div>` : ''}
        ${tags ? `<div style="margin-top:0.3rem; display:flex; gap:0.3rem;">${tags}</div>` : ''}
      </td>
      <td>${ent}</td>
      <td class="mono meta">${prettyCat(r.category)}</td>
      <td class="mono meta">${prettyCat(r.account || '—')}</td>
      <td>${typ}</td>
      <td class="right mono" style="color:${color};">${sign}${fmtUSD(r.amount)}</td>
      <td class="right">
        <button class="btn small danger" data-del="${r.id}" title="Delete">×</button>
      </td>
    </tr>`;
}

async function deleteRow(id) {
  // Soft delete (sets deleted_at) — preserves audit trail
  if (!confirm('Delete this transaction? It will be removed from all views.')) return;
  const { error } = await sb.from('financial_transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('Delete failed', 'err'); console.error(error); return; }
  toast('Deleted');
  load();
}

function entityPill(e) {
  const map = { personal: 'personal', plugverse: 'plugverse', '1789_fund': 'fund1789' };
  return `<span class="pill ${map[e] || ''}">${(e || '').replace('_',' ')}</span>`;
}
function prettyCat(c) { return (c || '').replace(/_/g, ' '); }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

subscribeTransactions(() => {
  liveEl.textContent = 'Live · updated';
  load().then(() => setTimeout(() => { liveEl.textContent = 'Live'; }, 1500));
});

await load();
