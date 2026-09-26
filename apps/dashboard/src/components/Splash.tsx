'use client';
import { useLocale } from '@balaa/ui/locale';
import { Amiri } from 'next/font/google';
import { useEffect, useState } from 'react';

const amiri = Amiri({ subsets: ['arabic'], weight: ['400', '700'], display: 'swap' });
export const hadith = '«وَتُمِيطُ الْأَذَى عَنِ الطَّرِيقِ صَدَقَةٌ»';
const SEEN_KEY = 'balaa_splash_seen';

/** Opening screen with the hadith, shown once each time the app is opened. */
export default function Splash() {
  const { t, language } = useLocale();
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'leaving'>('hidden');
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* Show it anyway. */
    }
    setPhase('shown');
    const leave = setTimeout(() => setPhase('leaving'), 2600);
    const done = setTimeout(() => setPhase('hidden'), 3200);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);
  if (phase === 'hidden') return null;
  return (
    <div
      className={`splash ${phase === 'leaving' ? 'splash-leaving' : ''}`}
      role="presentation"
      onClick={() => setPhase('hidden')}
    >
      <span className="splash-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path
            d="M6 7h20M6 16h20M6 25h20M9 7v18M16 7v18M23 7v18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <p className={`splash-hadith ${amiri.className}`} lang="ar" dir="rtl" aria-label={hadith}>
        <span>«وَتُمِيطُ الْأَذَى</span>
        <span>عَنِ الطَّرِيقِ صَدَقَةٌ»</span>
      </p>
      <span className="splash-source">{t('حديث شريف')}</span>
      {language === 'en' && <span className="splash-translation">{t(hadith)}</span>}
    </div>
  );
}
