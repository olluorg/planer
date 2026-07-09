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

## Прод

Развернуть на любом хосте с Docker (VPS / Fly.io / Railway). Фронт (GitHub Pages/статик) указывает на URL сервера в Настройках синхронизации. Обязательно HTTPS перед сервером (reverse-proxy: Caddy/nginx).
