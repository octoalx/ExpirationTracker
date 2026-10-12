# Admin and settings release — 2026-10-03

## Authorized goal and acceptance

The owner requested ordinary commits and deployment of all current changes. Commit the explicit reviewed application, migration, test and documentation files. Do not push without a push request. Deploy to the previously verified target Alex@146.103.42.228:34657, /home/Alex/ExpirationTracker, https://expiry.axnode.xyz.

- Release gate passes with no skipped checks.
- Build the exact committed source into an independently tagged candidate while production stays available.
- Rehearse normal startup, migrations, login, admin creation and critical existing flows on a disposable production snapshot with jobs and integrations disabled.
- Keep all production user, product, catalog, settings and account rows unchanged. Existing nullable manufacture metadata is preserved.
- Replace only the app, reload nginx and verify HTTP, assets, anonymous boundaries and database fingerprints.

## Scope and recovery

The working tree contains the previously deployed manufacture metadata, threshold and scanner changes plus settings input/layout fixes and admin account creation. No new migration beyond the already deployed additive manufacture metadata migration is expected. Preserve the server's unrelated modified source checkout; upload a Git archive to a new release directory. Avoid deploy.sh because it pulls main and stops the stack.

Keep the current image under a rollback tag. Make a restricted consistent SQLite backup and rehearse restoration on a separate copy. On failed startup or health checks, recreate the app with the retained image and reload nginx, without overwriting live storage. Match package-lock hashes before reusing the retained dependency builder.

## Verification and result

Fresh release gate PASS: 38 application tests, 3 harness tests, typecheck and context; no skips. Actual phone camera, keyboard and responsive visual checks remain device checks.

## Deployment evidence

- Application source commit: `4e3cf913d2ad7845ca5f9e64a5d3cf3d98c810f8`.
- Git source archive SHA-256: `07d9adcdec175121ece5fa6fc6320aaf948c6c4b899667d1f3e893788db28a95`; extracted only into `releases/20261003-admin-settings`. The server's modified checkout was preserved.
- Raw lockfile hashes differed because Git archive converted line endings. A deep equality check of the entire parsed lockfile against the retained builder passed. Canonical JSON SHA-256: `8872c1fd53842123bf27db8aa57438ee30c2a0f50d7dbd22447df915b2f92063`.
- Cached Linux build PASS. Candidate `expirationtracker-admin-settings:20261003`, deployed image ID `sha256:c64219e2c0a296710244025fcb2d834c6ba6f54cc17265627247a751527c0ed3`, image config `sha256:2a427aa25b5a482772130832068e40ebf75cd0cbd0ab12a2058206e740925830`.
- Restricted consistent online backups: `backups/pre-admin-settings-20261003.db` and `backups/pre-admin-settings-switch-20261003.db`, mode 600, integrity OK.
- Isolated snapshot restoration/migration and normal-entrypoint rehearsal PASS with network disabled, jobs disabled and integrations cleared. Actual admin/employee login, account creation, duplicate rejection, employee admin denial, owner isolation, threshold save/read/validation, manufacture editing, optional expiry, stats, pages and assets passed.
- No migrations were pending. Rehearsal and post-switch fingerprints match every original column in User (2), Product (434), CatalogEntry (106), Settings (1) and Account (0), including manufacture metadata.
- App-only replacement and nginx config/reload PASS. Application is healthy; startup initialized background jobs. Sign-in returns 200; anonymous products/catalog/thresholds return 401. Eleven production JS/CSS assets return 200, including the dynamic admin account form, manufacture editor and settings refresh code. Public HTTPS returns the existing Access redirect (302).
- Rollback image retained: `expirationtracker-rollback:pre-admin-settings-20261003`, ID `sha256:1a13c3b71e8052a06d82d75b3c98e5474a0751cf96565d6dc5a0f7962c1f7471`. Re-tag it as `expirationtracker-app`, recreate only app with `docker compose up -d --no-deps --no-build app`, then reload nginx. Do not restore over live data for image rollback.
- Server evidence lives under the release directory (`build.log`, `rehearsal.log`, `switch.log`, `before-switch.json`, `reconciled.json`). No credentials, databases, backups or logs were committed; no push or manual notification send was performed.
