# Roadmap доводки до уровня дизайна

Порядок выбран по правилу «максимум воспринимаемого качества за минимум работы».
Каждая фаза самодостаточна и заканчивается рабочим, проверяемым результатом.

---

## Фаза A — Фундамент токенов  ⭐ начать здесь

> Эффект: мгновенно поднимает ВСЕ экраны без переписывания.

- [ ] A1. Цветовые шкалы primary/neutral 50–900 в `tailwind.config.js`.
- [ ] A2. Semantic + chart-палитра как токены (заменить хардкод `#22c55e` и т.п.).
- [ ] A3. Typography-утилиты `.text-display…label` в `index.css`.
- [ ] A4. Motion-переменные `--motion-*`, `--ease-*` + `prefers-reduced-motion`.
- [ ] A5. Shadow-xl для модалок, ревизия применения теней.
- [ ] A6. Z-index sweep по шкале слоёв (свести InboxPopover/InsightsPanel/FocusMode/Dialog).

**Оценка: 1 заход. Риск: низкий (механика).**

---

## Фаза B — Sparklines и KPI-карточки  ⭐

> Эффект: дашборд и аналитика начинают выглядеть как эталон.

- [ ] B1. `Sparkline` (мини line/area, ECharts или чистый SVG).
- [ ] B2. `MetricCard` — заголовок, крупное значение, дельта `↑12%`, sparkline.
- [ ] B3. Ряд из 4 KPI на дашборд: Focus Score, Tasks Progress, Habit Streak, Energy.
- [ ] B4. Ряд KPI вверху Analytics (Focus Score/Deep Work/Tasks/Productivity).
- [ ] B5. Counter-animation (число «накручивается» при появлении).

**Оценка: 1 заход.**

---

## Фаза C — Motion & feedback слой  ⭐

> Эффект: ощущение «дорогого» продукта.

- [ ] C1. `Skeleton` компоненты + skeleton-загрузка вместо «Загрузка SQLite».
- [ ] C2. Toast-система (`useToast`) — «Задача создана», «Цель достигнута» (z-70).
- [ ] C3. Success-checkmark анимация (draw-in галочки).
- [ ] C4. Progress-bar анимация заливки.
- [ ] C5. Page-transition crossfade между роутами.

**Оценка: 1–2 захода.**

---

## Фаза D — Аналитика и виджеты данных

- [ ] D1. Time Distribution donut (категории времени).
- [ ] D2. Top Categories — горизонтальные бары.
- [ ] D3. Weekly Consistency heatmap (виджет на дашборд).
- [ ] D4. Confidence-band оформить как отдельную карту.
- [ ] D5. Streak/consistency bar-charts довести.

**Оценка: 1–2 захода.**

---

## Фаза E — Доводка экранов под макет

- [ ] E1. Tasks: секции High/Medium/Low + цветные теги категорий + футер «N done · %».
- [ ] E2. Habits: компактная недельная сетка (кружки M T W T F S S) + streak-число.
- [ ] E3. Planning: hour-by-hour timeline для дня (переиспользовать Calendar week-view).
- [ ] E4. Goals: статус-табы Active/Completed/Archived + категория с цветной полосой.
- [ ] E5. Reflection: journal-формат (What went well / improve / tomorrow) + Wins/Lessons/Gratitude.

**Оценка: 2–3 захода.**

---

## Фаза F — Empty / loading / states

- [ ] F1. Единый `EmptyState` (иконка + заголовок + подсказка + CTA) на всех пустых экранах.
- [ ] F2. Interaction states по компонентам: focus-ring, disabled, error (inputs).
- [ ] F3. Keyboard-shortcuts шпаргалка по `?`.

**Оценка: 1 заход.**

---

## Фаза G — Опционально (новые типы данных)

- [ ] G1. Gantt/Timeline для целей с milestone.
- [ ] G2. Scatter/Bubble (корреляции).
- [ ] G3. Contribution-heatmap (год активности).
- [ ] G4. Modal-stack (вложенные flow).

---

## Фаза H — Маркетинг (вне продукта)

- [ ] H1. Landing page.
- [ ] H2. Brand-assets (favicon, og-image, social-cards — переиспользовать sharePng).

---

## Рекомендуемый порядок выполнения

```
A (токены) → B (KPI/sparkline) → C (motion/feedback)
  → D (аналитика) → E (экраны) → F (states)
  → [пауза, оценка] → G / H по желанию
```

Фазы A+B+C — это ~80% эффекта «выглядит как SaaS». После них имеет смысл
снова свериться с дизайном и решить, что из D–H реально нужно.
