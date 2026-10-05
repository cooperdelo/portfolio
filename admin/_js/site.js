import {mountShell,isLocalDemo} from '/admin/_shell/admin-shell.js';
import {sb,requireFullAdminOrRedirect} from '/admin/_shell/supabase.js';
import {esc,ago} from '/admin/_shell/ui.js';

// Portfolio visitors: first-party events from /api/track (site_events). One visit = one tab session.
if(!(await requireFullAdminOrRedirect()))throw new Error('not full admin');
await mountShell({title:'Portfolio visitors'});
const app=document.querySelector('#site');
let days=Number(new URLSearchParams(location.search).get('days'))||30;
const head=()=>`<header class="ws-head"><span class="ws-kicker">Personal / cooperdelo.com</span><h1>Who came, and how far they got.</h1><p>First-party visits from your portfolio. No cookies and nothing personal: one random id per tab visit, and Do Not Track is respected.</p></header>
<nav class="st-tabs" aria-label="Range">${[7,30,90].map(d=>`<a href="?days=${d}"${d===days?' aria-current="page"':''}>Last ${d} days</a>`).join('')}</nav>`;

function demoRows(){ // invented, for the local ?demo preview only
  const out=[],pages=['/','/work/plugverse-launch-film','/work/bioswap','/work-with-me','/resources/','/resources/film-plan','/work/chapter-one'],refs=['instagram.com','tiktok.com','linkedin.com','','','google.com'];
  for(let s=0;s<140;s++){const id='demo'+s.toString(36).padStart(6,'0'),t=Date.now()-Math.random()*days*864e5,ref=refs[s%refs.length],dev=s%3?'phone':'desktop';
    const push=(name,path,props={})=>out.push({session:id,name,path,props,at:new Date(t+out.length*1000).toISOString(),referrer:ref,source:ref==='instagram.com'&&s%4===0?'ig_bio':'',device:dev});
    push('page_view','/');if(s%5)push('motion_beat','/',{beat:1});if(s%5&&s%4)push('motion_beat','/',{beat:3});if(s%5&&s%3===0)push('motion_beat','/',{beat:5});
    if(s%3!==2)push('page_view',pages[1+s%6]);if(s%4===0)push('record_pull','/',{album:['In Rainbows','Vs.','Dirt','Siamese Dream'][s%4?1:s%3]});
    if(s%7===0)push('page_view','/work-with-me');if(s%14===0)push('brief_drafted','/work-with-me',{kind:'Film or motion'});
    if(s%9===0){push('page_view','/resources/film-plan');push('planner_started','/resources/film-plan');if(s%18===0)push('planner_download','/resources/film-plan',{filled:5});}
    if(s%11===0)push('cta_click','/',{target:s%22?'book_call':'plugverse'});
    if(s%4===1){push('cta_click','/',{target:'resource',from:'picker',to:'film-motion'});push('resource_open','/resources/guides/film-motion',{to:'film-motion',from:'picker'});
      if(s%8===1){push('gate_view','/resources/guides/film-motion',{kit:'film-motion'});if(s%16===1){push('email_submit','/resources/guides/film-motion',{kit:'film-motion'});push('kit_unlock','/resources/guides/film-motion',{kit:'film-motion',how:'email'});
        if(s%32===1){push('cta_click','/resources/guides/film-motion',{target:'resource',from:'next',to:'design-kit'});push('checkout_start','/shop/design-kit',{kit:'design'});}}}}}
  return out;
}

async function load(){
  if(isLocalDemo())return {rows:demoRows()};
  const since=new Date(Date.now()-days*864e5).toISOString(),rows=[];
  for(let from=0;from<50000;from+=1000){
    const {data,error}=await sb.from('site_events').select('session,name,path,props,at,referrer,source,device').gte('at',since).order('at',{ascending:true}).range(from,from+999);
    if(error)return {error};
    rows.push(...data);if(data.length<1000)break;
  }
  return {rows};
}

const pct=(a,b)=>b?Math.round(100*a/b)+'%':'—';
const fmt=n=>Number(n||0).toLocaleString();
function bars(list,total){return `<div class="st-rows">${list.map(([k,n])=>`<div><span>${esc(k)}</span><span>${fmt(n)} · ${pct(n,total)}</span></div>`).join('')||'<div><span>Nothing yet.</span><span></span></div>'}</div>`;}
function funnel(steps){const top=steps[0][1]||1;return `<div class="st-rows">${steps.map(([l,n],i)=>`<div style="display:block"><div style="display:flex;justify-content:space-between;gap:14px"><span>${l}</span><span>${fmt(n)}${i?' · '+pct(n,steps[0][1]):''}</span></div><div class="st-bar"><i style="width:${Math.round(100*n/top)}%"></i></div></div>`).join('')}</div>`;}

app.innerHTML=head()+'<p role="status">Loading visits…</p>';
const {rows,error}=await load();
if(error){
  const missing=/site_events|relation|schema cache/i.test(error.message||'');
  app.innerHTML=head()+`<section class="ws-card"><span class="ws-state warn">${missing?'Not switched on yet':'Unavailable'}</span><h2>${missing?'Visits start recording once the table exists.':'Couldn’t read visits.'}</h2><p>${missing?'The site already sends events to /api/track, which drops them until <code>scripts/migrations/20261002-site-events.sql</code> is applied. Nothing before that point can be recovered.':esc(error.message)}</p></section>`;
} else {
  const by=s=>{const m=new Map();rows.forEach(r=>{if(!m.has(r.session))m.set(r.session,[]);m.get(r.session).push(r);});return m;};
  const S=by(),visits=[...S.values()];
  const has=(v,f)=>v.some(f),count=f=>visits.filter(v=>has(v,f)).length;
  const views=rows.filter(r=>r.name==='page_view');
  const work=count(r=>r.name==='page_view'&&r.path.startsWith('/work/'));
  const wwm=count(r=>r.name==='page_view'&&r.path==='/work-with-me');
  const brief=count(r=>r.name==='brief_drafted');
  const cta=t=>count(r=>r.name==='cta_click'&&r.props?.target===t);
  const res=count(r=>r.name==='page_view'&&r.path.startsWith('/resources'));
  const plan=count(r=>r.name==='page_view'&&r.path==='/resources/film-plan');
  const started=count(r=>r.name==='planner_started'),dl=count(r=>r.name==='planner_download');
  const beat=n=>count(r=>r.name==='motion_beat'&&r.props?.beat===n);
  // Funnel to the kit, strict: a visit counts at a step only if it also hit every earlier step.
  const STEPS=[['Visited','page_view'],['Opened a resource','resource_open'],['Saw an email gate','gate_view'],['Gave an email','email_submit'],['Started checkout','checkout_start'],['Unlocked a kit','kit_unlock']];
  const chain=STEPS.map(([l],i)=>[l,visits.filter(v=>STEPS.slice(0,i+1).every(([,n])=>has(v,r=>r.name===n))).length]);
  const from=f=>count(r=>r.name==='cta_click'&&r.props?.from===f);
  const pulls=rows.filter(r=>r.name==='record_pull'),albums={};pulls.forEach(r=>albums[r.props?.album]=(albums[r.props?.album]||0)+1);
  const src={};visits.forEach(v=>{const r=v[0];const k=r.source?`${r.referrer||'direct'} · ${r.source}`:(r.referrer||'Direct or unknown');src[k]=(src[k]||0)+1;});
  const pages={};views.forEach(r=>pages[r.path]=(pages[r.path]||0)+1);
  const dev={};visits.forEach(v=>{const d=v[0].device||'unknown';dev[d]=(dev[d]||0)+1;});
  const deep=visits.filter(v=>v.filter(r=>r.name==='page_view').length>1).length;
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const last=rows.length?rows[rows.length-1].at:null;
  app.innerHTML=head()+`<div class="st-strip">${[['Visits',visits.length],['Saw more than one page',deep],['Opened a project',work],['Wrote a brief',brief],['Booked a call (clicked)',cta('book_call')],['Went to PlugVerse',cta('plugverse')]].map(([l,n])=>`<div><b>${fmt(n)}</b><small>${l}</small></div>`).join('')}</div>
  <p class="ws-note" style="margin:-8px 0 22px">${isLocalDemo()?'Invented demo data.':last?`Last event ${esc(ago(last))}.`:'No events in this range yet.'} Clicks count intent; the click itself doesn't prove a call was booked or an email sent.</p>
  <div class="ws-grid">
    <section class="ws-card"><h2>Work → conversation</h2>${funnel([['Visited',visits.length],['Opened a project',work],['Opened Work with me',wwm],['Wrote the brief',brief]])}</section>
    <section class="ws-card"><h2>Resources</h2>${funnel([['Visited Resources',res],['Opened the planner',plan],['Started filling it in',started],['Downloaded a plan',dl]])}<p class="ws-note" style="margin-top:12px">Starter interest clicks: ${fmt(cta('starter_interest'))}</p></section>
    <section class="ws-card"><h2>Free playbooks → kit</h2>${funnel(chain)}<p class="ws-note" style="margin-top:12px">Each step counts visits that also did every step above it. Any path: ${fmt(count(r=>r.name==='checkout_start'))} started checkout, ${fmt(count(r=>r.name==='kit_unlock'&&r.props?.how==='paid'))} paid unlocks. Clicks from the picker ${fmt(from('picker'))}, Next cards ${fmt(from('next'))}, case pages ${fmt(from('case'))}, hero ${fmt(from('hero'))}.</p></section>
    <section class="ws-card"><h2>How far into Motion</h2>${funnel([['Reached beat 1',beat(1)],['Beat 3, the bio swap',beat(3)],['Beat 5, the end',beat(5)]])}</section>
    <section class="ws-card"><h2>On Repeat</h2><p>${fmt(pulls.length)} records pulled by hand in ${fmt(count(r=>r.name==='record_pull'))} visits.</p>${bars(top(albums),pulls.length)}</section>
    <section class="ws-card"><h2>Where visits came from</h2>${bars(top(src),visits.length)}</section>
    <section class="ws-card"><h2>Pages</h2>${bars(top(pages),views.length)}<h3 style="margin:18px 0 6px">Devices</h3>${bars(top(dev),visits.length)}</section>
  </div>`;
}

// Messages from the contact popup (/api/contact -> site_messages), newest first.
if(!isLocalDemo()){
  const {data,error}=await sb.from('site_messages').select('at,kind,name,reply,message').order('at',{ascending:false}).limit(30);
  const grid=app.querySelector('.ws-grid')||app;
  const card=document.createElement('section');card.className='ws-card';card.style.gridColumn='1 / -1';
  card.innerHTML=error?`<h2>Messages</h2><span class="ws-state warn">Not switched on yet</span><p>Messages from the contact popup start saving once <code>scripts/migrations/20261003-site-messages.sql</code> is applied.</p>`
   :`<h2>Messages</h2>${data.length?`<div class="st-rows">${data.map(m=>`<div style="display:block"><div style="display:flex;justify-content:space-between;gap:14px"><span><b>${esc(m.name)}</b> · ${esc(m.kind)} · ${esc(m.reply)}</span><span>${esc(ago(m.at))}</span></div><p style="margin:6px 0 0;white-space:pre-wrap">${esc(m.message)}</p></div>`).join('')}</div>`:'<p>No messages yet.</p>'}`;
  grid.prepend(card);
}
