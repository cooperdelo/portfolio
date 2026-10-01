import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/plugverse-kpi.mjs';
test('source failure preserves the previous KPI snapshot rather than overwriting it with nulls',async()=>{
 const oldFetch=globalThis.fetch;let writes=0,result,status;
 const previous=[{date:'2026-09-29',users_total:42}];
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='POST'){writes++;throw Error('Unexpected write during source outage');}
  if(url.includes('/auth/v1/user'))return{ok:true,json:async()=>({id:'fixture',email:'fixture@example.invalid'})};
  if(url.includes('/admin_allowlist'))return{ok:true,json:async()=>[{admin_role:'full'}]};
  if(url.includes('/plugverse_kpi_snapshots?'))return{ok:true,json:async()=>previous};
  throw Error('Simulated source outage');
 };
 try{
  await handler({headers:{authorization:'Bearer fixture'}},{setHeader(){},status(s){status=s;return this;},json(d){result=d;}});
  assert.equal(status,200);assert.equal(writes,0);assert.equal(result.snapshot_written,false);assert.deepEqual(result.history,previous);assert(result.errors.length>=1);
 }finally{globalThis.fetch=oldFetch;}
});
