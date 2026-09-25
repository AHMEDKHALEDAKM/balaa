// EXPO_PUBLIC_* variables are bundled into the app. They must never contain secrets.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { token?: string; body?: unknown; method?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string | { message?: string };
    };
    if (!response.ok) {
      const message =
        typeof data.error === 'string' ? data.error : (data.error?.message ?? data.message);
      throw new ApiError(
        message ?? `تعذر إتمام الطلب (${response.status}). حاول مرة أخرى.`,
        response.status,
        data,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('انتهت مهلة الاتصال. تحقق من الشبكة وحاول مرة أخرى.');
    throw new Error('تعذر الاتصال بخادم التجربة. تحقق من اتصالك وعنوان الخادم في إعدادات التطوير.');
  } finally {
    clearTimeout(timeout);
  }
}

export function mediaUrl(url: string) {
  if (/^(https?:|data:|file:)/.test(url)) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
