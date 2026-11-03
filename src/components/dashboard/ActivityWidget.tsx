import { useEffect, useId, useMemo, useState } from 'react';
import { Activity, Footprints, Dumbbell, Plus, Trash2, Target, HeartPulse } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate, fmtNum } from '@/lib/utils';
import {
  burnedKcal, addManual, removeManual, MANUAL_PRESETS, ACTIVITY_EVENT,
  stepKcal, manualActiveKcal, isWorkoutStorageReadable, isManualActivityStorageReadable,
} from '@/lib/activity';
import { eatenKcal, hasCompleteEatenCalories, NUTRITION_EVENT } from '@/lib/nutrition';
import { resolveWeight, setProfileWeight, PROFILE_EVENT, computeBMR } from '@/lib/profile';
import { activityAction } from '@/lib/activityAction';

/** Активность за сегодня: шаги + зарядка + ручные тренировки → сожжённые ккал.
 *  Показывает связь с целями (шаги-цель, дефицит для похудения). */
export const ActivityWidget: React.FC = () => {
  const { healthLogs, goals } = useStore();
  const [tick, setTick] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [preset, setPreset] = useState<string>(MANUAL_PRESETS[0].id);
  const [minutes, setMinutes] = useState('');
  const [minutesError, setMinutesError] = useState('');
  const errorId = useId();
  const [weightEdit, setWeightEdit] = useState('');
  const today = isoDate(new Date());
  const storageProblem = !isWorkoutStorageReadable() || !isManualActivityStorageReadable();

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
  const balance = bmr > 0 && hasCompleteEatenCalories(today) ? eaten - (bmr + b.total) : null;

  const stepsGoal = goals.find((g) => g.status === 'active' && g.health_metric === 'steps');
  const weightGoal = goals.find((g) => g.status === 'active' && (g.unit ?? '').toLowerCase().includes('кг') && g.target_value < g.start_value);

  const submit = () => {
    const mins = Number(minutes);
    const p = MANUAL_PRESETS.find((x) => x.id === preset) ?? MANUAL_PRESETS[0];
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) { setMinutesError('Укажите целое число минут от 1 до 1440.'); return; }
    if (!activityAction(() => addManual(today, p.label, mins, p.met, weight))) return;
    setMinutes('');
    setMinutesError('');
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
        <span className="text-sm font-bold tabular-nums text-accent shrink-0" title={bmr > 0 ? 'оценка: покой + активность сверх покоя' : 'оценка активности сверх покоя'}>−{fmtNum(bmr + b.total, 0)} ккал</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-2.5">
        {storageProblem && <p role="alert" className="text-xs text-danger">Данные активности повреждены или недоступны. Сохраните исходную копию личных данных в настройках перед восстановлением.</p>}
        {bmr > 0 && <Row icon={HeartPulse} label="Покой (BMR)" sub="базовый метаболизм за день" kcal={bmr} />}
        <Row icon={Footprints} label="Шаги" sub={`${fmtNum(b.steps, 0)} · ${stepKcal(weight).toFixed(3)} ккал/шаг`} kcal={b.stepsKcal} />
        <Row icon={Dumbbell} label="Тренировки" sub={b.workoutMin > 0 ? `${b.workoutMin} мин · примерная оценка` : 'сегодня ещё не было'} kcal={b.workoutKcal} />
        {b.manual.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5 group">
            <span className="h-7 w-7 rounded-lg bg-bg-soft flex items-center justify-center shrink-0"><Activity className="h-3.5 w-3.5 text-accent" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-text truncate">{m.title}</span>
              <span className="block text-[10px] text-text-dim">{m.minutes} мин</span>
            </span>
            <span className="text-xs font-semibold tabular-nums text-accent shrink-0">−{fmtNum(manualActiveKcal(m), 0)}</span>
            <button onClick={() => activityAction(() => removeManual(today, m.id))} className="p-2 text-text-dim hover:text-danger focus-visible:text-danger shrink-0" aria-label={`Удалить: ${m.title}, ${m.minutes} мин`} title="Удалить">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {formOpen ? (
          <div className="space-y-1">
          <div className="flex gap-1.5">
            <select aria-label="Вид активности" value={preset} onChange={(e) => setPreset(e.target.value)}
              className="flex-1 h-8 rounded-lg bg-bg-soft border border-border-soft px-1.5 text-xs outline-none">
              {MANUAL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input aria-label="Длительность в минутах" aria-invalid={!!minutesError} aria-describedby={minutesError ? errorId : undefined} value={minutes} onChange={(e) => { setMinutes(e.target.value); setMinutesError(''); }} placeholder="мин" inputMode="numeric" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-14 h-8 rounded-lg bg-bg-soft border border-border-soft px-2 text-xs tabular-nums outline-none focus:border-border" />
            <button onClick={submit} aria-label="Сохранить активность" className="h-8 w-8 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {minutesError && <p id={errorId} role="alert" className="text-xs text-danger">{minutesError}</p>}
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
          <span className="text-text-muted">Расчётный баланс</span>
          {balance === null ? <span className="text-text-dim">нет данных</span> : <b className="text-text">{balance > 0 ? '+' : ''}{fmtNum(balance, 0)} ккал</b>}
        </div>
        <p className="text-[10px] text-text-dim">{balance === null ? 'Для оценки добавьте еду и заполните профиль.' : 'По внесённым записям; неполный дневник влияет на результат.'}</p>
        {steps > 0 && (b.workoutMin > 0 || b.manual.length > 0) && <p className="text-[10px] text-text-dim">Шаги и тренировки могут пересекаться.</p>}
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
            {balance === null ? `Для оценки по цели «${weightGoal.title}» заполните дневник и профиль` : `Цель «${weightGoal.title}»: расчёт по внесённым записям`}
          </div>
        )}
      </div>
    </div>
  );
};
