'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LocaleProvider, useLocale, type Language } from '@balaa/ui/locale';
export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('lang');
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('balaa.language');
    } catch {
      /* Storage can be disabled. */
    }
    setLanguageState(query === 'en' || query === 'ar' ? query : saved === 'en' ? 'en' : 'ar');
  }, []);
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem('balaa.language', next);
    } catch {
      /* The switch still works. */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(window.history.state, '', url);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);
  return (
    <LocaleProvider language={language} setLanguage={setLanguage}>
      {children}
    </LocaleProvider>
  );
}
export function LanguageSwitch() {
  const { language, setLanguage } = useLocale();
  return (
    <button
      className="language-switch"
      type="button"
      lang={language === 'ar' ? 'en' : 'ar'}
      aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
    >
      {language === 'ar' ? 'EN' : 'العربية'}
    </button>
  );
}
