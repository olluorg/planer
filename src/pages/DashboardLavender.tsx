import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TodayFocus } from '@/components/dashboard/TodayFocus';
import { DayBrief } from '@/components/dashboard/DayBrief';
import { TodayPlanList } from '@/components/dashboard/TodayPlanList';
import { TodaySchedule } from '@/components/dashboard/TodaySchedule';
import { HabitDots } from '@/components/dashboard/HabitDots';
import { WeeklyConsistency } from '@/components/dashboard/WeeklyConsistency';
import { GoalsProgress } from '@/components/dashboard/GoalsProgress';
import { WeekProgressChart } from '@/components/dashboard/WeekProgressChart';
import { FocusTimeCard } from '@/components/dashboard/FocusTimeCard';
import { MiniCalendar } from '@/components/dashboard/MiniCalendar';
import { ReflectionMini } from '@/components/dashboard/ReflectionMini';
import { QuickCapture } from '@/components/dashboard/QuickCapture';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { MetricsRow } from '@/components/dashboard/MetricsRow';
import { QuickAddDialog } from '@/components/QuickAddDialog';
import { getUserName } from '@/lib/onboarding';

interface Props { date: Date; onDateChange?: (d: Date) => void; onStartFocus?: () => void }

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const QUOTES = [
  'Дисциплина сегодня — свобода завтра.',
  'Маленькие шаги приводят к большим результатам.',
  'Сделай сегодня немного больше, чем вчера.',
  'Фокус — это говорить «нет» лишнему.',
];

export const DashboardLavender: React.FC<Props> = ({ date, onDateChange, onStartFocus }) => {
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | null>(null);
  const quote = QUOTES[date.getDate() % QUOTES.length];

  return (
    <div className="page py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Приветствие */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <h1 className="text-h1 text-text flex items-center gap-2">
            {greeting()}, {getUserName()} <span className="text-2xl">👋</span>
          </h1>
          <div className="text-sm text-text-muted mt-1 capitalize">{format(date, 'EEEE, d MMMM', { locale: ru })}</div>
        </div>
        <div className="text-sm text-text-muted italic max-w-xs md:text-right">«{quote}»</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 sm:gap-6">
        {/* Главная колонка */}
        <div className="space-y-4 sm:space-y-6 min-w-0">
          <MetricsRow date={date} />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 sm:gap-6">
            <TodayFocus date={date} onStartFocus={() => onStartFocus?.()} />
            <DayBrief date={date} />
          </div>

          {/* План / Привычки / Постоянство */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <TodayPlanList date={date} />
            <HabitDots date={date} />
            <WeeklyConsistency />
          </div>

          {/* Нижний ряд: Время / Продуктивность / Цели */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <FocusTimeCard date={date} />
            <WeekProgressChart date={date} />
            <GoalsProgress />
          </div>
        </div>

        {/* Правая колонка */}
        <div className="space-y-4 sm:space-y-6">
          <QuickCapture date={date} />
          <UpcomingEvents date={date} />
          <MiniCalendar date={date} onDateChange={(d) => onDateChange?.(d)} />
          <TodaySchedule date={date} />
          <ReflectionMini date={date} />
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
