import { AnalyticsEventSchema } from '../index';

describe('EventSchema', () => {
  it('validates a correct track event', () => {
    const validTrack = {
      eventId: '123e4567-e89b-12d3-a456-426614174000',
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: new Date().toISOString(),
      type: 'track',
      event: 'User Signed Up',
      properties: { plan: 'pro' },
    };

    const result = AnalyticsEventSchema.safeParse(validTrack);
    expect(result.success).toBe(true);
  });

  it('fails if tenantId is missing', () => {
    const invalidTrack = {
      eventId: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: new Date().toISOString(),
      type: 'track',
      event: 'User Signed Up',
    };

    const result = AnalyticsEventSchema.safeParse(invalidTrack);
    expect(result.success).toBe(false);
  });

  it('fails if eventId is missing', () => {
    const invalidTrack = {
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      timestamp: new Date().toISOString(),
      type: 'track',
      event: 'User Signed Up',
    };

    const result = AnalyticsEventSchema.safeParse(invalidTrack);
    expect(result.success).toBe(false);
  });
});
