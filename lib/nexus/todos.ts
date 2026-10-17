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
  /** Set when a superadmin (e.g. 张捷嘉) assigned this todo: API users.id, demo login email. */
  assignedBy?: number | string | null;
  /** Assigner's name at the time of assignment, shown as 「由 张捷嘉 指派」. */
  assignedByName?: string | null;
  /** Owner (assignee) display name / email, filled by the API for the assigner's 「我指派的」 view. */
  ownerName?: string | null;
  ownerEmail?: string | null;
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

/** YYYY-MM of a timestamp in Asia/Shanghai. */
export function monthKeyOf(iso?: string | null, timeZone = 'Asia/Shanghai'): string {
  const d = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(Number.isNaN(d.getTime()) ? new Date() : d);
  return `${parts.find(p => p.type === 'year')?.value || '0000'}-${parts.find(p => p.type === 'month')?.value || '01'}`;
}
export const monthKeyLabel = (key: string) => { const [y, m] = key.split('-'); return y && m ? `${y}年${Number(m)}月` : key; };

/** Group completed todos by calendar month in Asia/Shanghai (e.g. 2026年10月). */
export function groupDoneByMonth(list: readonly Todo[], timeZone = 'Asia/Shanghai'): { key: string; label: string; items: Todo[] }[] {
  const done = doneTodos(list);
  const map = new Map<string, Todo[]>();
  for (const t of done) {
    const key = monthKeyOf(t.completedAt, timeZone);
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

/** Todos owned by the user identified by `key` (API: numeric id as string; demo: email). */
export const ownedBy = (list: readonly Todo[], key: string) => list.filter(t => String(t.userId).toLowerCase() === key.toLowerCase());
/** Todos the user identified by `key` assigned to someone else (「我指派的」). */
export const assignedByKey = (list: readonly Todo[], key: string) => list.filter(t => t.assignedBy != null && String(t.assignedBy).toLowerCase() === key.toLowerCase() && String(t.userId).toLowerCase() !== key.toLowerCase());
/** Todos in `key`'s own list that someone else (the 部门负责人) assigned to them (「领导万岁」). */
export const assignedToKey = (list: readonly Todo[], key: string) => list.filter(t => String(t.userId).toLowerCase() === key.toLowerCase() && t.assignedBy != null && String(t.assignedBy).toLowerCase() !== key.toLowerCase());
/** Tag shown on leader-assigned todos instead of 「由 张捷嘉 指派」 (assigner kept in the tooltip). */
export const CAPITALIST_TAG = '【万恶的资本家】';
/** Tag on a todo an ops teacher assigned upward to the 部门负责人. */
export const UPWARD_TAG = '【以下犯上】';
/** Assignment summary for 「我指派的」. */
export function assignmentStats(list: readonly Todo[]) {
  const done = list.filter(isDone).length;
  return { total: list.length, done, open: list.length - done };
}

function shanghaiParts(d: Date, timeZone = 'Asia/Shanghai') {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const v = (t: string) => p.find(x => x.type === t)?.value || '';
  return { y: v('year'), m: v('month'), d: v('day'), h: v('hour'), min: v('minute') };
}
const shortDate = (iso: string, timeZone = 'Asia/Shanghai') => {
  const raw = iso.length <= 10 ? iso + 'T12:00:00+08:00' : iso;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return iso;
  const p = shanghaiParts(d, timeZone);
  return `${Number(p.m)}月${Number(p.d)}日`;
};

/**
 * Plain-text summary of completed todos for 周报 / 月报 (「一键导出」).
 * month: 'YYYY-MM' for one month, or 'all' for every month (grouped, newest first).
 */
export function exportDoneText(list: readonly Todo[], opts: { month: string; name?: string; now?: Date; timeZone?: string }): string {
  const tz = opts.timeZone || 'Asia/Shanghai';
  const groups = groupDoneByMonth(list, tz).filter(g => opts.month === 'all' || g.key === opts.month);
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const now = shanghaiParts(opts.now || new Date(), tz);
  const scope = opts.month === 'all' ? '全部已完成事项' : `${monthKeyLabel(opts.month)} 已完成事项`;
  const lines: string[] = [`【${opts.name ? opts.name + ' · ' : ''}${scope}】`, `共 ${count} 项 · 导出于 ${now.y}-${now.m}-${now.d} ${now.h}:${now.min}`];
  if (!count) { lines.push('', opts.month === 'all' ? '（暂无已完成事项）' : '（本月暂无已完成事项）'); return lines.join('\n'); }
  const item = (t: Todo, i: number) => {
    const meta = [t.completedAt ? `完成 ${shortDate(t.completedAt, tz)}` : '', t.dueAt ? `DDL ${shortDate(t.dueAt, tz)}` : '', t.assignedByName ? `由 ${t.assignedByName} 指派` : ''].filter(Boolean).join(' · ');
    const out = [`${i + 1}. ${t.title}`];
    if (meta) out.push(`   ${meta}`);
    if (t.note && t.note.trim()) out.push(...t.note.trim().split('\n').map((l, j) => (j ? '         ' : '   备注：') + l));
    return out.join('\n');
  };
  for (const g of groups) {
    lines.push('');
    if (opts.month === 'all') lines.push(`■ ${g.label}（${g.items.length} 项）`);
    // Oldest first inside a month reads like a timeline in a report.
    g.items.slice().reverse().forEach((t, i) => lines.push(item(t, i)));
  }
  return lines.join('\n');
}
