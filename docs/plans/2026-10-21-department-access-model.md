# Department-scoped access model

Dated: 2026-10-21. Specification only — no code has been written and no production
data has been touched. Owner decisions from 2026-10-21 are recorded in "Decisions
taken". Open points that still need an owner answer are in "Open decisions".

## Goal and acceptance criteria

The service is a single store ("Магазин") that contains any number of departments
("отделы"). Every department has exactly one shared product table, one manager and
any number of employees. Nobody can read or write a table of a department they do
not belong to, including the platform administrator.

Observable behavior after implementation:

1. A visitor who registers gets a new department named by them, and is the manager
   of that department. No other account exists in it.
2. A manager creates an employee account with login and password, hands the
   credentials over, and the employee signs in with them and sees exactly that
   department's table.
3. Any member of a department — manager or employee — can add, edit, re-status and
   delete rows of that department's table. Deletion is no longer manager-only.
4. Only the manager of a department can create employees, reset their passwords
   and revoke their access.
5. No account, including the administrator, can see a product row of a department
   they are not a member of. The administrator's view contains no product data.
6. The administrator controls the service: all accounts, all departments, backups,
   restore, logs, the shared barcode reference and the Telegram bot. The
   administrator is not a member of any department and therefore has no table.
7. Every member can link their own Telegram account to the one shared bot and
   receives notifications about their own department only.
8. All product rows, users and memberships created before the model change are
   removed, leaving only the administrator account and the shared barcode
   reference. Employees and rows are recreated from scratch by the owner.

## Current state, as verified in code and live data

Two independent role scales exist today, and this is the root of the confusion:

| Scale | Field | Values | Grants |
| --- | --- | --- | --- |
| Platform | `User.role` | `USER`, `ADMIN` | `/admin` (guarded in `src/middleware.ts:9`): accounts, backups, restore, logs, email logs, issues, stats, shared catalog write, store transfer, Telegram runtime control |
| Department | `StoreMembership.role` | `EMPLOYEE`, `MANAGER` | In-team rights: `requireManager()` in `src/lib/server/inventory.ts:27` guards hiring, thresholds and shared-row deletion |

`ADMIN` does not imply `MANAGER` and vice versa. Visibility has exactly one
source, `inventoryScope()` (`src/lib/server/inventory.ts:13`): a member sees every
row with `storeId` equal to their store; a non-member sees only rows they own
with `storeId = null`.

Live production state (read-only query of `/app/data/dev.db` on 2026-10-21):
4 users, one store `main` named "Магазин", thresholds 3/100 days, 436 ACTIVE rows
all authored by the administrator, 3 members (administrator as `MANAGER`,
"Стройка" and "Краски" as `EMPLOYEE`), one user ("Олег") outside any team with 3
personal rows, 1321 audit events, 106 per-user catalog rows and 444,297 rows in
`SharedCatalogEntry`.

Two structural facts constrain the change:

- `Store.id` is the literal `"main"` in `src/lib/server/store-transfer.ts:22,36`,
  `src/pages/api/admin/store.ts:13` and the backup schema
  `src/lib/server/store-backup.ts:6-7`. One store is hardcoded in four places.
- `StoreMembership.userId` is unique, so a user belongs to at most one store. That
  constraint already matches the target model and should be kept.

The store entity is reused as the department entity. The service itself stays a
single tenant; "one store with departments" is expressed as "the service has many
department rows". The service-level container is not modeled as a table of its
own, because it would hold no data and no settings that the departments do not
already hold.

## Target model

### Roles

- `ADMIN` — platform operator. Owns accounts, departments, backups, logs, the
  shared barcode reference and the bot. Belongs to no department, sees no table.
- `MANAGER` — owns one department. Founds it or inherits it at registration, hires
  and releases employees, sets the department thresholds, works the table like
  everyone else.
- `EMPLOYEE` — member of one department. Works the table, manages own account
  settings and own Telegram link.

A department has exactly one manager. Ownership transfer is an administrator
action. This removes the ambiguity of "who decides who is hired" that two
simultaneous managers would create.

### Scoping invariant

> Any access to product rows requires a `StoreMembership`. There is no personal
> product scope.

`storeId = null` rows and the personal-scope branch of `inventoryScope()` are
removed. `Product.storeId` becomes non-nullable. This is the change that makes
"the administrator sees no table" true by construction rather than by convention.

The per-user barcode catalog (`CatalogEntry`) is separate and stays per user, but
`/api/catalog` gains a fallback read of `SharedCatalogEntry`. Today that table is
written by `src/pages/api/admin/catalog.ts:22` and never read anywhere — the
shared reference is dead weight while every employee has to import the same file
privately.

### Permission matrix

| Capability | ADMIN | MANAGER | EMPLOYEE |
| --- | --- | --- | --- |
| See / search / export rows of a department | — | own | own |
| Add row | — | own | own |
| Edit row, change status | — | own | own |
| Delete row | — | own | own |
| Walk, claim, inspection results | — | own | own |
| Excel import | — | own | own |
| Department statistics | — | own | own |
| Department thresholds (urgent / warning) | service-wide default | own | — |
| Team list (read-only) | all departments | own | own |
| Create employee account with login and password | — | own | — |
| Reset employee password | any account | own department | — |
| Revoke employee access | any account | own department | — |
| Own profile, own password, own notification settings | own | own | own |
| Link own Telegram to the shared bot | — | own | own |
| All accounts, role changes, password reset | all | — | — |
| Departments: list, appoint manager, delete, transfer | all | — | — |
| Backups, restore, logs, error log, email log, issues | all | — | — |
| Shared barcode reference (444k rows) | read + write | read | read |
| Telegram bot: token, pause, runtime | all | — | — |
| Service settings, default thresholds | all | — | — |

A row marked "own" is scoped to the caller's department membership. A row marked
"—" is refused with 403, not silently degraded.

## Scope and approach

### Schema changes (`prisma/schema.prisma`)

| Change | Detail |
| --- | --- |
| `Store.id` | becomes `@default(cuid())`; the literal `"main"` is no longer required or valid |
| `Store` | add `createdAt`; keep `name`, `urgentThreshold`, `warningThreshold` |
| `StoreMembership` | unchanged; `userId` stays unique, `role` stays `MANAGER`/`EMPLOYEE` |
| `Product.storeId` | becomes non-nullable, `onDelete: Restrict` retained |
| `Product.userId` | stays nullable, `onDelete: SetNull` retained — the author may be deleted while the row survives |
| `User` | add `mustChangePassword Boolean @default(false)` for manager-issued credentials |
| `User.role` | unchanged, `ADMIN`/`USER` |

Migrations are incremental. `src/lib/server/store-backup.ts:6-7` changes
`z.literal("main")` to `z.string()`. `src/lib/server/store-transfer.ts` and
`src/pages/api/admin/store.ts` are reworked: the personal-to-store transfer flow
is obsolete once every account belongs to a department, and is replaced by
department ownership transfer.

### API changes

| Route | Change |
| --- | --- |
| `POST /api/auth/register` | Creates `User` + `Store` (department name from the form) + `StoreMembership(MANAGER)` in one transaction. A registration no longer produces an account without a team. |
| `POST /api/store/members` | Replaces "attach an existing account" with "create an employee account": accepts name, email and password, returns the credentials once for hand-off. Rejects an email that already exists. |
| `POST /api/store/members/[userId]/password` | New. Manager of that department resets one employee password. |
| `DELETE /api/store/members` | Revokes membership, unlinks Telegram, cancels queued deliveries, releases the employee's rows from authorship while keeping the rows. |
| `POST /api/store/settings` | Unchanged surface, now guarded by department ownership. |
| `GET /api/catalog` | Falls back to `SharedCatalogEntry` when the user has no personal row. |
| `DELETE /api/products/[productId]` | Manager-only check removed; every member may delete a row of their own department. |
| `GET /api/products` | `canDelete` is true for any member, false for a non-member. |
| `POST /api/products` | Refused with 403 when the caller has no membership; a row can no longer be created without a department. |
| `POST /api/admin/departments` | New. Administrator creates, renames, appoints a manager for, transfers and deletes departments. |
| `POST /api/admin/users/[userId]/password` | Extended with the department context. |
| `POST /api/products/import`, `/api/store/worklist`, `/api/products/[id]/claim`, `/actions` | Membership becomes mandatory, not optional. |

`src/lib/server/inventory.ts` is the single place that resolves scope.
`inventoryScope()` stops returning a personal branch and raises 403 when the
caller has no membership. Every route that needs a department calls it, so the
rule is applied once.

### UI changes

- `/auth/register` asks for the department name; the account becomes its manager.
- `/store` becomes the department screen: table, walk, team, thresholds, own
  Telegram link. The "Команда" tab is manager-only for write actions and
  read-only for employees.
- Manager actions: create employee with credentials, reset password, revoke
  access, set thresholds.
- `/admin` gains a "Отделы" tab: list of departments, their managers, member
  counts, transfer of ownership, deletion. It keeps accounts, backups, logs, the
  shared reference and the bot. It shows no product rows.
- The administrator's dashboard shows service counters only, never rows.

### Telegram

The bot is already global: `TELEGRAM_BOT_TOKEN` comes from the environment and
`src/lib/server/telegram-jobs.ts` schedules per linked user. Linking already
requires a membership (`src/lib/server/telegram-link.ts:8`). Under the new model
this is exactly the required behavior — one shared bot, one link per member,
notifications limited to the member's department. The per-user
`Settings.telegramToken` and `telegramChatId` fields are vestigial because the
bot is global; they are left in place for the backup format and not written.

Administrator notifications about new registrations are an optional later step
and are not part of this change.

## Migration and reset

The owner approved starting from scratch: only the administrator account and the
shared barcode reference survive.

1. Take a verified backup of the live database and confirm it restores.
2. Ship the schema and code change with the data intact; `storeId` stays
   nullable for one migration cycle so the migration is reversible.
3. Verify the new model on the backup copy, not on production.
4. Purge, as an explicit owner-authorized step, in one transaction:
   `Product`, `ProductEvent`, `ProductClaim`, `TelegramWarning`,
   `TelegramDelivery`, `TelegramButton`, `TelegramUpdate`, `StoreMembership`,
   `Store`, and every `User` except the administrator. Keep `SharedCatalogEntry`,
   the administrator's `Settings`, `Account` and `Session` rows, `SystemLog` and
   `EmailLog`.
5. Make `Product.storeId` non-nullable in a second incremental migration.
6. The administrator creates departments and employees from scratch and re-enters
   the rows.

Step 4 is destructive and is not part of a routine deploy. It runs only on the
owner's explicit instruction, after step 1.

## Risks and invariants

- **Administrator loses table access.** Intended. If the owner ever needs to work
  rows, that is a deliberate temporary membership, logged as an audit event.
- **Deleting a row becomes a shared action.** Every member can delete. The
  deletion is a soft delete (`deletedAt`) and writes a `ProductEvent`, so the
  history stays recoverable and the actor is recorded.
- **A single manager per department.** If a manager leaves, the administrator
  must appoint a successor, otherwise the department is orphaned. The
  administrator panel lists departments with their manager for exactly this
  purpose.
- **A manager cannot be created by another manager.** Only the owner of a
  department may create employees, and only the administrator may appoint a
  manager. This is a deliberate reading of "кого удалять из сотрудника и
  добавлять решает только менеджер".
- **Registration is open to the world.** The owner accepts this. It is worth
  remembering that the site is not merely behind a Cloudflare Tunnel: on
  2026-10-21 a request to `https://expiry.axnode.xyz/auth/signin` returned a 302
  to `qwerybox.cloudflareaccess.com`, so a Cloudflare Access application stands
  in front of the application itself. Two other Access applications are visible
  in the account: "WGDashboard panel", which allows only
  `nassabelarus@gmail.com`, and "ExpiTrack Telegram webhook", which bypasses
  everyone. The policy of the application covering `expiry.axnode.xyz` was not
  read, because that check was not authorized. Until it is confirmed, "anyone
  can register" is an assumption, not a fact.
- **The shared barcode reference stays.** 444,297 rows are kept. It is the only
  asset in the database that is expensive to rebuild.
- **Timezone and expiry semantics stay untouched.** The change is about access,
  not about dates. The cron remains Europe/Minsk.
- **Invariants from `AGENTS.md` still hold.** Identity is derived from the
  verified session; product reads and mutations are scoped by the caller's
  department membership; store management requires `MANAGER`; admin operations
  require `ADMIN`; Prisma and credentials stay out of browser bundles; secrets
  are never logged.

## Verification

Behavioral tests to add, on disposable SQLite storage with fake notification
transports:

- Registration creates a department and a manager membership, atomically.
- A manager creates an employee; the employee sees only that department's rows.
- A member can delete a row of their own department; a member of another
  department receives 404 on the same row.
- A non-member receives 403 on list, create, import and worklist.
- A manager resets an employee password; the employee can sign in with the new
  password and must change it.
- A manager cannot create a second manager and cannot revoke access of a
  department they do not own.
- The administrator receives 403 on every product route and sees no row in any
  response.
- The shared barcode reference is returned when the user has no personal row.
- A revoked employee loses Telegram notifications.

Static and repository checks:

```
npm run typecheck
npm run test:app
npm run check:context
npm run test:harness
npm run verify:release
```

Existing tests that encode the old model and must be updated rather than
deleted: `tests/store-inspection.test.ts`, `tests/telegram-assistant.test.ts`,
`tests/telegram-api.test.cjs`, `tests/admin-account-creation.test.cjs`,
`tests/account-settings.test.cjs`, `tests/mobile-product-flow.test.ts`,
`tests/helpers/disposable.ts`.

Release evidence: manual sign-in as administrator, as manager and as employee;
a full round of table operations as each of the three; a Telegram link and a
real notification for one employee; a backup and a restore on a copy.

## Decisions taken

Recorded from the owner on 2026-10-21.

1. One store for the service, with any number of departments inside it.
2. A self-registered account becomes the manager of a new department and sees
   only that department.
3. A manager creates employee accounts with login and password and hands the
   credentials over; the employee signs in with them.
4. Employees work the shared table as a joint effort: every member may add,
   edit, delete and mark rows.
5. Hiring and releasing people is the manager's decision alone.
6. The administrator controls the service and sees no department table.
7. One shared Telegram bot; each member links their own Telegram account.
8. Start from scratch: only the administrator account and the shared barcode
   reference remain; employees and rows are recreated.

## Open decisions

1. **Cloudflare Access policy on `expiry.axnode.xyz`.** The owner believes the
   service is open to the world behind a Tunnel. The application is in fact
   behind an Access application. Its policy must be read, or stated by the owner,
   before "anyone can register" can be relied on. If the policy is a closed email
   list, self-registration is effectively closed and the department model changes
   no security posture.
2. **May a manager appoint a co-manager?** The specification assumes no: one
   manager per department, administrator transfers ownership. If the owner wants
   a manager to hand the department to a colleague, the rule and the migration
   change.
3. **Must a manager-issued employee change the password on first sign-in?** The
   specification recommends yes, via `User.mustChangePassword`.
4. **Is the administrator allowed a temporary membership in a department** when
   support work requires it? The specification allows it and records it as an
   audit event.
5. **Should the service-level default thresholds be editable by the
   administrator** and inherited by new departments? The schema has them per
   department; a service-level default is not modeled yet.

## Result and handoff

Nothing was implemented when this document was written. The agreed target is now
implemented on branch `local/department-access-model`; the purge stays deferred to
a separate, explicitly authorized step.

## Decisions taken in the second round (owner, 2026-10-21)

1. **One manager per department.** A manager cannot appoint a co-manager; only the
   administrator transfers ownership. No schema or rule change.
2. **No forced password change.** A manager-issued password stays valid until the
   manager resets it or the employee changes it in settings, so `User.mustChangePassword`
   is *not* added to the schema.
3. **The administrator may enter a department temporarily** for support work. The
   visit is a normal `EMPLOYEE` membership created through the "Отделы" tab, and
   both the grant (`SUPPORT_ACCESS`) and the revocation (`SUPPORT_ACCESS_REVOKED`)
   are written to `ProductEvent` with a store and no product row.
4. **No service-level default thresholds.** Thresholds stay per department and are
   owned by its manager.
5. **Cloudflare Access is left as it is.** Its policy on `expiry.axnode.xyz` was not
   read and is not part of this change.

## Implementation status (2026-10-21)

Delivered on `local/department-access-model`; production data is untouched and the
purge of step 4 above has not run.

- Schema: `Store.id` became `@default(cuid())` and gained `createdAt`
  (migration `20261021000000_department_access_model`, verified against a legacy
  database with rows, members and a `main` store). `Product.storeId` stays
  nullable for one cycle; it becomes `NOT NULL` in a follow-up migration after the
  approved purge, because making it non-nullable now would force deleting the
  three personal rows on production inside a migration.
- Scope: `inventoryScope()` refuses an account without a department with 403;
  there is no personal branch. `storeMembership()` is the non-throwing lookup used
  by background jobs and by screens that must render "no department".
- Departments: `src/lib/server/departments.ts` owns registration, hiring, password
  reset, revocation, the administrator registry, ownership transfer, deletion and
  support visits. `POST /api/admin/departments` and
  `POST /api/store/members/[userId]/password` are new; the personal-to-store
  transfer flow (`store-transfer.ts`, `api/admin/store.ts`, `StoreTransfer.tsx`)
  is removed.
- The administrator sees no row: `/api/products`, `/api/user/stats` and the admin
  dashboard counters refuse or omit product data for a non-member.
- UI: registration asks for the department, `/store` became the department screen
  with hiring and password reset, `/admin` gained "Отделы" and Telegram tabs.
- Tests: `tests/department-access.test.cjs` covers the new model end to end; the
  existing suites that encoded the old model were updated, and
  `tests/store-inspection.test.ts` gained the migration data-preservation check.
