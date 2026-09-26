import { describe, expect, it } from 'vitest';
import { english } from '../packages/ui/src/messages';
import { translate, formatDate, formatNumber } from '../packages/ui/src/i18n';

describe('Arabic and English interface copy', () => {
  it('preserves every interpolation placeholder in English', () => {
    for (const [source, target] of Object.entries(english)) {
      expect(target.trim(), source).not.toBe('');
      expect(target.match(/\{\d+\}/g)?.sort() ?? [], source).toEqual(
        source.match(/\{\d+\}/g)?.sort() ?? [],
      );
    }
  });
  it('corrects Arabic status grammar and distinguishes test delivery', () => {
    expect(translate('جاري العمل', 'ar')).toBe('جارٍ العمل');
    expect(translate('وصل لصندوق الاختبار', 'ar')).toBe('وصل إلى صندوق الاختبار');
    expect(translate('وصل لصندوق الاختبار', 'en')).toBe('Delivered to test inbox');
  });
  it('formats interpolated text, dates and numbers in the selected language', () => {
    expect(translate('موقع اصطناعي للعرض · ', 'en')).toBe('Synthetic demo location · ');
    expect(translate('فتح {0}', 'en', 'BLAA-000124')).toBe('Open BLAA-000124');
    expect(formatDate('2026-09-25T12:00:00Z', 'en')).toContain('September');
    expect(formatNumber(123, 'ar')).toBe('١٢٣');
    expect(formatNumber(123, 'en')).toBe('123');
  });
  it('keeps unknown text unchanged rather than inventing a translation', () => {
    expect(translate('وصف كتبه المواطن بنفسه', 'en')).toBe('وصف كتبه المواطن بنفسه');
  });
});
