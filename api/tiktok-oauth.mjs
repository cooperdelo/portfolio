// =====================================================================
// /api/tiktok-oauth.mjs
// Handles TikTok's OAuth callback for the Login Kit / Display API.
//
// Flow:
//   1. User clicks "Connect TikTok" on the admin page (built separately).
//      Page redirects to https://www.tiktok.com/v2/auth/authorize/?... with
//      this URL as redirect_uri.
//   2. User authorizes in TikTok, TikTok redirects back here with ?code=...
//   3. POST to https://open.tiktokapis.com/v2/oauth/token/ — code → access+refresh
//   4. POST to https://open.tiktokapis.com/v2/user/info/ — pull username, avatar
//   5. UPSERT into tiktok_credentials
//   6. Render a styled success page
//
// Env vars:
//   TIKTOK_CLIENT_KEY                — from developers.tiktok.com → App credentials
//   TIKTOK_CLIENT_SECRET             — from same place (NEVER ship to client)
//   SUPABASE_ADMIN_SERVICE_ROLE_KEY  — service_role for admin DB writes
//   TIKTOK_OAUTH_REDIRECT (optional) — override; defaults to this endpoint
// =====================================================================

const ADMIN_URL    = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const PUBLIC_URL   = 'https://www.cooperdelo.com';
const REDIRECT_URI = process.env.TIKTOK_OAUTH_REDIRECT || `${PUBLIC_URL}/api/tiktok-oauth`;

function htmlOk(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
body{margin:0;min-height:100vh;background:#0A0908;color:#F4EFE6;font-family:Geist,sans-serif;display:grid;place-items:center;padding:2rem;}
.card{max-width:520px;width:100%;padding:2.6rem 2.2rem;border:1px solid rgba(244,239,230,0.14);border-radius:22px;background:rgba(244,239,230,0.03);backdrop-filter:blur(28px);}
.eyebrow{font-family:"Geist Mono",monospace;font-size:0.65rem;letter-spacing:0.3em;text-transform:uppercase;color:#FF4D2E;margin-bottom:1.4rem;}
h1{font-family:"Geist",sans-serif;font-weight:600;font-size:1.8rem;line-height:1.15;letter-spacing:-0.01em;margin:0 0 1rem;}
p{font-size:1rem;line-height:1.55;color:#DDD4C5;margin:0 0 0.9rem;}
a{color:#FF4D2E;text-decoration:underline;text-underline-offset:3px;}
pre{font-family:"Geist Mono",monospace;font-size:0.72rem;padding:0.7rem 0.9rem;border-radius:8px;background:rgba(244,239,230,0.04);overflow-x:auto;margin:1rem 0 0;color:#DDD4C5;}
</style></head><body><div class="card">${body}</div></body></html>`;
}

function pageSuccess(username, openId) {
  return htmlOk('TikTok connected', `
    <div class="eyebrow">TikTok · Connected</div>
    <h1>Linked to @${username || 'tiktok'}</h1>
    <p>Access + refresh tokens stored. Refresh runs automatically before expiry. You can close this tab.</p>
    <p><a href="/admin/social/">→ Open social dashboard</a></p>
    <pre>open_id: ${openId}</pre>
  `);
}

function pageError(title, detail) {
  return htmlOk('TikTok connection failed', `
    <div class="eyebrow" style="color:#FF4D2E">TikTok · Failed</div>
    <h1>${title}</h1>
    <p>${detail}</p>
    <p><a href="/admin/">← Back to admin</a></p>
  `);
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    client_key:    process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type:    'authorization_code',
    redirect_uri:  REDIRECT_URI,
  });
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body,
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`token exchange: ${r.status} ${JSON.stringify(j)}`);
  return j; // { access_token, refresh_token, expires_in, refresh_expires_in, open_id, scope, token_type }
}

async function fetchTiktokUserInfo(accessToken) {
  const url = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,is_verified,follower_count,following_count,likes_count,video_count';
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = await r.json();
  if (!r.ok || j.error?.code !== 'ok') throw new Error(`user/info: ${r.status} ${JSON.stringify(j)}`);
  return j.data?.user || {};
}

async function upsertCredentials(row) {
  const svc = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if (!svc) throw new Error('SUPABASE_ADMIN_SERVICE_ROLE_KEY env var not set');
  const r = await fetch(`${ADMIN_URL}/rest/v1/tiktok_credentials`, {
    method: 'POST',
    headers: {
      apikey: svc,
      Authorization: `Bearer ${svc}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`db upsert: ${r.status} ${await r.text()}`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const errReason = req.query.error;
  if (errReason) {
    return res.status(400).send(pageError(
      'Authorization cancelled',
      `TikTok returned: ${String(errReason)} — ${String(req.query.error_description || '').replace(/</g, '&lt;')}`
    ));
  }

  const code = req.query.code;
  if (!code) {
    return res.status(400).send(pageError('Missing code', 'No auth code in callback. Re-start from /admin/social/.'));
  }
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    return res.status(500).send(pageError(
      'Server not configured',
      'TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set in Vercel env. Add them and redeploy.'
    ));
  }

  try {
    const tok = await exchangeCodeForTokens(String(code));
    let user = {};
    try { user = await fetchTiktokUserInfo(tok.access_token); } catch (_) { /* non-fatal */ }

    const now = Date.now();
    const row = {
      tiktok_user_id:     String(tok.open_id),
      union_id:           user.union_id || null,
      username:           user.display_name || null,   // TikTok's "display_name" is closest to handle
      display_name:       user.display_name || null,
      avatar_url:         user.avatar_url || null,
      access_token:       tok.access_token,
      refresh_token:      tok.refresh_token || null,
      scope:              tok.scope || null,
      token_type:         tok.token_type || 'Bearer',
      expires_at:         tok.expires_in         ? new Date(now + Number(tok.expires_in)         * 1000).toISOString() : null,
      refresh_expires_at: tok.refresh_expires_in ? new Date(now + Number(tok.refresh_expires_in) * 1000).toISOString() : null,
      refreshed_at:       new Date(now).toISOString(),
    };
    await upsertCredentials(row);

    return res.status(200).send(pageSuccess(user.display_name, tok.open_id));
  } catch (e) {
    return res.status(500).send(pageError('Token exchange failed', String(e?.message || e).replace(/</g, '&lt;')));
  }
}
