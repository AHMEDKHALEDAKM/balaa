export type Severity = 'normal' | 'dangerous' | 'critical';
export type Status =
  | 'submitted'
  | 'delivered'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'duplicate'
  | 'under_review';
export interface Report {
  id: string;
  publicId: string;
  categoryId: string;
  categoryLabel: string;
  categoryLabelEn?: string;
  districtId: string;
  districtName: string;
  districtNameEn?: string;
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
  identityVerified?: boolean;
  history: { status: Status; note?: string; createdAt: string }[];
}
export interface Category {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  active: boolean;
}
export interface User {
  id: string;
  role: string;
  verified: boolean;
  districtIds: string[];
}
export const statuses: Record<Status, string> = {
  submitted: 'تم الإبلاغ',
  delivered: 'تم الإرسال · تجريبي',
  acknowledged: 'تم الاستلام',
  in_progress: 'جاري العمل',
  resolved: 'تم الحل',
  rejected: 'مرفوض',
  duplicate: 'بلاغ مكرر',
  under_review: 'تحت المراجعة',
};
export const severities: Record<Severity, string> = {
  normal: 'عادية',
  dangerous: 'خطرة',
  critical: 'خطر فوري',
};
export const date = (value: string) =>
  new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(value),
  );
export const number = (value: number) => new Intl.NumberFormat('ar-EG').format(value);
/** True in the GitHub Pages build, where the demo runs entirely on the device. */
export const deviceDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === '1';
/** Prefixes a site path with the GitHub Pages sub-path (e.g. /balaa); a no-op elsewhere. */
export const withBase = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
export async function api<T>(url: string, body?: unknown): Promise<T> {
  if (deviceDemo) return (await import('./localApi')).localApi<T>(url, body);
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || data.message || 'تعذّر إتمام الطلب. حاول مرة أخرى.',
    );
  return data as T;
}
export async function fileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}
