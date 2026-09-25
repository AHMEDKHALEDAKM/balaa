import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { categorySchema, coordinateSchema } from '@balaa/types';
import { resolveDistrict } from '@balaa/geo';
import { audit, transaction } from '@/server/store';
import { handleSupabase } from '@/server/supabase';
import {
  ApiError,
  canManage,
  canRead,
  confirmReport,
  dto,
  duplicateReports,
  findReport,
  hashToken,
  issueSession,
  mockLogin,
  moderateReport,
  rateLimit,
  requireRole,
  requireUser,
  sessionUser,
  submitReport,
  transitionReport,
} from '@/server/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
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
    if (method === 'POST' && endpoint === 'admin/outbox/process') return json({ processed: 0 });
    return await transaction(async (state) => {
      const user = sessionUser(state, token);
      if (method === 'GET' && endpoint === 'auth/session') return json({ user });
      if (method === 'POST' && (endpoint === 'auth/mock' || endpoint === 'auth/staff')) {
        rateLimit(state, `login:${request.headers.get('x-forwarded-for') || 'local'}`, 30, 3600000);
        const result =
          endpoint === 'auth/mock'
            ? await mockLogin(state, user)
            : (() => {
                const { role } = z
                  .object({
                    role: z.enum([
                      'district_agent',
                      'district_manager',
                      'moderator',
                      'platform_admin',
                    ]),
                  })
                  .parse(body);
                const staff = state.users.find((u) => u.id === `demo-${role}`)!;
                audit(state, staff.id, 'session.demo_staff', staff.id);
                return issueSession(state, staff);
              })();
        const response = json(result);
        response.cookies.set('balaa_session', result.token, {
          httpOnly: true,
          sameSite: 'strict',
          secure: request.nextUrl.protocol === 'https:',
          path: '/',
          maxAge: 86400,
        });
        return response;
      }
      if (method === 'POST' && endpoint === 'auth/logout') {
        if (token) state.sessions = state.sessions.filter((s) => s.hash !== hashToken(token));
        const response = json({ ok: true });
        response.cookies.delete('balaa_session');
        return response;
      }
      if (method === 'GET' && endpoint === 'categories')
        return json({
          categories: state.categories.filter((c) => c.active || user?.role === 'platform_admin'),
        });
      if (method === 'GET' && endpoint === 'public/reports')
        return json({
          reports: state.reports
            .filter((r) => r.moderationStatus === 'safe')
            .map((r) => dto(state, r)),
        });
      if (method === 'GET' && path[0] === 'public' && path[1] === 'reports' && path[2]) {
        const report = findReport(state, path[2]);
        if (report.moderationStatus !== 'safe') throw new ApiError(404, 'البلاغ غير منشور');
        return json({ report: dto(state, report) });
      }
      if (method === 'GET' && endpoint === 'me/reports') {
        const citizen = requireUser(user);
        return json({
          reports: state.reports.filter((r) => r.userId === citizen.id).map((r) => dto(state, r)),
        });
      }
      if (method === 'POST' && endpoint === 'geo') {
        const input = coordinateSchema.parse(body);
        const district = resolveDistrict(input.latitude, input.longitude);
        if (!district) throw new ApiError(422, 'الموقع خارج حدود العرض التجريبي');
        return json({
          district: { id: district.id, nameAr: district.nameAr, nameEn: district.nameEn },
          dataset: 'synthetic-demo',
        });
      }
      if (method === 'POST' && endpoint === 'reports/duplicates') {
        requireRole(user, ['citizen']);
        const input = coordinateSchema.extend({ categoryId: z.string().max(80) }).parse(body);
        return json({ reports: duplicateReports(state, input).map((r) => dto(state, r)) });
      }
      if (method === 'POST' && endpoint === 'reports')
        return json({ report: await submitReport(state, user, body) }, 201);
      if (method === 'POST' && path[0] === 'reports' && path[1] && path[2] === 'confirm')
        return json({ report: confirmReport(state, user, path[1]) });
      if (method === 'POST' && endpoint === 'media') {
        const actor = requireUser(user);
        rateLimit(state, `upload:${actor.id}`, 30, 3600000);
        const input = z
          .object({ dataUrl: z.string().max(7000000), kind: z.enum(['before', 'resolution']) })
          .parse(body);
        if (input.kind === 'before') requireRole(user, ['citizen']);
        else requireRole(user, ['district_agent', 'district_manager', 'platform_admin']);
        const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl);
        if (!match) throw new ApiError(400, 'استخدم صورة JPEG أو PNG أو WebP');
        const bytes = Buffer.from(match[2]!, 'base64');
        if (bytes.length > 5000000) throw new ApiError(413, 'الحد الأقصى للصورة 5 ميجابايت');
        let normalized: Buffer;
        try {
          normalized = await sharp(bytes, { limitInputPixels: 24000000 })
            .rotate()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();
        } catch {
          throw new ApiError(400, 'الصورة غير صالحة');
        }
        const id = randomUUID();
        state.media.push({
          id,
          ownerId: actor.id,
          kind: input.kind,
          data: normalized.toString('base64'),
          createdAt: new Date().toISOString(),
        });
        audit(state, actor.id, 'media.uploaded', id);
        return json({ imageUrl: `/api/media/${id}` }, 201);
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
      if (method === 'GET' && endpoint === 'dashboard/reports') {
        const actor = requireRole(user, ['district_agent', 'district_manager', 'platform_admin']);
        return json({
          reports: state.reports
            .filter((r) => canManage(actor, r) && r.moderationStatus === 'safe')
            .map((r) => ({
              ...dto(state, r, true),
              internalNotes: r.internalNotes.map((n) => ({ note: n.note, createdAt: n.createdAt })),
            })),
        });
      }
      if (method === 'POST' && path[0] === 'dashboard' && path[1] === 'reports' && path[2]) {
        const report = findReport(state, path[2]);
        const actor = requireUser(user);
        if (!canManage(actor, report)) throw new ApiError(403, 'غير مصرح');
        if (path[3] === 'status')
          return json({ report: await transitionReport(state, actor, report.id, body) });
        if (path[3] === 'notes') {
          const { note } = z.object({ note: z.string().trim().min(1).max(1000) }).parse(body);
          report.internalNotes.push({
            note,
            actorId: actor.id,
            createdAt: new Date().toISOString(),
          });
          audit(state, actor.id, 'report.internal_note', report.id);
          return json({ ok: true });
        }
      }
      if (method === 'GET' && endpoint === 'moderation') {
        requireRole(user, ['moderator', 'platform_admin']);
        return json({
          reports: state.reports
            .filter((r) => r.moderationStatus !== 'safe')
            .map((r) => dto(state, r, true)),
        });
      }
      if (method === 'POST' && path[0] === 'moderation' && path[1]) {
        const input = z
          .object({
            decision: z.enum(['safe', 'flagged', 'blocked']),
            note: z.string().trim().min(3).max(1000),
          })
          .parse(body);
        return json({
          report: await moderateReport(state, user, path[1], input.decision, input.note),
        });
      }
      if (method === 'GET' && endpoint === 'admin/outbox') {
        requireRole(user, ['platform_admin']);
        return json({ notifications: state.notifications });
      }
      if (method === 'GET' && endpoint === 'admin/audit') {
        requireRole(user, ['platform_admin']);
        return json({ events: state.audit });
      }
      if (method === 'POST' && endpoint === 'admin/categories') {
        const actor = requireRole(user, ['platform_admin']);
        const input = categorySchema.parse(body);
        const category = { ...input, id: input.id || `category-${randomUUID().slice(0, 8)}` };
        const index = state.categories.findIndex((c) => c.id === category.id);
        if (index === -1) state.categories.push(category);
        else state.categories[index] = category;
        audit(state, actor.id, 'category.updated', category.id);
        return json({ category });
      }
      if (method === 'GET' && endpoint === 'admin/abuse') {
        requireRole(user, ['platform_admin']);
        return json({
          accounts: state.users
            .filter((u) => u.role === 'citizen')
            .map((u) => ({
              id: u.id,
              suspendedUntil: u.suspendedUntil,
              submitted: state.reports.filter((r) => r.userId === u.id).length,
              rejected: state.reports.filter((r) => r.userId === u.id && r.status === 'rejected')
                .length,
              flagged: state.reports.filter(
                (r) => r.userId === u.id && r.moderationStatus === 'flagged',
              ).length,
              strikes: state.audit.filter((a) => a.action === 'abuse.strike' && a.targetId === u.id)
                .length,
            })),
        });
      }
      if (method === 'POST' && endpoint === 'admin/abuse') {
        const actor = requireRole(user, ['platform_admin']);
        const input = z
          .object({
            userId: z.string(),
            hours: z.number().int().min(0).max(168),
            note: z.string().trim().min(3).max(500),
          })
          .parse(body);
        const target = state.users.find((u) => u.id === input.userId && u.role === 'citizen');
        if (!target) throw new ApiError(404, 'Account not found');
        target.suspendedUntil = input.hours
          ? new Date(Date.now() + input.hours * 3600000).toISOString()
          : undefined;
        audit(
          state,
          actor.id,
          input.hours ? 'abuse.strike' : 'abuse.reviewed',
          target.id,
          input.note,
        );
        return json({ ok: true });
      }
      throw new ApiError(404, 'Endpoint not found');
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: 'بيانات غير صالحة',
          details: error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        400,
      );
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error('Balaa request failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'تعذر إتمام الطلب. راجع إعدادات الخادم.' }, 500);
  }
}
export const GET = handle;
export const POST = handle;
