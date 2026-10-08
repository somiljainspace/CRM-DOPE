import { Pool } from 'pg';
import { createHash } from 'crypto';
import { config } from '../config';

export const pgPool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pg.user,
  password: config.pg.password,
  database: config.pg.database,
});

// Hash an API key for safe storage and comparison
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export interface ApiKeyRecord {
  tenant_id: string;
}

export async function getApiKeyRecord(apiKey: string): Promise<ApiKeyRecord | null> {
  const hash = hashApiKey(apiKey);
  const result = await pgPool.query(
    'SELECT tenant_id FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
    [hash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return { tenant_id: result.rows[0].tenant_id };
}
