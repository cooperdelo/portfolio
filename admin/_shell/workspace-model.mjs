export function normalizeHandle(value='') {
  return String(value).trim().replace(/^https?:\/\/(?:www\.)?(?:instagram\.com|tiktok\.com)\//i,'').replace(/^@/,'').split(/[/?#]/)[0].toLowerCase();
}
const PERSONAL = new Set(['cooperdelo','cooperdelo_','cooper delo','cooperdelo (api)']);
const BUSINESS = new Set(['plugverse.app','plugverseapp']);
export function accountScope(handle) {
  const h=normalizeHandle(handle);
  return BUSINESS.has(h)?'plugverse':h==='the.band.rubber'?'rubber-band':PERSONAL.has(h)?'personal':'unclassified';
}
export function cashAccounts(rows) {
  return rows.filter(r=>/checking|savings/.test(r.account||'')&&!/ira|crypto|broker|invest/.test(r.account||''));
}
export function scopeForTask(row) {
  const p=String(row.source_path||row.source_vault_path||'').replaceAll('\\','/').toLowerCase();
  if(p.startsWith('projects/plugverse/'))return 'plugverse';
  if(p.startsWith('projects/personal-brand/'))return 'content';
  if(/^projects\/(health|academics|music|relationships|travel|investments)\//.test(p))return 'personal';
  return 'unclassified';
}
export function safeExternal(value) {
  try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}
}
export function freshness(row,now=Date.now()) {
  if(!row.observed_at)return {state:'never connected',age:null};
  const age=now-Date.parse(row.observed_at);
  if(!Number.isFinite(age)||age< -300000)return {state:'invalid date',age:null};
  return {state:row.error?'update failed':age>(row.max_age_ms||36*3600000)?'stale':'current',age};
}
