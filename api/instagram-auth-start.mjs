// =====================================================================
// /api/instagram-auth-start.mjs
// "Connect Instagram" on /admin/integrations/ links here. Builds the
// Instagram API with Instagram Login authorize URL server-side (app id stays
// in Vercel env) and sends the browser to Instagram. The callback is the
// already-registered /api/instagram-oauth.
//
// force_reauth=true makes Instagram ask which account to use, so the same
// button connects @cooperdelo and then @plugverse.app.
// After connect, Postgres takes over: ig_token_refresh() keeps the token
// alive forever and instagram_api_pull() writes daily per-post insights.
// =====================================================================

const PUBLIC_URL   = 'https://www.cooperdelo.com';
const REDIRECT_URI = process.env.IG_OAUTH_REDIRECT || `${PUBLIC_URL}/api/instagram-oauth`;
const SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'].join(',');

export function buildAuthorizeUrl(appId, state) {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('force_reauth', 'true');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  return url.toString();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    res.statusCode = 302;
    res.setHeader('Location', '/admin/integrations/?oauth_error=' + encodeURIComponent('instagram: app id missing in Vercel env'));
    return res.end();
  }
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  res.setHeader('Set-Cookie', `ig_oauth_state=${state}; Path=/api; Max-Age=900; HttpOnly; Secure; SameSite=Lax`);
  res.statusCode = 302;
  res.setHeader('Location', buildAuthorizeUrl(appId, state));
  res.end();
}
