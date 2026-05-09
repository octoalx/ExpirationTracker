# ExpirationTracker — Docker Deploy Guide

## Requirements

- Docker 24+
- Docker Compose v2 (`docker compose` not `docker-compose`)
- Port 80 available on host

## First-time setup

```bash
# 1. Clone
git clone <repo-url>
cd ExpirationTracker

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in required values:
#   NEXTAUTH_SECRET  — generate with: openssl rand -base64 32
#   NEXTAUTH_URL     — set to your server's URL (e.g. http://your-server-ip)
#   SMTP_*           — for email notifications (optional)
#   TELEGRAM_*       — for Telegram notifications (optional)

# 3. Deploy
chmod +x deploy.sh
./deploy.sh
```

## Verify

```bash
curl http://localhost/
# Should return HTML of the app
```

## Common commands

```bash
# View logs
docker compose logs -f

# View app logs only
docker compose logs -f app

# Restart app
docker compose restart app

# Stop everything
docker compose down

# Update to latest code
git pull
./deploy.sh
```

## Database backup

SQLite DB is stored in `./data/dev.db` on the host.

```bash
# Manual backup
cp ./data/dev.db ./data/backup-$(date +%Y%m%d-%H%M%S).db

# Restore from backup
docker compose stop app
cp ./data/backup-<timestamp>.db ./data/dev.db
docker compose start app
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path — keep as `file:/app/data/dev.db` |
| `NEXTAUTH_URL` | Yes | Full URL of the app (e.g. `http://your-server-ip`) |
| `NEXTAUTH_SECRET` | Yes | Random secret — `openssl rand -base64 32` |
| `SMTP_HOST` | No | SMTP server for email notifications |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_CHAT_ID` | No | Telegram chat ID |

## Troubleshooting

**App won't start:**
```bash
docker compose logs app
```

**Port 80 in use:**
```bash
sudo ss -tlnp | grep :80
# Kill or stop the process using port 80
```

**Migrations failed:**
```bash
docker compose exec app npx prisma migrate deploy
```
