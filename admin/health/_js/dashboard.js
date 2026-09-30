// =====================================================================
// /admin/health/_js/dashboard.js, insights over the Crohn's tracker
// Adds an auto-computed Harvey-Bradshaw Index (HBI) proxy + actionable
// insight cards, all from data already logged (zero added friction).
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';
import { icon } from '/admin/_shell/icons.js';
import { statTile, pillBars, sparkline } from '/admin/_shell/ui.js';
import { reveal, growPills, drawOn } from '/admin/_shell/motion.js';

await mountShell({ title: 'Health', demo: true });
document.getElementById('logBtn')?.insertAdjacentHTML('afterbegin', icon('plus', { size: 14 }));

const fmtSleep = (m) => (m == null ? '–' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const sevClass = (s) => s == null ? '' : s >= 7 ? 's3' : s >= 4 ? 's2' : 's1';
const avg = (a) => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };

// ---- pull data ----
const [tl, br, wko] = await Promise.all([
  sb.from('v_health_timeline').select('*').order('day', { ascending: false }).limit(45),
  sb.from('health_bristol').select('day,bristol,blood').order('day', { ascending: false }).limit(600),
  sb.from('health_workout').select('*').order('start_time', { ascending: false }).limit(10),
]);

const rows = tl.data || [];
const kpis = document.getElementById('kpis');
const tbody = document.getElementById('rows');
const signal = document.getElementById('signal');
const workoutsEl = document.getElementById('workouts');

// ---- recent workouts (independent of the day-grain timeline) ----
{
  const wk = wko.data || [];
  if (!wk.length) {
    workoutsEl.innerHTML = '<div class="empty">No workouts synced yet.</div>';
  } else {
    workoutsEl.innerHTML = wk.slice(0, 5).map(w => {
      const d = new Date(w.start_time || `${w.day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dur = w.duration_min ? (w.duration_min >= 60 ? `${Math.floor(w.duration_min / 60)}h${String(Math.round(w.duration_min % 60)).padStart(2, '0')}` : `${Math.round(w.duration_min)}m`) : '–';
      return `<div class="row"><div class="grow"><div class="t">${(w.name || (w.activity_type || 'workout').replace(/_/g, ' '))}</div>
        <div class="s">${d}${w.calories ? ' · ' + w.calories + ' cal' : ''}${w.avg_hr ? ' · ' + w.avg_hr + ' bpm' : ''}</div></div><span class="r">${dur}</span></div>`;
    }).join('');
  }
}

// ---- liquid stools per day (Bristol 6–7) ----
const liquidByDay = {};
for (const b of (br.data || [])) { if (b.bristol >= 6) liquidByDay[b.day] = (liquidByDay[b.day] || 0) + 1; }

// ---- Harvey-Bradshaw Index proxy ----
// HBI = wellbeing(0-4) + abdominal pain(0-3) + liquid stools/day + abdominal mass(0) + complications(0)
// Mass & complications aren't tracked → default 0, so this is a lower-bound PROXY to TREND, not a clinical score.
function hbi(r) {
  if (r.mood == null && r.symptom_severity == null && !(r.day in liquidByDay)) return null;
  const wellbeing = r.mood != null ? (5 - r.mood) : 2;                 // mood5→0 (very well) … mood1→4 (terrible)
  const pain = r.symptom_severity == null ? 0 : r.symptom_severity >= 8 ? 3 : r.symptom_severity >= 5 ? 2 : r.symptom_severity >= 2 ? 1 : 0;
  const liquid = liquidByDay[r.day] || 0;
  return wellbeing + pain + liquid;
}
const hbiBand = (v) => v == null ? ['–', 'muted'] : v < 5 ? ['Remission', 'good'] : v <= 7 ? ['Mild', 'warn'] : v <= 16 ? ['Moderate', 'warn'] : ['Severe', 'bad'];

function card(n, l) { return `<div class="sv-card flat"><div class="t-label" style="color:var(--text-3)">${l}</div><span class="num">${n}</span></div>`; }

function render() {
  const asc = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const last7 = rows.slice(0, 7);
  const hbi7 = avg(last7.map(hbi));
  const [band] = hbiBand(hbi7);
  const flareDays = rows.filter(r => r.flare || (r.symptom_severity ?? 0) >= 7).length;
  const bloodDays = rows.filter(r => r.any_blood).length;

  // ---- fitness / cut metrics ----
  const weighed = [...rows].filter(r => r.weight_lb != null).sort((a, b) => a.day.localeCompare(b.day));
  const latestW = weighed.length ? weighed[weighed.length - 1].weight_lb : null;
  const oldestW = weighed.length ? weighed[0].weight_lb : null;
  const wDelta = (latestW != null && oldestW != null && weighed.length > 1) ? (latestW - oldestW) : null;
  const avgSteps = avg(last7.map(r => r.steps));
  const avgActiveCal = avg(last7.map(r => r.active_calories));
  const netCalDays = last7.filter(r => r.food_calories && r.active_calories != null);
  const avgNetCal = netCalDays.length ? avg(netCalDays.map(r => r.food_calories - r.active_calories)) : null;

  // KPIs: four hero tiles, five small ones
  const asOf = rows[0]?.day ? new Date(rows[0].day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const sleep7 = avg(last7.map(r => r.sleep_minutes));
  kpis.innerHTML =
    statTile({ k: 'HBI proxy · 7d', v: hbi7 == null ? '–' : hbi7.toFixed(1), d: hbi7 == null ? '' : `<span class="chip">${band}</span>`, src: `Daily log + Bristol · ${asOf}` }) +
    statTile({ k: 'Sleep · 7d avg', v: sleep7 == null ? '–' : fmtSleep(Math.round(sleep7)), spark: sparkline(asc.slice(-14).map(r => r.sleep_minutes)), src: `Garmin · ${asOf}` }) +
    statTile({ k: 'Steps · 7d avg', v: avgSteps == null ? '–' : Math.round(avgSteps).toLocaleString(), spark: sparkline(asc.slice(-14).map(r => r.steps)), src: `Garmin · ${asOf}` }) +
    statTile({ k: 'Weight', v: latestW == null ? '–' : String(latestW), small: latestW == null ? '' : 'lb', d: wDelta != null ? `<span class="chip">${wDelta > 0 ? '+' : ''}${wDelta.toFixed(1)} lb · ${weighed.length} weigh-ins</span>` : 'No weigh-ins', src: `Daily log · ${asOf}` });
  document.getElementById('kmini').innerHTML =
    card(avg(last7.map(r => r.stress_avg)) == null ? '–' : Math.round(avg(last7.map(r => r.stress_avg))), 'Stress · 7d') +
    card(flareDays, 'Flare days · 30d') +
    card(bloodDays, 'Blood days · 30d') +
    card(avgActiveCal == null ? '–' : Math.round(avgActiveCal), 'Active cal · 7d') +
    card(avgNetCal == null ? '–' : Math.round(avgNetCal), 'Food minus active · 7d');
  reveal(document.querySelectorAll('#kpis .stat, #kmini > *'), { stagger: 60, y: 14 });
  drawOn(kpis, { delay: 300 });

  // Sleep, last 14 nights, as capsule bars
  const nights = asc.slice(-14);
  document.getElementById('sleepChart').innerHTML = pillBars(nights.map((r, i) => ({
    label: new Date(r.day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' }),
    value: r.sleep_minutes || 0, now: i === nights.length - 1,
    title: `${new Date(r.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${fmtSleep(r.sleep_minutes)}${r.sleep_score ? ' · score ' + r.sleep_score : ''}`,
  })), { height: 200, fmt: (m) => fmtSleep(m) });
  growPills(document.getElementById('sleepChart'), { delay: 250 });

  // ---- ACTIONABLE INSIGHTS ----
  const insights = [];
  const bad = [], calm = [];
  for (let i = 1; i < asc.length; i++) {
    const d = asc[i], p = asc[i - 1];
    ((d.symptom_severity ?? 0) >= 6 || d.flare ? bad : calm).push({ prevSleep: p.sleep_minutes, prevStress: p.stress_avg, prevIrr: p.irritant_count || 0 });
  }
  if (bad.length >= 2) {
    const bs = avg(bad.map(x => x.prevSleep)), cs = avg(calm.map(x => x.prevSleep));
    if (bs != null && cs != null && bs < cs - 20) insights.push(['moon', `Bad days follow short sleep: ${fmtSleep(Math.round(bs))} the night before vs ${fmtSleep(Math.round(cs))} before calm days. Protecting sleep looks like your #1 lever.`]);
    const bi = avg(bad.map(x => x.prevIrr)), ci = avg(calm.map(x => x.prevIrr));
    if (bi != null && ci != null && bi > ci + 0.3) insights.push(['alert-triangle', `Irritants (alcohol / smoked THC) the day before are higher on bad days (${bi.toFixed(1)} vs ${ci.toFixed(1)}). Worth an elimination test.`]);
    const bst = avg(bad.map(x => x.prevStress)), cst = avg(calm.map(x => x.prevStress));
    if (bst != null && cst != null && bst > cst + 5) insights.push(['activity', `Higher Garmin stress precedes flare days (${Math.round(bst)} vs ${Math.round(cst)}). Stress management is showing up in your gut.`]);
  }
  if (bloodDays > 0) insights.push(['droplet', `${bloodDays} day(s) with blood in the last 30. Log these and mention frequency to Dr. Khanna; rising rectal bleeding is a flare signal.`]);
  // HBI trend
  const hbiPrev7 = avg(rows.slice(7, 14).map(hbi));
  if (hbi7 != null && hbiPrev7 != null) {
    const d = hbi7 - hbiPrev7;
    if (d >= 1.5) insights.push(['trending-up', `Your HBI proxy rose ${d.toFixed(1)} vs the prior week (${hbiPrev7.toFixed(1)} to ${hbi7.toFixed(1)}), trending toward more activity. If it keeps climbing, flag it.`]);
    else if (d <= -1.5) insights.push(['trending-down', `HBI proxy dropped ${Math.abs(d).toFixed(1)} vs last week. The meds/changes are trending the right way.`]);
  }
  // med adherence
  const missedBud = rows.slice(0, 14).filter(r => r.mood != null); // proxy: days logged
  if (!insights.length) signal.innerHTML = '<div class="empty">No patterns yet.</div>';
  else signal.innerHTML = insights.map(([i, t]) => `<div class="sig">${icon(i, { size: 16 })}<span>${t}</span></div>`).join('');

  // ---- table ----
  tbody.innerHTML = rows.slice(0, 30).map(r => {
    const d = new Date(r.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    const h = hbi(r); const [hb, hc] = hbiBand(h);
    return `<tr class="${r.flare ? 'flarerow' : ''}">
      <td>${d}</td>
      <td>${fmtSleep(r.sleep_minutes)}</td>
      <td>${r.stress_avg ?? '<span class=muted>–</span>'}</td>
      <td>${r.mood ?? '<span class=muted>–</span>'}</td>
      <td><span class="sev ${sevClass(r.symptom_severity)}">${r.symptom_severity ?? '–'}</span></td>
      <td>${r.bm_count || 0}</td>
      <td>${h == null ? '<span class=muted>–</span>' : `${h} <span class="muted" style="font-size:.78em">${hb}</span>`}</td>
      <td>${r.any_blood ? `<span class="flag" title="Blood">${icon('droplet', { size: 14, label: 'Blood' })}</span>` : ''}</td>
      <td>${r.irritant_count ? `<span class="flag">${icon('alert-triangle', { size: 13 })}${r.irritant_count}</span>` : ''}</td>
    </tr>`;
  }).join('');
}

// ---- gate: render only after all declarations above are initialized ----
if (tl.error) { tbody.innerHTML = `<tr><td colspan="9" class="muted">Couldn't load: ${tl.error.message}</td></tr>`; }
else if (!rows.length) {
  kpis.innerHTML = card('–', 'No logs yet');
  signal.innerHTML = '<span class="muted">No data yet.</span>';
  tbody.innerHTML = `<tr><td colspan="9" class="muted">No data yet.</td></tr>`;
} else {
  render();
}
