// 推文: workflow rules, metrics dedupe, public API without login, publish gating, roles, OG share shell.
// Runs without PostgreSQL: the real Hono app (server/app.ts) is bundled with an in-memory PostRepo.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sign } from 'hono/jwt';

const outdir = 'node_modules/.cache/nexus-tests';
mkdirSync(outdir, { recursive: true });
await build({ entryPoints: { posts: 'lib/nexus/posts.ts', seed: 'lib/nexus/post-seed.ts', app: 'server/app.ts', postsApi: 'server/posts.ts' }, outdir, bundle: true, platform: 'node', format: 'esm', packages: 'external', outExtension: { '.js': '.mjs' }, logLevel: 'error' });
const load = n => import(pathToFileURL(`${outdir}/${n}.mjs`).href + '?t=' + Date.now());
const P = await load('posts'), { seedPosts } = await load('seed'), { createApp } = await load('app'), S = await load('postsApi');

// ---- pure rules -------------------------------------------------------------
let calls = 0; const slug = P.newSlug('BPA', ['bpa-aaaaaa'], () => (calls++ < 6 ? 0 : 0.5));
assert.notEqual(slug, 'bpa-aaaaaa', 'collisions are retried');
assert.match(P.newSlug('bpa', ['bpa-aaaaaa'], () => 0), /^bpa-[a-z0-9]{10}$/, 'a stuck generator still terminates');
assert.match(slug, /^bpa-[a-z0-9]{6}$/); assert(P.isSlug(slug));
assert(!P.isSlug('Bad Slug') && !P.isSlug('-x') && !P.isSlug('a'));
const content = { title: '标题', summary: '摘要', cover: 'materials/cover-bpa.svg', blocks: [{ id: '1', type: 'paragraph', text: '正文' }] };
let post = P.newPost({ id: 'POST-1', slug, program: 'bpa', author: '许瑾老师', authorEmail: 'XuJin@nexus.local', now: 't0', draft: content });
assert.equal(post.status, 'draft'); assert.equal(post.authorEmail, 'xujin@nexus.local'); assert.equal(P.postState(post), '草稿'); assert(!P.isPublic(post));
assert(P.postIssues({ ...post, author: ' ' }).some(i => i.includes('作者')));
assert.throws(() => P.publishPost({ ...post, draft: { ...content, title: '' } }, 't1'));
const live = P.publishPost(post, 't1');
assert.equal(live.status, 'published'); assert.equal(live.publishedAt, 't1'); assert(P.isPublic(live)); assert.equal(P.postState(live), '已发布');
assert.equal(P.postState(P.savePostDraft(live, { draft: { ...content, title: '改' } }, 't2')), '有未发布修改');
const gone = P.withdrawPost(live, 't3');
assert.equal(gone.status, 'withdrawn'); assert.equal(gone.published, null); assert.equal(P.postState(gone), '已撤回'); assert(!P.isPublic(gone));
assert.equal(P.withdrawPost(post, 't3').status, 'draft', 'withdrawing a draft keeps it a draft');
// Sales only ever get published snapshots.
const mixed = [post, live, gone, { ...live, id: 'POST-2', slug: 'bpa-second', program: 'ctb', authorEmail: 'fangyanqi@nexus.local', publishedAt: 't9' }];
assert.deepEqual(P.visiblePosts(mixed, 'sales').map(p => p.id), ['POST-1', 'POST-2']);
assert(P.visiblePosts(mixed, 'sales').every(p => JSON.stringify(p.draft) === JSON.stringify(p.published)));
assert.equal(P.visiblePosts(mixed, 'ops').length, 4);
assert.deepEqual(P.filterPosts(mixed, { program: 'ctb' }).map(p => p.id), ['POST-2']);
assert.equal(P.filterPosts(mixed, { status: 'withdrawn' }).length, 1);
assert.equal(P.filterPosts(mixed, { author: 'FANGYANQI@nexus.local' }).length, 1);
assert.equal(P.filterPosts(mixed, { q: 'bpa-second' }).length, 1);
// Local (Pages) metrics: like once per browser, view once per 30 min, share once per minute.
let m = P.emptyLocalMetrics(), r;
r = P.recordLocal(m, 'bpa-x1', 'like', 0); assert(r.counted); m = r.state;
r = P.recordLocal(m, 'bpa-x1', 'like', 9e9); assert(!r.counted); assert(P.likedLocally(m, 'bpa-x1'));
r = P.recordLocal(m, 'bpa-x1', 'view', 1000); assert(r.counted); m = r.state;
r = P.recordLocal(m, 'bpa-x1', 'view', 1000 + 29 * 60_000); assert(!r.counted);
r = P.recordLocal(m, 'bpa-x1', 'view', 1000 + 31 * 60_000); assert(r.counted); m = r.state;
r = P.recordLocal(m, 'bpa-x1', 'share', 5); assert(r.counted); m = r.state;
r = P.recordLocal(m, 'bpa-x1', 'share', 6); assert(!r.counted);
r = P.recordLocal(m, 'bpa-x1', 'share', 61_000); assert(r.counted); m = r.state;
assert.deepEqual(m.counts['bpa-x1'], { views: 2, shares: 2, likes: 1 });
assert(P.likedLocally(m, 'bpa-x1'), 'like key survives later time buckets');
assert.deepEqual(P.readLocalMetrics(JSON.parse(JSON.stringify(m))), m);
assert.deepEqual(P.readLocalMetrics({ counts: { 'bpa-x1': { views: -1, shares: 0, likes: 0 } } }).counts, {});
// Stored posts are validated; a slug can never be taken over by another id.
const merged = P.mergeStoredPosts(seedPosts, [{ ...live }, { ...live, id: 'POST-evil', slug: seedPosts[0].slug }, { id: 'x' }]);
assert.equal(merged.length, seedPosts.length + 1); assert.equal(merged.find(p => p.slug === seedPosts[0].slug).id, seedPosts[0].id);
assert.equal(P.mergeStoredPosts(seedPosts, 'junk').length, seedPosts.length);
// Seeds: unique slugs, published ones pass the publish rules.
assert.equal(new Set(seedPosts.map(p => p.slug)).size, seedPosts.length);
for (const p of seedPosts) { assert(P.isValidPost(p), p.id); if (p.status === 'published') assert.deepEqual(P.postIssues(p), [], p.id); }
// OG shell: escaped per-article tags, SVG covers swapped for PNG, generic tags when not public.
const html = P.shareShellHtml({ origin: 'https://best.example', slug: 'bpa-x1', article: { title: 'A "<b>" & B', summary: 'S', cover: 'materials/cover-bpa.svg', program: 'bpa' } });
assert(html.includes('<meta property="og:title" content="A &quot;&lt;b&gt;&quot; &amp; B">'));
assert(html.includes('content="https://best.example/materials/cover-bpa.png"'));
assert(html.includes('location.replace("/#/p/bpa-x1")'));
assert(P.shareShellHtml({ origin: 'https://best.example', slug: 'x-y', article: null }).includes('og-default.png'));

// ---- API (real app, in-memory posts, fake users table) -----------------------
const programs = ['bpa', 'ctb', 'conrad'].map(id => ({ id, name: id.toUpperCase() + ' 项目', short: id.toUpperCase(), type: '竞赛', color: 'violet' }));
const repo = S.memoryRepo(seedPosts, programs);
const users = { 1: { id: 1, email: 'xujin@nexus.local', username: '许瑾', name: '许瑾', role: 'ops', salesName: null, active: true, mustChangePassword: false },
  2: { id: 2, email: 'sales@nexus.demo', username: 'Alex', name: 'Alex', role: 'sales', salesName: '顾问 Alex', active: true, mustChangePassword: false },
  3: { id: 3, email: 'zhangjiejia@nexus.local', username: '张捷嘉', name: '张捷嘉', role: 'superadmin', salesName: null, active: true, mustChangePassword: false } };
let who = null; // the users row the fake db returns for the session lookup
const fakeDb = { select: () => ({ from: () => ({ where: () => ({ limit: async () => (who ? [who] : []) }) }) }), execute: async () => ({ rows: [] }) };
const config = { databaseUrl: 'x', jwtSecret: 'test-secret-0123456789-0123456789-abcdef', port: 0, host: '127.0.0.1', env: 'test', corsOrigins: [], publicOrigin: '' };
const app = createApp(fakeDb, config, new Date(), repo);
const tokenFor = async id => sign({ sub: String(id), role: users[id].role, exp: Math.floor(Date.now() / 1000) + 600 }, config.jwtSecret, 'HS256');
const call = async (method, path, { body, as, headers = {} } = {}) => {
  who = as ? users[as] : null;
  const h = { ...headers, ...(body ? { 'content-type': 'application/json' } : {}), ...(as ? { authorization: 'Bearer ' + await tokenFor(as) } : {}) };
  const res = await app.request(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
};
const V1 = 'visitor-aaaaaaaa', V2 = 'visitor-bbbbbbbb';

// Public reader: no Authorization header at all.
let res = await call('GET', '/api/public/articles/bpa-autumn-kickoff');
assert.equal(res.status, 200); assert.equal(res.json.article.title, seedPosts[0].published.title);
assert(!('draft' in res.json.article) && !('authorEmail' in res.json.article), 'public view hides draft and author email');
assert.equal(res.json.article.program.short, 'BPA'); assert.equal(res.json.liked, false);
assert.equal((await call('GET', '/api/public/articles/conrad-prototype-week')).status, 404, 'drafts are not public');
assert.equal((await call('GET', '/api/public/articles/no-such-post')).status, 404);
assert.equal((await call('GET', '/api/public/articles/BAD%20SLUG')).status, 404);
// Counters: idempotent per visitor.
res = await call('POST', '/api/public/articles/bpa-autumn-kickoff/view', { body: { visitor: V1 } }); assert.equal(res.status, 200); assert.equal(res.json.counted, true);
res = await call('POST', '/api/public/articles/bpa-autumn-kickoff/view', { body: { visitor: V1 } }); assert.equal(res.json.counted, false); assert.equal(res.json.metrics.views, 1);
res = await call('POST', '/api/public/articles/bpa-autumn-kickoff/view', { body: { visitor: V2 } }); assert.equal(res.json.metrics.views, 2);
res = await call('POST', '/api/public/articles/bpa-autumn-kickoff/like', { body: { visitor: V1 } }); assert.equal(res.json.counted, true); assert.equal(res.json.liked, true);
res = await call('POST', '/api/public/articles/bpa-autumn-kickoff/like', { body: { visitor: V1 } }); assert.equal(res.json.counted, false); assert.equal(res.json.metrics.likes, 1);
res = await call('POST', '/api/public/articles/bpa-autumn-kickoff/share', { body: { visitor: V1 } }); assert.equal(res.json.metrics.shares, 1);
res = await call('POST', '/api/public/articles/bpa-autumn-kickoff/share', { body: { visitor: V1 } }); assert.equal(res.json.counted, false, 'repeated share clicks within a minute count once');
assert.equal((await call('GET', `/api/public/articles/bpa-autumn-kickoff?visitor=${V1}`)).json.liked, true);
assert.equal((await call('POST', '/api/public/articles/bpa-autumn-kickoff/view', { body: { visitor: 'x' } })).status, 400, 'visitor id required');
assert.equal((await call('POST', '/api/public/articles/bpa-autumn-kickoff/delete', { body: { visitor: V1 } })).status, 404);
assert.equal((await call('POST', '/api/public/articles/conrad-prototype-week/like', { body: { visitor: V1 } })).status, 404, 'no metrics on drafts');
// Signed-in routes still need a token.
assert.equal((await call('GET', '/api/posts')).status, 401);
assert.equal((await call('PUT', '/api/posts/POST-new', { body: {} })).status, 401);
// Sales: published snapshots only, read-only.
res = await call('GET', '/api/posts', { as: 2 });
assert.equal(res.status, 200); assert.deepEqual(res.json.posts.map(p => p.slug).sort(), ['bpa-autumn-kickoff', 'ctb-research-guide']);
const fresh = P.newPost({ id: 'POST-api-1', slug: 'bpa-apitest', program: 'bpa', author: '许瑾老师', authorEmail: 'xujin@nexus.local', now: 't', draft: content });
assert.equal((await call('PUT', '/api/posts/POST-api-1', { as: 2, body: fresh })).status, 403, 'sales cannot write');
// Ops: create draft, metrics from the client are ignored, publishing is gated.
res = await call('PUT', '/api/posts/POST-api-1', { as: 1, body: { ...fresh, metrics: { views: 999, shares: 0, likes: 0 } } });
assert.equal(res.status, 200); assert.equal(res.json.record.metrics.views, 0); assert.equal(res.json.record.status, 'draft');
assert.equal((await call('GET', '/api/public/articles/bpa-apitest')).status, 404);
res = await call('PUT', '/api/posts/POST-api-1', { as: 1, body: { ...fresh, status: 'published', published: { ...content, cover: '' } } });
assert.equal(res.status, 400); assert(res.json.issues.some(i => i.includes('封面')));
assert.equal((await call('PUT', '/api/posts/POST-api-1', { as: 1, body: { ...fresh, status: 'withdrawn' } })).status, 409, 'cannot withdraw a draft');
res = await call('PUT', '/api/posts/POST-api-1', { as: 1, body: P.publishPost(fresh, 't') });
assert.equal(res.status, 200); assert.equal(res.json.record.status, 'published'); assert.match(res.json.record.publishedAt, /^\d{4}-\d\d-\d\d \d\d:\d\d$/);
assert.equal((await call('GET', '/api/public/articles/bpa-apitest')).status, 200, 'published post is public');
assert.equal((await call('PUT', '/api/posts/POST-api-1', { as: 1, body: { ...fresh, slug: 'bpa-renamed' } })).status, 400, 'slug is immutable');
assert.equal((await call('PUT', '/api/posts/POST-api-2', { as: 1, body: { ...fresh, id: 'POST-api-2' } })).status, 409, 'slug unique');
assert.equal((await call('PUT', '/api/posts/POST-api-3', { as: 1, body: { ...fresh, id: 'POST-api-3', slug: 'bpa-other', program: 'nope' } })).status, 400, 'unknown project');
assert.equal((await call('PUT', '/api/posts/POST-api-1', { as: 1, body: { ...fresh, status: 'draft' } })).status, 409, 'published posts are withdrawn, not reset to draft');
// Superadmin withdraws: public link and metrics endpoints go dark, sales lose it.
res = await call('PUT', '/api/posts/POST-api-1', { as: 3, body: P.withdrawPost(P.publishPost(fresh, 't'), 't') });
assert.equal(res.status, 200); assert.equal(res.json.record.status, 'withdrawn'); assert.equal(res.json.record.authorEmail, 'xujin@nexus.local', 'author kept');
assert.equal((await call('GET', '/api/public/articles/bpa-apitest')).status, 404);
assert.equal((await call('POST', '/api/public/articles/bpa-apitest/view', { body: { visitor: V1 } })).status, 404);
assert(!(await call('GET', '/api/posts', { as: 2 })).json.posts.some(p => p.slug === 'bpa-apitest'));
assert((await call('GET', '/api/posts', { as: 1 })).json.posts.some(p => p.slug === 'bpa-apitest' && p.status === 'withdrawn'));
// Republish after withdrawal.
assert.equal((await call('PUT', '/api/posts/POST-api-1', { as: 1, body: P.publishPost(fresh, 't') })).status, 200);
// OG share shell outside /api.
res = await call('GET', '/a/ctb-research-guide', { headers: { host: 'best.example', 'x-forwarded-proto': 'https' } });
assert.equal(res.status, 200); assert(res.text.includes(`<meta property="og:title" content="${seedPosts[1].published.title}">`));
assert(res.text.includes('https://best.example/materials/cover-ctb.png')); assert(res.text.includes('og:url" content="https://best.example/a/ctb-research-guide"'));
res = await call('GET', '/a/conrad-prototype-week'); assert.equal(res.status, 404); assert(!res.text.includes(seedPosts[2].draft.title), 'draft titles never leak into link previews');
// Per-IP throttle.
const allow = S.throttle(3, 1000); assert(allow('ip', 0) && allow('ip', 1) && allow('ip', 2)); assert(!allow('ip', 3)); assert(allow('ip', 1001));

console.log('推文: workflow, local metrics dedupe, public API without login, publish gating, roles, slug rules and OG share shell passed.');
