# Catalog deployment to the existing VPS

## Goal and acceptance criteria

Deploy the reviewed catalog/camera/TXT implementation to the existing expiry.axnode.xyz service at the owner's explicit request. Apply the additive catalog migration and import the supplied 106 catalog entries and 272 non-OLD batches into the sole existing account. Verify health, ownership boundaries, source counts and calculated dates.

## Scope and approach

The server checkout is clean at ded6d7151dcdd8d98a76b703b880bbb5830826f2. Local source is based on c228be7 with the reviewed working-tree changes. Package a clean Git archive with explicit changed/new source files; identify the archive by SHA-256. No Git push or history change is needed. Build a separately tagged Docker image while the existing service runs; disable background jobs during image compilation. Deploy the built image with the existing Compose configuration and reload nginx after app health is confirmed.

## Risks and recovery

Before changes, create a consistent online SQLite backup using better-sqlite3 and preserve the current image sha256:2b57312c7da273f8e4a9e0d53bc53166e279bd1033e508079e57dd36a7c8ae04 with a rollback tag. Rehearse backup restoration and additive migration on disposable storage. Existing production has one ADMIN user, zero products and disabled email/Telegram notifications. Import into that verified sole owner in one transaction and refuse to repeat inventory insertion if rows already exist.

Rollback re-tags the preserved old image and recreates only app, then reloads nginx. The additive catalog table can safely remain in SQLite for the old app; do not remove tables or restore over live data routinely. If database recovery becomes necessary, stop and assess the saved backup and intervening writes before restoration. Do not use deploy.sh: its Git pull is unnecessary and its full Compose shutdown would stop the tunnel during compilation.

## Verification

Fresh local verify:release passed all required gates (13 application tests). Require the Linux Docker build, isolated container runtime/auth checks with jobs disabled, representative backup/migration rehearsal, production health and database source reconciliation. Physical-phone camera verification remains manual.

## Result and handoff

Completed 2026-10-02. Final deployed source archive SHA-256: `9ad864928ea6280500fb3f3dbd0318b0570f9b002f459e502621cc449de09bac`. Candidate tag: `expirationtracker-catalog:20261002-offline-start`; image config: `sha256:cd99ba7bf633e89d814a51ae835d6988c48fe9b2ccc5252d6ffcd9501354ac9e`. No Git commit or push was performed; source was deployed by archive.

Consistent backup: `backups/pre-catalog-20261002.db`. Disposable restoration and additive migration preserved the existing user and passed integrity checks. Backup and source payload permissions are restricted. The prior image remains tagged `expirationtracker-rollback:pre-catalog-20261002`.

Initial deployment exposed CRLF in the archived shell entrypoint and was immediately rolled back before production migration or import. The final image normalizes the entrypoint, uses Node 22's built-in TypeScript execution for ensure-admin instead of downloading tsx at startup, and binds Next.js to 0.0.0.0. Its normal entrypoint passed an isolated network-disabled runtime check with background jobs disabled, authenticated dashboard, catalog import/lookup, inventory source reconciliation and unauthorized API rejection.

On the memory-constrained VPS, dependency stages were built sequentially. Builder inherits deps and runner inherits production-deps to avoid large cross-stage dependency copies. Runner retains system build tools as an image-size tradeoff.

Production migration and atomic import completed: 106 catalog entries, 272 ACTIVE batches, 103 null expiry dates and null quantities. OLD rows excluded. Full barcode/name/expiry multiset reconciliation against parsed source: PASS. Existing sole ADMIN ownership verified; email and Telegram notification settings remain disabled.

Production checks: app healthy; nginx sign-in HTTP 200; anonymous catalog HTTP 401; public HTTPS HTTP 302 to existing Cloudflare Access. Tunnel and nginx remained running. Physical phone camera remains unverified. Do not repeat the inventory import: it creates additional batches.
