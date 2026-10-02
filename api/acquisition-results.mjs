import {authorize,privateResponse} from './_lib/admin-auth.mjs';
import {aggregateArtistOutcomes} from './_lib/acquisition-results.mjs';
export default async function handler(req,res){
 try{
  const auth=await authorize(req,['full','acquisition']);if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
  if(req.method!=='GET')return privateResponse(res,405,{error:'Read only'});
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)return privateResponse(res,503,{error:'Product outcome connection is not configured'});
  const observed=new Date().toISOString(),start=new Date(Date.now()-30*86400000).toISOString();
  const users=[];
  for(let offset=0;offset<10000;offset+=500){
   const q=new URLSearchParams({select:'id,signup_utm,email_verified,onboarding_completed,first_booking_at',role:'eq.artist',deleted_at:'is.null',is_super_admin:'eq.false',created_at:'gte.'+start,order:'id',offset:String(offset),limit:'500'});
   const r=await fetch('https://yhemvsksnoojplnxirlv.supabase.co/rest/v1/users?'+q,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Product query failed');
   const rows=await r.json();users.push(...rows);
   if(rows.length<500)return privateResponse(res,200,aggregateArtistOutcomes(users,observed));
  }
  return privateResponse(res,503,{error:'Outcome query exceeded its verified coverage. No partial total is shown.'});
 }catch{return privateResponse(res,503,{error:'Product outcomes unavailable. Missing results do not mean zero signups.'});}
}
