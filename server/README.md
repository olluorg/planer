# THEDAD Sync Server

E2E-зашифрованный blob-синк. Сервер хранит только шифр-текст дампа БД — не видит содержимое и не знает ключ шифрования.

## Запуск (Docker)

```bash
cd server
docker compose up --build
# сервер на http://localhost:8787, Postgres в томе thedad_db
```

## Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/health` | проверка живости |
| POST | `/vault` | создать анонимный vault (для QR-привязки) → `{syncId, authToken}` |
| POST | `/register` | `{email, password, salt}` → `{syncId, authToken, salt}` |
| POST | `/login` | `{email, password}` → `{syncId, authToken, salt}` |
| PUT | `/vault/:id` | (Bearer authToken) `{ciphertext, updatedAt}` — залить блоб |
| GET | `/vault/:id` | (Bearer authToken) → `{ciphertext, updatedAt}` |

## Как это E2E

- Клиент шифрует дамп SQLite ключом `encKey` (AES-GCM) **до** отправки.
- Для email-входа `encKey` выводится из пароля через PBKDF2(password, salt) на клиенте — сервер хранит `salt` и `pass_hash`, но не `encKey`.
- Для QR-привязки `encKey` случайный и передаётся в QR (в URL-хеше), на сервер не попадает.
- Сервер видит только `ciphertext` и `updated_at`.

## Переменные окружения

| Переменная | По умолчанию | Зачем |
|---|---|---|
| `DATABASE_URL` | локальный Postgres | подключение к БД |
| `PORT` | `8787` | порт |
| `ALLOWED_ORIGINS` | пусто (любой источник) | список доменов через запятую. **В проде задавать обязательно** — иначе чужая страница сможет обращаться к API от имени залогиненного пользователя |
| `RATE_LIMIT_MAX` | `120` | запросов в минуту с одного IP |

Отдельные лимиты жёстче общего: `/register` и `/vault` — 5 в час, `/login` —
10 за 15 минут. Это защита от перебора паролей и от накрутки пустых хранилищ.
Сервер читает `X-Forwarded-For` (`trustProxy`), поэтому лимиты считаются по
реальному IP только если он стоит за доверенным reverse-proxy.

## Прод

Развёртывание, бэкапы, обновление и восстановление — в
[`deploy/server/`](../deploy/server/README.md). Эта папка — только код сервера;
`docker-compose.yml` здесь для локальной разработки.
