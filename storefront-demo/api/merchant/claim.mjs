import {safeOrigin} from '../../server/http-auth.mjs';
import { redeemManagementLink } from '../../server/management-links.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) {
    return res.status(415).json({ error: 'JSON required' });
  }
  if(!safeOrigin(req))return res.status(403).json({error:'Invalid origin'});
  const token = req.body?.token;
  try {
    const session = await redeemManagementLink(token);
    if (!session) return res.status(401).json({ error: 'Link invalid, expired or already used' });
    res.setHeader('Set-Cookie', session.setCookie);
    return res.status(200).json({ ok: true, storeId: session.storeId });
  } catch (error) {
    console.error('Management link claim failed', error?.message);
    return res.status(500).json({ error: 'Unable to claim link' });
  }
}
