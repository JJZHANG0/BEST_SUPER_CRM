import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const load = async file => import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64'));
const T = await load('lib/nexus/themes.ts');

assert.equal(T.DEFAULT_THEME, 'amethyst');
assert.ok(T.THEMES.length >= 7);
const labels = T.THEMES.map(t => t.label);
for (const need of ['紫晶', '冰蓝', '墨青', '暖沙', '玫瑰', '墨绿', '炭黑']) {
  assert.ok(labels.includes(need), 'missing ' + need);
}
assert.ok(T.isThemeId('ice'));
assert.ok(!T.isThemeId('neon'));
assert.equal(T.getTheme('nope').id, 'amethyst');
assert.ok(T.getTheme('pine').vars['--nx-accent']);
assert.equal(T.applyTheme('rose'), 'rose');
console.log('themes.mjs: ok', T.THEMES.map(t => t.id).join(','));
