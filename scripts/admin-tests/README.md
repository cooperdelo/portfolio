# Admin integration verification

Run from the portfolio repository. Never infer production readiness from a passing mock test.

## Checks

- `node --test scripts/admin-tests/*.test.mjs`: eligibility, attribution semantics, private API role checks. These are contracts, not a connected acquisition owner.
- `python -m unittest discover -s scripts/admin-tests -p test_vault_sync.py`: actual vault scripts with isolated files and mocked transport.
- `python scripts/admin-db-query.py scripts/admin-tests/permissions.sql --write`: live transaction that rolls back a synthetic limited role; checks private rows, invoker views and guarded RPCs.
- `python scripts/admin-db-query.py scripts/admin-tests/band-roundtrip.sql --write`: real transactional review persistence, idempotency, stale revision, collision and timestamp checks; rolls back fixtures.
- `node scripts/admin-tests/live-api.mjs`: disposable Supabase Auth identity, actual API handlers, private storage stream, product outcomes, dated money sources and revocation. Deletes its tagged identity and records in `finally`; no emails or original-media changes.
- `node scripts/admin-tests/browser-server.mjs`: loopback-only authenticated test server, 45-minute expiry and cleanup. Not a deployed route. Use `/__audit`, then normal pages. Never expose this server externally.

## September 30 evidence

Thirteen Node tests and seven isolated sync tests passed. Both live SQL suites passed. Live Auth/API tests passed eleven checks, including review read-back/retry/conflict, non-public stream, source reads and revoked/logged-out denial. Browser review save survived refresh. The Money page showed source dates and had no horizontal overflow at 390px. This does not certify field performance, all roles or a complete media workflow.

The existing vault sync also passed a real cloud-to-file read-back, unchanged retry and local/cloud conflict. Its private evidence stays in the existing vault's outreach/automation folder.

## Release limitations

The Claude board source uses its artifact database. No complete database export or supported external write adapter is connected. Acquisition writes intentionally remain disabled. Karthik has not been invited and his login identity is unknown. Product account creation is visible, but sender attribution, test-user registry and real-gig verification are incomplete. Forty-two band videos are indexed; one private proxy is prepared. Band sharing, automatic Drive refresh and rendered exports are pending. No production-ready claim is made.

## Migrations and recovery

Apply the dated files under `scripts/migrations` in this order: limited-admin-boundary, health-photo-access, band-review, band-business-conflict, band-trim-integrity. They were applied to the existing portfolio-admin project during this audit. No product-finance migration is involved. Existing operational acquisition records were not moved.

Recover the frontend through Git to the previous revision if needed. Keep permission hardening in place; rolling back a page is not a reason to reopen private data. Band records and originals should be preserved; disable the review route before a schema rollback, export its records privately, and reconcile any later edits forward. Never reactivate two writable acquisition owners or overwrite newer send history with a snapshot.

For deployed verification, set ADMIN_TEST_DEPLOYMENT to the exact protected preview URL before running live-api.mjs. It uses the existing Vercel CLI authentication and project protection token without printing credentials. September 30: the first nine checks passed against deployment 4cc00da; all eleven expanded checks passed against 6a62ab9. The independent review also found and fixed half-range trim acceptance, historical-award inclusion, a broken Investments link and silent media collection truncation.
