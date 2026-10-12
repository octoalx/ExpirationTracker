# Telegram store assistant — 2026-10-06

## Goal and acceptance criteria

Implement one shared store with individual accounts, manager-controlled membership
and thresholds, a daily inspection workflow, and a Telegram assistant. Employees
can claim records, check availability, mark missing, and close whole batches as
sold, removed, or defective. Checked/missing records remain at risk until resolved.
Unselected accounts retain private inventories. No automatic account merging.

## Scope and approach

1. Add incremental SQLite migrations, store membership, audit events, expiring
   claims, optimistic versions, and an explicit preview/confirm inventory transfer.
2. Centralize inventory authorization and actions; update CRUD, imports, statistics,
   settings, email selection, JSON backup/restore, and account deletion.
3. Add responsive store/inspection screens and authenticated product deep links.
4. Add one server-configured Telegraf bot, expiring two-step account linking,
   private-chat menus/search/actions, durable webhook inbox and delivery outbox.
5. Preserve Europe/Minsk and personal notification times. Telegram warnings cover
   first entry into the warning band; urgent summaries repeat daily. Email retains
   its exact-threshold warning policy. Date-only expiry ends at the day's boundary.

## Risks and invariants

- Web identity comes from NextAuth; Telegram identity from a confirmed unique link.
  Current membership is checked on every operation. Manager is not system admin.
- Repeated updates/actions must not duplicate writes. Claims expire after ten
  minutes; conflicting product versions must not overwrite another employee.
- Preserve record IDs, nullable dates/quantities, status, and author on transfer.
  Shared records must survive account deletion. Restore pauses Telegram processing.
- Secrets remain server-side. Legacy bot credentials are retained in storage but
  never returned, accepted, or automatically activated.
- No production commands, deployments, live sends, or real database migrations.
  Delivery after an ambiguous network timeout cannot guarantee exactly once.

## Verification

Use migrated disposable SQLite, fake Telegram/SMTP, controlled clocks, behavioral
tests for access/transfer/actions/linking/inbox/outbox/restore/date boundaries,
TypeScript, context/harness, application suite, and diff review. Run release checks
and isolated build where feasible; report actual failures and skips. Verify UI with
isolated sessions and jobs disabled. Never start live transports during tests.

## Result and handoff

Implemented the shared store, explicit transfer, membership/threshold controls,
inspection queues, claims, versioned actions/audit, confirmed Telegram linking,
private-chat assistant, persisted webhook inbox and notification outbox. Updated
CRUD, imports, statistics, email scoping, account deletion and backup/recovery.
Recovery upgrades a temporary snapshot, preserves history and pauses Telegram.
SQLite backups capture committed WAL data; JSON export uses one transaction.

Verification on 2026-10-06:

- `npm run verify:release`: PASS, context, three harness tests, TypeScript and
  85 application tests; no failures or skips. Tests use disposable migrated SQLite,
  controlled calendar dates and fake Telegram/SMTP. Coverage includes transfer
  preservation, access revocation, claims/conflicts, duplicate callbacks, expired
  Telegram acknowledgements, warning-band entry, 429/blocked delivery, legacy
  migration history, WAL capture and paused recovery.
- `npm run build`: PASS with disposable `.verification/telegram/ui.db`, jobs
  disabled, empty bot token and isolated `.verification/telegram/next-build`.
- Browser: actual isolated manager sign-in/deep-link redirect, claim, missing and
  confirmed removal; checked/missing risk retained until resolution. Walk/team
  layouts checked at 320, 390, 768, 1024 and 1440 pixels without horizontal overflow;
  integration settings show an unconfigured bot correctly. No captured JS warnings
  or errors. Screenshot: `.verification/telegram/store-desktop.png` (ignored).
- `git diff --check`: PASS. No commit, push, deployment, production migration or
  real email/Telegram send was performed.

Activation procedure: `docs/engineering/telegram.md`. Public HTTPS webhook,
BotFather credentials, real Telegram delivery and native iOS remain unverified.
Production activation and store transfer require operator selection and a
separately authorized rollout. Pilot measures inspection time, unresolved risks,
duplicate inspections and unknown expiry dates. Partial quantities, OCR, voice,
shift escalation, group chats and multiple stores remain outside this scope.
