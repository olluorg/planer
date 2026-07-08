import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { computeInsights } from '@/lib/insights';
import { getUserName } from '@/lib/onboarding';
import { askAI, hasAiKey } from '@/lib/ai';
import { isoDate } from '@/lib/utils';
import { Bot, SendHorizontal, TriangleAlert, TrendingUp, Sparkles, Info, Loader2 } from 'lucide-react';

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

export const CoachPanel: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { tasks, habits, habitLogs, reflections, timeEntries, goals, progress } = useStore();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const online = hasAiKey();

  const recs = useMemo(
    () => computeInsights({ today: date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress }).slice(0, 3),
    [date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress],
  );

  // Контекст дня для модели — реальные данные пользователя
  const buildContext = () => {
    const d = isoDate(date);
    const today = tasks.filter((t) => t.date === d && !t.parent_id);
    const doneToday = today.filter((t) => t.status === 'done').length;
    const activeGoals = goals.filter((g) => !g.parent_id && g.status === 'active').slice(0, 8);
    return [
      `Пользователь: ${getUserName()}. Дата: ${d}.`,
      `Задачи на сегодня (${doneToday}/${today.length} выполнено): ${today.map((t) => `${t.status === 'done' ? '✓' : '○'} ${t.title}${t.start_time ? ` (${t.start_time})` : ''}`).join('; ') || 'нет'}.`,
      `Активные цели: ${activeGoals.map((g) => g.title).join('; ') || 'нет'}.`,
      `Привычки: ${habits.map((h) => h.title).join('; ') || 'нет'}.`,
    ].join('\n');
  };

  const run = async (prompt: string) => {
    setLoading(true);
    setAnswer(null);
    try {
      const reply = await askAI([
        { role: 'system', content: `Ты — краткий продуктивный AI-коуч в планере THEDAD. Отвечай по-русски, конкретно, без воды. Контекст:\n${buildContext()}` },
        { role: 'user', content: prompt },
      ]);
      setAnswer(reply);
    } catch (e: any) {
      setAnswer(`Ошибка: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const ask = () => { if (q.trim()) { run(q.trim()); setQ(''); } };

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

      {/* Ответ модели */}
      {(loading || answer) && (
        <div className="rounded-xl bg-bg-soft p-3 text-[13px] text-text leading-relaxed whitespace-pre-wrap">
          {loading ? (
            <span className="flex items-center gap-2 text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Думаю…</span>
          ) : answer}
        </div>
      )}

      {/* Действия */}
      <div className="rounded-xl bg-bg-soft p-3">
        <div className="text-[13px] text-text mb-2.5">
          {online ? 'Оптимизировать твоё расписание на сегодня?' : 'Включить коуча?'}
        </div>
        <div className="flex gap-2">
          {online ? (
            <>
              <button
                onClick={() => run('Составь оптимальный план на сегодня с учётом моих задач и целей: что делать в первую очередь, как распределить время. Кратко, по пунктам.')}
                disabled={loading}
                className="flex-1 h-9 rounded-lg border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/10 transition-colors duration-base disabled:opacity-50"
              >
                Оптимизировать день
              </button>
              <button
                onClick={() => run('Что мне сейчас важнее всего сделать и почему? Одна рекомендация.')}
                disabled={loading}
                className="flex-1 h-9 rounded-lg border border-border bg-bg-card text-xs font-medium text-text hover:bg-bg-hover transition-colors duration-base disabled:opacity-50"
              >
                Что важнее всего?
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
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          disabled={!online || loading}
          placeholder={online ? 'Спроси о чём угодно…' : 'Доступно после подключения ключа'}
          className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text-dim disabled:cursor-not-allowed"
        />
        <button
          onClick={ask}
          disabled={!online || !q.trim() || loading}
          className="h-7 w-7 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40 transition-opacity duration-base"
          title="Отправить"
        >
          <SendHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
