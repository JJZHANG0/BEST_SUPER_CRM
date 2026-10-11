import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

export type Db = NodePgDatabase<typeof schema>;
export function connect(databaseUrl: string) {
  // Small pool: the server has 2 GiB RAM and runs two API processes plus PostgreSQL.
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
  return { pool, db: drizzle(pool, { schema }) as Db };
}
export { schema };
