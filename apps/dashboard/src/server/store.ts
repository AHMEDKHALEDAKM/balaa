import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seed, type State } from './state';

export * from './state';
export const dataDirectory = () => process.env.BALAA_DATA_DIR || path.join(process.cwd(), '.balaa');
declare global {
  var balaaTransactionQueue: Promise<unknown> | undefined;
}
/** One local Next.js process only. Hosted concurrency belongs in PostgreSQL RPCs. */
export async function transaction<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
  const run = async () => {
    await mkdir(dataDirectory(), { recursive: true });
    const file = path.join(dataDirectory(), 'state.json');
    let state: State;
    try {
      state = JSON.parse(await readFile(file, 'utf8')) as State;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      state = seed();
    }
    const result = await fn(state);
    const temp = path.join(dataDirectory(), `state-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(state), 'utf8');
    await rename(temp, file);
    return result;
  };
  const result = (globalThis.balaaTransactionQueue || Promise.resolve()).then(run, run);
  globalThis.balaaTransactionQueue = result.catch(() => undefined);
  return result;
}
