import { z } from 'zod';
import { randomUUID } from 'crypto';

export interface BrowserSDKConfig {
  key: string;
  endpoint?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  consent?: boolean;
}

export interface TrackPayload { event: string; properties?: Record<string, unknown>; }
export interface IdentifyPayload { userId: string; traits?: Record<string, unknown>; }

const ConfigSchema = z.object({
  key: z.string().min(8).refine(k => k.startsWith('pk_'), { message: 'Browser SDK requires publishable pk_ key' }),
  endpoint: z.string().optional(),
  batchSize: z.number().int().positive().max(50).optional().default(10),
  flushIntervalMs: z.number().int().positive().optional().default(5000),
  consent: z.boolean().optional().default(false),
});

export class BrowserSDK {
  private config: z.infer<typeof ConfigSchema>;
  private queue: Array<{ eventId: string; payload: TrackPayload | IdentifyPayload }> = [];
  private anonymousId?: string;
  private userId?: string;
  private timer?: ReturnType<typeof setInterval>;
  private consent: boolean;

  constructor(cfg: BrowserSDKConfig) {
    const parsed = ConfigSchema.parse(cfg);
    this.config = parsed;
    this.consent = parsed.consent ?? false;
    if (this.consent) this.initAnonymous();
    this.startFlush();
  }

  initAnonymous() {
    if (!this.anonymousId && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      this.anonymousId = crypto.randomUUID();
    }
  }

  optIn() { this.consent = true; if (!this.anonymousId) this.initAnonymous(); this.startFlush(); }
  optOut() { this.consent = false; this.queue = []; if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  identify(payload: IdentifyPayload) {
    if (!this.consent) return;
    this.userId = payload.userId;
    this.queue.push({ eventId: randomUUID(), payload });
  }

  reset() { this.userId = undefined; this.anonymousId = undefined; this.initAnonymous(); }

  track(payload: TrackPayload) {
    if (!this.consent) return;
    this.queue.push({ eventId: randomUUID(), payload });
    if (this.queue.length >= this.config.batchSize) this.flush();
  }

  flush() {
    if (!this.consent || this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.config.batchSize);
    const body = JSON.stringify({ batch: batch.map(b => ({
      eventId: b.eventId,
      timestamp: new Date().toISOString(),
      type: 'track',
      event: (b.payload as TrackPayload).event,
      properties: (b.payload as TrackPayload).properties || {},
      anonymousId: this.anonymousId,
      userId: this.userId,
    })) });
    fetch(this.config.endpoint || 'http://localhost:3000/v1/track/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.config.key },
      body,
      keepalive: true,
    }).catch(() => { /* observable via return value */ });
  }

  private startFlush() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }
}

export function init(cfg: BrowserSDKConfig): BrowserSDK { return new BrowserSDK(cfg); }
