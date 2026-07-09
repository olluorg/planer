import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { Scale, Moon, Footprints, Droplet, Dumbbell, Zap, HeartPulse, Utensils, Smile } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Ring } from '@/components/ui/ring';
import { Sparkline } from '@/components/ui/sparkline';
import { ECharts } from '@/components/charts/ECharts';
import { useStore } from '@/lib/store';
import { isoDate, fmtNum } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { getChartColors } from '@/lib/chart-theme';
import type { HealthMetric } from '@/lib/types';

interface MetricDef {
  key: HealthMetric;
  label: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  goal: number | null;   // дневная норма (для Health Score)
  step: string;
  decimals: number;
}

const METRICS: MetricDef[] = [
  { key: 'weight',  label: 'Вес',        unit: 'кг',  icon: Scale,      color: '#6366f1', goal: null,  step: '0.1', decimals: 1 },
  { key: 'sleep',   label: 'Сон',        unit: 'ч',   icon: Moon,       color: '#8b5cf6', goal: 8,     step: '0.5', decimals: 1 },
  { key: 'steps',   label: 'Шаги',       unit: '',    icon: Footprints, color: '#22c55e', goal: 10000, step: '500', decimals: 0 },
  { key: 'water',   label: 'Вода',       unit: 'л',   icon: Droplet,    color: '#06b6d4', goal: 2,     step: '0.25', decimals: 1 },
  { key: 'workout', label: 'Тренировка', unit: 'мин', icon: Dumbbell,   color: '#f59e0b', goal: 30,    step: '5',   decimals: 0 },
  { key: 'energy',  label: 'Энергия',    unit: '/10', icon: Zap,        color: '#ec4899', goal: 7,     step: '1',   decimals: 0 },
  // calories: goal=null — калории не входят в Health Score (больше ≠ лучше), только трекинг
  { key: 'calories', label: 'Питание',   unit: 'ккал', icon: Utensils,  color: '#f97316', goal: null,  step: '50',  decimals: 0 },
];

export const HealthPage: React.FC<{ date: Date }> = ({ date }) => {
  const { healthLogs, upsertHealthLog, reflections } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const d = isoDate(date);

  const days14 = useMemo(() => Array.from({ length: 14 }, (_, i) => isoDate(addDays(date, -13 + i))), [date]);
  const days30 = useMemo(() => Array.from({ length: 30 }, (_, i) => isoDate(addDays(date, -29 + i))), [date]);

  const valueOf = (day: string, metric: HealthMetric): number | null => {
    const row = healthLogs.find((l) => l.date === day && l.metric === metric);
    return row ? row.value : null;
  };

  // Health Score дня: средняя доля выполнения дневных норм (вес не участвует)
  const score = useMemo(() => {
    const parts = METRICS.filter((m) => m.goal != null).map((m) => {
      const v = valueOf(d, m.key);
      if (v == null) return null;
      return Math.max(0, Math.min(1, v / m.goal!));
    }).filter((x): x is number => x != null);
    return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null;
  }, [healthLogs, d]);

  const scoreSeries = useMemo(() => days14.map((day) => {
    const parts = METRICS.filter((m) => m.goal != null).map((m) => {
      const v = valueOf(day, m.key);
      if (v == null) return null;
      return Math.max(0, Math.min(1, v / m.goal!));
    }).filter((x): x is number => x != null);
    return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 0;
  }), [healthLogs, days14]);

  return (
    <div className="page py-4 space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-h1">Здоровье</h1>
        </div>
        <p className="text-small text-text-muted mt-1">Тело — платформа для всего остального. Логируй минимум, смотри тренды.</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Быстрый лог: 6 метрик */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {METRICS.map((m) => (
              <MetricLogCard
                key={m.key}
                def={m}
                today={valueOf(d, m.key)}
                series={days14.map((day) => valueOf(day, m.key) ?? 0)}
                onLog={(v) => upsertHealthLog(d, m.key, v)}
              />
            ))}
          </div>

          {/* Тренды */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardTitle>Вес · 30 дней</CardTitle>
              <ECharts height={200} option={lineOpt(days30, days30.map((day) => valueOf(day, 'weight')), '#6366f1', cc)} />
            </Card>
            <Card>
              <CardTitle>Сон · 14 дней</CardTitle>
              <ECharts height={200} option={barOpt(days14, days14.map((day) => valueOf(day, 'sleep')), '#8b5cf6', cc, 8)} />
            </Card>
            <Card>
              <CardTitle>Шаги · 14 дней</CardTitle>
              <ECharts height={200} option={barOpt(days14, days14.map((day) => valueOf(day, 'steps')), '#22c55e', cc, 10000)} />
            </Card>
            <Card>
              <CardTitle>Энергия · 14 дней</CardTitle>
              <ECharts height={200} option={barOpt(days14, days14.map((day) => valueOf(day, 'energy')), '#ec4899', cc, 7)} />
            </Card>
            <Card>
              <CardTitle>Питание · 14 дней</CardTitle>
              <ECharts height={200} option={barOpt(days14, days14.map((day) => valueOf(day, 'calories')), '#f97316', cc)} />
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Smile className="h-4 w-4 text-accent" />
                <CardTitle className="!mb-0">Настроение · 14 дней</CardTitle>
              </div>
              <ECharts height={200} option={moodOpt(days14, days14.map((day) => {
                const r = reflections.find((x) => x.date === day);
                return r?.mood != null ? r.mood + 1 : null; // 1..5
              }), cc)} />
              <p className="text-caption text-text-muted mt-1">Источник — «Рефлексия»: отмечай настроение дня там.</p>
            </Card>
          </div>
        </div>

        {/* Рейл: Health Score */}
        <aside className="w-full xl:w-[300px] shrink-0 space-y-4 xl:sticky xl:top-4 self-start">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="h-4 w-4 text-accent" />
              <h3 className="text-base font-semibold text-text">Health Score</h3>
            </div>
            <div className="flex items-center gap-4">
              <Ring value={score ?? 0} size={84} stroke={9} color={score == null ? 'var(--border)' : score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'} glow={false} trackColor="var(--border)">
                <div className="text-base font-bold tabular-nums leading-none">{score == null ? '—' : `${score}%`}</div>
              </Ring>
              <div className="text-small text-text-muted leading-relaxed">
                {score == null ? 'Залогируй хотя бы одну метрику за сегодня' : score >= 70 ? 'Отличный день для тела' : score >= 40 ? 'Норм, но есть что добрать' : 'Тело просит внимания'}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border-soft">
              <div className="section-label !mb-1.5">14 дней</div>
              <Sparkline data={scoreSeries} width={252} height={40} color="var(--accent)" />
            </div>
          </Card>

          <Card>
            <CardTitle>Нормы дня</CardTitle>
            <ul className="space-y-2">
              {METRICS.filter((m) => m.goal != null).map((m) => {
                const v = valueOf(d, m.key);
                const pct = v == null ? 0 : Math.min(100, Math.round((v / m.goal!) * 100));
                return (
                  <li key={m.key} className="flex items-center gap-2.5 text-small">
                    <m.icon className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
                    <span className="flex-1 text-text-muted">{m.label}</span>
                    <span className="tabular-nums text-text">{v == null ? '—' : fmtNum(v, m.decimals)}/{fmtNum(m.goal!, 0)}{m.unit ? ` ${m.unit}` : ''}</span>
                    <span className={`tabular-nums w-10 text-right font-medium ${pct >= 100 ? 'text-success' : 'text-text-muted'}`}>{pct}%</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
};

const MetricLogCard: React.FC<{
  def: MetricDef;
  today: number | null;
  series: number[];
  onLog: (v: number) => void;
}> = ({ def, today, series, onLog }) => {
  const [v, setV] = useState('');
  const Icon = def.icon;
  const submit = () => {
    const num = Number(v.replace(',', '.'));
    if (!v.trim() || isNaN(num)) return;
    onLog(num);
    setV('');
  };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${def.color}1f` }}>
          <Icon className="h-4.5 w-4.5" style={{ color: def.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-small font-semibold text-text">{def.label}</div>
          <div className="text-caption text-text-muted">
            {today == null ? 'нет записи' : `${fmtNum(today, def.decimals)}${def.unit ? ` ${def.unit}` : ''} сегодня`}
          </div>
        </div>
        <Sparkline data={series} width={72} height={28} color={def.color} />
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          step={def.step}
          placeholder={def.unit || 'значение'}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button size="sm" onClick={submit}>Записать</Button>
      </div>
    </Card>
  );
};

function lineOpt(days: string[], vals: (number | null)[], color: string, cc: any) {
  return {
    grid: { left: 40, right: 10, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
    xAxis: { type: 'category', data: days.map((x) => x.slice(5)), axisLabel: { color: cc.axis, fontSize: 9, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: cc.axisLine } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: cc.axis, fontSize: 10 }, splitLine: { lineStyle: { color: cc.splitLine } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'line', smooth: true, connectNulls: true, data: vals, showSymbol: false, lineStyle: { color, width: 2.5 }, areaStyle: { color: `${color}1f` } }],
  };
}

function moodOpt(days: string[], vals: (number | null)[], cc: any) {
  const EMOJI = ['', '😖', '😕', '😐', '🙂', '😄'];
  return {
    grid: { left: 40, right: 10, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText }, formatter: (ps: any[]) => ps.map((p) => `${p.axisValue}: ${EMOJI[p.value] ?? '—'} ${p.value ?? ''}`).join('\n') },
    xAxis: { type: 'category', data: days.map((x) => x.slice(5)), axisLabel: { color: cc.axis, fontSize: 9, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: cc.axisLine } } },
    yAxis: { type: 'value', min: 1, max: 5, interval: 1, axisLabel: { color: cc.axis, fontSize: 12, formatter: (v: number) => EMOJI[v] ?? '' }, splitLine: { lineStyle: { color: cc.splitLine } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'line', smooth: true, connectNulls: true, data: vals, symbol: 'circle', symbolSize: 7, lineStyle: { color: '#8b5cf6', width: 2.5 }, itemStyle: { color: '#8b5cf6' }, areaStyle: { color: '#8b5cf61f' } }],
  };
}

function barOpt(days: string[], vals: (number | null)[], color: string, cc: any, goal?: number) {
  return {
    grid: { left: 40, right: 10, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
    xAxis: { type: 'category', data: days.map((x) => x.slice(5)), axisLabel: { color: cc.axis, fontSize: 9, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: cc.axisLine } } },
    yAxis: { type: 'value', axisLabel: { color: cc.axis, fontSize: 10 }, splitLine: { lineStyle: { color: cc.splitLine } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: 12, data: vals.map((x) => x ?? 0), itemStyle: { color, borderRadius: [3, 3, 0, 0] },
      ...(goal != null ? { markLine: { silent: true, symbol: 'none', lineStyle: { color: cc.axis, type: 'dashed' }, data: [{ yAxis: goal, label: { color: cc.axis, formatter: 'норма' } }] } } : {}),
    }],
  };
}
