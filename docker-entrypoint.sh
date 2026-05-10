#!/bin/sh
set -e

# Убеждаемся, что переменная БД установлена
export DATABASE_URL="file:/app/data/dev.db"

echo "Current user: $(whoami)"
echo "Checking database directory..."

# Создаем папку, если она не была создана (на всякий случай)
if [ ! -d "/app/data" ]; then
  mkdir -p /app/data
fi

echo "Running Prisma migrations..."
# Выполняем миграции перед стартом
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Starting Next.js Standalone..."
# В режиме standalone главный файл — server.js
exec node server.js