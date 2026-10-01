import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const BASE='https://eibtnkaoqsgwiqttiwjo.supabase.co';
const key=()=>process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
export const cookieName=provider=>`${provider}_admin_oauth`;
export function clearOAuthCookie(provider){return `${cookieName(provider)}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;}
export function createOAuthState(provider,userId,now=Date.now()){
 if(!key())throw Error('Admin connection unavailable');
 const state=randomBytes(32).toString('hex');
 const payload=Buffer.from(JSON.stringify({userId,state,expires:now+600000})).toString('base64url');
 const signature=createHmac('sha256',key()).update(provider+'.'+payload).digest('base64url');
 return {state,cookie:`${cookieName(provider)}=${payload}.${signature}; Path=/api; Max-Age=600; HttpOnly; Secure; SameSite=Lax`};
}
export function readOAuthState(req,provider,now=Date.now()){
 try{
  if(!key()||typeof req.query?.state!=='string')return null;
  const value=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(provider)+'='))?.split('=').slice(1).join('=');
  if(!value||value.length>1500)return null;
  const [payload,signature,extra]=value.split('.');if(extra||!payload||!signature)return null;
  const expected=createHmac('sha256',key()).update(provider+'.'+payload).digest();
  const supplied=Buffer.from(signature,'base64url');if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;
  const data=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(!/^[a-f0-9-]{36}$/i.test(data.userId)||data.state!==req.query.state||!Number.isFinite(data.expires)||data.expires<=now||data.expires>now+600000)return null;
  return data;
 }catch{return null;}
}
export async function verifyOAuthOwner(req,provider,fetcher=fetch){
 const state=readOAuthState(req,provider);if(!state)return false;
 const headers={apikey:key(),Authorization:'Bearer '+key()};
 try{
  const r=await fetcher(BASE+'/auth/v1/admin/users/'+state.userId,{headers,signal:AbortSignal.timeout(10000)});if(!r.ok)return false;
  const user=await r.json();if(!user.email)return false;
  const role=await fetcher(BASE+'/rest/v1/admin_allowlist?select=admin_role&email=eq.'+encodeURIComponent(user.email),{headers,signal:AbortSignal.timeout(10000)});if(!role.ok)return false;
  const rows=await role.json();return rows.length===1&&rows[0].admin_role==='full';
 }catch{return false;}
}

export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
