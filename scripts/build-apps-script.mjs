// Builds apps-script/dist/Code.gs: one file to paste into the Google Apps Script editor.
// Usage: npm run build:apps-script
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = path.join(root, 'apps-script');
const bundle = await build({
  entryPoints: [path.join(dir, 'core.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'BalaaCore',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  target: 'es2020',
  // Turn async/await into calls on the global Promise, which prelude.js makes synchronous.
  supported: { 'async-await': false, 'async-generator': false, 'for-await': false },
  minify: true,
  legalComments: 'none',
  loader: { '.json': 'json' },
  tsconfig: path.join(root, 'apps/dashboard/tsconfig.json'),
});
const header = `// Balaa shared backend for Google Apps Script. GENERATED FILE, do not edit here.
// Source: apps-script/prelude.js, apps-script/Code.js and the shared rules in
// apps/dashboard/src/server. Rebuild with: npm run build:apps-script
`;
const output = [
  header,
  readFileSync(path.join(dir, 'prelude.js'), 'utf8'),
  bundle.outputFiles[0].text,
  readFileSync(path.join(dir, 'Code.js'), 'utf8'),
].join('\n');
mkdirSync(path.join(dir, 'dist'), { recursive: true });
writeFileSync(path.join(dir, 'dist/Code.gs'), output);
console.log(`apps-script/dist/Code.gs written (${Math.round(output.length / 1024)} KB).`);
