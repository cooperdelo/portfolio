// =====================================================================
// /api/cron-social-sync.mjs
// Vercel cron entry point. Daily at 13:00 UTC (9am ET), calls the TikTok
// sync endpoint with the shared CRON_SECRET so it bypasses admin-JWT.
// =====================================================================

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET not set' });

  // Vercel cron sets Authorization: Bearer <CRON_SECRET> on incoming requests.
  // We also accept explicit X-Cron-Secret for manual invocations.
  const authz = req.headers.authorization || '';
  const xcs   = req.headers['x-cron-secret'] || '';
  if (authz !== `Bearer ${secret}` && xcs !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const base = `https://${req.headers.host || 'www.cooperdelo.com'}`;
  const callSync = async (path) => {
    try {
      const r = await fetch(`${base}${path}`, {
        method: 'GET',
        headers: { 'x-cron-secret': secret, 'Cache-Control': 'no-store' },
      });
      const j = await r.json().catch(() => ({}));
      return { path, ok: r.ok, status: r.status, summary: r.ok
        ? { handle: j.handle, posts_total: j.posts_total, synced: (j.posts || []).length, error: j.error || null }
        : { error: j.error || `HTTP ${r.status}` } };
    } catch (e) {
      return { path, ok: false, status: 0, summary: { error: String(e?.message || e) } };
    }
  };

  // Instagram is no longer pulled here (2026-09-28). Postgres owns it now:
  // pg_cron 'social-api-pull' -> public.instagram_api_pull() writes per-post
  // insights into social_post_snapshots for every connected account, and
  // 'ig-token-refresh' keeps the tokens alive. /api/instagram-sync stays for
  // manual use only; calling it daily created duplicate social_posts rows.
  const tt = await callSync('/api/tiktok-sync');

  const ok = tt.ok;
  return res.status(ok ? 200 : 207).json({
    ran_at: new Date().toISOString(),
    ok,
    results: [tt],
  });
}
