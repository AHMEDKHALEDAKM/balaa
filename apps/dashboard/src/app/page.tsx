'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LoaderCircle,
  LogOut,
  MapPin,
  Plus,
  Route,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { api, Category, number, Report, User } from '../components/model';
import { EmptyState, ReportCard } from '../components/ReportCard';
import PublicMap from '../components/PublicMap';
import CreateReport from '../components/CreateReport';
import ReportDetail from '../components/ReportDetail';
import Dashboard from '../components/Dashboard';

type View = 'home' | 'map' | 'my' | 'dashboard';
export default function Home() {
  const [view, setView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [mine, setMine] = useState<Report[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [onboarding, setOnboarding] = useState(false);
  const refresh = useCallback(async () => {
    setError('');
    try {
      const [publicData, categoryData, session] = await Promise.all([
        api<{ reports: Report[] }>('/api/public/reports'),
        api<{ categories: Category[] }>('/api/categories'),
        api<{ user: User | null }>('/api/auth/session'),
      ]);
      setReports(publicData.reports);
      setCategories(categoryData.categories);
      setUser(session.user);
      if (session.user?.role === 'citizen') {
        const data = await api<{ reports: Report[] }>('/api/me/reports');
        setMine(data.reports);
      } else setMine([]);
      setSelected((old) =>
        old ? publicData.reports.find((report) => report.id === old.id) || old : null,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const query = new URLSearchParams(window.location.search);
    if (query.get('view') === 'dashboard') setView('dashboard');
    const id = query.get('report');
    if (id)
      api<{ report: Report }>(`/api/public/reports/${encodeURIComponent(id)}`)
        .then((result) => setSelected(result.report))
        .catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (view === 'my' && user?.role === 'citizen')
      api<{ reports: Report[] }>('/api/me/reports')
        .then((data) => setMine(data.reports))
        .catch((e) => setError(e.message));
  }, [view, user]);
  async function logout() {
    try {
      await api('/api/auth/logout', {});
      setUser(null);
      setMine([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const resolved = reports.filter((report) => report.status === 'resolved').length;
  const progress = reports.filter((report) => report.status === 'in_progress').length;
  const filtered = reports.filter((report) =>
    status === 'all' || status === 'open'
      ? !['resolved', 'rejected', 'duplicate'].includes(report.status) || status === 'all'
      : report.status === status,
  );
  function navigate(next: View) {
    setView(next);
    setStatus('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  return (
    <>
      <div className="prototype-bar">
        <span>
          <span className="prototype-dot" />
          نسخة تجريبية مفتوحة المصدر
        </span>
        <span>مبادرة مستقلة · بدون تكامل أو اعتماد حكومي</span>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand-button"
            aria-label="بلاعة، الصفحة الرئيسية"
            onClick={() => navigate('home')}
          >
            <Brand />
          </button>
          <nav className="main-nav" aria-label="التنقل الرئيسي">
            <button className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}>
              الرئيسية
            </button>
            <button className={view === 'map' ? 'active' : ''} onClick={() => navigate('map')}>
              خريطة البلاغات
            </button>
            <button className={view === 'my' ? 'active' : ''} onClick={() => navigate('my')}>
              بلاغاتي
            </button>
            <button
              className={view === 'dashboard' ? 'active' : ''}
              onClick={() => navigate('dashboard')}
            >
              لوحة الأحياء
              <ArrowUpLeft size={13} />
            </button>
          </nav>
          <div className="header-actions">
            {user ? (
              <button className="account-button" onClick={logout} title="تسجيل الخروج">
                <span className="account-avatar">{user.role === 'citizen' ? 'م' : 'ف'}</span>
                <span>{user.role === 'citizen' ? 'مواطن تجريبي' : 'فريق العمل'}</span>
                <LogOut size={15} />
              </button>
            ) : (
              <span className="header-location">
                <MapPin size={16} />
                القاهرة
              </span>
            )}
            <button className="button primary header-report" onClick={() => setCreate(true)}>
              <Plus size={18} />
              بلّغ عن مشكلة
            </button>
          </div>
        </div>
      </header>
      {error && (
        <div className="global-error" role="alert">
          {error}
          <button className="text-button" onClick={refresh}>
            إعادة المحاولة
          </button>
        </div>
      )}
      {view === 'dashboard' ? (
        <Dashboard user={user} categories={categories} onLogin={setUser} onRefresh={refresh} />
      ) : (
        <main className="page-container">
          {view === 'home' && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-eyebrow">
                    <span />
                    مع بعض، شوارعنا أأمن
                  </span>
                  <h1>
                    بلّغ. تابع.
                    <br />
                    خلّي الطريق <em>أأمن.</em>
                  </h1>
                  <p>
                    حفرة، بلاعة مفتوحة، أو مشكلة في الطريق؟
                    <br />
                    صوّرها، حدّد مكانها، وتابع بلاغك لحد ما تتحل.
                  </p>
                  <div className="hero-buttons">
                    <button className="button primary large" onClick={() => setCreate(true)}>
                      <Plus size={21} />
                      بلّغ عن مشكلة
                      <ArrowLeft size={19} />
                    </button>
                    <button className="button ghost" onClick={() => setOnboarding(true)}>
                      إزاي بلاعة بتشتغل؟
                      <ArrowUpLeft size={17} />
                    </button>
                  </div>
                  <div className="hero-trust">
                    <ShieldCheck size={17} />
                    <span>هويتك خاصة. وأثر مشاركتك للجميع.</span>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="hero-art-grid" />
                  <div className="art-street street-one" />
                  <div className="art-street street-two" />
                  <div className="art-street street-three" />
                  <span className="art-district-label label-one">المعادي</span>
                  <span className="art-district-label label-two">شارع ٩</span>
                  <div className="art-pin pin-one">
                    <Brand compact />
                  </div>
                  <div className="art-pin pin-two">
                    <Check size={24} />
                  </div>
                  <div className="art-pin pin-three">
                    <Plus size={22} />
                  </div>
                  <div className="art-report">
                    <div className="art-report-icon">
                      <CheckCircle2 size={22} />
                    </div>
                    <span>
                      <strong>التغيير بيبدأ ببلاغ</strong>
                      <small>مشاركتك تصنع فرقًا في شارعك</small>
                    </span>
                  </div>
                  <div className="art-caption">
                    <span className="live-dot" />
                    عين على الطريق، وخطوة نحو الحل
                  </div>
                  <svg className="art-route" viewBox="0 0 400 300" fill="none">
                    <path
                      d="M62 75V115Q62 143 90 143H275Q301 143 301 173V221"
                      stroke="#197466"
                      strokeWidth="3"
                      strokeDasharray="7 8"
                    />
                  </svg>
                </div>
              </section>
              <section className="impact-strip" aria-label="ملخص البلاغات">
                <div className="impact-intro">
                  <span className="eyebrow">مشاركة تتحول لأثر</span>
                  <h2>كل بلاغ بيفرق.</h2>
                  <span>إحصاءات بيانات العرض التجريبي</span>
                </div>
                <div className="impact-stat">
                  <span className="stat-icon">
                    <ClipboardList size={23} />
                  </span>
                  <div>
                    <strong>{number(reports.length)}</strong>
                    <span>بلاغ على المنصة</span>
                  </div>
                </div>
                <div className="impact-stat">
                  <span className="stat-icon green">
                    <CheckCircle2 size={23} />
                  </span>
                  <div>
                    <strong>{number(resolved)}</strong>
                    <span>مشكلة تم حلها</span>
                  </div>
                </div>
                <div className="impact-stat">
                  <span className="stat-icon amber">
                    <Clock3 size={23} />
                  </span>
                  <div>
                    <strong>{number(progress)}</strong>
                    <span>بلاغ جاري العمل عليه</span>
                  </div>
                </div>
              </section>
              <section className="nearby-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">اعرف اللي بيحصل حواليك</span>
                    <h2>شارعك على الخريطة</h2>
                    <p>شاهد المشكلات القريبة، وتابع التغيير خطوة بخطوة.</p>
                  </div>
                  <button className="button secondary" onClick={() => navigate('map')}>
                    استكشف الخريطة
                    <ArrowUpLeft size={17} />
                  </button>
                </div>
                <div className="home-map-wrap">
                  <PublicMap reports={reports} onSelect={setSelected} />
                  <div className="map-summary-card">
                    <span className="map-summary-icon">
                      <MapPin size={23} />
                    </span>
                    <span className="eyebrow">نطاق النسخة الأولى</span>
                    <h3>القاهرة، بداية الحكاية.</h3>
                    <p>مساهمة بسيطة منك تساعد في توثيق المشكلة ومتابعة حلّها.</p>
                    <div className="summary-divider" />
                    <span className="summary-foot">
                      <ShieldCheck size={16} />
                      بلاغات عامة بدون بيانات شخصية
                    </span>
                    <button className="text-button" onClick={() => navigate('map')}>
                      عرض البلاغات
                      <ArrowLeft size={16} />
                    </button>
                  </div>
                </div>
              </section>
              <section className="recent-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">من شوارعنا</span>
                    <h2>آخر البلاغات</h2>
                  </div>
                  <button className="text-button" onClick={() => navigate('map')}>
                    كل البلاغات
                    <ArrowLeft size={17} />
                  </button>
                </div>
                {loading ? (
                  <div className="loading-state">
                    <LoaderCircle className="spin" />
                    جارٍ تحميل البلاغات…
                  </div>
                ) : reports.length ? (
                  <div className="report-grid">
                    {reports.slice(0, 3).map((report) => (
                      <ReportCard key={report.id} report={report} onSelect={setSelected} />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}
              </section>
              <section className="community-banner">
                <span className="feature-icon">
                  <Route size={28} />
                </span>
                <div>
                  <h2>الطريق مسؤوليتنا كلنا.</h2>
                  <p>«وتُميطُ الأذى عن الطريق صدقة»</p>
                </div>
                <button className="button primary" onClick={() => setCreate(true)}>
                  ابدأ بمشاركة
                  <ArrowLeft size={17} />
                </button>
              </section>
            </>
          )}
          {view === 'map' && (
            <>
              <div className="page-heading">
                <span className="eyebrow">المشهد من حولك</span>
                <h1>خريطة البلاغات</h1>
                <p>بلاغات موثقة، متابعة واضحة، وبيانات شخصية تظل خاصة.</p>
              </div>
              <div className="map-page-toolbar">
                <div className="filter-tabs">
                  {[
                    ['all', 'كل البلاغات'],
                    ['open', 'بلاغات مفتوحة'],
                    ['in_progress', 'جاري العمل'],
                    ['resolved', 'تم الحل'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={status === value ? 'active' : ''}
                      onClick={() => setStatus(value!)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span>
                  <MapPin size={16} />
                  القاهرة <b>{number(filtered.length)} بلاغ</b>
                </span>
              </div>
              <PublicMap reports={filtered} onSelect={setSelected} />
              <div className="map-page-reports">
                <div className="section-heading">
                  <h2>البلاغات في هذا العرض</h2>
                  <span className="muted">الإحداثيات العامة تقريبية</span>
                </div>
                {filtered.length ? (
                  <div className="report-grid">
                    {filtered.map((report) => (
                      <ReportCard key={report.id} report={report} onSelect={setSelected} />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>
            </>
          )}
          {view === 'my' && (
            <>
              <div className="page-heading">
                <span className="eyebrow">مشاركتك وأثرها</span>
                <h1>بلاغاتي</h1>
                <p>تابع كل خطوة من تسجيل البلاغ إلى توثيق الحل.</p>
              </div>
              {user?.role === 'citizen' ? (
                mine.length ? (
                  <div className="report-grid">
                    {mine.map((report) => (
                      <ReportCard key={report.id} report={report} onSelect={setSelected} />
                    ))}
                  </div>
                ) : (
                  <div className="my-empty">
                    <EmptyState
                      title="أول مساهمة تبدأ منك"
                      description="لم تسجّل أي بلاغات بعد. لو لاحظت مشكلة في الطريق، وثّقها بصورة."
                    />
                    <button className="button primary" onClick={() => setCreate(true)}>
                      <Plus size={18} />
                      إنشاء أول بلاغ
                    </button>
                  </div>
                )
              ) : (
                <div className="my-empty">
                  <span className="feature-icon large">
                    <ShieldCheck size={35} />
                  </span>
                  <h2>بلاغاتك في مكان واحد</h2>
                  <p>استخدم حساب مواطن تجريبي لإنشاء بلاغاتك ومتابعتها.</p>
                  <button className="button primary" onClick={() => setCreate(true)}>
                    متابعة عبر مصر الرقمية
                    <ArrowLeft size={18} />
                  </button>
                  <span className="microcopy">محاكاة مستقلة. لا يوجد اتصال بخدمة هوية حكومية.</span>
                </div>
              )}
            </>
          )}
        </main>
      )}
      <footer className="site-footer">
        <div>
          <Brand />
          <p>بنية مفتوحة لمشاركة تصنع طريقًا أأمن.</p>
        </div>
        <div>
          <span>بلاعة · مشروع مجتمعي مفتوح المصدر</span>
          <small>نسخة تجريبية. الهوية والحدود والإشعارات للعرض فقط.</small>
        </div>
        <button onClick={() => setOnboarding(true)}>
          عن المبادرة
          <ArrowUpLeft size={15} />
        </button>
      </footer>
      {create && (
        <CreateReport
          user={user}
          categories={categories}
          onLogin={setUser}
          onClose={() => {
            setCreate(false);
            void refresh();
          }}
          onSubmitted={(report) => {
            setCreate(false);
            setSelected(report);
            void refresh();
          }}
        />
      )}
      {selected && (
        <ReportDetail
          report={selected}
          user={user}
          onClose={() => setSelected(null)}
          onUpdate={refresh}
        />
      )}{' '}
      {onboarding && (
        <div className="modal-backdrop" onClick={() => setOnboarding(false)}>
          <section
            className="onboarding-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-top">
              <Brand />
              <button
                className="icon-button"
                aria-label="إغلاق"
                onClick={() => setOnboarding(false)}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id="onboarding-title">
              بلاغ بسيط.
              <br />
              أثر نقدر نتابعه.
            </h2>
            <p>بلاعة مبادرة مستقلة لتوثيق مشكلات الطرق وتسهيل متابعتها.</p>
            <div className="onboarding-steps">
              {[
                { icon: Plus, title: 'صوّر وبلّغ', text: 'صورة للمشكلة مع موقعها ونوعها.' },
                {
                  icon: MapPin,
                  title: 'نعرف الحي المختص',
                  text: 'نربط الموقع بحدود الحي وننشئ رقم متابعة.',
                },
                {
                  icon: CheckCircle2,
                  title: 'تابع لحد الحل',
                  text: 'حالة واضحة، وسجل متابعة، وصور قبل وبعد.',
                },
              ].map((item, index) => (
                <div key={item.title}>
                  <span className="feature-icon">
                    <item.icon size={23} />
                  </span>
                  <div>
                    <h3>
                      <span>0{index + 1}</span>
                      {item.title}
                    </h3>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="notice">
              النسخة الحالية تجربة مفتوحة المصدر: التحقق من الهوية محاكاة، وحدود الأحياء توضيحية،
              والإشعارات محفوظة بصندوق اختبار.
            </div>
            <button
              className="button primary full"
              onClick={() => {
                setOnboarding(false);
                setCreate(true);
              }}
            >
              خلّي مشاركتك أول خطوة
              <ArrowLeft size={18} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
