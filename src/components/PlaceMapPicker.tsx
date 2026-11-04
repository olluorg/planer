import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Map tiles are requested only after the user opens this control. */
export function PlaceMapPicker({ point, onSelect }: {
  point: { lat: number; lon: number } | null;
  onSelect: (point: { lat: number; lon: number }) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const pointRef = useRef(point);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [failed, setFailed] = useState(false);
  onSelectRef.current = onSelect;
  pointRef.current = point;

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    void import('leaflet').then(L => {
      if (disposed || !host.current) return;
      map = L.map(host.current, { zoomControl: true, scrollWheelZoom: false });
      mapRef.current = map;
      leafletRef.current = L;
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      tiles.on('tileerror', () => { if (!disposed) setFailed(true); });
      const initial = pointRef.current;
      map.setView(initial ? [initial.lat, initial.lon] : [20, 0], initial ? 14 : 2);
      if (initial) markerRef.current = L.circleMarker([initial.lat, initial.lon], { radius: 8 }).addTo(map);
      map.on('click', (event) => {
        const lat = Number(event.latlng.lat.toFixed(6));
        // Leaflet repeats the world horizontally, so normalise clicks on a repeated copy.
        const lon = Number(((((event.latlng.lng + 180) % 360) + 360) % 360 - 180).toFixed(6));
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
        else markerRef.current = L.circleMarker([lat, lon], { radius: 8 }).addTo(map!);
        onSelectRef.current({ lat, lon });
      });
      requestAnimationFrame(() => { if (!disposed) map?.invalidateSize(); });
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; map?.remove(); mapRef.current = null; markerRef.current = null; leafletRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const marker = markerRef.current;
    const previous = marker?.getLatLng();
    if (previous && Math.abs(previous.lat - point.lat) < 0.0000005 && Math.abs(previous.lng - point.lon) < 0.0000005) return;
    if (marker) marker.setLatLng([point.lat, point.lon]);
    else markerRef.current = L.circleMarker([point.lat, point.lon], { radius: 8 }).addTo(map);
    map.setView([point.lat, point.lon], Math.max(map.getZoom(), 14));
  }, [point?.lat, point?.lon]);

  return <div className="space-y-2">
    <p className="text-xs text-text-muted">При открытии карты OpenStreetMap получит запросы на область карты и IP-адрес устройства. Нажмите на карту, чтобы выбрать точку.</p>
    <div ref={host} className="h-56 w-full rounded-lg overflow-hidden" aria-label="Выбор точки на карте" />
    {failed && <p role="status" className="text-xs text-text-muted">Не удалось загрузить карту. Можно ввести координаты вручную.</p>}
  </div>;
}
