/**
 * Single-page A4 PDF of all ops teachers' monthly OKR / 绩效 scores for 张捷嘉's 绩效考核.
 * Canvas → JPEG → imagesToPdf (same stack as 导出课表). Runtime-import free for tests.
 */
import { imagesToPdf } from './pdf';
import { scoreSheet, kpiStatusLabels, type KpiSheet, type KpiStatus } from './kpi';
import { monthKeyLabel } from './todos';

export type KpiExportRow = {
  name: string;
  roleLabel: string;
  status: KpiStatus | 'none';
  total: number | null;
  reviewNote: string;
  reviewedByName: string;
  filled: number;
  slots: number;
};

const W = 1240, H = 1754; // ~A4 portrait @ 150 dpi
const PAD = 56;
const FONT = 'system-ui, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const SERIF = '"Songti SC", "Noto Serif SC", "Songti SC", serif';
const C = {
  bg: '#FBF8FE', ink: '#2B2236', mute: '#8D7F9B', brand: '#7A5BC0', soft: '#F3EDF9',
  line: '#EBE3F4', good: '#3D8B6E', watch: '#C07A2A', draft: '#6B7C9B', none: '#A093AD', white: '#FFFFFF',
};

const fit = (ctx: CanvasRenderingContext2D, text: string, max: number) => {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
};

const wrap = (ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number) => {
  const t = (text || '').trim() || '—';
  const lines: string[] = [];
  let line = '';
  for (const ch of t) {
    const next = line + ch;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = ch; if (lines.length >= maxLines) break; }
    else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && (line.length > lines[maxLines - 1].length || t.length > lines.join('').length)) {
    lines[maxLines - 1] = fit(ctx, lines[maxLines - 1], max);
  }
  return lines;
};

const statusColor = (st: KpiStatus | 'none') =>
  st === 'finalized' ? C.good : st === 'submitted' ? C.watch : st === 'draft' ? C.draft : C.none;

export function buildKpiExportRows(rows: readonly { user: { name: string; role: string }; sheet: KpiSheet | null }[]): KpiExportRow[] {
  return rows.map(r => {
    const st = (r.sheet?.status ?? 'none') as KpiStatus | 'none';
    const items = r.sheet?.items || [];
    const filled = items.filter(x => x.category !== 'D' && x.title.trim()).length;
    const scored = items.length ? scoreSheet(items).total : null;
    const total = st === 'finalized' ? (r.sheet?.total ?? scored) : st === 'submitted' ? scored : null;
    return {
      name: r.user.name,
      roleLabel: r.user.role === 'ops' ? '项目运营老师' : '超级管理员',
      status: st,
      total,
      reviewNote: (r.sheet?.reviewNote || '').trim(),
      reviewedByName: r.sheet?.reviewedByName || '张捷嘉',
      filled,
      slots: 16,
    };
  });
}

/** Draw one portrait page; scales content to fit. Returns JPEG bytes for imagesToPdf. */
export async function renderKpiMonthPdf(
  month: string,
  rows: readonly KpiExportRow[],
  opts: { generatedAt?: string; reviewer?: string } = {},
): Promise<Uint8Array> {
  if (typeof document === 'undefined') throw new Error('KPI PDF requires a browser canvas');
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // Header band
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#8B6BC7'); grad.addColorStop(1, '#C4A3E8');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 118);
  ctx.fillStyle = C.white; ctx.font = `800 34px ${FONT}`; ctx.fillText('B.E.S.T', PAD, 52);
  ctx.font = `600 16px ${FONT}`; ctx.fillText('内部系统 · 运营部绩效考核', PAD, 82);
  ctx.textAlign = 'right';
  ctx.font = `700 26px ${SERIF}`; ctx.fillText(monthKeyLabel(month) + ' OKR 汇总', W - PAD, 52);
  ctx.font = `500 14px ${FONT}`; ctx.fillText(`审核人 ${opts.reviewer || '张捷嘉'} · ${opts.generatedAt || ''}`, W - PAD, 82);
  ctx.textAlign = 'left';

  // Summary strip
  let y = 148;
  const n = rows.length;
  const finalized = rows.filter(r => r.status === 'finalized').length;
  const submitted = rows.filter(r => r.status === 'submitted').length;
  const scored = rows.filter(r => r.status === 'finalized' && r.total != null);
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + (r.total || 0), 0) / scored.length * 10) / 10 : null;
  const cards = [
    ['老师人数', String(n)],
    ['已定稿', String(finalized)],
    ['待审核', String(submitted)],
    ['平均分', avg == null ? '—' : String(avg)],
  ];
  const cw = (W - 2 * PAD - 36) / 4;
  cards.forEach(([k, v], i) => {
    const x = PAD + i * (cw + 12);
    ctx.fillStyle = C.white; roundRect(ctx, x, y, cw, 72, 14); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; roundRect(ctx, x, y, cw, 72, 14); ctx.stroke();
    ctx.fillStyle = C.mute; ctx.font = `600 13px ${FONT}`; ctx.fillText(k, x + 18, y + 28);
    ctx.fillStyle = C.ink; ctx.font = `800 28px ${FONT}`; ctx.fillText(v, x + 18, y + 58);
  });
  y += 96;

  // Table header
  ctx.fillStyle = C.soft; roundRect(ctx, PAD, y, W - 2 * PAD, 40, 10); ctx.fill();
  const cols = [PAD + 18, PAD + 160, PAD + 320, PAD + 430, PAD + 540];
  ctx.fillStyle = C.mute; ctx.font = `700 13px ${FONT}`;
  ['老师', '状态', '已填 KR', '加权总分', '领导评语'].forEach((h, i) => ctx.fillText(h, cols[i], y + 26));
  y += 52;

  const bottom = H - 72;
  const avail = bottom - y;
  const rowH = Math.max(52, Math.min(88, Math.floor(avail / Math.max(1, rows.length))));
  const noteLines = rowH >= 76 ? 2 : 1;

  rows.forEach((r, idx) => {
    if (y + rowH > bottom) return;
    if (idx % 2 === 0) { ctx.fillStyle = '#FFFFFF'; roundRect(ctx, PAD, y - 8, W - 2 * PAD, rowH, 10); ctx.fill(); }
    ctx.fillStyle = C.ink; ctx.font = `700 16px ${FONT}`; ctx.fillText(fit(ctx, r.name, 130), cols[0], y + 14);
    ctx.fillStyle = C.mute; ctx.font = `500 11px ${FONT}`; ctx.fillText(fit(ctx, r.roleLabel, 130), cols[0], y + 32);

    const st = kpiStatusLabels[r.status];
    ctx.fillStyle = statusColor(r.status); ctx.font = `700 13px ${FONT}`; ctx.fillText(st, cols[1], y + 20);

    ctx.fillStyle = C.ink; ctx.font = `600 14px ${FONT}`; ctx.fillText(r.status === 'none' ? '—' : `${r.filled}/${r.slots}`, cols[2], y + 20);

    const showTotal = r.status === 'finalized' || r.status === 'submitted';
    ctx.fillStyle = r.status === 'finalized' ? C.brand : C.mute;
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText(showTotal && r.total != null ? String(r.total) : '—', cols[3], y + 22);
    if (showTotal && r.total != null) { ctx.font = `500 11px ${FONT}`; ctx.fillStyle = C.mute; ctx.fillText('/ 100', cols[3] + ctx.measureText(String(r.total)).width + 6, y + 22); }

    ctx.fillStyle = C.ink; ctx.font = `500 12px ${FONT}`;
    const note = r.reviewNote || (r.status === 'finalized' ? '（无评语）' : r.status === 'submitted' ? '待定稿' : '—');
    const lines = wrap(ctx, note, W - PAD - cols[4] - 12, noteLines);
    lines.forEach((ln, i) => ctx.fillText(ln, cols[4], y + 14 + i * 16));
    y += rowH;
  });

  // Footer
  ctx.fillStyle = C.line; ctx.fillRect(PAD, H - 52, W - 2 * PAD, 1);
  ctx.fillStyle = C.mute; ctx.font = `500 12px ${FONT}`;
  ctx.fillText('B.E.S.T · 当月绩效一键导出 · 单页汇总（自动缩放）', PAD, H - 28);
  ctx.textAlign = 'right'; ctx.fillStyle = C.brand; ctx.font = `800 13px ${FONT}`; ctx.fillText('B.E.S.T', W - PAD, H - 28); ctx.textAlign = 'left';

  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', 0.92));
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  return imagesToPdf([{ jpeg, width: W, height: H }], { pageW: 595.28, pageH: 841.89, margin: 0, title: 'B.E.S.T KPI ' + month });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
