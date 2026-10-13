/**
 * 「生成OKR」: completed todos → Qwen → OKR JSON → 当月绩效 (KPI sheet) KR slots.
 * The 当月绩效 sheet is the app's OKR page: A 教务管理 / B 项目运营 / C 团队支持 are the Objectives,
 * each slot (A1…A6, B1…B6, C1…C4) is a Key Result. D 客诉反馈 is reviewer-owned and never touched.
 * Runtime-import free (only type imports) so tests and the API server load it directly.
 */
import type { KpiItem } from './kpi';

export type OkrCategory = 'A' | 'B' | 'C';
export type OkrKeyResult = { title: string; description: string; progress: number | null; todoIds: string[] };
export type OkrObjective = { category: OkrCategory; objective: string; keyResults: OkrKeyResult[] };
export type OkrDraft = { month: string; summary: string; objectives: OkrObjective[]; model?: string; generatedAt?: string };
export type OkrTodoInput = { id: string; title: string; note?: string | null; completedAt?: string | null; assignedByName?: string | null };

/** Mirrors KPI_CATEGORIES in kpi.ts (kept local so this module stays import-free). */
export const OKR_SLOTS: Record<OkrCategory, { name: string; slots: number }> = {
  A: { name: '教务管理', slots: 6 }, B: { name: '项目运营', slots: 6 }, C: { name: '团队支持', slots: 4 },
};
export const OKR_MAX_TODOS = 150;
export const OKR_MAX_INPUT_CHARS = 12000;
export const OKR_DRAFT_KEY = 'nexus.okr.draft.v1';

const text = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
const isCat = (v: unknown): v is OkrCategory => v === 'A' || v === 'B' || v === 'C';
const CAT_BY_NAME: Record<string, OkrCategory> = { 教务管理: 'A', 项目运营: 'B', 团队支持: 'C' };

/** Compact, size-capped todo list for the prompt (newest first are dropped last). */
export function todoLines(todos: readonly OkrTodoInput[], maxTodos = OKR_MAX_TODOS, maxChars = OKR_MAX_INPUT_CHARS): { lines: string; used: number; truncated: boolean } {
  const out: string[] = []; let size = 0;
  const list = todos.slice(0, maxTodos);
  for (const t of list) {
    const note = (t.note || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const line = `[${t.id}] ${t.title.replace(/\s+/g, ' ').trim().slice(0, 200)}${note ? `（备注：${note}）` : ''}${t.completedAt ? ` · 完成于 ${t.completedAt.slice(0, 10)}` : ''}${t.assignedByName ? ` · ${t.assignedByName}指派` : ''}`;
    if (size + line.length + 1 > maxChars) break;
    out.push(line); size += line.length + 1;
  }
  return { lines: out.join('\n'), used: out.length, truncated: out.length < todos.length };
}

export function buildOkrMessages(opts: { month: string; name: string; todos: readonly OkrTodoInput[] }) {
  const { lines, used } = todoLines(opts.todos);
  const system = [
    '你是 B.E.S.T（国际学科竞赛与升学教育机构）运营部的绩效顾问，擅长把运营老师的日常工作整理成 OKR。',
    '运营部月度 OKR 固定为三个 Objective（类别）：',
    'A 教务管理（排课、课时、学生与老师对接、教务数据）最多 6 个 KR；',
    'B 项目运营（竞赛/项目报名、组队、赛事执行、活动与推文）最多 6 个 KR；',
    'C 团队支持（协助同事、内部流程、培训、跨部门支持）最多 4 个 KR。',
    '要求：',
    '1. 只依据给出的已完成待办归纳，不要编造未出现的事项、数字或人名；同类事项合并成一个 KR。',
    '2. KR 标题 ≤ 30 字，结果导向（动词 + 对象 + 结果），描述 ≤ 150 字，写清做了什么和产出。',
    '3. progress 为 0–100 的整数，表示该 KR 本月完成度；已完成事项通常为 100。',
    '4. todoIds 填写该 KR 依据的待办 id（方括号中的内容）。',
    '5. 某类没有相关事项时 keyResults 为空数组。',
    '6. 只输出一个 JSON 对象，不要 Markdown 代码块或任何解释。格式：',
    '{"summary":"本月工作概述（≤80字）","objectives":[{"category":"A","objective":"目标（≤30字）","keyResults":[{"title":"…","description":"…","progress":100,"todoIds":["…"]}]},{"category":"B",…},{"category":"C",…}]}',
  ].join('\n');
  const user = `老师：${opts.name || '运营老师'}\n月份：${opts.month}\n本月已完成待办（共 ${used} 项）：\n${lines || '（无）'}\n\n请生成本月 OKR，严格输出 JSON。`;
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}

/** Pulls the JSON object out of a model reply (tolerates ```json fences and leading prose). */
export function extractJson(raw: string): unknown {
  const s = String(raw || '').replace(/^\uFEFF/, '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf('{'), end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON');
  return JSON.parse(body.slice(start, end + 1));
}

/** Validates / normalizes model output. Throws when nothing usable is left. */
export function parseOkr(raw: unknown, month: string, knownTodoIds?: ReadonlySet<string>): OkrDraft {
  const data = typeof raw === 'string' ? extractJson(raw) : raw;
  if (!data || typeof data !== 'object') throw new Error('OKR 格式不正确');
  const objs = (data as { objectives?: unknown }).objectives;
  if (!Array.isArray(objs)) throw new Error('OKR 缺少 objectives');
  const byCat = new Map<OkrCategory, OkrObjective>();
  for (const o of objs) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    const catRaw = typeof r.category === 'string' ? r.category.trim() : '';
    const cat: OkrCategory | undefined = isCat(catRaw.toUpperCase().slice(0, 1)) && catRaw.length <= 2 ? catRaw.toUpperCase().slice(0, 1) as OkrCategory
      : Object.entries(CAT_BY_NAME).find(([n]) => catRaw.includes(n))?.[1];
    if (!cat) continue;
    const target = byCat.get(cat) ?? { category: cat, objective: '', keyResults: [] };
    if (!target.objective) target.objective = text(r.objective, 60);
    const krs = Array.isArray(r.keyResults) ? r.keyResults : [];
    for (const k of krs) {
      if (!k || typeof k !== 'object') continue;
      const kr = k as Record<string, unknown>;
      const title = text(kr.title, 120);
      if (!title) continue;
      const p = typeof kr.progress === 'number' ? kr.progress : Number(kr.progress);
      const ids = Array.isArray(kr.todoIds) ? kr.todoIds.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(x => !knownTodoIds || knownTodoIds.has(x)) : [];
      target.keyResults.push({ title, description: text(kr.description, 1500), progress: Number.isFinite(p) ? Math.round(Math.min(100, Math.max(0, p))) : null, todoIds: [...new Set(ids)].slice(0, 30) });
    }
    byCat.set(cat, target);
  }
  const objectives = (['A', 'B', 'C'] as const).map(c => byCat.get(c)).filter((o): o is OkrObjective => !!o)
    .map(o => ({ ...o, keyResults: o.keyResults.slice(0, OKR_SLOTS[o.category].slots) }));
  if (!objectives.some(o => o.keyResults.length)) throw new Error('模型没有生成任何 KR');
  return { month, summary: text((data as { summary?: unknown }).summary, 200), objectives };
}

/**
 * Writes the OKR into the KPI sheet's A–C slots (D and every score untouched).
 * Description = KR description + 「关联待办：…」 lines from todoIds.
 */
export function okrToKpiItems(draft: OkrDraft, current: readonly KpiItem[], todoTitles: ReadonlyMap<string, string> = new Map()): KpiItem[] {
  const next = current.map(x => ({ ...x }));
  for (const o of draft.objectives) {
    const slots = next.filter(x => x.category === o.category);
    slots.forEach((slot, i) => {
      const kr = o.keyResults[i];
      if (!kr) { slot.title = ''; slot.description = ''; slot.progress = null; return; }
      const linked = kr.todoIds.map(id => todoTitles.get(id)).filter((t): t is string => !!t);
      slot.title = kr.title.slice(0, 120);
      slot.description = [kr.description, linked.length ? '关联待办：' + linked.join('；') : ''].filter(Boolean).join('\n').slice(0, 2000);
      slot.progress = kr.progress;
    });
  }
  return next;
}

/** True when the sheet already has any saved A–C content (needs confirmation before overwrite). */
export const hasOkrContent = (items: readonly KpiItem[]) => items.some(x => x.category !== 'D' && (x.title.trim() || x.description.trim()));

/** Per-key sliding rate limit (default 1 call / 20 s). */
export function rateLimiter(windowMs = 20_000) {
  const last = new Map<string, number>();
  return (key: string, now = Date.now()): number => {
    const prev = last.get(key);
    if (prev !== undefined && now - prev < windowMs) return Math.ceil((windowMs - (now - prev)) / 1000);
    last.set(key, now);
    if (last.size > 1000) for (const [k, t] of last) if (now - t > windowMs) last.delete(k);
    return 0;
  };
}
