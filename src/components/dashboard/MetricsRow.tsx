import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MetricCard } from '@/components/ui/metric-card';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { addDays } from 'date-fns';
import { computeStreak } from '@/lib/gamification';
import { Target, CheckSquare, Flame, Zap } from 'lucide-react';

export const MetricsRow: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { tasks, habits, habitLogs, reflections, xpLog } = useStore();

  const m = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(date, -6 + i)));

    // Focus Score: дневная доля выполненных задач (для спарклайна) + сегодняшнее значение
    const focusSeries = days.map((d) => {
      const dt = tasks.filter((t) => t.date === d);
      return dt.length ? Math.round((dt.filter((t) => t.status === 'done').length / dt.length) * 100) : 0;
    });
    const focusScore = focusSeries[focusSeries.length - 1];
    const focusPrev = focusSeries[focusSeries.length - 2] || 0;
    const focusDelta = focusPrev ? Math.round(((focusScore - focusPrev) / focusPrev) * 100) : null;

    // Tasks Progress: % за сегодня
    const todayIso = isoDate(date);
    const dt = tasks.filter((t) => t.date === todayIso);
    const tasksProgress = dt.length ? Math.round((dt.filter((t) => t.status === 'done').length / dt.length) * 100) : 0;

    // Habit Streak: общий стрик активности
    const streak = computeStreak(date, tasks, habitLogs, reflections);
    const streakSeries = days.map((d) => {
      return habits.filter((h) => habitLogs.some((l) => l.habit_id === h.id && l.date === d)).length;
    });

    // Energy: производная от XP за неделю (нормализовано) + настроение
    const xpSeries = days.map((d) => xpLog.filter((e) => e.date === d).reduce((s, e) => s + e.amount, 0));
    const xpMax = Math.max(1, ...xpSeries);
    const energySeries = days.map((d, i) => {
      const refl = reflections.find((r) => r.date === d);
      const moodPart = refl?.mood != null ? (refl.mood / 4) * 50 : 25;
      const xpPart = (xpSeries[i] / xpMax) * 50;
      return Math.round(moodPart + xpPart);
    });
    const energy = energySeries[energySeries.length - 1];
    const energyPrev = energySeries[energySeries.length - 2] || 0;
    const energyDelta = energyPrev ? Math.round(((energy - energyPrev) / energyPrev) * 100) : null;

    return {
      focusScore, focusDelta, focusSeries,
      tasksProgress, tasksSeries: focusSeries,
      streak, streakSeries,
      energy, energyDelta, energySeries,
    };
  }, [tasks, habits, habitLogs, reflections, xpLog, date]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        label="Фокус"
        value={m.focusScore}
        suffix="%"
        delta={m.focusDelta}
        data={m.focusSeries}
        color="#6366f1"
        icon={<Target className="h-4 w-4" />}
        onClick={() => nav('/analytics')}
      />
      <MetricCard
        label="Задачи сегодня"
        value={m.tasksProgress}
        suffix="%"
        data={m.tasksSeries}
        color="#8b5cf6"
        icon={<CheckSquare className="h-4 w-4" />}
        onClick={() => nav('/tasks')}
      />
      <MetricCard
        label="Серия дней"
        value={m.streak}
        data={m.streakSeries}
        color="#f59e0b"
        icon={<Flame className="h-4 w-4" />}
        onClick={() => nav('/awards')}
      />
      <MetricCard
        label="Энергия"
        value={m.energy}
        suffix="%"
        delta={m.energyDelta}
        data={m.energySeries}
        color="#22c55e"
        icon={<Zap className="h-4 w-4" />}
        onClick={() => nav('/reflection')}
      />
    </div>
  );
};
