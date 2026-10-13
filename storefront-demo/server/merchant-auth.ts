import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

/**
 * Server-only primitives for merchant phone + generated access code authentication.
 * Never import this module in client components or browser bundles.
 * Rate limits and session persistence must be enforced by the API/database layer.
 */
export function normalizeNigerianPhone(input: string): string {
  const value = input.replace(/[\s()-]/g, "");
  if (/^0[789][01]\d{8}$/.test(value)) return "+234" + value.slice(1);
  if (/^\+234[789][01]\d{8}$/.test(value)) return value;
  throw new Error("Enter a valid Nigerian phone number");
}

export function generateAccessCode(): string {
  // 32 random bytes; URL-safe, high entropy and contains non-alphanumeric symbols.
  return randomBytes(32).toString("base64url") + "!#";
}

export function generateRecoveryCode(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashSecret(secret: string): Promise<string> {
  return argon2.hash(secret, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifySecret(hash: string, candidate: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, candidate);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function compareSessionToken(token: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashSessionToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function merchantSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 7): string {
  return `early_storefront_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
