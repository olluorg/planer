import { useNavigate } from 'react-router-dom';
import { CheckSquare, Target, Repeat, Calendar, TrendingUp, NotebookPen, Sparkles, Bell, ArrowRight, Rocket } from 'lucide-react';
import { getUserName } from '@/lib/onboarding';
import { quoteOfDay } from '@/lib/quotes';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

interface CardDef {
  key: string;
  icon: React.ElementType;
  color: string;
  section: string;
  heading: string;
  body: string;
  cta: string;
  to: string;
}

const CARDS: CardDef[] = [
  { key: 'tasks', icon: CheckSquare, color: '#6366f1', section: 'Задачи', heading: 'Здесь пока нет задач', body: 'Создай свою первую задачу и начни день с фокуса.', cta: 'Добавить задачу', to: '/tasks' },
  { key: 'goals', icon: Target, color: '#22c55e', section: 'Цели', heading: 'У тебя пока нет целей', body: 'Поставь цель, которая вдохновляет, и двигайся к ней каждый день.', cta: 'Создать цель', to: '/goals' },
  { key: 'habits', icon: Repeat, color: '#f59e0b', section: 'Привычки', heading: 'Привычек пока нет', body: 'Добавь привычку и отслеживай свой прогресс день за днём.', cta: 'Добавить привычку', to: '/habits' },
  { key: 'plan', icon: Calendar, color: '#8b5cf6', section: 'Планирование', heading: 'Планов на сегодня нет', body: 'Запланируй задачи или начни фокус-сессию.', cta: 'Запланировать', to: '/plan' },
  { key: 'progress', icon: TrendingUp, color: '#06b6d4', section: 'Прогресс', heading: 'Нет данных для графика', body: 'Выполняй задачи и отслеживай прогресс — здесь появится аналитика.', cta: 'Перейти к задачам', to: '/tasks' },
  { key: 'reflection', icon: NotebookPen, color: '#ec4899', section: 'Рефлексия', heading: 'Пока нет записей', body: 'Поделись своими мыслями и отслеживай рост с течением времени.', cta: 'Добавить запись', to: '/reflection' },
  { key: 'ai', icon: Sparkles, color: '#6366f1', section: 'AI-коуч', heading: 'Инсайты появятся здесь', body: 'Чем больше данных, тем точнее рекомендации и прогнозы.', cta: 'Узнать больше', to: '/analytics' },
  { key: 'health', icon: Bell, color: '#ef4444', section: 'Здоровье', heading: 'Пока нет метрик', body: 'Логируй сон, шаги и энергию — тело питает энергию для целей.', cta: 'Открыть здоровье', to: '/health' },
];

/** Иллюстрация: иконка в мягком градиентном круге с декоративными точками. */
const Illustration: React.FC<{ icon: React.ElementType; color: string }> = ({ icon: Icon, color }) => (
  <div className="relative mx-auto mb-4 h-20 w-20">
    <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${color}33, ${color}12 60%, transparent 72%)` }} />
    <div className="absolute inset-2 rounded-2xl flex items-center justify-center" style={{ background: `${color}1f` }}>
      <Icon className="h-8 w-8" style={{ color }} strokeWidth={1.75} />
    </div>
    <span className="absolute -right-0.5 top-1 h-2 w-2 rounded-full" style={{ background: `${color}66` }} />
    <span className="absolute right-2 -top-1 h-1.5 w-1.5 rounded-full" style={{ background: `${color}44` }} />
    <span className="absolute -left-1 bottom-3 h-1.5 w-1.5 rounded-full" style={{ background: `${color}44` }} />
  </div>
);

export const EmptyDashboard: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const quote = quoteOfDay(date);

  return (
    <div className="page py-4 sm:py-6">
      {/* Приветствие */}
      <div className="mb-6 px-1">
        <h1 className="text-2xl sm:text-h1 text-text flex items-center gap-2">
          {greeting()}, {getUserName()}! <span className="text-2xl">👋</span>
        </h1>
        <div className="text-sm text-text-muted mt-1 capitalize">{format(date, 'EEEE, d MMMM', { locale: ru })} · с чего начнём?</div>
      </div>

      {/* Сетка пустых секций */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((c) => (
          <div key={c.key} className="rounded-2xl bg-bg-card border border-border shadow-card p-5 flex flex-col text-center hover:shadow-lift hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted text-left mb-3">{c.section}</div>
            <Illustration icon={c.icon} color={c.color} />
            <h3 className="text-base font-semibold text-text">{c.heading}</h3>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed flex-1">{c.body}</p>
            <button
              onClick={() => nav(c.to)}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent text-white text-sm font-medium px-4 py-2 hover:bg-accent-soft transition-[background-color,transform] active:scale-[0.97]"
            >
              {c.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Мотивационная плашка */}
      <div className="mt-4 rounded-2xl bg-bg-card border border-border shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8">
          <div className="relative shrink-0 h-24 w-24 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 40% 35%, var(--accent-glow, rgba(99,102,241,0.25)), transparent 70%)' }}>
            <div className="h-16 w-16 rounded-2xl bg-accent/15 flex items-center justify-center">
              <Rocket className="h-8 w-8 text-accent" strokeWidth={1.75} />
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-xl font-bold text-text flex items-center justify-center sm:justify-start gap-2">Ты на правильном пути <span>💜</span></h2>
            <p className="text-sm text-text-muted mt-1.5 leading-relaxed">«{quote.text}» <span className="text-text-dim">— {quote.author}</span></p>
          </div>
          <button
            onClick={() => nav('/goals')}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-accent text-white font-semibold px-6 py-3 hover:bg-accent-soft transition-[background-color,transform] active:scale-[0.97]"
          >
            Начать сейчас <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
