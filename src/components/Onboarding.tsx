import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Lock, TrendingUp, Bell } from 'lucide-react';
import { CATEGORIES, setOnboardingDone, setUserName } from '@/lib/onboarding';
import { Logo } from '@/components/ui/logo';
import { useStore } from '@/lib/store';
import { requestPermission, setHeartbeatEnabled } from '@/lib/notifications';
import { todayISO } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'hello' | 'goal' | 'mark';
const STEPS: Step[] = ['hello', 'goal', 'mark'];

/** Срок по умолчанию — через три месяца, в локальной дате. */
function inThreeMonths(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Знакомство в три шага: имя → одна цель числом → первая отметка.
 *
 *  Раньше шагов было девять (тема, направления, схема цикла, виджеты,
 *  профиль здоровья…), и до прогноза — главного, ради чего приложение
 *  существует, — мастер не доводил вовсе. Теперь человек выходит из него с
 *  целью, у которой уже есть первая точка, и видит, что нужно для прогноза.
 *  Всё остальное настраивается позже и по желанию. */
export const Onboarding: React.FC<Props> = ({ open, onClose }) => {
  const addGoal = useStore((s) => s.addGoal);
  const addProgress = useStore((s) => s.addProgress);

  const [step, setStep] = useState<Step>('hello');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const [deadline, setDeadline] = useState(inThreeMonths);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [remind, setRemind] = useState(false);

  if (!open) return null;

  const idx = STEPS.indexOf(step);
  const startNum = Number(start.replace(',', '.'));
  const targetNum = Number(target.replace(',', '.'));
  const goalValid = title.trim() !== '' && start !== '' && target !== ''
    && Number.isFinite(startNum) && Number.isFinite(targetNum) && startNum !== targetNum;

  const finish = async () => {
    setUserName(name);
    setOnboardingDone(true);
    if (remind) {
      const p = await requestPermission();
      if (p === 'granted') setHeartbeatEnabled(true);
    }
    onClose();
  };

  const createGoal = () => {
    const g = addGoal({
      title: title.trim(),
      type: 'mid',
      start_value: startNum,
      current_value: startNum,
      target_value: targetNum,
      unit: unit.trim() || null,
      deadline: deadline || null,
    });
    setGoalId(g.id);
    setCurrent(start);
    setStep('mark');
  };

  const saveMark = async () => {
    const v = Number(current.replace(',', '.'));
    if (goalId && Number.isFinite(v)) {
      addProgress({ goal_id: goalId, date: todayISO(), value: v, note: null });
    }
    await finish();
  };

  const usePreset = (id: string) => {
    const c = CATEGORIES.find((x) => x.id === id);
    if (!c) return;
    setTitle(c.sample.title);
    setStart('0');
    setTarget(String(c.sample.target));
    setUnit(c.sample.unit);
  };

  const field = 'block text-caption text-text-muted mb-1.5';

  return (
    <div className="fixed inset-0 z-[300] bg-bg flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Знакомство с THEDAD">
      <div className="w-full max-w-lg rounded-2xl bg-bg-card border border-border-soft shadow-card overflow-hidden">
        <div className="h-1 bg-bg-soft" aria-hidden>
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="p-7 sm:p-9 min-h-[420px] flex flex-col">
          {step === 'hello' && (
            <div className="flex-1 flex flex-col">
              <Logo size={52} className="mb-5 -ml-1.5" />
              <h1 className="text-h2 font-bold text-text text-balance">Планер, который говорит, успеете ли вы</h1>
              <p className="text-small text-text-muted mt-3 leading-relaxed">
                Вы ставите цель числом и отмечаете, как движетесь. Приложение считает
                темп и показывает, когда дойдёте — и предупреждает заранее, если не успеваете.
              </p>
              <label className="mt-7">
                <span className={field}>Как к вам обращаться? (необязательно)</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" autoFocus />
              </label>
              <p className="flex items-start gap-2 text-caption text-text-dim mt-auto pt-6">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Регистрации нет. Всё хранится на этом устройстве и никуда не отправляется.
              </p>
            </div>
          )}

          {step === 'goal' && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-h3 font-bold text-text text-balance">Одна цель — числом</h2>
              <p className="text-small text-text-muted mt-2">
                Не «похудеть», а «вес 78 кг к декабрю». Считать можно только то, что измеримо.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-4" aria-label="Примеры целей">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => usePreset(c.id)}
                    className="rounded-full border border-border-soft px-3 py-1 text-caption text-text-muted hover:border-accent hover:text-text transition-colors"
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <label className="mt-5">
                <span className={field}>Цель</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: пробежать 10 км без остановки" />
              </label>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <label>
                  <span className={field}>Сейчас</span>
                  <Input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="3" />
                </label>
                <label>
                  <span className={field}>Нужно</span>
                  <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10" />
                </label>
                <label>
                  <span className={field}>Единица</span>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="км" />
                </label>
              </div>
              <label className="mt-3">
                <span className={field}>К какому сроку</span>
                <Input type="date" value={deadline} min={todayISO()} onChange={(e) => setDeadline(e.target.value)} />
              </label>
              {start !== '' && target !== '' && startNum === targetNum && (
                <p className="text-caption text-danger mt-2">«Сейчас» и «Нужно» совпадают — цель уже достигнута.</p>
              )}
            </div>
          )}

          {step === 'mark' && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-h3 font-bold text-text text-balance">Первая отметка</h2>
              <p className="text-small text-text-muted mt-2">
                Сколько сейчас? Это первая точка на графике «{title}».
              </p>
              <label className="mt-5">
                <span className={field}>Сейчас{unit ? `, ${unit}` : ''}</span>
                <Input inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
              </label>
              <div className="flex items-start gap-3 rounded-xl bg-accent/[0.06] border border-accent/15 p-3.5 mt-5">
                <TrendingUp className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p className="text-small text-text leading-relaxed">
                  Отметьте прогресс ещё раз в другой день — и появится прогноз:
                  дата, когда вы дойдёте до цели, и хватает ли темпа к сроку.
                </p>
              </div>
              <label className="flex items-center gap-2.5 mt-5 cursor-pointer text-small text-text">
                <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                <Bell className="h-3.5 w-3.5 text-text-muted" />
                Напоминать утром о главном и вечером — отметить итог
              </label>
            </div>
          )}

          <div className="flex items-center gap-3 pt-6">
            {idx > 0 && step !== 'mark' && (
              <Button variant="ghost" onClick={() => setStep(STEPS[idx - 1])}><ChevronLeft /> Назад</Button>
            )}
            <button type="button" onClick={finish} className="text-caption text-text-dim hover:text-text-muted mr-auto">
              {step === 'mark' ? 'Отмечу позже' : 'Пропустить'}
            </button>
            {step === 'hello' && <Button onClick={() => setStep('goal')}>Дальше <ChevronRight /></Button>}
            {step === 'goal' && <Button disabled={!goalValid} onClick={createGoal}>Создать цель <ChevronRight /></Button>}
            {step === 'mark' && <Button onClick={saveMark}>Готово</Button>}
          </div>
        </div>
      </div>
    </div>
  );
};
