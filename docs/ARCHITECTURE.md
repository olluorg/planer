# Архитектура THEDAD

## Принципы

- **Local-first**: всё хранится на устройстве, нет серверной части в ядре.
- **Реактивность**: UI подписан на Zustand-стор, точечный ререндер.
- **Разделение слоёв**: бизнес-логика в `src/lib/` не зависит от React.

## Слои

```
┌─────────────────────────────────────────────┐
│  pages/  +  components/        (React UI)     │
├─────────────────────────────────────────────┤
│  lib/store.ts  (Zustand)       состояние      │
├─────────────────────────────────────────────┤
│  lib/db.ts     (SQLite WASM)   персист        │
├─────────────────────────────────────────────┤
│  IndexedDB (idb-keyval)        диск браузера  │
└─────────────────────────────────────────────┘
```

## Данные

SQLite-таблицы: `goals`, `tasks`, `habits`, `habit_logs`, `progress_records`,
`reflections`, `predictions`, `time_entries`, `change_log`, `xp_log`, `achievements`.

Часть состояния геймификации и UI-настроек хранится в `localStorage`
(quests, weekly challenge, leagues, combo, inbox, layout дашборда).

### Миграции

`src/lib/db.ts` → `migrate()` добавляет колонки через `ALTER TABLE` идемпотентно
(проверка `columnExists`). Индексы, зависящие от новых колонок, создаются
в `POST_MIGRATE_INDEXES` после миграции.

### Персист

`schedulePersist()` дебаунсит экспорт БД (`db.export()`) в IndexedDB на 250 мс
после последнего изменения. Экспорт/импорт `.sqlite` (в т.ч. зашифрованный) —
в Настройках.

## Ключевые модули lib/

| Модуль | Назначение |
|---|---|
| `db.ts` | SQLite WASM, схема, миграции, персист |
| `store.ts` | Zustand-стор, CRUD, hooks геймификации |
| `forecast.ts` / `predict.ts` | модели прогноза (linreg/EMA/Holt + CI) |
| `gamification.ts` | XP, уровни, streak, достижения |
| `quests.ts`, `weekly.ts`, `leagues.ts`, `combo.ts` | геймификация |
| `insights.ts` | детерминированные инсайты по данным |
| `templates.ts` | готовые наборы целей/привычек/задач |
| `inbox.ts` | центр уведомлений |
| `notifications.ts` | локальные пуши (Notifications API) |
| `cryptoExport.ts` | AES-GCM шифрование экспорта |
| `report.ts` | Markdown-отчёт за неделю |

## Производительность

- Тяжёлые страницы (Analytics, Plan, Calendar, и т.д.) загружаются через `React.lazy`.
- `vite.config.ts` → `manualChunks` разбивает зависимости (echarts, grid, sqlite, radix).
- WASM SQLite загружается асинхронно с экраном загрузки.

## Командный режим (Pro)

Командные функции — отдельный слой (опциональный sync поверх local-first ядра),
лицензируются коммерчески (см. COMMERCIAL-LICENSE.md). В этом репозитории —
только ядро.
