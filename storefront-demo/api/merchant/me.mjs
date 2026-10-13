import { requireMerchantSession } from '../../server/merchant-session-store.mjs';

function readSessionCookie(header) {
  const prefix = '__Host-early_storefront_session=';
  const cookie = String(header ?? '').split(';').map(v => v.trim()).find(v => v.startsWith(prefix));
  if (!cookie) return null;
  try { return decodeURIComponent(cookie.slice(prefix.length)); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const merchant = await requireMerchantSession(readSessionCookie(req.headers.cookie));
    if (!merchant) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, storeId: merchant.store_id });
  } catch (error) {
    console.error('Merchant session lookup error', error?.message);
    return res.status(500).json({ error: 'Session check temporarily unavailable' });
  }
}
