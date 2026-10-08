import { AnalyticsEvent } from '@cdp/event-schema';

export function enforceTenantOwnership(
  tenantId: string,
  event: AnalyticsEvent
): void {
  // Never trust client-supplied tenant identity for authorization.
  // The authenticated API key determines the tenant.
  if (event.tenantId !== tenantId) {
    throw new TenantMismatchError(
      'Tenant mismatch. The API key does not match the event tenantId.'
    );
  }
}

export class TenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantMismatchError';
  }
}

export function validateEventBatch(
  tenantId: string,
  events: AnalyticsEvent[],
  maxBatchSize: number
): void {
  if (events.length > maxBatchSize) {
    throw new BatchTooLargeError(
      `Batch size exceeds the maximum allowed size of ${maxBatchSize}.`
    );
  }

  for (const event of events) {
    enforceTenantOwnership(tenantId, event);
  }
}

export class BatchTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchTooLargeError';
  }
}
