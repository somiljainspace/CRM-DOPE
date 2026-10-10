// Pure analytics calculation helpers — unit-testable without network/db.
// Queries live in repositories/analytics.ts; calculations live here.

export type Interval = 'hour' | 'day';
export type Period = 'day' | 'week' | 'month';

/**
 * Bucket a UTC ISO timestamp into the requested interval bucket label.
 * Always operates in UTC. Returns a label like "2026-10-10 00:00:00" (day)
 * or "2026-10-10 05:00:00" (hour).
 */
export function bucketTimestamp(isoUtc: string, interval: Interval): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (interval === 'hour') {
    const h = String(d.getUTCHours()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:00:00`;
  }
  return `${y}-${m}-${day} 00:00:00`;
}

/**
 * Compute funnel conversion metrics from per-step entry counts.
 * counts[i] = number of distinct users who reached step i (ordered).
 * Returns per-step users, conversion to next, drop-off count and rate.
 */
export function computeFunnel(counts: number[]): Array<{
  step: number;
  users: number;
  convertedToNext: number | null;
  conversionRate: number | null;
  dropOff: number | null;
  dropOffRate: number | null;
}> {
  if (counts.length < 2) throw new Error('Funnels require at least 2 steps');
  return counts.map((users, i) => {
    if (i === counts.length - 1) {
      return { step: i + 1, users, convertedToNext: null, conversionRate: null, dropOff: null, dropOffRate: null };
    }
    const next = counts[i + 1];
    const convertedToNext = Math.max(0, Math.min(users, next));
    const dropOff = users - convertedToNext;
    return {
      step: i + 1,
      users,
      convertedToNext,
      conversionRate: users > 0 ? convertedToNext / users : 0,
      dropOff,
      dropOffRate: users > 0 ? dropOff / users : 0,
    };
  });
}

/**
 * Build a daily retention matrix from (cohortDate, dayOffset) -> user count rows.
 * Returns cohorts with day 0 = entry size and retention percentages per offset.
 */
export function buildRetentionMatrix(
  rows: Array<{ cohort_date: string; day_offset: string; users_count: string }>,
): Array<{ cohort: string; size: number; retention: Record<string, number> }> {
  const byCohort = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const off = parseInt(r.day_offset, 10);
    if (!byCohort.has(r.cohort_date)) byCohort.set(r.cohort_date, new Map());
    byCohort.get(r.cohort_date)!.set(off, parseInt(r.users_count, 10));
  }
  const result: Array<{ cohort: string; size: number; retention: Record<string, number> }> = [];
  for (const [cohort, offsets] of byCohort) {
    const size = offsets.get(0) ?? 0;
    const retention: Record<string, number> = {};
    for (const [off, count] of offsets) {
      retention[`day_${off}`] = size > 0 ? count / size : 0;
    }
    retention['size'] = size;
    result.push({ cohort, size, retention });
  }
  return result;
}

/**
 * Normalize an identity for analytics counting.
 * Prefers the identified user_id; falls back to anonymous_id.
 * Returns null when neither is present (event cannot be attributed to a person).
 */
export function normalizeIdentity(user_id: string | null | undefined, anonymous_id: string | null | undefined): string | null {
  if (user_id) return `user:${user_id}`;
  if (anonymous_id) return `anon:${anonymous_id}`;
  return null;
}

/** Clamp pagination params to safe bounds. */
export function clampPagination(limit: number, offset: number, maxLimit = 100): { limit: number; offset: number } {
  const l = Math.min(Math.max(parseInt(String(limit), 10) || 25, 1), maxLimit);
  const o = Math.max(parseInt(String(offset), 10) || 0, 0);
  return { limit: l, offset: o };
}

/** Convert a percentage (0..1) to a rounded number for display. */
export function pct(rate: number | null): number | null {
  if (rate === null) return null;
  return Math.round(rate * 10000) / 100;
}
