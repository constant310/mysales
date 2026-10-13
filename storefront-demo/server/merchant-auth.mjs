// Server-only credential helpers. Requires: npm install argon2
// Never import this module into browser code.
import argon2 from 'argon2';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const CODE_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
});

export function generateAccessCode() {
  // 32 random bytes, URL-safe, ~256 bits of entropy.
  return randomBytes(32).toString('base64url');
}

export function generateRecoveryCode() {
  return randomBytes(32).toString('base64url');
}

export async function hashAccessCode(code) {
  if (typeof code !== 'string' || code.length < 32) throw new Error('Invalid credential');
  return argon2.hash(code, CODE_OPTIONS);
}

export async function verifyAccessCode(hash, candidate) {
  if (typeof hash !== 'string' || typeof candidate !== 'string' || candidate.length > 512) return false;
  try { return await argon2.verify(hash, candidate); } catch { return false; }
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 512) throw new Error('Invalid session token');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function compareTokenHashes(expected, actual) {
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

export function merchantSessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return `__Host-early_storefront_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearMerchantSessionCookie() {
  return '__Host-early_storefront_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
}
