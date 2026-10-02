import {authorize,privateResponse} from './_lib/admin-auth.mjs';
import {createOAuthState} from './_lib/oauth-state.mjs';
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
  if(req.method!=='POST')return privateResponse(res,405,{error:'Start from the signed-in Integrations page'});
  const auth=await authorize(req,['full']).catch(()=>({ok:false,status:503,error:'Permission check unavailable'}));if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
  res.setHeader('Cache-Control', 'no-store');
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) return privateResponse(res,503,{error:'Account connection is not configured'});
  const {state,cookie}=createOAuthState('ig',auth.userId);
  res.setHeader('Set-Cookie',cookie);
  return privateResponse(res,200,{url:buildAuthorizeUrl(appId,state)});
}
