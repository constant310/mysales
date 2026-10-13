import { loginMerchant } from '../../server/merchant-session-store.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) {
    return res.status(415).json({ error: 'JSON required' });
  }
  const { phone, code } = req.body ?? {};
  try {
    // Only trust platform-provided request IP, not user-controlled forwarded headers.
    const result = await loginMerchant({ phone, code, ip: req.socket?.remoteAddress ?? 'unknown' });
    if (!result.ok) return res.status(result.status).json({ error: result.message });
    res.setHeader('Set-Cookie', result.setCookie);
    return res.status(200).json({ ok: true, storeId: result.storeId });
  } catch (error) {
    console.error('Merchant login error', error?.message);
    return res.status(500).json({ error: 'Login temporarily unavailable' });
  }
}
