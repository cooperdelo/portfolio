// Shared band reviewer: links, piles, validation, and the save path (Supabase faked).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_ADMIN_SERVICE_ROLE_KEY = 'test-service-key';
const mod = await import('../../api/band-share.mjs');
const { makeLink, readLink, resetDriveKey, BAND } = mod;
const handler = mod.default;

function call({ method = 'GET', query = {}, body, headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } };
    handler({ method, query, body, headers: { host: 'x.test', ...headers } }, res);
  });
}

const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';
const A3 = '33333333-3333-4333-8333-333333333333';
const ASSETS = [
  { id: A1, name: 'a.mp4', gig: 'Chi Phi', duration: 10, mime_type: 'video/mp4', proxy_path: 'x/a.mp4', preview_drive_id: 'DRV1', poster_drive_id: null },
  { id: A2, name: 'b.jpg', gig: 'Chi Phi', duration: null, mime_type: 'image/jpeg', proxy_path: null, preview_drive_id: 'DRV2', poster_drive_id: 'THUMB2' },
  { id: A3, name: 'c.mp4', gig: 'Kappa', duration: 5, mime_type: 'video/mp4', proxy_path: 'y/c.mp4', preview_drive_id: null, poster_drive_id: null },
];

// Fake Supabase: assets (filtered by id when asked), reviews, secrets, storage signing, review writes, owner auth.
async function withFake(fn, { saveStatus = [], cols = true, patchEmpty = false } = {}) {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    seen.push({ url, init });
    if (url.includes('/rest/v1/band_media_assets')) {
      if (!cols && /preview_drive_id|mime_type/.test(url)) return new Response(JSON.stringify({ message: 'column band_media_assets.mime_type does not exist' }), { status: 400 });
      const id = /id=eq\.([\w-]+)/.exec(url)?.[1];
      return new Response(JSON.stringify(id ? ASSETS.filter((a) => a.id === id) : ASSETS), { status: 200 });
    }
    if (url.includes('automation_secrets')) return new Response(JSON.stringify([{ value: 'KEY123' }]), { status: 200 });
    if (url.includes('/storage/v1/object/sign')) return new Response(JSON.stringify(JSON.parse(init.body).paths.map((p) => ({ path: p, signedURL: '/sign/' + p }))), { status: 200 });
    if (url.includes('band_media_reviews') && init.method) {
      const bad = saveStatus.shift();
      if (bad) return new Response(JSON.stringify({ message: bad }), { status: 400 });
      if (patchEmpty) return new Response('[]', { status: 200 });
      return new Response(JSON.stringify([{ asset_id: A1, ...JSON.parse(init.body) }]), { status: 200 });
    }
    if (url.includes('band_media_reviews')) return new Response(JSON.stringify([{ asset_id: A1, revision: 1, verdict: 'keep', note: '', use_band: true }, { asset_id: A3, revision: 1, verdict: 'reject', note: '' }]), { status: 200 });
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u', email: 'c@x.test' }), { status: 200 });
    if (url.includes('admin_allowlist')) return new Response(JSON.stringify([{ admin_role: 'full' }]), { status: 200 });
    return new Response('[]', { status: 200 });
  };
  try { resetDriveKey(); return await fn(seen); } finally { globalThis.fetch = real; }
}
const post = (b, k = makeLink('Sam')) => call({ method: 'POST', body: { k, asset: A1, revision: 3, verdict: 'delete', note: 'shaky', start: 1.5, end: 4, ...b } });

test('links verify, and tampered, foreign or expired links do not', () => {
  const k = makeLink('Jake');
  assert.equal(readLink(k).n, 'Jake');
  assert.equal(readLink(k.slice(0, -2) + 'xx'), null);
  assert.equal(readLink('nope'), null);
  assert.equal(readLink(makeLink('Jake', -1)), null);
  assert.equal(readLink(k, { SUPABASE_ADMIN_SERVICE_ROLE_KEY: 'other' }), null);
});

test('links with a pile verify, and a tampered pile does not', () => {
  const k = makeLink('Jake', 120, process.env, ['Chi Phi']);
  assert.deepEqual(readLink(k).g, ['Chi Phi']);
  assert.equal(readLink(makeLink('Jake')).g, undefined);
  const [body, mac] = k.split('.');
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  p.g = ['Kappa'];
  assert.equal(readLink(Buffer.from(JSON.stringify(p)).toString('base64url') + '.' + mac), null);
});

test('no valid link, no access', async () => {
  assert.equal((await call({ query: { k: 'bad.link' } })).code, 401);
  assert.equal((await call({ method: 'POST', body: { k: 'bad.link' } })).code, 401);
});

test('saves are validated before anything is written', async () => {
  const base = { asset: A1, revision: 0, verdict: 'favorite', start: null, end: null };
  assert.equal((await post({ ...base, verdict: 'nuke' })).code, 400);
  assert.equal((await post({ ...base, start: 5, end: 4 })).code, 400);
  assert.equal((await post({ ...base, start: 5 })).code, 400);
  assert.equal((await post({ ...base, asset: 'x' })).code, 400);
});

test('tags are validated', async () => {
  const none = { start: null, end: null };
  for (const b of [{ shot: 'Wide' }, { shot: 'a' }, { subject: 'x'.repeat(17) }, { subject: 5 }, { band: 'yes' }, { broll: 1 }]) assert.equal((await post({ ...none, ...b })).code, 400, JSON.stringify(b));
});

test('a save writes the shared row with the next revision and maps delete to reject', () => withFake(async (seen) => {
  const r = await post({ band: true, shot: 'wide', subject: 'drums' });
  assert.equal(r.code, 200);
  assert.equal(r.body.mark.verdict, 'delete');
  assert.equal(r.body.mark.revision, 4);
  assert.equal(r.body.mark.band, true);
  assert.equal(r.body.mark.broll, false);
  assert.equal(r.body.mark.shot, 'wide');
  const w = seen.find((s) => s.init.method === 'PATCH');
  const sent = JSON.parse(w.init.body);
  assert.equal(sent.verdict, 'reject');
  assert.equal(sent.updated_by, 'Sam');
  assert.equal(sent.use_band, true);
  assert.match(w.url, new RegExp(`reviewer=eq.${BAND}&revision=eq.3`));
}));

test('missing tag columns still save the verdict and trim, with a notice', () => withFake(async (seen) => {
  const r = await post({ band: true });
  assert.equal(r.code, 200);
  assert.equal(r.body.notice, 'Tags turn on once Cooper finishes setup.');
  const last = JSON.parse(seen.filter((s) => s.init.method === 'PATCH').pop().init.body);
  assert.equal('use_band' in last, false);
  assert.equal(last.trim_start, 1.5);
  assert.equal(last.verdict, 'reject');
}, { saveStatus: ['column band_media_reviews.use_band does not exist'] }));

test('a missing updated_by column is retried without it', () => withFake(async (seen) => {
  const r = await post({});
  assert.equal(r.code, 200);
  assert.equal(r.body.notice, undefined);
  assert.equal('updated_by' in JSON.parse(seen.filter((s) => s.init.method === 'PATCH').pop().init.body), false);
}, { saveStatus: ['column band_media_reviews.updated_by does not exist'] }));

test('saving outside the pile is forbidden, inside it works', () => withFake(async () => {
  const k = makeLink('Jake', 120, process.env, ['Chi Phi']);
  assert.equal((await post({ asset: A3 }, k)).code, 403);
  assert.equal((await post({ asset: A1 }, k)).code, 200);
}));

test('a photo cannot carry a trim', () => withFake(async () => {
  assert.equal((await post({ asset: A2 })).code, 400);
  assert.equal((await post({ asset: A2, start: null, end: null })).code, 200);
}));

test('GET returns only the pile, with Drive urls when the key exists and Supabase urls otherwise', () => withFake(async () => {
  const r = await call({ query: { k: makeLink('Jake', 120, process.env, ['Chi Phi']) } });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.gigs, ['Chi Phi']);
  assert.deepEqual(r.body.clips.map((c) => [c.id, c.kind]), [[A1, 'video'], [A2, 'photo']]);
  assert.equal(r.body.clips[0].url, 'https://www.googleapis.com/drive/v3/files/DRV1?alt=media&key=KEY123');
  assert.match(r.body.clips[0].poster, /\/sign\/x\/poster\.jpg$/);
  assert.match(r.body.clips[1].poster, /files/THUMB2?alt=media/);
  assert.deepEqual(r.body.marks.map((m) => m.asset), [A1]);
  assert.equal(r.body.marks[0].band, true);
  const all = await call({ query: { k: makeLink('Jake') } });
  assert.deepEqual(all.body.gigs, ['Chi Phi', 'Kappa']);
  assert.equal(all.body.clips.length, 3);
  assert.match(all.body.clips[2].url, /\/storage\/v1\/sign\/y\/c\.mp4$/);
  assert.match(all.body.clips[2].poster, /sign\/y\/poster\.jpg$/);
}));

test('GET still works before the migration adds the new columns', () => withFake(async () => {
  const r = await call({ query: { k: makeLink('Jake') } });
  assert.equal(r.code, 200);
  assert.equal(r.body.clips.length, 3);
}, { cols: false }));

test('a stale revision comes back as a conflict, not a silent overwrite', () => withFake(async () => {
  const r = await post({ revision: 2, verdict: 'keep', start: null, end: null });
  assert.equal(r.code, 409);
}, { patchEmpty: true }));

test('only the owner can make links or list gigs', async () => {
  assert.notEqual((await call({ query: { mint: 'Jake' } })).code, 200);
  assert.notEqual((await call({ query: { gigs: '1' } })).code, 200);
});

test('owner lists gigs and mints a pile-limited link', () => withFake(async () => {
  const h = { authorization: 'Bearer t' };
  const g = await call({ query: { gigs: '1' }, headers: h });
  assert.deepEqual(g.body.gigs, [{ gig: 'Chi Phi', videos: 1, photos: 1 }, { gig: 'Kappa', videos: 1, photos: 0 }]);
  const m = await call({ query: { mint: 'Jake', gig: ['Chi Phi', 'Kappa'] }, headers: h });
  assert.equal(m.code, 200);
  assert.deepEqual(readLink(new URL(m.body.url).searchParams.get('k')).g, ['Chi Phi', 'Kappa']);
  const one = await call({ query: { mint: 'Jake', gig: 'Kappa' }, headers: h });
  assert.deepEqual(one.body.gigs, ['Kappa']);
  assert.equal((await call({ query: { mint: 'Jake', gig: 'Nope' }, headers: h })).code, 400);
  const every = await call({ query: { mint: 'Jake' }, headers: h });
  assert.equal(readLink(new URL(every.body.url).searchParams.get('k')).g, undefined);
  assert.deepEqual(every.body.gigs, ['Chi Phi', 'Kappa']);
}));

test('a trim cannot run past the clip duration', () => withFake(async () => {
  assert.equal((await post({ start: 1, end: 11 })).code, 400);
  assert.equal((await post({ start: 1, end: 10.4 })).code, 200);
}));
