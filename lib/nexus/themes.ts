/**
 * Curated accent themes for B.E.S.T. Applied via CSS variables on <html>
 * (`data-nx-theme` + --nx-* / --primary). Persisted per-user (localStorage + API).
 */
export type ThemeId =
  | 'amethyst' // 紫晶 / 默认
  | 'ice'      // 冰蓝
  | 'ink'      // 墨青
  | 'sand'     // 暖沙
  | 'rose'     // 玫瑰
  | 'pine'     // 墨绿
  | 'charcoal'; // 炭黑浅色

export type ThemeVars = {
  id: ThemeId;
  label: string;
  /** Swatch shown in the picker (solid accent). */
  swatch: string;
  /** CSS custom properties applied to :root / html. */
  vars: Record<string, string>;
};

export const THEME_STORAGE_KEY = 'nexus.theme.v1';
export const DEFAULT_THEME: ThemeId = 'amethyst';

export const THEMES: readonly ThemeVars[] = [
  {
    id: 'amethyst',
    label: '紫晶',
    swatch: '#8050db',
    vars: {
      '--nx-accent': '#8050db',
      '--nx-accent-2': '#8150ce',
      '--nx-accent-hi': '#9b71e5',
      '--nx-accent-soft': '#ede6fc',
      '--nx-accent-softer': '#f5f0fc',
      '--nx-accent-ink': '#7540c8',
      '--nx-accent-muted': '#a78bfa',
      '--nx-accent-border': '#e6dfef',
      '--nx-page': '#f8f7fc',
      '--nx-glow': '#8b5cc923',
      '--nx-grad-a': '#ede5fb',
      '--nx-grad-b': '#f8f7fc',
      '--primary': '#8050db',
      '--ring': '#a78bfa',
      '--sidebar-accent': '#ede6fc',
      '--sidebar-accent-foreground': '#7540c8',
    },
  },
  {
    id: 'ice',
    label: '冰蓝',
    swatch: '#3d8fd9',
    vars: {
      '--nx-accent': '#3d8fd9',
      '--nx-accent-2': '#2f7ec4',
      '--nx-accent-hi': '#6bb0ef',
      '--nx-accent-soft': '#e6f1fb',
      '--nx-accent-softer': '#f2f8fd',
      '--nx-accent-ink': '#1f6fb0',
      '--nx-accent-muted': '#7eb6e8',
      '--nx-accent-border': '#d5e6f5',
      '--nx-page': '#f5f9fc',
      '--nx-glow': '#3d8fd926',
      '--nx-grad-a': '#dff0fb',
      '--nx-grad-b': '#f5f9fc',
      '--primary': '#3d8fd9',
      '--ring': '#7eb6e8',
      '--sidebar-accent': '#e6f1fb',
      '--sidebar-accent-foreground': '#1f6fb0',
    },
  },
  {
    id: 'ink',
    label: '墨青',
    swatch: '#3a7a8c',
    vars: {
      '--nx-accent': '#3a7a8c',
      '--nx-accent-2': '#2f6878',
      '--nx-accent-hi': '#5a9aab',
      '--nx-accent-soft': '#e4eef1',
      '--nx-accent-softer': '#f1f6f8',
      '--nx-accent-ink': '#2a5f6e',
      '--nx-accent-muted': '#7aadb8',
      '--nx-accent-border': '#d2e2e7',
      '--nx-page': '#f4f7f8',
      '--nx-glow': '#3a7a8c26',
      '--nx-grad-a': '#dce9ed',
      '--nx-grad-b': '#f4f7f8',
      '--primary': '#3a7a8c',
      '--ring': '#7aadb8',
      '--sidebar-accent': '#e4eef1',
      '--sidebar-accent-foreground': '#2a5f6e',
    },
  },
  {
    id: 'sand',
    label: '暖沙',
    swatch: '#c4894a',
    vars: {
      '--nx-accent': '#c4894a',
      '--nx-accent-2': '#b0783c',
      '--nx-accent-hi': '#d9a66e',
      '--nx-accent-soft': '#f7efe4',
      '--nx-accent-softer': '#fbf6ef',
      '--nx-accent-ink': '#8f6230',
      '--nx-accent-muted': '#d4a878',
      '--nx-accent-border': '#eadcc8',
      '--nx-page': '#faf7f2',
      '--nx-glow': '#c4894a26',
      '--nx-grad-a': '#f3e6d4',
      '--nx-grad-b': '#faf7f2',
      '--primary': '#c4894a',
      '--ring': '#d4a878',
      '--sidebar-accent': '#f7efe4',
      '--sidebar-accent-foreground': '#8f6230',
    },
  },
  {
    id: 'rose',
    label: '玫瑰',
    swatch: '#c45a7a',
    vars: {
      '--nx-accent': '#c45a7a',
      '--nx-accent-2': '#b04868',
      '--nx-accent-hi': '#d87a96',
      '--nx-accent-soft': '#f8e8ee',
      '--nx-accent-softer': '#fcf3f6',
      '--nx-accent-ink': '#9a3d5c',
      '--nx-accent-muted': '#d989a4',
      '--nx-accent-border': '#ecd5de',
      '--nx-page': '#fbf5f7',
      '--nx-glow': '#c45a7a26',
      '--nx-grad-a': '#f3dce5',
      '--nx-grad-b': '#fbf5f7',
      '--primary': '#c45a7a',
      '--ring': '#d989a4',
      '--sidebar-accent': '#f8e8ee',
      '--sidebar-accent-foreground': '#9a3d5c',
    },
  },
  {
    id: 'pine',
    label: '墨绿',
    swatch: '#3d8a62',
    vars: {
      '--nx-accent': '#3d8a62',
      '--nx-accent-2': '#327853',
      '--nx-accent-hi': '#5aaa7e',
      '--nx-accent-soft': '#e5f2eb',
      '--nx-accent-softer': '#f1f8f4',
      '--nx-accent-ink': '#2b6b4a',
      '--nx-accent-muted': '#7ab896',
      '--nx-accent-border': '#d2e6db',
      '--nx-page': '#f4f8f6',
      '--nx-glow': '#3d8a6226',
      '--nx-grad-a': '#dcefe5',
      '--nx-grad-b': '#f4f8f6',
      '--primary': '#3d8a62',
      '--ring': '#7ab896',
      '--sidebar-accent': '#e5f2eb',
      '--sidebar-accent-foreground': '#2b6b4a',
    },
  },
  {
    id: 'charcoal',
    label: '炭黑',
    swatch: '#4a5568',
    vars: {
      '--nx-accent': '#4a5568',
      '--nx-accent-2': '#3d4656',
      '--nx-accent-hi': '#6b778c',
      '--nx-accent-soft': '#e8eaee',
      '--nx-accent-softer': '#f3f4f6',
      '--nx-accent-ink': '#2d3748',
      '--nx-accent-muted': '#8a93a3',
      '--nx-accent-border': '#d5d8de',
      '--nx-page': '#f6f7f9',
      '--nx-glow': '#4a556826',
      '--nx-grad-a': '#e2e5ea',
      '--nx-grad-b': '#f6f7f9',
      '--primary': '#4a5568',
      '--ring': '#8a93a3',
      '--sidebar-accent': '#e8eaee',
      '--sidebar-accent-foreground': '#2d3748',
    },
  },
] as const;

const byId = Object.fromEntries(THEMES.map(t => [t.id, t])) as Record<ThemeId, ThemeVars>;

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && v in byId;
}

export function getTheme(id: ThemeId | string | null | undefined): ThemeVars {
  return (id && isThemeId(id) ? byId[id] : byId[DEFAULT_THEME])!;
}

/** Apply theme CSS vars + data-nx-theme on <html>. Safe on SSR (no-ops without document). */
export function applyTheme(id: ThemeId | string | null | undefined): ThemeId {
  const theme = getTheme(id);
  if (typeof document === 'undefined') return theme.id;
  const root = document.documentElement;
  root.setAttribute('data-nx-theme', theme.id);
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  return theme.id;
}

export function readStoredTheme(): ThemeId | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch { /* session-only */ }
}
