import { z } from 'zod';
export const statuses = [
  'submitted',
  'delivered',
  'acknowledged',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate',
  'under_review',
] as const;
export type ReportStatus = (typeof statuses)[number];
export const moderationStates = ['pending', 'safe', 'flagged', 'blocked'] as const;
export type ModerationStatus = (typeof moderationStates)[number];
export type Role =
  'guest' | 'citizen' | 'district_agent' | 'district_manager' | 'moderator' | 'platform_admin';
export type Severity = 'normal' | 'dangerous' | 'critical';
export interface User {
  id: string;
  role: Role;
  verified: boolean;
  districtIds: string[];
  suspendedUntil?: string;
}
export interface Category {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  active: boolean;
}
export interface HistoryEntry {
  status: ReportStatus;
  note?: string;
  createdAt: string;
}
export interface PublicReport {
  id: string;
  publicId: string;
  categoryId: string;
  categoryLabel: string;
  categoryLabelEn?: string;
  districtId: string;
  districtName: string;
  districtNameEn?: string;
  status: ReportStatus;
  moderationStatus: ModerationStatus;
  severity: Severity;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  resolutionImageUrl?: string;
  resolutionNote?: string;
  createdAt: string;
  confirmationCount: number;
  history: HistoryEntry[];
  identityVerified?: boolean;
}
export const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const reportInputSchema = coordinateSchema
  .extend({
    categoryId: z.string().min(1).max(80),
    severity: z.enum(['normal', 'dangerous', 'critical']),
    description: z.string().trim().max(500).default(''),
    capturedLatitude: z.number().finite().min(-90).max(90).optional(),
    capturedLongitude: z.number().finite().min(-180).max(180).optional(),
    gpsAccuracy: z.number().finite().gt(0).max(200),
    capturedAt: z.iso.datetime(),
    deviceTimestamp: z.iso.datetime().optional(),
    imageUrl: z.string().startsWith('/api/media/').max(200),
  })
  .strict();
export type ReportInput = z.infer<typeof reportInputSchema>;
export const transitionSchema = z
  .object({
    status: z.enum(statuses),
    note: z.string().trim().min(3).max(1000),
    imageUrl: z.string().startsWith('/api/media/').max(200).optional(),
    duplicateOf: z.string().max(80).optional(),
  })
  .strict();
export const categorySchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80)
      .optional(),
    labelAr: z.string().trim().min(2).max(80),
    labelEn: z.string().trim().min(2).max(80),
    icon: z.string().max(30).default('circle'),
    active: z.boolean().default(true),
  })
  .strict();
export const statusLabels: Record<ReportStatus, string> = {
  submitted: 'تم الإبلاغ',
  delivered: 'وصل لصندوق الاختبار',
  acknowledged: 'تم الاستلام',
  in_progress: 'جارٍ العمل',
  resolved: 'تم الحل',
  rejected: 'مرفوض',
  duplicate: 'بلاغ مكرر',
  under_review: 'تحت المراجعة',
};
export const allowedTransitions: Record<ReportStatus, readonly ReportStatus[]> = {
  submitted: ['delivered', 'acknowledged', 'rejected', 'duplicate', 'under_review'],
  delivered: ['acknowledged', 'rejected', 'duplicate', 'under_review'],
  acknowledged: ['in_progress', 'rejected', 'duplicate', 'under_review'],
  in_progress: ['resolved', 'rejected', 'duplicate', 'under_review'],
  under_review: ['submitted', 'rejected'],
  resolved: [],
  rejected: [],
  duplicate: [],
};
export const openStatuses: readonly ReportStatus[] = [
  'submitted',
  'delivered',
  'acknowledged',
  'in_progress',
];
export function canTransition(from: ReportStatus, to: ReportStatus) {
  return allowedTransitions[from].includes(to);
}
