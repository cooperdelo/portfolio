// =====================================================================
// /api/tiktok-auth-start.mjs
// Kicks off the TikTok Login Kit OAuth flow. The admin "Connect TikTok"
// button links here. We build the authorize URL server-side so the
// client_key stays in Vercel env (never hardcoded in the static admin page).
//
// Whatever TikTok account authorizes here becomes THE connected account,
// because /api/tiktok-sync reads the most-recently-connected row. So to
// switch accounts, just hit Connect again and authorize with the new one.
//
// Env vars:
//   TIKTOK_CLIENT_KEY               — developers.tiktok.com -> App credentials
//   TIKTOK_OAUTH_REDIRECT (optional)— defaults to the callback below
// =====================================================================

const PUBLIC_URL   = 'https://www.cooperdelo.com';
const REDIRECT_URI = process.env.TIKTOK_OAUTH_REDIRECT || `${PUBLIC_URL}/api/tiktok-oauth`;

// Scopes must match what /api/tiktok-sync consumes:
//   user.info.basic / .profile / .stats  -> handle, avatar, follower/like/video counts
//   video.list                           -> recent videos + per-video metrics + captions
const SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'].join(',');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(
      '<pre style="font:14px monospace;padding:2rem">TIKTOK_CLIENT_KEY is not set in Vercel env.\n' +
      'Add it (Settings -> Environment Variables) and redeploy, then click Connect again.</pre>'
    );
  }

  // CSRF state — short-lived, echoed back by TikTok. Stored in a cookie the
  // callback can read if you want to verify; harmless if unused.
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  res.setHeader('Set-Cookie', `tt_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);

  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);

  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.end();
}
