/**
 * 当月绩效 (monthly KPI self-fill) and 绩效考核 (review), modelled on the 运营部 绩效评分 sheet.
 * Runtime-import free so tests and the API server load it directly.
 *
 *   类别            O分值  权重  KR 数
 *   A 教务管理        30   30%    6
 *   B 项目运营        30   30%    6
 *   C 团队支持        20   20%    4
 *   D 客诉反馈        20   20%    4   (pre-filled 默认满分, 5 points each; the reviewer deducts)
 *
 * Every KR is worth 5 points (KR 上级评分 0–5). Category subtotal = Σ KR scores (capped at O分值);
 * weighted score = subtotal / O分值 × 权重; total = Σ weighted, out of 100.
 * Unscored KRs count as 0 (D rows default to 5).
 */
export type KpiCategoryKey = 'A' | 'B' | 'C' | 'D';
export type KpiCategory = { key: KpiCategoryKey; name: string; points: number; weight: number; slots: number; locked: boolean };
export const KR_POINTS = 5;
export const KPI_CATEGORIES: readonly KpiCategory[] = [
  { key: 'A', name: '教务管理', points: 30, weight: 30, slots: 6, locked: false },
  { key: 'B', name: '项目运营', points: 30, weight: 30, slots: 6, locked: false },
  { key: 'C', name: '团队支持', points: 20, weight: 20, slots: 4, locked: false },
  { key: 'D', name: '客诉反馈', points: 20, weight: 20, slots: 4, locked: true },
];
export const COMPLAINT_TITLE = '默认满分';
export const COMPLAINT_DESC = '有客诉或者失误 由项目经理填写事项 对应扣分';

export type KpiItem = {
  /** Stable slot id: A1…A6, B1…B6, C1…C4, D1…D4. */
  id: string;
  category: KpiCategoryKey;
  title: string;
  description: string;
  /** 目标完成进度 (0–100 %); filled by the teacher, adjustable by the reviewer. */
  progress: number | null;
  /** KR 上级评分 (0–5, half points allowed); reviewer only. */
  score: number | null;
};
export type KpiStatus = 'draft' | 'submitted' | 'finalized';
export const kpiStatusLabels: Record<KpiStatus | 'none', string> = { none: '未填写', draft: '草稿', submitted: '待审核', finalized: '已定稿' };
export type KpiSheet = {
  id: string;
  /** API: users.id as a string. Pages demo: login email. */
  userKey: string;
  userName: string;
  month: string;
  status: KpiStatus;
  items: KpiItem[];
  submittedAt?: string | null;
  reviewedByName?: string | null;
  reviewNote?: string;
  finalizedAt?: string | null;
  /** Weighted total, stored when finalized (null otherwise / hidden from the owner until then). */
  total?: number | null;
  updatedAt: string;
};
export type KpiReviewAction = 'save' | 'finalize' | 'return' | 'reopen';
export const isKpiReviewAction = (v: unknown): v is KpiReviewAction => v === 'save' || v === 'finalize' || v === 'return' || v === 'reopen';

export const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const categoryOf = (key: string) => KPI_CATEGORIES.find(c => c.key === key);

/** Empty sheet: A–C slots blank, D rows pre-filled 默认满分 with 5 points. */
export function blankItems(): KpiItem[] {
  const out: KpiItem[] = [];
  for (const c of KPI_CATEGORIES) for (let i = 1; i <= c.slots; i++) {
    out.push(c.locked
      ? { id: c.key + i, category: c.key, title: COMPLAINT_TITLE, description: COMPLAINT_DESC, progress: 100, score: KR_POINTS }
      : { id: c.key + i, category: c.key, title: '', description: '', progress: null, score: null });
  }
  return out;
}

const clampText = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
export function clampProgress(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : null;
}
/** 0–5 in half-point steps. */
export function clampScore(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(KR_POINTS, Math.max(0, n)) * 2) / 2 : null;
}

/** Fixed slot list from any input (unknown ids dropped, missing slots filled, values clamped). */
export function normalizeItems(input: unknown): KpiItem[] {
  const given = new Map<string, Record<string, unknown>>();
  if (Array.isArray(input)) for (const x of input) if (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') given.set((x as { id: string }).id, x as Record<string, unknown>);
  return blankItems().map(b => {
    const g = given.get(b.id);
    if (!g) return b;
    return { id: b.id, category: b.category, title: clampText(g.title, 120), description: clampText(g.description, 2000), progress: clampProgress(g.progress), score: clampScore(g.score) };
  });
}

/** Teacher edit: A–C title / description / progress; D rows and every score stay as stored. */
export function applyTeacherEdit(current: readonly KpiItem[], incoming: unknown): KpiItem[] {
  const next = normalizeItems(incoming), cur = normalizeItems(current);
  return cur.map((c, i) => categoryOf(c.category)?.locked ? c : { ...c, title: next[i].title, description: next[i].description, progress: next[i].progress });
}
/** Reviewer edit: every score and progress; D title / description (扣分事项); A–C wording stays the teacher's. */
export function applyReviewerEdit(current: readonly KpiItem[], incoming: unknown): KpiItem[] {
  const next = normalizeItems(incoming), cur = normalizeItems(current);
  return cur.map((c, i) => ({ ...c, score: next[i].score, progress: next[i].progress, ...(categoryOf(c.category)?.locked ? { title: next[i].title || COMPLAINT_TITLE, description: next[i].description } : {}) }));
}

/** Problems that block 提交审核 (empty KR titles in A–C). */
export function submitIssues(items: readonly KpiItem[]): string[] {
  const out: string[] = [];
  for (const c of KPI_CATEGORIES) {
    if (c.locked) continue;
    const missing = items.filter(x => x.category === c.key && !x.title.trim()).length;
    if (missing) out.push(`${c.key} ${c.name}还有 ${missing} 个 KR 未填写标题`);
  }
  return out;
}
/** Problems that block 定稿 (unscored KRs). */
export function finalizeIssues(items: readonly KpiItem[]): string[] {
  const n = items.filter(x => x.score === null).length;
  return n ? [`还有 ${n} 个 KR 未评分`] : [];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export type KpiScore = {
  categories: { key: KpiCategoryKey; name: string; points: number; weight: number; subtotal: number; weighted: number; scored: number; count: number }[];
  total: number;
  /** True when every KR has a score. */
  complete: boolean;
};
/** Category subtotals (Σ KR 上级评分, capped at O分值) and the weighted total out of 100. */
export function scoreSheet(items: readonly KpiItem[]): KpiScore {
  const categories = KPI_CATEGORIES.map(c => {
    const list = items.filter(x => x.category === c.key);
    const raw = list.reduce((n, x) => n + (clampScore(x.score) ?? 0), 0);
    const subtotal = round2(Math.min(c.points, raw));
    return { key: c.key, name: c.name, points: c.points, weight: c.weight, subtotal, weighted: round2(subtotal / c.points * c.weight), scored: list.filter(x => x.score !== null).length, count: list.length };
  });
  return { categories, total: round2(categories.reduce((n, c) => n + c.weighted, 0)), complete: items.length > 0 && items.every(x => x.score !== null) };
}

/** What the teacher sees of their own sheet: reviewer scores stay hidden until 定稿. */
export function ownerView(sheet: KpiSheet): KpiSheet {
  if (sheet.status === 'finalized') return sheet;
  return { ...sheet, total: null, items: sheet.items.map(x => categoryOf(x.category)?.locked ? x : { ...x, score: null }) };
}

/** KR description text built from a completed todo (title + note). */
export function todoAsKr(todo: { title: string; note?: string | null }): string {
  const note = (todo.note || '').trim();
  return note ? `${todo.title}：${note}` : todo.title;
}
/** Appends a line to a KR description without duplicating it. */
export function appendLine(text: string, line: string): string {
  const t = text.trim();
  if (!line.trim()) return t;
  if (t.split('\n').some(l => l.trim() === line.trim())) return t;
  return t ? t + '\n' + line : line;
}

export type KpiResult = { ok: true; sheet: KpiSheet } | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/** Teacher saves their own sheet (draft, or submit for review). Shared by the API and the Pages demo. */
export function teacherSave(current: KpiSheet | null, owner: { id: string; userKey: string; userName: string; month: string }, incoming: unknown, submit: boolean, now = new Date()): KpiResult {
  if (!isMonth(owner.month)) return { ok: false, status: 400, error: '月份格式应为 YYYY-MM' };
  if (!Array.isArray(incoming)) return { ok: false, status: 400, error: '绩效内容格式不正确' };
  if (current && current.status !== 'draft') return { ok: false, status: 409, error: current.status === 'finalized' ? '本月绩效已定稿，不能再修改' : '已提交审核，如需修改请联系审核人退回' };
  const items = applyTeacherEdit(current ? current.items : blankItems(), incoming);
  if (submit) { const issues = submitIssues(items); if (issues.length) return { ok: false, status: 400, error: issues.join('；') }; }
  const stamp = now.toISOString();
  return { ok: true, sheet: { ...(current ?? { id: owner.id, userKey: owner.userKey, userName: owner.userName, month: owner.month, reviewNote: '', reviewedByName: null, finalizedAt: null, total: null }), items, status: submit ? 'submitted' : 'draft', submittedAt: submit ? stamp : null, updatedAt: stamp } };
}

/** Reviewer action on someone else's sheet. Shared by the API and the Pages demo. */
export function reviewSheet(current: KpiSheet | null, opts: { action: unknown; items?: unknown; reviewNote?: unknown; reviewerKey: string; reviewerName: string; now?: Date }): KpiResult {
  const { action } = opts;
  if (!isKpiReviewAction(action)) return { ok: false, status: 400, error: '未知操作' };
  if (!current) return { ok: false, status: 404, error: '该老师本月尚未填写绩效' };
  if (String(current.userKey).toLowerCase() === String(opts.reviewerKey).toLowerCase()) return { ok: false, status: 403, error: '不能审核自己的绩效' };
  const stamp = (opts.now ?? new Date()).toISOString();
  const reviewNote = typeof opts.reviewNote === 'string' ? opts.reviewNote.trim().slice(0, 2000) : current.reviewNote ?? '';
  if (action === 'reopen') {
    if (current.status !== 'finalized') return { ok: false, status: 409, error: '只有已定稿的绩效可以撤销定稿' };
    return { ok: true, sheet: { ...current, status: 'submitted', finalizedAt: null, total: null, updatedAt: stamp } };
  }
  if (action === 'return') {
    if (current.status !== 'submitted') return { ok: false, status: 409, error: '只有待审核的绩效可以退回' };
    return { ok: true, sheet: { ...current, status: 'draft', submittedAt: null, reviewNote, reviewedByName: opts.reviewerName, updatedAt: stamp } };
  }
  if (current.status !== 'submitted') return { ok: false, status: 409, error: current.status === 'finalized' ? '已定稿，如需修改请先撤销定稿' : '该老师尚未提交审核' };
  const items = Array.isArray(opts.items) ? applyReviewerEdit(current.items, opts.items) : normalizeItems(current.items);
  if (action === 'finalize') {
    const issues = finalizeIssues(items);
    if (issues.length) return { ok: false, status: 400, error: issues.join('；') };
    return { ok: true, sheet: { ...current, items, reviewNote, reviewedByName: opts.reviewerName, status: 'finalized', finalizedAt: stamp, total: scoreSheet(items).total, updatedAt: stamp } };
  }
  return { ok: true, sheet: { ...current, items, reviewNote, reviewedByName: opts.reviewerName, updatedAt: stamp } };
}
