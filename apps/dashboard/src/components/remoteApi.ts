// Shared backend client for the GitHub Pages build: every request goes to the Balaa
// Google Apps Script web app (apps-script/), so all phones see the same reports.
import { normalizeImage } from './imageTools';

const TOKEN_KEY = 'balaa_token';
const DEVICE_KEY = 'balaa_device';

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* The session then lasts until the page closes. */
  }
}
let memoryToken: string | null = null;
const token = () => read(TOKEN_KEY) ?? memoryToken;
function device() {
  let id = read(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(DEVICE_KEY, id);
  }
  return id;
}

// Photos live at /api/media/<id> in the rules and at a Drive address in the app.
const pathByUrl = new Map<string, string>();
function toPage(value: unknown, media: Record<string, string>): unknown {
  if (typeof value === 'string') {
    const id = value.startsWith('/api/media/') ? value.slice(11) : '';
    const url = id && media[id];
    if (!url) return value;
    pathByUrl.set(url, value);
    return url;
  }
  if (Array.isArray(value)) return value.map((item) => toPage(item, media));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPage(v, media)]));
  return value;
}
function fromPage(value: unknown): unknown {
  if (typeof value === 'string') return pathByUrl.get(value) ?? value;
  if (Array.isArray(value)) return value.map(fromPage);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromPage(v)]));
  return value;
}

type Reply = {
  status: number;
  body: { error?: unknown; token?: unknown } | null;
  media?: Record<string, string>;
};
async function send(backend: string, request: string): Promise<Reply | 'failed'> {
  try {
    const response = await fetch(backend, {
      method: 'POST',
      // text/plain keeps this a "simple" request, which Apps Script accepts cross-origin.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: request,
    });
    const reply = (await response.json()) as Reply;
    return typeof reply?.status === 'number' ? reply : 'failed';
  } catch {
    return 'failed';
  }
}

export async function remoteApi<T>(backend: string, url: string, body?: unknown): Promise<T> {
  let payload = body;
  // Send a small upright JPEG instead of the full camera photo.
  if (url === '/api/media' && body && typeof body === 'object' && 'dataUrl' in body) {
    const data = body as { dataUrl: string };
    const base64 = await normalizeImage(data.dataUrl.slice(data.dataUrl.indexOf(',') + 1));
    payload = { ...data, dataUrl: `data:image/jpeg;base64,${base64}` };
  }
  const read = body === undefined;
  const request = JSON.stringify({
    method: read ? 'GET' : 'POST',
    path: url,
    body: fromPage(payload),
    token: token(),
    device: device(),
  });
  let result: Reply | null = null;
  // Google sometimes answers slowly or with a temporary error page, especially when the
  // script has been idle. Reads are retried quietly; a change (like sending a report) is
  // retried only when the server says it did nothing, so it can never be sent twice.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
    const reply = await send(backend, request);
    if (reply === 'failed') {
      if (read) continue;
      break;
    }
    result = reply;
    if (reply.status !== 503) break;
  }
  if (!result)
    throw new Error(
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'أنت غير متصل بالإنترنت. سنحاول مرة أخرى عند عودة الاتصال.'
        : 'تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.',
    );
  if (result.status >= 400)
    throw new Error(
      typeof result.body?.error === 'string'
        ? result.body.error
        : 'تعذّر إتمام الطلب. حاول مرة أخرى.',
    );
  if (url === '/api/auth/logout') {
    memoryToken = null;
    write(TOKEN_KEY, null);
  }
  if (typeof result.body?.token === 'string') {
    memoryToken = result.body.token;
    write(TOKEN_KEY, result.body.token);
  }
  return toPage(result.body, result.media ?? {}) as T;
}
