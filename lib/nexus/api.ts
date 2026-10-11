/**
 * Browser client for the NEXUS API. Enabled only when NEXT_PUBLIC_API_BASE is set at build time
 * (e.g. "/api" on the server builds). Without it — the GitHub Pages build — the app runs in
 * demo mode on the local store, exactly as before.
 */
import type { Role } from './data';
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
export const API_ENABLED = API_BASE.length > 0;
/** 'production' | 'development' | '' (demo) — shown as a small badge outside production. */
export const APP_ENV = process.env.NEXT_PUBLIC_NEXUS_ENV || '';
export type ApiUser = { id: number; email: string; name: string; role: Role; salesName: string | null };
export type Collection = 'programs' | 'teams' | 'students' | 'enrollments' | 'courses' | 'feedbacks' | 'resources' | 'assignments' | 'articles';
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
export const api = {
  login: (email: string, password: string) => request<{ token: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: ApiUser }>('/auth/me'),
  bootstrap: <T>() => request<T>('/bootstrap'),
  put: <T>(collection: Collection, id: string, record: unknown) => request<{ record: T }>(`/${collection}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(record) }),
};

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
