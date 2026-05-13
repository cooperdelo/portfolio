// =====================================================================
// /api/instagram-sync.mjs
// Pulls latest Instagram data via Graph API (Instagram Login flavor) and
// persists into the unified social_* tables. Called by /admin/social/ on
// each visit + Refresh-now button. Admin-JWT gated.
// =====================================================================

const ADMIN_URL  = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const ADMIN_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYnRua2FvcXNnd2lxdHRpd2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTI4MTYsImV4cCI6MjA2NzU4ODgxNn0.8gBRu_k_4YPVOq8rf8dfuyXKbCSgqZ4UQeoIXUIlgxo';
const ADMIN_EMAIL = 'delocooper6@gmail.com';

async function verifyAdminJwt(jwt) {
  if (!jwt) return { ok: false, status: 401 };
  const r = await fetch(`${ADMIN_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON },
  });
  if (!r.ok) return { ok: false, status: 401 };
  const u = await r.json();
  if (u.email !== ADMIN_EMAIL) return { ok: false, status: 403 };
  return { ok: true };
}

const svcHeaders = () => {
  const svc = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if (!svc) throw new Error('SUPABASE_ADMIN_SERVICE_ROLE_KEY env var not set');
  return { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' };
};

async function getLatestCreds() {
  const h = svcHeaders();
  const r = await fetch(`${ADMIN_URL}/rest/v1/instagram_credentials?select=*&order=connected_at.desc&limit=1`, { headers: h });
  if (!r.ok) throw new Error(`creds load: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  if (!rows.length) throw new Error('No Instagram account connected. Run the OAuth flow first.');
  return rows[0];
}

async function igGet(path, params) {
  const url = new URL(`https://graph.instagram.com/${path}`);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const r = await fetch(url.toString());
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`ig ${path}: ${r.status} ${JSON.stringify(j.error || j)}`);
  return j;
}

async function upsertPost(post) {
  const r = await fetch(`${ADMIN_URL}/rest/v1/social_posts?on_conflict=platform,external_id`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(post),
  });
  if (!r.ok) throw new Error(`post upsert: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  return rows[0];
}

async function insertMetrics(metrics) {
  const r = await fetch(`${ADMIN_URL}/rest/v1/social_post_metrics`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(metrics),
  });
  if (!r.ok) throw new Error(`metrics insert: ${r.status} ${await r.text()}`);
}

async function upsertAccountSnapshot(row) {
  const r = await fetch(`${ADMIN_URL}/rest/v1/social_account_snapshots?on_conflict=date,platform`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`snapshot upsert: ${r.status} ${await r.text()}`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const auth = await verifyAdminJwt(jwt);
  if (!auth.ok) return res.status(auth.status).json({ error: 'unauthorized' });

  try {
    const cred = await getLatestCreds();
    const token = cred.access_token;

    // Use /me to sidestep ID-format ambiguity. The token identifies the account.
    // Graph API rejects the OAuth-returned user_id in some Instagram Login flows
    // because the ID format differs from the canonical Instagram Business Account ID.
    const profile = await igGet(`v21.0/me`, {
      fields: 'id,username,account_type,followers_count,follows_count,media_count',
      access_token: token,
    });

    const media = await igGet(`v21.0/me/media`, {
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: '25',
      access_token: token,
    });

    const today = new Date().toISOString().slice(0, 10);
    await upsertAccountSnapshot({
      date: today,
      platform: 'instagram',
      followers: profile.followers_count ?? null,
      following: profile.follows_count ?? null,
      posts_total: profile.media_count ?? null,
      handle: profile.username ?? null,
      raw: profile,
    });

    const postsOut = [];
    for (const m of (media.data || [])) {
      const hashtags = (m.caption || '').match(/#[\p{L}\p{N}_]+/gu) || [];
      const post = await upsertPost({
        platform: 'instagram',
        external_id: m.id,
        account_handle: profile.username || null,
        caption: m.caption || null,
        posted_at: m.timestamp || null,
        media_type: m.media_type || null,
        media_url: m.media_url || null,
        thumbnail_url: m.thumbnail_url || m.media_url || null,
        permalink: m.permalink || null,
        hashtags,
        raw: m,
        updated_at: new Date().toISOString(),
      });
      const likes    = Number(m.like_count     ?? 0);
      const comments = Number(m.comments_count ?? 0);
      await insertMetrics({
        post_id: post.id,
        likes,
        comments,
        engagement_pct: profile.followers_count ? ((likes + comments) / profile.followers_count) * 100 : null,
        raw: { source: 'media_list', like_count: likes, comments_count: comments },
      });
      postsOut.push({ ...post, latest: { likes, comments } });
    }

    return res.status(200).json({
      platform: 'instagram',
      handle: profile.username,
      followers: profile.followers_count,
      following: profile.follows_count,
      posts_total: profile.media_count,
      synced_at: new Date().toISOString(),
      posts: postsOut,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
