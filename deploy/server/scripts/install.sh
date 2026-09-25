#!/usr/bin/env bash
# Первичная настройка чистой Ubuntu 22.04/24.04 под sync-сервер THEDAD.
# Запуск из корня репозитория на сервере:  sudo deploy/server/scripts/install.sh
#
# Что делает (повторный запуск безопасен):
#   1. ставит Docker из официального репозитория;
#   2. включает автоматические обновления безопасности;
#   3. закрывает всё входящее, кроме SSH, 80 и 443;
#   4. создаёт .env с паролем базы, если его ещё нет;
#   5. ставит ежедневный бэкап через systemd.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Запустите через sudo: sudo $0" >&2
  exit 1
fi

HERE="$(cd "$(dirname "$0")/.." && pwd)"   # deploy/server
cd "$HERE"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

log "Обновляю систему"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl gnupg ufw unattended-upgrades openssl rclone

if ! command -v docker >/dev/null 2>&1; then
  log "Ставлю Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker уже установлен: $(docker --version)"
fi

log "Включаю автоматические обновления безопасности"
dpkg-reconfigure -f noninteractive unattended-upgrades

log "Настраиваю файрвол"
# Порядок важен: сначала разрешаем SSH, потом включаем — иначе отрежем себя.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

if [[ ! -f .env ]]; then
  log "Создаю .env"
  cp .env.example .env
  pass="$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-40)"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pass}|" .env
  chmod 600 .env
  echo "Пароль базы сгенерирован и записан в $HERE/.env"
  echo "Осталось вписать SYNC_DOMAIN и ACME_EMAIL:  sudo nano $HERE/.env"
else
  log ".env уже есть — не трогаю"
fi

log "Ставлю ежедневный бэкап (systemd timer)"
sed "s|__DIR__|$HERE|g" systemd/thedad-backup.service > /etc/systemd/system/thedad-backup.service
cp systemd/thedad-backup.timer /etc/systemd/system/thedad-backup.timer
systemctl daemon-reload
systemctl enable --now thedad-backup.timer

log "Готово"
cat <<EOF

Дальше:
  1. sudo nano $HERE/.env       — впишите SYNC_DOMAIN и ACME_EMAIL
  2. cd $HERE && sudo docker compose up -d --build
  3. curl https://<ваш SYNC_DOMAIN>/health    → {"ok":true}

Подробности — в $HERE/README.md
EOF
