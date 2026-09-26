'use client';
import { useLocale } from '@balaa/ui/locale';
export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  return (
    <span className="brand">
      <img className="brand-logo" src="/brand/balaa-logo.png" alt="" width={64} height={64} />
      {!compact && (
        <span>
          {t('بلاعة')}
          <span className="brand-english">BALAA</span>
        </span>
      )}
    </span>
  );
}
