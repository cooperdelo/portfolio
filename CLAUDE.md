# Cooper Delo Portfolio — Claude Code context

Static HTML portfolio site (Vercel-hosted at cooperdelo.com) plus a private admin console at `/admin/*` backed by Supabase. This file gives Claude Code sessions everything needed to read/write the admin DB and ship changes confidently.

---

## Repo shape

```
/                                ← Public marketing site (vanilla HTML/CSS/JS)
  index.html, plugverse.html, rubber-band.html, athletic.html, lens.html, now.html
  shell.css, shell.js            ← Shared public-site styles + interactivity
  vercel.json                    ← Vercel routing + admin headers
/admin/                          ← Private admin console
  login.html                     ← Password-gated magic-link sign-in
  index.html                     ← Workspace chooser (Personal / PlugVerse). Plugverse role is sent straight to /admin/plugverse/
  _js/workspaces.js              ← Renders the workspace pages (body data-workspace = choose / personal / plugverse / more)
  personal/
    index.html                   ← Personal workspace page (full role only)
    overview.html                ← Former admin home dashboard (home.js)
  more/
    index.html                   ← "More tools": full route directory filtered by role (from _shell/directory.js)
  acquisition/
    index.html                   ← PlugVerse sending queue + experiment results (_js/acquisition.js → /api/acquisition, /api/acquisition-results)
  assets/
    index.html                   ← Band media review (_js/band-media.js → /api/band-review), full role only
  _shell/
    admin-shell.css              ← Layout, tokens, components (left rail, cards, tables)
    admin-shell.js               ← mountShell() — auth gate + sidebar + toast; confines acquisition role to /admin/plugverse/ + /admin/acquisition/
    supabase.js                  ← Shared sb client, getAdminRole(), isAdmin(), debounced realtime helpers
    directory.js                 ← DIRECTORY: every existing route with per-item `roles`, used by More tools
    workspace-model.mjs          ← Pure helpers: accountScope(), scopeForTask(), cashAccounts() (personal vs PlugVerse split)
    acquisition-model.mjs        ← Pure adapter contract for the acquisition queue (eligibility, conflicts); no store, no sends
    workspaces.css               ← Styles for the workspace pages
  finance/                       ← Finance dashboard suite
    index.html                   ← Money (_js/money.js → /api/money-overview)
    overview.html                ← Former finance dashboard (finance/_js/dashboard.js)
    transactions.html, entry.html, investments.html, networth.html,
    plugverse.html, fund.html, funding.html, food-log.html, tax.html, export.html
    _js/                         ← Per-page logic
  merch/
    index.html                   ← Merch inventory + debt tracker (admin-styled)
  plugverse/
    index.html                   ← PlugVerse workspace page (workspaces.js)
    metrics.html                 ← Plugverse KPIs dashboard (MRR, users, payouts, top events) → /api/plugverse-kpi
    ops.html                     ← Plugverse ops
  social/
    index.html                   ← IG + TikTok unified dashboard (posts, engagement, account stats)
  playbook/
    index.html                   ← Brand/strategy/voice vault — filters, search, CRUD, realtime
    _js/playbook.js
  contacts/
    index.html                   ← Pipeline + network vault — Due/Cold alert strips, 4 filters, drawer w/ inline pipeline + copy chips + "Mark contacted today"
    _js/contacts.js
/api/                            ← Vercel serverless functions
  plugverse-kpi.mjs              ← Aggregates Plugverse Supabase + Stripe + PostHog, writes daily snapshots
  instagram-oauth.mjs            ← Meta IG OAuth callback → upserts instagram_credentials
  instagram-webhook.mjs          ← Meta webhook verify (GET) + event ack (POST)
  instagram-sync.mjs             ← Pulls IG media + account stats → social_posts / social_post_metrics / social_account_snapshots
  tiktok-oauth.mjs               ← TikTok OAuth callback → upserts tiktok_credentials
  tiktok-sync.mjs                ← Pulls TikTok user info + videos with auto-refresh → social_* tables
  investments-sync.mjs           ← Pulls quotes from Yahoo Finance (stocks) + Coinbase spot (crypto, keyless) → updates investment_positions
  money-overview.mjs             ← Read-only Money payload (bank balances, recent txns; personal snapshots + reconciliation doc for full only)
  acquisition.mjs                ← Acquisition board connection status. Fails closed (not_connected, writes rejected) until the owner is connected
  acquisition-results.mjs        ← 30-day artist signup outcomes by signup_utm, read from PlugVerse `users`
  band-review.mjs                ← Band media list, signed preview URLs from `band-review` bucket, review saves via band_review_save()
  band-media-source.mjs          ← Returns the confirmed Rubber Band Drive folder URL from vault_documents
  _lib/admin-auth.mjs            ← authorize(req, roles): verifies the JWT + admin_allowlist role; privateResponse() no-store headers
```

---

## Supabase

**Project:** `eibtnkaoqsgwiqttiwjo` ("cooperdelo's Project")
**URL:** `https://eibtnkaoqsgwiqttiwjo.supabase.co`
**Use the Supabase MCP tools** for any DB work — `list_tables`, `execute_sql`, `apply_migration`, `get_logs`, `get_advisors`. The MCP is configured against this project.

### Tables (all in `public` schema, all RLS-gated by `is_admin()`)

| Table | Purpose | Key columns |
|---|---|---|
| `admin_allowlist` | Email allowlist for the admin gate, with role | `email` (PK), `admin_role` (text, CHECK in `'full' / 'plugverse' / 'acquisition'`, default `'full'`), `added_at` |
| `finance_accounts` | Bank/card/investment account dictionary | `slug` (PK), `display_name`, `account_type`, `institution`, `is_active`, `cash_balance` (uninvested cash sitting in investment accounts — Schwab settlement, Coinbase USD — edited manually, not auto-synced) |
| `financial_transactions` | Master ledger — personal, Plugverse LLC, 1789 Fund | `id`, `date`, `description`, `amount`, `type` (income/expense), `entity` (personal/plugverse/1789_fund), `funding_source` (FK → funding_sources.slug), `account`, `category`, `is_tax_deductible`, `tax_category`, `deductible_pct`, `is_food_log`, `merchant`, `external_source` (mercury/stripe/manual/NULL), `external_id` (provider-side id), `deleted_at` (soft-delete) |
| `investment_positions` | Roth IRA + brokerage + crypto holdings. `current_price` is auto-synced by `/api/investments-sync` (Yahoo for stocks, Coinbase spot for crypto). Crypto sync uses `symbol` directly as the Coinbase ticker. | `id`, `account_slug` → finance_accounts, `symbol`, `shares`, `cost_basis`, `current_price`, `asset_type` (stock/crypto, CHECK), `coingecko_id` (legacy — kept for possible future fallback), `price_updated_at` |
| `budget_targets` | Monthly budget targets per entity/category | `id`, `entity`, `category`, `monthly_target`, `effective_date` |
| `merch_items` | Merch SKUs (Plugverse tees etc.) | `id`, `name`, `variant`, `price`, `initial_stock`, `sort_order`, `archived` |
| `merch_transactions` | Sales, restocks, gifts, adjustments | `id`, `item_id` → merch_items, `type` (sale/restock/adjust/gift/lost), `quantity`, `person_name`, `amount_owed`, `amount_paid`, `paid_at` |
| `funding_sources` | Lookup table of valid `funding_source` slugs | `slug` (PK, referenced by `financial_transactions.funding_source` via FK), `display_name`, `description`, `award_amount` (NULL = unbounded), `is_active`, `sort_order`, `started_at`, `exhausted_at` |
| `plugverse_kpi_snapshots` | Daily KPI snapshot for the Plugverse dashboard. UPSERTed by `/api/plugverse-kpi` on each admin visit. Read for sparklines. | `date` (PK), `captured_at`, `mrr_cents`, `arr_cents`, `active_subscriptions`, `users_total`, `signups_24h`, `signups_7d`, `churn_7d`, `payouts_pending_cents`, `payouts_completed_mtd_cents`, `top_events_7d` (jsonb), `raw` (jsonb full payload) |
| `instagram_credentials` | Long-lived IG access tokens (one row per connected IG business/creator account) | `ig_user_id` (PK), `username`, `access_token`, `expires_at`, `connected_at`, `refreshed_at` |
| `tiktok_credentials` | TikTok access + refresh tokens with their separate expiry windows | `tiktok_user_id` / open_id (PK), `union_id`, `username`, `display_name`, `avatar_url`, `access_token`, `refresh_token`, `expires_at`, `refresh_expires_at`, `connected_at`, `refreshed_at` |
| `social_posts` | Unified posts table across platforms | `id` (PK uuid), `platform` (instagram/tiktok/youtube/spotify), `external_id`, `account_handle`, `caption`, `posted_at`, `media_type`, `media_url`, `thumbnail_url`, `permalink`, `hashtags` (text[]), `raw` (jsonb), `first_seen_at`, `updated_at`. Unique (platform, external_id). |
| `social_post_metrics` | Time-series metrics per post (one row per sync) | `id`, `post_id` → social_posts, `captured_at`, `views`, `likes`, `comments`, `shares`, `saves`, `reach`, `impressions`, `engagement_pct`, `raw` |
| `social_account_snapshots` | Daily account-level stats per platform | `date` + `platform` (composite PK), `followers`, `following`, `posts_total`, `total_views`, `total_likes`, `handle`, `raw`, `captured_at` |
| `playbook_items` | Brand/strategy/voice vault — read by `/admin/playbook`. Auto-populated by chat sessions (post-response protocol writes atomic rows). `scope` is `personal-brand` / `plugverse` / `both`. `item_type` is `caption-idea` / `video-idea` / `philosophy-line` / `hook` / `decision` / `identity` / `pillar` / `strategy` / `rule` / `voice-rule` / `framework` / `prompt` (open-ended; new types are fine). | `id`, `scope`, `item_type`, `title`, `summary`, `body_markdown`, `category`, `subcategory`, `tags` (text[]), `priority` (lower=higher), `is_pinned`, `source_vault_path`, `source_anchor`, `status` (default `active`), `expires_at`, `last_synced_at`, `deleted_at` (soft-delete) |
| `plugverse_contacts` | Pipeline + network vault — read by `/admin/contacts`. Auto-populated by chat sessions when contacts are added or updated. `pipeline_stage` flows `identified` → `engaged` → `contacted` → `demo` → `committed` (plus `team`, `dead`). `pipeline_type` is `artist`/`organizer`/`venue`/`partnership`/`team`. | `id`, `full_name`, `preferred_name`, `role`, `title`, `organization`, `college`, `org_type`, `email`, `phone`, `instagram`, `twitter`, `linkedin`, `other_links` (jsonb), `pipeline_stage`, `pipeline_type`, `warm_path`, `last_contacted` (date), `next_step`, `next_step_due` (date), `notes`, `tags` (text[]), `referral_credit_to` → plugverse_contacts.id, `bookings_attributed`, `payout_owed`, `source_vault_path`, `is_pinned`, `priority`, `status` (default `active`), `deleted_at` (soft-delete) |
| `band_media_assets` | Rubber Band media catalog for `/admin/assets` (originals stay in Google Drive). Full-only SELECT; no direct writes from `authenticated`. Migration: `scripts/migrations/20260930-band-review.sql`. | `id`, `drive_file_id` (unique), `name`, `gig`, `mime_type`, `duration`, `proxy_path` (object in `band-review` bucket), `source_observed_at`, `retired_at` |
| `band_media_reviews` | One review row per asset per reviewer. Written only through `band_review_save(...)` (SECURITY DEFINER, full admin, optimistic `revision` check). | `asset_id` → band_media_assets, `reviewer` (auth uid), `revision`, `verdict` (unreviewed/favorite/reject), `note`, `time_seconds`, `trim_start`, `trim_end`, `updated_at`. PK (asset_id, reviewer) |
| `band_media_operations` | Idempotency log for `band_review_save` retries (same operation id + payload returns the stored result). | `operation_id` (PK), `reviewer`, `asset_id`, `request`, `result`, `created_at` |

Storage: private bucket `band-review` (50 MB limit; mp4/jpeg/webp/json) holds review proxies. Pages never read it directly; `/api/band-review` returns 15-minute signed URLs.

### Views (read-only summaries)

- `v_fund_1789` — total_received / total_spent / remaining for `funding_source = '1789_fund'`
- `v_funding_balance` — generic version of v_fund_1789, one row per funding source: `slug, display_name, is_active, award_amount, total_received, total_spent, remaining, started_at, exhausted_at`
- `v_monthly_summary` — `month, entity, type, category, tx_count, total`
- `v_food_log` — food log rows (`is_food_log = true`)
- `v_plugverse_pl` — monthly P&L for `entity = 'plugverse'`
- `v_tax_deductible` — `tax_year, tax_category, tx_count, deductible_amount, gross_amount`
- `v_playbook_active` — `playbook_items` filtered to `deleted_at IS NULL AND status='active' AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`. The admin page reads this view, not the raw table.
- `v_contacts_active` — `plugverse_contacts` filtered to `deleted_at IS NULL AND status='active'`. Joins `referral_credit_to` → `referred_by_name`. Main list source for `/admin/contacts`.
- `v_contacts_due_today` — `plugverse_contacts` with `next_step_due` ≤ today + 3 days. Drives the "Due this week" alert strip. Includes `days_until_due` (negative = overdue).
- `v_contacts_stale` — active pipeline contacts (`engaged`/`contacted`/`demo`/`committed`) with `last_contacted` NULL or >14 days ago. Drives the "Going cold" alert strip. Includes `days_since_contact`.

### Functions

- `is_admin()` — true iff `auth.jwt() ->> 'email'` is in `admin_allowlist` with `admin_role IN ('full','plugverse')` (since `20260930-limited-admin-boundary.sql`; an `acquisition` row does NOT pass).
- `is_full_admin()` — true iff the caller's `admin_role = 'full'`.
- `is_plugverse_scope()` — true iff the caller's `admin_role IN ('full','plugverse')`.
- `current_admin_role()` — returns the caller's `admin_role` (`'full' | 'plugverse' | 'acquisition' | NULL`).
- All four are `SECURITY DEFINER` (bypass RLS on `admin_allowlist`) and called from every RLS policy. The detailed access matrix is in the "Auth model" section below.
- `band_review_save(...)` — SECURITY DEFINER RPC, full admin only; the only write path into `band_media_reviews`.

### Dual-tag pattern: `entity` vs `funding_source`

A transaction has two independent dimensions:

- **`entity`** = whose books own this — `personal`, `plugverse`, or `1789_fund`. This is what shows up in entity-scoped P&Ls (e.g. `v_plugverse_pl` filters `entity = 'plugverse'`).
- **`funding_source`** = where the cash came from — `NULL` (no specific source / personal default), `1789_fund`, `founder_contribution`, `revenue`, `personal_savings`, `parents`.

Example: a Plugverse software expense paid from the 1789 award is `entity = 'plugverse'` (counts in Plugverse P&L) **and** `funding_source = '1789_fund'` (counts toward fund burn). Don't drop one for the other.

The 1789 fund accounting (`v_fund_1789`, `/admin/finance/fund`) filters on `funding_source = '1789_fund'`. Plugverse P&L (`v_plugverse_pl`, `/admin/finance/plugverse`) filters on `entity = 'plugverse'`. Both views are correct; they measure different things.

### Adding a new funding source

The `funding_sources` lookup table drives the "Funded by" dropdown on the Quick Add form. Adding a new source is a single insert — no code change needed:

```sql
-- Example: $20k Luby Pitch Competition prize
INSERT INTO funding_sources (slug, display_name, description, award_amount, is_active, sort_order, started_at)
VALUES ('luby_pitch', 'Luby Pitch Competition', 'Won 2026-XX-XX. No equity.', 20000.00, true, 15, '2026-XX-XX');
```

After insert, refresh `/admin/finance/entry.html` and "Luby Pitch Competition ($20,000)" will appear in the dropdown. To check its balance: `SELECT * FROM v_funding_balance WHERE slug = 'luby_pitch';`

To retire a source (e.g. after it's fully spent), set `is_active = false` — it stays in historic rows and views but stops appearing in the form.

**Pre-registered pending sources.** A source can be added with `is_active = false` *before* it's won, so transactions can be retroactively tagged the moment funds arrive. Currently pre-registered: `luby_pitch` ($20,000 estimated, awaiting result). When won:

```sql
UPDATE funding_sources
SET is_active = true,
    started_at = 'YYYY-MM-DD',
    description = 'Won YYYY-MM-DD. No equity. $20,000 prize.'
WHERE slug = 'luby_pitch';
```

### External transaction sync (Mercury / Stripe)

`financial_transactions.external_source` + `external_id` are reserved for the scheduled Mercury/Stripe importer. The unique partial index `uq_external_txn (external_source, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL` makes the importer idempotent — re-running pulls the same row, not duplicates. CHECK constraint restricts `external_source` to `mercury`, `stripe`, or `manual`. Manual entries leave both NULL.

### Auth model

- Magic-link only. The `admin/login.html` page asks for **email + shared password**. Password is a client-side soft gate; the real authn is the email-bound magic link.
- Shared password (rotate by editing the constant in `admin/login.html`): currently `plugverse2026`.
- Auth URL allowlist + Site URL configured in Supabase dashboard → Authentication → URL Configuration. Must include `https://cooperdelo.com/admin/**`.
- **Three roles**, stored in `admin_allowlist.admin_role` (text, CHECK in `('full','plugverse','acquisition')` since `20261001-acquisition-role.sql`):
  - `full` — Cooper (`delocooper6@gmail.com`). Sees and writes everything.
  - `plugverse` — Adler (`adlerrice@gmail.com`) and any future Plugverse cofounder. Sees and writes ONLY rows tied to Plugverse / the 1789 fund. Cannot touch personal finance, investments, merch, social analytics, IG/TikTok credentials, or the personal-brand playbook. Lands on `/admin/plugverse/` (no Personal workspace).
  - `acquisition` — narrow outreach contributor role. No table or storage access at all; only `/api/acquisition` and `/api/acquisition-results` (server-side, role-checked). `mountShell()` confines it to `/admin/plugverse/` and `/admin/acquisition/`.
- **RLS is the source of truth.** Client-side nav filtering + `requireFullAdminOrRedirect()` are UX only — direct-URL navigation, raw API calls, and even the Supabase JS client are all blocked at the DB layer.
- **`limited_role_boundary`** (`20260930-limited-admin-boundary.sql`): a RESTRICTIVE policy on every RLS-enabled `public` table except `admin_allowlist`, plus `storage.objects`, that denies any caller whose `current_admin_role()` is `acquisition` or `band`. It is ANDed with the normal permissive policies, so a broad `authenticated` policy can never leak to a limited role. Tables created later need it re-applied (the migration loops over existing tables only).
- SQL helpers (all `SECURITY DEFINER` so they ignore RLS on `admin_allowlist`):
  - `is_admin()` — true only for `full` or `plugverse` (not `acquisition`).
  - `is_full_admin()` — true only for `admin_role = 'full'`.
  - `is_plugverse_scope()` — true for `full` OR `plugverse`. Used in policies that both roles share.
  - `current_admin_role()` — returns `'full' | 'plugverse' | 'acquisition' | NULL`.

### Access matrix

| Table / view | full | plugverse | acquisition | Notes |
|---|---|---|---|---|
| `admin_allowlist` | ALL | SELECT own row | SELECT own row | Limited roles can self-discover their role (table is exempt from `limited_role_boundary`) |
| `financial_transactions` | ALL | ALL filtered by `entity IN ('plugverse','1789_fund') OR funding_source='1789_fund'` | none | Dual-tag boundary |
| `budget_targets` | ALL | ALL filtered by `entity IN ('plugverse','1789_fund')` | none | |
| `finance_accounts` | ALL | SELECT only | none | Lookup needed to render labels |
| `funding_sources` | ALL | SELECT only | none | Lookup table |
| `investment_positions` | ALL | none | none | Personal Roth + Coinbase |
| `merch_items`, `merch_transactions` | ALL | none | none | Personal side hustle |
| `social_posts`, `social_post_metrics`, `social_account_snapshots` | ALL | none | none | Personal IG/TikTok |
| `instagram_credentials`, `tiktok_credentials` | ALL | none | none | Personal API tokens |
| `plugverse_kpi_snapshots` | ALL | ALL | none | Plugverse data |
| `plugverse_contacts` | ALL | ALL | none | Plugverse pipeline |
| `playbook_items` | ALL | ALL filtered by `scope IN ('plugverse','both')` | none | Personal-brand items hidden |
| `band_media_assets`, `band_media_reviews`, `band_media_operations` | SELECT (writes via `band_review_save`) | none | none | Full-only band media review |
| Any other `public` table, `storage.objects` | per table | per table | none | `limited_role_boundary` denies acquisition everywhere |

The acquisition role's only data path is the two role-checked API routes `/api/acquisition` and `/api/acquisition-results`.

Views inherit RLS from their underlying tables, so `v_plugverse_pl`, `v_fund_1789`, `v_funding_balance`, `v_playbook_active`, `v_contacts_active`, `v_contacts_due_today`, `v_contacts_stale`, etc. all return the correct subset automatically.

### Adding a new admin

```sql
-- Full admin (sees everything):
INSERT INTO admin_allowlist (email, admin_role) VALUES ('person@example.com', 'full');

-- Plugverse-scoped admin (sees only Plugverse finance + plugverse-tagged data):
INSERT INTO admin_allowlist (email, admin_role) VALUES ('person@example.com', 'plugverse');

-- Acquisition contributor (no table access; sending queue + results APIs only):
INSERT INTO admin_allowlist (email, admin_role) VALUES ('person@example.com', 'acquisition');
```

They sign in via `/admin/login.html` with their email + the shared password. Their role is fetched once per session (cached in `getAdminRole()` in `supabase.js`) and drives nav rail + tile visibility.

### API auth (`/api/*`)

- `/api/plugverse-kpi.mjs` — requires `admin_role IN ('full','plugverse')` (acquisition is rejected).
- `/api/investments-sync.mjs` — requires `admin_role = 'full'`. Verifies via PostgREST `admin_allowlist?email=eq...` using the caller's JWT (works because of the self-read policy).
- Newer routes use `authorize(req, roles)` from `api/_lib/admin-auth.mjs` (verifies the JWT at `/auth/v1/user`, then reads the role with `SUPABASE_ADMIN_SERVICE_ROLE_KEY`) and reply via `privateResponse()` (`Cache-Control: no-store, private`):
  - `/api/money-overview` — `full`, `plugverse`. Reads with the caller's JWT so RLS still applies; personal snapshots + reconciliation doc are only fetched for `full`.
  - `/api/acquisition`, `/api/acquisition-results` — `full`, `acquisition`. GET only.
  - `/api/band-review`, `/api/band-media-source` — `full` only.

### Common queries

```sql
-- recent activity
SELECT date, description, entity, category, type, amount
FROM financial_transactions
WHERE deleted_at IS NULL
ORDER BY date DESC LIMIT 50;

-- this month's personal spend
SELECT sum(amount) FROM financial_transactions
WHERE entity = 'personal' AND type = 'expense'
  AND date >= date_trunc('month', current_date)
  AND deleted_at IS NULL;

-- 1789 fund burn
SELECT * FROM v_fund_1789;

-- open debts (people who owe me for merch)
SELECT person_name, sum(amount_owed - amount_paid) AS balance
FROM merch_transactions
WHERE type = 'sale' AND person_name <> ''
GROUP BY person_name
HAVING sum(amount_owed - amount_paid) > 0
ORDER BY balance DESC;
```

---

## Doing admin work from Claude Code

1. **Read first.** Before mutating, run a `SELECT` to confirm what's there.
2. **Soft-delete, don't drop.** `financial_transactions` has `deleted_at` — set it instead of DELETE.
3. **Use `apply_migration` for DDL**, `execute_sql` for DML. Both go through the same MCP server.
4. **Realtime is wired.** The admin pages subscribe to `financial_transactions`, `merch_items`, `merch_transactions`, `playbook_items`, `plugverse_contacts`. Any insert/update from `execute_sql` (or a chat session writing playbook/contact rows) will show up on Cooper's open admin tab within ~350ms (debounced).
5. **RLS bypasses.** The Supabase MCP uses the service role, so all RLS is bypassed — you can read/write anything. Don't accidentally write to PlugVerse tables (project `yhemvsksnoojplnxirlv`) — that's a separate app.

### Adding a new transaction

```sql
INSERT INTO financial_transactions (date, description, amount, type, entity, category)
VALUES ('2026-05-13', 'Coffee at Caribou', 6.50, 'expense', 'personal', 'food');
-- The /admin/finance dashboard will refresh live.
```

### Editing without breaking the dashboard

The dashboard reads `financial_transactions WHERE deleted_at IS NULL`. To "delete" a row, set `deleted_at = now()`. To restore it, set `deleted_at = NULL`.

---

## Vercel serverless functions

Static-site repo with a small `/api/` directory for serverless functions. Auto-detected by Vercel — no Next.js, no build step, no `package.json` (functions use Node 20's built-in `fetch`).

### `/api/plugverse-kpi.mjs`

Aggregates Plugverse KPIs from three sources and persists daily snapshots:

- **PlugVerse Supabase** (`yhemvsksnoojplnxirlv`, read via `SUPABASE_SERVICE_ROLE_KEY` env var): users count, signups 24h/7d/30d, artist/fan counts, active subscriptions, churn 7d, MRR/ARR computed by joining `user_subscriptions` × `subscription_tiers`, total GMV cents, gigs completed.
- **Stripe** (`STRIPE_SECRET_KEY`): payouts pending + payouts paid month-to-date.
- **PostHog** (`POSTHOG_PERSONAL_API_KEY`, project `331986`, host defaults to `https://us.posthog.com`): top 5 events in the last 7 days via HogQL.

Each source is wrapped in `safe()` so a single outage doesn't blank the page — failed sources show up in the response's `errors` array and the corresponding KPI cards render `—`.

**Auth model:** the page sends `Authorization: Bearer <admin-supabase-jwt>` (from `sb.auth.getSession()`). The function hits `${ADMIN_URL}/auth/v1/user` to verify the JWT, then reads the caller's own `admin_allowlist` row (anon key + caller JWT) and requires `admin_role IN ('full','plugverse')`. No service-role key required for the auth check.

**Snapshot UPSERT:** every successful call writes one row to `plugverse_kpi_snapshots` keyed by today's date (`Prefer: resolution=merge-duplicates`). The function uses the user's JWT for the write, so RLS still applies. The dashboard reads the last 30 days for sparkline rendering.

### Required Vercel env vars (Production + Preview)

Every serverless function uses these — kept in one canonical table here so naming stays consistent across files.

| Var | Used by | Source |
|---|---|---|
| `STRIPE_SECRET_KEY` | plugverse-kpi | PlugVerse Stripe account → Developers → API keys (`sk_live_…`) |
| `POSTHOG_PERSONAL_API_KEY` | plugverse-kpi | posthog.com → Settings → Personal API keys, scope "Performing analytics queries", project 331986 |
| `SUPABASE_SERVICE_ROLE_KEY` | plugverse-kpi, acquisition-results (reads PlugVerse `users` for signup outcomes) | Supabase project `yhemvsksnoojplnxirlv` (PlugVerse) → Settings → API → service_role |
| `SUPABASE_ADMIN_SERVICE_ROLE_KEY` | instagram-oauth, `_lib/admin-auth.mjs` (role check for money-overview, acquisition, acquisition-results, band-review, band-media-source), band-review (signed URLs), band-media-source (vault read) | Supabase project `eibtnkaoqsgwiqttiwjo` (admin) → Settings → API → service_role |
| `INSTAGRAM_APP_ID` | instagram-oauth | developers.facebook.com → App → Settings → Basic → App ID |
| `INSTAGRAM_APP_SECRET` | instagram-oauth | same place → App Secret (sensitive — function only) |
| `IG_WEBHOOK_VERIFY_TOKEN` | instagram-webhook | Arbitrary string. Must match what's pasted into the Meta App webhook UI's "Verify token" field |
| `TIKTOK_CLIENT_KEY` | tiktok-oauth, tiktok-sync | developers.tiktok.com → App → Credentials → Client key |
| `TIKTOK_CLIENT_SECRET` | tiktok-oauth, tiktok-sync | same place → Client secret. Rotate via "Reset secret" if leaked |
| `CRON_SECRET` | cron-social-sync (auth), instagram-sync + tiktok-sync (bypass) | Arbitrary high-entropy string. Vercel auto-sends `Authorization: Bearer <CRON_SECRET>` on scheduled cron invocations. Set once in Vercel env so the daily sync can run without an admin JWT. |
| `POSTHOG_HOST` (optional) | plugverse-kpi | Override if EU/self-hosted. Defaults `https://us.posthog.com` |
| `POSTHOG_PROJECT` (optional) | plugverse-kpi | Override if project ID changes. Defaults `331986` |

### Private social analytics (after Stanley, 2026-09-28)

- **Instagram API** (per-post reach, views, saves, shares, avg watch time): connect via `/api/instagram-auth-start` -> Meta -> `/api/instagram-oauth` (stores long-lived token in `instagram_credentials`, one row per account). From then on Postgres owns it: pg_cron `ig-token-refresh` -> `public.ig_token_refresh()` (refreshes any token 6+ days old, forever), pg_cron `social-api-pull` -> `public.instagram_api_pull()` writes `social_post_snapshots` source `instagram-api`. `social_api_catchup()` (every 10 min) runs the first pull right after a new connection.
- **YouTube Analytics** (views, watch minutes, avg view duration per video): Supabase edge function `youtube-oauth` (verify_jwt off, checks is_full_admin itself). Google client id/secret live in `automation_secrets` (`google_oauth_client_id/_secret`), set from the Integrations page via `set_google_oauth_client(json)`. Refresh token in `youtube_credentials` (service role only). Pull: `public.youtube_analytics_pull()` in the same cron, source `youtube-analytics`, watch minutes in `social_post_snapshots.watch_minutes`.
- Token columns are not selectable by `authenticated`; the page reads `integration_sources_status()` only. Trigger `snapshot_keep_private_metrics` stops a later public pull from nulling private metrics on the same day.
- All pull functions log to `task_run_log` and write `social_pipeline_health` rows with handle `<handle> (api)`; with no token they log `quiet` and do nothing.
- `/api/cron-social-sync` no longer calls `/api/instagram-sync` (it created duplicate social_posts rows).

NOTE on the two Supabase service-role keys: there are TWO separate Supabase projects in this repo's orbit. `SUPABASE_SERVICE_ROLE_KEY` (no prefix) = the **PlugVerse** project. `SUPABASE_ADMIN_SERVICE_ROLE_KEY` (explicit) = the **admin** project. Don't mix them — they're different secrets that grant access to different databases.

If any required var is missing, the affected source returns an error message in the response payload — the page renders the other KPIs and shows the error banner.

## Public site notes

- Each top-level page is its own HTML file with inline `<style>` blocks scoped by section.
- Shared layout primitives live in `shell.css` (glass cards, .plate, .eyebrow, nav, footer, modal).
- `shell.js` handles custom cursor, reveal-on-scroll, page transitions, mobile menu, nav indicator, contact modal. Loading it on a new page makes those features just work.
- The portfolio's brand tokens are in `shell.css :root` (`--ink`, `--bg`, `--rust`, `--sage`, `--crimson`, etc.) — admin shell duplicates them in `admin-shell.css :root` so admin pages don't need to import `shell.css`.

---

## Deploy

Pushing to `main` auto-deploys via Vercel. `vercel.json` injects `X-Robots-Tag: noindex` + `no-store` on `/admin/*`, plus `Cache-Control: no-cache` on all root HTML so site updates are immediate.

```bash
git add . && git commit -m "..." && git push
# Vercel: 30-60s build, then live at cooperdelo.com
```

---

## Don't

- Don't add the resume-gpt or PlugVerse tables back into this project — they live elsewhere.
- Don't disable RLS on the seven admin tables. The advisor will scream and the anon key would gain read access.
- Don't switch the admin Supabase project back to PlugVerse (`yhemvsksnoojplnxirlv`) — that mixing was the bug we fixed.
- Don't create `.md` docs unless explicitly requested.
- Don't add cute emoji icons. Typography only. Stay aligned with the existing minimalist brand.
