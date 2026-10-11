import {readFileSync,existsSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const prefix='/BEST_SUPER_CRM';
const html=readFileSync('out/index.html','utf8');
assert(html.includes('欢迎回来'));
assert(!html.includes('已报名 4')); // No workspace content rendered before demo sign-in.
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const u=m[1];if(!u.startsWith('/'))continue;
  assert(u.startsWith(prefix+'/'),`Root-relative asset outside Pages base: ${u}`);
  const file='out'+u.slice(prefix.length).split('?')[0];
  if(!u.endsWith('/'))assert(existsSync(file),`Missing asset: ${file}`);
}
assert(existsSync('out/.nojekyll'));
const manifest=JSON.parse(readFileSync('out/manifest.webmanifest','utf8'));
assert.equal(manifest.start_url,prefix+'/');assert.equal(manifest.icons[0].src,prefix+'/favicon.svg');
for(const p of ['bpa','ctb','conrad','prime','ihosa','mvp','winter','summer']){assert(existsSync(`out/materials/poster-${p}.svg`));assert(existsSync(`out/materials/cover-${p}.svg`),`Missing article cover for ${p}`)}
for(const s of ['workshop','research','showcase'])assert(existsSync(`out/materials/scene-${s}.svg`),`Missing article illustration ${s}`);
assert(existsSync('out/materials/R1.pdf'));
for(const f of ['bunny.webp','bunny.png'])assert(existsSync(`out/brand/${f}`),`Missing brand asset ${f}`);
assert(html.includes(prefix+'/brand/bunny.webp'),'Bunny easter-egg image is preloaded under the Pages base');
assert(html.includes('B.E.S.T · 内部超级管理系统'));
assert.equal(manifest.short_name,'B.E.S.T');

console.log('Static HTML, repository asset base, manifest, eight posters, article covers/illustrations and PDF references passed.');
