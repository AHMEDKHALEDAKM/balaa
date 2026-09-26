'use client';
import { useLocale } from '@balaa/ui/locale';

import { ArrowUpLeft, MapPin, Users, CircleAlert, Construction } from 'lucide-react';
import { Report, statuses } from './model';
export function StatusBadge({ status }: { status: Report['status'] }) {
  const { t } = useLocale();
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {t(statuses[status])}
    </span>
  );
}
export function ReportCard({
  report,
  onSelect,
}: {
  report: Report;
  onSelect: (report: Report) => void;
}) {
  const { t, bilingual, number } = useLocale();
  return (
    <button className="report-card" onClick={() => onSelect(report)}>
      <div className="report-card-image">
        <img src={report.imageUrl} alt={bilingual(report.categoryLabel, report.categoryLabelEn)} />
        <StatusBadge status={report.status} />
        {report.severity === 'critical' && (
          <span className="urgency">
            <CircleAlert size={13} />
            {t('خطر فوري')}
          </span>
        )}
      </div>
      <div className="report-card-body">
        <span className="small-code" dir="ltr">
          {report.publicId}
        </span>
        <h3>{bilingual(report.categoryLabel, report.categoryLabelEn)}</h3>
        <p>
          <MapPin size={14} />
          {bilingual(report.districtName, report.districtNameEn)}
          {t('، القاهرة')}
        </p>
        <div className="report-card-footer">
          <span>
            <Users size={15} />
            {number(report.confirmationCount)} {t('تأكيد للمشكلة')}
          </span>
          <span className="card-arrow">
            <ArrowUpLeft size={18} />
          </span>
        </div>
      </div>
    </button>
  );
}
export function EmptyState({
  title = 'لا توجد بلاغات هنا بعد',
  description = 'ستظهر البلاغات في هذه المساحة عندما تصبح متاحة.',
}: {
  title?: string;
  description?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="empty-state">
      <Construction size={30} />
      <h3>{t(title)}</h3>
      <p>{t(description)}</p>
    </div>
  );
}
