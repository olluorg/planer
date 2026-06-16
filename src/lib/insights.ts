import { addDays, differenceInCalendarDays } from 'date-fns';
import { isoDate } from './utils';
import type { Goal, Habit, HabitLog, ProgressRecord, Reflection, Task, TimeEntry } from './types';
import { forecastGoal } from './predict';

export type InsightTone = 'positive' | 'warning' | 'neutral' | 'info';

export interface Insight {
  id: string;
  tone: InsightTone;
  icon: string;       // emoji
  title: string;
  body: string;
  link?: string;
  priority: number;   // выше = важнее
}

export interface InsightCtx {
  today: Date;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  reflections: Reflection[];
  timeEntries: TimeEntry[];
  goals: Goal[];
  progress: ProgressRecord[];
}

function lastNDays(today: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => isoDate(addDays(today, -i)));
}

// Самый продуктивный час по pomodoro / выполненным задачам
function bestFocusWindow(ctx: InsightCtx): { from: number; to: number; count: number } | null {
  const buckets = new Array(24).fill(0);
  ctx.timeEntries.forEach((e) => {
    if (e.type !== 'pomodoro') return;
    const h = new Date(e.started_at).getHours();
    buckets[h] += e.duration;
  });
  let bestHour = -1, best = 0;
  buckets.forEach((v, h) => { if (v > best) { best = v; bestHour = h; } });
  if (bestHour < 0 || best === 0) return null;
  return { from: bestHour, to: (bestHour + 2) % 24, count: best };
}

export function computeInsights(ctx: InsightCtx): Insight[] {
  const out: Insight[] = [];
  const d7 = lastNDays(ctx.today, 7);
  const d14 = lastNDays(ctx.today, 14);

  // 1. Окно фокуса
  const win = bestFocusWindow(ctx);
  if (win) {
    out.push({
      id: 'focus_window',
      tone: 'info', icon: '🎯', priority: 80,
      title: `Твой пик фокуса — ${String(win.from).padStart(2, '0')}:00–${String(win.to).padStart(2, '0')}:00`,
      body: 'В это время ты делаешь больше всего глубокой работы. Планируй на него самые важные задачи.',
    });
  }

  // 2. Привычки на серии
  ctx.habits.forEach((h) => {
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const day = isoDate(addDays(ctx.today, -i));
      if (ctx.habitLogs.some((l) => l.habit_id === h.id && l.date === day)) streak++;
      else if (i > 0) break;
    }
    if (streak >= 5) {
      out.push({
        id: `habit_streak_${h.id}`,
        tone: 'positive', icon: '🔥', priority: 70 + Math.min(streak, 20),
        title: `«${h.title}» — ${streak} дней подряд`,
        body: streak >= 14 ? 'Это уже устойчивая привычка. Отличная работа.' : 'Хороший разгон, не прерывай серию.',
        link: '/habits',
      });
    }
  });

  // 3. Цели под угрозой по срокам
  ctx.goals.filter((g) => !g.parent_id && g.deadline && g.status === 'active').forEach((g) => {
    const recs = ctx.progress.filter((p) => p.goal_id === g.id);
    const fc = forecastGoal(g, recs, 30);
    if (!g.deadline) return;
    const denom = g.target_value - g.start_value || 1;
    const valueFrac = Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
    if (valueFrac >= 1) return;
    if (fc.etaDate) {
      const days = differenceInCalendarDays(new Date(fc.etaDate), new Date(g.deadline));
      if (days > 5) {
        out.push({
          id: `goal_risk_${g.id}`,
          tone: 'warning', icon: '⚠️', priority: 90,
          title: `Цель «${g.title}» под угрозой`,
          body: `По текущему темпу ты опаздываешь на ~${days} дн. Увеличь частоту действий.`,
          link: '/goals',
        });
      } else if (days < -5) {
        out.push({
          id: `goal_ahead_${g.id}`,
          tone: 'positive', icon: '🚀', priority: 60,
          title: `Цель «${g.title}» опережает график`,
          body: `Ты впереди плана примерно на ${-days} дн. Так держать!`,
          link: '/goals',
        });
      }
    } else {
      // прогресс есть, дедлайн близко, данных мало
      const left = differenceInCalendarDays(new Date(g.deadline), ctx.today);
      if (left >= 0 && left < 14 && valueFrac < 0.5) {
        out.push({
          id: `goal_low_${g.id}`,
          tone: 'warning', icon: '⏳', priority: 75,
          title: `«${g.title}»: ${left} дн. до срока`,
          body: `Прогресс ${Math.round(valueFrac * 100)}%. Самое время ускориться.`,
          link: '/goals',
        });
      }
    }
  });

  // 4. Сравнение недель по задачам
  const doneThis = ctx.tasks.filter((t) => d7.includes(t.date) && t.status === 'done').length;
  const prev7 = lastNDays(addDays(ctx.today, -7), 7);
  const donePrev = ctx.tasks.filter((t) => prev7.includes(t.date) && t.status === 'done').length;
  if (donePrev > 0) {
    const delta = doneThis - donePrev;
    const pct = Math.round((delta / donePrev) * 100);
    if (Math.abs(pct) >= 15) {
      out.push({
        id: 'week_trend',
        tone: delta >= 0 ? 'positive' : 'warning',
        icon: delta >= 0 ? '📈' : '📉', priority: 65,
        title: delta >= 0 ? `Ты ускорился на ${pct}%` : `Темп упал на ${Math.abs(pct)}%`,
        body: `За эту неделю ${doneThis} задач против ${donePrev} на прошлой.`,
        link: '/analytics',
      });
    }
  }

  // 5. Просадка по рефлексии
  const reflDays = d7.filter((d) => ctx.reflections.some((r) => r.date === d && r.mood !== null)).length;
  if (reflDays <= 2) {
    out.push({
      id: 'reflection_gap',
      tone: 'neutral', icon: '📝', priority: 50,
      title: 'Мало рефлексии на этой неделе',
      body: `Только ${reflDays} из 7 дней с записью. Рефлексия закрепляет прогресс.`,
      link: '/reflection',
    });
  }

  // 6. Настроение и привычки (мотивация)
  const moods = ctx.reflections.filter((r) => d14.includes(r.date) && r.mood !== null).map((r) => r.mood as number);
  if (moods.length >= 5) {
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
    if (avg >= 3) {
      out.push({
        id: 'mood_high',
        tone: 'positive', icon: '😊', priority: 40,
        title: 'Стабильно хорошее настроение',
        body: 'Последние 2 недели в плюсе. Зафиксируй, что работает.',
      });
    } else if (avg < 1.5) {
      out.push({
        id: 'mood_low',
        tone: 'warning', icon: '🫂', priority: 55,
        title: 'Настроение снижено',
        body: 'Возможно, стоит снизить нагрузку или добавить отдых в план.',
      });
    }
  }

  // 7. Нет задач на сегодня
  const todayIso = isoDate(ctx.today);
  const todayTasks = ctx.tasks.filter((t) => t.date === todayIso && !t.parent_id);
  if (todayTasks.length === 0) {
    out.push({
      id: 'empty_today',
      tone: 'info', icon: '🌱', priority: 45,
      title: 'На сегодня пусто',
      body: 'Добавь хотя бы 1–3 задачи, чтобы день имел направление.',
      link: '/tasks',
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
