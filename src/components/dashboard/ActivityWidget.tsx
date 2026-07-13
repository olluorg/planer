import { useEffect, useMemo, useState } from 'react';
import { Activity, Footprints, Dumbbell, Plus, Trash2, Target, HeartPulse } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate, fmtNum } from '@/lib/utils';
import {
  burnedKcal, addManual, removeManual, MANUAL_PRESETS, ACTIVITY_EVENT,
  stepKcal, metKcalPerMin, WORKOUT_MET,
} from '@/lib/activity';
import { eatenKcal, NUTRITION_EVENT } from '@/lib/nutrition';
import { resolveWeight, setProfileWeight, PROFILE_EVENT, computeBMR } from '@/lib/profile';

/** Активность за сегодня: шаги + зарядка + ручные тренировки → сожжённые ккал.
 *  Показывает связь с целями (шаги-цель, дефицит для похудения). */
export const ActivityWidget: React.FC = () => {
  const { healthLogs, goals } = useStore();
  const [tick, setTick] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [preset, setPreset] = useState<string>(MANUAL_PRESETS[0].id);
  const [minutes, setMinutes] = useState('');
  const [weightEdit, setWeightEdit] = useState('');
  const today = isoDate(new Date());

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(ACTIVITY_EVENT, bump);
    window.addEventListener(NUTRITION_EVENT, bump);
    window.addEventListener(PROFILE_EVENT, bump);
    return () => {
      window.removeEventListener(ACTIVITY_EVENT, bump);
      window.removeEventListener(NUTRITION_EVENT, bump);
      window.removeEventListener(PROFILE_EVENT, bump);
    };
  }, []);

  const weight = resolveWeight(healthLogs);
  const steps = healthLogs.find((l) => l.date === today && l.metric === 'steps')?.value ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const b = useMemo(() => burnedKcal(today, steps, weight), [tick, today, steps, weight]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bmr = useMemo(() => computeBMR(weight), [tick, weight]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eaten = useMemo(() => eatenKcal(today), [tick, today]);
  const balance = eaten - (bmr + b.total);

  const stepsGoal = goals.find((g) => g.status === 'active' && g.health_metric === 'steps');
  const weightGoal = goals.find((g) => g.status === 'active' && (g.unit ?? '').toLowerCase().includes('кг') && g.target_value < g.start_value);

  const submit = () => {
    const mins = Math.round(Number(minutes) || 0);
    const p = MANUAL_PRESETS.find((x) => x.id === preset) ?? MANUAL_PRESETS[0];
    if (mins <= 0) return;
    addManual(today, p.label, mins, p.met, weight);
    setMinutes('');
    setFormOpen(false);
  };

  const Row: React.FC<{ icon: React.ElementType; label: string; sub: string; kcal: number }> = ({ icon: Icon, label, sub, kcal }) => (
    <div className="flex items-center gap-2.5">
      <span className="h-7 w-7 rounded-lg bg-bg-soft flex items-center justify-center shrink-0"><Icon className="h-3.5 w-3.5 text-accent" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium text-text truncate">{label}</span>
        <span className="block text-[10px] text-text-dim">{sub}</span>
      </span>
      <span className="text-xs font-semibold tabular-nums text-accent shrink-0">−{fmtNum(kcal, 0)}</span>
    </div>
  );

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border-soft shadow-card p-4 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 shrink-0 mb-3">
        <Activity className="h-4 w-4 text-accent shrink-0" />
        <span className="text-sm font-semibold text-text truncate flex-1">Активность</span>
        <span className="text-sm font-bold tabular-nums text-accent shrink-0" title={bmr > 0 ? 'покой + активность' : 'активность'}>−{fmtNum(bmr + b.total, 0)} ккал</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-2.5">
        {bmr > 0 && <Row icon={HeartPulse} label="Покой (BMR)" sub="базовый метаболизм за день" kcal={bmr} />}
        <Row icon={Footprints} label="Шаги" sub={`${fmtNum(b.steps, 0)} · ${stepKcal(weight).toFixed(3)} ккал/шаг`} kcal={b.stepsKcal} />
        <Row icon={Dumbbell} label="Зарядка" sub={b.workoutMin > 0 ? `${b.workoutMin} мин · ${metKcalPerMin(WORKOUT_MET, weight).toFixed(1)} ккал/мин` : 'сегодня ещё не было'} kcal={b.workoutKcal} />
        {b.manual.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5 group">
            <span className="h-7 w-7 rounded-lg bg-bg-soft flex items-center justify-center shrink-0"><Activity className="h-3.5 w-3.5 text-accent" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-text truncate">{m.title}</span>
              <span className="block text-[10px] text-text-dim">{m.minutes} мин</span>
            </span>
            <span className="text-xs font-semibold tabular-nums text-accent shrink-0">−{fmtNum(m.kcal, 0)}</span>
            <button onClick={() => removeManual(today, m.id)} className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition-opacity shrink-0" title="Удалить">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {formOpen ? (
          <div className="flex gap-1.5">
            <select value={preset} onChange={(e) => setPreset(e.target.value)}
              className="flex-1 h-8 rounded-lg bg-bg-soft border border-border-soft px-1.5 text-xs outline-none">
              {MANUAL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="мин" inputMode="numeric" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-14 h-8 rounded-lg bg-bg-soft border border-border-soft px-2 text-xs tabular-nums outline-none focus:border-border" />
            <button onClick={submit} className="h-8 w-8 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setFormOpen(true)} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors">
            <Plus className="h-3.5 w-3.5" /> Добавить тренировку
          </button>
        )}
      </div>

      {/* Баланс, вес для расчёта и связь с целями */}
      <div className="shrink-0 border-t border-border-soft pt-2 mt-2 space-y-1">
        <div className="flex justify-between text-[11px] tabular-nums">
          <span className="text-text-muted">Баланс: съедено − сожжено</span>
          <b className={balance <= 0 ? 'text-accent' : 'text-text'}>{balance > 0 ? '+' : ''}{fmtNum(balance, 0)} ккал</b>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-text-muted">Вес для расчёта:</span>
          <input
            value={weightEdit || String(weight)}
            onChange={(e) => setWeightEdit(e.target.value)}
            onBlur={() => { const v = Number(weightEdit); if (v > 0) setProfileWeight(v); setWeightEdit(''); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            inputMode="numeric"
            className="w-12 h-6 rounded-md bg-bg-soft border border-border-soft px-1.5 text-[11px] tabular-nums text-center outline-none focus:border-border"
            title="Берётся из последней записи веса в «Здоровье», либо задай здесь"
          />
          <span className="text-text-dim">кг</span>
        </div>
        {stepsGoal && (
          <div className="flex items-center gap-1 text-[10px] text-text-dim truncate">
            <Target className="h-3 w-3 text-accent shrink-0" /> шаги идут в цель «{stepsGoal.title}»
          </div>
        )}
        {weightGoal && (
          <div className="flex items-center gap-1 text-[10px] text-text-dim truncate">
            <Target className="h-3 w-3 text-accent shrink-0" />
            {balance < 0 ? `дефицит ${fmtNum(-balance, 0)} ккал → «${weightGoal.title}»` : `для «${weightGoal.title}» нужен дефицит`}
          </div>
        )}
      </div>
    </div>
  );
};
