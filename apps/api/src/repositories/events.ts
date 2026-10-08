import { createClient } from '@clickhouse/client';
import { AnalyticsEvent } from '@cdp/event-schema';
import { config } from '../config';

export const clickhouse = createClient({
  url: config.clickhouse.url,
  username: config.clickhouse.username,
  password: config.clickhouse.password,
  database: config.clickhouse.database,
});

export interface ClickHouseEventRow {
  tenant_id: string;
  event_id: string;
  event_type: string;
  event_name: string;
  timestamp: string;
  user_id: string | null;
  anonymous_id: string | null;
  properties: string;
  context: string;
}

export function toClickHouseRow(event: AnalyticsEvent): ClickHouseEventRow {
  let eventName = 'unknown';
  let propertiesObj: Record<string, unknown> = { ...(event.properties || {}) };

  if (event.type === 'track') {
    eventName = event.event;
  } else if (event.type === 'page') {
    eventName = event.name || 'page';
    if (event.name) {
      propertiesObj = { ...propertiesObj, name: event.name };
    }
  } else if (event.type === 'identify') {
    eventName = 'identify';
    if ('traits' in event && event.traits) {
      propertiesObj = { ...propertiesObj, ...event.traits };
    }
  }

  return {
    tenant_id: event.tenantId,
    event_id: event.eventId,
    event_type: event.type,
    event_name: eventName,
    timestamp: new Date(event.timestamp).toISOString().replace('T', ' ').replace('Z', ''),
    user_id: event.userId || null,
    anonymous_id: event.anonymousId || null,
    properties: JSON.stringify(propertiesObj),
    context: JSON.stringify(event.context || {}),
  };
}

export async function checkEventExists(tenantId: string, eventId: string): Promise<boolean> {
  try {
    const result = await clickhouse.query({
      query: 'SELECT count() as c FROM analytics_events WHERE tenant_id = {tenantId: UUID} AND event_id = {eventId: UUID}',
      query_params: { tenantId, eventId },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    return (rows[0] as { c: string }).c !== '0';
  } catch {
    return false;
  }
}

export async function insertEvents(events: AnalyticsEvent[]): Promise<void> {
  if (events.length === 0) return;

  const rows = events.map(toClickHouseRow);

  const body = rows.map(r => JSON.stringify(r)).join('\n');
  const url = config.clickhouse.url + '/?query=INSERT+INTO+events.analytics_events+FORMAT+JSONEachRow';
  const res = await fetch(url, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'text/plain',
      'Authorization': 'Basic ' + Buffer.from(config.clickhouse.username + ':' + (config.clickhouse.password || '')).toString('base64'),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ClickHouse insert failed (${res.status}): ${text}`);
  }
}
