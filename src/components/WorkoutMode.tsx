import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, SkipForward, Check, Dumbbell } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { fmtSec } from '@/lib/pomodoroState';

/* ==================== База упражнений ====================
 * Картинки: public/workout/ex-01.jpg … ex-30.jpg (квадратные, обрезаются в круг).
 * Пока файла нет — показывается заглушка, зарядка работает и без картинок. */
export interface Exercise { name: string; hint: string; img: string }

export const EXERCISES: Exercise[] = [
  { name: 'Джампинг джек', hint: 'Прыжки: ноги врозь, руки вверх' },
  { name: 'Приседания', hint: 'Спина прямая, колени не выходят за носки' },
  { name: 'Отжимания', hint: 'Можно с колен — главное корпус ровный' },
  { name: 'Планка', hint: 'Живот подтянут, не проваливай поясницу' },
  { name: 'Выпады вперёд', hint: 'Поочерёдно каждой ногой' },
  { name: 'Скручивания', hint: 'Поясница прижата к полу' },
  { name: 'Бег на месте', hint: 'Держи ровный темп' },
  { name: 'Берпи', hint: 'В своём темпе, без рывков' },
  { name: 'Скалолаз', hint: 'В планке колени к груди попеременно' },
  { name: 'Высокие колени', hint: 'Бег с подъёмом колен до пояса' },
  { name: 'Ягодичный мостик', hint: 'Пауза наверху на 1 секунду' },
  { name: 'Стул у стены', hint: 'Бёдра параллельны полу, держим' },
  { name: 'Боковая планка слева', hint: 'Локоть строго под плечом' },
  { name: 'Боковая планка справа', hint: 'Корпус — одна линия' },
  { name: 'Велосипед', hint: 'Локоть к противоположному колену' },
  { name: 'Супермен', hint: 'Руки и ноги отрываем одновременно' },
  { name: 'Подъём ног лёжа', hint: 'Поясница остаётся на полу' },
  { name: 'Приседания с прыжком', hint: 'Приземляйся мягко, на носки' },
  { name: 'Обратные выпады', hint: 'Шаг назад, колено почти к полу' },
  { name: 'Отжимания от стула', hint: 'Локти назад, плечи вниз' },
  { name: 'Русские скручивания', hint: 'Сидя, поворот корпуса в стороны' },
  { name: 'Прыжки со скакалкой', hint: 'Можно без скакалки — имитация' },
  { name: 'Подъём на носки', hint: 'Медленно вверх и вниз' },
  { name: 'Наклоны к ногам', hint: 'Тянемся к носкам, колени мягкие' },
  { name: 'Наклоны в стороны', hint: 'Рука скользит по бедру' },
  { name: 'Кошка-корова', hint: 'Плавный прогиб и округление спины' },
  { name: 'Махи руками', hint: 'Круги вперёд, затем назад' },
  { name: 'Круги тазом', hint: 'Разминаем корпус в обе стороны' },
  { name: 'Захлёст голени', hint: 'Бег на месте, пятки к ягодицам' },
  { name: 'Растяжка плеч', hint: 'Рука поперёк груди, тянем плечо' },
].map((e, i) => ({ ...e, img: `/workout/ex-${String(i + 1).padStart(2, '0')}.jpg` }));

const EX_SECONDS = 60;
const EX_COUNT = 7;
export const WORKOUT_DONE_KEY = 'workout.last.v1';

/** Каждый запуск — новая зарядка: тасуем базу и берём 7. */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Короткий бип на смену упражнения (WebAudio, без файлов). */
function beep(freq = 880, dur = 0.12) {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur + 0.02);
    setTimeout(() => { void ctx.close(); }, 400);
  } catch {}
}

const glass = 'rounded-xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08]';

/** Круглая картинка упражнения с заглушкой. */
const ExerciseImage: React.FC<{ ex: Exercise; size: number }> = ({ ex, size }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [ex.img]);
  return failed ? (
    <div
      className="rounded-full bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Dumbbell className="text-white/50" style={{ width: size * 0.3, height: size * 0.3 }} />
    </div>
  ) : (
    <img
      src={ex.img}
      alt={ex.name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Полноэкранная зарядка: 7 упражнений × 1 минута, кольцо-таймер, картинка в круге. */
export const WorkoutMode: React.FC<Props> = ({ open, onClose }) => {
  const { startTimeEntry, finishTimeEntry } = useStore();
  const [plan, setPlan] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EX_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  // Новый случайный план на каждое открытие
  useEffect(() => {
    if (open) {
      setPlan(shuffle(EXERCISES).slice(0, EX_COUNT));
      setIdx(0);
      setSecondsLeft(EX_SECONDS);
      setRunning(false);
      setFinished(false);
      elapsedRef.current = 0;
    } else if (entryRef.current) {
      // вышли до конца — фиксируем фактическое время
      finishTimeEntry(entryRef.current, elapsedRef.current);
      entryRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finish = () => {
    setRunning(false);
    setFinished(true);
    if (entryRef.current) { finishTimeEntry(entryRef.current, elapsedRef.current); entryRef.current = null; }
    try { localStorage.setItem(WORKOUT_DONE_KEY, isoDate(new Date())); } catch {}
    window.dispatchEvent(new CustomEvent('thedad:workout-done'));
    beep(880); setTimeout(() => beep(1175), 180); setTimeout(() => beep(1568), 360);
  };

  useEffect(() => {
    if (!running || finished) return;
    const t = window.setInterval(() => {
      elapsedRef.current += 1;
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // конец минуты: следующее упражнение или финиш
        setIdx((i) => {
          if (i >= EX_COUNT - 1) { finish(); return i; }
          beep();
          return i + 1;
        });
        return EX_SECONDS;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, finished]);

  const start = () => {
    if (!entryRef.current) {
      const e = startTimeEntry(null, 'free');
      entryRef.current = e.id;
    }
    setRunning(true);
    beep(660);
  };

  const skip = () => {
    if (finished) return;
    if (idx >= EX_COUNT - 1) { finish(); return; }
    beep();
    setIdx((i) => i + 1);
    setSecondsLeft(EX_SECONDS);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); running ? setRunning(false) : start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running]);

  if (!open) return null;

  const ex = plan[idx];
  const next = plan[idx + 1];
  const pct = (EX_SECONDS - secondsLeft) / EX_SECONDS;
  const R = 148;
  const C = 2 * Math.PI * R;
  const started = running || elapsedRef.current > 0;

  // portal: у ячеек сетки transform, из-за него fixed-оверлей внутри виджета ломается
  return createPortal(
    <div className="fixed inset-0 z-[210] text-white select-none bg-[#0b0a14]/97 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      {/* Выход */}
      <button onClick={onClose} className="absolute top-5 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors">
        <span className={`h-9 w-9 ${glass} !rounded-full flex items-center justify-center`}><X className="h-4 w-4" /></span>
        <span className="text-sm">Выйти</span>
        <kbd className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">Esc</kbd>
      </button>

      <div className={`hidden sm:flex absolute top-5 right-6 items-center gap-2 ${glass} !rounded-full px-4 py-2 text-sm`}>
        <Dumbbell className="h-4 w-4 text-emerald-300" /> Зарядка · 7 минут
      </div>

      {finished ? (
        /* Финальный экран */
        <div className="flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-emerald-400/15 text-emerald-300 flex items-center justify-center mb-5">
            <Check className="h-10 w-10" />
          </div>
          <div className="text-3xl font-bold">Зарядка сделана!</div>
          <p className="text-white/50 mt-2 max-w-xs">7 минут движения — день уже лучше. Завтра будет новый набор упражнений.</p>
          <button onClick={onClose} className={`mt-7 ${glass} px-6 py-2.5 text-sm font-medium hover:bg-white/[0.12] transition-colors`}>
            Готово
          </button>
        </div>
      ) : (
        <>
          {/* Круг: кольцо-таймер минуты + круглая картинка упражнения */}
          <div className="relative" style={{ width: 340, height: 340 }}>
            <svg width="340" height="340" className="absolute inset-0 -rotate-90">
              <circle cx="170" cy="170" r={R} stroke="rgba(255,255,255,0.10)" strokeWidth="6" fill="none" />
              <circle
                cx="170" cy="170" r={R}
                stroke="rgba(52,211,153,0.95)" strokeWidth="6" fill="none"
                strokeDasharray={C}
                strokeDashoffset={(1 - pct) * C}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 800ms linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {ex && <ExerciseImage ex={ex} size={264} />}
            </div>
            {/* Таймер минуты поверх нижней части круга */}
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 ${glass} !rounded-full px-4 py-1.5 text-xl font-bold tabular-nums`}>
              {fmtSec(secondsLeft)}
            </div>
          </div>

          {/* Название и подсказка */}
          <div className="text-center mt-7 min-h-[72px]">
            <div className="text-[11px] uppercase tracking-widest text-white/35 mb-1">Упражнение {idx + 1} из {EX_COUNT}</div>
            <div className="text-2xl font-bold leading-tight">{ex?.name}</div>
            <div className="text-sm text-white/45 mt-1">{ex?.hint}</div>
          </div>

          {/* Прогресс из 7 точек */}
          <div className="flex items-center gap-2 mt-4">
            {plan.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${i < idx ? 'w-2 bg-emerald-300' : i === idx ? 'w-6 bg-white' : 'w-2 bg-white/20'}`}
              />
            ))}
          </div>

          {/* Управление */}
          <div className="flex items-center gap-2 mt-6">
            {!running ? (
              <button onClick={start} className={`flex items-center gap-2 ${glass} px-6 py-2.5 text-sm font-medium hover:bg-white/[0.12] transition-colors`}>
                <Play className="h-4 w-4" fill="white" /> {started ? 'Продолжить' : 'Начать зарядку'}
              </button>
            ) : (
              <button onClick={() => setRunning(false)} className={`flex items-center gap-2 ${glass} px-6 py-2.5 text-sm font-medium hover:bg-white/[0.12] transition-colors`}>
                <Pause className="h-4 w-4" /> Пауза
              </button>
            )}
            <button onClick={skip} disabled={!started} className="h-10 w-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 flex items-center justify-center text-white/60 hover:text-white transition-colors" title="Пропустить упражнение">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          {/* Следующее упражнение */}
          <div className="mt-5 text-xs text-white/35 min-h-[18px]">
            {next ? <>Дальше: <span className="text-white/60">{next.name}</span></> : 'Последнее упражнение — дожми!'}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
};
