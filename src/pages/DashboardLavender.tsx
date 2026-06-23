import { useState, useMemo } from 'react';
import { startOfWeek, addDays } from 'date-fns';
import { TodayFocus } from '@/components/dashboard/TodayFocus';
import { DayBrief } from '@/components/dashboard/DayBrief';
import { TodayPlanList } from '@/components/dashboard/TodayPlanList';
import { HabitDots } from '@/components/dashboard/HabitDots';
import { WeeklyConsistency } from '@/components/dashboard/WeeklyConsistency';
import { TimeAllocation } from '@/components/dashboard/TimeAllocation';
import { WeekProgressChart } from '@/components/dashboard/WeekProgressChart';
import { GoalsProgress } from '@/components/dashboard/GoalsProgress';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { QuickCapture } from '@/components/dashboard/QuickCapture';
import { QuickAddDialog } from '@/components/QuickAddDialog';
import { getUserName } from '@/lib/onboarding';
import { quoteOfDay } from '@/lib/quotes';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface Props { date: Date; onDateChange?: (d: Date) => void; onStartFocus?: () => void }

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export const DashboardLavender: React.FC<Props> = ({ date, onStartFocus }) => {
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | null>(null);
  const { tasks } = useStore();
  const quote = quoteOfDay();

  const weekPct = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const days = new Set(Array.from({ length: 7 }, (_, i) => isoDate(addDays(start, i))));
    const wk = tasks.filter((t) => days.has(t.date) && !t.parent_id);
    return wk.length ? Math.round((wk.filter((t) => t.status === 'done').length / wk.length) * 100) : 0;
  }, [tasks, date]);

  return (
    <div className="page py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Приветствие */}
      <div>
        <h1 className="text-h1 text-text flex items-center gap-2">
          {greeting()}, {getUserName()} <span className="text-2xl">👋</span>
        </h1>
        <div className="text-sm text-text-muted mt-1">
          Ты на <span className="text-accent font-semibold">{weekPct}%</span> ближе к своим целям на этой неделе.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 sm:gap-6 items-start">
        {/* Главная колонка */}
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Hero: фокус дня + сводка */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 sm:gap-6">
            <TodayFocus date={date} onStartFocus={() => onStartFocus?.()} />
            <DayBrief date={date} />
          </div>

          {/* Ряд: план · привычки · консистентность */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <TodayPlanList date={date} />
            <HabitDots date={date} />
            <WeeklyConsistency />
          </div>

          {/* Ряд графиков: распределение · тренд · цели */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <TimeAllocation date={date} />
            <WeekProgressChart date={date} />
            <GoalsProgress />
          </div>

        </div>

        {/* Правый рейл */}
        <div className="space-y-4 sm:space-y-6">
          {/* Коуч дня — цитата вместо AI-блока */}
          <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/10 to-accent/5 p-5">
            <div className="flex items-center gap-1.5 text-label text-accent mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Коуч дня
            </div>
            <blockquote className="text-sm text-text leading-relaxed">«{quote.text}»</blockquote>
            <div className="text-xs text-text-muted mt-2">— {quote.author}</div>
          </div>

          <UpcomingEvents date={date} />
          <QuickCapture date={date} />
        </div>
      </div>

      <QuickAddDialog
        open={quickTab !== null}
        onOpenChange={(v) => !v && setQuickTab(null)}
        date={date}
        initialTab={quickTab ?? undefined}
      />
    </div>
  );
};
