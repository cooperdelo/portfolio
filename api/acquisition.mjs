import {authorize,privateResponse} from './_lib/admin-auth.mjs';
// The existing Claude board is the operational owner. Until its persistence
// contract is verified, fail closed rather than create a parallel writable store.
export default async function handler(req,res){
  try{
    const auth=await authorize(req,['full','acquisition']);
    if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
    if(req.method!=='GET')return privateResponse(res,409,{code:'OWNER_NOT_CONNECTED',error:'The current board owner must be connected before recording operational updates.'});
    return privateResponse(res,200,{connection:{state:'not_connected',owner:'Claude Acquisition Board',verified_at:null,reason:'Board source, stored history and shared persistence have not been verified.',next_action:'Export the current board source and complete saved history for reconciliation.'},records:null,totals:null,capabilities:{read:false,write:false,shared:false},experiments:[{id:'cooper-instagram',owner:'Cooper',channels:['instagram','email'],email_account:'cooper@plugverse.app',status:'approach confirmed; results unverified'},{id:'karthik-email-linkedin',owner:'Karthik',channels:['email','linkedin'],status:'approach confirmed; results unverified'}]});
  }catch{return privateResponse(res,503,{error:'Acquisition connection unavailable. No update has been accepted.'});}
}
