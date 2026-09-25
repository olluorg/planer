# Общие функции скриптов. Подключается через `source`, сам по себе не запускается.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # deploy/server
cd "$HERE"

log()  { printf '\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

# Читает .env построчно, без `source`: пароль с `$` или пробелом не должен
# превращаться в подстановку переменной или команду.
load_env() {
  [[ -f .env ]] || fail "нет $HERE/.env — запустите scripts/install.sh или скопируйте .env.example"
  local key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    # .env, отредактированный на Windows, приходит с CRLF: без этой строки в конец
    # каждого значения прилипает невидимый \r, и пароль шифрования перестаёт совпадать.
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    export "$key=$value"
  done < .env
}

compose() { docker compose "$@"; }

# Ждёт, пока /health ответит изнутри контейнера (без зависимости от DNS и TLS).
wait_healthy() {
  local i
  for i in $(seq 1 30); do
    if compose exec -T sync wget -qO- http://127.0.0.1:8787/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}
