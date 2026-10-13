#!/usr/bin/env node
/**
 * One-off: soft-disable legacy test accounts 「Alex」 and 「陈老师」
 * (emails sales@nexus.demo / ops@nexus.demo, or exact name match).
 *
 * Does NOT run on deploy. Coordinator should run against prod/staging when ready:
 *   DATABASE_URL=… node scripts/remove-test-accounts.mjs [--dry-run]
 *
 * Prefers `psql` so it works without a local node_modules/pg.
 */
import { spawnSync } from 'node:child_process';

const DRY = process.argv.includes('--dry-run');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required');
  process.exit(2);
}

const sql = `
SELECT id, email, username, name, role, active
FROM users
WHERE lower(email) IN ('sales@nexus.demo', 'ops@nexus.demo')
   OR name IN ('Alex', '陈老师')
ORDER BY email;
`;

const run = (q, label) => {
  const r = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', '-c', q], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(label || 'psql failed:', r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  return (r.stdout || '').trim();
};

const found = run(sql, 'select');
if (!found) {
  console.log('No matching Alex / 陈老师 / demo emails found.');
  process.exit(0);
}
console.log('Matched rows:');
for (const line of found.split('\n')) console.log('  ' + line);

if (DRY) {
  console.log('[dry-run] would set active=false on the rows above');
  process.exit(0);
}

const upd = `
UPDATE users
SET active = false, updated_at = now()
WHERE active = true
  AND (
    lower(email) IN ('sales@nexus.demo', 'ops@nexus.demo')
    OR name IN ('Alex', '陈老师')
  )
RETURNING email, name;
`;
const out = run(upd, 'update');
console.log(out ? `Disabled:\n${out.split('\n').map(l => '  ' + l).join('\n')}` : 'Nothing to disable (already inactive).');
