/**
 * Date-range helpers shared by dashboard filters.
 * All API dates are UTC (YYYY-MM-DD). The dashboard sends UTC
 * ranges and labels chart axes with the timezone it queried.
 */

export type RangeKey = 'today' | '7d' | '14d' | '30d' | '90d';

export const RANGE_DAYS: Record<RangeKey, number> = {
  today: 0,
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

export function toUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateRange(key: RangeKey): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  if (key === 'today') {
    // Same-day range: start and end are today.
    return { startDate: toUtcDate(start), endDate: toUtcDate(end) };
  }
  start.setUTCDate(start.getUTCDate() - (RANGE_DAYS[key] - 1));
  return { startDate: toUtcDate(start), endDate: toUtcDate(end) };
}

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

/**
 * Format a UTC bucket label for charts/tables. Buckets from the API
 * are either YYYY-MM-DD or YYYY-MM-DDTHH:00:00Z (hourly).
 */
export function formatBucket(bucket: string, interval: 'hour' | 'day'): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  const time = d.toISOString().slice(11, 16);
  const date = d.toISOString().slice(0, 10);
  return interval === 'hour' ? `${date} ${time} UTC` : date;
}
