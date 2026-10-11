// node --test scripts/admin-tests/subscribe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const { validateSignup, saveSignup, ipHash } = await import('../../api/_lib/subscribe.mjs');
const subscribe = (await import('../../api/subscribe.mjs')).default;

function call(handler, body, headers = {}) {
  return new Promise((done) => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(d) { done({ status: this.statusCode, body: d }); return this; } };
    handler({ method: 'POST', body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers } }, res);
  });
}

test('validates email, source, utm and consent', () => {
  assert.equal(validateSignup({ email: 'nope', source: 'clock' }).error, 'bad_email');
  assert.equal(validateSignup({ email: 'a@b.co', source: 'other' }).error, 'bad_source');
  assert.equal(validateSignup({ email: 'a@b.co', source: 'guide', kit: 'Bad Kit' }).error, 'bad_kit');
  assert.ok(validateSignup({ email: 'a@b.co', source: 'clock', website: 'x' }).spam);
  const { row } = validateSignup({ email: ' A@B.co ', source: 'clock', consent: true, utm: { source: 'Instagram', campaign: 'clock', junk: 1 }, referrer: 'https://www.instagram.com/x', page: '/clock' });
  assert.equal(row.email, 'a@b.co'); assert.equal(row.utm_source, 'instagram'); assert.equal(row.utm_campaign, 'clock');
  assert.equal(row.referrer, 'instagram.com'); assert.equal(row.consent, true); assert.ok(row.consent_text); assert.equal(row.kit, '');
});

test('ip is only kept as a salted hash', () => {
  const h = ipHash('203.0.113.9', { SUBSCRIBE_SALT: 's' });
  assert.match(h, /^[0-9a-f]{32}$/); assert.ok(!h.includes('203'));
});

test('rpc first, shop_leads when the rpc is missing', async () => {
  const env = { SUPABASE_ADMIN_SERVICE_ROLE_KEY: 'k', SUBSCRIBE_SALT: 's' };
  const seen = []; const orig = globalThis.fetch;
  globalThis.fetch = async (url, o) => { seen.push([url, JSON.parse(o.body)]); return url.includes('/rpc/') ? new Response('{}', { status: 404 }) : new Response('', { status: 201 }); };
  const r = await saveSignup({ email: 'a@b.co', source: 'clock', kit: '', utm_source: 'instagram', utm_campaign: 'clock' }, '1.2.3.4', env);
  globalThis.fetch = orig;
  assert.equal(r.stored, 'shop_leads');
  assert.ok(seen[0][0].endsWith('/rpc/subscribe_signup')); assert.ok(seen[0][1].p.ip_hash);
  assert.deepEqual(seen[1][1], { email: 'a@b.co', kit: 'clock', source: 'clock:instagram:clock' });
});

test('rpc rate limit is passed through as 429', async () => {
  process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY = 'k';
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), { status: 200 });
  const r = await call(subscribe, { email: 'a@b.co', source: 'clock' });
  globalThis.fetch = orig; delete process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY;
  assert.equal(r.status, 429);
});

test('without a key the clock still unlocks (delivered on the page)', async () => {
  const r = await call(subscribe, { email: 'a@b.co', source: 'clock' });
  assert.equal(r.status, 200); assert.equal(r.body.unlocked, true); assert.equal(r.body.saved, false);
});

test('honeypot gets a quiet success and nothing is written', async () => {
  const orig = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls++; return new Response('{}'); };
  const r = await call(subscribe, { email: 'a@b.co', source: 'clock', website: 'spam.com' });
  globalThis.fetch = orig;
  assert.equal(r.status, 200); assert.equal(calls, 0);
});

test('only the clock may use /api/subscribe', async () => {
  assert.equal((await call(subscribe, { email: 'a@b.co', source: 'guide', kit: 'music' })).status, 400);
});

test('fallback limit: the 9th try from one IP in 10 minutes is refused', async () => {
  const env = { SUPABASE_ADMIN_SERVICE_ROLE_KEY: 'k', SUBSCRIBE_SALT: 's' };
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => (url.includes('/rpc/') ? new Response('{}', { status: 404 }) : new Response('', { status: 201 }));
  const out = [];
  for (let i = 0; i < 9; i++) out.push((await saveSignup({ email: `x${i}@b.co`, source: 'clock', kit: '' }, '198.51.100.7', env)).error || 'ok');
  globalThis.fetch = orig;
  assert.deepEqual(out.slice(0, 8), Array(8).fill('ok')); assert.equal(out[8], 'rate_limited');
});

test('demo checkout: previews yes, production never, never with a Stripe key', async () => {
  const { demoAllowed } = await import('../../api/_lib/shop.mjs');
  assert.equal(demoAllowed({ VERCEL_ENV: 'preview' }), true);
  assert.equal(demoAllowed({ VERCEL_ENV: 'production', SHOP_DEMO: '1' }), false);
  assert.equal(demoAllowed({ VERCEL_ENV: 'preview', SHOP_STRIPE_SECRET_KEY: 'sk_test_x' }), false);
  assert.equal(demoAllowed({}), false);
});
