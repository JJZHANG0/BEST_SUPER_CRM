/**
 * Role model. Kept free of runtime imports so tests and the API server can load it directly.
 *   sales      — read-only sales workspace (own students only)
 *   ops        — 项目运营老师: edits operations data, logs own 课时 / 课情反馈
 *   teacher    — 授课老师 portal: own courses, schedule, lesson feedback (metallic-gray shell)
 *   superadmin — everything ops can do, plus 系统管理 (users, 项目, 课程, 班型与津贴)
 *   leader flag — 部门负责人 (张捷嘉): all teachers' 课时/津贴, 绩效考核, 任务指派; does not fill 当月绩效
 *   admin      — legacy role, treated like ops for writes (kept for existing databases)
 */
export type Role = 'ops' | 'sales' | 'teacher' | 'admin' | 'superadmin';
export const roles: readonly Role[] = ['superadmin', 'ops', 'teacher', 'sales', 'admin'];
export const roleLabels: Record<Role, string> = { superadmin: '超级管理员', ops: '项目运营老师', teacher: '授课老师', sales: '销售顾问', admin: '系统管理员' };
/** 销售老师 org regions (users.sales_region) for grouping 销售业绩 stats. */
export const SALES_REGIONS = ['销售大部', '商务拓展一区', '商务拓展二区', '商务拓展三区'] as const;
export type SalesRegion = typeof SALES_REGIONS[number];
export const isSalesRegion = (v: unknown): v is SalesRegion => typeof v === 'string' && (SALES_REGIONS as readonly string[]).includes(v);
export const isRole = (v: unknown): v is Role => typeof v === 'string' && (roles as readonly string[]).includes(v);
/** Ops workspace (anything that is not sales). */
export const isOpsLike = (role: unknown) => role === 'ops' || role === 'superadmin' || role === 'admin';
export const isTeacher = (role: unknown) => role === 'teacher';
export const isSuperadmin = (role: unknown) => role === 'superadmin';
/** May write shared operations data (students, teams, articles…). */
export const canWrite = (role: unknown) => isOpsLike(role);
/** May manage users, 项目编号, 课程 and 津贴标准. */
export const canManageSystem = (role: unknown) => role === 'superadmin';
/**
 * Who is asking: role plus the explicit 部门负责人 (department head / leader) flag. Only 张捷嘉 carries
 * `leader`; being a superadmin does NOT grant leader rights (程雪晴 is a superadmin without it; 张雪航 is ops).
 * Passing a bare role (string) is treated as a non-leader, so a forgotten call site fails closed.
 */
export type Viewer = { role: unknown; leader?: boolean | null };
const asViewer = (v: Viewer | unknown): Viewer => (v && typeof v === 'object' && 'role' in (v as object) ? v as Viewer : { role: v });
/** 部门负责人 (only accounts with the explicit flag, and only inside the ops workspace). */
export const isLeader = (v: Viewer | unknown) => { const w = asViewer(v); return w.leader === true && isOpsLike(w.role); };
/** Sees every teacher's 课时记录 / 课情反馈 / 教务津贴 (per-teacher tabs). Everyone else only sees their own. */
export const canSeeAllLessons = (v: Viewer | unknown) => isLeader(v);
/** May create or edit a lesson record / feedback owned by `owner` (an email): own records, or any for the leader. */
export const canEditOwned = (v: Viewer | unknown, me: string, owner: string) => isLeader(v) || (isOpsLike(asViewer(v).role) && !!me && me.toLowerCase() === String(owner || '').toLowerCase());
/** 任务指派: create a todo in another ops teacher's list (leader only). */
export const canAssignTodos = (v: Viewer | unknown) => isLeader(v);
/** 以下犯上: an ops-workspace teacher who is not the leader may assign a todo only to the 部门负责人. */
export const canAssignToLeader = (v: Viewer | unknown) => { const w = asViewer(v); return isOpsLike(w.role) && !isLeader(w); };
/** 绩效考核: view, score, finalize and reopen other teachers' monthly KPI sheets (leader only). */
export const canReviewKpi = (v: Viewer | unknown) => isLeader(v);
/** Fills their own 当月绩效 and receives assigned todos: every ops-workspace account except the leader. */
export const canFillKpi = (v: Viewer | unknown) => isOpsLike(asViewer(v).role) && !isLeader(v);
/** Password policy shared by the browser and the API. */
/** Login username (usually the person's name, e.g. 张捷嘉): NFKC, trimmed, inner whitespace collapsed. */
export function normalizeUsername(v: unknown): string {
  return typeof v === 'string' ? v.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
}
/** Case-insensitive comparison key for usernames. */
export const usernameKey = (v: unknown) => normalizeUsername(v).toLowerCase();
/** Validation message for a (normalised) username, or null when valid. '@' is reserved for email logins. */
export function usernameIssue(u: string): string | null {
  if (!u) return '请填写用户名';
  if (u.length > 40) return '用户名不超过 40 个字符';
  if (u.includes('@')) return '用户名不能包含 @';
  return null;
}
export function passwordIssues(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 10) out.push('至少 10 位');
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) out.push('需同时包含字母和数字');
  if (pw.length > 128) out.push('不超过 128 位');
  return out;
}
