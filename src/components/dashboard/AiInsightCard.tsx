import { useMemo } from 'react';
import { Ring } from '@/components/ui/ring';
import { Sparkles, Activity } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { computeStreak, xpToday } from '@/lib/gamification';

interface Props { date: Date }

export const AiInsightCard: React.FC<Props> = ({ date }) => {
  const { tasks, habitLogs, reflections, xpLog, timeEntries } = useStore();
  const today = isoDate(date);

  const { focus, energy, success } = useMemo(() => {
    const dayTasks = tasks.filter((t) => t.date === today);
    const done = dayTasks.filter((t) => t.status === 'done').length;
    const total = dayTasks.length || 1;
    const focusScore = Math.min(100, Math.round((done / total) * 80 + (xpToday(today, xpLog) / 100) * 20));

    const yesterdayReflection = reflections.find((r) => r.date === isoDate(new Date(date.getTime() - 86400000)));
    const moodBoost = yesterdayReflection?.mood ? (yesterdayReflection.mood + 1) * 18 : 70;
    const sleepHours = 8; // placeholder; can be wired to real metric later
    const energyScore = Math.min(100, Math.round(moodBoost * 0.7 + sleepHours * 4));

    const streak = computeStreak(date, tasks, habitLogs, reflections);
    const totalProgress = focusScore * 0.4 + energyScore * 0.3 + Math.min(streak * 4, 30);
    const successScore = Math.min(100, Math.round(totalProgress));

    return { focus: focusScore, energy: energyScore, success: successScore };
  }, [tasks, habitLogs, reflections, xpLog, timeEntries, today, date]);

  const headline = success >= 70
    ? 'Сегодня отличный день для глубоких результатов'
    : success >= 40
    ? 'Хороший день — сделай главное по плану'
    : 'Начни с одного маленького шага';

  const subhead = focus >= 70
    ? 'У вас высокий уровень фокуса и энергии. Сконцентрируйтесь на задачах, которые приближают вас к целям.'
    : 'Сосредоточьтесь на одной важной задаче и не отвлекайтесь.';

  return (
    <div
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)',
      }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#5b21b6' }}>
        <Sparkles className="h-3.5 w-3.5" />
        AI-сводка
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight max-w-lg">
        {headline} <Sparkles className="inline h-5 w-5 text-violet-600" />
      </h2>
      <p className="text-sm text-slate-600 mt-3 max-w-lg leading-relaxed">{subhead}</p>

      <div className="flex flex-wrap items-center gap-4 mt-6">
        <MiniRing label="Фокус" value={focus} color="#6366f1" />
        <MiniRing label="Энергия" value={energy} color="#3b82f6" />
        <div className="rounded-xl bg-white/70 backdrop-blur px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <Activity className="h-5 w-5 text-violet-700" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold text-slate-900">
              {success >= 70 ? 'Высокий' : success >= 40 ? 'Средний' : 'Низкий'}
            </div>
            <div className="text-[11px] text-slate-500">Прогноз успеха</div>
          </div>
        </div>
      </div>

      {/* decorative orb */}
      <div
        className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full opacity-50 hidden md:block pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(196,181,253,0.4) 50%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
};

const MiniRing: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex items-center gap-2 rounded-xl bg-white/70 backdrop-blur px-3 py-2 shadow-sm">
    <Ring value={value} size={44} stroke={5} color={color} trackColor="rgba(15,23,42,0.08)" glow={false}>
      <div className="text-[11px] font-bold tabular-nums" style={{ color }}>{value}%</div>
    </Ring>
    <div className="text-[11px] text-slate-600">{label}</div>
  </div>
);
