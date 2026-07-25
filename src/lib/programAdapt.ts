/**
 * Адаптивная логика премиум-программ — то, что нельзя повторить одним промптом:
 * движок читает РЕАЛЬНЫЕ логи пользователя во времени (healthLogs: вес, тренировки,
 * калории) и подстраивает программу — рекомендует ужесточить/ослабить дефицит,
 * наверстать тренировки, добавить прогрессию. Показывается баннером в Программа-плеере.
 *
 * Чистая функция без побочных эффектов: analyzeProgram(...) → список инсайтов.
 */
import type { HealthLog } from './types';
import type { ProgramPack, WorkoutHub } from './marketplace';
import { workoutStreak } from './marketplace';

export interface AdaptiveInsight {
  tone: 'good' | 'warn' | 'info';
  title: string;
  message: string;
}

interface AnalyzeOpts {
  pack: ProgramPack;
  healthLogs: HealthLog[];
  /** Дата старта программы (ISO, из getProgress). */
  start: string;
  /** Текущий день программы (1..duration). */
  currentDay: number;
}

/** Целевой темп сброса кг/нед из цели пака (unit «кг») и длительности; иначе 0.5. */
function weeklyTargetKg(pack: ProgramPack): number {
  const g = pack.goals?.find((x) => (x.unit ?? '').toLowerCase().includes('кг'));
  const days = pack.duration_days || 56;
  if (g && g.target_value > 0 && days > 0) return (g.target_value / days) * 7;
  return 0.5;
}

function logsSince(logs: HealthLog[], metric: string, sinceISO: string): HealthLog[] {
  return logs.filter((l) => l.metric === metric && l.date >= sinceISO).sort((a, b) => a.date.localeCompare(b.date));
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Проанализировать ход программы по фактическим данным. Возвращает 0..3 инсайта. */
export function analyzeProgram({ pack, healthLogs, start, currentDay }: AnalyzeOpts): AdaptiveInsight[] {
  const out: AdaptiveInsight[] = [];
  const weeks = Math.max(currentDay / 7, 0.1);

  /* ── Вес ── */
  const weights = logsSince(healthLogs, 'weight', start);
  if (weights.length < 2) {
    if (currentDay >= 3) {
      out.push({
        tone: 'info',
        title: 'Нужны данные веса',
        message: 'Взвешивайся утром натощак каждый день — без динамики веса я не могу подстроить программу под тебя.',
      });
    }
  } else {
    const baseline = weights[0].value;
    const latest = weights[weights.length - 1].value;
    const lost = baseline - latest;
    const expected = weeklyTargetKg(pack) * weeks;
    const ratio = expected > 0 ? lost / expected : 1;

    if (lost <= 0) {
      out.push({
        tone: 'warn',
        title: 'Вес стоит или растёт',
        message: 'За это время снижения нет. Проверь порции и скрытые калории (соусы, напитки), ужесточи дефицит на ~200 ккал и добавь 2000 шагов. Иногда виновата вода — но если так неделю, нужна корректировка.',
      });
    } else if (ratio < 0.85) {
      out.push({
        tone: 'warn',
        title: 'Отстаёшь от графика',
        message: `Сброшено ${lost.toFixed(1)} кг, по плану — около ${expected.toFixed(1)} кг. Урежь порции углеводов на ужин или добавь кардио/шаги. Небольшой дефицит +150 ккал вернёт в график.`,
      });
    } else if (ratio > 1.5) {
      out.push({
        tone: 'warn',
        title: 'Теряешь слишком быстро',
        message: `Сброшено ${lost.toFixed(1)} кг — быстрее плана. Так теряешь и мышцы. Добавь +150–200 ккал (белок) и не опускайся ниже нормы, иначе вес встанет и вернётся.`,
      });
    } else {
      out.push({
        tone: 'good',
        title: 'Идёшь точно в графике',
        message: `Сброшено ${lost.toFixed(1)} кг — ровно то, что нужно (${expected.toFixed(1)} кг по плану). Ничего не меняй, продолжай в том же режиме.`,
      });
    }
  }

  /* ── Тренировки за последние 7 дней ── */
  if (currentDay >= 4) {
    const wk = logsSince(healthLogs, 'workout', daysAgoISO(6));
    const sessions = new Set(wk.map((l) => l.date)).size; // по дням, не по минутам
    if (sessions >= 3) {
      out.push({
        tone: 'good',
        title: 'Тренировки под контролем',
        message: 'Три и больше силовых за неделю — отлично. Добавь прогрессию: +1–2 повтора или чуть больше вес, иначе тело привыкнет.',
      });
    } else if (sessions <= 1) {
      out.push({
        tone: 'warn',
        title: 'Пропускаешь тренировки',
        message: `За неделю силовых: ${sessions}. Мышцы держат метаболизм — без них вес уходит медленнее. Сделай короткую сессию сегодня, даже 20 минут считается.`,
      });
    }
  }

  /* ── Логирование калорий ── */
  if (currentDay >= 3 && out.length < 3) {
    const cal = logsSince(healthLogs, 'calories', daysAgoISO(2));
    if (cal.length === 0) {
      out.push({
        tone: 'info',
        title: 'Отмечай съеденное',
        message: 'Ты не логируешь калории — это главный рычаг похудения. Отмечай приёмы пищи, чтобы видеть дефицит и вовремя ловить переедание.',
      });
    }
  }

  return out.slice(0, 3);
}

/* ==================== Адаптивная рекомендация тренировки на сегодня ==================== */

export interface WorkoutRecommendation {
  tone: 'good' | 'warn' | 'info';
  title: string;
  message: string;
  sessionId?: string;   // если движок предлагает конкретную тренировку — её id
}

const RECOVERY_TYPES = ['yoga', 'mobility', 'cardio'];

/** Что тренировать сегодня — по расписанию + фактической активности:
 *  уже тренировался → отдых; длинный стрик → восстановление; отставание → наверстать. */
export function recommendWorkout(hub: WorkoutHub, healthLogs: HealthLog[]): WorkoutRecommendation {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(now);
  const mondayIdx = (now.getDay() + 6) % 7;

  const doneDays = new Set(healthLogs.filter((l) => l.metric === 'workout' && l.value > 0).map((l) => l.date));
  const doneToday = doneDays.has(today);
  const streak = workoutStreak(healthLogs);

  const byId = (id: string) => hub.sessions.find((s) => s.id === id);
  const planned = (hub.schedule?.[mondayIdx]?.sessions ?? []).map(byId).filter((s): s is NonNullable<ReturnType<typeof byId>> => !!s);

  // тренировок за последние 7 дней (уникальные дни) vs запланировано в неделю
  let weekDone = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(d.getDate() - i); if (doneDays.has(iso(d))) weekDone++; }
  const weekPlanned = (hub.schedule ?? []).filter((d) => d.sessions.length > 0).length;

  if (doneToday) {
    return { tone: 'good', title: 'Сегодня уже тренировался', message: 'Отличная работа. Дай телу восстановиться — завтра продолжим по плану.' };
  }
  if (streak >= 5) {
    const recovery = hub.sessions.find((s) => RECOVERY_TYPES.includes(s.type.trim().toLowerCase()));
    return {
      tone: 'warn',
      title: `${streak} дней подряд — пора восстановиться`,
      message: recovery ? `Мышцы растут в отдыхе. Сегодня лёгкое: «${recovery.title}».` : 'Мышцы растут в отдыхе. Сделай сегодня лёгкую активность или отдохни.',
      sessionId: recovery?.id,
    };
  }
  if (planned.length > 0) {
    return { tone: 'info', title: 'План на сегодня', message: `По расписанию: «${planned[0].title}». Начни, когда будешь готов.`, sessionId: planned[0].id };
  }
  // день отдыха по расписанию, но если отстаёшь от недельной нормы — предложи наверстать
  if (weekPlanned > 0 && weekDone < weekPlanned - 1) {
    const catchUp = hub.sessions.find((s) => s.type.trim().toLowerCase() === 'strength') ?? hub.sessions[0];
    return {
      tone: 'warn',
      title: 'Отстаёшь от недельной нормы',
      message: catchUp ? `За неделю ${weekDone} из ${weekPlanned} тренировок. Наверстай: «${catchUp.title}».` : `За неделю ${weekDone} из ${weekPlanned}. Добавь тренировку сегодня.`,
      sessionId: catchUp?.id,
    };
  }
  return { tone: 'good', title: 'Сегодня день отдыха', message: 'По плану восстановление. Держи шаги и сон — это тоже часть прогресса.' };
}
