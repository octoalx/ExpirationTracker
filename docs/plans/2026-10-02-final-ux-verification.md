# Final UX and administration verification — 2026-10-02

## Goal and acceptance
Close outstanding local verification for the approved redesign. Inspect authentication, settings, import and expanded inventory on phone and desktop sizes. Exercise administrator role/password operations and JSON recovery using disposable SQLite only. Run the release gate and isolated production build. Verify Windows plugin hook exit status separately from project code.

## Risks
Real camera, vibration, phone keyboard and device safe areas require physical-device evidence. Never enable real transports or background jobs. Backup services use the workspace backup directory even in development: do not call live backup creation/restoration from the preview. Use isolated handlers and storage instead. Preserve unrelated work; no deployment, commit or push.

## Findings and bounded repair
JSON restore converted null expiry to the Unix epoch. Corrected null preservation, validated date/mode before mutation and wrapped the entire restore in a transaction. A regression test reproduces the old null failure and verifies rollback after a later duplicate-key failure. JSON export omits password hashes; clarified this limitation in the UI rather than introducing credentials into exports.

## Verification
- PASS: release gate (context, three harness tests, typecheck and 23 application tests); no skips. Fresh focused admin test also includes actual file-recovery handler on disposable SQLite.
- PASS: schema migration SQL applied in order to disposable storage; role changes, invalid-role rejection, password reset/hashing, non-admin rejection, JSON create/update null dates, optional quantity, status and barcode preservation. Invalid replacement dates do not erase data; later database errors roll back replacement deletion.
- PASS: file-recovery handler restores a closed disposable snapshot, preserves password hashes and creates an intact emergency copy of pre-restore data. This does not verify concurrent production writes, WAL behavior or multiple app workers.
- PASS: manual browser inspection of sign-in/registration, authenticated login, expanded/selected mobile records, add form and file-import entry, settings tabs/Telegram/SMTP controls at 360/390 px, desktop inventory and Excel modal at 1440 px. No overflow in measured settings views. No real integrations were saved or triggered; actual Excel file upload was not repeated.
- Fixed clipped settings tabs using a three-column layout; added programmatic field labels and integration switch names. Screenshots are ignored evidence under .verification/mobile-ux/.
- PASS: direct Stop and PostToolUse Windows hook launches both exit 0. The app's subsequent real hook scheduling remains unverified.
- PASS: optimized build with jobs disabled. The first build conflicted with the active dev cache; restarted the isolated preview and verified authenticated products HTTP 200. Added optional NEXT_DIST_DIR and rebuilt under .verification/release-build to isolate subsequent builds.
- BLOCKED: additional production-mode startup on port 3108 was rejected by automatic tool approval; no reason beyond policy blocking was provided. Did not retry through another mechanism.
- No production deployment, real-data recovery, commits or pushes.

## Physical-device follow-up
Run against an HTTPS preview containing this revision; localhost on the desktop is not a phone-accessible preview. Check camera permission, barcode decoding, permission-denied/manual-code fallback, keyboard occlusion of save controls, date entry, bottom navigation safe areas and reduced-motion behavior. Optional vibration depends on browser/device support. Exercise known barcode lookup and unknown barcode registration, then compare the saved record on desktop. These checks require the owner's device and remain pending.

## Recovery limitations before deployment
JSON replacement recreates accounts without passwords because JSON exports intentionally omit hashes; it is not a full credential-preserving backup. Use a verified database snapshot for full recovery. The file-recovery path still needs an operational recovery procedure with app writes stopped; this run is evidence for isolated recovery only.
