import { useEffect, useMemo, useState } from 'react';
import {
  Puzzle, Flame, Star, Heart, Dumbbell, Book, CheckCircle2, ListTodo, Activity,
  Target, CalendarDays, Repeat, Timer, Trophy, Sparkles, Moon, Sun, Droplets, Brain,
  SlidersHorizontal,
} from 'lucide-react';
import { MealPlanner } from '@/components/MealPlanner';
import { RecipeModal } from '@/components/dashboard/RecipeModal';
import { isEaten, toggleEaten, NUTRITION_EVENT } from '@/lib/nutrition';
import { toast } from '@/lib/toast';
import { isoDate } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { getChartColors } from '@/lib/chart-theme';
import { Ring } from '@/components/ui/ring';
import { ECharts } from '@/components/charts/ECharts';
import { fmtNum } from '@/lib/utils';
import {
  selectRows, totalValue, renderTemplate, menuDay,
  type PluginWidgetDef, type PluginDataSnapshot, type PluginRow,
} from '@/lib/plugins';

/** Белый список иконок для плагинов (icon: имя строчными). */
export const PLUGIN_ICONS: Record<string, React.ElementType> = {
  puzzle: Puzzle, flame: Flame, star: Star, heart: Heart, dumbbell: Dumbbell,
  book: Book, check: CheckCircle2, list: ListTodo, activity: Activity,
  target: Target, calendar: CalendarDays, repeat: Repeat, timer: Timer,
  trophy: Trophy, sparkles: Sparkles, moon: Moon, sun: Sun, drop: Droplets, brain: Brain,
};

const RANGE_LABEL: Record<string, string> = {
  'today': 'сегодня', 'last-7-days': '7 дней', 'last-30-days': '30 дней', 'last-90-days': '90 дней', 'all': 'всё время',
};

/** Эмодзи-заглушка для карточки без фото: по типу блюда, затем по приёму пищи. */
function foodEmoji(kind: string, meal: string): string {
  const k = kind.toLowerCase();
  if (k.includes('напит')) return '🥤';
  if (k.includes('десерт')) return '🍰';
  if (k.includes('снек') || k.includes('перекус')) return '🥜';
  if (k.includes('салат')) return '🥗';
  if (k.includes('гарнир')) return '🍚';
  const m = meal.toLowerCase();
  if (m.includes('завтрак')) return '🍳';
  if (m.includes('обед')) return '🍲';
  if (m.includes('ужин')) return '🍽';
  return '🍴';
}

/** Карточка контентного плагина: картинка + краткое описание. Клик открывает
 *  полноценную страницу рецепта (RecipeModal). Для дневного меню — ккал и отметка «съел». */
const ContentCard: React.FC<{ def: PluginWidgetDef; row: PluginRow }> = ({ def, row }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const r = def.render;
  const title = row.label;
  const badge = r.badge ? renderTemplate(r.badge, row.raw) : '';
  const text = r.text ? renderTemplate(r.text, row.raw) : '';
  const detail = r.detail ? renderTemplate(r.detail, row.raw) : '';
  const kind = typeof row.raw.kind === 'string' ? row.raw.kind : '';
  const kcal = Number(row.raw.kcal) || 0;
  const imgRaw = r.image ? row.raw[r.image] : null;
  const img = typeof imgRaw === 'string' && imgRaw.startsWith('/') && !imgRaw.startsWith('//') ? imgRaw : null;
  // Есть что показывать в развороте (рецепт/описание) — карточка кликабельна
  const openable = !!detail || !!text;

  // «съел»: только для дневного меню (dayField) — ключ стабилен в рамках плана
  const today = isoDate(new Date());
  const eatKey = `${badge}¦${title}`;
  const trackable = !!r.dayField && !!def.source.static;
  const [eaten, setEaten] = useState(() => trackable && isEaten(today, eatKey));
  useEffect(() => {
    if (!trackable) return;
    const sync = () => setEaten(isEaten(today, eatKey));
    window.addEventListener(NUTRITION_EVENT, sync);
    return () => window.removeEventListener(NUTRITION_EVENT, sync);
  }, [trackable, today, eatKey]);

  const onToggleEaten = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleEaten(today, { key: eatKey, title, kcal, meal: badge });
    if (!eaten) toast.success(`Учтено: ${title}`, kcal ? `+${kcal} ккал` : undefined);
  };

  return (
    <>
      <button
        onClick={() => openable && setRecipeOpen(true)}
        className={`group/card relative flex flex-col text-left rounded-xl border overflow-hidden bg-bg-soft/60 hover:border-accent/40 transition-colors h-full min-h-[150px] ${eaten ? 'border-accent/50' : 'border-border-soft'}`}
        title={openable ? 'Открыть рецепт' : undefined}
      >
        {/* Картинка/заглушка растёт по высоте карточки — заполняем пустоту в высоком виджете */}
        <div className={`relative flex-1 min-h-[80px] bg-gradient-to-br from-accent/15 to-accent/5 ${eaten ? 'opacity-60' : ''}`}>
          {img && !imgFailed ? (
            <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-3xl opacity-70">{foodEmoji(kind, badge)}</div>
          )}
          {badge && (
            <span className="absolute top-1.5 left-1.5 rounded-full bg-black/45 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-white">{badge}{kind && kind !== 'Основное' ? ` · ${kind}` : ''}</span>
          )}
          {kcal > 0 && (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums">{kcal} ккал</span>
          )}
        </div>
        <div className="shrink-0 p-2.5">
          <div className={`text-[13px] font-semibold leading-snug ${eaten ? 'text-text-muted line-through' : 'text-text'}`}>{title}</div>
          {text && <p className="text-[11px] text-text-muted leading-snug mt-1 line-clamp-2">{text}</p>}
        </div>
        {openable && <div className="px-2.5 pb-2 text-[10px] text-text-dim opacity-0 group-hover/card:opacity-100 transition-opacity">Рецепт — по клику</div>}

        {/* Отметка «съел» — считается в калории дня */}
        {trackable && (
          <span
            onClick={onToggleEaten}
            role="button"
            className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
              eaten ? 'bg-accent border-accent text-white' : 'bg-black/30 border-white/40 text-white/60 hover:text-white'
            }`}
            title={eaten ? 'Убрать из съеденного' : 'Съел — учесть калории'}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {recipeOpen && <RecipeModal def={def} row={row} onClose={() => setRecipeOpen(false)} />}
    </>
  );
};

/** Рендер декларативного плагина существующими примитивами. Данные — read-only из стора. */
export const PluginWidget: React.FC<{ def: PluginWidgetDef }> = ({ def }) => {
  const { goals, tasks, habits, habitLogs, healthLogs, progress, reflections, timeEntries } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark' || theme === 'glass');

  const rows = useMemo(() => {
    const snapshot = {
      goals, tasks, habits, habitLogs, healthLogs, progress, reflections, timeEntries,
    } as unknown as PluginDataSnapshot;
    return selectRows(def, snapshot);
  }, [def, goals, tasks, habits, habitLogs, healthLogs, progress, reflections, timeEntries]);

  const total = totalValue(def, rows);
  const Icon = PLUGIN_ICONS[def.icon ?? ''] ?? Puzzle;
  const r = def.render;
  // Планер рациона доступен контентным «дневным» плагинам (карточки + static + dayField)
  const plannable = r.type === 'cards' && !!def.source.static && !!r.dayField;
  const [plannerOpen, setPlannerOpen] = useState(false);

  // Подпись в шапке: для данных из стора — период, для контентных — «День N»
  const headerHint = def.source.static
    ? (r.dayField
      ? `День ${menuDay(def.source.static.reduce((m, x) => Math.max(m, Number(x[r.dayField!]) || 0), 0), def.id)}`
      : '')
    : RANGE_LABEL[def.source.range ?? 'last-30-days'];

  const body = () => {
    switch (r.type) {
      case 'stat':
        return (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{fmtNum(total, 1)}</div>
            {r.max != null && <div className="text-xs text-text-muted mt-1">из {fmtNum(r.max, 0)}</div>}
          </div>
        );
      case 'ring': {
        const pct = Math.round((total / (r.max ?? 100)) * 100);
        return (
          <div className="flex-1 flex items-center justify-center">
            <Ring value={pct} size={110} stroke={10} trackColor="var(--border-soft)">
              <div className="text-center">
                <div className="text-lg font-semibold tabular-nums">{fmtNum(total, 1)}</div>
                <div className="text-[10px] text-text-muted">{pct}%</div>
              </div>
            </Ring>
          </div>
        );
      }
      case 'list':
        return (
          <ul className="flex-1 overflow-auto space-y-1.5 text-sm">
            {rows.length === 0 && <li className="text-xs text-text-dim">Нет данных за период</li>}
            {rows.slice(0, 30).map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex-1 truncate">{row.label || '—'}</span>
                {r.value && r.value !== 'count' && <span className="text-text-muted tabular-nums text-xs">{fmtNum(row.value, 1)}</span>}
              </li>
            ))}
          </ul>
        );
      case 'bar':
      case 'line':
        return (
          <div className="flex-1 min-h-0">
            <ECharts
              height="100%"
              option={{
                grid: { left: 34, right: 8, top: 10, bottom: 22 },
                xAxis: {
                  type: 'category', data: rows.map((x) => x.label),
                  axisLine: { lineStyle: { color: cc.axisLine } },
                  axisLabel: { color: cc.axis, fontSize: 10, hideOverlap: true, formatter: (v: string) => (v.length > 5 ? v.slice(5) : v) },
                },
                yAxis: {
                  type: 'value',
                  axisLine: { show: false }, axisTick: { show: false },
                  splitLine: { lineStyle: { color: cc.splitLine } },
                  axisLabel: { color: cc.axis, fontSize: 10 },
                },
                tooltip: { trigger: 'axis' },
                series: [{
                  type: r.type,
                  data: rows.map((x) => x.value),
                  ...(r.type === 'bar'
                    ? { barMaxWidth: 18, itemStyle: { color: 'var(--accent)' } }
                    : { smooth: true, showSymbol: false, lineStyle: { color: 'var(--accent)', width: 2 }, itemStyle: { color: 'var(--accent)' } }),
                }],
              }}
            />
          </div>
        );
      case 'cards': {
        const list = rows.slice(0, 12);
        // Дневное меню (обычно 3 карточки) растягиваем на всю высоту — без пустот
        const fill = list.length > 0 && list.length <= 3;
        return (
          <div className="flex-1 min-h-0 overflow-auto">
            <div className={`grid gap-2 ${fill ? 'grid-cols-1 sm:grid-cols-3 h-full auto-rows-fr' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
              {list.length === 0 && <div className="text-xs text-text-dim col-span-full">Нет карточек</div>}
              {list.map((row, i) => <ContentCard key={i} def={def} row={row} />)}
            </div>
          </div>
        );
      }
      case 'table':
        return (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  {r.columns!.map((c) => <th key={c} className="py-1 pr-2 font-medium">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-t border-border-soft">
                    {r.columns!.map((c) => (
                      <td key={c} className="py-1 pr-2 truncate max-w-[160px]">{renderTemplate(`{{${c}}}`, row.raw)}</td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={r.columns!.length} className="py-2 text-text-dim">Нет данных за период</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border-soft shadow-card p-4 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Icon className="h-4 w-4 text-accent shrink-0" />
        {plannable ? (
          /* Клик по заголовку — полноценное окно конструктора рациона */
          <button
            onClick={() => setPlannerOpen(true)}
            className="min-w-0 flex-1 flex items-center gap-1.5 text-left group/hdr"
            title="Открыть конструктор рациона"
          >
            <span className="text-sm font-semibold text-text truncate group-hover/hdr:text-accent transition-colors">{def.name}</span>
            <SlidersHorizontal className="h-3.5 w-3.5 text-text-dim group-hover/hdr:text-accent transition-colors shrink-0" />
          </button>
        ) : (
          <span className="text-sm font-semibold text-text truncate flex-1">{def.name}</span>
        )}
        <span className="text-[10px] text-text-dim shrink-0" title={`Плагин${def.author ? ` · ${def.author}` : ''}`}>
          {headerHint}
        </span>
      </div>
      {body()}
      {plannable && <MealPlanner def={def} open={plannerOpen} onClose={() => setPlannerOpen(false)} />}
    </div>
  );
};
