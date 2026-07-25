import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, Check, Play, Dumbbell, UtensilsCrossed,
  GraduationCap, Flame, Loader2, Sparkles, TrendingUp, TriangleAlert, Info,
} from 'lucide-react';
import {
  fetchProgram, getProgress, currentDay, toggleDayDone, safePhoto, youtubeId, openWorkoutHub,
  type ProgramPack, type ProgramDay,
} from '@/lib/marketplace';
import { analyzeProgram, type AdaptiveInsight } from '@/lib/programAdapt';
import { useStore } from '@/lib/store';

/** Программа-плеер — направляемый режим «День X из N»: урок, тренировка (видео-демо),
 *  питание (фото+рецепт), акцент на привычках. Ядро премиум-опыта. */
export const ProgramRunner: React.FC<{ programId: string | null; onClose: () => void }> = ({ programId, onClose }) => {
  const healthLogs = useStore((s) => s.healthLogs);
  const [pack, setPack] = useState<ProgramPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [day, setDay] = useState(1);
  const [doneTick, setDoneTick] = useState(0);

  const total = useMemo(() => {
    if (!pack) return 1;
    if (pack.duration_days) return pack.duration_days;
    const days = pack.days ?? [];
    return days.length ? Math.max(...days.map((d) => d.day)) : 1;
  }, [pack]);

  useEffect(() => {
    if (!programId) { setPack(null); setError(''); return; }
    setLoading(true);
    setError('');
    fetchProgram(programId)
      .then((p) => { setPack(p); setDay(currentDay(programId, p.duration_days || (p.days?.length ? Math.max(...p.days.map((d) => d.day)) : 1))); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setDay((d) => Math.max(1, d - 1));
      else if (e.key === 'ArrowRight') setDay((d) => Math.min(total, d + 1));
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [programId, onClose, total]);

  // ВАЖНО: все хуки — ДО любого раннего return (правила хуков). Иначе при открытии
  // (programId null → id) меняется число хуков и React падает в белый экран.
  const progress = programId ? getProgress(programId) : { start: '', done: [] as number[] };
  const today = programId ? currentDay(programId, total) : 1;
  const dayData: ProgramDay | undefined = pack?.days?.find((d) => d.day === day);

  const insights: AdaptiveInsight[] = useMemo(() => {
    if (!pack || !programId) return [];
    return analyzeProgram({ pack, healthLogs, start: progress.start, currentDay: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, programId, healthLogs, today, doneTick]);

  if (!programId) return null;

  const doneCount = progress.done.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isDayDone = progress.done.includes(day);

  const markDone = () => {
    toggleDayDone(programId, day);
    setDoneTick((t) => t + 1);
    if (!isDayDone) {
      window.dispatchEvent(new CustomEvent('thedad:celebrate', { detail: { title: 'День пройден!', subtitle: pack?.title, emoji: '🎯' } }));
    }
  };
  void doneTick; // прогресс перечитывается из localStorage при ре-рендере

  return createPortal(
    <div className="fixed inset-0 z-[205] flex items-start justify-center p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-surface relative z-10 w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl bg-bg-card border-0 sm:border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        {/* Шапка + прогресс */}
        <div className="shrink-0 border-b border-border-soft">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="h-10 w-10 rounded-xl bg-accent/12 text-2xl flex items-center justify-center shrink-0">{pack?.emoji ?? '🎯'}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-text truncate">{pack?.title ?? 'Программа'}</div>
              <div className="text-[11px] text-text-muted">Пройдено {doneCount} из {total} дней · {pct}%</div>
            </div>
            {pack?.hub && programId && (
              <button
                onClick={() => openWorkoutHub(programId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/12 text-accent hover:bg-accent/20 px-2.5 py-1.5 text-xs font-medium shrink-0"
                title="Открыть фитнес-зал"
              >
                <Dumbbell className="h-3.5 w-3.5" /> Фитнес-зал
              </button>
            )}
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text shrink-0" title="Закрыть (Esc)">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-1 bg-bg-soft">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          {/* Навигация по дням */}
          <div className="flex items-center gap-2 px-5 py-2.5">
            <button onClick={() => setDay((d) => Math.max(1, d - 1))} disabled={day <= 1} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <div className="text-sm font-semibold text-text">{dayData?.title ?? `День ${day}`}</div>
              {day === today && <div className="text-[10px] uppercase tracking-wider text-accent">сегодня</div>}
            </div>
            <button onClick={() => setDay((d) => Math.min(total, d + 1))} disabled={day >= total} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Тело дня */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && <div className="py-16 flex justify-center text-text-dim"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {error && <div className="py-16 text-center text-sm text-red-400">{error}</div>}

          {!loading && !error && insights.length > 0 && (
            <div className="rounded-xl border border-accent/25 bg-accent/[0.05] p-3.5">
              <div className="flex items-center gap-2 mb-2 text-accent">
                <TrendingUp className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-widest font-semibold">Подстройка под тебя</span>
              </div>
              <div className="space-y-2.5">
                {insights.map((ins, i) => <InsightRow key={i} insight={ins} />)}
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {dayData?.lesson && (
                <Section icon={<GraduationCap className="h-4 w-4" />} title="Урок дня">
                  <p className="text-[13px] text-text leading-relaxed">{dayData.lesson}</p>
                </Section>
              )}

              {dayData?.workout && (
                <Section icon={<Dumbbell className="h-4 w-4" />} title={dayData.workout.title}>
                  {dayData.workout.note && <p className="text-[12px] text-text-muted mb-2.5">{dayData.workout.note}</p>}
                  {dayData.workout.video && <VideoButton id={youtubeId(dayData.workout.video)} label="Смотреть тренировку" />}
                  <div className="space-y-2 mt-2">
                    {dayData.workout.exercises?.map((ex, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-bg-soft/60 border border-border-soft p-2.5">
                        <MediaThumb photo={safePhoto(ex.photo)} vid={youtubeId(ex.video)} fallback="🏋️" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-text truncate">{ex.name}</div>
                          {ex.reps && <div className="text-[11px] text-accent">{ex.reps}</div>}
                          {ex.detail && <div className="text-[11px] text-text-muted leading-snug">{ex.detail}</div>}
                        </div>
                        {youtubeId(ex.video) && <VideoButton id={youtubeId(ex.video)} compact />}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {dayData?.meals && dayData.meals.length > 0 && (
                <Section icon={<UtensilsCrossed className="h-4 w-4" />} title="Питание на день">
                  <div className="space-y-2.5">
                    {dayData.meals.map((m, i) => <MealCard key={i} meal={m} />)}
                  </div>
                </Section>
              )}

              {dayData?.focusHabits && dayData.focusHabits.length > 0 && (
                <Section icon={<Flame className="h-4 w-4" />} title="Фокус на привычках">
                  <div className="flex flex-wrap gap-1.5">
                    {dayData.focusHabits.map((h, i) => (
                      <span key={i} className="rounded-full bg-bg-soft border border-border-soft px-2.5 py-1 text-[12px] text-text-muted">{h}</span>
                    ))}
                  </div>
                </Section>
              )}

              {!dayData && (
                <div className="py-12 text-center text-sm text-text-dim flex flex-col items-center gap-2">
                  <Sparkles className="h-6 w-6 text-text-dim" />
                  Свободный день — восстановление. Держи привычки и отдохни.
                </div>
              )}
            </>
          )}
        </div>

        {/* Футер: отметить день */}
        <div className="shrink-0 border-t border-border-soft p-4">
          <button
            onClick={markDone}
            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
              isDayDone ? 'bg-green-500/15 text-green-500' : 'bg-accent text-white hover:opacity-90'
            }`}
          >
            <Check className="h-4 w-4" /> {isDayDone ? 'День пройден' : 'Отметить день выполненным'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const InsightRow: React.FC<{ insight: AdaptiveInsight }> = ({ insight }) => {
  const { tone } = insight;
  const Icon = tone === 'good' ? Check : tone === 'warn' ? TriangleAlert : Info;
  const color = tone === 'good' ? 'text-green-500' : tone === 'warn' ? 'text-amber-500' : 'text-text-muted';
  return (
    <div className="flex gap-2.5">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
      <div className="min-w-0">
        <div className={`text-[13px] font-semibold ${tone === 'warn' ? 'text-text' : 'text-text'}`}>{insight.title}</div>
        <div className="text-[12px] text-text-muted leading-relaxed">{insight.message}</div>
      </div>
    </div>
  );
};

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-2.5 text-text-muted">
      <span className="text-accent">{icon}</span>
      <span className="text-[11px] uppercase tracking-widest">{title}</span>
    </div>
    {children}
  </div>
);

const MediaThumb: React.FC<{ photo: string; vid: string; fallback: string }> = ({ photo, fallback }) => (
  <div className="h-11 w-11 rounded-lg bg-bg-card border border-border-soft overflow-hidden shrink-0 flex items-center justify-center text-xl">
    {photo ? <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" /> : fallback}
  </div>
);

/** Кнопка-ссылка на YouTube (без загрузки внешних превью — приватность). */
const VideoButton: React.FC<{ id: string; label?: string; compact?: boolean }> = ({ id, label, compact }) => {
  if (!id) return null;
  const href = `https://www.youtube.com/watch?v=${id}`;
  if (compact) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-red-500/12 text-red-400 hover:bg-red-500/20 flex items-center justify-center shrink-0" title="Видео-демо">
        <Play className="h-4 w-4" />
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-red-500/12 text-red-400 hover:bg-red-500/20 px-3 py-2 text-[13px] font-medium">
      <Play className="h-4 w-4" /> {label ?? 'Смотреть видео'}
    </a>
  );
};

const MealCard: React.FC<{ meal: import('@/lib/marketplace').ProgramMeal }> = ({ meal }) => {
  const [open, setOpen] = useState(false);
  const photo = safePhoto(meal.photo);
  const vid = youtubeId(meal.video);
  return (
    <div className="rounded-xl border border-border-soft bg-bg-soft/60 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 w-full p-2.5 text-left">
        <div className="h-12 w-12 rounded-lg bg-bg-card border border-border-soft overflow-hidden shrink-0 flex items-center justify-center text-2xl">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" /> : '🍽️'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-text-dim">{meal.meal}{meal.kcal ? ` · ${meal.kcal} ккал` : ''}</div>
          <div className="text-[13px] font-medium text-text truncate">{meal.title}</div>
        </div>
        {(meal.recipe || vid) && <ChevronRight className={`h-4 w-4 text-text-dim shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />}
      </button>
      {open && (meal.recipe || vid) && (
        <div className="px-2.5 pb-3 pt-0.5 space-y-2">
          {meal.recipe && <p className="text-[12px] text-text-muted leading-relaxed whitespace-pre-line">{meal.recipe}</p>}
          {vid && <VideoButton id={vid} label="Видео-рецепт" />}
        </div>
      )}
    </div>
  );
};
