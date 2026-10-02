export function aggregateArtistOutcomes(users,observedAt){
 const sources=new Map();
 for(const user of users){
  const u=user.signup_utm||{},source=typeof u.source==='string'?u.source:'not recorded';
  const medium=typeof u.medium==='string'?u.medium:null,campaign=typeof u.campaign==='string'?u.campaign:null;
  const key=JSON.stringify([source,medium,campaign]);
  if(!sources.has(key))sources.set(key,{source,medium,campaign,accounts:0,email_verified:0,onboarded:0,first_booking_markers:0});
  const row=sources.get(key);row.accounts++;row.email_verified+=user.email_verified===true?1:0;row.onboarded+=user.onboarding_completed===true?1:0;row.first_booking_markers+=user.first_booking_at?1:0;
 }
 return {observed_at:observedAt,source:'PlugVerse production users; existing signup_utm first-touch attribution',window_days:30,rows:[...sources.values()].sort((a,b)=>b.accounts-a.accounts),coverage:{sends:false,replies:false,signup_records:true,real_gig_verification:false,test_internal_exclusion:'Deleted accounts and super-admins excluded; dedicated test/internal artist registry is not available.',sender_attribution:'Only explicit campaign tags can distinguish experiments. Untagged and ?s=dm signups are not assigned to Cooper or Karthik.'}};
}
