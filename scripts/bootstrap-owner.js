#!/usr/bin/env node

const crypto = require('node:crypto');
const argon2 = require('argon2');
const { Pool } = require('pg');

// PostgreSQL UUID values in older local fixtures use valid 8-4-4-4-12
// hexadecimal formatting without RFC 4122 version/variant bits.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function uuid(name, value) {
  if (!UUID_RE.test(value)) throw new Error(`${name} must be a UUID`);
  return value;
}

function createPool() {
  return new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5433),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
    database: process.env.PG_DATABASE || 'cdp_crm',
  });
}

async function main() {
  const tenantId = uuid('BOOTSTRAP_TENANT_ID', required('BOOTSTRAP_TENANT_ID'));
  const workspaceId = uuid('BOOTSTRAP_WORKSPACE_ID', required('BOOTSTRAP_WORKSPACE_ID'));
  const email = required('BOOTSTRAP_EMAIL').trim().toLowerCase();
  const password = required('BOOTSTRAP_PASSWORD');
  const createScope = process.env.BOOTSTRAP_CREATE_SCOPE === 'true';

  if (password.length < 8) throw new Error('BOOTSTRAP_PASSWORD must be at least 8 characters');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('BOOTSTRAP_EMAIL must be a valid email address');
  if (createScope && process.env.CRM_DOPE_DEMO_MODE !== 'true') {
    throw new Error('BOOTSTRAP_CREATE_SCOPE=true requires CRM_DOPE_DEMO_MODE=true');
  }

  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tenant = await client.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
    if (tenant.rows.length === 0) {
      if (!createScope) throw new Error(`Tenant ${tenantId} does not exist; use bootstrap-demo for a local demo scope`);
      await client.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [tenantId, 'CRM-DOPE synthetic demo tenant']);
    }

    const workspace = await client.query('SELECT tenant_id FROM workspaces WHERE id = $1 FOR UPDATE', [workspaceId]);
    if (workspace.rows.length === 0) {
      if (!createScope) throw new Error(`Workspace ${workspaceId} does not exist`);
      await client.query(
        `INSERT INTO workspaces (id, tenant_id, name, slug)
         VALUES ($1, $2, 'CRM-DOPE synthetic demo', 'crm-dope-synthetic-demo')`,
        [workspaceId, tenantId],
      );
    } else if (workspace.rows[0].tenant_id !== tenantId) {
      throw new Error('Workspace does not belong to BOOTSTRAP_TENANT_ID');
    }

    if (createScope) {
      const projectId = uuid('BOOTSTRAP_PROJECT_ID', required('BOOTSTRAP_PROJECT_ID'));
      const environmentId = uuid('BOOTSTRAP_ENVIRONMENT_ID', required('BOOTSTRAP_ENVIRONMENT_ID'));
      await client.query(
        `INSERT INTO projects (id, workspace_id, name, slug)
         VALUES ($1, $2, 'Synthetic Demo Project', 'synthetic-demo')
         ON CONFLICT (id) DO NOTHING`,
        [projectId, workspaceId],
      );
      await client.query(
        `INSERT INTO environments (id, project_id, name, key, type, allowed_origins)
         VALUES ($1, $2, 'Development', 'development', 'development', '{}')
         ON CONFLICT (id) DO NOTHING`,
        [environmentId, projectId],
      );
    }

    const existing = await client.query('SELECT id FROM platform_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) throw new Error(`Platform user ${email} already exists; refusing to replace its password`);

    const existingUser = await client.query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, email]);
    const userId = existingUser.rows[0]?.id || crypto.randomUUID();
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    if (existingUser.rows.length === 0) {
      await client.query('INSERT INTO users (id, tenant_id, email) VALUES ($1, $2, $3)', [userId, tenantId, email]);
    }
    await client.query('INSERT INTO platform_users (id, email, password_hash) VALUES ($1, $2, $3)', [userId, email, passwordHash]);
    await client.query(
      `INSERT INTO user_memberships (user_id, workspace_id, role)
       VALUES ($1, $2, 'OWNER')
       ON CONFLICT (user_id, workspace_id) DO UPDATE SET role = 'OWNER'`,
      [userId, workspaceId],
    );

    await client.query('COMMIT');
    console.log(`Created platform OWNER ${email} for workspace ${workspaceId}.`);
    console.log('The password was hashed with Argon2id and was not printed.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
