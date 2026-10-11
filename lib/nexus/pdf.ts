/**
 * Tiny dependency-free PDF writer: one JPEG per page (DCTDecode), fitted inside a margin and centred.
 * Used by 「导出课表」 so the static Pages build needs no PDF library. Runtime-import free (tests load it).
 */
export type PdfImage = { jpeg: Uint8Array; width: number; height: number };
const enc = (s: string) => new TextEncoder().encode(s);
/** A4 landscape in points. */
export const A4_LANDSCAPE = { w: 841.89, h: 595.28 } as const;
export function imagesToPdf(pages: readonly PdfImage[], opts: { pageW?: number; pageH?: number; margin?: number; title?: string } = {}): Uint8Array {
  const W = opts.pageW ?? A4_LANDSCAPE.w, H = opts.pageH ?? A4_LANDSCAPE.h, M = opts.margin ?? 18;
  const chunks: Uint8Array[] = []; const offsets: number[] = []; let size = 0;
  const push = (b: Uint8Array) => { chunks.push(b); size += b.length; };
  const obj = (n: number, body: (Uint8Array | string)[]) => { offsets[n] = size; push(enc(`${n} 0 obj\n`)); for (const b of body) push(typeof b === 'string' ? enc(b) : b); push(enc('\nendobj\n')); };
  push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
  const n = pages.length, pageIds = pages.map((_, i) => 4 + i * 3);
  const title = (opts.title || 'B.E.S.T Timetable').replace(/[()\\]/g, '');
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Count ${n} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`]);
  // Info dictionary (ASCII title only; CJK titles are dropped rather than mis-encoded).
  obj(3, [`<< /Producer (B.E.S.T) /Title (${/^[\x20-\x7e]*$/.test(title) ? title : 'B.E.S.T Timetable'}) >>`]);
  pages.forEach((p, i) => {
    const pid = pageIds[i], cid = pid + 1, iid = pid + 2;
    const scale = Math.min((W - 2 * M) / p.width, (H - 2 * M) / p.height);
    const w = p.width * scale, h = p.height * scale, x = (W - w) / 2, y = (H - h) / 2;
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    obj(pid, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`]);
    obj(cid, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    obj(iid, [`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
  });
  const total = 4 + n * 3, xref = size;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(enc(table + `trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(size); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
