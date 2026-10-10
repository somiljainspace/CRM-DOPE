import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * BFF proxy: forwards authenticated dashboard requests to the Fastify API.
 *
 * Security model:
 * - The upstream platform session token lives ONLY in an HttpOnly cookie
 *   (cdp_session) set by the login route. It is never exposed to browser JS.
 * - The browser sends the cookie; this server reads it and forwards it as a
 *   Bearer header to the configured API base URL.
 * - Only a fixed allowlist of analytics/auth control-plane paths is proxied.
 * - Destinations are validated against API_BASE_URL; no open proxy.
 */

const ALLOWED_PREFIXES = [
  'v1/auth/me',
  'v1/auth/login',
  'v1/auth/logout',
  'v1/control/analytics/trends',
  'v1/control/analytics/active-users',
  'v1/control/analytics/events',
  'v1/control/analytics/funnels',
  'v1/control/analytics/retention',
  'v1/control/segments',
] as const;

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';

  // Normalize: /api/proxy/v1/... -> v1/...
  const rawPath = req.query['...path'];
  const path = Array.isArray(rawPath) ? rawPath.join('/') : rawPath || '';
  if (!isAllowed(path)) {
    return res.status(403).json({ error: 'Forbidden', message: 'Path not allowed' });
  }

  const url = new URL(`${apiBase.replace(/\/$/, '')}/${path}`);
  // Forward only whitelisted query params
  const allowedParams = ['workspaceId', 'startDate', 'endDate', 'interval', 'eventName', 'limit', 'offset', 'period'];
  for (const key of Object.keys(req.query)) {
    if (key === '...path') continue;
    if (allowedParams.includes(key)) {
      const val = req.query[key];
      if (Array.isArray(val)) val.forEach((v) => url.searchParams.append(key, v));
      else if (val) url.searchParams.append(key, val);
    }
  }

  // Read the session from the HttpOnly cookie
  const cookieHeader = req.headers.cookie || '';
  const sessionMatch = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith('cdp_session='));
  const sessionToken = sessionMatch ? sessionMatch.slice('cdp_session='.length) : '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

  // CSRF/origin protection for cookie-authenticated mutations
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (!origin || !host || new URL(origin).host !== host) {
      return res.status(403).json({ error: 'Forbidden', message: 'Cross-origin request rejected' });
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // bounded 15s timeout
    let body: string | undefined;
    if (req.body && Object.keys(req.body).length > 0) body = JSON.stringify(req.body);

    const upstream = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upstream error';
    res.status(502).json({ error: 'Bad Gateway', message });
  }
}

// Disable Next.js body parsing limits only for small JSON payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '256kb',
    },
    responseLimit: '2mb',
  },
};
