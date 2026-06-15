import { useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Ring } from '@/components/ui/ring';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store';
import { ACHIEVEMENTS, computeStreak, levelFromXp, titleForLevel, xpToday, xpTotal } from '@/lib/gamification';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { todayISO, colorByPct, isoDate } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Mascot } from '@/components/Mascot';
import { renderShareCard, downloadDataUrl } from '@/lib/sharePng';
import { leagueFor, xpInWeek } from '@/lib/leagues';
import { Button } from '@/components/ui/button';
import { Share2, Snowflake } from 'lucide-react';
import { availableFreezes, useFreeze, FREEZES_PER_MONTH } from '@/lib/streakFreeze';
import { addDays } from 'date-fns';
import { weeklyXpHistory, monthlyXpHistory, bestWeek, bestMonth } from '@/lib/personalRecords';

export const AwardsPage = () => {
  const { tasks, habitLogs, reflections, xpLog, achievements } = useStore();
  const [dailyGoal, setDailyGoal] = useLocalStorage<number>('gamification.dailyGoal', 100);

  const total = xpTotal(xpLog);
  const day = xpToday(todayISO(), xpLog);
  const streak = useMemo(() => computeStreak(new Date(), tasks, habitLogs, reflections), [tasks, habitLogs, reflections]);
  const { level, pct, current, nextThreshold } = levelFromXp(total);
  const dayPct = Math.min(100, Math.round((day / Math.max(1, dailyGoal)) * 100));

  const unlockedSet = useMemo(() => new Set(achievements.map((a) => a.key)), [achievements]);
  const unlockedMap = useMemo(() => {
    const m = new Map<string, string>();
    achievements.forEach((a) => m.set(a.key, a.unlocked_at));
    return m;
  }, [achievements]);

  const [editGoal, setEditGoal] = useState(false);

  const [freezeTick, setFreezeTick] = useState(0);
  // freezeTick used to force re-render after freeze usage
  void freezeTick;
  const freezesLeft = availableFreezes(new Date());
  const yISO = isoDate(addDays(new Date(), -1));

  const applyFreezeYesterday = () => {
    if (useFreeze(yISO)) { setFreezeTick((v) => v + 1); location.reload(); }
  };

  const handleShare = () => {
    const weekXp = xpInWeek(xpLog, new Date());
    const league = leagueFor(weekXp);
    const url = renderShareCard({
      streak,
      level,
      title: titleForLevel(level),
      totalXp: total,
      weekXp,
      league: league.label,
      leagueColor: league.color,
    });
    downloadDataUrl(url, `thedad-${new Date().toISOString().slice(0, 10)}.png`);
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Награды</h1>
        <Button variant="soft" onClick={handleShare}><Share2 /> Карточка PNG</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex flex-col items-center justify-center">
          <CardTitle>Уровень</CardTitle>
          <Ring value={pct} size={140} stroke={12} color={colorByPct(pct)}>
            <div className="text-center">
              <div className="text-3xl font-bold">L{level}</div>
              <div className="text-[11px] text-text-muted">{titleForLevel(level)}</div>
            </div>
          </Ring>
          <div className="mt-3 text-xs text-text-muted tabular-nums">
            {current} / {nextThreshold} XP до следующего
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center">
          <CardTitle>Серия дней</CardTitle>
          <Mascot streak={streak} size={140} />
          <div className="text-3xl font-bold leading-none mt-2" style={{ color: streak > 0 ? '#f97316' : 'var(--text-muted)' }}>
            {streak} {streak === 0 ? 'дней' : 'дней подряд'}
          </div>
          <div className="text-xs text-text-muted mt-2 text-center">
            {streak === 0 && 'Сделай что-то сегодня, чтобы начать'}
            {streak > 0 && streak < 3 && 'Хорошее начало. Не теряй темп!'}
            {streak >= 3 && streak < 30 && 'Привычка формируется ✨'}
            {streak >= 30 && 'Ты в огне! 🔥'}
          </div>
          <div className="mt-3 pt-3 border-t border-border-soft w-full flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Snowflake className="h-4 w-4 text-info" />
              <span className="text-text-muted">Заморозки:</span>
              <b className="text-info">{freezesLeft}</b>
              <span className="text-text-dim">/ {FREEZES_PER_MONTH} в месяц</span>
            </div>
            <Button
              variant="soft" size="sm"
              disabled={freezesLeft === 0}
              onClick={applyFreezeYesterday}
              title="Спасти серию за вчера"
            >
              <Snowflake className="h-3.5 w-3.5" /> Заморозить вчера
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardTitle>Дневная цель XP</CardTitle>
          <div className="flex-1 flex flex-col justify-center items-center gap-2">
            <Ring value={dayPct} size={140} stroke={12} color={colorByPct(dayPct)}>
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums">{day}</div>
                <div className="text-[11px] text-text-muted">из {dailyGoal} XP</div>
              </div>
            </Ring>
          </div>
          <div className="flex justify-center gap-2 mt-3">
            {[50, 100, 200, 300].map((v) => (
              <button
                key={v}
                onClick={() => setDailyGoal(v)}
                className={`px-3 py-1 border text-xs transition-colors ${dailyGoal === v ? 'border-accent text-accent' : 'border-border text-text-muted hover:border-text'}`}
              >{v}</button>
            ))}
            <button
              onClick={() => setEditGoal((v) => !v)}
              className="px-3 py-1 border border-border text-xs text-text-muted hover:border-text"
            >другое</button>
          </div>
          {editGoal && (
            <Input
              type="number" min={10} max={1000} className="mt-2"
              value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value) || 100)}
            />
          )}
        </Card>
      </div>

      {(() => {
        const weeks = weeklyXpHistory(xpLog, 8);
        const months = monthlyXpHistory(xpLog, 6);
        const bw = bestWeek(weeks);
        const bm = bestMonth(months);
        const curWeek = weeks[0]?.xp ?? 0;
        const avgWeek = weeks.length > 0 ? Math.round(weeks.reduce((s, w) => s + w.xp, 0) / weeks.length) : 0;
        const maxBar = Math.max(1, ...weeks.map((w) => w.xp));
        return (
          <Card>
            <CardTitle>Личные рекорды</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat label="Лучшая неделя" value={bw ? `${bw.xp}` : '—'} sub={bw ? `от ${bw.label}` : ''} />
              <Stat label="Лучший месяц" value={bm ? `${bm.xp}` : '—'} sub={bm ? bm.label : ''} />
              <Stat label="Текущая неделя" value={`${curWeek}`} sub={`среднее ${avgWeek}`} />
              <Stat label="Серия дней" value={`🔥${streak}`} />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">XP за последние 8 недель</div>
            <div className="flex items-end gap-1 h-24">
              {[...weeks].reverse().map((w, i) => {
                const h = Math.round((w.xp / maxBar) * 96);
                const isCurrent = i === weeks.length - 1;
                const isBest = bw && w.weekStart === bw.weekStart;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${w.label}: ${w.xp} XP`}>
                    <div
                      className={`w-full transition-all ${isBest ? 'bg-accent' : isCurrent ? 'bg-info' : 'bg-text-dim'}`}
                      style={{ height: `${Math.max(2, h)}px` }}
                    />
                    <div className="text-[9px] text-text-dim">{w.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      <Card>
        <CardTitle>Достижения</CardTitle>
        <div className="text-[11px] text-text-muted mb-3">{unlockedSet.size} / {ACHIEVEMENTS.length} разблокировано</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedSet.has(a.key);
            const at = unlockedMap.get(a.key);
            return (
              <div
                key={a.key}
                className={`border p-3 flex items-start gap-3 transition-all ${unlocked ? 'border-accent' : 'border-border opacity-50 grayscale'}`}
              >
                <div className="text-3xl shrink-0">{a.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{a.title}</div>
                  <div className="text-[11px] text-text-muted">{a.description}</div>
                  {unlocked && at && (
                    <Badge tone="accent" className="mt-1">{format(new Date(at), 'd MMM', { locale: ru })}</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="border border-border-soft p-3">
    <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
    <div className="text-2xl font-bold tabular-nums leading-tight mt-1">{value}</div>
    {sub && <div className="text-[10px] text-text-dim mt-0.5">{sub}</div>}
  </div>
);
