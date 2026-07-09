// =====================================================================
// /admin/health/_js/food.js — photo + caption food logging
// Uploads photo to Storage bucket 'health-food-photos', inserts a
// health_food_log row (status='pending'). The food-photo-analysis
// scheduled task (Claude vision + local USDA DB) fills macros later.
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Food Log · Health' });

const BUCKET = 'health-food-photos';

// ---- selected day (defaults to today; can log/view any past day) ----
const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local (ET)
let day = todayStr();
// occurred_at at noon ET for past days (round-trips the generated `day` column)
const tsFor = () => (day === todayStr() ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString());
const dInput = document.getElementById('d-input');
function syncDate() {
  dInput.value = day; dInput.max = todayStr();
  document.getElementById('d-next').disabled = day >= todayStr();
  document.getElementById('list-day').textContent = day === todayStr() ? 'Today'
    : new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function shiftDay(n) { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); day = d.toLocaleDateString('en-CA'); syncDate(); loadToday(); }
document.getElementById('d-prev').addEventListener('click', () => shiftDay(-1));
document.getElementById('d-next').addEventListener('click', () => { if (day < todayStr()) shiftDay(1); });
document.getElementById('d-today').addEventListener('click', () => { day = todayStr(); syncDate(); loadToday(); });
dInput.addEventListener('change', () => { if (dInput.value) { day = dInput.value; syncDate(); loadToday(); } });

const fileInput = document.getElementById('photo');
const preview   = document.getElementById('preview');
const dropText  = document.getElementById('drop-text');
const drop      = document.getElementById('drop');
const captionEl = document.getElementById('caption');
let picked = null;

fileInput.addEventListener('change', () => {
  picked = fileInput.files?.[0] || null;
  if (!picked) return;
  preview.src = URL.createObjectURL(picked);
  preview.style.display = 'block';
  dropText.textContent = picked.name;
  drop.classList.add('hasimg');
});

async function saveEntry({ withPhoto }) {
  const caption = captionEl.value.trim();
  if (!caption) { toast('Add a caption', 'err'); return; }
  if (withPhoto && !picked) { toast('Pick a photo (or use caption-only)', 'err'); return; }

  const btnP = document.getElementById('save-photo');
  const btnT = document.getElementById('save-text');
  btnP.disabled = btnT.disabled = true;

  let photo_path = null;
  if (withPhoto && picked) {
    const ext = (picked.name.split('.').pop() || 'jpg').toLowerCase();
    photo_path = `${day}/${Date.now()}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(photo_path, picked, {
      cacheControl: '3600', upsert: false, contentType: picked.type || 'image/jpeg',
    });
    if (up.error) { console.error(up.error); toast('Upload failed: ' + up.error.message, 'err', 4000);
      btnP.disabled = btnT.disabled = false; return; }
  }

  const { error } = await sb.from('health_food_log').insert({
    photo_path, caption, occurred_at: tsFor(),
    status: withPhoto ? 'pending' : 'manual',
  });
  btnP.disabled = btnT.disabled = false;
  if (error) { console.error(error); toast(error.message || 'Save failed', 'err', 4000); return; }

  toast('Logged ✓');
  // reset
  picked = null; fileInput.value = ''; captionEl.value = '';
  preview.style.display = 'none'; drop.classList.remove('hasimg');
  dropText.textContent = '📷 Tap to take / choose a photo';
  loadToday();
}

document.getElementById('save-photo').addEventListener('click', () => saveEntry({ withPhoto: true }));
document.getElementById('save-text').addEventListener('click',  () => saveEntry({ withPhoto: false }));

// ---------- today's entries ----------
async function signedUrl(path) {
  if (!path) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

async function loadToday() {
  const list = document.getElementById('list');
  const { data, error } = await sb.from('health_food_log')
    .select('*').eq('day', day).order('occurred_at', { ascending: false });
  if (error) { list.innerHTML = `<p class="sublabel">Couldn't load (${error.message})</p>`; return; }
  if (!data?.length) { list.innerHTML = `<p class="sublabel" style="opacity:.6;">Nothing logged yet today.</p>`; return; }

  const rows = await Promise.all(data.map(async (r) => {
    const url = await signedUrl(r.photo_path);
    const t = new Date(r.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const macros = r.status === 'analyzed'
      ? `<div class="macros">${r.calories ?? '?'} cal · ${r.protein_g ?? '?'}p / ${r.carbs_g ?? '?'}c / ${r.fat_g ?? '?'}f${r.flagged_irritants?.length ? ' · ⚠ ' + r.flagged_irritants.join(', ') : ''}</div>`
      : '';
    return `<div class="entry">
      ${url ? `<img src="${url}" alt="">` : '<div class="entry" style="width:56px;height:56px;border-radius:9px;background:#222;"></div>'}
      <div style="flex:1 1 auto;">
        <div style="display:flex;justify-content:space-between;gap:.5rem;">
          <b>${r.caption}</b><span class="pill ${r.status}">${r.status}</span>
        </div>
        <div class="macros" style="opacity:.5;">${t}</div>
        ${macros}
      </div></div>`;
  }));
  list.innerHTML = rows.join('');
}

syncDate();
loadToday();
