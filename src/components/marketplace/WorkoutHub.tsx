import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Dumbbell, Play, Flame, Check, Loader2, Clock, ArrowLeft, SkipForward, Pause, ChevronRight,
} from 'lucide-react';
import {
  fetchProgram, safePhoto, youtubeId, workoutStreak,
  type ProgramPack, type WorkoutSession, type ProgramExercise,
} from '@/lib/marketplace';
import { useStore } from '@/lib/store';
import { logWorkout } from '@/lib/activity';
import { todayISO } from '@/lib/utils';
import { WorkoutCalendar } from './WorkoutCalendar';
import { WorkoutProgress } from './WorkoutProgress';
import { recommendWorkout } from '@/lib/programAdapt';
import { CalendarDays, LineChart, Sparkles } from 'lucide-react';

/** Премиум фитнес-хаб — экран занятий спортом на токенах приложения (glass-совместим):
 *  герой, цели-чеклист, стрик, недельное расписание, галерея сессий → гид-плеер тренировки. */
export const WorkoutHub: React.FC<{ programId: string | null; onClose: () => void }> = ({ programId, onClose }) => {
  const healthLogs = useStore((s) => s.healthLogs);
  const [pack, setPack] = useState<ProgramPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<WorkoutSession | null>(null);
  const [player, setPlayer] = useState<WorkoutSession | null>(null);
  const [goalsTick, setGoalsTick] = useState(0);

  useEffect(() => {
    if (!programId) { setPack(null); setError(''); setDetail(null); setPlayer(null); return; }
    setLoading(true); setError('');
    fetchProgram(programId)
      .then((p) => { if (!p.hub) throw new Error('В этой программе нет фитнес-хаба'); setPack(p); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (player) setPlayer(null); else if (detail) setDetail(null); else onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [programId, onClose, detail, player]);

  const hub = pack?.hub;
  const streak = useMemo(() => workoutStreak(healthLogs), [healthLogs]);
  const completedDays = useMemo(
    () => new Set(healthLogs.filter((l) => l.metric === 'workout' && l.value > 0).map((l) => l.date)),
    [healthLogs],
  );
  const reco = useMemo(() => (hub ? recommendWorkout(hub, healthLogs) : null), [hub, healthLogs]);
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
  const completeSession = (min: number) => logWorkout(todayISO(), min * 60);

  if (!programId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[206] bg-bg overflow-y-auto text-text" role="dialog" aria-modal="true">
      <button onClick={onClose} className="fixed top-4 right-4 z-20 h-10 w-10 rounded-full bg-bg-card/80 backdrop-blur border border-border-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text" title="Закрыть (Esc)">
        <X className="h-5 w-5" />
      </button>

      {loading && <div className="h-screen flex items-center justify-center text-text-dim"><Loader2 className="h-7 w-7 animate-spin" /></div>}
      {error && <div className="h-screen flex items-center justify-center text-red-500 text-sm px-6 text-center">{error}</div>}

      {!loading && !error && hub && (
        <div className="min-h-screen pb-20">
          {/* ── Герой ── */}
          <div className="relative h-[34vh] min-h-[220px] w-full overflow-hidden">
            {safePhoto(hub.hero)
              ? <img src={safePhoto(hub.hero)} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
              : <div className="absolute inset-0 bg-gradient-to-br from-accent/30 via-bg-soft to-bg" />}
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
            <div className="absolute bottom-6 left-0 right-0 px-6 sm:px-10 max-w-5xl mx-auto">
              <div className="h-11 w-11 rounded-xl bg-accent/15 backdrop-blur flex items-center justify-center mb-3 text-accent">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-text">{hub.headline}</h1>
              {hub.quote && <p className="mt-3 text-sm text-text-muted italic max-w-xl leading-relaxed">«{hub.quote}»</p>}
            </div>
          </div>

          <div className="px-6 sm:px-10 max-w-5xl mx-auto space-y-10">
            {/* ── Рекомендация на сегодня (адаптивный движок) ── */}
            {reco && (
              <div className={`-mt-4 rounded-2xl border p-4 flex items-center gap-4 ${
                reco.tone === 'good' ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : reco.tone === 'warn' ? 'border-amber-500/30 bg-amber-500/[0.06]'
                : 'border-accent/30 bg-accent/[0.06]'
              }`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  reco.tone === 'good' ? 'bg-emerald-500/15 text-emerald-500' : reco.tone === 'warn' ? 'bg-amber-500/15 text-amber-500' : 'bg-accent/15 text-accent'
                }`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-text-dim">Рекомендация на сегодня</div>
                  <div className="text-sm font-semibold text-text">{reco.title}</div>
                  <div className="text-[12px] text-text-muted leading-snug">{reco.message}</div>
                </div>
                {reco.sessionId && (() => {
                  const s = sessionById(reco.sessionId);
                  return s ? (
                    <button onClick={() => setDetail(s)} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90">
                      <Play className="h-4 w-4" /> Начать
                    </button>
                  ) : null;
                })()}
              </div>
            )}

            {/* ── Цели ── */}
            {hub.goals && hub.goals.length > 0 && (
              <section>
                <SectionTitle icon={<Check className="h-4 w-4" />}>Мои цели</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {hub.goals.map((g) => {
                    const on = checkedGoals.includes(g);
                    return (
                      <button key={g} onClick={() => toggleGoal(g)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors ${
                          on ? 'border-emerald-500/40 bg-emerald-500/10 text-text' : 'border-border-soft bg-bg-card text-text-muted hover:bg-bg-hover'
                        }`}>
                        <span className={`h-4 w-4 rounded-[5px] border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-border'}`}>
                          {on && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <span className={on ? 'line-through text-text-dim' : ''}>{g}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Стрик + расписание ── */}
            <section className="grid sm:grid-cols-[auto,1fr] gap-6 items-start">
              <div className="flex sm:flex-col items-center gap-3 rounded-2xl border border-border-soft bg-bg-card p-5 sm:w-44">
                <div className="relative h-20 w-20 flex items-center justify-center">
                  <Flame className={`h-20 w-20 ${streak > 0 ? 'text-orange-500' : 'text-text-dim/40'}`} strokeWidth={1.25} />
                  <span className="absolute text-2xl font-black text-text">{streak}</span>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-text">keep the streak!</div>
                  <div className="text-[11px] text-text-muted">{streak > 0 ? `${streak} дней подряд` : 'начни сегодня'}</div>
                </div>
              </div>

              {hub.schedule && hub.schedule.length > 0 && (
                <div className="flex-1 min-w-0">
                  <SectionTitle icon={<Clock className="h-4 w-4" />}>Расписание недели</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {hub.schedule.map((d, i) => (
                      <div key={i} className="rounded-xl border border-border-soft bg-bg-card p-2.5 min-h-[84px]">
                        <div className="text-[11px] uppercase tracking-wider text-text-dim mb-1.5">{d.label}</div>
                        <div className="space-y-1">
                          {d.sessions.length === 0 && <div className="text-[11px] text-text-dim/60">отдых</div>}
                          {d.sessions.map((sid) => {
                            const s = sessionById(sid);
                            if (!s) return null;
                            return (
                              <button key={sid} onClick={() => setDetail(s)}
                                className="block w-full text-left rounded-md px-1.5 py-1 text-[11px] leading-tight text-text hover:bg-bg-hover"
                                style={{ borderLeft: `2px solid ${typeColor(s.type)}` }}>
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

            {/* ── Календарь тренировок ── */}
            {hub.schedule && hub.schedule.length > 0 && (
              <section>
                <SectionTitle icon={<CalendarDays className="h-4 w-4" />}>Календарь тренировок</SectionTitle>
                <WorkoutCalendar hub={hub} completedDays={completedDays} onOpenSession={(s) => setDetail(s)} />
              </section>
            )}

            {/* ── Прогресс и замеры ── */}
            <section>
              <SectionTitle icon={<LineChart className="h-4 w-4" />}>Прогресс и замеры</SectionTitle>
              <WorkoutProgress programId={programId} healthLogs={healthLogs} streak={streak} />
            </section>

            {/* ── Галерея ── */}
            <section>
              <SectionTitle icon={<Dumbbell className="h-4 w-4" />}>Библиотека тренировок</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {hub.sessions.map((s) => <SessionCard key={s.id} session={s} onOpen={() => setDetail(s)} />)}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Детали сессии */}
      {detail && (
        <SessionDetail
          session={detail}
          onBack={() => setDetail(null)}
          onStart={() => setPlayer(detail)}
          onQuickDone={(min) => completeSession(min)}
        />
      )}

      {/* Гид-плеер */}
      {player && (
        <WorkoutPlayer
          session={player}
          onClose={() => setPlayer(null)}
          onComplete={(min) => { completeSession(min); setPlayer(null); setDetail(null); }}
        />
      )}
    </div>,
    document.body,
  );
};

/* ==================== Общее ==================== */

const TYPE_COLORS: Record<string, string> = {
  strength: '#ef4444', cardio: '#22c55e', yoga: '#a78bfa',
  calisthenics: '#f59e0b', mobility: '#38bdf8', rest: '#64748b',
};
function typeColor(type: string): string {
  return TYPE_COLORS[type.trim().toLowerCase()] ?? '#8b5cf6';
}
function durationMin(d: string): number {
  const s = d.toLowerCase();
  const h = s.match(/(\d+)\s*час/); const m = s.match(/(\d+)\s*мин/);
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) || 30;
}

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-2 mb-3 text-text-muted">
    <span className="text-accent">{icon}</span>
    <span className="text-[11px] uppercase tracking-widest font-semibold">{children}</span>
  </div>
);

const SessionCard: React.FC<{ session: WorkoutSession; onOpen: () => void }> = ({ session, onOpen }) => {
  const photo = safePhoto(session.photo);
  return (
    <button onClick={onOpen} className="group text-left rounded-xl overflow-hidden border border-border-soft bg-bg-card hover:border-accent/40 transition-colors">
      <div className="relative h-28 w-full overflow-hidden bg-bg-soft">
        {photo
          ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="h-full w-full flex items-center justify-center text-3xl">🏋️</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: typeColor(session.type) }}>{session.type}</div>
        <div className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-accent text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="h-4 w-4 ml-0.5" />
        </div>
      </div>
      <div className="p-2.5">
        <div className="text-[13px] font-semibold text-text leading-tight truncate">{session.title}</div>
        <div className="text-[11px] text-text-muted mt-0.5">{session.duration}</div>
      </div>
    </button>
  );
};

const SessionDetail: React.FC<{
  session: WorkoutSession; onBack: () => void; onStart: () => void; onQuickDone: (min: number) => void;
}> = ({ session, onBack, onStart, onQuickDone }) => {
  const [done, setDone] = useState(false);
  const photo = safePhoto(session.photo);
  const vid = youtubeId(session.video);
  const hasExercises = !!session.exercises?.length;
  const quickDone = () => {
    if (done) return;
    setDone(true);
    onQuickDone(durationMin(session.duration));
    window.dispatchEvent(new CustomEvent('thedad:celebrate', { detail: { title: 'Тренировка засчитана!', subtitle: session.title, emoji: '🔥' } }));
  };
  return (
    <div className="fixed inset-0 z-[207] bg-bg overflow-y-auto text-text">
      <div className="relative h-[30vh] min-h-[180px] w-full overflow-hidden">
        {photo ? <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-accent/25 to-bg" />}
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent" />
        <button onClick={onBack} className="absolute top-4 left-4 h-10 w-10 rounded-full bg-bg-card/80 backdrop-blur border border-border-soft flex items-center justify-center text-text-muted hover:text-text">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute bottom-5 left-0 right-0 px-6 max-w-3xl mx-auto">
          <div className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold text-white mb-2" style={{ backgroundColor: typeColor(session.type) }}>{session.type}</div>
          <h2 className="text-2xl sm:text-3xl font-black text-text leading-tight">{session.title}</h2>
          <div className="text-text-muted text-sm mt-1">{session.duration}</div>
        </div>
      </div>

      <div className="px-6 max-w-3xl mx-auto py-6 space-y-5">
        {session.note && <p className="text-[13px] text-text-muted leading-relaxed">{session.note}</p>}

        <div className="flex flex-wrap gap-2">
          {hasExercises && (
            <button onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-3 text-sm font-bold hover:opacity-90">
              <Play className="h-4 w-4" /> Начать тренировку
            </button>
          )}
          {vid && (
            <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white px-4 py-3 text-sm font-semibold">
              <Play className="h-4 w-4" /> Видео
            </a>
          )}
        </div>

        {hasExercises && (
          <div>
            <SectionTitle icon={<Dumbbell className="h-4 w-4" />}>Упражнения</SectionTitle>
            <div className="space-y-2">
              {session.exercises!.map((ex, i) => <ExerciseRow key={i} ex={ex} index={i + 1} />)}
            </div>
          </div>
        )}

        {!hasExercises && (
          <button onClick={quickDone}
            className={`w-full rounded-xl px-4 py-3.5 text-sm font-bold inline-flex items-center justify-center gap-2 ${done ? 'bg-emerald-500/20 text-emerald-500' : 'bg-accent text-white hover:opacity-90'}`}>
            {done ? <><Check className="h-4 w-4" /> Засчитано</> : <><Flame className="h-4 w-4" /> Завершить и засчитать</>}
          </button>
        )}
      </div>
    </div>
  );
};

const ExerciseRow: React.FC<{ ex: ProgramExercise; index: number }> = ({ ex, index }) => {
  const photo = safePhoto(ex.photo);
  const vid = youtubeId(ex.video);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg-card p-2.5">
      <div className="h-11 w-11 rounded-lg bg-bg-soft overflow-hidden shrink-0 flex items-center justify-center text-xl relative">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="text-text-dim text-sm font-bold">{index}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-text truncate">{ex.name}</div>
        {ex.reps && <div className="text-[11px] text-accent">{ex.reps}</div>}
        {ex.detail && <div className="text-[11px] text-text-muted leading-snug">{ex.detail}</div>}
      </div>
      {vid && (
        <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center shrink-0" title="Демо">
          <Play className="h-4 w-4" />
        </a>
      )}
    </div>
  );
};

/* ==================== Гид-плеер тренировки ==================== */

const REST_SECONDS = 45;

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 300);
  } catch { /* аудио недоступно — не критично */ }
}

const WorkoutPlayer: React.FC<{ session: WorkoutSession; onClose: () => void; onComplete: (min: number) => void }> = ({ session, onClose, onComplete }) => {
  const exercises = session.exercises ?? [];
  const [idx, setIdx] = useState(0);
  const [resting, setResting] = useState(false);
  const [rest, setRest] = useState(REST_SECONDS);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());

  const isLast = idx >= exercises.length - 1;
  const ex = exercises[idx];

  // Таймер отдыха
  useEffect(() => {
    if (!resting || paused) return;
    if (rest <= 0) { beep(); setResting(false); setRest(REST_SECONDS); return; }
    const t = setTimeout(() => setRest((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resting, paused, rest]);

  const finish = () => {
    const min = Math.max(1, Math.round((Date.now() - startRef.current) / 60000)) || durationMin(session.duration);
    window.dispatchEvent(new CustomEvent('thedad:celebrate', { detail: { title: 'Тренировка завершена!', subtitle: session.title, emoji: '🔥' } }));
    onComplete(min);
  };
  const nextExercise = () => {
    if (isLast) { finish(); return; }
    setIdx((i) => i + 1);
    setResting(false); setRest(REST_SECONDS);
  };
  const doneExercise = () => {
    if (isLast) { finish(); return; }
    setResting(true); setRest(REST_SECONDS);
  };

  const photo = ex ? safePhoto(ex.photo) : '';
  const vid = ex ? youtubeId(ex.video) : '';
  const progress = exercises.length ? Math.round(((idx + (resting ? 1 : 0)) / exercises.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[208] bg-bg text-text flex flex-col">
      {/* Шапка */}
      <div className="shrink-0 px-5 py-3.5 flex items-center gap-3 border-b border-border-soft">
        <button onClick={onClose} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted"><X className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{session.title}</div>
          <div className="text-[11px] text-text-muted">Упражнение {Math.min(idx + 1, exercises.length)} из {exercises.length}</div>
        </div>
      </div>
      <div className="h-1 bg-bg-soft shrink-0"><div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div>

      {/* Тело */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        {resting ? (
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-widest text-text-muted mb-4">Отдых</div>
            <div className="text-7xl font-black tabular-nums text-accent mb-2">{rest}</div>
            <div className="text-sm text-text-muted mb-6">Дальше: {exercises[idx + 1]?.name ?? 'финиш'}</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPaused((p) => !p)} className="h-11 w-11 rounded-full bg-bg-soft hover:bg-bg-hover flex items-center justify-center">
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button onClick={nextExercise} className="inline-flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-3 text-sm font-bold">
                <SkipForward className="h-4 w-4" /> Пропустить отдых
              </button>
            </div>
          </div>
        ) : ex ? (
          <div className="w-full max-w-md text-center">
            <div className="h-48 w-full rounded-2xl bg-bg-soft border border-border-soft overflow-hidden mb-5 flex items-center justify-center">
              {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <Dumbbell className="h-16 w-16 text-text-dim/40" strokeWidth={1} />}
            </div>
            <h2 className="text-2xl font-black mb-1">{ex.name}</h2>
            {ex.reps && <div className="text-lg font-bold text-accent mb-2">{ex.reps}</div>}
            {ex.detail && <p className="text-sm text-text-muted mb-4 leading-relaxed">{ex.detail}</p>}
            {vid && (
              <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 text-[13px] font-medium mb-5">
                <Play className="h-4 w-4" /> Как делать
              </a>
            )}
          </div>
        ) : null}
      </div>

      {/* Футер */}
      {!resting && ex && (
        <div className="shrink-0 p-4 border-t border-border-soft flex items-center gap-2">
          <button onClick={nextExercise} className="rounded-xl bg-bg-soft hover:bg-bg-hover text-text-muted px-4 py-3 text-sm inline-flex items-center gap-1.5">
            <SkipForward className="h-4 w-4" /> Пропустить
          </button>
          <button onClick={doneExercise} className="flex-1 rounded-xl bg-accent text-white px-4 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
            {isLast ? <><Check className="h-4 w-4" /> Завершить</> : <>Готово <ChevronRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </div>
  );
};
