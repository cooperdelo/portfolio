// Shared band reviewer: links, validation, and the save path (Supabase faked).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY = 'test-service-key';
const mod = await import('../../api/band-share.mjs');
const { makeLink, readLink, BAND } = mod;
const handler = mod.default;

function call({ method = 'GET', query = {}, body } = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } };
    handler({ method, query, body, headers: { host: 'x.test' } }, res);
  });
}

test('links verify, and tampered, foreign or expired links do not', () => {
  const k = makeLink('Jake');
  assert.equal(readLink(k).n, 'Jake');
  assert.equal(readLink(k.slice(0, -2) + 'xx'), null);
  assert.equal(readLink('nope'), null);
  assert.equal(readLink(makeLink('Jake', -1)), null);
  assert.equal(readLink(k, { SUPABASE_ADMIN_SERVICE_ROLE_KEY: 'other' }), null);
});

test('no valid link, no access', async () => {
  assert.equal((await call({ query: { k: 'bad.link' } })).code, 401);
  assert.equal((await call({ method: 'POST', body: { k: 'bad.link' } })).code, 401);
});

test('saves are validated before anything is written', async () => {
  const k = makeLink('Sam');
  const base = { k, asset: '11111111-1111-4111-8111-111111111111', revision: 0, verdict: 'favorite', note: '', start: null, end: null };
  assert.equal((await call({ method: 'POST', body: { ...base, verdict: 'nuke' } })).code, 400);
  assert.equal((await call({ method: 'POST', body: { ...base, start: 5, end: 4 } })).code, 400);
  assert.equal((await call({ method: 'POST', body: { ...base, start: 5 } })).code, 400);
  assert.equal((await call({ method: 'POST', body: { ...base, asset: 'x' } })).code, 400);
});

test('a save writes the shared row with the next revision and maps delete to reject', async () => {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    const b = JSON.parse(init.body);
    return new Response(JSON.stringify([{ asset_id: '11111111-1111-4111-8111-111111111111', revision: b.revision, verdict: b.verdict, note: b.note, trim_start: b.trim_start, trim_end: b.trim_end, updated_by: b.updated_by, updated_at: b.updated_at }]), { status: 200 });
  };
  try {
    const r = await call({ method: 'POST', body: { k: makeLink('Sam'), asset: '11111111-1111-4111-8111-111111111111', revision: 3, verdict: 'delete', note: 'shaky', start: 1.5, end: 4 } });
    assert.equal(r.code, 200);
    assert.equal(r.body.mark.verdict, 'delete');
    assert.equal(r.body.mark.revision, 4);
    const sent = JSON.parse(seen[0].init.body);
    assert.equal(sent.verdict, 'reject');
    assert.equal(sent.updated_by, 'Sam');
    assert.match(seen[0].url, new RegExp(`reviewer=eq.${BAND}&revision=eq.3`));
  } finally { globalThis.fetch = real; }
});

test('a stale revision comes back as a conflict, not a silent overwrite', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('[]', { status: 200 });
  try {
    const r = await call({ method: 'POST', body: { k: makeLink('Sam'), asset: '11111111-1111-4111-8111-111111111111', revision: 2, verdict: 'keep', note: '', start: null, end: null } });
    assert.equal(r.code, 409);
  } finally { globalThis.fetch = real; }
});

test('only the owner can make links', async () => {
  const r = await call({ query: { mint: 'Jake' } });
  assert.notEqual(r.code, 200);
});
