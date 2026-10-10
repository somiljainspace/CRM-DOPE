const { validateWebhookUrl, isPrivateIPv4, isPrivateIPv6 } = require('../../services/activation/urlValidation');

describe('Webhook URL validation (SSRF)', () => {
  it('rejects HTTP in production mode', () => {
    expect(validateWebhookUrl('http://example.com/hook').ok).toBe(false);
  });

  it('accepts HTTPS public URL', () => {
    expect(validateWebhookUrl('https://example.com/hook').ok).toBe(true);
  });

  it('rejects loopback', () => {
    expect(validateWebhookUrl('https://127.0.0.1/hook').ok).toBe(false);
    expect(validateWebhookUrl('https://localhost/hook').ok).toBe(false);
  });

  it('rejects private IPv4', () => {
    expect(isPrivateIPv4('10.0.0.1')).toBe(true);
    expect(isPrivateIPv4('192.168.1.1')).toBe(true);
    expect(isPrivateIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateIPv4('172.32.0.1')).toBe(false);
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
  });

  it('rejects link-local and multicast', () => {
    expect(isPrivateIPv4('169.254.1.1')).toBe(true);
    expect(isPrivateIPv4('224.0.0.1')).toBe(true);
    expect(isPrivateIPv4('255.255.255.255')).toBe(true);
  });

  it('rejects private IPv6', () => {
    expect(isPrivateIPv6('::1')).toBe(true);
    expect(isPrivateIPv6('fe80::1')).toBe(true);
    expect(isPrivateIPv6('fd00::1')).toBe(true);
    expect(isPrivateIPv6('ff02::1')).toBe(true);
    expect(isPrivateIPv6('2001:4860:4860::8888')).toBe(false);
  });

  it('rejects IPv4-mapped IPv6', () => {
    expect(isPrivateIPv6('::ffff:10.0.0.1')).toBe(true);
  });

  it('rejects URL credentials and malformed URLs', () => {
    expect(validateWebhookUrl('https://user:pass@example.com/').ok).toBe(false);
    expect(validateWebhookUrl('not-a-url').ok).toBe(false);
  });

  it('allows loopback only in explicit test/dev mode', () => {
    expect(validateWebhookUrl('http://localhost/hook', { allowLocal: true }).ok).toBe(true);
  });
});
