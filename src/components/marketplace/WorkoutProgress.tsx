import { useMemo, useRef, useState } from 'react';
import { TrendingDown, Flame, Dumbbell, Timer, ImagePlus, X } from 'lucide-react';
import type { HealthLog } from '@/lib/types';
import { ECharts } from '@/components/charts/ECharts';
import { compressImage } from '@/lib/imageCompress';

interface Photos { before?: string; after?: string }

/** Прогресс и замеры: график веса (healthLogs), статистика тренировок, фото «до/после». */
export const WorkoutProgress: React.FC<{ programId: string; healthLogs: HealthLog[]; streak: number }> = ({ programId, healthLogs, streak }) => {
  const photosKey = `hub.photos.${programId}`;
  const [photos, setPhotos] = useState<Photos>(() => {
    try { return JSON.parse(localStorage.getItem(photosKey) || '{}'); } catch { return {}; }
  });
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const weights = useMemo(
    () => healthLogs.filter((l) => l.metric === 'weight' && l.value > 0).sort((a, b) => a.date.localeCompare(b.date)),
    [healthLogs],
  );

  const stats = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    const monthW = healthLogs.filter((l) => l.metric === 'workout' && l.value > 0 && l.date.startsWith(ym));
    return {
      count: new Set(monthW.map((l) => l.date)).size,
      minutes: monthW.reduce((s, l) => s + l.value, 0),
    };
  }, [healthLogs]);

  const weightDelta = weights.length >= 2 ? weights[weights.length - 1].value - weights[0].value : 0;

  const savePhoto = async (which: keyof Photos, file: File | undefined) => {
    if (!file) return;
    try {
      const url = await compressImage(file, 640, 0.7);
      const next = { ...photos, [which]: url };
      setPhotos(next);
      localStorage.setItem(photosKey, JSON.stringify(next));
    } catch { /* не удалось — не критично */ }
  };
  const clearPhoto = (which: keyof Photos) => {
    const next = { ...photos }; delete next[which];
    setPhotos(next);
    localStorage.setItem(photosKey, JSON.stringify(next));
  };

  const chartOption = {
    grid: { left: 40, right: 12, top: 12, bottom: 24 },
    xAxis: { type: 'category', data: weights.map((w) => w.date.slice(5)), axisLabel: { fontSize: 10 }, boundaryGap: false },
    yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 10, formatter: '{value}' }, splitLine: { lineStyle: { opacity: 0.15 } } },
    tooltip: { trigger: 'axis' },
    series: [{
      type: 'line', smooth: true, data: weights.map((w) => w.value),
      lineStyle: { color: '#8b5cf6', width: 2 }, itemStyle: { color: '#8b5cf6' },
      areaStyle: { color: 'rgba(139,92,246,0.12)' }, symbolSize: 5,
    }],
  };

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat icon={<Dumbbell className="h-4 w-4" />} value={String(stats.count)} label="тренировок в этом месяце" />
        <Stat icon={<Timer className="h-4 w-4" />} value={`${stats.minutes}`} label="минут за месяц" />
        <Stat icon={<Flame className="h-4 w-4" />} value={String(streak)} label="дней стрик" />
      </div>

      {/* График веса */}
      <div className="rounded-xl border border-border-soft bg-bg-card p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-text">Динамика веса</span>
          {weights.length >= 2 && (
            <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${weightDelta <= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
              <TrendingDown className="h-3.5 w-3.5" /> {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} кг
            </span>
          )}
        </div>
        {weights.length >= 2
          ? <ECharts option={chartOption} height={180} />
          : <div className="py-10 text-center text-[12px] text-text-dim">Отмечай вес каждый день — здесь появится график динамики.</div>}
      </div>

      {/* Фото до/после */}
      <div className="grid grid-cols-2 gap-2.5">
        <PhotoSlot label="До" url={photos.before} onPick={() => beforeRef.current?.click()} onClear={() => clearPhoto('before')} />
        <PhotoSlot label="После" url={photos.after} onPick={() => afterRef.current?.click()} onClear={() => clearPhoto('after')} />
      </div>
      <input ref={beforeRef} type="file" accept="image/*" className="hidden" onChange={(e) => { savePhoto('before', e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={afterRef} type="file" accept="image/*" className="hidden" onChange={(e) => { savePhoto('after', e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="rounded-xl border border-border-soft bg-bg-card p-3 text-center">
    <div className="flex items-center justify-center text-accent mb-1">{icon}</div>
    <div className="text-xl font-black text-text tabular-nums">{value}</div>
    <div className="text-[10px] text-text-muted leading-tight mt-0.5">{label}</div>
  </div>
);

const PhotoSlot: React.FC<{ label: string; url?: string; onPick: () => void; onClear: () => void }> = ({ label, url, onPick, onClear }) => (
  <div className="relative rounded-xl border border-border-soft bg-bg-card overflow-hidden">
    <div className="absolute top-2 left-2 z-10 rounded-md bg-black/50 text-white px-1.5 py-0.5 text-[10px] font-semibold">{label}</div>
    {url ? (
      <>
        <img src={url} alt={label} className="w-full h-40 object-cover" />
        <button onClick={onClear} className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"><X className="h-3.5 w-3.5" /></button>
      </>
    ) : (
      <button onClick={onPick} className="w-full h-40 flex flex-col items-center justify-center gap-1.5 text-text-dim hover:text-text-muted hover:bg-bg-hover">
        <ImagePlus className="h-6 w-6" />
        <span className="text-[11px]">Добавить фото</span>
      </button>
    )}
  </div>
);
