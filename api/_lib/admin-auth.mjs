const BASE='https://eibtnkaoqsgwiqttiwjo.supabase.co';
export async function authorize(req, roles, fetcher=fetch) {
  const token=/^Bearer (\S+)$/i.exec(req.headers?.authorization||'')?.[1];
  const key=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if(!token)return {ok:false,status:401,error:'Sign in required'};
  if(!key)return {ok:false,status:503,error:'Admin connection is not configured'};
  const userResponse=await fetcher(`${BASE}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
  if(!userResponse.ok)return {ok:false,status:401,error:'Session expired'};
  const user=await userResponse.json();
  if(!user.id||!user.email)return {ok:false,status:403,error:'Access denied'};
  const response=await fetcher(`${BASE}/rest/v1/admin_allowlist?select=admin_role&email=eq.${encodeURIComponent(user.email)}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)return {ok:false,status:503,error:'Permission check unavailable'};
  const rows=await response.json();
  if(rows.length!==1||!roles.includes(rows[0].admin_role))return {ok:false,status:403,error:'Access denied'};
  return {ok:true,userId:user.id,email:user.email,role:rows[0].admin_role};
}
export function privateResponse(res,status,body){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Vary','Authorization');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}
