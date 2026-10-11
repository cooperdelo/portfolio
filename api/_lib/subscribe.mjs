// One email list for every free giveaway (the /clock, the guide gates). Server side only, service role.
// Preferred store: subscribers via subscribe_signup() (scripts/migrations/20261011-subscribers.sql), which
// rate limits per IP hash in the database and keeps UTM + consent. Until that migration is applied the
// function is missing, so rows go to the existing shop_leads table (email, kit, source) and the rate limit
// falls back to this instance's memory. Either way the visitor still gets the thing on the page.
import { createHash } from 'node:crypto';

const BASE = 'https://eibtnkaoqsgwiqttiwjo.supabase.co/rest/v1';
export const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[^\s@<>()"',;:]{1,190}\.[a-z]{2,24}$/i;
export const SOURCES = new Set(['clock', 'guide']);
export const CONSENT_TEXT = "Unlock and get the occasional email from Cooper when he makes something new. Unsubscribe any time.";
const SLUG = /^[a-z0-9-]{2,40}$/;
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export function clientIp(req) {
  const xf = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(req.headers?.['x-real-ip'] || req.socket?.remoteAddress || '');
}
export function ipHash(ip, env = process.env) {
  if (!ip) return '';
  const salt = env.SUBSCRIBE_SALT || env.SHOP_TOKEN_SECRET || env.SUPABASE_ADMIN_SERVICE_ROLE_KEY || 'cd';
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 32);
}

// Validates a raw body into a row. Returns {row} | {spam:true} | {error}.
export function validateSignup(b) {
  if (!b || typeof b !== 'object') return { error: 'bad_body' };
  if (b.website || b.company) return { spam: true };                          // honeypots
  const email = clean(b.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'bad_email' };
  const source = SOURCES.has(b.source) ? b.source : null;
  if (!source) return { error: 'bad_source' };
  const kit = source === 'guide' ? clean(b.kit, 40) : '';
  if (source === 'guide' && !SLUG.test(kit)) return { error: 'bad_kit' };
  const u = b.utm && typeof b.utm === 'object' ? b.utm : {};
  const utm = {};
  for (const k of ['source', 'medium', 'campaign', 'content', 'term']) { const v = clean(u[k], 100).toLowerCase(); if (v) utm['utm_' + k] = v; }
  let referrer = '';
  try { if (b.referrer) referrer = new URL(String(b.referrer)).hostname.replace(/^www\./, '').slice(0, 200); } catch { /* ignore */ }
  const page = clean(b.page, 200);
  return { row: { email, source, kit, ...utm, referrer: referrer || null, page: page.startsWith('/') ? page : null, consent: b.consent === true, consent_text: b.consent === true ? CONSENT_TEXT : null } };
}

// Memory fallback for the rate limit (one serverless instance only, so it is best effort).
const hits = new Map();
function memLimited(key, max = 8, windowMs = 10 * 60 * 1000) {
  if (!key) return false;
  const t = Date.now(), list = (hits.get(key) || []).filter((x) => t - x < windowMs);
  list.push(t); hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

// Saves a validated row. Returns {ok, stored: 'subscribers'|'shop_leads'|null, error?}.
export async function saveSignup(row, ip, env = process.env) {
  const key = env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if (!key) return { ok: true, stored: null, error: 'not_configured' };
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const ip_hash = ipHash(ip, env);
  try {
    const r = await fetch(`${BASE}/rpc/subscribe_signup`, { method: 'POST', headers: h, body: JSON.stringify({ p: { ...row, ip_hash } }), signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      if (j && j.ok === false) return { ok: false, stored: null, error: j.error || 'rejected' };
      return { ok: true, stored: 'subscribers' };
    }
    if (r.status !== 404) return { ok: true, stored: null, error: `db_${r.status}` };
  } catch { return { ok: true, stored: null, error: 'db_unreachable' }; }
  // Fallback: shop_leads (exists since 20261003-shop.sql). source keeps the campaign in 40 chars.
  if (memLimited(ip_hash)) return { ok: false, stored: null, error: 'rate_limited' };
  const kit = row.source === 'clock' ? 'clock' : row.kit;
  const source = [row.source === 'clock' ? 'clock' : 'guide-gate', row.utm_source, row.utm_campaign].filter(Boolean).join(':').slice(0, 40);
  try {
    const r = await fetch(`${BASE}/shop_leads?on_conflict=email,kit`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({ email: row.email, kit, source }), signal: AbortSignal.timeout(6000) });
    return { ok: true, stored: r.ok ? 'shop_leads' : null, error: r.ok ? undefined : `leads_${r.status}` };
  } catch { return { ok: true, stored: null, error: 'db_unreachable' }; }
}
