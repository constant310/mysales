// Passwordless merchant access: server-only. A management link is a bearer secret.
// Store only its SHA-256 hash; issue it via a trusted operator workflow, never a public route.
import { randomBytes, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { generateSessionToken, hashSessionToken, merchantSessionCookie } from './merchant-auth.mjs';

const pool = new Pool({
  connectionString: process.env.EARLY_STOREFRONT_DATABASE_URL,
  max: 5,
  ssl: { rejectUnauthorized: true },
});
const hash = token => createHash('sha256').update(token).digest('hex');
const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

export async function issueManagementLink(storeId, origin) {
  // This function must be invoked only by an authenticated operator.
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) throw new Error('Invalid store');
  const base = new URL(origin);
  if (base.protocol !== 'https:') throw new Error('HTTPS required');
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO early_storefront.management_links(store_id,token_hash,expires_at)
     SELECT id,$2,now()+interval '48 hours' FROM early_storefront.stores WHERE id=$1`,
    [storeId, hash(token)],
  );
  const url = new URL('/manage/claim', base);
  url.hash = 'token=' + encodeURIComponent(token); // fragment not sent in HTTP request or referer
  return url.toString(); // reveal only to intended merchant via trusted channel
}

export async function redeemManagementLink(token) {
  if (!validToken(token)) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE early_storefront.management_links
       SET used_at=now()
       WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()
       RETURNING store_id`,
      [hash(token)],
    );
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const sessionToken = generateSessionToken();
    await client.query(
      `INSERT INTO early_storefront.sessions(store_id,token_hash,expires_at)
       VALUES($1,$2,now()+interval '7 days')`,
      [result.rows[0].store_id, hashSessionToken(sessionToken)],
    );
    await client.query('COMMIT');
    return { storeId: result.rows[0].store_id, setCookie: merchantSessionCookie(sessionToken) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeStoreManagementAccess(storeId) {
  // Operator-only: invalidates all outstanding links and current store sessions.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE early_storefront.management_links SET revoked_at=now() WHERE store_id=$1 AND revoked_at IS NULL',
      [storeId],
    );
    await client.query(
      'UPDATE early_storefront.sessions SET revoked_at=now() WHERE store_id=$1 AND revoked_at IS NULL',
      [storeId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
