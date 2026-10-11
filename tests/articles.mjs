import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/nexus/articles.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const A=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const content={title:'标题',summary:'摘要',cover:'materials/cover-bpa.svg',blocks:[{id:'1',type:'heading',text:'小标题'},{id:'2',type:'paragraph',text:'正文'},{id:'3',type:'highlight',kind:'price',title:'费用说明',items:[{label:'参考价',value:'¥1'},{label:'',value:''}]}]};
const base={program:'bpa',author:'示例·陈运营',draft:content,published:null,updated:'t0',publishedAt:null};
assert.deepEqual(A.articleIssues(content),[]);
assert.equal(A.articleState(base),'未发布');

// Saving a draft never changes what sales see.
const saved=A.saveDraft({...base,published:content,publishedAt:'t0'},{...content,title:'新标题'},'t1');
assert.equal(saved.published.title,'标题');assert.equal(A.articleState(saved),'有未发布修改');

// Publishing snapshots the draft, drops empty highlight rows and is detached from later edits.
const live=A.publishArticle(base,content,'t2');
assert.equal(live.publishedAt,'t2');assert.equal(live.published.blocks[2].items.length,1);assert.equal(A.articleState(live),'已发布');
live.draft.blocks[0].text='改动';assert.equal(live.published.blocks[0].text,'小标题');
assert.equal(A.unpublishArticle(live,'t3').published,null);

// Invalid drafts cannot be published.
const bad={...content,title:' ',cover:'',blocks:[{id:'x',type:'image',src:'',caption:''},{id:'y',type:'highlight',kind:'tip',title:'',items:[{label:'a',value:''}]}]};
const issues=A.articleIssues(bad);
assert(issues.some(i=>i.includes('标题'))&&issues.some(i=>i.includes('封面'))&&issues.some(i=>i.includes('图片'))&&issues.some(i=>i.includes('名称')));
assert.throws(()=>A.publishArticle(base,bad,'t'));
assert(A.articleIssues({...content,summary:'字'.repeat(A.LIMITS.summary+1)}).some(i=>i.includes('摘要')));

assert.deepEqual(A.moveBlock(['a','b','c'],0,1),['b','a','c']);assert.deepEqual(A.moveBlock(['a','b'],0,-1),['a','b']);
assert.equal(A.newBlock('highlight','n').items.length,1);
assert(A.shareText(content,'BPA').includes('参考价：¥1'));

// Stored data from localStorage is validated; corrupt entries fall back to the seed.
const seed=[base,{...base,program:'ctb'}];
assert.equal(A.mergeStoredArticles(seed,'nope').length,2);
const merged=A.mergeStoredArticles(seed,[{...live},{program:'ctb',draft:{title:1}},{program:'zzz'}]);
assert.equal(merged[0].publishedAt,'t2');assert.equal(merged[1],seed[1]);assert.equal(merged.length,2);
console.log('Articles: validation, draft vs published isolation, publish snapshot, ordering, share text and storage merge passed.');
