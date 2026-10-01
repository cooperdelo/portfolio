// =====================================================================
// /admin/finance/_js/networth.js
// Personal net-worth rollup. Auth-gated (full) via the shared admin shell.
//
// DE-DUPED: the "Liquid" section does NOT re-list Roth/brokerage/crypto –
// it pulls the live total straight from the Investments page's source
// (investment_positions + investment cash accounts in Supabase), so there
// is one source of truth. This page only OWNS what lives nowhere else:
// physical assets, liabilities, and the business rollup.
// Snapshot values below (2026-07-24) are editable for a quick what-if.
// =====================================================================
import { sb, requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { esc } from '/admin/_shell/ui.js';
import { mountShell } from '/admin/_shell/admin-shell.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('access denied');
await mountShell({ title: 'Net Worth' });

const SNAPSHOT = '2026-07-24';

// Historical valuations are private vault data, never embedded in public assets.
let data;
try {
 const result=await sb.from('vault_documents').select('content').eq('path','Projects/admin/NET-WORTH-HISTORICAL-SNAPSHOT.json').single();
 if(result.error)throw result.error;
 const snapshot=JSON.parse(result.data.content);
 data=snapshot.data;
 for(const key of ['liquid','phys','liab','biz']){
  if(!Array.isArray(data[key])||data[key].some(r=>typeof r.name!=='string'||(r.value!==null&&!Number.isFinite(r.value))))throw Error('Invalid historical source');
 }
} catch {
 document.querySelector('main').innerHTML='<h1>Historical valuation unavailable</h1><p>The private source could not be loaded. No fallback financial figures are shown.</p><a href="/admin/finance/">Return to Money</a>';
 throw Error('Private valuation unavailable');
}

const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const clsLabel = { personal: 'Personal', plugverse: 'Plugverse', flag: 'Review' };

// Pull the liquid investable total from the SAME source the Investments page uses.
async function syncLiquidFromInvestments() {
  try {
    const [posRes, acctRes] = await Promise.all([
      sb.from('investment_positions').select('shares,current_price'),
      sb.from('finance_accounts').select('cash_balance').eq('account_type', 'investment'),
    ]);
    if (posRes.error || acctRes.error) return;
    let total = 0;
    (posRes.data || []).forEach(r => { total += Number(r.shares || 0) * Number(r.current_price || 0); });
    (acctRes.data || []).forEach(a => { total += Number(a.cash_balance || 0); });
    if (Number.isFinite(total)) {
      data.liquid[0].value = Math.round(total);
      data.liquid[0].meta = 'Investments page · live';
    }
  } catch (_) { /* keep snapshot fallback */ }
}

function rowHTML(r, key, i) {
  const c = []; if (r.value === null) c.push('tbd'); if (!r.include) c.push('off');
  const valueCell = r.historical ? `<span class="locked-val">${fmt(r.value)}</span> <span class="synced-tag">historical - excluded</span>` : r.locked
    ? `<span class="locked-val">${r.value === null ? '–' : fmt(r.value)}</span> <a class="synced-tag" href="/admin/finance/investments.html">synced ↗</a>`
    : `<input type="number" step="1" data-k="${key}" data-i="${i}" value="${r.value === null ? '' : r.value}" placeholder="TBD">`;
  return `<tr class="${c.join(' ')}">
    <td class="chk"><input type="checkbox" data-k="${key}" data-i="${i}" ${r.include ? 'checked' : ''} ${r.historical ? 'disabled' : ''}></td>
    <td><span class="desc">${esc(r.name)}</span>${r.meta ? `<span class="meta">${esc(r.meta)}</span>` : ''}</td>
    <td><span class="pill ${esc(r.cls)}">${clsLabel[r.cls]}</span></td>
    <td class="right">${valueCell}</td>
  </tr>`;
}

function renderAll() {
  for (const key of ['liquid', 'phys', 'liab', 'biz']) {
    const body = document.querySelector(`[data-body="${key}"]`);
    if (body) body.innerHTML = data[key].map((r, i) => rowHTML(r, key, i)).join('');
  }
  recompute();
}

const sum = (k) => data[k].reduce((s, r) => s + (!r.historical && r.include && typeof r.value === 'number' && !isNaN(r.value) ? r.value : 0), 0);

function recompute() {
  const liq = sum('liquid'), phys = sum('phys'), liab = sum('liab'), biz = sum('biz');
  const net = liq + phys - liab;
  const set = (k, v) => { const el = document.querySelector(`[data-k="${k}"]`); if (el) el.textContent = v; };
  set('net', fmt(net)); set('liq', fmt(liq)); set('phys', fmt(phys)); set('biz', fmt(biz));
  const setS = (k, v) => { const el = document.querySelector(`[data-s="${k}"]`); if (el) el.textContent = v; };
  setS('liquid', fmt(liq)); setS('phys', fmt(phys)); setS('liab', '− ' + fmt(liab)); setS('biz', fmt(biz));
}

document.addEventListener('input', (e) => {
  const k = e.target.dataset.k, i = e.target.dataset.i;
  if (k === undefined || i === undefined || !data[k]?.[i] || data[k][i].historical) return;
  const row = e.target.closest('tr');
  if (e.target.type === 'checkbox') { data[k][i].include = e.target.checked; row.classList.toggle('off', !e.target.checked); }
  else { const v = e.target.value === '' ? null : parseFloat(e.target.value); data[k][i].value = v; row.classList.toggle('tbd', v === null); }
  recompute();
});

const stamp = document.getElementById('nw-stamp');
if (stamp) stamp.textContent = 'Physical hand-valued ' + SNAPSHOT;
const foot = document.getElementById('nw-foot');
if (foot) foot.textContent = 'Liquid: Investments page + balance feeds · physical: hand-valued ' + SNAPSHOT;

// 2026-09-28 stale sweep: the Mercury rows were a hand-typed Jul 24 figure ($137.48)
// shown as "live". They now read the automatic balance feeds (Mercury API ->
// account_balances; money-watch -> personal_balance_snapshots) with their own dates.
async function syncBalances() {
  try {
    const { balances } = await import('/admin/_shell/live-data.js');
    const b = await balances();
    const pick = (re) => b.business.find(r => re.test(r.account_label || ''));
    const chk = pick(/checking/i), sav = pick(/saving/i);
    const d = (x) => new Date(String(x).length===10?x+'T12:00':x).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (chk) { data.biz[1].value = Number(chk.balance); data.biz[1].meta = `Mercury API · as of ${d(chk.as_of)}`; }
    if (sav) { data.biz[2].value = Number(sav.balance); data.biz[2].meta = `Mercury API · as of ${d(sav.as_of)}`; }
    data.biz[0].include = false;
    const personal = b.personal.filter(r => /check/i.test(r.account || '') && r.balance != null);
    if (personal.length) {
      data.liquid[1].value = Math.round(personal.reduce((a, r) => a + Number(r.balance), 0));
      data.liquid[1].meta = personal.map(r => `${String(r.account || '').replace(/_/g, ' ')} · as of ${d(String(r.as_of).slice(0, 10))}`).join(' · ') + ' · email alerts';
    }
  } catch (_) { /* leave rows as-is; the stamp below still says snapshot */ }
}

await Promise.all([syncLiquidFromInvestments(), syncBalances()]);
renderAll();

// TODO: persist physical/liabilities to Supabase (e.g. finance.net_worth_items)
// so edits survive reloads and can feed the Finance dashboard.
