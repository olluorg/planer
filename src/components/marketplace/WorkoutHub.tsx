import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Dumbbell, Play, Flame, Check, Loader2, Clock, ArrowLeft,
} from 'lucide-react';
import {
  fetchProgram, safePhoto, youtubeId, workoutStreak,
  type ProgramPack, type WorkoutHub as HubData, type WorkoutSession,
} from '@/lib/marketplace';
import { useStore } from '@/lib/store';
import { logWorkout } from '@/lib/activity';
import { todayISO } from '@/lib/utils';

/** Премиум фитнес-хаб — кинематографичный экран занятий спортом (см. exampe.jpg):
 *  герой, цели-чеклист, стрик, недельное расписание и галерея тренировок с видео. */
export const WorkoutHub: React.FC<{ programId: string | null; onClose: () => void }> = ({ programId, onClose }) => {
  const healthLogs = useStore((s) => s.healthLogs);
  const [pack, setPack] = useState<ProgramPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const [goalsTick, setGoalsTick] = useState(0);

  useEffect(() => {
    if (!programId) { setPack(null); setError(''); setSelected(null); return; }
    setLoading(true);
    setError('');
    fetchProgram(programId)
      .then((p) => { if (!p.hub) throw new Error('В этой программе нет фитнес-хаба'); setPack(p); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { selected ? setSelected(null) : onClose(); } };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [programId, onClose, selected]);

  const hub = pack?.hub;
  const streak = useMemo(() => workoutStreak(healthLogs), [healthLogs]);

  const goalsKey = `hub.goals.${programId}`;
  const checkedGoals: string[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(goalsKey) || '[]'); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalsKey, goalsTick]);
  const toggleGoal = (g: string) => {
    const set = new Set(checkedGoals);
    set.has(g) ? set.delete(g) : set.add(g);
    localStorage.setItem(goalsKey, JSON.stringify([...set]));
    setGoalsTick((t) => t + 1);
  };

  const sessionById = (id: string) => hub?.sessions.find((s) => s.id === id);

  if (!programId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[206] bg-[#0b0d12] overflow-y-auto" role="dialog" aria-modal="true">
      {/* Закрыть */}
      <button onClick={onClose} className="fixed top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 flex items-center justify-center text-white/80 hover:text-white" title="Закрыть (Esc)">
        <X className="h-5 w-5" />
      </button>

      {loading && <div className="h-screen flex items-center justify-center text-white/50"><Loader2 className="h-7 w-7 animate-spin" /></div>}
      {error && <div className="h-screen flex items-center justify-center text-red-300 text-sm px-6 text-center">{error}</div>}

      {!loading && !error && hub && (
        <div className="min-h-screen text-white">
          {/* ── Герой ── */}
          <div className="relative h-[38vh] min-h-[240px] w-full overflow-hidden">
            {safePhoto(hub.hero)
              ? <img src={safePhoto(hub.hero)} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
              : <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/40 to-transparent" />
            <div className="absolute bottom-6 left-0 right-0 px-6 sm:px-10 max-w-5xl mx-auto">
              <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center mb-3">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none">{hub.headline}</h1>
              {hub.quote && <p className="mt-3 text-sm text-white/60 italic max-w-xl leading-relaxed">«{hub.quote}»</p>}
            </div>
          </div>

          <div className="px-6 sm:px-10 max-w-5xl mx-auto pb-20 space-y-10 -mt-2">
            {/* ── Цели ── */}
            {hub.goals && hub.goals.length > 0 && (
              <section>
                <SectionTitle icon={<Check className="h-4 w-4" />}>Мои цели</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {hub.goals.map((g) => {
                    const on = checkedGoals.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGoal(g)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors ${
                          on ? 'border-emerald-500/40 bg-emerald-500/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className={`h-4 w-4 rounded-[5px] border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-white/30'}`}>
                          {on && <Check className="h-3 w-3 text-black" />}
                        </span>
                        <span className={on ? 'line-through text-white/50' : ''}>{g}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Стрик + расписание ── */}
            <section className="grid sm:grid-cols-[auto,1fr] gap-6 items-start">
              {/* Стрик */}
              <div className="flex sm:flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:w-40">
                <div className="relative h-20 w-20 flex items-center justify-center">
                  <Flame className={`h-20 w-20 ${streak > 0 ? 'text-orange-500/90' : 'text-white/15'}`} strokeWidth={1.25} />
                  <span className="absolute text-2xl font-black">{streak}</span>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold">keep the streak!</div>
                  <div className="text-[11px] text-white/50">{streak > 0 ? `${streak} дней подряд` : 'начни сегодня'}</div>
                </div>
              </div>

              {/* Недельное расписание */}
              {hub.schedule && hub.schedule.length > 0 && (
                <div className="flex-1">
                  <SectionTitle icon={<Clock className="h-4 w-4" />}>Расписание недели</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {hub.schedule.map((d, i) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 min-h-[84px]">
                        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{d.label}</div>
                        <div className="space-y-1">
                          {d.sessions.length === 0 && <div className="text-[11px] text-white/25">отдых</div>}
                          {d.sessions.map((sid) => {
                            const s = sessionById(sid);
                            if (!s) return null;
                            return (
                              <button
                                key={sid}
                                onClick={() => setSelected(s)}
                                className="block w-full text-left rounded-md px-1.5 py-1 text-[11px] leading-tight hover:bg-white/10"
                                style={{ borderLeft: `2px solid ${typeColor(s.type)}` }}
                              >
                                {s.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ── Галерея тренировок ── */}
            <section>
              <SectionTitle icon={<Dumbbell className="h-4 w-4" />}>Библиотека тренировок</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {hub.sessions.map((s) => (
                  <SessionCard key={s.id} session={s} onOpen={() => setSelected(s)} />
                ))}
              </div>
            </section>
          </div>

          {/* ── Детали сессии ── */}
          {selected && (
            <SessionDetail
              session={selected}
              onBack={() => setSelected(null)}
              onDone={(min) => { logWorkout(todayISO(), min * 60); }}
            />
          )}
        </div>
      )}
    </div>,
    document.body,
  );
};

/* ==================== Вспомогательные ==================== */

const TYPE_COLORS: Record<string, string> = {
  strength: '#ef4444', cardio: '#22c55e', yoga: '#a78bfa',
  calisthenics: '#f59e0b', mobility: '#38bdf8', rest: '#64748b',
};
function typeColor(type: string): string {
  return TYPE_COLORS[type.trim().toLowerCase()] ?? '#8b5cf6';
}
/** Примерная длительность в минутах из строки «1 час», «45 мин» — для лога зарядки. */
function durationMin(d: string): number {
  const s = d.toLowerCase();
  const h = s.match(/(\d+)\s*час/); const m = s.match(/(\d+)\s*мин/);
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) || 30;
}

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-2 mb-3 text-white/50">
    <span className="text-white/70">{icon}</span>
    <span className="text-[11px] uppercase tracking-widest font-semibold">{children}</span>
  </div>
);

const SessionCard: React.FC<{ session: WorkoutSession; onOpen: () => void }> = ({ session, onOpen }) => {
  const photo = safePhoto(session.photo);
  return (
    <button onClick={onOpen} className="group text-left rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-white/25 transition-colors">
      <div className="relative h-28 w-full overflow-hidden bg-zinc-800">
        {photo
          ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="h-full w-full flex items-center justify-center text-3xl">🏋️</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: typeColor(session.type) }}>
          {session.type}
        </div>
        <div className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-white/90 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="h-4 w-4 ml-0.5" />
        </div>
      </div>
      <div className="p-2.5">
        <div className="text-[13px] font-semibold text-white leading-tight truncate">{session.title}</div>
        <div className="text-[11px] text-white/45 mt-0.5">{session.duration}</div>
      </div>
    </button>
  );
};

const SessionDetail: React.FC<{ session: WorkoutSession; onBack: () => void; onDone: (min: number) => void }> = ({ session, onBack, onDone }) => {
  const [done, setDone] = useState(false);
  const photo = safePhoto(session.photo);
  const vid = youtubeId(session.video);
  const finish = () => {
    if (done) return;
    setDone(true);
    onDone(durationMin(session.duration));
    window.dispatchEvent(new CustomEvent('thedad:celebrate', { detail: { title: 'Тренировка засчитана!', subtitle: session.title, emoji: '🔥' } }));
  };
  return (
    <div className="fixed inset-0 z-[207] bg-[#0b0d12] overflow-y-auto">
      <div className="relative h-[34vh] min-h-[200px] w-full overflow-hidden">
        {photo
          ? <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          : <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] to-transparent" />
        <button onClick={onBack} className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/80 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute bottom-5 left-0 right-0 px-6 max-w-3xl mx-auto">
          <div className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold text-white mb-2" style={{ backgroundColor: typeColor(session.type) }}>{session.type}</div>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{session.title}</h2>
          <div className="text-white/50 text-sm mt-1">{session.duration}</div>
        </div>
      </div>

      <div className="px-6 max-w-3xl mx-auto py-6 space-y-5 text-white">
        {session.note && <p className="text-[13px] text-white/60 leading-relaxed">{session.note}</p>}
        {vid && (
          <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-semibold">
            <Play className="h-4 w-4" /> Смотреть тренировку
          </a>
        )}

        {session.exercises && session.exercises.length > 0 && (
          <div>
            <SectionTitle icon={<Dumbbell className="h-4 w-4" />}>Упражнения</SectionTitle>
            <div className="space-y-2">
              {session.exercises.map((ex, i) => {
                const exPhoto = safePhoto(ex.photo);
                const exVid = youtubeId(ex.video);
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="h-11 w-11 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center text-xl">
                      {exPhoto ? <img src={exPhoto} alt="" className="h-full w-full object-cover" loading="lazy" /> : '🏋️'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{ex.name}</div>
                      {ex.reps && <div className="text-[11px] text-orange-400">{ex.reps}</div>}
                      {ex.detail && <div className="text-[11px] text-white/45 leading-snug">{ex.detail}</div>}
                    </div>
                    {exVid && (
                      <a href={`https://www.youtube.com/watch?v=${exVid}`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-red-600/80 hover:bg-red-500 flex items-center justify-center shrink-0" title="Демо">
                        <Play className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={finish}
          className={`w-full rounded-xl px-4 py-3.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors ${
            done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-600 hover:bg-orange-500 text-white'
          }`}
        >
          {done ? <><Check className="h-4 w-4" /> Тренировка засчитана</> : <><Flame className="h-4 w-4" /> Завершить и засчитать</>}
        </button>
      </div>
    </div>
  );
};
