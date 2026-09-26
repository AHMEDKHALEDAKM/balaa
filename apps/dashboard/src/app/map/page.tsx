'use client';
import { LanguageSwitch } from '../../components/LanguageProvider';
import { useLocale } from '@balaa/ui/locale';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Brand } from '../../components/Brand';
import PublicMap from '../../components/PublicMap';
import ReportDetail from '../../components/ReportDetail';
import { api, Report } from '../../components/model';
export default function MapPage() {
  const { t } = useLocale();
  const [focus, setFocus] = useState<{ latitude: number; longitude: number }>();
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setEmbedded(query.get('embed') === '1');
    const latitude = Number(query.get('latitude')),
      longitude = Number(query.get('longitude'));
    if (
      query.has('latitude') &&
      query.has('longitude') &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    )
      setFocus({ latitude, longitude });
    api<{ reports: Report[] }>('/api/public/reports')
      .then((result) => {
        setReports(result.reports);
        if (query.get('report'))
          setSelected(result.reports.find((report) => report.id === query.get('report')) || null);
      })
      .catch((e) => setError(e.message));
  }, []);
  function select(report: Report) {
    const bridge = (
      window as unknown as { ReactNativeWebView?: { postMessage: (message: string) => void } }
    ).ReactNativeWebView;
    if (bridge) bridge.postMessage(JSON.stringify({ type: 'report', id: report.id }));
    else setSelected(report);
  }
  return (
    <div className={`standalone-map ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <header>
          <LanguageSwitch />
          <a href="/">
            <Brand />
          </a>
          <a className="button secondary" href="/">
            <ArrowRight size={16} />
            {t('الرئيسية')}
          </a>
        </header>
      )}
      {error && (
        <div className="form-error" role="alert">
          {t(error)}
        </div>
      )}
      <PublicMap focus={focus} reports={reports} onSelect={select} selectedId={selected?.id} />
      {selected && !embedded && (
        <ReportDetail
          report={selected}
          user={null}
          onClose={() => setSelected(null)}
          onUpdate={() => undefined}
        />
      )}
    </div>
  );
}
