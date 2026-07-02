import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { computeInsights } from '@/lib/insights';
import { getUserName } from '@/lib/onboarding';
import { Bot, SendHorizontal, TriangleAlert, TrendingUp, Sparkles, Info } from 'lucide-react';

const TONE_ICON: Record<string, React.ElementType> = {
  warning: TriangleAlert, positive: TrendingUp, info: Sparkles, neutral: Info,
};
const TONE_CHIP: Record<string, { label: string; cls: string }> = {
  warning: { label: 'Внимание', cls: 'bg-danger/10 text-danger' },
  positive: { label: 'Хороший темп', cls: 'bg-success/10 text-success' },
  info: { label: 'Важно', cls: 'bg-accent/10 text-accent' },
  neutral: { label: 'Наблюдение', cls: 'bg-bg-soft text-text-muted' },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** Ключ появится в настройках на этапе подключения AI-провайдера */
export function hasAiKey(): boolean {
  try { return Boolean(localStorage.getItem('thedad.ai.key')); } catch { return false; }
}

export const CoachPanel: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { tasks, habits, habitLogs, reflections, timeEntries, goals, progress } = useStore();
  const [q, setQ] = useState('');
  const online = hasAiKey();

  const recs = useMemo(
    () => computeInsights({ today: date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress }).slice(0, 3),
    [date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress],
  );

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-4 flex flex-col gap-3">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-label text-text">
            <Bot className="h-4 w-4 text-accent" /> AI-коуч
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-success' : 'bg-text-dim'}`} />
            {online ? 'Онлайн' : 'Офлайн'}
          </div>
        </div>
        <button
          onClick={() => nav('/settings')}
          className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-text-muted hover:bg-bg-soft transition-colors duration-base"
          title="Настройки AI"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </div>

      {/* Приветственный пузырь */}
      <div className="rounded-xl bg-accent text-white p-3.5 text-[13px] leading-relaxed">
        {greeting()}, {getUserName()}.{' '}
        {online
          ? 'Вот на чём сегодня стоит сфокусироваться, чтобы продвинуться сильнее всего.'
          : 'Пока я офлайн — показываю локальные наблюдения. Подключи API-ключ, и я смогу планировать день за тебя.'}
      </div>

      {/* Рекомендации */}
      <div className="space-y-2">
        {recs.length === 0 && (
          <div className="text-xs text-text-muted px-1">Поработай несколько дней — появятся рекомендации.</div>
        )}
        {recs.map((r) => {
          const Icon = TONE_ICON[r.tone] ?? Info;
          const chip = TONE_CHIP[r.tone] ?? TONE_CHIP.neutral;
          return (
            <button
              key={r.id}
              onClick={() => r.link && nav(r.link)}
              className="w-full rounded-xl bg-bg-soft hover:bg-bg-hover transition-colors duration-base p-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 shrink-0 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </span>
                <span className="text-[13px] font-semibold text-text truncate flex-1">{r.title}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${chip.cls}`}>{chip.label}</span>
              </div>
              <div className="text-xs text-text-muted leading-snug mt-1.5 line-clamp-2 pl-[42px]">{r.body}</div>
            </button>
          );
        })}
      </div>

      {/* Действия */}
      <div className="rounded-xl bg-bg-soft p-3">
        <div className="text-[13px] text-text mb-2.5">
          {online ? 'Оптимизировать твоё расписание на сегодня?' : 'Включить коуча?'}
        </div>
        <div className="flex gap-2">
          {online ? (
            <>
              <button className="flex-1 h-9 rounded-lg border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/10 transition-colors duration-base">
                Оптимизировать день
              </button>
              <button className="flex-1 h-9 rounded-lg border border-border bg-bg-card text-xs font-medium text-text hover:bg-bg-hover transition-colors duration-base">
                Другой план
              </button>
            </>
          ) : (
            <button
              onClick={() => nav('/settings')}
              className="flex-1 h-9 rounded-lg border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/10 transition-colors duration-base"
            >
              Добавить API-ключ
            </button>
          )}
        </div>
      </div>

      {/* Поле вопроса */}
      <div className={`flex items-center gap-2 rounded-xl border border-border-soft bg-bg-soft px-3 h-11 ${online ? '' : 'opacity-60'}`}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!online}
          placeholder={online ? 'Спроси о чём угодно…' : 'Доступно после подключения ключа'}
          className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text-dim disabled:cursor-not-allowed"
        />
        <button
          disabled={!online || !q.trim()}
          className="h-7 w-7 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40 transition-opacity duration-base"
          title="Отправить"
        >
          <SendHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
