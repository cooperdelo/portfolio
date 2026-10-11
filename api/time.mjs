// /api/time: the server's clock in epoch ms, for /admin/clock to sync against.
// Vercel hosts keep NTP time; the page samples this a few times and keeps the
// lowest round trip. Nothing private here, so no auth.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({ now: Date.now() }));
}
