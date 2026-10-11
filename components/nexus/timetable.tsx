'use client';
/**
 * 「导出课表」: a printable weekly class schedule (Mon–Sun × time slots, colour-coded courses with
 * course code, teacher and room / online, header with name · term · week range, legend), drawn on a
 * canvas so the PNG and the PDF (lib/nexus/pdf.ts, one A4-landscape page per week) are pixel-identical
 * and need no extra libraries on the static Pages build.
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
  occurrences, colorMap, timetableWeek, legend, weekStarts, weekRangeLabel, termLabel, addDays, mondayOf, PALETTE,
  type Occurrence, type TimetableWeek, type LegendItem,
} from '@/lib/nexus/schedule';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",system-ui,sans-serif';
const DAYS_EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAYS_ZH = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export type TimetableHeader = { title: string; subtitle: string; term: string; range: string; weekNo?: string; generated: string };

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}
/** Text clipped to `max` width with an ellipsis; returns the drawn string. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1; }
  return text.slice(0, lo) + '…';
}
/** Up to `lines` wrapped lines (CJK-friendly: breaks anywhere). */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number) {
  const out: string[] = []; let cur = '';
  for (const ch of text) { if (ctx.measureText(cur + ch).width > max && cur) { out.push(cur); cur = ch; if (out.length === lines) break; } else cur += ch; }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines) { const used = out.join('').length; if (used < [...text].length) out[lines - 1] = fit(ctx, out[lines - 1] + text.slice(used), max); }
  return out;
}

/** Logical size (CSS px) of one week page. */
export const PAGE_W = 1400;
const HOUR_H = 58, GRID_TOP = 150, TIME_W = 66, SIDE = 40;
export function pageHeight(week: TimetableWeek, items: number) {
  const hours = (week.toMin - week.fromMin) / 60;
  const legendRows = Math.max(1, Math.ceil(items / 3));
  return GRID_TOP + 46 + hours * HOUR_H + 40 + legendRows * 34 + 70;
}

export function drawTimetable(ctx: CanvasRenderingContext2D, week: TimetableWeek, items: LegendItem[], head: TimetableHeader, todayDate = '') {
  const W = PAGE_W, H = pageHeight(week, items.length);
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  // Header band
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#2B1B57'); g.addColorStop(1, '#5B3BB0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 112);
  ctx.fillStyle = '#C9B8F5'; ctx.font = `700 13px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('B.E.S.T  ·  CLASS SCHEDULE', SIDE, 36);
  ctx.fillStyle = '#ffffff'; ctx.font = `700 30px ${FONT}`; ctx.fillText(fit(ctx, head.title, W * 0.55), SIDE, 74);
  ctx.fillStyle = '#DCD0FA'; ctx.font = `500 14px ${FONT}`; ctx.fillText(fit(ctx, head.subtitle, W * 0.55), SIDE, 98);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff'; ctx.font = `700 20px ${FONT}`; ctx.fillText(head.range, W - SIDE, 52);
  ctx.fillStyle = '#DCD0FA'; ctx.font = `500 14px ${FONT}`; ctx.fillText(head.term + (head.weekNo ? '  ·  ' + head.weekNo : ''), W - SIDE, 78);
  ctx.fillText('Mon – Sun  ·  ' + DAYS_ZH[0] + '至' + DAYS_ZH[6], W - SIDE, 98);
  ctx.textAlign = 'left';

  // Grid geometry
  const gx = SIDE + TIME_W, gw = W - SIDE - gx, colW = gw / 7, hours = (week.toMin - week.fromMin) / 60;
  const top = GRID_TOP, headH = 46, gy = top + headH, gh = hours * HOUR_H;
  // Day header
  rr(ctx, SIDE, top - 14, W - 2 * SIDE, headH + gh + 14, 14); ctx.fillStyle = '#FBFAFE'; ctx.fill(); ctx.strokeStyle = '#E6E0F2'; ctx.lineWidth = 1; ctx.stroke();
  for (let d = 0; d < 7; d++) {
    const x = gx + d * colW, date = week.days[d], weekend = d >= 5, isToday = date === todayDate;
    if (weekend) { ctx.fillStyle = '#F4F1FA'; ctx.fillRect(x, gy, colW, gh); }
    if (isToday) { ctx.fillStyle = '#EFE8FD'; ctx.fillRect(x, gy, colW, gh); }
    ctx.fillStyle = isToday ? '#5B3BB0' : '#2A2140'; ctx.font = `800 13px ${FONT}`; ctx.fillText(DAYS_EN[d], x + 12, top + 12);
    ctx.fillStyle = '#7A6F90'; ctx.font = `500 12px ${FONT}`; ctx.fillText(`${DAYS_ZH[d]}  ${Number(date.slice(5, 7))}/${Number(date.slice(8))}`, x + 12, top + 30);
  }
  // Hour lines + labels
  ctx.font = `600 12px ${FONT}`;
  for (let i = 0; i <= hours; i++) {
    const y = gy + i * HOUR_H;
    ctx.strokeStyle = '#E3DCF0'; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(gx, y + .5); ctx.lineTo(gx + gw, y + .5); ctx.stroke();
    if (i < hours) { ctx.strokeStyle = '#EEE9F6'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(gx, y + HOUR_H / 2 + .5); ctx.lineTo(gx + gw, y + HOUR_H / 2 + .5); ctx.stroke(); ctx.setLineDash([]); }
    const m = week.fromMin + i * 60;
    ctx.fillStyle = '#8A7FA0'; ctx.textAlign = 'right'; ctx.fillText(`${String(Math.floor(m / 60)).padStart(2, '0')}:00`, gx - 10, y + 4); ctx.textAlign = 'left';
  }
  for (let d = 0; d <= 7; d++) { const x = gx + d * colW; ctx.strokeStyle = '#E3DCF0'; ctx.beginPath(); ctx.moveTo(x + .5, top - 14 + (d === 0 || d === 7 ? 14 : 0)); ctx.lineTo(x + .5, gy + gh); ctx.stroke(); }

  // Blocks
  for (const b of week.blocks) {
    const c = PALETTE[b.color];
    const laneW = (colW - 8) / b.lanes;
    const x = gx + b.day * colW + 4 + b.lane * laneW, y = gy + ((b.startMin - week.fromMin) / 60) * HOUR_H + 2;
    const w = laneW - (b.lanes > 1 ? 3 : 0), h = Math.max(26, ((b.endMin - b.startMin) / 60) * HOUR_H - 4);
    ctx.save();
    ctx.shadowColor = 'rgba(43,27,87,0.10)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    rr(ctx, x, y, w, h, 8); ctx.fillStyle = c.fill; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, x, y, w, h, 8); ctx.clip(); ctx.fillStyle = c.edge; ctx.fillRect(x, y, 4, h);
    const px = x + 11, maxW = w - 17; let ty = y + 17;
    ctx.fillStyle = c.edge; ctx.font = `800 11px ${FONT}`;
    ctx.fillText(fit(ctx, (b.code || 'COURSE') + '  ' + b.time, maxW), px, ty); ty += 17;
    ctx.fillStyle = c.ink; ctx.font = `700 13px ${FONT}`;
    const room = h - (ty - y) - 30;
    for (const line of wrap(ctx, b.title, maxW, room > 30 ? 2 : 1)) { if (ty > y + h - 6) break; ctx.fillText(line, px, ty); ty += 16; }
    ctx.fillStyle = c.ink; ctx.globalAlpha = .78; ctx.font = `500 11px ${FONT}`;
    if (ty + 2 < y + h - 4 && b.teacher) { ctx.fillText(fit(ctx, '授课  ' + b.teacher, maxW), px, ty + 2); ty += 15; }
    if (ty + 2 < y + h - 4 && b.location) { ctx.fillText(fit(ctx, '地点  ' + b.location, maxW), px, ty + 2); }
    ctx.restore();
  }
  if (!week.blocks.length) { ctx.fillStyle = '#A398B8'; ctx.font = `500 15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('本周没有排课', gx + gw / 2, gy + gh / 2); ctx.textAlign = 'left'; }

  // Legend
  let ly = gy + gh + 40;
  ctx.fillStyle = '#2A2140'; ctx.font = `800 13px ${FONT}`; ctx.fillText('LEGEND · 课程图例', SIDE, ly); ly += 14;
  const colLW = (W - 2 * SIDE) / 3;
  items.forEach((it, i) => {
    const c = PALETTE[it.color], x = SIDE + (i % 3) * colLW, y = ly + Math.floor(i / 3) * 34;
    rr(ctx, x, y + 6, 18, 18, 5); ctx.fillStyle = c.fill; ctx.fill(); ctx.fillStyle = c.edge; ctx.fillRect(x, y + 6, 4, 18);
    ctx.fillStyle = c.edge; ctx.font = `800 11px ${FONT}`; const code = it.code || '—'; ctx.fillText(fit(ctx, code, 120), x + 28, y + 20);
    const cw = Math.min(120, ctx.measureText(code).width) + 10;
    ctx.fillStyle = '#2A2140'; ctx.font = `600 12px ${FONT}`; ctx.fillText(fit(ctx, `${it.title} · ${it.teacher || '—'} · ${it.count} 节`, colLW - 40 - cw), x + 28 + cw, y + 20);
  });
  if (!items.length) { ctx.fillStyle = '#A398B8'; ctx.font = `500 12px ${FONT}`; ctx.fillText('—', SIDE, ly + 20); }
  // Footer
  ctx.fillStyle = '#A398B8'; ctx.font = `500 11px ${FONT}`;
  ctx.fillText('B.E.S.T 内部超级管理系统 · 课程安排导出', SIDE, H - 26);
  ctx.textAlign = 'right'; ctx.fillText('生成于 ' + head.generated, W - SIDE, H - 26); ctx.textAlign = 'left';
  ctx.restore();
  return { width: W, height: H };
}

type Scope = 'mine' | 'teacher' | 'program';
const stamp = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

/** Render every requested week to canvases (devicePixelRatio-independent, 2× for print sharpness). */
export function renderWeeks(occ: Occurrence<Course>[], mondays: string[], header: Omit<TimetableHeader, 'range' | 'weekNo'>, scale = 2) {
  const colors = colorMap(occ);
  return mondays.map((m, i) => {
    const week = timetableWeek(occ, m, colors);
    const inWeek = occ.filter(o => o.date >= m && o.date <= addDays(m, 6));
    const items = legend(inWeek, colors);
    const canvas = document.createElement('canvas');
    const h = pageHeight(week, items.length);
    canvas.width = PAGE_W * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!; ctx.scale(scale, scale);
    drawTimetable(ctx, week, items, { ...header, range: weekRangeLabel(m), weekNo: mondays.length > 1 ? `第 ${i + 1} / ${mondays.length} 周` : '' }, todayIso());
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
    title: scope === 'program' ? programName || '项目课表' : `${scope === 'mine' ? myName || '我' : teacher || '老师'} 的课表`,
    subtitle: scope === 'program' ? '项目课表 · Project Timetable' : scope === 'mine' ? '我的课程 · My Courses' : '授课老师课表 · Teacher Timetable',
    term: termLabel(mondays[0]), generated: stamp(),
  }), [scope, programName, myName, teacher, mondays]);
  const total = picked.filter(o => o.date >= mondays[0] && o.date <= addDays(mondays[mondays.length - 1], 6)).length;
  const fileBase = `课表-${header.title.replace(/\s+/g, '').replace(/的课表$/, '')}-${mondays[0]}${mondays.length > 1 ? '起' + mondays.length + '周' : ''}`;

  useEffect(() => {
    const el = preview.current; if (!el) return;
    const [c] = renderWeeks(picked, [mondays[0]], header, 1);
    c.style.width = '100%'; c.style.height = 'auto'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', '课表预览');
    el.replaceChildren(c);
  }, [picked, mondays, header]);

  const exportPng = async () => {
    setBusy(true);
    try {
      const pages = renderWeeks(picked, mondays, header, 2);
      let out = pages[0];
      if (pages.length > 1) { out = document.createElement('canvas'); out.width = pages[0].width; out.height = pages.reduce((n, p) => n + p.height, 0); const ctx = out.getContext('2d')!; let y = 0; for (const p of pages) { ctx.drawImage(p, 0, y); y += p.height; } }
      save(await blobOf(out, 'image/png'), fileBase + '.png'); toast.success('已导出 PNG 课表');
    } catch { toast.error('导出失败，请重试'); } finally { setBusy(false); }
  };
  const exportPdf = async () => {
    setBusy(true);
    try {
      const pages = renderWeeks(picked, mondays, header, 2);
      const imgs = await Promise.all(pages.map(async p => ({ jpeg: new Uint8Array(await (await blobOf(p, 'image/jpeg', 0.93)).arrayBuffer()), width: p.width, height: p.height })));
      save(new Blob([imagesToPdf(imgs, { title: 'B.E.S.T Timetable ' + mondays[0] }) as BlobPart], { type: 'application/pdf' }), fileBase + '.pdf'); toast.success(`已导出 PDF 课表（${pages.length} 页）`);
    } catch { toast.error('导出失败，请重试'); } finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog timetable-dialog">
    <DialogTitle><CalendarRange size={18} />导出课表</DialogTitle>
    <DialogDescription>按周生成课程表（周一至周日 × 时间段，按课程配色，含课程编号、授课老师与教室 / 线上），可下载 PNG 或 PDF（每周一页）。</DialogDescription>
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
