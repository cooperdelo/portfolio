// Real Supabase Auth + API + storage smoke. Creates only tagged disposable
// fixtures, removes them in finally, and never sends email or touches originals.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import band from '../../api/band-review.mjs';
import outcomes from '../../api/acquisition-results.mjs';
import money from '../../api/money-overview.mjs';
import kpi from '../../api/plugverse-kpi.mjs';
import {createOAuthState,verifyOAuthOwner} from '../../api/_lib/oauth-state.mjs';
const networkFetch=globalThis.fetch;
globalThis.fetch=(url,options={})=>networkFetch(url,{signal:AbortSignal.timeout(20000),...options});
const env=p=>Object.fromEntries(fs.readFileSync(p,'utf8').split(/\r?\n/).map(s=>/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(s)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
const factory=env('C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env');
const local=env('F:/Github/plugverse/.env.local');
const key=factory.SUPABASE_SERVICE_KEY,base='https://eibtnkaoqsgwiqttiwjo.supabase.co';
process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY=key;
const keys=await fetch('https://api.supabase.com/v1/projects/yhemvsksnoojplnxirlv/api-keys?reveal=true',{headers:{Authorization:'Bearer '+local.SUPABASE_ACCESS_TOKEN}});
assert.equal(keys.status,200);
process.env.SUPABASE_SERVICE_ROLE_KEY=(await keys.json()).find(k=>k.type==='secret')?.api_key;
const h={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function call(path,method='GET',body){const r=await fetch(base+path,{method,headers:h,body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(`${method} ${path.split('?')[0]} failed (${r.status})`);const text=await r.text();return text?JSON.parse(text):null;}
const email='codex-media-audit-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
let user,asset,token;
const proof=[];
const deployment=process.env.ADMIN_TEST_DEPLOYMENT;
let bypass;
if(deployment){
 assert.equal(deployment,'https://portfolio-git-admin-unified-preview-cooper-delos-projects.vercel.app');
 const cli=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'com.vercel.cli/Data/auth.json'),'utf8'));
 const p=await fetch('https://api.vercel.com/v9/projects/prj_67rsUcnpXKDfzK31pgacI3UM0NzA?teamId=team_iHBwC5FxqaLUwd4cO7Bz8x4W',{headers:{Authorization:'Bearer '+cli.token}});assert(p.ok);
 const project=await p.json();bypass=Object.keys(project.protectionBypass||{})[0];assert(bypass);
}
async function invoke(handler,method='GET',body,query={},jwt=token){
 let status,data;const headers={};const route=handler===band?'band-review':handler===money?'money-overview':handler===kpi?'plugverse-kpi':'acquisition-results';
 if(deployment){
  const r=await fetch(deployment+'/api/'+route+'?'+new URLSearchParams(query),{method,headers:{Authorization:jwt?'Bearer '+jwt:'','x-vercel-protection-bypass':bypass,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});status=r.status;data=await r.json();
 }else await handler({method,body,query,headers:{authorization:jwt?'Bearer '+jwt:''}},{setHeader(k,v){headers[k]=v;},status(s){status=s;return this;},json(d){data=d;return this;}});
 console.log('API check:',route,method,status);return{status,data,headers};
}
try{
 user=await call('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{purpose:'disposable admin integration audit'}});
 await call('/rest/v1/admin_allowlist','POST',{email,admin_role:'full'}).catch(e=>{if(!/failed/.test(e.message))throw e;throw e;});
 const login=await call('/auth/v1/token?grant_type=password','POST',{email,password});token=login.access_token;
 const fixture=crypto.randomUUID();
 const r=await fetch(base+'/rest/v1/band_media_assets',{method:'POST',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({drive_file_id:'audit-'+fixture,name:'Disposable API fixture',gig:'Audit fixture',duration:60})});assert.equal(r.status,201);asset=(await r.json())[0];
 let v=await invoke(band);assert.equal(v.status,200);assert(v.data.assets.some(a=>a.id===asset.id));proof.push('authenticated real asset read');
 const b={asset:asset.id,revision:0,operation:crypto.randomUUID(),verdict:'favorite',note:'Integration audit',time:12,start:10,end:20};
 const first=await invoke(band,'POST',b);assert.equal(first.status,200);assert.equal(first.data.review.revision,1);assert.equal(first.data.verified,true);
 const repeat=await invoke(band,'POST',b);assert.equal(repeat.status,200);assert.deepEqual(repeat.data,first.data);proof.push('API â†’ RPC â†’ persisted readback and idempotent retry');
 const conflict=await invoke(band,'POST',{...b,operation:crypto.randomUUID(),note:'stale'});assert.equal(conflict.status,409);proof.push('stale browser revision rejected');
 const video=v.data.assets.find(a=>a.proxy_path);assert(video);
 const stream=await invoke(band,'GET',undefined,{asset:video.id});assert.equal(stream.status,200);
 const bytes=await fetch(stream.data.url,{headers:{Range:'bytes=0-31'}});assert([200,206].includes(bytes.status));assert((await bytes.arrayBuffer()).byteLength>0);proof.push('authenticated signed video streams');
 const publicAttempt=await fetch(base+'/storage/v1/object/public/band-review/'+video.proxy_path);assert(!publicAttempt.ok);proof.push('video not publicly downloadable');
 const product=await invoke(outcomes);assert.equal(product.status,200);assert(Array.isArray(product.data.rows));proof.push('live product signup aggregation');
 const finances=await invoke(money);assert.equal(finances.status,200);assert(finances.data.bank.every(x=>x.as_of));assert(finances.data.confirmation?.content.includes('6,851.23'));assert(finances.data.personal.some(x=>x.account==='wells_fargo_checking'&&Number(x.balance)===6851.23&&x.source==='cooper_reported'));proof.push('live money sources and canonical dated owner confirmation');
 const state=createOAuthState('ig',user.id);const oauthReq={headers:{cookie:state.cookie.split(';')[0]},query:{state:state.state}};assert.equal(await verifyOAuthOwner(oauthReq,'ig'),true);proof.push('OAuth callback verifies current full owner');
 console.log(JSON.stringify({product_observed_at:product.data.observed_at,product_groups:product.data.rows.length,artist_accounts:product.data.rows.reduce((n,r)=>n+r.accounts,0)},null,2));
 if(process.env.ADMIN_TEST_KPI==='1'){
  assert(deployment,'KPI audit uses existing deployed provider credentials');
  const live=await invoke(kpi);assert.equal(live.status,200);
  console.log(JSON.stringify({kpi_observed_at:live.data.captured_at,snapshot_written:live.data.snapshot_written,failed_sources:(live.data.errors||[]).map(e=>({source:e.source,error:e.error?.slice(0,350)})),posthog_events:live.data.data?.top_events_7d?.length??null},null,2));
 }
 await call('/rest/v1/admin_allowlist?email=eq.'+encodeURIComponent(email),'DELETE');
 const revoked=await invoke(band);assert.equal(revoked.status,403);proof.push('access revocation takes effect immediately');assert.equal(await verifyOAuthOwner(oauthReq,'ig'),false);proof.push('OAuth state stops working after owner revocation');
 const loggedOut=await invoke(band,'GET',undefined,{},null);assert.equal(loggedOut.status,401);proof.push('logged-out denied');
 console.log(JSON.stringify({passed:proof},null,2));
}catch(error){console.error('Integration assertion:',error.message);throw error;}finally{
 if(asset){await call('/rest/v1/band_media_operations?asset_id=eq.'+asset.id,'DELETE');await call('/rest/v1/band_media_reviews?asset_id=eq.'+asset.id,'DELETE');await call('/rest/v1/band_media_assets?id=eq.'+asset.id,'DELETE');}
 await call('/rest/v1/admin_allowlist?email=eq.'+encodeURIComponent(email),'DELETE');
 if(user?.id)await call('/auth/v1/admin/users/'+user.id,'DELETE');
 console.log('Disposable audit identities and records removed.');
}
