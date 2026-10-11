// POST /api/subscribe {email, source:'clock', utm:{source,medium,campaign,content,term}, referrer, page, consent, website}
// The /clock email gate. Saves the email (api/_lib/subscribe.mjs) and unlocks on the page right away:
// there is no email provider yet, so the giveaway is delivered here, not by email.
// "website" is a honeypot: people never see it; bots that fill it get a fake success and nothing is stored.
import { validateSignup, saveSignup, clientIp } from './_lib/subscribe.mjs';
import { grant, readBody } from './_lib/shop.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'bad_body' });
  if (body.source !== 'clock') return res.status(400).json({ error: 'bad_source' });
  const v = validateSignup(body);
  if (v.spam) return res.status(200).json({ ok: true, unlocked: true });
  if (v.error) return res.status(400).json({ error: v.error });
  const saved = await saveSignup(v.row, clientIp(req));
  if (!saved.ok && saved.error === 'rate_limited') return res.status(429).json({ error: 'rate_limited' });
  return res.status(200).json({ ok: true, unlocked: true, saved: !!saved.stored, token: grant('clock', 'email', v.row.email) || null });
}
