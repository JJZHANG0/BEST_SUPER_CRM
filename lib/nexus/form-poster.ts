/**
 * Client-side poster for 收集表单 · 分享与收集.
 * Embeds the LIVE public form URL as a QR. Prefers optional assets under /form-poster/
 * (bg.png, logo.png, frame.png, mascot.png) when present; otherwise a polished programmatic design.
 */
import QRCode from 'qrcode';
import { assetUrl } from './assets';

export type PosterInput = {
  url: string;
  title: string;
  titleEn?: string;
  tipZh?: string;
  tipEn?: string;
  site?: string;
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

/** Wrap Chinese / mixed text to at most `max` characters per line (CJK counts as 1). */
function wrapTitle(text: string, max = 10): string[] {
  const t = text.trim();
  if (t.length <= max) return [t];
  const mid = Math.ceil(t.length / 2);
  return [t.slice(0, mid), t.slice(mid)];
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
  const title = input.title || '报名学员竞赛信息收集表';
  const titleEn = (input.titleEn || 'STUDENT COMPETITION INFORMATION FORM').toUpperCase();
  const tipZh = input.tipZh || '填写后由老师统一分配队伍';
  const tipEn = input.tipEn || 'TEACHERS WILL ASSIGN YOUR TEAM';
  const site = input.site || 'bestcrm.cc';

  // Optional assets: /form-poster/{bg,logo,frame,mascot}.png — fall back gracefully.
  const [bgAsset, logoAsset, frameAsset, mascotAsset, bunny] = await Promise.all([
    loadImg(assetUrl('form-poster/bg.png')),
    loadImg(assetUrl('form-poster/logo.png')),
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

  // Top brand
  const brandY = 170;
  if (logoAsset) {
    const lw = 280, lh = (logoAsset.height / logoAsset.width) * lw;
    g.drawImage(logoAsset, (W - lw) / 2, brandY - lh / 2, lw, lh);
  } else {
    // B.E.S.T wordmark
    g.fillStyle = '#2b2236';
    g.font = '800 56px Inter, "PingFang SC", "Helvetica Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const mark = 'B.E.S.T';
    // Draw with accent dots
    const mW = g.measureText(mark).width;
    let x = W / 2 - mW / 2;
    for (const ch of mark) {
      const cw = g.measureText(ch).width;
      g.fillStyle = ch === '.' ? '#7c4fd6' : '#2b2236';
      if (ch !== '.') {
        // gradient fill for letters
        const grd = g.createLinearGradient(0, brandY - 30, 0, brandY + 30);
        grd.addColorStop(0, '#2b2236');
        grd.addColorStop(1, '#6e40c9');
        g.fillStyle = grd;
      }
      g.fillText(ch, x + cw / 2, brandY);
      x += cw;
    }
    // Tag pill
    const tag = '报名信息收集';
    g.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    const tw = g.measureText(tag).width + 36;
    g.fillStyle = '#f2ecfd';
    roundRect(g, (W - tw) / 2, brandY + 42, tw, 36, 18);
    g.fill();
    g.fillStyle = '#7c4fd6';
    g.fillText(tag, W / 2, brandY + 60);
  }

  // Mascot (top-right of the card)
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

  // Title
  const titleLines = wrapTitle(title, 9);
  g.fillStyle = '#2b2236';
  g.font = '700 58px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const titleTop = 340;
  titleLines.forEach((l, i) => g.fillText(l, W / 2, titleTop + i * 72));
  g.fillStyle = '#9a8db0';
  g.font = '600 22px Inter, "Helvetica Neue", sans-serif';
  const enY = titleTop + titleLines.length * 72 + 18;
  {
    // Manual letter-spacing for ALL-CAPS EN
    const spacing = 4;
    let total = 0;
    for (const ch of titleEn) total += g.measureText(ch).width + spacing;
    total -= spacing;
    let cx = W / 2 - total / 2;
    for (const ch of titleEn) {
      g.fillText(ch, cx + g.measureText(ch).width / 2, enY);
      cx += g.measureText(ch).width + spacing;
    }
  }

  // QR card
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
  const cardY = 560;
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

  // Below QR
  const belowY = cardY + cardSize + 70;
  g.fillStyle = '#2b2236';
  g.font = '600 36px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.textAlign = 'center';
  g.fillText('微信扫码填写', W / 2, belowY);
  g.fillStyle = '#8a7f99';
  g.font = '700 20px Inter, "Helvetica Neue", sans-serif';
  {
    const label = 'SCAN TO REGISTER';
    const spacing = 5;
    let total = 0;
    for (const ch of label) total += g.measureText(ch).width + spacing;
    total -= spacing;
    let cx = W / 2 - total / 2;
    for (const ch of label) {
      g.fillText(ch, cx + g.measureText(ch).width / 2, belowY + 36);
      cx += g.measureText(ch).width + spacing;
    }
  }
  // Tip pill
  g.font = '500 24px "PingFang SC", "Microsoft YaHei", sans-serif';
  const tipW = Math.max(g.measureText(tipZh).width, 280) + 56;
  g.fillStyle = '#f2ecfd';
  roundRect(g, (W - tipW) / 2, belowY + 64, tipW, 52, 26);
  g.fill();
  g.fillStyle = '#6e40c9';
  g.fillText(tipZh, W / 2, belowY + 97);
  g.fillStyle = '#a99bc0';
  g.font = '600 16px Inter, sans-serif';
  {
    const spacing = 3;
    let total = 0;
    for (const ch of tipEn) total += g.measureText(ch).width + spacing;
    total -= spacing;
    let cx = W / 2 - total / 2;
    for (const ch of tipEn) {
      g.fillText(ch, cx + g.measureText(ch).width / 2, belowY + 140);
      cx += g.measureText(ch).width + spacing;
    }
  }

  // Bottom: site + decorative border line
  const botY = H - 140;
  g.strokeStyle = 'rgba(160,120,220,0.35)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(W / 2 - 160, botY - 30);
  g.lineTo(W / 2 - 20, botY - 30);
  g.moveTo(W / 2 + 20, botY - 30);
  g.lineTo(W / 2 + 160, botY - 30);
  g.stroke();
  // diamond accent
  g.fillStyle = '#7c4fd6';
  g.beginPath();
  g.moveTo(W / 2, botY - 38);
  g.lineTo(W / 2 + 7, botY - 30);
  g.lineTo(W / 2, botY - 22);
  g.lineTo(W / 2 - 7, botY - 30);
  g.closePath();
  g.fill();

  g.fillStyle = '#6e40c9';
  g.font = '700 28px Inter, "Helvetica Neue", sans-serif';
  g.fillText(site, W / 2, botY + 8);
  g.fillStyle = '#b2a8bf';
  g.font = '500 18px "PingFang SC", sans-serif';
  g.fillText('B.E.S.T · 报名信息收集', W / 2, botY + 42);

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
