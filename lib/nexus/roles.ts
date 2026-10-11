/**
 * Role model. Kept free of runtime imports so tests and the API server can load it directly.
 *   sales      — read-only sales workspace (own students only)
 *   ops        — 项目运营老师: edits operations data, logs own 课时 / 课情反馈
 *   superadmin — everything ops can do, plus 系统管理 (users, 项目, 课程, 班型与津贴) and all teachers' records
 *   admin      — legacy role, treated like ops for writes (kept for existing databases)
 */
export type Role = 'ops' | 'sales' | 'admin' | 'superadmin';
export const roles: readonly Role[] = ['superadmin', 'ops', 'sales', 'admin'];
export const roleLabels: Record<Role, string> = { superadmin: '超级管理员', ops: '项目运营老师', sales: '销售顾问', admin: '系统管理员' };
export const isRole = (v: unknown): v is Role => typeof v === 'string' && (roles as readonly string[]).includes(v);
/** Ops workspace (anything that is not sales). */
export const isOpsLike = (role: unknown) => role === 'ops' || role === 'superadmin' || role === 'admin';
export const isSuperadmin = (role: unknown) => role === 'superadmin';
/** May write shared operations data (students, teams, articles…). */
export const canWrite = (role: unknown) => isOpsLike(role);
/** May manage users, 项目编号, 课程 and 津贴标准. */
export const canManageSystem = (role: unknown) => role === 'superadmin';
/** Sees every teacher's 课时记录 / 课情反馈 (others only see their own). */
export const canSeeAllLessons = (role: unknown) => role === 'superadmin';
/** May create or edit a lesson record / feedback owned by `owner` (an email). */
export const canEditOwned = (role: unknown, me: string, owner: string) => canSeeAllLessons(role) || (isOpsLike(role) && !!me && me.toLowerCase() === String(owner || '').toLowerCase());
/** Password policy shared by the browser and the API. */
export function passwordIssues(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 10) out.push('至少 10 位');
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) out.push('需同时包含字母和数字');
  if (pw.length > 128) out.push('不超过 128 位');
  return out;
}
