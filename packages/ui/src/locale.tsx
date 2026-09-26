'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translate, formatDate, formatNumber, localeFor, type Language } from './i18n';
export type { Language } from './i18n';
const Context = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: 'ar',
  setLanguage: () => {},
});
export function LocaleProvider({
  language,
  setLanguage,
  children,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLocale() {
  const context = useContext(Context);
  return useMemo(
    () => ({
      ...context,
      locale: localeFor(context.language),
      isArabic: context.language === 'ar',
      t: (source: string | undefined | null, ...values: (string | number)[]) =>
        translate(source, context.language, ...values),
      date: (value: string) => formatDate(value, context.language),
      dateLabel: (value: string) => formatDate(value, context.language),
      number: (value: number) => formatNumber(value, context.language),
      bilingual: (ar: string | undefined, en: string | undefined) =>
        context.language === 'en' ? en || translate(ar, 'en') : translate(ar, 'ar'),
    }),
    [context],
  );
}
