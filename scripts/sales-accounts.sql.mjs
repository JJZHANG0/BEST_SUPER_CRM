// Emit SQL that upserts the 销售老师 roster (scripts/sales-roster.json) with a shared initial password.
//   SALES_PASSWORD='…' npx tsx scripts/sales-accounts.sql.mjs > /tmp/sales.sql   (then psql -d nexus_<env> -f)
// Existing emails/usernames are updated (name, role, region, lead, theme) and keep their password.
import { readFileSync } from 'node:fs';
import { hashPassword } from '../server/password.ts';
const pw = process.env.SALES_PASSWORD; if (!pw) { console.error('SALES_PASSWORD required'); process.exit(2); }
const roster = JSON.parse(readFileSync(new URL('./sales-roster.json', import.meta.url), 'utf8'));
const q = v => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const out = ['BEGIN;'];
for (const r of roster) {
  const name = r.en ? `${r.username} ${r.en}` : r.username, salesName = `顾问 ${r.username}`;
  const set = `name=${q(name)}, role='sales', sales_name=coalesce(users.sales_name, ${q(salesName)}), theme='ice', sales_region=${q(r.region)}, sales_lead=${r.lead}, active=true, updated_at=now()`;
  out.push(`UPDATE users SET ${set} WHERE lower(username)=lower(${q(r.username)}) AND email<>${q(r.email)};`);
  out.push(`INSERT INTO users (email, username, name, role, sales_name, password_hash, must_change_password, theme, sales_region, sales_lead) SELECT ${q(r.email)}, ${q(r.username)}, ${q(name)}, 'sales', ${q(salesName)}, ${q(await hashPassword(pw))}, true, 'ice', ${q(r.region)}, ${r.lead} WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(username)=lower(${q(r.username)}) AND email<>${q(r.email)}) ON CONFLICT (email) DO UPDATE SET ${set};`);
}
out.push('COMMIT;'); console.log(out.join('\n'));
