#!/bin/bash
set -e

echo "=== ExpirationTracker Deploy ==="

# Check .env exists
if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

# Check port 80 is free
if ss -tlnp 2>/dev/null | grep -q ':80 ' || netstat -tlnp 2>/dev/null | grep -q ':80 '; then
  echo "ERROR: Port 80 is already in use. Free it before deploying."
  exit 1
fi

echo "[1/4] Stopping existing containers..."
docker compose down --remove-orphans || true

echo "[2/4] Building image (no cache)..."
docker compose build --no-cache

echo "[3/4] Starting containers..."
docker compose up -d

echo "[4/4] Waiting for health check..."
RETRIES=12
until curl -sf http://localhost/ > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    echo "ERROR: App did not become healthy in time. Showing logs:"
    docker compose logs --tail=50
    exit 1
  fi
  echo "  Waiting... ($RETRIES attempts left)"
  sleep 5
done

echo ""
echo "=== Deploy successful! ==="
echo "App is available at: http://localhost"
