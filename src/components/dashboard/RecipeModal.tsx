import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Youtube, Flame, Utensils, CheckCircle2 } from 'lucide-react';
import { renderTemplate, type PluginWidgetDef, type PluginRow } from '@/lib/plugins';
import { parseYouTubeId } from '@/components/LiveWallpaper';
import { isEaten, toggleEaten } from '@/lib/nutrition';
import { isoDate } from '@/lib/utils';

/** Локальные пути (внешние URL отсекаются). */
const localPaths = (v: unknown): string[] =>
  typeof v === 'string'
    ? v.split(',').map((s) => s.trim()).filter((s) => s.startsWith('/') && !s.startsWith('//'))
    : [];

/** Разбивка текста рецепта на шаги: по строкам, служебную строку с ккал отделяем. */
function parseSteps(text: string): { steps: string[]; nutrition: string | null } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const nutrition = lines.find((l) => /ккал|белка|бжу/i.test(l)) ?? null;
  const steps = lines.filter((l) => l !== nutrition);
  return { steps, nutrition };
}

/** Полноценная страница рецепта: галерея/видео + подробные шаги + питательность. */
export const RecipeModal: React.FC<{ def: PluginWidgetDef; row: PluginRow | null; onClose: () => void }> = ({ def, row, onClose }) => {
  const [tab, setTab] = useState<'photo' | 'video'>('photo');
  const [imgIdx, setImgIdx] = useState(0);
  const today = isoDate(new Date());

  useEffect(() => {
    setTab('photo'); setImgIdx(0);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [row, onClose]);

  if (!row) return null;
  const r = def.render;
  const title = row.label;
  const meal = r.badge ? renderTemplate(r.badge, row.raw) : '';
  const kind = typeof row.raw.kind === 'string' ? row.raw.kind : '';
  const kcal = Number(row.raw.kcal) || 0;
  const desc = r.text ? renderTemplate(r.text, row.raw) : '';
  const { steps, nutrition } = parseSteps(r.detail ? renderTemplate(r.detail, row.raw) : '');

  // Галерея: поле gallery (список) + основное фото
  const gallery = [
    ...localPaths(r.image ? row.raw[r.image] : null),
    ...localPaths(r.gallery ? row.raw[r.gallery] : null),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const videoId = r.video ? parseYouTubeId(String(row.raw[r.video] ?? '')) : null;
  const eatKey = `${meal}¦${title}`;
  const trackable = !!r.dayField && !!def.source.static;
  const eaten = trackable && isEaten(today, eatKey);

  const macros = [
    ['Белки', row.raw.protein], ['Жиры', row.raw.fat], ['Углеводы', row.raw.carbs],
  ].filter(([, v]) => Number(v) > 0) as [string, number][];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-2 sm:p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[1100px] h-[94vh] rounded-2xl bg-bg border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        <button onClick={onClose} className="absolute top-3 right-3 z-30 h-9 w-9 rounded-lg bg-bg-soft/90 hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text transition-colors" title="Закрыть (Esc)">
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Медиа */}
            <div className="lg:sticky lg:top-0 lg:h-[94vh] bg-bg-soft flex flex-col">
              {(gallery.length > 0 || videoId) && (
                <div className="flex gap-1 p-3 shrink-0">
                  <button onClick={() => setTab('photo')} className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${tab === 'photo' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>Фото</button>
                  {videoId && <button onClick={() => setTab('video')} className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${tab === 'video' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'}`}><Youtube className="h-3.5 w-3.5" /> Видео</button>}
                </div>
              )}
              <div className="flex-1 min-h-[240px] flex items-center justify-center p-3 pt-0">
                {tab === 'video' && videoId ? (
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
                    <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`} title="Видео-рецепт" allow="encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                ) : gallery.length > 0 ? (
                  <div className="w-full">
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-bg-hover">
                      <img src={gallery[imgIdx]} alt="" className="w-full h-full object-cover" />
                    </div>
                    {gallery.length > 1 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto">
                        {gallery.map((g, i) => (
                          <button key={g} onClick={() => setImgIdx(i)} className={`h-14 w-20 rounded-lg overflow-hidden border-2 shrink-0 ${i === imgIdx ? 'border-accent' : 'border-transparent opacity-70'}`}>
                            <img src={g} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-text-dim">
                    <Utensils className="h-16 w-16 mb-2 opacity-40" />
                    <span className="text-sm">Фото не добавлено</span>
                  </div>
                )}
              </div>
              {/* Кнопка «найти видео», если своего нет */}
              {!videoId && (
                <div className="p-3 pt-0 shrink-0">
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} рецепт`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 h-10 rounded-xl bg-bg-card border border-border-soft text-sm text-text-muted hover:text-text hover:border-border transition-colors"
                  >
                    <Youtube className="h-4 w-4 text-red-500" /> Смотреть видео-рецепт на YouTube
                  </a>
                </div>
              )}
            </div>

            {/* Текст */}
            <div className="p-5 sm:p-7">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {meal && <span className="text-[11px] uppercase tracking-wider text-accent font-semibold">{meal}</span>}
                {kind && kind !== 'Основное' && <span className="text-[11px] text-text-dim">· {kind}</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text leading-tight">{title}</h1>
              {desc && <p className="text-sm text-text-muted mt-2 leading-relaxed">{desc}</p>}

              {/* Ккал + БЖУ */}
              <div className="flex flex-wrap gap-2 mt-4">
                {kcal > 0 && (
                  <div className="rounded-xl border border-border-soft px-3 py-2 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold tabular-nums">{kcal}</span>
                    <span className="text-xs text-text-muted">ккал</span>
                  </div>
                )}
                {macros.map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-border-soft px-3 py-2 text-center">
                    <div className="text-sm font-semibold tabular-nums">{v}<span className="text-[10px] text-text-dim ml-0.5">г</span></div>
                    <div className="text-[10px] text-text-muted">{l}</div>
                  </div>
                ))}
              </div>

              {/* Шаги */}
              {steps.length > 0 && (
                <div className="mt-6">
                  <div className="section-label">Как готовить</div>
                  <ol className="space-y-2.5">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="h-6 w-6 shrink-0 rounded-full bg-accent/12 text-accent text-xs font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                        <span className="text-sm text-text leading-relaxed pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {nutrition && <div className="mt-4 text-xs text-text-muted">{nutrition}</div>}

              {/* Отметка «съел» */}
              {trackable && (
                <button
                  onClick={() => toggleEaten(today, { key: eatKey, title, kcal, meal })}
                  className={`mt-6 w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    eaten ? 'bg-accent/12 text-accent' : 'bg-accent text-white hover:opacity-90'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" /> {eaten ? 'Съедено — учтено' : 'Отметить съеденным'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
