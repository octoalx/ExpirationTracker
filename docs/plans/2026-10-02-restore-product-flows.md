# Restore existing flows and handle unknown expiry

Date: 2026-10-02

## Goal and acceptance criteria

Restore the owner's previous Excel import and manual product-add behavior. Keep catalog camera lookup. Treat the supplied CSV/TXT ingestion as a completed one-time operator task, removing permanent file-specific UI. Unknown expiry must display as missing, never 1970, and must not count as expired. Preserve production rows.

## Diagnosis and risk

Read-only production query: 272 rows, 103 null expiry dates, zero numeric epoch dates. Existing date cells construct new Date(null). Restore the original Excel modal and endpoint from HEAD; its original default import date remains unchanged at the owner's request. Keep only scanner additions in manual form, preserving required expiry and original calculation. No schema or data migration is needed.

## Verification

Run application tests, typecheck, context checks and diff review. Add null-expiry regression coverage. Deploy this correction as continuation of the authorized server task after isolated runtime checks. Preserve the currently deployed image and create a fresh online database backup; do not repeat source imports.

## Local result and deployment preparation

Original Excel modal and API restored byte-for-byte from HEAD. Manual date calculation, required expiry and barcode editing behavior restored; camera/catalog lookup remains additive. CSV upload UI removed from the form. Table, cards and edit form handle missing expiry; dashboard expiry filter and statistics no longer treat null as epoch. Production data unchanged by the repair.

Fresh verify:release PASS: 15 application tests, typecheck, context and harness. Actual React table/card render tests confirm missing labels without epoch or expired badges. Diff reviewed. Candidate archive SHA-256: 2092d3d07042c4e457d4f741d4f042f0f6479f9d0b9036ef05dc6dd37797708e.

Online backup backups/pre-flow-fix-20261002.db and disposable restoration backups/flow-fix-rehearsal-20261002.db have 273 rows / 103 missing dates; integrity check OK, permissions restricted. Prior deployed image retained as expirationtracker-rollback:pre-flow-fix-20261002. Owner additions must be preserved.

## Deployment result

Completed 2026-10-02. Image expirationtracker-catalog:20261002-flow-fix, manifest-list ID sha256:84d39b64c80b6c92f4c80c4194a851d00757741a4937e23a7aeb2b8a8c4b4b90. Normal entrypoint passed on disposable production-copy SQLite with network/background jobs disabled. Authenticated catalog lookup and original Excel date behavior passed; test insertion was isolated.

After switching only app and reloading nginx: app healthy, sign-in HTTP 200, anonymous catalog HTTP 401, public Access HTTP 302. Read-only reconciliation preserved all 273 prior product rows including every name, barcode, expiry, quantity, status and owner; 103 null expiry dates and 106 catalog rows unchanged. No production import or database rewrite occurred. Rollback image and backup retained. Phone camera remains physically unverified.
