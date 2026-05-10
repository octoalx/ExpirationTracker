# ExpiTrack — Expiration Date Tracker

Web app for tracking product expiration dates with notifications via email and Telegram. Built with Next.js 14, TypeScript, Tailwind CSS, Prisma ORM + SQLite.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [First Run](#first-run)
- [Updating](#updating)
- [Backup & Restore](#backup--restore)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 24+ | BuildKit required for multi-stage builds |
| Docker Compose | v2+ | Plugin or standalone binary |
| Ports | 8881 free | nginx external port, configurable |

### Verify Prerequisites

```bash
docker --version
docker compose version
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/octoalx/ExpirationTracker.git
cd ExpirationTracker
```

### 2. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Generate secure secret for NextAuth
openssl rand -base64 32
```

Edit `.env` file:

```env
# Required
NEXTAUTH_URL="http://localhost:8881"
NEXTAUTH_SECRET="<paste-generated-secret-here>"
```

### 3. Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Build and start containers
./deploy.sh
```

### 4. Verify

```bash
# Check health
curl http://localhost:8881/

# View logs
docker compose logs -f
```

Access app: `http://localhost:8881`

---

## Configuration

### Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:/app/data/dev.db` | **Do not change** — SQLite path inside container |
| `NEXTAUTH_URL` | — | Full public URL (domain or IP) |
| `NEXTAUTH_SECRET` | — | 32-byte base64 secret |

### Optional: Email Notifications (SMTP)

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

For Gmail: use [App Password](https://support.google.com/accounts/answer/185833), not your login password.

### Optional: Telegram Notifications

```env
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrSTUvwxyz"
TELEGRAM_CHAT_ID="12345678"
```

To get `TELEGRAM_CHAT_ID`: message [@userinfobot](https://t.me/userinfobot).

### Notification Thresholds

```env
NOTIFY_BEFORE_EXPIRATION="3"    # Days before expiry to notify
URGENT_THRESHOLD="5"            # Red alert threshold (days)
WARNING_THRESHOLD="30"          # Yellow warning threshold (days)
```

---

## First Run

### Default Admin User

On first startup, the system auto-creates an admin user:

- **Email:** `admin@localhost`
- **Password:** `admin`

**Important:** Change this password immediately after first login via Settings → Profile.

### Initial Setup Steps

1. Login with default credentials
2. Go to Settings → Profile → change password
3. Configure notification channels (Email/Telegram)
4. Add your first products

---

## Updating

### Update to Latest Version

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
./deploy.sh
```

### What `deploy.sh` Does

1. Pulls latest source code
2. Rebuilds Docker images (`docker compose build`)
3. Runs database migrations (`prisma migrate deploy`)
4. Restarts services with zero-downtime

---

## Backup & Restore

### Automated Backups

The app creates daily backups at 03:00 (configurable in Settings).

### Manual Backup

```bash
# Create timestamped backup
cp ./data/dev.db "./data/backup-$(date +%Y%m%d-%H%M%S).db"

# Or backup to different location
cp ./data/dev.db /path/to/backups/expitrack-$(date +%Y%m%d).db
```

### Restore from Backup

```bash
# Stop app
docker compose down

# Replace database
cp ./data/backup-20250101.db ./data/dev.db

# Start app
./deploy.sh
```

### Database Location

The SQLite database is persisted via Docker volume:

```yaml
volumes:
  - ./data:/app/data
```

Local path: `./data/dev.db`  
Container path: `/app/data/dev.db`

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker compose logs app

# Verify database permissions
ls -la ./data/

# Check if port 8881 is in use
lsof -i :8881
```

### Database Migration Failures

```bash
# Reset database (WARNING: data loss)
docker compose down
rm -rf ./data/*
./deploy.sh

# Or manual migration
docker compose exec app npx prisma migrate deploy
```

### Permission Denied Errors

```bash
# Fix ownership (Linux)
sudo chown -R $USER:$USER ./data

# Fix permissions
chmod 755 ./data
chmod 644 ./data/dev.db
```

### Cannot Login

- Verify `NEXTAUTH_URL` matches your access URL
- Check `NEXTAUTH_SECRET` is set
- Clear browser cookies for the site

### Email Notifications Not Working

- Verify SMTP settings in `.env`
- Check logs: `docker compose logs app | grep -i email`
- Test with `scripts/test-notifications.ts`

### High Memory Usage

Default limit: 512MB. Adjust in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 1G
```

---

## Architecture

### Container Structure

```
┌─────────────┐     ┌─────────────┐
│   nginx     │────▶│  Next.js    │
│   :8881     │     │   :3000     │
└─────────────┘     └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  SQLite DB  │
                    │ /app/data/  │
                    └─────────────┘
```

### Multi-Stage Dockerfile

| Stage | Purpose |
|-------|---------|
| `deps` | Install npm dependencies |
| `builder` | Build Next.js + Prisma client |
| `runner` | Production runtime (minimal) |

### Data Persistence

- **Database:** `./data/dev.db` (bind volume)
- **Logs:** `docker compose logs` (JSON driver)
- **No named volumes** — all data in `./data/`

### Security

- Runs as non-root user (`nextjs:nodejs`)
- Security headers via nginx (X-Frame-Options, XSS protection)
- Static assets served with immutable cache headers
- WebSocket support for HMR (dev only)

---

## Useful Commands

```bash
# View real-time logs
docker compose logs -f

# Restart only app
docker compose restart app

# Execute command inside container
docker compose exec app sh

# Run Prisma Studio (database GUI)
docker compose exec app npx prisma studio

# Check container resource usage
docker stats

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: data loss)
docker compose down -v
```

---

## Tech Stack

- **Framework:** Next.js 14 (Pages Router) + TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui components
- **Database:** Prisma ORM + better-sqlite3
- **Auth:** NextAuth.js with credentials provider
- **Notifications:** Nodemailer + node-cron + Telegraf
- **Deployment:** Docker + nginx (reverse proxy)

---

## License

MIT
