import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const src = ts.transpileModule(readFileSync('lib/nexus/sales.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const S = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const core = S.normalizeTeamNameCore;
assert.equal(core('TEAM 深海'), '深海');
assert.equal(core('Team深海'), '深海');
assert.equal(core('TEAM「深海」'), '深海');
assert.equal(core('「TEAM 深海」'), '深海');
assert.equal(core('  team  「深海」  '), '深海');
assert.equal(core('深海队'), '深海队');
assert.equal(core('队深海'), '深海');

assert.equal(S.teamNamesTooSimilar('TEAM 深海', 'Team深海'), true);
assert.equal(S.teamNamesTooSimilar('TEAM「深海」', '深海'), true);
assert.equal(S.teamNamesTooSimilar('深海', '深蓝'), false); // different cores, dist 1 on len 2 — maxLen<=2 only exact
assert.equal(S.teamNamesTooSimilar('先锋号', '先锋号队'), true);
assert.equal(S.teamNamesTooSimilar('深海', '深海队'), true);
assert.equal(S.teamNamesTooSimilar('康莱德一队', '康莱德二队'), false);

const existing = [
  { id: 'T-KEEP', name: 'TEAM「深海」' },
  { id: 'T-OTHER', name: '蓝海探索' },
  { id: 'T-PSEUDO', name: '退费名单' },
];
assert.equal(S.findSimilarTeam('Team深海', existing)?.id, 'T-KEEP');
assert.equal(S.findSimilarTeam('TEAM「深海」', existing, 'T-KEEP'), null, 'exclude self on rename');
assert.equal(S.findSimilarTeam('退费', existing), null, 'pseudo teams ignored as targets');
assert.equal(S.teamNameConflictMessage('TEAM「深海」'), '已存在同名或高度相似的队伍：TEAM「深海」');

// Create-team must not race a client teamLogs PUT (server writes the log; client create skips setTeamLogs).
const modules = readFileSync('components/nexus/modules.tsx', 'utf8');
assert(!/isTeam\)\{[^}]*setTeamLogs/.test(modules.replace(/\n/g, ' ')), 'create team must not setTeamLogs (FK race)');
assert(modules.includes('findSimilarTeam'), 'create form checks near-duplicates');
const app = readFileSync('server/app.ts', 'utf8');
assert(app.includes("action: '创建队伍'"), 'server auto-logs team create');
assert(app.includes('findSimilarTeam'), 'server enforces name uniqueness');
const store = readFileSync('lib/nexus/store.tsx', 'utf8');
assert(store.includes("name==='teamLogs'"), 'store defers teamLogs until team synced');

console.log('team-names: normalization, similarity, create-race guards passed.');
