import { Volume2, Pause, Play, VolumeX } from 'lucide-react';
import { useSoundscape, LAYERS, MIX_PRESETS } from '@/lib/soundscape';

/** Виджет «Атмосфера»: генеративные звуки природы. Общий движок с Focus Mode —
 *  звук продолжается и вне фокуса, управляется из обоих мест. */
export const SoundscapeWidget: React.FC = () => {
  const { mix, master, paused, setLayer, setMaster, applyPreset, stopAll, togglePause } = useSoundscape();
  const anySound = Object.keys(mix).length > 0;

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border-soft shadow-card p-4 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 shrink-0 mb-3">
        <Volume2 className="h-4 w-4 text-accent shrink-0" />
        <span className="text-sm font-semibold text-text truncate flex-1">Атмосфера</span>
        <button onClick={togglePause} disabled={!anySound} className="h-7 w-7 rounded-lg hover:bg-bg-soft flex items-center justify-center text-text-muted hover:text-text disabled:opacity-30" title={paused ? 'Продолжить' : 'Пауза'}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
        <button onClick={stopAll} disabled={!anySound} className="h-7 w-7 rounded-lg hover:bg-bg-soft flex items-center justify-center text-text-muted hover:text-danger disabled:opacity-30" title="Стоп">
          <VolumeX className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Пресеты */}
      <div className="flex flex-wrap gap-1.5 shrink-0 mb-3">
        {MIX_PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p.mix)} className="rounded-full bg-bg-soft hover:bg-bg-hover border border-border-soft px-2.5 py-1 text-[11px] text-text-muted hover:text-text transition-colors">
            {p.label}
          </button>
        ))}
      </div>

      {/* Слои */}
      <div className="flex-1 min-h-0 overflow-auto space-y-2 pr-1">
        {LAYERS.map((l) => {
          const vol = mix[l.key] ?? 0;
          const active = vol > 0;
          return (
            <div key={l.key} className="flex items-center gap-2.5">
              <button
                onClick={() => setLayer(l.key, active ? 0 : 0.6)}
                className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-accent/15 text-accent' : 'bg-bg-soft text-text-dim hover:text-text-muted'}`}
                title={l.label}
              >
                <l.icon className="h-3.5 w-3.5" />
              </button>
              <span className={`w-20 shrink-0 text-xs ${active ? 'text-text' : 'text-text-muted'}`}>{l.label}</span>
              <input type="range" min="0" max="1" step="0.05" value={vol} onChange={(e) => setLayer(l.key, Number(e.target.value))} className="w-full accent-accent" />
            </div>
          );
        })}
      </div>

      {/* Общая громкость */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border-soft shrink-0">
        <Volume2 className="h-4 w-4 text-text-muted shrink-0" />
        <span className="text-xs text-text-muted w-16 shrink-0">Общая</span>
        <input type="range" min="0" max="1" step="0.05" value={master} onChange={(e) => setMaster(Number(e.target.value))} className="w-full accent-accent" />
      </div>
    </div>
  );
};
