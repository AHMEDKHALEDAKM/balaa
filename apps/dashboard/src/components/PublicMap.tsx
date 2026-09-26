'use client';
import { useLocale } from '@balaa/ui/locale';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, LocateFixed, MapPin } from 'lucide-react';
import type { Map as MapType, Marker } from 'maplibre-gl';
import { Report, withBase } from './model';
export default function PublicMap({
  reports,
  onSelect,
  selectedId,
  compact = false,
  focus,
}: {
  reports: Report[];
  onSelect?: (report: Report) => void;
  selectedId?: string;
  compact?: boolean;
  focus?: { latitude: number; longitude: number };
}) {
  const { t, bilingual } = useLocale();
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<MapType | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const me = useRef<Marker | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    let disposed = false;
    setReady(false);
    import('maplibre-gl')
      .then((maplibre) => {
        if (disposed || !node.current) return;
        maplibre.setWorkerUrl(withBase('/vendor/maplibre/maplibre-gl-worker.mjs'));
        const instance = new maplibre.Map({
          container: node.current,
          locale: {
            'NavigationControl.ZoomIn': t('تكبير الخريطة'),
            'NavigationControl.ZoomOut': t('تصغير الخريطة'),
            'AttributionControl.ToggleAttribution': t('مصادر الخريطة'),
            'Map.Title': t('الخريطة'),
          },
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [
              {
                id: 'osm',
                type: 'raster',
                source: 'osm',
                paint: { 'raster-saturation': -0.75, 'raster-contrast': -0.08 },
              },
            ],
          },
          center: [31.2357, 30.0444],
          zoom: 11.2,
          attributionControl: { compact: true },
        });
        map.current = instance;
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-left');
        instance.on('load', () => {
          setReady(true);
          setFailed(false);
        });
        instance.on('error', () => setFailed(true));
        const resize = new ResizeObserver(() => instance.resize());
        resize.observe(node.current);
        (instance as MapType & { _balaaResize?: ResizeObserver })._balaaResize = resize;
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      const instance = map.current as (MapType & { _balaaResize?: ResizeObserver }) | null;
      instance?._balaaResize?.disconnect();
      markers.current.forEach((marker) => marker.remove());
      me.current?.remove();
      me.current = null;
      instance?.remove();
      map.current = null;
    };
  }, [t]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    import('maplibre-gl').then((maplibre) => {
      if (disposed || !map.current) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = reports.map((report) => {
        const button = document.createElement('button');
        button.className = `map-marker ${report.status === 'resolved' ? 'marker-resolved' : report.severity === 'critical' ? 'marker-critical' : ''} ${selectedId === report.id ? 'marker-selected' : ''}`;
        button.setAttribute(
          'aria-label',
          `${bilingual(report.categoryLabel, report.categoryLabelEn)} ${report.publicId}`,
        );
        button.innerHTML =
          report.status === 'resolved'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 12 4 4 8-8"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 7h14M5 12h14M5 17h14M8 7v10M16 7v10"/></svg>';
        button.addEventListener('click', () => selectRef.current?.(report));
        return new maplibre.Marker({ element: button })
          .setLngLat([report.longitude, report.latitude])
          .addTo(map.current!);
      });
    });
    return () => {
      disposed = true;
    };
  }, [reports, ready, selectedId, bilingual]);
  useEffect(() => {
    if (!ready || !map.current || !focus) return;
    let marker: Marker | undefined;
    let disposed = false;
    map.current.flyTo({ center: [focus.longitude, focus.latitude], zoom: 16 });
    import('maplibre-gl').then((m) => {
      if (!disposed && map.current)
        marker = new m.Marker({ color: '#087e78' })
          .setLngLat([focus.longitude, focus.latitude])
          .addTo(map.current);
    });
    return () => {
      disposed = true;
      marker?.remove();
    };
  }, [ready, focus]);
  /** Centres the map on the phone's real GPS position and marks it with a blue dot. */
  function locateMe() {
    setLocateError('');
    if (!navigator.geolocation) {
      setLocateError(t('المتصفح لا يدعم تحديد الموقع.'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = position.coords;
        if (!map.current) return;
        map.current.flyTo({
          center: [longitude, latitude],
          zoom: accuracy > 500 ? 14 : 16.5,
        });
        void import('maplibre-gl').then((maplibre) => {
          if (!map.current) return;
          if (!me.current) {
            const dot = document.createElement('span');
            dot.className = 'map-me';
            dot.setAttribute('aria-label', t('موقعك الحالي'));
            me.current = new maplibre.Marker({ element: dot });
          }
          me.current.setLngLat([longitude, latitude]).addTo(map.current);
        });
      },
      (error) => {
        setLocating(false);
        setLocateError(
          error.code === error.PERMISSION_DENIED
            ? t('اسمح للتطبيق بالوصول إلى موقعك من إعدادات المتصفح أو الهاتف.')
            : t('تعذّر تحديد موقعك. تأكد من تشغيل الـ GPS وحاول مرة أخرى.'),
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }
  return (
    <div className={`public-map ${compact ? 'map-compact' : ''}`}>
      <div ref={node} className="map-canvas" aria-label={t('خريطة بلاغات القاهرة')} />
      {(!ready || failed) && (
        <div className="map-loading">
          <MapPin size={24} />
          <span>
            {failed
              ? t('تعذّر تحميل بعض أجزاء الخريطة. يمكنك تصفح قائمة البلاغات.')
              : t('جارٍ تحميل خريطة الحي…')}
          </span>
        </div>
      )}
      <div className="map-area">
        <span className="live-dot" />
        {t('القاهرة')}
      </div>
      <button
        className="map-locate"
        title={t('موقعي')}
        aria-label={t('موقعي')}
        onClick={locateMe}
        disabled={locating}
      >
        {locating ? <LoaderCircle className="spin" size={20} /> : <LocateFixed size={20} />}
      </button>
      {locateError && (
        <p className="map-locate-error" role="alert">
          {locateError}
        </p>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-open" />
          {t('بلاغ مفتوح')}
        </span>
        <span>
          <i className="legend-critical" />
          {t('خطر فوري')}
        </span>
        <span>
          <i className="legend-resolved" />
          {t('تم الحل')}
        </span>
      </div>
    </div>
  );
}
