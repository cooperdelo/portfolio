import {authorize,privateResponse} from './_lib/admin-auth.mjs';
// The existing Claude board is the operational owner. Until its persistence
// contract is verified, fail closed rather than create a parallel writable store.
export default async function handler(req,res){
  try{
    const auth=await authorize(req,['full','acquisition']);
    if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
    if(req.method!=='GET')return privateResponse(res,409,{code:'OWNER_NOT_CONNECTED',error:'The current board owner must be connected before recording operational updates.'});
    return privateResponse(res,200,{connection:{state:'not_connected',owner:'Claude Acquisition Board',verified_at:null,reason:'The live board uses Claude artifact database collections. Its source and 182 visible prospects were inspected on September 30; complete history and a supported external write connection are still missing.',next_action:'Connect the artifact database through an authorized adapter, or export complete collections and explicitly transfer ownership. A visible table export is insufficient.'},records:null,totals:null,capabilities:{read:false,write:false,shared:false},experiments:[{id:'cooper-instagram',owner:'Cooper',channels:['instagram','email'],email_account:'cooper@plugverse.app',status:'approach confirmed; results unverified'},{id:'karthik-email-linkedin',owner:'Karthik',channels:['email','linkedin'],status:'approach confirmed; results unverified'}]});
  }catch{return privateResponse(res,503,{error:'Acquisition connection unavailable. No update has been accepted.'});}
}
