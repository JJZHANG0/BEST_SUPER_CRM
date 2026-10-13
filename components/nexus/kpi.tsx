'use client';
/** 当月绩效 (teacher self-fill, in 待办事项) and 绩效考核 (reviewer page under 管理中心). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardCheck, FileCheck2, ListPlus, Lock, LockOpen, Save, Send, Undo2, ChevronRight, Check, Inbox, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { useNexus } from '@/lib/nexus/store';
import { canReviewKpi } from '@/lib/nexus/roles';
import { currentMonth } from '@/lib/nexus/ops';
import { groupDoneByMonth, ownedBy, monthKeyLabel, formatDue, type Todo } from '@/lib/nexus/todos';
import {
  KPI_CATEGORIES, KR_POINTS, blankItems, scoreSheet, submitIssues, finalizeIssues, todoAsKr, appendLine, clampProgress, clampScore,
  kpiStatusLabels, type KpiItem, type KpiSheet, type KpiStatus,
} from '@/lib/nexus/kpi';
import type { KpiReviewRow } from '@/lib/nexus/api';
import { PageTitle, EmptyState, Back, Notice } from './ui';
import { readOkrDraft, clearOkrDraft } from './okr';
import { okrToKpiItems, hasOkrContent, type OkrDraft } from '@/lib/nexus/okr';
import { buildKpiExportRows, renderKpiMonthPdf } from '@/lib/nexus/kpi-pdf';
import { Sparkles, X } from 'lucide-react';

type Mode = 'self' | 'review' | 'readonly';
const statusTone = (s: KpiStatus | 'none') => s === 'finalized' ? 'good' : s === 'submitted' ? 'watch' : s === 'draft' ? 'info' : 'neutral';
export function KpiStatusBadge({ status }: { status: KpiStatus | 'none' }) { return <span className={'kpi-status ' + statusTone(status)}><i aria-hidden="true" />{kpiStatusLabels[status]}</span>; }
const fmt = (n: number) => String(Math.round(n * 100) / 100);
const stamp = (iso?: string | null) => iso ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '';

function MonthField({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return <label className="month-field"><CalendarDays size={15} /><input type="month" aria-label="绩效月份" value={value} max={currentMonth()} onChange={e => e.target.value && onChange(e.target.value)} /></label>;
}

/** The 绩效评分 table: 序号 · 类别 · O分值 · 权重 · KEY RESULTS · KR 上级评分 · 目标完成进度. */
export function KpiTable({ items, mode, showScores, onChange, onPick }: { items: KpiItem[]; mode: Mode; showScores: boolean; onChange?: (items: KpiItem[]) => void; onPick?: (id: string) => void }) {
  const set = (id: string, patch: Partial<KpiItem>) => onChange?.(items.map(x => x.id === id ? { ...x, ...patch } : x));
  return <div className="kpi-table-wrap"><table className="kpi-table">
    <colgroup><col className="c-no" /><col className="c-cat" /><col className="c-pts" /><col className="c-wt" /><col /><col className="c-score" /><col className="c-prog" /></colgroup>
    <thead><tr><th>序号</th><th>类别</th><th>O 分值</th><th>权重</th><th className="left">要取得的关键成果 KEY RESULTS</th><th>KR 上级评分</th><th>目标完成进度</th></tr></thead>
    <tbody>{KPI_CATEGORIES.map(c => {
      const list = items.filter(x => x.category === c.key);
      return list.map((x, i) => {
        const editText = mode === 'self' && !c.locked, editLockedText = mode === 'review' && c.locked;
        const editProgress = mode === 'review' || (mode === 'self' && !c.locked);
        return <tr key={x.id} className={(c.locked ? 'locked ' : '') + (i === list.length - 1 ? 'cat-end' : '')}>
          {i === 0 && <><td rowSpan={list.length} className="kpi-cat-key">{c.key}</td><td rowSpan={list.length} className="kpi-cat-name">{c.name}</td><td rowSpan={list.length} className="num">{c.points}</td><td rowSpan={list.length} className="num">{c.weight}%</td></>}
          <td className="kpi-kr">
            {editText ? <div className="kpi-kr-edit">
              <div className="kpi-kr-title-row"><span className="kpi-kr-no">{i + 1}.</span><input aria-label={`${c.name} KR ${i + 1} 标题`} className="kpi-kr-title" maxLength={120} value={x.title} placeholder="KR 标题，例如：多项目课程排期与阶段衔接" onChange={e => set(x.id, { title: e.target.value })} />
                {onPick && <button type="button" className="text-button kpi-pick" onClick={() => onPick(x.id)} title="从本月已完成待办插入"><ListPlus size={14} />插入待办</button>}</div>
              <textarea aria-label={`${c.name} KR ${i + 1} 描述`} rows={3} maxLength={2000} value={x.description} placeholder="做了什么、怎么做的、取得了什么结果…" onChange={e => set(x.id, { description: e.target.value })} />
            </div> : editLockedText ? <div className="kpi-kr-edit">
              <div className="kpi-kr-title-row"><span className="kpi-kr-no">{i + 1}.</span><input aria-label={`客诉反馈 ${i + 1} 标题`} className="kpi-kr-title" maxLength={120} value={x.title} onChange={e => set(x.id, { title: e.target.value })} /></div>
              <textarea aria-label={`客诉反馈 ${i + 1} 扣分事项`} rows={2} maxLength={2000} value={x.description} placeholder="有客诉或失误时填写事项，并在右侧扣分" onChange={e => set(x.id, { description: e.target.value })} />
            </div> : <div className="kpi-kr-read">
              <strong>{i + 1}. {x.title || <em className="muted">（未填写）</em>}</strong>
              {x.description && <p>{x.description}</p>}
            </div>}
          </td>
          <td className="num kpi-score">{mode === 'review'
            ? <input type="number" aria-label={`${c.name} KR ${i + 1} 上级评分`} min={0} max={KR_POINTS} step={0.5} value={x.score ?? ''} placeholder="—" onChange={e => set(x.id, { score: clampScore(e.target.value) })} className={x.score === null ? 'empty' : ''} />
            : showScores && x.score !== null ? <b>{fmt(x.score)}</b> : <span className="muted">{c.locked ? fmt(x.score ?? KR_POINTS) : '—'}</span>}</td>
          <td className="num kpi-progress">{editProgress
            ? <span className="pct-input"><input type="number" aria-label={`${c.name} KR ${i + 1} 完成进度`} min={0} max={100} step={5} value={x.progress ?? ''} placeholder="—" onChange={e => set(x.id, { progress: clampProgress(e.target.value) })} /><span>%</span></span>
            : <span>{x.progress === null ? '—' : x.progress + '%'}</span>}</td>
        </tr>;
      });
    })}</tbody>
  </table></div>;
}

/** Category subtotals and the weighted total (out of 100). */
export function KpiScoreSummary({ items, title = '得分', pending }: { items: KpiItem[]; title?: string; pending?: boolean }) {
  const sc = scoreSheet(items);
  return <div className="kpi-summary">
    {sc.categories.map(c => <div key={c.key} className="kpi-summary-cat"><span>{c.key} {c.name}<small>{c.scored}/{c.count} 已评</small></span><b>{fmt(c.subtotal)}<small> / {c.points}</small></b><i style={{ width: `${(c.subtotal / c.points) * 100}%` }} aria-hidden="true" /></div>)}
    <div className="kpi-summary-total"><span>{title}{pending && !sc.complete ? '（未评分计 0）' : ''}</span><b>{fmt(sc.total)}<small> / 100</small></b></div>
  </div>;
}

/** Pick a completed todo of the month and write it into a KR (description, or title when empty). */
function TodoPickDialog({ open, onClose, todos, month, items, target, onPick }: { open: boolean; onClose: () => void; todos: Todo[]; month: string; items: KpiItem[]; target: string; onPick: (t: Todo) => void }) {
  const list = useMemo(() => groupDoneByMonth(todos).find(g => g.key === month)?.items || [], [todos, month]);
  const used = (t: Todo) => items.some(x => x.title === t.title || x.description.split('\n').some(l => l.trim() === todoAsKr(t) || l.trim() === t.title));
  const item = items.find(x => x.id === target);
  const cat = KPI_CATEGORIES.find(c => c.key === item?.category);
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog wide">
    <DialogTitle>从已完成待办插入</DialogTitle>
    <DialogDescription>{monthKeyLabel(month)}已完成的待办 · 插入到 {cat ? `${cat.key} ${cat.name}` : ''} KR {item ? Number(item.id.slice(1)) : ''}。标题为空时用待办标题作为 KR 标题，否则追加到描述。</DialogDescription>
    <div className="todo-list kpi-pick-list">
      {list.map(t => <button type="button" key={t.id} className={'kpi-pick-row' + (used(t) ? ' used' : '')} onClick={() => onPick(t)}>
        <span className="todo-check" aria-hidden="true"><Check size={15} /></span>
        <span className="kpi-pick-main"><strong>{t.title}</strong>{t.note && <small>{t.note}</small>}</span>
        <span className="kpi-pick-meta">{used(t) ? '已插入' : `完成 ${formatDue(t.completedAt)}`}</span>
      </button>)}
      {!list.length && <EmptyState icon={Inbox} title={`${monthKeyLabel(month)}还没有已完成的待办`} description="在「待办」中勾选完成的事项会出现在这里，方便写 KR。" />}
    </div>
    <div className="actions"><button type="button" className="secondary" onClick={onClose}>完成</button></div>
  </DialogContent></Dialog>;
}


/** 当月领导评分 card: score / 100 + 张捷嘉评语 — sits between status bar and 绩效评分 table. */
export function KpiLeaderScoreCard({ sheet, month }: { sheet: KpiSheet | null; month: string }) {
  const status: KpiStatus | 'none' = sheet?.status ?? 'none';
  const leader = sheet?.reviewedByName || '张捷嘉';
  const finalized = status === 'finalized';
  const total = finalized ? (sheet?.total ?? scoreSheet(sheet!.items).total) : null;
  const note = (sheet?.reviewNote || '').trim();
  const returned = status === 'draft' && !!note;
  return <section className="glass panel kpi-leader-card" aria-label="当月领导评分">
    <div className="kpi-leader-top">
      <div className="kpi-leader-who">
        <span className="avatar" aria-hidden="true">{leader.slice(0, 1)}</span>
        <div><strong>{leader} · 当月领导评分</strong><small>{monthKeyLabel(month)}绩效考核{finalized ? ` · 定稿于 ${stamp(sheet?.finalizedAt)}` : status === 'submitted' ? ' · 待定稿后可见得分' : returned ? ' · 已退回修改' : ' · 提交审核并定稿后显示'}</small></div>
      </div>
      <div className="kpi-leader-score" aria-live="polite">
        {finalized && total != null ? <><b>{fmt(total)}</b><small>/ 100</small></> : <b className="pending">{returned ? '已退回' : status === 'submitted' ? '待定稿' : '—'}</b>}
      </div>
    </div>
    {finalized && note ? <p className="kpi-leader-comment"><b>领导评语</b>{note}</p>
      : returned ? <p className="kpi-leader-comment"><b>{leader} 退回意见</b>{note}</p>
      : <p className="kpi-leader-empty">{finalized ? '定稿时未填写评语。' : '领导评分与评语在部门负责人（张捷嘉）定稿后显示在这里。'}</p>}
  </section>;
}

/** 当月绩效 tab: the signed-in teacher fills their KRs, saves a draft and submits for review. */
export function KpiSelfPanel() {
  const s = useNexus();
  const [ai, setAi] = useState<OkrDraft | null>(() => readOkrDraft());
  const [month, setMonth] = useState(() => ai?.month || currentMonth());
  const [sheet, setSheet] = useState<KpiSheet | null>(null);
  const [items, setItems] = useState<KpiItem[]>(blankItems());
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const own = useMemo(() => ownedBy(s.todos, s.meKey), [s.todos, s.meKey]);
  const doneThisMonth = useMemo(() => groupDoneByMonth(own).find(g => g.key === month)?.items.length || 0, [own, month]);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the async fetch below
    setLoading(true);
    s.kpi.load(month).then(sh => {
      if (!live) return;
      setSheet(sh);
      const base = sh ? sh.items : blankItems();
      const draft = readOkrDraft();
      if (draft && draft.month === month) {
        if (sh && sh.status !== 'draft') { clearOkrDraft(); setAi(null); setItems(base); setDirty(false); toast.error(sh.status === 'finalized' ? '本月绩效已定稿，AI 生成的 OKR 未写入' : '本月绩效已提交审核，AI 生成的 OKR 未写入'); }
        else { setAi(draft); setItems(okrToKpiItems(draft, base, new Map(own.map(t => [t.id, t.title])))); setDirty(true); }
      } else { setItems(base); setDirty(false); }
      setLoading(false);
    });
    return () => { live = false; };
  }, [month, s.meKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const status: KpiStatus | 'none' = sheet?.status ?? 'none';
  const editable = status === 'none' || status === 'draft';
  const filled = items.filter(x => !KPI_CATEGORIES.find(c => c.key === x.category)?.locked && x.title.trim()).length;
  const slots = KPI_CATEGORIES.filter(c => !c.locked).reduce((n, c) => n + c.slots, 0);
  const change = (next: KpiItem[]) => { setItems(next); setDirty(true); };
  const save = async (submit: boolean) => {
    if (submit) { const issues = submitIssues(items); if (issues.length) { toast.error(issues[0] + (issues.length > 1 ? ` 等 ${issues.length} 项` : '')); return; } }
    setBusy(true);
    const r = await s.kpi.save(month, items, submit);
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    setSheet(r.sheet); setItems(r.sheet.items); setDirty(false);
    if (ai) { clearOkrDraft(); setAi(null); }
    s.log(`${submit ? '提交' : '保存'}${monthKeyLabel(month)}绩效`);
    toast.success(submit ? '已提交审核，审核人评分定稿后可查看最终得分' : '草稿已保存');
  };
  const insert = (t: Todo) => {
    if (!pick) return;
    change(items.map(x => {
      if (x.id !== pick) return x;
      if (!x.title.trim()) return { ...x, title: t.title.slice(0, 120), description: t.note ? appendLine(x.description, t.note.trim()) : x.description };
      return { ...x, description: appendLine(x.description, todoAsKr(t)).slice(0, 2000) };
    }));
    toast.success('已插入到 KR');
  };
  const confirmAi = () => {
    if (sheet && hasOkrContent(sheet.items) && !window.confirm(`${monthKeyLabel(month)}已有保存过的绩效内容，确认用 AI 生成的 OKR（含你的修改）覆盖 A–C 类 KR？`)) return;
    save(false);
  };
  const discardAi = () => { clearOkrDraft(); setAi(null); setItems(sheet ? sheet.items : blankItems()); setDirty(false); toast.success('已放弃 AI 草稿'); };
  const switchMonth = (m: string) => { if (dirty && !window.confirm('当前月份有未保存的修改，切换月份将丢弃这些修改。继续？')) return; setMonth(m); };
  return <div role="tabpanel" aria-label="当月绩效" className="kpi-self">
    <section className="glass panel kpi-head">
      <div className="kpi-head-main">
        <MonthField value={month} onChange={switchMonth} />
        <KpiStatusBadge status={status} />
        <span className="kpi-head-meta">{editable ? `已填写 ${filled}/${slots} 个 KR` : status === 'submitted' ? `提交于 ${stamp(sheet?.submittedAt)}` : `由 ${sheet?.reviewedByName || '审核人'} 定稿于 ${stamp(sheet?.finalizedAt)}`}{doneThisMonth > 0 && editable ? ` · 本月已完成待办 ${doneThisMonth} 项，可插入 KR` : ''}</span>
      </div>
      {editable && <div className="kpi-head-actions">
        <button type="button" className="secondary compact" disabled={busy || loading} onClick={() => save(false)}><Save size={15} />保存草稿</button>
        <button type="button" className="primary compact" disabled={busy || loading} onClick={() => save(true)}><Send size={15} />提交审核</button>
      </div>}
    </section>
    {ai && editable && !loading && <section className="glass panel okr-ai-banner" role="status">
      <div className="okr-ai-main">
        <span className="okr-ai-tag"><Sparkles size={13} />AI生成·待确认</span>
        <div><strong>{monthKeyLabel(month)} OKR 草稿尚未保存</strong><p>{ai.summary || '已根据本月已完成待办生成 KR，请逐条检查修改后再确认保存。'}{sheet && hasOkrContent(sheet.items) ? ' 注意：确认保存将覆盖本月已保存的 A–C 类 KR。' : ''}</p>
        {ai.objectives.length > 0 && <ul className="okr-ai-objs">{ai.objectives.map(o => <li key={o.category}><b>{o.category}</b>{o.objective || KPI_CATEGORIES.find(c => c.key === o.category)?.name}<em>{o.keyResults.length} KR</em></li>)}</ul>}</div>
      </div>
      <div className="okr-ai-actions">
        <button type="button" className="secondary compact" disabled={busy} onClick={discardAi}><X size={15} />放弃</button>
        <button type="button" className="primary compact" disabled={busy} onClick={confirmAi}><Check size={15} />确认保存</button>
      </div>
    </section>}
    {status === 'submitted' && <Notice>已提交审核，等待审核人评分。如需修改，请联系审核人退回。</Notice>}
    {!loading && <KpiLeaderScoreCard sheet={sheet} month={month} />}
    {status === 'finalized' && sheet && <section className="glass panel kpi-final">
      <KpiScoreSummary items={sheet.items} title="分类加权明细" />
    </section>}
    <section className="glass panel kpi-sheet-panel">
      <div className="kpi-sheet-head"><div><h2>绩效评分</h2><span>每个 KR 对应满分 5 分。举例：教务管理 30 分需要 6 个 KR；客诉反馈默认满分，由项目经理填写扣分事项。</span></div></div>
      {loading ? <div className="kpi-loading">正在读取…</div> : <KpiTable items={items} mode={editable ? 'self' : 'readonly'} showScores={status === 'finalized'} onChange={change} onPick={editable ? setPick : undefined} />}
      {editable && <p className="kpi-foot">KR 上级评分与最终得分在审核人定稿后可见 · {s.apiMode ? '保存到服务器' : '预览站：保存在当前浏览器'}</p>}
    </section>
    {pick && <TodoPickDialog open={!!pick} onClose={() => setPick(null)} todos={own} month={month} items={items} target={pick} onPick={insert} />}
  </div>;
}


async function exportKpiPdf(month: string, rows: KpiReviewRow[], reviewer: string) {
  try {
    const data = buildKpiExportRows(rows);
    const generatedAt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const pdf = await renderKpiMonthPdf(month, data, { generatedAt, reviewer });
    const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `B.E.S.T-${month}-绩效考核.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`已导出 ${monthKeyLabel(month)} 绩效考核 PDF（单页）`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '导出失败');
  }
}

/** 绩效考核 (reviewer): list of ops teachers for a month → score each KR → finalize. Route: #/kpi-review?month=…&user=… */
export function KpiReviewPage() {
  const s = useNexus();
  const params = new URLSearchParams(s.route.split('?')[1] || '');
  const month = /^\d{4}-\d{2}$/.test(params.get('month') || '') ? params.get('month')! : currentMonth();
  const userKey = params.get('user') || '';
  const [rows, setRows] = useState<KpiReviewRow[] | null>(null);
  const reload = useCallback(() => { setRows(null); s.kpi.reviewList(month).then(setRows); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the review list for the selected month
  useEffect(() => { if (canReviewKpi(s.viewer)) reload(); }, [reload, s.viewer]);
  if (!canReviewKpi(s.viewer)) return <><PageTitle title="绩效考核" en="PERFORMANCE REVIEW" description="按月审核运营老师的绩效评分。" /><section className="glass panel"><EmptyState icon={Lock} title="仅部门负责人可访问" description="绩效考核由部门负责人（张捷嘉）负责；你可以在「待办事项 · 当月绩效」填写并提交自己的绩效。" /></section></>;
  const go = (m: string, u?: string) => s.go(`kpi-review?month=${m}${u ? '&user=' + encodeURIComponent(u) : ''}`);
  if (userKey) {
    const row = rows?.find(r => r.user.key === userKey);
    return <KpiReviewDetail key={userKey + month} month={month} row={row} loading={!rows} onBack={() => go(month)} onSaved={reload} />;
  }
  const count = (st: KpiStatus | 'none') => (rows || []).filter(r => (r.sheet?.status ?? 'none') === st).length;
  return <>
    <PageTitle title="绩效考核" en="PERFORMANCE REVIEW" description="查看每位运营老师当月的绩效填写情况，逐条评分并定稿；定稿后老师可在「当月绩效」看到最终得分。" />
    <div className="mini-stats ops-stats">
      <div className="glass"><span>待审核</span><b>{count('submitted')}<small> 人</small></b></div>
      <div className="glass"><span>已定稿</span><b>{count('finalized')}<small> 人</small></b></div>
      <div className="glass"><span>草稿中</span><b>{count('draft')}<small> 人</small></b></div>
      <div className="glass"><span>未填写</span><b>{count('none')}<small> 人</small></b></div>
    </div>
    <section className="glass panel">
      <div className="filter-toolbar ops-filters kpi-export-bar">
        <MonthField value={month} onChange={m => go(m)} />
        <button type="button" className="primary compact export-button" disabled={!rows?.length} onClick={() => void exportKpiPdf(month, rows || [], s.user?.name || '张捷嘉')}>
          <FileDown size={15} />一键导出
        </button>
      </div>
      <div className="results-meta">{monthKeyLabel(month)} · {rows?.length ?? 0} 位老师<span>点击一行进入评分 · 可一键导出当月 OKR 得分 PDF</span></div>
      {!rows ? <div className="kpi-loading">正在读取…</div> : rows.length ? <div className="ops-table-wrap"><Table className="ops-table kpi-review-table"><TableHeader><TableRow>{['老师', '状态', '已填 KR', '提交时间', '加权总分', ''].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map(r => {
          const st = r.sheet?.status ?? 'none';
          const filled = r.sheet ? r.sheet.items.filter(x => x.category !== 'D' && x.title.trim()).length : 0;
          const total = r.sheet ? (st === 'finalized' ? r.sheet.total ?? scoreSheet(r.sheet.items).total : scoreSheet(r.sheet.items).total) : null;
          return <TableRow key={r.user.key} className="kpi-review-row" onClick={() => go(month, r.user.key)}>
            <TableCell><span className="kpi-person"><span className="avatar small-avatar">{r.user.name.slice(0, 1)}</span><span><strong className="cell-title">{r.user.name}</strong><small className="cell-sub">{r.user.role === 'ops' ? '项目运营老师' : '超级管理员'}</small></span></span></TableCell>
            <TableCell><KpiStatusBadge status={st} /></TableCell>
            <TableCell className="num">{r.sheet ? `${filled}/16` : '—'}</TableCell>
            <TableCell className="nowrap">{stamp(r.sheet?.submittedAt) || '—'}</TableCell>
            <TableCell className="num">{total === null || st === 'none' || st === 'draft' ? '—' : <b className={st === 'finalized' ? 'kpi-total-final' : ''}>{fmt(total)}{st !== 'finalized' && <small className="muted"> 暂计</small>}</b>}</TableCell>
            <TableCell className="row-actions"><button className="text-button" onClick={e => { e.stopPropagation(); go(month, r.user.key); }}>{st === 'submitted' ? '去评分' : '查看'}<ChevronRight size={14} /></button></TableCell>
          </TableRow>;
        })}</TableBody></Table></div>
        : <EmptyState icon={ClipboardCheck} title="还没有运营老师" description="在系统管理中添加项目运营老师账号后，他们的月度绩效会出现在这里。" />}
    </section>
  </>;
}

function KpiReviewDetail({ month, row, loading, onBack, onSaved }: { month: string; row?: KpiReviewRow; loading: boolean; onBack: () => void; onSaved: () => void }) {
  const s = useNexus();
  const [items, setItems] = useState<KpiItem[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const sheet = row?.sheet ?? null;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the editable copy when another sheet is opened
  useEffect(() => { if (sheet) { setItems(sheet.items); setNote(sheet.reviewNote || ''); } }, [sheet]);
  const self = row && row.user.key.toLowerCase() === s.meKey.toLowerCase();
  const act = async (action: 'save' | 'finalize' | 'return' | 'reopen') => {
    if (!row || !items) return;
    if (action === 'finalize') { const issues = finalizeIssues(items); if (issues.length) { toast.error(issues[0]); return; } if (!window.confirm(`定稿后 ${row.user.name} 将看到最终得分 ${fmt(scoreSheet(items).total)}，确认定稿？`)) return; }
    if (action === 'return' && !note.trim()) { toast.error('请在审核意见中写明退回原因'); return; }
    setBusy(true);
    const r = await s.kpi.review(row.user.key, month, { items, reviewNote: note, action });
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    s.log(`${{ save: '保存评分', finalize: '定稿', return: '退回', reopen: '撤销定稿' }[action]}：${row.user.name} ${monthKeyLabel(month)}绩效`);
    toast.success({ save: '评分已保存', finalize: '已定稿，老师可查看最终得分', return: '已退回给老师修改', reopen: '已撤销定稿，可继续调整评分' }[action]);
    onSaved();
  };
  const header = <><Back to={`kpi-review?month=${month}`} label="返回绩效考核" /><PageTitle title={`${row?.user.name || ''} · ${monthKeyLabel(month)}绩效`} en="PERFORMANCE REVIEW" description="为每个 KR 打分（0–5 分），分类小计与加权总分自动计算；确认无误后定稿。" /></>;
  if (loading) return <>{header}<section className="glass panel"><div className="kpi-loading">正在读取…</div></section></>;
  if (!row) return <>{header}<section className="glass panel"><EmptyState icon={Inbox} title="找不到这位老师" description="TA 可能已被停用。" action="返回列表" onAction={onBack} /></section></>;
  if (!sheet || sheet.status === 'draft') return <>{header}<section className="glass panel"><EmptyState icon={FileCheck2} title={sheet ? `${row.user.name} 还在填写草稿` : `${row.user.name} 本月还没有填写绩效`} description="老师在「待办事项 · 当月绩效」中提交审核后即可评分。" /></section></>;
  const editable = sheet.status === 'submitted' && !self;
  const view = items || sheet.items;
  return <>
    {header}
    <section className="glass panel kpi-head">
      <div className="kpi-head-main"><KpiStatusBadge status={sheet.status} /><span className="kpi-head-meta">提交于 {stamp(sheet.submittedAt)}{sheet.status === 'finalized' ? ` · 由 ${sheet.reviewedByName} 定稿于 ${stamp(sheet.finalizedAt)}` : ''}</span></div>
      <div className="kpi-head-actions">
        {editable && <>
          <button type="button" className="secondary compact" disabled={busy} onClick={() => act('return')}><Undo2 size={15} />退回修改</button>
          <button type="button" className="secondary compact" disabled={busy} onClick={() => act('save')}><Save size={15} />保存评分</button>
          <button type="button" className="primary compact" disabled={busy} onClick={() => act('finalize')}><Lock size={15} />定稿</button>
        </>}
        {sheet.status === 'finalized' && !self && <button type="button" className="secondary compact" disabled={busy} onClick={() => act('reopen')}><LockOpen size={15} />撤销定稿</button>}
      </div>
    </section>
    {self && <Notice>不能审核自己的绩效，请由其他审核人评分。</Notice>}
    <KpiScoreSummary items={view} title={sheet.status === 'finalized' ? '最终得分' : '加权总分'} pending={sheet.status !== 'finalized'} />
    <section className="glass panel kpi-sheet-panel">
      <div className="kpi-sheet-head"><div><h2>绩效评分</h2><span>每个 KR 满分 5 分 · 客诉反馈默认满分，有客诉或失误时填写事项并扣分</span></div>
        {editable && <button type="button" className="text-button" onClick={() => { setItems(view.map(x => x.score === null ? { ...x, score: KR_POINTS } : x)); toast.success('未评分的 KR 已填为 5 分'); }}>未评分的填满分</button>}</div>
      <KpiTable items={view} mode={editable ? 'review' : 'readonly'} showScores onChange={setItems} />
    </section>
    <section className="glass panel kpi-note">
      <label className="form-field"><span>审核意见{editable ? '（退回时必填，定稿后老师可见）' : ''}</span>
        <textarea rows={3} maxLength={2000} value={note} disabled={!editable} onChange={e => setNote(e.target.value)} placeholder="本月亮点、需要改进的地方…" /></label>
    </section>
  </>;
}
