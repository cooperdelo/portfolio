import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{cleanEvent} from '../../api/track.mjs';

const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148';
const ok={name:'record_pull',session:'abc123def456',path:'/',props:{album:'In Rainbows'},referrer:'https://www.instagram.com/cooperdelo/',source:'IG'};

test('keeps only whitelisted events with short, plain fields',()=>{
  const e=cleanEvent(ok,UA);
  assert.deepEqual(e,{session:'abc123def456',name:'record_pull',path:'/',props:{album:'In Rainbows'},referrer:'instagram.com',source:'ig',device:'phone'});
  assert.equal(cleanEvent({...ok,name:'drop_table'},UA),null);
  assert.equal(cleanEvent({...ok,session:'x'},UA),null);
  assert.equal(cleanEvent(ok,'Googlebot/2.1'),null);
  const messy=cleanEvent({...ok,path:'javascript:alert(1)',props:{'Bad Key':'x',ok_key:{nested:1},n:3,s:'y'.repeat(500)}},UA);
  assert.equal(messy.path,'');assert.deepEqual(Object.keys(messy.props),['n','s']);assert.equal(messy.props.s.length,80);
});

test('internal referrers are dropped so only outside sources show up',()=>{
  assert.equal(cleanEvent({...ok,referrer:'https://cooperdelo.com/work/bioswap'},UA).referrer,'');
  assert.equal(cleanEvent({...ok,referrer:'not a url'},UA).referrer,'');
});

async function call(body,{key='fixture',reply}={}){
  const old=globalThis.fetch,oldKey=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;let status,sent=null;
  process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY=key;
  globalThis.fetch=async(url,opts)=>{sent=JSON.parse(opts.body);return reply||{ok:true,status:201};};
  try{await handler({method:'POST',headers:{'user-agent':UA},body},{setHeader(){},status(s){status=s;return this;},json(){return this;},end(){return this;}});}
  finally{globalThis.fetch=old;process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY=oldKey;}
  return {status,sent};
}

test('stores a clean event without an IP address or user agent',async()=>{
  const r=await call(ok);
  assert.equal(r.status,204);assert.equal(r.sent.name,'record_pull');
  assert(!('ip' in r.sent)&&!('ua' in r.sent)&&!('user_agent' in r.sent));
});

test('before the table exists, events are accepted and dropped quietly',async()=>{
  const r=await call(ok,{reply:{ok:false,status:404}});
  assert.equal(r.status,202);
});

test('junk is ignored without a write',async()=>{
  const r=await call({name:'nope'});
  assert.equal(r.status,202);assert.equal(r.sent,null);
});
