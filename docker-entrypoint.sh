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

# Verify writable
if [ ! -w "/app/data" ]; then
  echo "ERROR: /app/data is not writable by user $(whoami) (uid=$(id -u)). Fix: sudo chown -R 1001:1001 ./data on host."
  exit 1
fi

echo "Running Prisma migrations..."
# Выполняем миграции перед стартом
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Ensuring default admin user..."
# Создаем admin если нет пользователей
npx tsx /app/scripts/ensure-admin.ts

echo "Starting Next.js Standalone..."
# В режиме standalone главный файл — server.js
exec node server.js