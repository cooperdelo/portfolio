import {authorize,privateResponse} from './_lib/admin-auth.mjs';
// The acquisition board, backed by the acq_* tables in the admin database.
// GET returns the whole board for full and acquisition roles. POST applies one whitelisted change and
// stamps who made it. Approving or rejecting a draft is the full admin's call. If the tables are not
// there yet the board reports not_connected and accepts nothing, so this can ship before the migration.
const BASE='https://eibtnkaoqsgwiqttiwjo.supabase.co/rest/v1';
const STATUSES=['new','approved','contacted','replied','signed_up','rejected'];
const LEAD_TEXT=['notes','ruling','owner','finder_note','draft_text'];
const TAGS=['Setup was confusing',"Doesn't see the point yet",'Already has a system','Wants a feature','Worried about cost',"Worried it's a scam",'Likes the booking link','Will put the link in bio','Got a request through it','Booked through it','Wants a call'];
const NAMES={'delocooper6@gmail.com':'Cooper'};
const SENT=['contacted','replied','signed_up'];

function rest(key){
  const h={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  return async(path,opts={})=>{
    const r=await fetch(`${BASE}/${path}`,{...opts,headers:{...h,...(opts.headers||{})},signal:AbortSignal.timeout(10000)});
    const body=await r.json().catch(()=>null);
    if(!r.ok){const e=Error(`Database ${r.status}`);e.code=body?.code;e.dbStatus=r.status;throw e;}
    return body;
  };
}
const missing=e=>e.code==='PGRST205'||e.code==='42P01'||e.dbStatus===404;
const clip=(v,n)=>String(v??'').slice(0,n);
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?v:null;

export function shapeLead(row){
  return {...(row.data||{}),handle:row.handle,name:row.name,platform:row.platform,bucket:row.bucket,status:row.status,area:row.area,
    followers:row.followers,queue_day:row.queue_day,queue_order:row.queue_order,finder_verdict:row.finder_verdict,
    draft_verdict:row.draft_verdict,owner:row.owner,updated_at:row.updated_at,updated_by:row.updated_by};
}

// Works out the stored change and the activity line for one lead edit. Pure, so it is unit tested.
export function planLeadChange(lead,patch,actor){
  const now=new Date().toISOString(),data={...(lead.data||{})},cols={};
  let kind='edit',detail='';
  const draftBefore=String(lead.data?.draft_text??'');
  for(const k of LEAD_TEXT)if(k in patch){data[k]=clip(patch[k],k==='draft_text'?2000:3000);if(k==='owner')cols.owner=data.owner;}
  // An approval covers the exact words approved. Editing them afterwards needs a fresh approval.
  const reworded='draft_text' in patch&&data.draft_text!==draftBefore;
  if(reworded&&lead.draft_verdict==='approved'&&patch.draft_verdict!=='approved'){cols.draft_verdict=null;if(lead.status==='approved')cols.status='new';kind='edit';detail='message changed after approval';}
  if('followup_sent_at' in patch){data.followup_sent_at=now;data.followup_by=actor.email;kind='followup';}
  if('finder_verdict' in patch){
    const v=patch.finder_verdict;if(v!==null&&!['right','wrong'].includes(v))throw Object.assign(Error('Unknown finder verdict'),{status:400});
    if(v!==lead.finder_verdict){cols.finder_verdict=v;data.finder_verdict_by=actor.email;data.finder_verdict_at=now;kind=v?'finder_'+v:'edit';detail=clip(patch.finder_note,200);}
  }
  if('draft_verdict' in patch){
    const v=patch.draft_verdict;if(v!==null&&!['approved','rejected'].includes(v))throw Object.assign(Error('Unknown draft verdict'),{status:400});
    if(actor.role!=='full')throw Object.assign(Error('Only Cooper approves or rejects drafts'),{status:403});
    if(v!==lead.draft_verdict){cols.draft_verdict=v;data.draft_verdict_by=actor.email;data.draft_verdict_at=now;kind=v?'draft_'+v:'edit';if(v==='approved'&&lead.status==='new')cols.status='approved';}
  }
  if('status' in patch){
    const s=patch.status;if(!STATUSES.includes(s))throw Object.assign(Error('Unknown status'),{status:400});
    if(s==='contacted'&&SENT.includes(lead.status))throw Object.assign(Error('Already marked sent'),{status:409});
    const approvedNow=cols.draft_verdict==='approved'||(lead.draft_verdict==='approved'&&!('draft_verdict' in cols));
    if(s==='contacted'&&!approvedNow&&actor.role!=='full')throw Object.assign(Error('Only approved drafts can be sent'),{status:403});
    if(s!==lead.status){cols.status=s;if(['contacted','replied','signed_up'].includes(s)){kind=s==='contacted'?'sent':s;if(s==='contacted'){data.sent_by=actor.email;data.sent_at=now;data.sent_text=data.draft_text||'';}
        if(s==='replied')data.reply_at=now;}}
  }
  return {update:{...cols,data,updated_at:now,updated_by:actor.email},activity:{at:now,by_email:actor.email,by_name:actor.name,kind,handle:lead.handle,detail}};
}

export function planConversation(doc,actor){
  const name=clip(doc.name,200).trim();
  if(!name)throw Object.assign(Error('Add who you talked to'),{status:400});
  if(!String(doc.quote||'').trim()&&!String(doc.notes||'').trim())throw Object.assign(Error('Add what they said or a note'),{status:400});
  const now=new Date().toISOString();
  return {row:{at:now,by_email:actor.email,by_name:actor.name,name,handle:clip(doc.handle,80).replace(/^@/,''),kind:clip(doc.kind,60),channel:clip(doc.channel,60),
    date:day(doc.date),outcome:clip(doc.outcome,80),quote:clip(doc.quote,5000),notes:clip(doc.notes,5000),
    tags:(Array.isArray(doc.tags)?doc.tags:[]).filter(t=>TAGS.includes(t)),next_step:clip(doc.next_step,300),next_date:day(doc.next_date)},
    activity:{at:now,by_email:actor.email,by_name:actor.name,kind:'conversation',handle:clip(doc.handle,80).replace(/^@/,''),detail:name}};
}

export function planNewLead(doc,actor){
  const handle=String(doc.handle||'').trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9._-]{1,80}$/.test(handle))throw Object.assign(Error('Handle: letters, digits, dots, underscores'),{status:400});
  const now=new Date().toISOString(),platform=['instagram','tiktok','facebook','email','bandcamp','other'].includes(doc.platform)?doc.platform:'other';
  return {row:{handle,name:clip(doc.name,200)||handle,platform,bucket:'review',status:'new',followers:0,owner:'',
    data:{bio:clip(doc.bio,1000),reason:'added by hand, not scored',source:'by hand',notes:'',ruling:'',preview:'',created_at:now},
    created_at:now,updated_at:now,updated_by:actor.email},
    activity:{at:now,by_email:actor.email,by_name:actor.name,kind:'added',handle,detail:''}};
}

export default async function handler(req,res){
  try{
    const auth=await authorize(req,['full','acquisition']);
    if(!auth.ok)return privateResponse(res,auth.status,{error:auth.error});
    const key=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY,db=rest(key);
    const actor={email:auth.email,role:auth.role,name:NAMES[auth.email]||auth.email.split('@')[0]};
    const notConnected=()=>privateResponse(res,200,{connection:{state:'not_connected',owner:'Claude Acquisition Board',reason:'The acquisition tables are not in the admin database yet. The Claude board is still the owner.'},capabilities:{read:false,write:false}});

    if(req.method==='GET'){
      let leads;
      try{leads=await db('acq_leads?select=*&order=queue_day.asc.nullslast,queue_order.asc.nullslast,handle.asc');}
      catch(e){if(missing(e))return notConnected();throw e;}
      const [conversations,activity,reference]=await Promise.all([
        db('acq_conversations?select=*&order=at.desc&limit=1000'),
        db('acq_activity?select=*&order=at.desc&limit=500'),
        db('acq_reference?select=key,data,updated_at')]);
      const ref=Object.fromEntries(reference.map(r=>[r.key,r.data]));
      return privateResponse(res,200,{connection:{state:'connected',owner:'Admin database',verified_at:new Date().toISOString()},
        me:{email:actor.email,role:actor.role,name:actor.name},capabilities:{read:true,write:true,approve:actor.role==='full'},
        leads:leads.map(shapeLead),conversations,activity,drafts:ref.drafts||{},runs:ref.runs||[],lanes:ref.lanes||[],
        venue_acts:ref.venue_acts||[],artists:ref.artists||null,tags:TAGS});
    }

    if(req.method!=='POST')return privateResponse(res,405,{error:'Method not allowed'});
    // Writes need the tables. Until the cutover the Claude board stays the only writable owner.
    try{await db('acq_leads?select=handle&limit=1');}
    catch(e){if(missing(e))return privateResponse(res,409,{code:'OWNER_NOT_CONNECTED',error:'The acquisition tables are not in the admin database yet. Nothing was saved.'});throw e;}
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const log=a=>db('acq_activity',{method:'POST',body:JSON.stringify(a),headers:{Prefer:'return=minimal'}});

    if(body.op==='lead.update'){
      const h=String(body.handle||'').toLowerCase();
      let rows;try{rows=await db(`acq_leads?handle=eq.${encodeURIComponent(h)}&select=*`);}catch(e){if(missing(e))return notConnected();throw e;}
      if(rows.length!==1)return privateResponse(res,404,{error:'No such prospect'});
      if(body.if_updated_at&&rows[0].updated_at!==body.if_updated_at)return privateResponse(res,409,{error:'Someone changed this prospect a moment ago. Reload and try again.',lead:shapeLead(rows[0])});
      const plan=planLeadChange(rows[0],body.patch||{},actor);
      const saved=await db(`acq_leads?handle=eq.${encodeURIComponent(h)}`,{method:'PATCH',body:JSON.stringify(plan.update),headers:{Prefer:'return=representation'}});
      await log(plan.activity);
      return privateResponse(res,200,{lead:shapeLead(saved[0])});
    }
    if(body.op==='lead.add'){
      const plan=planNewLead(body.lead||{},actor);
      try{await db('acq_leads',{method:'POST',body:JSON.stringify(plan.row),headers:{Prefer:'return=minimal'}});}
      catch(e){if(missing(e))return notConnected();if(e.code==='23505')return privateResponse(res,409,{error:'Already on the board'});throw e;}
      await log(plan.activity);
      return privateResponse(res,200,{lead:shapeLead(plan.row)});
    }
    if(body.op==='conversation.add'){
      const plan=planConversation(body.conversation||{},actor);
      let saved;try{saved=await db('acq_conversations',{method:'POST',body:JSON.stringify(plan.row),headers:{Prefer:'return=representation'}});}
      catch(e){if(missing(e))return notConnected();throw e;}
      await log(plan.activity);
      return privateResponse(res,200,{conversation:saved[0]});
    }
    return privateResponse(res,400,{error:'Unknown change'});
  }catch(e){
    if(e.status&&e.status<500)return privateResponse(res,e.status,{error:e.message});
    return privateResponse(res,503,{error:'Acquisition board unavailable. Nothing was saved.'});
  }
}
