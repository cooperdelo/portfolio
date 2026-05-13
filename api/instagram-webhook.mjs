// =====================================================================
// /api/instagram-webhook.mjs
// Meta's webhook verification + event receiver for the Instagram API.
//
// Verification (GET):
//   Meta sends:  ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<random>
//   We echo back hub.challenge ONLY if hub.verify_token matches our env var.
//
// Event delivery (POST):
//   Meta POSTs JSON when something happens on subscribed objects (comments,
//   mentions, etc.). We accept-and-ack quickly; downstream processing can be
//   added later. For now we just 200 OK so Meta keeps the subscription alive.
//
// Env vars:
//   IG_WEBHOOK_VERIFY_TOKEN — must match the "Verify token" entered in the
//                             Meta App webhook configuration UI.
// =====================================================================

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']         || req.query.hub_mode;
    const token     = req.query['hub.verify_token'] || req.query.hub_verify_token;
    const challenge = req.query['hub.challenge']    || req.query.hub_challenge;

    // Trim whitespace defensively — pasted Vercel env values sometimes
    // include trailing newlines / spaces that silently break exact compare.
    const expected = (process.env.IG_WEBHOOK_VERIFY_TOKEN || '').trim();
    const got      = (token || '').trim();
    if (!expected) {
      return res.status(500).json({ error: 'IG_WEBHOOK_VERIFY_TOKEN not set' });
    }
    if (mode === 'subscribe' && got === expected) {
      return res.status(200).send(challenge);
    }
    // Mismatch — return lengths only (not values) for diagnostic. Safe to expose.
    return res.status(403).json({
      error: 'verify token mismatch',
      got_len: got.length,
      expected_len: expected.length,
      mode,
    });
  }

  if (req.method === 'POST') {
    // TODO: persist + dispatch events. For now we just ack so Meta retains
    // the subscription. Body is available on req.body if Vercel parsed it,
    // or we can buffer the raw request later for signature verification.
    return res.status(200).send('EVENT_RECEIVED');
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
