FROM node:20-alpine
WORKDIR /app
# npm ci по lockfile — одинаковые версии зависимостей в каждой сборке.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.js ./
# Не от root: при уязвимости в зависимостях у атакующего не будет прав в контейнере.
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "index.js"]
