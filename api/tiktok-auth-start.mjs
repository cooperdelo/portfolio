import {authorize,privateResponse} from './_lib/admin-auth.mjs';
import {createOAuthState} from './_lib/oauth-state.mjs';
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
  if(req.method!=='POST')return privateResponse(res,405,{error:'Start from the signed-in Integrations page'});
  const auth=await authorize(req,['full']).catch(()=>({ok:false,status:503,error:'Permission check unavailable'}));if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
  res.setHeader('Cache-Control', 'no-store');

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return privateResponse(res,503,{error:'Account connection is not configured'});

  // CSRF state — short-lived, echoed back by TikTok. Stored in a cookie the
  // callback can read if you want to verify; harmless if unused.
  const {state,cookie}=createOAuthState('tt',auth.userId);
  res.setHeader('Set-Cookie',cookie);

  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);

  return privateResponse(res,200,{url:url.toString()});
}
