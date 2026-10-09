import { Pool } from 'pg';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

export type Role = 'OWNER' | 'ADMIN' | 'ANALYST' | 'DEVELOPER' | 'VIEWER';

const permissions: Record<string, Role[]> = {
  'workspace:read': ['OWNER', 'ADMIN', 'ANALYST', 'DEVELOPER', 'VIEWER'],
  'workspace:write': ['OWNER', 'ADMIN'],
  'project:read': ['OWNER', 'ADMIN', 'ANALYST', 'DEVELOPER', 'VIEWER'],
  'project:write': ['OWNER', 'ADMIN'],
  'environment:read': ['OWNER', 'ADMIN', 'ANALYST', 'DEVELOPER', 'VIEWER'],
  'environment:write': ['OWNER', 'ADMIN'],
  'apikey:read': ['OWNER', 'ADMIN', 'DEVELOPER'],
  'apikey:write': ['OWNER', 'ADMIN'],
  'member:read': ['OWNER', 'ADMIN'],
  'member:write': ['OWNER', 'ADMIN'],
  'invitation:read': ['OWNER', 'ADMIN'],
  'invitation:write': ['OWNER', 'ADMIN'],
  'role:change': ['OWNER'],
  'tenant:read': ['OWNER', 'ADMIN'],
  'tenant:write': ['OWNER'],
};

export async function getMembership(userId: string, workspaceId: string): Promise<{ role: Role } | null> {
  const r = await pg.query('SELECT role FROM user_memberships WHERE user_id = $1 AND workspace_id = $2', [userId, workspaceId]);
  return r.rows.length ? { role: r.rows[0].role as Role } : null;
}

export function can(role: Role, permission: string): boolean {
  const allowed = permissions[permission] || [];
  return allowed.includes(role);
}

export async function requirePermission(userId: string, workspaceId: string, permission: string): Promise<Role> {
  const membership = await getMembership(userId, workspaceId);
  if (!membership) throw new Error('Not a member of this workspace');
  if (!can(membership.role, permission)) throw new Error('Insufficient permissions');
  return membership.role;
}
