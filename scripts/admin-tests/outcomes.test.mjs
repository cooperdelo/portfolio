import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateArtistOutcomes} from '../../api/_lib/acquisition-results.mjs';
test('signup sources preserve unknown attribution and distinct onboarding evidence',()=>{
 const result=aggregateArtistOutcomes([
  {signup_utm:null,email_verified:false,onboarding_completed:false},
  {signup_utm:{source:'dm',campaign:null},email_verified:true,onboarding_completed:false},
  {signup_utm:{source:'dm',campaign:'cooper-instagram'},email_verified:true,onboarding_completed:true,first_booking_at:'2026-09-30'},
 ],'2026-10-01T00:00:00Z');
 assert.equal(result.rows.length,3);
 assert.deepEqual(result.rows.find(r=>r.source==='not recorded'),{source:'not recorded',medium:null,campaign:null,accounts:1,email_verified:0,onboarded:0,first_booking_markers:0});
 assert.equal(result.coverage.real_gig_verification,false);
 assert.equal(result.rows.find(r=>r.campaign==='cooper-instagram').first_booking_markers,1);
 assert(!JSON.stringify(result).includes('user_id'));
});
