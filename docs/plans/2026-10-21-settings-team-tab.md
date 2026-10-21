# Settings: a department team tab for the manager

Branch: `local/settings-team-tab`. Date: 2026-10-21.

## Goal and acceptance criteria

Hiring people was only reachable through `/store` → «Команда», and nothing in
«Настройки» pointed there. The owner asked to make it obvious.

Acceptance criteria:

1. The manager (`storeRole === "MANAGER"`) sees a fourth settings tab «Команда»
   that lists the department, creates employees, resets an employee password,
   renames the department and edits its thresholds — without leaving Settings.
2. An employee (`storeRole === "EMPLOYEE"`) sees a read-only «Команда» tab: the
   member list and a note that hiring belongs to the manager.
3. An account without a department — the administrator included — does not see
   the tab at all, and thresholds stay editable only through Settings for it.
4. Nobody but the manager can change department thresholds: the 403 in
   `/api/settings` stays in force for employees and for a support visit.
5. The `/store` «Команда» screen keeps working unchanged.

## Scope and approach

- `src/lib/server/departments.ts`: `saveDepartmentThresholds()` — manager-scoped
  update of a department (`requireManager`), validation identical to the current
  settings rule (integers, non-negative, warning >= urgent); a support visit
  (`user.role === ADMIN`) is refused, because it may not reconfigure a department.
- `src/pages/api/store/settings.ts`: accepts `urgentThreshold`/`warningThreshold`
  next to the existing fields, via the new function.
- `src/components/store/StoreTeam.tsx`: gains `variant="settings"`. In that mode the
  thresholds form posts to `/api/store/settings` (it previously posted to the same
  endpoint, which rejects thresholds with 403 — a real defect), the department is
  renamed (manager only) through the new `PUT /api/store/members`, and the
  misleading «Таблица у отдела одна…» copy is trimmed. `/store` behaviour is
  preserved because the defaults stay as they are.
- `src/pages/api/store/members.ts`: `PUT` renames the caller's department
  (`requireManager`), reusing `departmentName()`.
- `src/pages/settings.tsx`: tab list becomes dynamic — «Команда» is added when
  `storeRole` is `MANAGER` or `EMPLOYEE`; the tab renders `StoreTeam` with its own
  data fetch; the global «Сохранить эту вкладку» bar is hidden on that tab because
  it has per-form saving.
- `src/lib/settings-draft.ts`: `team: []` so the tab participates in the existing
  dirty-patch logic without inventing fields.

## Risks and invariants

- Identity still comes from the session; every department mutation is scoped by
  `requireManager`, and a support visit is refused for reconfiguration.
- No schema change, no migration, no notification side effects.
- Thresholds remain one row per department; the personal `Settings` row keeps its
  fallback use for accounts outside departments.
- UI: the manager threshold fields keep the current look; the tab is present for
  employees in read-only form, which is intentional (people can see the team).

## Verification

- `npm run test:app` (department-access, telegram-api, settings-draft suites at
  minimum), `npm run typecheck`, `npm run build`.
- Runtime: settings screen as manager — create an employee, rename the department,
  save thresholds; as employee — no hiring form.

## Result and handoff

Completed:

- `StoreTeam` gained `variant="settings"` and refreshes through its own loader; the
  `/store` panel is unchanged.
- Thresholds save through `POST /api/store/settings` (was a 403 defect); department
  rename went through a new `PUT /api/store/members`.
- Settings renders the «Команда» tab for any account with a department, hides the
  shared save bar on it, and the «Статусы» note now points at that tab rather than
  at an unrelated link.

Verification (actual results, after rebasing onto `origin/main` @ `f744cfa`):

- `npm run typecheck`: PASS.
- `npm run build`: PASS (`/settings` and `/store` prerender cleanly).
- `npm run test:app` (parallel, default): 102 PASS, 0 FAIL.
- `node --import tsx --test --test-concurrency=1` over department-access,
  telegram-api, settings-draft, store-inspection, inventory-thresholds,
  dialog-css: 28 PASS, 0 FAIL.
- `npm run check:context`: PASS.

Earlier in this branch, before the rebase, `typecheck` and `build` failed in
`prisma/seed-construction.ts` and two `telegram-api` tests were red. Both were
caused by the branch sitting on an older `main`: `75ec4e5` had already made
`Product.storeId` mandatory and fixed the seed, the report fixture and the restore
loader. After the rebase nothing was red, so no separate fix was needed.

Unresolved: browser walk-through of the new tab was not run.
