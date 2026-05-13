import { sb, fmtUSD, fmtUSDCompact, fmtMonth, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast, monthsBack, monthKey } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Plugverse P&L · Finance' });

const C = { rust: '#FF4D2E', sage: '#7A8A6E', crimson: '#C8102E', stage: '#6B3FA0',
            pink: '#F2C1D1', cyan: '#B2E3E1', lavender: '#C9BEE6', cream: '#F2EDE4', ink2: '#DDD4C5' };
const palette = [C.rust, C.crimson, C.stage, C.lavender, C.cyan, C.pink, C.sage, C.cream];
Chart.defaults.color = C.ink2;
Chart.defaults.font.family = '"Geist Mono", ui-monospace, monospace';

const charts = {};

async function load() {
  const { data, error } = await sb.from('financial_transactions').select('*')
    .eq('entity', 'plugverse').is('deleted_at', null).order('date', { ascending: false });
  if (error) { toast('Failed to load', 'err'); return; }
  render(data || []);
}

function sumIf(rows, pred) { return rows.reduce((a, r) => a + (pred(r) ? Number(r.amount) : 0), 0); }
function daysAgo(d) { return (Date.now() - new Date(d).getTime()) / 86400000; }
function setK(k, v) { const e = document.querySelector(`[data-k="${k}"]`); if (e) e.textContent = v; }

function render(rows) {
  const income  = sumIf(rows, r => r.type === 'income');
  const expense = sumIf(rows, r => r.type === 'expense');
  const net = income - expense;
  const burn30 = sumIf(rows, r => r.type === 'expense' && daysAgo(r.date) <= 30);

  setK('income',  fmtUSDCompact(income));
  setK('expense', fmtUSDCompact(expense));
  setK('net',     `${net >= 0 ? '+' : '−'}${fmtUSDCompact(Math.abs(net))}`);
  setK('net_pct', income ? `${((net / income) * 100).toFixed(1)}% margin` : '—');
  setK('burn',    fmtUSDCompact(burn30));
  document.querySelector('[data-k="net"]').closest('.card').querySelector('.delta').className = 'delta ' + (net >= 0 ? 'pos' : 'neg');

  // Monthly P&L
  const months = monthsBack(12);
  const labels = months.map(d => fmtMonth(d));
  const inc = months.map(d => sumIf(rows, r => r.type === 'income'  && monthKey(r.date) === monthKey(d)));
  const exp = months.map(d => sumIf(rows, r => r.type === 'expense' && monthKey(r.date) === monthKey(d)));

  const ctx1 = document.getElementById('chart-pnl').getContext('2d');
  charts.pnl?.destroy();
  charts.pnl = new Chart(ctx1, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Income',  data: inc, backgroundColor: C.sage, borderRadius: 4 },
      { label: 'Expense', data: exp, backgroundColor: C.rust, borderRadius: 4 },
    ]},
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtUSD(c.parsed.y)}` } } },
      scales: { y: { ticks: { callback: (v) => fmtUSDCompact(v) }, grid: { color: 'rgba(244,239,230,0.05)' } }, x: { grid: { display: false } } },
    },
  });

  // Categories (expense only, 90d)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const cats = {};
  for (const r of rows) {
    if (new Date(r.date) < cutoff || r.type !== 'expense') continue;
    cats[r.category || 'uncategorized'] = (cats[r.category || 'uncategorized'] || 0) + Number(r.amount);
  }
  const entries = Object.entries(cats).sort((a,b) => b[1] - a[1]).slice(0, 8);
  const ctx2 = document.getElementById('chart-cats').getContext('2d');
  charts.cats?.destroy();
  if (entries.length) {
    charts.cats = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels: entries.map(([k]) => k.replace(/_/g, ' ')), datasets: [{ data: entries.map(([,v]) => v), backgroundColor: palette, borderColor: 'rgba(10,9,8,0.6)', borderWidth: 2 }] },
      options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUSD(c.parsed)}` } } } },
    });
  }

  // Ledger table
  const tbody = document.getElementById('ledger-tbody');
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty">No entries</td></tr>`; return; }
  tbody.innerHTML = rows.slice(0, 100).map(r => `
    <tr>
      <td class="mono meta">${new Date(r.date).toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'2-digit' })}</td>
      <td><div class="desc">${escapeHtml(r.description)}</div></td>
      <td class="mono meta">${(r.category || '').replace(/_/g, ' ')}</td>
      <td class="mono meta">${escapeHtml(r.merchant || '—')}</td>
      <td><span class="pill ${r.type === 'income' ? 'income' : 'expense'}">${r.type}</span></td>
      <td class="right mono" style="color:${r.type === 'income' ? 'var(--good)' : 'var(--rust, #FF4D2E)'};">
        ${r.type === 'income' ? '+' : '−'}${fmtUSD(r.amount)}
      </td>
    </tr>`).join('');
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

subscribeTransactions(() => load());
await load();
