'use client';
/*
 * Liquid glass refraction layer for the SALES workspace.
 *
 * Technique ported (not bundled) from liquid-glass-react by Max Rovensky
 * https://github.com/rdev/liquid-glass-react — MIT License, Copyright 2025 Max Rovensky.
 * Ported ideas: an SVG filter that displaces the backdrop with a displacement map
 * (feImage + feDisplacementMap), per-channel displacement scales blended with `screen`
 * for chromatic aberration, a light-catching rim whose angle follows the pointer, and
 * a press "squish". The npm package wraps children in absolutely positioned, centred
 * layers (translate(-50%,-50%)) and reads `navigator` during render, so instead of
 * re-parenting our grid cards/inputs we generate an edge-only displacement map sized to
 * each existing element and apply it through `backdrop-filter: url(#…)`.
 *
 * SVG references inside backdrop-filter only work in Chromium. Safari/Firefox (and
 * reduced-transparency users) keep the CSS frosted fallback from globals.css.
 */
import { useEffect, useState } from 'react';

/** Elements that get real refraction. Table rows are intentionally excluded. */
const TARGETS = [
  ['.topbar .global-search', 'search'],
  ['.sales-stats .stat-card', 'card'],
  ['.nexus-sidebar .nav-button[data-active=true]', 'nav'],
  ['.filter-toolbar .search-box', 'field'],
  ['.filter-toolbar .choice', 'field'],
  ['.primary', 'button'],
] as const;

type Kind = (typeof TARGETS)[number][1];
type Lens = { id: string; w: number; h: number; r: number; kind: Kind };

/** Displacement strength per element type (px). Negative = edges pull the backdrop inward like a lens. */
const STRENGTH: Record<Kind, { scale: number; aberration: number; frost: number }> = {
  card: { scale: -46, aberration: 0.12, frost: 0.6 },
  search: { scale: -30, aberration: 0.12, frost: 0.4 },
  nav: { scale: -26, aberration: 0.1, frost: 0.4 },
  field: { scale: -22, aberration: 0.08, frost: 0.3 },
  button: { scale: -24, aberration: 0.1, frost: 0.3 },
};

/**
 * Edge-only displacement map: red encodes x, blue encodes y, neutral grey (50%) in the
 * centre means "no displacement", so only the rim bends what is behind the glass.
 */
function displacementMap(w: number, h: number, r: number) {
  const edge = Math.max(5, Math.min(18, Math.min(w, h) * 0.24));
  const inner = Math.max(0, r - edge * 0.6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + '<defs><linearGradient id="x" x1="100%" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>'
    + '<linearGradient id="y" x1="0" y1="0" x2="0" y2="100%"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>'
    + `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(edge / 2.4).toFixed(2)}"/></filter></defs>`
    + `<rect width="${w}" height="${h}" fill="#808080"/>`
    + `<rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/>`
    + `<rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:difference"/>`
    + `<rect x="${edge}" y="${edge}" width="${Math.max(1, w - edge * 2)}" height="${Math.max(1, h - edge * 2)}" rx="${inner}" fill="#808080" filter="url(#b)"/>`
    + '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const channel = (row: number) => {
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
  m[row * 6] = 1;
  return m.join(' ');
};

function LensFilter({ lens }: { lens: Lens }) {
  const { id, w, h, r, kind } = lens;
  const s = STRENGTH[kind];
  return (
    <filter id={id} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feImage href={displacementMap(w, h, r)} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
      <feGaussianBlur in="SourceGraphic" stdDeviation={s.frost} result="frost" />
      {[0, 1, 2].map(c => (
        <g key={c}>
          <feDisplacementMap in="frost" in2="map" scale={s.scale * (1 + s.aberration * c)} xChannelSelector="R" yChannelSelector="B" result={`d${c}`} />
          <feColorMatrix in={`d${c}`} type="matrix" values={channel(c)} result={`c${c}`} />
        </g>
      ))}
      <feBlend in="c0" in2="c1" mode="screen" result="c01" />
      <feBlend in="c01" in2="c2" mode="screen" />
    </filter>
  );
}

function supportsSvgBackdrop() {
  const ua = navigator.userAgent;
  const webkitOnly = /iP(hone|ad|od)/.test(ua) || (/Safari\//.test(ua) && !/Chrom(e|ium)\//.test(ua));
  if (webkitOnly || /Firefox\//.test(ua)) return false;
  return /Chrom(e|ium)\//.test(ua) && CSS.supports('backdrop-filter', 'blur(1px)');
}

export default function LiquidGlassLayer({ enabled }: { enabled: boolean }) {
  const [lenses, setLenses] = useState<Lens[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    if (!enabled) { delete root.dataset.liquidGlass; return; }

    const marked = new Map<HTMLElement, string>();
    const sizes = new Map<string, Lens>();
    let raf = 0;
    let counter = 0;
    const refract = () => supportsSvgBackdrop() && !reducedTransparency.matches;

    const unmark = (el: HTMLElement) => {
      el.removeAttribute('data-lg');
      el.style.removeProperty('--lg-refract');
      ['--lg-mx', '--lg-my', '--lg-angle'].forEach(p => el.style.removeProperty(p));
      marked.delete(el);
      resize.unobserve(el);
    };

    const scan = () => {
      raf = 0;
      root.dataset.liquidGlass = refract() ? 'refract' : 'fallback';
      const found = new Map<HTMLElement, Kind>();
      for (const [selector, kind] of TARGETS) {
        document.querySelectorAll<HTMLElement>(selector).forEach(el => { if (!found.has(el)) found.set(el, kind); });
      }
      marked.forEach((_, el) => { if (!found.has(el) || !el.isConnected) unmark(el); });
      const used = new Set<string>();
      found.forEach((kind, el) => {
        const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
        if (!w || !h) return;
        const r = Math.min(h / 2, Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0));
        const key = `${kind}-${w}x${h}-${r}`;
        let lens = sizes.get(key);
        if (!lens) { lens = { id: `nx-lg-${counter++}`, w, h, r, kind }; sizes.set(key, lens); }
        used.add(key);
        if (marked.get(el) !== lens.id) {
          el.dataset.lg = kind;
          el.style.setProperty('--lg-refract', `url(#${lens.id})`);
          if (!marked.has(el)) resize.observe(el);
          marked.set(el, lens.id);
        }
      });
      sizes.forEach((_, key) => { if (!used.has(key)) sizes.delete(key); });
      const next = [...sizes.values()];
      setLenses(prev => (prev.length === next.length && prev.every((l, i) => l === next[i]) ? prev : next));
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(scan); };
    const resize = new ResizeObserver(queue);
    const mutations = new MutationObserver(queue);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-active', 'class'] });

    // Pointer-following specular rim (liquid-glass-react's mouseOffset → gradient angle).
    let pointerRaf = 0, last: HTMLElement | null = null, px = 0, py = 0, hit: HTMLElement | null = null;
    const paint = () => {
      pointerRaf = 0;
      if (last && last !== hit) ['--lg-mx', '--lg-my', '--lg-angle'].forEach(p => last!.style.removeProperty(p));
      last = hit;
      if (!hit) return;
      const b = hit.getBoundingClientRect();
      const ox = (px - b.left) / b.width, oy = (py - b.top) / b.height;
      hit.style.setProperty('--lg-mx', `${(ox * 100).toFixed(1)}%`);
      hit.style.setProperty('--lg-my', `${(oy * 100).toFixed(1)}%`);
      hit.style.setProperty('--lg-angle', `${(135 + (ox - 0.5) * 120).toFixed(1)}deg`);
    };
    const move = (e: PointerEvent) => {
      if (reducedMotion.matches || e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY;
      hit = (e.target as Element | null)?.closest?.<HTMLElement>('[data-lg]') ?? null;
      if (!pointerRaf) pointerRaf = requestAnimationFrame(paint);
    };
    document.addEventListener('pointermove', move, { passive: true });
    reducedTransparency.addEventListener('change', queue);
    queue();

    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(pointerRaf);
      mutations.disconnect(); resize.disconnect();
      document.removeEventListener('pointermove', move);
      reducedTransparency.removeEventListener('change', queue);
      marked.forEach((_, el) => unmark(el));
      delete root.dataset.liquidGlass;
      setLenses([]);
    };
  }, [enabled]);

  if (!enabled || !lenses.length) return null;
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'fixed', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <defs>{lenses.map(l => <LensFilter key={l.id} lens={l} />)}</defs>
    </svg>
  );
}
