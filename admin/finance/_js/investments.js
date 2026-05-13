// =====================================================================
// /admin/finance/_js/investments.js — manual position tracking
// =====================================================================
import { sb, fmtUSD, fmtUSDCompact } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Investments · Finance' });

const C = {
  ink2: '#DDD4C5', rust: '#FF4D2E', crimson: '#C8102E', stage: '#6B3FA0',
  pink: '#F2C1D1', cyan: '#B2E3E1', lavender: '#C9BEE6', sage: '#7A8A6E', cream: '#F2EDE4',
};

Chart.defaults.color = C.ink2;
Chart.defaults.font.family = '"Geist Mono", ui-monospace, monospace';
Chart.defaults.font.size = 11;

const charts = {};
const palette = [C.rust, C.crimson, C.stage, C.lavender, C.cyan, C.pink, C.sage, C.cream];

async function load() {
  const { data, error } = await sb.from('investment_positions').select('*').order('symbol');
  if (error) { toast('Failed to load positions', 'err'); return; }
  render(data || []);
}

function render(rows) {
  // KPIs
  let totalValue = 0, totalCost = 0, lastUpdate = null;
  for (const r of rows) {
    const value = Number(r.shares || 0) * Number(r.current_price || 0);
    const cost  = Number(r.shares || 0) * Number(r.cost_basis || 0);
    totalValue += value;
    totalCost  += cost;
    if (r.price_updated_at && (!lastUpdate || new Date(r.price_updated_at) > lastUpdate)) {
      lastUpdate = new Date(r.price_updated_at);
    }
  }
  const gain = totalValue - totalCost;
  setK('total_value', fmtUSDCompact(totalValue));
  setK('total_gain',  `${gain >= 0 ? '+' : ''}${fmtUSDCompact(gain)} ${totalCost ? `(${((gain/totalCost)*100).toFixed(1)}%)` : ''}`);
  const gainEl = document.querySelector('[data-k="total_gain"]');
  gainEl.className = 'delta ' + (gain >= 0 ? 'pos' : 'neg');
  setK('total_cost',  fmtUSDCompact(totalCost));
  setK('pos_count',   rows.length);
  setK('last_update', lastUpdate ? lastUpdate.toLocaleDateString() : '—');

  // Table
  const tbody = document.getElementById('pos-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">No positions yet — click "Add position"</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => {
      const value = Number(r.shares || 0) * Number(r.current_price || 0);
      const cost  = Number(r.shares || 0) * Number(r.cost_basis || 0);
      const g     = value - cost;
      const gClr  = g >= 0 ? 'var(--good)' : 'var(--rust, #FF4D2E)';
      return `
        <tr>
          <td class="mono"><strong>${escapeHtml(r.symbol)}</strong></td>
          <td>${escapeHtml(r.name || '—')}</td>
          <td class="mono meta">${escapeHtml(r.account_slug || '—')}</td>
          <td class="right mono">${Number(r.shares).toFixed(4)}</td>
          <td class="right mono">${r.current_price ? fmtUSD(r.current_price) : '—'}</td>
          <td class="right mono"><strong>${fmtUSD(value)}</strong></td>
          <td class="right mono meta">${fmtUSD(cost)}</td>
          <td class="right mono" style="color:${gClr};">${g >= 0 ? '+' : '−'}${fmtUSD(Math.abs(g))}</td>
          <td class="right">
            <button class="btn small" data-edit="${r.id}">Edit</button>
            <button class="btn small danger" data-del="${r.id}">×</button>
          </td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('button[data-del]').forEach(b =>
      b.addEventListener('click', async () => {
        if (!confirm('Delete this position?')) return;
        const { error } = await sb.from('investment_positions').delete().eq('id', b.dataset.del);
        if (error) toast('Delete failed', 'err'); else { toast('Deleted'); load(); }
      })
    );
    tbody.querySelectorAll('button[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEdit(rows.find(x => x.id === b.dataset.edit)))
    );
  }

  // Allocation by symbol
  const allocSym = rows
    .map(r => ({ k: r.symbol, v: Number(r.shares || 0) * Number(r.current_price || 0) }))
    .filter(x => x.v > 0)
    .sort((a,b) => b.v - a.v);
  drawDonut('chart-alloc', allocSym.map(x => x.k), allocSym.map(x => x.v));

  // Allocation by account
  const accMap = {};
  for (const r of rows) {
    const v = Number(r.shares || 0) * Number(r.current_price || 0);
    if (!v) continue;
    accMap[r.account_slug || 'other'] = (accMap[r.account_slug || 'other'] || 0) + v;
  }
  const accEntries = Object.entries(accMap);
  drawDonut('chart-acct', accEntries.map(([k]) => k), accEntries.map(([,v]) => v));
}

function drawDonut(id, labels, data) {
  const ctx = document.getElementById(id).getContext('2d');
  if (charts[id]) charts[id].destroy();
  if (!data.length) {
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    return;
  }
  charts[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: palette, borderColor: 'rgba(10,9,8,0.6)', borderWidth: 2 }] },
    options: {
      maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUSD(c.parsed)}` } },
      },
    },
  });
}

function setK(key, val) { const e = document.querySelector(`[data-k="${key}"]`); if (e) e.textContent = val; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// ----- Add/Edit modal -----
const modal   = document.getElementById('add-modal');
const posForm = document.getElementById('pos-form');
let editId = null;

document.getElementById('add-pos').addEventListener('click', () => { editId = null; posForm.reset(); modal.style.display = 'block'; });
document.getElementById('add-cancel').addEventListener('click', () => modal.style.display = 'none');
modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

function openEdit(row) {
  if (!row) return;
  editId = row.id;
  for (const [k, v] of Object.entries(row)) {
    const f = posForm.elements[k];
    if (f && v != null) f.value = v;
  }
  modal.style.display = 'block';
}

posForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(posForm);
  const body = {};
  for (const [k, v] of fd.entries()) body[k] = v === '' ? null : v;
  ['shares', 'cost_basis', 'current_price'].forEach(k => { if (body[k] != null) body[k] = Number(body[k]); });
  if (body.current_price != null) body.price_updated_at = new Date().toISOString();

  let res;
  if (editId) res = await sb.from('investment_positions').update(body).eq('id', editId);
  else        res = await sb.from('investment_positions').insert(body);

  if (res.error) { toast(res.error.message, 'err'); return; }
  toast(editId ? 'Updated' : 'Added');
  modal.style.display = 'none';
  load();
});

await load();
