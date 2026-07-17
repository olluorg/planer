# THEDAD — статическая сборка + nginx. Собирается из исходников, ничего наружу не ходит.
# Сборка:  docker build -t thedad .
# Запуск:  docker run -p 8080:80 thedad          → http://localhost:8080
# Полный self-host с локальным AI: docker compose up -d   (см. docker-compose.yml)

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
