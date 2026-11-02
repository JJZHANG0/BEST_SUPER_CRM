/**
 * Single-page A4 PDF of all ops teachers' monthly OKR / 绩效 scores for 张捷嘉's 绩效考核.
 * Canvas → JPEG → imagesToPdf (same stack as 导出课表). Runtime-import free for tests.
 */
import { imagesToPdf } from './pdf';
import { scoreSheet, kpiStatusLabels, KPI_CATEGORIES, KR_POINTS, type KpiSheet, type KpiStatus } from './kpi';
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

/* ───────────── Per-person 绩效评分 PDF (exactly one A4 page) ───────────── */

export type KpiPersonPdfInput = {
  name: string;
  roleLabel: string;
  month: string;
  sheet: KpiSheet;
  generatedAt?: string;
  finalizedAt?: string;
  submittedAt?: string;
};

/** File name: 绩效评分-姓名-2026-10.pdf (filesystem-unsafe characters removed). */
export const kpiPersonPdfName = (name: string, month: string) => `绩效评分-${(name || '老师').replace(/[\\/:*?"<>|\s]+/g, '')}-${month}.pdf`;

/**
 * Lays everything out on ONE logical A4 canvas (1240×1754) rendered at 2× (2480×3508 ≈ 300 dpi).
 * One-page guarantee: the PDF is built from exactly one image; the KR table, KR descriptions and the
 * 评语 box are sized to the space left, with lines clamped + ellipsised — nothing can overflow.
 */
export async function renderKpiPersonPdf(input: KpiPersonPdfInput): Promise<Uint8Array> {
  if (typeof document === 'undefined') throw new Error('KPI PDF requires a browser canvas');
  const S = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = H * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);
  ctx.textBaseline = 'alphabetic';
  const { sheet } = input;
  const items = sheet.items;
  const sc = scoreSheet(items);
  const finalized = sheet.status === 'finalized';
  const total = finalized ? (sheet.total ?? sc.total) : sc.total;
  const P = 64, IW = W - 2 * P;

  // Background + soft glass blobs
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const blob = (x: number, y: number, r: number, col: string) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); };
  blob(1100, 260, 420, 'rgba(196,163,232,0.28)'); blob(120, 1500, 460, 'rgba(139,107,199,0.14)');

  // Header band
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#7A5BC0'); grad.addColorStop(1, '#C4A3E8');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 128);
  ctx.fillStyle = C.white; ctx.font = `800 36px ${FONT}`; ctx.fillText('B.E.S.T', P, 60);
  ctx.font = `600 15px ${FONT}`; ctx.globalAlpha = 0.92; ctx.fillText('BEST项目资料库 · 运营部绩效考核', P, 92); ctx.globalAlpha = 1;
  ctx.textAlign = 'right';
  ctx.font = `700 30px ${SERIF}`; ctx.fillText('月度绩效评分表', W - P, 60);
  ctx.font = `600 15px ${FONT}`; ctx.fillText(`${monthKeyLabel(input.month)} · PERFORMANCE REVIEW`, W - P, 92);
  ctx.textAlign = 'left';

  // Meta + score hero card
  let y = 156;
  const heroH = 236;
  card(ctx, P, y, IW, heroH);
  // Avatar + name
  ctx.fillStyle = C.soft; ctx.beginPath(); ctx.arc(P + 62, y + 66, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.brand; ctx.font = `800 30px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText((input.name || '—').slice(0, 1), P + 62, y + 77); ctx.textAlign = 'left';
  ctx.fillStyle = C.ink; ctx.font = `800 30px ${FONT}`; ctx.fillText(fit(ctx, input.name || '—', 360), P + 112, y + 62);
  ctx.fillStyle = C.mute; ctx.font = `500 14px ${FONT}`; ctx.fillText(fit(ctx, `${input.roleLabel} · ${monthKeyLabel(input.month)}`, 360), P + 112, y + 88);
  // status pill
  const st = kpiStatusLabels[sheet.status];
  ctx.font = `700 13px ${FONT}`;
  const pw = ctx.measureText(st).width + 28;
  ctx.fillStyle = statusColor(sheet.status); ctx.globalAlpha = 0.12; roundRect(ctx, P + 112, y + 102, pw, 26, 13); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = statusColor(sheet.status); ctx.fillText(st, P + 126, y + 120);
  // meta lines
  const meta: [string, string][] = [
    ['审核人', sheet.reviewedByName || '张捷嘉'],
    ['提交时间', input.submittedAt || '—'],
    [finalized ? '定稿时间' : '导出时间', (finalized ? input.finalizedAt : input.generatedAt) || '—'],
  ];
  meta.forEach(([k, v], i) => {
    const mx = P + 28 + i * 150;
    ctx.fillStyle = C.mute; ctx.font = `600 12px ${FONT}`; ctx.fillText(k, mx, y + 168);
    ctx.fillStyle = C.ink; ctx.font = `700 14px ${FONT}`; ctx.fillText(fit(ctx, v, 140), mx, y + 192);
  });
  // big total ring
  const rx = P + 600, ry = y + heroH / 2, rr = 78;
  ctx.lineWidth = 14; ctx.strokeStyle = C.soft; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.stroke();
  const rg = ctx.createLinearGradient(rx - rr, ry, rx + rr, ry); rg.addColorStop(0, '#7A5BC0'); rg.addColorStop(1, '#C4A3E8');
  ctx.strokeStyle = rg; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, total / 100))); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink; ctx.font = `800 44px ${FONT}`; ctx.fillText(num(total), rx, ry + 10);
  ctx.fillStyle = C.mute; ctx.font = `600 13px ${FONT}`; ctx.fillText(finalized ? '最终得分 / 100' : '暂计得分 / 100', rx, ry + 36);
  ctx.textAlign = 'left';
  // category bars
  const bx = P + 730, bw = W - P - 28 - bx;
  sc.categories.forEach((c, i) => {
    const cy = y + 34 + i * 50;
    ctx.fillStyle = C.ink; ctx.font = `700 14px ${FONT}`; ctx.fillText(`${c.key} ${c.name}`, bx, cy);
    ctx.fillStyle = C.mute; ctx.font = `500 12px ${FONT}`; ctx.fillText(`权重 ${c.weight}%`, bx + 92, cy);
    ctx.textAlign = 'right'; ctx.fillStyle = C.brand; ctx.font = `800 14px ${FONT}`;
    ctx.fillText(`${num(c.subtotal)}/${c.points} → ${num(c.weighted)}`, bx + bw, cy); ctx.textAlign = 'left';
    ctx.fillStyle = C.soft; roundRect(ctx, bx, cy + 9, bw, 8, 4); ctx.fill();
    ctx.fillStyle = C.brand; roundRect(ctx, bx, cy + 9, Math.max(8, bw * c.subtotal / c.points), 8, 4); ctx.fill();
  });
  y += heroH + 22;

  // Reserve 评语 box (adaptive) and footer; table takes the rest.
  const footerTop = H - 56;
  const noteText = (sheet.reviewNote || '').trim() || (finalized ? '（定稿时未填写评语）' : '（暂无评语）');
  const NOTE_FS = 15, NOTE_LH = 24, noteW = IW - 56;
  ctx.font = `500 ${NOTE_FS}px ${FONT}`;
  const noteAll = wrapParas(ctx, noteText, noteW, 99);
  const kr = items.length || 20;
  const MIN_ROW = 30;
  const tableHead = 40;
  const minTable = tableHead + kr * MIN_ROW + 12;
  const maxNoteLines = Math.max(2, Math.min(noteAll.length, 9, Math.floor((footerTop - 18 - y - minTable - 22 - 64) / NOTE_LH)));
  const noteLines = wrapParas(ctx, noteText, noteW, maxNoteLines);
  const noteH = 64 + noteLines.length * NOTE_LH;
  const noteTop = footerTop - 18 - noteH;
  const tableH = noteTop - 22 - y;

  // KR table
  card(ctx, P, y, IW, tableH);
  const cx = { cat: P + 18, kr: P + 150, score: W - P - 170, prog: W - P - 70 };
  ctx.fillStyle = C.soft; roundRect(ctx, P + 8, y + 8, IW - 16, tableHead - 8, 10); ctx.fill();
  ctx.fillStyle = C.mute; ctx.font = `700 12px ${FONT}`;
  ctx.fillText('类别 · 权重', cx.cat, y + 30); ctx.fillText('关键成果 KEY RESULTS', cx.kr, y + 30);
  ctx.textAlign = 'center'; ctx.fillText('上级评分', cx.score + 30, y + 30); ctx.fillText('完成进度', cx.prog + 24, y + 30); ctx.textAlign = 'left';
  const rowH = Math.min(64, (tableH - tableHead - 12) / kr);
  const TITLE_FS = rowH >= 34 ? 13 : 12, DESC_FS = 11, DESC_LH = 14;
  const descLines = Math.max(0, Math.min(2, Math.floor((rowH - 26) / DESC_LH)));
  let ry2 = y + tableHead + 6;
  const krW = cx.score - cx.kr - 16;
  for (const c of KPI_CATEGORIES) {
    const list = items.filter(x => x.category === c.key);
    if (!list.length) continue;
    const top = ry2, h = list.length * rowH;
    const sub = sc.categories.find(k => k.key === c.key)!;
    ctx.fillStyle = C.brand; ctx.font = `800 22px ${FONT}`; ctx.fillText(c.key, cx.cat, top + 30);
    ctx.fillStyle = C.ink; ctx.font = `700 14px ${FONT}`; ctx.fillText(c.name, cx.cat + 24, top + 28);
    ctx.fillStyle = C.mute; ctx.font = `500 12px ${FONT}`; ctx.fillText(`${c.points} 分 · ${c.weight}%`, cx.cat, top + 50);
    if (h > 76) { ctx.fillStyle = C.brand; ctx.font = `700 12px ${FONT}`; ctx.fillText(`小计 ${num(sub.subtotal)}/${c.points}`, cx.cat, top + 70); }
    list.forEach((x, i) => {
      const yy = ry2;
      if (i % 2 === 1) { ctx.fillStyle = 'rgba(243,237,249,0.55)'; ctx.fillRect(cx.kr - 10, yy, W - P - 8 - (cx.kr - 10), rowH); }
      const midTitle = descLines && x.description.trim() ? yy + 18 : yy + rowH / 2 + 5;
      ctx.fillStyle = x.title.trim() ? C.ink : C.none; ctx.font = `700 ${TITLE_FS}px ${FONT}`;
      ctx.fillText(fit(ctx, `${i + 1}. ${x.title.trim() || '（未填写）'}`, krW), cx.kr, midTitle);
      if (descLines && x.description.trim()) {
        ctx.fillStyle = C.mute; ctx.font = `500 ${DESC_FS}px ${FONT}`;
        wrap(ctx, x.description.replace(/\s*\n\s*/g, '；'), krW, descLines).forEach((ln, j) => ctx.fillText(ln, cx.kr, yy + 34 + j * DESC_LH));
      }
      const mid = yy + rowH / 2 + 6;
      ctx.textAlign = 'center';
      ctx.fillStyle = x.score === null ? C.none : x.score >= KR_POINTS ? C.good : x.score < 3 ? C.watch : C.brand;
      ctx.font = `800 16px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(x.score === null ? '—' : num(x.score), cx.score + 44, mid); ctx.textAlign = 'center';
      ctx.fillStyle = C.mute; ctx.font = `500 11px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('/5', cx.score + 48, mid); ctx.textAlign = 'center';
      ctx.fillStyle = C.ink; ctx.font = `600 13px ${FONT}`; ctx.fillText(x.progress === null ? '—' : x.progress + '%', cx.prog + 24, mid);
      ctx.textAlign = 'left';
      ry2 += rowH;
    });
    ctx.fillStyle = C.line; ctx.fillRect(P + 16, top + h, IW - 32, 1);
  }

  // 评语
  card(ctx, P, noteTop, IW, noteH);
  ctx.fillStyle = C.brand; roundRect(ctx, P, noteTop, 6, noteH, 3); ctx.fill();
  ctx.fillStyle = C.ink; ctx.font = `800 17px ${FONT}`; ctx.fillText('领导评语', P + 28, noteTop + 36);
  ctx.fillStyle = C.mute; ctx.font = `500 12px ${FONT}`; ctx.fillText(`— ${sheet.reviewedByName || '张捷嘉'}`, P + 112, noteTop + 36);
  ctx.fillStyle = C.ink; ctx.font = `500 ${NOTE_FS}px ${FONT}`;
  noteLines.forEach((ln, i) => ctx.fillText(ln, P + 28, noteTop + 66 + i * NOTE_LH));

  // Footer
  ctx.fillStyle = C.line; ctx.fillRect(P, footerTop, IW, 1);
  ctx.fillStyle = C.mute; ctx.font = `500 12px ${FONT}`;
  ctx.fillText(`每个 KR 满分 5 分 · 类别小计 ÷ O分值 × 权重 = 加权得分 · 导出于 ${input.generatedAt || ''}`, P, footerTop + 30);
  ctx.textAlign = 'right'; ctx.fillStyle = C.brand; ctx.font = `800 13px ${FONT}`; ctx.fillText('B.E.S.T', W - P, footerTop + 30); ctx.textAlign = 'left';

  const out = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', 0.95));
  const jpeg = new Uint8Array(await out.arrayBuffer());
  return imagesToPdf([{ jpeg, width: W * S, height: H * S }], { pageW: 595.28, pageH: 841.89, margin: 0, title: 'B.E.S.T KPI ' + input.month });
}

const num = (n: number) => String(Math.round(n * 100) / 100);
function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save(); ctx.shadowColor = 'rgba(122,91,192,0.10)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(ctx, x, y, w, h, 18); ctx.fill(); ctx.restore();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; roundRect(ctx, x, y, w, h, 18); ctx.stroke();
}
/** Wrap keeping paragraph breaks; last line ellipsised when clamped. */
function wrapParas(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number) {
  const out: string[] = [];
  const paras = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  for (let p = 0; p < paras.length; p++) {
    const left = maxLines - out.length;
    if (left <= 0) break;
    const ls = wrap(ctx, paras[p], max, left);
    out.push(...ls);
    if (out.length >= maxLines && p < paras.length - 1) { out[out.length - 1] = fit(ctx, out[out.length - 1] + '……', max); break; }
  }
  return out.length ? out : ['—'];
}
