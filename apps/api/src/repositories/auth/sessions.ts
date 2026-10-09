import { Pool } from 'pg';
import { createHash, randomBytes } from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}
export async function createSession(pg: Pool, userId: string, tokenHash: string, expiresAt: Date, ip?: string, ua?: string): Promise<void> {
  await pg.query('INSERT INTO platform_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5)', [userId, tokenHash, expiresAt, ip || null, ua || null]);
}
export async function findSession(pg: Pool, tokenHash: string): Promise<{ user_id: string; id: string; expires_at: Date; revoked_at: Date | null } | null> {
  const r = await pg.query('SELECT id, user_id, expires_at, revoked_at FROM platform_sessions WHERE token_hash = $1', [tokenHash]);
  if (r.rows.length === 0) return null;
  const s = r.rows[0];
  return { id: s.id, user_id: s.user_id, expires_at: s.expires_at, revoked_at: s.revoked_at };
}
export async function revokeSession(pg: Pool, tokenHash: string): Promise<void> {
  await pg.query('UPDATE platform_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [tokenHash]);
}
