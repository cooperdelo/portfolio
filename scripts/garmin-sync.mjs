#!/usr/bin/env node
// =====================================================================
// scripts/garmin-sync.mjs — pull Garmin Connect wellness data → health_daily
//
// Populates the Garmin columns the Crohn's tracker reads (sleep + stages,
// stress, body battery, HRV, resting HR, steps, calories).
//
// WHERE TO RUN: a residential connection (your vault / laptop) — Garmin blocks
// datacenter IPs. Idempotent (upsert by day), so re-running is safe.
//
// SETUP:
//   cd scripts && npm install
//   copy .env.garmin.example -> .env.garmin  and fill it in (gitignored)
//   node garmin-sync.mjs 3 --dry     # test: fetch 3 days, print, no DB write
//   node garmin-sync.mjs 10          # real: sync last 10 days into Supabase
// =====================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'garmin-connect';
const { GarminConnect } = pkg;

// ---- tiny .env loader (no dep) ----
const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const f of ['.env.garmin', '.env']) {
  const p = path.join(HERE, f);
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const mt = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2].replace(/^["']|["']$/g, '');
  }
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const DAYS = Math.max(1, Math.min(400, parseInt(args.find(a => /^\d+$/.test(a)) || '10', 10)));
const EMAIL = process.env.GARMIN_EMAIL, PASS = process.env.GARMIN_PASSWORD;
const SB_URL = process.env.SUPABASE_ADMIN_URL || 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const SB_KEY = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;

if (!EMAIL || !PASS) { console.error('✗ Set GARMIN_EMAIL and GARMIN_PASSWORD (scripts/.env.garmin)'); process.exit(1); }
if (!DRY && !SB_KEY) { console.error('✗ Set SUPABASE_ADMIN_SERVICE_ROLE_KEY, or pass --dry to test Garmin only'); process.exit(1); }

const ymd = (d) => d.toISOString().slice(0, 10);
const num = (v) => (v == null || v === '' || Number.isNaN(+v) ? null : Math.round(+v));
const GC_API = 'https://connectapi.garmin.com';

async function main() {
  console.log(`Garmin${DRY ? ' (dry-run)' : ''} → health_daily · ${DAYS} day(s)`);
  const GC = new GarminConnect({ username: EMAIL, password: PASS });
  await GC.login();
  const profile = await GC.getUserProfile().catch(() => null);
  const displayName = profile?.displayName || GC._userHash;
  console.log(`✓ logged in${displayName ? ` (${displayName})` : ''}`);

  const rows = [];
  for (let i = 1; i <= DAYS; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const date = ymd(d);
    const row = { day: date, garmin_synced_at: new Date().toISOString() };

    // sleep + stages (wrapper)
    try {
      const s = await GC.getSleepData(d);
      const dto = s?.dailySleepDTO || s;
      if (dto?.sleepTimeSeconds != null) {
        row.sleep_minutes = num(dto.sleepTimeSeconds / 60);
        row.sleep_score = num(dto.sleepScores?.overall?.value);
        row.sleep_deep_min = num((dto.deepSleepSeconds ?? 0) / 60) || null;
        row.sleep_rem_min = num((dto.remSleepSeconds ?? 0) / 60) || null;
        row.sleep_light_min = num((dto.lightSleepSeconds ?? 0) / 60) || null;
        row.sleep_awake_min = num((dto.awakeSleepSeconds ?? 0) / 60) || null;
      }
    } catch (e) { if (i === 1) console.warn('  · sleep:', e.message); }

    // steps (wrapper)
    try { const st = await GC.getSteps(d); row.steps = num(typeof st === 'number' ? st : st?.totalSteps); }
    catch (e) { if (i === 1) console.warn('  · steps:', e.message); }

    // heart rate → resting HR (wrapper)
    try { const hr = await GC.getHeartRate(d); row.resting_hr = num(hr?.restingHeartRate); }
    catch (e) { if (i === 1) console.warn('  · hr:', e.message); }

    // daily summary → stress, body battery, calories (raw authed GET)
    if (displayName) try {
      const sum = await GC.get(`${GC_API}/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`);
      if (sum) {
        row.stress_avg = num(sum.averageStressLevel);
        row.body_battery_high = num(sum.bodyBatteryHighestValue ?? sum.highestBodyBattery);
        row.body_battery_low = num(sum.bodyBatteryLowestValue ?? sum.lowestBodyBattery);
        row.active_calories = num(sum.activeKilocalories);
        if (row.steps == null) row.steps = num(sum.totalSteps);
        if (row.resting_hr == null) row.resting_hr = num(sum.restingHeartRate);
      }
    } catch (e) { if (i === 1) console.warn('  · summary:', e.message); }

    // HRV overnight avg (raw authed GET)
    try {
      const hrv = await GC.get(`${GC_API}/hrv-service/hrv/${date}`);
      row.hrv_ms = num(hrv?.hrvSummary?.lastNightAvg);
    } catch (e) { if (i === 1) console.warn('  · hrv:', e.message); }

    const got = Object.keys(row).filter(k => k !== 'day' && k !== 'garmin_synced_at' && row[k] != null);
    if (got.length) { rows.push(row); console.log(`  ${date}: ${got.map(k => `${k}=${row[k]}`).join(', ')}`); }
    else console.log(`  ${date}: no data`);
  }

  if (DRY) { console.log(`\n(dry-run) ${rows.length} day(s) — not written. Remove --dry to sync.`); return; }
  if (rows.length) {
    // PostgREST bulk insert requires every object to have identical keys — pad
    // to the union of all keys (missing metrics → null).
    const allKeys = [...new Set(rows.flatMap(Object.keys))];
    const norm = rows.map(r => Object.fromEntries(allKeys.map(k => [k, r[k] ?? null])));
    const res = await fetch(`${SB_URL}/rest/v1/health_daily?on_conflict=day`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(norm),
    });
    if (!res.ok) throw new Error(`Supabase upsert ${res.status}: ${await res.text()}`);
  }
  console.log(`✓ upserted ${rows.length} day(s) into health_daily`);
}

main().catch((e) => { console.error('✗', e.message || e); process.exit(1); });
