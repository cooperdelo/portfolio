// =====================================================================
// /api/plugverse-kpi.mjs
// Vercel serverless function that aggregates KPIs for the Plugverse
// admin dashboard from three sources:
//   1. PlugVerse Supabase  (users, subscriptions, GMV)
//   2. Stripe              (payouts, Stripe-side revenue)
//   3. PostHog             (top events, conversion funnel)
//
// Auth model: the admin page hits this endpoint with an Authorization:
// Bearer <admin-supabase-jwt> header. We verify the JWT belongs to the
// allowlisted admin email; everything else gets 401/403.
//
// Side effect: on every successful call we UPSERT a row into
// plugverse_kpi_snapshots (one row per date). This builds the history
// the dashboard's sparklines read from.
// =====================================================================

const ADMIN_URL  = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const ADMIN_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYnRua2FvcXNnd2lxdHRpd2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTI4MTYsImV4cCI6MjA2NzU4ODgxNn0.8gBRu_k_4YPVOq8rf8dfuyXKbCSgqZ4UQeoIXUIlgxo';

const PV_URL = 'https://yhemvsksnoojplnxirlv.supabase.co';

const POSTHOG_HOST    = process.env.POSTHOG_HOST    || 'https://us.posthog.com';
const POSTHOG_PROJECT = process.env.POSTHOG_PROJECT || '331986';

// ---------- auth ----------

async function verifyAdminJwt(jwt) {
  if (!jwt) return { ok: false, status: 401, error: 'missing token' };
  const r = await fetch(`${ADMIN_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON },
  });
  if (!r.ok) return { ok: false, status: 401, error: 'invalid token' };
  const u = await r.json();
  // Plugverse KPIs are accessible to anyone in the admin_allowlist (both
  // full and plugverse-scoped admins). The allowlist policy is self-read,
  // so this query returns a row only if the caller is allowlisted.
  const a = await fetch(`${ADMIN_URL}/rest/v1/admin_allowlist?select=admin_role&email=eq.${encodeURIComponent(u.email || '')}`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON } });
  if (!a.ok) return { ok: false, status: 403, error: 'forbidden' };
  const rows = await a.json();
  if (!rows.length) return { ok: false, status: 403, error: 'forbidden' };
  return { ok: true, user: u, role: rows[0].admin_role };
}

// ---------- helpers ----------

const iso = (d) => d.toISOString();
const todayDate = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

// Wrap fetch so a single source failing doesn't kill the whole response.
async function safe(label, fn) {
  try { return { ok: true, label, value: await fn() }; }
  catch (e) { return { ok: false, label, error: e?.message || String(e) }; }
}

// ---------- PlugVerse Supabase fetchers ----------

async function pvCount(path, headers) {
  const r = await fetch(`${PV_URL}/rest/v1/${path}`, {
    headers: { ...headers, Prefer: 'count=exact' },
  });
  if (!r.ok) throw new Error(`pv ${path} → ${r.status} ${await r.text()}`);
  const range = r.headers.get('content-range') || '';
  return parseInt(range.split('/')[1] || '0', 10);
}

async function pvSelect(path, headers) {
  const r = await fetch(`${PV_URL}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`pv ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function fetchPlugverseKpis() {
  // SUPABASE_SERVICE_ROLE_KEY is Plugverse's service role (project yhemvsksnoojplnxirlv).
  // The admin DB uses SUPABASE_ADMIN_SERVICE_ROLE_KEY — different project.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY env var not set (PlugVerse service role)');
  const h = { apikey: key, Authorization: `Bearer ${key}` };

  const since24 = iso(daysAgo(1));
  const since7  = iso(daysAgo(7));
  const since30 = iso(daysAgo(30));

  const [
    usersTotal,
    signups24h,
    signups7d,
    signups30d,
    artistsTotal,
    artistsOnboarded,
    fansTotal,
    activeSubs,
    churn7d,
    activeSubsRows,
    tiers,
    gmvAgg,
  ] = await Promise.all([
    pvCount(`users?select=id&deleted_at=is.null`, h),
    pvCount(`users?select=id&deleted_at=is.null&created_at=gte.${since24}`, h),
    pvCount(`users?select=id&deleted_at=is.null&created_at=gte.${since7}`, h),
    pvCount(`users?select=id&deleted_at=is.null&created_at=gte.${since30}`, h),
    pvCount(`artist_profiles?select=id`, h),
    pvCount(`artist_profiles?select=id&stripe_connect_onboarded=eq.true`, h),
    pvCount(`fan_profiles?select=id`, h),
    // Billable-only filters: stripe_subscription_id IS NOT NULL excludes
    // comp / admin-grant rows that have status='active' but no Stripe billing
    // attached. Without this, our own admin grants inflate MRR. The plugverse
    // data model uses user_subscriptions for both paid subs and feature-access
    // grants, so we have to discriminate at query time.
    pvCount(`user_subscriptions?select=id&status=eq.active&stripe_subscription_id=not.is.null`, h),
    pvCount(`user_subscriptions?select=id&cancelled_at=gte.${since7}&stripe_subscription_id=not.is.null`, h),
    pvSelect(`user_subscriptions?select=tier_id,billing_interval,status&status=eq.active&stripe_subscription_id=not.is.null`, h),
    pvSelect(`subscription_tiers?select=id,name,price_monthly,price_annually`, h),
    pvSelect(`users?select=total_gmv_cents,total_gigs_completed&deleted_at=is.null`, h),
  ]);

  // MRR: for each active sub, add monthly price (or annual / 12)
  const tierById = Object.fromEntries(tiers.map(t => [t.id, t]));
  let mrrCents = 0;
  for (const s of activeSubsRows) {
    const t = tierById[s.tier_id]; if (!t) continue;
    if (s.billing_interval === 'monthly') mrrCents += Number(t.price_monthly || 0);
    else if (s.billing_interval === 'yearly' || s.billing_interval === 'annual') mrrCents += Number(t.price_annually || 0) / 12;
  }
  mrrCents = Math.round(mrrCents);
  const arrCents = mrrCents * 12;

  const totalGmvCents = gmvAgg.reduce((a, r) => a + Number(r.total_gmv_cents || 0), 0);
  const totalGigsCompleted = gmvAgg.reduce((a, r) => a + Number(r.total_gigs_completed || 0), 0);

  return {
    users_total: usersTotal,
    signups_24h: signups24h,
    signups_7d: signups7d,
    signups_30d: signups30d,
    artists_total: artistsTotal,
    artists_onboarded: artistsOnboarded,
    fans_total: fansTotal,
    active_subscriptions: activeSubs,
    churn_7d: churn7d,
    mrr_cents: mrrCents,
    arr_cents: arrCents,
    total_gmv_cents: totalGmvCents,
    total_gigs_completed: totalGigsCompleted,
  };
}

// ---------- Stripe fetchers ----------

async function stripeGet(path, params = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY env var not set');
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.stripe.com/v1/${path}${qs ? '?' + qs : ''}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`stripe ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function fetchStripeKpis() {
  // Payouts in the current calendar month
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const since = Math.floor(monthStart.getTime() / 1000);

  const [pending, paid] = await Promise.all([
    stripeGet('payouts', { 'status': 'pending',     'limit': '100' }),
    stripeGet('payouts', { 'status': 'paid', 'created[gte]': String(since), 'limit': '100' }),
  ]);

  const payoutsPendingCents     = (pending.data || []).reduce((a, p) => a + Number(p.amount || 0), 0);
  const payoutsCompletedMtdCents = (paid.data    || []).reduce((a, p) => a + Number(p.amount || 0), 0);

  return { payouts_pending_cents: payoutsPendingCents, payouts_completed_mtd_cents: payoutsCompletedMtdCents };
}

// ---------- PostHog fetchers ----------

async function posthogQuery(hogql) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) throw new Error('POSTHOG_PERSONAL_API_KEY env var not set');
  const r = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogql } }),
  });
  if (!r.ok) throw new Error(`posthog → ${r.status} ${await r.text()}`);
  return r.json();
}

async function fetchPosthogKpis() {
  // Top 5 events in the last 7 days
  const top = await posthogQuery(`
    SELECT event, count() AS n
    FROM events
    WHERE timestamp > now() - INTERVAL 7 DAY
    GROUP BY event
    ORDER BY n DESC
    LIMIT 5
  `);
  const topEvents = (top.results || []).map(([event, n]) => ({ event, count: Number(n) }));
  return { top_events_7d: topEvents };
}

// ---------- Snapshot upsert ----------

async function upsertSnapshot(jwt, row) {
  const r = await fetch(`${ADMIN_URL}/rest/v1/plugverse_kpi_snapshots`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ADMIN_ANON,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`snapshot upsert → ${r.status} ${await r.text()}`);
}

async function fetchHistory(jwt) {
  const r = await fetch(
    `${ADMIN_URL}/rest/v1/plugverse_kpi_snapshots?select=*&order=date.desc&limit=30`,
    { headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON } },
  );
  if (!r.ok) return [];
  return r.json();
}

// ---------- Handler ----------

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const auth = await verifyAdminJwt(jwt);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // Fan out — each source is best-effort so one outage doesn't blank the page.
  const [pv, stripe, posthog] = await Promise.all([
    safe('plugverse', fetchPlugverseKpis),
    safe('stripe',    fetchStripeKpis),
    safe('posthog',   fetchPosthogKpis),
  ]);

  const errors = [pv, stripe, posthog].filter(x => !x.ok).map(x => ({ source: x.label, error: x.error }));
  const data = {
    ...(pv.value      || {}),
    ...(stripe.value  || {}),
    ...(posthog.value || {}),
  };

  // Persist a snapshot row for today (UPSERT — latest visit wins).
  try {
    await upsertSnapshot(jwt, {
      date: todayDate(),
      mrr_cents:                   data.mrr_cents ?? null,
      arr_cents:                   data.arr_cents ?? null,
      active_subscriptions:        data.active_subscriptions ?? null,
      users_total:                 data.users_total ?? null,
      signups_24h:                 data.signups_24h ?? null,
      signups_7d:                  data.signups_7d ?? null,
      churn_7d:                    data.churn_7d ?? null,
      payouts_pending_cents:       data.payouts_pending_cents ?? null,
      payouts_completed_mtd_cents: data.payouts_completed_mtd_cents ?? null,
      top_events_7d:               data.top_events_7d ?? null,
      raw:                         data,
    });
  } catch (e) {
    errors.push({ source: 'snapshot', error: e?.message || String(e) });
  }

  const history = await fetchHistory(jwt);

  return res.status(200).json({
    captured_at: new Date().toISOString(),
    data,
    history,
    errors: errors.length ? errors : undefined,
  });
}
