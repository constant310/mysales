import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAccessCode, generateRecoveryCode, hashAccessCode, verifyAccessCode,
  generateSessionToken, hashSessionToken, compareTokenHashes,
  merchantSessionCookie, clearMerchantSessionCookie,
} from '../server/merchant-auth.mjs';

test('access codes are random, URL-safe and independently generated', () => {
  const a = generateAccessCode();
  const b = generateAccessCode();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.match(generateRecoveryCode(), /^[A-Za-z0-9_-]{43}$/);
});

test('Argon2id verifies only the correct access code', async () => {
  const code = generateAccessCode();
  const hash = await hashAccessCode(code);
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyAccessCode(hash, code), true);
  assert.equal(await verifyAccessCode(hash, generateAccessCode()), false);
  assert.equal(await verifyAccessCode('invalid', code), false);
});

test('session tokens are stored only as stable SHA256 hashes', () => {
  const token = generateSessionToken();
  const digest = hashSessionToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(compareTokenHashes(digest, hashSessionToken(token)), true);
  assert.equal(compareTokenHashes(digest, hashSessionToken(generateSessionToken())), false);
});

test('session cookie has secure browser attributes and revocation works', () => {
  const cookie = merchantSessionCookie(generateSessionToken());
  assert.match(cookie, /^__Host-early_storefront_session=/);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(attr));
  assert.ok(clearMerchantSessionCookie().includes('Max-Age=0'));
});
