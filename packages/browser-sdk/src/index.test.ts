import { BrowserSDK, init } from './index';
describe('BrowserSDK', () => {
  it('rejects secret sk_ key', () => { expect(() => new BrowserSDK({ key: 'sk_secret', consent: true })).toThrow(); });
  it('accepts pk_ key', () => { const s = new BrowserSDK({ key: 'pk_test_abc', consent: true }); expect(s).toBeDefined(); });
  it('defaults consent off', () => { const s = new BrowserSDK({ key: 'pk_test_x', consent: false }); expect(s).toBeDefined(); });
  it('optIn enables tracking', () => { const s = new BrowserSDK({ key: 'pk_test_x', consent: false }); s.optIn(); expect(s['consent']).toBe(true); });
  it('optOut clears queue', () => { const s = new BrowserSDK({ key: 'pk_test_x', consent: true }); s.track({ event: 'x' }); s.optOut(); expect(s['queue'].length).toBe(0); });
  it('identify sets userId', () => { const s = new BrowserSDK({ key: 'pk_test_x', consent: true }); s.identify({ userId: 'u1' }); expect(s['userId']).toBe('u1'); });
  it('reset clears userId', () => { const s = new BrowserSDK({ key: 'pk_test_x', consent: true }); s.identify({ userId: 'u1' }); s.reset(); expect(s['userId']).toBeUndefined(); });
  it('track requires consent', () => { const s = new BrowserSDK({ key: 'pk_test_x', consent: false }); s.track({ event: 'x' }); expect(s['queue'].length).toBe(0); });
});
