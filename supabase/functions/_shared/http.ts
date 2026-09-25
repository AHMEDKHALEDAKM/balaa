export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Expected an object');
  return value as JsonObject;
}
export function onlyKeys(value: JsonObject, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new HttpError(400, 'Unexpected request fields');
}
export function text(value: unknown, maximum = 2000, minimum = 1): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum)
    throw new HttpError(400, 'Invalid text field');
  return value.trim();
}
export function uuid(value: unknown): string {
  const result = text(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result))
    throw new HttpError(400, 'Invalid identifier');
  return result;
}
export function number(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
    throw new HttpError(400, 'Invalid numeric field');
  return value;
}
export function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    throw new HttpError(400, 'Invalid choice');
  return value as T;
}
export function timestamp(value: unknown): string {
  const result = text(value, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) ||
    !Number.isFinite(Date.parse(result))
  )
    throw new HttpError(400, 'Invalid timestamp');
  return result;
}
function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, 'Server configuration is incomplete');
  return value;
}
function cors(request: Request): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  });
  const origin = request.headers.get('Origin');
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((v) => v.trim());
  if (origin && !allowed.includes(origin)) throw new HttpError(403, 'Origin is not allowed');
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return headers;
}
export interface UserClient {
  userId: string;
  rpc(name: string, parameters: JsonObject): Promise<unknown>;
  read(table: string, query: URLSearchParams): Promise<unknown>;
  signImage(bucket: 'report-originals' | 'report-derivatives', path: string): Promise<unknown>;
}
export async function authenticate(request: Request): Promise<UserClient> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 8192)
    throw new HttpError(401, 'Authentication required');
  const base = env('SUPABASE_URL');
  // This function never reads or uses a service-role key. Every database/storage
  // request carries the end user's JWT, so direct RPC authorization still applies.
  const headers = {
    apikey: env('SUPABASE_ANON_KEY'),
    Authorization: authorization,
    'Content-Type': 'application/json',
  };
  const auth = await fetch(`${base}/auth/v1/user`, { headers });
  if (!auth.ok) throw new HttpError(401, 'Invalid or expired session');
  const user = object(await auth.json());
  const userId = uuid(user.id);
  async function execute(path: string, method: string, body?: JsonObject): Promise<unknown> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      let error: JsonObject = {};
      try {
        error = object(await response.json());
      } catch {
        /* Do not expose infrastructure errors. */
      }
      const code = typeof error.code === 'string' ? error.code : '';
      const safeCodes = ['42501', '22023', 'P0001'];
      const message =
        safeCodes.includes(code) && typeof error.message === 'string'
          ? error.message
          : 'The requested operation could not be completed';
      throw new HttpError(
        code === '42501' ? 403 : code === 'P0001' ? 429 : response.status >= 500 ? 503 : 400,
        message,
      );
    }
    const result = await response.text();
    return result ? JSON.parse(result) : null;
  }
  return {
    userId,
    rpc: (name, parameters) => execute(`/rest/v1/rpc/${name}`, 'POST', parameters),
    read: (table, query) => execute(`/rest/v1/${table}?${query.toString()}`, 'GET'),
    signImage: (bucket, path) =>
      execute(
        `/storage/v1/object/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
        'POST',
        { expiresIn: 60 },
      ),
  };
}
export async function handle(
  request: Request,
  operation: (body: JsonObject, client: UserClient) => Promise<unknown>,
): Promise<Response> {
  let headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  try {
    headers = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') throw new HttpError(405, 'POST required');
    if (!request.headers.get('Content-Type')?.startsWith('application/json'))
      throw new HttpError(415, 'JSON required');
    if (Number(request.headers.get('Content-Length') ?? 0) > 32768)
      throw new HttpError(413, 'Request too large');
    const client = await authenticate(request);
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Request body required');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 32768) {
        await reader.cancel();
        throw new HttpError(413, 'Request too large');
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let body: JsonObject;
    try {
      body = object(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      throw new HttpError(400, 'Invalid JSON object');
    }
    return new Response(JSON.stringify({ data: await operation(body, client) }), {
      status: 200,
      headers,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : 'Unexpected server error';
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
}
