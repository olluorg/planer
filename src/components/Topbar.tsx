import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarIcon, Plus, Bell, Timer } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

interface Props {
  date: Date;
  onDate: (d: Date) => void;
  range: 'day' | 'week' | 'month' | 'year';
  onRange: (r: 'day' | 'week' | 'month' | 'year') => void;
  onAdd?: () => void;
}

export const Topbar: React.FC<Props> = ({ date, onDate, range, onRange, onAdd }) => {
  const label = format(date, 'd MMMM, EEEE', { locale: ru });
  return (
    <header className="h-16 shrink-0 border-b border-border bg-bg-card flex items-center px-6 gap-4">
      <Tabs value={range} onValueChange={(v) => onRange(v as any)}>
        <TabsList>
          <TabsTrigger value="day">Сегодня</TabsTrigger>
          <TabsTrigger value="week">Неделя</TabsTrigger>
          <TabsTrigger value="month">Месяц</TabsTrigger>
          <TabsTrigger value="year">Год</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => onDate(addDays(date, -1))}>
          <ChevronLeft />
        </Button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{label}</span>
          <CalendarIcon className="h-4 w-4 text-text-muted" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDate(addDays(date, 1))}>
          <ChevronRight />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onAdd}>
          <Plus />
        </Button>
        <Button variant="ghost" size="icon">
          <Timer />
        </Button>
        <Button variant="ghost" size="icon">
          <Bell />
        </Button>
        <div className="h-8 w-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">
          A
        </div>
      </div>
    </header>
  );
};
