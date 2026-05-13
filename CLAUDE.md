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
  index.html                     ← Admin home (tool launcher)
  _shell/
    admin-shell.css              ← Layout, tokens, components (left rail, cards, tables)
    admin-shell.js               ← mountShell() — auth gate + sidebar + toast
    supabase.js                  ← Shared sb client, isAdmin(), debounced realtime helpers
  finance/                       ← Finance dashboard suite
    index.html, transactions.html, entry.html, investments.html,
    plugverse.html, fund.html, funding.html, food-log.html, tax.html, export.html
    _js/                         ← Per-page logic
  merch/
    index.html                   ← Merch inventory + debt tracker (admin-styled)
  plugverse/
    index.html                   ← Plugverse KPIs dashboard (MRR, users, payouts, top events)
  social/
    index.html                   ← IG + TikTok unified dashboard (posts, engagement, account stats)
  playbook/
    index.html                   ← Brand/strategy/voice vault — filters, search, CRUD, realtime
    _js/playbook.js
/api/                            ← Vercel serverless functions
  plugverse-kpi.mjs              ← Aggregates Plugverse Supabase + Stripe + PostHog, writes daily snapshots
  instagram-oauth.mjs            ← Meta IG OAuth callback → upserts instagram_credentials
  instagram-webhook.mjs          ← Meta webhook verify (GET) + event ack (POST)
  instagram-sync.mjs             ← Pulls IG media + account stats → social_posts / social_post_metrics / social_account_snapshots
  tiktok-oauth.mjs               ← TikTok OAuth callback → upserts tiktok_credentials
  tiktok-sync.mjs                ← Pulls TikTok user info + videos with auto-refresh → social_* tables
  investments-sync.mjs           ← Pulls quotes from Yahoo Finance (stocks) + Coinbase spot (crypto, keyless) → updates investment_positions
```

---

## Supabase

**Project:** `eibtnkaoqsgwiqttiwjo` ("cooperdelo's Project")
**URL:** `https://eibtnkaoqsgwiqttiwjo.supabase.co`
**Use the Supabase MCP tools** for any DB work — `list_tables`, `execute_sql`, `apply_migration`, `get_logs`, `get_advisors`. The MCP is configured against this project.

### Tables (all in `public` schema, all RLS-gated by `is_admin()`)

| Table | Purpose | Key columns |
|---|---|---|
| `admin_allowlist` | Email allowlist for the admin gate | `email` (PK), `added_at` |
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

### Views (read-only summaries)

- `v_fund_1789` — total_received / total_spent / remaining for `funding_source = '1789_fund'`
- `v_funding_balance` — generic version of v_fund_1789, one row per funding source: `slug, display_name, is_active, award_amount, total_received, total_spent, remaining, started_at, exhausted_at`
- `v_monthly_summary` — `month, entity, type, category, tx_count, total`
- `v_food_log` — food log rows (`is_food_log = true`)
- `v_plugverse_pl` — monthly P&L for `entity = 'plugverse'`
- `v_tax_deductible` — `tax_year, tax_category, tx_count, deductible_amount, gross_amount`
- `v_playbook_active` — `playbook_items` filtered to `deleted_at IS NULL AND status='active' AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`. The admin page reads this view, not the raw table.

### Function

- `is_admin()` — returns `true` iff `auth.jwt() ->> 'email'` is in `admin_allowlist`. Every RLS policy uses this.

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

- Magic-link only. Password field in `login.html` is a client-side gate that gates whether to call `sendMagicLink()`.
- Admin email (only one allowed): `delocooper6@gmail.com`
- Admin password (rotate by editing the constant in `admin/login.html`): currently `plugverse2026`
- Auth URL allowlist + Site URL configured in Supabase dashboard → Authentication → URL Configuration. Must include `https://cooperdelo.com/admin/**`.

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
4. **Realtime is wired.** The admin pages subscribe to `financial_transactions`, `merch_items`, `merch_transactions`, `playbook_items`. Any insert/update from `execute_sql` (or a chat session writing playbook rows) will show up on Cooper's open admin tab within ~350ms (debounced).
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

- **PlugVerse Supabase** (`yhemvsksnoojplnxirlv`, read via `PLUGVERSE_SUPABASE_SERVICE_ROLE` env var): users count, signups 24h/7d/30d, artist/fan counts, active subscriptions, churn 7d, MRR/ARR computed by joining `user_subscriptions` × `subscription_tiers`, total GMV cents, gigs completed.
- **Stripe** (`STRIPE_SECRET_KEY`): payouts pending + payouts paid month-to-date.
- **PostHog** (`POSTHOG_API_KEY`, project `331986`, host defaults to `https://us.posthog.com`): top 5 events in the last 7 days via HogQL.

Each source is wrapped in `safe()` so a single outage doesn't blank the page — failed sources show up in the response's `errors` array and the corresponding KPI cards render `—`.

**Auth model:** the page sends `Authorization: Bearer <admin-supabase-jwt>` (from `sb.auth.getSession()`). The function hits `${ADMIN_URL}/auth/v1/user` to verify the JWT and checks the email is the admin allowlist email. No service-role key required for the auth check.

**Snapshot UPSERT:** every successful call writes one row to `plugverse_kpi_snapshots` keyed by today's date (`Prefer: resolution=merge-duplicates`). The function uses the user's JWT for the write, so RLS still applies. The dashboard reads the last 30 days for sparkline rendering.

### Required Vercel env vars (Production + Preview)

Every serverless function uses these — kept in one canonical table here so naming stays consistent across files.

| Var | Used by | Source |
|---|---|---|
| `STRIPE_SECRET_KEY` | plugverse-kpi | PlugVerse Stripe account → Developers → API keys (`sk_live_…`) |
| `POSTHOG_PERSONAL_API_KEY` | plugverse-kpi | posthog.com → Settings → Personal API keys, scope "Performing analytics queries", project 331986 |
| `SUPABASE_SERVICE_ROLE_KEY` | plugverse-kpi | Supabase project `yhemvsksnoojplnxirlv` (PlugVerse) → Settings → API → service_role |
| `SUPABASE_ADMIN_SERVICE_ROLE_KEY` | instagram-oauth (and any future admin-DB writer) | Supabase project `eibtnkaoqsgwiqttiwjo` (admin) → Settings → API → service_role |
| `INSTAGRAM_APP_ID` | instagram-oauth | developers.facebook.com → App → Settings → Basic → App ID |
| `INSTAGRAM_APP_SECRET` | instagram-oauth | same place → App Secret (sensitive — function only) |
| `IG_WEBHOOK_VERIFY_TOKEN` | instagram-webhook | Arbitrary string. Must match what's pasted into the Meta App webhook UI's "Verify token" field |
| `TIKTOK_CLIENT_KEY` | tiktok-oauth, tiktok-sync | developers.tiktok.com → App → Credentials → Client key |
| `TIKTOK_CLIENT_SECRET` | tiktok-oauth, tiktok-sync | same place → Client secret. Rotate via "Reset secret" if leaked |
| `POSTHOG_HOST` (optional) | plugverse-kpi | Override if EU/self-hosted. Defaults `https://us.posthog.com` |
| `POSTHOG_PROJECT` (optional) | plugverse-kpi | Override if project ID changes. Defaults `331986` |

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
