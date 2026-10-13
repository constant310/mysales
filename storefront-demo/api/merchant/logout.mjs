import {safeOrigin} from '../../server/http-auth.mjs';
import { logoutMerchant } from '../../server/merchant-session-store.mjs';

function cookieValue(header, key) {
  const found = (header ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(key + '='));
  return found ? decodeURIComponent(found.slice(key.length + 1)) : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
  const token = cookieValue(req.headers.cookie, '__Host-early_storefront_session');
  try {
    res.setHeader('Set-Cookie', await logoutMerchant(token));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Merchant logout error', error?.message);
    return res.status(500).json({ error: 'Logout temporarily unavailable' });
  }
}
