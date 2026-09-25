'use client';
import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  ImagePlus,
  LoaderCircle,
  LocateFixed,
  MapPin,
  ShieldCheck,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import { api, Category, fileData, Report, Severity, severities, User } from './model';
import { StatusBadge } from './ReportCard';
import { useDialog } from './useDialog';

export default function CreateReport({
  user,
  categories,
  onLogin,
  onClose,
  onSubmitted,
}: {
  user: User | null;
  categories: Category[];
  onLogin: (user: User) => void;
  onClose: () => void;
  onSubmitted: (report: Report) => void;
}) {
  useDialog(true, onClose);
  const [step, setStep] = useState(user?.role === 'citizen' ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [capture, setCapture] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    gpsAccuracy: number;
    district: string;
    demo: boolean;
  } | null>(null);
  const [categoryId, setCategoryId] = useState(categories.find((c) => c.active)?.id || '');
  const [severity, setSeverity] = useState<Severity>('normal');
  const [description, setDescription] = useState('');
  const [duplicates, setDuplicates] = useState<Report[]>([]);
  const [result, setResult] = useState<Report | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const category = categories.find((c) => c.id === categoryId);
  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    await run(async () => {
      const result = await api<{ user: User }>('/api/auth/mock', {});
      onLogin(result.user);
      setStep(1);
    });
  }
  async function choose(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('اختر ملف صورة صالحًا.');
      return;
    }
    if (file.size > 5 * 1000 * 1000) {
      setError('حجم الصورة يجب ألا يتجاوز ٥ ميجابايت.');
      return;
    }
    await run(async () => {
      const data = await fileData(file);
      setPhoto(data);
      setCapture(new Date().toISOString());
      const upload = await api<{ imageUrl: string }>('/api/media', {
        dataUrl: data,
        kind: 'before',
      });
      setImageUrl(upload.imageUrl);
    });
  }
  async function demoPhoto() {
    await run(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 600;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#aaa99d';
      context.fillRect(0, 0, 960, 600);
      context.fillStyle = '#686d69';
      context.beginPath();
      context.moveTo(250, 0);
      context.lineTo(790, 0);
      context.lineTo(960, 600);
      context.lineTo(0, 600);
      context.closePath();
      context.fill();
      context.fillStyle = '#b5b3a4';
      context.fillRect(0, 100, 220, 28);
      context.fillRect(775, 170, 185, 22);
      context.strokeStyle = '#e8dfbd';
      context.lineWidth = 9;
      context.setLineDash([70, 38]);
      context.beginPath();
      context.moveTo(560, 0);
      context.lineTo(650, 600);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#3b4039';
      context.beginPath();
      context.ellipse(408, 368, 133, 59, -0.14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#85877b';
      context.lineWidth = 20;
      context.stroke();
      context.fillStyle = '#e9d9ad';
      context.fillRect(318, 235, 12, 80);
      context.fillRect(540, 230, 12, 80);
      context.fillStyle = '#bc7b31';
      context.fillRect(306, 239, 260, 24);
      context.fillStyle = '#fff';
      context.font = '20px sans-serif';
      context.fillText('BALAA — DEMO IMAGE / NOT A REAL REPORT', 35, 562);
      const data = canvas.toDataURL('image/jpeg', 0.9);
      setPhoto(data);
      setCapture(new Date().toISOString());
      const upload = await api<{ imageUrl: string }>('/api/media', {
        dataUrl: data,
        kind: 'before',
      });
      setImageUrl(upload.imageUrl);
    });
  }
  async function locate(demo: boolean) {
    await run(async () => {
      const coordinates = demo
        ? { latitude: 29.96, longitude: 31.26, gpsAccuracy: 8 }
        : await new Promise<{ latitude: number; longitude: number; gpsAccuracy: number }>(
            (resolve, reject) => {
              if (!navigator.geolocation) return reject(new Error('المتصفح لا يدعم تحديد الموقع.'));
              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    gpsAccuracy: pos.coords.accuracy,
                  }),
                () =>
                  reject(
                    new Error(
                      'تعذّر تحديد الموقع. اسمح بالوصول للموقع أو استخدم موقع العرض التجريبي.',
                    ),
                  ),
                { enableHighAccuracy: true, timeout: 15000 },
              );
            },
          );
      const result = await api<{ district: { nameAr: string } }>('/api/geo', coordinates);
      setLocation({ ...coordinates, district: result.district.nameAr, demo });
    });
  }
  async function review() {
    if (!location || !categoryId) return;
    await run(async () => {
      const result = await api<{ reports: Report[] }>('/api/reports/duplicates', {
        latitude: location.latitude,
        longitude: location.longitude,
        categoryId,
      });
      setDuplicates(result.reports);
      setStep(3);
    });
  }
  async function submit() {
    if (!location || !imageUrl) return;
    await run(async () => {
      const result = await api<{ report: Report }>('/api/reports', {
        categoryId,
        severity,
        description,
        latitude: location.latitude,
        longitude: location.longitude,
        gpsAccuracy: location.gpsAccuracy,
        capturedLatitude: location.latitude,
        capturedLongitude: location.longitude,
        capturedAt: capture,
        deviceTimestamp: new Date().toISOString(),
        imageUrl,
      });
      setResult(result.report);
      setStep(4);
    });
  }
  async function confirm(report: Report) {
    await run(async () => {
      const result = await api<{ report: Report }>(`/api/reports/${report.id}/confirm`, {});
      setResult(result.report);
      setStep(4);
    });
  }
  return (
    <div className="modal-backdrop">
      <section
        className="wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
      >
        <div className="modal-top">
          <span className="eyebrow">مساهمة صغيرة. طريق أأمن.</span>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {step > 0 && step < 4 && (
          <div className="wizard-progress">
            {['الصورة والموقع', 'تفاصيل المشكلة', 'مراجعة وإرسال'].map((label, index) => (
              <div className={step >= index + 1 ? 'active' : ''} key={label}>
                <span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>
                <b>{label}</b>
              </div>
            ))}
          </div>
        )}
        {step === 0 && (
          <div className="auth-panel">
            <span className="feature-icon large">
              <ShieldCheck size={36} />
            </span>
            <span className="demo-pill">نسخة تجريبية · Demo</span>
            <h2 id="wizard-title">صوتك موثوق. بياناتك خاصة.</h2>
            <p>
              توثيق الهوية يساعدنا في الحفاظ على جدية البلاغات. لا يظهر اسمك أو أي بيانات شخصية مع
              بلاغك.
            </p>
            <div className="notice">
              <ShieldCheck size={19} />
              <span>
                هذه محاكاة لتسجيل الدخول، ولا تتصل بمصر الرقمية أو أي جهة حكومية. لا نطلب رقمك
                القومي.
              </span>
            </div>
            <button className="button primary full" onClick={verify} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={19} /> : <ShieldCheck size={19} />}{' '}
              {busy ? 'جارٍ التحقق التجريبي…' : 'متابعة عبر مصر الرقمية'}
              <ArrowLeft size={18} />
            </button>
            <small>سيتم إنشاء حساب مواطن تجريبي داخل هذه النسخة.</small>
          </div>
        )}
        {step === 1 && (
          <>
            <h2 id="wizard-title">صوّر المشكلة وحدّد مكانها</h2>
            <p className="muted">صورة واضحة وموقع دقيق يساعدان في وصول البلاغ للحي الصحيح.</p>
            <input
              ref={camera}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <div className={`photo-capture ${photo ? 'has-photo' : ''}`}>
              {photo ? (
                <>
                  <img src={photo} alt="صورة المشكلة الملتقطة" />
                  <button
                    className="button light"
                    disabled={busy}
                    onClick={() => camera.current?.click()}
                  >
                    <Camera size={16} />
                    تغيير الصورة
                  </button>
                </>
              ) : (
                <>
                  <span className="feature-icon">
                    <Camera size={29} />
                  </span>
                  <h3>ابدأ بصورة للمشكلة</h3>
                  <p>بدون وجوه أو لوحات سيارات قدر الإمكان.</p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => camera.current?.click()}
                  >
                    <Camera size={18} />
                    فتح الكاميرا
                  </button>
                </>
              )}
            </div>
            <div className="dev-inputs">
              <span>أدوات العرض التجريبي:</span>
              <button disabled={busy} onClick={() => file.current?.click()}>
                <Upload size={14} />
                اختيار صورة
              </button>
              <button disabled={busy} onClick={demoPhoto}>
                <ImagePlus size={14} />
                صورة تجريبية
              </button>
            </div>
            <div className="location-box">
              <div className="location-heading">
                <span className="feature-icon small">
                  <MapPin size={21} />
                </span>
                <div>
                  <h3>{location ? location.district : 'أين توجد المشكلة؟'}</h3>
                  <p>
                    {location
                      ? `${location.demo ? 'موقع اصطناعي للعرض · ' : ''}دقة الموقع ${Math.round(location.gpsAccuracy)} م`
                      : 'نحدد الحي تلقائيًا من إحداثيات الموقع.'}
                  </p>
                </div>
                {location && <Check className="teal" size={22} />}
              </div>
              <div className="location-actions">
                <button className="button secondary" onClick={() => locate(false)} disabled={busy}>
                  <LocateFixed size={17} />
                  تحديد موقعي
                </button>
                <button className="text-button" onClick={() => locate(true)} disabled={busy}>
                  موقع المعادي التجريبي
                </button>
              </div>
              {location && (
                <span className="coordinate" dir="ltr">
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </span>
              )}
            </div>
            <p className="microcopy">حدود الأحياء في العرض توضيحية وليست بيانات رسمية معتمدة.</p>
          </>
        )}
        {step === 2 && (
          <>
            <h2 id="wizard-title">ما المشكلة التي لاحظتها؟</h2>
            <p className="muted">اختر أقرب وصف. التفاصيل الإضافية اختيارية.</p>
            <label className="field-label">نوع المشكلة</label>
            <div className="category-grid">
              {categories
                .filter((category) => category.active)
                .map((category) => (
                  <button
                    className={`category-choice ${categoryId === category.id ? 'selected' : ''}`}
                    key={category.id}
                    onClick={() => setCategoryId(category.id)}
                  >
                    <span className="choice-radio">
                      {categoryId === category.id && <Check size={12} />}
                    </span>
                    {category.labelAr}
                  </button>
                ))}
            </div>
            <label className="field-label">درجة الخطورة</label>
            <div className="severity-options">
              {(['normal', 'dangerous', 'critical'] as const).map((value) => (
                <button
                  key={value}
                  className={`${severity === value ? 'selected' : ''} severity-${value}`}
                  onClick={() => setSeverity(value)}
                >
                  {value === 'critical' ? (
                    <TriangleAlert size={17} />
                  ) : (
                    <span className="severity-dot" />
                  )}
                  {severities[value]}
                </button>
              ))}
            </div>
            {severity === 'critical' && (
              <div className="notice warning">
                هذه منصة متابعة تجريبية وليست قناة للطوارئ. ابتعد عن الخطر واطلب المساعدة العاجلة من
                الجهة المختصة عند الحاجة.
              </div>
            )}
            <label className="field-label" htmlFor="description">
              تفاصيل تساعدنا <span>اختياري</span>
            </label>
            <textarea
              id="description"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلًا: أمام مدخل الشارع، وتشكّل خطرًا على المارة…"
            />
            <span className="character-count">{description.length} / 500</span>
          </>
        )}
        {step === 3 && (
          <>
            <h2 id="wizard-title">بلاغك جاهز للمراجعة</h2>
            <p className="muted">تأكد من التفاصيل قبل الإرسال.</p>
            <div className="review-card">
              <img src={photo} alt="صورة البلاغ للمراجعة" />
              <div>
                <h3>{category?.labelAr}</h3>
                <p>
                  <MapPin size={15} />
                  {location?.district}، القاهرة
                </p>
                <span className={`severity-tag severity-${severity}`}>{severities[severity]}</span>
              </div>
            </div>
            {description && <p className="review-description">{description}</p>}
            {duplicates.length > 0 && (
              <div className="duplicate-box">
                <h3>يبدو أن المشكلة أُبلغ عنها بالفعل</h3>
                <p>وجدنا بلاغًا من النوع نفسه في نطاق ٣٠ مترًا. يمكنك تأكيد استمراره.</p>
                {duplicates.map((report) => (
                  <div key={report.id}>
                    <span dir="ltr">{report.publicId}</span>
                    <StatusBadge status={report.status} />
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => confirm(report)}
                    >
                      المشكلة ما زالت موجودة
                    </button>
                  </div>
                ))}
                <small>إذا كانت مشكلة مختلفة، يمكنك إرسال بلاغ مستقل.</small>
              </div>
            )}
            <div className="notice">
              <ShieldCheck size={21} />
              <span>
                يُراجع البلاغ قبل إتاحته للعامة. تذهب إشعارات هذه النسخة لصندوق اختبار فقط، ولا
                تُرسل لجهة حكومية.
              </span>
            </div>
          </>
        )}
        {step === 4 && result && (
          <div className="submitted-panel">
            <span className="success-circle">
              <CheckCheck size={39} />
            </span>
            <span className="eyebrow">خطوة أقرب لطريق أأمن</span>
            <h2 id="wizard-title">تم تسجيل مساهمتك</h2>
            <p>
              {result.status === 'under_review'
                ? 'بلاغك تحت المراجعة قبل ظهوره للعامة.'
                : 'يمكنك الآن متابعة حالة البلاغ من حسابك.'}
            </p>
            <div className="submitted-id">
              <span>رقم البلاغ</span>
              <strong dir="ltr">{result.publicId}</strong>
              <span>
                <MapPin size={15} />
                {result.districtName}
              </span>
            </div>
            <div className="notice">
              الإشعارات تجريبية ومحفوظة بصندوق الاختبار. لم يتم إرسال بلاغ إلى جهة حكومية.
            </div>
            <button className="button primary full" onClick={() => onSubmitted(result)}>
              متابعة البلاغ
              <ArrowLeft size={18} />
            </button>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {busy && step > 0 && (
          <p className="loading-line" role="status">
            <LoaderCircle size={16} className="spin" />
            جارٍ إتمام الطلب…
          </p>
        )}
        {step > 0 && step < 4 && (
          <div className="wizard-footer">
            <button
              className="button ghost"
              onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
              disabled={busy}
            >
              <ArrowRight size={17} />
              {step === 1 ? 'إلغاء' : 'رجوع'}
            </button>
            <button
              className="button primary"
              disabled={
                busy || (step === 1 && (!imageUrl || !location)) || (step === 2 && !categoryId)
              }
              onClick={() => (step === 1 ? setStep(2) : step === 2 ? review() : submit())}
            >
              {step === 3 ? 'إرسال البلاغ' : 'متابعة'}
              {step === 3 ? <Check size={18} /> : <ArrowLeft size={18} />}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
