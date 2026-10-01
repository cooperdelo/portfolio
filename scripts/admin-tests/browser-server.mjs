// Loopback-only, disposable authenticated browser test. Not a deployed route.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import band from '../../api/band-review.mjs';
import money from '../../api/money-overview.mjs';
import acquisition from '../../api/acquisition.mjs';
const raw=fs.readFileSync('C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env','utf8');
const key=/^SUPABASE_SERVICE_KEY\s*=\s*(.+?)\s*$/m.exec(raw)[1].replace(/^['"]|['"]$/g,'');
process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY=key;
const base='https://eibtnkaoqsgwiqttiwjo.supabase.co',headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function request(p,method='GET',body){const r=await fetch(base+p,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Audit request failed '+r.status);const s=await r.text();return s?JSON.parse(s):null;}
const email='codex-media-audit-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(32).toString('base64url');
const user=await request('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{purpose:'disposable admin integration audit'}});
await request('/rest/v1/admin_allowlist','POST',{email,admin_role:'full'});
const session=await request('/auth/v1/token?grant_type=password','POST',{email,password});
const root=path.resolve('.'),nonce=crypto.randomUUID();
let stopped=false;
async function cleanup(){if(stopped)return;stopped=true;await request('/rest/v1/band_media_operations?reviewer=eq.'+user.id,'DELETE');await request('/rest/v1/band_media_reviews?reviewer=eq.'+user.id,'DELETE');await request('/rest/v1/admin_allowlist?email=eq.'+encodeURIComponent(email),'DELETE');await request('/auth/v1/admin/users/'+user.id,'DELETE');console.log('Browser fixture removed.');process.exit(0);}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:8766');
  res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/__audit'){
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<title>Private integration audit</title><button id="login">Open disposable reviewer session</button><script type="module">import {sb} from '/admin/_shell/supabase.js';document.querySelector('#login').onclick=async()=>{const r=await fetch('/__session',{method:'POST',headers:{'X-Audit-Nonce':'${nonce}'}});await sb.auth.setSession(await r.json());location.href='/admin/assets/';};</script>`);return;
  }
  if(url.pathname==='/__session'){
   if(req.method!=='POST'||req.headers['x-audit-nonce']!==nonce){res.writeHead(403);res.end();return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token}));return;
  }
  if(url.pathname==='/__finish'&&req.method==='POST'&&req.headers['x-audit-nonce']===nonce){res.end('Done');setTimeout(cleanup,100);return;}
  const handler={'/api/band-review':band,'/api/money-overview':money,'/api/acquisition':acquisition}[url.pathname];
  if(handler){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)throw Error('body too large');}
   req.body=body?JSON.parse(body):undefined;req.query=Object.fromEntries(url.searchParams);
   res.status=s=>{res.statusCode=s;return res;};res.json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));return res;};await handler(req,res);return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||file.includes(path.sep+'.')||!['.html','.js','.mjs','.css','.webp','.woff2','.png','.jpg','.svg','.json'].includes(path.extname(file))&&!fs.existsSync(path.join(file,'index.html'))){res.writeHead(404);res.end();return;}
  const actual=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
  const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
  res.setHeader('Content-Type',(mime[path.extname(actual)]||'application/octet-stream')+'; charset=utf-8');fs.createReadStream(actual).pipe(res);
 }catch{res.statusCode=500;res.end('Audit server request failed');}
});
server.listen(8766,'127.0.0.1',()=>console.log('Private browser audit at http://127.0.0.1:8766/__audit'));
process.on('SIGINT',cleanup);process.on('SIGTERM',cleanup);
setTimeout(cleanup,45*60000);
