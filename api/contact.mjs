// POST /api/contact {kind, name, reply, message, website}
// The contact popup sends here instead of opening anyone's mail app. Messages land in site_messages
// (admin: Portfolio visitors page). "website" is a honeypot: real people never see or fill it.
const URL_BASE = 'https://eibtnkaoqsgwiqttiwjo.supabase.co/rest/v1/site_messages';
export const KINDS = ['Film or content', 'Product or a build', 'Summer 2027', 'Something else'];
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);

export function validate(b) {
  if (!b || typeof b !== 'object') return { error: 'Something went wrong. Try again.' };
  if (b.website) return { spam: true };
  const kind = KINDS.includes(b.kind) ? b.kind : 'Something else';
  const name = clean(b.name, 80), reply = clean(b.reply, 120), message = clean(b.message, 2000);
  if (!name) return { error: 'Add your name.' };
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reply), handle = /^@?[A-Za-z0-9._]{2,30}$/.test(reply);
  if (!email && !handle) return { error: 'Add an email or your Instagram handle so I can reply.' };
  if (message.length < 10) return { error: 'Say a little more about what you have in mind.' };
  return { row: { kind, name, reply, message } };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body || '{}'); } catch { return res.status(400).json({ error: 'Something went wrong. Try again.' }); }
  const v = validate(body);
  if (v.spam) return res.status(200).json({ ok: true });
  if (v.error) return res.status(400).json({ error: v.error });
  const key = process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  if (!key) return res.status(503).json({ error: 'not_ready' });
  try {
    const r = await fetch(URL_BASE, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ ...v.row, page: clean(body.page, 200) }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(503).json({ error: 'not_ready' });
    return res.status(200).json({ ok: true });
  } catch { return res.status(503).json({ error: 'not_ready' }); }
}
