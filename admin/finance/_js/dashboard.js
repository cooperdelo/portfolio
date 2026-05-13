// =====================================================================
// /admin/finance/_js/dashboard.js — finance overview
// =====================================================================
import { sb, fmtUSD, fmtUSDCompact, fmtMonth, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast, monthsBack, monthKey } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Finance · Overview' });

// Brand palette (matches shell.css)
const C = {
  ink:     '#F4EFE6',
  ink2:    '#DDD4C5',
  muted:   '#6F6A60',
  rust:    '#FF4D2E',
  crimson: '#C8102E',
  stage:   '#6B3FA0',
  pink:    '#F2C1D1',
  cyan:    '#B2E3E1',
  lavender:'#C9BEE6',
  sage:    '#7A8A6E',
  cream:   '#F2EDE4',
};

// Chart.js global theme
Chart.defaults.color = C.ink2;
Chart.defaults.font.family = '"Geist Mono", ui-monospace, monospace';
Chart.defaults.font.size = 11;
Chart.defaults.borderColor = 'rgba(244,239,230,0.10)';
Chart.defaults.plugins.legend.labels.color = C.ink2;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(20,17,15,0.95)';
Chart.defaults.plugins.tooltip.titleColor = C.ink;
Chart.defaults.plugins.tooltip.bodyColor = C.ink2;
Chart.defaults.plugins.tooltip.borderColor = 'rgba(244,239,230,0.18)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

const charts = {};

async function loadAll() {
  // Pull everything we need in parallel
  const [tx, fund] = await Promise.all([
    sb.from('financial_transactions').select('*').is('deleted_at', null).order('date', { ascending: false }),
    sb.from('v_fund_1789').select('*').single(),
  ]);

  if (tx.error)   { toast('Failed to load transactions', 'err'); console.error(tx.error); return; }
  const rows = tx.data || [];
  renderKpis(rows, fund.data || { total_received: 0, total_spent: 0, remaining: 0 });
  renderFlow(rows);
  renderCategories(rows);
  renderRunway(rows);
  renderEntity(rows);
  renderRecent(rows.slice(0, 12));
}

// ---------------- KPI cards ----------------

function renderKpis(rows, fund) {
  const now  = new Date();
  const year = now.getFullYear();
  const mkey = monthKey(now);

  const pv  = rows.filter(r => r.entity === 'plugverse');
  const pvIncome  = sumIf(pv, r => r.type === 'income');
  const pvExpense = sumIf(pv, r => r.type === 'expense');
  const pvNet = pvIncome - pvExpense;

  const personalMtd = sumIf(rows, r =>
    r.entity === 'personal' && r.type === 'expense' && monthKey(r.date) === mkey
  );
  const foodMtd = sumIf(rows, r =>
    r.is_food_log === true && monthKey(r.date) === mkey
  );
  const deductYtd = sumIf(rows, r =>
    r.is_tax_deductible && new Date(r.date).getFullYear() === year
  );
  const recent30 = rows.filter(r => daysAgo(r.date) <= 30).length;

  setK('pv_net',          fmtUSDCompact(pvNet));
  setK('pv_delta',        `In ${fmtUSDCompact(pvIncome)} · Out ${fmtUSDCompact(pvExpense)}`);
  setK('fund_remaining',  fmtUSDCompact(fund.remaining));
  setK('fund_delta',      `${fmtUSD(fund.total_spent)} spent of $1,850 award`);
  setK('pers_mtd',        fmtUSDCompact(personalMtd));
  setK('pers_delta',      'This month · personal expenses');
  setK('food_mtd',        fmtUSDCompact(foodMtd));
  setK('food_delta',      'This month · for parents');
  setK('ded_ytd',         fmtUSDCompact(deductYtd));
  setK('ded_delta',       `${year} · tax deductible`);
  setK('tx_count',        rows.length);
  setK('tx_recent',       `${recent30} in last 30 days`);

  // Color the deltas
  setDelta('pv_delta', pvNet >= 0 ? 'pos' : 'neg');
}

function setK(key, val) {
  const el = document.querySelector(`[data-k="${key}"]`);
  if (el) el.textContent = val;
}
function setDelta(key, cls) {
  const el = document.querySelector(`[data-k="${key}"]`);
  if (el) el.className = 'delta ' + cls;
}
function sumIf(rows, pred) {
  return rows.reduce((acc, r) => acc + (pred(r) ? Number(r.amount) : 0), 0);
}
function daysAgo(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / 86400000;
}

// ---------------- Charts ----------------

function gradient(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  g.addColorStop(0, color + 'CC');
  g.addColorStop(1, color + '11');
  return g;
}

function renderFlow(rows) {
  const months = monthsBack(12);
  const labels = months.map(d => fmtMonth(d));
  const inflow  = months.map(d => sumIf(rows, r => r.type === 'income'  && monthKey(r.date) === monthKey(d)));
  const outflow = months.map(d => sumIf(rows, r => r.type === 'expense' && monthKey(r.date) === monthKey(d)));

  const ctx = document.getElementById('chart-flow').getContext('2d');
  charts.flow?.destroy();
  charts.flow = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income',  data: inflow,  backgroundColor: C.sage,   borderRadius: 4, borderSkipped: false },
        { label: 'Expense', data: outflow, backgroundColor: C.rust,   borderRadius: 4, borderSkipped: false },
      ],
    },
    options: chartOpts({ grid: true, money: true }),
  });
}

function renderCategories(rows) {
  const since = new Date(); since.setDate(since.getDate() - 90);
  const buckets = {};
  for (const r of rows) {
    if (new Date(r.date) < since) continue;
    if (r.type !== 'expense') continue;
    const k = r.category || 'uncategorized';
    buckets[k] = (buckets[k] || 0) + Number(r.amount);
  }
  const entries = Object.entries(buckets).sort((a,b)=>b[1]-a[1]).slice(0, 8);
  const labels  = entries.map(([k])=> prettyCat(k));
  const data    = entries.map(([,v])=> v);
  const palette = [C.rust, C.crimson, C.stage, C.lavender, C.cyan, C.pink, C.sage, C.cream];

  const ctx = document.getElementById('chart-cats').getContext('2d');
  charts.cats?.destroy();
  charts.cats = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: palette, borderColor: 'rgba(10,9,8,0.6)', borderWidth: 2 }] },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUSD(c.parsed)}` } },
      },
    },
  });
}

function renderRunway(rows) {
  const pv = rows.filter(r => r.entity === 'plugverse').sort((a,b)=> new Date(a.date) - new Date(b.date));
  let running = 0;
  const points = pv.map(r => {
    running += (r.type === 'income' ? +Number(r.amount) : -Number(r.amount));
    return { x: r.date, y: running };
  });

  const ctx = document.getElementById('chart-runway').getContext('2d');
  charts.runway?.destroy();
  charts.runway = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Plugverse · cumulative net',
        data: points,
        borderColor: C.rust,
        backgroundColor: gradient(ctx, C.rust),
        fill: true,
        tension: 0.34,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: C.rust,
      }],
    },
    options: chartOpts({ grid: true, money: true, time: true }),
  });
}

function renderEntity(rows) {
  const year = new Date().getFullYear();
  const ent = { personal: 0, plugverse: 0, '1789_fund': 0 };
  for (const r of rows) {
    if (new Date(r.date).getFullYear() !== year) continue;
    if (ent[r.entity] != null) ent[r.entity] += Number(r.amount);
  }
  const ctx = document.getElementById('chart-entity').getContext('2d');
  charts.entity?.destroy();
  charts.entity = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Personal', 'Plugverse', '1789 Fund'],
      datasets: [{
        data: [ent.personal, ent.plugverse, ent['1789_fund']],
        backgroundColor: [C.lavender, C.rust, C.cyan],
        borderColor: 'rgba(10,9,8,0.6)', borderWidth: 2,
      }],
    },
    options: {
      maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${fmtUSD(c.parsed)}` } },
      },
    },
  });
}

function chartOpts({ grid = false, money = false, time = false } = {}) {
  return {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money ? fmtUSD(c.parsed.y ?? c.parsed) : c.parsed}` } },
    },
    scales: {
      x: time
        ? { type: 'time', time: { unit: 'month', tooltipFormat: 'MMM yyyy' }, grid: { color: 'rgba(244,239,230,0.05)' } }
        : { grid: { color: 'rgba(244,239,230,0.05)' }, ticks: { autoSkip: true, maxRotation: 0 } },
      y: { grid: grid ? { color: 'rgba(244,239,230,0.05)' } : { display: false }, ticks: { callback: (v) => money ? fmtUSDCompact(v) : v } },
    },
  };
}

// ---------------- Recent table ----------------

function renderRecent(rows) {
  const tbody = document.getElementById('recent-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No transactions yet</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const ent = entityPill(r.entity);
    const typ = `<span class="pill ${r.type === 'income' ? 'income' : 'expense'}">${r.type}</span>`;
    const amtClass = r.type === 'income' ? 'pos' : 'neg';
    return `
      <tr>
        <td class="mono meta">${new Date(r.date).toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'2-digit' })}</td>
        <td>
          <div class="desc">${escapeHtml(r.description)}</div>
          ${r.merchant ? `<div class="meta">${escapeHtml(r.merchant)}</div>` : ''}
        </td>
        <td>${ent}</td>
        <td class="mono meta">${prettyCat(r.category)}</td>
        <td>${typ}</td>
        <td class="right mono" style="color:${r.type === 'income' ? C.sage : C.rust};">
          ${r.type === 'income' ? '+' : '−'}${fmtUSD(r.amount)}
        </td>
      </tr>`;
  }).join('');
}

function entityPill(e) {
  const map = { personal: 'personal', plugverse: 'plugverse', '1789_fund': 'fund1789' };
  const label = (e || '').replace('_', ' ');
  return `<span class="pill ${map[e] || ''}">${label}</span>`;
}
function prettyCat(c) { return (c || '').replace(/_/g, ' '); }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// ---------------- Realtime ----------------

const indicator = document.getElementById('live-indicator');
subscribeTransactions((payload) => {
  indicator.textContent = 'Live · updated';
  loadAll().then(() => setTimeout(() => { indicator.textContent = 'Live · syncing'; }, 1800));
});

await loadAll();
indicator.textContent = 'Live · syncing';
