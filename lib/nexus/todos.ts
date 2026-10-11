/**
 * Ops 待办 (TODO) helpers. Records are scoped per logged-in user.
 * Everyone starts with an empty list (no seeded samples); the API and the Pages demo store the same shape.
 */
export type Todo = {
  id: string;
  /** API: numeric users.id. Demo: stable string key (email). */
  userId: number | string;
  title: string;
  note?: string;
  /** ISO date (YYYY-MM-DD) or full ISO timestamp when set. */
  dueAt?: string | null;
  /** ISO timestamp when completed; null/undefined means open. */
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const isOpen = (t: Todo) => !t.completedAt;
export const isDone = (t: Todo) => !!t.completedAt;

export function openTodos(list: readonly Todo[]) {
  return list.filter(isOpen).slice().sort((a, b) => {
    const ad = a.dueAt || '9999', bd = b.dueAt || '9999';
    if (ad !== bd) return ad.localeCompare(bd);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function doneTodos(list: readonly Todo[]) {
  return list.filter(isDone).slice().sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
}

/** Group completed todos by calendar month in Asia/Shanghai (e.g. 2026年10月). */
export function groupDoneByMonth(list: readonly Todo[], timeZone = 'Asia/Shanghai'): { key: string; label: string; items: Todo[] }[] {
  const done = doneTodos(list);
  const map = new Map<string, Todo[]>();
  for (const t of done) {
    const d = t.completedAt ? new Date(t.completedAt) : new Date();
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value || '0000';
    const m = parts.find(p => p.type === 'month')?.value || '01';
    const key = `${y}-${m}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [y, m] = key.split('-');
      return { key, label: `${y}年${Number(m)}月`, items };
    });
}

export function formatDue(dueAt?: string | null, timeZone = 'Asia/Shanghai'): string {
  if (!dueAt) return '';
  const raw = dueAt.length <= 10 ? dueAt + 'T12:00:00+08:00' : dueAt;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return dueAt;
  return new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'numeric', day: 'numeric' }).format(d);
}

export function monthLabelFromIso(iso: string, timeZone = 'Asia/Shanghai'): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value || '';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  return `${y}年${Number(m)}月`;
}

/** Valid todos from browser storage (anything malformed is dropped). */
export function storedTodos(stored: unknown): Todo[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter((x): x is Todo => !!x && typeof x === 'object' && typeof (x as Todo).id === 'string' && typeof (x as Todo).title === 'string');
}

export function newTodoId() {
  return 'TODO-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}
