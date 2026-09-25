'use client';
import { useState } from 'react';
import { X, MapPin, Users, ShieldCheck, Share2, Check, ArrowUpLeft } from 'lucide-react';
import { api, Report, User, statuses, severities, date, number } from './model';
import { StatusBadge } from './ReportCard';
import { useDialog } from './useDialog';
export default function ReportDetail({
  report,
  user,
  onClose,
  onUpdate,
}: {
  report: Report;
  user: User | null;
  onClose: () => void;
  onUpdate: () => void;
}) {
  useDialog(true, onClose);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/reports/${report.id}/confirm`, {});
      setMessage('تم تسجيل تأكيدك. شكرًا لمشاركتك.');
      onUpdate();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = `${location.origin}/reports/${report.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `بلاعة · ${report.publicId}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage('تم نسخ رابط البلاغ');
      }
    } catch {
      setMessage('تعذّرت المشاركة. رابط البلاغ: ' + url);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-top">
          <span className="eyebrow">تفاصيل البلاغ</span>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق">
            <X size={21} />
          </button>
        </div>
        <div className="detail-title">
          <div>
            <span className="small-code" dir="ltr">
              {report.publicId}
            </span>
            <h2 id="detail-title">{report.categoryLabel}</h2>
            <p>
              <MapPin size={16} />
              {report.districtName}، القاهرة
            </p>
          </div>
          <StatusBadge status={report.status} />
        </div>
        <div className={`evidence-grid ${report.resolutionImageUrl ? 'has-after' : ''}`}>
          <figure>
            <img src={report.imageUrl} alt="صورة المشكلة قبل الحل" />
            <figcaption>{report.resolutionImageUrl ? 'قبل المعالجة' : 'صورة البلاغ'}</figcaption>
          </figure>
          {report.resolutionImageUrl && (
            <figure>
              <img src={report.resolutionImageUrl} alt="صورة توثيق حل المشكلة" />
              <figcaption className="after">
                <Check size={14} />
                بعد المعالجة
              </figcaption>
            </figure>
          )}
        </div>
        <div className="detail-facts">
          <div>
            <span>تاريخ البلاغ</span>
            <strong>{date(report.createdAt)}</strong>
          </div>
          <div>
            <span>درجة الخطورة</span>
            <strong>{severities[report.severity]}</strong>
          </div>
          <div>
            <span>تأكيدات المواطنين</span>
            <strong>{number(report.confirmationCount)} تأكيد</strong>
          </div>
        </div>
        {report.description && <p className="detail-description">{report.description}</p>}
        {report.resolutionNote && (
          <div className="success-notice">
            <Check size={18} />
            <span>{report.resolutionNote}</span>
          </div>
        )}
        <h3 className="section-mini-title">رحلة البلاغ</h3>
        <div className="timeline">
          {report.history.map((event, index) => (
            <div
              className={`timeline-event ${index === report.history.length - 1 ? 'current' : ''}`}
              key={`${event.createdAt}-${index}`}
            >
              <span className="timeline-point">
                <Check size={12} />
              </span>
              <div>
                <strong>{statuses[event.status]}</strong>
                {event.note && <p>{event.note}</p>}
                <time>{date(event.createdAt)}</time>
              </div>
            </div>
          ))}
        </div>
        <div className="privacy-note">
          <ShieldCheck size={17} />
          بيانات صاحب البلاغ خاصة ولا تظهر للجمهور.
        </div>
        {message && (
          <p className="inline-message" role="status">
            {message}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" onClick={share}>
            <Share2 size={17} />
            مشاركة البلاغ
          </button>
          {user?.role === 'citizen' &&
            ['submitted', 'delivered', 'acknowledged', 'in_progress'].includes(report.status) && (
              <button className="button primary" onClick={confirm} disabled={busy}>
                <Users size={17} />
                المشكلة ما زالت موجودة
              </button>
            )}
          <a className="button ghost" href={`/map?report=${report.id}`}>
            <ArrowUpLeft size={17} />
            الخريطة
          </a>
        </div>
      </section>
    </div>
  );
}
