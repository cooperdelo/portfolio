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
  const base = { kind: 'Brand or UGC', brand: 'Acme', need: 'Three UGC videos for our app launch', email: 'm@acme.co' };
  assert.deepEqual(validate(base).row, { kind: 'Brand or UGC', name: 'Acme', reply: 'm@acme.co', message: 'Three UGC videos for our app launch' });
  assert.equal(validate({ ...base, deal: 'Per video', rate: '150', videos: '4' }).row.message, 'Three UGC videos for our app launch\n\nTerms: Per video: $150 per video, 4 videos');
  assert.equal(validate({ ...base, deal: 'Monthly retainer', rate: '$2,500' }).row.message, 'Three UGC videos for our app launch\n\nTerms: Monthly retainer: $2,500 per month');
  assert.equal(validate({ ...base, deal: 'Base + CPM', rate: '45', videos: '10', bonus: '$1 CPM up to 1M views' }).row.message, 'Three UGC videos for our app launch\n\nTerms: Base + CPM: $45 base per video, 10 videos, bonus: $1 CPM up to 1M views');
  assert.equal(validate({ ...base, deal: 'Not sure yet', rate: '999' }).row.message, 'Three UGC videos for our app launch\n\nTerms: Not sure yet');
  assert.equal(validate({ ...base, deal: 'a million', rate: '5' }).row.message, 'Three UGC videos for our app launch');
  assert.equal(validate({ ...base, deal: 'Per video', rate: '-3', videos: 'lots' }).row.message, 'Three UGC videos for our app launch\n\nTerms: Per video');
  assert.match(validate({ kind: 'Brand or UGC', brand: '', need: 'Three UGC videos', email: 'm@acme.co' }).error, /brand/);
  assert.match(validate({ kind: 'Brand or UGC', brand: 'Acme', need: 'Three UGC videos', email: '@acme' }).error, /email/);
  assert.match(validate({ kind: 'Brand or UGC', brand: 'Acme', need: 'hi', email: 'm@acme.co' }).error, /more/);
  assert.ok(validate({ kind: 'Brand or UGC', website: 'spam' }).spam);
});
