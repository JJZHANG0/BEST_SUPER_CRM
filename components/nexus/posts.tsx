'use client';
/**
 * 推文: overall list (filter by project / status / author), per-post editor (reuses the 项目书 block
 * editor), in-app reader, and the public page #/p/<slug> that works without signing in.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CircleAlert, Copy, ExternalLink, Eye, EyeOff, Heart, Link2, Newspaper, PenLine, Save, Send, Share2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useNexus } from '@/lib/nexus/store';
import { publicApi, visitorId, type PublicArticle as PublicArticleData } from '@/lib/nexus/api';
import { copyText } from '@/lib/nexus/clipboard';
import { filterPosts, isPublic, postIssues, postState, postStatusLabels, postStatuses, publishPost, savePostDraft, visiblePosts, withdrawPost, type ArticlePost, type PostMetrics, type PostStatus } from '@/lib/nexus/posts';
import type { ArticleContent } from '@/lib/nexus/articles';
import type { Program } from '@/lib/nexus/data';
import { ArticleView, ContentSections, resolveSrc, stamp, stateTone, useUnsavedWarning } from './articles';
import { Back, Badge, EmptyState, FormField, NoResults, Notice, PageTitle, Picker, SearchBox, SectionTitle } from './ui';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const LOCAL_ONLY = '预览站仅统计本机数据';
/** Public link: on the server build /a/<slug> (per-article OG tags, then the SPA); on Pages the hash route. */
export function publicUrl(slug: string, apiMode: boolean) {
  const origin = typeof location === 'undefined' ? '' : location.origin;
  return apiMode ? `${origin}/a/${slug}` : `${origin}${BASE}/#/p/${slug}`;
}
const isWeChat = () => typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);
const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** Share: Web Share API on phones (not available inside WeChat), otherwise copy the link. Counts one share per click. */
async function sharePost(input: { slug: string; title: string; summary: string; apiMode: boolean; track: () => unknown }) {
  const url = publicUrl(input.slug, input.apiMode);
  if (typeof navigator !== 'undefined' && navigator.share && coarse() && !isWeChat()) {
    try { await navigator.share({ title: input.title, text: input.summary, url }); input.track(); return; }
    catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  }
  if (await copyText(url)) { input.track(); toast.success(isWeChat() ? '链接已复制。也可以点右上角「···」发送给朋友' : '推文链接已复制，可粘贴到微信发送'); }
  else toast.error('浏览器限制了复制，请长按地址栏复制链接');
}

export function Metrics({ m, compact = false }: { m: PostMetrics; compact?: boolean }) {
  return <span className={'post-metrics' + (compact ? ' compact' : '')}><span title="阅读"><Eye size={13} />{m.views}</span><span title="分享"><Share2 size={13} />{m.shares}</span><span title="点赞"><Heart size={13} />{m.likes}</span></span>;
}
function usePosts() { const s = useNexus(); return useMemo(() => visiblePosts(s.posts, s.role), [s.posts, s.role]); }

function NewPostDialog({ open, onOpenChange, program }: { open: boolean; onOpenChange: (v: boolean) => void; program?: string }) {
  const s = useNexus();
  const [pick, setPick] = useState(program || s.programs[0]?.id || '');
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogTitle>写推文</DialogTitle><DialogDescription>选择推文所属的项目。创建后会生成固定的公开链接，发布后才能访问。</DialogDescription>
    <FormField label="所属项目"><Picker label="所属项目" value={pick} onChange={setPick} options={s.programs.map(p => ({ value: p.id, label: `${p.short} · ${p.name}` }))} /></FormField>
    <div className="actions"><button className="secondary" onClick={() => onOpenChange(false)}>取消</button><button className="primary" disabled={!pick} onClick={() => { const id = s.createPost(pick); onOpenChange(false); s.go('articles/' + id + '/edit'); }}><PenLine size={16} />开始编辑</button></div>
  </DialogContent></Dialog>;
}

export function PostsPage() {
  const s = useNexus(), ops = s.role !== 'sales', posts = usePosts();
  const initial = new URLSearchParams(s.route.split('?')[1]).get('program') || '';
  const [program, setProgram] = useState(s.programs.some(p => p.id === initial) ? initial : ''), [status, setStatus] = useState<PostStatus | ''>(''), [author, setAuthor] = useState(''), [q, setQ] = useState(''), [creating, setCreating] = useState(false);
  const authors = [...new Set(posts.map(p => p.authorEmail).filter(Boolean))];
  const list = filterPosts(posts, { program, status, author, q });
  const total = list.reduce((m, p) => { const x = s.postMetrics(p); return { views: m.views + x.views, shares: m.shares + x.shares, likes: m.likes + x.likes }; }, { views: 0, shares: 0, likes: 0 });
  return <>
    <PageTitle title="推文" en="ARTICLES" description={ops ? '像公众号一样为每个项目写推文：草稿 → 发布 → 撤回。发布后有公开链接，家长无需登录即可阅读。' : '运营老师发布的项目推文，复制链接即可分享给家长。'} action={ops ? '写推文' : undefined} onAction={() => setCreating(true)} />
    <div className="glass panel">
      <div className="filter-toolbar post-filters">
        <SearchBox value={q} onChange={setQ} placeholder="搜索推文标题、摘要或作者" />
        <Picker label="所属项目" value={program} onChange={setProgram} options={[{ value: '', label: '全部项目' }, ...s.programs.map(p => ({ value: p.id, label: `${p.short} · ${p.name}` }))]} />
        {ops && <Picker label="推文状态" value={status} onChange={v => setStatus(v as PostStatus | '')} options={[{ value: '', label: '全部状态' }, ...postStatuses.map(k => ({ value: k, label: postStatusLabels[k] }))]} />}
        {ops && <Picker label="作者" value={author} onChange={setAuthor} options={[{ value: '', label: '全部作者' }, ...authors.map(e => ({ value: e, label: s.staffName(e) }))]} />}
      </div>
      <div className="results-meta">共 {list.length} 篇推文{ops && <span className="post-total"><BarChart3 size={13} />合计 阅读 {total.views} · 分享 {total.shares} · 点赞 {total.likes}{!s.apiMode && ` · ${LOCAL_ONLY}`}</span>}</div>
      <div className="post-list">{list.map(p => <PostRow key={p.id} post={p} />)}</div>
      {!list.length && (posts.length ? <NoResults /> : <EmptyState icon={Newspaper} title="还没有推文" description={ops ? '为项目写第一篇推文，发布后即可分享公开链接。' : '运营老师发布推文后会显示在这里。'} action={ops ? '写推文' : undefined} onAction={() => setCreating(true)} />)}
    </div>
    {ops && <NewPostDialog open={creating} onOpenChange={setCreating} program={program || undefined} />}
  </>;
}

function PostRow({ post }: { post: ArticlePost }) {
  const s = useNexus(), ops = s.role !== 'sales';
  const p = s.programs.find(x => x.id === post.program), c = post.draft, state = postState(post), live = isPublic(post);
  return <article className="post-row">
    <button className="post-thumb" onClick={() => s.go('articles/' + post.id)} aria-label={`阅读${c.title || '未命名推文'}`}><img src={resolveSrc(c.cover || `materials/cover-${post.program}.svg`)} alt="" loading="lazy" /></button>
    <div className="post-main">
      <button className="post-title" onClick={() => s.go('articles/' + post.id)}>{c.title || '未命名推文'}</button>
      <div className="post-meta"><span className={'code-chip ' + (p?.color || 'violet')}>{p?.short || post.program}</span><span>{post.author || '未署名'}</span><span>{post.publishedAt ? `发布于 ${post.publishedAt}` : `更新于 ${post.updated}`}</span>{ops && <Badge tone={stateTone(state)}>{state}</Badge>}</div>
      <p>{c.summary || '（暂无摘要）'}</p>
    </div>
    <div className="post-side">
      {ops && <Metrics m={s.postMetrics(post)} />}
      <div className="post-actions">
        {live && <button className="secondary compact-action" onClick={() => sharePost({ slug: post.slug, title: c.title, summary: c.summary, apiMode: s.apiMode, track: () => s.trackPost(post.slug, 'share') })}><Link2 size={14} />分享链接</button>}
        {ops && <button className="secondary compact-action" onClick={() => s.go('articles/' + post.id + '/edit')}><PenLine size={14} />编辑</button>}
      </div>
    </div>
  </article>;
}

function PublicLinkBox({ post }: { post: ArticlePost }) {
  const s = useNexus(), url = publicUrl(post.slug, s.apiMode), live = isPublic(post);
  return <div className="public-link-box">
    <span className="public-link-label">公开链接{live ? '' : '（发布后可访问）'}</span>
    <div className="public-link-row"><input readOnly value={url} aria-label="公开链接" onFocus={e => e.target.select()} /><button className="icon-button" aria-label="复制公开链接" onClick={async () => { if (await copyText(url)) { toast.success('链接已复制'); if (live) s.trackPost(post.slug, 'share'); } }}><Copy size={16} /></button>{live && <a className="icon-button" aria-label="新窗口打开公开页" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /></a>}</div>
    <small>{s.apiMode ? '/a/ 链接带有该推文的分享卡片信息（标题、摘要、封面），打开后自动进入阅读页。' : '预览站链接：只有内置示例推文和本浏览器创建的推文可以在本机打开。'}</small>
  </div>;
}
function MetricTiles({ post }: { post: ArticlePost }) {
  const s = useNexus(), m = s.postMetrics(post);
  return <><dl className="metric-tiles"><div><dt><Eye size={14} />阅读</dt><dd>{m.views}</dd></div><div><dt><Share2 size={14} />分享</dt><dd>{m.shares}</dd></div><div><dt><Heart size={14} />点赞</dt><dd>{m.likes}</dd></div></dl>
    <small className="metric-note">阅读：公开页打开（同一访客 30 分钟内计 1 次）；分享：点击分享 / 复制链接；点赞：每个浏览器 1 次。{!s.apiMode && <b> {LOCAL_ONLY}。</b>}</small></>;
}

export function PostReader({ id }: { id: string }) {
  const s = useNexus(), ops = s.role !== 'sales', posts = usePosts();
  const post = posts.find(p => p.id === id), p = s.programs.find(x => x.id === post?.program);
  if (!post || !p) return <><Back to="articles" label="返回推文列表" /><NoResults /></>;
  const content = post.published ?? (ops ? post.draft : null), state = postState(post);
  if (!content) return <><Back to="articles" label="返回推文列表" /><Notice>该推文暂不可阅读。</Notice></>;
  const more = posts.filter(x => x.program === post.program && x.id !== post.id && isPublic(x)).slice(0, 4);
  return <>
    <Back to="articles" label="返回推文列表" />
    {ops && <div className="glass article-ops-bar"><Badge tone={stateTone(state)}>{state}</Badge><span>{isPublic(post) ? (state === '有未发布修改' ? '当前显示已发布版本，草稿中的修改发布后才会更新。' : `已发布 · ${post.publishedAt} · 公开链接可访问`) : post.status === 'withdrawn' ? '已撤回：公开链接与销售端都已不可见，显示的是草稿。' : '草稿预览：发布后销售端与公开链接才可见。'}</span><button className="primary" onClick={() => s.go(`articles/${id}/edit`)}><PenLine size={16} />编辑推文</button></div>}
    <div className="article-layout">
      <article className="glass article-paper">
        <ArticleView content={content} program={p} author={post.author} date={isPublic(post) ? post.publishedAt : null} />
        <div className="article-actions">{isPublic(post) && <button className="primary" onClick={() => sharePost({ slug: post.slug, title: content.title, summary: content.summary, apiMode: s.apiMode, track: () => s.trackPost(post.slug, 'share') })}><Share2 size={16} />分享给家长</button>}<button className="secondary" onClick={() => s.go(`programs/${p.id}/article`)}>查看项目书</button></div>
      </article>
      <aside className="article-aside">
        {ops && <section className="glass panel"><SectionTitle title="数据" sub="阅读 · 分享 · 点赞" /><MetricTiles post={post} /></section>}
        <section className="glass panel"><SectionTitle title="分享" /><PublicLinkBox post={post} /></section>
        {more.length > 0 && <section className="glass panel article-more"><SectionTitle title={`${p.short} 的更多推文`} />{more.map(o => <button key={o.id} className="article-more-item" onClick={() => s.go('articles/' + o.id)}><img src={resolveSrc(o.published!.cover)} alt="" loading="lazy" /><span><strong>{o.published!.title}</strong><small>{o.author}</small></span></button>)}</section>}
      </aside>
    </div>
  </>;
}

export function PostEditor({ id }: { id: string }) {
  const s = useNexus();
  const post = s.posts.find(p => p.id === id), p = s.programs.find(x => x.id === post?.program);
  const [draft, setDraft] = useState<ArticleContent | null>(() => (post ? JSON.parse(JSON.stringify(post.draft)) : null));
  const [author, setAuthor] = useState(post?.author ?? ''), [dirty, setDirty] = useState(false), [issues, setIssues] = useState<string[]>([]);
  useUnsavedWarning(dirty);
  if (s.role === 'sales') return <><Back to="articles" label="返回推文列表" /><Notice>编辑与发布推文仅对项目运营老师开放。</Notice></>;
  if (!post || !p || !draft) return <><Back to="articles" label="返回推文列表" /><NoResults /></>;
  const update = (patch: Partial<ArticleContent>) => { setDraft(d => ({ ...d!, ...patch })); setDirty(true); if (issues.length) setIssues([]); };
  const apply = (fn: (x: ArticlePost) => ArticlePost) => s.updatePosts(list => list.map(x => (x.id === id ? fn(x) : x)));
  const save = () => { apply(x => savePostDraft(x, { draft, author }, stamp())); setDirty(false); s.log('保存推文草稿：' + (draft.title || post.slug)); toast.success(isPublic(post) ? '草稿已保存，公开页仍显示已发布版本' : '草稿已保存'); };
  const publish = () => {
    const found = postIssues({ author, draft }); setIssues(found);
    if (found.length) { toast.error(found[0]); return; }
    const t = stamp(); apply(x => publishPost(savePostDraft(x, { draft, author }, t), t));
    setDirty(false); s.log('发布推文：' + draft.title); toast.success('推文已发布，公开链接已可访问');
  };
  const withdraw = () => { apply(x => withdrawPost(x, stamp())); s.log('撤回推文：' + draft.title); toast.info('已撤回：公开链接与销售端将不再显示这篇推文'); };
  const state = postState(post);
  return <>
    <Back to="articles" label="返回推文列表" />
    <PageTitle title="编辑推文" en="ARTICLE STUDIO" description={`${p.short} · ${p.name} · 写好后发布，即可通过公开链接分享给家长`} />
    <div className="glass composer-bar">
      <div className="composer-status"><Badge tone={stateTone(state)}>{state}</Badge><span>{dirty ? '有未保存的修改' : `已保存 · ${post.updated}`}</span>{post.publishedAt && <span>上次发布 {post.publishedAt}</span>}</div>
      <div className="composer-actions">
        {post.status === 'published' && <button className="secondary" onClick={withdraw}><EyeOff size={16} />撤回</button>}
        <button className="secondary" onClick={() => s.go(`articles/${id}`)}><Eye size={16} />阅读视图</button>
        <button className="secondary" onClick={save} disabled={!dirty}><Save size={16} />保存草稿</button>
        <button className="primary" onClick={publish}><Send size={16} />{post.status === 'published' ? '更新发布' : post.status === 'withdrawn' ? '重新发布' : '发布推文'}</button>
      </div>
    </div>
    {issues.length > 0 && <div className="composer-issues" role="alert"><CircleAlert size={18} /><div><strong>发布前请完善以下内容</strong><ul>{issues.map(i => <li key={i}>{i}</li>)}</ul></div></div>}
    {!s.persisted && <Notice>保存失败：{s.apiMode ? '服务器暂时不可用，请稍后重试。' : '浏览器存储空间不足，请压缩或减少上传的图片。'}</Notice>}
    <div className="composer">
      <div className="composer-main">
        <section className="glass panel composer-section"><SectionTitle title="署名" sub="显示在标题下方，例如：许瑾老师" />
          <div className="form-columns"><FormField label="作者署名"><input value={author} maxLength={40} placeholder="例如：许瑾老师" onChange={e => { setAuthor(e.target.value); setDirty(true); }} /></FormField><FormField label="所属项目"><input value={`${p.short} · ${p.name}`} readOnly disabled /></FormField></div>
        </section>
        <ContentSections draft={draft} update={update} program={p.id} kind="推文" />
      </div>
      <aside className="composer-preview post-sidebar" aria-label="发布与数据">
        <section className="glass panel"><SectionTitle title="发布与数据" sub={`链接标识 ${post.slug}`} /><MetricTiles post={post} /><PublicLinkBox post={post} /></section>
        <div className="composer-preview-label"><Smartphone size={15} />实时预览 · 手机阅读效果</div>
        <div className="phone-frame"><div className="phone-screen"><ArticleView compact content={draft} program={p} author={author || '未署名'} date={post.publishedAt} /></div></div>
      </aside>
    </div>
  </>;
}

/** #/p/<slug>: public, mobile-first reader. No login, no workspace chrome. */
export function PublicArticle({ slug }: { slug: string }) {
  const s = useNexus();
  const local = !s.apiMode ? s.posts.find(p => p.slug === slug && isPublic(p)) : undefined;
  const [remote, setRemote] = useState<{ article: PublicArticleData; liked: boolean } | null | 'missing'>(null);
  const [metrics, setMetrics] = useState<PostMetrics | null>(null), [liked, setLiked] = useState(false);
  const viewed = useRef(false);
  useEffect(() => {
    if (!s.apiMode) return;
    let alive = true;
    publicApi.article(slug, visitorId()).then(r => { if (alive) { setRemote(r); setMetrics(r.article.metrics); setLiked(r.liked); } }).catch(() => alive && setRemote('missing'));
    return () => { alive = false; };
  }, [slug, s.apiMode]);
  const ready = s.apiMode ? remote !== null && remote !== 'missing' : !!local;
  const title = s.apiMode ? (remote && remote !== 'missing' ? remote.article.title : '') : local?.published?.title ?? '';
  useEffect(() => {
    if (!ready || viewed.current) return;
    viewed.current = true;
    s.trackPost(slug, 'view').then(r => { if (r) { setMetrics(r.metrics); setLiked(r.liked); } });
  }, [ready, slug, s]);
  useEffect(() => {
    if (!title) return;
    // The framework may re-apply the site <title> right after hydration; set it again shortly after.
    const set = () => { document.title = title + ' · B.E.S.T'; };
    set(); const t = [setTimeout(set, 300), setTimeout(set, 1500)];
    return () => { t.forEach(clearTimeout); document.title = 'B.E.S.T · 内部超级管理系统'; };
  }, [title]);
  useEffect(() => { document.documentElement.dataset.workspace = 'public'; }, []);
  if (s.apiMode && remote === null) return <div className="pub-shell"><div className="pub-loading">正在打开推文…</div></div>;
  if (!ready) return <div className="pub-shell"><div className="pub-missing"><Newspaper size={30} /><h1>推文不存在或已撤回</h1><p>请向分享给你的老师确认链接。{!s.apiMode && ' 预览站只能打开内置示例推文和本浏览器创建的推文。'}</p></div></div>;
  const a = s.apiMode && remote && remote !== 'missing' ? remote.article : null;
  const content: ArticleContent = a ? { title: a.title, summary: a.summary, cover: a.cover, blocks: a.blocks } : local!.published!;
  const program = (a ? { ...a.program, en: '', description: '', date: '', status: '', curriculum: '', published: true } : s.programs.find(x => x.id === local!.program)) as Program | undefined;
  const fallback = { id: '', name: '', en: '', short: 'BEST', type: '项目推文', color: 'violet', description: '', date: '', status: '', curriculum: '', published: true } as Program;
  const m = metrics ?? (local ? s.postMetrics(local) : a!.metrics), isLiked = liked || (!s.apiMode && s.likedLocal(slug));
  const like = async () => { if (isLiked) return; setLiked(true); const r = await s.trackPost(slug, 'like'); if (r) setMetrics(r.metrics); };
  const share = () => sharePost({ slug, title: content.title, summary: content.summary, apiMode: s.apiMode, track: async () => { const r = await s.trackPost(slug, 'share'); if (r) setMetrics(r.metrics); } });
  return <div className="pub-shell">
    <main className="pub-article">
      <ArticleView content={content} program={program ?? fallback} author={a ? a.author : local!.author} date={a ? a.publishedAt : local!.publishedAt} />
      <div className="pub-stats"><span>阅读 {m.views}</span>{!s.apiMode && <span className="pub-local">{LOCAL_ONLY}</span>}</div>
    </main>
    <nav className="pub-bar" aria-label="推文操作">
      <button className={'pub-like' + (isLiked ? ' liked' : '')} aria-pressed={isLiked} onClick={like}><Heart size={19} fill={isLiked ? 'currentColor' : 'none'} /><span>{isLiked ? '已赞' : '点赞'} {m.likes}</span></button>
      <button className="pub-share" onClick={share}><Share2 size={19} /><span>分享</span></button>
    </nav>
    <footer className="pub-foot">B.E.S.T · 项目推文</footer>
  </div>;
}

