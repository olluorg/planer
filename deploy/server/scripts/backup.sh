#!/usr/bin/env bash
# Дамп базы sync-сервера. Запускается systemd-таймером раз в сутки и вручную
# перед обновлением и восстановлением.
#
#   deploy/server/scripts/backup.sh [метка]
#
# Метка попадает в имя файла: restore.sh и update.sh ставят свою, чтобы
# страховочные копии было видно в списке.
#
# Кладёт дамп в deploy/server/backups/, чистит старые. Если в .env задан
# BACKUP_RCLONE_REMOTE — шифрует копию и отправляет её за пределы машины:
# бэкап на том же диске не переживёт смерть этого диска.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_env

KEEP="${BACKUP_KEEP_DAYS:-14}"
DIR="$HERE/backups"
LABEL="${1:+-$1}"
# Секунды в имени и отказ перезаписывать: раньше метка была до минуты, и
# страховочный бэкап перед восстановлением молча затирал тот самый хороший
# дамп, из которого восстанавливали, — если что-то шло не так, откатиться было
# уже не к чему.
FILE="$DIR/thedad-$(date +%Y-%m-%d_%H%M%S)$LABEL.sql.gz"
[[ -e "$FILE" ]] && FILE="${FILE%.sql.gz}-$$.sql.gz"

# healthchecks.io: не пришёл пинг — сервис сам напишет, что бэкап не прошёл.
hc_ping() {
  [[ -n "${BACKUP_PING_URL:-}" ]] && curl -fsS -m 10 --retry 3 "${BACKUP_PING_URL}$1" >/dev/null || true
}
# Ловим любой ненулевой выход, включая fail(): ERR-ловушка явный exit не видит.
finish() { local rc=$?; [[ $rc -ne 0 ]] && hc_ping /fail; rm -f "${FILE:-}.part"; }
trap finish EXIT

mkdir -p "$DIR"
chmod 700 "$DIR"

log "Дамп базы → $FILE"
compose exec -T db pg_dump -U thedad --no-owner thedad | gzip -9 > "$FILE.part"

# Проверяем до того, как считать копию готовой: битый или пустой дамп хуже,
# чем никакого, — о нём узнаёшь в момент, когда он нужен.
gzip -t "$FILE.part" || fail "архив повреждён"
lines="$(gunzip -c "$FILE.part" | grep -c 'CREATE TABLE' || true)"
[[ "$lines" -ge 1 ]] || fail "в дампе нет ни одной таблицы — база пуста или pg_dump отработал с ошибкой"
mv "$FILE.part" "$FILE"
chmod 600 "$FILE"
log "Готово: $(du -h "$FILE" | cut -f1)"

log "Удаляю локальные копии старше $KEEP дн."
find "$DIR" -name 'thedad-*.sql.gz' -mtime +"$KEEP" -print -delete

if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  [[ -n "${BACKUP_PASSPHRASE:-}" ]] || fail "задан BACKUP_RCLONE_REMOTE, но нет BACKUP_PASSPHRASE — незашифрованный дамп наружу не отправляю"
  enc="$FILE.gpg"
  log "Шифрую и отправляю в $BACKUP_RCLONE_REMOTE"
  gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
      --passphrase-fd 3 --output "$enc" "$FILE" 3<<<"$BACKUP_PASSPHRASE"
  rclone copy "$enc" "$BACKUP_RCLONE_REMOTE" --quiet
  rm -f "$enc"
  rclone delete "$BACKUP_RCLONE_REMOTE" --min-age "${KEEP}d" --include 'thedad-*.sql.gz.gpg' --quiet
  log "Удалённая копия отправлена"
fi

hc_ping ""
