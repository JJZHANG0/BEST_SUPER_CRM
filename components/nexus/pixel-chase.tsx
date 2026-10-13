'use client';
/**
 * Floating white-rabbit robot desktop pet (replaces the old dog-chase card).
 * Pixel-art sprite with many cheeky expressions that auto-cycle.
 * Portalled to <body>, fixed bottom-right, transparent — no card/frame.
 * Click: soft boop + quip. prefers-reduced-motion → static idle.
 */
import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const QUIPS = [
  '又是被 PPT 支配的一天，兔兔续命中…',
  '需求改第三版了？没事，工资没改。',
  '下班？那是下个季度的 OKR。',
  '会议纪要写完，会议又开一轮。',
  '周一立 flag，周五改需求，周末修 bug。',
  '咖啡续杯，牛马续命，创新继续。',
  '老板说「很快就好」，已经很快了三周。',
  '哼哼，被我逮到摸鱼了吧？',
  '课时记完了吗？兔兔在盯着你哦～',
  '贱兮兮笑一下，压力就小一点。',
];

type Sprite = { pixels: string[]; colors: Record<string, string> };

/** Shared palette — white rabbit robot (Codex-pet vibe). */
const C: Record<string, string> = {
  '.': '',
  K: '#1a1520', // outline
  W: '#f8f5f0', // white fur / shell
  G: '#e0d8ce', // body shade
  P: '#f5b6c4', // pink ear / mouth
  D: '#e890a0', // deep pink
  N: '#1e1a22', // pupil
  E: '#ffffff', // eye white
  R: '#ff5a6e', // tongue / heart
  B: '#b8b0c0', // metal joint
  M: '#8a8498', // metal mid
  Y: '#ffe066', // sparkle
  H: '#ffc0d0', // blush
  S: '#2a2430', // face screen
  Z: '#c8c0d0', // closed-eye dash on screen
};

/**
 * Full 16×20 sprites. Rows 0–5 ears/head, 6–11 dark face screen, 12–19 body/legs.
 * Only the screen band differs per expression.
 */
const HEAD: string[] = [
  '....KK....KK....',
  '...KPPK..KPPK...',
  '...KPWK..KWPK...',
  '...KWWK..KWWK...',
  '....KKWWWWKK....',
  '...KWWWWWWWWK...',
];

const BODY: string[] = [
  '...KWGGGGGGWK...',
  '...KWGGMMGGWK...',
  '....KWGGGGWK....',
  '.....KWWWWK.....',
  '....KBK..KBK....',
  '....KWK..KWK....',
  '....KBK..KBK....',
  '.....KK..KK.....',
];

/** Face/screen band: 6 rows × 16 cols. */
type FaceBand = string[];

const FACES: { id: string; face: FaceBand; weight: number }[] = [
  {
    id: 'idle',
    weight: 3,
    face: [
      '...KSSSSSSSSK...',
      '..KS.ENNENN.SK..',
      '..KS.NNNNNN.SK..',
      '..KS........SK..',
      '..KS...PP...SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'wink',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS.ZZZ.ENN.SK.',
      '..KS.....NNN.SK.',
      '..KS........SK..',
      '..KS...RR...SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'tongue',
    weight: 3,
    face: [
      '...KSSSSSSSSK...',
      '..KS.ENN.ENN.SK.',
      '..KS.NNN.NNN.SK.',
      '..KS........SK..',
      '..KS..KRRRK.SK..',
      '...KSS.RRR.SSK..',
    ],
  },
  {
    id: 'smirk',
    weight: 3,
    face: [
      '...KSSSSSSSSK...',
      '..KS..ENN.ENNSK.',
      '..KS..NNN.NNNSK.',
      '..KS........SK..',
      '..KS....PP..SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'grin',
    weight: 3,
    face: [
      '...KSSSSSSSSK...',
      '..KS.EYN.EYN.SK.',
      '..KS.NNN.NNN.SK.',
      '..KS.H....H.SK..',
      '..KS.KKKKKK.SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'hearts',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS.R.R.R.R.SK.',
      '..KS.RRR.RRR.SK.',
      '..KS..R...R.SK..',
      '..KS...PP...SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'sleepy',
    weight: 1,
    face: [
      '...KSSSSSSSSK...',
      '..KS.ZZZ.ZZZ.SK.',
      '..KS........SK..',
      '..KS........SK..',
      '..KS...Z.Z..SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'owo',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS.ENN.ENN.SK.',
      '..KS.NNN.NNN.SK.',
      '..KS........SK..',
      '..KS...NN...SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'evil',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS.KNN.NNK.SK.',
      '..KS.NNN.NNN.SK.',
      '..KS.H....H.SK..',
      '..KS..KKKK..SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'blush',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS.ENN.ENN.SK.',
      '..KS.NNN.NNN.SK.',
      '..KS.HH..HH.SK..',
      '..KS...PP...SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'away',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS...ENN.ENSK.',
      '..KS...NNN.NNSK.',
      '..KS........SK..',
      '..KS.....PP.SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'sparkle',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS.EYN.EYN.SK.',
      '..KS.YNY.YNY.SK.',
      '..KS........SK..',
      '..KS...YY...SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'pout',
    weight: 1,
    face: [
      '...KSSSSSSSSK...',
      '..KS.KNN.NNK.SK.',
      '..KS.NNN.NNN.SK.',
      '..KS........SK..',
      '..KS...KK...SK..',
      '...KSSSSSSSSK...',
    ],
  },
  {
    id: 'laugh',
    weight: 2,
    face: [
      '...KSSSSSSSSK...',
      '..KS.ENN.ENN.SK.',
      '..KS.NNN.NNN.SK.',
      '..KS.H....H.SK..',
      '..KS..KNNNK.SK..',
      '...KSS.KNNK.SSK.',
    ],
  },
];

function assertFaces() {
  for (const f of FACES) {
    for (const row of f.face) {
      if (row.length !== 16) throw new Error(`face ${f.id} bad row len ${row.length}: ${row}`);
    }
  }
  for (const row of HEAD) if (row.length !== 16) throw new Error(`head ${row}`);
  for (const row of BODY) if (row.length !== 16) throw new Error(`body ${row}`);
}

function assembleSprite(face: FaceBand): Sprite {
  return { colors: C, pixels: [...HEAD, ...face, ...BODY] };
}

function drawSprite(ctx: CanvasRenderingContext2D, spr: Sprite, ox: number, oy: number, scale: number) {
  const rows = spr.pixels;
  const w = rows[0]!.length;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!;
    for (let x = 0; x < w; x++) {
      const col = spr.colors[row[x]!] ?? '';
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

function pickWeighted(exclude?: string): (typeof FACES)[number] {
  const pool = exclude ? FACES.filter((f) => f.id !== exclude) : FACES;
  const total = pool.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of pool) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return pool[0]!;
}

function boop() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(640, t0);
    o.frequency.exponentialRampToValueAtTime(880, t0 + 0.06);
    o.frequency.exponentialRampToValueAtTime(420, t0 + 0.14);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.18);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {
    /* audio unavailable */
  }
}

const SPRITE_W = 16;
const SPRITE_H = 20; // 6 head + 6 face + 8 body
const SCALE = 4; // ~64×80 CSS px — matches former bottom-right NULL pet
const CSS_W = SPRITE_W * SCALE;
const CSS_H = SPRITE_H * SCALE + 8;

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function PixelChase({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const mounted = useIsClient();
  const faceRef = useRef(FACES[0]!);
  const raf = useRef(0);
  const start = useRef(0);

  useEffect(() => {
    try {
      assertFaces();
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [mounted]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      faceRef.current = pickWeighted(faceRef.current.id);
    }, 2400);
    return () => clearInterval(id);
  }, [reduced]);

  const paint = useCallback((t: number, staticFrame = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.floor(CSS_W * dpr);
    const bh = Math.floor(CSS_H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CSS_W, CSS_H);

    const bob = staticFrame ? 0 : Math.sin(t / 380) * 3.2;
    const spr = assembleSprite(faceRef.current.face);
    drawSprite(ctx, spr, 0, Math.round(5 + bob), SCALE);
  }, []);

  useEffect(() => {
    if (!mounted) return;
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
  }, [reduced, paint, mounted]);

  const onClick = () => {
    boop();
    faceRef.current = FACES.find((f) => f.id === 'tongue') ?? pickWeighted();
    setQuip(QUIPS[Math.floor(Math.random() * QUIPS.length)]!);
    window.setTimeout(() => setQuip(null), 2400);
  };

  if (!mounted) return null;

  const node = (
    <button
      type="button"
      className={`pixel-pet ${className}`.trim()}
      onClick={onClick}
      aria-label="像素兔机器人彩蛋：点击听声，看冷笑话"
    >
      <canvas ref={canvasRef} className="pixel-pet-canvas" width={CSS_W} height={CSS_H} />
      {quip && (
        <span className="pixel-pet-quip" role="status">
          {quip}
        </span>
      )}
    </button>
  );

  return createPortal(node, document.body);
}

/** Alias for the floating rabbit pet. */
export const PixelPet = PixelChase;
