import {readFileSync,existsSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const prefix='/BEST_SUPER_CRM';
const html=readFileSync('out/index.html','utf8');
assert(html.includes('开班队伍与招生名额'));
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const u=m[1];if(!u.startsWith('/'))continue;
  assert(u.startsWith(prefix+'/'),`Root-relative asset outside Pages base: ${u}`);
  const file='out'+u.slice(prefix.length).split('?')[0];
  if(!u.endsWith('/'))assert(existsSync(file),`Missing asset: ${file}`);
}
assert(existsSync('out/.nojekyll'));
const manifest=JSON.parse(readFileSync('out/manifest.webmanifest','utf8'));
assert.equal(manifest.start_url,prefix+'/');assert.equal(manifest.icons[0].src,prefix+'/favicon.svg');
for(const p of ['bpa','ctb','conrad','prime','ihosa','mvp','winter','summer'])assert(existsSync(`out/materials/poster-${p}.svg`));
assert(existsSync('out/materials/R1.pdf'));
console.log('Static HTML, repository asset base, manifest, eight posters and PDF references passed.');
