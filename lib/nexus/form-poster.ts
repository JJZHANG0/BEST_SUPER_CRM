/**
 * Client-side poster for 收集表单 · 分享与收集.
 * Embeds the LIVE public form URL as a QR. Prefers optional assets under /form-poster/
 * (bg.png, frame.png, mascot.png) when present; otherwise a polished programmatic design.
 */
import QRCode from 'qrcode';
import { assetUrl } from './assets';

export type PosterInput = {
  url: string;
  title: string;
  titleEn?: string;
};

const loadImg = (src: string): Promise<HTMLImageElement | null> =>
  new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Soft rounded rect path (Canvas 2D). */
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** Draw ALL-CAPS English with manual letter-spacing, centered. */
function drawSpacedCaps(
  g: CanvasRenderingContext2D,
  text: string,
  y: number,
  spacing: number,
) {
  let total = 0;
  for (const ch of text) total += g.measureText(ch).width + spacing;
  total -= spacing;
  let cx = g.canvas.width / 2 - total / 2;
  for (const ch of text) {
    const cw = g.measureText(ch).width;
    g.fillText(ch, cx + cw / 2, y);
    cx += cw + spacing;
  }
}

/**
 * Build a 1080×1920 vertical poster PNG blob.
 * Always regenerates the QR from `url` so the download never embeds a stale link.
 */
export async function buildFormPoster(input: PosterInput): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const title = (input.title || '报名学员竞赛信息收集表').trim();
  const titleEn = (input.titleEn || 'STUDENT COMPETITION INFORMATION FORM').toUpperCase();

  // Optional assets: /form-poster/{bg,frame,mascot}.png — fall back gracefully.
  // logo.png is intentionally unused (top brand block removed per design).
  const [bgAsset, frameAsset, mascotAsset, bunny] = await Promise.all([
    loadImg(assetUrl('form-poster/bg.png')),
    loadImg(assetUrl('form-poster/frame.png')),
    loadImg(assetUrl('form-poster/mascot.png')),
    loadImg(assetUrl('brand/bunny.png')),
  ]);
  const mascot = mascotAsset || bunny;

  // Background
  if (bgAsset) {
    g.drawImage(bgAsset, 0, 0, W, H);
  } else {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#f7f3ff');
    bg.addColorStop(0.45, '#faf8fe');
    bg.addColorStop(1, '#eef5fb');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // Soft brand orbs
    const orb = (x: number, y: number, r: number, color: string) => {
      const rad = g.createRadialGradient(x, y, 0, x, y, r);
      rad.addColorStop(0, color);
      rad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    orb(W * 0.9, H * 0.08, 420, 'rgba(180,140,235,0.32)');
    orb(W * 0.08, H * 0.92, 380, 'rgba(140,190,230,0.28)');
    orb(W * 0.55, H * 0.55, 260, 'rgba(200,170,240,0.12)');
  }

  // Outer decorative border (liquid-glass card)
  g.save();
  g.shadowColor = 'rgba(76,52,128,0.14)';
  g.shadowBlur = 40;
  g.shadowOffsetY = 12;
  g.fillStyle = 'rgba(255,255,255,0.78)';
  roundRect(g, 56, 56, W - 112, H - 112, 48);
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 2;
  roundRect(g, 56, 56, W - 112, H - 112, 48);
  g.stroke();
  // Accent inner hairline
  g.strokeStyle = 'rgba(160,120,220,0.22)';
  g.lineWidth = 1.5;
  roundRect(g, 76, 76, W - 152, H - 152, 40);
  g.stroke();

  if (frameAsset) g.drawImage(frameAsset, 0, 0, W, H);

  // Mascot (top-right of the card) — kept; logo/badge brand block removed
  if (mascot) {
    const mh = 200;
    const mw = (mascot.width / mascot.height) * mh;
    g.save();
    g.shadowColor = 'rgba(90,60,140,0.18)';
    g.shadowBlur = 24;
    g.shadowOffsetY = 8;
    g.drawImage(mascot, W - 56 - 40 - mw, 110, mw, mh);
    g.restore();
  }

  // Title — single line (no wrap). Slightly smaller font so long titles still fit.
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#2b2236';
  let titleSize = 52;
  g.font = `700 ${titleSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  const maxTitleW = W - 200;
  while (titleSize > 36 && g.measureText(title).width > maxTitleW) {
    titleSize -= 2;
    g.font = `700 ${titleSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  }
  // Lift title block + pack gaps so the poster feels denser after logo/tip/footer removal
  const titleTop = 240;
  g.fillText(title, W / 2, titleTop);

  g.fillStyle = '#9a8db0';
  g.font = '600 22px Inter, "Helvetica Neue", sans-serif';
  const enY = titleTop + 42;
  drawSpacedCaps(g, titleEn, enY, 4);

  // QR card — fixed tight stack under title (no floating center in leftover whitespace)
  const qrData = await QRCode.toDataURL(input.url, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#2b2236', light: '#ffffff' },
  });
  const qrImg = await loadImg(qrData);
  if (!qrImg) throw new Error('qr_failed');
  const cardSize = 700;
  const cardX = (W - cardSize) / 2;
  const gapTitleToQr = 48;
  const gapAboveScan = 36;
  const cardY = Math.round(enY + gapTitleToQr);

  g.save();
  g.shadowColor = 'rgba(76,52,128,0.18)';
  g.shadowBlur = 36;
  g.shadowOffsetY = 14;
  g.fillStyle = '#ffffff';
  roundRect(g, cardX, cardY, cardSize, cardSize, 36);
  g.fill();
  g.restore();
  // Soft accent ring
  g.strokeStyle = 'rgba(160,120,220,0.28)';
  g.lineWidth = 3;
  roundRect(g, cardX, cardY, cardSize, cardSize, 36);
  g.stroke();
  const pad = 48;
  g.drawImage(qrImg, cardX + pad, cardY + pad, cardSize - pad * 2, cardSize - pad * 2);

  // Below QR — keep scan instructions only
  const belowY = cardY + cardSize + gapAboveScan;
  g.fillStyle = '#2b2236';
  g.font = '600 36px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.textAlign = 'center';
  g.fillText('微信扫码填写', W / 2, belowY);
  g.fillStyle = '#8a7f99';
  g.font = '700 20px Inter, "Helvetica Neue", sans-serif';
  drawSpacedCaps(g, 'SCAN TO REGISTER', belowY + 36, 5);

  return await new Promise<Blob>((resolve, reject) => {
    c.toBlob(b => (b ? resolve(b) : reject(new Error('poster_blob_failed'))), 'image/png');
  });
}

/** Plain QR PNG (no poster chrome) for the LIVE url. */
export async function buildPlainQrPng(url: string, size = 1024): Promise<Blob> {
  const data = await QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#2b2236', light: '#ffffff' },
  });
  const res = await fetch(data);
  return res.blob();
}
