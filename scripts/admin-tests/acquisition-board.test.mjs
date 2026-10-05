import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{planLeadChange,planConversation,planNewLead} from '../../api/acquisition.mjs';

const cooper={email:'cooper@example.invalid',role:'full',name:'Cooper'};
const karthik={email:'karthik@example.invalid',role:'acquisition',name:'karthik'};
const lead={handle:'fixtureband',status:'new',finder_verdict:null,draft_verdict:null,data:{draft_text:'hey'}};

test('only the full admin approves or rejects drafts',()=>{
  assert.throws(()=>planLeadChange(lead,{draft_verdict:'approved'},karthik),e=>e.status===403);
  const p=planLeadChange(lead,{draft_verdict:'approved'},cooper);
  assert.equal(p.update.draft_verdict,'approved');assert.equal(p.update.status,'approved');
  assert.equal(p.activity.kind,'draft_approved');assert.equal(p.update.data.draft_verdict_by,cooper.email);
});

test('the acquisition role can only mark approved drafts as sent',()=>{
  assert.throws(()=>planLeadChange(lead,{status:'contacted'},karthik),e=>e.status===403);
  const p=planLeadChange({...lead,draft_verdict:'approved',status:'approved'},{status:'contacted'},karthik);
  assert.equal(p.update.status,'contacted');assert.equal(p.activity.kind,'sent');assert.equal(p.update.data.sent_by,karthik.email);
});

test('finder labels and notes are recorded with who made them',()=>{
  const p=planLeadChange(lead,{finder_verdict:'wrong',finder_note:'agency books them',notes:'x'.repeat(5000)},karthik);
  assert.equal(p.update.finder_verdict,'wrong');assert.equal(p.activity.kind,'finder_wrong');assert.equal(p.activity.detail,'agency books them');
  assert.equal(p.update.data.notes.length,3000);assert.equal(p.update.updated_by,karthik.email);
  assert.throws(()=>planLeadChange(lead,{status:'hired'},cooper),e=>e.status===400);
});

test('conversations need a name and something they said, and keep only known tags',()=>{
  assert.throws(()=>planConversation({quote:'hi'},karthik),e=>e.status===400);
  assert.throws(()=>planConversation({name:'Band'},karthik),e=>e.status===400);
  const p=planConversation({name:'Band',handle:'@band',quote:'we book through DMs',tags:['Wants a call','made up'],date:'2026-10-02',next_date:'soon'},karthik);
  assert.deepEqual(p.row.tags,['Wants a call']);assert.equal(p.row.handle,'band');assert.equal(p.row.next_date,null);assert.equal(p.row.by_email,karthik.email);
});

test('hand-added prospects start in review with a clean handle',()=>{
  assert.throws(()=>planNewLead({handle:'bad handle!'},cooper),e=>e.status===400);
  const p=planNewLead({handle:'@New.Band',platform:'myspace'},cooper);
  assert.equal(p.row.handle,'new.band');assert.equal(p.row.platform,'other');assert.equal(p.row.bucket,'review');
});

function harness(role,routes){
  const calls=[];
  const fetcher=async(url,opts={})=>{
    calls.push([opts.method||'GET',url]);
    if(url.includes('/auth/v1/user'))return{ok:true,json:async()=>({id:'u',email:role+'@example.invalid'})};
    if(url.includes('/admin_allowlist'))return{ok:true,json:async()=>[{admin_role:role}]};
    for(const [match,reply] of routes)if(url.includes(match)){const [status,body]=typeof reply==='function'?reply(opts):reply;return{ok:status<300,status,json:async()=>body};}
    throw Error('unexpected '+url);
  };
  return {calls,fetcher};
}
async function run(role,routes,req){
  const old=globalThis.fetch,oldKey=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  const h=harness(role,routes);globalThis.fetch=h.fetcher;process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY='fixture';
  let status,body;
  try{await handler({headers:{authorization:'Bearer fixture'},...req},{setHeader(){},status(s){status=s;return this;},json(d){body=d;}});}
  finally{globalThis.fetch=old;process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY=oldKey;}
  return {status,body,calls:h.calls};
}

test('before the migration the board reports not_connected and writes nothing',async()=>{
  const r=await run('full',[['acq_leads',[404,{code:'PGRST205',message:'missing'}]]],{method:'GET'});
  assert.equal(r.status,200);assert.equal(r.body.connection.state,'not_connected');assert.equal(r.body.capabilities.write,false);
  const w=await run('full',[['acq_leads',[404,{code:'PGRST205'}]]],{method:'POST',body:{op:'lead.update',handle:'x',patch:{notes:'y'}}});
  assert.equal(w.status,409);assert.equal(w.body.code,'OWNER_NOT_CONNECTED');assert(!w.calls.some(([m])=>m==='PATCH'));
});

test('the plugverse role cannot open the acquisition board',async()=>{
  const r=await run('plugverse',[],{method:'GET'});
  assert.equal(r.status,403);
});

test('a stale edit is refused instead of overwriting a newer change',async()=>{
  const row={handle:'fixtureband',status:'new',updated_at:'2026-10-02T08:00:00Z',data:{}};
  const r=await run('acquisition',[['acq_leads?select=handle&limit=1',[200,[row]]],['acq_leads?handle=eq.fixtureband',[200,[row]]]],
    {method:'POST',body:{op:'lead.update',handle:'fixtureband',if_updated_at:'2026-10-02T07:00:00Z',patch:{notes:'late'}}});
  assert.equal(r.status,409);assert(!r.calls.some(([m])=>m==='PATCH'));
});

test('database errors never leak raw messages',async()=>{
  const r=await run('full',[['acq_leads',[500,{message:'relation secret_internal does not exist'}]]],{method:'GET'});
  assert.equal(r.status,503);assert(!JSON.stringify(r.body).includes('secret_internal'));
});

test('rewording an approved message needs a fresh approval, and sends record the words used',()=>{
  const approved={...lead,status:'approved',draft_verdict:'approved',data:{draft_text:'hey'}};
  const p=planLeadChange(approved,{draft_text:'hey there'},karthik);
  assert.equal(p.update.draft_verdict,null);assert.equal(p.update.status,'new');
  assert.throws(()=>planLeadChange({...approved,draft_verdict:null},{status:'contacted'},karthik),e=>e.status===403);
  const sent=planLeadChange(approved,{status:'contacted'},karthik);
  assert.equal(sent.update.data.sent_text,'hey');
  assert.throws(()=>planLeadChange({...approved,status:'contacted'},{status:'contacted'},cooper),e=>e.status===409);
});
