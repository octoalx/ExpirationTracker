# Telegram store assistant

## Architecture and access

One `main` store uses individual NextAuth accounts and MANAGER/EMPLOYEE membership.
Users outside a store keep personal inventory. Web APIs derive identity from the
session; Telegram private-chat actions resolve a confirmed Telegram ID and verify
current membership on every operation. A manager is not a system administrator.
Shared records survive author deletion. Claims last ten minutes; record versions
prevent stale updates. Audit events distinguish physical checks from resolved risk.

Telegram uses the existing Node/Next.js process, Telegraf's server API client, a
durable SQLite inbox/outbox, and webhook delivery. There is no polling process,
Mini App authentication, Redis dependency, or public token. The supported v1
deployment is one application instance using the existing SQLite volume. Stop
other writers for file restoration; multiple replica rollout is outside v1.

## Authorized activation procedure

The staged rollout and recovery limits are documented in
[activation preparation](../plans/2026-10-06-telegram-activation.md).

1. Review the revision, run the release gate, verify a representative migration and
   recovery on disposable storage, and take a consistent SQLite backup. Production
   migration/deployment is a separate authorized task.
2. Create a bot with BotFather and configure `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_BOT_USERNAME` (without `@`) and `TELEGRAM_WEBHOOK_SECRET` on the server.
   The secret must use 1–256 letters, digits, underscores or hyphens. Set
   `NEXTAUTH_URL` to the public HTTPS origin without credentials, path, query or
   fragment. Never commit or expose these values.
3. Apply the incremental Prisma migration using the normal deployment procedure.
   It creates empty integration tables and preserves existing product values;
   it does not merge users or send notifications.
4. An administrator opens **Обход → Перенос базы**, chooses the store name,
   manager and source accounts, reviews the preview, then confirms. Duplicates are
   retained. Empty accounts may subsequently be added by the manager by email.
   Promote a replacement manager through the same admin transfer screen before
   deleting the previous manager account.
5. Preview registration with `node scripts/setup-telegram.mjs`. It performs no
   network calls. During authorized activation run the same command with `--apply`.
   It verifies bot identity, registers commands and sets a secret-protected HTTPS
   webhook without discarding pending updates. Do not run against the real bot in
   offline development or tests.
6. Pilot employees connect Telegram in **Настройки → Интеграции**, open the bot,
   press Start and confirm the displayed account in their web session. Invitations
   do not bypass account linking. Re-linking invalidates old action buttons.
7. Check **Обход → Telegram** as ADMIN: processing pause, delivery results and
   failed inbound updates. Start with a small team; confirm actual client messages,
   search, a claim conflict, one resolved batch, and one still-active checked batch.

The public tunnel/nginx must allow the webhook path without a browser login or
interactive challenge. The endpoint verifies the Telegram secret header and only
acknowledges updates after persistence. Local fake transports do not prove public
webhook connectivity or real Telegram/iOS behavior.

## Notification policy

Operational dates use Europe/Minsk. Stored expiry dates are calendar labels; the
expiry day is still `today`, and overdue starts on the following calendar day.
No device timezone shifts the label. Optional dates/quantities remain optional.

Personal urgent/warning times remain in Settings; members share store thresholds.
Telegram urgent summaries include active urgent and overdue batches every day.
Warnings include newly entered batches in the warning band, including late-added
batches. They repeat only after leaving and re-entering the band or a changed date
or threshold. Equal times produce one combined summary; empty reports are omitted.
New entries after that day's report appear at the next scheduled report. Email
keeps its exact-warning-threshold policy and independent enablement/SMTP settings.

The worker runs every ten seconds and schedules on each cron minute. Restart
recovers due work for the current day, not a backlog of old daily reports. Telegram
429 honors `retry_after`; network/5xx failures receive up to five retries. The
transport aborts a request after fifteen seconds. Blocking the bot marks delivery
unavailable until the user unblocks and interacts again. Ambiguous timeout/crash
after a Telegram acceptance can duplicate a message, but not a product action.

## Recovery, diagnostics and pilot

JSON v2 backups include stores, membership, audit, linked accounts, warning state
and delivery history. Ephemeral claims, callback tokens, linking requests and raw
inbox messages are not restored. SQLite recovery validates/upgrades a temporary
snapshot before replacement. Legacy JSON replacement restores personal records.
All recovery pauses Telegram and cancels pending deliveries; inspect ownership and
date calculations before an administrator explicitly resumes processing. Never
restore production storage as a routine development repair.

Pausing through **Обход → Telegram** stops new processing. A transport call already
in progress may finish; restore refuses until the application worker is idle.
Health information contains sanitized codes and delivery state, never raw API
errors or token-bearing URLs. Inbox IDs remain as deduplication tombstones; completed
message bodies are cleared after a day. There are no read-receipt assumptions.

Record baseline and pilot inspection time, warning-to-resolution time, duplicate
physical checks, active overdue records and unknown dates. Financial loss reduction
cannot be claimed without actual price/loss data. Partial quantities, discounting,
shift assignment/escalation, group chats, OCR and voice input are deferred.
