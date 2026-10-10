// Real SSRF-safe HTTPS transport with DNS pinning, TLS, no redirects
import https from 'https';
import { URL } from 'url';
import net from 'net';
import dns from 'dns';
import { isPrivateIPv4, isPrivateIPv6 } from './urlValidation';

export interface DeliveryResult {
  ok: boolean;
  status?: number;
  bodyPreview?: string;
  error?: string;
  retryable: boolean;
}

export async function deliverWebhook(
  urlStr: string,
  payloadBytes: Buffer,
  headers: Record<string, string>,
  timeoutMs = 10000,
  allowLocal = false,
): Promise<DeliveryResult> {
  const u = new URL(urlStr);
  if (u.protocol !== 'https:') return { ok: false, error: 'HTTPS required', retryable: false };
  const hostname = u.hostname;

  // Resolve DNS. Reject prohibited answers. Fail closed on private addresses
  // unless explicitly allowed for test-only loopback injection.
  const addresses = await new Promise<string[]>((res) => {
    dns.lookup(hostname, { all: true }, (_: any, a: any) => res(((a || []) as Array<{ address: string }>).map((x) => x.address)));
  });
  if (addresses.length === 0) return { ok: false, error: 'No resolvable address', retryable: true };
  const targetIp = addresses.find(a => !a.includes(':')) || addresses[0];

  if (!allowLocal) {
    const v4 = net.isIP(targetIp) === 4 ? targetIp : null;
    const v6 = net.isIP(targetIp) === 6 ? targetIp : null;
    if (v4 && isPrivateIPv4(v4)) return { ok: false, error: 'Private IPv4', retryable: false };
    if (v6 && isPrivateIPv6(v6)) return { ok: false, error: 'Private IPv6', retryable: false };
  }

  return new Promise<DeliveryResult>((res) => {
    const req = https.request({
      hostname: targetIp,
      port: u.port ? parseInt(u.port, 10) : 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': payloadBytes.length },
      servername: hostname, // SNI: cert verification uses hostname
      timeout: timeoutMs,
      agent: false,
      rejectUnauthorized: true, // TLS verification on
    }, (resp) => {
      let chunks = Buffer.alloc(0);
      resp.on('data', (c: Buffer) => { chunks = Buffer.concat([chunks, c]); if (chunks.length > 65536) resp.destroy(); });
      resp.on('end', () => {
        const ok = resp.statusCode !== undefined && resp.statusCode >= 200 && resp.statusCode < 300;
        res({
          ok,
          status: resp.statusCode,
          bodyPreview: chunks.toString('utf8').slice(0, 200),
          retryable: !ok && (resp.statusCode === undefined || resp.statusCode >= 500),
        });
      });
    });
    req.on('error', (e) => res({ ok: false, error: e.message, retryable: true }));
    req.on('timeout', () => { req.destroy(); res({ ok: false, error: 'Timeout', retryable: true }); });
    req.write(payloadBytes);
    req.end();
  });
}
