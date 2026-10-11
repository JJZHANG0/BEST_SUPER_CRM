import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const A=await load('lib/nexus/auth.ts');
const R=await load('lib/nexus/roles.ts');

// Staff directory: 5 运营部 accounts with full-pinyin logins, 3 superadmins + 2 ops, plus the public sales demo.
const staff=A.staffAccounts;
assert.equal(staff.length,5);
assert.deepEqual(staff.map(a=>[a.name,a.email,a.role]),[
  ['张捷嘉','zhangjiejia@nexus.local','superadmin'],['程雪晴','chengxueqing@nexus.local','superadmin'],['张雪航','zhangxuehang@nexus.local','superadmin'],
  ['许瑾','xujin@nexus.local','ops'],['方彦淇','fangyanqi@nexus.local','ops']]);
assert.equal(new Set(staff.map(a=>a.email)).size,5,'logins are unique');
// No plaintext staff passwords in the client bundle — only salted PBKDF2 hashes.
for(const a of staff){assert(!('password' in a));assert.match(a.salt,/^[0-9a-f]{32}$/);assert.match(a.hash,/^[0-9a-f]{64}$/)}
const dir=A.directory();
assert(dir.every(u=>u.email!=='ops@nexus.demo'),'old ops demo account removed');
assert(dir.filter(u=>u.role!=='sales').every(u=>u.mustChange),'staff must change the initial password');

// Sales demo still works; normalisation; wrong passwords and unknown accounts fail.
assert.equal((await A.authenticateDemo(' SALES@nexus.demo ','NexusSales2026!'))?.role,'sales');
assert.equal(await A.authenticateDemo('sales@nexus.demo','wrong'),null);
assert.equal(await A.authenticateDemo('ops@nexus.demo','NexusOps2026!'),null);
assert.equal(await A.authenticateDemo('zhangjiejia@nexus.local','guess-1234'),null);

// Browser overrides: changed password, disabled account, admin-created user.
const h=await A.makeHash('NewPassw0rd!x');
let o={'xujin@nexus.local':{...h,mustChange:false}};
const xu=await A.authenticateDemo('xujin@nexus.local','NewPassw0rd!x',o);
assert.equal(xu?.name,'许瑾');assert.equal(xu?.mustChange,false);assert.equal(xu?.role,'ops');
o={'xujin@nexus.local':{...h,active:false}};
assert.equal(await A.authenticateDemo('xujin@nexus.local','NewPassw0rd!x',o),null,'disabled accounts cannot sign in');
o={'new@nexus.local':{created:true,name:'新老师',role:'ops',...h}};
assert.equal((await A.authenticateDemo('new@nexus.local','NewPassw0rd!x',o))?.name,'新老师');
assert.equal(A.directory({'fangyanqi@nexus.local':{role:'superadmin'}}).find(u=>u.email==='fangyanqi@nexus.local').role,'superadmin');
const pw=A.randomPassword();assert.equal(pw.length,16);assert.deepEqual(R.passwordIssues(pw),[]);

// Name-as-username login: every staff account's username is the person's name; email still works.
assert.deepEqual(staff.map(a=>a.username),['张捷嘉','程雪晴','张雪航','许瑾','方彦淇']);
assert.equal(A.findAccount('张捷嘉')?.email,'zhangjiejia@nexus.local');
assert.equal(A.findAccount('  许瑾 ')?.email,'xujin@nexus.local','username is trimmed');
assert.equal(A.findAccount('ZHANGJIEJIA@nexus.local')?.username,'张捷嘉','email login still resolves');
assert.equal(A.findAccount('张'),undefined,'no prefix matching');
assert.equal(A.findAccount('Alex'),undefined,'sales demo signs in with email only');
assert.equal(A.findAccount(''),undefined);
const ho={'xujin@nexus.local':{...h,mustChange:false}};
assert.equal((await A.authenticateDemo('许瑾','NewPassw0rd!x',ho))?.email,'xujin@nexus.local','username + password');
assert.equal(await A.authenticateDemo('许瑾','wrong-pass-1',ho),null);
assert.equal(await A.authenticateDemo('许 瑾','NewPassw0rd!x',ho),null,'inner whitespace is significant after collapsing');
// Renamed username (admin edit) replaces the old login name; uniqueness is case-insensitive.
const ren={'xujin@nexus.local':{...h,username:'Xu Jin'}};
assert.equal((await A.authenticateDemo('  xu   JIN ','NewPassw0rd!x',ren))?.email,'xujin@nexus.local');
assert.equal(A.findAccount('许瑾',ren),undefined);
assert(A.usernameTaken('方彦淇'));assert(!A.usernameTaken('方彦淇',{},'fangyanqi@nexus.local'));assert(A.usernameTaken('xu jin',ren));
assert.equal(R.normalizeUsername('  张 \t 捷嘉  '),'张 捷嘉');assert.equal(R.normalizeUsername(5),'');
assert.equal(R.usernameIssue(''),'请填写用户名');assert.equal(R.usernameIssue('a@b'),'用户名不能包含 @');assert.equal(R.usernameIssue('x'.repeat(41)),'用户名不超过 40 个字符');assert.equal(R.usernameIssue('张捷嘉'),null);

// Role model: superadmin ⊇ ops; sales read-only.
assert(R.isOpsLike('superadmin')&&R.isOpsLike('ops')&&!R.isOpsLike('sales'));
assert(R.canWrite('superadmin')&&R.canWrite('ops')&&!R.canWrite('sales'));
assert(R.canManageSystem('superadmin')&&!R.canManageSystem('ops')&&!R.canManageSystem('admin')&&!R.canManageSystem('sales'));
assert(R.canSeeAllLessons('superadmin')&&!R.canSeeAllLessons('ops'));
assert(R.canEditOwned('ops','xujin@nexus.local','XUJIN@nexus.local'));
assert(!R.canEditOwned('ops','xujin@nexus.local','fangyanqi@nexus.local'));
assert(R.canEditOwned('superadmin','zhangjiejia@nexus.local','fangyanqi@nexus.local'));
assert(!R.canEditOwned('sales','sales@nexus.demo','sales@nexus.demo'));
assert.deepEqual(R.passwordIssues('short1'),['至少 10 位']);assert.equal(R.passwordIssues('onlyletters').length,1);

// The API seed carries the same five accounts as scrypt hashes and forces a password change.
const seed=readFileSync('server/staff-seed.ts','utf8');
for(const a of staff){assert(seed.includes(a.email));assert(seed.includes(`username: '${a.username}'`));}
assert.equal((seed.match(/passwordHash: 'scrypt\$/g)||[]).length,5);
assert(readFileSync('server/seed.ts','utf8').includes('mustChangePassword: true'));
console.log('Auth: five staff accounts (hashed only), roles, sales demo, overrides, disabled users and role gating passed.');
