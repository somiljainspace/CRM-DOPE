// Retry policy unit tests (pure functions)
import { computeRetryAfter, isRetryable, isPermanent, MAX_ATTEMPTS, BASE_DELAY_MS, MAX_DELAY_MS } from '../../../services/activation/retry';

describe('Retry policy', () => {
  it('returns a valid finite Date for first attempt', () => {
    const d = computeRetryAfter(1);
    expect(d).toBeInstanceOf(Date);
    expect(Number.isFinite(d.getTime())).toBe(true);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });

  it('exponential backoff grows with attempt number', () => {
    const a1 = computeRetryAfter(1);
    const a3 = computeRetryAfter(3);
    expect(a3.getTime()).toBeGreaterThan(a1.getTime());
  });

  it('caps delay at MAX_DELAY_MS', () => {
    const d = computeRetryAfter(20); // beyond max attempts
    expect(d.getTime()).toBe(0); // terminal marker
  });

  it('returns terminal marker at MAX_ATTEMPTS', () => {
    const d = computeRetryAfter(MAX_ATTEMPTS);
    expect(d.getTime()).toBe(0);
  });

  it('respects Retry-After header (bounded)', () => {
    const d = computeRetryAfter(1, '60');
    expect(d.getTime()).toBeGreaterThan(Date.now());
    expect(d.getTime() - Date.now()).toBeLessThanOrEqual(MAX_DELAY_MS);
  });

  it('classifies 5xx as retryable', () => {
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
  });

  it('classifies 408/425/429 as retryable', () => {
    expect(isRetryable(408)).toBe(true);
    expect(isRetryable(425)).toBe(true);
    expect(isRetryable(429)).toBe(true);
  });

  it('classifies other 4xx as permanent', () => {
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(404)).toBe(false);
    expect(isPermanent(400)).toBe(true);
    expect(isPermanent(404)).toBe(true);
  });

  it('classifies network errors (null) as retryable', () => {
    expect(isRetryable(null)).toBe(true);
    expect(isPermanent(null)).toBe(false);
  });

  it('documents the bounded policy constants', () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(BASE_DELAY_MS).toBe(2000);
    expect(MAX_DELAY_MS).toBe(3600000);
  });
});
