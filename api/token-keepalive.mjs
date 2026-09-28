// =====================================================================
// /api/token-keepalive.mjs  (admin-stale-sweep 2026-09-28, PROPOSAL until merged to main)
// Keeps the official-API tokens alive forever with no human step:
//   - Instagram (Instagram API with Instagram Login): long-lived token lasts 60 days and
//     can be refreshed once it is >24h old and still valid. Refreshing weekly = never expires.
//   - TikTok (Display API / Login Kit): access token 24h, refresh token 365 days. Each
//     refresh returns a fresh token pair, so a weekly refresh keeps it alive indefinitely.
// Writes the outcome to task_run_log (task 'token-keepalive') and never returns tokens.
// Auth: Vercel cron (Authorization: Bearer CRON_SECRET) or x-cron-secret.
// Schedule: add { "path": "/api/token-keepalive", "schedule": "17 12 * * *" } to vercel.json crons.
// =====================================================================
const URL_ = 'https://eibtnkaoqsgwiqttiwjo.supabase.co';

const svc = () => {
  const k = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if (!k) throw new Error('SUPABASE_ADMIN_SERVICE_ROLE_KEY not set');
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' };
};
const rest = async (path, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...svc(), ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
};
const days = (iso) => iso ? (new Date(iso) - Date.now()) / 864e5 : null;

async function keepInstagram() {
  const rows = await rest('instagram_credentials?select=ig_user_id,access_token,expires_at,refreshed_at&order=connected_at.desc&limit=1');
  const c = rows?.[0];
  if (!c?.access_token) return { platform: 'instagram', status: 'no_token', action: 'one-time OAuth needed' };
  const left = days(c.expires_at);
  if (left != null && left <= 0) return { platform: 'instagram', status: 'expired', expired_days_ago: Math.round(-left), action: 'one-time re-OAuth (expired tokens cannot be refreshed)' };
  const u = new URL('https://graph.instagram.com/refresh_access_token');
  u.searchParams.set('grant_type', 'ig_refresh_token');
  u.searchParams.set('access_token', c.access_token);
  const r = await fetch(u); const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return { platform: 'instagram', status: 'refresh_failed', http: r.status, error: j?.error?.message || null };
  const now = Date.now();
  await rest(`instagram_credentials?ig_user_id=eq.${encodeURIComponent(c.ig_user_id)}`, { method: 'PATCH', body: JSON.stringify({
    access_token: j.access_token, expires_at: new Date(now + Number(j.expires_in || 5184000) * 1000).toISOString(), refreshed_at: new Date(now).toISOString() }) });
  return { platform: 'instagram', status: 'refreshed', valid_days: Math.round(Number(j.expires_in || 5184000) / 86400) };
}

async function keepTiktok() {
  const rows = await rest('tiktok_credentials?select=tiktok_user_id,refresh_token,refresh_expires_at&order=connected_at.desc&limit=1');
  const c = rows?.[0];
  if (!c?.refresh_token) return { platform: 'tiktok', status: 'no_token', action: 'one-time OAuth needed' };
  if (days(c.refresh_expires_at) != null && days(c.refresh_expires_at) <= 0) return { platform: 'tiktok', status: 'expired', action: 'one-time re-OAuth' };
  const body = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY || '', client_secret: process.env.TIKTOK_CLIENT_SECRET || '', grant_type: 'refresh_token', refresh_token: c.refresh_token });
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error || !j.access_token) return { platform: 'tiktok', status: 'refresh_failed', http: r.status, error: j.error_description || j.error || null };
  const now = Date.now();
  await rest(`tiktok_credentials?tiktok_user_id=eq.${encodeURIComponent(c.tiktok_user_id)}`, { method: 'PATCH', body: JSON.stringify({
    access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token,
    expires_at: j.expires_in ? new Date(now + j.expires_in * 1000).toISOString() : null,
    refresh_expires_at: j.refresh_expires_in ? new Date(now + j.refresh_expires_in * 1000).toISOString() : c.refresh_expires_at,
    refreshed_at: new Date(now).toISOString() }) });
  return { platform: 'tiktok', status: 'refreshed', refresh_valid_days: j.refresh_expires_in ? Math.round(j.refresh_expires_in / 86400) : null };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const s = process.env.CRON_SECRET;
  const a = req.headers.authorization || '', x = req.headers['x-cron-secret'] || '';
  if (!s || (a !== `Bearer ${s}` && x !== s)) return res.status(401).json({ error: 'unauthorized' });
  const results = [];
  for (const fn of [keepInstagram, keepTiktok]) {
    try { results.push(await fn()); } catch (e) { results.push({ platform: fn.name, status: 'error', error: String(e?.message || e).slice(0, 200) }); }
  }
  const ok = results.every(r => r.status === 'refreshed');
  try {
    await rest('task_run_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      task: 'token-keepalive', status: ok ? 'ok' : 'partial', wrote: ['instagram_credentials', 'tiktok_credentials'],
      note: results.map(r => `${r.platform}:${r.status}${r.action ? ' (' + r.action + ')' : ''}`).join(' · ') }) });
  } catch { /* logging is best-effort */ }
  return res.status(200).json({ ok, results });
}
