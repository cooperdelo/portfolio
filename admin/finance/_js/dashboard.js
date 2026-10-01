// =====================================================================
// /admin/finance/_js/dashboard.js — Finance overview v7 (2026-09-29).
// Reads: account_balances + personal_balance_snapshots (live-data balances()),
// financial_transactions, v_fund_1789. Realtime refresh on financial_transactions.
// =====================================================================
import { sb, fmtUSD, fmtUSDCompact, fmtMonth, subscribeTransactions } from '/admin/_shell/supabase.js';
import { mountShell, toast, monthsBack, monthKey } from '/admin/_shell/admin-shell.js';
import { balances } from '/admin/_shell/live-data.js';
import { statTile, esc } from '/admin/_shell/ui.js';
import { reveal, countUp, growX } from '/admin/_shell/motion.js';
import { C, applyChartTheme, fillUnder } from '/admin/_shell/chart-theme.js';
import { cashAccounts } from '/admin/_shell/workspace-model.mjs';

await mountShell({ title: 'Finance · Overview', demo: true });
applyChartTheme();

const ACCT = { wells_fargo_checking: 'Wells Fargo checking', roth_ira: 'Roth IRA', coinbase_crypto: 'Coinbase' };
const acctName = (a) => ACCT[a] || String(a || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const dayLbl = (d) => new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
const hrsOld = (d) => (Date.now() - new Date(String(d).length === 10 ? d + 'T23:59:00' : d).getTime()) / 3.6e6;
const usd0 = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('en-US');
const $ = (id) => document.getElementById(id);
function setStat(id, o) { const el = $(id); el.className = 'stat' + (o.accent ? ' is-accent' : ''); const t = document.createElement('div'); t.innerHTML = statTile(o); el.innerHTML = t.firstElementChild.innerHTML; }

// ---------------- Balances ----------------
async function renderBalances() {
  const el = $('balances');
  let b;
  try { b = await balances(); } catch (e) { el.innerHTML = `<div class="sv-empty"><div class="e1">Couldn't load balances</div><div class="e2">${esc(e?.message || e)}</div></div>`; return; }
  const tot = (rows) => rows.reduce((a, r) => a + Number(r.balance || 0), 0);
  const asof = (rows) => rows.map(r => r.as_of).sort().pop();
  const staleChip = (d, h) => d && hrsOld(d) > h ? ' <span class="chip stale">stale</span>' : '';
  const personalCash = cashAccounts(b.personal);
  setStat('hsBiz', { k: 'PlugVerse cash', v: b.business.length ? `<span data-usd="${tot(b.business)}">$0</span>` : '–', d: b.business.length ? `${b.business.length} Mercury accounts` : 'No balance yet', src: b.business.length ? `Mercury · available · as of ${dayLbl(asof(b.business))}${staleChip(asof(b.business), 48)}` : 'Mercury' });
  setStat('hsPers', { k: 'Personal cash', v: personalCash.length ? `<span data-usd="${tot(personalCash)}">$0</span>` : '–', d: personalCash.map(r => acctName(r.account)).join(' · '), src: personalCash.length ? `Recorded balances · as of ${dayLbl(asof(personalCash))}${staleChip(asof(personalCash), 168)}` : 'No checking or savings snapshot' });
  document.querySelectorAll('#hero [data-usd]').forEach((n, i) => countUp(n, Number(n.dataset.usd), { delay: i * 90, format: usd0 }));
  const group = (title, rows, name) => rows.length ? `<div class="t-label" style="color:var(--text-3);margin:14px 0 2px">${title}</div>${rows.map(r => `<div class="bal-row"><span class="n">${esc(name(r))}</span><span class="v">${fmtUSD(r.balance)}</span></div>`).join('')}` : '';
  el.innerHTML = `<div class="sv-h" style="margin-bottom:0"><h2>Accounts</h2></div>
    ${group('PlugVerse · Mercury', b.business, r => r.account_label + (r.balance_kind && r.balance_kind !== 'available' ? ` (${r.balance_kind})` : ''))}
    ${group('Personal', b.personal, r => acctName(r.account))}`;
}
renderBalances();

const charts = {};
async function loadAll() {
  const [tx, fund] = await Promise.all([
    sb.from('financial_transactions').select('*').is('deleted_at', null).order('date', { ascending: false }),
    sb.from('v_fund_1789').select('*').single(),
  ]);
  if (tx.error) { toast('Failed to load transactions', 'err'); console.error(tx.error); return; }
  const rows = tx.data || [];
  renderKpis(rows, fund.data || { total_received: 0, total_spent: 0, remaining: 0 });
  renderFlow(rows);
  renderCategories(rows);
  renderRunway(rows);
  renderRecent(rows.slice(0, 10));
}

// ---------------- KPIs ----------------
function renderKpis(rows, fund) {
  const now = new Date(), year = now.getFullYear(), mkey = monthKey(now);
  const pv = rows.filter(r => r.entity === 'plugverse');
  const pvIncome = sumIf(pv, r => r.type === 'income'), pvExpense = sumIf(pv, r => r.type === 'expense');
  const pvNet = pvIncome - pvExpense;
  const personalMtd = sumIf(rows, r => r.entity === 'personal' && r.type === 'expense' && monthKey(r.date) === mkey);
  const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const personalPrev = sumIf(rows, r => r.entity === 'personal' && r.type === 'expense' && monthKey(r.date) === prevKey);
  const foodMtd = sumIf(rows, r => r.is_food_log === true && monthKey(r.date) === mkey);
  const deductYtd = sumIf(rows, r => r.is_tax_deductible && new Date(r.date).getFullYear() === year);
  const recent30 = rows.filter(r => daysAgo(r.date) <= 30).length;
  const newest = rows[0]?.date;
  setStat('hsPv', { k: 'PlugVerse net', v: `<span data-usd="${pvNet}">$0</span>`, d: `In ${fmtUSDCompact(pvIncome)} · out ${fmtUSDCompact(pvExpense)}`, src: `Ledger · all time${newest ? ' · as of ' + dayLbl(newest) : ''}` });
  setStat('hsMtd', { k: 'Spent this month', v: `<span data-usd="${personalMtd}">$0</span>`, d: personalPrev ? `<span class="chip ${personalMtd > personalPrev ? 'up' : 'down'}">${fmtUSDCompact(personalPrev)} last month</span>` : '', src: `Personal · card alerts + Mercury${newest ? ' · as of ' + dayLbl(newest) : ''}` });
  document.querySelectorAll('#hsPv [data-usd], #hsMtd [data-usd]').forEach((n, i) => countUp(n, Number(n.dataset.usd), { delay: i * 90, format: usd0 }));
  setK('fund_remaining', fmtUSDCompact(fund.remaining));
  setK('fund_delta', `${fmtUSD(fund.total_spent)} of $1,850 spent`);
  setK('food_mtd', fmtUSDCompact(foodMtd));
  setK('ded_ytd', fmtUSDCompact(deductYtd));
  setK('ded_delta', String(year));
  setK('tx_count', rows.length);
  setK('tx_recent', `${recent30} in 30 days`);
}
function setK(key, val) { const el = document.querySelector(`[data-k="${key}"]`); if (el) el.textContent = val; }
function sumIf(rows, pred) { return rows.reduce((acc, r) => acc + (pred(r) ? Number(r.amount) : 0), 0); }
function daysAgo(dateStr) { return (Date.now() - new Date(dateStr).getTime()) / 86400000; }

// ---------------- Charts ----------------
function renderFlow(rows) {
  const months = monthsBack(12);
  const labels = months.map(d => d.toLocaleDateString('en-US', { month: 'short' }));
  const inflow = months.map(d => sumIf(rows, r => r.type === 'income' && monthKey(r.date) === monthKey(d)));
  const outflow = months.map(d => sumIf(rows, r => r.type === 'expense' && monthKey(r.date) === monthKey(d)));
  charts.flow?.destroy();
  charts.flow = new Chart($('chart-flow').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'In', data: inflow, backgroundColor: C.bone },
      { label: 'Out', data: outflow, backgroundColor: 'rgba(244,241,234,.26)' },
    ] },
    options: chartOpts({ money: true }),
  });
  void fmtMonth;
}
// Categories as pill meters (no donut): the biggest is solid bone.
function renderCategories(rows) {
  const since = new Date(); since.setDate(since.getDate() - 90);
  const buckets = {};
  for (const r of rows) { if (new Date(r.date) < since || r.type !== 'expense') continue; const k = r.category || 'uncategorized'; buckets[k] = (buckets[k] || 0) + Number(r.amount); }
  const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = entries[0]?.[1] || 1;
  $('cats').innerHTML = entries.map(([k, v], i) => `<div class="row" style="display:block;padding:10px 0">
      <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:7px"><span class="t" style="font-weight:400;color:var(--text-2)">${esc(prettyCat(k))}</span><span class="r">${usd0(v)}</span></div>
      <div class="meter thin"><i data-growx style="--p:${(v / max * 100).toFixed(1)}%;${i ? 'opacity:.45' : ''}"></i></div></div>`).join('') || '<div class="empty">No spend in 90 days.</div>';
  growX($('cats'), { delay: 200, stagger: 70 });
}
function renderRunway(rows) {
  const pv = rows.filter(r => r.entity === 'plugverse').sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = 0;
  const points = pv.map(r => { running += (r.type === 'income' ? +Number(r.amount) : -Number(r.amount)); return { x: r.date, y: running }; });
  const ctx = $('chart-runway').getContext('2d');
  charts.runway?.destroy();
  charts.runway = new Chart(ctx, {
    type: 'line',
    data: { datasets: [{ label: 'PlugVerse · cumulative net', data: points, borderColor: C.bone, backgroundColor: fillUnder(ctx), fill: true, borderWidth: 1.6, pointHoverRadius: 4, pointHoverBackgroundColor: C.bone }] },
    options: chartOpts({ money: true, time: true, legend: false }),
  });
}
function chartOpts({ money = false, time = false, legend = true } = {}) {
  return {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: legend, position: 'top', align: 'end' },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money ? fmtUSD(c.parsed.y ?? c.parsed) : c.parsed}` } },
    },
    scales: {
      x: time ? { type: 'time', time: { unit: 'month', tooltipFormat: 'MMM yyyy' }, grid: { display: false }, border: { display: false } }
        : { grid: { display: false }, border: { display: false }, ticks: { autoSkip: true, maxRotation: 0 } },
      y: { grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => money ? fmtUSDCompact(v) : v, maxTicksLimit: 5 } },
    },
  };
}

// ---------------- Recent table ----------------
function renderRecent(rows) {
  const tbody = $('recent-tbody');
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty">No transactions yet</td></tr>`; return; }
  tbody.innerHTML = rows.map(r => `<tr>
      <td class="mono">${new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</td>
      <td><div class="desc">${esc(r.description)}</div>${r.merchant ? `<div class="meta">${esc(r.merchant)}</div>` : ''}</td>
      <td>${entityPill(r.entity)}</td>
      <td class="meta">${esc(prettyCat(r.category))}</td>
      <td class="right" style="font-family:var(--f-display);font-size:12.5px;color:${r.type === 'income' ? 'var(--text)' : 'var(--text-3)'}">${r.type === 'income' ? '+' : '-'}${fmtUSD(r.amount)}</td>
    </tr>`).join('');
}
function entityPill(e) { const map = { personal: 'personal', plugverse: 'plugverse', '1789_fund': 'fund1789' }; return `<span class="pill ${map[e] || ''}">${esc((e || '').replace('_', ' '))}</span>`; }
function prettyCat(c) { return (c || '').replace(/_/g, ' '); }

// ---------------- Realtime ----------------
const indicator = $('live-indicator');
subscribeTransactions(() => { indicator.textContent = 'Updated'; loadAll().then(() => setTimeout(() => { indicator.textContent = 'Live'; }, 1800)); });
await loadAll();
reveal(document.querySelectorAll('#hero .stat, main .grid > *'), { stagger: 60, y: 14 });
