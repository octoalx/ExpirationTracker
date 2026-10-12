# Telegram production rollout — 2026-10-06

## Authorization and goal

The owner supplied a BotFather token and explicitly authorized completing the
launch autonomously. Deploy the reviewed local implementation, configure the bot
and webhook, preserve existing records/accounts/preferences and confirm health.
No Git push or history rewrite. Credentials remain in restricted server settings.

## Confirmed target and scope

SSH: `Alex@146.103.42.228:34657`; application `/home/Alex/ExpirationTracker`;
public origin `https://expiry.axnode.xyz`. Current image revision is `f24d84f`,
image digest `04c549828ac17aa0d1be2510cd321bfab89a64e5751e2a0854b86bca510a7f3d`.
The modified server checkout is not the deployment source. SQLite integrity is OK,
with 437 products and four accounts. Build an exact working-source archive in a
separate release directory without changing that checkout.

Use the existing ADMIN as store manager and transfer its 434 records. Add the two
empty departmental accounts as employees. Preserve Oleg's three personal records
and account outside the store; including them would require a separate decision.
Keep manager thresholds and everyone's notification schedules/preferences. Account
linking remains a personal web-confirmed step; no account is linked automatically.

## Procedure and acceptance

1. Fresh local release gate and safe bot identity check. Record source archive hash.
2. Build candidate while the current application stays available. Rehearse schema
   migration and startup on a disposable representative snapshot, with jobs disabled,
   no network for the rehearsal application and fake integration credentials.
3. Retain current image/environment and a consistent final SQLite backup; stop
   application writers only for backup/migration/replacement. Check field preservation
   and unaffected-table fingerprints, then initialize the chosen shared-store scope
   atomically with audit and Telegram paused.
4. Replace only the application, preserving nginx/tunnel and other services. Verify
   health, auth boundaries, account access and static assets.
5. Create a specific Cloudflare Access application for the webhook path, with bypass
   at that path only; leave the parent application unchanged. The application still
   verifies the Telegram secret. Check root/private API Access remains enforced.
6. Register commands/webhook without dropping pending updates. Verify secretless
   webhook rejection, valid-secret persistence, real Telegram webhook status, and
   resume processing after configuration checks. No unsolicited employee messages.

## Recovery

Keep old image, environment and pre-migration snapshot. Before accepting new writes,
restore the old image/snapshot under the same write freeze if data or health fails.
After shared-store transfer/new writes, pause Telegram and prefer forward repair:
old code does not implement shared access, and restoring a snapshot discards new
activity. Obtain a specific reconciliation decision before any such rollback.
Never delete live storage or reset migrations. See `2026-10-06-telegram-activation.md`.

## Evidence

Rollout completed. Bot identity verified as `@expitrackbot`; token not printed.
Local gate passed 89 application tests, three harness tests, context and TypeScript.
The operator CLI now uses Node 22 environment loading without requiring dotenv
from development dependencies; affected offline tests and syntax check passed.

- Exact source archive SHA-256:
  `320d969fb2143cb993aec31b3f4b8d81365a449a9ba6a4676a084ebc26856314`.
  Linux Docker/Next.js build passed. Candidate/deployed image:
  `expirationtracker-telegram:320d969fb214`, image ID
  `sha256:089b1e903aa028d8fa968db64678f42bd89b2ed17b34f511864ee66b58c65c36`.
  Application health is healthy; only app was replaced and nginx reloaded.
- Representative migrated snapshot and transfer preserved fingerprints of every
  original column in all original data tables, excluding expected SystemLog and
  migration metadata. Rehearsal ran with no network, fake env, cleared account/SMTP
  credentials and jobs disabled. Auth boundaries, manager/employee/personal scopes,
  shared settings, store page, nine static assets and secretless webhook rejection
  passed. An operator-only sanitization fixture used the wrong backup-column name;
  corrected to `backupEnabled` and the remaining rehearsal passed before deployment.
- Final backup and environment recovery copy are restricted (0600):
  `/home/Alex/.codex-releases/expirationtracker-telegram-20261006/final-before.db`
  and `environment-before.env`. Old image retained as
  `expirationtracker-rollback:pre-telegram-20261006`. All previous column/table
  fingerprints matched again after production migration and after transfer, before
  enabling startup jobs. Products 437, users/settings 4 each, catalog 106 and
  shared catalog 444297 were preserved. SQLite integrity OK; FK errors zero.
- Shared scope: 434 products, one manager and two employees. Three personal products
  retained outside the store. No password, account profile or schedule changed.
- Cloudflare webhook Access app `2add2e75-cc32-4b7b-91c1-6768fde508a9` applies only
  to `expiry.axnode.xyz/api/telegram/webhook`; bypass policy
  `61a27baa-6587-49ee-bbdc-98563f0e0a44` permits transport to the secret-protected
  handler. Parent app `24e0b3f8-7161-496f-8d48-7fb548044fd0` remained unchanged.
  Public root and products API still redirect to Access (302).
- Registration preview and real apply passed. Telegram webhook reports the expected
  URL and zero pending updates. Public curl checks: missing secret 403, valid secret
  with invalid body 400, empty operator probe 200, duplicate probe 200 but one row.
  Worker resumed through the authenticated admin API; operator probe reached DONE.
  Telegram is configured and unpaused, with zero linked accounts.
- Python's default user agent triggered existing Cloudflare BIC error 1010 during
  the first public probe. Normal curl, empty agent and TelegramBot agent checks
  passed. No additional zone security rules were changed. Real client linking and
  scheduled employee delivery still need the employee's personal confirmation;
  no account identity was inferred from the bot token or linked automatically.
- No Git commit/push. Server modified checkout, tunnel and parent Access policy
  preserved. Operator evidence is under the restricted release directory; local
  helper artifacts are ignored under `.verification/telegram/activation/`.
- Final context check passed. The default whitespace check flagged Windows CRLF
  because repository `core.autocrlf` is currently false; the check with a per-command
  `core.autocrlf=true` passed. No owner Git configuration or file endings were changed.

The user-facing first-use flow is Settings → Integrations → Connect Telegram,
Start in the bot, then confirm the displayed account in the web application.
Native iOS and observed scheduled Telegram delivery remain pilot verification.
