# Architecture decision records

Short records of decisions that are expensive to rediscover. One decision per
file, numbered, never edited after acceptance: a changed decision gets a new ADR
that supersedes the old one.

Status values: `Accepted`, `Superseded by ADR-NNNN`, `Deprecated`.

- [ADR-0001](0001-department-is-the-only-product-scope.md) — a department is the only product scope
- [ADR-0002](0002-administrator-has-no-product-rows.md) — the administrator sees no product rows
- [ADR-0003](0003-sqlite-in-wal-with-journal-quarantine.md) — SQLite runs in WAL, corrupt journals are quarantined
- [ADR-0004](0004-tests-stay-offline-from-instrumentation.md) — tests stay offline from instrumentation
- [ADR-0005](0005-release-is-manual.md) — release is a manual, approved workflow run
- [ADR-0006](0006-cron-stays-in-europe-minsk.md) — cron and expiry boundaries stay in Europe/Minsk
- [ADR-0007](0007-spec-first-with-an-approved-spec-gate.md) — spec first, owner approves, gate enforces it

New records are created from the structure of ADR-0007.
