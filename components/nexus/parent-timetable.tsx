'use client';
/**
 * 「导出课表」 for one course, for students and parents: B.E.S.T-branded A4 pages with the student / team,
 * teacher, place, a month calendar of every meeting and the full session list. Canvas → PNG / PDF.
 */
import { useEffect, useMemo, useState } from 'react';
import { FileDown, ImageDown, CalendarHeart } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FormField, Picker } from './ui';
import { useNexus } from '@/lib/nexus/store';
import { imagesToPdf } from '@/lib/nexus/pdf';
import { occurrences, isoWeekday, weekdayLabels } from '@/lib/nexus/schedule';
import { today as todayIso } from '@/lib/nexus/ops';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",system-ui,sans-serif';
const SERIF = '"Songti SC","Noto Serif CJK SC","Source Han Serif SC",Georgia,serif';
export const PT_W = 1240, PT_H = 1754; // A4 portrait
const PAD = 84;
const C = { ink: '#2B2140', soft: '#6E6384', mute: '#A69CB8', line: '#ECE6F4', brand: '#5B3BB0', brand2: '#8B5CF6', tint: '#F6F2FD', gold: '#E9B949', cream: '#FFFCF7' };

export type ParentSession = { date: string; start: string; end: string; location: string };
export type ParentModel = { who: string; whoNote: string; program: string; course: string; code: string; teacher: string; location: string; sessions: ParentSession[]; generated: string; today: string };

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
const md = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
const months = (s: ParentSession[]) => [...new Set(s.map(x => x.date.slice(0, 7)))].sort();

function frame(ctx: CanvasRenderingContext2D, m: ParentModel, page: number, pages: number) {
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, PT_W, PT_H);
  // Soft corner glow.
  const glow = ctx.createRadialGradient(PT_W - 120, 120, 10, PT_W - 120, 120, 520);
  glow.addColorStop(0, 'rgba(139,92,246,.10)'); glow.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, PT_W, PT_H);
  // Wordmark.
  ctx.fillStyle = C.brand; ctx.font = `800 30px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('B.E.S.T', PAD, 104);
  ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(PAD + ctx.measureText('B.E.S.T').width + 10, 98, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.mute; ctx.font = `600 14px ${FONT}`; ctx.fillText('课程安排 · 学生与家长版', PAD, 130);
  ctx.textAlign = 'right'; ctx.fillText(`生成于 ${m.generated}`, PT_W - PAD, 104);
  if (pages > 1) ctx.fillText(`第 ${page} / ${pages} 页`, PT_W - PAD, 130);
  ctx.textAlign = 'left';
  // Footer.
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD, PT_H - 92); ctx.lineTo(PT_W - PAD, PT_H - 92); ctx.stroke();
  ctx.fillStyle = C.mute; ctx.font = `500 14px ${FONT}`;
  ctx.fillText('如需请假或调课，请提前联系授课老师或项目老师。期待每一次课堂上的成长 ✦', PAD, PT_H - 58);
  ctx.textAlign = 'right'; ctx.fillStyle = C.brand; ctx.font = `800 14px ${FONT}`; ctx.fillText('B.E.S.T', PT_W - PAD, PT_H - 58); ctx.textAlign = 'left';
}

function hero(ctx: CanvasRenderingContext2D, m: ParentModel): number {
  let y = 210;
  ctx.fillStyle = C.ink; ctx.font = `700 54px ${SERIF}`;
  ctx.fillText(fit(ctx, m.who ? `${m.who} 的课程表` : '课程表', PT_W - 2 * PAD), PAD, y);
  y += 46; ctx.fillStyle = C.soft; ctx.font = `500 22px ${FONT}`;
  ctx.fillText(fit(ctx, [m.program, m.course].filter(Boolean).join('  ·  '), PT_W - 2 * PAD), PAD, y);
  if (m.whoNote) { y += 34; ctx.fillStyle = C.mute; ctx.font = `500 17px ${FONT}`; ctx.fillText(fit(ctx, m.whoNote, PT_W - 2 * PAD), PAD, y); }
  // Info cards.
  y += 40;
  const first = m.sessions[0], last = m.sessions[m.sessions.length - 1];
  const cards: [string, string][] = [
    ['授课老师', m.teacher || '待定'], ['上课地点', m.location || '线上 / 待通知'],
    ['课程周期', first ? (first.date === last.date ? md(first.date) : `${md(first.date)} – ${md(last.date)}`) : '待定'], ['课时', `共 ${m.sessions.length} 节`],
  ];
  const gap = 18, w = (PT_W - 2 * PAD - gap * 3) / 4, h = 104;
  cards.forEach(([k, v], i) => {
    const x = PAD + i * (w + gap);
    rr(ctx, x, y, w, h, 20); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
    ctx.fillStyle = i === 3 ? C.gold : C.brand2; rr(ctx, x + 22, y + 24, 6, 18, 3); ctx.fill();
    ctx.fillStyle = C.mute; ctx.font = `600 15px ${FONT}`; ctx.fillText(k, x + 38, y + 39);
    ctx.fillStyle = C.ink; ctx.font = `700 23px ${FONT}`; ctx.fillText(fit(ctx, v, w - 44), x + 22, y + 78);
  });
  y += h;
  if (m.code) { y += 30; ctx.fillStyle = C.mute; ctx.font = `500 15px ${FONT}`; ctx.fillText(`课程编号 ${m.code}`, PAD, y); }
  return y + 40;
}

function monthCard(ctx: CanvasRenderingContext2D, ym: string, m: ParentModel, x: number, y: number, w: number): number {
  const [yy, mm] = ym.split('-').map(Number);
  const firstDay = `${ym}-01`, lead = isoWeekday(firstDay) - 1;
  const daysIn = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const rows = 6; // fixed so cards in one row line up
  const cw = (w - 40) / 7, ch = w < 400 ? 52 : 64, h = 84 + 30 + rows * ch + 18;
  rr(ctx, x, y, w, h, 24); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
  ctx.fillStyle = C.ink; ctx.font = `700 28px ${SERIF}`; const mw = ctx.measureText(`${mm}月`).width; ctx.fillText(`${mm}月`, x + 22, y + 50);
  ctx.fillStyle = C.mute; ctx.font = `500 15px ${FONT}`; ctx.fillText(String(yy), x + 30 + mw, y + 50);
  const count = m.sessions.filter(s => s.date.startsWith(ym)).length;
  ctx.textAlign = 'right'; ctx.fillStyle = C.brand; ctx.font = `700 16px ${FONT}`; ctx.fillText(`${count} 节`, x + w - 22, y + 49); ctx.textAlign = 'left';
  const gy = y + 84;
  ctx.font = `600 14px ${FONT}`; ctx.textAlign = 'center';
  weekdayLabels.forEach((d, i) => { ctx.fillStyle = i >= 5 ? '#C9A4B5' : C.mute; ctx.fillText(d.slice(1), x + 20 + cw * i + cw / 2, gy + 14); });
  for (let d = 1; d <= daysIn; d++) {
    const idx = lead + d - 1, r = Math.floor(idx / 7), col = idx % 7;
    const cx = x + 20 + col * cw, cy = gy + 30 + r * ch;
    const date = `${ym}-${String(d).padStart(2, '0')}`;
    const hit = m.sessions.filter(s => s.date === date);
    if (hit.length) {
      const past = date < m.today;
      rr(ctx, cx + 4, cy + 2, cw - 8, ch - 8, 16);
      const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch); g.addColorStop(0, past ? '#D9CFEA' : C.brand); g.addColorStop(1, past ? '#E6DEF2' : C.brand2);
      ctx.fillStyle = g; ctx.fill();
      const small = ch < 60;
      ctx.fillStyle = '#fff'; ctx.font = `800 ${small ? 18 : 22}px ${FONT}`; ctx.fillText(String(d), cx + cw / 2, cy + (small ? 24 : 30));
      ctx.font = `600 ${small ? 11 : 13}px ${FONT}`; ctx.fillText(hit[0].start + (hit.length > 1 ? ` +${hit.length - 1}` : ''), cx + cw / 2, cy + (small ? 40 : 50));
    } else {
      ctx.fillStyle = date === m.today ? C.brand : col >= 5 ? '#CDBFD8' : '#8E84A0'; ctx.font = `${date === m.today ? 800 : 500} 18px ${FONT}`;
      ctx.fillText(String(d), cx + cw / 2, cy + ch / 2 + 2);
    }
  }
  ctx.textAlign = 'left';
  return h;
}

const ROW = 56;
function listHeader(ctx: CanvasRenderingContext2D, y: number, title: string) {
  ctx.fillStyle = C.ink; ctx.font = `700 26px ${SERIF}`; ctx.fillText(title, PAD, y);
  y += 26; const cols = colX();
  ctx.fillStyle = C.mute; ctx.font = `600 14px ${FONT}`;
  ctx.fillText('节次', cols[0], y + 6); ctx.fillText('日期', cols[1], y + 6); ctx.fillText('时间', cols[2], y + 6); ctx.fillText('地点', cols[3], y + 6); ctx.fillText('老师', cols[4], y + 6);
  return y + 22;
}
const colX = () => [PAD + 24, PAD + 110, PAD + 400, PAD + 620, PT_W - PAD - 190];
function listRow(ctx: CanvasRenderingContext2D, m: ParentModel, s: ParentSession, i: number, y: number) {
  const past = s.date < m.today, cols = colX();
  rr(ctx, PAD, y, PT_W - 2 * PAD, ROW - 10, 16); ctx.fillStyle = i % 2 ? '#fff' : C.tint; ctx.fill();
  ctx.fillStyle = past ? '#C8BFD6' : C.brand; rr(ctx, cols[0] - 4, y + 10, 44, 26, 13); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), cols[0] + 18, y + 28); ctx.textAlign = 'left';
  ctx.fillStyle = past ? C.mute : C.ink; ctx.font = `700 20px ${FONT}`;
  ctx.fillText(`${md(s.date)}  ${weekdayLabels[isoWeekday(s.date) - 1]}`, cols[1], y + 30);
  ctx.fillStyle = past ? C.mute : C.brand; ctx.font = `700 20px ${FONT}`; ctx.fillText(`${s.start} – ${s.end}`, cols[2], y + 30);
  ctx.fillStyle = past ? C.mute : C.soft; ctx.font = `500 17px ${FONT}`;
  ctx.fillText(fit(ctx, s.location || m.location || '线上 / 待通知', cols[4] - cols[3] - 20), cols[3], y + 30);
  ctx.fillText(fit(ctx, m.teacher || '待定', PT_W - PAD - cols[4] - 16), cols[4], y + 30);
}

/** A4 pages: hero + calendar (+ as much of the list as fits), then list continuation pages. */
export function renderParentTimetable(m: ParentModel, scale = 2): HTMLCanvasElement[] {
  const bottom = PT_H - 130;
  const mk = () => { const c = document.createElement('canvas'); c.width = PT_W * scale; c.height = PT_H * scale; const ctx = c.getContext('2d')!; ctx.scale(scale, scale); return { c, ctx }; };
  // Content is drawn on transparent layers first, then laid over the framed pages once the page count is known.
  const layers: HTMLCanvasElement[] = [];
  let { c, ctx } = mk(); layers.push(c);
  let y = hero(ctx, m);
  const ms = months(m.sessions), cols = Math.max(1, Math.min(3, ms.length));
  const cardW = (PT_W - 2 * PAD - 24 * (cols - 1)) / cols;
  ctx.fillStyle = C.ink; ctx.font = `700 26px ${SERIF}`; ctx.fillText('上课日历', PAD, y); y += 24;
  for (let i = 0; i < ms.length; i += cols) {
    let h = 0;
    for (let k = 0; k < cols && ms[i + k]; k++) h = Math.max(h, monthCard(ctx, ms[i + k], m, PAD + k * (cardW + 24), y, cardW));
    y += h + 24;
  }
  if (!ms.length) { ctx.fillStyle = C.mute; ctx.font = `500 18px ${FONT}`; ctx.fillText('暂未排课', PAD, y + 30); y += 60; }
  y += 36;
  const newPage = (title: string) => { ({ c, ctx } = mk()); layers.push(c); y = listHeader(ctx, 210, title); };
  if (y + 60 + ROW > bottom) newPage('全部课次'); else y = listHeader(ctx, y, '全部课次');
  m.sessions.forEach((x, i) => { if (y + ROW > bottom) newPage('全部课次（续）'); listRow(ctx, m, x, i, y); y += ROW; });
  return layers.map((layer, k) => { const page = mk(); frame(page.ctx, m, k + 1, layers.length); page.ctx.setTransform(1, 0, 0, 1, 0, 0); page.ctx.drawImage(layer, 0, 0); return page.c; });
}

const blobOf = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), type, q));
function save(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
const stamp = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** Course → parent model; `who` = 'team' or a student id. */
export function useParentModel(courseId: string, who: string): ParentModel | null {
  const s = useNexus();
  return useMemo(() => {
    const c = s.courses.find(x => x.id === courseId); if (!c) return null;
    const team = s.teams.find(t => t.id === c.team);
    const roster = team ? s.students.filter(st => st.team === team.id || s.enrollments.some(e => e.student === st.id && e.team === team.id)) : [];
    const student = roster.find(st => st.id === who);
    const occ = occurrences([c], s.courseSessions);
    return {
      who: student ? `${student.name} 同学` : team?.name || '',
      whoNote: student ? (team ? `所属队伍：${team.name}` : '') : roster.length ? `学员：${roster.map(x => x.name).join('、')}` : '',
      program: s.programs.find(p => p.id === c.program)?.name || '', course: c.name, code: c.code || '', teacher: c.teacher, location: c.location || '',
      sessions: occ.map(o => ({ date: o.date, start: o.start || '', end: o.end || '', location: o.location })), generated: stamp(), today: todayIso(),
    };
  }, [s.courses, s.teams, s.students, s.enrollments, s.programs, s.courseSessions, courseId, who]);
}

export function ParentTimetableDialog({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const s = useNexus();
  const c = s.courses.find(x => x.id === courseId);
  const roster = useMemo(() => { const t = c?.team; return t ? s.students.filter(st => st.team === t || s.enrollments.some(e => e.student === st.id && e.team === t)) : []; }, [c, s.students, s.enrollments]);
  const [who, setWho] = useState('team');
  const model = useParentModel(courseId, who);
  const [busy, setBusy] = useState(false);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el || !model) return;
    const pages = renderParentTimetable(model, 1);
    el.replaceChildren(...pages.map((p, i) => { p.style.width = '100%'; p.style.height = 'auto'; p.setAttribute('role', 'img'); p.setAttribute('aria-label', `课表预览第 ${i + 1} 页`); return p; }));
  }, [model, el]);
  if (!c || !model) return null;
  const fileBase = `B.E.S.T课表-${model.who.replace(/\s+/g, '')}-${c.name.replace(/\s+/g, '')}`;
  const exportPng = async () => {
    setBusy(true);
    try {
      const pages = renderParentTimetable(model, 2);
      let out = pages[0]!;
      if (pages.length > 1) { out = document.createElement('canvas'); out.width = pages[0]!.width; out.height = pages.reduce((n, p) => n + p.height, 0); const ctx = out.getContext('2d')!; let y = 0; for (const p of pages) { ctx.drawImage(p, 0, y); y += p.height; } }
      save(await blobOf(out, 'image/png'), fileBase + '.png'); toast.success('已导出 PNG 课表');
    } catch { toast.error('导出失败，请重试'); } finally { setBusy(false); }
  };
  const exportPdf = async () => {
    setBusy(true);
    try {
      const pages = renderParentTimetable(model, 2);
      const imgs = await Promise.all(pages.map(async p => ({ jpeg: new Uint8Array(await (await blobOf(p, 'image/jpeg', 0.94)).arrayBuffer()), width: p.width, height: p.height })));
      save(new Blob([imagesToPdf(imgs, { pageW: 595.28, pageH: 841.89, margin: 0, title: 'B.E.S.T Timetable' }) as BlobPart], { type: 'application/pdf' }), fileBase + '.pdf'); toast.success(`已导出 PDF 课表（${pages.length} 页）`);
    } catch { toast.error('导出失败，请重试'); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="ops-dialog timetable-dialog parent-timetable-dialog">
    <DialogTitle><CalendarHeart size={18} />导出课表 · 学生 / 家长</DialogTitle>
    <DialogDescription>{c.name} · 共 {model.sessions.length} 节。生成带 B.E.S.T 品牌的课程表（日历 + 课次列表），可下载 PNG 或 A4 PDF 发给家长。</DialogDescription>
    <div className="timetable-options">
      <FormField label="课表抬头"><Picker label="课表抬头" value={who} onChange={setWho} options={[{ value: 'team', label: roster.length ? `整个队伍（${roster.length} 名学员）` : '课程 / 队伍' }, ...roster.map(st => ({ value: st.id, label: `${st.name} 同学` }))]} /></FormField>
    </div>
    <div className="timetable-preview parent-preview" ref={setEl} />
    <div className="actions">
      <button type="button" className="secondary" onClick={onClose}>关闭</button>
      <button type="button" className="secondary" disabled={busy} onClick={exportPng}><ImageDown size={16} />下载 PNG</button>
      <button type="button" className="primary" disabled={busy} onClick={exportPdf}><FileDown size={16} />下载 PDF</button>
    </div>
  </DialogContent></Dialog>;
}
