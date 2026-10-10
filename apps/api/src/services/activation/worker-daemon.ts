import { Pool } from 'pg';
import crypto from 'crypto';
import { runWorker } from './worker';

let isShuttingDown = false;
let runningTimeout: NodeJS.Timeout | null = null;
let currentPromise: Promise<void> | null = null;
let pg: Pool | null = null;

export async function stopDaemon() {
  isShuttingDown = true;
  if (runningTimeout) clearTimeout(runningTimeout);
  if (currentPromise) {
    console.log('Waiting for current worker run to finish...');
    await currentPromise;
  }
  if (pg) {
    await pg.end().catch(() => {});
  }
}

export function startDaemon() {
  pg = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5433', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
    database: process.env.PG_DATABASE || 'cdp_crm'
  });
  
  const workerId = crypto.randomUUID();
  console.log(`Starting delivery worker daemon (ID: ${workerId})...`);

  const loop = async () => {
    if (isShuttingDown) return;
    
    try {
      currentPromise = runWorker(pg!, workerId);
      await currentPromise;
    } catch (e: any) {
      console.error('Worker loop error:', e.message);
    } finally {
      currentPromise = null;
    }

    if (!isShuttingDown) {
      runningTimeout = setTimeout(loop, 2000);
    }
  };

  loop();

  process.on('SIGINT', stopDaemon);
  process.on('SIGTERM', stopDaemon);
}

if (require.main === module) {
  startDaemon();
}
