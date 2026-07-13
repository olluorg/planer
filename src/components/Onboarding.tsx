import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Bell, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Zap, BarChart3, Calendar as CalendarIcon, HeartPulse, NotebookPen, Maximize2, Flame, Dumbbell, Activity } from 'lucide-react';
import { CATEGORIES, setOnboardingDone, setUserName, setUserCategories } from '@/lib/onboarding';
import { applyTheme, useTheme } from '@/lib/theme';
import { Logo } from '@/components/ui/logo';
import { useStore } from '@/lib/store';
import { requestPermission, setHeartbeatEnabled } from '@/lib/notifications';
import { setSex, setAge, setHeight, setProfileWeight, type Sex } from '@/lib/profile';

interface Props {
  open: boolean;
  onClose: () => void;
}

type StepId = 'welcome' | 'theme' | 'name' | 'categories' | 'cycle' | 'widgets' | 'health' | 'notifications' | 'done';

export const Onboarding: React.FC<Props> = ({ open, onClose }) => {
  const addGoal = useStore((s) => s.addGoal);
  const { theme } = useTheme();
  const [step, setStep] = useState<StepId>('welcome');
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Профиль для точного расчёта калорий (BMR с первого дня)
  const [sex, setSexState] = useState<Sex | null>(null);
  const [age, setAgeState] = useState('');
  const [height, setHeightState] = useState('');
  const [weight, setWeightState] = useState('');

  if (!open) return null;

  const steps: StepId[] = ['welcome', 'theme', 'name', 'categories', 'cycle', 'widgets', 'health', 'notifications', 'done'];
  const stepIdx = steps.indexOf(step);

  const saveProfile = () => {
    if (sex) setSex(sex);
    const a = Number(age); if (a > 0) setAge(a);
    const h = Number(height); if (h > 0) setHeight(h);
    const w = Number(weight); if (w > 0) setProfileWeight(w);
  };

  const next = () => {
    if (step === 'health') saveProfile();
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
              <Logo size={72} className="mb-5" />
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
                  {/* Мини-интерфейс: контрастная серая подложка + белые карточки с тенью,
                      график и кольцо — чтобы пример читался, а не выглядел «просто белым» */}
                  <div className="h-24 rounded-lg bg-[#e9edf4] border border-[#d4dbe6] p-2 flex gap-1.5 text-left overflow-hidden">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#6366f1]" />
                        <div className="h-2 w-1/2 rounded-full bg-[#94a3b8]" />
                      </div>
                      <div className="flex-1 rounded-md bg-white border border-[#dde3ee] shadow-sm p-1.5 flex flex-col gap-1">
                        <div className="h-1.5 w-4/5 rounded-full bg-[#6366f1]/70" />
                        <div className="h-1.5 w-3/5 rounded-full bg-[#b6c1d6]" />
                        <div className="h-1.5 w-2/3 rounded-full bg-[#d3dbe8]" />
                      </div>
                      {/* мини-график */}
                      <div className="h-5 rounded-md bg-white border border-[#dde3ee] shadow-sm flex items-end gap-0.5 px-1.5 pb-0.5">
                        {[40, 70, 55, 90, 65].map((h, i) => (
                          <div key={i} className="flex-1 rounded-sm bg-[#6366f1]" style={{ height: `${h}%`, opacity: 0.45 + i * 0.12 }} />
                        ))}
                      </div>
                    </div>
                    <div className="w-10 shrink-0 rounded-md bg-white border border-[#dde3ee] shadow-sm flex flex-col items-center justify-center gap-1">
                      <div className="h-6 w-6 rounded-full border-[3px] border-[#6366f1] border-r-[#e2e8f0] border-b-[#e2e8f0]" />
                      <div className="h-1 w-5 rounded-full bg-[#d3dbe8]" />
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-text mt-2.5">Minimalism</div>
                  <div className="text-[11px] text-text-muted">Чистый светлый интерфейс</div>
                </button>
                <button
                  onClick={() => applyTheme('glass')}
                  className={`rounded-xl border-2 p-3 transition-all hover:scale-[1.02] ${theme === 'glass' ? 'border-accent' : 'border-border'}`}
                >
                  {/* Тот же мини-интерфейс, но панели — матовое стекло поверх обоев */}
                  <div
                    className="h-24 rounded-lg p-2 flex gap-1.5 text-left overflow-hidden bg-cover bg-center"
                    style={{ backgroundImage: "url('/wallpapers/wp14.jpg')" }}
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="h-2 w-2/3 rounded-full bg-white/85" />
                      <div className="flex-1 rounded-md bg-white/15 backdrop-blur-sm border border-white/25 p-1 flex flex-col gap-1">
                        <div className="h-1.5 w-4/5 rounded-full bg-white/60" />
                        <div className="h-1.5 w-3/5 rounded-full bg-white/35" />
                      </div>
                      <div className="h-4 rounded-md bg-white/15 backdrop-blur-sm border border-white/25" />
                    </div>
                    <div className="w-9 shrink-0 rounded-md bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full border-[3px] border-white/85 border-r-white/25 border-b-white/25" />
                    </div>
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
              <p className="text-text-muted mt-2">Выберите 1–3 — под каждую создадим стартовую цель. Или <b className="text-text">пропустите</b>: начнёте с чистого листа и добавите всё сами (в том числе из Шаблонов).</p>
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

          {step === 'cycle' && (
            <div className="flex-1 flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-text text-center">Как это работает</h2>
              <p className="text-text-muted mt-2 text-sm text-center max-w-md mx-auto">THEDAD — не просто список дел, а замкнутый цикл жизни. Каждый шаг питает следующий.</p>
              <div className="mt-7 space-y-2.5 max-w-md mx-auto w-full">
                {[
                  { icon: Target, color: '#6366f1', title: 'Цели', body: 'Задаёшь направление и вехи' },
                  { icon: CalendarIcon, color: '#8b5cf6', title: 'План', body: 'Раскладываешь день по времени' },
                  { icon: Zap, color: '#f59e0b', title: 'Фокус', body: 'Действуешь — Focus Mode и привычки' },
                  { icon: HeartPulse, color: '#22c55e', title: 'Здоровье', body: 'Тело питает энергию для целей' },
                  { icon: NotebookPen, color: '#ec4899', title: 'Рефлексия', body: 'Смотришь итог — и цикл идёт заново' },
                ].map((s, i, arr) => (
                  <div key={s.title}>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}1f` }}>
                        <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text">{s.title}</div>
                        <div className="text-xs text-text-muted">{s.body}</div>
                      </div>
                    </div>
                    {i < arr.length - 1 && <div className="ml-[18px] my-0.5 h-3 w-px bg-border" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'widgets' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h2 className="text-2xl font-bold text-text">Виджеты раскрываются в страницы</h2>
              <p className="text-text-muted mt-2 text-sm max-w-md">
                Дашборд — это и есть навигация. Наведи на виджет и нажми
                <span className="inline-flex items-center justify-center h-5 w-5 mx-1 rounded bg-bg-soft border border-border-soft align-middle"><Maximize2 className="h-3 w-3 text-text-muted" /></span>
                в правом нижнем углу — виджет развернётся в полную страницу с подробным отчётом.
              </p>
              {/* Иллюстрация: виджет → разворот в страницу */}
              <div className="mt-7 flex items-center gap-3 w-full max-w-md justify-center">
                <div className="relative w-32 h-24 rounded-lg bg-bg-soft border border-border p-2 text-left shrink-0">
                  <div className="h-1.5 w-2/3 rounded-full bg-accent/60 mb-1.5" />
                  <div className="h-1.5 w-1/2 rounded-full bg-border mb-1" />
                  <div className="h-1.5 w-3/5 rounded-full bg-border" />
                  <div className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded bg-bg-card border border-border shadow-sm flex items-center justify-center">
                    <Maximize2 className="h-3 w-3 text-accent" />
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-text-dim shrink-0" />
                <div className="relative flex-1 h-32 rounded-lg bg-bg-soft border border-accent/40 p-2.5 text-left shadow-[0_8px_24px_rgba(99,102,241,0.12)]">
                  <div className="h-2 w-1/3 rounded-full bg-accent/70 mb-2" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="h-8 rounded bg-bg-card border border-border-soft" />
                    <div className="h-8 rounded bg-bg-card border border-border-soft" />
                    <div className="h-8 rounded bg-bg-card border border-border-soft col-span-2" />
                  </div>
                  <div className="text-[10px] text-text-dim mt-1.5">Полная страница: детали, отчёты, действия</div>
                </div>
              </div>
              <p className="text-[11px] text-text-dim mt-5">Состав дашборда меняется в редакторе раскладки — плитка «+» добавляет новые виджеты.</p>
            </div>
          )}

          {step === 'health' && (
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-5 w-5 text-accent" />
                <h2 className="text-2xl font-bold text-text">Здоровье и калории</h2>
              </div>
              <p className="text-text-muted mt-1 text-sm">
                Виджеты <b className="text-text">Калории</b>, <b className="text-text">Зарядка</b> и <b className="text-text">Активность</b> считают
                баланс дня и связывают его с целями. Заполни профиль — тогда расчёт будет точным с первого дня (можно пропустить).
              </p>

              <div className="grid grid-cols-3 gap-2 mt-5 mb-5 text-center text-[11px]">
                {[
                  { icon: Flame, label: 'Калории: съедено vs сожжено' },
                  { icon: Dumbbell, label: 'Зарядка: 7 минут в день' },
                  { icon: Activity, label: 'Активность: шаги + тренировки' },
                ].map((f) => (
                  <div key={f.label} className="rounded-xl border border-border-soft p-3">
                    <div className="h-8 w-8 mx-auto mb-1.5 rounded-lg bg-accent/12 text-accent flex items-center justify-center"><f.icon className="h-4 w-4" /></div>
                    <div className="text-text-muted leading-snug">{f.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 max-w-sm mx-auto w-full">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {(['male', 'female'] as Sex[]).map((s) => (
                      <button key={s} type="button" onClick={() => setSexState(s)}
                        className={`flex-1 h-10 text-sm transition-colors ${sex === s ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-soft'}`}>
                        {s === 'male' ? 'Мужчина' : 'Женщина'}
                      </button>
                    ))}
                  </div>
                  <Input value={age} onChange={(e) => setAgeState(e.target.value)} placeholder="Возраст" inputMode="numeric" className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={height} onChange={(e) => setHeightState(e.target.value)} placeholder="Рост, см" inputMode="numeric" className="h-10" />
                  <Input value={weight} onChange={(e) => setWeightState(e.target.value)} placeholder="Вес, кг" inputMode="numeric" className="h-10" />
                </div>
              </div>
              <p className="text-[11px] text-text-dim mt-4 text-center">Данные хранятся только на устройстве и нужны для формулы базового метаболизма (BMR).</p>
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
