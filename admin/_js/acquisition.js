import {mountShell,toast,isLocalDemo} from '/admin/_shell/admin-shell.js';
import {getSession} from '/admin/_shell/supabase.js';
import {esc,ago} from '/admin/_shell/ui.js';

// The acquisition board: sending queue, prospects, conversations and results, all from /api/acquisition.
// Nothing here sends a message. Copy, open and send happen in the real app, then Mark sent records it.

const ctx=await mountShell({title:'Acquisition'}),app=document.querySelector('#acquisition');
const VIEWS={queue:'Sending queue',prospects:'Prospects',replies:'Replies & follow-ups',results:'Experiments & results'};
const view=VIEWS[new URLSearchParams(location.search).get('view')]?new URLSearchParams(location.search).get('view'):'queue';
const TITLES={queue:'Good prospects. Less friction.',prospects:'Every act on the board.',replies:'Keep the conversation going.',results:'Compare what works.'};
const STATUS={new:'New',approved:'Draft approved',contacted:'Sent',replied:'Replied',signed_up:'Signed up',rejected:'Dropped'};
const QUEUE_ORDER=['Already on PlugVerse','Fri 10/3, your account','Fri 10/3, PlugVerse account','Ask Cooper first','Next','Mon 9/28','Tue 9/29','Wed 9/30','Thu 10/1','Fri 10/2','Next week pool','Not queued'];
const BUCKETS=['high_fit','dj_fit','solo_fit','gigging','review','dj_review','dj_pilot','existing_user','retired','hold','low_fit'];
const SENT=['contacted','replied','signed_up'];

const header=()=>`<header class="ws-head"><span class="ws-kicker">PlugVerse / Acquisition</span><h1>${TITLES[view]}</h1><p>Your Instagram + email lane and Karthik’s email / LinkedIn lane. One shared contact history, separate experiments. Nothing is sent from this page.</p></header>
<nav class="aq-tabs" aria-label="Acquisition sections">${Object.entries(VIEWS).map(([k,l])=>`<a href="/admin/acquisition/${k==='queue'?'':'?view='+k}"${k===view?' aria-current="page"':''}>${l}</a>`).join('')}</nav>`;

let S=null; // board state from the API
const by={queue:{mode:null,i:0},prospects:{q:'',bucket:'',status:'',verdict:'',open:null},replies:{who:'',tag:''}};

async function api(method,body){
  if(isLocalDemo()){const demo=await import('/admin/_js/acquisition-demo.js');return demo.handle(method,body);}
  const session=await getSession();
  const r=await fetch('/api/acquisition',{method,headers:{Authorization:`Bearer ${session?.access_token||''}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const data=await r.json().catch(()=>({error:'Unreadable response'}));
  if(!r.ok){const e=Error(data.error||'Connection unavailable');e.status=r.status;e.data=data;throw e;}
  return data;
}

const draftOf=l=>l.draft_text||S.drafts?.[l.draft]?.text||'';
const queueRank=l=>{const i=QUEUE_ORDER.indexOf(l.queue_day||'Not queued');return i<0?99:i;};
const sortQueue=(a,b)=>queueRank(a)-queueRank(b)||(a.queue_order??999)-(b.queue_order??999)||a.handle.localeCompare(b.handle);
const profileUrl=l=>l.platform==='tiktok'?`https://www.tiktok.com/@${encodeURIComponent(l.handle)}`:l.platform==='facebook'?`https://www.facebook.com/${encodeURIComponent(l.handle)}`:`https://www.instagram.com/${encodeURIComponent(l.handle)}/`;
const who=e=>{if(!e)return 'Someone';if(e===S.me?.email)return 'You';const n=e.split('@')[0];return n==='delocooper6'?'Cooper':n.charAt(0).toUpperCase()+n.slice(1);};
const fmt=n=>Number(n||0).toLocaleString();

function draftChecks(t){
  return [['Under 450 characters',t.length>0&&t.length<=450],['No unfilled placeholder',!/\[[^\]]*link[^\]]*\]/i.test(t)],
    ['Says what PlugVerse is for',/plugverse/i.test(t)],['No em dash',!/—/.test(t)],['No “would you be interested”',!/would you be interested/i.test(t)]];
}

async function copy(text,label){
  try{await navigator.clipboard.writeText(text);toast(label+' copied');}
  catch{toast('Copy blocked by the browser. Select the text instead.','err');}
}

async function saveLead(handle,patch,{quiet}={}){
  const l=S.leads.find(x=>x.handle===handle);
  try{
    const r=await api('POST',{op:'lead.update',handle,if_updated_at:l?.updated_at,patch});
    Object.assign(l,r.lead);if(!quiet)toast('Saved for everyone');return true;
  }catch(e){
    if(e.status===409&&e.data?.lead){Object.assign(l,e.data.lead);toast('Someone changed this a moment ago. Showing the latest.','err');render();}
    else toast(e.message,'err');
    return false;
  }
}

// ---------------------------------------------------------------- sending queue
function queueItems(){
  const mode=by.queue.mode||(S.capabilities.approve?'waiting':'ready');by.queue.mode=mode;
  return S.leads.filter(l=>draftOf(l)&&l.draft_verdict!=='rejected'&&!SENT.includes(l.status)&&l.status!=='rejected')
    .filter(l=>mode==='all'||(mode==='waiting'?!l.draft_verdict:l.draft_verdict==='approved')).sort(sortQueue);
}
function renderQueue(host){
  const items=queueItems(),mode=by.queue.mode,approve=S.capabilities.approve;
  const counts={waiting:S.leads.filter(l=>draftOf(l)&&!l.draft_verdict&&!SENT.includes(l.status)&&l.status!=='rejected').length,
    ready:S.leads.filter(l=>l.draft_verdict==='approved'&&!SENT.includes(l.status)&&l.status!=='rejected').length};
  if(by.queue.i>=items.length)by.queue.i=Math.max(0,items.length-1);
  const l=items[by.queue.i];
  const chips=`<div class="aq-chips" role="group" aria-label="Which drafts">${[['waiting',`Waiting for Cooper (${counts.waiting})`],['ready',`Approved, ready to send (${counts.ready})`],['all','Everything unsent']].map(([k,t])=>`<button type="button" data-mode="${k}" aria-pressed="${k===mode}">${t}</button>`).join('')}</div>`;
  if(!l){host.innerHTML=`<section class="ws-card">${chips}<h2 style="margin-top:22px">${mode==='waiting'?'Nothing waiting on you.':mode==='ready'?'Nothing approved and unsent.':'The queue is empty.'}</h2><p>${mode==='ready'&&!approve?'Cooper approves drafts first. Talk to artists already on PlugVerse in the meantime.':'New drafts land here as the finder adds prospects.'}</p><a class="ws-link" href="/admin/acquisition/?view=replies">Log a conversation</a></section>`;wire(host);return;}
  const text=draftOf(l),checks=draftChecks(text);
  host.innerHTML=`<section class="ws-card">${chips}
  <div class="aq-step" style="margin-top:22px"><span>${by.queue.i+1} of ${items.length} · ${esc(l.queue_day||'Not queued')}</span><span>${l.updated_by?`Last change ${esc(who(l.updated_by))}, ${esc(ago(l.updated_at))}`:''}</span></div>
  <div class="aq-focus">
    <div>
      <div class="aq-who"><div class="aq-av" aria-hidden="true">${esc((l.name||l.handle)[0].toUpperCase())}</div><div><div class="aq-handle">@${esc(l.handle)}</div><div class="aq-meta">${esc(l.name)} · ${fmt(l.followers)} followers · last post ${esc(l.last_post||'?')}</div></div></div>
      <div class="aq-bio">${esc(l.bio||'(empty bio)')}</div>
      <div><span class="aq-badge${l.bucket==='high_fit'?' hot':''}">${esc((l.bucket||'').replace('_',' '))}</span><span class="aq-badge">${esc(l.platform)}</span>${l.area?`<span class="aq-badge">${esc(l.area)}</span>`:''}</div>
      <p class="aq-why">${esc(l.reason||'')}</p>
      <div class="aq-controls" style="margin-top:14px"><span class="ws-note" style="align-self:center">Finder was</span><button class="aq-btn sm${l.finder_verdict==='right'?' on':''}" data-fv="right" type="button">Right</button><button class="aq-btn sm${l.finder_verdict==='wrong'?' on':''}" data-fv="wrong" type="button">Wrong</button></div>
    </div>
    <div>
      <label class="ws-note" for="aq-draft">The message${l.draft_verdict?` · ${l.draft_verdict==='approved'?'approved':'rejected'}`:' · waiting for Cooper'}</label>
      <textarea id="aq-draft" class="aq-draft" ${approve?'':'readonly'}>${esc(text)}</textarea>
      <div class="aq-checks" id="aq-checks">${checks.map(([t,ok])=>`<span class="${ok?'':'bad'}">${ok?'✓':'✗'} ${esc(t)}</span>`).join('')}</div>
      <div class="aq-controls">
        <button class="aq-btn" type="button" data-act="copy-handle">Copy username</button>
        <button class="aq-btn" type="button" data-act="copy-draft">Copy message</button>
        <a class="aq-btn" href="${profileUrl(l)}" target="_blank" rel="noopener">Open profile ↗</a>
        ${approve?`<button class="aq-btn${l.draft_verdict==='approved'?' on':''}" type="button" data-act="approve">Approve</button><button class="aq-btn" type="button" data-act="reject">Reject</button>`:''}
        <button class="aq-btn primary" type="button" data-act="sent" ${l.draft_verdict==='approved'?'':'disabled title="Approve the draft first"'}>Mark sent &amp; next</button>
        <button class="aq-btn" type="button" data-act="skip">Skip</button>
      </div>
      <p class="ws-note" style="margin-top:14px">Copying or opening never counts as sending. Press Mark sent only after the message is actually out. About 40 a day from one account; stop for 48 hours if Instagram says try again later.</p>
    </div>
  </div></section>
  <section class="ws-card" style="margin-top:18px"><h2>Up next</h2><ul class="aq-next">${items.slice(by.queue.i+1,by.queue.i+7).map((n,k)=>`<li><button type="button" data-jump="${by.queue.i+1+k}">@${esc(n.handle)}</button><small>${esc(n.name)} · ${esc(n.queue_day||'')}</small></li>`).join('')||'<li><small>Nothing after this one.</small></li>'}</ul></section>`;
  const ta=host.querySelector('#aq-draft');
  const fit=()=>{ta.style.height='auto';ta.style.height=Math.max(190,ta.scrollHeight+4)+'px';};fit(); // the whole message, no inner scroll
  ta.addEventListener('input',fit);
  ta.addEventListener('input',()=>{host.querySelector('#aq-checks').innerHTML=draftChecks(ta.value).map(([t,ok])=>`<span class="${ok?'':'bad'}">${ok?'✓':'✗'} ${esc(t)}</span>`).join('');});
  const edited=()=>approve&&ta.value!==text?{draft_text:ta.value}:{};
  host.querySelector('[data-act="copy-handle"]').onclick=()=>copy(l.handle,'Username');
  host.querySelector('[data-act="copy-draft"]').onclick=()=>copy(ta.value,'Message');
  host.querySelector('[data-act="skip"]').onclick=()=>{by.queue.i=(by.queue.i+1)%items.length;render();};
  host.querySelector('[data-act="approve"]')?.addEventListener('click',async()=>{if(await saveLead(l.handle,{...edited(),draft_verdict:'approved'}))render();});
  host.querySelector('[data-act="reject"]')?.addEventListener('click',async()=>{if(await saveLead(l.handle,{draft_verdict:'rejected'}))render();});
  // Cooper editing then sending approves the words that actually went out.
  host.querySelector('[data-act="sent"]').onclick=async()=>{const e=edited();if(await saveLead(l.handle,{...e,...(e.draft_text?{draft_verdict:'approved'}:{}),status:'contacted'},{quiet:true})){toast('Marked sent');render();}};
  host.querySelectorAll('[data-fv]').forEach(b=>b.onclick=async()=>{const v=b.dataset.fv===l.finder_verdict?null:b.dataset.fv;if(await saveLead(l.handle,{finder_verdict:v}))render();});
  host.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{by.queue.i=+b.dataset.jump;render();});
  wire(host);
}
function wire(host){host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{by.queue.mode=b.dataset.mode;by.queue.i=0;render();});}

// ---------------------------------------------------------------- prospects
function renderProspects(host){
  const f=by.prospects,q=f.q.toLowerCase(),approve=S.capabilities.approve;
  const rows=S.leads.filter(l=>(!f.bucket||l.bucket===f.bucket)&&(!f.status||l.status===f.status)&&(!f.verdict||(l.finder_verdict||'none')===f.verdict)
    &&(!q||[l.handle,l.name,l.bio,l.reason,l.notes].join(' ').toLowerCase().includes(q))).sort(sortQueue);
  const buckets=BUCKETS.filter(b=>S.leads.some(l=>l.bucket===b));
  host.innerHTML=`<section class="ws-card">
  <div class="aq-toolbar"><input type="search" id="pq" placeholder="Search handle, name, bio, notes" value="${esc(f.q)}" aria-label="Search prospects">
    <select id="ps" aria-label="Status"><option value="">Any status</option>${Object.entries(STATUS).map(([k,v])=>`<option value="${k}"${f.status===k?' selected':''}>${v}</option>`).join('')}</select>
    <select id="pv" aria-label="Finder verdict"><option value="">Any verdict</option><option value="none"${f.verdict==='none'?' selected':''}>Unreviewed</option><option value="right"${f.verdict==='right'?' selected':''}>Finder right</option><option value="wrong"${f.verdict==='wrong'?' selected':''}>Finder wrong</option></select>
    <span class="aq-count">${rows.length} of ${S.leads.length}</span><button class="aq-btn sm" type="button" id="padd" style="margin-left:auto">Add a prospect</button></div>
  <div class="aq-chips" role="group" aria-label="Bucket" style="margin-bottom:16px">${['',...buckets].map(b=>`<button type="button" data-b="${b}" aria-pressed="${f.bucket===b}">${b?esc(b.replace('_',' ')):'All buckets'}</button>`).join('')}</div>
  <form id="paddf" class="aq-form" hidden style="margin-bottom:18px"><label>Handle<input name="handle" required placeholder="handle, no @"></label><label>Act name<input name="name"></label><label>Platform<select name="platform"><option>instagram</option><option>tiktok</option><option>facebook</option><option>email</option><option>bandcamp</option><option>other</option></select></label><label class="wide">Bio, or why it fits<input name="bio"></label><div class="wide aq-controls"><button class="aq-btn primary" type="submit">Save prospect</button><span class="ws-note" style="align-self:center">Not scored, so it starts in review.</span></div></form>
  <div class="aq-table"><table><thead><tr><th>Act</th><th>Bucket</th><th>Why</th><th style="text-align:right">Followers</th><th>Queue</th><th>Finder</th><th>Draft</th><th>Status</th><th>Last change</th></tr></thead><tbody>
  ${rows.map(l=>`<tr class="aq-row" data-h="${esc(l.handle)}" aria-expanded="${f.open===l.handle}" tabindex="0"><td><b>${esc(l.name)}</b><br><small>@${esc(l.handle)} · ${esc(l.platform)}</small></td><td><span class="aq-badge${l.bucket==='high_fit'?' hot':''}">${esc((l.bucket||'').replace('_',' '))}</span></td><td style="max-width:280px;color:var(--text-2)">${esc(l.reason||'')}</td><td class="aq-num">${fmt(l.followers)}</td><td><small>${esc(l.queue_day||'')}</small></td><td><small>${esc(l.finder_verdict||'unreviewed')}</small></td><td><small>${draftOf(l)?esc(l.draft_verdict||'waiting'):'no draft'}</small></td><td><span class="aq-st ${esc(l.status)}">${esc(STATUS[l.status]||l.status)}</span></td><td><small>${l.updated_by?esc(who(l.updated_by))+', '+esc(ago(l.updated_at)):''}</small></td></tr>
  ${f.open===l.handle?editor(l,approve):''}`).join('')||'<tr><td colspan="9">Nothing matches.</td></tr>'}
  </tbody></table></div></section>`;
  const set=(k,v)=>{f[k]=v;render();};
  const pq=host.querySelector('#pq');pq.oninput=()=>{f.q=pq.value;clearTimeout(pq._t);pq._t=setTimeout(()=>{render();const n=document.querySelector('#pq');n.focus();n.setSelectionRange(n.value.length,n.value.length);},220);};
  host.querySelector('#ps').onchange=e=>set('status',e.target.value);
  host.querySelector('#pv').onchange=e=>set('verdict',e.target.value);
  host.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>set('bucket',b.dataset.b));
  host.querySelector('#padd').onclick=()=>{const fm=host.querySelector('#paddf');fm.hidden=!fm.hidden;if(!fm.hidden)fm.handle.focus();};
  host.querySelector('#paddf').onsubmit=async e=>{e.preventDefault();const fd=Object.fromEntries(new FormData(e.target));
    try{const r=await api('POST',{op:'lead.add',lead:fd});S.leads.push(r.lead);toast('Added for everyone');f.open=r.lead.handle;render();}catch(err){toast(err.message,'err');}};
  host.querySelectorAll('tr.aq-row').forEach(tr=>{const open=()=>{f.open=f.open===tr.dataset.h?null:tr.dataset.h;render();};tr.onclick=open;tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
  const ed=host.querySelector('.aq-edit');
  if(ed){const h=ed.dataset.h,val=n=>ed.querySelector(`[name="${n}"]`)?.value;
    ed.querySelector('[data-save]').onclick=async()=>{const patch={status:val('status'),owner:val('owner'),ruling:val('ruling'),notes:val('notes')};if(ed.querySelector('[name="draft_text"]')&&approve)patch.draft_text=val('draft_text');if(await saveLead(h,patch))render();};
    ed.querySelectorAll('[data-fv]').forEach(b=>b.onclick=async()=>{if(await saveLead(h,{finder_verdict:b.dataset.fv,finder_note:val('finder_note')}))render();});
    ed.querySelectorAll('[data-dv]').forEach(b=>b.onclick=async()=>{if(await saveLead(h,{draft_verdict:b.dataset.dv}))render();});}
}
function editor(l,approve){
  const d=draftOf(l);
  return `<tr class="aq-edit" data-h="${esc(l.handle)}"><td colspan="9"><div class="grid">
    <div class="wide"><div class="aq-bio" style="margin-top:0">${esc(l.bio||'(empty bio)')}</div><a class="ws-link" href="${profileUrl(l)}" target="_blank" rel="noopener">Open profile ↗</a></div>
    <label>Status<select name="status">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}"${l.status===k?' selected':''}>${v}</option>`).join('')}</select></label>
    <label>Owner<input name="owner" value="${esc(l.owner||'')}" placeholder="Cooper or Karthik"></label>
    <label>Ruling<input name="ruling" value="${esc(l.ruling||'')}" placeholder="self-books: yes / no / probably"></label>
    <label>If the finder was wrong, why<input name="finder_note" value="${esc(l.finder_note||'')}"></label>
    <div class="wide aq-controls"><span class="ws-note" style="align-self:center">Finder was</span><button class="aq-btn sm${l.finder_verdict==='right'?' on':''}" type="button" data-fv="right">Right</button><button class="aq-btn sm${l.finder_verdict==='wrong'?' on':''}" type="button" data-fv="wrong">Wrong</button></div>
    ${d?`<label class="wide">Message${l.draft_verdict?` (${esc(l.draft_verdict)})`:' (waiting for Cooper)'}<textarea name="draft_text" ${approve?'':'readonly'}>${esc(d)}</textarea></label>${approve?`<div class="wide aq-controls"><button class="aq-btn sm${l.draft_verdict==='approved'?' on':''}" type="button" data-dv="approved">Approve message</button><button class="aq-btn sm${l.draft_verdict==='rejected'?' on':''}" type="button" data-dv="rejected">Reject message</button></div>`:''}`:''}
    <label class="wide">Notes<textarea name="notes" placeholder="What happened, what they said, next step">${esc(l.notes||'')}</textarea></label>
    <div class="wide aq-controls"><button class="aq-btn primary" type="button" data-save>Save</button></div>
  </div></td></tr>`;
}

// ---------------------------------------------------------------- replies & conversations
function renderReplies(host){
  const f=by.replies,tags=S.tags||[],counts={};
  S.conversations.forEach(c=>(c.tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));
  const list=S.conversations.filter(c=>(!f.who||c.by_email===f.who)&&(!f.tag||(c.tags||[]).includes(f.tag)));
  const people=[...new Set(S.conversations.map(c=>c.by_email).filter(Boolean))];
  const talked=new Set(S.conversations.map(c=>(c.name||'').toLowerCase()));
  const artists=(S.artists?.rows||[]);
  const replied=S.leads.filter(l=>l.status==='replied');
  const DAYS={instagram:5,email:4},day=864e5;
  const due=S.leads.filter(l=>l.status==='contacted'&&l.sent_at&&!l.followup_sent_at&&DAYS[l.platform]&&Date.now()-Date.parse(l.sent_at)>=DAYS[l.platform]*day)
    .sort((a,b)=>Date.parse(a.sent_at)-Date.parse(b.sent_at));
  host.innerHTML=`<div class="ws-grid">
  <section class="ws-card"><h2>Log a conversation</h2><p>Every DM thread, call or chat at a show. Their exact words matter more than a summary.</p>
    <form class="aq-form" id="cf">
      <label>Artist or band<input name="name" required list="cnames"></label><label>Handle<input name="handle" placeholder="no @"></label>
      <label>Who they are<select name="kind"><option>Artist on PlugVerse</option><option>Prospect who replied</option><option>Artist met at a show</option><option>Other</option></select></label>
      <label>How<select name="channel"><option>Instagram DM</option><option>Text</option><option>Call</option><option>In person</option><option>Email</option><option>LinkedIn</option></select></label>
      <label>When<input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></label>
      <label>Where it landed<select name="outcome"><option value="">Not decided</option><option>Put the link in their bio</option><option>Will try it</option><option>Wants help setting up</option><option>Not now</option><option>Not for them</option></select></label>
      <label class="wide">What they said, in their words<textarea name="quote" placeholder="“we mostly book through instagram and it's a mess”"></textarea></label>
      <label class="wide">Notes<textarea name="notes" placeholder="What happened, what they use today, what they asked for"></textarea></label>
      <div class="wide"><span class="ws-note">What it tells us</span><div class="aq-chips" style="margin-top:8px">${tags.map(t=>`<label class="aq-tag"><input type="checkbox" name="tags" value="${esc(t)}">${esc(t)}</label>`).join('')}</div></div>
      <label>Next step<input name="next_step" placeholder="e.g. send setup help Thursday"></label><label>By<input type="date" name="next_date"></label>
      <div class="wide aq-controls"><button class="aq-btn primary" type="submit">Save conversation</button></div>
    </form><datalist id="cnames">${artists.map(a=>`<option value="${esc(a.name)}">`).join('')}${replied.map(l=>`<option value="${esc(l.name)}">`).join('')}</datalist></section>
  <section class="ws-card"><h2>What artists are telling us</h2><div class="aq-rows">${Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).map(t=>`<div><span>${esc(t)}</span><span>${counts[t]}</span></div>`).join('')||'<div><span>Nothing logged yet.</span><span></span></div>'}</div>
    <h2 style="margin-top:28px">The feedback call, 10 minutes</h2><ol class="aq-script"><li>How did you hear about PlugVerse, and what did you hope it would do?</li><li>Walk me through the last show you booked. Where did the back and forth happen?</li><li>Have you sent your booking link to anyone? If not, what stopped you?</li><li>What was confusing or annoying when you set it up?</li><li>If it disappeared tomorrow, would you notice? What would you miss?</li></ol>
    <p class="ws-note" style="margin-top:12px">Ask about what already happened, never “would you use this”. Don't promise features, prices or dates.</p>
    <h2 style="margin-top:28px">Follow-ups</h2><p>Instagram: one follow-up after at least five days without a reply. Email: one after four days in the same thread. Any reply or decline stops it.</p></section>
  </div>
  <section class="ws-card" style="margin-bottom:18px"><h2>Follow-ups due</h2><p>Sent with no reply yet: Instagram after five days, email after four. One follow-up each, and any reply stops it.</p><ul class="ws-list">${due.map(l=>`<li><div><strong>@${esc(l.handle)}</strong><small>${esc(l.name)} · sent ${esc(ago(l.sent_at))}${l.sent_by?' by '+esc(who(l.sent_by)):''}</small></div><div class="aq-controls"><a class="aq-btn sm" href="${profileUrl(l)}" target="_blank" rel="noopener">Open ↗</a><button class="aq-btn sm" type="button" data-fu="${esc(l.handle)}">Followed up</button><button class="aq-btn sm" type="button" data-rep="${esc(l.handle)}">They replied</button></div></li>`).join('')||'<li><small>Nothing due. Sends show up here once they pass the wait.</small></li>'}</ul></section>
  ${replied.length?`<section class="ws-card" style="margin-bottom:18px"><h2>Replied, not logged yet</h2><ul class="ws-list">${replied.filter(l=>!talked.has((l.name||'').toLowerCase())).map(l=>`<li><div><strong>${esc(l.name)}</strong><small>@${esc(l.handle)}</small></div><button class="aq-btn sm" type="button" data-talk="${esc(l.name)}|${esc(l.handle)}|Prospect who replied">Log it</button></li>`).join('')||'<li><small>Every reply has a logged conversation.</small></li>'}</ul></section>`:''}
  <section class="ws-card" style="margin-bottom:18px"><h2>Artists already on PlugVerse</h2><p>They signed up, so they'll tell you what worked and what didn't. Talk to them first.${S.artists?.pulled_at?` Pulled ${esc(S.artists.pulled_at)}, read-only, no emails.`:''}</p>
    <div class="aq-table"><table style="min-width:720px"><thead><tr><th>Artist</th><th>City</th><th>Signed up</th><th style="text-align:right">Links sent</th><th style="text-align:right">Requests in</th><th>Talked to</th><th></th></tr></thead><tbody>
    ${artists.map(a=>`<tr><td><b>${esc(a.name)}</b>${a.instagram?`<br><small>@${esc(a.instagram)}</small>`:''}</td><td><small>${esc(a.city||'')}</small></td><td><small>${esc(a.signed_up||'')}</small></td><td class="aq-num">${fmt(a.links_sent)}</td><td class="aq-num">${fmt(a.requests_in)}</td><td><small>${talked.has((a.name||'').toLowerCase())?'yes':'not yet'}</small></td><td><button class="aq-btn sm" type="button" data-talk="${esc(a.name)}|${esc(a.instagram||'')}|Artist on PlugVerse">Log a conversation</button></td></tr>`).join('')||'<tr><td colspan="7">No artist list on the board yet.</td></tr>'}
    </tbody></table></div></section>
  <section class="ws-card"><div class="aq-toolbar"><h2 style="margin:0">Every conversation</h2><select id="cw" aria-label="Who logged it"><option value="">Everyone</option>${people.map(p=>`<option value="${esc(p)}"${f.who===p?' selected':''}>${esc(who(p))}</option>`).join('')}</select><select id="ct" aria-label="Tag"><option value="">Any tag</option>${tags.map(t=>`<option${f.tag===t?' selected':''}>${esc(t)}</option>`).join('')}</select><span class="aq-count">${list.length} of ${S.conversations.length}</span></div>
    ${list.map(c=>`<div class="aq-convo"><strong>${esc(c.name)}</strong> ${c.handle?`<small class="ws-note">@${esc(c.handle)}</small>`:''}<div class="ws-note">${esc(c.kind)} · ${esc(c.channel)} · ${esc(c.date||'')} · logged by ${esc(c.by_name||who(c.by_email))}, ${esc(ago(c.at))}${c.outcome?' · '+esc(c.outcome):''}</div>${c.quote?`<div class="said">${esc(c.quote)}</div>`:''}${c.notes?`<p>${esc(c.notes)}</p>`:''}${(c.tags||[]).length?`<div style="margin-top:8px">${c.tags.map(t=>`<span class="aq-badge">${esc(t)}</span>`).join('')}</div>`:''}${c.next_step?`<p class="ws-note">Next: ${esc(c.next_step)}${c.next_date?' by '+esc(c.next_date):''}</p>`:''}</div>`).join('')||'<p>No conversations yet. Start with an artist already on PlugVerse.</p>'}
  </section>`;
  const fm=host.querySelector('#cf');
  fm.onsubmit=async e=>{e.preventDefault();const fd=new FormData(fm),doc=Object.fromEntries(fd);doc.tags=fd.getAll('tags');
    try{const r=await api('POST',{op:'conversation.add',conversation:doc});S.conversations.unshift(r.conversation);toast('Saved for everyone');render();}catch(err){toast(err.message,'err');}};
  host.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>{const [n,h,k]=b.dataset.talk.split('|');fm.name.value=n;fm.handle.value=h;fm.kind.value=k;fm.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>fm.quote.focus(),400);});
  host.querySelectorAll('[data-rep]').forEach(b=>b.onclick=async()=>{if(await saveLead(b.dataset.rep,{status:'replied'}))render();});
  host.querySelectorAll('[data-fu]').forEach(b=>b.onclick=async()=>{if(await saveLead(b.dataset.fu,{followup_sent_at:new Date().toISOString()}))render();});
  host.querySelector('#cw').onchange=e=>{f.who=e.target.value;render();};
  host.querySelector('#ct').onchange=e=>{f.tag=e.target.value;render();};
}

// ---------------------------------------------------------------- results
function renderResults(host){
  const L=S.leads,count=fn=>L.filter(fn).length,scored=(S.runs||[]).reduce((a,r)=>a+(r.pulled||0),0);
  const funnel=[['Accounts scored',scored],['On the board',L.length],['High fit',count(l=>l.bucket==='high_fit')],['Drafted',count(l=>draftOf(l))],['Approved',count(l=>l.draft_verdict==='approved')],['Sent',count(l=>SENT.includes(l.status))],['Replied',count(l=>['replied','signed_up'].includes(l.status))],['Signed up',count(l=>l.status==='signed_up')]];
  const wk=(()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getTime();})();
  const people=[...new Set(S.activity.map(a=>a.by_email).concat(S.conversations.map(c=>c.by_email)).filter(Boolean))];
  const stat=e=>{const a=S.activity.filter(x=>x.by_email===e&&Date.parse(x.at)>=wk),k=n=>a.filter(x=>x.kind===n).length;
    return [['Messages sent',k('sent')],['Conversations logged',S.conversations.filter(c=>c.by_email===e&&Date.parse(c.at)>=wk).length],['Drafts approved or rejected',k('draft_approved')+k('draft_rejected')],['Finder labels',k('finder_right')+k('finder_wrong')]];};
  const spend=(S.runs||[]).reduce((a,r)=>a+(r.spend_usd||0),0);
  const hf=(S.runs||[]).filter(r=>!/before/.test(r.note||'')).reduce((a,r)=>a+(r.high_fit||0),0),rt=(S.runs||[]).filter(r=>!/before/.test(r.note||'')).reduce((a,r)=>a+(r.right||0),0);
  host.innerHTML=`<div class="aq-funnel">${funnel.map(([l,n])=>`<div><b>${fmt(n)}</b><small>${l}</small></div>`).join('')}</div>
  <div class="ws-grid">
    <section class="ws-card"><h2>This week, by person</h2>${people.map(p=>`<h3 style="margin:18px 0 6px">${esc(who(p))}</h3><div class="aq-rows">${stat(p).map(([l,n])=>`<div><span>${l}</span><span>${n}</span></div>`).join('')}</div>`).join('')||'<p>Nothing this week yet. Every approve, label, send and conversation shows up here with who did it.</p>'}</section>
    <section class="ws-card"><h2>Finder accuracy and spend</h2><div class="aq-rows"><div><span>High-fit calls after the code rules</span><span>${hf}</span></div><div><span>Confirmed right by a human read</span><span>${rt}</span></div><div><span>Precision</span><span>${hf?Math.round(100*rt/hf)+'%':'—'}</span></div><div><span>Finder labels on the board</span><span>${count(l=>l.finder_verdict)}</span></div><div><span>Scraper spend, all runs</span><span>$${spend.toFixed(2)}</span></div></div>
      <div class="aq-table" style="margin-top:16px"><table style="min-width:520px"><thead><tr><th>Date</th><th>Source</th><th style="text-align:right">Pulled</th><th style="text-align:right">High fit</th><th style="text-align:right">Spend</th></tr></thead><tbody>${(S.runs||[]).map(r=>`<tr><td><small>${esc(r.date)}</small></td><td>${esc(r.source)}<br><small>${esc(r.note||'')}</small></td><td class="aq-num">${fmt(r.pulled)}</td><td class="aq-num">${fmt(r.high_fit)}</td><td class="aq-num">$${Number(r.spend_usd||0).toFixed(3)}</td></tr>`).join('')}</tbody></table></div></section>
  </div>
  <section class="ws-card" style="margin-bottom:18px"><h2>Recent activity</h2><ul class="ws-list">${S.activity.slice(0,25).map(a=>`<li><div><strong>${esc(a.by_name||who(a.by_email))} ${esc({finder_right:'marked the finder right on',finder_wrong:'marked the finder wrong on',draft_approved:'approved the message for',draft_rejected:'rejected the message for',sent:'sent the first message to',replied:'logged a reply from',followup:'followed up with',signed_up:'logged a signup from',edit:'edited',conversation:'logged a conversation with',added:'added'}[a.kind]||a.kind)} ${a.handle?'@'+esc(a.handle):esc(a.detail)}</strong></div><small>${esc(ago(a.at))}</small></li>`).join('')||'<li><small>No activity yet.</small></li>'}</ul></section>
  <section class="ws-card" id="aq-outcomes"><h2>Product outcomes · last 30 days</h2><p role="status">Reading existing signup attribution…</p></section>`;
  outcomes(host.querySelector('#aq-outcomes'));
}
async function outcomes(section){
  if(isLocalDemo()){section.innerHTML='<h2>Product outcomes</h2><p>Sign in to query the product database. No synthetic signup totals are shown.</p>';return;}
  try{
    const session=await getSession();const r=await fetch('/api/acquisition-results',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});const o=await r.json();if(!r.ok)throw Error(o.error);
    section.innerHTML=`<h2>Product outcomes · last 30 days</h2><p class="ws-note">${esc(o.source)} · observed ${esc(new Date(o.observed_at).toLocaleString())}</p><div class="aq-table"><table><thead><tr><th>Source / campaign</th><th>Artist accounts</th><th>Email verified</th><th>Onboarded</th><th>First-booking marker</th></tr></thead><tbody>${o.rows.map(x=>`<tr><td>${esc(x.source)}<br><small>${esc(x.medium||'')} ${esc(x.campaign||'')}</small></td><td class="aq-num">${x.accounts}</td><td class="aq-num">${x.email_verified}</td><td class="aq-num">${x.onboarded}</td><td class="aq-num">${x.first_booking_markers}</td></tr>`).join('')}</tbody></table></div>${o.rows.length?'':'<p>No artist account records returned in this window.</p>'}<p class="ws-note">${esc(o.coverage.test_internal_exclusion)} ${esc(o.coverage.sender_attribution)} A first-booking marker is not yet independently verified as a real gig.</p>`;
  }catch(e){section.innerHTML='<h2>Product outcomes unavailable</h2><p>'+esc(e.message)+'</p>';}
}

// ---------------------------------------------------------------- shell
function notConnected(c){
  app.innerHTML=header()+`<section class="ws-card"><span class="ws-state warn">${c.state==='not_connected'?'Board not connected':'Connection unavailable'}</span><h2>The Claude board is still the owner.</h2><p>${esc(c.reason||'')}</p><p class="aq-notice">This page switches on once the acquisition tables are in the admin database and the current board has been imported. Until then it doesn't create prospects, record sends or show unknown results as zero.</p><a class="ws-link" href="https://claude.ai/artifact/5SoV39QXz4NghVwKvmzSN6" target="_blank" rel="noopener">Open the current board ↗</a></section>`;
}
function render(){
  if(!S)return;
  const y=scrollY;
  app.innerHTML=header()+'<div id="aq-view"></div>';
  const host=app.querySelector('#aq-view');
  ({queue:renderQueue,prospects:renderProspects,replies:renderReplies,results:renderResults})[view](host);
  scrollTo(0,y);
}

app.innerHTML=header()+'<p role="status">Loading the board…</p>';
try{
  const data=await api('GET');
  if(data.connection?.state!=='connected')notConnected(data.connection||{});
  else{S=data;S.leads=S.leads||[];S.conversations=S.conversations||[];S.activity=S.activity||[];render();}
}catch(e){notConnected({state:'unavailable',reason:e.message});}
void ctx;
