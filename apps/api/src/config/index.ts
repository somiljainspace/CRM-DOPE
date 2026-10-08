export interface AppConfig {
  port: number;
  bodyLimitBytes: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  maxBatchSize: number;
  pg: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  clickhouse: {
    url: string;
    username: string;
    password: string;
    database: string;
  };
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    bodyLimitBytes: parseInt(process.env.BODY_LIMIT_BYTES || String(1024 * 1024), 10), // 1MB
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(60 * 1000), 10),
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '500', 10),
    pg: {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5433', 10),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'password',
      database: process.env.PG_DATABASE || 'cdp_crm',
    },
    clickhouse: {
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DB || 'events',
    },
  };
}

export const config = loadConfig();
