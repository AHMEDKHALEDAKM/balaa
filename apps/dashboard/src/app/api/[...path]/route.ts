import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { handleSupabase } from '@/server/supabase';
import { canRead, ApiError } from '@/server/service';
import { hashToken, issueSession, sessionUser } from '@/server/session';
import { demoError, demoRequest } from '@/server/demo-api';
import { transaction } from '@/server/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function normalizeImage(base64: string) {
  const jpeg = await sharp(Buffer.from(base64, 'base64'), { limitInputPixels: 24000000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return jpeg.toString('base64');
}
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const mode = process.env.APP_MODE || 'demo';
    if (!['demo', 'supabase'].includes(mode)) throw new ApiError(503, 'Unknown backend mode');
    const path = (await context.params).path;
    const method = request.method;
    const endpoint = path.join('/');
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const token = bearer || request.cookies.get('balaa_session')?.value || null;
    if (method !== 'GET' && !bearer) {
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== request.headers.get('host'))
        throw new ApiError(403, 'Cross-origin writes are not allowed');
    }
    let body: unknown = {};
    if (method !== 'GET') {
      if (Number(request.headers.get('content-length') || 0) > 7500000)
        throw new ApiError(413, 'حجم الصورة كبير');
      const text = await request.text();
      if (text.length > 7500000) throw new ApiError(413, 'حجم الصورة كبير');
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        throw new ApiError(400, 'Invalid JSON');
      }
    }
    if (method === 'GET' && endpoint === 'config')
      return json({
        mode,
        identityMock: process.env.AUTH_PROVIDER === 'digital_egypt_mock' || mode === 'demo',
      });
    if (mode === 'supabase') return await handleSupabase(request, path, body, token);
    return await transaction(async (state) => {
      const user = sessionUser(state, token);
      if (method === 'POST' && endpoint === 'auth/logout') {
        if (token) state.sessions = state.sessions.filter((s) => s.hash !== hashToken(token));
        const response = json({ ok: true });
        response.cookies.delete('balaa_session');
        return response;
      }
      if (method === 'GET' && path[0] === 'media' && path[1]) {
        const media = state.media.find((m) => m.id === path[1]);
        if (!media) throw new ApiError(404, 'الصورة غير موجودة');
        const report = media.reportId
          ? state.reports.find((r) => r.id === media.reportId)
          : undefined;
        const allowed = report ? canRead(user, report) : user?.id === media.ownerId;
        if (!allowed) throw new ApiError(404, 'الصورة غير متاحة');
        return new NextResponse(Buffer.from(media.data, 'base64'), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      const result = await demoRequest(state, user, method, path, body, {
        clientKey: request.headers.get('x-forwarded-for') || 'local',
        normalizeImage,
      });
      if (!result.login) return json(result.body, result.status);
      const session = issueSession(state, result.login);
      const response = json(session);
      response.cookies.set('balaa_session', session.token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: 86400,
      });
      return response;
    });
  } catch (error) {
    const known = demoError(error);
    if (known) return json(known.body, known.status);
    console.error('Balaa request failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'تعذر إتمام الطلب. راجع إعدادات الخادم.' }, 500);
  }
}
export const GET = handle;
export const POST = handle;
