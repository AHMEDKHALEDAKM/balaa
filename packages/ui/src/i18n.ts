import { english, arabicCorrections } from './messages';
export type Language = 'ar' | 'en';
export const localeFor = (language: Language) => (language === 'ar' ? 'ar-EG' : 'en-GB');
export function translate(
  source: string | undefined | null,
  language: Language,
  ...values: (string | number)[]
): string {
  if (source == null) return '';
  const catalog = language === 'en' ? english : arabicCorrections;
  const normalized = source.replace(/\s+/g, ' ').trim();
  const copy =
    catalog[source] ??
    (catalog[normalized] === undefined
      ? source
      : `${source.match(/^\s*/)?.[0] ?? ''}${catalog[normalized]}${source.match(/\s*$/)?.[0] ?? ''}`);
  return copy.replace(/\{(\d+)\}/g, (match, index) => String(values[Number(index)] ?? match));
}
export function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
export function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}
