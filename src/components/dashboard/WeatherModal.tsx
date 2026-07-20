import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';
import { getForecast, type Forecast, type Weather } from '@/lib/weather';
import { format } from 'date-fns';

const ICON: Record<Weather['kind'], React.ElementType> = {
  clear: Sun, cloudy: Cloud, fog: CloudFog, drizzle: CloudDrizzle,
  rain: CloudRain, snow: CloudSnow, storm: CloudLightning,
};

export const WeatherModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [data, setData] = useState<Forecast | null | 'loading'>('loading');

  useEffect(() => {
    if (!open) return;
    setData('loading');
    let on = true;
    void getForecast().then((f) => { if (on) setData(f); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { on = false; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-start justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[88vh] rounded-2xl bg-bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-soft shrink-0">
          <div className="text-sm font-semibold text-text flex-1">Погода · сегодня по часам</div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text shrink-0" title="Закрыть (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {data === 'loading' && <div className="py-16 text-center text-sm text-text-muted">Загружаю прогноз…</div>}
          {data === null && (
            <div className="py-16 text-center text-sm text-text-muted">
              Прогноз недоступен — разреши геолокацию в браузере, чтобы видеть погоду.
            </div>
          )}
          {data && data !== 'loading' && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {data.hourly.map((h) => {
                const Icon = ICON[h.kind];
                const d = new Date(h.time);
                return (
                  <div key={h.time} className="shrink-0 w-16 rounded-xl border border-border-soft bg-bg-soft/50 p-2.5 text-center">
                    <div className="text-[11px] text-text-muted tabular-nums">{format(d, 'HH:mm')}</div>
                    <Icon className="h-6 w-6 mx-auto my-1.5 text-accent" strokeWidth={1.75} />
                    <div className="text-sm font-semibold tabular-nums">{h.temp}°</div>
                  </div>
                );
              })}
              {data.hourly.length === 0 && <div className="text-sm text-text-dim">Нет данных</div>}
            </div>
          )}
          <p className="text-[11px] text-text-dim mt-4 text-center">Open-Meteo · без ключа, данные на твоём устройстве</p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
