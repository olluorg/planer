/**
 * Адаптивная логика премиум-программ — то, что нельзя повторить одним промптом:
 * движок показывает сводку записей пользователя (вес, тренировки, калории).
 *
 * Чистая функция без побочных эффектов: analyzeProgram(...) → список инсайтов.
 */
import type { HealthLog } from './types';
import type { ProgramPack, WorkoutHub } from './marketplace';
import { workoutStreak } from './marketplace';
import { isoDate } from './utils';

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

function logsSince(logs: HealthLog[], metric: string, sinceISO: string): HealthLog[] {
  return logs.filter((l) => l.metric === metric && l.date >= sinceISO).sort((a, b) => a.date.localeCompare(b.date));
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

/** Проанализировать ход программы по фактическим данным. Возвращает 0..3 инсайта. */
export function analyzeProgram({ healthLogs, start, currentDay }: AnalyzeOpts): AdaptiveInsight[] {
  const out: AdaptiveInsight[] = [];

  /* ── Вес ── */
  const weights = logsSince(healthLogs, 'weight', start).filter((log) => Number.isFinite(log.value) && log.value > 0 && log.date <= daysAgoISO(0));
  if (new Set(weights.map((log) => log.date)).size < 2) {
    if (currentDay >= 3) {
      out.push({
        tone: 'info',
        title: 'Нужны данные веса',
        message: 'Добавьте измерения в разные дни, если хотите отслеживать изменение веса.',
      });
    }
  } else {
    const baseline = weights[0].value;
    const latest = weights[weights.length - 1].value;
    const change = latest - baseline;
    out.push({ tone: 'info', title: 'Изменение веса', message: `Между первой и последней записью: ${change > 0 ? '+' : ''}${change.toFixed(1)} кг. На вес влияет много факторов; по этим данным нельзя определить причину изменения.` });
  }

  /* ── Тренировки за последние 7 дней ── */
  if (currentDay >= 4) {
    const wk = logsSince(healthLogs, 'workout', daysAgoISO(6)).filter((log) => log.date <= daysAgoISO(0) && Number.isFinite(log.value) && log.value > 0);
    const sessions = new Set(wk.map((l) => l.date)).size; // по дням, не по минутам
    out.push({
      tone: 'info',
      title: 'Тренировки за неделю',
      message: `За последние 7 дней отмечено дней с тренировками: ${sessions}. План можно подстроить под доступное время и самочувствие.`,
    });
  }

  /* ── Логирование калорий ── */
  if (currentDay >= 3 && out.length < 3) {
    const cal = logsSince(healthLogs, 'calories', daysAgoISO(2)).filter((log) => log.date <= daysAgoISO(0));
    if (cal.length === 0) {
      out.push({
        tone: 'info',
        title: 'Записи питания',
        message: 'За последние три дня нет записей калорий. Можно отмечать питание, если вам удобно его отслеживать.',
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

const RECOVERY_TYPES = ['yoga', 'mobility'];

/** Подсказка по расписанию с учётом уже записанной активности и восстановления. */
export function recommendWorkout(hub: WorkoutHub, healthLogs: HealthLog[]): WorkoutRecommendation {
  const now = new Date();
  const iso = isoDate;
  const today = iso(now);
  const mondayIdx = (now.getDay() + 6) % 7;

  const doneDays = new Set(healthLogs.filter((l) => l.metric === 'workout' && l.value > 0).map((l) => l.date));
  const doneToday = doneDays.has(today);
  const streak = workoutStreak(healthLogs);

  const byId = (id: string) => hub.sessions.find((s) => s.id === id);
  const planned = (hub.schedule?.[mondayIdx]?.sessions ?? []).map(byId).filter((s): s is NonNullable<ReturnType<typeof byId>> => !!s);

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
  return { tone: 'good', title: 'Сегодня день отдыха', message: 'По плану восстановление. Держи шаги и сон — это тоже часть прогресса.' };
}
