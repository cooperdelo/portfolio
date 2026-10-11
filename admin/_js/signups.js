import {mountShell,isLocalDemo} from '/admin/_shell/admin-shell.js';
import {sb,requireFullAdminOrRedirect} from '/admin/_shell/supabase.js';
import {esc,ago} from '/admin/_shell/ui.js';

// Signups: every email from the free giveaways (the /clock and the guide gates), newest first, with where
// they came from. Full admin only (RLS on subscribers / shop_leads is is_full_admin()).
// Reads `subscribers` (20261011-subscribers.sql). Until that migration is applied, it reads shop_leads,
// where /api/subscribe and /api/kit write in the meantime (source holds "clock:instagram:clock" style tags).
if(!(await requireFullAdminOrRedirect()))throw new Error('not full admin');
await mountShell({title:'Signups'});
const app=document.querySelector('#signups');
const head=`<header class="ws-head"><span class="ws-kicker">Personal / email list</span><h1>Who signed up, and from where.</h1><p>Emails from the free clock and the guide gates. Nothing is emailed to them yet; they get the thing on the page.</p></header>`;
const fmt=n=>Number(n||0).toLocaleString();
const missing=e=>/relation|schema cache|does not exist|Could not find/i.test(e?.message||'');

function demo(){ // invented, for the local ?demo preview only
  const src=['clock','guide'],kits=['','linkedin','music'];
  return {table:'subscribers',rows:Array.from({length:18},(_,i)=>({email:`reader${i}@example.com`,source:src[i%2],kit:i%2?kits[i%3]||'linkedin':'',utm_source:i%3?'instagram':null,utm_campaign:i%3?'clock':null,created_at:new Date(Date.now()-i*36e5*5).toISOString(),signups:1}))};
}
async function load(){
  if(isLocalDemo())return demo();
  const s=await sb.from('subscribers').select('email,source,kit,utm_source,utm_medium,utm_campaign,referrer,page,consent,signups,created_at').order('created_at',{ascending:false}).limit(2000);
  if(!s.error)return {table:'subscribers',rows:s.data||[]};
  if(!missing(s.error))return {table:'subscribers',rows:[],err:s.error};
  const l=await sb.from('shop_leads').select('email,kit,source,created_at').order('created_at',{ascending:false}).limit(2000);
  // shop_leads: kit 'clock' = the clock; source 'clock:instagram:clock' = giveaway:utm_source:utm_campaign
  const rows=(l.data||[]).map(r=>{const [g,us,uc]=(r.source||'').split(':');return {email:r.email,source:r.kit==='clock'?'clock':'guide',kit:r.kit==='clock'?'':r.kit,utm_source:us||null,utm_campaign:uc||null,created_at:r.created_at,signups:1,legacy:g};});
  return {table:'shop_leads',rows,err:l.error};
}

app.innerHTML=head+'<p role="status">Loading…</p>';
const d=await load();
const rows=d.rows,day=864e5,nowMs=Date.now();
const within=n=>rows.filter(r=>nowMs-new Date(r.created_at).getTime()<n*day).length;
const count=(f)=>{const o={};rows.forEach(r=>{const k=f(r);o[k]=(o[k]||0)+1;});return Object.entries(o).sort((a,b)=>b[1]-a[1]);};
const list=(entries)=>`<div class="st-rows">${entries.length?entries.map(([k,n])=>`<div><span>${esc(k)}</span><span>${fmt(n)}</span></div>`).join(''):'<div><span>Nothing yet.</span><span></span></div>'}</div>`;
const what=r=>r.source==='clock'?'Clock':`Guide · ${r.kit}`;
const from=r=>[r.utm_source,r.utm_campaign].filter(Boolean).join(' / ')||r.referrer||'direct';
const csv=()=>{const cols=['email','source','kit','utm_source','utm_medium','utm_campaign','referrer','page','consent','signups','created_at'];
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;return [cols.join(','),...rows.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');};

app.innerHTML=head+`<div class="st-strip">${[['All signups',rows.length],['Last 24 hours',within(1)],['Last 7 days',within(7)],['From the clock',rows.filter(r=>r.source==='clock').length],['From guides',rows.filter(r=>r.source==='guide').length]].map(([l,n])=>`<div><b>${fmt(n)}</b><small>${l}</small></div>`).join('')}</div>
<p class="ws-note" style="margin:-8px 0 22px">${isLocalDemo()?'Invented demo data.':d.table==='subscribers'?'Reading the subscribers table.':'Reading shop_leads until 20261011-subscribers.sql is applied (no UTM detail beyond source and campaign yet).'}${d.err&&!missing(d.err)?' Could not load: '+esc(d.err.message):''} <button type="button" class="btn" id="csv" style="margin-left:8px">Download CSV</button></p>
<div class="ws-grid">
  <section class="ws-card"><h2>By giveaway</h2>${list(count(what))}</section>
  <section class="ws-card"><h2>By source</h2>${list(count(from))}</section>
  <section class="ws-card" style="grid-column:1/-1"><h2>Recent</h2><div class="st-rows">${rows.length?rows.slice(0,60).map(r=>`<div><span>${esc(r.email)}</span><span>${esc(what(r))} · ${esc(from(r))} · ${esc(ago(r.created_at))}</span></div>`).join(''):'<div><span>Nothing yet.</span><span></span></div>'}</div></section>
</div>`;
document.querySelector('#csv')?.addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv()],{type:'text/csv'}));a.download=`signups-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);});
