import { useRef, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Plus, Trash2, TrendingUp, X, Rocket, Dumbbell, BookOpen, Wallet, Heart, Languages, Target, Sparkles, FileText, BarChart3, Download, ChevronRight, CheckCircle2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { fmtNum, colorByPct } from '@/lib/utils';
import { forecastGoal } from '@/lib/predict';
import { computeInsights } from '@/lib/insights';
import { ECharts } from '@/components/charts/ECharts';
import { Ring } from '@/components/ui/ring';
import { PageContainer } from '@/components/ui/page-container';
import { GoalPath } from '@/components/GoalPath';
import { useTheme } from '@/lib/theme';
import { getChartColors, type ChartColors } from '@/lib/chart-theme';
import type { Goal, GoalType } from '@/lib/types';

export const GoalsPage = () => {
  const { goals, progress, addGoal, removeGoal, updateGoal, addProgress, tasks, habits, habitLogs, reflections, timeEntries } = useStore();
  const nav = useNavigate();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const [open, setOpen] = useState(false);
  const [statusTab, setStatusTab] = useState<'active' | 'done' | 'archived'>('active');
  const [form, setForm] = useState({ title: '', type: 'mid' as GoalType, start_value: '0', target_value: '100', unit: '', deadline: '', parent_id: '__none' });
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
    });
    setOpen(false);
    setForm({ title: '', type: 'mid', start_value: '0', target_value: '100', unit: '', deadline: '', parent_id: '__none' });
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
  const insights = computeInsights({ today: new Date(), tasks, habits, habitLogs, reflections, timeEntries, goals, progress }).slice(0, 3);
  const recent = [...progress].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((p) => ({ p, goal: goals.find((g) => g.id === p.goal_id) }));

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
        <div className="flex items-center gap-2">
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

      <div className="goals-grid">
        {visible.map((g, i) => {
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
            <Card key={g.id} className="hover:shadow-lift flex flex-col">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1f` }}>
                  <Icon className="h-5 w-5" style={{ color: accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-h3 truncate">{g.title}</h2>
                    <span className="inline-flex items-center gap-1.5 text-caption text-text-muted shrink-0">
                      <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
                      {typeLabel}
                    </span>
                  </div>
                  <div className="text-small text-text-muted mt-0.5 truncate">
                    {g.metric || `${fmtNum(g.current_value, 1)} → ${fmtNum(g.target_value, 0)}${g.unit ? ` ${g.unit}` : ''}`}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-text-dim hover:text-danger" onClick={() => removeGoal(g.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <Progress value={r} className="flex-1" barColor={accent} />
                <span className="text-small font-semibold tabular-nums w-10 text-right">{r}%</span>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4">
                <GoalStat label="Старт" value={fmtDate(g.created_at)} />
                <GoalStat label="Дедлайн" value={g.deadline ? fmtDate(g.deadline) : '—'} />
                <GoalStat label="Осталось" value={daysLeft == null ? '—' : daysLeft < 0 ? 'просрочено' : `${daysLeft} дн`} />
                <GoalStat label="Прогноз" value={successPct == null ? '—' : `${successPct}%`} valueClass={successClass(successPct)} />
              </div>

              <div className="mt-4 pt-4 border-t border-border-soft">
                <div className="flex items-center justify-between mb-1">
                  <div className="section-label !mb-0">Динамика прогресса</div>
                  <span className="inline-flex items-center gap-1 text-caption text-text-muted">
                    <TrendingUp className="h-3 w-3" />
                    {f.etaDate ? f.etaDate : 'нет прогноза'}
                  </span>
                </div>
                <ECharts height={120} option={forecastChart(g, recs, f, cc, accent)} />
                <QuickProgress goal={g} onAdd={(v) => addProgress({ goal_id: g.id, date: new Date().toISOString().slice(0, 10), value: v, note: null })} />
              </div>

              {children.length > 0 && (
                <div className="mt-4 border-t border-border-soft pt-3">
                  <div className="section-label !mb-2">Подцели · {children.length}</div>
                  <ul className="space-y-2">
                    {children.map((c) => {
                      const cd = c.target_value - c.start_value || 1;
                      const cr = Math.round(Math.max(0, Math.min(1, (c.current_value - c.start_value) / cd)) * 100);
                      return (
                        <li key={c.id} className="flex items-center gap-3 text-small">
                          <span className="text-text-dim">↳</span>
                          <span className="flex-1 truncate">{c.title}</span>
                          <div className="w-24"><Progress value={cr} barColor={colorByPct(cr)} /></div>
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
      </div>

      {visible.length > 0 && (
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
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-accent" />
            <h3 className="text-base font-semibold text-text">AI-инсайты</h3>
          </div>
          {insights.length === 0 ? (
            <p className="text-small text-text-muted">Пока недостаточно данных для рекомендаций — добавь прогресс по целям.</p>
          ) : (
            <div className="space-y-3">
              {insights.map((i) => (
                <div key={i.id} className="flex gap-2.5">
                  <span className="text-base leading-none">{i.icon}</span>
                  <div className="min-w-0">
                    <div className="text-small font-medium text-text">{i.title}</div>
                    <div className="text-caption text-text-muted mt-0.5">{i.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => nav('/analytics')} className="mt-3 w-full flex items-center justify-center gap-1 text-caption text-accent hover:underline">
            Все рекомендации <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </Card>

        <Card>
          <CardTitle>Общая статистика</CardTitle>
          <div className="flex items-center gap-4">
            <Ring value={overall} size={84} stroke={9} color="#6366f1" glow={false} trackColor="var(--border)">
              <div className="text-base font-bold tabular-nums leading-none">{overall}%</div>
            </Ring>
            <div className="flex-1 space-y-2">
              <RailStat label="Активные цели" value={counts.active} />
              <RailStat label="Завершённые" value={counts.done} />
              <RailStat label="Средний прогноз" value={avgSuccess == null ? '—' : `${avgSuccess}%`} />
            </div>
          </div>
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
