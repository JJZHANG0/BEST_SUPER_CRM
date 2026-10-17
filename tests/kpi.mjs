import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const K=await load('lib/nexus/kpi.ts');
const R=await load('lib/nexus/roles.ts');

// Sheet structure mirrors the 绩效评分 table: A30/B30/C20/D20, 5 points per KR.
assert.deepEqual(K.KPI_CATEGORIES.map(c=>[c.key,c.name,c.points,c.weight,c.slots]),[['A','教务管理',30,30,6],['B','项目运营',30,30,6],['C','团队支持',20,20,4],['D','客诉反馈',20,20,4]]);
for(const c of K.KPI_CATEGORIES)assert.equal(c.slots*K.KR_POINTS,c.points,'O分值 = KR 数 × 5');
assert.equal(K.KPI_CATEGORIES.reduce((n,c)=>n+c.weight,0),100);
const blank=K.blankItems();
assert.equal(blank.length,20);
const D=blank.filter(x=>x.category==='D');
assert(D.every(x=>x.title==='默认满分'&&x.description==='有客诉或者失误 由项目经理填写事项 对应扣分'&&x.score===5&&x.progress===100),'客诉反馈 pre-filled 默认满分 5 分');
assert(blank.filter(x=>x.category!=='D').every(x=>x.title===''&&x.score===null));

// Scoring: subtotal = Σ scores (capped), weighted = subtotal / O分值 × 权重, total out of 100.
const s0=K.scoreSheet(blank);
assert.equal(s0.total,20,'unscored A–C count 0; D defaults to 20');assert.equal(s0.complete,false);
const full=blank.map(x=>({...x,score:5}));
assert.equal(K.scoreSheet(full).total,100);assert.equal(K.scoreSheet(full).complete,true);
const mixed=full.map(x=>x.id==='A1'?{...x,score:3}:x.id==='B2'?{...x,score:4.5}:x.id==='C4'?{...x,score:0}:x.id==='D3'?{...x,score:2}:x);
const sm=K.scoreSheet(mixed);
assert.deepEqual(sm.categories.map(c=>c.subtotal),[28,29.5,15,17]);
assert.deepEqual(sm.categories.map(c=>c.weighted),[28,29.5,15,17]);
assert.equal(sm.total,89.5);
assert.equal(K.clampScore(7),5);assert.equal(K.clampScore(-1),0);assert.equal(K.clampScore(3.3),3.5);assert.equal(K.clampScore(''),null);
assert.equal(K.clampProgress(120),100);assert.equal(K.clampProgress('85'),85);assert.equal(K.clampProgress(null),null);
assert.equal(K.normalizeItems([{id:'A1',title:'x'.repeat(300),score:9},{id:'Z9',title:'bogus'}]).length,20);
assert.equal(K.normalizeItems([{id:'A1',title:'x'.repeat(300),score:9}])[0].title.length,120);

// Teacher may not touch scores or 客诉反馈; reviewer may not rewrite the teacher's KRs.
const t1=K.applyTeacherEdit(blank,blank.map(x=>x.category==='D'?{...x,score:0,description:'改了'}:{...x,title:'KR '+x.id,score:5,progress:80}));
assert(t1.filter(x=>x.category!=='D').every(x=>x.title==='KR '+x.id&&x.score===null&&x.progress===80));
assert(t1.filter(x=>x.category==='D').every(x=>x.score===5&&x.description.startsWith('有客诉')));
const r1=K.applyReviewerEdit(t1,t1.map(x=>({...x,title:'reviewer',score:4,description:x.category==='D'?'迟到一次':x.description})));
assert(r1.filter(x=>x.category!=='D').every(x=>x.title.startsWith('KR ')&&x.score===4));
assert(r1.filter(x=>x.category==='D').every(x=>x.description==='迟到一次'&&x.score===4));
assert.deepEqual(K.submitIssues(blank).length,3);assert.deepEqual(K.submitIssues(t1),[]);
assert.equal(K.finalizeIssues(t1).length,1);

// Workflow: draft → submitted → finalized; return / reopen; own sheet hidden scores until 定稿.
const owner={id:'k1',userKey:'xujin@nexus.local',userName:'许瑾',month:'2026-10'};
assert.equal(K.teacherSave(null,owner,blank,true).ok,false,'cannot submit empty KRs');
const draft=K.teacherSave(null,owner,t1.map(x=>({...x})),false);assert(draft.ok&&draft.sheet.status==='draft');
const sub=K.teacherSave(draft.sheet,owner,t1,true);assert(sub.ok&&sub.sheet.status==='submitted'&&sub.sheet.submittedAt);
assert.equal(K.teacherSave(sub.sheet,owner,t1,false).ok,false,'submitted sheets are locked for the teacher');
const rv={reviewerKey:'zhangjiejia@nexus.local',reviewerName:'张捷嘉'};
assert.equal(K.reviewSheet(sub.sheet,{...rv,reviewerKey:'xujin@nexus.local',action:'save'}).status,403,'no self review');
assert.equal(K.reviewSheet(null,{...rv,action:'save'}).status,404);
assert.equal(K.reviewSheet(draft.sheet,{...rv,action:'finalize'}).status,409,'drafts cannot be finalized');
assert.equal(K.reviewSheet(sub.sheet,{...rv,action:'finalize'}).ok,false,'unscored KRs block 定稿');
const scored=K.reviewSheet(sub.sheet,{...rv,action:'save',items:mixed});assert(scored.ok&&scored.sheet.status==='submitted'&&scored.sheet.reviewedByName==='张捷嘉');
assert.equal(K.ownerView(scored.sheet).items.find(x=>x.id==='A1').score,null,'teacher cannot see scores before 定稿');
assert.equal(K.ownerView(scored.sheet).total,null);
const fin=K.reviewSheet(scored.sheet,{...rv,action:'finalize',items:mixed,reviewNote:'不错'});
assert(fin.ok&&fin.sheet.status==='finalized'&&fin.sheet.total===89.5&&fin.sheet.reviewNote==='不错');
assert.equal(K.ownerView(fin.sheet).items.find(x=>x.id==='A1').score,3,'final scores visible to the teacher');
assert.equal(K.reviewSheet(fin.sheet,{...rv,action:'save',items:full}).status,409,'locked after 定稿');
const re=K.reviewSheet(fin.sheet,{...rv,action:'reopen'});assert(re.ok&&re.sheet.status==='submitted'&&re.sheet.total===null);
const back=K.reviewSheet(re.sheet,{...rv,action:'return',reviewNote:'请补充 B3'});assert(back.ok&&back.sheet.status==='draft');
assert.equal(K.reviewSheet(sub.sheet,{...rv,action:'nope'}).status,400);
assert.equal(K.isMonth('2026-10'),true);assert.equal(K.isMonth('2026-13'),false);
assert.equal(K.todoAsKr({title:'BPA 备课',note:'第二阶段 12 课时'}),'BPA 备课：第二阶段 12 课时');
assert.equal(K.appendLine('a','a'),'a');assert.equal(K.appendLine('a','b'),'a\nb');

// Permissions: assign / review belong to the 部门负责人 flag (only 张捷嘉), not to superadmin. The leader does not fill KPI.
const leader={role:'superadmin',leader:true};
assert(R.canAssignTodos(leader)&&R.canReviewKpi(leader)&&!R.canFillKpi(leader));
for(const r of ['superadmin','ops','admin','sales',undefined,{role:'superadmin'},{role:'superadmin',leader:false},{role:'sales',leader:true}])assert(!R.canAssignTodos(r)&&!R.canReviewKpi(r),JSON.stringify(r));
assert(R.canFillKpi('ops')&&R.canFillKpi('superadmin')&&R.canFillKpi({role:'superadmin',leader:false})&&!R.canFillKpi('sales'));
assert(R.canAssignToLeader('ops')&&R.canAssignToLeader({role:'superadmin',leader:false})&&!R.canAssignToLeader(leader)&&!R.canAssignToLeader('sales')&&!R.canAssignToLeader('teacher'));
const A=await load('lib/nexus/auth.ts');
assert.equal(A.staffAccounts.find(a=>a.name==='张捷嘉').role,'superadmin');
assert.equal(A.staffAccounts.find(a=>a.name==='张捷嘉').leader,true);
assert.deepEqual(A.staffAccounts.filter(a=>a.leader).map(a=>a.name),['张捷嘉']);

// API + UI gating.
const app=readFileSync('server/app.ts','utf8');
assert(/app\.put\('\/kpi-review\/:userId\/:month'[\s\S]{0,200}canReviewKpi/.test(app),'review endpoint gated');
assert(/app\.get\('\/kpi-review\/:month'[\s\S]{0,200}canReviewKpi/.test(app));
assert(/app\.post\('\/todos'[\s\S]{0,2200}canAssignTodos/.test(app),'assignment gated');
assert(app.indexOf("app.put('/kpi/:month'")<app.indexOf("app.put('/:collection/:id'"),'KPI routes registered before the generic collection route');
assert(readFileSync('app/page.tsx','utf8').includes("canReviewKpi(s.viewer)?['kpi-review']:[]"));
assert(readFileSync('components/nexus/kpi.tsx','utf8').includes('if (!canReviewKpi(s.viewer)) return'));
assert(readFileSync('drizzle/0004_kpi_assign_teachers.sql','utf8').includes('CREATE TABLE "kpi_sheets"'));
assert(readFileSync('drizzle/0004_kpi_assign_teachers.sql','utf8').includes('ADD COLUMN "assigned_by" integer'));
console.log('KPI: sheet structure, scoring math, edit rules, review workflow, permissions and gating passed.');
const kpiUi=readFileSync('components/nexus/kpi.tsx','utf8');
assert(kpiUi.includes('KpiLeaderScoreCard')&&kpiUi.includes('当月领导评分'),'leadership score card on 当月绩效');
assert(kpiUi.includes('一键导出')&&kpiUi.includes('renderKpiMonthPdf'),'leader PDF export on 绩效考核');
assert(readFileSync('lib/nexus/kpi-pdf.ts','utf8').includes('B.E.S.T')&&readFileSync('lib/nexus/kpi-pdf.ts','utf8').includes('imagesToPdf'));
assert(readFileSync('components/nexus/modules.tsx','utf8').includes('强制设定')&&readFileSync('components/nexus/modules.tsx','utf8').includes('opsTeacher'));
assert(readFileSync('lib/nexus/schedule.ts','utf8').includes("ops: '运营老师'"));
console.log('KPI UI: leadership card + PDF export + course ops conflict wiring checked.');
