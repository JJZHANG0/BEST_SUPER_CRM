/**
 * Copy text to the clipboard. Uses the async Clipboard API in secure contexts (HTTPS / localhost)
 * and falls back to a hidden textarea + execCommand('copy') elsewhere (plain-HTTP intranet, old WebViews).
 * `container` should be inside any open modal so its focus trap does not steal the selection.
 */
export async function copyText(text: string, container?: HTMLElement | null): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  if (typeof document === 'undefined') return false;
  const host = container || document.body;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
  host.appendChild(ta);
  const active = document.activeElement as HTMLElement | null;
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  host.removeChild(ta);
  active?.focus?.();
  return ok;
}
