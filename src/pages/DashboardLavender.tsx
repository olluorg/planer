import { useState } from 'react';
import { AiInsightCard } from '@/components/dashboard/AiInsightCard';
import { TodayPlan } from '@/components/dashboard/TodayPlan';
import { TodaySchedule } from '@/components/dashboard/TodaySchedule';
import { HabitDots } from '@/components/dashboard/HabitDots';
import { GoalsProgress } from '@/components/dashboard/GoalsProgress';
import { WeekProgressChart } from '@/components/dashboard/WeekProgressChart';
import { FocusTimeCard } from '@/components/dashboard/FocusTimeCard';
import { MiniCalendar } from '@/components/dashboard/MiniCalendar';
import { ReflectionMini } from '@/components/dashboard/ReflectionMini';
import { QuickAddDialog } from '@/components/QuickAddDialog';

interface Props { date: Date; onDateChange?: (d: Date) => void }

export const DashboardLavender: React.FC<Props> = ({ date, onDateChange }) => {
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | null>(null);

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 sm:gap-6">
      {/* Главная колонка */}
      <div className="space-y-4 sm:space-y-6 min-w-0">
        <AiInsightCard date={date} />
        <TodayPlan date={date} />

        {/* 3 нижних виджета */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <GoalsProgress />
          <WeekProgressChart date={date} />
          <FocusTimeCard date={date} />
        </div>
      </div>

      {/* Правая колонка */}
      <div className="space-y-4 sm:space-y-6">
        <MiniCalendar date={date} onDateChange={(d) => onDateChange?.(d)} />
        <TodaySchedule date={date} />
        <HabitDots date={date} />
        <ReflectionMini date={date} />
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
