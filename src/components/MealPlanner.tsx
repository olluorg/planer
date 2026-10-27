import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shuffle, Save, Check, Utensils, Plus, BookOpen } from 'lucide-react';
import { installPlugin, renderTemplate, type PluginWidgetDef } from '@/lib/plugins';
import { toast } from '@/lib/toast';
import { withDiningCollection, diningPreview, DINING_FILTERS, matchesDiningFilter, diningTotals, type DiningFilter } from '@/lib/diningCollection';
import { RecipeModal } from './dashboard/RecipeModal';
import type { PluginRow } from '@/lib/plugins';

/* Планер рациона для контентных плагинов (cards + static + dayField).
 * В одной ячейке (день × приём) может быть НЕСКОЛЬКО блюд: основное, гарнир,
 * десерт, напиток, снек — у каждого блюда два тега: meal (время дня) и kind (тип).
 * Блюда без day — библиотека: в виджет не попадают, пока не поставлены в план. */

type Row = Record<string, string | number | null>;

const tplField = (tpl?: string): string | null =>
  tpl?.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/)?.[1] ?? null;

const DISH_KINDS = ['Основное', 'Гарнир', 'Салат', 'Десерт', 'Напиток', 'Снек', 'Другое'];

/** Мини-картинка блюда с заглушкой. */
const Thumb: React.FC<{ src: string | null; size?: number }> = ({ src, size = 34 }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return !src || failed ? (
    <div className="rounded-lg bg-accent/10 flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <Utensils className="h-3.5 w-3.5 text-accent/60" />
    </div>
  ) : (
    <img src={diningPreview(src)} alt="" loading="lazy" className="rounded-lg object-contain bg-white shrink-0" style={{ width: size, height: size }} onError={() => setFailed(true)} />
  );
};

interface Props {
  def: PluginWidgetDef;
  open: boolean;
  onClose: () => void;
}

export const MealPlanner: React.FC<Props> = ({ def, open, onClose }) => {
  const dayField = def.render.dayField!;
  const badgeField = tplField(def.render.badge) ?? '';
  const labelTpl = def.render.label ?? '';
  const imageField = def.render.image ?? '';

  // Свои блюда, добавленные в этой сессии планера (вливаются в библиотеку и сохраняются)
  const [customDishes, setCustomDishes] = useState<Row[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [studioOnly, setStudioOnly] = useState(false);
  const [diningFilter, setDiningFilter] = useState<DiningFilter>('all');
  const [preview, setPreview] = useState<PluginRow | null>(null);

  // Библиотека уникальных блюд (включая блюда без day) и приёмы пищи.
  // daylessKeys — блюда «только из библиотеки» (напитки/десерты/свои): их сохраняем без day.
  const { library, meals, days, daylessKeys } = useMemo(() => {
    const lib = new Map<string, Row>();
    const mealList: string[] = [];
    const dayless = new Set<string>();
    let maxDay = 0;
    for (const row of withDiningCollection(def.id, [...(def.source.static ?? []), ...customDishes])) {
      const meal = badgeField ? String(row[badgeField] ?? '') : '';
      if (!mealList.includes(meal)) mealList.push(meal);
      const label = renderTemplate(labelTpl, row);
      const key = `${meal}¦${label}`;
      if (!lib.has(key)) {
        const { [dayField]: _день, ...dish } = row;
        lib.set(key, dish);
      }
      const d = Number(row[dayField]) || 0;
      if (d > 0) { maxDay = Math.max(maxDay, d); dayless.delete(key); }
      else if (![...(def.source.static ?? [])].some((r) => Number(r[dayField]) > 0
        && `${badgeField ? String(r[badgeField] ?? '') : ''}¦${renderTemplate(labelTpl, r)}` === key)) {
        dayless.add(key);
      }
    }
    return { library: lib, meals: mealList, days: Math.max(maxDay, 30), daylessKeys: dayless };
  }, [def, customDishes, badgeField, labelTpl, dayField]);

  // План: ячейка «день|приём» → СПИСОК ключей блюд
  const [plan, setPlan] = useState<Record<string, string[]>>({});
  // Стек: отмеченные блюда — из них собирается случайная раскладка
  const [stack, setStack] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  // Форма своего блюда
  const [formOpen, setFormOpen] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fKcal, setFKcal] = useState('');
  const [fMeal, setFMeal] = useState('');
  const [fKind, setFKind] = useState(DISH_KINDS[0]);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string[]> = {};
    for (const row of def.source.static ?? []) {
      const meal = badgeField ? String(row[badgeField] ?? '') : '';
      const d = Number(row[dayField]) || 0;
      if (d > 0) {
        const cell = `${d}|${meal}`;
        const key = `${meal}¦${renderTemplate(labelTpl, row)}`;
        next[cell] = [...(next[cell] ?? []), key];
      }
    }
    setPlan(next);
    setStack(new Set());
    setSelected(null);
    setCustomDishes([]);
    setFormOpen(false);
  }, [open, def, badgeField, labelTpl, dayField]);

  if (!open) return null;

  const dishesOf = (meal: string) => [...library.keys()].filter((k) => k.startsWith(`${meal}¦`));
  const dishLabel = (key: string) => key.split('¦')[1] ?? '';
  const dishKind = (key: string) => String(library.get(key)?.kind ?? '');
  const dishKcal = (key: string) => Number(library.get(key)?.kcal) || 0;
  const dishImg = (key: string): string | null => {
    const v = imageField ? library.get(key)?.[imageField] : null;
    return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : null;
  };
  const cellKcal = (cell: string) => (plan[cell] ?? []).reduce((s, k) => s + dishKcal(k), 0);
  const visibleDish = (key: string) => dishLabel(key).toLowerCase().includes(libraryQuery.trim().toLowerCase()) && (!studioOnly || library.get(key)?.collection === 'studio-2026') && matchesDiningFilter(library.get(key)!, diningFilter);

  /** Случайная раскладка: в каждый приём — по одному блюду каждого типа из стека
   *  (или основное из всей библиотеки, если стек пуст). Основное не повторяется два дня подряд. */
  const shuffleAll = () => {
    const next: Record<string, string[]> = {};
    for (const meal of meals) {
      const all = dishesOf(meal);
      const picked = all.filter((k) => stack.has(k));
      // группы по типу блюда
      const source = picked.length > 0 ? picked : all.filter((k) => dishKind(k) === 'Основное' || !dishKind(k));
      const byKind = new Map<string, string[]>();
      for (const k of source) {
        const kind = dishKind(k) || 'Основное';
        byKind.set(kind, [...(byKind.get(kind) ?? []), k]);
      }
      if (byKind.size === 0) continue;
      let prevMain = '';
      for (let d = 1; d <= days; d++) {
        const cellList: string[] = [];
        for (const [kind, pool] of byKind) {
          let pick = pool[Math.floor(Math.random() * pool.length)];
          if (kind === 'Основное' && pool.length > 1 && pick === prevMain) {
            pick = pool[(pool.indexOf(pick) + 1) % pool.length];
          }
          if (kind === 'Основное') prevMain = pick;
          cellList.push(pick);
        }
        next[`${d}|${meal}`] = cellList;
      }
    }
    setPlan(next);
    toast.success(stack.size ? 'Собрал рацион из твоего стека' : 'Собрал рацион из основных блюд');
  };

  const addToCell = (cell: string, key: string) =>
    setPlan((p) => (p[cell] ?? []).includes(key) ? p : { ...p, [cell]: [...(p[cell] ?? []), key] });

  const removeFromCell = (cell: string, key: string) =>
    setPlan((p) => ({ ...p, [cell]: (p[cell] ?? []).filter((k) => k !== key) }));

  const onCellClick = (cell: string, meal: string) => {
    if (selected && selected.startsWith(`${meal}¦`)) addToCell(cell, selected);
  };

  /* Drag&drop: из библиотеки — добавить, между ячейками — перенести */
  const onDragStart = (e: React.DragEvent, payload: { from: 'lib' | 'cell'; key: string; cell?: string }) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onCellDrop = (e: React.DragEvent, cell: string, meal: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const p = JSON.parse(e.dataTransfer.getData('text/plain')) as { from: 'lib' | 'cell'; key: string; cell?: string };
      if (!p.key.startsWith(`${meal}¦`)) { toast.error('Это блюдо для другого приёма пищи'); return; }
      if (p.from === 'cell' && p.cell && p.cell !== cell) removeFromCell(p.cell, p.key);
      if (p.from === 'lib' || (p.cell && p.cell !== cell)) addToCell(cell, p.key);
    } catch {}
  };

  const addCustomDish = () => {
    const title = fTitle.trim();
    const kcal = Math.max(0, Math.round(Number(fKcal) || 0));
    const meal = fMeal || meals[0] || '';
    if (!title) { toast.error('Название блюда пустое'); return; }
    const row: Row = {
      [badgeField || 'meal']: meal,
      kind: fKind,
      title,
      desc: `${fKind} · добавлено вручную`,
      kcal,
      image: '',
    };
    setCustomDishes((c) => [...c, row]);
    setFTitle(''); setFKcal('');
    toast.success(`«${title}» в библиотеке (${meal})`, 'Не забудь сохранить план');
  };

  const save = () => {
    const rows: Row[] = [];
    // блюда «только из библиотеки» (напитки/десерты/свои) — сохраняем без day, чтобы не потерялись
    for (const key of daylessKeys) {
      const dish = library.get(key);
      if (dish) rows.push({ ...dish });
    }
    for (let d = 1; d <= days; d++) {
      for (const meal of meals) {
        for (const key of plan[`${d}|${meal}`] ?? []) {
          const dish = library.get(key);
          if (dish) rows.push({ ...dish, [dayField]: d });
        }
      }
    }
    if (rows.length === 0) { toast.error('План пустой — нечего сохранять'); return; }
    try {
      installPlugin({ ...def, source: { static: rows } });
      toast.success('Рацион сохранён', 'Виджет уже показывает твой план');
      onClose();
    } catch (e) {
      toast.error('Не удалось сохранить', e instanceof Error ? e.message : undefined);
    }
  };

  const toggleStack = (key: string) => setStack((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-start justify-center p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Конструктор рациона">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[1400px] h-[94vh] rounded-2xl bg-bg modal-surface border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        {/* Шапка */}
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-5 py-3.5 border-b border-border-soft shrink-0">
          <Utensils className="h-4 w-4 text-accent" />
          <div className="min-w-0 flex-1 basis-[70%] sm:basis-auto">
            <div className="text-sm font-semibold text-text truncate">{def.name} — конструктор рациона</div>
            <div className="text-[11px] text-text-muted">В приём можно класть несколько блюд: основное, гарнир, напиток, десерт… Клик по блюду слева → клики по ячейкам, или тяни мышью</div>
          </div>
          <button onClick={shuffleAll} className="h-9 px-3 rounded-lg bg-bg-soft hover:bg-bg-hover text-sm flex items-center gap-2 transition-colors shrink-0">
            <Shuffle className="h-4 w-4" /> Случайно{stack.size > 0 ? ` (из ${stack.size})` : ''}
          </button>
          <button onClick={save} className="h-9 px-4 rounded-lg bg-accent text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
            <Save className="h-4 w-4" /> Сохранить
          </button>
          <button onClick={onClose} className="h-9 w-9 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text transition-colors shrink-0" title="Закрыть без сохранения">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Библиотека блюд */}
          <aside aria-label="Библиотека блюд" className="w-full sm:w-80 max-h-[38vh] sm:max-h-none shrink-0 border-r border-border-soft overflow-y-auto p-3 space-y-4">
            <input aria-label="Поиск блюд" placeholder="Найти блюдо…" value={libraryQuery} onChange={(e) => setLibraryQuery(e.target.value)} className="w-full h-10 rounded-lg bg-bg-soft border border-border px-3 text-sm" />
            {def.id === 'nutrition-month' && <div className="space-y-2">
              <label className="block text-xs text-text-muted" htmlFor="dining-filter">Подобрать под свой день</label>
              <select id="dining-filter" value={diningFilter} onChange={(e) => setDiningFilter(e.target.value as DiningFilter)} className="w-full h-10 rounded-lg bg-bg-soft border border-border px-2 text-sm">
                {DINING_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <p className="text-xs text-text-muted leading-relaxed">{DINING_FILTERS.find((f) => f.id === diningFilter)?.hint}</p>
            </div>}
            {def.id === 'nutrition-month' && <button onClick={() => setStudioOnly((v) => !v)} aria-pressed={studioOnly} className={`rounded-lg px-3 py-2 text-xs border ${studioOnly ? 'bg-accent/10 text-accent border-accent' : 'border-border text-text-muted'}`}>Новая коллекция · 4 блюда</button>}
            <div className="text-[11px] text-text-muted leading-relaxed">
              Галочка — блюдо в <b className="text-text">стеке</b>: «Случайно» соберёт рацион из стека,
              по одному блюду каждого типа на приём.
            </div>

            {/* Своё блюдо */}
            <div className="rounded-xl border border-border-soft p-2.5">
              <button onClick={() => setFormOpen((v) => !v)} className="w-full flex items-center gap-2 text-sm font-medium text-text">
                <Plus className="h-4 w-4 text-accent" /> Добавить своё блюдо
              </button>
              {formOpen && (
                <div className="mt-2.5 space-y-2">
                  <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Название"
                    className="w-full h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs outline-none focus:border-border" />
                  <div className="flex gap-2">
                    <select value={fMeal || meals[0] || ''} onChange={(e) => setFMeal(e.target.value)}
                      className="flex-1 h-8 rounded-lg bg-bg-soft border border-border-soft px-1.5 text-xs outline-none">
                      {meals.map((m) => <option key={m} value={m}>{m || 'Приём'}</option>)}
                    </select>
                    <select value={fKind} onChange={(e) => setFKind(e.target.value)}
                      className="flex-1 h-8 rounded-lg bg-bg-soft border border-border-soft px-1.5 text-xs outline-none">
                      {DISH_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input value={fKcal} onChange={(e) => setFKcal(e.target.value)} placeholder="ккал" inputMode="numeric"
                      className="w-20 h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs outline-none focus:border-border" />
                    <button onClick={addCustomDish} className="flex-1 h-8 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                      В библиотеку
                    </button>
                  </div>
                </div>
              )}
            </div>

            {![...library.keys()].some(visibleDish) && <div role="status" className="p-3 rounded-xl bg-bg-soft text-sm text-text-muted">Пока нет блюд с такими данными. <button className="text-accent underline" onClick={() => { setDiningFilter('all'); setStudioOnly(false); setLibraryQuery(''); }}>Сбросить фильтры</button></div>}
            {meals.map((meal) => (
              <div key={meal}>
                <div className="section-label">{meal || 'Блюда'}</div>
                <div className="space-y-1.5">
                  {dishesOf(meal).filter(visibleDish).map((key) => (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => onDragStart(e, { from: 'lib', key })}
                      className={`flex items-center gap-2 rounded-lg border p-1.5 cursor-pointer transition-colors ${
                        selected === key ? 'border-accent bg-accent/10' : 'border-border-soft hover:border-border bg-bg-soft/50'
                      }`}
                    >
                      <button type="button" aria-label={`Выбрать блюдо: ${dishLabel(key)}`} aria-pressed={selected === key} onClick={() => setSelected(selected === key ? null : key)} className="flex flex-1 min-w-0 gap-2 items-center text-left">
                      <Thumb src={dishImg(key)} size={52} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs text-text leading-snug line-clamp-2">{dishLabel(key)}</span>
                        <span className="block text-[10px] text-text-dim">{dishKind(key)}{dishKcal(key) ? ` · ${dishKcal(key)} ккал` : ''}</span>
                      </span>
                      </button>
                      <button type="button" aria-label={`Рецепт: ${dishLabel(key)}`} onClick={() => setPreview({ label: dishLabel(key), value: dishKcal(key), raw: library.get(key)! })} className="h-8 w-8 shrink-0 rounded-lg text-text-muted hover:text-accent hover:bg-bg-hover"><BookOpen className="h-4 w-4 mx-auto" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStack(key); }}
                        className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          stack.has(key) ? 'bg-accent border-accent text-white' : 'border-border text-transparent hover:border-accent/50'
                        }`}
                        title={stack.has(key) ? 'Убрать из стека' : 'В стек'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          {/* План: 30 дней × приёмы, в ячейке несколько блюд */}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead className="sticky top-0 z-10 bg-bg">
                <tr>
                  <th className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold px-3 py-2 w-14 border-b border-border-soft">День</th>
                  {meals.map((m) => (
                    <th key={m} className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold px-3 py-2 border-b border-border-soft">{m || 'Блюдо'}</th>
                  ))}
                  <th className="text-left text-xs text-text-muted px-3 py-2 border-b border-border-soft">Итого за день</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                  <tr key={d} className="border-b border-border-soft/60">
                    <td className="px-3 py-1.5 text-sm font-semibold text-text-dim tabular-nums align-top pt-3">{d}</td>
                    {meals.map((meal) => {
                      const cell = `${d}|${meal}`;
                      const keys = plan[cell] ?? [];
                      const kcal = cellKcal(cell);
                      return (
                        <td
                          key={meal}
                          className="px-1.5 py-1.5 align-top"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onCellDrop(e, cell, meal)}
                          onClick={() => onCellClick(cell, meal)}
                        >
                          <div className="space-y-1">
                            {keys.map((key) => (
                              <div
                                key={key}
                                draggable
                                onDragStart={(e) => onDragStart(e, { from: 'cell', key, cell })}
                                className="group/chip flex items-center gap-1.5 rounded-lg border border-border-soft bg-bg-card p-1 pr-1.5 cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
                              >
                                <Thumb src={dishImg(key)} size={24} />
                                <span className="flex-1 min-w-0 text-[11px] leading-tight truncate">{dishLabel(key)}</span>
                                {dishKcal(key) > 0 && <span className="text-[9px] text-text-dim tabular-nums shrink-0">{dishKcal(key)}</span>}
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeFromCell(cell, key); }}
                                  className="h-4 w-4 rounded flex items-center justify-center text-text-dim hover:text-danger opacity-0 group-hover/chip:opacity-100 transition-opacity shrink-0"
                                  title="Убрать"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <div className={`rounded-lg border border-dashed border-border flex items-center justify-center text-text-dim text-[10px] transition-colors ${keys.length ? 'h-6' : 'h-[38px]'} ${selected?.startsWith(`${meal}¦`) ? 'border-accent/50 text-accent' : ''}`}>
                              {selected?.startsWith(`${meal}¦`) ? '+ кликни' : keys.length ? `${kcal} ккал` : '—'}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 align-top min-w-[150px]">
                      {(() => {
                        const rows = meals.flatMap((meal) => (plan[`${d}|${meal}`] ?? []).map((key) => library.get(key)!));
                        const total = diningTotals(rows);
                        const macroText = (key: 'protein' | 'fat' | 'carbs') => rows.some((row) => typeof row[key] === 'number' && Number.isFinite(row[key]) && Number(row[key]) >= 0) ? total[key].toFixed(1) : '—';
                        return rows.length ? <div className="text-xs tabular-nums space-y-1" aria-label={`Питание за день ${d}`}>
                          <div className="font-semibold">{Math.round(total.kcal)} ккал</div>
                          <div className="text-text-muted">Б {macroText('protein')} · Ж {macroText('fat')} · У {macroText('carbs')} г</div>
                          {total.missing > 0 && <div className="text-text-dim text-[10px]">Частичный итог: у {total.missing} блюд неполные БЖУК</div>}
                        </div> : <span className="text-text-dim">—</span>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {preview && <RecipeModal def={def} row={preview} onClose={() => setPreview(null)} />}
    </div>,
    document.body,
  );
};
