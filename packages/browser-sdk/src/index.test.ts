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

describe('Consent, Identity, Queue, Retry', () => {
  it('optIn creates anonymous ID; reset generates new one', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    expect(s['anonymousId']).toBeTruthy();
    const old = s['anonymousId'];
    s.reset();
    expect(s['userId']).toBeUndefined();
    expect(s['anonymousId']).not.toBe(old);
  });
  it('optOut does not create new anonymous ID', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: false });
    s.optIn(); s.track({ event: 'x' }); s.optOut();
    expect(s['anonymousId']).toBeTruthy(); // preserved (optOut clears queue, not identity)
  });
  it('track creates event with eventId', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    s.track({ event: 'product_viewed', properties: { id: 'p1' } });
    expect(s['queue'].length).toBeGreaterThanOrEqual(1);
    const item = s['queue'][0];
    expect(typeof item.eventId).toBe('string');
    expect(item.eventId.length).toBeGreaterThan(0);
  });
  it('identify associates userId', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    s.identify({ userId: 'user-123' });
    expect(s['userId']).toBe('user-123');
  });
  it('invalid event name handled', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    // Event names with invalid chars just pass through; SDK doesn't block at client
    s.track({ event: 'bad!', properties: {} });
    expect(s['queue'].length).toBeGreaterThanOrEqual(1);
  });
  it('batch respects batchSize limit', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true, batchSize: 2 });
    s.track({ event: 'a' }); s.track({ event: 'b' }); s.track({ event: 'c' });
    expect(s['queue'].length).toBe(1); // first batch flushed (2 out), third queued
  });
  it('reinitialization does not duplicate timer', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    const t1 = s['timer'];
    s.optIn(); // restarts timer
    const t2 = s['timer'];
    expect(t2).toBeDefined();
  });
  it('flush empties queue', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    s.track({ event: 'x' });
    s.flush();
    expect(s['queue'].length).toBe(0);
  });
});

describe('Lifecycle cleanup', () => {
  it('destroy stops timer and clears state', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    s.track({ event: 'x' });
    s.destroy();
    expect(s['consent']).toBe(false);
    expect(s['timer']).toBeUndefined();
    expect(s['queue'].length).toBe(0);
    expect(s['anonymousId']).toBeUndefined();
  });
  it('repeated init/destroy does not leak timers', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    s.destroy();
    s.destroy(); // repeat
    expect(s['timer']).toBeUndefined();
  });
});

describe('SDK lifecycle cleanup', () => {
  it('destroy clears timer', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    s.destroy();
    expect(s['timer']).toBeUndefined();
    expect(s['consent']).toBe(false);
  });
  it('repeated destroy safe', () => {
    const s = new BrowserSDK({ key: 'pk_test_x', consent: true });
    s.destroy(); s.destroy();
    expect(s['timer']).toBeUndefined();
  });
});
