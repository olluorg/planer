import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Pause, Play, SkipForward, Check, Dumbbell, Flame, Flower2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { fmtSec } from '@/lib/pomodoroState';
import { logWorkout, WORKOUT_TYPE_MET } from '@/lib/activity';
import { activityAction } from '@/lib/activityAction';

/* ==================== База упражнений ====================
 * Три типа тренировки, все домашние и без снаряжения. Картинки:
 *   зарядка   → public/workout/ex-NN.jpg
 *   калистеника → public/workout/calisthenics-NN.jpg
 *   йога      → public/workout/yoga-NN.jpg
 * Пока файла нет — показывается заглушка, тренировка работает и без картинок. */
export interface Exercise { name: string; hint: string; img: string }
export type WorkoutType = 'charge' | 'calisthenics' | 'yoga' | 'low-impact';

const studioImage = (id: string) => `/workout/studio/${id}.webp`;
const STUDIO_BY_NAME: Record<string, string> = {
  'Приседания': 'squat', 'Отжимания': 'push-up', 'Выпады вперёд': 'forward-lunge',
  'Планка': 'plank', 'Ягодичный мостик': 'bridge', 'Поза ребёнка': 'child-pose', 'Кошка-корова': 'cat-cow',
  'Джампинг джек': 'jumping-jack', 'Собака мордой вниз': 'downward-dog',
  'Боковая планка слева': 'side-plank', 'Боковая планка справа': 'side-plank',
  'Поза горы': 'mountain-pose', 'Стул у стены': 'wall-sit', 'Высокие колени': 'high-knees',
  'Поза кобры': 'cobra-pose', 'Поза воина II': 'warrior-two',
  'Скручивания': 'crunch', 'Наклон вперёд стоя': 'standing-forward-fold',
  'Велосипед': 'bicycle-crunch', 'Подъём ног лёжа': 'leg-raise',
  'Бег на месте': 'jog-in-place', 'Супермен': 'superman', 'Махи руками': 'arm-circles', 'Скалолаз': 'mountain-climber',
  'Поза дерева (слева)': 'tree-pose', 'Поза дерева (справа)': 'tree-pose',
  'Поза лодки': 'boat-pose',
  'Захлёст голени': 'butt-kick',
  'Шавасана / дыхание': 'savasana', 'Мостик лёжа': 'bridge',
  'Наклоны к ногам': 'standing-forward-fold',
  'Круги тазом': 'hip-circles', 'Ягодичный мостик на одной ноге': 'single-leg-bridge',
  'Поза голубя': 'pigeon-pose',
  'Отжимания узким хватом': 'close-grip-push-up', 'Болгарские выпады': 'bulgarian-split-squat',
  'Отжимания «щучка»': 'pike-push-up',
  'Обратные отжимания от стула': 'bench-dip', 'Приседания с прыжком': 'squat-jump',
};

export const LOW_IMPACT: Exercise[] = [
  { name: 'Шаг на месте', hint: 'Начни спокойно, ставь стопу мягко и дыши свободно.', img: studioImage('march') },
  { name: 'Приседания', hint: 'Пятки на полу, колени по направлению стоп. Выбирай комфортную глубину.', img: studioImage('squat') },
  { name: 'Подъём на носки', hint: 'Плавно поднимай и опускай пятки, опираясь на переднюю часть стоп. При необходимости держись за опору.', img: studioImage('calf-raise') },
  { name: 'Ягодичный мостик', hint: 'Стопы на полу. Поднимай таз без чрезмерного прогиба поясницы.', img: studioImage('bridge') },
  { name: 'Птица-собака', hint: 'Из положения на четвереньках вытягивай противоположные руку и ногу. Чередуй стороны, сохраняя таз ровным.', img: studioImage('bird-dog') },
  { name: 'Планка', hint: 'Локти под плечами, дыши свободно. Можно опустить колени или сделать паузу раньше сигнала.', img: studioImage('plank') },
  { name: 'Поза ребёнка', hint: 'Мягко отведи таз к пяткам и расслабь плечи. Не углубляй положение через боль.', img: studioImage('child-pose') },
];

const CHARGE = [
  { name: 'Джампинг джек', hint: 'Прыжки: ноги врозь, руки вверх' },
  { name: 'Приседания', hint: 'Пятки на полу, колени по направлению стоп; выбирай комфортную глубину' },
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
  { name: 'Приседания', hint: 'Пятки на полу, колени по направлению стоп; выбирай комфортную глубину' },
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
  { name: 'Поза дерева (слева)', hint: 'Опора на левой ноге. Стопа у щиколотки или на голени, не на колене.' },
  { name: 'Поза дерева (справа)', hint: 'Опора на правой ноге. Стопа у щиколотки или на голени, не на колене.' },
  { name: 'Скручивание сидя', hint: 'Спина прямая, поворот от талии' },
  { name: 'Поза голубя', hint: 'Раскрытие бедра, дыши в натяжение' },
  { name: 'Мостик лёжа', hint: 'Таз вверх, лопатки вместе' },
  { name: 'Поза лодки', hint: 'Балансируй на седалищных костях, держи спину вытянутой; колени можно согнуть.' },
  { name: 'Шавасана / дыхание', hint: 'Ляг, расслабься, дыши животом' },
];

function withImg(list: { name: string; hint: string }[], slug: string): Exercise[] {
  return list.map((e, i) => ({ ...e, img: STUDIO_BY_NAME[e.name] ? studioImage(STUDIO_BY_NAME[e.name]) : `/workout/${slug}-${String(i + 1).padStart(2, '0')}.jpg` }));
}

export const WORKOUT_TYPES: { id: WorkoutType; label: string; icon: React.ElementType; hint: string; exercises: Exercise[] }[] = [
  { id: 'low-impact', label: 'Без прыжков', icon: Flower2, hint: '7 минут · коврик · спокойный темп · фиксированный порядок', exercises: LOW_IMPACT },
  { id: 'charge', label: 'Зарядка', icon: Dumbbell, hint: 'Лёгкая разминка на всё тело', exercises: withImg(CHARGE, 'ex') },
  { id: 'calisthenics', label: 'Калистеника', icon: Flame, hint: 'Сила с весом тела; для некоторых упражнений нужна устойчивая опора', exercises: withImg(CALISTHENICS, 'calisthenics') },
  { id: 'yoga', label: 'Йога', icon: Flower2, hint: 'Растяжка, баланс и дыхание', exercises: withImg(YOGA, 'yoga') },
];

/** Для превью виджета — упражнения зарядки (обратная совместимость с /workout/ex-NN.jpg). */
export const EXERCISES = LOW_IMPACT;

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
      className="rounded-2xl object-contain bg-white p-2"
      style={{ width: size, height: size, transform: ex.name === 'Поза дерева (справа)' ? 'scaleX(-1)' : undefined }}
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
  const [type, setType] = useState<WorkoutType>(() => {
    const saved = localStorage.getItem(TYPE_KEY);
    return WORKOUT_TYPES.find((w) => w.id === saved)?.id ?? 'low-impact';
  });
  const [plan, setPlan] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EX_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [workoutSaved, setWorkoutSaved] = useState(true);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const idxRef = useRef(0);
  const secondsRef = useRef(EX_SECONDS);
  const finishedRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});

  const exercisesOf = (t: WorkoutType) => WORKOUT_TYPES.find((x) => x.id === t)!.exercises;
  const makePlan = (t: WorkoutType) => t === 'low-impact' ? [...LOW_IMPACT] : shuffle(exercisesOf(t)).slice(0, EX_COUNT);

  // Новый случайный план на каждое открытие
  useEffect(() => {
    if (open) {
      setPlan(makePlan(type));
      setIdx(0);
      setSecondsLeft(EX_SECONDS);
      setRunning(false);
      setFinished(false);
      setWorkoutSaved(true);
      elapsedRef.current = 0;
      idxRef.current = 0;
      secondsRef.current = EX_SECONDS;
      finishedRef.current = false;
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
    setPlan(makePlan(t));
    setIdx(0);
    setSecondsLeft(EX_SECONDS);
    idxRef.current = 0;
    secondsRef.current = EX_SECONDS;
  };

  const saveWorkoutSession = () => {
    const saved = activityAction(() => logWorkout(isoDate(new Date()), elapsedRef.current, WORKOUT_TYPE_MET[type])) !== undefined;
    setWorkoutSaved(saved);
    if (saved) {
      try { localStorage.setItem(WORKOUT_DONE_KEY, isoDate(new Date())); } catch {}
      window.dispatchEvent(new CustomEvent('thedad:workout-done'));
    }
    return saved;
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setFinished(true);
    if (entryRef.current) { finishTimeEntry(entryRef.current, elapsedRef.current); entryRef.current = null; }
    // минуты зарядки → лог активности; событие поднимет useHealthSync,
    // который сведёт зарядку в healthLogs('workout') → виджеты и цели
    saveWorkoutSession();
    // Крупный эмоциональный отклик: конфетти (App) + праздничный оверлей (Celebration)
    window.dispatchEvent(new CustomEvent('thedad:celebrate', {
      detail: { title: `${WORKOUT_TYPES.find((w) => w.id === type)!.label} — готово!`, subtitle: 'Минимальная активность на сегодня выполнена 💪', emoji: '🎉' },
    }));
    beep(880); setTimeout(() => beep(1175), 180); setTimeout(() => beep(1568), 360);
  };

  const closeWorkout = () => {
    if (finished && !workoutSaved && !window.confirm('Активность не сохранена. Выйти без записи времени тренировки?')) return;
    if (running) tickRef.current();
    setRunning(false);
    if (entryRef.current) {
      if (elapsedRef.current > 0 && activityAction(() => logWorkout(isoDate(new Date()), elapsedRef.current, WORKOUT_TYPE_MET[type])) === undefined) return;
      finishTimeEntry(entryRef.current, elapsedRef.current);
      entryRef.current = null;
    }
    onClose();
  };

  useEffect(() => {
    if (!running || finished) return;
    let lastTick = performance.now();
    const tick = () => {
      let delta = Math.floor((performance.now() - lastTick) / 1000);
      if (delta <= 0) return;
      lastTick += delta * 1000;
      let transitioned = false;
      while (delta > 0 && !finishedRef.current) {
        const spent = Math.min(delta, secondsRef.current);
        secondsRef.current -= spent;
        elapsedRef.current += spent;
        delta -= spent;
        if (secondsRef.current === 0) {
          if (idxRef.current >= EX_COUNT - 1) { finish(); break; }
          idxRef.current += 1;
          secondsRef.current = EX_SECONDS;
          transitioned = true;
        }
      }
      setIdx(idxRef.current);
      setSecondsLeft(secondsRef.current);
      if (transitioned && !finishedRef.current) beep();
    };
    tickRef.current = tick;
    const t = window.setInterval(tick, 1000);
    return () => { window.clearInterval(t); tickRef.current = () => {}; };
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
    if (running) tickRef.current();
    if (finishedRef.current) return;
    if (idxRef.current >= EX_COUNT - 1) { finish(); return; }
    beep();
    idxRef.current += 1;
    secondsRef.current = EX_SECONDS;
    setIdx(idxRef.current);
    setSecondsLeft(EX_SECONDS);
  };

  const pause = () => { tickRef.current(); setRunning(false); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWorkout();
      if (e.key === ' ' && !finished && !e.repeat) {
        const target = e.target;
        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('button, input, textarea, select, a, summary, [role="button"]'))) return;
        e.preventDefault();
        running ? pause() : start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running, finished, type]);

  if (!open) return null;

  const ex = plan[idx];
  const next = plan[idx + 1];
  const pct = (EX_SECONDS - secondsLeft) / EX_SECONDS;
  const R = 148;
  const C = 2 * Math.PI * R;
  const started = running || entryRef.current !== null;

  // portal: у ячеек сетки transform, из-за него fixed-оверлей внутри виджета ломается.
  // Фон полностью непрозрачный (как у Focus Mode): /97 не входит в шкалу opacity Tailwind
  // и класс молча не генерился — оверлей был прозрачным.
  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Тренировка"
      className="fixed inset-0 z-[210] text-white select-none flex flex-col items-center overflow-y-auto p-4 pt-20 bg-[#0b0a14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(52,211,153,0.10), transparent), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(99,102,241,0.10), transparent)' }}
    >
      {/* Выход */}
      <button onClick={closeWorkout} className="absolute top-5 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors">
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
          <p className="text-white/50 mt-2 max-w-xs">{workoutSaved ? 'Сессия завершена. В журнал записано фактическое время движения.' : 'Сессия завершена, но активность не записана. Проверьте хранилище и повторите сохранение.'}</p>
          {!workoutSaved && <button onClick={saveWorkoutSession} className={`mt-4 ${glass} px-6 py-2.5 text-sm font-medium`}>Повторить сохранение активности</button>}
          <button onClick={closeWorkout} className={`mt-7 ${glass} px-6 py-2.5 text-sm font-medium hover:bg-white/[0.12] transition-colors`}>
            Готово
          </button>
        </div>
      ) : (
        <>
          {/* Круг: кольцо-таймер минуты + круглая картинка упражнения */}
          <div className="relative shrink-0" style={{ width: 'min(340px, calc(100vw - 32px))', height: 'min(340px, calc(100vw - 32px))' }}>
            <svg width="100%" height="100%" viewBox="0 0 340 340" className="absolute inset-0 -rotate-90">
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
            <div className="flex flex-wrap justify-center items-center gap-2 mt-5 max-w-lg">
              {WORKOUT_TYPES.map((wt) => (
                <button
                  key={wt.id}
                  onClick={() => pickType(wt.id)}
                  aria-pressed={type === wt.id}
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
          {!started && <details className="mt-4 w-full max-w-lg rounded-xl border border-white/15 bg-white/5 p-3 text-sm">
            <summary className="cursor-pointer text-white/80">План занятия · 7 упражнений · 7 минут</summary>
            <p className="mt-2 text-white/55">{WORKOUT_TYPES.find((w) => w.id === type)!.hint}</p>
            <ol className="mt-3 space-y-2" aria-label="Упражнения до старта">
              {plan.map((exercise, i) => <li key={i} className="flex gap-3 text-white/75"><span className="text-white/35 tabular-nums">{i + 1}.</span><span className="flex-1">{exercise.name}</span><span className="text-white/40">60 с</span></li>)}
            </ol>
          </details>}
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
              <button onClick={pause} className={`flex items-center gap-2 ${glass} px-6 py-2.5 text-sm font-medium hover:bg-white/[0.12] transition-colors`}>
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
