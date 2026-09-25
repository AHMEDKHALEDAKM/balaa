import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initialCategories } from '@balaa/config';
import type {
  Category,
  HistoryEntry,
  ModerationStatus,
  ReportInput,
  ReportStatus,
  Role,
  User,
} from '@balaa/types';

export interface StoredReport extends ReportInput {
  id: string;
  publicId: string;
  userId: string;
  districtId: string;
  districtName: string;
  status: ReportStatus;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
  confirmationUserIds: string[];
  resolutionImageUrl?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  acknowledgedAt?: string;
  duplicateOf?: string;
  internalNotes: { note: string; actorId: string; createdAt: string }[];
}
export interface Session {
  hash: string;
  userId: string;
  expiresAt: string;
}
export interface Media {
  id: string;
  ownerId: string;
  kind: 'before' | 'resolution';
  data: string;
  createdAt: string;
  reportId?: string;
}
export interface Outbox {
  id: string;
  reportId: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  status: 'test_captured';
}
export interface Audit {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  createdAt: string;
  detail?: string;
}
export interface State {
  version: 1;
  sequence: number;
  users: User[];
  sessions: Session[];
  reports: StoredReport[];
  categories: Category[];
  media: Media[];
  notifications: Outbox[];
  audit: Audit[];
  rateLimits: Record<string, { started: number; count: number }>;
  identityVerifications: { userId: string; provider: string; mode: string; verifiedAt: string }[];
}
export const dataDirectory = () => process.env.BALAA_DATA_DIR || path.join(process.cwd(), '.balaa');
function seed(): State {
  const now = Date.now();
  const reports: StoredReport[] = [];
  const fixtures: {
    categoryId: string;
    status: ReportStatus;
    latitude: number;
    longitude: number;
    severity: StoredReport['severity'];
    districtId: string;
    description: string;
  }[] = [
    {
      categoryId: 'manhole',
      status: 'in_progress',
      latitude: 29.9622,
      longitude: 31.2611,
      severity: 'critical',
      districtId: 'maadi',
      description: 'غطاء بلاعة مكسور بجوار الرصيف — بلاغ توضيحي',
    },
    {
      categoryId: 'pothole',
      status: 'delivered',
      latitude: 29.9584,
      longitude: 31.2574,
      severity: 'dangerous',
      districtId: 'maadi',
      description: 'حفرة تحتاج إلى إصلاح — بيانات تجريبية',
    },
    {
      categoryId: 'lighting',
      status: 'acknowledged',
      latitude: 29.966,
      longitude: 31.269,
      severity: 'normal',
      districtId: 'maadi',
      description: 'عمود إنارة لا يعمل — بيانات تجريبية',
    },
    {
      categoryId: 'pavement',
      status: 'resolved',
      latitude: 29.953,
      longitude: 31.264,
      severity: 'normal',
      districtId: 'maadi',
      description: 'جزء من الرصيف يحتاج إصلاحًا — بيانات تجريبية',
    },
    {
      categoryId: 'waste',
      status: 'delivered',
      latitude: 30.055,
      longitude: 31.345,
      severity: 'normal',
      districtId: 'nasr-city',
      description: 'مخلفات بجوار الطريق — بيانات تجريبية',
    },
    {
      categoryId: 'water',
      status: 'under_review',
      latitude: 29.957,
      longitude: 31.271,
      severity: 'dangerous',
      districtId: 'maadi',
      description: '[flag] بلاغ توضيحي ينتظر المراجعة',
    },
  ];
  fixtures.forEach((f, i) => {
    const createdAt = new Date(now - (i + 1) * 3600000).toISOString();
    const history: HistoryEntry[] = [{ status: 'submitted', createdAt }];
    if (f.status !== 'under_review') {
      history.push({ status: 'delivered', createdAt, note: 'تم حفظ إشعار في صندوق الاختبار فقط' });
      if (['acknowledged', 'in_progress', 'resolved'].includes(f.status))
        history.push({ status: 'acknowledged', createdAt });
      if (['in_progress', 'resolved'].includes(f.status))
        history.push({ status: 'in_progress', createdAt });
      if (f.status === 'resolved')
        history.push({ status: 'resolved', createdAt, note: 'تم إصلاح الرصيف في العرض التجريبي' });
    } else history.push({ status: 'under_review', createdAt });
    reports.push({
      ...f,
      id: `demo-report-${i + 1}`,
      publicId: `BLAA-${String(124 + i).padStart(6, '0')}`,
      userId: 'demo-citizen',
      districtName: f.districtId === 'maadi' ? 'المعادي' : 'مدينة نصر',
      moderationStatus: f.status === 'under_review' ? 'flagged' : 'safe',
      createdAt,
      updatedAt: createdAt,
      capturedAt: createdAt,
      deviceTimestamp: createdAt,
      gpsAccuracy: 12,
      imageUrl: '/demo-road.svg',
      history,
      confirmationUserIds: [],
      internalNotes: [],
      ...(f.status === 'resolved'
        ? {
            resolutionImageUrl: '/demo-resolved.svg',
            resolutionNote: 'تم إصلاح الرصيف في العرض التجريبي',
            resolvedAt: createdAt,
            resolvedBy: 'demo-district_agent',
          }
        : {}),
    });
  });
  const staff = (role: Role): User => ({
    id: `demo-${role}`,
    role,
    verified: true,
    districtIds: ['district_agent', 'district_manager'].includes(role) ? ['maadi'] : [],
  });
  return {
    version: 1,
    sequence: 129,
    users: [
      { id: 'demo-citizen', role: 'citizen', verified: true, districtIds: [] },
      staff('district_agent'),
      staff('district_manager'),
      staff('moderator'),
      staff('platform_admin'),
    ],
    sessions: [],
    reports,
    categories: initialCategories.map((c) => ({ ...c })),
    media: [],
    notifications: [],
    audit: [],
    rateLimits: {},
    identityVerifications: [],
  };
}
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
export function audit(
  state: State,
  actorId: string,
  action: string,
  targetId: string,
  detail?: string,
) {
  state.audit.push({
    id: randomUUID(),
    actorId,
    action,
    targetId,
    detail,
    createdAt: new Date().toISOString(),
  });
}
