// Builds the phone demo for GitHub Pages into apps/dashboard/out.
// Usage: npm run build:pages            (served from /balaa, the repository name)
//        BALAA_BASE_PATH=/other npm run build:pages
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboard = path.join(root, 'apps/dashboard');
const basePath = process.env.BALAA_BASE_PATH ?? '/balaa';
const env = { ...process.env, NEXT_PUBLIC_STATIC_DEMO: '1', NEXT_PUBLIC_BASE_PATH: basePath };
const run = (args) => {
  const result = spawnSync(process.execPath, args, { cwd: dashboard, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run([path.join(root, 'scripts/sync-map-worker.mjs')]);
run([path.join(root, 'node_modules/next/dist/bin/next'), 'build']);
// Stop GitHub Pages from running Jekyll, which would hide the _next folder.
writeFileSync(path.join(dashboard, 'out/.nojekyll'), '');
console.log(`Phone demo built in apps/dashboard/out (base path "${basePath}").`);
