import {mountShell} from '/admin/_shell/admin-shell.js';
import {sb} from '/admin/_shell/supabase.js';
import {esc} from '/admin/_shell/ui.js';
import {DIRECTORY} from '/admin/_shell/directory.js';
import {scopeForTask} from '/admin/_shell/workspace-model.mjs';
const mode=document.body.dataset.workspace;
const ctx=await mountShell({title:mode==='choose'?'Your workspace':mode==='plugverse'?'PlugVerse':mode==='more'?'More tools':'Personal'});
const app=document.querySelector('#workspace');
const date=d=>d?new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not recorded';
const card=(title,body,extra='')=>`<section class="ws-card ${extra}"><h2>${title}</h2>${body}</section>`;
const link=(href,label)=>`<a href="${href}">${label} ↗</a>`;
const head=(title,description)=>`<header class="ws-head"><span class="ws-kicker">Cooper Delo / ${mode==='plugverse'?'PlugVerse':mode==='personal'?'Personal':'Admin'}</span><h1>${title}</h1><p>${description}</p></header>`;
if(mode==='choose') {
  app.innerHTML=head('A place for each part.','Choose what you’re working on. Your content stays together; your personal and business work stay separate.')+`<div class="ws-grid"><a class="ws-card ws-choice" href="/admin/personal/"><div><div class="ws-no">01 / Personal</div><h2>Your day, outside PlugVerse.</h2><p>Decisions, health, school, money and the things you’re making.</p></div><span class="ws-enter">Open Personal ↗</span></a><a class="ws-card ws-choice" href="/admin/plugverse/"><div><div class="ws-no">02 / PlugVerse</div><h2>Build something artists use.</h2><p>Your outreach, Karthik’s experiments, signups and real gig activity.</p></div><span class="ws-enter">Open PlugVerse ↗</span></a></div><div class="ws-shared"><div><strong>One content workspace.</strong><p>Personal, PlugVerse and Rubber Band. Separate accounts, together in one view.</p></div>${link('/admin/content/','Open all content')}</div><p class="ws-note">Existing tools and history are in ${link('/admin/more/','More tools')}.</p>`;
} else if(mode==='more') {
  app.innerHTML=head('Everything still has a place.','The full directory, when you need it. Your daily work lives in Personal, PlugVerse and Content.')+`<div class="ws-grid">${DIRECTORY.map(section=>{const items=section.items.filter(x=>x.roles?x.roles.includes(ctx.role):['full','plugverse'].includes(ctx.role));return items.length?card(esc(section.section),`<ul class="ws-list">${items.map(x=>`<li>${link(x.href==='/admin/'?'/admin/personal/overview.html':x.href==='/admin/plugverse/'?'/admin/plugverse/metrics.html':x.href,esc(x.label))}</li>`).join('')}</ul>`):'';}).join('')}${ctx.role==='full'?card('Band media',`<p>Review photos, select favorites and mark video highlights without changing your originals.</p>${link('/admin/assets/','Open media review')}`):''}</div>`;
} else {
  const pv=mode==='plugverse';
  app.innerHTML=head(pv?'Artists first. Real gigs next.':'A little less to keep in your head.',pv?'Your Instagram approach and Karthik’s email / LinkedIn experiments, with shared ownership and one history.':'Your personal priorities and decisions. All content remains in the shared Content workspace.')+`<div class="ws-tools">${pv?link('/admin/acquisition/','Your sending queue')+link('/admin/acquisition/?view=results','Compare experiments'):link('/admin/schedule/','Content schedule')+link('/admin/health/dashboard.html','Health')+link('/admin/academics/','Academics')}${ctx.role==='full'?link('/admin/content/','All content'):''}</div><div class="ws-grid"><section class="ws-card" id="ws-priorities"><h2>What needs you</h2><p class="ws-loading" role="status">Checking the current source…</p></section>${pv?card('Two approaches. One goal.',`<ul class="ws-list"><li><div><strong>Cooper / Instagram</strong><small>Your artist outreach, with a fast copy-and-send queue.</small></div></li><li><div><strong>Karthik / Email + LinkedIn</strong><small>Independent experiment. Access and sender-specific copy still need verification.</small></div></li></ul>${link('/admin/acquisition/?view=results','Compare verified outcomes')}`):card('Personal, with room to focus.',`<p>Health, school and finances stay here. Work through what matters, then get back to your day.</p><div class="ws-tools">${link('/admin/finance/','Money')}${link('/admin/life/music.html','Music')}${link('/admin/personal/overview.html','Detailed overview')}</div>`)}<section class="ws-card" id="ws-strategy"><h2>${pv?'Current approved guidance':'Decisions and context'}</h2><p class="ws-loading">Checking source-backed items…</p></section><section class="ws-card" id="ws-health"><h2>Updates needing attention</h2><p class="ws-loading">Checking recent attempts…</p></section></div>`;
  if(ctx.role==='acquisition'){
    document.querySelector('#ws-priorities').innerHTML='<h2>Your assigned work</h2><p>Acquisition connection has not been verified yet. Private task sources are not loaded.</p>'+link('/admin/acquisition/','Connection status');
    document.querySelector('#ws-strategy').innerHTML='<h2>Approved guidance</h2><p>Acquisition-scoped guidance becomes available after the contributor adapter is verified.</p>';
    document.querySelector('#ws-health').innerHTML='<h2>Connection status</h2><span class="ws-state warn">Not connected</span><p>The current board’s source and saved history are required.</p>';
  } else if(ctx.role==='full') {
    await Promise.allSettled([priorities(pv),strategy(pv),health()]);
  } else {
    document.querySelector('#ws-priorities').innerHTML='<h2>Existing business tools</h2>'+link('/admin/plugverse/metrics.html','Business metrics');
    document.querySelector('#ws-strategy').innerHTML='<h2>Approved guidance</h2>'+link('/admin/playbook/','Open existing Playbook');
    document.querySelector('#ws-health').innerHTML='<h2>Acquisition integration</h2><p>Not connected. Existing business access is preserved.</p>';
  }
}
async function priorities(pv){
 const el=document.querySelector('#ws-priorities');
 try{
  let q=sb.from('command_center').select('id,title,kind,priority,due,source_path,updated_at,expires_at').eq('done',false).order('priority').limit(20);
  q=pv?q.like('source_path','Projects/plugverse/%'):q.not('source_path','like','Projects/plugverse/%');
  const {data,error}=await q;if(error)throw error;
  const rows=(data||[]).filter(r=>!r.expires_at||Date.parse(r.expires_at)>Date.now()).slice(0,5);
  el.innerHTML='<h2>What needs you</h2>'+(rows.length?`<ul class="ws-list">${rows.map(r=>`<li><div><strong>${esc(r.title)}</strong><small>${scopeForTask(r)==='unclassified'?'Scope needs review · ':''}${esc(r.kind||'Action')}${r.due?' · due '+esc(date(r.due)):''}</small><small>${esc(r.source_path||'Source not recorded')} · updated ${esc(date(r.updated_at))}</small></div>${link('/admin/decisions/','Open')}</li>`).join('')}</ul>`:'<p>No open items were returned by this source. Acquisition follow-ups are shown separately in the queue.</p>');
 }catch(e){el.innerHTML='<h2>What needs you</h2><p class="ws-error">Could not load current priorities. Your existing list is still available.</p>'+link('/admin/decisions/','Open decisions');}
}
async function strategy(pv){
 const el=document.querySelector('#ws-strategy');
 try{const {data,error}=await sb.from('v_playbook_active').select('id,title,summary,source_vault_path,source_anchor,last_synced_at,status').eq('scope',pv?'plugverse':'personal-brand').in('item_type',['strategy','decision','rule']).order('priority').limit(3);if(error)throw error;
 el.innerHTML=`<h2>${pv?'Source-backed guidance':'Decisions and context'}</h2><p class="ws-note">Existing active Playbook entries. Their approval revision is not yet verified by the new synchronization contract.</p>`+(data?.length?`<ul class="ws-list">${data.map(r=>`<li><div><strong>${esc(r.title)}</strong><small>${esc(r.summary||'')}</small><small>${esc(r.source_vault_path||'Source missing')} · synced ${esc(date(r.last_synced_at))}</small></div></li>`).join('')}</ul>`:'<p>No matching active guidance returned.</p>')+link('/admin/playbook/','Read the source context');
 }catch{el.innerHTML='<h2>Guidance unavailable</h2><p>The source could not be loaded. No replacement strategy has been invented.</p>'+link('/admin/playbook/','Open Playbook');}
}
async function health(){
 const el=document.querySelector('#ws-health');
 try {const {data,error}=await sb.from('task_run_log').select('task,ran_at,status,note').gte('ran_at',new Date(Date.now()-48*3600000).toISOString()).order('ran_at',{ascending:false}).limit(100);if(error)throw error;
 const latest=new Map();for(const r of data||[])if(!latest.has(r.task))latest.set(r.task,r);
 const failures=[...latest.values()].filter(r=>['failed','partial','error'].includes(r.status)).slice(0,3);
 el.innerHTML='<h2>Updates needing attention</h2>'+(failures.length?`<ul class="ws-list">${failures.map(r=>`<li><div><strong>${esc(r.task.replaceAll('-',' '))}</strong><small>${esc(r.status)} · ${esc(date(r.ran_at))}</small></div></li>`).join('')}</ul>`:'<p>No failed latest attempt found in the last 48 hours. This does not certify missing or never-connected feeds.</p>')+link('/admin/integrations/','Inspect and resolve');
 }catch{el.innerHTML='<h2>Update status unavailable</h2><p>Could not inspect recent attempts.</p>'+link('/admin/integrations/','Open integrations');}
}
