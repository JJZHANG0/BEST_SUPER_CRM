'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal, preload } from 'react-dom';
import { assetUrl } from '@/lib/nexus/assets';

export const BRAND_NAME = 'B.E.S.T';
export const BRAND_SUBTITLE = '内部超级管理系统';
export const BUNNY_WEBP = assetUrl('brand/bunny.webp');
export const BUNNY_PNG = assetUrl('brand/bunny.png');

/* Deterministic per-letter scatter vectors for the dissolve (px, px, deg). */
const SCATTER: [number, number, number][] = [[-14, -10, -18], [-4, -16, 30], [6, 12, -26], [-8, 14, 22], [10, -14, 14], [4, 16, -30], [16, -6, 20]];

const noopSubscribe = () => () => {};

type Props = { href?: string; label?: string; subtitle?: boolean; className?: string };

/**
 * B.E.S.T wordmark. Hover or keyboard focus dissolves the letters and a bunny
 * pops out. The bunny is portalled to <body> with fixed positioning so the
 * sidebar's overflow/backdrop-filter never clips it, and it is absolutely
 * positioned so the layout never shifts.
 */
export function BrandMark({ href, label, subtitle = true, className = '' }: Props) {
  preload(BUNNY_WEBP, { as: 'image', type: 'image/webp', fetchPriority: 'low' });
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; h: number } | null>(null);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const place = useCallback(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const h = Math.round(Math.min(230, Math.max(150, window.innerHeight * 0.26)));
    // Feet sit just below the wordmark, nudged right so the bunny leans out past the sidebar edge;
    // never let the ears leave the top of the viewport.
    setPos({ x: r.left + r.width * 0.5 + 28, y: Math.max(r.bottom + h * 0.45, h + 10), h });
  }, []);
  const show = useCallback(() => { place(); setActive(true); }, [place]);
  const hide = useCallback(() => setActive(false), []);

  useEffect(() => {
    if (!active) return;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true); window.addEventListener('resize', onMove);
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
  }, [active, place]);

  const letters = BRAND_NAME.split('');
  const body = <>
    <span className="best-mono" aria-hidden="true">B</span>
    <div className="best-word">
      <b className="best-wordmark" aria-hidden="true">{letters.map((ch, i) => {
        const [dx, dy, rot] = SCATTER[i % SCATTER.length];
        return <span key={i} className={ch === '.' ? 'dot' : undefined} style={{ '--i': i, '--dx': `${dx}px`, '--dy': `${dy}px`, '--rot': `${rot}deg` } as CSSProperties}>{ch}</span>;
      })}</b>
      {subtitle && <small>{BRAND_SUBTITLE}</small>}
    </div>
  </>;
  const common = {
    className: `brand best-brand ${className}`.trim(),
    'data-active': active || undefined,
    onPointerEnter: show, onPointerLeave: hide, onFocus: show, onBlur: hide,
    'aria-label': label || `${BRAND_NAME} ${BRAND_SUBTITLE}`,
  };
  const bunny = mounted && createPortal(
    <div className="best-bunny" aria-hidden="true" data-active={active || undefined}
      style={pos ? { left: pos.x, top: pos.y, '--bunny-h': `${pos.h}px` } as CSSProperties : undefined}>
      <picture><source srcSet={BUNNY_WEBP} type="image/webp" /><img src={BUNNY_PNG} alt="" draggable={false} decoding="async" /></picture>
    </div>, document.body);

  return href
    ? <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} {...common}>{body}{bunny}</a>
    : <div ref={ref as React.Ref<HTMLDivElement>} tabIndex={0} role="img" {...common}>{body}{bunny}</div>;
}

export const HUSKY_WEBP = assetUrl('brand/husky.webp');
export const HUSKY_PNG = assetUrl('brand/husky.png');

/**
 * 「领导万岁」 label: on hover / focus the characters dissolve (same scatter as the B.E.S.T wordmark) and a
 * husky pops up above the label, then wobbles left-right twice. Portalled + fixed so tab bars and glass
 * panels never clip it; pointer-events: none so it never steals the hover. Reduced motion: fade only.
 */
export function HuskyLabel({ text, hostRef }: { text: string; hostRef: React.RefObject<HTMLElement | null> }) {
  preload(HUSKY_WEBP, { as: 'image', type: 'image/webp', fetchPriority: 'low' });
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; h: number } | null>(null);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const place = useCallback(() => {
    const el = hostRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const h = Math.round(Math.min(170, Math.max(120, window.innerHeight * 0.2)));
    // Paws rest on the label's top edge; keep the ears inside the viewport.
    setPos({ x: r.left + r.width / 2, y: Math.max(r.top + 12, h + 8), h });
  }, [hostRef]);
  useEffect(() => {
    const el = hostRef.current; if (!el) return;
    const on = () => { place(); setActive(true); }, off = () => setActive(false);
    el.addEventListener('pointerenter', on); el.addEventListener('pointerleave', off);
    el.addEventListener('focus', on); el.addEventListener('blur', off);
    return () => { el.removeEventListener('pointerenter', on); el.removeEventListener('pointerleave', off); el.removeEventListener('focus', on); el.removeEventListener('blur', off); };
  }, [hostRef, place]);
  useEffect(() => {
    if (!active) return;
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [active, place]);
  return <span className="husky-label" data-active={active || undefined}>
    <span className="husky-text" aria-hidden="true">{text.split('').map((ch, i) => {
      const [dx, dy, rot] = SCATTER[(i + 2) % SCATTER.length];
      return <span key={i} style={{ '--i': i, '--dx': `${dx}px`, '--dy': `${dy}px`, '--rot': `${rot}deg` } as CSSProperties}>{ch}</span>;
    })}</span>
    <span className="sr-only">{text}</span>
    {mounted && createPortal(
      <div className="husky-pop" aria-hidden="true" data-active={active || undefined}
        style={pos ? { left: pos.x, top: pos.y, '--husky-h': `${pos.h}px` } as CSSProperties : undefined}>
        <div className="husky-wobble"><picture><source srcSet={HUSKY_WEBP} type="image/webp" /><img src={HUSKY_PNG} alt="" draggable={false} decoding="async" /></picture></div>
      </div>, document.body)}
  </span>;
}
