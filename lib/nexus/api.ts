/**
 * Browser client for the NEXUS API. Enabled only when NEXT_PUBLIC_API_BASE is set at build time
 * (e.g. "/api" on the server builds). Without it — the GitHub Pages build — the app runs in
 * demo mode on the local store, exactly as before.
 */
import type { Role } from './roles';
import type { KpiItem, KpiReviewAction, KpiSheet } from './kpi';
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
export const API_ENABLED = API_BASE.length > 0;
/** 'production' | 'development' | '' (demo) — shown as a small badge outside production. */
export const APP_ENV = process.env.NEXT_PUBLIC_NEXUS_ENV || '';
export type ApiUser = { id: number; email: string; username?: string | null; name: string; role: Role; salesName: string | null; mustChangePassword?: boolean;
  /** 部门负责人 (only 张捷嘉): sees all teachers' 课时/津贴, reviews 绩效, assigns tasks. */ leader?: boolean; avatar?: string | null };
/** Ops teachers listed for 教务老师 pickers and name lookups. */
export type StaffMember = { email: string; name: string; role: Role; active: boolean; leader?: boolean };
/** Row of 系统管理 · 用户管理. */
export type AdminUser = { id: number; email: string; username: string | null; name: string; role: Role; active: boolean; mustChangePassword: boolean; salesName: string | null; leader?: boolean };
export type OpsCollection = 'classTypes' | 'projects' | 'teachers' | 'opsCourses' | 'lessons' | 'lessonFeedbacks' | 'courseSessions';
export type Collection = 'programs' | 'teams' | 'students' | 'enrollments' | 'courses' | 'feedbacks' | 'resources' | 'assignments' | 'articles' | 'posts' | OpsCollection;
const TOKEN_KEY = 'nexus.api.token.v1';
export class ApiError extends Error { constructor(public status: number, public code: string, message?: string) { super(message || code); } }

export const token = {
  get() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(v: string) { try { localStorage.setItem(TOKEN_KEY, v); } catch { /* session-only */ } },
  clear() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(API_BASE + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || 'http_' + res.status, (data as { message?: string }).message);
  return data as T;
}
export type ApiTodo = {
  id: string;
  userId: number;
  title: string;
  note?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  assignedBy?: number | null;
  assignedByName?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  createdAt: string;
  updatedAt: string;
};
/** One row of 绩效考核: a teacher and their sheet for the month (null when not started). */
export type KpiReviewRow = { user: { key: string; name: string; email: string; role: Role }; sheet: KpiSheet | null };
export type TodoWrite = { title?: string; note?: string | null; dueAt?: string | null; completedAt?: string | null };

export const api = {
  login: (login: string, password: string) => request<{ token: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  me: () => request<{ user: ApiUser }>('/auth/me'),
  bootstrap: <T>() => request<T>('/bootstrap'),
  put: <T>(collection: Collection, id: string, record: unknown) => request<{ record: T }>(`/${collection}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(record) }),
  listTodos: () => request<{ todos: ApiTodo[] }>('/todos'),
  createTodo: (body: { title: string; note?: string | null; dueAt?: string | null; assignee?: string | null }) => request<{ todo: ApiTodo }>('/todos', { method: 'POST', body: JSON.stringify(body) }),
  updateTodo: (id: string, body: TodoWrite) => request<{ todo: ApiTodo }>(`/todos/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTodo: (id: string) => request<{ ok: true }>(`/todos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  kpi: (month: string) => request<{ sheet: KpiSheet | null }>(`/kpi/${month}`),
  saveKpi: (month: string, items: KpiItem[], submit: boolean) => request<{ sheet: KpiSheet }>(`/kpi/${month}`, { method: 'PUT', body: JSON.stringify({ items, submit }) }),
  kpiReview: (month: string) => request<{ rows: KpiReviewRow[] }>(`/kpi-review/${month}`),
  reviewKpi: (userKey: string, month: string, body: { items?: KpiItem[]; reviewNote?: string; action: KpiReviewAction }) => request<{ sheet: KpiSheet }>(`/kpi-review/${encodeURIComponent(userKey)}/${month}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (collection: OpsCollection, id: string) => request<{ ok: true }>(`/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  changePassword: (current: string, next: string) => request<{ ok: true }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current, next }) }),
  updateAvatar: (avatar: string | null) => request<{ user: ApiUser }>('/auth/avatar', { method: 'POST', body: JSON.stringify({ avatar }) }),
  adminUsers: () => request<{ users: AdminUser[] }>('/admin/users'),
  createUser: (body: { email: string; username: string; name: string; role: Role; salesName?: string | null }) => request<{ user: AdminUser; password: string }>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: number, body: { name?: string; username?: string; role?: Role; active?: boolean }) => request<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetPassword: (id: number) => request<{ password: string }>(`/admin/users/${id}/reset-password`, { method: 'POST' }),
};

/** Published 推文 as served to anyone (no login): GET /api/public/articles/:slug. */
export type PublicArticle = { slug: string; title: string; summary: string; cover: string; blocks: import('./articles').ArticleBlock[]; author: string; publishedAt: string | null;
  metrics: import('./posts').PostMetrics; program: { id: string; name: string; short: string; type: string; color: string } | null };
/** Public reader endpoints: never send the staff token, so the page behaves the same signed in or out. */
async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) }, credentials: 'omit' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || 'http_' + res.status, (data as { message?: string }).message);
  return data as T;
}
export const publicApi = {
  article: (slug: string, visitor: string) => publicRequest<{ article: PublicArticle; liked: boolean }>(`/public/articles/${encodeURIComponent(slug)}?visitor=${encodeURIComponent(visitor)}`),
  track: (slug: string, kind: 'view' | 'share' | 'like', visitor: string) => publicRequest<{ counted: boolean; metrics: import('./posts').PostMetrics; liked: boolean }>(`/public/articles/${encodeURIComponent(slug)}/${kind}`, { method: 'POST', body: JSON.stringify({ visitor }) }),
};
/** Anonymous per-browser id for like / view / share dedupe (no personal data). */
export function visitorId(): string {
  const KEY = 'nexus.visitor.v1';
  try { const v = localStorage.getItem(KEY); if (v && /^[A-Za-z0-9_-]{8,64}$/.test(v)) return v; } catch { /* storage blocked */ }
  const bytes = new Uint8Array(12);
  try { crypto.getRandomValues(bytes); } catch { bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); }); }
  const id = 'v' + Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  try { localStorage.setItem(KEY, id); } catch { /* session-only id */ }
  return id;
}

/** Key-order independent JSON for change detection; drops undefined values and browser-only fields. */
export function stableJson(value: unknown, omit: readonly string[] = []): string {
  const norm = (v: unknown): unknown => Array.isArray(v) ? v.map(norm) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v as object).filter(k => !omit.includes(k) && (v as Record<string, unknown>)[k] !== undefined).sort().map(k => [k, norm((v as Record<string, unknown>)[k])]))
    : v;
  return JSON.stringify(norm(value));
}
/** Records whose content differs from the last server-confirmed version (new records included). */
export function changedRecords<T>(list: readonly T[], synced: ReadonlyMap<string, string>, key: (x: T) => string, omit: readonly string[] = []): T[] {
  return list.filter(x => synced.get(key(x)) !== stableJson(x, omit));
}
