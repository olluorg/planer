import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, CalendarArrowUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { buildWeekReview, markReviewDone, nextMonday, type GoalPace } from '@/lib/weeklyReview';
import { toast } from '@/lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = ['Цели', 'Задачи', 'Неделя', 'Дальше'] as const;

const PACE: Record<GoalPace, { label: string; tone: string }> = {
  ahead: { label: 'опережаете', tone: 'text-success' },
  on_track: { label: 'в графике', tone: 'text-success' },
  behind: { label: 'отстаёте', tone: 'text-warning' },
  idle: { label: 'без движения', tone: 'text-text-muted' },
  no_data: { label: 'нет отметок', tone: 'text-text-dim' },
};

const num = (v: number) => Number(v.toFixed(Math.abs(v) >= 10 ? 0 : 1)).toLocaleString('ru-RU');
const dayName = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** Недельный обзор: четыре коротких шага. Итог — незакрытое перенесено,
 *  главное на следующую неделю записано задачами на понедельник. */
export const WeeklyReview: React.FC<Props> = ({ open, onClose }) => {
  const s = useStore();
  const review = useMemo(
    () => buildWeekReview({ goals: s.goals, tasks: s.tasks, habits: s.habits, habitLogs: s.habitLogs, progress: s.progress, reflections: s.reflections }),
    // Пересчитываем при открытии, а не на каждую правку во время обзора:
    // иначе перенесённые задачи исчезали бы из списка у пользователя под курсором.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );
  const [step, setStep] = useState(0);
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [moved, setMoved] = useState(false);
  const [focus, setFocus] = useState(['', '', '']);

  const monday = nextMonday();
  const selected = review.leftover.filter((t) => keep[t.id] ?? true);

  const moveLeftover = () => {
    for (const t of selected) s.updateTask(t.id, { date: monday });
    setMoved(true);
    toast.success(`Перенесено на понедельник: ${selected.length}`);
  };

  const finish = () => {
    for (const title of focus.map((f) => f.trim()).filter(Boolean)) {
      s.addTask({ title, date: monday, priority: 2 });
    }
    markReviewDone();
    toast.success('Обзор недели готов', 'Хорошей недели!');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Обзор недели</DialogTitle>
          <DialogDescription>
            {dayName(review.weekStart)} — {dayName(review.weekEnd)} · шаг {step + 1} из {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[260px] max-h-[55vh] overflow-y-auto pr-1">
          {step === 0 && (
            review.goals.length === 0 ? (
              <p className="text-sm text-text-muted">Активных целей нет. Поставьте одну — и в следующее воскресенье будет что сравнить.</p>
            ) : (
              <ul className="space-y-3">
                {review.goals.map(({ goal, moved: mv, needed, pace }) => {
                  const u = goal.unit ? ` ${goal.unit}` : '';
                  return (
                    <li key={goal.id} className="rounded-xl border border-border-soft p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-text truncate">{goal.title}</span>
                        <span className={`text-caption font-semibold shrink-0 ${PACE[pace].tone}`}>{PACE[pace].label}</span>
                      </div>
                      <div className="text-caption text-text-muted mt-1">
                        {mv === null ? 'Отметьте прогресс, чтобы было что сравнить.' : <>За неделю: {mv > 0 ? '+' : ''}{num(mv)}{u}</>}
                        {needed !== null && mv !== null && <> · нужно было {num(needed)}{u}, чтобы успеть к сроку</>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-text">
                Выполнено задач: <b>{review.tasksDone}</b> из {review.tasksTotal}.
              </p>
              {review.leftover.length === 0 ? (
                <p className="text-sm text-text-muted">Незакрытых задач нет — чистая неделя.</p>
              ) : (
                <>
                  <p className="text-sm text-text-muted">Осталось висеть. Отметьте, что переносим на понедельник — остальное останется, где было.</p>
                  <ul className="space-y-1.5">
                    {review.leftover.map((t) => (
                      <li key={t.id}>
                        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--accent)]"
                            checked={keep[t.id] ?? true}
                            disabled={moved}
                            onChange={(e) => setKeep((k) => ({ ...k, [t.id]: e.target.checked }))}
                          />
                          <span className="flex-1 truncate">{t.title}</span>
                          <span className="text-caption text-text-dim shrink-0">{dayName(t.date)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <Button variant="soft" disabled={moved || selected.length === 0} onClick={moveLeftover}>
                    <CalendarArrowUp /> {moved ? 'Перенесено' : `Перенести на понедельник (${selected.length})`}
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {review.habits.length > 0 && (
                <div>
                  <div className="section-label mb-1.5">Привычки</div>
                  <ul className="space-y-1">
                    {review.habits.map(({ habit, done, target }) => (
                      <li key={habit.id} className="flex justify-between text-sm">
                        <span className="truncate">{habit.title}</span>
                        <span className="tabular-nums text-text-muted">{done} из {target}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="section-label mb-1.5">Ваши записи за неделю</div>
                {review.notes.length === 0 ? (
                  <p className="text-sm text-text-muted">Рефлексий на этой неделе не было. Три строчки вечером — и через месяц будет видно, что помогало, а что мешало.</p>
                ) : (
                  <ul className="space-y-2">
                    {review.notes.map((n) => (
                      <li key={n.date} className="text-sm">
                        <div className="text-caption text-text-dim">{dayName(n.date)}</div>
                        {n.good && <div>✓ {n.good}</div>}
                        {n.improve && <div className="text-text-muted">↻ {n.improve}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {review.avgMood !== null && (
                <p className="text-caption text-text-muted">Среднее настроение: {num(review.avgMood)} из 4</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-text">Три главные вещи на следующую неделю — не больше. Они встанут задачами на понедельник.</p>
              {focus.map((f, i) => (
                <Input
                  key={i}
                  aria-label={`Главное №${i + 1}`}
                  placeholder={i === 0 ? 'Самое важное' : 'Необязательно'}
                  value={f}
                  onChange={(e) => setFocus((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="items-center">
          {step > 0 && <Button variant="ghost" className="mr-auto" onClick={() => setStep(step - 1)}><ChevronLeft /> Назад</Button>}
          {step < STEPS.length - 1
            ? <Button onClick={() => setStep(step + 1)}>Дальше <ChevronRight /></Button>
            : <Button onClick={finish}>Завершить обзор</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
