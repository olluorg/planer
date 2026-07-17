import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, SkipForward, Check, Dumbbell, Flame, Flower2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { fmtSec } from '@/lib/pomodoroState';
import { logWorkout } from '@/lib/activity';

/* ==================== База упражнений ====================
 * Три типа тренировки, все домашние и без снаряжения. Картинки:
 *   зарядка   → public/workout/ex-NN.jpg
 *   калистеника → public/workout/calisthenics-NN.jpg
 *   йога      → public/workout/yoga-NN.jpg
 * Пока файла нет — показывается заглушка, тренировка работает и без картинок. */
export interface Exercise { name: string; hint: string; img: string }
export type WorkoutType = 'charge' | 'calisthenics' | 'yoga';

const CHARGE = [
  { name: 'Джампинг джек', hint: 'Прыжки: ноги врозь, руки вверх' },
  { name: 'Приседания', hint: 'Спина прямая, колени не выходят за носки' },
  { name: 'Отжимания', hint: 'Можно с колен — главное корпус ровный' },
  { name: 'Планка', hint: 'Живот подтянут, не проваливай поясницу' },
  { name: 'Выпады вперёд', hint: 'Поочерёдно каждой ногой' },
  { name: 'Скручивания', hint: 'Поясница прижата к полу' },
  { name: 'Бег на месте', hint: 'Держи ровный темп' },
  { name: 'Высокие колени', hint: 'Бег с подъёмом колен до пояса' },
  { name: 'Ягодичный мостик', hint: 'Пауза наверху на 1 секунду' },
  { name: 'Велосипед', hint: 'Локоть к противоположному колену' },
  { name: 'Махи руками', hint: 'Круги вперёд, затем назад' },
  { name: 'Круги тазом', hint: 'Разминаем корпус в обе стороны' },
  { name: 'Захлёст голени', hint: 'Бег на месте, пятки к ягодицам' },
  { name: 'Наклоны к ногам', hint: 'Тянемся к носкам, колени мягкие' },
];

const CALISTHENICS = [
  { name: 'Отжимания', hint: 'Локти вдоль тела, корпус — одна линия' },
  { name: 'Приседания', hint: 'Ниже параллели, пятки от пола не отрывать' },
  { name: 'Отжимания узким хватом', hint: 'Ладони под грудью, работают трицепсы' },
  { name: 'Обратные отжимания от стула', hint: 'Локти назад, опускайся до угла 90°' },
  { name: 'Болгарские выпады', hint: 'Задняя нога на диване, вес на передней' },
  { name: 'Планка', hint: 'Держи прямую линию от пяток до макушки' },
  { name: 'Боковая планка слева', hint: 'Локоть под плечом, таз вверх' },
  { name: 'Боковая планка справа', hint: 'Не проваливай бедро' },
  { name: 'Приседания с прыжком', hint: 'Взрывной вверх, мягкое приземление' },
  { name: 'Скалолаз', hint: 'Быстро подтягивай колени к груди' },
  { name: 'Ягодичный мостик на одной ноге', hint: 'Вторая нога вытянута' },
  { name: 'Супермен', hint: 'Отрывай руки и ноги, держи 2 секунды' },
  { name: 'Подъём ног лёжа', hint: 'Медленно вниз, поясница прижата' },
  { name: 'Стул у стены', hint: 'Бёдра параллельны полу, держим' },
  { name: 'Отжимания «щучка»', hint: 'Таз вверх, отжимайся под углом — плечи' },
];

const YOGA = [
  { name: 'Поза горы', hint: 'Стой ровно, дыши глубоко, плечи вниз' },
  { name: 'Собака мордой вниз', hint: 'Таз вверх, пятки тянем к полу' },
  { name: 'Поза ребёнка', hint: 'Колени врозь, лоб на пол, расслабься' },
  { name: 'Кошка-корова', hint: 'Плавно на вдохе прогиб, на выдохе округление' },
  { name: 'Поза кобры', hint: 'Грудь вверх, плечи от ушей, таз на полу' },
  { name: 'Поза воина II', hint: 'Переднее колено над стопой, руки в стороны' },
  { name: 'Наклон вперёд стоя', hint: 'Колени мягкие, отпусти шею и руки' },
  { name: 'Поза дерева (слева)', hint: 'Стопа на голени, взгляд в точку' },
  { name: 'Поза дерева (справа)', hint: 'Держи баланс, дыши ровно' },
  { name: 'Скручивание сидя', hint: 'Спина прямая, поворот от талии' },
  { name: 'Поза голубя', hint: 'Раскрытие бедра, дыши в натяжение' },
  { name: 'Мостик лёжа', hint: 'Таз вверх, лопатки вместе' },
  { name: 'Поза лодки', hint: 'Баланс на седалищных костях, пресс' },
  { name: 'Шавасана / дыхание', hint: 'Ляг, расслабься, дыши животом' },
];

function withImg(list: { name: string; hint: string }[], slug: string): Exercise[] {
  return list.map((e, i) => ({ ...e, img: `/workout/${slug}-${String(i + 1).padStart(2, '0')}.jpg` }));
}

export const WORKOUT_TYPES: { id: WorkoutType; label: string; icon: React.ElementType; hint: string; exercises: Exercise[] }[] = [
  { id: 'charge', label: 'Зарядка', icon: Dumbbell, hint: 'Лёгкая разминка на всё тело', exercises: withImg(CHARGE, 'ex') },
  { id: 'calisthenics', label: 'Калистеника', icon: Flame, hint: 'Сила с весом тела, без снаряжения', exercises: withImg(CALISTHENICS, 'calisthenics') },
  { id: 'yoga', label: 'Йога', icon: Flower2, hint: 'Растяжка, баланс и дыхание', exercises: withImg(YOGA, 'yoga') },
];

/** Для превью виджета — упражнения зарядки (обратная совместимость с /workout/ex-NN.jpg). */
export const EXERCISES = WORKOUT_TYPES[0].exercises;

const EX_SECONDS = 60;
const EX_COUNT = 7;
export const WORKOUT_DONE_KEY = 'workout.last.v1';
const TYPE_KEY = 'workout.type.v1';

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
  const [type, setType] = useState<WorkoutType>(() => (localStorage.getItem(TYPE_KEY) as WorkoutType) || 'charge');
  const [plan, setPlan] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EX_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  const exercisesOf = (t: WorkoutType) => WORKOUT_TYPES.find((x) => x.id === t)!.exercises;

  // Новый случайный план на каждое открытие
  useEffect(() => {
    if (open) {
      setPlan(shuffle(exercisesOf(type)).slice(0, EX_COUNT));
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

  // Смена типа до старта — пересобираем план под новый тип
  const pickType = (t: WorkoutType) => {
    setType(t);
    try { localStorage.setItem(TYPE_KEY, t); } catch {}
    setPlan(shuffle(exercisesOf(t)).slice(0, EX_COUNT));
    setIdx(0);
    setSecondsLeft(EX_SECONDS);
  };

  const finish = () => {
    setRunning(false);
    setFinished(true);
    if (entryRef.current) { finishTimeEntry(entryRef.current, elapsedRef.current); entryRef.current = null; }
    try { localStorage.setItem(WORKOUT_DONE_KEY, isoDate(new Date())); } catch {}
    // минуты зарядки → лог активности; событие поднимет useHealthSync,
    // который сведёт зарядку в healthLogs('workout') → виджеты и цели
    logWorkout(isoDate(new Date()), elapsedRef.current);
    window.dispatchEvent(new CustomEvent('thedad:workout-done'));
    // Крупный эмоциональный отклик: конфетти (App) + праздничный оверлей (Celebration)
    window.dispatchEvent(new CustomEvent('thedad:celebrate', {
      detail: { title: `${WORKOUT_TYPES.find((w) => w.id === type)!.label} — готово!`, subtitle: 'Минимальная активность на сегодня выполнена 💪', emoji: '🎉' },
    }));
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

  // portal: у ячеек сетки transform, из-за него fixed-оверлей внутри виджета ломается.
  // Фон полностью непрозрачный (как у Focus Mode): /97 не входит в шкалу opacity Tailwind
  // и класс молча не генерился — оверлей был прозрачным.
  return createPortal(
    <div
      className="fixed inset-0 z-[210] text-white select-none flex flex-col items-center justify-center p-4 bg-[#0b0a14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(52,211,153,0.10), transparent), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(99,102,241,0.10), transparent)' }}
    >
      {/* Выход */}
      <button onClick={onClose} className="absolute top-5 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors">
        <span className={`h-9 w-9 ${glass} !rounded-full flex items-center justify-center`}><X className="h-4 w-4" /></span>
        <span className="text-sm">Выйти</span>
        <kbd className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">Esc</kbd>
      </button>

      <div className={`hidden sm:flex absolute top-5 right-6 items-center gap-2 ${glass} !rounded-full px-4 py-2 text-sm`}>
        {(() => { const T = WORKOUT_TYPES.find((w) => w.id === type)!; return <><T.icon className="h-4 w-4 text-emerald-300" /> {T.label} · 7 минут</>; })()}
      </div>

      {finished ? (
        /* Финальный экран */
        <div className="flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-emerald-400/15 text-emerald-300 flex items-center justify-center mb-5">
            <Check className="h-10 w-10" />
          </div>
          <div className="text-3xl font-bold">{WORKOUT_TYPES.find((w) => w.id === type)!.label} — готово!</div>
          <p className="text-white/50 mt-2 max-w-xs">7 минут движения — день уже лучше. Каждый запуск — новый набор упражнений.</p>
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

          {/* Выбор типа тренировки — только до старта */}
          {!started && (
            <div className="flex items-center gap-2 mt-5">
              {WORKOUT_TYPES.map((wt) => (
                <button
                  key={wt.id}
                  onClick={() => pickType(wt.id)}
                  title={wt.hint}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all ${
                    type === wt.id ? 'bg-white/15 text-white ring-1 ring-white/50' : 'text-white/55 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <wt.icon className="h-4 w-4" /> {wt.label}
                </button>
              ))}
            </div>
          )}

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
                <Play className="h-4 w-4" fill="white" /> {started ? 'Продолжить' : `Начать · ${WORKOUT_TYPES.find((w) => w.id === type)!.label}`}
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
