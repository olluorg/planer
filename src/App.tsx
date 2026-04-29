import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { useStore } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { GoalsPage } from './pages/Goals';
import { TasksPage } from './pages/Tasks';
import { HabitsPage } from './pages/Habits';
import { PlanPage } from './pages/Plan';
import { AnalyticsPage } from './pages/Analytics';
import { ReflectionPage } from './pages/Reflection';
import { SettingsPage } from './pages/Settings';
import { QuickAddDialog } from './components/QuickAddDialog';

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [date, setDate] = useState(new Date());
  const [range, setRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Загрузка SQLite...
      </div>
    );
  }

  return (
    <div className="h-full flex bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar date={date} onDate={setDate} range={range} onRange={setRange} onAdd={() => setQuickOpen(true)} />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard date={date} />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/tasks" element={<TasksPage date={date} />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/plan" element={<PlanPage date={date} />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reflection" element={<ReflectionPage date={date} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <QuickAddDialog open={quickOpen} onOpenChange={setQuickOpen} date={date} />
    </div>
  );
}
