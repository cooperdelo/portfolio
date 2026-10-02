// First-party portfolio events. Public, so it is strict: whitelisted names, short strings, no IP or
// user agent stored, bots dropped. If the site_events table is not there yet, events are dropped (202).
const URL_BASE='https://eibtnkaoqsgwiqttiwjo.supabase.co/rest/v1/site_events';
export const NAMES=['page_view','record_pull','record_open','preview_play','motion_beat','showcase_view','brief_drafted','planner_started','planner_download','cta_click','resource_open'];
const BOT=/bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;
const str=(v,n)=>String(v??'').replace(/[\u0000-\u001f]/g,'').slice(0,n);

export function cleanEvent(raw,ua=''){
  if(!raw||typeof raw!=='object')return null;
  if(BOT.test(ua))return null;
  const name=String(raw.name||'');
  if(!NAMES.includes(name))return null;
  const session=String(raw.session||'');
  if(!/^[a-z0-9]{8,32}$/.test(session))return null;
  const props={};
  if(raw.props&&typeof raw.props==='object')for(const [k,v] of Object.entries(raw.props).slice(0,6)){
    if(/^[a-z_]{1,24}$/.test(k)&&['string','number','boolean'].includes(typeof v))props[k]=typeof v==='string'?str(v,80):v;
  }
  let referrer='';
  try{if(raw.referrer)referrer=new URL(String(raw.referrer)).hostname.replace(/^www\./,'').slice(0,120);}catch{}
  if(referrer==='cooperdelo.com'||referrer.endsWith('.vercel.app'))referrer='';
  const device=/iPad|Tablet/i.test(ua)?'tablet':/Mobi|Android|iPhone/i.test(ua)?'phone':ua?'desktop':'';
  const path=str(raw.path,200);
  return {session,name,path:path.startsWith('/')?path:'',props,referrer,source:str(raw.source,80).toLowerCase(),device};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    let body=req.body;
    if(typeof body==='string'){if(body.length>2048)return res.status(413).end();body=JSON.parse(body||'{}');}
    const ev=cleanEvent(body,String(req.headers?.['user-agent']||''));
    if(!ev)return res.status(202).end();
    const key=process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
    if(!key)return res.status(202).end();
    const r=await fetch(URL_BASE,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(ev),signal:AbortSignal.timeout(5000)});
    return res.status(r.ok?204:202).end();
  }catch{return res.status(202).end();}
}
