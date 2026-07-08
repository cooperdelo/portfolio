// =====================================================================
// /admin/health/_js/dashboard.js — insights over the Crohn's tracker
// Adds an auto-computed Harvey-Bradshaw Index (HBI) proxy + actionable
// insight cards, all from data already logged (zero added friction).
// =====================================================================
import { sb } from '/admin/_shell/supabase.js';
import { mountShell } from '/admin/_shell/admin-shell.js';

await mountShell({ title: 'Insights · Health' });

const fmtSleep = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const sevColor = (s) => s == null ? 'transparent'
  : s >= 7 ? 'rgba(255,77,77,.35)' : s >= 4 ? 'rgba(255,180,60,.30)' : 'rgba(120,200,80,.25)';
const avg = (a) => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };

// ---- pull data ----
const [tl, br] = await Promise.all([
  sb.from('v_health_timeline').select('*').order('day', { ascending: false }).limit(45),
  sb.from('health_bristol').select('day,bristol,blood').order('day', { ascending: false }).limit(600),
]);

const rows = tl.data || [];
const kpis = document.getElementById('kpis');
const tbody = document.getElementById('rows');
const signal = document.getElementById('signal');

if (tl.error) { tbody.innerHTML = `<tr><td colspan="9" class="muted">Load error: ${tl.error.message}. (Schema applied?)</td></tr>`; }
else if (!rows.length) {
  kpis.innerHTML = card('—', 'Start logging'); 
  signal.textContent = 'No data yet — log a few days on the Daily Log page and insights appear here automatically.';
  tbody.innerHTML = `<tr><td colspan="9" class="muted">No data yet.</td></tr>`;
} else {
  render();
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
const hbiBand = (v) => v == null ? ['—', 'muted'] : v < 5 ? ['Remission', 'good'] : v <= 7 ? ['Mild', 'warn'] : v <= 16 ? ['Moderate', 'warn'] : ['Severe', 'bad'];

function card(n, l, cls = '') { return `<div class="kpi"><div class="n ${cls}">${n}</div><div class="l">${l}</div></div>`; }

function render() {
  const asc = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const last7 = rows.slice(0, 7);
  const hbi7 = avg(last7.map(hbi));
  const [band] = hbiBand(hbi7);
  const flareDays = rows.filter(r => r.flare || (r.symptom_severity ?? 0) >= 7).length;
  const bloodDays = rows.filter(r => r.any_blood).length;

  // KPIs
  kpis.innerHTML =
    card(hbi7 == null ? '—' : hbi7.toFixed(1), `HBI proxy · ${band}`, hbi7 == null ? '' : (hbi7 < 5 ? 'good' : hbi7 <= 7 ? 'warn' : 'bad')) +
    card(avg(last7.map(r => r.sleep_minutes)) == null ? '—' : fmtSleep(Math.round(avg(last7.map(r => r.sleep_minutes)))), 'Avg sleep (7d)') +
    card(avg(last7.map(r => r.stress_avg)) == null ? '—' : Math.round(avg(last7.map(r => r.stress_avg))), 'Garmin stress (7d)') +
    card(flareDays, 'Flare days (30d)', flareDays ? 'warn' : '') +
    card(bloodDays, 'Blood days (30d)', bloodDays ? 'bad' : '');

  // ---- ACTIONABLE INSIGHTS ----
  const insights = [];
  const bad = [], calm = [];
  for (let i = 1; i < asc.length; i++) {
    const d = asc[i], p = asc[i - 1];
    ((d.symptom_severity ?? 0) >= 6 || d.flare ? bad : calm).push({ prevSleep: p.sleep_minutes, prevStress: p.stress_avg, prevIrr: p.irritant_count || 0 });
  }
  if (bad.length >= 2) {
    const bs = avg(bad.map(x => x.prevSleep)), cs = avg(calm.map(x => x.prevSleep));
    if (bs != null && cs != null && bs < cs - 20) insights.push(['🛌', `Bad days follow short sleep — ${fmtSleep(Math.round(bs))} the night before vs ${fmtSleep(Math.round(cs))} before calm days. Protecting sleep looks like your #1 lever.`]);
    const bi = avg(bad.map(x => x.prevIrr)), ci = avg(calm.map(x => x.prevIrr));
    if (bi != null && ci != null && bi > ci + 0.3) insights.push(['🚩', `Irritants (alcohol / smoked THC) the day before are higher on bad days (${bi.toFixed(1)} vs ${ci.toFixed(1)}). Worth an elimination test.`]);
    const bst = avg(bad.map(x => x.prevStress)), cst = avg(calm.map(x => x.prevStress));
    if (bst != null && cst != null && bst > cst + 5) insights.push(['🧠', `Higher Garmin stress precedes flare days (${Math.round(bst)} vs ${Math.round(cst)}). Stress management is showing up in your gut.`]);
  }
  if (bloodDays > 0) insights.push(['🩸', `${bloodDays} day(s) with blood in the last 30 — log these and mention frequency to Dr. Khanna; rising rectal bleeding is a flare signal.`]);
  // HBI trend
  const hbiPrev7 = avg(rows.slice(7, 14).map(hbi));
  if (hbi7 != null && hbiPrev7 != null) {
    const d = hbi7 - hbiPrev7;
    if (d >= 1.5) insights.push(['📈', `Your HBI proxy rose ${d.toFixed(1)} vs the prior week (${hbiPrev7.toFixed(1)} → ${hbi7.toFixed(1)}) — trending toward more activity. If it keeps climbing, flag it.`]);
    else if (d <= -1.5) insights.push(['📉', `HBI proxy dropped ${Math.abs(d).toFixed(1)} vs last week — the meds/changes are trending the right way.`]);
  }
  // med adherence
  const missedBud = rows.slice(0, 14).filter(r => r.mood != null); // proxy: days logged
  if (!insights.length) signal.innerHTML = 'Keep logging — actionable patterns (sleep, irritants, stress, HBI trend) unlock after ~1–2 weeks of data. The weekly task also emails a ranked trigger report.';
  else signal.innerHTML = insights.map(([i, t]) => `<div style="display:flex;gap:.6rem;padding:.4rem 0;"><span>${i}</span><span>${t}</span></div>`).join('')
    + `<div style="opacity:.5;font-size:.72rem;margin-top:.5rem;">HBI proxy = wellbeing + abdominal pain + liquid stools/day (mass & complications not tracked → lower bound). Trend it; bring the real HBI to your GI. Not medical advice.</div>`;

  // ---- table ----
  tbody.innerHTML = rows.slice(0, 30).map(r => {
    const d = new Date(r.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    const h = hbi(r); const [hb, hc] = hbiBand(h);
    return `<tr class="${r.flare ? 'flarerow' : ''}">
      <td>${d}</td>
      <td>${fmtSleep(r.sleep_minutes)}</td>
      <td>${r.stress_avg ?? '<span class=muted>—</span>'}</td>
      <td>${r.mood ?? '<span class=muted>—</span>'}</td>
      <td><span class="sev" style="background:${sevColor(r.symptom_severity)}">${r.symptom_severity ?? '—'}</span></td>
      <td>${r.bm_count || 0}</td>
      <td>${h == null ? '<span class=muted>—</span>' : `${h} <span style="opacity:.5;font-size:.7em">${hb}</span>`}</td>
      <td>${r.any_blood ? '🩸' : ''}</td>
      <td>${r.irritant_count ? '⚠ ' + r.irritant_count : ''}</td>
    </tr>`;
  }).join('');
}
