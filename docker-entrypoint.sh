#!/bin/sh
set -e

mkdir -p /app/data

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Starting Next.js..."
exec npm start
