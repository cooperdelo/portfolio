// Shop + gated guides. Kit content never lives in this (public) repo: it comes from the SHOP_KITS_GZ env var
// (base64 of gzipped JSON, set per environment in Vercel). Access is a signed token, issued after an email
// (email gate) or a verified Stripe payment (paywall). Free kits need nothing.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

// gate: free | email | paid. draft: true shows a 'Draft price' tag (Design kit set at $29 on 2026-10-05).
export const KITS = {
  design: { title: "Sites that don't look like AI", gate: 'paid', price: 2900, shop: '/shop/design-kit' },
  'ai-system': { title: 'One folder Claude reads first', gate: 'email', guide: '/resources/guides/ai-system' },
  linkedin: { title: 'LinkedIn posts strangers actually read', gate: 'email', guide: '/resources/guides/linkedin' },
  'instagram-tiktok': { title: 'Short videos from your real week', gate: 'email', guide: '/resources/guides/instagram-tiktok' },
  'film-motion': { title: 'Film your life with one camera', gate: 'email', guide: '/resources/guides/film-motion' },
  music: { title: 'Book gigs, build sets, dial tone', gate: 'email', guide: '/resources/guides/music' },
  startup: { title: 'Shipping PlugVerse solo with AI', gate: 'free', guide: '/resources/guides/startup' },
};
export const TAX_CODE = 'txcd_10503004'; // Stripe: digital documents, viewable, permanent rights (eligible for Managed Payments)

let cache = null;
export function loadKits(env = process.env) {
  if (cache) return cache;
  const raw = env.SHOP_KITS_GZ;
  if (!raw) return null;
  try { cache = JSON.parse(gunzipSync(Buffer.from(raw, 'base64')).toString('utf8')); } catch { return null; }
  return cache;
}

// Teaser: what anyone can see. Full: everything, only with access.
export function teaser(k) {
  return { slug: k.slug, pillar: k.pillar, title: k.title, result: k.result, proof_links: k.proof_links || [],
    first: k.steps?.[0] || null, count: k.steps?.length || 0, outline: (k.steps || []).map((x) => x.do) };
}
export function full(k) { return { ...teaser(k), steps: k.steps || [], master_prompt: k.master_prompt || '' }; }

const b64u = (b) => Buffer.from(b).toString('base64url');
function secret(env = process.env) { return env.SHOP_TOKEN_SECRET || ''; }
export function sign(payload, env = process.env) {
  const s = secret(env); if (!s) return null;
  const body = b64u(JSON.stringify(payload));
  const mac = createHmac('sha256', s).update(body).digest('base64url');
  return `${body}.${mac}`;
}
export function verify(token, env = process.env) {
  const s = secret(env); if (!s || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const want = createHmac('sha256', s).update(body).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.exp && Date.now() / 1000 > p.exp) return null;
    return p;
  } catch { return null; }
}
const YEAR = 60 * 60 * 24 * 365;
export function grant(kit, how, who, env = process.env) {
  return sign({ kit, how, who: String(who || '').slice(0, 120), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 5 * YEAR }, env);
}
export function canRead(slug, token, env = process.env) {
  const meta = KITS[slug]; if (!meta) return false;
  if (meta.gate === 'free') return true;
  const p = verify(token, env);
  if (!p || p.kit !== slug) return false;
  if (meta.gate === 'paid') return p.how === 'paid' || p.how === 'demo';
  return true; // email gate: any valid grant for this kit
}

export const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[^\s@<>()"',;:]{1,190}\.[a-z]{2,24}$/i;
export const isProd = (env = process.env) => env.VERCEL_ENV === 'production';
// Demo checkout exists so the paywall can be tested before a Stripe test key is added. Never in production.
export const demoAllowed = (env = process.env) => !isProd(env) && !env.SHOP_STRIPE_SECRET_KEY && env.SHOP_DEMO === '1';

export const STRIPE_VERSION = '2026-09-30.endive';
export async function stripe(path, { method = 'GET', form = null, key } = {}) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined, signal: AbortSignal.timeout(9000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j?.error?.message || `stripe ${r.status}`); e.status = r.status; throw e; }
  return j;
}

export function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { if (b.length > 4096) return null; try { b = JSON.parse(b || '{}'); } catch { return null; } }
  return b && typeof b === 'object' ? b : {};
}
export function origin(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || 'cooperdelo.com');
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = String(req.headers?.['x-forwarded-proto'] || (local ? 'http' : 'https'));
  return `${proto}://${host}`;
}
