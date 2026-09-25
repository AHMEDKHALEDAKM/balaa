'use client';
import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import type { Map as MapType, Marker } from 'maplibre-gl';
import { Report } from './model';
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
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<MapType | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    let disposed = false;
    import('maplibre-gl')
      .then((maplibre) => {
        if (disposed || !node.current) return;
        maplibre.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');
        const instance = new maplibre.Map({
          container: node.current,
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
          center: [31.263, 29.965],
          zoom: 13.3,
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
      instance?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    import('maplibre-gl').then((maplibre) => {
      if (disposed || !map.current) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = reports.map((report) => {
        const button = document.createElement('button');
        button.className = `map-marker ${report.status === 'resolved' ? 'marker-resolved' : report.severity === 'critical' ? 'marker-critical' : ''} ${selectedId === report.id ? 'marker-selected' : ''}`;
        button.setAttribute('aria-label', `${report.categoryLabel} ${report.publicId}`);
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
  }, [reports, ready, selectedId]);
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
  return (
    <div className={`public-map ${compact ? 'map-compact' : ''}`}>
      <div ref={node} className="map-canvas" aria-label="خريطة بلاغات القاهرة" />
      {(!ready || failed) && (
        <div className="map-loading">
          <MapPin size={24} />
          <span>
            {failed
              ? 'تعذّر تحميل بعض أجزاء الخريطة. يمكنك تصفح قائمة البلاغات.'
              : 'جارٍ تحميل خريطة الحي…'}
          </span>
        </div>
      )}
      <div className="map-area">
        <span className="live-dot" />
        القاهرة · نطاق العرض التجريبي
      </div>
      <button
        className="map-locate"
        title="العودة إلى المعادي"
        aria-label="العودة إلى المعادي"
        onClick={() => map.current?.flyTo({ center: [31.263, 29.965], zoom: 13.3 })}
      >
        <LocateFixed size={20} />
      </button>
      <div className="map-legend">
        <span>
          <i className="legend-open" />
          بلاغ مفتوح
        </span>
        <span>
          <i className="legend-critical" />
          خطر فوري
        </span>
        <span>
          <i className="legend-resolved" />
          تم الحل
        </span>
      </div>
    </div>
  );
}
