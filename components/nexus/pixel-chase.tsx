'use client';
/**
 * Floating desktop pet — fine 32×40 pixel sprites (rabbit / cat / carrot / pig).
 * Portalled to <body>, fixed bottom-right, transparent — no card/frame.
 * Click: soft boop + quip. prefers-reduced-motion → static idle.
 * Active pet from user.pixelPet (localStorage + API), default rabbit.
 */
import { useEffect, useRef, useState, useCallback, useSyncExternalStore, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNexus } from '@/lib/nexus/store';
import {
  SPRITE_W,
  SPRITE_H,
  SCALE,
  DEFAULT_PET,
  getPet,
  isPetId,
  assembleSprite,
  drawSprite,
  pickWeightedFace,
  assertPet,
  type PetFace,
  type PetId,
} from '@/lib/nexus/pets';

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
  const s = useNexus();
  const petId: PetId = isPetId(s.user?.pixelPet) ? s.user!.pixelPet! : DEFAULT_PET;
  const pet = useMemo(() => getPet(petId), [petId]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const mounted = useIsClient();
  const faceRef = useRef<PetFace>(pet.faces[0]!);
  const raf = useRef(0);
  const start = useRef(0);

  useEffect(() => {
    faceRef.current = pet.faces[0]!;
    try {
      assertPet(pet);
    } catch (e) {
      console.error(e);
    }
  }, [pet]);

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
      faceRef.current = pickWeightedFace(pet.faces, faceRef.current.id);
    }, 2400);
    return () => clearInterval(id);
  }, [reduced, pet]);

  const paint = useCallback(
    (t: number, staticFrame = false) => {
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
      const spr = assembleSprite(pet, faceRef.current.face);
      drawSprite(ctx, spr, 0, Math.round(5 + bob), SCALE);
    },
    [pet],
  );

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
  }, [reduced, paint, mounted, petId]);

  const onClick = () => {
    boop();
    faceRef.current = pet.faces.find((f) => f.id === 'tongue') ?? pickWeightedFace(pet.faces);
    setQuip(pet.quips[Math.floor(Math.random() * pet.quips.length)]!);
    window.setTimeout(() => setQuip(null), 2400);
  };

  if (!mounted) return null;

  const label = pet.id === 'rabbit' ? '像素兔' : pet.id === 'cat' ? '像素猫' : pet.id === 'carrot' ? '小胡萝卜' : '粉猪猪';

  const node = (
    <button
      type="button"
      className={`pixel-pet ${className}`.trim()}
      onClick={onClick}
      aria-label={`${label}彩蛋：点击听声，看冷笑话`}
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

/** Alias for the floating pet. */
export const PixelPet = PixelChase;
