# /admin — Cooper Delo Admin Console

Single-tenant admin shell that gates internal tools behind Supabase Auth. First tool: **/admin/finance**, the live replacement for `Cooper_Delo_Finances.xlsx`.

---

## Architecture

```
Browser  →  Static HTML at cooperdelo.com/admin/*
                │
                ▼  (Supabase JS client, Realtime subscriptions)
        Supabase Postgres (project yhemvsksnoojplnxirlv)
        ├── financial_transactions       ← single source of truth
        ├── finance_accounts             ← lookup
        ├── investment_positions
        ├── budget_targets
        ├── admin_allowlist              ← gates is_admin()
        └── views: v_monthly_summary, v_food_log, v_plugverse_pl,
                   v_fund_1789, v_tax_deductible
                │
                ├──►  Edge Function: notion-mirror  →  Notion DB
                └──►  XLSX export (on demand, in-browser via SheetJS)
```

## Security model

1. **Allowlist.** Only `delocooper6@gmail.com` is in `admin_allowlist`. `is_admin()` returns true only for that email.
2. **RLS on every table.** All policies require `is_admin()` for SELECT/INSERT/UPDATE/DELETE.
3. **Role grants.** Base GRANTs are limited to `authenticated`; `anon` has zero access.
4. **Client gate.** `admin-shell.js` calls `requireAdminOrRedirect()` on every page load.
5. **HTTP headers.** `vercel.json` injects `X-Robots-Tag: noindex` + no-cache for all `/admin/*`.
6. **robots.txt** disallows `/admin/`.

If someone hits `/admin/finance/` without a session, they get bounced to `/admin/login.html`. If they bypass the client gate (e.g. by hitting Supabase directly), RLS returns zero rows.

## File map

```
admin/
├── README.md                        ← you are here
├── login.html                       ← magic-link sign-in
├── index.html                       ← admin home (tool launcher)
├── _shell/
│   ├── admin-shell.css              ← extends portfolio shell.css
│   ├── admin-shell.js               ← auth gate + sidebar + toast
│   └── supabase.js                  ← shared client + helpers
└── finance/
    ├── index.html                   ← KPIs, charts, recent activity
    ├── transactions.html            ← list, filter, soft-delete, click-to-edit
    ├── entry.html                   ← add/edit single transaction
    ├── investments.html             ← Roth IRA + brokerage positions
    ├── plugverse.html               ← Plugverse P&L
    ├── fund.html                    ← 1789 Fund burn-down
    ├── food-log.html                ← monthly food log (for parents)
    ├── tax.html                     ← tax-deductible aggregates
    ├── export.html                  ← on-demand XLSX/CSV download
    ├── _js/                         ← page-specific logic
    └── _supabase/functions/notion-mirror/
        ├── index.ts
        └── README.md                ← one-time deploy instructions
```

## Deploy

```bash
cd F:\Github\Portfolio
git add admin/ vercel.json robots.txt
git commit -m "Add /admin shell with finance dashboard"
git push
# Vercel auto-deploys on push
```

Visit `cooperdelo.com/admin/login.html`, enter `delocooper6@gmail.com`, get the magic link, you're in.

## Notion mirror

Optional. To enable two-system sync (Supabase → Notion Financial Command Center), follow `finance/_supabase/functions/notion-mirror/README.md`. Until set up, Notion is stale — the webapp + Supabase are the source of truth.

## Adding a new admin tool

1. Create `admin/<tool>/index.html` (and `_js/` folder for logic).
2. Add nav entries to the `NAV` array in `admin/_shell/admin-shell.js`.
3. Add `<script type="module">` import of `mountShell({ title: '…' })`.
4. Use `import { sb } from '/admin/_shell/supabase.js'` — auth is automatic.

That's it. Auth, sidebar, layout, theme all come for free.
