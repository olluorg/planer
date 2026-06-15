import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Sparkles, Zap } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { computeStreak, levelFromXp, titleForLevel, xpToday, xpTotal, ACHIEVEMENTS, isTodayUnsealed } from '@/lib/gamification';
import { todayISO } from '@/lib/utils';
import { useCombo } from '@/lib/combo';

export const GamificationBar: React.FC = () => {
  const nav = useNavigate();
  const { tasks, habitLogs, reflections, xpLog, recentXp, dismissRecentXp, recentUnlocks, dismissRecentUnlock } = useStore();
  const [dailyGoal] = useLocalStorage<number>('gamification.dailyGoal', 100);

  const today = todayISO();
  const total = useMemo(() => xpTotal(xpLog), [xpLog]);
  const dayXp = useMemo(() => xpToday(today, xpLog), [today, xpLog]);
  const streak = useMemo(() => computeStreak(new Date(), tasks, habitLogs, reflections), [tasks, habitLogs, reflections]);
  const unsealed = useMemo(() => isTodayUnsealed(new Date(), tasks, habitLogs, reflections), [tasks, habitLogs, reflections]);
  const { level, pct } = useMemo(() => levelFromXp(total), [total]);
  const dayPct = Math.min(100, Math.round((dayXp / Math.max(1, dailyGoal)) * 100));
  const title = titleForLevel(level);
  const combo = useCombo();

  // periodic combo refresh so multiplier expires
  useEffect(() => {
    const id = setInterval(() => combo.refresh(), 5000);
    return () => clearInterval(id);
  }, [combo]);

  const comboRemainingMin = combo.activeUntil
    ? Math.max(0, Math.ceil((combo.activeUntil - Date.now()) / 60000))
    : 0;

  const [flash, setFlash] = useState<{ amount: number } | null>(null);
  useEffect(() => {
    if (recentXp.length === 0) return;
    const sum = recentXp.reduce((s, x) => s + x.amount, 0);
    setFlash({ amount: sum });
    const t = setTimeout(() => { setFlash(null); dismissRecentXp(); }, 1500);
    return () => clearTimeout(t);
  }, [recentXp, dismissRecentXp]);

  return (
    <div className="flex items-center gap-3 text-xs select-none">
      {/* Streak */}
      <button
        onClick={() => nav('/awards')}
        title={unsealed ? `${streak} дней — запиши рефлексию чтобы закрыть день` : `Серия ${streak} дней`}
        className={`flex items-center gap-1 tabular-nums ${streak > 0 ? 'text-warn' : 'text-text-muted'} hover:text-text transition-colors`}
      >
        <Flame className="h-4 w-4" /> <span className="font-semibold">{streak}</span>
        {unsealed && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-warn animate-pulse-ok" title="День не закрыт рефлексией" />
        )}
      </button>
      {/* Level + XP progress */}
      <button onClick={() => nav('/awards')} className="flex items-center gap-2 hover:text-text text-text-muted transition-colors" title={`${title} · ${total} XP`}>
        <span className="font-semibold text-text">L{level}</span>
        <div className="w-16 h-1.5 bg-bg-soft overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </button>
      {/* Daily goal */}
      <button onClick={() => nav('/awards')} className="flex items-center gap-1 hover:text-text text-text-muted transition-colors" title={`Сегодня ${dayXp}/${dailyGoal} XP`}>
        <Sparkles className="h-4 w-4" />
        <span className="tabular-nums font-semibold text-text">{dayXp}</span>
        <span className="text-text-dim">/{dailyGoal}</span>
        <div className="w-12 h-1.5 bg-bg-soft overflow-hidden ml-1">
          <div className="h-full bg-accent transition-all" style={{ width: `${dayPct}%` }} />
        </div>
      </button>

      {/* Combo multiplier */}
      {combo.multiplier > 1 && comboRemainingMin > 0 && (
        <span
          className="flex items-center gap-1 px-2 py-0.5 border border-accent text-accent text-[11px] font-bold animate-pulse-ok tabular-nums"
          title={`Множитель XP ×${combo.multiplier} активен ещё ${comboRemainingMin} мин`}
        >
          <Zap className="h-3 w-3" /> ×{combo.multiplier} · {comboRemainingMin}м
        </span>
      )}

      {/* XP flash */}
      {flash && (
        <span className="text-accent font-semibold animate-fade-in tabular-nums">+{flash.amount} XP</span>
      )}

      {/* Achievement unlocks toast */}
      {recentUnlocks.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[60] space-y-2">
          {recentUnlocks.map((u) => {
            const a = ACHIEVEMENTS.find((x) => x.key === u.key);
            if (!a) return null;
            return (
              <button
                key={u.key}
                onClick={() => { dismissRecentUnlock(u.key); nav('/awards'); }}
                className="flex items-center gap-3 bg-bg-card border border-accent p-3 animate-slide-up hover:bg-bg-hover transition-colors min-w-[260px]"
              >
                <span className="text-2xl">{a.icon}</span>
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider text-accent">Награда</div>
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-[11px] text-text-muted">{a.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
