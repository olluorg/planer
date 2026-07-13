# THEDAD — синхронизация виджетов и потоки данных

Как связаны виджеты здоровья/питания/активности и почему изменение в одном месте
отражается везде. Кратко: **всё сходится в `healthLogs`** (единый лог метрик), а виджеты
общаются через события `window`.

## Слои хранения

| Хранилище | Что лежит | Модуль |
|---|---|---|
| **SQLite (IndexedDB)** через `useStore` | `healthLogs` (steps, weight, **calories**, **workout**, sleep, water, energy), goals, tasks, habits… | `lib/store.ts` |
| **localStorage** | съеденное за день, цель ккал, свои продукты | `lib/nutrition.ts` |
| **localStorage** | зарядка (секунды/день), ручные тренировки | `lib/activity.ts` |
| **localStorage** | профиль: вес, пол, возраст, рост | `lib/profile.ts` |

`healthLogs` — **канонический слой**. К нему привязан авто-прогресс целей
(`goal.health_metric`) и виджет «Здоровье». Локальные фичи (питание/зарядка/активность)
держат «сырые» данные у себя, а дневные итоги сводят в `healthLogs`.

## События (шина `window`)

| Событие | Кто шлёт | Кто слушает |
|---|---|---|
| `thedad:nutrition-changed` (`NUTRITION_EVENT`) | любое изменение еды/продуктов/цели ккал | Калории, Активность, `useHealthSync` |
| `thedad:activity-changed` (`ACTIVITY_EVENT`) | зарядка, ручные тренировки | Активность, Калории, `useHealthSync` |
| `thedad:workout-done` | конец зарядки (`WorkoutMode`) | виджет Зарядка, `useHealthSync` |
| `thedad:profile-changed` (`PROFILE_EVENT`) | смена веса/пола/возраста/роста | Калории, Активность |
| `thedad:plugins-changed` (`PLUGINS_EVENT`) | установка/удаление плагина | Дашборд, Калории |

## Единая точка сведе́ния — `useHealthSync`

`lib/healthSync.ts` монтируется один раз в `App`. Слушает события еды/активности/зарядки
и (с дебаунсом 300мс) пишет дневные итоги в `healthLogs`:

- `calories` = сумма съеденного за сегодня (как только появилась первая отметка «съел»);
- `workout` = минуты зарядки за сегодня.

Виджеты больше **не** пишут в `healthLogs` напрямую — они только меняют свои сторы и шлют
события. Это убирает двойные записи и делает поток предсказуемым.

```mermaid
flowchart TD
  subgraph UI["Виджеты / экраны"]
    Food["Питание (карточки)\nотметка «съел»"]
    CalW["Калории\n+ разворот меню"]
    ActW["Активность\n+ ручные тренировки"]
    WrkM["Зарядка 7 минут\n(WorkoutMode)"]
    HlthW["Здоровье\n(ручной ввод: вес, шаги…)"]
    Goals["Цели\n(авто-прогресс)"]
  end

  subgraph LS["localStorage"]
    Nut["nutrition.*\nсъедено, продукты, цель ккал"]
    Act["activity.* / workout.*\nтренировки, минуты зарядки"]
    Prof["profile.*\nвес, пол, возраст, рост"]
  end

  HL[("healthLogs (SQLite)\nsteps · weight · calories · workout …")]
  Sync{{"useHealthSync\n(дебаунс, сведение итогов)"}}

  Food -->|toggleEaten| Nut
  CalW -->|eat / custom / goal| Nut
  ActW -->|addManual| Act
  WrkM -->|logWorkout| Act
  CalW -.->|правка веса/профиля| Prof
  ActW -.->|правка веса| Prof

  Nut -->|NUTRITION_EVENT| Sync
  Act -->|ACTIVITY_EVENT| Sync
  WrkM -->|workout-done| Sync

  Sync -->|calories, workout| HL
  HlthW -->|upsertHealthLog| HL
  HL -->|health_metric| Goals
  HL --> HlthW

  Prof -->|BMR, вес| CalW
  Prof -->|BMR, вес| ActW
  Nut --> CalW
  Act --> ActW
  Nut --> ActW
  HL -->|шаги| CalW
  HL -->|шаги| ActW
```

## Как считается баланс дня

```
баланс = съедено − (BMR покоя + активность)
активность = шаги·k(вес) + зарядка·MET(вес) + ручные тренировки
BMR = Миффлин-Сан-Жеор (пол, возраст, рост, вес)      // 0, если профиль не заполнен
```

Дефицит (баланс ≤ 0) → снижение веса; профицит → набор. Виджет «Калории» сверяет это
с целью по весу (цель в кг, где target < start) и с целью, привязанной к метрике `calories`.

## Точка расширения для экосистемы

Любой внешний источник (Apple Health, Health Connect, Google Fit, умные часы), который
пишет в `healthLogs` через `upsertHealthLog(date, metric, value)` — **автоматически**
прорастает во все виджеты и цели, без отдельной проводки. Именно поэтому `healthLogs`
выбран каноническим слоем. Подробности — в [ECOSYSTEM.md](./ECOSYSTEM.md).
