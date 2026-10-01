export const GOALS={connection:'Make someone want to come back',opportunity:'Show what I can do',resource:'Give someone something useful',plugverse:'Help an artist use PlugVerse'};
export const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export function searchReferences(rows,{query='',topic='',mechanism='',format=''}={}){
 const words=query.toLowerCase().split(/\s+/).filter(Boolean);
 return rows.filter(r=>(!topic||r.analysis?.labels?.topic?.value===topic)&&(!mechanism||r.analysis?.labels?.mechanism?.value===mechanism)&&(!format||r.format===format)&&words.every(w=>`${r.creator} ${r.opening||''} ${r.transcript||''}`.toLowerCase().includes(w)));
}
export function summarizeReferences(rows,metric='views'){
 if(!['views','plays'].includes(metric))throw Error('Unknown metric');
 const seen=new Set(),groups=new Map();
 for(const r of rows){
  const a=r.analysis,key=a?.labels?.mechanism?.value;if(!key)continue;
  const fingerprint=(r.transcript||r.id).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
  if(seen.has(fingerprint))continue;seen.add(fingerprint);
  const s=r.snapshot;if(!s?.as_of||!Number.isFinite(s[metric])||s[metric]<=0)continue;
  const g=groups.get(key)||[];g.push(s[metric]);groups.set(key,g);
 }
 return [...groups].map(([mechanism,values])=>{values.sort((a,b)=>a-b);return {mechanism,n:values.length,median:(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2};});
}
export function makeBrief({plan,goal,cta,adaptation,payoff,rawIntent,format,references}){
 if(!plan?.id||!GOALS[goal])throw Error('Choose an existing piece and its purpose.');
 if(!['M01','M06','M09'].includes(format))throw Error('Choose the actual format.');
 if(!rawIntent?.trim()||!adaptation?.trim()||!payoff?.trim())throw Error('Add the real idea, what changes, and the payoff.');
 if(!references.length||references.length>3)throw Error('Choose one to three references.');
 if(cta&&!safeURL(cta))throw Error('Use an HTTPS destination, or leave it blank.');
 for(const r of references){
  if(format==='M09'){if(!r.review?.review_basis)throw Error('Silent work needs a reviewed visual reference.');}
  else if(!r.source||!r.opening||r.transcript_conflict||r.review?.spoken_hook_eligible===false)throw Error('This reference lacks eligible spoken source evidence.');
  if(!r.snapshot)throw Error('This reference lacks a source snapshot.');
 }
 return {version:1,idea_source:plan.source_path||`content_plan:${plan.id}`,raw_intent:rawIntent.trim(),format,audience_response:GOALS[goal],adaptation:adaptation.trim(),payoff:payoff.trim(),status:'draft',goal,cta_destination:cta||null,plan_id:plan.id,created_at:new Date().toISOString(),references:references.map(r=>({id:r.id,opening:r.opening,snapshot:r.snapshot,mechanism:r.review?.mechanism||r.analysis?.labels?.mechanism?.value||'manual review required',payoff_evidence:r.review?.payoff_evidence||(r.transcript||'').slice(-500),fit_limit:r.review?.fit_limit||'Transcript classification; delivery and transfer to my audience still require review.',follower_conversion:null,...(format==='M09'?{evidence_type:'visual_review',visual_source:r.review.review_basis}:{})}))};
}
