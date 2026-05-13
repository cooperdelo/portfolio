import { sb, fmtUSD, fmtUSDCompact, fmtMonth, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast, monthsBack, monthKey } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Food Log · Finance' });

const C = { rust: '#FF4D2E', sage: '#7A8A6E', ink2: '#DDD4C5' };
Chart.defaults.color = C.ink2;
Chart.defaults.font.family = '"Geist Mono", ui-monospace, monospace';

let chart = null;
let rowsAll = [];
let activeMonthKey = monthKey(new Date());

async function load() {
  const { data, error } = await sb.from('financial_transactions').select('*')
    .eq('is_food_log', true).is('deleted_at', null).order('date', { ascending: false });
  if (error) { toast('Failed to load', 'err'); return; }
  rowsAll = data || [];
  populateMonthPicker();
  render();
}

function populateMonthPicker() {
  const set = new Set();
  for (const r of rowsAll) set.add(monthKey(r.date));
  const sorted = [...set].sort().reverse();
  if (!sorted.length) sorted.push(monthKey(new Date()));
  const sel = document.getElementById('month-pick');
  sel.innerHTML = sorted.map(k => `<option value="${k}" ${k === activeMonthKey ? 'selected' : ''}>${fmtMonth(new Date(k + '-01'))}</option>`).join('');
  sel.onchange = () => { activeMonthKey = sel.value; render(); };
}

function render() {
  const inMonth   = rowsAll.filter(r => monthKey(r.date) === activeMonthKey);
  const monthTotal = inMonth.reduce((a, r) => a + Number(r.amount), 0);
  const monthCount = inMonth.length;
  const monthAvg   = monthCount ? monthTotal / monthCount : 0;

  // Prior month
  const [y, m] = activeMonthKey.split('-').map(Number);
  const priorD = new Date(y, m - 2, 1);
  const priorKey = monthKey(priorD);
  const priorTotal = rowsAll.filter(r => monthKey(r.date) === priorKey).reduce((a, r) => a + Number(r.amount), 0);
  const mom = priorTotal ? ((monthTotal - priorTotal) / priorTotal) * 100 : null;

  const ytd = rowsAll.filter(r => new Date(r.date).getFullYear() === y).reduce((a, r) => a + Number(r.amount), 0);

  setK('month_total', fmtUSD(monthTotal));
  setK('month_count', `${monthCount} entr${monthCount === 1 ? 'y' : 'ies'}`);
  setK('month_avg',   fmtUSD(monthAvg));
  setK('last_month',  fmtUSD(priorTotal));
  setK('mom',         mom == null ? '—' : `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}% vs prior`);
  setK('ytd',         fmtUSD(ytd));
  const momEl = document.querySelector('[data-k="mom"]');
  if (mom != null) momEl.className = 'delta ' + (mom >= 0 ? 'neg' : 'pos');

  // 12-month chart
  const months = monthsBack(12);
  const labels = months.map(d => fmtMonth(d));
  const data = months.map(d => rowsAll.filter(r => monthKey(r.date) === monthKey(d)).reduce((a, r) => a + Number(r.amount), 0));
  const ctx = document.getElementById('chart-food').getContext('2d');
  chart?.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Food spend', data, backgroundColor: C.rust, borderRadius: 4 }] },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${fmtUSD(c.parsed.y)}` } } },
      scales: { y: { ticks: { callback: (v) => fmtUSDCompact(v) }, grid: { color: 'rgba(244,239,230,0.05)' } }, x: { grid: { display: false } } },
    },
  });

  // Entries table for selected month
  const tbody = document.getElementById('food-tbody');
  if (!inMonth.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty">No food entries this month</td></tr>`; return; }
  tbody.innerHTML = inMonth.map(r => `
    <tr>
      <td class="mono meta">${new Date(r.date).toLocaleDateString('en-US', { month:'short', day:'2-digit' })}</td>
      <td><div class="desc">${escapeHtml(r.description)}</div></td>
      <td class="mono meta">${escapeHtml(r.merchant || '—')}</td>
      <td class="mono meta">${escapeHtml(r.account || '—')}</td>
      <td class="right mono">${fmtUSD(r.amount)}</td>
    </tr>`).join('');
}

document.getElementById('copy-summary').addEventListener('click', async () => {
  const inMonth = rowsAll.filter(r => monthKey(r.date) === activeMonthKey);
  const total = inMonth.reduce((a, r) => a + Number(r.amount), 0);
  const monthLabel = fmtMonth(new Date(activeMonthKey + '-01'));
  const lines = [
    `Food log · ${monthLabel}`,
    `Total: ${fmtUSD(total)} across ${inMonth.length} entries`,
    '',
    ...inMonth.map(r => `${new Date(r.date).toLocaleDateString()} · ${r.description}${r.merchant ? ` (${r.merchant})` : ''} — ${fmtUSD(r.amount)}`),
  ];
  await navigator.clipboard.writeText(lines.join('\n'));
  toast('Summary copied');
});

function setK(k, v) { const e = document.querySelector(`[data-k="${k}"]`); if (e) e.textContent = v; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

subscribeTransactions(() => load());
await load();
