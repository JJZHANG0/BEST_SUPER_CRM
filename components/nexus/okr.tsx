'use client';
/** 「生成OKR」 button + loading dialog (已完成 tab). The draft goes to 当月绩效 via sessionStorage, unsaved. */
import { useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCcw, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useNexus } from '@/lib/nexus/store';
import { api, ApiError } from '@/lib/nexus/api';
import { canFillKpi } from '@/lib/nexus/roles';
import { monthKeyLabel } from '@/lib/nexus/todos';
import { OKR_DRAFT_KEY, type OkrDraft } from '@/lib/nexus/okr';

const CLIENT_TIMEOUT = 100_000;
const STEPS = ['整理本月已完成待办…', '千问 AI 正在归纳目标与关键结果…', '对齐 教务管理 / 项目运营 / 团队支持…', '生成 KR 描述与完成度…'];

export function saveOkrDraft(d: OkrDraft) { try { sessionStorage.setItem(OKR_DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
export function readOkrDraft(): OkrDraft | null {
  try { const v = JSON.parse(sessionStorage.getItem(OKR_DRAFT_KEY) || 'null'); return v && typeof v === 'object' && Array.isArray(v.objectives) ? v as OkrDraft : null; } catch { return null; }
}
export function clearOkrDraft() { try { sessionStorage.removeItem(OKR_DRAFT_KEY); } catch { /* ignore */ } }

export function GenerateOkrButton({ month, count }: { month: string; count: number }) {
  const s = useNexus();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'running' | 'error'>('running');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0), [elapsed, setElapsed] = useState(0);
  const run = useRef(0);
  const allowed = canFillKpi(s.viewer);
  const disabledReason = !s.apiMode ? '预览站不支持（需连接服务器）' : !allowed ? '仅运营老师可生成 OKR' : !count ? `${monthKeyLabel(month)}还没有已完成的待办` : '';
  useEffect(() => {
    if (!open || phase !== 'running') return;
    const t0 = Date.now();
    const id = window.setInterval(() => { const sec = Math.floor((Date.now() - t0) / 1000); setElapsed(sec); setStep(Math.min(STEPS.length - 1, Math.floor(sec / 4))); }, 500);
    return () => window.clearInterval(id);
  }, [open, phase]);
  const start = async () => {
    const my = ++run.current;
    setOpen(true); setPhase('running'); setError(''); setStep(0); setElapsed(0);
    try {
      const r = await Promise.race([api.generateOkr(month), new Promise<never>((_, rej) => setTimeout(() => rej(new ApiError(504, 'timeout', 'AI 生成超时，请重试')), CLIENT_TIMEOUT))]);
      if (my !== run.current) return;
      saveOkrDraft(r.okr);
      s.log(`AI 生成${monthKeyLabel(month)} OKR（待确认）`);
      setOpen(false);
      s.go('todos?tab=kpi');
    } catch (e) {
      if (my !== run.current) return;
      setPhase('error'); setError(e instanceof ApiError ? e.message || '生成失败' : '网络异常，请检查连接后重试');
    }
  };
  const close = () => { run.current++; setOpen(false); };
  return <>
    <span className="okr-btn-wrap" title={disabledReason || `用 AI 把${monthKeyLabel(month)}已完成事项整理成 OKR 草稿`}>
      <button type="button" className="primary compact export-button okr-button" disabled={!!disabledReason} onClick={start}><Sparkles size={15} />生成OKR</button>
    </span>
    <Dialog open={open} onOpenChange={o => { if (!o && phase === 'error') close(); }}>
      <DialogContent className="ops-dialog okr-loading-dialog" showCloseButton={phase === 'error'}
        onEscapeKeyDown={e => { if (phase === 'running') e.preventDefault(); }} onInteractOutside={e => e.preventDefault()}>
        {phase === 'running' ? <div className="okr-loading" aria-live="polite">
          <div className="okr-orb" aria-hidden="true"><span /><span /><span /><Sparkles size={26} /></div>
          <DialogTitle>正在生成{monthKeyLabel(month)} OKR</DialogTitle>
          <DialogDescription>基于 {count} 项已完成待办，通常需要 10–40 秒，请勿关闭页面。</DialogDescription>
          <ol className="okr-steps">{STEPS.map((t, i) => <li key={t} className={i < step ? 'done' : i === step ? 'active' : ''}>{t}</li>)}</ol>
          <div className="okr-progress" aria-hidden="true"><i style={{ width: `${Math.min(95, 8 + elapsed * 2.4)}%` }} /></div>
          <small className="okr-elapsed">已用时 {elapsed} 秒</small>
        </div> : <div className="okr-loading error">
          <div className="okr-orb error" aria-hidden="true"><AlertTriangle size={26} /></div>
          <DialogTitle>生成失败</DialogTitle>
          <DialogDescription>{error}</DialogDescription>
          <div className="actions"><button type="button" className="secondary" onClick={close}>关闭</button><button type="button" className="primary" onClick={start}><RotateCcw size={15} />重试</button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
