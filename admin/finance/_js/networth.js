// =====================================================================
// /admin/finance/_js/networth.js
// Personal net-worth rollup. Auth-gated (full) via the shared admin shell.
//
// DE-DUPED: the "Liquid" section does NOT re-list Roth/brokerage/crypto —
// it pulls the live total straight from the Investments page's source
// (investment_positions + investment cash accounts in Supabase), so there
// is one source of truth. This page only OWNS what lives nowhere else:
// physical assets, liabilities, and the business rollup.
// Snapshot values below (2026-07-24) are editable for a quick what-if.
// =====================================================================
import { sb, requireFullAdminOrRedirect } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';

if (!(await requireFullAdminOrRedirect())) throw new Error('access denied');
await mountShell({ title: 'Net Worth' });

const SNAPSHOT = '2026-07-24';

const data = {
  liquid: [
    // [0] filled live from Investments; [1] checking lives nowhere else.
    { name: 'Investments — Roth · brokerage · crypto · cash', meta: 'live from the Investments page', cls: 'personal', value: 7661, include: true, locked: true },
    { name: 'Personal checking', meta: 'Wells Fargo + Truist — not tracked elsewhere; get current number', cls: 'personal', value: null, include: true },
  ],
  phys: [
    { name: 'Custom PC — i9-11900K · RTX 3070 · 32GB · 3.25TB', meta: 'pulled from machine · used-build value', cls: 'personal', value: 1100, include: true },
    { name: 'MacBook (M3)', meta: '', cls: 'personal', value: 1150, include: true },
    { name: '2× computer monitors', meta: 'est.', cls: 'personal', value: 350, include: true },
    { name: 'Studio monitors (pair)', meta: 'speakers — paid ~$200; used ~$180', cls: 'personal', value: 180, include: true },
    { name: 'Logitech wireless mouse', meta: 'est.', cls: 'personal', value: 40, include: true },
    { name: 'iPhone 17 Pro', meta: '$1,099 retail / ~$950 used', cls: 'personal', value: 1000, include: true },
    { name: 'Meta Ray-Ban glasses', meta: 'paid $480', cls: 'personal', value: 480, include: true },
    { name: 'Garmin Vivoactive 6', meta: '~$300 retail', cls: 'personal', value: 300, include: true },
    { name: 'Emporio Armani watch', meta: 'est.', cls: 'personal', value: 250, include: true },
    { name: 'Breitling watch', meta: 'replica (Thailand) — ~$0 resale', cls: 'personal', value: 0, include: true },
    { name: 'Gibson bass', meta: 'paid ~$400–500', cls: 'personal', value: 450, include: true },
    { name: 'PRS SE Custom 24', meta: 'used ~$550–700', cls: 'personal', value: 600, include: true },
    { name: 'Takamine acoustic-electric', meta: 'paid ~$600; used ~$500', cls: 'personal', value: 550, include: true },
    { name: 'Marshall DSL40CR (guitar amp)', meta: 'used ~$550–650', cls: 'personal', value: 600, include: true },
    { name: 'Fender Rumble 500 (bass amp)', meta: 'used ~$400–450', cls: 'personal', value: 425, include: true },
    { name: 'Fender Rumble 100 (bass amp)', meta: 'used ~$250–300', cls: 'personal', value: 275, include: true },
    { name: 'Line 6 Pod Go (pedalboard)', meta: 'used ~$300–350', cls: 'personal', value: 350, include: true },
    { name: 'Alesis electronic drum set', meta: 'paid ~$600 on sale; used ~$450', cls: 'personal', value: 450, include: true },
    { name: 'sE Electronics sE2200 (mic)', meta: 'used ~$180–220', cls: 'personal', value: 200, include: true },
    { name: 'Shure SM58 (mic)', meta: '', cls: 'personal', value: 100, include: true },
    { name: 'Beyerdynamic DT 770 Pro X', meta: '', cls: 'personal', value: 200, include: true },
    { name: 'Focusrite Scarlett 2i2', meta: '', cls: 'personal', value: 180, include: true },
    { name: 'DJI Mic Mini', meta: '', cls: 'personal', value: 150, include: true },
    { name: 'Variable ND filter', meta: '', cls: 'personal', value: 50, include: true },
    { name: 'tomtoc 22L bag', meta: '', cls: 'personal', value: 50, include: true },
    { name: 'Golf set — T100 irons · TSi3 driver + 3W · TM hybrid · 3× SM9 wedges · TM putter', meta: 'used: irons ~$700, TSi3 driver ~$260, TSi3 3W ~$200, hybrid ~$90, 3× SM9 ~$285, putter ~$175', cls: 'personal', value: 1710, include: true },
    { name: 'Sony A7C II kit', meta: 'PLANNED buy from the $20K — off until purchased', cls: 'plugverse', value: 3300, include: false },
    { name: 'Car / vehicle', meta: 'parent-titled — not yours', cls: 'flag', value: null, include: false },
  ],
  liab: [
    { name: 'Debt', meta: 'cards paid monthly', cls: 'personal', value: 0, include: true },
    { name: 'Tax reserve owed', meta: '~25–30% of band 1099 + $20K prize — set aside', cls: 'flag', value: null, include: true },
  ],
  biz: [
    { name: 'Luby Pitch prize', meta: 'NOT in Mercury (bal $137.48) — confirm location; taxable', cls: 'flag', value: 20000, include: true },
    { name: 'Mercury business checking', meta: 'live balance ' + SNAPSHOT, cls: 'plugverse', value: 137.48, include: true },
    { name: 'Mercury savings', meta: 'live balance', cls: 'plugverse', value: 0, include: true },
    { name: 'PlugVerse LLC equity', meta: 'book ~$0, speculative upside', cls: 'plugverse', value: 0, include: true },
    { name: 'Codebase / IP / brand / domain', meta: 'real but unvalued', cls: 'plugverse', value: 0, include: true },
  ],
};

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
    if (total > 0) {
      data.liquid[0].value = Math.round(total);
      data.liquid[0].meta = 'live from Investments · synced ' + SNAPSHOT;
    }
  } catch (_) { /* keep snapshot fallback */ }
}

function rowHTML(r, key, i) {
  const c = []; if (r.value === null) c.push('tbd'); if (!r.include) c.push('off');
  const valueCell = r.locked
    ? `<span class="locked-val">${r.value === null ? '—' : fmt(r.value)}</span> <a class="synced-tag" href="/admin/finance/investments.html">synced ↗</a>`
    : `<input type="number" step="1" data-k="${key}" data-i="${i}" value="${r.value === null ? '' : r.value}" placeholder="TBD">`;
  return `<tr class="${c.join(' ')}">
    <td class="chk"><input type="checkbox" data-k="${key}" data-i="${i}" ${r.include ? 'checked' : ''}></td>
    <td><span class="desc">${r.name}</span>${r.meta ? `<span class="meta">${r.meta}</span>` : ''}</td>
    <td><span class="pill ${r.cls}">${clsLabel[r.cls]}</span></td>
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

const sum = (k) => data[k].reduce((s, r) => s + (r.include && typeof r.value === 'number' && !isNaN(r.value) ? r.value : 0), 0);

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
  if (k === undefined) return;
  const row = e.target.closest('tr');
  if (e.target.type === 'checkbox') { data[k][i].include = e.target.checked; row.classList.toggle('off', !e.target.checked); }
  else { const v = e.target.value === '' ? null : parseFloat(e.target.value); data[k][i].value = v; row.classList.toggle('tbd', v === null); }
  recompute();
});

const stamp = document.getElementById('nw-stamp');
if (stamp) stamp.textContent = 'Snapshot · ' + SNAPSHOT;
const foot = document.getElementById('nw-foot');
if (foot) foot.innerHTML = 'Liquid is pulled live from the Investments page (one source of truth) — only personal checking is entered here. Personal net worth = liquid + owned physical − liabilities. Business (Plugverse) is tracked separately. The Sony camera is off by default (funded by the $20K). The replica Breitling counts as $0.';

await syncLiquidFromInvestments();
renderAll();

// TODO: persist physical/liabilities to Supabase (e.g. finance.net_worth_items)
// so edits survive reloads and can feed the Finance dashboard.
