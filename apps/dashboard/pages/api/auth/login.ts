import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Login: posts credentials to the Fastify API, stores the returned
 * session token in an HttpOnly cookie, returns only user info.
 * The raw token never reaches browser JavaScript.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiBase = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Bad Request', message: 'Email and password required' });

  // CSRF/origin protection for cookie-setting mutations
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host && new URL(origin).host !== host) {
    return res.status(403).json({ error: 'Forbidden', message: 'Cross-origin request rejected' });
  }

  try {
    const upstream = await fetch(`${apiBase}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !data.token) {
      return res.status(upstream.status).json({
        error: data.error || 'Unauthorized',
        message: data.message || 'Login failed',
      });
    }

    const maxAge = 60 * 60 * 24; // 24h
    const secure = process.env.NODE_ENV === 'production';
    const cookie = [
      `cdp_session=${data.token}`,
      'HttpOnly',
      'Path=/',
      `Max-Age=${maxAge}`,
      `SameSite=Lax`,
      secure ? 'Secure' : '',
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ success: true, expiresAt: data.expiresAt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return res.status(502).json({ error: 'Bad Gateway', message });
  }
}
