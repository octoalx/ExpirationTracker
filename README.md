# ExpirationTracker

Web app for tracking product expiration dates with notifications via email and Telegram.

## Quick Start (Docker)

### Requirements

- Docker 24+
- Docker Compose v2
- Port 8080 free on host

### Deploy

```bash
# 1. Clone
git clone https://github.com/octoalx/ExpirationTracker.git
cd ExpirationTracker

# 2. Configure
cp .env.example .env

# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Edit .env and fill:
#   NEXTAUTH_SECRET=<generated-secret>
#   NEXTAUTH_URL=http://localhost:8080 (or your server IP)

# 3. Deploy
chmod +x deploy.sh
./deploy.sh
```

### Verify

```bash
curl http://localhost:8080/
```

App runs at `http://localhost:8080`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path — keep `file:/app/data/dev.db` |
| `NEXTAUTH_URL` | Yes | Full URL, e.g. `http://192.168.1.10` |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `SMTP_*` | No | Email notifications |
| `TELEGRAM_*` | No | Telegram notifications |

## Management

```bash
# Logs
docker compose logs -f

# Restart
docker compose restart app

# Stop
docker compose down

# Update
git pull && ./deploy.sh

# Backup DB
cp ./data/dev.db ./data/backup-$(date +%Y%m%d).db
```

## Tech Stack

- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma ORM + SQLite
- NextAuth.js
- Docker + nginx

## License

MIT
