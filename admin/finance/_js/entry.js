// =====================================================================
// /admin/finance/_js/entry.js — add or edit a transaction
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Add transaction · Finance' });

const params  = new URLSearchParams(location.search);
const editId  = params.get('id');
const form    = document.getElementById('tx-form');
const saveBtn = document.getElementById('save-btn');
const saveAddBtn = document.getElementById('save-add-btn');
const deleteBtn  = document.getElementById('delete-btn');
const modeH1     = document.getElementById('mode-h1');
const modeEyebrow = document.getElementById('mode-eyebrow');

// Populate accounts dropdown
{
  const { data } = await sb.from('finance_accounts').select('slug, display_name').eq('is_active', true).order('display_name');
  const sel = form.elements['account'];
  for (const a of (data || [])) {
    const opt = document.createElement('option');
    opt.value = a.slug; opt.textContent = a.display_name;
    sel.appendChild(opt);
  }
}

// Populate funding_source dropdown from the lookup table
{
  const { data } = await sb.from('funding_sources')
    .select('slug, display_name, award_amount')
    .eq('is_active', true)
    .order('sort_order');
  const sel = form.elements['funding_source'];
  for (const fs of (data || [])) {
    const opt = document.createElement('option');
    opt.value = fs.slug;
    opt.textContent = fs.award_amount != null
      ? `${fs.display_name} ($${Number(fs.award_amount).toLocaleString()})`
      : fs.display_name;
    sel.appendChild(opt);
  }
}

// Populate category datalist from existing distinct categories
{
  const { data } = await sb.from('financial_transactions').select('category').is('deleted_at', null).limit(2000);
  const cats = [...new Set((data || []).map(r => r.category).filter(Boolean))].sort();
  const dl = document.getElementById('cat-list');
  for (const c of cats) {
    const o = document.createElement('option'); o.value = c; dl.appendChild(o);
  }
}

// Default date = today
form.elements['date'].value = new Date().toISOString().slice(0,10);
form.elements['deductible_pct'].value = '100';
// Default funding source for new entries = 1789 fund (overridden on edit by the row's actual value)
if (!editId && form.elements['funding_source']) form.elements['funding_source'].value = '1789_fund';

if (editId) {
  modeH1.innerHTML = 'EDIT <span class="accent">entry</span>';
  modeEyebrow.textContent = 'Editing existing record';
  deleteBtn.style.display = 'inline-flex';

  const { data, error } = await sb.from('financial_transactions').select('*').eq('id', editId).single();
  if (error || !data) { toast('Not found', 'err'); }
  else {
    for (const [k, v] of Object.entries(data)) {
      const f = form.elements[k];
      if (!f) continue;
      if (f.type === 'checkbox') f.checked = !!v;
      else if (v != null) f.value = v;
    }
  }
}

function collect() {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    obj[k] = (v === '' ? null : v);
  }
  // Checkboxes
  obj.is_food_log        = form.elements['is_food_log'].checked;
  obj.is_tax_deductible  = form.elements['is_tax_deductible'].checked;
  obj.cpa_review_needed  = form.elements['cpa_review_needed'].checked;
  // Numbers
  obj.amount = Number(obj.amount);
  obj.deductible_pct = obj.deductible_pct ? Number(obj.deductible_pct) : 100;
  // Normalize category
  if (obj.category) obj.category = obj.category.trim().toLowerCase().replace(/\s+/g, '_');
  return obj;
}

async function save({ thenAddAnother = false } = {}) {
  saveBtn.disabled = true; saveAddBtn.disabled = true;
  const body = collect();
  let res;
  if (editId) {
    res = await sb.from('financial_transactions').update(body).eq('id', editId);
  } else {
    res = await sb.from('financial_transactions').insert(body);
  }
  saveBtn.disabled = false; saveAddBtn.disabled = false;

  if (res.error) {
    console.error(res.error);
    toast(res.error.message || 'Save failed', 'err', 4000);
    return;
  }

  toast(editId ? 'Updated' : 'Saved');
  if (thenAddAnother && !editId) {
    form.reset();
    form.elements['date'].value = new Date().toISOString().slice(0,10);
    form.elements['deductible_pct'].value = '100';
    form.elements['type'].value = 'expense';
    form.elements['entity'].value = 'personal';
    if (form.elements['funding_source']) form.elements['funding_source'].value = '1789_fund';
    form.elements['description'].focus();
  } else {
    setTimeout(() => location.href = '/admin/finance/transactions.html', 600);
  }
}

form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
saveAddBtn.addEventListener('click', () => save({ thenAddAnother: true }));

deleteBtn.addEventListener('click', async () => {
  if (!editId) return;
  if (!confirm('Soft-delete this transaction? It will be hidden from all views but remain in the database.')) return;
  const { error } = await sb.from('financial_transactions').update({ deleted_at: new Date().toISOString() }).eq('id', editId);
  if (error) { toast('Delete failed', 'err'); return; }
  toast('Deleted');
  setTimeout(() => location.href = '/admin/finance/transactions.html', 500);
});
