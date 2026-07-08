// =====================================================================
// /admin/health/_js/dashboard.js — insights over v_health_timeline
// KPIs + a simple lagged trigger signal + 30-day table.
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Insights · Health' });

const fmtSleep = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const sevColor = (s) => s == null ? 'transparent'
  : s >= 7 ? 'rgba(255,77,77,.35)' : s >= 4 ? 'rgba(255,180,60,.30)' : 'rgba(120,200,80,.25)';

const { data: rows, error } = await sb.from('v_health_timeline')
  .select('*').order('day', { ascending: false }).limit(30);

const tbody = document.getElementById('rows');
if (error) { tbody.innerHTML = `<tr><td colspan="9" class="muted">Load error: ${error.message}. (Has the schema been applied?)</td></tr>`; }
else if (!rows?.length) { tbody.innerHTML = `<tr><td colspan="9" class="muted">No data yet — start logging on the Daily Log page.</td></tr>`; }
else renderAll(rows);

function avg(arr) { const v = arr.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

function renderAll(rows) {
  const last7 = rows.slice(0, 7);
  const flareDays = rows.filter(r => r.flare || (r.symptom_severity ?? 0) >= 7).length;
  const bloodDays = rows.filter(r => r.any_blood).length;
  const avgSleep = avg(last7.map(r => r.sleep_minutes));
  const avgStress = avg(last7.map(r => r.stress_avg));
  const avgSev = avg(last7.map(r => r.symptom_severity));

  document.getElementById('kpis').innerHTML = [
    ['Avg sleep (7d)', avgSleep == null ? '—' : fmtSleep(Math.round(avgSleep))],
    ['Avg Garmin stress (7d)', avgStress == null ? '—' : Math.round(avgStress)],
    ['Avg symptom (7d)', avgSev == null ? '—' : avgSev.toFixed(1)],
    ['Flare days (30d)', flareDays],
    ['Days w/ blood (30d)', bloodDays],
  ].map(([l, n]) => `<div class="kpi"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

  // ---- simple lagged trigger signal ----
  // Compare the day-before conditions on high-symptom days vs calm days.
  const asc = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const flare = [], calm = [];
  for (let i = 1; i < asc.length; i++) {
    const d = asc[i], prev = asc[i - 1];
    const bucket = ((d.symptom_severity ?? 0) >= 6 || d.flare) ? flare : calm;
    bucket.push({
      prevStress: prev.stress_avg, prevSleep: prev.sleep_minutes,
      prevIrritants: prev.irritant_count || 0,
    });
  }
  const sig = document.getElementById('signal');
  if (flare.length < 2) {
    sig.textContent = 'Not enough flare days logged yet to spot patterns. Keep logging — the weekly analysis task will surface ranked trigger hypotheses once there’s ~2+ weeks of data.';
  } else {
    const fS = avg(flare.map(x => x.prevStress)), cS = avg(calm.map(x => x.prevStress));
    const fSl = avg(flare.map(x => x.prevSleep)), cSl = avg(calm.map(x => x.prevSleep));
    const fI = avg(flare.map(x => x.prevIrritants)), cI = avg(calm.map(x => x.prevIrritants));
    const bits = [];
    if (fS != null && cS != null) bits.push(`Day-before Garmin stress on bad days ${Math.round(fS)} vs ${Math.round(cS)} on calm days.`);
    if (fSl != null && cSl != null) bits.push(`Sleep the night before: ${fmtSleep(Math.round(fSl))} vs ${fmtSleep(Math.round(cSl))}.`);
    if (fI != null && cI != null) bits.push(`Irritants (alcohol/smoked THC) day before: ${fI.toFixed(1)} vs ${cI.toFixed(1)}.`);
    sig.innerHTML = bits.join('<br>') + '<br><span style="opacity:.55;">Directional only — the weekly task does the real correlation.</span>';
  }

  // ---- table ----
  tbody.innerHTML = rows.map(r => {
    const d = new Date(r.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    return `<tr class="${r.flare ? 'flarerow' : ''}">
      <td>${d}</td>
      <td>${fmtSleep(r.sleep_minutes)}</td>
      <td>${r.stress_avg ?? '<span class=muted>—</span>'}</td>
      <td>${r.mood ?? '<span class=muted>—</span>'}</td>
      <td><span class="sev" style="background:${sevColor(r.symptom_severity)}">${r.symptom_severity ?? '—'}</span></td>
      <td>${r.bm_count || 0}</td>
      <td>${r.worst_bristol ?? '<span class=muted>—</span>'}</td>
      <td>${r.any_blood ? '🩸' : ''}</td>
      <td>${r.irritant_count ? '⚠ ' + r.irritant_count : ''}</td>
    </tr>`;
  }).join('');
}
