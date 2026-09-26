// Demo-mode API rules shared by the Next.js route (JSON file store) and the
// phone demo on GitHub Pages (browser store). Keep this file free of Node imports.
import { z } from 'zod';
import { categorySchema, coordinateSchema, type User } from '@balaa/types';
import { resolveDistrict } from '@balaa/geo';
import { audit, type State } from './state';
import {
  ApiError,
  canManage,
  confirmReport,
  dto,
  duplicateReports,
  findReport,
  mockLogin,
  moderateReport,
  rateLimit,
  requireRole,
  requireUser,
  submitReport,
  transitionReport,
} from './service';

export interface DemoHost {
  /** Identifies the caller for login rate limits. */
  clientKey: string;
  /** Re-encodes an uploaded image as a metadata-free JPEG and returns it as base64. */
  normalizeImage(base64: string): Promise<string>;
}
/** `login` asks the host to start a session for that user and return it to the caller. */
export type DemoResult = { status: number; body: unknown; login?: User };

const ok = (body: unknown, status = 200): DemoResult => ({ status, body });

export async function demoRequest(
  state: State,
  user: User | null,
  method: string,
  path: string[],
  body: unknown,
  host: DemoHost,
): Promise<DemoResult> {
  const endpoint = path.join('/');
  if (method === 'POST' && endpoint === 'admin/outbox/process') return ok({ processed: 0 });
  if (method === 'GET' && endpoint === 'auth/session') return ok({ user });
  if (method === 'POST' && (endpoint === 'auth/mock' || endpoint === 'auth/staff')) {
    rateLimit(state, `login:${host.clientKey}`, 30, 3600000);
    if (endpoint === 'auth/mock') {
      const citizen = await mockLogin(state, user);
      return { status: 200, body: null, login: citizen };
    }
    const { role } = z
      .object({
        role: z.enum(['district_agent', 'district_manager', 'moderator', 'platform_admin']),
      })
      .parse(body);
    const staff = state.users.find((u) => u.id === `demo-${role}`)!;
    audit(state, staff.id, 'session.demo_staff', staff.id);
    return { status: 200, body: null, login: staff };
  }
  if (method === 'GET' && endpoint === 'categories')
    return ok({
      categories: state.categories.filter((c) => c.active || user?.role === 'platform_admin'),
    });
  if (method === 'GET' && endpoint === 'public/reports')
    return ok({
      reports: state.reports.filter((r) => r.moderationStatus === 'safe').map((r) => dto(state, r)),
    });
  if (method === 'GET' && path[0] === 'public' && path[1] === 'reports' && path[2]) {
    const report = findReport(state, path[2]);
    if (report.moderationStatus !== 'safe') throw new ApiError(404, 'البلاغ غير منشور');
    return ok({ report: dto(state, report) });
  }
  if (method === 'GET' && endpoint === 'me/reports') {
    const citizen = requireUser(user);
    return ok({
      reports: state.reports.filter((r) => r.userId === citizen.id).map((r) => dto(state, r)),
    });
  }
  if (method === 'POST' && endpoint === 'geo') {
    const input = coordinateSchema.parse(body);
    const district = resolveDistrict(input.latitude, input.longitude);
    if (!district) throw new ApiError(422, 'الموقع خارج حدود العرض التجريبي');
    return ok({
      district: { id: district.id, nameAr: district.nameAr, nameEn: district.nameEn },
      dataset: 'synthetic-demo',
    });
  }
  if (method === 'POST' && endpoint === 'reports/duplicates') {
    requireRole(user, ['citizen']);
    const input = coordinateSchema.extend({ categoryId: z.string().max(80) }).parse(body);
    return ok({ reports: duplicateReports(state, input).map((r) => dto(state, r)) });
  }
  if (method === 'POST' && endpoint === 'reports')
    return ok({ report: await submitReport(state, user, body) }, 201);
  if (method === 'POST' && path[0] === 'reports' && path[1] && path[2] === 'confirm')
    return ok({ report: confirmReport(state, user, path[1]) });
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
    const base64 = match[2]!;
    const bytes = Math.floor((base64.length * 3) / 4) - (base64.match(/=+$/)?.[0].length ?? 0);
    if (bytes > 5000000) throw new ApiError(413, 'الحد الأقصى للصورة 5 ميجابايت');
    let normalized: string;
    try {
      normalized = await host.normalizeImage(base64);
    } catch {
      throw new ApiError(400, 'الصورة غير صالحة');
    }
    const id = crypto.randomUUID();
    state.media.push({
      id,
      ownerId: actor.id,
      kind: input.kind,
      data: normalized,
      createdAt: new Date().toISOString(),
    });
    audit(state, actor.id, 'media.uploaded', id);
    return ok({ imageUrl: `/api/media/${id}` }, 201);
  }
  if (method === 'GET' && endpoint === 'dashboard/reports') {
    const actor = requireRole(user, ['district_agent', 'district_manager', 'platform_admin']);
    return ok({
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
      return ok({ report: await transitionReport(state, actor, report.id, body) });
    if (path[3] === 'notes') {
      const { note } = z.object({ note: z.string().trim().min(1).max(1000) }).parse(body);
      report.internalNotes.push({ note, actorId: actor.id, createdAt: new Date().toISOString() });
      audit(state, actor.id, 'report.internal_note', report.id);
      return ok({ ok: true });
    }
  }
  if (method === 'GET' && endpoint === 'moderation') {
    requireRole(user, ['moderator', 'platform_admin']);
    return ok({
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
    return ok({ report: await moderateReport(state, user, path[1], input.decision, input.note) });
  }
  if (method === 'GET' && endpoint === 'admin/outbox') {
    requireRole(user, ['platform_admin']);
    return ok({ notifications: state.notifications });
  }
  if (method === 'GET' && endpoint === 'admin/audit') {
    requireRole(user, ['platform_admin']);
    return ok({ events: state.audit });
  }
  if (method === 'POST' && endpoint === 'admin/categories') {
    const actor = requireRole(user, ['platform_admin']);
    const input = categorySchema.parse(body);
    const category = { ...input, id: input.id || `category-${crypto.randomUUID().slice(0, 8)}` };
    const index = state.categories.findIndex((c) => c.id === category.id);
    if (index === -1) state.categories.push(category);
    else state.categories[index] = category;
    audit(state, actor.id, 'category.updated', category.id);
    return ok({ category });
  }
  if (method === 'GET' && endpoint === 'admin/abuse') {
    requireRole(user, ['platform_admin']);
    return ok({
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
    audit(state, actor.id, input.hours ? 'abuse.strike' : 'abuse.reviewed', target.id, input.note);
    return ok({ ok: true });
  }
  throw new ApiError(404, 'Endpoint not found');
}

/** Error response body in the same shape the Next.js route has always returned. */
export function demoError(error: unknown): { status: number; body: unknown } | null {
  if (error instanceof z.ZodError)
    return {
      status: 400,
      body: {
        error: 'بيانات غير صالحة',
        details: error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
    };
  if (error instanceof ApiError) return { status: error.status, body: { error: error.message } };
  return null;
}
