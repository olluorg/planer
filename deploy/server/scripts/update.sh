#!/usr/bin/env bash
# Обновление sync-сервера до последней версии из репозитория.
#
#   deploy/server/scripts/update.sh
#
# Порядок: бэкап → новый код → пересборка → проверка здоровья. Если сервер
# после обновления не поднялся, скрипт скажет об этом и покажет логи; база при
# этом не тронута, а свежий дамп лежит в backups/.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_env

log "Бэкап перед обновлением"
"$HERE/scripts/backup.sh" pre-update

log "Забираю новый код"
# Скрипт запускают через sudo, а репозиторий и ключ доступа к GitHub принадлежат
# обычному пользователю. git от root отказался бы работать с чужим репозиторием
# («dubious ownership») и не нашёл бы ключ — поэтому тянем от имени владельца.
owner="$(stat -c %U "$HERE")"
if [[ $EUID -eq 0 && "$owner" != "root" ]]; then
  sudo -u "$owner" git -C "$HERE" pull --ff-only
else
  git -C "$HERE" pull --ff-only
fi

log "Пересобираю и перезапускаю"
compose pull db caddy
compose up -d --build

log "Проверяю здоровье"
if wait_healthy; then
  log "Сервер работает"
else
  compose logs --tail=50 sync
  fail "sync не отвечает после обновления. Откат: git checkout <прошлый коммит> && docker compose up -d --build"
fi

# Старые образы копятся с каждой пересборкой и съедают диск.
docker image prune -f >/dev/null
compose ps
