import { bucketTimestamp, computeFunnel, buildRetentionMatrix, normalizeIdentity, clampPagination, pct } from '../../services/analytics';

describe('Analytics Calculations', () => {
  it('buckets timestamps correctly', () => {
    expect(bucketTimestamp('2026-10-10T14:45:00Z', 'hour')).toBe('2026-10-10 14:00:00');
    expect(bucketTimestamp('2026-10-10T14:45:00Z', 'day')).toBe('2026-10-10 00:00:00');
    expect(() => bucketTimestamp('invalid', 'day')).toThrow();
  });

  it('computes funnels', () => {
    const raw = [100, 60, 15]; // step 1=100, step 2=60, step 3=15
    const res = computeFunnel(raw);
    expect(res.length).toBe(3);
    
    // Step 1
    expect(res[0].users).toBe(100);
    expect(res[0].convertedToNext).toBe(60);
    expect(res[0].conversionRate).toBe(0.6);
    expect(res[0].dropOff).toBe(40);
    expect(res[0].dropOffRate).toBe(0.4);

    // Step 2
    expect(res[1].users).toBe(60);
    expect(res[1].convertedToNext).toBe(15);
    expect(res[1].conversionRate).toBe(0.25);
    
    // Step 3
    expect(res[2].convertedToNext).toBeNull();
  });

  it('requires at least 2 steps for funnels', () => {
    expect(() => computeFunnel([100])).toThrow();
  });

  it('builds a retention matrix', () => {
    const rows = [
      { cohort_date: '2026-10-01', day_offset: '0', users_count: '100' },
      { cohort_date: '2026-10-01', day_offset: '1', users_count: '40' },
      { cohort_date: '2026-10-01', day_offset: '7', users_count: '20' },
    ];
    const res = buildRetentionMatrix(rows);
    expect(res.length).toBe(1);
    expect(res[0].cohort).toBe('2026-10-01');
    expect(res[0].size).toBe(100);
    expect(res[0].retention['day_1']).toBe(0.4);
    expect(res[0].retention['day_7']).toBe(0.2);
    expect(res[0].retention['day_0']).toBe(1);
  });

  it('normalizes identity', () => {
    expect(normalizeIdentity('user-1', null)).toBe('user:user-1');
    expect(normalizeIdentity('user-1', 'anon-2')).toBe('user:user-1');
    expect(normalizeIdentity(null, 'anon-2')).toBe('anon:anon-2');
    expect(normalizeIdentity(null, null)).toBeNull();
  });

  it('clamps pagination', () => {
    expect(clampPagination(-5, -10)).toEqual({ limit: 1, offset: 0 });
    expect(clampPagination(500, 10)).toEqual({ limit: 100, offset: 10 });
    expect(clampPagination(NaN, NaN)).toEqual({ limit: 25, offset: 0 });
  });

  it('formats percentages properly', () => {
    expect(pct(0.123456)).toBe(12.35);
    expect(pct(0)).toBe(0);
    expect(pct(null)).toBeNull();
  });
});
