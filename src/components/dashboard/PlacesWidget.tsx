import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import 'leaflet/dist/leaflet.css';

export const PlacesWidget: React.FC<{preview?: boolean}> = ({preview = false}) => {
  const tasks = useStore(s => s.tasks);
  const nav = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [mapError, setMapError] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, CircleMarker>());
  const pendingPlace = useRef<string | null>(null);
  const places = useMemo(() => tasks.filter(t => t.status === 'active' && !!t.place_name)
    .sort((a,b) => a.date.localeCompare(b.date)), [tasks]);
  const mapped = useMemo(() => places.filter(t => typeof t.place_lat === 'number' && Number.isFinite(t.place_lat) && Math.abs(t.place_lat) <= 90 && typeof t.place_lon === 'number' && Number.isFinite(t.place_lon) && Math.abs(t.place_lon) <= 180), [places]);
  const mappedIds = useMemo(() => new Set(mapped.map(t => t.id)), [mapped]);
  useEffect(() => {
    if (!enabled || !host.current || !mapped.length || preview) return;
    let disposed = false; let map: LeafletMap | null = null; let resizeObserver: ResizeObserver | null = null;
    setMapError(false);
    void import('leaflet').then(L => {
      if (disposed || !host.current) return;
      map = L.map(host.current, {zoomControl:true, scrollWheelZoom:false}); mapRef.current = map;
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(map);
      tiles.on('tileerror', () => setMapError(true));
      let selected: { point: [number, number]; marker: ReturnType<typeof L.circleMarker> } | null = null;
      const points = mapped.map(task => {
        const point: [number, number] = [task.place_lat!, task.place_lon!];
        const content = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = task.title;
        const place = document.createElement('div'); place.textContent = task.place_name ?? '';
        content.append(title, place);
        const marker = L.circleMarker(point, {radius:8, color:'#ffffff', weight:2, fillColor:'#4c70c8', fillOpacity:1}).bindPopup(content).addTo(map!);
        markersRef.current.set(task.id, marker);
        if (task.id === pendingPlace.current) selected = {point, marker};
        return point;
      });
      if (points.length === 1) map.setView(points[0], 14); else map.fitBounds(L.latLngBounds(points), {padding:[24,24], maxZoom:14});
      if (selected) {
        const target = selected as { point: [number, number]; marker: ReturnType<typeof L.circleMarker> };
        map.setView(target.point, 15);
        target.marker.openPopup();
        pendingPlace.current = null;
      }
      resizeObserver = new ResizeObserver(() => { if (!disposed) map?.invalidateSize({ pan: false }); });
      resizeObserver.observe(host.current);
      requestAnimationFrame(() => { if (!disposed) map?.invalidateSize(); });
    }).catch(() => setMapError(true));
    return () => {disposed = true; resizeObserver?.disconnect(); map?.remove(); mapRef.current = null; markersRef.current.clear();};
  }, [enabled, mapped, preview]);
  return <section className="h-full rounded-xl bg-bg-card border border-border p-4 flex flex-col overflow-auto" aria-label="Места задач">
    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent"/><h3 className="font-semibold text-text">Места задач</h3></div>
    {places.length === 0 ? <p className="mt-3 text-sm text-text-muted">У активных задач пока нет мест. Добавьте место в списке задач.</p> : <>
      <ul className="mt-3 space-y-2 text-sm">
        {places.map(t => <li key={t.id} className="flex items-start justify-between gap-2 border-b border-border-soft pb-2">
          <span className="min-w-0"><strong className="block truncate font-medium">{t.title}</strong><span className="text-text-muted">{t.place_name} · {t.date}</span></span>
          {mappedIds.has(t.id) && !preview ? <button type="button" className="text-accent text-xs shrink-0" onClick={() => {if (enabled && mapRef.current) {mapRef.current.setView([t.place_lat!, t.place_lon!], 15); markersRef.current.get(t.id)?.openPopup();} else {pendingPlace.current = t.id; setEnabled(true);}}}>На карте</button> : !mappedIds.has(t.id) ? <span className="text-xs text-text-dim">Добавьте координаты в задаче</span> : null}
        </li>)}
      </ul>
      {mapped.length > 0 && !enabled && !preview && <button type="button" onClick={() => setEnabled(true)} className="mt-3 text-left text-sm text-accent">Показать карту</button>}
      {mapped.length > 0 && !enabled && <p className="mt-1 text-xs text-text-muted">При открытии OpenStreetMap получит запросы на область карты и IP-адрес устройства. Названия задач не отправляются.</p>}
      {enabled && mapped.length > 0 && !preview && <><div ref={host} className="mt-3 min-h-[200px] w-full flex-1 rounded-lg" aria-label="Карта мест" />{mapError && <p role="status" className="text-xs text-text-muted mt-2">Карту не удалось загрузить. Список мест доступен без сети.</p>}</>}
    </>}
    <button type="button" className="mt-auto pt-3 text-left text-xs text-text-muted hover:text-accent" onClick={() => nav('/tasks')}>Управлять местами в задачах</button>
  </section>;
};
