import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible,validateSend,followUpDue,RecordConflict} from '../../admin/_shell/acquisition-model.mjs';
import {accountScope,freshness,safeExternal} from '../../admin/_shell/workspace-model.mjs';
import {authorize} from '../../api/_lib/admin-auth.mjs';
import acquisitionHandler from '../../api/acquisition.mjs';
import bandHandler from '../../api/band-media-source.mjs';
const actor={sender:'cooper',account:'plugverse.app'};
const record=()=>({id:'fixture',revision:2,owner:'cooper',account:'plugverse.app',channel:'instagram',status:'approved',draft_revision:3,evidence_verified_at:new Date().toISOString(),approval:{human_verified:true,draft_revision:3,sender:'cooper',account:'plugverse.app',channel:'instagram'}});
test('unreconciled history, suppression and uncertain sends all block outreach',()=>{
 for(const property of ['suppressed','prior_contact_unknown','send_uncertain'])assert.equal(eligible({...record(),[property]:true},actor).ok,false);
 assert.equal(eligible({...record(),sent_at:new Date().toISOString()},actor).ok,false);
});
test('stale, invalid and future evidence cannot authorize contact',()=>{
 for(const date of ['invalid','2020-01-01','2099-01-01'])assert.equal(eligible({...record(),evidence_verified_at:date},actor).ok,false);
});
test('approval binds draft, sender, account and channel',()=>{
 assert.equal(eligible(record(),actor).ok,true);
 for(const [key,value] of Object.entries({draft_revision:4,owner:'karthik',account:'other',channel:'email'}))assert.equal(eligible({...record(),[key]:value},actor).ok,false);
});
test('stale revision is a conflict and copy alone is never a send',()=>{
 const input={operation_id:'fixture-operation-123',revision:1,actual_text:'Fixture only',sent_at:new Date().toISOString(),attested_sent:true};
 assert.throws(()=>validateSend(record(),input,actor),RecordConflict);
 assert.throws(()=>validateSend(record(),{...input,revision:2,attested_sent:false},actor));
 assert.equal(validateSend(record(),{...input,revision:2},actor).expected_revision,2);
});
test('followups stop on replies and unsupported channels',()=>{
 assert.equal(followUpDue({...record(),sent_at:'2026-09-01T00:00:00Z'}),'2026-09-06T00:00:00.000Z');
 for(const fields of [{reply_at:'2026-09-02'},{suppressed:true},{channel:'linkedin'},{sent_at:'invalid'}])assert.equal(followUpDue({...record(),sent_at:'2026-09-01',...fields}),null);
});
test('brand separation and timestamps do not invent evidence',()=>{
 assert.equal(accountScope('@the.band.rubber'),'rubber-band');
 assert.equal(accountScope('cooperdelo_'),'personal');
 assert.equal(accountScope('unknown'),'unclassified');
 assert.equal(freshness({}).state,'never connected');
 assert.equal(safeExternal('javascript:alert(1)'),null);
});
test('API checks authenticated allowlist role rather than client role',async()=>{
 process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY='fixture-not-a-secret';
 const fetcher=async url=>({ok:true,json:async()=>url.includes('/auth/')?{id:'test',email:'fixture@example.invalid'}:[{admin_role:'acquisition'}]});
 assert.equal((await authorize({headers:{}},['full'],fetcher)).status,401);
 assert.equal((await authorize({headers:{authorization:'Bearer fixture'}},['full','plugverse'],fetcher)).status,403);
 assert.equal((await authorize({headers:{authorization:'Bearer fixture'}},['acquisition'],fetcher)).ok,true);
});
test('unconnected acquisition rejects writes; contributor cannot retrieve band source',async()=>{
 const previous=globalThis.fetch;
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
 try{
  // acq_* tables absent: the state before the board cutover.
  globalThis.fetch=async url=>url.includes('/acq_')?({ok:false,status:404,json:async()=>({code:'PGRST205'})}):({ok:true,json:async()=>url.includes('/auth/')?{id:'fixture',email:'fixture@example.invalid'}:[{admin_role:'acquisition'}]});
  const req={method:'POST',headers:{authorization:'Bearer fixture'}};
  const a=response();await acquisitionHandler(req,a);assert.equal(a.code,409);assert.equal(a.body.code,'OWNER_NOT_CONNECTED');assert.equal(a.headers['Cache-Control'],'no-store, private');
  const b=response();await bandHandler({...req,method:'GET'},b);assert.equal(b.code,403);
 }finally{globalThis.fetch=previous;}
});
