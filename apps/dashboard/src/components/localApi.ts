// Phone demo backend (GitHub Pages build only). Runs the same demo rules as the
// Next.js server, but keeps all reports and photos on this device in IndexedDB.
// Nothing is sent anywhere: every phone has its own private copy of the demo.
import type { User } from '@balaa/types';
import { demoError, demoRequest } from '../server/demo-api';
import { seed, type State } from '../server/state';
import { normalizeImage } from './imageTools';
import { withBase } from './model';

const DB_NAME = 'balaa-demo';
const STORE = 'state';
const USER_KEY = 'balaa_demo_user';

let memory: State | null = null; // used when the browser blocks IndexedDB
let queue: Promise<unknown> = Promise.resolve();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function load(): Promise<State> {
  try {
    const db = await openDb();
    const stored = await new Promise<State | undefined>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get('state');
      request.onsuccess = () => resolve(request.result as State | undefined);
      request.onerror = () => reject(request.error);
    });
    return stored ?? seed(false);
  } catch {
    return (memory ??= seed(false));
  }
}
async function save(state: State) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, 'state');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memory = state;
  }
}
function storedUserId() {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}
function setStoredUser(id: string | null) {
  try {
    if (id) localStorage.setItem(USER_KEY, id);
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* Sign-in then lasts until the page closes. */
  }
}

// Stored photos are addressed as /api/media/<id>, which has no server here. Hand
// the page blob: URLs instead, and translate them back when the page sends them.
const blobByMedia = new Map<string, string>();
const mediaByBlob = new Map<string, string>();
function mediaUrl(state: State, id: string) {
  let url = blobByMedia.get(id);
  if (!url) {
    const media = state.media.find((m) => m.id === id);
    if (!media) return withBase('/image-pending.svg');
    const bytes = Uint8Array.from(atob(media.data), (c) => c.charCodeAt(0));
    url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    blobByMedia.set(id, url);
    mediaByBlob.set(url, id);
  }
  return url;
}
function toPage(state: State, value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('/api/media/')) return mediaUrl(state, value.slice(11));
    if (/imageurl$/i.test(key) && value.startsWith('/')) return withBase(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => toPage(state, item));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPage(state, v, k)]));
  return value;
}
function fromPage(value: unknown): unknown {
  if (typeof value === 'string') {
    const id = mediaByBlob.get(value);
    return id ? `/api/media/${id}` : value;
  }
  if (Array.isArray(value)) return value.map(fromPage);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromPage(v)]));
  return value;
}

async function run(url: string, body: unknown) {
  const method = body === undefined ? 'GET' : 'POST';
  const path = url
    .split('?')[0]!
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const endpoint = path.join('/');
  if (endpoint === 'config') return { mode: 'demo', identityMock: true, districtTeams: true };
  if (endpoint === 'auth/logout') {
    setStoredUser(null);
    return { ok: true };
  }
  const state = await load();
  const user: User | null = state.users.find((u) => u.id === storedUserId()) ?? null;
  try {
    const result = await demoRequest(state, user, method, path, fromPage(body ?? {}), {
      clientKey: 'device',
      normalizeImage,
      officialDistricts: true,
    });
    await save(state);
    if (result.login) {
      setStoredUser(result.login.id);
      return { user: result.login, token: 'device' };
    }
    return toPage(state, result.body);
  } catch (error) {
    const known = demoError(error);
    if (!known) throw error;
    const payload = known.body as { error: string };
    throw new Error(payload.error);
  }
}

export function localApi<T>(url: string, body?: unknown): Promise<T> {
  const next = queue.then(
    () => run(url, body),
    () => run(url, body),
  );
  queue = next.catch(() => undefined);
  return next as Promise<T>;
}
