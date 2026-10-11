'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, CalendarDays, ChevronRight, CircleAlert, Clock, Copy, Eye, EyeOff, Heading2, Image as ImageGlyph, ImagePlus, Lightbulb, PenLine, Pilcrow, Plus, Quote, RotateCcw, Save, Send, Smartphone, Sparkles, Star, Trash2, UserCheck, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNexus } from '@/lib/nexus/store';
import { assetUrl } from '@/lib/nexus/assets';
import { cohortAvailability, cohortOffers, money, programOffers } from '@/lib/nexus/recruitment';
import { articleIssues, articleState, blockLabels, highlightKinds, highlightLabels, LIMITS, moveBlock, newBlock, publishArticle, readingMinutes, saveDraft, shareText, unpublishArticle, type ArticleBlock, type ArticleContent, type BlockType, type HighlightKind } from '@/lib/nexus/articles';
import { articleContentFor } from '@/lib/nexus/article-seed';
import type { Program } from '@/lib/nexus/data';
import { Back, Badge, Choice, FormField, NoResults, Notice, PageTitle, ProgramMark, SearchBox, SectionTitle } from './ui';
import { Poster } from './recruitment';

/** Asset paths are stored relative (works under the Pages base path); uploads are data URLs. */
export const resolveSrc = (src: string) => (!src ? '' : /^(data:|blob:|https?:)/.test(src) ? src : assetUrl(src));
const stamp = () => { const d = new Date(), pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const highlightIcon = { price: Wallet, schedule: CalendarClock, eligibility: UserCheck, tip: Lightbulb } as const;
const blockIcon = { heading: Heading2, paragraph: Pilcrow, image: ImageGlyph, highlight: Sparkles, quote: Quote } as const;
const stateTone = (s: string) => (s === '已发布' ? 'green' : s === '未发布' ? 'neutral' : 'orange');

function Blocks({ blocks }: { blocks: ArticleBlock[] }) {
  return <>{blocks.map(b => {
    switch (b.type) {
      case 'heading': return b.text.trim() ? <h2 key={b.id} className="article-h2">{b.text}</h2> : null;
      case 'paragraph': return b.text.trim() ? <p key={b.id} className="article-p">{b.text}</p> : null;
      case 'quote': return b.text.trim() ? <blockquote key={b.id} className="article-quote">{b.text}</blockquote> : null;
      case 'image': return b.src ? <figure key={b.id} className="article-figure"><img src={resolveSrc(b.src)} alt={b.caption || '推文配图'} loading="lazy" />{b.caption && <figcaption>{b.caption}</figcaption>}</figure> : null;
      case 'highlight': {
        const Icon = highlightIcon[b.kind];
        const items = b.items.filter(i => i.label.trim() || i.value.trim());
        return <section key={b.id} className={'article-highlight ' + b.kind}><h3><Icon size={16} />{b.title || highlightLabels[b.kind]}</h3><dl>{items.map((i, n) => <div key={n}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl></section>;
      }
    }
  })}</>;
}

/** WeChat-article style rendering shared by the sales reader and the ops live preview. */
export function ArticleView({ content, program, author, date, compact = false }: { content: ArticleContent; program: Program; author: string; date: string | null; compact?: boolean }) {
  return <div className={'article-view' + (compact ? ' compact' : '')}>
    <div className="article-kicker"><ProgramMark program={program} small /><span>{program.type} · {program.short}</span></div>
    <h1 className="article-title">{content.title || '未命名推文'}</h1>
    <div className="article-meta"><span>{author}</span><span>{date ? `发布于 ${date}` : '草稿 · 尚未发布'}</span><span><Clock size={13} />约 {readingMinutes(content)} 分钟读完</span></div>
    {content.cover ? <img className="article-cover" src={resolveSrc(content.cover)} alt={`${program.name}推文封面`} /> : <div className="article-cover placeholder"><ImageGlyph size={26} />请选择封面</div>}
    {content.summary && <p className="article-summary">{content.summary}</p>}
    <Blocks blocks={content.blocks} />
    <p className="article-end">以上为演示内容，正式信息以签约报价与项目公告为准</p>
  </div>;
}

export function ProgramHub() {
  const s = useNexus(), ops = s.role !== 'sales';
  const [q, setQ] = useState(''), [type, setType] = useState('全部项目'), [status, setStatus] = useState('全部状态');
  const articleFor = (id: string) => s.articles.find(a => a.program === id);
  const list = s.programs.filter(p => {
    const a = articleFor(p.id), c = ops ? a?.draft : a?.published;
    const hay = (p.name + p.en + (c?.title ?? '') + (c?.summary ?? '')).toLowerCase();
    return hay.includes(q.trim().toLowerCase()) && (type === '全部项目' || type === p.type || (type === '我的收藏' && s.favorites.includes(p.id)) || (type === '最近浏览' && s.recent.includes(p.id))) && (status === '全部状态' || p.status === status);
  });
  const open = (p: Program) => { s.setRecent(v => [p.id, ...v.filter(x => x !== p.id)].slice(0, 8)); s.go('programs/' + p.id + '/article'); };
  return <>
    <PageTitle title="项目中心" en="PROGRAM HUB" description={ops ? '像排版公众号推文一样编排项目介绍，发布后销售老师即可阅读与分享。' : '阅读每个项目的介绍推文：亮点、课程、时间与费用一目了然。'} />
    <div className="sticky-filters"><div className="filter-toolbar"><SearchBox value={q} onChange={setQ} placeholder="搜索项目或推文标题，例如 BPA" /><Choice value={status} onChange={setStatus} options={['全部状态', '招生中', '滚动招生', '预报名', '筹备中']} label="招生状态" /></div><div className="filter-chips">{['全部项目', '我的收藏', '最近浏览', ...new Set(s.programs.map(p => p.type))].map(t => <button className={type === t ? 'selected' : ''} key={t} onClick={() => setType(t)}>{t === '我的收藏' && <Star size={14} />} {t}</button>)}</div></div>
    <div className="results-meta">共 {list.length} 个项目 <span>{ops ? '推文保存在本浏览器（演示）· 发布后销售端可见' : '项目介绍由运营老师发布 · 内容为演示'}</span></div>
    <div className="program-grid article-grid">{list.map(p => {
      const a = articleFor(p.id), c = ops ? a?.draft : a?.published, state = a ? articleState(a) : '未发布', readable = !!a?.published;
      const fav = s.favorites.includes(p.id);
      return <article className="glass program-card article-card" key={p.id}>
        <button className="article-card-cover" onClick={() => (readable || ops) && open(p)} disabled={!readable && !ops} aria-label={readable || ops ? `阅读${p.name}项目介绍` : `${p.name}项目介绍筹备中`}>
          <img src={resolveSrc(c?.cover || `materials/cover-${p.id}.svg`)} alt="" loading="lazy" />
          {!readable && <span className="article-card-flag">{ops ? '草稿 · 销售端不可见' : '介绍筹备中'}</span>}
        </button>
        <div className="article-card-body">
          <div className="card-top"><span className="article-card-program"><ProgramMark program={p} small /><span>{p.short}<small>{p.type}</small></span></span><button className={'icon-button favorite ' + (fav ? 'is-favorite' : '')} aria-label={`${fav ? '取消收藏' : '收藏'}${p.name}`} onClick={() => s.setFavorites(v => v.includes(p.id) ? v.filter(x => x !== p.id) : [...v, p.id])}><Star size={18} fill={fav ? 'currentColor' : 'none'} /></button></div>
          <h2>{c?.title || p.name}</h2>
          <small className="article-card-name">{p.name}</small>
          <p>{c?.summary || p.description}</p>
          <div className="program-card-meta"><Badge tone={p.status === '筹备中' ? 'neutral' : 'green'}>{p.status}</Badge>{ops && <Badge tone={stateTone(state)}>推文{state}</Badge>}<span><CalendarDays size={14} />{p.date}</span></div>
          <div className="article-card-actions">
            {readable || ops ? <button className="card-link" onClick={() => open(p)}>{readable ? '阅读项目介绍' : '预览草稿'}<ChevronRight size={16} /></button> : <span className="card-link is-disabled">介绍即将发布</span>}
            <button className="text-button" onClick={() => s.go('programs/' + p.id)}>招生详情</button>
            {ops && <button className="secondary compact-action" onClick={() => s.go('programs/' + p.id + '/compose')}><PenLine size={15} />编辑推文</button>}
          </div>
        </div>
      </article>;
    })}</div>{!list.length && <NoResults />}
  </>;
}

export function ArticleReader({ id }: { id: string }) {
  const s = useNexus(), ops = s.role !== 'sales';
  const p = s.programs.find(x => x.id === id), a = s.articles.find(x => x.program === id);
  if (!p || !a) return <NoResults />;
  const preview = ops && !a.published;
  const content = a.published ?? (ops ? a.draft : null);
  if (!content) return <><Back to="programs" label="返回项目中心" /><Notice>该项目的介绍推文正在筹备中，运营老师发布后即可阅读。</Notice></>;
  const offer = programOffers[id];
  const remaining = s.teams.filter(t => t.program === id).reduce((n, t) => { const c = cohortAvailability(t, s.enrollments); return n + (c.status === '招生中' ? c.remaining : 0); }, 0);
  const others = s.programs.filter(x => x.id !== id && s.articles.find(o => o.program === x.id)?.published).slice(0, 3);
  const copy = async () => { try { await navigator.clipboard.writeText(shareText(content, p.name)); toast.success('分享文案已复制，可直接粘贴到微信'); } catch { toast.error('浏览器限制了复制，可直接选择页面文字复制。'); } };
  const state = articleState(a);
  return <>
    <Back to="programs" label="返回项目中心" />
    {ops && <div className="glass article-ops-bar"><Badge tone={stateTone(state)}>推文{state}</Badge><span>{preview ? '草稿预览：销售端暂时看不到这篇推文。' : state === '有未发布修改' ? '当前显示已发布版本，草稿中的修改发布后才会更新。' : `销售端正在显示此版本 · 发布于 ${a.publishedAt}`}</span><button className="primary" onClick={() => s.go(`programs/${id}/compose`)}><PenLine size={16} />编辑推文</button></div>}
    <div className="article-layout">
      <article className="glass article-paper">
        <ArticleView content={content} program={p} author={a.author} date={preview ? null : a.publishedAt} />
        <div className="article-actions"><button className="secondary" onClick={copy}><Copy size={16} />复制分享文案</button><Poster program={id} /><button className="primary" onClick={() => s.go('programs/' + id)}>招生与开班详情<ChevronRight size={16} /></button></div>
      </article>
      <aside className="article-aside">
        <section className="glass panel article-facts"><SectionTitle title="招生速览" sub="演示数据 · 非正式报价" />
          <dl><div><dt>项目参考价</dt><dd>{money(offer.fee)}<small> / 人</small></dd></div><div><dt>当前可报余位</dt><dd>{remaining}<small> 个</small></dd></div><div><dt>课程计划</dt><dd>{offer.sessions}<small> 次 / {offer.hours} 课时</small></dd></div><div className="wide"><dt>适合人群</dt><dd className="text">{offer.audience}</dd></div></dl>
        </section>
        {others.length > 0 && <section className="glass panel article-more"><SectionTitle title="更多项目介绍" />{others.map(o => { const oa = s.articles.find(x => x.program === o.id)!.published!; return <button key={o.id} className="article-more-item" onClick={() => s.go('programs/' + o.id + '/article')}><img src={resolveSrc(oa.cover)} alt="" loading="lazy" /><span><strong>{oa.title}</strong><small>{o.name}</small></span></button>; })}</section>}
      </aside>
    </div>
  </>;
}

const imageChoices = (programs: Program[]) => [
  ...programs.map(p => ({ label: `${p.short} · 项目封面`, src: `materials/cover-${p.id}.svg` })),
  ...programs.map(p => ({ label: `${p.short} · 招生海报`, src: `materials/poster-${p.id}.svg` })),
  { label: '插图 · 小组协作', src: 'materials/scene-workshop.svg' }, { label: '插图 · 研究讨论', src: 'materials/scene-research.svg' }, { label: '插图 · 成果展示', src: 'materials/scene-showcase.svg' },
];
const UPLOADED = '本地上传的图片';
function readImage(file: File, apply: (src: string) => void) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) return void toast.error('仅支持 PNG、JPEG、WebP 或 SVG 图片');
  if (file.size > LIMITS.imageBytes) return void toast.error('图片请控制在 1.5 MB 以内，以便保存在浏览器中');
  const reader = new FileReader();
  reader.onload = () => apply(String(reader.result));
  reader.onerror = () => toast.error('读取图片失败，请重试');
  reader.readAsDataURL(file);
}
function ImagePicker({ value, onChange, wide = false, label }: { value: string; onChange: (src: string) => void; wide?: boolean; label: string }) {
  const { programs } = useNexus();
  const choices = imageChoices(programs);
  const current = choices.find(c => c.src === value)?.label ?? (value ? UPLOADED : '');
  const input = useRef<HTMLInputElement>(null);
  return <div className={'image-picker' + (wide ? ' wide' : '')}>
    <div className="image-picker-thumb">{value ? <img src={resolveSrc(value)} alt="" /> : <ImageGlyph size={22} />}</div>
    <div className="image-picker-controls">
      <Choice label={label} value={current || '选择素材库图片'} onChange={v => { const c = choices.find(x => x.label === v); if (c) onChange(c.src); }} options={[...(current ? [] : ['选择素材库图片']), ...(current === UPLOADED ? [UPLOADED] : []), ...choices.map(c => c.label)]} />
      <button type="button" className="secondary" onClick={() => input.current?.click()}><ImagePlus size={16} />上传图片</button>
      <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => { const f = e.target.files?.[0]; if (f) readImage(f, onChange); e.target.value = ''; }} />
      <small>PNG / JPEG / WebP / SVG，最大 1.5 MB；上传的图片仅保存在本浏览器。</small>
    </div>
  </div>;
}
function BlockFields({ block, onChange }: { block: ArticleBlock; onChange: (b: ArticleBlock) => void }) {
  switch (block.type) {
    case 'heading': return <input className="block-input heading" aria-label="小标题" maxLength={LIMITS.heading} value={block.text} placeholder="例如：为什么选择这个项目" onChange={e => onChange({ ...block, text: e.target.value })} />;
    case 'paragraph': return <textarea className="block-input" aria-label="正文段落" rows={5} maxLength={LIMITS.paragraph} value={block.text} placeholder="输入正文，换行会原样保留" onChange={e => onChange({ ...block, text: e.target.value })} />;
    case 'quote': return <textarea className="block-input quote" aria-label="引用" rows={2} maxLength={200} value={block.text} placeholder="一句打动家长的话" onChange={e => onChange({ ...block, text: e.target.value })} />;
    case 'image': return <div className="block-stack"><ImagePicker label="选择配图" value={block.src} onChange={src => onChange({ ...block, src })} /><input className="block-input" aria-label="图片说明" maxLength={LIMITS.caption} value={block.caption} placeholder="图片说明（可选）" onChange={e => onChange({ ...block, caption: e.target.value })} /></div>;
    case 'highlight': return <div className="block-stack">
      <div className="highlight-head"><Choice label="卡片类型" value={highlightLabels[block.kind]} options={highlightKinds.map(k => highlightLabels[k])} onChange={v => { const kind = highlightKinds.find(k => highlightLabels[k] === v) as HighlightKind; onChange({ ...block, kind, title: block.title === highlightLabels[block.kind] || !block.title ? highlightLabels[kind] : block.title }); }} /><input className="block-input" aria-label="卡片标题" maxLength={20} value={block.title} placeholder="卡片标题" onChange={e => onChange({ ...block, title: e.target.value })} /></div>
      {block.items.map((item, i) => <div className="highlight-row" key={i}>
        <input className="block-input" aria-label={`第 ${i + 1} 行名称`} maxLength={12} value={item.label} placeholder="名称，如 项目参考价" onChange={e => onChange({ ...block, items: block.items.map((x, n) => n === i ? { ...x, label: e.target.value } : x) })} />
        <input className="block-input" aria-label={`第 ${i + 1} 行内容`} maxLength={80} value={item.value} placeholder="内容，如 ¥12,800 / 人" onChange={e => onChange({ ...block, items: block.items.map((x, n) => n === i ? { ...x, value: e.target.value } : x) })} />
        <button type="button" className="icon-button" aria-label={`删除第 ${i + 1} 行`} disabled={block.items.length === 1} onClick={() => onChange({ ...block, items: block.items.filter((_, n) => n !== i) })}><X size={16} /></button>
      </div>)}
      <button type="button" className="text-button self-start" disabled={block.items.length >= 8} onClick={() => onChange({ ...block, items: [...block.items, { label: '', value: '' }] })}><Plus size={15} />添加一行</button>
    </div>;
  }
}

export function ArticleEditor({ id }: { id: string }) {
  const s = useNexus();
  const p = s.programs.find(x => x.id === id), a = s.articles.find(x => x.program === id);
  const [draft, setDraft] = useState<ArticleContent | null>(() => (a ? JSON.parse(JSON.stringify(a.draft)) : null));
  const [dirty, setDirty] = useState(false), [issues, setIssues] = useState<string[]>([]), [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  if (s.role === 'sales') return <><Back to={`programs/${id}/article`} label="返回项目介绍" /><Notice>编辑与发布项目推文仅对项目运营老师开放。</Notice></>;
  if (!p || !a || !draft) return <NoResults />;
  // Next free block id within this draft (deterministic, no clock needed).
  const nid = () => { let n = draft.blocks.length + 1; while (draft.blocks.some(b => b.id === `${id}-n${n}`)) n++; return `${id}-n${n}`; };
  const update = (patch: Partial<ArticleContent>) => { setDraft(d => ({ ...d!, ...patch })); setDirty(true); if (issues.length) setIssues([]); };
  const setBlock = (b: ArticleBlock) => update({ blocks: draft.blocks.map(x => (x.id === b.id ? b : x)) });
  const add = (type: BlockType | 'facts') => {
    let block: ArticleBlock;
    if (type === 'facts') {
      const offer = programOffers[id], team = s.teams.find(t => t.program === id), cohort = team ? cohortOffers[team.id] : undefined;
      block = { id: nid(), type: 'highlight', kind: 'price', title: '招生信息', items: [{ label: '项目参考价', value: `${money(offer.fee)} / 人（演示）` }, { label: '课程计划', value: `${offer.sessions} 次 · ${offer.hours} 课时` }, { label: '计划开课', value: cohort?.opens ?? '待发布' }, { label: '报名截止', value: cohort?.deadline ?? '待发布' }] };
    } else block = newBlock(type, nid());
    update({ blocks: [...draft.blocks, block] });
    requestAnimationFrame(() => document.getElementById('block-' + block.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }));
  };
  const save = () => { s.updateArticles(list => list.map(x => (x.program === id ? saveDraft(x, draft, stamp()) : x))); setDirty(false); s.log('保存推文草稿：' + p.name); toast.success(a.published ? '草稿已保存，销售端仍显示已发布版本' : '草稿已保存，发布后销售端可见'); };
  const publish = () => {
    const found = articleIssues(draft); setIssues(found);
    if (found.length) { toast.error(found[0]); return; }
    const t = stamp(); s.updateArticles(list => list.map(x => (x.program === id ? publishArticle(x, draft, t) : x)));
    setDirty(false); s.log('发布项目推文：' + p.name); toast.success('推文已发布，销售老师可在项目中心阅读');
  };
  const unpublish = () => { s.updateArticles(list => list.map(x => (x.program === id ? unpublishArticle(x, stamp()) : x))); s.log('撤回项目推文：' + p.name); toast.info('已撤回发布，销售端将显示“介绍筹备中”'); };
  const state = articleState(a);
  return <>
    <Back to="programs" label="返回项目中心" />
    <PageTitle title="编辑项目推文" en="ARTICLE STUDIO" description={`${p.name} · 编排封面、摘要与正文，发布后销售端即可阅读`} />
    <div className="glass composer-bar">
      <div className="composer-status"><Badge tone={stateTone(state)}>推文{state}</Badge><span>{dirty ? '有未保存的修改' : `已保存 · ${a.updated}`}</span>{a.publishedAt && <span>上次发布 {a.publishedAt}</span>}</div>
      <div className="composer-actions">
        <button className="secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />恢复示例</button>
        {a.published && <button className="secondary" onClick={unpublish}><EyeOff size={16} />撤回发布</button>}
        <button className="secondary" onClick={() => s.go(`programs/${id}/article`)}><Eye size={16} />阅读视图</button>
        <button className="secondary" onClick={save} disabled={!dirty}><Save size={16} />保存草稿</button>
        <button className="primary" onClick={publish}><Send size={16} />发布推文</button>
      </div>
    </div>
    {issues.length > 0 && <div className="composer-issues" role="alert"><CircleAlert size={18} /><div><strong>发布前请完善以下内容</strong><ul>{issues.map(i => <li key={i}>{i}</li>)}</ul></div></div>}
    {!s.persisted && <Notice>浏览器存储空间不足，最近的修改只保留到刷新前。请压缩或减少上传的图片。</Notice>}
    <div className="composer">
      <div className="composer-main">
        <section className="glass panel composer-section"><SectionTitle title="封面与摘要" sub="显示在项目中心卡片与推文顶部" />
          <div className="form-stack">
            <FormField label={`推文标题（${draft.title.length}/${LIMITS.title}）`}><input value={draft.title} maxLength={LIMITS.title} placeholder="一句话说清项目价值" onChange={e => update({ title: e.target.value })} /></FormField>
            <FormField label={`摘要（${draft.summary.length}/${LIMITS.summary}）`}><textarea rows={3} value={draft.summary} maxLength={LIMITS.summary} placeholder="出现在卡片上的简介，建议 40–80 字" onChange={e => update({ summary: e.target.value })} /></FormField>
            <div className="form-field"><span>封面图片（建议 16:9）</span><ImagePicker wide label="选择封面" value={draft.cover} onChange={cover => update({ cover })} /></div>
          </div>
        </section>
        <section className="glass panel composer-section"><SectionTitle title="正文排版" sub={`${draft.blocks.length} 个内容模块 · 使用箭头调整顺序`} />
          <ol className="block-list">{draft.blocks.map((b, i) => { const Icon = blockIcon[b.type]; return <li key={b.id} id={'block-' + b.id} className={'block-card ' + b.type}>
            <div className="block-card-head"><span className="block-type"><Icon size={15} />{blockLabels[b.type]}</span><span className="block-index">#{i + 1}</span><div className="block-tools">
              <button type="button" className="icon-button" aria-label={`上移第 ${i + 1} 个模块`} disabled={i === 0} onClick={() => update({ blocks: moveBlock(draft.blocks, i, -1) })}><ArrowUp size={16} /></button>
              <button type="button" className="icon-button" aria-label={`下移第 ${i + 1} 个模块`} disabled={i === draft.blocks.length - 1} onClick={() => update({ blocks: moveBlock(draft.blocks, i, 1) })}><ArrowDown size={16} /></button>
              <button type="button" className="icon-button danger" aria-label={`删除第 ${i + 1} 个模块`} onClick={() => update({ blocks: draft.blocks.filter(x => x.id !== b.id) })}><Trash2 size={16} /></button>
            </div></div>
            <BlockFields block={b} onChange={setBlock} />
          </li>; })}</ol>
          {!draft.blocks.length && <p className="muted">还没有正文内容，使用下方按钮添加第一个模块。</p>}
          <div className="block-adder"><span>添加模块</span>{(['heading', 'paragraph', 'image', 'highlight', 'quote'] as BlockType[]).map(t => { const Icon = blockIcon[t]; return <button key={t} type="button" className="secondary" onClick={() => add(t)}><Icon size={15} />{blockLabels[t]}</button>; })}<button type="button" className="secondary" onClick={() => add('facts')}><Sparkles size={15} />插入招生数据</button></div>
        </section>
      </div>
      <aside className="composer-preview" aria-label="推文实时预览"><div className="composer-preview-label"><Smartphone size={15} />实时预览 · 销售端阅读效果</div><div className="phone-frame"><div className="phone-screen"><ArticleView compact content={draft} program={p} author={a.author} date={a.publishedAt} /></div></div></aside>
    </div>
    <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}><AlertDialogContent><AlertDialogTitle>恢复为示例内容？</AlertDialogTitle><AlertDialogDescription>当前编辑区的内容将被示例推文替换。保存或发布后才会生效，已发布版本暂不受影响。</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => { update(articleContentFor(id)); setConfirmReset(false); toast.info('已载入示例内容，保存或发布后生效'); }}>恢复示例</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
