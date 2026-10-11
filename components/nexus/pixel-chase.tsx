'use client';
/**
 * High-res pixel-art chase for the workbench card.
 * Sequence (fleeing left, one-by-one with clear gaps): carrot → pig → snake → rabbit,
 * then the dog chasing behind. ~1–2 CSS px per texel — detailed sprites, not chunky upscales.
 * Click: Web Audio bark + quip. prefers-reduced-motion → static frame.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const QUIPS = [
  '又是被 PPT 支配的一天，牛马续命中…',
  '需求改第三版了？没事，工资没改。',
  '下班？那是下个季度的 OKR。',
  '会议纪要写完，会议又开一轮。',
  '周一立 flag，周五改需求，周末修 bug。',
  '咖啡续杯，牛马续命，创新继续。',
  '老板说「很快就好」，已经很快了三周。',
];

type Sprite = { pixels: string[]; colors: Record<string, string>; };
const T = ''; // transparent

/** Detailed panicked sprites — wider grids, small texels on canvas. */
const CARROT: Sprite = {
  colors: { '.': T, O: '#f08a2e', D: '#d46a18', L: '#ffb05a', G: '#4a9a3a', H: '#2f7a28', W: '#6bb84a' },
  pixels: [
    '......WW......',
    '.....WGGH.....',
    '....WGHGH.....',
    '.....HG.G.....',
    '......LO......',
    '.....LODL.....',
    '....LODOLD....',
    '...LODOLDOL...',
    '..LODOLDOLD...',
    '..ODOLDOLDO...',
    '...DOLDOLD....',
    '....OLDOL.....',
    '.....ODO......',
    '......O.......',
  ],
};

const PIG: Sprite = {
  colors: { '.': T, P: '#f2a8b8', D: '#e07890', K: '#c45a72', N: '#2a1a20', W: '#fff', E: '#fff5f8', S: '#ffd0da' },
  pixels: [
    '....SS..SS......',
    '...SPP..PP......',
    '..SPPPPPPP.SS...',
    '.SPWEWEPPPSPP...',
    'SPPNNNNPPPPPP...',
    'SPPPPPPPK.PPP...',
    '.SPPPKPPP.PP....',
    '..SPPPPPP.DD....',
    '...PP..PP.KK....',
    '...PD..PD.......',
    '...KK..KK.......',
  ],
};

const SNAKE: Sprite = {
  colors: { '.': T, G: '#5cb85c', D: '#3a8a3a', L: '#7ed87e', Y: '#f0d050', N: '#1a2010', R: '#e05040', W: '#fff' },
  pixels: [
    '..............LL..',
    '.............LYNW.',
    '............LGGGR.',
    '...........LGGGD..',
    '.........LLGGD....',
    '.......LLGGD......',
    '.....LLGGD........',
    '...LLGGD..........',
    '.LLGGD............',
    'LGGD..............',
    'GD................',
  ],
};

const RABBIT: Sprite = {
  colors: { '.': T, W: '#f4f0ea', G: '#c8c0b4', P: '#f2a8b8', N: '#2a2420', E: '#fff', R: '#e07070', B: '#d8d0c4' },
  pixels: [
    '..B....B........',
    '.WG....GW.......',
    '.WW....WW.......',
    '.WWB..BWW.......',
    '.WWWWWWWW.BB....',
    'WWWEWEWWW.WW....',
    'WWNNNNWW.WWW....',
    '.WWPPWWW.WW.....',
    '..WWWWWWWW......',
    '...WW..WW.......',
    '...WR..WR.......',
    '...BB..BB.......',
  ],
};

const DOG: Sprite = {
  colors: { '.': T, B: '#3d2a1f', C: '#c48a4a', A: '#a86e38', W: '#f5efe6', N: '#1a120c', P: '#e8b4a0', R: '#d45a4a', L: '#d4a060', E: '#fff' },
  pixels: [
    '.....BBB..........',
    '....BCCCB.BB......',
    '...BCCCCCBCCB.....',
    '..BCWEWECBCCCB....',
    '..BCNNNN.CCCCB....',
    '...BCCCCACCCCB....',
    '....BCCCCCCCPB....',
    '....ABCCCCCCB.....',
    '.....BCB..BCB.....',
    '.....BRB..BRB.....',
    '.....AAA..AAA.....',
  ],
};

function drawSprite(ctx: CanvasRenderingContext2D, spr: Sprite, ox: number, oy: number, scale: number, flip = false) {
  const rows = spr.pixels;
  const w = rows[0]!.length;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!;
    for (let x = 0; x < w; x++) {
      const col = spr.colors[row[x]!] ?? '';
      if (!col) continue;
      const dx = flip ? ox + (w - 1 - x) * scale : ox + x * scale;
      ctx.fillStyle = col;
      ctx.fillRect(dx, oy + y * scale, scale, scale);
    }
  }
}

function bark() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const t0 = ctx.currentTime;
    const mk = (freq: number, start: number, dur: number, type: OscillatorType, gain: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0 + start);
      o.frequency.exponentialRampToValueAtTime(freq * 0.45, t0 + start + dur);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(gain, t0 + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + start); o.stop(t0 + start + dur + 0.02);
    };
    mk(420, 0, 0.09, 'square', 0.18);
    mk(280, 0.1, 0.12, 'square', 0.14);
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = 0.12;
    src.connect(g); g.connect(ctx.destination);
    src.start(t0);
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch { /* audio unavailable */ }
}

export function PixelChase({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const raf = useRef(0);
  const start = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const paint = useCallback((t: number, staticFrame = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 300;
    const cssH = canvas.clientHeight || 160;
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const accentSoft = getComputedStyle(document.documentElement).getPropertyValue('--nx-accent-soft').trim() || '#ede6fc';
    const accentSofter = getComputedStyle(document.documentElement).getPropertyValue('--nx-accent-softer').trim() || '#f5f0fc';
    const g = ctx.createLinearGradient(0, 0, cssW, cssH);
    g.addColorStop(0, accentSoft + 'cc');
    g.addColorStop(1, accentSofter);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 22; i++) {
      const x = ((i * 47 + 13) % cssW);
      const y = ((i * 31 + 9) % Math.max(20, cssH - 50));
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // High-res: lock texels to ~1–2 CSS px (detailed pixel art, not chunky upscale).
    const spriteH = 14;
    const scale = Math.max(1, Math.min(1.5, Math.round(((Math.min(cssH, 180) * 0.32) / spriteH) * 2) / 2));
    const ground = Math.max(12, Math.min(cssH - 18 - spriteH * scale, cssH * 0.58));

    // Fit all five in the (often narrow) chase column with clear gaps.
    const sprW = 18 * scale;
    const gap = Math.max(sprW + 6, Math.min(sprW + 16, (cssW - sprW) / 4.4));
    const parade = gap * 4;

    const period = 11000;
    const start = cssW + sprW + 8;
    const travel = cssW + parade + sprW * 2 + 16;
    // Centered pack for reduced-motion / first paint; otherwise sweep right→left.
    const centerDogX = (cssW + parade) / 2;
    const dogX = staticFrame
      ? centerDogX
      : start - ((t % period) / period) * travel;
    const bob = (seed: number) => (staticFrame ? 0 : Math.sin((t / 110) + seed) * 1.6);

    // Left→right: carrot → pig → snake → rabbit, dog chasing from the right
    drawSprite(ctx, CARROT, dogX - gap * 4, ground + bob(0) - 2, scale, true);
    drawSprite(ctx, PIG,    dogX - gap * 3, ground + bob(1.1) + 2, scale, true);
    drawSprite(ctx, SNAKE,  dogX - gap * 2, ground + bob(2.0) + 3, scale, true);
    drawSprite(ctx, RABBIT, dogX - gap * 1, ground + bob(0.6), scale, true);
    drawSprite(ctx, DOG,    dogX,           ground + bob(1.7), scale, true);
  }, []);

  useEffect(() => {
    if (reduced) {
      paint(0, true);
      return;
    }
    start.current = performance.now();
    const loop = (now: number) => {
      paint(now - start.current, false);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [reduced, paint]);

  useEffect(() => {
    const onResize = () => paint(performance.now() - start.current, reduced);
    window.addEventListener('resize', onResize);
    const el = canvasRef.current?.parentElement;
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (el && ro) ro.observe(el);
    requestAnimationFrame(onResize);
    return () => { window.removeEventListener('resize', onResize); ro?.disconnect(); };
  }, [paint, reduced]);

  const onClick = () => {
    bark();
    setQuip(QUIPS[Math.floor(Math.random() * QUIPS.length)]!);
    window.setTimeout(() => setQuip(null), 2200);
  };

  return (
    <button type="button" className={`pixel-chase ${className}`.trim()} onClick={onClick} aria-label="像素追逐彩蛋：点击听狗叫，看牛马冷笑话">
      <canvas ref={canvasRef} className="pixel-chase-canvas" />
      {quip && <span className="pixel-chase-quip" role="status">{quip}</span>}
      {!quip && <span className="pixel-chase-hint">点击 · 牛马续命</span>}
    </button>
  );
}
