import { z } from 'zod';

export const EventIdentitySchema = z.object({
  tenantId: z.string().uuid().describe("All customer data must be tenant-scoped"),
  userId: z.string().optional(),
  anonymousId: z.string().optional(),
});

export const BaseEventSchema = EventIdentitySchema.extend({
  eventId: z.string().uuid().describe("Event IDs must support idempotency"),
  timestamp: z.string().datetime(),
  event: z.string(),
  properties: z.record(z.any()).default({}),
  sessionId: z.string().optional().describe("Browser session identifier; derived server-side or provided by SDK"),
  context: z.object({
    userAgent: z.string().optional(),
    ip: z.string().optional(),
    library: z.object({
      name: z.string(),
      version: z.string(),
    }).optional(),
  }).optional(),
});

// Specific event types (Page, Track, Identify)
export const TrackEventSchema = BaseEventSchema.extend({
  type: z.literal('track'),
  event: z.string(),
});

export const IdentifyEventSchema = BaseEventSchema.extend({
  type: z.literal('identify'),
  traits: z.record(z.any()).default({}),
});

export const PageEventSchema = BaseEventSchema.extend({
  type: z.literal('page'),
  name: z.string().optional(),
});

export const AnalyticsEventSchema = z.discriminatedUnion('type', [
  TrackEventSchema,
  IdentifyEventSchema,
  PageEventSchema,
]);

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export type TrackEvent = z.infer<typeof TrackEventSchema>;
export type IdentifyEvent = z.infer<typeof IdentifyEventSchema>;
export type PageEvent = z.infer<typeof PageEventSchema>;
