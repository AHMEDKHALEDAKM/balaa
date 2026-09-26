'use client';
import { useLocale } from '@balaa/ui/locale';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  FileText,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Search,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import {
  api,
  Category,
  fileData,
  Report,
  severities,
  Status,
  statuses,
  User,
  withBase,
} from './model';
import { EmptyState, StatusBadge } from './ReportCard';
import AbuseReview from './AbuseReview';
import { useDialog } from './useDialog';
type Tab = 'reports' | 'moderation' | 'categories' | 'outbox' | 'abuse';
export default function Dashboard({
  user,
  categories,
  onLogin,
  onRefresh,
}: {
  user: User | null;
  categories: Category[];
  onLogin: (user: User) => void;
  onRefresh: () => void;
}) {
  const { t, bilingual, date, number } = useLocale();
  const [backend, setBackend] = useState('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [codeRequired, setCodeRequired] = useState(false);
  const [redactionConfirmed, setRedactionConfirmed] = useState(false);
  useEffect(() => {
    api<{ mode: string; staffCodeRequired?: boolean }>('/api/config')
      .then((c) => {
        setBackend(c.mode);
        setCodeRequired(!!c.staffCodeRequired);
      })
      .catch(() => undefined);
  }, []);
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [action, setAction] = useState<Status | null>(null);
  const [duplicateOf, setDuplicateOf] = useState('');
  const [outbox, setOutbox] = useState<
    {
      id: string;
      reportId: string;
      to: string;
      intendedTo?: string;
      from?: string;
      audience?: 'district' | 'citizen' | 'operations';
      subject: string;
      createdAt: string;
      status: string;
    }[]
  >([]);
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    labelAr: '',
    labelEn: '',
    icon: 'circle',
    active: true,
  });
  useDialog(!!selected, () => setSelected(null));
  const isStaff =
    user &&
    ['district_agent', 'district_manager', 'moderator', 'platform_admin'].includes(user.role);
  const isAdmin = user?.role === 'platform_admin';
  const isModerator = isAdmin || user?.role === 'moderator';
  async function load() {
    if (!isStaff) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 'outbox') {
        const result = await api<{ notifications: typeof outbox }>('/api/admin/outbox');
        setOutbox(result.notifications);
      } else if (tab !== 'categories' && tab !== 'abuse') {
        const result = await api<{ reports: Report[] }>(
          tab === 'moderation' ? '/api/moderation' : '/api/dashboard/reports',
        );
        setReports(result.reports);
        setSelected((old) =>
          old ? result.reports.find((report) => report.id === old.id) || null : null,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [tab, user?.id]);
  async function login(role: string) {
    setLoading(true);
    setError('');
    try {
      const result = await api<{ user: User }>(
        '/api/auth/staff',
        backend === 'supabase'
          ? { email, password }
          : codeRequired
            ? { role, code: staffCode }
            : { role },
      );
      onLogin(result.user);
      if (result.user.role === 'moderator') setTab('moderation');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function update(status: Status) {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await api(`/api/dashboard/reports/${selected.id}/status`, {
        status,
        note:
          note.trim() ||
          (status === 'acknowledged'
            ? t('تم استلام البلاغ')
            : status === 'in_progress'
              ? t('بدأ العمل على البلاغ')
              : ''),
        imageUrl: resolution || undefined,
        duplicateOf: duplicateOf || undefined,
      });
      setNote('');
      setAction(null);
      setResolution('');
      setMessage(t('تم تحديث حالة البلاغ وتسجيل الإجراء.'));
      await load();
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function addNote() {
    if (!selected || !note.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api(`/api/dashboard/reports/${selected.id}/notes`, { note });
      setNote('');
      setMessage(t('تم حفظ الملاحظة الداخلية. لا تظهر للمواطنين.'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setLoading(true);
    try {
      const image = await api<{ imageUrl: string }>('/api/media', {
        dataUrl: await fileData(file),
        kind: 'resolution',
      });
      setResolution(image.imageUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function demoResolution() {
    setLoading(true);
    setError('');
    try {
      const image = new Image();
      image.src = withBase('/demo-resolved.svg');
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 600;
      canvas.getContext('2d')!.drawImage(image, 0, 0, 960, 600);
      const uploaded = await api<{ imageUrl: string }>('/api/media', {
        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
        kind: 'resolution',
      });
      setResolution(uploaded.imageUrl);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function moderate(decision: string) {
    if (!selected) return;
    setLoading(true);
    try {
      await api(`/api/moderation/${selected.id}`, {
        decision,
        note: note.trim() || t('تمت مراجعة المحتوى يدويًا'),
        ...(backend === 'supabase' ? { redactionConfirmed } : {}),
      });
      setSelected(null);
      setNote('');
      setMessage(t('تم حفظ قرار المراجعة.'));
      await load();
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function saveCategory() {
    setLoading(true);
    setError('');
    try {
      await api('/api/admin/categories', { ...categoryForm, id: categoryForm.id || undefined });
      setCategoryForm({ id: '', labelAr: '', labelEn: '', icon: 'circle', active: true });
      onRefresh();
      setMessage(t('تم حفظ التصنيف.'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const open = reports.filter(
    (report) => !['resolved', 'rejected', 'duplicate'].includes(report.status),
  );
  const filtered = reports.filter(
    (report) =>
      (filter === 'all' || filter === 'high'
        ? filter === 'all' || report.severity !== 'normal'
        : filter === 'open'
          ? open.includes(report)
          : filter === 'new'
            ? ['submitted', 'delivered'].includes(report.status)
            : report.status === filter) &&
      `${report.publicId} ${bilingual(report.categoryLabel, report.categoryLabelEn)} ${bilingual(report.districtName, report.districtNameEn)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (!isStaff)
    return (
      <div className="staff-login">
        <div className="staff-login-story">
          <span className="eyebrow">{t('مساحة فرق الأحياء')}</span>
          <h1>
            {t('كل بلاغ،')}
            <br />
            <em>{t('فرصة لتحسين الطريق.')}</em>
          </h1>
          <p>{t('تابع البلاغات الواردة، نسّق العمل، ووثّق الحل في مكان واحد.')}</p>
          <div className="staff-feature">
            <ShieldCheck size={23} />
            <span>{t('صلاحيات محددة لكل حي')}</span>
          </div>
          <div className="staff-feature">
            <FileText size={23} />
            <span>{t('سجل واضح لكل إجراء')}</span>
          </div>
          <div className="staff-feature">
            <CheckCircle2 size={23} />
            <span>{t('حلول موثقة بالصور')}</span>
          </div>
          <span className="staff-story-bottom">
            {t('بلاعة / البنية التحتية للمشاركة المجتمعية')}
          </span>
        </div>
        <div className="staff-login-card">
          <span className="feature-icon">
            <LayoutDashboard size={29} />
          </span>
          <span className="demo-pill">{t('دخول تجريبي')}</span>
          <h2>{t('مرحبًا بفريق العمل')}</h2>
          <p>
            {codeRequired
              ? t('أدخل رمز فريق العمل الذي حصلت عليه من إدارة المنصة، ثم اختر دورك.')
              : t('اختر دورًا لتجربة لوحة المتابعة. جميع الحسابات والبيانات هنا مخصصة للعرض.')}
          </p>
          {codeRequired && (
            <>
              <label className="field-label" htmlFor="staff-code">
                {t('رمز فريق العمل')}
              </label>
              <input
                id="staff-code"
                type="password"
                autoComplete="off"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
              />
            </>
          )}
          <>
            {backend === 'supabase' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void login('staff');
                }}
              >
                <label className="field-label" htmlFor="staff-email">
                  {t('البريد المسجل لدى Supabase')}
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
                <label className="field-label" htmlFor="staff-password">
                  {t('كلمة المرور')}
                </label>
                <input
                  id="staff-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button className="button primary full" disabled={loading}>
                  {t('دخول فريق العمل')}
                </button>
              </form>
            )}
            <div hidden={backend === 'supabase'}>
              <button
                className="role-option"
                disabled={loading}
                onClick={() => login('district_agent')}
              >
                <span className="feature-icon small">
                  <MapPin size={20} />
                </span>
                <span>
                  <strong>{t('موظف حي المعادي')}</strong>
                  <small>{t('إدارة البلاغات المسندة لهذا الحي فقط')}</small>
                </span>
                <ArrowLeft size={18} />
              </button>
              <button className="role-option" disabled={loading} onClick={() => login('moderator')}>
                <span className="feature-icon small">
                  <ShieldCheck size={20} />
                </span>
                <span>
                  <strong>{t('مراجع المحتوى')}</strong>
                  <small>{t('مراجعة البلاغات قبل النشر')}</small>
                </span>
                <ArrowLeft size={18} />
              </button>
              <button
                className="role-option"
                disabled={loading}
                onClick={() => login('platform_admin')}
              >
                <span className="feature-icon small">
                  <Settings2 size={20} />
                </span>
                <span>
                  <strong>{t('مدير المنصة')}</strong>
                  <small>{t('التصنيفات والمراجعة والرسائل الصادرة')}</small>
                </span>
                <ArrowLeft size={18} />
              </button>
            </div>
          </>
          <div className="notice">
            {t('بيئة عرض مستقلة. لا تمثل بوابة حكومية أو وصولًا لأنظمة حقيقية.')}
          </div>
          {error && (
            <p role="alert" className="form-error">
              {t(error)}
            </p>
          )}
        </div>
      </div>
    );
  return (
    <div className="console-layout">
      <aside className="console-sidebar">
        <span className="sidebar-label">{t('مساحة العمل')}</span>
        <h3>
          {user.role === 'district_agent'
            ? t('حي المعادي')
            : user.role === 'moderator'
              ? t('مراجعة المحتوى')
              : t('إدارة المنصة')}
        </h3>
        <span className="sidebar-role">
          {user.role === 'district_agent' ? t('فريق متابعة البلاغات') : t('حساب تجريبي')}
        </span>
        <nav>
          {user.role !== 'moderator' && (
            <button
              className={tab === 'reports' ? 'active' : ''}
              onClick={() => {
                setTab('reports');
                setSelected(null);
              }}
            >
              <LayoutDashboard size={19} />
              {t('نظرة عامة')}
            </button>
          )}
          {isModerator && (
            <button
              className={tab === 'moderation' ? 'active' : ''}
              onClick={() => {
                setTab('moderation');
                setSelected(null);
              }}
            >
              <ShieldCheck size={19} />
              {t('مراجعة المحتوى')}
            </button>
          )}
          {isAdmin && (
            <>
              <button
                className={tab === 'categories' ? 'active' : ''}
                onClick={() => setTab('categories')}
              >
                <Settings2 size={19} />
                {t('التصنيفات')}
              </button>
              <button className={tab === 'outbox' ? 'active' : ''} onClick={() => setTab('outbox')}>
                <Inbox size={19} />
                {t('الرسائل الصادرة')}
              </button>
              <button className={tab === 'abuse' ? 'active' : ''} onClick={() => setTab('abuse')}>
                <ShieldCheck size={19} />
                {t('مراجعة الحسابات')}
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={22} />
          <p>{t('خصوصية المواطن أولًا')}</p>
          <small>{t('لا تتضمن البلاغات بيانات الهوية الشخصية.')}</small>
        </div>
      </aside>
      <div className="console-main">
        <div className="console-heading">
          <div>
            <span className="eyebrow">{t('لوحة متابعة الأحياء')}</span>
            <h1>
              {tab === 'reports'
                ? t('من البلاغ إلى الحل')
                : tab === 'moderation'
                  ? t('مراجعة المحتوى')
                  : tab === 'categories'
                    ? t('تصنيفات المشكلات')
                    : tab === 'abuse'
                      ? t('مراجعة الحسابات')
                      : t('صندوق الإشعارات التجريبي')}
            </h1>
            <p>
              {tab === 'reports'
                ? t('صورة واضحة لما يحدث في الشارع، ومتابعة لكل خطوة.')
                : tab === 'moderation'
                  ? t('راجع الصورة والتفاصيل قبل إتاحة البلاغ للعامة.')
                  : tab === 'categories'
                    ? t('تظهر التغييرات في تطبيق المواطن بدون تحديث التطبيق.')
                    : t('جميع الإشعارات محفوظة محليًا. لا يُرسل بريد حقيقي.')}
            </p>
          </div>
          <button className="button secondary" disabled={loading} onClick={load}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <Clock3 size={16} />}
            {t('تحديث')}
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {t(error)}
          </p>
        )}
        {message && (
          <p role="status" className="success-notice">
            <Check size={16} />
            {t(message)}
          </p>
        )}
        {tab === 'reports' && (
          <div className="dashboard-stats">
            <div>
              <span>{t('بلاغات مفتوحة')}</span>
              <strong>{number(open.length)}</strong>
              <ClipboardList size={23} />
            </div>
            <div>
              <span>{t('جاري العمل عليها')}</span>
              <strong>
                {number(reports.filter((report) => report.status === 'in_progress').length)}
              </strong>
              <Clock3 size={23} />
            </div>
            <div>
              <span>{t('بلاغات تم حلها')}</span>
              <strong>
                {number(reports.filter((report) => report.status === 'resolved').length)}
              </strong>
              <CheckCircle2 size={23} />
            </div>
            <div>
              <span>{t('ذات خطورة عالية')}</span>
              <strong>
                {number(open.filter((report) => report.severity !== 'normal').length)}
              </strong>
              <TriangleAlert size={23} />
            </div>
          </div>
        )}
        {(tab === 'reports' || tab === 'moderation') && (
          <div className="reports-panel">
            <div className="panel-heading">
              <h2>
                {tab === 'moderation' ? t('قائمة المراجعة') : t('البلاغات الواردة')}{' '}
                <span>{number(reports.length)}</span>
              </h2>
              <label className="search-input">
                <Search size={17} />
                <input
                  aria-label={t('بحث في البلاغات')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('ابحث برقم البلاغ أو نوع المشكلة')}
                />
              </label>
            </div>
            {tab === 'reports' && (
              <div className="filter-tabs">
                {[
                  ['all', t('كل البلاغات')],
                  ['open', t('مفتوحة')],
                  ['new', t('جديدة')],
                  ['in_progress', t('جاري العمل')],
                  ['resolved', t('تم الحل')],
                  ['high', t('خطورة عالية')],
                ].map(([key, label]) => (
                  <button
                    className={filter === key ? 'active' : ''}
                    key={key}
                    onClick={() => setFilter(key!)}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            )}
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>{t('البلاغ')}</th>
                    <th>{t('الحي')}</th>
                    <th>{t('الخطورة')}</th>
                    <th>{t('الحالة')}</th>
                    <th>{t('التاريخ')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((report) => (
                    <tr
                      key={report.id}
                      onClick={() => {
                        setSelected(report);
                        setResolution(report.resolutionImageUrl || '');
                        setRedactionConfirmed(false);
                        setAction(null);
                        setNote('');
                        setError('');
                        setMessage('');
                      }}
                    >
                      <td>
                        <div className="table-issue">
                          <img src={report.imageUrl} alt="" />
                          <span>
                            <strong>
                              {bilingual(report.categoryLabel, report.categoryLabelEn)}
                            </strong>
                            <small dir="ltr">{report.publicId}</small>
                          </span>
                        </div>
                      </td>
                      <td>{bilingual(report.districtName, report.districtNameEn)}</td>
                      <td>
                        <span className={`severity-tag severity-${report.severity}`}>
                          {t(severities[report.severity])}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="table-date">{date(report.createdAt)}</td>
                      <td>
                        <button className="icon-button" aria-label={t('فتح {0}', report.publicId)}>
                          <ChevronLeft size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <EmptyState
                title={loading ? t('جارٍ تحميل البلاغات…') : t('لا توجد بلاغات مطابقة')}
                description={t('جرّب تغيير عوامل التصفية أو العودة لاحقًا.')}
              />
            )}
            <div className="table-footer">
              {t('عرض')}
              {number(filtered.length)} {t('من')}
              {number(reports.length)} {t('بلاغ')}{' '}
              <span>{t('البيانات ضمن صلاحيات حسابك فقط')}</span>
            </div>
          </div>
        )}
        {tab === 'categories' && (
          <div className="admin-categories">
            <div className="reports-panel">
              <div className="panel-heading">
                <h2>{t('التصنيفات الحالية')}</h2>
              </div>
              {categories.map((category) => (
                <button
                  className="admin-category-row"
                  key={category.id}
                  onClick={() => setCategoryForm(category)}
                >
                  <span>
                    <strong>{bilingual(category.labelAr, category.labelEn)}</strong>
                    <small>{category.labelEn}</small>
                  </span>
                  <span className={category.active ? 'active-category' : 'muted'}>
                    {category.active ? t('مفعّل') : t('غير مفعّل')}
                  </span>
                  <ChevronLeft size={18} />
                </button>
              ))}
            </div>
            <form
              className="admin-category-form"
              onSubmit={(e) => {
                e.preventDefault();
                void saveCategory();
              }}
            >
              <h3>{categoryForm.id ? t('تعديل التصنيف') : t('إضافة تصنيف')}</h3>
              <label className="field-label" htmlFor="category-ar">
                {t('الاسم بالعربية')}
              </label>
              <input
                id="category-ar"
                required
                value={categoryForm.labelAr}
                onChange={(e) => setCategoryForm({ ...categoryForm, labelAr: e.target.value })}
              />
              <label className="field-label" htmlFor="category-en">
                {t('الاسم بالإنجليزية')}
              </label>
              <input
                id="category-en"
                required
                dir="ltr"
                value={categoryForm.labelEn}
                onChange={(e) => setCategoryForm({ ...categoryForm, labelEn: e.target.value })}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={categoryForm.active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })}
                />
                {t('تصنيف مفعّل')}
              </label>
              <button className="button primary" type="submit" disabled={loading}>
                <Check size={17} />
                {t('حفظ التصنيف')}
              </button>
              <button
                className="button ghost"
                type="button"
                onClick={() =>
                  setCategoryForm({
                    id: '',
                    labelAr: '',
                    labelEn: '',
                    icon: 'circle',
                    active: true,
                  })
                }
              >
                {t('تصنيف جديد')}
              </button>
            </form>
          </div>
        )}
        {tab === 'abuse' && <AbuseReview />}
        {tab === 'outbox' && (
          <div className="reports-panel">
            <div className="panel-heading">
              <h2>
                {t('الرسائل الصادرة')}
                <span>{number(outbox.length)}</span>
              </h2>
              <span className="demo-pill">{t('الإرسال الفعلي متوقف')}</span>
              {backend === 'supabase' && (
                <button
                  className="button secondary"
                  onClick={() =>
                    void api('/api/admin/outbox/process', {})
                      .then(load)
                      .catch((e) => setError(e.message))
                  }
                >
                  {t('معالجة قائمة الاختبار')}
                </button>
              )}
            </div>
            {outbox.map((item) => (
              <div className="outbox-item" key={item.id}>
                <span className="feature-icon small">
                  <Inbox size={21} />
                </span>
                <div>
                  <span className="outbox-audience">
                    {item.audience === 'citizen'
                      ? t('إلى المواطن')
                      : item.audience === 'operations'
                        ? t('إلى فريق التوجيه')
                        : t('إلى الحي المختص')}
                  </span>
                  <strong>{item.subject}</strong>
                  <p>
                    {t('إلى:')} <span dir="ltr">{item.intendedTo ?? item.to}</span>
                  </p>
                  {item.from && (
                    <p>
                      {t('من:')} <span dir="ltr">{item.from}</span>
                    </p>
                  )}
                  <small>
                    {date(item.createdAt)} · {t('لم تُرسل · وضع تجريبي')}
                  </small>
                </div>
                <CheckCircle2 size={19} />
              </div>
            ))}
            {!outbox.length && (
              <EmptyState
                title={t('لا توجد رسائل بعد')}
                description={t('كل رسالة للحي أو للمواطن تظهر هنا مع المرسل والمستلم.')}
              />
            )}
          </div>
        )}
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="staff-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-top">
              <span className="small-code" dir="ltr">
                {selected.publicId}
              </span>
              <button
                className="icon-button"
                aria-label={t('إغلاق')}
                onClick={() => setSelected(null)}
              >
                <X size={21} />
              </button>
            </div>
            <h2 id="staff-detail-title">
              {bilingual(selected.categoryLabel, selected.categoryLabelEn)}
            </h2>
            <div className="staff-detail-sub">
              <span>
                <MapPin size={16} />
                {bilingual(selected.districtName, selected.districtNameEn)}
              </span>
              <StatusBadge status={selected.status} />
            </div>
            <img
              className="staff-evidence"
              src={selected.imageUrl}
              alt={t('صورة البلاغ المراد معالجته')}
            />
            <div className="staff-info">
              <span>
                <ShieldCheck size={16} />
                {selected.identityVerified ? t('مواطن موثّق تجريبيًا') : t('حالة التحقق غير متاحة')}
              </span>
              <span className={`severity-tag severity-${selected.severity}`}>
                {t(severities[selected.severity])}
              </span>
            </div>
            <p>{selected.description || t('لم تُضف تفاصيل أخرى.')}</p>
            <div className="staff-coordinate">
              <span>{t('إحداثيات الموقع')}</span>
              <a
                href={withBase(`/map?report=${selected.id}`)}
                target="_blank"
                rel="noreferrer"
                dir="ltr"
              >
                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}{' '}
                <ArrowUpLeft size={14} />
              </a>
            </div>
            {selected.resolutionImageUrl && (
              <div className="staff-resolution">
                <h3>{t('توثيق الحل')}</h3>
                <img src={selected.resolutionImageUrl} alt={t('صورة المعالجة')} />
                <p>{selected.resolutionNote}</p>
              </div>
            )}
            <div className="staff-history">
              <h3>{t('سجل الإجراءات')}</h3>
              {selected.history.map((event, index) => (
                <div key={index}>
                  <span>{t(statuses[event.status])}</span>
                  <small>{date(event.createdAt)}</small>
                  {event.note && <p>{event.note}</p>}
                </div>
              ))}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {t(error)}
              </p>
            )}
            {message && (
              <p className="success-notice" role="status">
                {t(message)}
              </p>
            )}
            <label className="field-label" htmlFor="staff-note">
              {action === 'resolved'
                ? t('وصف المعالجة (مطلوب)')
                : t('ملاحظة الإجراء / ملاحظة داخلية')}
            </label>
            <textarea
              id="staff-note"
              rows={3}
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('اكتب تفاصيل واضحة للفريق…')}
            />
            {tab === 'moderation' ? (
              <div>
                {backend === 'supabase' && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={redactionConfirmed}
                      onChange={(e) => setRedactionConfirmed(e.target.checked)}
                    />
                    {t(
                      'راجعت صور قبل وبعد، ولا توجد وجوه أو لوحات أو بيانات شخصية ظاهرة. احجب الصور الحساسة لحين توفير نسخة منقحة.',
                    )}
                  </label>
                )}
                <div className="staff-actions">
                  <button
                    className="button primary"
                    disabled={loading}
                    onClick={() => moderate('safe')}
                  >
                    <Check size={17} />
                    {t('السماح بالنشر')}
                  </button>
                  <button
                    className="button secondary"
                    disabled={loading}
                    onClick={() => moderate('flagged')}
                  >
                    {t('يحتاج مراجعة إضافية')}
                  </button>
                  <button
                    className="button danger"
                    disabled={loading || !note.trim()}
                    onClick={() => moderate('blocked')}
                  >
                    {t('حجب المحتوى')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {action === 'resolved' && (
                  <div className="resolution-upload">
                    {backend !== 'supabase' && (
                      <button
                        className="button secondary"
                        disabled={loading}
                        onClick={demoResolution}
                      >
                        {t('صورة معالجة تجريبية')}
                      </button>
                    )}
                    <label className="button secondary">
                      <Upload size={17} />
                      {resolution ? t('تغيير صورة المعالجة') : t('رفع صورة المعالجة (مطلوبة)')}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(e) => upload(e.target.files?.[0])}
                      />
                    </label>
                    {resolution && <img src={resolution} alt={t('صورة المعالجة المختارة')} />}
                    <button
                      className="button primary"
                      disabled={loading || !resolution || !note.trim()}
                      onClick={() => update('resolved')}
                    >
                      <CheckCircle2 size={17} />
                      {t('تأكيد حل البلاغ')}
                    </button>
                  </div>
                )}
                {action === 'duplicate' && (
                  <div className="resolution-upload">
                    <label className="field-label" htmlFor="duplicate-id">
                      {t('معرّف البلاغ الأصلي')}
                    </label>
                    <select
                      id="duplicate-id"
                      value={duplicateOf}
                      onChange={(e) => setDuplicateOf(e.target.value)}
                    >
                      <option value="">{t('اختر البلاغ الأصلي')}</option>
                      {reports
                        .filter(
                          (report) => report.id !== selected.id && report.status !== 'duplicate',
                        )
                        .map((report) => (
                          <option key={report.id} value={report.id}>
                            {report.publicId} —{' '}
                            {bilingual(report.categoryLabel, report.categoryLabelEn)}
                          </option>
                        ))}
                    </select>
                    <button
                      className="button primary"
                      disabled={loading || !duplicateOf || !note.trim()}
                      onClick={() => update('duplicate')}
                    >
                      {t('تأكيد البلاغ المكرر')}
                    </button>
                  </div>
                )}
                <div className="staff-actions">
                  {['submitted', 'delivered'].includes(selected.status) && (
                    <button
                      className="button primary"
                      disabled={loading}
                      onClick={() => update('acknowledged')}
                    >
                      <Check size={16} />
                      {t('استلام البلاغ')}
                    </button>
                  )}
                  {selected.status === 'acknowledged' && (
                    <button
                      className="button primary"
                      disabled={loading}
                      onClick={() => update('in_progress')}
                    >
                      {t('بدء العمل')}
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  {selected.status === 'in_progress' && action !== 'resolved' && (
                    <button
                      className="button primary"
                      disabled={loading}
                      onClick={() => setAction('resolved')}
                    >
                      <CheckCircle2 size={16} />
                      {t('تم الحل')}
                    </button>
                  )}
                  <button
                    className="button secondary"
                    disabled={loading || !note.trim()}
                    onClick={addNote}
                  >
                    {t('إضافة ملاحظة داخلية')}
                  </button>
                  {!['resolved', 'rejected', 'duplicate', 'under_review'].includes(
                    selected.status,
                  ) && (
                    <>
                      <button
                        className="button ghost"
                        disabled={loading}
                        onClick={() => setAction('duplicate')}
                      >
                        {t('بلاغ مكرر')}
                      </button>
                      <button
                        className="button danger"
                        disabled={loading || !note.trim()}
                        onClick={() => update('rejected')}
                      >
                        {t('رفض مع توضيح السبب')}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
