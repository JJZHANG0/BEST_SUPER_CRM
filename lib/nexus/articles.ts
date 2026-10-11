/**
 * Project showcase articles (项目推文): composed by ops like a WeChat Official Account post,
 * read by sales in 项目中心. Kept free of runtime imports so tests/articles.mjs can load it alone.
 */
export type HighlightKind = 'price' | 'schedule' | 'eligibility' | 'tip';
export type HighlightItem = { label: string; value: string };
export type ArticleBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'image'; src: string; caption: string }
  | { id: string; type: 'highlight'; kind: HighlightKind; title: string; items: HighlightItem[] }
  | { id: string; type: 'quote'; text: string };
export type BlockType = ArticleBlock['type'];
export type ArticleContent = { title: string; summary: string; cover: string; blocks: ArticleBlock[] };
/** Sales only ever see `published`; ops edit `draft` and publish a snapshot of it. */
export type ProgramArticle = { program: string; author: string; draft: ArticleContent; published: ArticleContent | null; updated: string; publishedAt: string | null };

export const blockLabels: Record<BlockType, string> = { heading: '小标题', paragraph: '正文段落', image: '图片', highlight: '亮点卡片', quote: '引用 / 金句' };
export const highlightLabels: Record<HighlightKind, string> = { price: '费用说明', schedule: '时间安排', eligibility: '报名条件', tip: '温馨提示' };
export const highlightKinds = Object.keys(highlightLabels) as HighlightKind[];
export const LIMITS = { title: 64, summary: 120, heading: 40, paragraph: 1200, caption: 60, imageBytes: 1.5 * 1024 * 1024 };

export function newBlock(type: BlockType, id: string): ArticleBlock {
  switch (type) {
    case 'heading': return { id, type, text: '' };
    case 'paragraph': return { id, type, text: '' };
    case 'image': return { id, type, src: '', caption: '' };
    case 'quote': return { id, type, text: '' };
    case 'highlight': return { id, type, kind: 'price', title: highlightLabels.price, items: [{ label: '', value: '' }] };
  }
}
export function moveBlock<T>(blocks: readonly T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || index >= blocks.length || to < 0 || to >= blocks.length) return [...blocks];
  const next = [...blocks];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}
/** Problems that block publishing. An empty list means the draft can go live. */
export function articleIssues(c: ArticleContent): string[] {
  const issues: string[] = [];
  if (!c.title.trim()) issues.push('请填写推文标题');
  else if (c.title.length > LIMITS.title) issues.push(`标题请控制在 ${LIMITS.title} 字以内`);
  if (!c.summary.trim()) issues.push('请填写推文摘要');
  else if (c.summary.length > LIMITS.summary) issues.push(`摘要请控制在 ${LIMITS.summary} 字以内`);
  if (!c.cover) issues.push('请选择封面图片');
  if (!c.blocks.length) issues.push('正文至少需要一个内容模块');
  c.blocks.forEach((b, i) => {
    const n = `第 ${i + 1} 个模块（${blockLabels[b.type]}）`;
    if ((b.type === 'heading' || b.type === 'paragraph' || b.type === 'quote') && !b.text.trim()) issues.push(`${n}内容为空`);
    if (b.type === 'image' && !b.src) issues.push(`${n}未选择图片`);
    if (b.type === 'highlight' && !b.items.some(x => x.label.trim() && x.value.trim())) issues.push(`${n}至少需要一行完整的“名称 + 内容”`);
  });
  return issues;
}
const clean = (c: ArticleContent): ArticleContent => ({
  ...c, title: c.title.trim(), summary: c.summary.trim(),
  blocks: c.blocks.map(b => b.type === 'highlight' ? { ...b, items: b.items.filter(x => x.label.trim() && x.value.trim()) } : b),
});
export function saveDraft(a: ProgramArticle, draft: ArticleContent, now: string): ProgramArticle { return { ...a, draft, updated: now }; }
export function publishArticle(a: ProgramArticle, draft: ArticleContent, now: string): ProgramArticle {
  const issues = articleIssues(draft);
  if (issues.length) throw new Error(issues[0]);
  const snapshot = clean(draft);
  return { ...a, draft: snapshot, published: JSON.parse(JSON.stringify(snapshot)), updated: now, publishedAt: now };
}
export function unpublishArticle(a: ProgramArticle, now: string): ProgramArticle { return { ...a, published: null, publishedAt: null, updated: now }; }
export type ArticleState = '已发布' | '有未发布修改' | '未发布';
export function articleState(a: ProgramArticle): ArticleState {
  if (!a.published) return '未发布';
  return JSON.stringify(a.draft) === JSON.stringify(a.published) ? '已发布' : '有未发布修改';
}
export function readingMinutes(c: ArticleContent) {
  const text = c.summary + c.blocks.map(b => b.type === 'highlight' ? b.items.map(i => i.label + i.value).join('') : 'text' in b ? b.text : b.caption).join('');
  return Math.max(1, Math.round(text.length / 350));
}
/** Plain text for sales to paste into WeChat / SMS when sharing with parents. */
export function shareText(c: ArticleContent, programName: string) {
  const facts = c.blocks.flatMap(b => b.type === 'highlight' ? b.items.filter(i => i.label && i.value).map(i => `${i.label}：${i.value}`) : []);
  return [`【${programName}】${c.title}`, c.summary, ...facts.slice(0, 6), '以上为演示内容，正式信息以签约报价与项目公告为准。'].join('\n');
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const str = (v: unknown) => typeof v === 'string';
function validBlock(b: unknown): b is ArticleBlock {
  if (!isObj(b) || !str(b.id)) return false;
  if (b.type === 'heading' || b.type === 'paragraph' || b.type === 'quote') return str(b.text);
  if (b.type === 'image') return str(b.src) && str(b.caption);
  if (b.type === 'highlight') return str(b.title) && highlightKinds.includes(b.kind as HighlightKind) && Array.isArray(b.items) && b.items.every(i => isObj(i) && str(i.label) && str(i.value));
  return false;
}
function validContent(c: unknown): c is ArticleContent {
  return isObj(c) && str(c.title) && str(c.summary) && str(c.cover) && Array.isArray(c.blocks) && c.blocks.every(validBlock);
}
/** Shape check shared by the browser store and the API server. */
export function isValidArticle(a: unknown): a is ProgramArticle {
  return isObj(a) && str(a.program) && str(a.author) && str(a.updated) && validContent(a.draft) && (a.published === null || validContent(a.published)) && (a.publishedAt === null || str(a.publishedAt));
}
/**
 * Merge articles saved in browser storage over the seed. Corrupt or unknown entries are
 * dropped so a bad localStorage value can never break 项目中心.
 */
export function mergeStoredArticles(seed: readonly ProgramArticle[], stored: unknown): ProgramArticle[] {
  if (!Array.isArray(stored)) return [...seed];
  const byProgram = new Map<string, ProgramArticle>();
  for (const a of stored) {
    if (isValidArticle(a)) byProgram.set(a.program, a);
  }
  return seed.map(a => byProgram.get(a.program) ?? a);
}
