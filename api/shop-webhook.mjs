// POST /api/shop-webhook  (Stripe → here)
// Records each completed Checkout in shop_orders: kit, email, total, tax, promo code. Access itself never
// depends on this (the buyer's page verifies the session directly), so a missed webhook loses a row, not a sale.
// Verifies the Stripe-Signature header with SHOP_STRIPE_WEBHOOK_SECRET; anything unsigned is rejected.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = { api: { bodyParser: false } };
const ORDERS = 'https://eibtnkaoqsgwiqttiwjo.supabase.co/rest/v1/shop_orders';

async function raw(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  let s = ''; for await (const c of req) s += c; return s;
}

export function verifySig(payload, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const t = Number(parts.t), sigs = String(header).split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const want = Buffer.from(createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex'));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === want.length && timingSafeEqual(b, want); });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = await raw(req);
  if (!verifySig(body, req.headers?.['stripe-signature'], process.env.SHOP_STRIPE_WEBHOOK_SECRET)) return res.status(400).json({ error: 'bad_signature' });
  let ev; try { ev = JSON.parse(body); } catch { return res.status(400).json({ error: 'bad_json' }); }
  if (ev.type !== 'checkout.session.completed' && ev.type !== 'checkout.session.async_payment_succeeded') return res.status(200).json({ ignored: ev.type });
  const s = ev.data?.object || {};
  if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return res.status(200).json({ pending: s.payment_status }); // async methods finish later
  const key = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if (!key) return res.status(200).json({ recorded: false });
  const row = { stripe_session: s.id, kit: s.metadata?.kit || '', email: s.customer_details?.email || null, amount_total: s.amount_total ?? null,
    amount_tax: s.total_details?.amount_tax ?? null, currency: s.currency || null, promo_code: s.metadata?.promo || (s.total_details?.amount_discount ? 'discount' : null) };
  try {
    const r = await fetch(ORDERS, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(row), signal: AbortSignal.timeout(6000) });
    return res.status(200).json({ recorded: r.ok }); // 200 either way so Stripe doesn't retry forever while the table is missing
  } catch { return res.status(200).json({ recorded: false }); }
}
