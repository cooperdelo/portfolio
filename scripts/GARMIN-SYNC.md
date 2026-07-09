# Garmin → health_daily sync

Pulls Garmin Connect wellness data into the `health_daily` table so the Crohn's
tracker (Daily Log + Insights) shows sleep, stress, body battery, HRV, resting
HR, steps and calories next to your symptoms.

## Where to run it
**Not on Vercel.** Garmin's login blocks datacenter IPs. Run it from a
**residential connection** — your vault box, laptop, or a home server — on a
nightly schedule. It's idempotent (upsert by `day`), so re-running is safe and
it will backfill any missing recent days.

## One-time setup
```bash
cd scripts
npm install                      # installs garmin-connect
```

Set env vars (in your shell profile, a `.env` you source, or your vault's secret
store):
```bash
export GARMIN_EMAIL="you@example.com"
export GARMIN_PASSWORD="your-garmin-password"
export SUPABASE_ADMIN_SERVICE_ROLE_KEY="…"   # admin project (eibtnkaoqsgwiqttiwjo) service_role
# optional — defaults to the admin project URL:
export SUPABASE_ADMIN_URL="https://eibtnkaoqsgwiqttiwjo.supabase.co"
```

> The service_role key bypasses RLS (there's no logged-in admin in a cron), so
> keep it out of git and only in the runner's secret store.

## Run
```bash
node garmin-sync.mjs           # last 10 days
node garmin-sync.mjs 30        # last 30 days (first-time backfill)
```

Run it **once manually first** and check the output — it prints each day and the
fields it found. Garmin occasionally requires an MFA prompt or changes its API;
if a metric shows "no data", the method name for that metric may differ in your
installed `garmin-connect` version (the script tries a few and skips gracefully).

## Schedule nightly
cron (Linux/mac):
```
0 6 * * *  cd /path/to/repo/scripts && /usr/bin/node garmin-sync.mjs >> ~/garmin-sync.log 2>&1
```
Or add it as a scheduled task in your vault next to the other nightly agents.

## What it writes
Upserts one `health_daily` row per day with: `sleep_minutes`, `sleep_score`,
`sleep_deep_min`, `sleep_rem_min`, `sleep_light_min`, `sleep_awake_min`,
`stress_avg`, `body_battery_high/low`, `hrv_ms`, `resting_hr`, `steps`,
`active_calories`, `garmin_synced_at`. Your manual check-in fields on the same
row (`mood`, `flare`, `note`, …) are never touched — the upsert only sets the
Garmin columns.
