'use client';
/**
 * 「导出课表 · 给学生/家长/销售」: friendly weekly schedule (by weekday with date, time,
 * course name, teacher, room/online). Canvas → PNG / PDF. Not an internal ops grid.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, ImageDown, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FormField, Picker } from './ui';
import { useNexus, useVisible } from '@/lib/nexus/store';
import type { Course } from '@/lib/nexus/data';
import { today as todayIso } from '@/lib/nexus/ops';
import { imagesToPdf } from '@/lib/nexus/pdf';
import {
  occurrences, weekStarts, weekRangeLabel, termLabel, addDays, mondayOf,
  type Occurrence,
} from '@/lib/nexus/schedule';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",system-ui,sans-serif';
const DAYS_ZH = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ROW_H = 52, DAY_GAP = 18, SIDE = 48, TOP = 132;
export const PAGE_W = 1100;

export type TimetableHeader = { title: string; subtitle: string; term: string; range: string; weekNo?: string; generated: string };

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1; }
  return text.slice(0, lo) + '…';
}

type DayBucket = { date: string; dayLabel: string; items: { time: string; name: string; teacher: string; place: string }[] };

function bucketsForWeek(occ: Occurrence<Course>[], monday: string): DayBucket[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const items = occ
      .filter(o => o.date === date)
      .sort((a, b) => (a.start || a.course.time).localeCompare(b.start || b.course.time))
      .map(o => ({
        time: o.start && o.end ? `${o.start}–${o.end}` : (o.course.time || '—'),
        name: o.course.name,
        teacher: o.course.teacher || '待定',
        place: o.location || o.course.location || '线上 / 待通知',
      }));
    return { date, dayLabel: DAYS_ZH[i]!, items };
  });
}

export function pageHeight(days: DayBucket[]) {
  let h = TOP + 24;
  for (const d of days) h += 36 + Math.max(1, d.items.length) * ROW_H + DAY_GAP;
  return h + 56;
}

export function drawFriendlyTimetable(ctx: CanvasRenderingContext2D, days: DayBucket[], head: TimetableHeader) {
  const W = PAGE_W, H = pageHeight(days);
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#5B3BB0'); g.addColorStop(1, '#8B5CF6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 108);
  ctx.fillStyle = '#EDE4FF'; ctx.font = `700 12px ${FONT}`;
  ctx.fillText('给学生 / 家长 / 销售 · 一周课程安排', SIDE, 34);
  ctx.fillStyle = '#ffffff'; ctx.font = `700 28px ${FONT}`;
  ctx.fillText(fit(ctx, head.title, W * 0.58), SIDE, 70);
  ctx.fillStyle = '#E8DEFF'; ctx.font = `500 13px ${FONT}`;
  ctx.fillText(fit(ctx, head.subtitle, W * 0.58), SIDE, 94);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff'; ctx.font = `700 18px ${FONT}`; ctx.fillText(head.range, W - SIDE, 52);
  ctx.fillStyle = '#E8DEFF'; ctx.font = `500 13px ${FONT}`;
  ctx.fillText(head.term + (head.weekNo ? '  ·  ' + head.weekNo : ''), W - SIDE, 78);
  ctx.fillText('日期 · 时间 · 课程 · 老师 · 地点', W - SIDE, 98);
  ctx.textAlign = 'left';

  let y = TOP;
  const colW = W - 2 * SIDE;
  for (const d of days) {
    const md = `${Number(d.date.slice(5, 7))} 月 ${Number(d.date.slice(8))} 日`;
    rr(ctx, SIDE, y, colW, 28, 8); ctx.fillStyle = '#F4F0FB'; ctx.fill();
    ctx.fillStyle = '#5B3BB0'; ctx.font = `800 14px ${FONT}`;
    ctx.fillText(`${d.dayLabel}  ·  ${md}`, SIDE + 14, y + 19);
    y += 36;
    if (!d.items.length) {
      rr(ctx, SIDE, y, colW, ROW_H - 6, 10); ctx.fillStyle = '#FAF8FD'; ctx.fill();
      ctx.fillStyle = '#A89BB8'; ctx.font = `500 13px ${FONT}`;
      ctx.fillText('本日暂无课程', SIDE + 18, y + 28);
      y += ROW_H + 4;
    } else {
      for (const it of d.items) {
        rr(ctx, SIDE, y, colW, ROW_H - 6, 10);
        ctx.fillStyle = '#FFFFFF'; ctx.fill();
        ctx.strokeStyle = '#E8E0F2'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#5B3BB0'; ctx.fillRect(SIDE, y + 8, 4, ROW_H - 22);
        ctx.fillStyle = '#6B4FA0'; ctx.font = `700 14px ${FONT}`;
        ctx.fillText(it.time, SIDE + 18, y + 22);
        ctx.fillStyle = '#2A2140'; ctx.font = `700 15px ${FONT}`;
        ctx.fillText(fit(ctx, it.name, colW * 0.42), SIDE + 130, y + 22);
        ctx.fillStyle = '#7A6F90'; ctx.font = `500 12px ${FONT}`;
        ctx.fillText(fit(ctx, `老师 ${it.teacher}  ·  ${it.place}`, colW - 160), SIDE + 130, y + 40);
        y += ROW_H;
      }
    }
    y += DAY_GAP - 4;
  }
  ctx.fillStyle = '#A398B8'; ctx.font = `500 11px ${FONT}`;
  ctx.fillText('B.E.S.T · 课程安排（给学生 / 家长 / 销售）', SIDE, H - 24);
  ctx.textAlign = 'right'; ctx.fillText('生成于 ' + head.generated, W - SIDE, H - 24); ctx.textAlign = 'left';
  ctx.restore();
  return { width: W, height: H };
}

type Scope = 'mine' | 'teacher' | 'program';
const stamp = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function renderWeeks(occ: Occurrence<Course>[], mondays: string[], header: Omit<TimetableHeader, 'range' | 'weekNo'>, scale = 2) {
  return mondays.map((m, i) => {
    const days = bucketsForWeek(occ, m);
    const canvas = document.createElement('canvas');
    const h = pageHeight(days);
    canvas.width = PAGE_W * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!; ctx.scale(scale, scale);
    drawFriendlyTimetable(ctx, days, { ...header, range: weekRangeLabel(m), weekNo: mondays.length > 1 ? `第 ${i + 1} / ${mondays.length} 周` : '' });
    return canvas;
  });
}
const blobOf = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), type, q));
function save(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }

export function TimetableExportDialog({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate?: string }) {
  const s = useNexus(), v = useVisible();
  const myName = s.user?.name || '';
  const all = useMemo(() => occurrences(v.courses, s.courseSessions), [v.courses, s.courseSessions]);
  const teachers = useMemo(() => [...new Set(v.courses.map(c => c.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [v.courses]);
  const programs = useMemo(() => s.programs.filter(p => v.courses.some(c => c.program === p.id)), [s.programs, v.courses]);
  const [scope, setScope] = useState<Scope>('mine');
  const [teacher, setTeacher] = useState(teachers.includes(myName) ? myName : teachers[0] || '');
  const [program, setProgram] = useState(programs[0]?.id || '');
  const [from, setFrom] = useState(mondayOf(initialDate || todayIso()));
  const [weeks, setWeeks] = useState('1');
  const [busy, setBusy] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const picked = useMemo(() => all.filter(o => scope === 'mine' ? o.course.teacher === myName : scope === 'teacher' ? o.course.teacher === teacher : o.course.program === program), [all, scope, myName, teacher, program]);
  const mondays = useMemo(() => weekStarts(from || todayIso(), Number(weeks) || 1), [from, weeks]);
  const programName = s.programs.find(p => p.id === program)?.name || '';
  const header = useMemo(() => ({
    title: scope === 'program' ? programName || '项目课程安排' : `${scope === 'mine' ? myName || '我' : teacher || '老师'} 的一周课程`,
    subtitle: '给学生 / 家长 / 销售 · 清晰可读的每周课表',
    term: termLabel(mondays[0]), generated: stamp(),
  }), [scope, programName, myName, teacher, mondays]);
  const total = picked.filter(o => o.date >= mondays[0] && o.date <= addDays(mondays[mondays.length - 1], 6)).length;
  const fileBase = `课表-学生家长销售-${header.title.replace(/\s+/g, '').replace(/的一周课程$/, '')}-${mondays[0]}${mondays.length > 1 ? '起' + mondays.length + '周' : ''}`;

  useEffect(() => {
    const el = preview.current; if (!el) return;
    const [c] = renderWeeks(picked, [mondays[0]], header, 1);
    c.style.width = '100%'; c.style.height = 'auto'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', '课表预览（给学生/家长/销售）');
    el.replaceChildren(c);
  }, [picked, mondays, header]);

  const exportPng = async () => {
    setBusy(true);
    try {
      const pages = renderWeeks(picked, mondays, header, 2);
      let out = pages[0]!;
      if (pages.length > 1) { out = document.createElement('canvas'); out.width = pages[0]!.width; out.height = pages.reduce((n, p) => n + p.height, 0); const ctx = out.getContext('2d')!; let y = 0; for (const p of pages) { ctx.drawImage(p, 0, y); y += p.height; } }
      save(await blobOf(out, 'image/png'), fileBase + '.png'); toast.success('已导出 PNG 课表（给学生/家长/销售）');
    } catch { toast.error('导出失败，请重试'); } finally { setBusy(false); }
  };
  const exportPdf = async () => {
    setBusy(true);
    try {
      const pages = renderWeeks(picked, mondays, header, 2);
      const imgs = await Promise.all(pages.map(async p => ({ jpeg: new Uint8Array(await (await blobOf(p, 'image/jpeg', 0.93)).arrayBuffer()), width: p.width, height: p.height })));
      save(new Blob([imagesToPdf(imgs, { title: 'B.E.S.T 课表 ' + mondays[0] }) as BlobPart], { type: 'application/pdf' }), fileBase + '.pdf'); toast.success(`已导出 PDF 课表（${pages.length} 页 · 给学生/家长/销售）`);
    } catch { toast.error('导出失败，请重试'); } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog timetable-dialog">
    <DialogTitle><CalendarRange size={18} />导出课表 · 给学生 / 家长 / 销售</DialogTitle>
    <DialogDescription>生成友好的一周课程安排（日期、时间、课程名称、老师、线上/教室），适合发给学生、家长或销售，可下载 PNG 或 PDF。</DialogDescription>
    <div className="timetable-audience" role="note">受众：学生 / 家长 / 销售（非内部运营课表）</div>
    <div className="timetable-options">
      <FormField label="范围"><Picker label="范围" value={scope} onChange={v => setScope(v as Scope)} options={[{ value: 'mine', label: '我的课程（我是授课老师）' }, { value: 'teacher', label: '某位授课老师' }, { value: 'program', label: '某个项目' }]} /></FormField>
      {scope === 'teacher' && <FormField label="授课老师"><Picker label="授课老师" value={teacher} onChange={setTeacher} options={teachers.length ? teachers.map(t => ({ value: t, label: t })) : [{ value: '', label: '暂无授课老师' }]} /></FormField>}
      {scope === 'program' && <FormField label="项目"><Picker label="项目" value={program} onChange={setProgram} options={programs.length ? programs.map(p => ({ value: p.id, label: p.name })) : [{ value: '', label: '暂无排课的项目' }]} /></FormField>}
      <FormField label="起始周（任选该周一天）"><input type="date" value={from} onChange={e => setFrom(e.target.value ? mondayOf(e.target.value) : '')} /></FormField>
      <FormField label="周数"><Picker label="周数" value={weeks} onChange={setWeeks} options={['1', '2', '3', '4', '6', '8'].map(n => ({ value: n, label: n === '1' ? '仅本周' : `连续 ${n} 周` }))} /></FormField>
    </div>
    <div className="timetable-meta">{weekRangeLabel(mondays[0], mondays.length)} · 共 {total} 节课{mondays.length > 1 && ' · 预览显示第 1 周'}</div>
    <div className="timetable-preview" ref={preview} />
    <div className="actions">
      <button type="button" className="secondary" onClick={onClose}>关闭</button>
      <button type="button" className="secondary" disabled={busy} onClick={exportPng}><ImageDown size={16} />下载 PNG</button>
      <button type="button" className="primary" disabled={busy} onClick={exportPdf}><FileDown size={16} />下载 PDF</button>
    </div>
  </DialogContent></Dialog>;
}
