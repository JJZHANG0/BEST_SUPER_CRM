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
assert.equal(manifest.start_url,prefix+'/');
// Husky favicon set: every manifest icon lives under the Pages base, carries ?v= cache-busting and exists.
assert(manifest.icons.length>=3&&manifest.icons.some(i=>i.purpose==='maskable'));
for(const i of manifest.icons){assert(i.src.startsWith(prefix+'/')&&/\?v=\w+$/.test(i.src),`manifest icon ${i.src}`);assert(existsSync('out'+i.src.slice(prefix.length).split('?')[0]),`Missing icon ${i.src}`)}
for(const f of ['favicon.ico','favicon-16x16.png','favicon-32x32.png','icon-192.png','icon-512.png','apple-touch-icon.png'])assert(existsSync('out/'+f),`Missing ${f}`);
assert(!existsSync('out/favicon.svg'),'old B. tile favicon removed');
assert(/<link rel="icon" href="\/BEST_SUPER_CRM\/favicon\.ico\?v=\w+"/.test(html),'favicon.ico link under Pages base with ?v=');
assert(/<link rel="apple-touch-icon" href="\/BEST_SUPER_CRM\/apple-touch-icon\.png\?v=\w+" sizes="180x180"/.test(html),'apple-touch-icon link');
assert(/<link rel="manifest" href="\/BEST_SUPER_CRM\/manifest\.webmanifest\?v=\w+"/.test(html),'manifest link');
for(const f of ['husky-avatar.webp','husky-avatar.png'])assert(existsSync(`out/brand/${f}`),`Missing sidebar avatar ${f}`);
for(const p of ['bpa','ctb','conrad','prime','ihosa','mvp','winter','summer']){assert(existsSync(`out/materials/poster-${p}.svg`));assert(existsSync(`out/materials/cover-${p}.svg`),`Missing article cover for ${p}`)}
for(const s of ['workshop','research','showcase'])assert(existsSync(`out/materials/scene-${s}.svg`),`Missing article illustration ${s}`);
assert(existsSync('out/materials/R1.pdf'));
for(const f of ['bunny.webp','bunny.png'])assert(existsSync(`out/brand/${f}`),`Missing brand asset ${f}`);
assert(html.includes(prefix+'/brand/bunny.webp'),'Bunny easter-egg image is preloaded under the Pages base');
assert(html.includes('B.E.S.T · 内部超级管理系统'));
assert.equal(manifest.short_name,'B.E.S.T');

// Link previews: generic Open Graph card with an absolute PNG image (crawlers ignore SVG).
assert(html.includes('<meta property="og:image" content="https://jjzhang0.github.io/BEST_SUPER_CRM/og-default.png"/>'),'og:image');
assert(html.includes('property="og:title"')&&html.includes('property="og:description"'));
assert(existsSync('out/og-default.png'));
for(const p of ['bpa','ctb','conrad','prime','ihosa','mvp','winter','summer'])assert(existsSync(`out/materials/cover-${p}.png`),`Missing PNG cover for ${p}`);
console.log('Static HTML, repository asset base, manifest, eight posters, article covers/illustrations PNG link-preview images, OG tags and PDF references passed.');
