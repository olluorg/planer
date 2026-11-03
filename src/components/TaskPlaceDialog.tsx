import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Task } from '@/lib/types';
import { useStore } from '@/lib/store';
import { parsePlaceCoordinates } from '@/lib/placeCoordinates';

export const TaskPlaceDialog: React.FC<{task: Task; onClose: () => void}> = ({task, onClose}) => {
  const updateTask = useStore((s) => s.updateTask);
  const [name, setName] = useState(task.place_name ?? '');
  const [lat, setLat] = useState(task.place_lat == null ? '' : String(task.place_lat));
  const [lon, setLon] = useState(task.place_lon == null ? '' : String(task.place_lon));
  const [error, setError] = useState('');
  const [coordinateInput, setCoordinateInput] = useState('');
  const fillCoordinates = () => {
    const point = parsePlaceCoordinates(coordinateInput);
    if (!point) { setError('Не удалось прочитать координаты. Вставьте широту и долготу или ссылку OpenStreetMap.'); return; }
    setLat(String(point.lat)); setLon(String(point.lon)); setError('');
  };
  const save = () => {
    const title = name.trim();
    const hasLat = lat.trim() !== '', hasLon = lon.trim() !== '';
    const latitude = Number(lat.trim().replace(',', '.')), longitude = Number(lon.trim().replace(',', '.'));
    if ((hasLat || hasLon) && !title) { setError('Укажите название места.'); return; }
    if (hasLat !== hasLon || (hasLat && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180))) {
      setError('Укажите обе координаты: широта от −90 до 90, долгота от −180 до 180.'); return;
    }
    updateTask(task.id, {place_name: title || null, place_lat: hasLat ? latitude : null, place_lon: hasLon ? longitude : null});
    onClose();
  };
  return <Dialog open onOpenChange={(v) => {if (!v) onClose();}}>
    <DialogContent>
      <DialogHeader><DialogTitle>Место: {task.title}</DialogTitle></DialogHeader>
      <p className="text-sm text-text-muted">Название хранится в задаче. Координаты нужны, чтобы показать её на карте; их можно добавить позже.</p>
      <label className="block text-sm">Место или адрес<Input className="mt-1" value={name} onChange={e=>setName(e.target.value)} placeholder="Например, библиотека" /></label>
      <label className="block text-sm">Координаты или ссылка OpenStreetMap<Input className="mt-1" value={coordinateInput} onChange={e=>setCoordinateInput(e.target.value)} placeholder="55.75, 37.62" /></label>
      <p className="text-xs text-text-muted">Для ссылки без маркера берётся центр карты. Проверьте координаты перед сохранением.</p>
      <Button variant="soft" onClick={fillCoordinates} disabled={!coordinateInput.trim()}>Заполнить координаты</Button>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Широта<Input className="mt-1" inputMode="decimal" value={lat} onChange={e=>setLat(e.target.value)} placeholder="55.75" /></label>
        <label className="block text-sm">Долгота<Input className="mt-1" inputMode="decimal" value={lon} onChange={e=>setLon(e.target.value)} placeholder="37.62" /></label>
      </div>
      {name.trim() && <a className="text-sm text-accent underline" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(name.trim())}`} target="_blank" rel="noopener noreferrer">Найти место в OpenStreetMap</a>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DialogFooter><Button variant="ghost" onClick={onClose}>Отмена</Button><Button onClick={save}>Сохранить место</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};
