// =====================================================================
// /admin/health/_js/log.js — Crohn's daily log (Bristol + check-in + intake)
// Low-friction: tap toggles, two save buttons. Writes to:
//   health_bristol (per bathroom trip)  |  health_daily (upsert per day)
//   health_intake  (meds / thc / alcohol / supplements)
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell, toast } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Daily Log · Health' });

const today = new Date().toISOString().slice(0, 10);
document.getElementById('today-str').textContent =
  new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// ---- single-select tap groups (mood/stress/energy/bristol/thc) ----
function singleSelect(containerId) {
  const box = document.getElementById(containerId);
  let val = box.querySelector('.tap.on')?.dataset.v ?? null;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.tap'); if (!b) return;
    box.querySelectorAll('.tap').forEach(t => t.classList.remove('on'));
    b.classList.add('on'); val = b.dataset.v;
  });
  return () => (val == null ? null : (isNaN(+val) ? val : +val));
}
// ---- toggle buttons ----
function toggle(id) {
  const b = document.getElementById(id);
  b.addEventListener('click', () => b.classList.toggle('on'));
  return () => b.classList.contains('on');
}
// ---- slider bind ----
function slider(id, outId) {
  const s = document.getElementById(id), o = document.getElementById(outId);
  s.addEventListener('input', () => o.textContent = s.value);
  return () => +s.value;
}

const getBristol = singleSelect('bristol');
const getMood    = singleSelect('mood');
const getStress  = singleSelect('stress');
const getEnergy  = singleSelect('energy');
const getThc     = singleSelect('thc');
const getBlood   = toggle('b-blood');
const getMucus   = toggle('b-mucus');
const getUrgency = toggle('b-urgency');
const getFlare   = toggle('flare');
const getPain    = slider('b-pain', 'b-pain-val');
const getSev     = slider('severity', 'sev-val');
const getAlc     = slider('alcohol', 'alc-val');

// med toggles
const medBud = document.getElementById('med-bud');
const medTrem = document.getElementById('med-trem');
const supZinc = document.getElementById('sup-zinc');
[medBud, medTrem, supZinc].forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));

// ---------- Save a bathroom trip ----------
document.getElementById('save-bristol').addEventListener('click', async () => {
  const bristol = getBristol();
  if (bristol == null) { toast('Tap a Bristol type first', 'err'); return; }
  const row = {
    bristol,
    blood: getBlood(), mucus: getMucus(), urgency: getUrgency(),
    pain: getPain(),
  };
  const { error } = await sb.from('health_bristol').insert(row);
  if (error) { console.error(error); toast(error.message || 'Save failed', 'err', 4000); return; }
  toast('Trip logged');
  // reset trip controls only
  document.querySelectorAll('#bristol .tap').forEach(t => t.classList.remove('on'));
  ['b-blood', 'b-mucus', 'b-urgency'].forEach(id => document.getElementById(id).classList.remove('on'));
  const p = document.getElementById('b-pain'); p.value = 0; document.getElementById('b-pain-val').textContent = '0';
});

// ---------- Save today's check-in + intake ----------
document.getElementById('save-day').addEventListener('click', async () => {
  const btn = document.getElementById('save-day'); btn.disabled = true;

  // 1) upsert daily rollup
  const daily = {
    day: today,
    mood: getMood(), stress_self: getStress(), energy: getEnergy(),
    symptom_severity: getSev(), flare: getFlare(),
    note: document.getElementById('day-note').value.trim() || null,
  };
  const { error: e1 } = await sb.from('health_daily')
    .upsert(daily, { onConflict: 'day' });

  // 2) intake rows (only insert the ones that are "on"/relevant)
  const intake = [];
  if (medBud.classList.contains('on'))
    intake.push({ kind: 'med', name: 'budesonide', detail: '9mg', taken: true });
  if (medTrem.classList.contains('on'))
    intake.push({ kind: 'med', name: 'tremfya', taken: true });
  if (supZinc.classList.contains('on'))
    intake.push({ kind: 'supplement', name: 'zinc', detail: '30mg', taken: true });
  const thc = getThc();
  if (thc && thc !== 'none')
    intake.push({ kind: 'thc', detail: thc, is_irritant: thc === 'smoked', taken: true });
  const alc = getAlc();
  if (alc > 0)
    intake.push({ kind: 'alcohol', detail: `${alc} drink(s)`, is_irritant: true, taken: true });

  let e2 = null;
  if (intake.length) {
    const res = await sb.from('health_intake').insert(intake);
    e2 = res.error;
  }

  btn.disabled = false;
  if (e1 || e2) { console.error(e1 || e2); toast((e1 || e2).message || 'Save failed', 'err', 4000); return; }
  toast('Saved ✓ nice work');
});
