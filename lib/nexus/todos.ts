/**
 * Ops 待办 (TODO) helpers. Records are scoped per logged-in user.
 * Demo/GitHub Pages seeds a few open items for ops@nexus.demo; the API stores the same shape.
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

export const DEMO_TODO_USER = 'ops@nexus.demo';

/** Sample open todos shown to the ops demo account on first load (localStorage / empty DB). */
export function seedTodos(userId: number | string = DEMO_TODO_USER, now = new Date()): Todo[] {
  const iso = (d: Date) => d.toISOString();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const base = now.getTime();
  return [
    { id: 'TODO-seed-1', userId, title: '核对本周 BPA 课程排期', note: '确认两支队伍的上课时间无冲突', dueAt: day(1), completedAt: null, createdAt: iso(new Date(base - 86_400_000 * 2)), updatedAt: iso(new Date(base - 86_400_000 * 2)) },
    { id: 'TODO-seed-2', userId, title: '整理 CTB 队伍进度备注', note: '把「材料待补充」的队伍说明写清楚，方便周报引用', dueAt: day(2), completedAt: null, createdAt: iso(new Date(base - 86_400_000)), updatedAt: iso(new Date(base - 86_400_000)) },
    { id: 'TODO-seed-3', userId, title: '准备周五项目周报素材', dueAt: day(4), completedAt: null, createdAt: iso(new Date(base - 36_000_000)), updatedAt: iso(new Date(base - 36_000_000)) },
    { id: 'TODO-seed-4', userId, title: '跟进需关注学生状态更新', note: '与负责销售对齐状态不佳同学的下一步', dueAt: null, completedAt: null, createdAt: iso(now), updatedAt: iso(now) },
  ];
}

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

/** Merge stored list with seed: keep user edits; inject missing seed ids only when storage was empty. */
export function mergeStoredTodos(seed: Todo[], stored: unknown): Todo[] {
  if (!Array.isArray(stored) || !stored.length) return seed.slice();
  return stored.filter((x): x is Todo => !!x && typeof x === 'object' && typeof (x as Todo).id === 'string' && typeof (x as Todo).title === 'string');
}

export function newTodoId() {
  return 'TODO-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}
