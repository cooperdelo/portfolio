// POST /api/shop-checkout {kit, code?}
// Creates a Stripe Checkout session for a paid kit through Managed Payments (Stripe is merchant of record: tax,
// fraud, disputes and receipts are Stripe's), promotion codes accepted
// (or applied up front when a ?code= link is used), receipt emailed by Stripe. Without a Stripe key on QA it
// answers with a demo URL so the whole flow can still be clicked through. Demo never runs in production.
import { KITS, TAX_CODE, demoAllowed, checkoutLocked, stripe, readBody, origin } from './_lib/shop.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = readBody(req);
  const slug = String(body?.kit || '');
  const meta = KITS[slug];
  if (!meta || meta.gate !== 'paid') return res.status(404).json({ error: 'not_for_sale' });
  const site = origin(req);
  const page = `${site}${meta.shop}`;
  const key = process.env.SHOP_STRIPE_SECRET_KEY;
  if (checkoutLocked(String(body?.tp || ''))) return res.status(503).json({ error: 'checkout_opening_soon' });

  if (!key) {
    if (!demoAllowed()) return res.status(503).json({ error: 'checkout_not_configured' });
    return res.status(200).json({ demo: true, url: `${meta.shop}?demo=1` });
  }

  const form = {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(meta.price),
    'line_items[0][price_data][tax_behavior]': 'exclusive',
    'line_items[0][price_data][product_data][name]': meta.title,
    'line_items[0][price_data][product_data][tax_code]': TAX_CODE,
    // Managed Payments rejects automatic_tax and invoice_creation: Stripe calculates tax and sends the receipt itself.
    'managed_payments[enabled]': 'true',
    integration_identifier: 'cooperdelo-shop-kqwmzrta',
    customer_creation: 'always',
    'metadata[kit]': slug,
    success_url: `${page}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${page}?canceled=1`,
  };
  const code = String(body?.code || '').trim().slice(0, 40);
  try {
    if (code) {
      const found = await stripe(`promotion_codes?active=true&limit=1&code=${encodeURIComponent(code)}`, { key });
      const promo = found?.data?.[0];
      if (!promo) return res.status(400).json({ error: 'bad_code' });
      form['discounts[0][promotion_code]'] = promo.id;
      form['metadata[promo]'] = code; // Stripe doesn't allow this together with allow_promotion_codes
    } else {
      form.allow_promotion_codes = 'true';
    }
    const s = await stripe('checkout/sessions', { method: 'POST', form, key });
    return res.status(200).json({ url: s.url });
  } catch (e) {
    return res.status(502).json({ error: 'stripe_error', detail: String(e.message || '').slice(0, 160) });
  }
}
