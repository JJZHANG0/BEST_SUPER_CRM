import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, rmSync, renameSync } from 'node:fs';
// Empty base serves at a domain root; GitHub project pages use /REPOSITORY.
const base = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
if (base && !/^\/[A-Za-z0-9_-]+$/.test(base)) throw new Error('Base path must be empty or one repository path.');
const run = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
  stdio: 'inherit', env: { ...process.env, NEXUS_STATIC_EXPORT: '1', NEXT_PUBLIC_BASE_PATH: base, NEXT_TELEMETRY_DISABLED: '1' },
});
if (run.status !== 0) process.exit(run.status || 1);
// Next exports to distDir when an explicit export directory is configured.
if (existsSync('.next-static/index.html')) {
  rmSync('out', { recursive: true, force: true });
  renameSync('.next-static', 'out');
}
writeFileSync('out/.nojekyll', '');
const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
manifest.start_url=(base||'')+'/';manifest.scope=(base||'')+'/';
manifest.icons=manifest.icons.map(icon=>({...icon,src:(base||'')+'/favicon.svg'}));
writeFileSync('out/manifest.webmanifest', JSON.stringify(manifest,null,2));
console.log(`Static site ready: out/ (base path ${base || '/'})`);
