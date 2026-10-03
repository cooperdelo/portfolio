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
