import { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { fmtNum } from '@/lib/utils';
import { forecastGoal } from '@/lib/predict';
import { ECharts } from '@/components/charts/ECharts';
import type { GoalType } from '@/lib/types';

export const GoalsPage = () => {
  const { goals, progress, addGoal, removeGoal, updateGoal, addProgress } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'mid' as GoalType, start_value: '0', target_value: '100', unit: '', deadline: '' });

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
    });
    setOpen(false);
    setForm({ title: '', type: 'mid', start_value: '0', target_value: '100', unit: '', deadline: '' });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Цели</h1>
        <Button onClick={() => setOpen(true)}><Plus /> Новая цель</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {goals.map((g) => {
          const recs = progress.filter((p) => p.goal_id === g.id);
          const f = forecastGoal(g, recs, 30);
          const denom = g.target_value - g.start_value || 1;
          const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);

          const typeLabel = { long: 'долгосрочная', mid: 'среднесрочная', short: 'краткосрочная' }[g.type];

          return (
            <Card key={g.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone="soft">{typeLabel}</Badge>
                    {g.deadline && <Badge>{g.deadline}</Badge>}
                  </div>
                  <h2 className="text-lg font-medium truncate">{g.title}</h2>
                  <div className="text-sm text-text-muted">
                    {fmtNum(g.current_value, 1)} → {fmtNum(g.target_value, 0)}{g.unit ? ` ${g.unit}` : ''}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeGoal(g.id)}>
                  <Trash2 className="h-4 w-4 text-text-muted" />
                </Button>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <Progress value={r} className="flex-1" />
                <span className="text-sm tabular-nums">{r}%</span>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
                <TrendingUp className="h-3.5 w-3.5" />
                {f.etaDate ? <>прогноз достижения: <b className="text-text">{f.etaDate}</b> · точность {Math.round(f.etaConfidence * 100)}%</> : 'недостаточно данных для прогноза'}
              </div>

              <div className="mt-3">
                <ECharts height={140} option={forecastChart(g, recs, f)} />
              </div>

              <QuickProgress goal={g} onAdd={(v) => addProgress({ goal_id: g.id, date: new Date().toISOString().slice(0, 10), value: v, note: null })} />
            </Card>
          );
        })}
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
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
            <Button onClick={submit}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function forecastChart(goal: any, recs: any[], f: any) {
  const histDates = recs.map((r) => r.date);
  const histVals = recs.map((r) => r.value);
  const fcDates = f.forecast.map((p: any) => p.date);
  const fcExp = f.forecast.map((p: any) => p.expected);
  const fcLow = f.forecast.map((p: any) => p.low);
  const fcHigh = f.forecast.map((p: any) => p.high);
  const xs = [...histDates, ...fcDates];
  return {
    grid: { left: 35, right: 10, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: xs, axisLabel: { color: '#a3a3a3', fontSize: 10 }, axisLine: { lineStyle: { color: '#262626' } } },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#a3a3a3', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1f1f1f' } },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [
      {
        name: 'История', type: 'line', smooth: true, showSymbol: false,
        data: [...histVals, ...new Array(fcDates.length).fill(null)],
        lineStyle: { color: '#22c55e', width: 2 }, areaStyle: { color: 'rgba(34,197,94,0.15)' },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#a3a3a3', type: 'dashed' }, data: [{ yAxis: goal.target_value, label: { color: '#a3a3a3', formatter: 'цель' } }] },
      },
      {
        name: 'Прогноз', type: 'line', smooth: true, showSymbol: false,
        data: [...new Array(histVals.length).fill(null), ...fcExp],
        lineStyle: { color: '#3b82f6', width: 2, type: 'dashed' },
      },
      {
        name: 'low', type: 'line', smooth: true, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'ci', symbol: 'none',
        data: [...new Array(histVals.length).fill(null), ...fcLow],
      },
      {
        name: 'high', type: 'line', smooth: true, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'ci', symbol: 'none',
        areaStyle: { color: 'rgba(59,130,246,0.15)' },
        data: [...new Array(histVals.length).fill(null), ...fcHigh.map((h: number, i: number) => h - fcLow[i])],
      },
    ],
  };
}
