import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { identityProvider, DemoModerationProvider, notificationProvider } from '@balaa/config';
import { distanceMeters, publicCoordinate, resolveDistrict, demoBoundaries } from '@balaa/geo';
import {
  canTransition,
  openStatuses,
  reportInputSchema,
  transitionSchema,
  type PublicReport,
  type ReportStatus,
  type Role,
  type User,
} from '@balaa/types';
import { audit, type State, type StoredReport } from './store';
import districtContacts from '../../../../data/cairo-district-contacts.json';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireUser(user: User | null): User {
  if (!user) throw new ApiError(401, 'سجّل الدخول أولًا');
  return user;
}
export function requireRole(user: User | null, roles: Role[]): User {
  const actual = requireUser(user);
  if (!roles.includes(actual.role)) throw new ApiError(403, 'غير مصرح بهذه العملية');
  return actual;
}
export function canManage(user: User, report: StoredReport) {
  return (
    user.role === 'platform_admin' ||
    (['district_agent', 'district_manager'].includes(user.role) &&
      user.districtIds.includes(report.districtId))
  );
}
export function canRead(user: User | null, report: StoredReport) {
  return (
    report.moderationStatus === 'safe' ||
    (!!user && (report.userId === user.id || canManage(user, report) || user.role === 'moderator'))
  );
}
export function dto(state: State, report: StoredReport, staff = false): PublicReport {
  return {
    id: report.id,
    publicId: report.publicId,
    categoryId: report.categoryId,
    categoryLabel:
      state.categories.find((c) => c.id === report.categoryId)?.labelAr || report.categoryId,
    categoryLabelEn: state.categories.find((c) => c.id === report.categoryId)?.labelEn,
    districtNameEn: demoBoundaries.find((d) => d.id === report.districtId)?.nameEn,
    districtId: report.districtId,
    districtName: report.districtName,
    status: report.status,
    moderationStatus: report.moderationStatus,
    severity: report.severity,
    description: report.description,
    latitude: staff ? report.latitude : publicCoordinate(report.latitude),
    longitude: staff ? report.longitude : publicCoordinate(report.longitude),
    imageUrl: report.imageUrl,
    resolutionImageUrl: report.resolutionImageUrl,
    resolutionNote: report.resolutionNote,
    createdAt: report.createdAt,
    confirmationCount: report.confirmationUserIds.length,
    history: report.history.map((h) => ({ status: h.status, createdAt: h.createdAt })),
    ...(staff ? { identityVerified: true } : {}),
  };
}
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function sessionUser(state: State, token: string | null) {
  if (!token) return null;
  const session = state.sessions.find(
    (s) => s.hash === hashToken(token) && Date.parse(s.expiresAt) > Date.now(),
  );
  return session ? state.users.find((u) => u.id === session.userId) || null : null;
}
export function issueSession(state: State, user: User) {
  const token = randomBytes(32).toString('base64url');
  state.sessions = state.sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
  state.sessions.push({
    hash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  return { user, token };
}
export async function mockLogin(state: State, current: User | null) {
  const user: User =
    current?.role === 'citizen'
      ? current
      : { id: randomUUID(), role: 'citizen', verified: true, districtIds: [] };
  const result = await identityProvider(process.env.AUTH_PROVIDER).verify(user.id);
  if (!state.users.some((u) => u.id === user.id)) state.users.push(user);
  state.identityVerifications.push({
    userId: user.id,
    provider: result.provider,
    mode: result.verificationMode,
    verifiedAt: new Date().toISOString(),
  });
  audit(state, user.id, 'identity.mock_verified', user.id);
  return issueSession(state, user);
}
export function rateLimit(state: State, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  let bucket = state.rateLimits[key];
  if (!bucket || now - bucket.started >= windowMs)
    bucket = state.rateLimits[key] = { started: now, count: 0 };
  if (bucket.count >= limit) throw new ApiError(429, 'طلبات كثيرة. حاول لاحقًا');
  bucket.count++;
}
export function findReport(state: State, id: string) {
  const report = state.reports.find((r) => r.id === id || r.publicId === id);
  if (!report) throw new ApiError(404, 'البلاغ غير موجود');
  return report;
}
export function duplicateReports(
  state: State,
  input: { latitude: number; longitude: number; categoryId: string },
) {
  return state.reports.filter(
    (r) =>
      r.moderationStatus === 'safe' &&
      r.categoryId === input.categoryId &&
      openStatuses.includes(r.status) &&
      distanceMeters(r, input) <= 30,
  );
}
function verifiedCitizen(user: User | null) {
  const actual = requireRole(user, ['citizen']);
  if (!actual.verified) throw new ApiError(403, 'التحقق من الهوية مطلوب');
  if (actual.suspendedUntil && Date.parse(actual.suspendedUntil) > Date.now())
    throw new ApiError(403, 'الإبلاغ موقوف مؤقتًا لحين المراجعة');
  return actual;
}
function ownMedia(state: State, url: string, userId: string, kind: 'before' | 'resolution') {
  const id = url.split('/').pop();
  const media = state.media.find(
    (m) => m.id === id && m.ownerId === userId && m.kind === kind && !m.reportId,
  );
  if (!media) throw new ApiError(400, 'ارفع صورة جديدة من حسابك لهذا البلاغ');
  return media;
}
async function notify(state: State, report: StoredReport) {
  if (report.moderationStatus !== 'safe') return;
  const endpoint = districtContacts.districts
    .find((d) => d.districtSlug === report.districtId)
    ?.endpoints.find((e) => e.type === 'primary' && e.enabled);
  if (!endpoint) throw new ApiError(422, 'لم يتم إعداد نقطة إشعار لهذا الحي');
  const provider = notificationProvider(process.env.EMAIL_MODE, process.env.TEST_INBOX);
  const category = state.categories.find((c) => c.id === report.categoryId)?.labelAr || '';
  const subject = `[Balaa Demo] ${report.publicId} — ${category} — ${report.districtName}`;
  const body = `${report.publicId}\n${category}\n${report.severity}\n${report.districtName}\n${report.capturedAt}\nالموقع العام: ${publicCoordinate(report.latitude)}, ${publicCoordinate(report.longitude)}\n/api/public/reports/${report.id}\n${report.imageUrl}\nنسخة تجريبية — لم يتم الاتصال بأي جهة حكومية.`;
  const delivered = await provider.send({ reportId: report.id, to: endpoint.email, subject, body });
  state.notifications.push({
    id: randomUUID(),
    reportId: report.id,
    to: delivered.destination,
    subject,
    body,
    createdAt: new Date().toISOString(),
    status: delivered.status,
  });
  audit(state, 'system', 'notification.test_captured', report.id);
}
function setStatus(
  state: State,
  report: StoredReport,
  status: ReportStatus,
  actorId: string,
  note?: string,
) {
  const now = new Date().toISOString();
  report.status = status;
  report.updatedAt = now;
  report.history.push({ status, note, createdAt: now });
  if (status === 'acknowledged') report.acknowledgedAt = now;
  audit(state, actorId, `report.${status}`, report.id, note);
}
export async function submitReport(state: State, user: User | null, body: unknown) {
  const citizen = verifiedCitizen(user);
  const input = reportInputSchema.parse(body);
  if ((input.capturedLatitude === undefined) !== (input.capturedLongitude === undefined))
    throw new ApiError(400, 'Both original coordinates are required');
  if (
    input.capturedLatitude !== undefined &&
    input.capturedLongitude !== undefined &&
    distanceMeters(input, {
      latitude: input.capturedLatitude,
      longitude: input.capturedLongitude,
    }) > 50
  )
    throw new ApiError(400, 'Pin adjustment exceeds 50 meters');
  const capture = Date.parse(input.capturedAt);
  if (capture > Date.now() + 300000 || capture < Date.now() - 86400000)
    throw new ApiError(400, 'الصورة يجب أن تكون ملتقطة خلال آخر 24 ساعة');
  if (!state.categories.some((c) => c.id === input.categoryId && c.active))
    throw new ApiError(400, 'تصنيف غير متاح');
  const district = resolveDistrict(input.latitude, input.longitude);
  if (!district) throw new ApiError(422, 'الموقع خارج حدود العرض التجريبي أو يحتاج مراجعة');
  const media = ownMedia(state, input.imageUrl, citizen.id, 'before');
  rateLimit(state, `reports:${citizen.id}`, 10, 3600000);
  const moderation = await new DemoModerationProvider().review(input);
  const now = new Date().toISOString();
  const report: StoredReport = {
    ...input,
    id: randomUUID(),
    publicId: `BLAA-${String(++state.sequence).padStart(6, '0')}`,
    userId: citizen.id,
    districtId: district.id,
    districtName: district.nameAr,
    status: 'submitted',
    moderationStatus: moderation.state,
    createdAt: now,
    updatedAt: now,
    history: [{ status: 'submitted', createdAt: now }],
    confirmationUserIds: [],
    internalNotes: [],
  };
  media.reportId = report.id;
  state.reports.unshift(report);
  audit(state, citizen.id, 'report.created', report.id);
  audit(state, 'system', `moderation.${moderation.state}`, report.id, moderation.reason);
  if (report.moderationStatus === 'safe') {
    await notify(state, report);
    setStatus(state, report, 'delivered', 'system', 'تم حفظ إشعار تجريبي؛ لم يُرسل لأي جهة حكومية');
  } else setStatus(state, report, 'under_review', 'system');
  return dto(state, report);
}
export function confirmReport(state: State, user: User | null, id: string) {
  const citizen = verifiedCitizen(user);
  const report = findReport(state, id);
  if (report.moderationStatus !== 'safe' || !openStatuses.includes(report.status))
    throw new ApiError(409, 'يمكن تأكيد البلاغات العامة المفتوحة فقط');
  if (report.userId === citizen.id) throw new ApiError(409, 'هذا بلاغك بالفعل');
  if (!report.confirmationUserIds.includes(citizen.id)) {
    report.confirmationUserIds.push(citizen.id);
    audit(state, citizen.id, 'report.confirmed', report.id);
  }
  return dto(state, report);
}
export async function transitionReport(state: State, user: User | null, id: string, body: unknown) {
  const actor = requireUser(user);
  const report = findReport(state, id);
  if (!canManage(actor, report)) throw new ApiError(403, 'البلاغ خارج الأحياء المصرح لك بها');
  if (report.moderationStatus !== 'safe') throw new ApiError(409, 'يجب مراجعة المحتوى أولًا');
  const input = transitionSchema.parse(body);
  if (
    !canTransition(report.status, input.status) ||
    ['submitted', 'delivered', 'under_review'].includes(input.status)
  )
    throw new ApiError(409, 'انتقال حالة غير مسموح');
  if (input.status === 'resolved') {
    if (!input.imageUrl) throw new ApiError(400, 'ملاحظة وصورة بعد الإصلاح مطلوبتان');
    const media = ownMedia(state, input.imageUrl, actor.id, 'resolution');
    const moderation = await new DemoModerationProvider().review({
      description: input.note,
      imageUrl: input.imageUrl,
    });
    if (moderation.state !== 'safe')
      throw new ApiError(422, 'دليل الحل يحتاج مراجعة؛ لم يتغير البلاغ');
    media.reportId = report.id;
    report.resolutionImageUrl = input.imageUrl;
    report.resolutionNote = input.note;
    report.resolvedAt = new Date().toISOString();
    report.resolvedBy = actor.id;
  }
  if (input.status === 'duplicate') {
    if (!input.duplicateOf || input.duplicateOf === id)
      throw new ApiError(400, 'اختر البلاغ الأصلي');
    const target = findReport(state, input.duplicateOf);
    if (
      target.id === report.id ||
      target.categoryId !== report.categoryId ||
      target.moderationStatus !== 'safe' ||
      target.districtId !== report.districtId ||
      !openStatuses.includes(target.status) ||
      distanceMeters(report, target) > 30
    )
      throw new ApiError(400, 'البلاغ الأصلي يجب أن يكون مفتوحًا وقريبًا ومن نفس التصنيف والحي');
    report.duplicateOf = target.id;
  }
  setStatus(state, report, input.status, actor.id, input.note);
  if (input.status === 'resolved') await notify(state, report);
  return dto(state, report, true);
}
export async function moderateReport(
  state: State,
  user: User | null,
  id: string,
  decision: 'safe' | 'flagged' | 'blocked',
  note: string,
) {
  const actor = requireRole(user, ['moderator', 'platform_admin']);
  const report = findReport(state, id);
  const previous = report.moderationStatus;
  report.moderationStatus = decision;
  audit(state, actor.id, `moderation.${decision}`, report.id, note);
  if (decision === 'safe' && previous !== 'safe' && report.status === 'under_review') {
    setStatus(state, report, 'submitted', actor.id);
    await notify(state, report);
    setStatus(state, report, 'delivered', 'system', 'إشعار في صندوق الاختبار فقط');
  } else if (decision !== 'safe' && openStatuses.includes(report.status))
    setStatus(state, report, 'under_review', actor.id);
  return dto(state, report, true);
}
