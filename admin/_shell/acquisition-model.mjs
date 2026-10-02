// Shared adapter contract. This contains no customer store and performs no sends.
export class RecordConflict extends Error{constructor(message){super(message);this.code='CONFLICT';}}
export function eligible(record,{sender,account,now=Date.now()}={}){
 if(record.suppressed)return {ok:false,reason:'Do not contact'};
 if(record.prior_contact_unknown)return {ok:false,reason:'Prior outreach needs reconciliation'};
 if(record.sent_at||record.send_uncertain)return {ok:false,reason:'Already sent or awaiting send verification'};
 if(record.owner!==sender||record.account!==account)return {ok:false,reason:'Assigned to a different sender or account'};
 if(record.status!=='approved'||!record.approval?.human_verified)return {ok:false,reason:'Current human approval required'};
 if(record.approval.draft_revision!==record.draft_revision||record.approval.sender!==sender||record.approval.account!==account||record.approval.channel!==record.channel)return {ok:false,reason:'Draft or sender changed after approval'};
 const evidenceTime=Date.parse(record.evidence_verified_at);
 if(!Number.isFinite(evidenceTime)||evidenceTime>now+300000||now-evidenceTime>7*86400000)return {ok:false,reason:'Recheck prospect evidence'};
 return {ok:true};
}
export function followUpDue(record){
 if(!record.sent_at||record.suppressed||record.reply_at||record.followup_sent_at)return null;
 const days={instagram:5,email:4}[record.channel];
 const sentTime=Date.parse(record.sent_at);
 return days&&Number.isFinite(sentTime)?new Date(sentTime+days*86400000).toISOString():null;
}
export function validateSend(record,input,actor){
 if(!input.operation_id||!/^[a-zA-Z0-9_-]{16,80}$/.test(input.operation_id))throw new Error('A durable operation ID is required');
 if(input.revision!==record.revision)throw new RecordConflict('This prospect changed. Refresh before continuing.');
 const check=eligible(record,actor);if(!check.ok)throw new RecordConflict(check.reason);
 if(typeof input.actual_text!=='string'||!input.actual_text.trim()||input.actual_text.length>10000)throw new Error('Actual sent text is required');
 if(!input.attested_sent)throw new Error('Confirm the message was actually sent');
 const time=Date.parse(input.sent_at);if(!Number.isFinite(time)||time>Date.now()+300000)throw new Error('A valid actual send time is required');
 return {operation_id:input.operation_id,record_id:record.id,expected_revision:record.revision,actual_text:input.actual_text,sent_at:input.sent_at,sender:actor.sender,account:actor.account,channel:record.channel};
}
