/** Public demo identities only. Replace with server authentication before using real data. */
export const demoAccounts = [
  { role: 'sales', label: '销售顾问', name: 'Alex', email: 'sales@nexus.demo', password: 'NexusSales2026!' },
  { role: 'ops', label: '运营老师', name: '陈老师', email: 'ops@nexus.demo', password: 'NexusOps2026!' },
] as const;
export function authenticateDemo(email: string, password: string) {
  return demoAccounts.find(account => account.email === email.trim().toLowerCase() && account.password === password) ?? null;
}
