# Telegram activation preparation — 2026-10-06

## Goal and acceptance criteria

The owner authorized launch preparation without production changes. Produce a
reviewable rollout/recovery procedure and verify the registration command offline.
Preview must make no Telegram calls; apply must validate bot identity before
changing commands/webhook, preserve pending updates and never print credentials.
No commit, push, remote connection, deployment, migration or live send is authorized.

## Current readiness

- Local implementation: 85 application tests, three harness tests, context,
  TypeScript and isolated Next.js build passed. Responsive inspection actions were
  exercised against disposable SQLite with jobs disabled.
- Docker Compose loads `.env`; the existing entrypoint runs Prisma migrations
  before starting the application. The image includes scripts and migration files.
- Local `.env` is absent. No BotFather token, username or webhook secret has been
  provided. Server configuration has not been read or changed during this task.
- The recorded production target is `Alex@146.103.42.228:34657`, workspace
  `/home/Alex/ExpirationTracker`, public origin `https://expiry.axnode.xyz`.
  Reconfirm it during the authorized rollout; prior deployment evidence is in
  `2026-10-06-settings-deployment.md`. Its checkout contains unrelated changes;
  build an exact reviewed source archive instead of pulling/resetting it.

## Preparation work

1. Extract registration into an injectable command and test preview, validation,
   identity mismatch, apply ordering, pending-update preservation and safe errors.
2. Run affected tests, release gate and diff review. Record executed results.
3. Document staged activation, observable acceptance and realistic rollback limits.

## Authorized rollout procedure (not executed)

1. Obtain explicit rollout permission, bot credentials through a secure channel,
   desired manager/source accounts and notification settings. Never paste tokens
   into chat, command arguments, logs or version control. The owner may create the
   bot with BotFather and populate the server's restricted `.env` directly.
2. Select an exact reviewed commit/source archive, record its digest and keep the
   current image/configuration. Check the actual running revision, disk space,
   migration history and single-instance SQLite ownership. Do not run `deploy.sh`:
   it pulls `main` and stops the deployment before building.
3. Build the candidate without stopping production. Rehearse migrations/startup
   and JSON/SQLite recovery on an isolated representative database copy, with
   integrations replaced and background jobs disabled. Compare every existing
   product field and all unaffected tables before/after; verify integrity/FKs.
4. Schedule a brief write freeze and stop application writers. Take a consistent
   pre-migration SQLite snapshot, validate integrity and record table fingerprints.
   Retain the snapshot, old image and restricted configuration for recovery.
5. Apply migrations with the candidate under maintenance and jobs disabled. Check
   existing counts/values; new store/integration tables must be empty. Insert
   `IntegrationState('telegram', paused=true)` using a reviewed administrative
   operation so processing stays paused while registration is prepared.
6. Start the candidate, confirm health, sign-in, personal inventory, import and
   settings. Existing email schedules remain unchanged. Before any shared-store
   transfer, confirm the chosen accounts and preview counts/possible duplicates.
7. Configure the three Telegram variables and the public HTTPS origin securely.
   Inside the candidate container, run `node scripts/setup-telegram.mjs` first.
   During authorized activation run `node scripts/setup-telegram.mjs --apply`.
   Verify webhook reachability and that the proxy forwards the secret header.
   Keep existing tunnel/Access rules; add only a reviewed webhook exception if
   an interactive challenge blocks Telegram requests. Never expose private APIs.
8. Perform the reviewed store transfer, preserving IDs, timestamps and duplicate
   batches. Link a small pilot team through web confirmation. An ADMIN resumes
   Telegram via **Обход → Telegram** only when ownership/configuration are correct.
9. Confirm real private-chat search, different batches sharing a barcode, claim
   conflict, valid check/missing action and confirmed whole-batch closure. Check
   actual scheduled warnings/urgent delivery and delivery status without changing
   the agreed frequency. Keep a pilot log; expand only after reviewing it.

## Recovery and stop conditions

Stop activation on migration/data mismatch, failed health/sign-in, unexpected
ownership access, broken claims, wrong bot identity or inaccessible webhook.
Pause Telegram immediately on unexpected delivery behavior. Revoke/rotate leaked
credentials through the authorized operator; never print raw transport errors.

Before transfer or new writes, the old image and pre-migration snapshot can restore
the prior service during the write freeze. Validate the restored snapshot first.
After transfer or new writes, an old image alone is not a coherent rollback: it
does not implement store membership or the new action semantics. Prefer pausing
Telegram and repairing the current release. A snapshot rollback would discard
subsequent writes and requires an explicit decision about preserving/reconciling
them. Do not automatically overwrite the database. Restores pause Telegram and
invalidate pending actions/deliveries; verify ownership before resuming.

## Verification result

Preparation completed locally. Registration now uses an injectable transport;
preview never instantiates it. Origin validation rejects credentials, paths,
queries/fragments and malformed URLs. Unknown arguments fail instead of silently
selecting a mode. Apply checks identity before mutations and preserves updates.

- Four offline registration tests: PASS; no network access or live transport.
- Actual CLI preview with synthetic `example.invalid` configuration: PASS, no API
  calls, token and secret absent from output. No `.env` file was created.
- `node --check` on both registration modules: PASS.
- `npm run verify:release`: PASS, 89 application tests, three harness tests,
  context and TypeScript; zero failures or skips.
- Diff review and `git diff --check`: PASS.

Production, public webhook, real messages and native iOS remain untouched/unverified.
No remote commands, deployment, production migration, commit or push occurred.
Launch still needs BotFather credentials, manager/source-account selection and
explicit rollout authorization. Implementation evidence and deferred product scope
remain in `2026-10-06-telegram-store-assistant.md`.

Subsequent authorization and the completed production rollout are recorded in
`2026-10-06-telegram-production.md`; the preparation-only limitations above describe
the state before that authorization.
