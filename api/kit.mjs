// GET  /api/kit?list=1                            the catalog (titles, gates, prices), no kit content
// GET  /api/kit?slug=design                       teaser for anyone, full kit if the bearer token unlocks it
// POST /api/kit {slug, email}                      email gate: returns a token and the full kit
// POST /api/kit {slug, session_id}                 after Stripe Checkout: verifies payment, returns a token and the kit
// POST /api/kit {slug, demo: true}                 QA only, no Stripe key yet: simulates a paid unlock
import { KITS, loadKits, teaser, full, canRead, grant, EMAIL_RE, demoAllowed, stripe, readBody } from './_lib/shop.mjs';

const LEADS = 'https://eibtnkaoqsgwiqttiwjo.supabase.co/rest/v1/shop_leads';

async function saveLead(email, slug) {
  const key = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if (!key) return false;
  try {
    const r = await fetch(LEADS, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({ email: email.toLowerCase(), kit: slug, source: 'guide-gate' }), signal: AbortSignal.timeout(5000) });
    return r.ok; // the table may not exist yet; the unlock still works
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  const kits = loadKits();
  if (!kits) return res.status(503).json({ error: 'not_configured' });
  if (req.method === 'GET' && req.query?.list) {
    const list = Object.entries(KITS).filter(([k]) => kits[k]).map(([k, m]) => ({ slug: k, title: kits[k].title, pillar: kits[k].pillar,
      result: kits[k].result, count: kits[k].steps?.length || 0, gate: m.gate, price: m.price || 0, draft: !!m.draft, href: m.shop || m.guide }));
    return res.status(200).json({ kits: list });
  }
  const slug = String((req.method === 'GET' ? req.query?.slug : readBody(req)?.slug) || '');
  const meta = KITS[slug], kit = kits[slug];
  if (!meta || !kit) return res.status(404).json({ error: 'unknown_kit' });
  const base = { gate: meta.gate, price: meta.price || 0, draft: !!meta.draft };

  if (req.method === 'GET') {
    const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    if (canRead(slug, token)) return res.status(200).json({ ...base, locked: false, kit: full(kit) });
    return res.status(200).json({ ...base, locked: true, kit: teaser(kit) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'bad_body' });

  if (meta.gate === 'email' && body.email) {
    const email = String(body.email).trim();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'bad_email' });
    const saved = await saveLead(email, slug);
    return res.status(200).json({ ...base, locked: false, saved, token: grant(slug, 'email', email), kit: full(kit) });
  }

  if (meta.gate === 'paid' && body.session_id) {
    const key = process.env.SHOP_STRIPE_SECRET_KEY;
    if (!key) return res.status(503).json({ error: 'stripe_not_configured' });
    try {
      const s = await stripe(`checkout/sessions/${encodeURIComponent(String(body.session_id))}`, { key });
      const paid = s.payment_status === 'paid' || s.payment_status === 'no_payment_required';
      if (!paid || s.metadata?.kit !== slug) return res.status(402).json({ error: 'not_paid' });
      return res.status(200).json({ ...base, locked: false, token: grant(slug, 'paid', s.customer_details?.email || s.id), kit: full(kit) });
    } catch (e) { return res.status(502).json({ error: 'stripe_error' }); }
  }

  if (meta.gate === 'paid' && body.demo) {
    if (!demoAllowed()) return res.status(403).json({ error: 'demo_off' });
    return res.status(200).json({ ...base, locked: false, demo: true, token: grant(slug, 'demo', 'qa'), kit: full(kit) });
  }
  return res.status(400).json({ error: 'nothing_to_do' });
}
