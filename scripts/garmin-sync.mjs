#!/usr/bin/env node
// =====================================================================
// scripts/garmin-sync.mjs — pull Garmin Connect wellness data → health_daily
//
// Populates the Garmin columns the Crohn's tracker reads (sleep, stress,
// body battery, HRV, resting HR, steps, calories) so the Daily Log +
// Insights show real biometric context next to symptoms.
//
// WHY A SCRIPT (not a Vercel cron): Garmin's login (SSO) frequently blocks
// datacenter IPs. Run this from a residential connection — your vault /
// laptop / a home server — on a nightly schedule. It's idempotent (upsert
// by day) so re-running is safe.
//
// SETUP (in whatever env you run it):
//   npm i garmin-connect            (see scripts/package.json)
//   export GARMIN_EMAIL="you@example.com"
//   export GARMIN_PASSWORD="…"
//   export SUPABASE_ADMIN_URL="https://eibtnkaoqsgwiqttiwjo.supabase.co"   # optional (defaults)
//   export SUPABASE_ADMIN_SERVICE_ROLE_KEY="…"   # admin project service_role
//   node scripts/garmin-sync.mjs [days]          # days back to sync (default 10)
//
// Schedule nightly (cron):  0 6 * * *  cd /path && node scripts/garmin-sync.mjs
// =====================================================================
import { GarminConnect } from 'garmin-connect';

const SB_URL = process.env.SUPABASE_ADMIN_URL || 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const SB_KEY = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
const EMAIL = process.env.GARMIN_EMAIL;
const PASS = process.env.GARMIN_PASSWORD;
const DAYS = Math.max(1, Math.min(60, parseInt(process.argv[2] || '10', 10)));

if (!EMAIL || !PASS) { console.error('✗ Set GARMIN_EMAIL and GARMIN_PASSWORD'); process.exit(1); }
if (!SB_KEY) { console.error('✗ Set SUPABASE_ADMIN_SERVICE_ROLE_KEY'); process.exit(1); }

const ymd = (d) => d.toISOString().slice(0, 10);
const dateList = () => { const out = []; for (let i = 1; i <= DAYS; i++) { const d = new Date(); d.setDate(d.getDate() - i); out.push(ymd(d)); } return out; };
const num = (v) => (v == null || Number.isNaN(+v) ? null : Math.round(+v));

// ---- Supabase REST upsert (no SDK dep) ----
async function upsertDaily(rows) {
  if (!rows.length) return;
  const res = await fetch(`${SB_URL}/rest/v1/health_daily?on_conflict=day`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert ${res.status}: ${await res.text()}`);
}

// Best-effort call: try a library method, swallow if this version lacks it.
async function tryCall(fn) { try { return await fn(); } catch (e) { return null; } }

async function main() {
  console.log(`Garmin → health_daily · ${DAYS} day(s)`);
  const GC = new GarminConnect({ username: EMAIL, password: PASS });
  await GC.login();
  console.log('✓ logged in');

  const rows = [];
  for (const day of dateList()) {
    const dObj = new Date(`${day}T12:00:00Z`);
    const row = { day, garmin_synced_at: new Date().toISOString() };

    // Sleep (duration, score, stages)
    const sleep = await tryCall(() => GC.getSleepData(day)) || await tryCall(() => GC.getSleep(dObj));
    const dto = sleep?.dailySleepDTO || sleep;
    if (dto) {
      if (dto.sleepTimeSeconds != null) row.sleep_minutes = num(dto.sleepTimeSeconds / 60);
      row.sleep_score = num(dto.sleepScores?.overall?.value ?? dto.overallSleepScore);
      row.sleep_deep_min = num((dto.deepSleepSeconds ?? 0) / 60) || null;
      row.sleep_rem_min = num((dto.remSleepSeconds ?? 0) / 60) || null;
      row.sleep_light_min = num((dto.lightSleepSeconds ?? 0) / 60) || null;
      row.sleep_awake_min = num((dto.awakeSleepSeconds ?? 0) / 60) || null;
    }

    // Daily summary (steps, calories, resting HR, stress, body battery)
    const sum = await tryCall(() => GC.getSteps(dObj)) // some versions: number
      || await tryCall(() => GC.getDailySummary?.(dObj))
      || await tryCall(() => GC.getUserSummary?.(day));
    if (sum && typeof sum === 'object') {
      row.steps = num(sum.totalSteps ?? sum.steps);
      row.active_calories = num(sum.activeKilocalories ?? sum.activeCalories);
      row.resting_hr = num(sum.restingHeartRate);
      row.stress_avg = num(sum.averageStressLevel ?? sum.avgStressLevel);
      row.body_battery_high = num(sum.bodyBatteryHighestValue ?? sum.highestBodyBattery);
      row.body_battery_low = num(sum.bodyBatteryLowestValue ?? sum.lowestBodyBattery);
    } else if (typeof sum === 'number') {
      row.steps = num(sum);
    }

    // HRV (overnight avg)
    const hrv = await tryCall(() => GC.getHrvData?.(day)) || await tryCall(() => GC.getHeartRateVariability?.(dObj));
    const hrvVal = hrv?.hrvSummary?.lastNightAvg ?? hrv?.lastNightAvg;
    if (hrvVal != null) row.hrv_ms = num(hrvVal);

    // only keep the day if we actually got at least one biometric
    const got = Object.keys(row).filter(k => k !== 'day' && k !== 'garmin_synced_at' && row[k] != null);
    if (got.length) { rows.push(row); console.log(`  ${day}: ${got.join(', ')}`); }
    else console.log(`  ${day}: no data`);
  }

  await upsertDaily(rows);
  console.log(`✓ upserted ${rows.length} day(s) into health_daily`);
}

main().catch((e) => { console.error('✗', e.message || e); process.exit(1); });
