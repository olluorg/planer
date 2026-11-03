import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Map tiles are requested only after the user opens this control. */
export function PlaceMapPicker({ initial, onSelect }: {
  initial: { lat: number; lon: number } | null;
  onSelect: (point: { lat: number; lon: number }) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    let marker: CircleMarker | null = null;
    void import('leaflet').then(L => {
      if (disposed || !host.current) return;
      map = L.map(host.current, { zoomControl: true, scrollWheelZoom: false });
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      tiles.on('tileerror', () => { if (!disposed) setFailed(true); });
      map.setView(initial ? [initial.lat, initial.lon] : [20, 0], initial ? 14 : 2);
      if (initial) marker = L.circleMarker([initial.lat, initial.lon], { radius: 8 }).addTo(map);
      map.on('click', (event) => {
        const lat = Number(event.latlng.lat.toFixed(6));
        // Leaflet repeats the world horizontally, so normalise clicks on a repeated copy.
        const lon = Number(((((event.latlng.lng + 180) % 360) + 360) % 360 - 180).toFixed(6));
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        if (marker) marker.setLatLng([lat, lon]);
        else marker = L.circleMarker([lat, lon], { radius: 8 }).addTo(map!);
        onSelectRef.current({ lat, lon });
      });
      requestAnimationFrame(() => { if (!disposed) map?.invalidateSize(); });
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; map?.remove(); };
    // Initial position is read once per opening; subsequent clicks update the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="space-y-2">
    <p className="text-xs text-text-muted">При открытии карты OpenStreetMap получит запросы на область карты и IP-адрес устройства. Нажмите на карту, чтобы выбрать точку.</p>
    <div ref={host} className="h-56 w-full rounded-lg overflow-hidden" aria-label="Выбор точки на карте" />
    {failed && <p role="status" className="text-xs text-text-muted">Не удалось загрузить карту. Можно ввести координаты вручную.</p>}
  </div>;
}
