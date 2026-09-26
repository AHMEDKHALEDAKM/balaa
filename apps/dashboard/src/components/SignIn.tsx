'use client';
import { useLocale } from '@balaa/ui/locale';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  IdCard,
  LoaderCircle,
  Mail,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Brand } from './Brand';
import { LanguageSwitch } from './LanguageProvider';
import { api, User } from './model';
import { useDialog } from './useDialog';

type Step = 'start' | 'verifying' | 'verified' | 'profile';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Citizen sign-in. The Digital Egypt button shows how the real integration is meant to
 * work; in this version it signs in straight away (no government system is contacted).
 */
export default function SignIn({
  onSignedIn,
  onGuest,
  reason,
}: {
  onSignedIn: (user: User) => void;
  onGuest: () => void;
  reason?: 'report';
}) {
  const { t } = useLocale();
  useDialog(true, onGuest);
  const [step, setStep] = useState<Step>('start');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (step === 'verifying') {
      const timer = setTimeout(() => setStep('verified'), 1300);
      return () => clearTimeout(timer);
    }
    if (step === 'verified') {
      const timer = setTimeout(() => setStep('profile'), 900);
      return () => clearTimeout(timer);
    }
  }, [step]);
  const validName = name.trim().length >= 2;
  const validEmail = emailPattern.test(email.trim());
  async function finish() {
    setError('');
    if (!validName || !validEmail) {
      setError(t('اكتب اسمك وبريدًا إلكترونيًا صحيحًا.'));
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ user: User }>('/api/auth/mock', {
        name: name.trim(),
        email: email.trim(),
      });
      onSignedIn(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="signin-screen" role="dialog" aria-modal="true" aria-labelledby="signin-title">
      <div className="signin-top">
        <LanguageSwitch />
        <button className="icon-button" aria-label={t('إغلاق')} onClick={onGuest}>
          <X size={20} />
        </button>
      </div>
      <div className="signin-body">
        <div className="signin-brand">
          <Brand />
          <p>{t('بلّغ. تابع. خلّي الطريق أأمن.')}</p>
        </div>
        {step === 'start' && (
          <section className="signin-card">
            <h1 id="signin-title">
              {reason === 'report' ? t('سجّل الدخول لإرسال بلاغك') : t('أهلًا بك في بلاعة')}
            </h1>
            <p>
              {t('سجّل دخولك بهويتك الرقمية للإبلاغ عن مشكلات الطريق ومتابعة حلها خطوة بخطوة.')}
            </p>
            <button className="digital-egypt-button" onClick={() => setStep('verifying')}>
              <span className="de-icon">
                <IdCard size={22} />
              </span>
              <span>{t('الدخول عبر مصر الرقمية')}</span>
              <span className="de-pill">{t('تجريبي')}</span>
            </button>
            <div className="signin-divider">
              <span>{t('أو')}</span>
            </div>
            <button className="button ghost full" onClick={onGuest}>
              {t('تصفح البلاغات بدون تسجيل')}
            </button>
            <small className="signin-legal">
              {t(
                'نسخة تجريبية: زر مصر الرقمية للعرض فقط ولا يتصل بأي جهة حكومية. لا نطلب رقمك القومي.',
              )}
            </small>
          </section>
        )}
        {(step === 'verifying' || step === 'verified') && (
          <section className="signin-card signin-progress" role="status">
            {step === 'verifying' ? (
              <LoaderCircle className="spin" size={42} />
            ) : (
              <BadgeCheck className="teal" size={46} />
            )}
            <h1 id="signin-title">
              {step === 'verifying'
                ? t('جارٍ التحقق من هويتك…')
                : t('تم التحقق التجريبي من الهوية ✓')}
            </h1>
            <p>{t('مصر الرقمية')}</p>
          </section>
        )}
        {step === 'profile' && (
          <section className="signin-card">
            <span className="verified-chip">
              <BadgeCheck size={16} />
              {t('هوية موثقة')}
            </span>
            <h1 id="signin-title">{t('أكمل بياناتك')}</h1>
            <p>{t('خطوة أخيرة لنرسل لك تحديثات بلاغاتك.')}</p>
            <label className="field-label" htmlFor="signin-name">
              {t('الاسم')}
            </label>
            <div className="input-with-icon">
              <UserIcon size={18} />
              <input
                id="signin-name"
                autoComplete="name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('اسمك كما تحب أن نناديك')}
              />
            </div>
            <label className="field-label" htmlFor="signin-email">
              {t('البريد الإلكتروني')}
            </label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                id="signin-email"
                type="email"
                dir="ltr"
                inputMode="email"
                autoComplete="email"
                value={email}
                maxLength={160}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <small className="signin-legal">
              {t('نستخدم بريدك لإرسال تحديثات بلاغاتك فقط. لا يظهر اسمك أو بريدك للحي أو للعامة.')}
            </small>
            {error && (
              <p className="form-error" role="alert">
                {t(error)}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || !validName || !validEmail}
              onClick={finish}
            >
              {busy ? <LoaderCircle className="spin" size={18} /> : null}
              {t('ابدأ')}
              <ArrowLeft size={18} />
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
