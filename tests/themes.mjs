import assert from 'node:assert/strict';
import { THEMES, getTheme, isThemeId, DEFAULT_THEME, applyTheme } from '../lib/nexus/themes.ts';

assert.equal(DEFAULT_THEME, 'amethyst');
assert.ok(THEMES.length >= 7);
const labels = THEMES.map(t => t.label);
for (const need of ['紫晶', '冰蓝', '墨青', '暖沙', '玫瑰', '墨绿', '炭黑']) {
  assert.ok(labels.includes(need), 'missing ' + need);
}
assert.ok(isThemeId('ice'));
assert.ok(!isThemeId('neon'));
assert.equal(getTheme('nope').id, 'amethyst');
assert.ok(getTheme('pine').vars['--nx-accent']);
console.log('themes.mjs: ok', THEMES.map(t => t.id).join(','));
