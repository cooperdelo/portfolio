// =====================================================================
// /api/instagram-oauth.mjs
// Handles Meta's OAuth callback for the Instagram API (Instagram Login).
//
// Flow:
//   1. User clicks "Connect Instagram" on the admin page (built separately).
//      That redirects to api.instagram.com/oauth/authorize?... with this URL
//      as the redirect_uri.
//   2. User signs in on Instagram, approves scopes.
//   3. Meta redirects back here with ?code=<auth_code>.
//   4. We exchange the code for a short-lived token (1 hour).
//   5. Exchange the short-lived for a long-lived token (~60 days).
//   6. UPSERT into instagram_credentials using the service-role admin client.
//   7. Redirect the user to /admin/social/instagram/?connected=1 (or whatever
//      page is up at the time — for now we render a simple success page).
//
// Env vars:
//   INSTAGRAM_APP_ID            — App ID from developers.facebook.com → App → Settings → Basic
//   INSTAGRAM_APP_SECRET        — App Secret from same place (NEVER ship to client)
//   ADMIN_SUPABASE_SERVICE_ROLE — service_role key for project eibtnkaoqsgwiqttiwjo
//   IG_OAUTH_REDIRECT (optional) — override redirect URI if needed; defaults to this endpoint
// =====================================================================

const ADMIN_URL    = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';
const PUBLIC_URL   = 'https://www.cooperdelo.com';
const REDIRECT_URI = process.env.IG_OAUTH_REDIRECT || `${PUBLIC_URL}/api/instagram-oauth`;

// ---- HTML renderers (no template engine, just strings) ----

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

function pageSuccess(username, igUserId) {
  return htmlOk('Instagram connected', `
    <div class="eyebrow">Instagram · Connected</div>
    <h1>Linked to @${username}</h1>
    <p>Long-lived access token stored. Auto-refresh runs before expiry. You can close this tab.</p>
    <p><a href="/admin/">← Back to admin</a></p>
    <pre>ig_user_id: ${igUserId}</pre>
  `);
}

function pageError(title, detail) {
  return htmlOk('Instagram connection failed', `
    <div class="eyebrow" style="color:#FF4D2E">Instagram · Failed</div>
    <h1>${title}</h1>
    <p>${detail}</p>
    <p><a href="/admin/">← Back to admin</a></p>
  `);
}

// ---- Token exchange helpers ----

async function exchangeCodeForShortToken(code) {
  const body = new URLSearchParams({
    client_id:     process.env.INSTAGRAM_APP_ID,
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    grant_type:    'authorization_code',
    redirect_uri:  REDIRECT_URI,
    code,
  });
  const r = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`code → short token: ${r.status} ${await r.text()}`);
  return r.json(); // { access_token, user_id, permissions }
}

async function exchangeShortForLong(shortToken) {
  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', process.env.INSTAGRAM_APP_SECRET);
  url.searchParams.set('access_token', shortToken);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`short → long token: ${r.status} ${await r.text()}`);
  return r.json(); // { access_token, token_type, expires_in (seconds) }
}

async function fetchIgProfile(igUserId, accessToken) {
  const url = new URL(`https://graph.instagram.com/v21.0/${igUserId}`);
  url.searchParams.set('fields', 'id,username,account_type');
  url.searchParams.set('access_token', accessToken);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`profile fetch: ${r.status} ${await r.text()}`);
  return r.json();
}

// ---- Persist to admin DB ----

async function upsertCredentials(row) {
  const svc = process.env.ADMIN_SUPABASE_SERVICE_ROLE;
  if (!svc) throw new Error('ADMIN_SUPABASE_SERVICE_ROLE env var not set');
  const r = await fetch(`${ADMIN_URL}/rest/v1/instagram_credentials`, {
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

// ---- Handler ----

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Surface Meta-reported errors (user denied permission, etc.)
  const errReason = req.query.error_reason || req.query.error;
  if (errReason) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(pageError(
      'Authorization cancelled',
      `Instagram returned: ${String(errReason)} — ${String(req.query.error_description || '').replace(/</g,'&lt;')}`
    ));
  }

  const code = req.query.code;
  if (!code) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(pageError('Missing code', 'No auth code in callback. Re-start the connect flow from /admin/.'));
  }

  if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(pageError(
      'Server not configured',
      'INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be set in Vercel env. Add them and redeploy.'
    ));
  }

  try {
    const shortTok = await exchangeCodeForShortToken(String(code));
    const longTok  = await exchangeShortForLong(shortTok.access_token);

    const igUserId = String(shortTok.user_id);
    let username   = null;
    try {
      const profile = await fetchIgProfile(igUserId, longTok.access_token);
      username = profile.username || null;
    } catch (_) { /* non-fatal */ }

    const expiresAt = new Date(Date.now() + Number(longTok.expires_in || 5184000) * 1000).toISOString();

    await upsertCredentials({
      ig_user_id:    igUserId,
      username,
      access_token:  longTok.access_token,
      token_type:    longTok.token_type || 'long_lived',
      expires_at:    expiresAt,
      connected_email: null,
      refreshed_at:  new Date().toISOString(),
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(pageSuccess(username || 'instagram', igUserId));
  } catch (e) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(pageError('Token exchange failed', String(e?.message || e).replace(/</g,'&lt;')));
  }
}
