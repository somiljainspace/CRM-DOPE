import { clickhouse } from './events';

export interface AnalyticsQueryOptions {
  tenantId: string;
  startDate: string; // ISO8601
  endDate: string; // ISO8601 
  eventName?: string;
}

export async function getEventTrends(opts: AnalyticsQueryOptions, interval: 'hour' | 'day') {
  const timeFormat = interval === 'hour' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d 00:00:00';
  let where = 'tenant_id = {tenantId:UUID} AND timestamp >= parseDateTimeBestEffort({startDate:String}) AND timestamp <= parseDateTimeBestEffort({endDate:String})';
  const params: any = { tenantId: opts.tenantId, startDate: opts.startDate, endDate: opts.endDate };

  if (opts.eventName) {
    where += ' AND event_name = {eventName:String}';
    params.eventName = opts.eventName;
  }

  const query = `
    SELECT 
      formatDateTime(timestamp, '${timeFormat}') as time_bucket,
      count() as event_count
    FROM events.analytics_events FINAL
    WHERE ${where}
    GROUP BY time_bucket
    ORDER BY time_bucket ASC
  `;

  const rows = await clickhouse.query({
    query,
    query_params: params,
    format: 'JSONEachRow'
  });
  return await rows.json();
}

export async function getActiveUsers(opts: AnalyticsQueryOptions, period: 'day' | 'week' | 'month') {
  const where = 'tenant_id = {tenantId:UUID} AND timestamp >= parseDateTimeBestEffort({startDate:String}) AND timestamp <= parseDateTimeBestEffort({endDate:String})';
  const params: any = { tenantId: opts.tenantId, startDate: opts.startDate, endDate: opts.endDate };

  // For weekly, formatDateTime %X-%V can be tricky. Let's use toStartOfWeek / toStartOfMonth / toStartOfDay
  const func = period === 'month' ? 'toStartOfMonth(timestamp)' : (period === 'week' ? 'toStartOfWeek(timestamp, 1)' : 'toStartOfDay(timestamp)');

  const query = `
    SELECT 
      ${func} as time_bucket,
      uniqExact(coalesce(user_id, anonymous_id)) as unique_users
    FROM events.analytics_events FINAL
    WHERE ${where}
    GROUP BY time_bucket
    ORDER BY time_bucket ASC
  `;

  const rows = await clickhouse.query({
    query,
    query_params: params,
    format: 'JSONEachRow'
  });
  return await rows.json();
}

export async function getEventExplorer(opts: AnalyticsQueryOptions, limit: number, offset: number) {
  let where = 'tenant_id = {tenantId:UUID} AND timestamp >= parseDateTimeBestEffort({startDate:String}) AND timestamp <= parseDateTimeBestEffort({endDate:String})';
  const params: any = { tenantId: opts.tenantId, startDate: opts.startDate, endDate: opts.endDate, limit: limit.toString(), offset: offset.toString() };

  if (opts.eventName) {
    where += ' AND event_name = {eventName:String}';
    params.eventName = opts.eventName;
  }

  const query = `
    SELECT event_id, event_type, event_name, timestamp, user_id, anonymous_id, session_id, properties
    FROM events.analytics_events FINAL
    WHERE ${where}
    ORDER BY timestamp DESC, event_id DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `;

  const rows = await clickhouse.query({
    query,
    query_params: params,
    format: 'JSONEachRow'
  });
  return await rows.json();
}

export async function getFunnel(opts: AnalyticsQueryOptions, steps: string[]) {
  if (steps.length < 2 || steps.length > 5) throw new Error('Funnels must have between 2 and 5 steps');
  const where = 'tenant_id = {tenantId:UUID} AND timestamp >= parseDateTimeBestEffort({startDate:String}) AND timestamp <= parseDateTimeBestEffort({endDate:String})';
  
  // We use ClickHouse's sequenceMatch function.
  // We define conditions for each step.
  const conditions = steps.map((s, i) => `event_name = {step${i}:String}`).join(', ');
  
  const params: any = { tenantId: opts.tenantId, startDate: opts.startDate, endDate: opts.endDate };
  steps.forEach((s, i) => params[`step${i}`] = s);

  // We want to count how many users matched sequence exactly length N.
  // Using windowFunnel is easier in ClickHouse.
  const query = `
    SELECT level, count() as count
    FROM (
      SELECT coalesce(user_id, anonymous_id) as u_id,
      windowFunnel(604800)(
        toDateTime(timestamp),
        ${conditions}
      ) as level
      FROM events.analytics_events FINAL
      WHERE ${where}
      GROUP BY u_id
    )
    GROUP BY level
    ORDER BY level ASC
  `;

  const rows = await clickhouse.query({
    query,
    query_params: params,
    format: 'JSONEachRow'
  });
  return await rows.json();
}

export async function getRetention(opts: AnalyticsQueryOptions, entryEvent: string, returningEvent: string) {
  const query = `
    WITH 
      events AS (
         SELECT coalesce(user_id, anonymous_id) as u_id, event_name, toDate(timestamp) as event_date
         FROM events.analytics_events FINAL
         WHERE tenant_id = {tenantId:UUID} 
           AND timestamp >= parseDateTimeBestEffort({startDate:String}) 
           AND timestamp <= parseDateTimeBestEffort({endDate:String})
           AND event_name IN ({entryEvent:String}, {returningEvent:String})
      ),
      cohorts AS (
         SELECT u_id, min(event_date) as start_date
         FROM events
         WHERE event_name = {entryEvent:String}
         GROUP BY u_id
      )
    SELECT
      c.start_date as cohort_date,
      e.event_date - c.start_date as day_offset,
      count(DISTINCT c.u_id) as users_count
    FROM cohorts c
    JOIN events e ON c.u_id = e.u_id
       AND e.event_name = {returningEvent:String}
    WHERE e.event_date >= c.start_date
    GROUP BY cohort_date, day_offset
    ORDER BY cohort_date, day_offset
  `;
  
  const rows = await clickhouse.query({
    query,
    query_params: { tenantId: opts.tenantId, startDate: opts.startDate, endDate: opts.endDate, entryEvent, returningEvent },
    format: 'JSONEachRow'
  });
  return await rows.json();
}
