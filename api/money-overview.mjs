import {authorize,privateResponse} from './_lib/admin-auth.mjs';
const BASE='https://eibtnkaoqsgwiqttiwjo.supabase.co';
export default async function handler(req,res){
 try{
  const auth=await authorize(req,['full','plugverse']);if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
  if(req.method!=='GET')return privateResponse(res,405,{error:'Read only'});
  const key=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  const read=async path=>{const r=await fetch(BASE+'/rest/v1/'+path,{headers:{apikey:key,Authorization:req.headers.authorization},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Source unavailable');return r.json();};
  const latest=(rows,id)=>[...rows.reduce((m,r)=>m.has(r[id])?m:m.set(r[id],r),new Map()).values()];
  const [bank,personal,recent,doc]=await Promise.all([
   read('account_balances?select=source,account_label,balance,balance_kind,as_of&order=as_of.desc&limit=50'),
   auth.role==='full'?read('personal_balance_snapshots?select=account,balance,as_of,source&order=as_of.desc&limit=100'):[],
   read('financial_transactions?select=id,date,description,amount,type,entity,funding_source&deleted_at=is.null&order=date.desc&limit=12'),
   auth.role==='full'?read('vault_documents?select=content,updated_at&path=eq.Projects%2Fadmin%2FFINANCE-RECONCILIATION-2026-09-30.md'):[]
  ]);
  return privateResponse(res,200,{bank:latest(bank,'account_label'),personal:latest(personal,'account'),recent,confirmation:doc[0]?{content:doc[0].content,mirrored_at:doc[0].updated_at,reported_at:'2026-09-30',source:'Projects/admin/FINANCE-RECONCILIATION-2026-09-30.md'}:null,queried_at:new Date().toISOString()});
 }catch{return privateResponse(res,503,{error:'Money sources could not be loaded. No replacement balances have been calculated.'});}
}
