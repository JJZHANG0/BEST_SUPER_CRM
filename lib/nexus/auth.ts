/**
 * Sign-in for the static demo / GitHub Pages build (no NEXT_PUBLIC_API_BASE).
 * The API build verifies passwords on the server (server/password.ts) and never uses this file.
 *
 * Pages-only limitation: the static site has no server, so the account list ships in the client
 * bundle. Staff passwords are NOT included — only salted PBKDF2-SHA256 hashes (120k iterations) of
 * random 16-character initial passwords. Password changes, new users, role changes and disabled
 * accounts made on the Pages preview are stored in that browser's localStorage only.
 * Runtime-import free so tests/auth.mjs can load it directly.
 */
import type { Role } from './roles';

export type DirectoryUser = { email: string; name: string; role: Role; salesName: string | null; active: boolean; mustChange: boolean; builtIn: boolean };
type StaffAccount = { name: string; email: string; role: Role; salt: string; hash: string };
/** Per-browser changes made through 系统管理 / 修改密码 on the Pages preview. */
export type UserOverride = { name?: string; role?: Role; active?: boolean; salt?: string; hash?: string; mustChange?: boolean; created?: boolean; salesName?: string | null };
export type Overrides = Record<string, UserOverride>;

/** Public sales demo account (intentionally advertised on the login page). */
export const salesDemo = { role: 'sales' as Role, label: '销售顾问', name: 'Alex', email: 'sales@nexus.demo', password: 'NexusSales2026!', salesName: '顾问 Alex' };
/** Kept for the login page's "fill demo account" button. */
export const demoAccounts = [salesDemo] as const;

/** 运营部老师. Initial passwords are delivered out of band and must be changed on first sign-in. */
export const staffAccounts: readonly StaffAccount[] = [
  { name: '张捷嘉', email: 'zhangjiejia@nexus.local', role: 'superadmin', salt: 'bc355382768dcfbfe486ad56141c989f', hash: '15bbde64841f9b813b5f292f95627a72023759d42b3da899a8dc90a0d4c579bf' },
  { name: '程雪晴', email: 'chengxueqing@nexus.local', role: 'superadmin', salt: 'b80d15780bd91e1b78c97de5d329a9f0', hash: '340e37e90f88182c420733e8daddab75152339e4a44b1b957db415bfaca4d971' },
  { name: '张雪航', email: 'zhangxuehang@nexus.local', role: 'superadmin', salt: 'da11a3d08cd179b9e0c3693705238d63', hash: '4466ab71f1afca1d31b2378d478082ee6904f9ecb083306304ab6b196fba6030' },
  { name: '许瑾', email: 'xujin@nexus.local', role: 'ops', salt: 'ba918c0135e170b6e2438d7b496d5468', hash: 'b3f9323a95189bdac4ed6ed2a6024f8772637636887cd5e096bdbf382485455b' },
  { name: '方彦淇', email: 'fangyanqi@nexus.local', role: 'ops', salt: '27f4d48997feff07dda12357def67a5e', hash: 'e78d8604ae8825cae0debc2ca1515d334a1203d72e975484adef00571d8281aa' },
];
export const PBKDF2_ITERATIONS = 120_000;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array((h.match(/../g) || []).map(b => parseInt(b, 16)));
export async function pbkdf2Hex(password: string, saltHex: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('crypto_unavailable');
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256));
}
export async function makeHash(password: string) {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const saltHex = hex(salt.buffer);
  return { salt: saltHex, hash: await pbkdf2Hex(password, saltHex) };
}
/** Random password without look-alike characters; always has upper, lower, digit and symbol. */
export function randomPassword(length = 16) {
  const all = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';
  for (;;) {
    const bytes = new Uint32Array(length);
    globalThis.crypto.getRandomValues(bytes);
    const pw = [...bytes].map(b => all[b % all.length]).join('');
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) return pw;
  }
}
const norm = (email: string) => email.trim().toLowerCase();
/** Built-in accounts merged with this browser's overrides. */
export function directory(overrides: Overrides = {}): DirectoryUser[] {
  const base: DirectoryUser[] = [
    ...staffAccounts.map(a => ({ email: a.email, name: a.name, role: a.role, salesName: null, active: true, mustChange: true, builtIn: true })),
    { email: salesDemo.email, name: salesDemo.name, role: salesDemo.role, salesName: salesDemo.salesName, active: true, mustChange: false, builtIn: true },
  ];
  const out = base.map(u => { const o = overrides[u.email]; return o ? { ...u, ...pick(o) } : u; });
  for (const [email, o] of Object.entries(overrides)) if (o.created && !out.some(u => u.email === email) && o.role) {
    out.push({ email, name: o.name || email, role: o.role, salesName: o.salesName ?? null, active: o.active ?? true, mustChange: o.mustChange ?? true, builtIn: false });
  }
  return out;
}
function pick(o: UserOverride) {
  const r: Partial<DirectoryUser> = {};
  if (o.name) r.name = o.name;
  if (o.role) r.role = o.role;
  if (typeof o.active === 'boolean') r.active = o.active;
  if (typeof o.mustChange === 'boolean') r.mustChange = o.mustChange;
  if (o.salesName !== undefined) r.salesName = o.salesName;
  return r;
}
/** Resolves to the signed-in user, or null for unknown / disabled accounts and wrong passwords. */
export async function authenticateDemo(email: string, password: string, overrides: Overrides = {}): Promise<DirectoryUser | null> {
  const key = norm(email);
  const user = directory(overrides).find(u => u.email === key);
  if (!user || !user.active || !password) return null;
  const o = overrides[key];
  if (o?.hash && o.salt) return (await pbkdf2Hex(password, o.salt)) === o.hash ? user : null;
  if (key === salesDemo.email) return password === salesDemo.password ? user : null;
  const staff = staffAccounts.find(a => a.email === key);
  if (!staff) return null;
  return (await pbkdf2Hex(password, staff.salt)) === staff.hash ? user : null;
}
