/** Personal workbench shortcuts. Keep ids stable: they are stored on each user account. */
export const QUICK_ACTION_IDS = ['lessons', 'feedback', 'student', 'team', 'course', 'resource', 'todos', 'programs'] as const;
export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

export const DEFAULT_QUICK_ACTIONS: readonly QuickActionId[] = ['lessons', 'feedback', 'student', 'resource'];
export const MAX_QUICK_ACTIONS = 6;

export function parseQuickActions(value: unknown): QuickActionId[] | null {
  if (!Array.isArray(value)) return null;
  const allowed = new Set<string>(QUICK_ACTION_IDS);
  const unique = [...new Set(value.filter((x): x is string => typeof x === 'string' && allowed.has(x)))];
  if (!unique.length || unique.length > MAX_QUICK_ACTIONS || unique.length !== value.length) return null;
  return unique as QuickActionId[];
}

export function quickActionsOrDefault(value: unknown): QuickActionId[] {
  return parseQuickActions(value) ?? [...DEFAULT_QUICK_ACTIONS];
}
