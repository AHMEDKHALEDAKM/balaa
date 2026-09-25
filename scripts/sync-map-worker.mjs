import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'node_modules/maplibre-gl');
const target = path.join(root, 'apps/dashboard/public/vendor/maplibre');
await mkdir(target, { recursive: true });
for (const name of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'])
  await copyFile(path.join(source, 'dist', name), path.join(target, name));
await copyFile(path.join(source, 'LICENSE.txt'), path.join(target, 'LICENSE.txt'));
