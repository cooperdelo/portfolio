# Life & Ops — agent sync contract

These pages are **read-only** for Cooper. They render a seeded data block that the
nightly/weekly vault agent is responsible for keeping current. Cooper never edits them.

## Pages & their data source (vault → page)

| Page | File | Refresh from |
|---|---|---|
| Life · Review | `admin/life/index.html` | `Context/user.md` (domain scores, north star, Q priorities), `Context/commitments.md` (this-week focus) |
| Life · Relationships | `admin/life/relationships.html` | `People/*.md` (reconnect queue, anchors), `Context/memory.md` (isolation pattern) |
| Life · Music | `admin/life/music.html` | Rubber Band + Cooper Delo notes, finance `band_income` |
| Build · Ops | `admin/plugverse/ops.html` | `Projects/plugverse/` (pipeline, team, QA), `People/*.md` with `lead: true` |

## How to sync

Each page contains a clearly marked block:

```
// ==== AGENT-SYNCED DATA (nightly/weekly agent rewrites this block ...) ====
const SYNCED = 'YYYY-MM-DD';
const <arrays> = [ ... ];
// =========================================================================
```

Nightly/weekly job: regenerate those arrays from the vault, bump `SYNCED` to the run
date, write the file, and `git commit && git push` (Vercel auto-deploys). Keep the array
shapes identical — only values change.

## Leads intake rule (per Cooper, 2026-07-24)

Everyone Cooper mentions in connection with Plugverse gets a `People/<name>.md` lead
profile (`lead: true`, priority, next_action) **and** appears in the Ops pipeline here.
Track them all — no potential venue/artist/connector gets dropped.
