// =====================================================================
// /admin/health/_js/log.js — Crohn's DAY EDITOR
// Pick any date → load everything logged that day → add/edit/delete:
//   • check-in (health_daily, upsert per day)   • intake (health_intake)
//   • multiple bathroom trips (health_bristol)   • multiple meals (health_food_log)
// Built for night batch-logging: shoot photos through the day, log it all here.
// NOTE: bristol/food/intake `day` is a GENERATED column from occurred_at
// (America/New_York), so we set occurred_at — never `day` — for past days.
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Daily Log · Health' });

const BUCKET = 'health-food-photos';
const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local (ET) tz
let day = todayStr();

// occurred_at for the selected day at a wall-clock time (browser tz = ET, which
// round-trips through the DB's America/New_York generated `day`).
function tsFor(timeStr) {
  if (timeStr) return new Date(`${day}T${timeStr}:00`).toISOString();
  if (day === todayStr()) return new Date().toISOString();
  return new Date(`${day}T12:00:00`).toISOString();
}
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtSleep = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const $ = (id) => document.getElementById(id);

// ---------------- reusable controls (get + set) ----------------
function tapGroup(id) {
  const box = $(id);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.tap'); if (!b) return;
    box.querySelectorAll('.tap').forEach(t => t.classList.remove('on'));
    b.classList.add('on');
  });
  return {
    get() { const v = box.querySelector('.tap.on')?.dataset.v; return v == null ? null : (isNaN(+v) ? v : +v); },
    set(v) { box.querySelectorAll('.tap').forEach(t => t.classList.toggle('on', v != null && String(t.dataset.v) === String(v))); }
  };
}
function toggleBtn(id) {
  const b = $(id);
  b.addEventListener('click', () => b.classList.toggle('on'));
  return { get: () => b.classList.contains('on'), set: (v) => b.classList.toggle('on', !!v) };
}
function sliderBind(id, outId) {
  const s = $(id), o = $(outId);
  s.addEventListener('input', () => o.textContent = s.value);
  return { get: () => +s.value, set: (v) => { s.value = v ?? 0; o.textContent = s.value; } };
}

const mood = tapGroup('mood'), stress = tapGroup('stress'), energy = tapGroup('energy'), thc = tapGroup('thc');
const bristol = tapGroup('bristol');
const blood = toggleBtn('b-blood'), mucus = toggleBtn('b-mucus'), urgency = toggleBtn('b-urgency');
const flare = toggleBtn('flare');
const bPain = sliderBind('b-pain', 'b-pain-val'), sev = sliderBind('severity', 'sev-val'), alc = sliderBind('alcohol', 'alc-val');
const medBud = $('med-bud'), medTrem = $('med-trem'), supZinc = $('sup-zinc');
[medBud, medTrem, supZinc].forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));

// ---------------- date navigation ----------------
const dInput = $('d-input');
function shiftDay(delta) { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + delta); day = d.toLocaleDateString('en-CA'); syncDateUI(); loadDay(); }
function syncDateUI() {
  dInput.value = day; dInput.max = todayStr();
  $('today-str').textContent = new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  $('d-next').disabled = day >= todayStr();
}
$('d-prev').addEventListener('click', () => shiftDay(-1));
$('d-next').addEventListener('click', () => { if (day < todayStr()) shiftDay(1); });
$('d-today').addEventListener('click', () => { day = todayStr(); syncDateUI(); loadDay(); });
dInput.addEventListener('change', () => { if (dInput.value) { day = dInput.value; syncDateUI(); loadDay(); } });

// ---------------- load a day ----------------
async function signedUrl(path) {
  if (!path) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

async function loadDay() {
  const badge = $('loaded-badge'); badge.classList.remove('show');
  const [d, tr, ml, ik] = await Promise.all([
    sb.from('health_daily').select('*').eq('day', day).maybeSingle(),
    sb.from('health_bristol').select('*').eq('day', day).order('occurred_at', { ascending: true }),
    sb.from('health_food_log').select('*').eq('day', day).order('occurred_at', { ascending: true }),
    sb.from('health_intake').select('*').eq('day', day),
  ]);

  // ---- check-in + garmin ----
  const row = d.data || {};
  mood.set(row.mood); stress.set(row.stress_self); energy.set(row.energy);
  sev.set(row.symptom_severity ?? 0); flare.set(row.flare); $('day-note').value = row.note || '';
  renderGarmin(row);

  // ---- intake ----
  const intake = ik.data || [];
  const has = (k, n) => intake.some(r => r.kind === k && (n == null || r.name === n));
  medBud.classList.toggle('on', has('med', 'budesonide'));
  medTrem.classList.toggle('on', has('med', 'tremfya'));
  supZinc.classList.toggle('on', has('supplement', 'zinc'));
  const thcRow = intake.find(r => r.kind === 'thc'); thc.set(thcRow ? thcRow.detail : 'none');
  const alcRow = intake.find(r => r.kind === 'alcohol'); alc.set(alcRow ? (parseInt(alcRow.detail) || 0) : 0);

  // ---- lists ----
  renderTrips(tr.data || []);
  await renderMeals(ml.data || []);

  const n = (tr.data?.length || 0) + (ml.data?.length || 0) + (d.data ? 1 : 0) + intake.length;
  if (n) { badge.textContent = `loaded · ${n} item${n > 1 ? 's' : ''}`; badge.classList.add('show'); }
}

function renderGarmin(row) {
  const box = $('gstats'), sync = $('garmin-sync');
  const stats = [
    ['Sleep', fmtSleep(row.sleep_minutes), row.sleep_minutes], ['Sleep score', row.sleep_score, row.sleep_score],
    ['Stress', row.stress_avg, row.stress_avg], ['Body batt', row.body_battery_high != null ? `${row.body_battery_low ?? '?'}–${row.body_battery_high}` : null, row.body_battery_high],
    ['HRV', row.hrv_ms != null ? `${row.hrv_ms}ms` : null, row.hrv_ms], ['Rest HR', row.resting_hr, row.resting_hr],
    ['Steps', row.steps != null ? row.steps.toLocaleString() : null, row.steps], ['Active cal', row.active_calories, row.active_calories],
  ].filter(s => s[2] != null);
  if (!stats.length) { box.innerHTML = `<div class="empty">No Garmin data for this day yet.</div>`; sync.textContent = 'not synced'; return; }
  box.innerHTML = stats.map(([l, v]) => `<div class="gstat"><div class="n">${v}</div><div class="l">${l}</div></div>`).join('');
  sync.textContent = row.garmin_synced_at ? `synced ${fmtTime(row.garmin_synced_at)}` : '';
}

// ---------------- bathroom trips ----------------
function renderTrips(trips) {
  $('trip-count').textContent = trips.length ? `${trips.length} today` : '';
  const list = $('trip-list');
  if (!trips.length) { list.innerHTML = `<div class="empty">No trips logged this day.</div>`; return; }
  list.innerHTML = trips.map(t => {
    const flags = [t.blood && 'blood', t.mucus && 'mucus', t.urgency && 'urgency', t.pain ? `pain ${t.pain}` : null].filter(Boolean);
    const loose = t.bristol >= 6;
    return `<div class="entry">
      <span class="btype" style="${loose ? 'background:rgba(255,107,77,.25);color:#ff9b7d' : ''}">${t.bristol}</span>
      <div class="body"><b>Bristol ${t.bristol}</b>
        <div class="meta">${fmtTime(t.occurred_at)}${flags.length ? ' · ' + flags.join(' · ') : ''}</div></div>
      <button class="del" data-del-trip="${t.id}" title="Delete">&times;</button>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-del-trip]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this trip?')) return;
    const { error } = await sb.from('health_bristol').delete().eq('id', b.dataset.delTrip);
    if (error) return toast(error.message, 'err');
    toast('Deleted'); loadDay();
  }));
}

$('save-bristol').addEventListener('click', async () => {
  const b = bristol.get();
  if (b == null) { toast('Tap a Bristol type first', 'err'); return; }
  const btn = $('save-bristol'); btn.disabled = true;
  const { error } = await sb.from('health_bristol').insert({
    occurred_at: tsFor($('b-time').value), bristol: b,
    blood: blood.get(), mucus: mucus.get(), urgency: urgency.get(), pain: bPain.get(),
  });
  btn.disabled = false;
  if (error) { console.error(error); return toast(error.message || 'Save failed', 'err', 4000); }
  toast('Trip added ✓');
  bristol.set(null); blood.set(false); mucus.set(false); urgency.set(false); bPain.set(0); $('b-time').value = '';
  loadDay();
});

// ---------------- meals ----------------
let mealFiles = [];
$('mealphoto').addEventListener('change', (e) => {
  mealFiles = Array.from(e.target.files || []);
  const thumbs = $('mealthumbs');
  thumbs.innerHTML = mealFiles.map(f => `<img src="${URL.createObjectURL(f)}" alt="">`).join('');
  $('drop-text').textContent = mealFiles.length ? `${mealFiles.length} photo${mealFiles.length > 1 ? 's' : ''} ready` : '📷 Tap to add meal photo(s)';
});

async function renderMeals(meals) {
  $('meal-count').textContent = meals.length ? `${meals.length} today` : '';
  const list = $('meal-list');
  if (!meals.length) { list.innerHTML = `<div class="empty">No meals logged this day.</div>`; return; }
  const rows = await Promise.all(meals.map(async (m) => {
    const url = await signedUrl(m.photo_path);
    const macros = m.status === 'analyzed'
      ? `<div class="meta">${m.calories ?? '?'} cal · ${m.protein_g ?? '?'}p/${m.carbs_g ?? '?'}c/${m.fat_g ?? '?'}f${m.flagged_irritants?.length ? ' · ⚠ ' + m.flagged_irritants.join(', ') : ''}</div>` : '';
    return `<div class="entry">
      ${url ? `<img src="${url}" alt="">` : `<div class="entry" style="width:52px;height:52px;background:#222;"></div>`}
      <div class="body">
        <b data-edit-meal="${m.id}" style="cursor:pointer;" title="Tap to edit">${m.caption || '(no caption)'}</b>
        <span class="pill ${m.status}" style="margin-left:.4rem;">${m.status}</span>
        <div class="meta">${fmtTime(m.occurred_at)}</div>${macros}
      </div>
      <button class="del" data-del-meal="${m.id}" title="Delete">&times;</button>
    </div>`;
  }));
  list.innerHTML = rows.join('');
  list.querySelectorAll('[data-del-meal]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this meal?')) return;
    const { error } = await sb.from('health_food_log').delete().eq('id', b.dataset.delMeal);
    if (error) return toast(error.message, 'err');
    toast('Deleted'); loadDay();
  }));
  list.querySelectorAll('[data-edit-meal]').forEach(el => el.addEventListener('click', async () => {
    const next = prompt('Edit caption:', el.textContent === '(no caption)' ? '' : el.textContent);
    if (next == null) return;
    const { error } = await sb.from('health_food_log').update({ caption: next.trim() }).eq('id', el.dataset.editMeal);
    if (error) return toast(error.message, 'err');
    toast('Updated'); loadDay();
  }));
}

$('save-meal').addEventListener('click', async () => {
  const caption = $('mealcap').value.trim();
  if (!mealFiles.length && !caption) { toast('Add a photo or a caption', 'err'); return; }
  const btn = $('save-meal'); btn.disabled = true;
  const occurred_at = tsFor($('meal-time').value);
  try {
    if (mealFiles.length) {
      for (let i = 0; i < mealFiles.length; i++) {
        const f = mealFiles[i];
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${day}/${Date.now()}-${i}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'image/jpeg' });
        if (up.error) throw up.error;
        // stagger timestamps a few minutes so order is stable
        const ts = new Date(new Date(occurred_at).getTime() + i * 60000).toISOString();
        const ins = await sb.from('health_food_log').insert({ occurred_at: ts, photo_path: path, caption: caption || null, status: 'pending' });
        if (ins.error) throw ins.error;
      }
    } else {
      const ins = await sb.from('health_food_log').insert({ occurred_at, caption, status: 'manual' });
      if (ins.error) throw ins.error;
    }
    toast(`Added ${mealFiles.length || 1} meal${(mealFiles.length || 1) > 1 ? 's' : ''} ✓`);
    mealFiles = []; $('mealphoto').value = ''; $('mealcap').value = ''; $('mealthumbs').innerHTML = '';
    $('drop-text').textContent = '📷 Tap to add meal photo(s)'; $('meal-time').value = '';
    loadDay();
  } catch (err) { console.error(err); toast(err.message || 'Save failed', 'err', 4000); }
  btn.disabled = false;
});

// ---------------- check-in ----------------
$('save-checkin').addEventListener('click', async () => {
  const btn = $('save-checkin'); btn.disabled = true;
  const { error } = await sb.from('health_daily').upsert({
    day, mood: mood.get(), stress_self: stress.get(), energy: energy.get(),
    symptom_severity: sev.get(), flare: flare.get(),
    note: $('day-note').value.trim() || null, updated_at: new Date().toISOString(),
  }, { onConflict: 'day' });
  btn.disabled = false;
  if (error) { console.error(error); return toast(error.message || 'Save failed', 'err', 4000); }
  toast('Check-in saved ✓');
});

// ---------------- intake (idempotent: clear the day + re-insert) ----------------
$('save-intake').addEventListener('click', async () => {
  const btn = $('save-intake'); btn.disabled = true;
  const rows = [];
  const at = tsFor('');
  if (medBud.classList.contains('on')) rows.push({ occurred_at: at, kind: 'med', name: 'budesonide', detail: '9mg', taken: true });
  if (medTrem.classList.contains('on')) rows.push({ occurred_at: at, kind: 'med', name: 'tremfya', taken: true });
  if (supZinc.classList.contains('on')) rows.push({ occurred_at: at, kind: 'supplement', name: 'zinc', detail: '30mg', taken: true });
  const t = thc.get();
  if (t && t !== 'none') rows.push({ occurred_at: at, kind: 'thc', detail: t, is_irritant: t === 'smoked', taken: true });
  const a = alc.get();
  if (a > 0) rows.push({ occurred_at: at, kind: 'alcohol', detail: `${a} drink(s)`, is_irritant: true, taken: true });

  const del = await sb.from('health_intake').delete().eq('day', day);
  if (del.error) { btn.disabled = false; console.error(del.error); return toast(del.error.message, 'err', 4000); }
  if (rows.length) {
    const ins = await sb.from('health_intake').insert(rows);
    if (ins.error) { btn.disabled = false; console.error(ins.error); return toast(ins.error.message, 'err', 4000); }
  }
  btn.disabled = false;
  toast('Intake saved ✓');
});

// ---------------- go ----------------
$('meal-time').value = '';
syncDateUI();
loadDay();
