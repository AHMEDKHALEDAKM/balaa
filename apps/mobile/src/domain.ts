export type Severity = 'normal' | 'dangerous' | 'critical';
export type Screen =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'map'
  | 'auth'
  | 'camera'
  | 'location'
  | 'details'
  | 'review'
  | 'duplicates'
  | 'submitted'
  | 'my-reports'
  | 'report';
export type Status =
  | 'submitted'
  | 'delivered'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'duplicate'
  | 'under_review';

export interface Category {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
}
export interface District {
  id: string;
  nameAr: string;
  nameEn: string;
}
export interface User {
  id: string;
  role: string;
  verified: boolean;
  districtIds: string[];
}
export interface Session {
  token: string;
  user: User;
}
export interface PublicReport {
  id: string;
  publicId: string;
  categoryId: string;
  categoryLabel: string;
  districtId: string;
  districtName: string;
  status: Status;
  moderationStatus: string;
  severity: Severity;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  resolutionImageUrl?: string;
  resolutionNote?: string;
  createdAt: string;
  confirmationCount: number;
  history: { status: Status; note?: string; createdAt: string }[];
}
export interface CaptureLocation {
  latitude: number;
  longitude: number;
  gpsAccuracy: number;
  capturedAt: string;
  deviceTimestamp: string;
}
export interface Draft {
  photoUri: string;
  dataUrl: string;
  location: CaptureLocation | null;
  origin: { latitude: number; longitude: number } | null;
  district: District | null;
  categoryId: string;
  severity: Severity;
  description: string;
  syntheticLocation: boolean;
  fixturePhoto: boolean;
}

export const emptyDraft = (): Draft => ({
  photoUri: '',
  dataUrl: '',
  location: null,
  origin: null,
  district: null,
  categoryId: '',
  severity: 'normal',
  description: '',
  syntheticLocation: false,
  fixturePhoto: false,
});
export const statusLabels: Record<Status, string> = {
  submitted: 'تم الإبلاغ',
  delivered: 'أُرسل لصندوق الاختبار',
  acknowledged: 'تم الاستلام',
  in_progress: 'جارٍ العمل',
  resolved: 'تم الحل',
  rejected: 'مرفوض',
  duplicate: 'بلاغ مكرر',
  under_review: 'تحت المراجعة',
};
export const severityLabels: Record<Severity, string> = {
  normal: 'عادية',
  dangerous: 'خطرة',
  critical: 'خطر فوري',
};

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
