'use client';
/**
 * Shared-element zoom: a card grows into a centred modal (FLIP from the card's rect), the backdrop
 * dims + blurs, and closing shrinks it back into the card. The source card keeps its grid slot
 * (the parent hides it with visibility:hidden while the modal is open), so the rest of the grid never shifts.
 * Esc / backdrop / close button close it; focus is trapped and restored; reduced motion → plain fade.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const EASE = 'cubic-bezier(.22,.9,.24,1)';
const OPEN_MS = 440, CLOSE_MS = 340;
const prefersReduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/** Transform that maps `el` (laid out at its final rect, transform-origin 0 0) onto `origin`'s rect. */
function invert(origin: HTMLElement, el: HTMLElement) {
  const a = origin.getBoundingClientRect(), b = el.getBoundingClientRect();
  if (!a.width || !b.width) return null;
  return `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
}

export function ZoomModal({ origin, label, onClosed, children }: {
  /** The card that was clicked; its rect is the start / end of the animation. */
  origin: HTMLElement;
  label: string;
  /** Called once the close animation has finished (unmount the modal here). */
  onClosed: () => void;
  children: ReactNode;
}) {
  const shell = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  useLayoutEffect(() => {
    const el = shell.current, inner = body.current, bd = backdrop.current;
    if (!el || !inner || !bd) return;
    const html = document.documentElement, prevOverflow = html.style.overflow, prevPad = html.style.paddingRight;
    const gutter = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden'; if (gutter > 0) html.style.paddingRight = gutter + 'px';
    const from = !prefersReduced() && invert(origin, el);
    if (from) {
      el.animate([{ transform: from, borderRadius: '14px' }, { transform: 'none', borderRadius: '22px' }], { duration: OPEN_MS, easing: EASE });
      inner.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: OPEN_MS, easing: 'ease-out' });
      bd.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS * 0.8, easing: 'ease-out' });
    } else {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      bd.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    }
    (el.querySelector<HTMLElement>('[data-autofocus]') || el).focus({ preventScroll: true });
    return () => { html.style.overflow = prevOverflow; html.style.paddingRight = prevPad; };
  }, [origin]);

  const close = useCallback(() => {
    const el = shell.current, inner = body.current, bd = backdrop.current;
    if (closing.current || !el || !inner || !bd) return;
    closing.current = true;
    const to = !prefersReduced() && origin.isConnected && invert(origin, el);
    const opts = { fill: 'forwards' as const };
    const anims = to
      ? [inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS * 0.4, easing: 'ease-in', ...opts }),
         el.animate([{ transform: 'none', borderRadius: '22px' }, { transform: to, borderRadius: '14px' }], { duration: CLOSE_MS, easing: EASE, ...opts }),
         bd.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: 'ease-in', ...opts })]
      : [el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, ...opts }), bd.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, ...opts })];
    Promise.all(anims.map(a => a.finished.catch(() => undefined))).then(() => {
      onClosed();
      if (origin.isConnected) origin.focus({ preventScroll: true });
    });
  }, [origin, onClosed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // Keep Tab inside the dialog.
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !shell.current) return;
    const items = [...shell.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return createPortal(<div className="zoom-layer">
    <div ref={backdrop} className="zoom-backdrop" onClick={close} aria-hidden="true" />
    <div ref={shell} className="zoom-shell" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={trap}>
      <div ref={body} className="zoom-body">
        <button type="button" className="icon-button zoom-close" aria-label="关闭" title="关闭 (Esc)" data-autofocus onClick={close}><X size={17} /></button>
        {children}
      </div>
    </div>
  </div>, document.body);
}
