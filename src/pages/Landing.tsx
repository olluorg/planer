import { useNavigate } from 'react-router-dom';
import { Target, Calendar as CalendarIcon, Zap, HeartPulse, NotebookPen, BarChart3, Bot, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

const FEATURES = [
  { icon: Target, title: 'Цели с планом', body: 'Направление, вехи и прогноз достижения — не просто список желаний.' },
  { icon: CalendarIcon, title: 'План дня', body: 'Почасовая тайм-блок-сетка. Защищаешь время на главное.' },
  { icon: Zap, title: 'Focus Mode', body: 'Глубокая работа, генеративные звуки и YouTube для потока.' },
  { icon: HeartPulse, title: 'Здоровье', body: 'Сон, шаги, энергия, вес. Тело питает энергию для целей.' },
  { icon: Bot, title: 'AI-коуч', body: 'Подключи ключ — планирует день и отвечает на вопросы.' },
  { icon: BarChart3, title: 'Аналитика', body: 'Тренды, прогнозы и личные рекорды. Видишь, что работает.' },
];

const CYCLE = [
  { icon: Target, color: '#6366f1', label: 'Цели' },
  { icon: CalendarIcon, color: '#8b5cf6', label: 'План' },
  { icon: Zap, color: '#f59e0b', label: 'Фокус' },
  { icon: HeartPulse, color: '#22c55e', label: 'Здоровье' },
  { icon: NotebookPen, color: '#ec4899', label: 'Рефлексия' },
];

export const LandingPage: React.FC = () => {
  const nav = useNavigate();
  const start = () => nav('/');

  return (
    <div className="min-h-screen bg-bg text-text overflow-x-hidden">
      {/* Nav */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <Logo size={40} />
          <div>
            <div className="font-bold leading-none">THEDAD</div>
            <div className="text-[10px] text-text-muted">Productivity OS</div>
          </div>
        </div>
        <button onClick={start} className="rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2 hover:bg-accent-soft transition-colors active:scale-[0.97]">Открыть приложение</button>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-card px-3 py-1 text-xs text-text-muted mb-6">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> Твоя жизнь как единая система
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold leading-[1.05] max-w-3xl mx-auto">
          Достигай большего.<br />С ясностью, фокусом<br />и <span className="text-accent">AI рядом</span>.
        </h1>
        <p className="text-base sm:text-lg text-text-muted mt-6 max-w-xl mx-auto leading-relaxed">
          Всё-в-одном система продуктивности: цели, план дня, привычки, здоровье и рефлексия — связаны в один цикл. Локально, приватно, твоё.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-accent text-white font-semibold px-6 py-3 hover:bg-accent-soft transition-[background-color,transform] active:scale-[0.97]">
            Начать бесплатно <ArrowRight className="h-4 w-4" />
          </button>
          <span className="inline-flex items-center gap-1.5 text-sm text-text-muted"><Lock className="h-3.5 w-3.5" /> Данные не покидают устройство</span>
        </div>
      </section>

      {/* Life-OS цикл */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-border bg-bg-card p-6 sm:p-8">
          <div className="text-center text-sm text-text-muted mb-6">Один замкнутый цикл — каждый шаг питает следующий</div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
            {CYCLE.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: `${s.color}1f` }}>
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                {i < CYCLE.length - 1 && <ArrowRight className="h-4 w-4 text-text-dim mb-4" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-bg-card p-6 hover:shadow-lift hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200">
              <div className="h-11 w-11 rounded-xl bg-accent/12 text-accent flex items-center justify-center mb-4"><f.icon className="h-5 w-5" /></div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-accent text-white px-6 sm:px-10 py-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div>
            <div className="text-2xl font-bold">Твои цели. Твоя система. Твоя жизнь.</div>
            <div className="text-white/80 mt-1">Всё связано. Всё, чтобы ты стал лучшей версией себя.</div>
          </div>
          <button onClick={start} className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white text-accent font-semibold px-6 py-3 hover:bg-white/90 transition-[background-color,transform] active:scale-[0.97]">
            Начать путь <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-text-muted border-t border-border-soft">
        THEDAD · Productivity OS · Локально, приватно, без рекламы
      </footer>
    </div>
  );
};
