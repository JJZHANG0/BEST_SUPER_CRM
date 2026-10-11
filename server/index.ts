/**
 * API entry point, bundled to server-dist/index.mjs by `npm run build:server`.
 *   node index.mjs            start the HTTP API (HOST/PORT from env)
 *   node index.mjs migrate    apply SQL migrations from ./drizzle next to the bundle (or MIGRATIONS_DIR)
 *   node index.mjs seed       insert reference data + staff accounts if missing (idempotent, never overwrites)
 *   node index.mjs purge-demo delete the fictional demo records left by older builds (explicit, one-off)
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from './config';
import { connect } from './db';
import { createApp } from './app';
import { seed, purgeDemo } from './seed';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = process.env.MIGRATIONS_DIR || [join(here, 'drizzle'), join(here, '..', 'drizzle')].find(p => existsSync(join(p, 'meta', '_journal.json'))) || join(here, 'drizzle');

async function main() {
  const config = loadConfig();
  const { db, pool } = connect(config.databaseUrl);
  const command = process.argv[2] || 'serve';
  if (command === 'migrate') { await migrate(db, { migrationsFolder }); console.log('migrate: done'); await pool.end(); return; }
  if (command === 'seed') { await seed(db); await pool.end(); return; }
  if (command === 'purge-demo') { await purgeDemo(db); await pool.end(); return; }
  if (command !== 'serve') throw new Error(`Unknown command: ${command}`);
  const app = createApp(db, config);
  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, info => console.log(`nexus-api (${config.env}) listening on http://${info.address}:${info.port}`));
  const stop = () => { server.close(); pool.end().finally(() => process.exit(0)); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
main().catch(err => { console.error(err); process.exit(1); });
