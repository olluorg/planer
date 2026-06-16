# Gap-анализ: доска за доской

Легенда: ✅ есть · 🟡 частично · ❌ нет

---

## 1. Core Product — Dashboard

| Элемент дизайна | Статус | Что доделать |
|---|---|---|
| 4 KPI-карточки (Focus/Tasks/Habit/Energy) со спарклайнами и `↑12%` | ❌ | Новый `MetricCard` со sparkline + дельтой. Заменить/дополнить AiInsightCard |
| Today's Plan (список с временем) | ✅ | есть `TodayPlan` |
| AI Insight блок | 🟡 | у нас Insights-панель сбоку, на дашборд можно вынести 1 карточку |
| Weekly Consistency heatmap (M T W T F S S × недели) | ❌ | мини-heatmap виджет на дашборд |
| Quick Capture (таб Task/Note/Habit/Idea) | 🟡 | есть QuickAdd, нет inline-варианта с табами на дашборде |
| Upcoming (дедлайны) | 🟡 | есть в расписании, нет отдельного «ближайшие дедлайны» |
| 4 stat-плашки внизу (Tasks Due/Events/Focus Time/Completed) | 🟡 | есть похожие, привести к виду макета |

**Приоритет: ВЫСОКИЙ** — это лицо продукта.

---

## 2. Core Product — Goals

| Элемент | Статус | Доделать |
|---|---|---|
| Список целей с цветной левой полосой по категории | 🟡 | добавить категорию+цвет, left-border |
| Прогресс-бар + % + дедлайн на строке | ✅ | есть |
| Группировка Active/Completed/Archived (табы) | ❌ | добавить статус-фильтр табами |
| Goal Analytics / AI Predictions блок | 🟡 | прогноз есть, оформить как в макете |

**Приоритет: СРЕДНИЙ**

---

## 3. Core Product — Tasks

| Элемент | Статус | Доделать |
|---|---|---|
| Секции High / Medium / Low Priority | 🟡 | есть kanban, нет секционного списка с заголовками приоритета |
| Теги категорий (Work/Health/Personal) цветные | 🟡 | теги есть, нет цветовой палитры категорий |
| Дата справа (Today/Tomorrow/дата) | ✅ | есть |
| Прогресс-бар «14 completed · 72%» внизу | ❌ | футер-сводка списка |

**Приоритет: СРЕДНИЙ**

---

## 4. Core Product — Habits

| Элемент | Статус | Доделать |
|---|---|---|
| Недельная сетка M T W T F S S с кружками-галочками | 🟡 | у нас матрица 30 дней; добавить компактный недельный вид как в макете |
| Streak-счётчик на строке (число + иконка) | 🟡 | показать серию числом |
| «View habit analytics» | 🟡 | ссылка на аналитику привычки |

**Приоритет: СРЕДНИЙ**

---

## 5. Core Product — Planning

| Элемент | Статус | Доделать |
|---|---|---|
| Hour-by-hour timeline (06:00…22:00) с цветными блоками | ❌ | у нас 4 тайм-блока; добавить почасовой timeline-вид (как Week-view календаря, но для дня) |
| Цветные события по категориям | 🟡 | есть в Calendar week-view, перенести в Planning |
| «Today's Focus» сайд-блок | 🟡 | есть фокус дня, оформить |

**Приоритет: СРЕДНИЙ** (частично закрыто Calendar week-view).

---

## 6. Core Product — Analytics

| Элемент | Статус | Доделать |
|---|---|---|
| 4 KPI вверху (Focus Score/Deep Work/Tasks/Productivity) с дельтой | ❌ | MetricCard-ряд |
| Focus Score Trend (line) | ✅ | есть динамика |
| Time Distribution (donut по категориям) | ❌ | donut «Deep Work/Meetings/Personal/Learning» |
| Top Categories (горизонтальные бары) | ❌ | bar-list |
| Radar / Distribution | ✅ | добавили |

**Приоритет: ВЫСОКИЙ** — аналитика в макете заметно богаче.

---

## 7. Core Product — Reflection

| Элемент | Статус | Доделать |
|---|---|---|
| Journal-формат (How was your day / What went well / improve / tomorrow) | 🟡 | есть поля, привести к journal-виду |
| Mood с числом (8/10) | 🟡 | у нас 5 эмодзи; добавить числовую шкалу-вариант |
| Daily Reflection Streak (мини-граф) | 🟡 | streak есть, мини-граф нет |
| Wins / Lessons / Gratitude табы | ❌ | доп. секции журнала |

**Приоритет: НИЗКИЙ**

---

## 8. Interaction Layer

| Элемент | Статус | Доделать |
|---|---|---|
| Command Palette | ✅ | есть |
| AI Side Panel | 🟡 | сделали Insights-панель (без AI) |
| Quick Capture (overlay с табами) | 🟡 | есть QuickAdd |
| Notifications Center | ✅ | Inbox |
| Focus Mode | ✅ | есть |
| Modal Stack (вложенные модалки) | ❌ | поддержать стек z-index для flow «создать цель → milestone» |
| Mobile Sheets | ✅ | DialogContent адаптивный |
| **Interaction States** (button/input/toggle/checkbox states) | 🟡 | свести в единый набор, добить focus/disabled/error |
| **Micro-interactions** (counter anim, success anim, progress anim) | ❌ | анимация чисел, чек-марков, прогресса |
| Keyboard Shortcuts (помощь по `?`) | 🟡 | хоткеи есть, нет экрана-шпаргалки |

**Приоритет: ВЫСОКИЙ** (микро-взаимодействия = ощущение «дорого»).

---

## 9. Data Visualization System (12 типов)

| Тип | Статус |
|---|---|
| Rings & circular progress | ✅ |
| Line charts (trends) | ✅ |
| Area charts | ✅ |
| Heatmaps (activity/consistency) | 🟡 (есть task-heatmap, нет calendar-contribution и stacked) |
| Forecasts & predictions | ✅ |
| Confidence intervals (band на графике) | 🟡 (есть в main chart, оформить отдельно) |
| Timelines & Gantt | ❌ |
| Streak & consistency bars | 🟡 |
| Radar / Spider | ✅ |
| Distribution histogram | ✅ |
| Scatter / Bubble | ❌ |
| Micro charts in cards (sparklines) | ❌ ← **критично для KPI-карточек** |

**Приоритет: sparklines — ВЫСОКИЙ, остальное — НИЗКИЙ.**

---

## 10. Design System → Real Components

| Элемент | Статус | Доделать |
|---|---|---|
| Color scale 50–900 (primary, neutral) | ❌ | внедрить шкалу в tailwind |
| Semantic colors (success/warn/error/info/neutral) | 🟡 | есть, привести к токенам дизайна |
| Typography scale (Display/H1/H2/H3/Body/Small/Caption/Label) | ❌ | классы-утилиты `.text-h1` и т.д. |
| Spacing scale (4..128) | 🟡 | tailwind дефолт, выверить ритм |
| Radius & Shadow tokens | 🟡 | есть, привести к sm/md/lg/xl шкале дизайна |
| Component library (buttons/inputs/badges/tabs/cards: все состояния) | 🟡 | добить варианты и состояния |

**Приоритет: ВЫСОКИЙ — это фундамент.**

---

## 11. Motion & Interaction Showcase

| Элемент | Статус | Доделать |
|---|---|---|
| Hover states (card lift, button fill, icon, nav) | 🟡 | унифицировать |
| Focus states (input, keyboard ring) | 🟡 | добить ring везде |
| Drag preview | ✅ | dnd-kit overlay |
| Modal transition (scale+fade) | 🟡 | привести к spring |
| Command palette open (scale+blur) | 🟡 | |
| Widget expansion | ❌ | |
| Notification appear (slide+stagger) | 🟡 | |
| Loading & skeleton | ❌ | **skeleton-компоненты** |
| Toast notifications | ❌ | **toast-система** |
| Page transition | ❌ | crossfade между роутами |
| Easing & duration tokens | ❌ | `--motion-*` переменные |

**Приоритет: ВЫСОКИЙ (skeleton + toast + motion-tokens).**

---

## 12. Ecosystem / Landing / Brand

| Элемент | Статус |
|---|---|
| Landing page | ❌ |
| App store / social assets | ❌ |
| Integrations (Google Cal, Notion…) | ❌ (по ТЗ не требовалось) |
| Watch/mobile companion | ❌ |

**Приоритет: НИЗКИЙ** (маркетинг, не продукт).

---

## Итоговая матрица приоритетов

**Сделать в первую очередь (поднимет качество мгновенно):**
1. Дизайн-токены: цветовая шкала, typography, тени, motion-переменные.
2. Sparkline-компонент + 4 KPI-карточки на дашборд и в аналитику.
3. Skeleton-загрузка + Toast-система.
4. Микро-анимации: счётчики, чек-марки, прогресс.
5. Weekly consistency heatmap, Time Distribution donut, Top Categories.

**Вторым заходом:**
6. Доводка Tasks (priority-секции), Habits (недельная сетка), Planning (timeline).
7. Empty-states по всем экранам.
8. Goals: статус-табы + категории с цветом.
9. Keyboard shortcuts-шпаргалка (`?`).

**Опционально:**
10. Gantt/Timeline, Scatter/Bubble, contribution-heatmap.
11. Landing page, brand-assets.
