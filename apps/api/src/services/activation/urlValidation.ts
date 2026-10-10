// Phase 6A: SSRF-resistant webhook URL validation
import net from 'net';
import { URL } from 'url';

export const PROD_ONLY_HTTPS = true;

export function isPrivateIPv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;
  const [a, b] = octets;
  if (a === 0 || a === 10) return true; // unspecified / private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0 && octets[2] === 0) return true; // reserved
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast/reserved
  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return true; // unspecified / loopback
  if (s.startsWith('fe80:')) return true; // link-local
  if (s.startsWith('fc') || s.startsWith('fd')) return true; // unique local
  if (s.startsWith('ff')) return true; // multicast
  if (s.includes(':ffff:') || s.includes('::ffff:')) {
    // IPv4-mapped IPv6
    const v4 = ip.split('::ffff:')[1] || ip.split(':ffff:')[1];
    return v4 ? isPrivateIPv4(v4) : true;
  }
  if (s.startsWith('2001:db8:')) return true; // documentation
  return false;
}

export function validateWebhookUrl(raw: string, opts: { allowLocal?: boolean } = {}): { ok: boolean; host?: string; error?: string } {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && !opts.allowLocal) {
      return { ok: false, error: 'HTTPS required in production' };
    }
    if (u.username || u.password) return { ok: false, error: 'URL credentials not allowed' };
    if (!u.hostname) return { ok: false, error: 'Missing hostname' };
    const ip = net.isIP(u.hostname);
    if (ip) {
      const blocked = ip === 4 ? isPrivateIPv4(u.hostname) : isPrivateIPv6(u.hostname);
      if (blocked && !opts.allowLocal) return { ok: false, error: 'Non-public destination IP' };
    }
    return { ok: true, host: u.hostname };
  } catch {
    return { ok: false, error: 'Malformed URL' };
  }
}
