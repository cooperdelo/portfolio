import { sb, fmtUSD, fmtUSDCompact, fmtMonth, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast, monthsBack, monthKey } from '/admin/_shell/admin-shell.js';

import { C, MONO, applyChartTheme } from '/admin/_shell/chart-theme.js';

await mountShell({ title: 'Plugverse P&L · Finance' });
applyChartTheme();
const palette = MONO;

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
  setK('net_pct', income ? `${((net / income) * 100).toFixed(1)}% margin` : '–');
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
      { label: 'In',  data: inc, backgroundColor: C.bone },
      { label: 'Out', data: exp, backgroundColor: 'rgba(244,241,234,.26)' },
    ]},
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtUSD(c.parsed.y)}` } } },
      scales: { y: { ticks: { callback: (v) => fmtUSDCompact(v), maxTicksLimit: 5 }, grid: { color: C.grid }, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } },
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
      data: { labels: entries.map(([k]) => k.replace(/_/g, ' ')), datasets: [{ data: entries.map(([,v]) => v), backgroundColor: palette, borderColor: 'rgba(12,11,10,0.9)', borderWidth: 3, borderRadius: 6 }] },
      options: { maintainAspectRatio: false, cutout: '76%', plugins: { legend: { position: 'bottom', labels: { padding: 10 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUSD(c.parsed)}` } } } },
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
      <td class="mono meta">${escapeHtml(r.merchant || '–')}</td>
      <td><span class="pill ${r.type === 'income' ? 'income' : 'expense'}">${r.type}</span></td>
      <td class="right" style="font-family:var(--f-display);font-size:12.5px;white-space:nowrap;color:${r.type === 'income' ? 'var(--text)' : 'var(--text-3)'};">
        ${r.type === 'income' ? '+' : '-'}${fmtUSD(r.amount)}
      </td>
    </tr>`).join('');
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

subscribeTransactions(() => load());
await load();
