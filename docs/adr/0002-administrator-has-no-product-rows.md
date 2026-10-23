# ADR-0002: the administrator sees no product rows

Status: Accepted
Date: 2026-10-21
Applies to: `src/pages/api/admin/*`, `src/lib/server/departments.ts`, admin screens

## Context

The administrator operates the service: accounts, departments, backups, logs,
the shared barcode catalog and the Telegram bot. Before the department model the
admin could read and modify store data, which made every privacy statement false.

## Decision

The administrator manages the service but is not a participant of any department.
Product routes return 403 for a non-member, the administrator included. Diagnostics
that genuinely need visibility use an explicit, audited support visit
(`SUPPORT_ACCESS` / `SUPPORT_ACCESS_REVOKED` audit events, one visit at a time),
which still does not allow reconfiguring a department.

## Consequences

- Admin statistics no longer count products.
- Department threshold changes require MANAGER; a support visit is refused.
- Support visits are time-boxed and visible in the audit log, so access is
  accountable rather than implicit.

## Evidence

`docs/plans/2026-10-21-department-access-model.md`,
`tests/department-access.test.cjs`, `tests/telegram-api.test.cjs`.
