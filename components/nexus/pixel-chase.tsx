'use client';
/**
 * Pixel-art chase for the workbench lower-right card: a dog chasing a carrot,
 * pig, snake and rabbit, looping right→left. Click for a Web Audio bark + quip.
 * Respects prefers-reduced-motion (static frame).
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const QUIPS = [
  '汪！今天也要让创新发生～',
  '胡萝卜快跑，狗狗更快！',
  '小猪：我只是来凑热闹的…',
  '蛇：嘶——别踩尾巴！',
  '兔子：这才不是奥运会！',
  'B.E.S.T · 每一次追赶都算数',
  '汪汪！点我还有彩蛋哦',
];

type Sprite = { pixels: string[]; colors: Record<string, string> };

const DOG: Sprite = {
  colors: { '.': '', B: '#3d2a1f', C: '#c48a4a', W: '#f5efe6', N: '#1a120c', P: '#e8b4a0', R: '#d45a4a' },
  pixels: [
    '..BBB........',
    '.BCCCB.......',
    'BCCCCCB.BB...',
    'BCWNWCBBCCB..',
    'BCCCCC.CCCCB.',
    '.BCCCCCCCPB..',
    '..BCCCCCCB...',
    '..BCB..BCB...',
    '..BRB..BRB...',
  ],
};
const CARROT: Sprite = {
  colors: { '.': '', O: '#f08a2e', G: '#4a9a3a', D: '#d46a18' },
  pixels: [
    '....GG....',
    '...GGG....',
    '....GO....',
    '...ODO....',
    '..ODOD....',
    '.ODODO....',
    '..ODO.....',
    '...O......',
  ],
};
const PIG: Sprite = {
  colors: { '.': '', P: '#f2a8b8', D: '#e07890', N: '#2a1a20', W: '#fff' },
  pixels: [
    '..PPP.......',
    '.PPPPP.PP...',
    'PPWNWPPPP...',
    'PPPPPP.PP...',
    '.PPDPPPP....',
    '..PP..PP....',
  ],
};
const SNAKE: Sprite = {
  colors: { '.': '', G: '#5cb85c', D: '#3a8a3a', Y: '#f0d050', N: '#1a2010' },
  pixels: [
    '........GG..',
    '.......GYNG.',
    '......GGGG..',
    '...GGGGD....',
    '.GGGD.......',
    'GGD.........',
  ],
};
const RABBIT: Sprite = {
  colors: { '.': '', W: '#f4f0ea', G: '#c8c0b4', P: '#f2a8b8', N: '#2a2420', E: '#fff' },
  pixels: [
    '.G...G......',
    '.W...W......',
    '.WW.WW......',
    'WWWEWW.WW...',
    'WWNNW.WWW...',
    '.WWWPWWW....',
    '..WW.WW.....',
  ],
};

function drawSprite(ctx: CanvasRenderingContext2D, spr: Sprite, ox: number, oy: number, scale: number, flip = false) {
  const rows = spr.pixels;
  const w = rows[0].length;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const col = spr.colors[ch];
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
    // Short noisy "bark": two descending square bursts + noise.
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
    // Soft noise burst
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
    // Soft purple ground
    const g = ctx.createLinearGradient(0, 0, cssW, cssH);
    g.addColorStop(0, '#ebe4f9');
    g.addColorStop(1, '#e4dff6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    // Stars / dots
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 18; i++) {
      const x = ((i * 47 + 13) % cssW);
      const y = ((i * 31 + 9) % Math.max(20, cssH - 50));
      ctx.fillRect(x, y, 2, 2);
    }
    const scale = Math.max(3, Math.floor(Math.min(cssW, cssH) / 55));
    const ground = cssH - 8 - 9 * scale;
    // Loop period ~7s; entities run right→left
    const period = 7000;
    const phase = staticFrame ? 0.35 : ((t % period) / period);
    const runX = (offset: number, spread: number) => {
      const p = (phase + offset) % 1;
      return cssW + 40 - p * (cssW + spread);
    };
    // Order: dog chasing the pack (dog furthest right among the chase)
    drawSprite(ctx, CARROT, runX(0.0, 120), ground - 2, scale, true);
    drawSprite(ctx, PIG, runX(0.08, 140), ground + scale, scale, true);
    drawSprite(ctx, SNAKE, runX(0.16, 150), ground + scale * 2, scale, true);
    drawSprite(ctx, RABBIT, runX(0.24, 160), ground, scale, true);
    drawSprite(ctx, DOG, runX(0.32, 180), ground, scale, true);
    // Bobbing: slight vertical wobble for dog
    if (!staticFrame) {
      // already drawn; fine as-is for pixel look
    }
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
    return () => window.removeEventListener('resize', onResize);
  }, [paint, reduced]);

  const onClick = () => {
    bark();
    setQuip(QUIPS[Math.floor(Math.random() * QUIPS.length)]);
    window.setTimeout(() => setQuip(null), 2200);
  };

  return (
    <button type="button" className={`pixel-chase ${className}`.trim()} onClick={onClick} aria-label="像素追逐彩蛋：点击听狗叫">
      <canvas ref={canvasRef} className="pixel-chase-canvas" />
      {quip && <span className="pixel-chase-quip" role="status">{quip}</span>}
      {!quip && <span className="pixel-chase-hint">点击 · 汪！</span>}
    </button>
  );
}
