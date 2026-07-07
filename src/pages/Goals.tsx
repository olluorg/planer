import { useRef, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Plus, Trash2, TrendingUp, X, Rocket, Dumbbell, BookOpen, Wallet, Heart, Languages, Target, Sparkles, FileText, BarChart3, Download, ChevronRight, CheckCircle2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { fmtNum, colorByPct } from '@/lib/utils';
import { forecastGoal } from '@/lib/predict';
import { ECharts } from '@/components/charts/ECharts';
import { Ring } from '@/components/ui/ring';
import { Sparkline } from '@/components/ui/sparkline';
import { CountUp } from '@/components/ui/count-up';
import { PageContainer } from '@/components/ui/page-container';
import { GoalPath } from '@/components/GoalPath';
import { useTheme } from '@/lib/theme';
import { getChartColors, type ChartColors } from '@/lib/chart-theme';
import type { Goal, GoalType } from '@/lib/types';

export const GoalsPage = () => {
  const { goals, progress, addGoal, removeGoal, updateGoal, addProgress, tasks, habits, habitLogs, reflections, timeEntries, milestones, toggleTask, toggleHabitLog, addMilestone, toggleMilestone, removeMilestone } = useStore();
  const nav = useNavigate();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const [open, setOpen] = useState(false);
  const [statusTab, setStatusTab] = useState<'active' | 'done' | 'archived'>('active');
  const [view, setView] = useState<'cards' | 'timeline' | 'tree'>('cards');
  const [form, setForm] = useState({ title: '', type: 'mid' as GoalType, start_value: '0', target_value: '100', unit: '', deadline: '', parent_id: '__none', health_metric: '__none' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'progress' | 'deadline' | 'name'>('progress');

  const submit = () => {
    if (!form.title.trim()) return;
    addGoal({
      title: form.title.trim(),
      type: form.type,
      start_value: Number(form.start_value) || 0,
      target_value: Number(form.target_value) || 100,
      current_value: Number(form.start_value) || 0,
      unit: form.unit || null,
      deadline: form.deadline || null,
      parent_id: form.parent_id === '__none' ? null : form.parent_id,
      health_metric: form.health_metric === '__none' ? null : (form.health_metric as any),
    });
    setOpen(false);
    setForm({ title: '', type: 'mid', start_value: '0', target_value: '100', unit: '', deadline: '', parent_id: '__none', health_metric: '__none' });
  };

  const isAchieved = (g: typeof goals[number]) => {
    const denom = g.target_value - g.start_value || 1;
    return (g.current_value - g.start_value) / denom >= 1;
  };
  const pctOf = (g: Goal) => Math.max(0, Math.min(1, (g.current_value - g.start_value) / (g.target_value - g.start_value || 1)));
  const roots = goals.filter((g) => !g.parent_id);
  let visible = roots.filter((g) => {
    if (statusTab === 'active') return g.status === 'active' && !isAchieved(g);
    if (statusTab === 'done') return isAchieved(g) || g.status === 'done';
    return g.status === 'archived';
  });
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    visible = visible.filter((g) => g.title.toLowerCase().includes(q));
  }
  visible = [...visible].sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title);
    if (sort === 'deadline') return (a.deadline ?? '9999-99-99').localeCompare(b.deadline ?? '9999-99-99');
    return pctOf(b) - pctOf(a);
  });
  const counts = {
    active: roots.filter((g) => g.status === 'active' && !isAchieved(g)).length,
    done: roots.filter((g) => isAchieved(g) || g.status === 'done').length,
    archived: roots.filter((g) => g.status === 'archived').length,
  };

  const activeRoots = roots.filter((g) => g.status === 'active' && !isAchieved(g));
  const overall = activeRoots.length ? Math.round((activeRoots.reduce((s, g) => s + pctOf(g), 0) / activeRoots.length) * 100) : 0;
  const fcList = activeRoots.map((g) => ({ g, f: forecastGoal(g, progress.filter((p) => p.goal_id === g.id), 30) }));
  const succVals = fcList.filter((x) => x.f.etaDate).map((x) => x.f.etaConfidence);
  const avgSuccess = succVals.length ? Math.round((succVals.reduce((a, b) => a + b, 0) / succVals.length) * 100) : null;
  const sphereMap = new Map<string, { label: string; color: string; count: number }>();
  activeRoots.forEach((g) => { const s = goalSphere(g.title); const e = sphereMap.get(s.label) ?? { ...s, count: 0 }; e.count++; sphereMap.set(s.label, e); });
  const spheres = [...sphereMap.values()];
  const recent = [...progress].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((p) => ({ p, goal: goals.find((g) => g.id === p.goal_id) }));

  // --- Goals V2: hero-цель, отставание от графика, AI-coach (эвристики на реальных данных) ---
  const heroGoal = statusTab === 'active' && !query.trim() && activeRoots.length
    ? [...activeRoots].sort((a, b) => pctOf(b) - pctOf(a) || (a.deadline ?? '9999-99-99').localeCompare(b.deadline ?? '9999-99-99'))[0]
    : undefined;

  const scheduleGap = (g: Goal): number | null => {
    const created = new Date(g.created_at).getTime();
    const dl = g.deadline ? new Date(g.deadline).getTime() : null;
    if (!dl || dl <= created) return null;
    const timeP = Math.max(0, Math.min(1, (Date.now() - created) / (dl - created)));
    return Math.round((timeP - pctOf(g)) * 100); // >0 отстаёт, <0 опережает
  };

  const risks = activeRoots
    .map((g) => ({ g, gap: scheduleGap(g) }))
    .filter((x): x is { g: Goal; gap: number } => x.gap !== null)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  const coachPush = activeRoots
    .map((g) => ({ g, m: nextMilestone(g) }))
    .filter((x) => x.m !== null)
    .sort((a, b) => a.m!.remainFrac - b.m!.remainFrac)
    .slice(0, 3)
    .map((x) => x.g);

  const gridGoals = visible.filter((g) => g.id !== heroGoal?.id);

  return (
    <PageContainer className="py-4 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-h1">Мои цели</h1>
            <Badge tone="soft">{counts.active} активных</Badge>
          </div>
          <p className="text-small text-text-muted mt-1">Фокусируйся на важном. Действуй ежедневно. Достигай большего.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim pointer-events-none" />
            <Input placeholder="Поиск целей…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 w-56" />
          </div>
          <Button variant="ghost" onClick={() => nav('/settings')}><Download /> Импорт</Button>
          <Button variant="ghost" onClick={() => nav('/templates')}><FileText /> Шаблоны</Button>
          <Button onClick={() => setOpen(true)}><Plus /> Новая цель</Button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as any)}>
          <TabsList>
            <TabsTrigger value="active">Активные · {counts.active}</TabsTrigger>
            <TabsTrigger value="done">Достигнутые · {counts.done}</TabsTrigger>
            <TabsTrigger value="archived">Архив · {counts.archived}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="cards">Карточки</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="tree">Дерево</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="text-caption text-text-muted">Сортировка</span>
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="progress">По прогрессу</SelectItem>
              <SelectItem value="deadline">По дедлайну</SelectItem>
              <SelectItem value="name">По названию</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
      <div className="goals-col flex-1 min-w-0 space-y-4">
      {visible.length === 0 && (
        <Card className="p-8 text-center text-sm text-text-muted">
          {statusTab === 'active' ? 'Нет активных целей — создай первую' : statusTab === 'done' ? 'Пока нет достигнутых целей' : 'Архив пуст'}
        </Card>
      )}

      {view === 'timeline' && <GoalsTimeline goals={visible} />}
      {view === 'tree' && <GoalsTree goals={visible} />}

      {view === 'cards' && heroGoal && (() => {
        const g = heroGoal;
        const recs = progress.filter((p) => p.goal_id === g.id);
        const f = forecastGoal(g, recs, 30);
        const r = Math.round(pctOf(g) * 100);
        const successPct = f.etaDate ? Math.round(f.etaConfidence * 100) : null;
        const chance = successPct == null ? null : successPct >= 70 ? 'Высокий' : successPct >= 40 ? 'Средний' : 'Низкий';
        const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;
        const gap = scheduleGap(g);
        const Icon = goalIcon(g.title);
        const accent = g.color || GOAL_PALETTE[0];
        const typeLabel = { long: 'Долгосрочная', mid: 'Среднесрочная', short: 'Краткосрочная' }[g.type];
        const aiText = gap == null
          ? 'Добавь дедлайн и записывай прогресс — оценю темп и шанс достижения.'
          : gap <= -5 ? 'Ты идёшь с опережением графика. Продолжай в том же темпе.'
          : gap >= 5 ? `Отставание от графика ~${gap}%. Стоит увеличить частоту действий.`
          : 'Ты держишь темп графика. Так держать.';
        return (
          <Card className="relative overflow-hidden border-accent/15">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${accent}1f` }}>
                  <Icon className="h-7 w-7" style={{ color: accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-h2">{g.title}</h2>
                    <Badge tone="soft">основная цель</Badge>
                  </div>
                  <p className="text-small text-text-muted mt-1">
                    {g.metric || `${fmtNum(g.current_value, 1)} → ${fmtNum(g.target_value, 0)}${g.unit ? ` ${g.unit}` : ''}`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-2 text-caption text-text-muted">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: accent }} />{typeLabel}</span>
                    {successPct != null && <><span className="text-text-dim">·</span><span>{successPct}% уверенность</span></>}
                    {daysLeft != null && <><span className="text-text-dim">·</span><span>{daysLeft < 0 ? 'просрочено' : `осталось ${daysLeft} дн`}</span></>}
                    {g.health_metric && <><span className="text-text-dim">·</span><span className="text-accent">⛓ авто из Здоровья</span></>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-caption text-text-muted uppercase tracking-wider">Прогноз достижения</div>
                  <div className="text-4xl font-bold tabular-nums leading-none mt-1" style={{ color: successPct == null ? 'var(--text-dim)' : successPct >= 70 ? '#22c55e' : successPct >= 40 ? '#f59e0b' : '#ef4444' }}>
                    {successPct == null ? '—' : <CountUp value={successPct} suffix="%" />}
                  </div>
                  {chance && <div className="text-caption text-text-muted mt-1">Шанс: {chance}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4 items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <Progress value={r} className="flex-1" barColor={accent} />
                    <CountUp value={r} suffix="%" className="text-h3 font-bold tabular-nums" />
                  </div>
                  <div className="text-caption text-text-muted mt-1.5">
                    {g.deadline ? `Дедлайн ${fmtDate(g.deadline)} · прогноз ${f.etaDate ?? '—'}` : 'Без дедлайна'}
                  </div>
                </div>
                <ECharts height={90} option={forecastChart(g, recs, f, cc, accent)} />
              </div>

              <MilestoneChips goal={g} accent={accent} />

              <GoalToday goal={g} accent={accent} />

              <div className="flex items-start gap-2.5 rounded-xl border border-accent/15 bg-accent/[0.06] p-3">
                <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <div className="text-caption font-semibold text-accent">AI Coach</div>
                  <div className="text-small text-text mt-0.5">{aiText}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => nav('/plan')}><Rocket className="h-4 w-4" /> Перейти в фокус</Button>
                <div className="flex-1 min-w-[200px]">
                  <QuickProgress goal={g} onAdd={(v) => addProgress({ goal_id: g.id, date: new Date().toISOString().slice(0, 10), value: v, note: null })} />
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {view === 'cards' && <div className="goals-grid">
        {gridGoals.map((g, i) => {
          const recs = progress.filter((p) => p.goal_id === g.id);
          const f = forecastGoal(g, recs, 30);
          const denom = g.target_value - g.start_value || 1;
          const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);

          const typeLabel = { long: 'долгосрочная', mid: 'среднесрочная', short: 'краткосрочная' }[g.type];
          const accent = g.color || GOAL_PALETTE[i % GOAL_PALETTE.length];
          const Icon = goalIcon(g.title);
          const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;
          const successPct = f.etaDate ? Math.round(f.etaConfidence * 100) : null;
          const children = goals.filter((x) => x.parent_id === g.id);

          return (
            <Card key={g.id} className="group hover:shadow-lift flex flex-col">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1f` }}>
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-small font-semibold truncate">{g.title}</h2>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: accent }} title={typeLabel} />
                  </div>
                  <div className="text-caption text-text-muted mt-0.5 truncate">
                    {g.metric || `${fmtNum(g.current_value, 1)} → ${fmtNum(g.target_value, 0)}${g.unit ? ` ${g.unit}` : ''}`}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-text-dim hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeGoal(g.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-h2 font-bold tabular-nums leading-none" style={{ color: accent }}>{r}%</span>
                <span className="ml-auto text-caption text-text-muted tabular-nums">
                  {daysLeft == null ? '' : daysLeft < 0 ? 'просрочено' : `осталось ${daysLeft} дн`}
                </span>
              </div>
              <Progress value={r} className="mt-1.5" barColor={accent} />

              <div className="flex items-center justify-between mt-3">
                <span className="text-caption text-text-muted">
                  Дедлайн: <b className="text-text font-medium">{g.deadline ? fmtDate(g.deadline) : '—'}</b>
                  <span className="mx-1.5 text-text-dim">·</span>
                  Прогноз: <b className={`font-medium ${successClass(successPct)}`}>{successPct == null ? '—' : `${successPct}%`}</b>
                </span>
                <Sparkline data={recs.length >= 2 ? recs.map((x) => x.value) : [g.start_value, g.current_value]} width={72} height={26} color={accent} />
              </div>

              <div className="mt-3 pt-3 border-t border-border-soft">
                <QuickProgress goal={g} onAdd={(v) => addProgress({ goal_id: g.id, date: new Date().toISOString().slice(0, 10), value: v, note: null })} />
              </div>

              {children.length > 0 && (
                <div className="mt-3 border-t border-border-soft pt-3">
                  <ul className="space-y-1.5">
                    {children.map((c) => {
                      const cd = c.target_value - c.start_value || 1;
                      const cr = Math.round(Math.max(0, Math.min(1, (c.current_value - c.start_value) / cd)) * 100);
                      return (
                        <li key={c.id} className="flex items-center gap-2.5 text-caption">
                          <span className="text-text-dim">↳</span>
                          <span className="flex-1 truncate text-text-muted">{c.title}</span>
                          <div className="w-16"><Progress value={cr} barColor={colorByPct(cr)} /></div>
                          <span className="text-caption text-text-muted tabular-nums w-8 text-right">{cr}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>}

      {view === 'cards' && visible.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardTitle>Прогноз достижения целей</CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="text-text-muted text-caption">
                    <th className="text-left font-medium pb-2">Цель</th>
                    <th className="text-left font-medium pb-2">Вероятность</th>
                    <th className="text-left font-medium pb-2">Прогноз даты</th>
                    <th className="text-right font-medium pb-2">Прогресс</th>
                  </tr>
                </thead>
                <tbody>
                  {fcList.map(({ g, f }) => {
                    const r = Math.round(pctOf(g) * 100);
                    const sp = f.etaDate ? Math.round(f.etaConfidence * 100) : null;
                    return (
                      <tr key={g.id} className="border-t border-border-soft">
                        <td className="py-2 pr-3 truncate max-w-[160px]">{g.title}</td>
                        <td className={`py-2 pr-3 font-medium ${successClass(sp)}`}>{sp == null ? '—' : `${sp}%`}</td>
                        <td className="py-2 pr-3 text-text-muted tabular-nums">{f.etaDate ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums">{r}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardTitle>Распределение по сферам жизни</CardTitle>
            {spheres.length === 0 ? (
              <p className="text-small text-text-muted">Нет активных целей</p>
            ) : (
              <>
                <ECharts
                  height={200}
                  option={{
                    tooltip: { trigger: 'item' },
                    series: [{
                      type: 'pie', radius: ['58%', '80%'], avoidLabelOverlap: true,
                      label: { show: false }, labelLine: { show: false },
                      data: spheres.map((s) => ({ value: s.count, name: s.label, itemStyle: { color: s.color } })),
                    }],
                  }}
                />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                  {spheres.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-caption text-text-muted">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="truncate">{s.label}</span>
                      <span className="ml-auto tabular-nums text-text">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
      </div>

      <aside className="w-full xl:w-[320px] shrink-0 space-y-4 xl:sticky xl:top-4 self-start">
        <Card className="border-accent/20 bg-gradient-to-br from-accent/[0.08] to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-accent" />
            <h3 className="text-base font-semibold text-text">AI Coach</h3>
            <span className="ml-auto inline-flex items-center gap-1 text-caption text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />онлайн</span>
          </div>
          {coachPush.length === 0 ? (
            <p className="text-small text-text-muted">Все цели идут по графику. Выбери любую и действуй сегодня.</p>
          ) : (
            <>
              <p className="text-small text-text-muted mb-2">Сегодня выгоднее всего продвинуть:</p>
              <ul className="space-y-1.5">
                {coachPush.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 text-small text-text">
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="truncate">{g.title}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button className="w-full mt-3" onClick={() => nav('/plan')}>Оптимизировать план <ChevronRight className="h-4 w-4" /></Button>
        </Card>

        <Card>
          <CardTitle>Прогноз на неделю</CardTitle>
          <div className="flex items-center gap-4">
            <Ring value={avgSuccess ?? 0} size={84} stroke={9} color="#6366f1" glow={false} trackColor="var(--border)">
              <div className="text-base font-bold tabular-nums leading-none">{avgSuccess == null ? '—' : `${avgSuccess}%`}</div>
            </Ring>
            <div className="flex-1 space-y-2">
              <RailStat label="Средний прогресс" value={`${overall}%`} />
              <RailStat label="Активные цели" value={counts.active} />
              <RailStat label="Достигнутые" value={counts.done} />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Риски и возможности</CardTitle>
          {risks.length === 0 ? (
            <p className="text-small text-text-muted">Добавь дедлайны целям — оценю отставание от графика.</p>
          ) : (
            <ul className="space-y-2.5">
              {risks.map(({ g, gap }) => {
                const danger = gap > 5;
                const ahead = gap < -5;
                const Icon = goalIcon(g.title);
                const tone = danger ? '#ef4444' : ahead ? '#22c55e' : '#94a3b8';
                return (
                  <li key={g.id} className="flex items-center gap-2.5">
                    <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tone}1f` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: tone }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-small text-text truncate">{g.title}</div>
                      <div className="text-caption" style={{ color: tone }}>
                        {danger ? `Отстаёт на ${gap}%` : ahead ? 'Опережает график' : 'В графике'}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Быстрые действия</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            <RailAction icon={Plus} label="Новая цель" onClick={() => setOpen(true)} />
            <RailAction icon={FileText} label="Шаблоны" onClick={() => nav('/templates')} />
            <RailAction icon={BarChart3} label="Аналитика" onClick={() => nav('/analytics')} />
            <RailAction icon={Download} label="Импорт" onClick={() => nav('/settings')} />
          </div>
        </Card>

        <Card>
          <CardTitle>Недавние достижения</CardTitle>
          {recent.length === 0 ? (
            <p className="text-small text-text-muted">Пока пусто — запиши прогресс по цели.</p>
          ) : (
            <ul className="space-y-2.5">
              {recent.map(({ p, goal }, idx) => (
                <li key={idx} className="flex items-center gap-2.5">
                  <span className="h-7 w-7 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-small text-text truncate">{goal?.title ?? 'Цель'}</div>
                    <div className="text-caption text-text-muted">{fmtDate(p.date)} · {fmtNum(p.value, 0)}{goal?.unit ? ` ${goal.unit}` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новая цель</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="long">Долгосрочная</SelectItem>
                <SelectItem value="mid">Среднесрочная</SelectItem>
                <SelectItem value="short">Краткосрочная</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="Старт" value={form.start_value} onChange={(e) => setForm({ ...form, start_value: e.target.value })} />
              <Input type="number" placeholder="Цель" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
              <Input placeholder="Ед." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
              <SelectTrigger><SelectValue placeholder="Родительская цель" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Без родителя</SelectItem>
                {goals.filter((g) => !g.parent_id).map((g) => (
                  <SelectItem key={g.id} value={g.id}>↳ {g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.health_metric} onValueChange={(v) => setForm({ ...form, health_metric: v })}>
              <SelectTrigger><SelectValue placeholder="Авто-прогресс из Здоровья" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Без авто-прогресса</SelectItem>
                <SelectItem value="weight">Вес (кг)</SelectItem>
                <SelectItem value="sleep">Сон (ч)</SelectItem>
                <SelectItem value="steps">Шаги</SelectItem>
                <SelectItem value="water">Вода (л)</SelectItem>
                <SelectItem value="workout">Тренировка (мин)</SelectItem>
                <SelectItem value="energy">Энергия (/10)</SelectItem>
                <SelectItem value="calories">Питание (ккал)</SelectItem>
              </SelectContent>
            </Select>
            {form.health_metric !== '__none' && (
              <p className="text-caption text-text-muted">Каждый лог этой метрики на странице «Здоровье» будет автоматически записываться в прогресс цели.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
            <Button onClick={submit}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

const CoverImage: React.FC<{ goal: Goal; onUpdate: (cover: string | null) => void }> = ({ goal, onUpdate }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpdate(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (goal.cover) {
    return (
      <div className="relative w-full h-36 group">
        <img src={goal.cover} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
        <button
          onClick={() => onUpdate(null)}
          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-2 right-2 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="w-full h-10 flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-text hover:bg-surface-1 cursor-pointer transition-colors border-b border-border"
    >
      <Camera className="h-3.5 w-3.5" />
      Добавить обложку
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

const QuickProgress: React.FC<{ goal: any; onAdd: (v: number) => void }> = ({ goal, onAdd }) => {
  const [v, setV] = useState('');
  return (
    <div className="flex gap-2 mt-3">
      <Input type="number" placeholder={`Текущее значение (${goal.unit ?? ''})`} value={v} onChange={(e) => setV(e.target.value)} />
      <Button size="sm" onClick={() => { if (v) { onAdd(Number(v)); setV(''); } }}>Записать</Button>
    </div>
  );
};

const GOAL_PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

// Вехи выводятся из start→target как 4 контрольные точки (без изменения схемы БД).
function deriveMilestones(g: Goal) {
  const span = g.target_value - g.start_value;
  const dir = Math.sign(span) || 1;
  const steps = 4;
  return Array.from({ length: steps }, (_, k) => {
    const frac = (k + 1) / steps;
    const value = g.start_value + span * frac;
    const done = dir > 0 ? g.current_value >= value - 1e-9 : g.current_value <= value + 1e-9;
    return { value, frac, done };
  });
}

function nextMilestone(g: Goal): { value: number; frac: number; done: boolean; remainFrac: number } | null {
  const ms = deriveMilestones(g);
  const idx = ms.findIndex((m) => !m.done);
  if (idx === -1) return null;
  const next = ms[idx];
  const span = g.target_value - g.start_value || 1;
  const prevVal = g.start_value + span * (next.frac - 1 / ms.length);
  const seg = next.value - prevVal || 1;
  const remainFrac = Math.max(0, Math.min(1, (next.value - g.current_value) / seg));
  return { ...next, remainFrac };
}

const pctOfG = (g: Goal) => Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / (g.target_value - g.start_value || 1))) * 100);

/** Вехи цели: реальные из БД (кликабельные) с fallback на расчётные + inline-добавление. */
const MilestoneChips: React.FC<{ goal: Goal; accent: string }> = ({ goal, accent }) => {
  const { milestones, toggleMilestone, removeMilestone, addMilestone } = useStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const real = milestones.filter((m) => m.goal_id === goal.id);

  const submit = () => {
    if (!title.trim()) return;
    addMilestone({ goal_id: goal.id, title: title.trim(), value: value ? Number(value.replace(',', '.')) : null });
    setTitle(''); setValue(''); setAdding(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="section-label !mb-0">Вехи</div>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 text-caption text-accent hover:underline">
          <Plus className="h-3 w-3" /> Веха
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {real.length > 0 ? real.map((m) => {
          const done = !!m.done_at;
          return (
            <div key={m.id} className="group/ms flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors" style={{ borderColor: done ? accent : 'var(--border)' }}>
              <button
                onClick={() => toggleMilestone(m.id)}
                className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-110"
                style={{ background: done ? accent : 'transparent', border: done ? 'none' : `1.5px solid ${accent}80` }}
                title={done ? 'Отменить' : 'Достигнута'}
              >
                {done && <CheckCircle2 className="h-3 w-3 text-white" />}
              </button>
              <div className="leading-tight">
                <div className={`text-small font-medium ${done ? 'line-through text-text-muted' : ''}`}>{m.title}</div>
                <div className="text-caption text-text-muted tabular-nums">
                  {m.value != null && `${fmtNum(m.value, 1)}${goal.unit ? ` ${goal.unit}` : ''}`}
                  {m.value != null && m.due_date && ' · '}
                  {m.due_date && fmtDate(m.due_date)}
                  {m.value == null && !m.due_date && (done ? 'достигнута' : 'впереди')}
                </div>
              </div>
              <button onClick={() => removeMilestone(m.id)} className="opacity-0 group-hover/ms:opacity-100 transition-opacity text-text-dim hover:text-danger">
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        }) : deriveMilestones(goal).map((m, k, arr) => {
          const nextIdx = arr.findIndex((x) => !x.done);
          const isNext = k === nextIdx;
          return (
            <div key={k} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: m.done ? accent : isNext ? `${accent}80` : 'var(--border)' }}>
              <span className="h-4 w-4 rounded-full flex items-center justify-center shrink-0" style={{ background: m.done ? accent : 'transparent', border: m.done ? 'none' : `1.5px solid ${isNext ? accent : 'var(--border)'}` }}>
                {m.done && <CheckCircle2 className="h-3 w-3 text-white" />}
              </span>
              <div className="leading-tight">
                <div className="text-small font-medium tabular-nums">{fmtNum(m.value, 1)}{goal.unit ? ` ${goal.unit}` : ''}</div>
                <div className="text-caption text-text-muted">{m.done ? 'достигнута' : isNext ? 'следующая' : k === arr.length - 1 ? 'финиш' : 'впереди'}</div>
              </div>
            </div>
          );
        })}
      </div>
      {adding && (
        <div className="flex gap-2 mt-2">
          <Input placeholder="Название вехи" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
          <Input type="number" placeholder={goal.unit ? `Значение (${goal.unit})` : 'Значение'} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className="w-40" />
          <Button size="sm" onClick={submit}>Добавить</Button>
        </div>
      )}
    </div>
  );
};

/** «Что делать сегодня» по цели: связанные задачи на сегодня + привычки цели. */
const GoalToday: React.FC<{ goal: Goal; accent: string }> = ({ goal, accent }) => {
  const { tasks, habits, habitLogs, toggleTask, toggleHabitLog } = useStore();
  const today = todayISO2();
  const todayTasks = tasks.filter((t) => t.goal_id === goal.id && t.date === today && !t.parent_id);
  const goalHabits = habits.filter((h) => h.goal_id === goal.id);
  const minutes = todayTasks.filter((t) => t.status !== 'done').reduce((s, t) => s + (t.estimate_min ?? 0), 0);

  if (todayTasks.length === 0 && goalHabits.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3 text-caption text-text-muted">
        Свяжи задачи и привычки с этой целью (поле «Цель» при создании) — здесь появится план действий на сегодня.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="section-label !mb-0">Что делать сегодня</div>
        {minutes > 0 && <span className="text-caption text-text-muted tabular-nums">{minutes} мин действий</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {todayTasks.map((t) => (
          <label key={t.id} className="flex items-center gap-2.5 text-small cursor-pointer group/td">
            <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
            <span className={`truncate ${t.status === 'done' ? 'line-through text-text-muted' : 'text-text'}`}>{t.title}</span>
            {t.start_time && <span className="ml-auto text-caption text-text-dim tabular-nums shrink-0">{t.start_time}</span>}
          </label>
        ))}
        {goalHabits.map((h) => {
          const done = habitLogs.some((l) => l.habit_id === h.id && l.date === today);
          const color = h.color ?? accent;
          return (
            <label key={h.id} className="flex items-center gap-2.5 text-small cursor-pointer">
              <button
                onClick={() => toggleHabitLog(h.id, today)}
                className="h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-all hover:scale-110"
                style={{ background: done ? color : 'transparent', borderColor: color }}
              >
                {done && <CheckCircle2 className="h-3 w-3 text-white" />}
              </button>
              <span className={`truncate ${done ? 'text-text-muted' : 'text-text'}`}>{h.title}</span>
              <span className="ml-auto text-caption text-text-dim shrink-0">привычка</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

function todayISO2(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Timeline: полосы целей по календарной оси с вехами и маркером «сегодня». */
const GoalsTimeline: React.FC<{ goals: Goal[] }> = ({ goals }) => {
  const { milestones } = useStore();
  if (goals.length === 0) return <Card className="p-8 text-center text-sm text-text-muted">Нет целей для таймлайна</Card>;

  const now = Date.now();
  const starts = goals.map((g) => new Date(g.created_at).getTime());
  const ends = goals.map((g) => (g.deadline ? new Date(g.deadline).getTime() : now + 30 * 86400000));
  const min = Math.min(...starts);
  const max = Math.max(...ends, now);
  const span = max - min || 1;
  const pos = (t: number) => Math.max(0, Math.min(100, ((t - min) / span) * 100));

  // Месячные деления
  const ticks: { t: number; label: string }[] = [];
  const c = new Date(min); c.setDate(1); c.setHours(0, 0, 0, 0);
  while (c.getTime() <= max) {
    ticks.push({ t: c.getTime(), label: `${MONTHS_RU[c.getMonth()]}${c.getMonth() === 0 ? ` '${String(c.getFullYear()).slice(2)}` : ''}` });
    c.setMonth(c.getMonth() + 1);
  }

  return (
    <Card className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Ось месяцев */}
        <div className="relative h-6 ml-[188px] mb-2">
          {ticks.map((tk) => (
            <span key={tk.t} className="absolute top-0 text-caption text-text-muted -translate-x-1/2" style={{ left: `${pos(tk.t)}%` }}>{tk.label}</span>
          ))}
        </div>
        <div className="relative space-y-3">
          {/* Маркер «сегодня» */}
          <div className="absolute top-0 bottom-0 w-px bg-danger/60 z-10 pointer-events-none" style={{ left: `calc(188px + (100% - 188px) * ${pos(now) / 100})` }}>
            <span className="absolute -top-0.5 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-danger" />
          </div>
          {goals.map((g, i) => {
            const accent = g.color || GOAL_PALETTE[i % GOAL_PALETTE.length];
            const s = new Date(g.created_at).getTime();
            const e = g.deadline ? new Date(g.deadline).getTime() : now + 30 * 86400000;
            const left = pos(s);
            const width = Math.max(2, pos(e) - left);
            const r = pctOfG(g);
            const gms = milestones.filter((m) => m.goal_id === g.id && m.due_date);
            const Icon = goalIcon(g.title);
            return (
              <div key={g.id} className="flex items-center gap-3">
                <div className="w-44 shrink-0 flex items-center gap-2 min-w-0">
                  <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}1f` }}>
                    <Icon className="h-3 w-3" style={{ color: accent }} />
                  </span>
                  <span className="text-small truncate">{g.title}</span>
                  <span className="ml-auto text-caption text-text-muted tabular-nums shrink-0">{r}%</span>
                </div>
                <div className="flex-1 relative h-7 rounded-md bg-bg-soft">
                  <div className="absolute top-1 bottom-1 rounded-md" style={{ left: `${left}%`, width: `${width}%`, background: `${accent}2e`, border: `1px solid ${accent}55` }}>
                    <div className="h-full rounded-md" style={{ width: `${r}%`, background: `${accent}cc` }} />
                  </div>
                  {gms.map((m) => (
                    <span
                      key={m.id}
                      title={`${m.title}${m.due_date ? ` · ${fmtDate(m.due_date)}` : ''}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border-2 z-[5]"
                      style={{ left: `${pos(new Date(m.due_date!).getTime())}%`, background: m.done_at ? accent : 'var(--bg-card)', borderColor: accent }}
                    />
                  ))}
                  {g.deadline && (
                    <span className="absolute top-1/2 -translate-y-1/2 text-caption text-text-dim tabular-nums" style={{ left: `calc(${pos(e)}% + 6px)` }}>
                      {fmtDate(g.deadline)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

/** Дерево: цель → вехи → подцели → связанные задачи и привычки. */
const GoalsTree: React.FC<{ goals: Goal[] }> = ({ goals }) => {
  const { goals: allGoals, milestones, tasks, habits, habitLogs, toggleMilestone, toggleTask, toggleHabitLog } = useStore();
  const today = todayISO2();
  if (goals.length === 0) return <Card className="p-8 text-center text-sm text-text-muted">Нет целей</Card>;

  return (
    <div className="space-y-3">
      {goals.map((g, i) => {
        const accent = g.color || GOAL_PALETTE[i % GOAL_PALETTE.length];
        const Icon = goalIcon(g.title);
        const r = pctOfG(g);
        const gms = milestones.filter((m) => m.goal_id === g.id);
        const children = allGoals.filter((x) => x.parent_id === g.id);
        const linkedTasks = tasks.filter((t) => t.goal_id === g.id && !t.parent_id);
        const activeTasks = linkedTasks.filter((t) => t.status !== 'done').slice(0, 5);
        const doneCount = linkedTasks.filter((t) => t.status === 'done').length;
        const linkedHabits = habits.filter((h) => h.goal_id === g.id);
        return (
          <Card key={g.id}>
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1f` }}>
                <Icon className="h-4 w-4" style={{ color: accent }} />
              </span>
              <h3 className="text-h3 truncate flex-1">{g.title}</h3>
              <div className="w-28 hidden sm:block"><Progress value={r} barColor={accent} /></div>
              <span className="text-small font-semibold tabular-nums w-10 text-right">{r}%</span>
            </div>
            <div className="mt-3 ml-4 pl-5 border-l border-border-soft space-y-3">
              {gms.length > 0 && (
                <TreeSection label={`Вехи · ${gms.filter((m) => m.done_at).length}/${gms.length}`}>
                  {gms.map((m) => (
                    <li key={m.id} className="flex items-center gap-2.5 text-small">
                      <button
                        onClick={() => toggleMilestone(m.id)}
                        className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-110"
                        style={{ background: m.done_at ? accent : 'transparent', border: m.done_at ? 'none' : `1.5px solid ${accent}80` }}
                      >
                        {m.done_at && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </button>
                      <span className={m.done_at ? 'line-through text-text-muted' : 'text-text'}>{m.title}</span>
                      {m.value != null && <span className="text-caption text-text-muted tabular-nums">{fmtNum(m.value, 1)}{g.unit ? ` ${g.unit}` : ''}</span>}
                    </li>
                  ))}
                </TreeSection>
              )}
              {children.length > 0 && (
                <TreeSection label={`Подцели · ${children.length}`}>
                  {children.map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5 text-small">
                      <Target className="h-3.5 w-3.5 text-text-dim shrink-0" />
                      <span className="flex-1 truncate">{c.title}</span>
                      <div className="w-20"><Progress value={pctOfG(c)} barColor={colorByPct(pctOfG(c))} /></div>
                      <span className="text-caption text-text-muted tabular-nums w-8 text-right">{pctOfG(c)}%</span>
                    </li>
                  ))}
                </TreeSection>
              )}
              {linkedTasks.length > 0 && (
                <TreeSection label={`Задачи · ${doneCount}/${linkedTasks.length} выполнено`}>
                  {activeTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 text-small">
                      <Checkbox checked={false} onCheckedChange={() => toggleTask(t.id)} />
                      <span className="flex-1 truncate">{t.title}</span>
                      <span className="text-caption text-text-dim tabular-nums shrink-0">{t.date === today ? 'сегодня' : fmtDate(t.date)}</span>
                    </li>
                  ))}
                  {linkedTasks.filter((t) => t.status !== 'done').length > 5 && (
                    <li className="text-caption text-text-muted">…ещё {linkedTasks.filter((t) => t.status !== 'done').length - 5}</li>
                  )}
                </TreeSection>
              )}
              {linkedHabits.length > 0 && (
                <TreeSection label={`Привычки · ${linkedHabits.length}`}>
                  {linkedHabits.map((h) => {
                    const done = habitLogs.some((l) => l.habit_id === h.id && l.date === today);
                    const color = h.color ?? accent;
                    return (
                      <li key={h.id} className="flex items-center gap-2.5 text-small">
                        <button
                          onClick={() => toggleHabitLog(h.id, today)}
                          className="h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-all hover:scale-110"
                          style={{ background: done ? color : 'transparent', borderColor: color }}
                        >
                          {done && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </button>
                        <span className="flex-1 truncate">{h.title}</span>
                        <span className="text-caption text-text-dim">сегодня {done ? '✓' : '—'}</span>
                      </li>
                    );
                  })}
                </TreeSection>
              )}
              {gms.length === 0 && children.length === 0 && linkedTasks.length === 0 && linkedHabits.length === 0 && (
                <p className="text-caption text-text-muted">Нет связей — добавь вехи в карточке цели, а задачам и привычкам укажи цель.</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const TreeSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="section-label !mb-1.5">{label}</div>
    <ul className="space-y-1.5">{children}</ul>
  </div>
);

function goalSphere(title: string): { label: string; color: string } {
  const t = title.toLowerCase();
  if (/(трен|спорт|зал|форм|бег|марафон|похуд|вес|кг|workout|фитнес|здоров|сон)/.test(t)) return { label: 'Здоровье', color: '#22c55e' };
  if (/(деньг|финанс|доход|подушк|money|₽|накоп|инвест|бюджет)/.test(t)) return { label: 'Финансы', color: '#f59e0b' };
  if (/(проект|бизнес|запуск|saas|стартап|работ|карьер|product)/.test(t)) return { label: 'Карьера', color: '#6366f1' };
  if (/(семь|отнош|близк|family|любов|друз)/.test(t)) return { label: 'Отношения', color: '#ec4899' };
  if (/(англ|язык|книг|чита|read|курс|учеб|навык|развит)/.test(t)) return { label: 'Развитие', color: '#3b82f6' };
  return { label: 'Другое', color: '#94a3b8' };
}

const RailStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-caption text-text-muted">{label}</span>
    <span className="text-small font-semibold tabular-nums text-text">{value}</span>
  </div>
);

const RailAction: React.FC<{ icon: React.ElementType; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-bg-soft hover:bg-bg-hover p-3 transition-colors">
    <Icon className="h-4 w-4 text-accent" />
    <span className="text-caption text-text-muted">{label}</span>
  </button>
);

function goalIcon(title: string): React.ElementType {
  const t = title.toLowerCase();
  if (/(трен|спорт|зал|форм|бег|марафон|похуд|вес|кг|workout|фитнес)/.test(t)) return Dumbbell;
  if (/(деньг|финанс|доход|подушк|money|₽|накоп|инвест|бюджет)/.test(t)) return Wallet;
  if (/(проект|бизнес|запуск|saas|стартап|product)/.test(t)) return Rocket;
  if (/(англ|язык|english|испан|немец|language)/.test(t)) return Languages;
  if (/(книг|чита|read|страниц)/.test(t)) return BookOpen;
  if (/(семь|отнош|близк|family|любов)/.test(t)) return Heart;
  return Target;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function successClass(pct: number | null): string {
  if (pct == null) return 'text-text';
  if (pct >= 70) return 'text-success';
  if (pct >= 40) return 'text-warning';
  return 'text-danger';
}

const GoalStat: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="min-w-0">
    <div className="text-caption text-text-muted truncate">{label}</div>
    <div className={`text-small font-semibold tabular-nums truncate ${valueClass ?? 'text-text'}`}>{value}</div>
  </div>
);

function forecastChart(goal: any, recs: any[], f: any, cc: ChartColors, accent: string) {
  const histDates = recs.map((r) => r.date);
  const histVals = recs.map((r) => r.value);
  const fcDates = f.forecast.map((p: any) => p.date);
  const fcExp = f.forecast.map((p: any) => p.expected);
  const fcLow = f.forecast.map((p: any) => p.low);
  const fcHigh = f.forecast.map((p: any) => p.high);
  const xs = [...histDates, ...fcDates];
  return {
    grid: { left: 35, right: 10, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
    xAxis: { type: 'category', data: xs, boundaryGap: false, axisLabel: { color: cc.axis, fontSize: 9, hideOverlap: true, formatter: (v: string) => (v.length > 5 ? v.slice(5) : v) }, axisTick: { show: false }, axisLine: { lineStyle: { color: cc.axisLine } } },
    yAxis: {
      type: 'value',
      axisLabel: { color: cc.axis, fontSize: 10 },
      splitLine: { lineStyle: { color: cc.splitLine } },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [
      {
        name: 'История', type: 'line', smooth: true, showSymbol: false,
        data: [...histVals, ...new Array(fcDates.length).fill(null)],
        lineStyle: { color: accent, width: 2 }, areaStyle: { color: `${accent}26` },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: cc.axis, type: 'dashed' }, data: [{ yAxis: goal.target_value, label: { color: cc.axis, formatter: 'цель' } }] },
      },
      {
        name: 'Прогноз', type: 'line', smooth: true, showSymbol: false,
        data: [...new Array(histVals.length).fill(null), ...fcExp],
        lineStyle: { color: accent, width: 2, type: 'dashed' },
      },
      {
        name: 'low', type: 'line', smooth: true, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'ci', symbol: 'none',
        data: [...new Array(histVals.length).fill(null), ...fcLow],
      },
      {
        name: 'high', type: 'line', smooth: true, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'ci', symbol: 'none',
        areaStyle: { color: `${accent}1f` },
        data: [...new Array(histVals.length).fill(null), ...fcHigh.map((h: number, i: number) => h - fcLow[i])],
      },
    ],
  };
}
