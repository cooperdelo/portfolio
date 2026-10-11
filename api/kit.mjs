// GET  /api/kit?list=1                            the catalog (titles, gates, prices), no kit content
// GET  /api/kit?slug=design                       teaser for anyone, full kit if the bearer token unlocks it
// POST /api/kit {slug, email}                      email gate: returns a token and the full kit
// POST /api/kit {slug, session_id}                 after Stripe Checkout: verifies payment, returns a token and the kit
// POST /api/kit {slug, demo: true}                 QA only, no Stripe key yet: simulates a paid unlock
import { KITS, gateFor, priceFor, loadKits, teaser, full, canRead, grant, demoAllowed, stripe, readBody } from './_lib/shop.mjs';
import { validateSignup, saveSignup, clientIp } from './_lib/subscribe.mjs';

// Guide emails go to the same list as the /clock (api/_lib/subscribe.mjs): source 'guide', kit = slug.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  const kits = loadKits();
  if (!kits) return res.status(503).json({ error: 'not_configured' });
  if (req.method === 'HEAD') return res.status(200).end();                   // link checkers: was a 404 (no slug in a HEAD)
  if (req.method === 'GET' && req.query?.list) {
    const list = Object.entries(KITS).filter(([k]) => kits[k]).map(([k, m]) => ({ slug: k, title: kits[k].title, pillar: kits[k].pillar,
      result: kits[k].result, count: kits[k].steps?.length || 0, gate: gateFor(k), price: priceFor(k), draft: gateFor(k) === 'paid' && !!m.draft, href: m.shop || m.guide }));
    return res.status(200).json({ kits: list });
  }
  const slug = String((req.method === 'GET' ? req.query?.slug : readBody(req)?.slug) || '');
  const meta = KITS[slug], kit = kits[slug];
  if (!meta || !kit) return res.status(404).json({ error: 'unknown_kit' });
  const gate = gateFor(slug);
  const base = { gate, price: priceFor(slug), draft: gate === 'paid' && !!meta.draft };

  if (req.method === 'GET') {
    const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    if (canRead(slug, token)) return res.status(200).json({ ...base, locked: false, kit: full(kit) });
    return res.status(200).json({ ...base, locked: true, kit: teaser(kit) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'bad_body' });

  if (gate === 'email' && (body.email || body.website)) {
    const v = validateSignup({ ...body, source: 'guide', kit: slug });
    if (v.spam) return res.status(400).json({ error: 'bad_email' });           // honeypot: no unlock, nothing stored
    if (v.error) return res.status(400).json({ error: v.error === 'bad_email' ? 'bad_email' : 'bad_body' });
    const saved = await saveSignup(v.row, clientIp(req));
    if (!saved.ok && saved.error === 'rate_limited') return res.status(429).json({ error: 'rate_limited' });
    return res.status(200).json({ ...base, locked: false, saved: !!saved.stored, token: grant(slug, 'email', v.row.email), kit: full(kit) });
  }

  if (gate === 'paid' && body.session_id) {
    const key = process.env.SHOP_STRIPE_SECRET_KEY;
    if (!key) return res.status(503).json({ error: 'stripe_not_configured' });
    try {
      const s = await stripe(`checkout/sessions/${encodeURIComponent(String(body.session_id))}`, { key });
      const paid = s.payment_status === 'paid' || s.payment_status === 'no_payment_required';
      if (!paid || s.metadata?.kit !== slug) return res.status(402).json({ error: 'not_paid' });
      return res.status(200).json({ ...base, locked: false, token: grant(slug, 'paid', s.customer_details?.email || s.id), kit: full(kit) });
    } catch (e) { return res.status(502).json({ error: 'stripe_error' }); }
  }

  if (gate === 'paid' && body.demo) {
    if (!demoAllowed()) return res.status(403).json({ error: 'demo_off' });
    return res.status(200).json({ ...base, locked: false, demo: true, token: grant(slug, 'demo', 'qa'), kit: full(kit) });
  }
  return res.status(400).json({ error: 'nothing_to_do' });
}
