# Partial settings saves — 2026-10-06

Save only changed fields from the active settings tab. Keep other tab drafts and
mark unsaved tabs. The authenticated API accepts partial profile/settings updates,
merges dependent validation with stored values, and writes only submitted fields.
Disabled email integrations may retain incomplete drafts; validate recipient and
SMTP port when enabled and changed, or when enabling. Login email/password changes
still require the current password. Preserve shared-store threshold authorization.

Acceptance: unrelated invalid legacy fields cannot block a partial save; omitted
fields and stored SMTP passwords survive; threshold ordering checks the effective
pair; conflicts remain atomic; tab switching preserves drafts; successful save
clears only the saved tab's changes and password inputs.

Risks: legacy full requests remain supported, concurrent saves must not overwrite
unsubmitted fields, and secrets must not appear in errors. No schema, scheduling,
deployment or live integration changes. Verify disposable SQLite API regressions,
tab payload behavior, typecheck and focused diff review.

Completed: tab patches and saved snapshots isolate fields; disabled email accepts
draft recipient/port values; enabling validates retained values. Profile changes
preserve credential checks, settings-only saves do not touch profile records,
and threshold updates validate against the stored/shared counterpart.

Verification: all 90 application tests and 3 harness tests passed with no skips;
typecheck, context check and focused diff whitespace check passed (CRLF-aware).
Browser/native iPhone interaction and deployment were not exercised.
