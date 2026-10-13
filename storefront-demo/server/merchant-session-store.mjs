// Passwordless merchant sessions. A permanent, revocable private link
// creates a time-limited HttpOnly browser session for its own store.
// No merchant password, login code, or credential fallback is supported.
import pg from 'pg';
import { hashSessionToken, clearMerchantSessionCookie } from './merchant-auth.mjs';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.EARLY_STOREFRONT_DATABASE_URL,
  max: 5,
  ssl: { rejectUnauthorized: true },
});

export async function requireMerchantSession(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await pool.query(
    `SELECT s.store_id
     FROM early_storefront.sessions s
     JOIN early_storefront.stores st ON st.id=s.store_id
     WHERE s.token_hash=$1 AND s.store_id IS NOT NULL
       AND s.revoked_at IS NULL AND s.expires_at > now()
     LIMIT 1`,
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
