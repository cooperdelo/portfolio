import {mountShell,isLocalDemo} from '/admin/_shell/admin-shell.js';
import {sb,requireFullAdminOrRedirect} from '/admin/_shell/supabase.js';
import {esc,ago} from '/admin/_shell/ui.js';

// Shop: who unlocked a guide with their email, who paid for a kit, and how many got there from a gate.
if(!(await requireFullAdminOrRedirect()))throw new Error('not full admin');
await mountShell({title:'Shop'});
const app=document.querySelector('#shop');
const head=`<header class="ws-head"><span class="ws-kicker">Personal / shop.cooperdelo.com</span><h1>Who took something, and who paid.</h1><p>Emails from the guide gates, orders from Stripe, and the steps in between from the site's own events.</p></header>`;
const fmt=n=>Number(n||0).toLocaleString();
const money=(c,cur='usd')=>c==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:(cur||'usd').toUpperCase()}).format(c/100);
const missing=e=>/relation|schema cache|does not exist/i.test(e?.message||'');

function demo(){ // invented, for the local ?demo preview only
  const kits=['linkedin','music','ai-system','film-motion','instagram-tiktok'];
  return {leads:Array.from({length:23},(_,i)=>({email:`reader${i}@example.com`,kit:kits[i%5],created_at:new Date(Date.now()-i*36e5*7).toISOString()})),
    orders:Array.from({length:4},(_,i)=>({kit:'design',email:`buyer${i}@example.com`,amount_total:i===2?0:2900+(i%2)*203,amount_tax:(i%2)*203,currency:'usd',promo_code:i===2?'discount':null,created_at:new Date(Date.now()-i*864e5).toISOString()})),
    events:[...Array(140)].map((_,i)=>({name:['gate_view','email_submit','kit_unlock','checkout_start'][i%4],props:{kit:i%4===3?'design':kits[i%5]}}))};
}

async function load(){
  if(isLocalDemo())return demo();
  const since=new Date(Date.now()-90*864e5).toISOString();
  const [l,o,e]=await Promise.all([
    sb.from('shop_leads').select('email,kit,created_at').order('created_at',{ascending:false}).limit(500),
    sb.from('shop_orders').select('kit,email,amount_total,amount_tax,currency,promo_code,created_at').order('created_at',{ascending:false}).limit(500),
    sb.from('site_events').select('name,props').in('name',['gate_view','email_submit','kit_unlock','checkout_start']).gte('at',since).limit(20000)]);
  return {leads:l.data||[],orders:o.data||[],events:e.data||[],errs:{leads:l.error,orders:o.error,events:e.error}};
}

app.innerHTML=head+'<p role="status">Loading…</p>';
const d=await load(),errs=d.errs||{};
const off=(what,file)=>`<span class="ws-state warn">Not switched on yet</span><p>${what} start recording once <code>${file}</code> is applied.</p>`;
const ev=n=>d.events.filter(r=>r.name===n).length;
const paid=d.orders.filter(o=>(o.amount_total||0)>0),gross=paid.reduce((s,o)=>s+(o.amount_total||0),0),tax=paid.reduce((s,o)=>s+(o.amount_tax||0),0);
const byKit={};d.leads.forEach(l=>byKit[l.kit]=(byKit[l.kit]||0)+1);
const rows=(list,cols)=>`<div class="st-rows">${list.length?list.map(r=>`<div>${cols.map(c=>`<span>${c(r)}</span>`).join('')}</div>`).join(''):'<div><span>Nothing yet.</span><span></span></div>'}</div>`;
app.innerHTML=head+`<div class="st-strip">${[['Emails from guides',d.leads.length],['Orders',d.orders.length],['Revenue',money(gross)],['Tax collected',money(tax)],['Orders with a code',d.orders.filter(o=>o.promo_code).length]].map(([l,n])=>`<div><b>${typeof n==='number'?fmt(n):n}</b><small>${l}</small></div>`).join('')}</div>
<p class="ws-note" style="margin:-8px 0 22px">${isLocalDemo()?'Invented demo data.':'Revenue is before Stripe fees. Tax is what Stripe Tax collected; filing it is still on you.'}</p>
<div class="ws-grid">
  <section class="ws-card"><h2>Guide gates</h2>${errs.events&&missing(errs.events)?off('Gate steps','20261002-site-events.sql'):`<div class="st-rows">${[['Saw a gate',ev('gate_view')],['Put in an email',ev('email_submit')],['Opened a kit',ev('kit_unlock')],['Started checkout',ev('checkout_start')]].map(([l,n])=>`<div><span>${l}</span><span>${fmt(n)}</span></div>`).join('')}</div>`}</section>
  <section class="ws-card"><h2>Emails by guide</h2>${errs.leads&&missing(errs.leads)?off('Emails','20261003-shop.sql'):rows(Object.entries(byKit).sort((a,b)=>b[1]-a[1]),[r=>esc(r[0]),r=>fmt(r[1])])}</section>
  <section class="ws-card"><h2>Recent emails</h2>${errs.leads&&missing(errs.leads)?off('Emails','20261003-shop.sql'):rows(d.leads.slice(0,12),[r=>esc(r.email),r=>`${esc(r.kit)} · ${esc(ago(r.created_at))}`])}</section>
  <section class="ws-card"><h2>Orders</h2>${errs.orders&&missing(errs.orders)?off('Orders','20261003-shop.sql'):rows(d.orders.slice(0,12),[r=>`${esc(r.kit)} · ${esc(r.email||'')}`,r=>`${money(r.amount_total,r.currency)}${r.promo_code?' · code':''} · ${esc(ago(r.created_at))}`])}</section>
</div>`;
