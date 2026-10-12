# Operational statistics and mobile administration — 2026-10-02

## Goal
Rebuild statistics around actionable expiry monitoring and make administration usable on phones within the approved light design system.

## Acceptance
- Expiry risk applies to ACTIVE records; archive and defect remain visible as separate inventory counts.
- Missing expiry is explicit and never treated as expired or safe. Calendar-day boundaries match inventory, including today.
- Statistics lead with risk counts and accessible record-edit links; optional quantity is not presented as an error. Remove inferred category charts and unrelated quantity rankings from the primary view.
- Retry, loading and empty states work. Record links actually open inventory editing.
- Admin navigation has labels on phones, user actions fit without horizontal scrolling, logs wrap and backup controls remain usable.
- Preserve verified session ownership, server role checks, notification schedules and existing admin mutation behavior.

## Risks and checks
Expiry summaries change to active-record scope; explain the denominator in UI. Keep existing API fields while adding explicit unknown-date fields. Test null dates, midnight/date boundaries, archived/defect exclusion, account scope and authorization with fake transports/dependencies. Run typecheck, app tests, whitespace/diff review. Attempt browser inspection and disclose blocked evidence. No production changes or live admin mutations.

## Outcome and verification
- Replaced chart-heavy statistics with actionable risk summaries, expiry lists, missing-date records, inventory status counts and secondary notification context. Links open the matching inventory edit dialog.
- Fixed null-expiry API failure, scoped risk to ACTIVE records, used calendar-day boundaries and respected zero-valued thresholds. Existing account ownership and API fields retained.
- Added mobile user cards, labelled administration navigation, expandable log metadata and wrapping backup controls. Admin components mount only for an ADMIN session; server authorization retained.
- Fresh typecheck PASS; application tests 22/22 PASS, no skips; context check and diff whitespace check PASS. Statistics tests also PASS in Europe/Minsk and America/Los_Angeles.
- Isolated browser verification: statistics risk/missing-date fixtures and edit link; admin users, journal and backup views at 360/390 px; desktop users at 1440 px. No horizontal page overflow in checked mobile views. Screenshots saved under ignored .verification/mobile-ux/.
- Preview uses disposable storage and disabled background jobs. No production deployment, backup restoration, user-role changes or real notification sends. Physical phone interactions and administrative mutations remain unverified.
