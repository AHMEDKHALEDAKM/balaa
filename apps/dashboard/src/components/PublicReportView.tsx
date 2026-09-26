'use client';
import { LanguageSwitch } from './LanguageProvider';
import { useLocale } from '@balaa/ui/locale';

import { useCallback, useEffect, useState } from 'react';
import { api, type Report, type User, withBase } from './model';
import ReportDetail from './ReportDetail';
import { Brand } from './Brand';
export default function PublicReportView({ id }: { id: string }) {
  const { t } = useLocale();
  const [report, setReport] = useState<Report | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [data, session] = await Promise.all([
        api<{ report: Report }>(`/api/public/reports/${encodeURIComponent(id)}`),
        api<{ user: User | null }>('/api/auth/session'),
      ]);
      setReport(data.report);
      setUser(session.user);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <main className="page-container">
      <LanguageSwitch />
      <a href={withBase('/')}>
        <Brand />
      </a>
      <p>{t('نسخة تجريبية مستقلة — لا يوجد تكامل حكومي.')}</p>
      {error ? (
        <p role="alert">{t(error)}</p>
      ) : !report ? (
        <p role="status">{t('جارٍ تحميل البلاغ…')}</p>
      ) : (
        <ReportDetail
          report={report}
          user={user}
          onClose={() => {
            window.location.href = withBase('/');
          }}
          onUpdate={() => void refresh()}
        />
      )}
    </main>
  );
}
