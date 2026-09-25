#!/usr/bin/env bash
# Восстановление базы sync-сервера из дампа.
#
#   deploy/server/scripts/restore.sh backups/thedad-2026-09-25_0330.sql.gz
#   deploy/server/scripts/restore.sh thedad-2026-09-25_0330.sql.gz.gpg   # зашифрованная копия
#
# Перед восстановлением снимает свежий бэкап текущего состояния — так ошибочное
# восстановление можно откатить тем же скриптом.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_env

SRC="${1:-}"
[[ -n "$SRC" ]] || fail "укажите файл: $0 backups/thedad-....sql.gz"
[[ "$SRC" = /* ]] || SRC="${OLDPWD:-$PWD}/$SRC"   # путь относительно места вызова
[[ -f "$SRC" ]] || fail "нет файла $SRC"

echo "База будет ЗАМЕНЕНА содержимым:"
echo "  $SRC"
echo "Все изменения пользователей после момента этого дампа пропадут."
read -r -p "Чтобы продолжить, введите ВОССТАНОВИТЬ: " answer
[[ "$answer" == "ВОССТАНОВИТЬ" ]] || fail "отменено"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ "$SRC" == *.gpg ]]; then
  [[ -n "${BACKUP_PASSPHRASE:-}" ]] || fail "файл зашифрован, а BACKUP_PASSPHRASE в .env пуст"
  log "Расшифровываю"
  gpg --batch --yes --pinentry-mode loopback --decrypt --passphrase-fd 3 \
      --output "$TMP" "$SRC" 3<<<"$BACKUP_PASSPHRASE" || fail "не удалось расшифровать — неверный пароль?"
else
  cp "$SRC" "$TMP"
fi
gzip -t "$TMP" || fail "архив повреждён"

log "Снимаю страховочный бэкап текущей базы"
"$HERE/scripts/backup.sh" pre-restore

log "Останавливаю sync, чтобы никто не писал во время замены"
compose stop sync

log "Пересоздаю базу"
compose exec -T db psql -U thedad -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS thedad WITH (FORCE);" \
  -c "CREATE DATABASE thedad OWNER thedad;"

log "Загружаю дамп"
gunzip -c "$TMP" | compose exec -T db psql -U thedad -d thedad -v ON_ERROR_STOP=1 -q

log "Запускаю sync"
compose start sync
wait_healthy || fail "sync не поднялся — смотрите: docker compose logs sync"

count="$(compose exec -T db psql -U thedad -d thedad -tAc 'SELECT count(*) FROM vaults')"
log "Готово. Хранилищ в базе: $count"
