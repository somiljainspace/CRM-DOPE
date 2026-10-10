import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Logout: revokes session via upstream API and clears cookie.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiBase = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

  // Read session from cookie
  const cookieHeader = req.headers.cookie || '';
  const sessionMatch = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith('cdp_session='));
  const sessionToken = sessionMatch ? sessionMatch.slice('cdp_session='.length) : '';

  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized', message: 'No session' });

  try {
    const upstream = await fetch(`${apiBase}/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data = await upstream.json().catch(() => ({}));

    res.setHeader('Set-Cookie', 'cdp_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return res.status(200).json({ success: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Logout failed';
    return res.status(502).json({ error: 'Bad Gateway', message });
  }
}
