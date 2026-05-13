// =====================================================================
// /admin/finance/_js/export.js — generate XLSX/CSV downloads from Supabase
// SheetJS is loaded as a global from the page (xlsx.full.min.js).
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Export · Finance' });

const status = document.getElementById('status');

async function fetchAll() {
  status.textContent = 'Pulling rows…';
  const { data, error } = await sb.from('financial_transactions').select('*')
    .is('deleted_at', null).order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

function shapeBase(r) {
  return {
    Date: r.date,
    Description: r.description,
    Merchant: r.merchant || '',
    Entity: r.entity,
    Category: r.category,
    Type: r.type,
    Amount: Number(r.amount),
    Account: r.account || '',
    'Funded By': r.funded_by || '',
    'Tax Deductible': r.is_tax_deductible ? 'Y' : '',
    'Tax Category': r.tax_category || '',
    'Deductible %': r.deductible_pct ?? '',
    'CPA Review': r.cpa_review_needed ? 'Y' : '',
    'Food Log': r.is_food_log ? 'Y' : '',
    Notes: r.notes || '',
  };
}

function shapePlugverse(r) {
  return {
    Date: r.date,
    Type: r.type,
    Category: r.category,
    Description: r.description,
    Inflow:  r.type === 'income'  ? Number(r.amount) : '',
    Outflow: r.type === 'expense' ? Number(r.amount) : '',
    Vendor:  r.merchant || '',
    'Tax Deductible': r.is_tax_deductible ? 'Y' : '',
  };
}

function shapeFund(r, running) {
  return {
    Date: r.date,
    Description: r.description,
    Category: r.category,
    Vendor: r.merchant || '',
    Amount: r.type === 'expense' ? Number(r.amount) : -Number(r.amount),
    'Running balance': running,
    Notes: r.notes || '',
  };
}

function shapeFood(r) {
  return {
    Date: r.date,
    Description: r.description,
    Merchant: r.merchant || '',
    Account: r.account || '',
    Amount: Number(r.amount),
    Notes: r.notes || '',
  };
}

function shapePersonal(r) {
  return {
    Date: r.date,
    Description: r.description,
    Category: r.category,
    Account: r.account || '',
    Type: r.type,
    Amount: Number(r.amount),
    Merchant: r.merchant || '',
    Notes: r.notes || '',
  };
}

function shapeTax(r) {
  return {
    Year: new Date(r.date).getFullYear(),
    Date: r.date,
    Description: r.description,
    Entity: r.entity,
    'Tax Category': r.tax_category || '',
    'Deductible %': r.deductible_pct ?? 100,
    Gross: Number(r.amount),
    Deductible: Number(r.amount) * (Number(r.deductible_pct ?? 100) / 100),
    'CPA Review': r.cpa_review_needed ? 'Y' : '',
    'Write-off notes': r.writeoff_notes || '',
  };
}

function shapeTravelMeals(r) {
  return {
    Date: r.date,
    Description: r.description,
    'Primary Purpose': r.writeoff_notes || '',
    Merchant: r.merchant || '',
    Amount: Number(r.amount),
    'Tax Category': r.tax_category || '',
    'Deductible %': r.deductible_pct ?? 100,
    Deductible: Number(r.amount) * (Number(r.deductible_pct ?? 100) / 100),
  };
}

function downloadCSV(filename, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

document.getElementById('dl-all').addEventListener('click', async () => {
  try {
    const rows = await fetchAll();
    status.textContent = 'Building workbook…';
    const wb = XLSX.utils.book_new();

    const all = rows.map(shapeBase);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), 'All Transactions');

    const pv = rows.filter(r => r.entity === 'plugverse').map(shapePlugverse);
    if (pv.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pv), 'Plugverse Ledger');

    let running = 0;
    const fundRows = rows
      .filter(r => r.entity === '1789_fund')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => {
        running += r.type === 'income' ? +Number(r.amount) : -Number(r.amount);
        return shapeFund(r, running);
      });
    if (fundRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fundRows), '1789 Fund');

    const food = rows.filter(r => r.is_food_log).map(shapeFood);
    if (food.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(food), 'Monthly Food Log');

    const personal = rows.filter(r => r.entity === 'personal').map(shapePersonal);
    if (personal.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(personal), 'Personal Spending');

    const tax = rows.filter(r => r.is_tax_deductible).map(shapeTax);
    if (tax.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tax), 'Tax Prep');

    const travelMeals = rows.filter(r => /(travel|meal)/i.test(r.tax_category || '')).map(shapeTravelMeals);
    if (travelMeals.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(travelMeals), 'Business Travel & Meals');

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Cooper_Delo_Finances_${stamp}.xlsx`);
    status.textContent = `Downloaded · ${rows.length} rows · ${stamp}`;
    toast('Workbook downloaded');
  } catch (e) {
    console.error(e);
    status.textContent = 'Error: ' + e.message;
    toast('Export failed', 'err');
  }
});

document.getElementById('dl-food').addEventListener('click', async () => {
  const rows = (await fetchAll()).filter(r => r.is_food_log).map(shapeFood);
  downloadCSV(`food_log_${new Date().toISOString().slice(0,10)}.csv`, rows);
  toast('Food CSV downloaded');
});

document.getElementById('dl-tax').addEventListener('click', async () => {
  const rows = (await fetchAll()).filter(r => r.is_tax_deductible).map(shapeTax);
  downloadCSV(`tax_deductibles_${new Date().toISOString().slice(0,10)}.csv`, rows);
  toast('Tax CSV downloaded');
});
