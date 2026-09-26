import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import {
  categorySchema,
  coordinateSchema,
  reportInputSchema,
  transitionSchema,
  type PublicReport,
  type Role,
  type User,
} from '@balaa/types';
import { ApiError } from './service';

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const idSchema = z.uuid();
const uploadPattern = /^\/api\/media\/upload_([0-9a-f-]{36})_([0-9a-f-]{36})$/;

/** Every backend request carries the caller's JWT. This adapter never reads a service-role key. */
export class SupabaseGateway {
  readonly base: string;
  readonly key: string;
  constructor(readonly token: string | null) {
    this.base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
      /\/$/,
      '',
    );
    this.key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!this.base || !this.key) throw new ApiError(503, 'Supabase URL and anon key are required');
  }
  headers() {
    return { apikey: this.key, Authorization: `Bearer ${this.token || this.key}` };
  }
  async request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
    const result = (await response.json().catch(() => null)) as Row | null;
    if (!response.ok) {
      const code = text(result?.code);
      const message =
        text(result?.error_description) ||
        text(result?.message) ||
        text(result?.error) ||
        'Supabase operation failed';
      throw new ApiError(
        code === '42501'
          ? 403
          : code === 'P0001'
            ? 429
            : response.status >= 500
              ? 503
              : response.status,
        message,
      );
    }
    return result;
  }
  read(table: string, filters: Record<string, string> = {}) {
    return this.request(
      `/rest/v1/${table}?${new URLSearchParams({ select: '*', ...filters })}`,
    ).then(rows);
  }
  rpc(name: string, parameters: Row) {
    return this.request(`/rest/v1/rpc/${name}`, 'POST', parameters);
  }
  async edge(name: string, body: Row) {
    const result = (await this.request(`/functions/v1/${name}`, 'POST', body)) as Row;
    return result.data;
  }
  async upload(bucket: string, path: string, bytes: Buffer) {
    const response = await fetch(`${this.base}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: new Uint8Array(bytes),
    });
    if (!response.ok) throw new ApiError(response.status, 'تعذر رفع الصورة إلى التخزين الخاص');
  }
  async image(bucket: string, path: string) {
    const response = await fetch(`${this.base}/storage/v1/object/authenticated/${bucket}/${path}`, {
      headers: this.headers(),
      cache: 'no-store',
    });
    if (!response.ok) throw new ApiError(404, 'الصورة غير متاحة');
    return Buffer.from(await response.arrayBuffer());
  }
  async profile(): Promise<User | null> {
    if (!this.token) return null;
    const auth = (await this.request('/auth/v1/user')) as Row;
    const account = (await this.read('users', { id: `eq.${idSchema.parse(auth.id)}` }))[0];
    if (!account) return null;
    const memberships = await this.read('district_memberships', { user_id: `eq.${account.id}` });
    return {
      id: text(account.id),
      role: text(account.role) as Role,
      verified: account.verified === true,
      districtIds: memberships.map((m) => text(m.district_id)),
      ...(account.suspended_until ? { suspendedUntil: text(account.suspended_until) } : {}),
    };
  }
}

function requireAccount(user: User | null, roles?: Role[]): User {
  if (!user) throw new ApiError(401, 'سجّل الدخول أولًا');
  if (roles && !roles.includes(user.role)) throw new ApiError(403, 'غير مصرح');
  return user;
}
function originalPath(url: string, userId: string) {
  const match = uploadPattern.exec(url);
  if (!match || match[1] !== userId) throw new ApiError(400, 'صورة مملوكة للحساب مطلوبة');
  idSchema.parse(match[1]);
  idSchema.parse(match[2]);
  return `${match[1]}/${match[2]}.jpg`;
}
async function normalizedPhoto(body: unknown) {
  const input = z
    .object({ dataUrl: z.string().max(7000000), kind: z.enum(['before', 'resolution']) })
    .parse(body);
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl);
  if (!match) throw new ApiError(400, 'صورة JPEG أو PNG أو WebP مطلوبة');
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length > 5000000) throw new ApiError(413, 'الحد الأقصى 5 ميجابايت');
  try {
    return {
      kind: input.kind,
      bytes: await sharp(bytes, { limitInputPixels: 24000000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer(),
    };
  } catch {
    throw new ApiError(400, 'صورة غير صالحة');
  }
}

type ReportView = 'public' | 'own' | 'district' | 'moderation';
async function reports(
  client: SupabaseGateway,
  view: ReportView,
  user: User | null,
  filter?: string,
): Promise<PublicReport[]> {
  const table = {
    public: 'public_reports',
    own: 'reports',
    district: 'district_reports',
    moderation: 'moderation_queue',
  }[view];
  const filters: Record<string, string> = { order: 'created_at.desc', limit: '200' };
  if (filter) filters[/^BLAA-\d+$/.test(filter) ? 'public_id' : 'id'] = `eq.${filter}`;
  if (view === 'own') filters.user_id = `eq.${requireAccount(user).id}`;
  const [records, categories, districts] = await Promise.all([
    client.read(table, filters),
    client.read('categories'),
    client.read('districts'),
  ]);
  if (!records.length) return [];
  const ids = records.map((r) => text(r.id));
  const imageTable =
    view === 'public'
      ? 'public_report_images'
      : view === 'district'
        ? 'district_report_images'
        : 'report_images';
  const historyTable =
    view === 'public'
      ? 'public_report_timeline'
      : view === 'district'
        ? 'district_report_timeline'
        : view === 'moderation'
          ? 'moderator_report_timeline'
          : 'report_status_history';
  const [images, history] = await Promise.all([
    client.read(imageTable, { report_id: `in.(${ids.join(',')})` }),
    client.read(historyTable, { report_id: `in.(${ids.join(',')})`, order: 'created_at.asc' }),
  ]);
  return records.map((r) => {
    const category = categories.find((c) => c.id === r.category_id || c.slug === r.category_slug);
    const district = districts.find((d) => d.id === r.district_id);
    const before = images.find((i) => i.report_id === r.id && i.kind === 'before');
    const after = images.filter((i) => i.report_id === r.id && i.kind === 'after').at(-1);
    const imageUrl = (i: Row | undefined) =>
      i
        ? `/api/media/${view === 'public' || view === 'district' ? 'public' : 'private'}_${i.id}`
        : '/image-pending.svg';
    return {
      id: text(r.id),
      publicId: text(r.public_id),
      categoryId: text(category?.slug) || text(r.category_slug),
      categoryLabel: text(category?.name_ar) || text(r.category_ar),
      categoryLabelEn: text(category?.name_en) || text(r.category_en),
      districtNameEn: text(district?.name_en),
      districtId: text(district?.slug),
      districtName: text(district?.name_ar),
      status: r.status as PublicReport['status'],
      moderationStatus: (r.moderation_status || 'safe') as PublicReport['moderationStatus'],
      severity: r.severity as PublicReport['severity'],
      description: text(r.description),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      imageUrl: imageUrl(before),
      ...(after ? { resolutionImageUrl: imageUrl(after) } : {}),
      ...(r.resolved_at ? { resolutionNote: 'تم توثيق الحل بصورة معتمدة.' } : {}),
      createdAt: text(r.created_at),
      confirmationCount: Number(r.confirmation_count) || 0,
      history: history
        .filter((h) => h.report_id === r.id)
        .map((h) => ({
          status: h.to_status as PublicReport['status'],
          createdAt: text(h.created_at),
        })),
      ...(view === 'district' || view === 'moderation'
        ? { identityVerified: r.citizen_verified === true }
        : {}),
    };
  });
}
async function reportResult(client: SupabaseGateway, id: string, user: User | null) {
  for (const view of (user?.role === 'citizen'
    ? ['own', 'public']
    : user?.role === 'moderator'
      ? ['moderation', 'public']
      : ['district', 'moderation', 'public']) as ReportView[]) {
    const list = await reports(client, view, user, id);
    if (list[0]) return list[0];
  }
  throw new ApiError(404, 'البلاغ غير متاح');
}

export async function handleSupabase(
  request: NextRequest,
  path: string[],
  body: unknown,
  token: string | null,
) {
  const client = new SupabaseGateway(token);
  const endpoint = path.join('/');
  const method = request.method;
  if (method === 'POST' && ['auth/mock', 'auth/staff'].includes(endpoint)) {
    let auth: Row;
    if (endpoint === 'auth/mock') {
      if (
        process.env.AUTH_PROVIDER !== 'digital_egypt_mock' ||
        process.env.ENABLE_MOCK_IDENTITY !== 'true'
      )
        throw new ApiError(403, 'Mock identity must be explicitly enabled');
      const existing = await client.profile();
      if (existing?.role === 'citizen') auth = { access_token: token };
      else auth = (await new SupabaseGateway(null).request('/auth/v1/signup', 'POST', {})) as Row;
    } else {
      const input = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(body);
      auth = (await new SupabaseGateway(null).request(
        '/auth/v1/token?grant_type=password',
        'POST',
        input,
      )) as Row;
    }
    const accessToken = text(auth.access_token);
    if (!accessToken) throw new ApiError(401, 'تعذر إنشاء جلسة؛ راجع إعدادات Supabase Auth');
    const signed = new SupabaseGateway(accessToken);
    if (endpoint === 'auth/mock') await signed.edge('mock-identity', {});
    const user = await signed.profile();
    if (endpoint === 'auth/staff')
      requireAccount(user, ['district_agent', 'district_manager', 'moderator', 'platform_admin']);
    const response = json({ user, token: accessToken });
    response.cookies.set('balaa_session', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: Number(auth.expires_in) || 3600,
    });
    return response;
  }
  if (method === 'POST' && endpoint === 'auth/logout') {
    if (token) await client.request('/auth/v1/logout', 'POST');
    const response = json({ ok: true });
    response.cookies.delete('balaa_session');
    return response;
  }
  if (method === 'GET' && endpoint === 'categories') {
    const list = await client.read('categories');
    return json({
      categories: list.map((c) => ({
        id: c.slug,
        labelAr: c.name_ar,
        labelEn: c.name_en,
        icon: 'circle',
        active: c.active,
      })),
    });
  }
  if (method === 'GET' && endpoint === 'public/reports')
    return json({ reports: await reports(new SupabaseGateway(null), 'public', null) });
  if (method === 'GET' && path[0] === 'public' && path[1] === 'reports' && path[2]) {
    const report = (await reports(new SupabaseGateway(null), 'public', null, path[2]))[0];
    if (!report) throw new ApiError(404, 'البلاغ غير منشور');
    return json({ report });
  }
  if (method === 'POST' && endpoint === 'geo') {
    const point = coordinateSchema.parse(body);
    const result = (await client.rpc('resolve_district', {
      lng: point.longitude,
      lat: point.latitude,
    })) as Row;
    return json({
      district: { id: result.slug, nameAr: result.name_ar, nameEn: result.name_en },
      dataset: result.is_synthetic ? 'synthetic-demo' : 'configured',
    });
  }
  if (method === 'GET' && path[0] === 'media' && path[1]?.startsWith('public_')) {
    const id = idSchema.parse(path[1].slice(7));
    const publicClient = new SupabaseGateway(null);
    let image = (await publicClient.read('public_report_images', { id: `eq.${id}` }))[0];
    let imageClient = publicClient;
    if (!image && token) {
      image = (await client.read('district_report_images', { id: `eq.${id}` }))[0];
      imageClient = client;
    }
    if (!image) throw new ApiError(404, 'الصورة غير منشورة');
    const signed = (await imageClient.request(
      `/storage/v1/object/sign/report-derivatives/${text(image.public_path)}`,
      'POST',
      { expiresIn: 60 },
    )) as Row;
    const signedUrl = text(signed.signedURL) || text(signed.signedUrl);
    if (!signedUrl) throw new ApiError(503, 'تعذر توقيع رابط الصورة');
    return NextResponse.redirect(`${publicClient.base}/storage/v1${signedUrl}`, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  const user = await client.profile();
  if (method === 'GET' && endpoint === 'auth/session') return json({ user });
  if (method === 'GET' && endpoint === 'me/reports') {
    requireAccount(user);
    return json({ reports: await reports(client, 'own', user) });
  }
  if (method === 'POST' && endpoint === 'media') {
    const actor = requireAccount(user);
    const photo = await normalizedPhoto(body);
    requireAccount(
      user,
      photo.kind === 'before'
        ? ['citizen']
        : ['district_agent', 'district_manager', 'platform_admin'],
    );
    await client.rpc('authorize_media_upload', {});
    const id = randomUUID();
    await client.upload('report-originals', `${actor.id}/${id}.jpg`, photo.bytes);
    return json({ imageUrl: `/api/media/upload_${actor.id}_${id}` }, 201);
  }
  if (method === 'GET' && path[0] === 'media' && path[1]) {
    const actor = requireAccount(user);
    let storagePath: string;
    if (path[1].startsWith('upload_'))
      storagePath = originalPath(`/api/media/${path[1]}`, actor.id);
    else if (path[1].startsWith('private_')) {
      const image = (
        await client.read('report_images', { id: `eq.${idSchema.parse(path[1].slice(8))}` })
      )[0];
      if (!image) throw new ApiError(404, 'الصورة غير متاحة');
      storagePath = text(image.original_path);
    } else throw new ApiError(404, 'الصورة غير متاحة');
    return new NextResponse(new Uint8Array(await client.image('report-originals', storagePath)), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' },
    });
  }
  if (method === 'POST' && endpoint === 'reports/duplicates') {
    requireAccount(user, ['citizen']);
    const input = coordinateSchema.extend({ categoryId: z.string().max(80) }).parse(body);
    const matches = rows(
      await client.edge('reports', {
        action: 'duplicates',
        category_slug: input.categoryId,
        lng: input.longitude,
        lat: input.latitude,
      }),
    );
    const matching = await Promise.all(
      matches.map((m) => reports(client, 'public', null, text(m.id))),
    );
    return json({ reports: matching.flat() });
  }
  if (method === 'POST' && endpoint === 'reports') {
    const actor = requireAccount(user, ['citizen']);
    const input = reportInputSchema.parse(body);
    const created = (await client.edge('reports', {
      action: 'submit',
      input: {
        category_slug: input.categoryId,
        description: input.description,
        severity: input.severity,
        latitude: input.latitude,
        longitude: input.longitude,
        captured_latitude: input.capturedLatitude ?? input.latitude,
        captured_longitude: input.capturedLongitude ?? input.longitude,
        gps_accuracy: input.gpsAccuracy,
        captured_at: input.capturedAt,
        device_timestamp: input.deviceTimestamp || input.capturedAt,
        original_path: originalPath(input.imageUrl, actor.id),
      },
    })) as Row;
    return json({ report: await reportResult(client, text(created.id), user) }, 201);
  }
  if (method === 'POST' && path[0] === 'reports' && path[1] && path[2] === 'confirm') {
    requireAccount(user, ['citizen']);
    await client.edge('reports', { action: 'confirm', report_id: idSchema.parse(path[1]) });
    return json({ report: await reportResult(client, path[1], user) });
  }
  if (method === 'GET' && endpoint === 'dashboard/reports') {
    requireAccount(user, ['district_agent', 'district_manager', 'platform_admin']);
    return json({ reports: await reports(client, 'district', user) });
  }
  if (method === 'POST' && path[0] === 'dashboard' && path[1] === 'reports' && path[2]) {
    const actor = requireAccount(user, ['district_agent', 'district_manager', 'platform_admin']);
    const id = idSchema.parse(path[2]);
    if (path[3] === 'notes') {
      const { note } = z.object({ note: z.string().trim().min(1).max(1000) }).parse(body);
      await client.edge('reports', { action: 'note', report_id: id, note });
      return json({ ok: true });
    }
    if (path[3] === 'status') {
      const input = transitionSchema.parse(body);
      let resolutionId: string | undefined;
      if (input.status === 'resolved') {
        if (!input.imageUrl) throw new ApiError(400, 'صورة وملاحظة الحل مطلوبتان');
        const approvedId = input.imageUrl.startsWith('/api/media/public_')
          ? idSchema.parse(input.imageUrl.slice('/api/media/public_'.length))
          : undefined;
        const objectPath = approvedId ? '' : originalPath(input.imageUrl, actor.id);
        const known = approvedId
          ? (
              await client.read('district_report_images', {
                id: `eq.${approvedId}`,
                report_id: `eq.${id}`,
              })
            )[0]
          : (
              await client.read('report_images', {
                original_path: `eq.${objectPath}`,
                report_id: `eq.${id}`,
              })
            )[0];
        if (approvedId && !known) throw new ApiError(403, 'صورة المعالجة غير مصرح بها');
        resolutionId = known
          ? text(known.id)
          : text(
              await client.edge('reports', {
                action: 'register_image',
                report_id: id,
                object_path: objectPath,
              }),
            );
        if (!known || known.moderation_status !== 'safe')
          throw new ApiError(
            409,
            'تم تسجيل صورة المعالجة. يجب أن يراجعها مراجع المحتوى أولًا، ثم أعد تأكيد الحل بنفس الصورة.',
          );
      }
      await client.edge('reports', {
        action: 'transition',
        report_id: id,
        new_status: input.status,
        note: input.note,
        ...(resolutionId ? { resolution_image_id: resolutionId } : {}),
        ...(input.duplicateOf ? { duplicate_of: idSchema.parse(input.duplicateOf) } : {}),
      });
      return json({ report: await reportResult(client, id, user) });
    }
  }
  if (method === 'GET' && endpoint === 'moderation') {
    requireAccount(user, ['moderator', 'platform_admin']);
    return json({ reports: await reports(client, 'moderation', user) });
  }
  if (method === 'POST' && path[0] === 'moderation' && path[1]) {
    requireAccount(user, ['moderator', 'platform_admin']);
    const input = z
      .object({
        decision: z.enum(['safe', 'flagged', 'blocked']),
        note: z.string().trim().min(3).max(1000),
        redactionConfirmed: z.boolean().default(false),
      })
      .parse(body);
    const id = idSchema.parse(path[1]);
    if (input.decision === 'safe' && !input.redactionConfirmed)
      throw new ApiError(
        400,
        'أكد مراجعة الصور وخلوها من الوجوه واللوحات والبيانات الشخصية قبل النشر',
      );
    const images = await client.read('report_images', { report_id: `eq.${id}` });
    for (const image of images) {
      let derivativePath: string | undefined;
      if (input.decision === 'safe') {
        if (image.moderation_status === 'safe' && image.public_path) continue;
        const original = await client.image('report-originals', text(image.original_path));
        const derivative = await sharp(original, { limitInputPixels: 24000000 })
          .rotate()
          .jpeg({ quality: 82 })
          .toBuffer();
        derivativePath = `${id}/${randomUUID()}.jpg`;
        await client.upload('report-derivatives', derivativePath, derivative);
      }
      await client.edge('reports', {
        action: 'moderate_image',
        image_id: image.id,
        decision: input.decision,
        note: input.note,
        ...(derivativePath ? { derivative_path: derivativePath, redaction_confirmed: true } : {}),
      });
    }
    await client.edge('reports', {
      action: 'moderate_report',
      report_id: id,
      decision: input.decision,
      note: input.note,
    });
    if (user?.role === 'platform_admin') await client.edge('test-notifications', {});
    return json({ ok: true });
  }
  if (method === 'GET' && endpoint === 'admin/outbox') {
    requireAccount(user, ['platform_admin']);
    const list = await client.read('email_deliveries', { order: 'created_at.desc' });
    return json({
      notifications: list.map((n) => ({
        id: n.id,
        reportId: (n.body as Row)?.public_id,
        to: n.recipient,
        subject: n.subject,
        createdAt: n.created_at,
        status: 'test_captured',
      })),
    });
  }
  if (method === 'POST' && endpoint === 'admin/outbox/process') {
    requireAccount(user, ['platform_admin']);
    return json({ processed: await client.edge('test-notifications', {}) });
  }
  if (method === 'POST' && endpoint === 'admin/categories') {
    requireAccount(user, ['platform_admin']);
    const input = categorySchema.parse(body);
    const id = input.id || `category-${randomUUID().slice(0, 8)}`;
    await client.rpc('upsert_category', {
      category_slug: id,
      arabic_label: input.labelAr,
      english_label: input.labelEn,
      enabled: input.active,
    });
    return json({ category: { ...input, id } });
  }
  if (method === 'GET' && endpoint === 'admin/abuse') {
    requireAccount(user, ['platform_admin']);
    const list = await client.read('abuse_review_summary');
    return json({
      accounts: list.map((a) => ({
        id: a.user_id,
        suspendedUntil: a.suspended_until,
        submitted: Number(a.reports_submitted),
        rejected: Number(a.reports_rejected),
        flagged: Number(a.flagged_submissions),
        strikes: a.abuse_strikes,
      })),
    });
  }
  if (method === 'POST' && endpoint === 'admin/abuse') {
    requireAccount(user, ['platform_admin']);
    const input = z
      .object({
        userId: z.uuid(),
        hours: z.number().int().min(0).max(168),
        note: z.string().trim().min(3).max(500),
      })
      .parse(body);
    await client.rpc('review_abuse', {
      member_id: input.userId,
      until_time: input.hours ? new Date(Date.now() + input.hours * 3600000).toISOString() : null,
      reason: input.note,
    });
    return json({ ok: true });
  }
  throw new ApiError(404, 'Endpoint not found');
}
