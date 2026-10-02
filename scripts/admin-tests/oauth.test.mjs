import test from 'node:test';
import assert from 'node:assert/strict';
import {createOAuthState,readOAuthState,verifyOAuthOwner} from '../../api/_lib/oauth-state.mjs';
import instagramStart from '../../api/instagram-auth-start.mjs';
import tiktokStart from '../../api/tiktok-auth-start.mjs';
import instagramCallback from '../../api/instagram-oauth.mjs';
import tiktokCallback from '../../api/tiktok-oauth.mjs';
process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY='test-secret-not-a-real-credential';
const id='00000000-0000-4000-8000-000000000001';
const req=(pair,provider='ig')=>({headers:{cookie:pair.cookie.split(';')[0]},query:{state:pair.state},method:'GET'});
test('OAuth state requires owner-issued signed cookie, matching nonce, provider and expiry',()=>{
 const pair=createOAuthState('ig',id,1000),r=req(pair);
 assert.equal(readOAuthState(r,'ig',1001).userId,id);
 assert.equal(readOAuthState({...r,headers:{}},'ig',1001),null);
 assert.equal(readOAuthState({...r,query:{state:'forged'}},'ig',1001),null);
 assert.equal(readOAuthState(r,'tt',1001),null);
 assert.equal(readOAuthState(r,'ig',601001),null);
 assert.equal(readOAuthState({...r,headers:{cookie:r.headers.cookie.replace(id,'forged')+'.tamper'}},'ig',1001),null);
 assert(!pair.state.includes(id));
});
test('OAuth callback rechecks current owner permission and fails closed',async()=>{
 const r=req(createOAuthState('ig',id));
 const mock=role=>async url=>({ok:true,json:async()=>url.includes('/auth/')?{email:'fixture@example.invalid'}:[{admin_role:role}]});
 assert.equal(await verifyOAuthOwner(r,'ig',mock('full')),true);
 assert.equal(await verifyOAuthOwner(r,'ig',mock('acquisition')),false);
 assert.equal(await verifyOAuthOwner(r,'ig',mock('plugverse')),false);
 assert.equal(await verifyOAuthOwner(r,'ig',async()=>{throw Error('offline');}),false);
});
test('Anonymous starts and callbacks cannot connect a reporting account',async()=>{
 for(const handler of [instagramStart,tiktokStart,instagramCallback,tiktokCallback]){
  let status;const response={setHeader(){},status(s){status=s;return this;},json(){},send(){},end(){}};
  await handler({method:handler===instagramStart||handler===tiktokStart?'POST':'GET',headers:{},query:{code:'not-a-real-code'}},response);
  assert([401,403].includes(status));
 }
});
