'use client';
import { ArrowUpLeft, MapPin, Users, CircleAlert, Construction } from 'lucide-react';
import { Report, statuses, number } from './model';
export function StatusBadge({ status }: { status: Report['status'] }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {statuses[status]}
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
  return (
    <button className="report-card" onClick={() => onSelect(report)}>
      <div className="report-card-image">
        <img src={report.imageUrl} alt={report.categoryLabel} />
        <StatusBadge status={report.status} />
        {report.severity === 'critical' && (
          <span className="urgency">
            <CircleAlert size={13} />
            خطر فوري
          </span>
        )}
      </div>
      <div className="report-card-body">
        <span className="small-code" dir="ltr">
          {report.publicId}
        </span>
        <h3>{report.categoryLabel}</h3>
        <p>
          <MapPin size={14} />
          {report.districtName}، القاهرة
        </p>
        <div className="report-card-footer">
          <span>
            <Users size={15} />
            {number(report.confirmationCount)} تأكيد للمشكلة
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
  return (
    <div className="empty-state">
      <Construction size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
