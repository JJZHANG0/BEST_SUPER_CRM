// Bundles the API into a single dependency-free file so the server needs only Node 22.
import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('server-dist', { recursive: true, force: true });
mkdirSync('server-dist');
await build({
  entryPoints: ['server/index.ts'], outfile: 'server-dist/index.mjs', bundle: true, platform: 'node', target: 'node22', format: 'esm',
  external: ['pg-native'], sourcemap: true, legalComments: 'none', logLevel: 'warning',
  alias: { '@': '.' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
cpSync('drizzle', 'server-dist/drizzle', { recursive: true });
console.log('API bundle ready: server-dist/index.mjs (+ drizzle migrations)');
