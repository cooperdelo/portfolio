import {authorize,privateResponse} from './_lib/admin-auth.mjs';
export default async function handler(req,res){
 try{
  const auth=await authorize(req,['full']);
  if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
  if(req.method!=='GET')return privateResponse(res,405,{error:'Read only'});
  const key=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  const path='Projects/plugverse/outreach/CODING-AGENT-BRIEF-ADMIN-ACQUISITION-2026-09-30.md';
  const response=await fetch(`https://eibtnkaoqsgwiqttiwjo.supabase.co/rest/v1/vault_documents?select=content&path=eq.${encodeURIComponent(path)}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)throw new Error('Source unavailable');
  const rows=await response.json();
  const id=rows.length===1?/Correct Rubber Drive folder: https:\/\/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)/.exec(rows[0].content)?.[1]:null;
  if(!id)return privateResponse(res,503,{error:'Confirmed folder source unavailable'});
  return privateResponse(res,200,{folder_url:`https://drive.google.com/drive/folders/${id}`,state:'reviewer_not_connected'});
 }catch{return privateResponse(res,503,{error:'Media source unavailable'});}
}
