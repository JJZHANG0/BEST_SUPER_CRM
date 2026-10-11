/**
 * 推文 (article posts): many per project, written by ops like WeChat Official Account articles.
 * Workflow: draft → published → withdrawn (→ published again). A published post has a public
 * URL (#/p/<slug> on every build, /a/<slug> with per-article Open Graph tags on the server build).
 * Shared by the browser store, the public reader and the API server; only imports articles.ts
 * (itself free of runtime imports) so tests can bundle it alone.
 */
import { articleIssues, cleanContent, validContent, type ArticleContent } from './articles';

export type PostStatus = 'draft' | 'published' | 'withdrawn';
export type PostMetrics = { views: number; shares: number; likes: number };
export type MetricKind = 'view' | 'share' | 'like';
export type ArticlePost = {
  id: string;
  /** Public URL key, unique and immutable once created. */
  slug: string;
  program: string;
  status: PostStatus;
  /** Byline shown on the article (e.g. 许瑾老师). */
  author: string;
  /** Login email of the ops teacher who created the post. */
  authorEmail: string;
  /** Working copy edited by ops. */
  draft: ArticleContent;
  /** Snapshot shown to sales and the public; null unless status is published. */
  published: ArticleContent | null;
  createdAt: string;
  updated: string;
  publishedAt: string | null;
  metrics: PostMetrics;
};

export const postStatusLabels: Record<PostStatus, string> = { draft: '草稿', published: '已发布', withdrawn: '已撤回' };
export const postStatuses = Object.keys(postStatusLabels) as PostStatus[];
export const metricKinds: readonly MetricKind[] = ['view', 'share', 'like'];
export const emptyMetrics = (): PostMetrics => ({ views: 0, shares: 0, likes: 0 });
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;
export const VISITOR_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const isSlug = (v: unknown): v is string => typeof v === 'string' && SLUG_RE.test(v);
export const isVisitorId = (v: unknown): v is string => typeof v === 'string' && VISITOR_RE.test(v);

const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
/** Random lower-case token (no look-alike characters). `rand` returns [0, 1). */
export function randomToken(length = 6, rand: () => number = Math.random) {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(rand() * alphabet.length) % alphabet.length];
  return out;
}
/** New slug: `<program>-<random>` (e.g. bpa-k3x9q2); retried by callers on the rare collision. */
export function newSlug(program: string, taken: ReadonlySet<string> | readonly string[] = [], rand: () => number = Math.random) {
  const set = taken instanceof Set ? taken : new Set(taken as readonly string[]);
  const prefix = program.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'post';
  for (;;) { const s = `${prefix}-${randomToken(6, rand)}`; if (!set.has(s)) return s; }
}
export function newPost(input: { id: string; slug: string; program: string; author: string; authorEmail: string; now: string; draft?: ArticleContent }): ArticlePost {
  return { id: input.id, slug: input.slug, program: input.program, status: 'draft', author: input.author, authorEmail: input.authorEmail.toLowerCase(),
    draft: input.draft ?? { title: '', summary: '', cover: `materials/cover-${input.program}.svg`, blocks: [] }, published: null,
    createdAt: input.now, updated: input.now, publishedAt: null, metrics: emptyMetrics() };
}

/** Problems that block publishing (same rules as 项目书, plus a byline). */
export function postIssues(p: Pick<ArticlePost, 'author' | 'draft'>): string[] {
  const issues = articleIssues(p.draft);
  if (!p.author.trim()) issues.push('请填写作者署名');
  return issues;
}
export function savePostDraft(p: ArticlePost, patch: { draft?: ArticleContent; author?: string }, now: string): ArticlePost {
  return { ...p, ...(patch.draft ? { draft: patch.draft } : {}), ...(patch.author !== undefined ? { author: patch.author.slice(0, 40) } : {}), updated: now };
}
export function publishPost(p: ArticlePost, now: string): ArticlePost {
  const issues = postIssues(p);
  if (issues.length) throw new Error(issues[0]);
  const snapshot = cleanContent(p.draft);
  return { ...p, author: p.author.trim(), draft: snapshot, published: JSON.parse(JSON.stringify(snapshot)), status: 'published', updated: now, publishedAt: now };
}
/** Withdraw: the public link and the sales reader stop showing the post; the draft is kept. */
export function withdrawPost(p: ArticlePost, now: string): ArticlePost {
  return { ...p, status: p.status === 'published' ? 'withdrawn' : p.status, published: null, updated: now };
}
export type PostState = '草稿' | '已发布' | '有未发布修改' | '已撤回';
export function postState(p: ArticlePost): PostState {
  if (p.status === 'withdrawn') return '已撤回';
  if (p.status !== 'published' || !p.published) return '草稿';
  return JSON.stringify(p.draft) === JSON.stringify(p.published) ? '已发布' : '有未发布修改';
}
export const isPublic = (p: Pick<ArticlePost, 'status' | 'published'>) => p.status === 'published' && !!p.published;

export type PostFilter = { program?: string; status?: PostStatus | ''; author?: string; q?: string };
/** Overall 推文 list: newest activity first, filtered by project / status / author email / text. */
export function filterPosts(list: readonly ArticlePost[], f: PostFilter): ArticlePost[] {
  const q = (f.q || '').trim().toLowerCase();
  return list.filter(p => (!f.program || p.program === f.program) && (!f.status || p.status === f.status) && (!f.author || p.authorEmail === f.author.toLowerCase())
    && (!q || (p.draft.title + p.draft.summary + p.author + p.slug).toLowerCase().includes(q)))
    .slice().sort((a, b) => (b.publishedAt || b.updated).localeCompare(a.publishedAt || a.updated));
}
/** What a signed-in role may see: ops everything; sales only live posts, showing the published snapshot. */
export function visiblePosts(list: readonly ArticlePost[], role: string): ArticlePost[] {
  if (role !== 'sales') return [...list];
  return list.filter(isPublic).map(p => ({ ...p, draft: p.published! }));
}

/**
 * Counting rules shared by the API (events table) and the Pages preview (localStorage):
 *   like  — once per visitor, forever
 *   view  — once per visitor per 30 minutes
 *   share — once per visitor per minute (each share / copy click within that window counts once)
 * `bucketFor` returns the dedupe key; an event counts only the first time its key is seen.
 */
export const VIEW_WINDOW_MS = 30 * 60_000;
export const SHARE_WINDOW_MS = 60_000;
export function bucketFor(kind: MetricKind, nowMs: number): string {
  if (kind === 'like') return 'like';
  return kind + ':' + Math.floor(nowMs / (kind === 'view' ? VIEW_WINDOW_MS : SHARE_WINDOW_MS));
}
const metricKey: Record<MetricKind, keyof PostMetrics> = { view: 'views', share: 'shares', like: 'likes' };
export const metricField = (kind: MetricKind) => metricKey[kind];

/** Browser-side counter state (Pages preview): counts per slug plus the dedupe keys this browser has used. */
export type LocalMetrics = { counts: Record<string, PostMetrics>; seen: Record<string, string[]> };
export const emptyLocalMetrics = (): LocalMetrics => ({ counts: {}, seen: {} });
export function readLocalMetrics(v: unknown): LocalMetrics {
  if (!v || typeof v !== 'object') return emptyLocalMetrics();
  const o = v as { counts?: unknown; seen?: unknown };
  const counts: Record<string, PostMetrics> = {}, seen: Record<string, string[]> = {};
  if (o.counts && typeof o.counts === 'object') for (const [k, m] of Object.entries(o.counts as Record<string, unknown>)) {
    const x = m as Partial<PostMetrics>;
    if (isSlug(k) && x && [x.views, x.shares, x.likes].every(n => Number.isInteger(n) && (n as number) >= 0)) counts[k] = { views: x.views!, shares: x.shares!, likes: x.likes! };
  }
  if (o.seen && typeof o.seen === 'object') for (const [k, l] of Object.entries(o.seen as Record<string, unknown>)) if (isSlug(k) && Array.isArray(l)) seen[k] = l.filter(s => typeof s === 'string').slice(-50);
  return { counts, seen };
}
export function recordLocal(state: LocalMetrics, slug: string, kind: MetricKind, nowMs: number): { state: LocalMetrics; counted: boolean } {
  const key = bucketFor(kind, nowMs), used = state.seen[slug] ?? [];
  if (used.includes(key)) return { state, counted: false };
  const cur = state.counts[slug] ?? emptyMetrics(), field = metricKey[kind];
  // Keep the like key forever; time buckets only need the latest few.
  const keep = [...used.filter(k => k === 'like' || !k.startsWith(kind + ':')), key];
  return { state: { counts: { ...state.counts, [slug]: { ...cur, [field]: cur[field] + 1 } }, seen: { ...state.seen, [slug]: keep } }, counted: true };
}
export const likedLocally = (state: LocalMetrics, slug: string) => (state.seen[slug] ?? []).includes('like');
/** Seed counts + this browser's counts (Pages preview only counts locally). */
export function addMetrics(a: PostMetrics, b?: PostMetrics): PostMetrics {
  return b ? { views: a.views + b.views, shares: a.shares + b.shares, likes: a.likes + b.likes } : a;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
/** Shape check for stored / submitted posts (content shape is checked with articles.ts rules by callers). */
export function isPostShape(v: unknown): v is ArticlePost {
  if (!isObj(v)) return false;
  return str(v.id) && v.id.length > 0 && v.id.length <= 80 && isSlug(v.slug) && str(v.program) && postStatuses.includes(v.status as PostStatus)
    && str(v.author) && v.author.length <= 40 && str(v.authorEmail) && str(v.createdAt) && str(v.updated) && (v.publishedAt === null || str(v.publishedAt))
    && validContent(v.draft) && (v.published === null || validContent(v.published));
}
const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
/** Full check for posts read back from localStorage (metrics included). */
export function isValidPost(v: unknown): v is ArticlePost {
  if (!isPostShape(v)) return false;
  const m = (v as { metrics?: Partial<PostMetrics> }).metrics;
  return !!m && count(m.views) && count(m.shares) && count(m.likes);
}
/** Merge posts saved in this browser over the bundled seed (by id); invalid entries are dropped. */
export function mergeStoredPosts(seed: readonly ArticlePost[], stored: unknown): ArticlePost[] {
  if (!Array.isArray(stored)) return [...seed];
  const byId = new Map(seed.map(p => [p.id, p]));
  const slugs = new Set(seed.map(p => p.slug));
  for (const p of stored) {
    if (!isValidPost(p)) continue;
    const prev = byId.get(p.id);
    if (!prev && slugs.has(p.slug)) continue; // a slug may never be reused by another post
    byId.set(p.id, p); slugs.add(p.slug);
  }
  return [...byId.values()];
}

/** Absolute public URLs. `origin` is e.g. https://jjzhang0.github.io, `base` the SPA base path ('' or /BEST_SUPER_CRM). */
export const publicHashUrl = (origin: string, base: string, slug: string) => `${origin}${base}/#/p/${slug}`;
export const shareCardUrl = (origin: string, slug: string) => `${origin}/a/${slug}`;

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/**
 * Minimal HTML shell served at /a/<slug> on the server build: per-article Open Graph tags for
 * link-preview crawlers, then a redirect into the SPA reader (#/p/<slug>). Generic tags when the
 * article is missing or not published, so drafts never leak through link previews.
 */
export function shareShellHtml(input: { origin: string; slug: string; article: { title: string; summary: string; cover: string; program: string } | null; siteName?: string }) {
  const site = input.siteName || 'B.E.S.T';
  const target = `/#/p/${encodeURIComponent(input.slug)}`;
  const a = input.article;
  const title = a ? a.title : `${site} · 项目推文`;
  const description = a ? a.summary : '该推文暂不可阅读，可能已撤回或尚未发布。';
  const img = a?.cover && !/^(data:|blob:)/.test(a.cover) ? (/^https?:/.test(a.cover) ? a.cover : `${input.origin}/${a.cover.replace(/^\//, '').replace(/\.svg$/, '.png')}`) : `${input.origin}/og-default.png`;
  const url = shareCardUrl(input.origin, input.slug);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="${esc(site)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image"><meta itemprop="name" content="${esc(title)}"><meta itemprop="description" content="${esc(description)}"><meta itemprop="image" content="${esc(img)}">
<link rel="canonical" href="${esc(url)}"><meta http-equiv="refresh" content="0;url=${esc(target)}"><script>location.replace(${JSON.stringify(target)})</script></head>
<body style="font-family:-apple-system,'PingFang SC',sans-serif;padding:24px"><h1 style="font-size:18px">${esc(title)}</h1><p>${esc(description)}</p><p><a href="${esc(target)}">打开推文</a></p></body></html>`;
}
