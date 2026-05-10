# ─── СТАДИЯ 1: Установка зависимостей ───
FROM node:22-alpine AS deps
RUN --mount=type=cache,target=/etc/apk/cache \
    apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Устанавливаем всё, включая devDependencies для билда
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --legacy-peer-deps

# ─── СТАДИЯ 2: Сборка приложения ───
FROM node:22-alpine AS builder
RUN --mount=type=cache,target=/etc/apk/cache \
    apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Временный URL для генерации клиента Prisma
ENV DATABASE_URL="file:./dev.db"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY prisma.config.ts ./prisma.config.ts

RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# Пересобираем better-sqlite3 для Alpine (нативные модули)
RUN npm rebuild better-sqlite3

# ─── СТАДИЯ 3: Финальный образ (Runner) ───
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Путь к базе данных внутри контейнера
ENV DATABASE_URL="file:/app/data/dev.db"

# Создаем пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Создаем папку для БД и даем права пользователю nextjs
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Копируем только необходимое из билдера
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Копируем зависимости, чтобы npx prisma работал в рантайме
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Копируем скрипт создания admin
COPY --from=builder /app/scripts ./scripts

# Подготавливаем входной скрипт
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown nextjs:nodejs /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]