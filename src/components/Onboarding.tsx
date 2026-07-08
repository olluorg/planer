import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Target, Bell, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Zap, BarChart3 } from 'lucide-react';
import { CATEGORIES, setOnboardingDone, setUserName, setUserCategories } from '@/lib/onboarding';
import { applyTheme, useTheme } from '@/lib/theme';
import { useStore } from '@/lib/store';
import { requestPermission, setHeartbeatEnabled } from '@/lib/notifications';

interface Props {
  open: boolean;
  onClose: () => void;
}

type StepId = 'welcome' | 'theme' | 'name' | 'categories' | 'notifications' | 'done';

export const Onboarding: React.FC<Props> = ({ open, onClose }) => {
  const addGoal = useStore((s) => s.addGoal);
  const { theme } = useTheme();
  const [step, setStep] = useState<StepId>('welcome');
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const steps: StepId[] = ['welcome', 'theme', 'name', 'categories', 'notifications', 'done'];
  const stepIdx = steps.indexOf(step);

  const next = () => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]);
  };
  const prev = () => {
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]);
  };

  const finish = async () => {
    setBusy(true);
    setUserName(name);
    setUserCategories(chosen);
    // создаём по 1 шаблонной цели за каждую выбранную категорию
    const deadline = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      return d.toISOString().slice(0, 10);
    })();
    chosen.forEach((cid) => {
      const c = CATEGORIES.find((x) => x.id === cid);
      if (!c) return;
      addGoal({
        title: c.sample.title,
        type: c.sample.type as any,
        start_value: 0,
        target_value: c.sample.target,
        unit: c.sample.unit,
        deadline,
      });
    });
    setOnboardingDone(true);
    setBusy(false);
    onClose();
  };

  const enableHeartbeat = async () => {
    const p = await requestPermission();
    if (p === 'granted') setHeartbeatEnabled(true);
    next();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-bg-card border border-border-soft shadow-card overflow-hidden">
        {/* Progress */}
        <div className="h-1 bg-bg-soft">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
        </div>

        {/* Body */}
        <div className="p-8 sm:p-10 min-h-[440px] flex flex-col">
          {step === 'welcome' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-accent text-white flex items-center justify-center mb-5 shadow-lift">
                <Sparkles className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold text-text">Добро пожаловать в THEDAD</h1>
              <p className="text-text-muted mt-3 max-w-md leading-relaxed">
                Планер целей с прогнозом результата. Всё хранится локально на вашем устройстве — данные ваши.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-8 w-full max-w-md text-xs">
                {[
                  { icon: Target, label: 'Цели и подцели' },
                  { icon: Zap, label: 'Pomodoro и фокус' },
                  { icon: BarChart3, label: 'Прогнозы и аналитика' },
                ].map((f) => (
                  <div key={f.label} className="rounded-xl border border-border-soft p-3 text-center">
                    <div className="h-8 w-8 mx-auto mb-1.5 rounded-lg bg-accent/12 text-accent flex items-center justify-center">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <div className="text-text-muted">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'theme' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h2 className="text-2xl font-bold text-text">Выбери стиль</h2>
              <p className="text-text-muted mt-2 text-sm">Как THEDAD будет выглядеть каждый день.</p>
              <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-md">
                <button
                  onClick={() => applyTheme('light')}
                  className={`rounded-xl border-2 p-3 transition-all hover:scale-[1.02] ${theme === 'light' ? 'border-accent' : 'border-border'}`}
                >
                  <div className="h-24 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-2 space-y-1.5 text-left">
                    <div className="h-2 w-1/2 rounded bg-[#6366f1]" />
                    <div className="h-8 rounded bg-white border border-[#e2e8f0]" />
                    <div className="h-8 rounded bg-white border border-[#e2e8f0]" />
                  </div>
                  <div className="text-sm font-semibold text-text mt-2.5">Minimalism</div>
                  <div className="text-[11px] text-text-muted">Чистый светлый интерфейс</div>
                </button>
                <button
                  onClick={() => applyTheme('glass')}
                  className={`rounded-xl border-2 p-3 transition-all hover:scale-[1.02] ${theme === 'glass' ? 'border-accent' : 'border-border'}`}
                >
                  <div
                    className="h-24 rounded-lg p-2 space-y-1.5 text-left bg-cover bg-center"
                    style={{ backgroundImage: "url('/wallpapers/1.jpg')" }}
                  >
                    <div className="h-2 w-1/2 rounded bg-white/80" />
                    <div className="h-8 rounded bg-black/35 backdrop-blur-sm border border-white/15" />
                    <div className="h-8 rounded bg-black/35 backdrop-blur-sm border border-white/15" />
                  </div>
                  <div className="text-sm font-semibold text-text mt-2.5">Glass</div>
                  <div className="text-[11px] text-text-muted">Обои и стеклянные панели</div>
                </button>
              </div>
              <p className="text-[11px] text-text-dim mt-5">Тему всегда можно изменить в Настройках → Внешний вид.</p>
            </div>
          )}

          {step === 'name' && (
            <div className="flex-1 flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-text">Как к вам обращаться?</h2>
              <p className="text-text-muted mt-2">Имя будет в приветствии и отчётах.</p>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="mt-6 text-lg h-12"
                onKeyDown={(e) => e.key === 'Enter' && next()}
              />
            </div>
          )}

          {step === 'categories' && (
            <div className="flex-1 flex flex-col">
              <Target className="h-6 w-6 text-accent mb-3" />
              <h2 className="text-2xl font-bold text-text">На каких сферах сфокусируетесь?</h2>
              <p className="text-text-muted mt-2">Выберите 1–3. Под каждую создадим шаблонную цель — её можно отредактировать.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                {CATEGORIES.map((c) => {
                  const active = chosen.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setChosen((cur) => {
                          if (cur.includes(c.id)) return cur.filter((x) => x !== c.id);
                          if (cur.length >= 3) return cur;
                          return [...cur, c.id];
                        });
                      }}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        active
                          ? 'border-accent bg-accent/10 shadow-soft'
                          : 'border-border-soft hover:border-border'
                      }`}
                    >
                      <div className="text-2xl">{c.icon}</div>
                      <div className="text-sm font-semibold text-text mt-1">{c.label}</div>
                      <div className="text-[11px] text-text-muted truncate mt-0.5">{c.sample.title}</div>
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-text-muted mt-4">Выбрано: {chosen.length} / 3</div>
            </div>
          )}

          {step === 'notifications' && (
            <div className="flex-1 flex flex-col justify-center">
              <Bell className="h-6 w-6 text-accent mb-3" />
              <h2 className="text-2xl font-bold text-text">Утренний и вечерний пульс</h2>
              <p className="text-text-muted mt-2 leading-relaxed">
                Утром в 08:00 — топ-3 задач дня. Вечером в 21:00 — напоминание о рефлексии. Без серверов, без слежки.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button variant="default" onClick={enableHeartbeat} disabled={busy}>
                  Разрешить уведомления
                </Button>
                <Button variant="soft" onClick={next} disabled={busy}>
                  Пропустить
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-accent/15 text-accent flex items-center justify-center mb-5">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="text-2xl font-bold text-text">Готово, {name || 'друг'}!</h2>
              <p className="text-text-muted mt-3 max-w-md">
                Начните с быстрого добавления (Ctrl+K) или нажмите «Focus Mode» в шапке, когда нужно сосредоточиться.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 sm:px-10 py-4 border-t border-border-soft bg-bg-soft/40">
          <Button variant="ghost" onClick={prev} disabled={stepIdx === 0 || busy}>
            <ChevronLeft className="h-4 w-4" /> Назад
          </Button>
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 w-1.5 rounded-full ${i === stepIdx ? 'bg-accent' : 'bg-border'}`} />
            ))}
          </div>
          {step === 'done' ? (
            <Button onClick={finish} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Начать
            </Button>
          ) : step === 'notifications' ? (
            <span />
          ) : (
            <Button onClick={next} disabled={step === 'name' && !name.trim()}>
              Далее <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
