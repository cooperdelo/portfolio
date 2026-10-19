import test from 'node:test';
import assert from 'node:assert/strict';
const { validate } = await import('../../api/contact.mjs');
test('contact: honeypot, required fields, email or handle', () => {
  assert.ok(validate({ website: 'x' }).spam);
  assert.match(validate({ name: '', reply: 'a@b.co', message: 'hello there friend' }).error, /name/);
  assert.match(validate({ name: 'A', reply: 'nope nope', message: 'hello there friend' }).error, /Instagram/);
  assert.match(validate({ name: 'A', reply: 'a@b.co', message: 'hi' }).error, /more/);
  assert.equal(validate({ name: 'A', reply: '@cooperdelo', message: 'Launch film for my brand', kind: 'Film or content' }).row.kind, 'Film or content');
  assert.equal(validate({ name: 'A', reply: 'a@b.co', message: 'Launch film for my brand', kind: 'evil' }).row.kind, 'Something else');
});
test('contact: brand inquiries from /brands', () => {
  const ok = validate({ kind: 'Brand or UGC', brand: 'Acme', need: 'Three UGC videos for our app launch', budget: '$500 to $2,000', email: 'm@acme.co' });
  assert.deepEqual(ok.row, { kind: 'Brand or UGC', name: 'Acme', reply: 'm@acme.co', message: 'Three UGC videos for our app launch\n\nBudget: $500 to $2,000' });
  assert.equal(validate({ kind: 'Brand or UGC', brand: 'Acme', need: 'Three UGC videos for our app launch', budget: 'a million', email: 'm@acme.co' }).row.message, 'Three UGC videos for our app launch');
  assert.match(validate({ kind: 'Brand or UGC', brand: '', need: 'Three UGC videos', email: 'm@acme.co' }).error, /brand/);
  assert.match(validate({ kind: 'Brand or UGC', brand: 'Acme', need: 'Three UGC videos', email: '@acme' }).error, /email/);
  assert.match(validate({ kind: 'Brand or UGC', brand: 'Acme', need: 'hi', email: 'm@acme.co' }).error, /more/);
  assert.ok(validate({ kind: 'Brand or UGC', website: 'spam' }).spam);
});
