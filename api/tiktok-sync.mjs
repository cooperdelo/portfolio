// =====================================================================
// /api/tiktok-sync.mjs
// Pulls latest TikTok data via Display API and persists into social_*.
// Admin-JWT gated.
// =====================================================================

const ADMIN_URL  = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const ADMIN_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYnRua2FvcXNnd2lxdHRpd2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTI4MTYsImV4cCI6MjA2NzU4ODgxNn0.8gBRu_k_4YPVOq8rf8dfuyXKbCSgqZ4UQeoIXUIlgxo';
const ADMIN_EMAIL = 'delocooper6@gmail.com';

async function verifyAdminJwt(jwt) {
  if (!jwt) return { ok: false, status: 401 };
  const r = await fetch(`${ADMIN_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: ADMIN_ANON } });
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
  const r = await fetch(`${ADMIN_URL}/rest/v1/tiktok_credentials?select=*&order=connected_at.desc&limit=1`, { headers: h });
  if (!r.ok) throw new Error(`creds load: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  if (!rows.length) throw new Error('No TikTok account connected. Run the OAuth flow first.');
  return rows[0];
}

async function persistRefreshedToken(openId, tok) {
  const now = Date.now();
  const patch = {
    access_token:       tok.access_token,
    refresh_token:      tok.refresh_token || null,
    expires_at:         tok.expires_in         ? new Date(now + Number(tok.expires_in)         * 1000).toISOString() : null,
    refresh_expires_at: tok.refresh_expires_in ? new Date(now + Number(tok.refresh_expires_in) * 1000).toISOString() : null,
    refreshed_at:       new Date(now).toISOString(),
  };
  const url = `${ADMIN_URL}/rest/v1/tiktok_credentials?tiktok_user_id=eq.${encodeURIComponent(openId)}`;
  const r = await fetch(url, { method: 'PATCH', headers: svcHeaders(), body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(`creds patch: ${r.status} ${await r.text()}`);
}

async function refreshTiktokToken(cred) {
  const body = new URLSearchParams({
    client_key:    process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: cred.refresh_token,
  });
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body,
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`token refresh: ${r.status} ${JSON.stringify(j)}`);
  await persistRefreshedToken(cred.tiktok_user_id, j);
  return j.access_token;
}

async function ttGet(path, accessToken) {
  const r = await fetch(`https://open.tiktokapis.com/${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const j = await r.json();
  if (!r.ok || j.error?.code !== 'ok') throw new Error(`tt GET ${path}: ${r.status} ${JSON.stringify(j.error || j)}`);
  return j;
}

async function ttPost(path, accessToken, body) {
  const r = await fetch(`https://open.tiktokapis.com/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json();
  if (!r.ok || j.error?.code !== 'ok') throw new Error(`tt POST ${path}: ${r.status} ${JSON.stringify(j.error || j)}`);
  return j;
}

async function withAccessToken(cred, fn) {
  // If token is within 60s of expiry, refresh first.
  const now = Date.now();
  const exp = cred.expires_at ? new Date(cred.expires_at).getTime() : 0;
  let token = cred.access_token;
  if (cred.refresh_token && exp && exp - now < 60_000) {
    token = await refreshTiktokToken(cred);
  }
  try {
    return await fn(token);
  } catch (e) {
    // 401 → try one refresh + retry
    if (cred.refresh_token && String(e?.message || '').match(/401|access_token_invalid|token_expired/)) {
      token = await refreshTiktokToken(cred);
      return fn(token);
    }
    throw e;
  }
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

    const result = await withAccessToken(cred, async (token) => {
      const user = await ttGet(
        'v2/user/info/?fields=open_id,union_id,avatar_url,display_name,is_verified,follower_count,following_count,likes_count,video_count',
        token,
      );
      const profile = user.data?.user || {};

      const videos = await ttPost('v2/video/list/?fields=id,title,video_description,duration,cover_image_url,embed_link,create_time,view_count,like_count,comment_count,share_count', token, { max_count: 20 });
      const videoList = videos.data?.videos || [];

      return { profile, videos: videoList };
    });

    const { profile, videos } = result;
    const today = new Date().toISOString().slice(0, 10);
    await upsertAccountSnapshot({
      date: today,
      platform: 'tiktok',
      followers: profile.follower_count  ?? null,
      following: profile.following_count ?? null,
      posts_total: profile.video_count   ?? null,
      total_likes: profile.likes_count   ?? null,
      handle: profile.display_name       ?? null,
      raw: profile,
    });

    const postsOut = [];
    for (const v of videos) {
      const postedAt = v.create_time ? new Date(Number(v.create_time) * 1000).toISOString() : null;
      const post = await upsertPost({
        platform: 'tiktok',
        external_id: String(v.id),
        account_handle: profile.display_name || null,
        caption: v.video_description || v.title || null,
        posted_at: postedAt,
        media_type: 'VIDEO',
        media_url: v.embed_link || null,
        thumbnail_url: v.cover_image_url || null,
        permalink: v.embed_link || null,
        hashtags: ((v.video_description || '').match(/#[\p{L}\p{N}_]+/gu) || []),
        raw: v,
        updated_at: new Date().toISOString(),
      });
      const views    = Number(v.view_count    ?? 0);
      const likes    = Number(v.like_count    ?? 0);
      const comments = Number(v.comment_count ?? 0);
      const shares   = Number(v.share_count   ?? 0);
      await insertMetrics({
        post_id: post.id,
        views, likes, comments, shares,
        engagement_pct: views > 0 ? ((likes + comments + shares) / views) * 100 : null,
        raw: { source: 'video/list', v },
      });
      postsOut.push({ ...post, latest: { views, likes, comments, shares } });
    }

    return res.status(200).json({
      platform: 'tiktok',
      handle: profile.display_name,
      followers: profile.follower_count,
      following: profile.following_count,
      posts_total: profile.video_count,
      total_likes: profile.likes_count,
      synced_at: new Date().toISOString(),
      posts: postsOut,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
