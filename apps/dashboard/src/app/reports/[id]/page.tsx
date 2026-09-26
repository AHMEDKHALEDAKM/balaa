'use client';
import { LanguageSwitch } from '../../../components/LanguageProvider';
import { useLocale } from '@balaa/ui/locale';

import { use, useCallback, useEffect, useState } from 'react';
import { api, type Report, type User } from '../../../components/model';
import ReportDetail from '../../../components/ReportDetail';
import { Brand } from '../../../components/Brand';
export default function PublicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLocale();
  const { id } = use(params);
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
      <a href="/">
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
            window.location.href = '/';
          }}
          onUpdate={() => void refresh()}
        />
      )}
    </main>
  );
}
