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

Fresh release gate PASS: 38 application tests, 3 harness tests, typecheck and context. Build, isolated runtime, production health and preservation checks pending. Actual phone camera, keyboard and responsive visual checks remain device checks.
