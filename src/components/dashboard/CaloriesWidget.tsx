import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRef } from 'react';
import { X, Flame, Plus, Trash2, UtensilsCrossed, Maximize2, Target, Check, ImagePlus, Utensils, Download, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { getChartColors } from '@/lib/chart-theme';
import { Ring } from '@/components/ui/ring';
import { ECharts } from '@/components/charts/ECharts';
import { isoDate, fmtNum } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompress';
import { toast } from '@/lib/toast';
import {
  getEaten, toggleEaten, isEaten, addCustomEaten, removeEaten, eatenKcal, eatenMacros,
  getKcalGoal, setKcalGoal, NUTRITION_EVENT, type EatenItem,
  getFoods, addFood, removeFood, eatFood, exportFoods, importFoods, type CustomFood,
} from '@/lib/nutrition';
import { burnedKcal, ACTIVITY_EVENT } from '@/lib/activity';
import {
  resolveWeight, PROFILE_EVENT, computeBMR, hasBmrProfile,
  getSex, setSex, getAge, setAge, getHeight, setHeight, getProfileWeight, setProfileWeight, type Sex,
} from '@/lib/profile';
import { getInstalledPlugins, selectRows, renderTemplate, PLUGINS_EVENT, type PluginWidgetDef, type PluginDataSnapshot } from '@/lib/plugins';

/** Сегодняшнее меню из плагина питания (первый контентный «дневной» плагин). */
function todayMenu(): { def: PluginWidgetDef | null; items: { key: string; title: string; kcal: number; meal: string; kind: string }[] } {
  const def = getInstalledPlugins().find((p) => p.render.type === 'cards' && p.source.static && p.render.dayField) ?? null;
  if (!def) return { def: null, items: [] };
  const rows = selectRows(def, {} as PluginDataSnapshot);
  const badgeTpl = def.render.badge ?? '';
  return {
    def,
    items: rows.map((r) => {
      const meal = badgeTpl ? renderTemplate(badgeTpl, r.raw) : '';
      return {
        key: `${meal}¦${r.label}`,
        title: r.label,
        kcal: Number(r.raw.kcal) || 0,
        meal,
        kind: typeof r.raw.kind === 'string' ? r.raw.kind : '',
      };
    }),
  };
}

/** Тик пересчёта: любые изменения еды/активности/плагинов. */
function useNutritionTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(NUTRITION_EVENT, bump);
    window.addEventListener(ACTIVITY_EVENT, bump);
    window.addEventListener(PLUGINS_EVENT, bump);
    window.addEventListener(PROFILE_EVENT, bump);
    return () => {
      window.removeEventListener(NUTRITION_EVENT, bump);
      window.removeEventListener(ACTIVITY_EVENT, bump);
      window.removeEventListener(PLUGINS_EVENT, bump);
      window.removeEventListener(PROFILE_EVENT, bump);
    };
  }, []);
  return tick;
}

/* ==================== Развёрнутое меню (iOS-стиль) ==================== */

const CaloriesExpand: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { healthLogs, goals } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark' || theme === 'glass');
  const tick = useNutritionTick();
  const today = isoDate(new Date());
  const [addTitle, setAddTitle] = useState('');
  const [addKcal, setAddKcal] = useState('');
  const [goalEdit, setGoalEdit] = useState('');
  // форма своего продукта
  const [profileOpen, setProfileOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fKcal, setFKcal] = useState('');
  const [fP, setFP] = useState('');
  const [fF, setFF] = useState('');
  const [fC, setFC] = useState('');
  const [fImg, setFImg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { items } = useMemo(() => todayMenu(), [tick, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const eatenList = getEaten(today);
  const eaten = eatenKcal(today);
  const macros = eatenMacros(today);
  const foods = getFoods();
  const goal = getKcalGoal();
  const steps = healthLogs.find((l) => l.date === today && l.metric === 'steps')?.value ?? 0;
  const weight = resolveWeight(healthLogs);
  const burned = burnedKcal(today, steps, weight);
  const bmr = computeBMR(weight);
  const totalBurn = bmr + burned.total;        // покой + активность
  const balance = eaten - totalBurn;
  const maintenance = bmr > 0 ? Math.round(bmr * 1.4) : 0; // TDEE при лёгкой активности

  // Баланс за последние 7 дней (съедено − покой − активность)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weekData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = isoDate(new Date(Date.now() - (6 - i) * 86400000));
    const st = healthLogs.find((l) => l.date === d && l.metric === 'steps')?.value ?? 0;
    const balance = Math.round(eatenKcal(d) - (bmr + burnedKcal(d, st, weight).total));
    return { label: d.slice(5), balance };
  }), [tick, open, healthLogs, weight, bmr]);
  const weekHasData = weekData.some((x) => x.balance !== 0);

  // связь с целями: похудение (кг, цель ниже старта) и цель по калориям
  const weightGoal = goals.find((g) => g.status === 'active' && (g.unit ?? '').toLowerCase().includes('кг') && g.target_value < g.start_value);
  const kcalGoalLinked = goals.find((g) => g.status === 'active' && g.health_metric === 'calories');

  if (!open) return null;

  // Мутации питания шлют NUTRITION_EVENT → useHealthSync сводит итог в healthLogs
  const meals = [...new Set(items.map((x) => x.meal))];
  const customToday = eatenList.filter((x) => x.custom);

  const quickAdd = () => {
    const kcal = Math.round(Number(addKcal) || 0);
    if (!addTitle.trim() || kcal <= 0) return;
    addCustomEaten(today, addTitle, kcal);
    setAddTitle(''); setAddKcal('');
  };

  const uploadFoodImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setFImg(await compressImage(file, 480, 0.7)); } catch {}
  };

  const saveFood = () => {
    const kcal = Math.round(Number(fKcal) || 0);
    if (!fTitle.trim() || kcal <= 0) return;
    addFood({ title: fTitle, kcal, protein: Number(fP) || 0, fat: Number(fF) || 0, carbs: Number(fC) || 0, image: fImg || undefined });
    setFTitle(''); setFKcal(''); setFP(''); setFF(''); setFC(''); setFImg('');
    setFoodOpen(false);
  };

  const importFoodsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const added = importFoods(JSON.parse(await file.text()));
      if (added > 0) toast.success(`Добавлено продуктов: ${added}`);
      else toast.info('Новых продуктов нет — всё уже в библиотеке');
    } catch (err) {
      toast.error('Не удалось импортировать', err instanceof Error ? err.message : undefined);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-start justify-center p-2 sm:p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[94vh] rounded-2xl bg-bg border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-soft shrink-0">
          <Flame className="h-4 w-4 text-accent" />
          <div className="text-sm font-semibold text-text flex-1">Калории сегодня</div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text" title="Закрыть (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Кольцо и сводка */}
          <div className="flex items-center gap-6">
            <Ring value={goal ? Math.min(100, (eaten / goal) * 100) : 0} size={130} stroke={12} trackColor="var(--border-soft)"
              glow={false} color={eaten > goal ? '#ef4444' : 'var(--accent)'}>
              <div className="text-center leading-tight">
                <div className="text-xl font-bold tabular-nums">{fmtNum(eaten, 0)}</div>
                <div className="text-[10px] text-text-muted">из {fmtNum(goal, 0)}</div>
              </div>
            </Ring>
            <div className="flex-1 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Съедено</span><b className="tabular-nums">{fmtNum(eaten, 0)} ккал</b></div>
              {bmr > 0 && <div className="flex justify-between"><span className="text-text-muted">Покой (BMR)</span><b className="tabular-nums text-accent">−{fmtNum(bmr, 0)} ккал</b></div>}
              <div className="flex justify-between"><span className="text-text-muted">Активность</span><b className="tabular-nums text-accent">−{fmtNum(burned.total, 0)} ккал</b></div>
              <div className="flex justify-between border-t border-border-soft pt-1.5">
                <span className="text-text-muted">Баланс дня</span>
                <b className={`tabular-nums ${balance > 0 ? 'text-text' : 'text-accent'}`}>{balance > 0 ? '+' : ''}{fmtNum(balance, 0)} ккал</b>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-text-muted">Цель:</span>
                <input
                  value={goalEdit || String(goal)}
                  onChange={(e) => setGoalEdit(e.target.value)}
                  onBlur={() => { const v = Number(goalEdit); if (v > 0) setKcalGoal(v); setGoalEdit(''); }}
                  inputMode="numeric"
                  className="w-20 h-7 rounded-lg bg-bg-soft border border-border-soft px-2 text-xs tabular-nums outline-none focus:border-border"
                />
                <span className="text-xs text-text-dim">ккал/день</span>
              </div>
            </div>
          </div>

          {/* БЖУ за день (по позициям, где макросы известны) */}
          {(macros.protein > 0 || macros.fat > 0 || macros.carbs > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {([['Белки', macros.protein, '#22c55e'], ['Жиры', macros.fat, '#f59e0b'], ['Углеводы', macros.carbs, '#6366f1']] as const).map(([l, v, c]) => (
                <div key={l} className="rounded-xl border border-border-soft p-2.5 text-center">
                  <div className="text-lg font-bold tabular-nums" style={{ color: c }}>{fmtNum(v, 0)}<span className="text-[10px] text-text-dim ml-0.5">г</span></div>
                  <div className="text-[10px] text-text-muted">{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Недельный тренд баланса */}
          {weekHasData && (
            <div>
              <div className="section-label">Баланс за неделю</div>
              <div className="rounded-xl border border-border-soft p-2">
                <ECharts
                  height={140}
                  option={{
                    grid: { left: 38, right: 8, top: 10, bottom: 22 },
                    xAxis: {
                      type: 'category', data: weekData.map((x) => x.label),
                      axisLine: { lineStyle: { color: cc.axisLine } },
                      axisLabel: { color: cc.axis, fontSize: 10 },
                    },
                    yAxis: {
                      type: 'value',
                      axisLine: { show: false }, axisTick: { show: false },
                      splitLine: { lineStyle: { color: cc.splitLine } },
                      axisLabel: { color: cc.axis, fontSize: 10 },
                    },
                    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v > 0 ? '+' : ''}${v} ккал` },
                    series: [{
                      type: 'bar', barMaxWidth: 22,
                      data: weekData.map((x) => ({
                        value: x.balance,
                        // дефицит (≤0) — зелёный, профицит (>0) — красный
                        itemStyle: { color: x.balance <= 0 ? '#22c55e' : '#ef4444', borderRadius: [3, 3, 0, 0] },
                      })),
                    }],
                  }}
                />
              </div>
              <p className="text-[10px] text-text-dim mt-1">Зелёный — дефицит (минус к весу), красный — профицит. Данные накапливаются день за днём.</p>
            </div>
          )}

          {/* Профиль для точного расчёта: пол, возраст, рост, вес → BMR */}
          <div className="rounded-xl border border-border-soft p-3">
            <button onClick={() => setProfileOpen((v) => !v)} className="w-full flex items-center justify-between text-sm">
              <span className="font-medium text-text">Профиль и точный расчёт</span>
              <span className="text-xs text-text-muted">{hasBmrProfile() ? `BMR ${fmtNum(bmr, 0)} ккал` : 'заполни для точности'}</span>
            </button>
            {profileOpen && (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex rounded-lg border border-border-soft overflow-hidden">
                    {(['male', 'female'] as Sex[]).map((s) => (
                      <button key={s} onClick={() => setSex(s)}
                        className={`flex-1 h-8 text-xs transition-colors ${getSex() === s ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover'}`}>
                        {s === 'male' ? 'Муж' : 'Жен'}
                      </button>
                    ))}
                  </div>
                  <input defaultValue={getAge() ?? ''} onBlur={(e) => { const v = Number(e.target.value); if (v > 0) setAge(v); }}
                    placeholder="Возраст" inputMode="numeric"
                    className="h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs tabular-nums outline-none focus:border-border" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input defaultValue={getHeight() ?? ''} onBlur={(e) => { const v = Number(e.target.value); if (v > 0) setHeight(v); }}
                    placeholder="Рост, см" inputMode="numeric"
                    className="h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs tabular-nums outline-none focus:border-border" />
                  <input defaultValue={getProfileWeight()} onBlur={(e) => { const v = Number(e.target.value); if (v > 0) setProfileWeight(v); }}
                    placeholder="Вес, кг" inputMode="numeric"
                    className="h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs tabular-nums outline-none focus:border-border" />
                </div>
                {bmr > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-text-muted flex-1">Поддержание ≈ {fmtNum(maintenance, 0)} ккал</span>
                    <button onClick={() => setKcalGoal(maintenance)} className="h-7 px-2.5 rounded-lg bg-bg-soft hover:bg-bg-hover text-[11px] transition-colors">Поддержание</button>
                    <button onClick={() => setKcalGoal(Math.max(1000, maintenance - 500))} className="h-7 px-2.5 rounded-lg bg-accent/10 text-accent text-[11px] font-semibold hover:bg-accent/20 transition-colors">−500 (похудение)</button>
                  </div>
                )}
                <p className="text-[10px] text-text-dim leading-relaxed">Вес берётся из последней записи в «Здоровье», если она есть. BMR — базовый метаболизм (Миффлин-Сан-Жеор): калории, которые тело тратит в покое.</p>
              </div>
            )}
          </div>

          {/* Связь с целями */}
          {(weightGoal || kcalGoalLinked) && (
            <div className="rounded-xl bg-accent/5 border border-accent/20 p-3 text-xs text-text-muted flex items-start gap-2">
              <Target className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div className="space-y-1">
                {weightGoal && (
                  <div>
                    Цель «<b className="text-text">{weightGoal.title}</b>»: {balance < 0
                      ? <span className="text-accent">дефицит {fmtNum(-balance, 0)} ккал — работаешь на снижение веса.</span>
                      : <span>профицит {fmtNum(balance, 0)} ккал — для снижения веса нужен дефицит.</span>}
                  </div>
                )}
                {kcalGoalLinked && <div>Итог дня автоматически идёт в цель «<b className="text-text">{kcalGoalLinked.title}</b>».</div>}
              </div>
            </div>
          )}

          {/* Меню дня по приёмам */}
          {meals.map((meal) => (
            <div key={meal}>
              <div className="section-label">{meal || 'Меню'}</div>
              <div className="space-y-1.5">
                {items.filter((x) => x.meal === meal).map((x) => {
                  const on = isEaten(today, x.key);
                  return (
                    <button
                      key={x.key}
                      onClick={() => toggleEaten(today, { key: x.key, title: x.title, kcal: x.kcal, meal: x.meal })}
                      className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                        on ? 'border-accent/40 bg-accent/5' : 'border-border-soft hover:border-border'
                      }`}
                    >
                      <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-accent border-accent text-white' : 'border-border'}`}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className={`flex-1 min-w-0 text-sm truncate ${on ? 'text-text-muted line-through' : 'text-text'}`}>{x.title}</span>
                      {x.kind && x.kind !== 'Основное' && <span className="text-[10px] text-text-dim shrink-0">{x.kind}</span>}
                      <span className="text-xs text-text-muted tabular-nums shrink-0">{x.kcal} ккал</span>
                    </button>
                  );
                })}
                {items.filter((x) => x.meal === meal).length === 0 && (
                  <div className="text-xs text-text-dim">Пусто — настрой рацион в виджете питания</div>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-sm text-text-dim flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" /> План питания не найден — установи виджет «Правильное питание».</div>
          )}

          {/* Мои продукты — личная библиотека с фото и БЖУ */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="section-label mb-0">Мои продукты</div>
              <div className="flex items-center gap-3">
                {foods.length > 0 && (
                  <button onClick={exportFoods} className="text-xs text-text-muted flex items-center gap-1 hover:text-text" title="Выгрузить .json">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => importRef.current?.click()} className="text-xs text-text-muted flex items-center gap-1 hover:text-text" title="Импорт из .json">
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setFoodOpen((v) => !v)} className="text-xs text-accent flex items-center gap-1 hover:opacity-80">
                  <Plus className="h-3.5 w-3.5" /> добавить
                </button>
                <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={importFoodsFile} />
              </div>
            </div>

            {foodOpen && (
              <div className="rounded-xl border border-border-soft p-3 space-y-2 mb-2">
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()} className="h-14 w-14 rounded-lg bg-bg-soft border border-border-soft flex items-center justify-center overflow-hidden shrink-0 hover:border-border" title="Фото продукта">
                    {fImg ? <img src={fImg} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-text-dim" />}
                  </button>
                  <div className="flex-1 space-y-2">
                    <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Название продукта"
                      className="w-full h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs outline-none focus:border-border" />
                    <input value={fKcal} onChange={(e) => setFKcal(e.target.value)} placeholder="ккal (на порцию)" inputMode="numeric"
                      className="w-full h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs tabular-nums outline-none focus:border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input value={fP} onChange={(e) => setFP(e.target.value)} placeholder="Б, г" inputMode="decimal"
                    className="h-8 rounded-lg bg-bg-soft border border-border-soft px-2 text-xs tabular-nums outline-none focus:border-border" />
                  <input value={fF} onChange={(e) => setFF(e.target.value)} placeholder="Ж, г" inputMode="decimal"
                    className="h-8 rounded-lg bg-bg-soft border border-border-soft px-2 text-xs tabular-nums outline-none focus:border-border" />
                  <input value={fC} onChange={(e) => setFC(e.target.value)} placeholder="У, г" inputMode="decimal"
                    className="h-8 rounded-lg bg-bg-soft border border-border-soft px-2 text-xs tabular-nums outline-none focus:border-border" />
                </div>
                <button onClick={saveFood} className="w-full h-8 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90">Сохранить в библиотеку</button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadFoodImg} />
              </div>
            )}

            <div className="space-y-1.5 mb-4">
              {foods.length === 0 && !foodOpen && <div className="text-xs text-text-dim">Пока пусто. Добавь продукты, которые ешь часто — с фото и БЖУ.</div>}
              {foods.map((f: CustomFood) => (
                <div key={f.id} className="flex items-center gap-2.5 rounded-xl border border-border-soft p-2">
                  {f.image
                    ? <img src={f.image} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                    : <span className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0"><Utensils className="h-4 w-4 text-accent/60" /></span>}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text truncate">{f.title}</div>
                    <div className="text-[10px] text-text-dim tabular-nums">
                      {f.kcal} ккал{f.protein ? ` · Б ${f.protein}` : ''}{f.fat ? ` · Ж ${f.fat}` : ''}{f.carbs ? ` · У ${f.carbs}` : ''}
                    </div>
                  </div>
                  <button onClick={() => eatFood(today, f)} className="h-7 px-2.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 shrink-0" title="Съел — учесть">
                    Съел
                  </button>
                  <button onClick={() => removeFood(f.id)} className="text-text-dim hover:text-danger shrink-0" title="Удалить продукт">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Съедено вне плана */}
          <div>
            <div className="section-label">Вне плана</div>
            <div className="space-y-1.5">
              {customToday.map((x: EatenItem) => (
                <div key={x.key} className="flex items-center gap-3 rounded-xl border border-border-soft p-2.5">
                  <span className="flex-1 min-w-0 text-sm truncate">{x.title}</span>
                  <span className="text-xs text-text-muted tabular-nums shrink-0">{x.kcal} ккал</span>
                  <button onClick={() => removeEaten(today, x.key)} className="text-text-dim hover:text-danger shrink-0" title="Удалить">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Что ещё съел…"
                  onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
                  className="flex-1 h-9 rounded-xl bg-bg-soft border border-border-soft px-3 text-sm outline-none focus:border-border" />
                <input value={addKcal} onChange={(e) => setAddKcal(e.target.value)} placeholder="ккал" inputMode="numeric"
                  onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
                  className="w-20 h-9 rounded-xl bg-bg-soft border border-border-soft px-3 text-sm tabular-nums outline-none focus:border-border" />
                <button onClick={quickAdd} className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 shrink-0">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ==================== Виджет ==================== */

export const CaloriesWidget: React.FC = () => {
  const { healthLogs } = useStore();
  const tick = useNutritionTick();
  const [open, setOpen] = useState(false);
  const today = isoDate(new Date());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eaten = useMemo(() => eatenKcal(today), [tick, today]);
  const goal = getKcalGoal();
  const steps = healthLogs.find((l) => l.date === today && l.metric === 'steps')?.value ?? 0;
  const weight = resolveWeight(healthLogs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const burned = useMemo(() => burnedKcal(today, steps, weight), [tick, today, steps, weight]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bmr = useMemo(() => computeBMR(weight), [tick, weight]);
  const totalBurn = bmr + burned.total;
  const balance = eaten - totalBurn;
  const pct = goal ? Math.min(100, Math.round((eaten / goal) * 100)) : 0;

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border-soft shadow-card p-4 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 shrink-0">
        <Flame className="h-4 w-4 text-accent shrink-0" />
        <button onClick={() => setOpen(true)} className="min-w-0 flex-1 flex items-center gap-1.5 text-left group/hdr" title="Открыть меню дня">
          <span className="text-sm font-semibold text-text truncate group-hover/hdr:text-accent transition-colors">Калории сегодня</span>
          <Maximize2 className="h-3 w-3 text-text-dim group-hover/hdr:text-accent transition-colors shrink-0" />
        </button>
        <span className="text-[10px] text-text-dim tabular-nums shrink-0">{pct}%</span>
      </div>

      <div className="flex-1 flex items-center justify-center py-1">
        <Ring value={pct} size={116} stroke={11} trackColor="var(--border-soft)" glow={false} color={eaten > goal ? '#ef4444' : 'var(--accent)'}>
          <div className="text-center leading-tight">
            <div className="text-lg font-bold tabular-nums">{fmtNum(eaten, 0)}</div>
            <div className="text-[9px] text-text-muted">из {fmtNum(goal, 0)} ккал</div>
          </div>
        </Ring>
      </div>

      <div className="shrink-0 flex justify-between text-[11px] text-text-muted tabular-nums">
        <span>−{fmtNum(totalBurn, 0)} {bmr > 0 ? 'покой+актив' : 'активность'}</span>
        <span className={balance <= 0 ? 'text-accent font-semibold' : ''}>{balance > 0 ? '+' : ''}{fmtNum(balance, 0)} баланс</span>
      </div>

      <CaloriesExpand open={open} onClose={() => setOpen(false)} />
    </div>
  );
};
