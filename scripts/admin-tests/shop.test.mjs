// Shop + gated guides: tokens, gates, demo safety, and the two endpoints with a fake environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const KITS_JSON = {
  design: { slug: 'design', pillar: 'Design', title: 'D', result: 'r', steps: [{ do: 'one', copy: 'a' }, { do: 'two', copy: 'b' }], master_prompt: 'MP' },
  linkedin: { slug: 'linkedin', pillar: 'Brand', title: 'L', result: 'r', steps: [{ do: 'one', copy: 'a' }, { do: 'two', copy: 'secret' }], master_prompt: 'MP2' },
  startup: { slug: 'startup', pillar: 'Startup', title: 'S', result: 'r', steps: [{ do: 'one', copy: 'a' }], master_prompt: 'MP3' },
};
process.env.SHOP_KITS_GZ = gzipSync(Buffer.from(JSON.stringify(KITS_JSON))).toString('base64');
process.env.SHOP_TOKEN_SECRET = 'test-secret';
delete process.env.SHOP_STRIPE_SECRET_KEY;

const shop = await import('../../api/_lib/shop.mjs');
const kitApi = (await import('../../api/kit.mjs')).default;
const checkout = (await import('../../api/shop-checkout.mjs')).default;

function call(handler, { method = 'GET', query = {}, body, headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
      json(o) { resolve({ code: this.code, body: o, headers: this.h }); }, end() { resolve({ code: this.code, body: null, headers: this.h }); } };
    handler({ method, query, body, headers: { host: 'qa.example', ...headers } }, res);
  });
}

test('tokens round-trip and reject tampering', () => {
  const t = shop.grant('linkedin', 'email', 'a@b.co');
  assert.equal(shop.verify(t).kit, 'linkedin');
  const [body] = t.split('.');
  assert.equal(shop.verify(`${body}.AAAA`), null);
  assert.equal(shop.verify('nope'), null);
});

test('expired tokens are refused', () => {
  const t = shop.sign({ kit: 'linkedin', how: 'email', exp: Math.floor(Date.now() / 1000) - 10 });
  assert.equal(shop.verify(t), null);
});

test('gates: free open, email needs a grant for that kit, paid needs a paid grant', () => {
  assert.equal(shop.canRead('startup', ''), true);
  assert.equal(shop.canRead('linkedin', ''), false);
  assert.equal(shop.canRead('linkedin', shop.grant('linkedin', 'email', 'x@y.co')), true);
  assert.equal(shop.canRead('linkedin', shop.grant('music', 'email', 'x@y.co')), false);
  assert.equal(shop.canRead('design', shop.grant('design', 'email', 'x@y.co')), false);
  assert.equal(shop.canRead('design', shop.grant('design', 'paid', 'x@y.co')), true);
});

test('demo checkout is impossible in production or with a real key', () => {
  assert.equal(shop.demoAllowed({ VERCEL_ENV: 'production', SHOP_DEMO: '1' }), false);
  assert.equal(shop.demoAllowed({ VERCEL_ENV: 'preview', SHOP_DEMO: '1', SHOP_STRIPE_SECRET_KEY: 'sk_test' }), false);
  assert.equal(shop.demoAllowed({ VERCEL_ENV: 'preview', SHOP_DEMO: '1' }), true);
  assert.equal(shop.demoAllowed({ VERCEL_ENV: 'preview' }), false);
});

test('GET returns only the teaser when locked', async () => {
  const r = await call(kitApi, { query: { slug: 'linkedin' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.locked, true);
  assert.equal(r.body.kit.steps, undefined);
  assert.equal(JSON.stringify(r.body).includes('secret'), false);
  assert.equal(r.body.kit.count, 2);
});

test('email gate unlocks with a valid email and rejects a bad one', async () => {
  const bad = await call(kitApi, { method: 'POST', body: { slug: 'linkedin', email: 'nope' } });
  assert.equal(bad.code, 400);
  const ok = await call(kitApi, { method: 'POST', body: { slug: 'linkedin', email: 'reader@example.com' } });
  assert.equal(ok.code, 200);
  assert.equal(ok.body.kit.steps.length, 2);
  const again = await call(kitApi, { query: { slug: 'linkedin' }, headers: { authorization: `Bearer ${ok.body.token}` } });
  assert.equal(again.body.locked, false);
});

test('an email cannot unlock the paid kit', async () => {
  const r = await call(kitApi, { method: 'POST', body: { slug: 'design', email: 'reader@example.com' } });
  assert.equal(r.code, 400);
});

test('demo unlock and demo checkout only when allowed', async () => {
  process.env.VERCEL_ENV = 'production'; process.env.SHOP_DEMO = '1';
  // production: the Design kit is free there, so a demo unlock has nothing to do (and never grants a paid token)
  assert.equal((await call(kitApi, { method: 'POST', body: { slug: 'design', demo: true } })).code, 400);
  assert.equal((await call(checkout, { method: 'POST', body: { kit: 'design' } })).code, 404);
  process.env.VERCEL_ENV = 'preview';
  const d = await call(kitApi, { method: 'POST', body: { slug: 'design', demo: true } });
  assert.equal(d.code, 200); assert.equal(d.body.kit.master_prompt, 'MP');
  const c = await call(checkout, { method: 'POST', body: { kit: 'design' } });
  assert.equal(c.code, 200); assert.equal(c.body.demo, true); assert.match(c.body.url, /\/shop\/design-kit\?demo=1$/);
  delete process.env.SHOP_DEMO; delete process.env.VERCEL_ENV;
});

test('only paid kits can be checked out', async () => {
  assert.equal((await call(checkout, { method: 'POST', body: { kit: 'linkedin' } })).code, 404);
  assert.equal((await call(checkout, { method: 'GET' })).code, 405);
});

test('responses are never cached', async () => {
  const r = await call(kitApi, { query: { slug: 'startup' } });
  assert.match(r.headers['Cache-Control'], /no-store/);
  assert.equal(r.body.locked, false);
});

test('the catalog lists kits without their steps', async () => {
  const r = await call(kitApi, { query: { list: '1' } });
  assert.equal(r.code, 200);
  assert.ok(r.body.kits.find((k) => k.slug === 'design' && k.gate === 'paid'));
  assert.equal(JSON.stringify(r.body).includes('secret'), false);
  assert.equal(JSON.stringify(r.body).includes('MP'), false);
});

const { verifySig } = await import('../../api/shop-webhook.mjs');
const { createHmac } = await import('node:crypto');
test('webhook signatures: valid passes, tampered, stale or unsigned fail', () => {
  const secret = 'whsec_test', body = '{"type":"checkout.session.completed"}', t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  assert.equal(verifySig(body, `t=${t},v1=${sig}`, secret), true);
  assert.equal(verifySig(body + ' ', `t=${t},v1=${sig}`, secret), false);
  assert.equal(verifySig(body, `t=${t - 4000},v1=${createHmac('sha256', secret).update(`${t - 4000}.${body}`).digest('hex')}`, secret), false);
  assert.equal(verifySig(body, '', secret), false);
  assert.equal(verifySig(body, `t=${t},v1=${sig}`, ''), false);
});

test('checkout uses Managed Payments: no automatic_tax or invoice_creation, pinned API version', async () => {
  const realFetch = globalThis.fetch; let sent;
  globalThis.fetch = async (url, init) => { sent = { url: String(url), headers: init.headers, form: new URLSearchParams(init.body) }; return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/x' }), { status: 200 }); };
  process.env.SHOP_STRIPE_SECRET_KEY = 'sk_test_x';
  try {
    const r = await call(checkout, { method: 'POST', body: { kit: 'design' } });
    assert.equal(r.code, 200);
    assert.match(sent.url, /checkout\/sessions$/);
    assert.equal(sent.headers['Stripe-Version'], shop.STRIPE_VERSION);
    assert.equal(sent.form.get('managed_payments[enabled]'), 'true');
    assert.equal(sent.form.get('automatic_tax[enabled]'), null);
    assert.equal(sent.form.get('invoice_creation[enabled]'), null);
    assert.equal(sent.form.get('payment_method_types[0]'), null);
    assert.equal(sent.form.get('line_items[0][price_data][product_data][tax_code]'), shop.TAX_CODE);
  } finally { globalThis.fetch = realFetch; delete process.env.SHOP_STRIPE_SECRET_KEY; }
});

test('production on a test key: the test-pass lock still guards, but nothing is for sale in production', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/x' }), { status: 200 });
  process.env.SHOP_STRIPE_SECRET_KEY = 'sk_test_x'; process.env.VERCEL_ENV = 'production';
  try {
    assert.equal(shop.checkoutLocked('nope'), true);
    const r = await call(checkout, { method: 'POST', body: { kit: 'design', tp: shop.testPass() } });
    assert.equal(r.code, 404); assert.equal(r.body.error, 'not_for_sale');
    process.env.SHOP_STRIPE_SECRET_KEY = 'rk_live_x';
    assert.equal(shop.checkoutLocked(''), false);
  } finally { globalThis.fetch = realFetch; delete process.env.SHOP_STRIPE_SECRET_KEY; delete process.env.VERCEL_ENV; }
});

// Cooper's ruling 2026-10-05: the Design kit is free on production, paid ($29) on previews.
test('production: the Design kit is free everywhere the API reports it', async () => {
  process.env.VERCEL_ENV = 'production';
  try {
    assert.equal(shop.gateFor('design'), 'free'); assert.equal(shop.priceFor('design'), 0);
    assert.equal(shop.gateFor('linkedin'), 'email'); assert.equal(shop.gateFor('startup'), 'free');
    const list = await call(kitApi, { query: { list: '1' } });
    const d = list.body.kits.find((k) => k.slug === 'design');
    assert.equal(d.gate, 'free'); assert.equal(d.price, 0); assert.equal(d.draft, false);
    assert.equal(list.body.kits.some((k) => k.gate === 'paid' || k.price > 0), false);
    const g = await call(kitApi, { query: { slug: 'design' } });
    assert.equal(g.code, 200); assert.equal(g.body.gate, 'free'); assert.equal(g.body.price, 0);
    assert.equal(g.body.locked, false); assert.equal(g.body.kit.master_prompt, 'MP');
    for (const kit of ['design', 'linkedin', 'startup', 'nope']) {
      const c = await call(checkout, { method: 'POST', body: { kit } });
      assert.equal(c.code, 404); assert.equal(c.body.error, 'not_for_sale');
    }
  } finally { delete process.env.VERCEL_ENV; }
});

test('preview: the Design kit stays paid at $29 and locked', async () => {
  process.env.VERCEL_ENV = 'preview';
  try {
    assert.equal(shop.gateFor('design'), 'paid'); assert.equal(shop.priceFor('design'), 2900);
    const list = await call(kitApi, { query: { list: '1' } });
    const d = list.body.kits.find((k) => k.slug === 'design');
    assert.equal(d.gate, 'paid'); assert.equal(d.price, 2900);
    const g = await call(kitApi, { query: { slug: 'design' } });
    assert.equal(g.body.gate, 'paid'); assert.equal(g.body.locked, true); assert.equal(g.body.kit.master_prompt, undefined);
    assert.equal(shop.canRead('design', '', process.env), false);
  } finally { delete process.env.VERCEL_ENV; }
});
