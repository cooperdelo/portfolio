import {authorize,privateResponse} from './_lib/admin-auth.mjs';
const BASE='https://eibtnkaoqsgwiqttiwjo.supabase.co';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export default async function handler(req,res){
 try{
  const auth=await authorize(req,['full']);
  if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
  const headers={apikey:process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY,Authorization:req.headers.authorization,'Content-Type':'application/json'};
  const read=async path=>{const r=await fetch(BASE+'/rest/v1/'+path,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Read failed');return r.json();};
  const all=async path=>{const rows=[];for(let offset=0;offset<5000;offset+=500){const batch=await read(path+'&limit=500&offset='+offset);rows.push(...batch);if(batch.length<500)return rows;}throw Error('Media collection exceeds safe response size');};
  if(req.method==='GET'){
   if(req.query?.asset){
    if(!uuid(req.query.asset))return privateResponse(res,400,{error:'Invalid media ID'});
    const rows=await read('band_media_assets?select=proxy_path&id=eq.'+req.query.asset+'&retired_at=is.null');
    if(!rows[0]?.proxy_path)return privateResponse(res,404,{error:'Preview is not prepared yet. Open the original in Drive.'});
    const key=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
    const r=await fetch(BASE+'/storage/v1/object/sign/band-review/'+rows[0].proxy_path.split('/').map(encodeURIComponent).join('/'),{method:'POST',signal:AbortSignal.timeout(12000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:900})});
    if(!r.ok)throw Error('Preview unavailable');
    const signed=await r.json();
    return privateResponse(res,200,{url:BASE+'/storage/v1'+signed.signedURL,expires_at:new Date(Date.now()+900000).toISOString()});
   }
   const [assets,reviews]=await Promise.all([all('band_media_assets?select=*&retired_at=is.null&order=gig,name,id'),all('band_media_reviews?select=*&reviewer=eq.'+auth.userId+'&order=asset_id')]);
   return privateResponse(res,200,{assets,reviews,reviewer:auth.userId,access:'owner_only',source:'Google Drive originals; private review previews',observed_at:new Date().toISOString()});
  }
  if(req.method!=='POST')return privateResponse(res,405,{error:'Method not allowed'});
  const b=req.body||{};
  if(!uuid(b.asset)||!uuid(b.operation)||!Number.isInteger(b.revision)||b.revision<0||!['unreviewed','favorite','reject'].includes(b.verdict)||typeof b.note!=='string'||b.note.length>4000)return privateResponse(res,400,{error:'Invalid review'});
  for(const n of [b.time,b.start,b.end])if(n!==null&&(typeof n!=='number'||!Number.isFinite(n)||n<0))return privateResponse(res,400,{error:'Invalid timestamp'});
  if((b.start===null)!==(b.end===null)||(b.start!==null&&b.end<=b.start))return privateResponse(res,400,{error:'Trim end must follow its start'});
  const r=await fetch(BASE+'/rest/v1/rpc/band_review_save',{method:'POST',headers,signal:AbortSignal.timeout(12000),body:JSON.stringify({p_asset:b.asset,p_revision:b.revision,p_verdict:b.verdict,p_note:b.note,p_time:b.time,p_start:b.start,p_end:b.end,p_operation:b.operation})});
  if(!r.ok){const e=await r.json();const conflict=e.code==='P0001'&&e.message?.startsWith('Review changed.');return privateResponse(res,conflict||e.code==='23505'?409:400,{error:conflict?'This review changed in another tab. Your text is still here; reload the saved review before trying again.':'Review was not accepted. Check its timestamps or reload.',code:conflict?'REVIEW_CONFLICT':e.code});}
  const saved=await r.json();
  const readback=await read('band_media_reviews?select=*&asset_id=eq.'+b.asset+'&reviewer=eq.'+auth.userId);
  if(readback[0]?.revision!==saved.revision)return privateResponse(res,409,{error:'A newer review exists. Reload to see it.',code:'NEWER_REVISION'});
  return privateResponse(res,200,{review:readback[0],verified:true});
 }catch{return privateResponse(res,503,{error:'Review connection unavailable. Your changes have not been confirmed.'});}
}
