import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Cpu, KeyRound, TriangleAlert, Target, ListChecks, Repeat } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { generatePlan, type GeneratedPlan } from '@/lib/aiGenerate';
import { resolveProvider, type ProviderKind } from '@/lib/aiProvider';
import { PRIORITY_LABEL as PRIO_LABEL } from '@/components/ui/priority-dot';

const EXAMPLES = [
  'Хочу пробежать полумарафон через 3 месяца',
  'Выучить английский до уровня B2 за полгода',
  'Навести порядок в финансах и начать копить',
  'Запустить пет-проект за месяц',
];

const TYPE_LABEL: Record<string, string> = { long: 'Долгосрочная', mid: 'Среднесрочная', short: 'Короткая' };
const dayLabel = (d: number) => (d === 0 ? 'сегодня' : d === 1 ? 'завтра' : `через ${d} дн.`);

/** AI-генерация плана: описание на естественном языке → цель + задачи + привычки.
 *  Ничего не создаётся без подтверждения: сперва превью с галочками. */
export const AiGenerateModal: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({ open, onOpenChange }) => {
  const nav = useNavigate();
  const { addGoal, addTask, addHabit } = useStore();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [provider, setProvider] = useState<ProviderKind>('none');
  const [useGoal, setUseGoal] = useState(true);
  const [taskSel, setTaskSel] = useState<boolean[]>([]);
  const [habitSel, setHabitSel] = useState<boolean[]>([]);

  useEffect(() => {
    if (!open) return;
    void resolveProvider().then(setProvider);
    setPlan(null); setError(null); setPrompt('');
  }, [open]);

  const gen = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(null); setPlan(null);
    try {
      const p = await generatePlan(prompt);
      setPlan(p);
      setUseGoal(!!p.goal);
      setTaskSel(p.tasks.map(() => true));
      setHabitSel(p.habits.map(() => true));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const commit = () => {
    if (!plan) return;
    let goalId: string | null = null;
    if (plan.goal && useGoal) {
      const g = plan.goal;
      goalId = addGoal({
        title: g.title,
        type: g.type,
        metric: g.metric,
        target_value: g.target_value ?? 100,
        unit: g.unit,
        deadline: g.deadline_days ? isoDate(new Date(Date.now() + g.deadline_days * 86400000)) : null,
      }).id;
    }
    let n = 0;
    plan.tasks.forEach((t, i) => {
      if (!taskSel[i]) return;
      addTask({
        title: t.title,
        date: isoDate(new Date(Date.now() + t.day_offset * 86400000)),
        priority: t.priority,
        recurrence: t.recurrence,
        goal_id: goalId,
      });
      n++;
    });
    let h = 0;
    plan.habits.forEach((x, i) => {
      if (!habitSel[i]) return;
      addHabit({ title: x.title, schedule: x.schedule, target_per_week: x.target_per_week, goal_id: goalId });
      h++;
    });
    toast.success('План добавлен', [goalId && 'цель', n && `задач: ${n}`, h && `привычек: ${h}`].filter(Boolean).join(' · '));
    onOpenChange(false);
  };

  const nothingPicked = !!plan && !(plan.goal && useGoal) && !taskSel.some(Boolean) && !habitSel.some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> AI-генерация плана</DialogTitle>
          <DialogDescription>Опиши, чего хочешь достичь — соберу цель, задачи и привычки. Добавится только то, что отметишь.</DialogDescription>
        </DialogHeader>

        {/* Какой провайдер отвечает */}
        <div className="flex items-center gap-2 text-[11px] text-text-muted mb-3">
          {provider === 'chrome' && <><Cpu className="h-3.5 w-3.5 text-success" /> Встроенный AI Chrome — работает локально, бесплатно</>}
          {provider === 'key' && <><KeyRound className="h-3.5 w-3.5 text-accent" /> Свой API-ключ</>}
          {provider === 'none' && (
            <span className="flex items-center gap-2 text-danger">
              <TriangleAlert className="h-3.5 w-3.5" /> AI недоступен —
              <button onClick={() => { onOpenChange(false); nav('/settings'); }} className="underline hover:no-underline">настроить</button>
            </span>
          )}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) gen(); }}
          rows={3}
          placeholder="Например: хочу пробежать полумарафон через 3 месяца…"
          className="w-full rounded-xl border border-border bg-bg-soft px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent resize-none"
        />
        {!plan && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLES.map((x) => (
              <button key={x} onClick={() => setPrompt(x)} className="rounded-full border border-border-soft bg-bg-soft px-2.5 py-1 text-[11px] text-text-muted hover:text-text hover:border-border transition-colors">
                {x}
              </button>
            ))}
          </div>
        )}

        {error && <div className="mt-3 rounded-xl bg-danger/10 text-danger text-xs p-3">{error}</div>}

        {/* Превью плана */}
        {plan && (
          <div className="mt-4 space-y-4 max-h-[45vh] overflow-y-auto pr-1">
            {plan.goal && (
              <div>
                <div className="section-label flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Цель</div>
                <label className="flex items-start gap-2.5 rounded-xl border border-border-soft p-3 cursor-pointer">
                  <Checkbox checked={useGoal} onCheckedChange={() => setUseGoal((v) => !v)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text">{plan.goal.title}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge tone="accent">{TYPE_LABEL[plan.goal.type]}</Badge>
                      {plan.goal.target_value && <Badge tone="soft">{plan.goal.target_value} {plan.goal.unit ?? ''}</Badge>}
                      {plan.goal.deadline_days && <Badge tone="soft">срок: {plan.goal.deadline_days} дн.</Badge>}
                    </div>
                  </div>
                </label>
              </div>
            )}

            {plan.tasks.length > 0 && (
              <div>
                <div className="section-label flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Задачи</div>
                <div className="space-y-1.5">
                  {plan.tasks.map((t, i) => (
                    <label key={i} className="flex items-start gap-2.5 rounded-lg border border-border-soft p-2.5 cursor-pointer">
                      <Checkbox checked={!!taskSel[i]} onCheckedChange={() => setTaskSel((s) => s.map((v, j) => (j === i ? !v : v)))} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-text">{t.title}</div>
                        <div className="text-[11px] text-text-muted mt-0.5 flex flex-wrap gap-2">
                          <span>{dayLabel(t.day_offset)}</span>
                          <span>· {PRIO_LABEL[t.priority]}</span>
                          {t.recurrence && <span className="flex items-center gap-1 text-accent"><Repeat className="h-3 w-3" /> повтор</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {plan.habits.length > 0 && (
              <div>
                <div className="section-label flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Привычки</div>
                <div className="space-y-1.5">
                  {plan.habits.map((h, i) => (
                    <label key={i} className="flex items-center gap-2.5 rounded-lg border border-border-soft p-2.5 cursor-pointer">
                      <Checkbox checked={!!habitSel[i]} onCheckedChange={() => setHabitSel((s) => s.map((v, j) => (j === i ? !v : v)))} />
                      <span className="text-sm text-text flex-1 min-w-0 truncate">{h.title}</span>
                      <Badge tone="soft">{h.schedule === 'daily' ? 'каждый день' : `${h.target_per_week}/нед`}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {plan ? (
            <>
              <Button variant="ghost" onClick={() => setPlan(null)}>Заново</Button>
              <Button onClick={commit} disabled={nothingPicked}>Добавить</Button>
            </>
          ) : (
            <Button onClick={gen} disabled={!prompt.trim() || loading || provider === 'none'}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Генерирую…</> : <><Sparkles className="h-4 w-4" /> Сгенерировать</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
