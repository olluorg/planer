import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABEL, TEMPLATES, type TemplatePack } from '@/lib/templates';
import { useStore } from '@/lib/store';
import { todayISO } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Check, ChevronRight } from 'lucide-react';

export const TemplatesPage = () => {
  const { addTask, addHabit, addGoal } = useStore();
  const [filter, setFilter] = useState<'all' | TemplatePack['category']>('all');
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => (filter === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.category === filter)),
    [filter],
  );

  const apply = (tpl: TemplatePack) => {
    const today = todayISO();
    tpl.goals?.forEach((g) => {
      const deadline = g.deadline_in_days
        ? (() => { const d = new Date(); d.setDate(d.getDate() + g.deadline_in_days!); return d.toISOString().slice(0, 10); })()
        : null;
      addGoal({
        title: g.title,
        type: g.type,
        start_value: g.start_value,
        target_value: g.target_value,
        unit: g.unit ?? null,
        deadline,
      });
    });
    tpl.habits?.forEach((h) => {
      addHabit({
        title: h.title,
        color: h.color ?? null,
        schedule: h.schedule ?? 'daily',
        target_per_week: h.target_per_week ?? 7,
      });
    });
    tpl.tasks?.forEach((t) => {
      addTask({
        title: t.title,
        date: today,
        time_block: (t.time_block as any) ?? null,
        start_time: t.start_time ?? null,
        priority: t.priority ?? 2,
        tags: t.tags ?? null,
        estimate_min: t.estimate_min ?? null,
      });
    });
    setApplied((s) => new Set([...s, tpl.id]));
    const total = (tpl.goals?.length ?? 0) + (tpl.habits?.length ?? 0) + (tpl.tasks?.length ?? 0);
    toast.success(`Шаблон «${tpl.title}» применён`, `Добавлено ${total} элементов`);
  };

  const cats = ['all', ...Object.keys(CATEGORY_LABEL)] as const;

  return (
    <div className="page py-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Шаблоны</h1>
          <p className="text-sm text-text-muted mt-1">Готовые наборы целей, привычек и задач. Применяй одним кликом, потом редактируй под себя.</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === c
                ? 'bg-accent text-white shadow-lift'
                : 'bg-bg-soft text-text-muted hover:bg-bg-hover hover:text-text'
            }`}
          >
            {c === 'all' ? 'Все' : CATEGORY_LABEL[c as TemplatePack['category']]}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="bento-grid">
        {filtered.map((tpl) => {
          const total = (tpl.goals?.length ?? 0) + (tpl.habits?.length ?? 0) + (tpl.tasks?.length ?? 0);
          const isApplied = applied.has(tpl.id);
          return (
            <Card key={tpl.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-bg-soft text-2xl flex items-center justify-center shrink-0">
                  {tpl.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-text-muted">{CATEGORY_LABEL[tpl.category]}</div>
                  <h3 className="text-base font-semibold text-text leading-snug">{tpl.title}</h3>
                </div>
              </div>
              <p className="text-sm text-text-muted mt-2 leading-relaxed">{tpl.description}</p>

              <ul className="mt-3 space-y-1.5 text-xs">
                {tpl.goals && tpl.goals.length > 0 && (
                  <SectionList label="Цели" items={tpl.goals.map((g) => g.title)} />
                )}
                {tpl.habits && tpl.habits.length > 0 && (
                  <SectionList label="Привычки" items={tpl.habits.map((h) => h.title)} />
                )}
                {tpl.tasks && tpl.tasks.length > 0 && (
                  <SectionList
                    label="Задачи"
                    items={tpl.tasks.map((t) => (t.start_time ? `${t.start_time} · ${t.title}` : t.title))}
                  />
                )}
              </ul>

              <div className="mt-4 pt-3 border-t border-border-soft flex items-center justify-between">
                <span className="text-[11px] text-text-muted">{total} элементов</span>
                <Button
                  variant={isApplied ? 'soft' : 'default'}
                  size="sm"
                  onClick={() => apply(tpl)}
                >
                  {isApplied ? <><Check className="h-3.5 w-3.5" /> Применено</> : <>Применить <ChevronRight className="h-3.5 w-3.5" /></>}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const SectionList: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <li>
    <div className="text-[10px] uppercase tracking-wider text-text-dim mb-1">{label}</div>
    <ul className="space-y-0.5">
      {items.slice(0, 4).map((t, i) => (
        <li key={i} className="text-text-muted truncate">· {t}</li>
      ))}
      {items.length > 4 && <li className="text-text-dim">+ ещё {items.length - 4}</li>}
    </ul>
  </li>
);
