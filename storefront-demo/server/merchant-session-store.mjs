// Server-only merchant session repository. Use with a privileged, server-side
// PostgreSQL client; never expose the connection string to browsers.
// npm install pg argon2
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import {
  verifyAccessCode, generateSessionToken, hashSessionToken,
  merchantSessionCookie, clearMerchantSessionCookie,
} from './merchant-auth.mjs';

const pool = new Pool({
  connectionString: process.env.EARLY_STOREFRONT_DATABASE_URL,
  max: 5,
  ssl: { rejectUnauthorized: true },
});
const GENERIC_ERROR = 'Invalid phone or access code';
const hashIP = (ip) => createHash('sha256').update(String(process.env.EARLY_STOREFRONT_IP_PEPPER) + ':' + ip).digest('hex');

export async function loginMerchant({ phone, code, ip }) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone ?? '') || typeof code !== 'string' || code.length > 512) {
    throw new Error(GENERIC_ERROR);
  }
  if (!process.env.EARLY_STOREFRONT_IP_PEPPER || !process.env.EARLY_STOREFRONT_DATABASE_URL) {
    throw new Error('Authentication service not configured');
  }
  const client = await pool.connect();
  try {
    const ipHash = hashIP(ip ?? 'unknown');
    await client.query('BEGIN');
    // Serialize checks and writes for the same phone or IP to avoid parallel guessing.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['login:' + phone]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['ip:' + ipHash]);
    const recent = await client.query(
      `SELECT count(*) FILTER (WHERE phone=$1) AS phone_count,
              count(*) FILTER (WHERE ip_hash=$2) AS ip_count
       FROM early_storefront.login_attempts
       WHERE attempted_at > now() - interval '15 minutes'`,
      [phone, ipHash],
    );
    if (Number(recent.rows[0].phone_count) >= 5 || Number(recent.rows[0].ip_count) >= 20) {
      await client.query('ROLLBACK');
      return { ok: false, status: 429, message: 'Too many attempts. Try again later.' };
    }
    const found = await client.query(
      `SELECT id, store_id, code_hash FROM early_storefront.credentials
       WHERE phone=$1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    const credential = found.rows[0];
    const valid = credential ? await verifyAccessCode(credential.code_hash, code) : false;
    await client.query(
      'INSERT INTO early_storefront.login_attempts(phone,ip_hash,succeeded) VALUES($1,$2,$3)',
      [phone, ipHash, valid],
    );
    if (!valid) {
      await client.query('COMMIT');
      return { ok: false, status: 401, message: GENERIC_ERROR };
    }
    const token = generateSessionToken();
    await client.query(
      `INSERT INTO early_storefront.sessions(credential_id,token_hash,expires_at)
       VALUES($1,$2,now() + interval '7 days')`,
      [credential.id, hashSessionToken(token)],
    );
    await client.query('COMMIT');
    return { ok: true, storeId: credential.store_id, setCookie: merchantSessionCookie(token) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function requireMerchantSession(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await pool.query(
    `SELECT c.store_id, c.id AS credential_id
     FROM early_storefront.sessions s
     JOIN early_storefront.credentials c ON c.id=s.credential_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
       AND c.revoked_at IS NULL LIMIT 1`,
    [hashSessionToken(token)],
  );
  return result.rows[0] ?? null;
}

export async function logoutMerchant(token) {
  if (typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await pool.query(
      'UPDATE early_storefront.sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL',
      [hashSessionToken(token)],
    );
  }
  return clearMerchantSessionCookie();
}

export async function closeMerchantAuthPool() {
  await pool.end();
}
