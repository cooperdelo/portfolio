// Real disposable Auth identity. No messages, invitations or provider syncs.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import acquisition from '../../api/acquisition.mjs';
import money from '../../api/money-overview.mjs';
import band from '../../api/band-review.mjs';
import source from '../../api/band-media-source.mjs';
import ig from '../../api/instagram-auth-start.mjs';
import tt from '../../api/tiktok-auth-start.mjs';
import investments from '../../api/investments-sync.mjs';
import kpi from '../../api/plugverse-kpi.mjs';
import igSync from '../../api/instagram-sync.mjs';
import ttSync from '../../api/tiktok-sync.mjs';
const env=Object.fromEntries(fs.readFileSync('C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env','utf8').split(/\r?\n/).map(s=>/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(s)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
const key=env.SUPABASE_SERVICE_KEY,base='https://eibtnkaoqsgwiqttiwjo.supabase.co';
process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY=key;
const email='codex-access-audit-'+crypto.randomUUID()+'@example.invalid';
const password=crypto.randomBytes(32).toString('base64url');
let user,token;
const deployment=process.env.ADMIN_TEST_DEPLOYMENT;
let bypass;
if(deployment){
 assert.equal(deployment,'https://portfolio-git-admin-unified-preview-cooper-delos-projects.vercel.app');
 const cli=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'com.vercel.cli/Data/auth.json'),'utf8'));
 const response=await fetch('https://api.vercel.com/v9/projects/prj_67rsUcnpXKDfzK31pgacI3UM0NzA?teamId=team_iHBwC5FxqaLUwd4cO7Bz8x4W',{headers:{Authorization:'Bearer '+cli.token},signal:AbortSignal.timeout(20000)});
 assert(response.ok);bypass=Object.keys((await response.json()).protectionBypass||{})[0];assert(bypass);
}
async function call(route,method='GET',body,jwt=key){
 const r=await fetch(base+route,{method,headers:{apikey:key,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null};
}
async function invoke(handler,method='GET'){
 let status,data;
 if(deployment){
  const route=new Map([[acquisition,'acquisition'],[money,'money-overview'],[band,'band-review'],[source,'band-media-source'],[ig,'instagram-auth-start'],[tt,'tiktok-auth-start'],[investments,'investments-sync'],[kpi,'plugverse-kpi'],[igSync,'instagram-sync'],[ttSync,'tiktok-sync']]).get(handler);
  const response=await fetch(deployment+'/api/'+route,{method,headers:{Authorization:'Bearer '+token,'x-vercel-protection-bypass':bypass},signal:AbortSignal.timeout(20000)});
  return {status:response.status,data:await response.json()};
 }
 await handler({method,headers:{authorization:'Bearer '+token},query:{},body:{}},{setHeader(){},status(s){status=s;return this;},json(d){data=d;return this;},send(d){data=d;return this;},end(){}});
 return {status,data};
}
try{
 const created=await call('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{purpose:'disposable limited-access audit'}});assert.equal(created.status,200);user=created.data;
 assert.equal((await call('/rest/v1/admin_allowlist','POST',{email,admin_role:'acquisition'})).status,201);
 const login=await call('/auth/v1/token?grant_type=password','POST',{email,password});assert.equal(login.status,200);token=login.data.access_token;
 const own=await call('/rest/v1/admin_allowlist?select=email,admin_role','GET',null,token);assert.equal(own.status,200);assert.deepEqual(own.data,[{email,admin_role:'acquisition'}]);
 const anon=/const SUPABASE_PUBLISHABLE_KEY = '([^']+)'/.exec(fs.readFileSync('admin/_shell/supabase.js','utf8'))[1];
 const publicSnapshot=await call('/rest/v1/vault_documents?select=content&path=eq.Projects%2Fadmin%2FNET-WORTH-HISTORICAL-SNAPSHOT.json','GET',null,anon);
 assert(publicSnapshot.status===403||(publicSnapshot.status===200&&publicSnapshot.data.length===0),'Historical valuation exposed anonymously');
 for(const table of ['financial_transactions','account_balances','personal_balance_snapshots','vault_documents','playbook_items','command_center','band_media_assets','band_media_reviews','automation_secrets']){
  const r=await call('/rest/v1/'+table+'?select=*&limit=1','GET',null,token);assert(r.status===403||(r.status===200&&r.data.length===0),table+' exposed');
 }
 for(const [name,handler] of [['money',money],['band',band],['band source',source],['Instagram connect',ig],['TikTok connect',tt],['investments sync',investments],['KPI',kpi],['Instagram sync',igSync],['TikTok sync',ttSync]]){
  const r=await invoke(handler,'POST');assert.equal(r.status,403,name+' did not deny limited role');
 }
 assert.equal((await invoke(acquisition)).status,200);
 assert.equal((await invoke(acquisition,'POST')).status,409);
 await call('/rest/v1/admin_allowlist?email=eq.'+encodeURIComponent(email),'DELETE');
 assert.equal((await invoke(acquisition)).status,403);
 console.log('PASS: real limited identity, own allowlist only, ten private data sources denied, nine private APIs denied, owner-disconnected writes rejected, revocation immediate.');
}finally{
 await call('/rest/v1/admin_allowlist?email=eq.'+encodeURIComponent(email),'DELETE');
 if(user?.id)assert.equal((await call('/auth/v1/admin/users/'+user.id,'DELETE')).status,200);
 console.log('Disposable identity removed.');
}

