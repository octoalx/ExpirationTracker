# Remove the personal catalog (CatalogEntry and POST /api/catalog)

Status: DRAFT
Owner approval:
Type: contract
Branch: local/remove-personal-catalog
Spec gate: `npm run check:spec`

Depends on `docs/specs/2026-11-14-admin-shared-catalog-update.md` (branch
`local/admin-dbf-catalog`): that change removes the only caller of `POST /api/catalog`.
Merge it first; otherwise this branch must be rebased onto it.

## Что изменится для вас

Сканер будет искать название товара только в общей базе, которую вы обновляете двумя DBF-файлами. Личные каталоги сотрудников (их когда-то наполняли загрузкой CSV) исчезнут вместе с таблицей. Если какого-то штрих-кода нет в общей базе, сканер скажет «Товар не найден в каталоге», как и сейчас для неизвестных кодов. Перед удалением я покажу, сколько записей лежит в личных каталогах на проде, и вы решите, переносить ли их в общую базу.

## Problem

After the DBF update lands, nothing writes `CatalogEntry`. It is read first by `GET /api/catalog` and written only by `POST /api/catalog` (`src/pages/api/catalog/index.ts`). The result is a hidden second source of truth: the same barcode can resolve to a stale personal name that the administrator's update never corrects. The table, the endpoint and the personal-first lookup order are dead weight and a data-consistency trap.

## Decision (owner, 14.11.2026, in chat: "B")

Option B: before the table is dropped, personal rows whose barcode is absent from `SharedCatalogEntry` are copied into it; no existing shared name is overwritten. When one barcode has different personal names across accounts, the most recently updated one is copied (deterministic: `ORDER BY updatedAt DESC, id`). The production row count of `CatalogEntry` is still unknown and is read from the real database in the separate, authorized release task, after a verified backup.

## Acceptance criteria

- AC1 — `GET /api/catalog?barcode=` reads only `SharedCatalogEntry`: found → 200 `{barcode,name}`, unknown → 404, invalid code → 400, no session → 401 (unchanged statuses).
- AC2 — `POST /api/catalog` is gone: the handler answers 405 with `Allow: GET` for every other method; no source file contains a write to a personal catalog.
- AC3 — an incremental Prisma migration drops `CatalogEntry`, removes `User.catalogEntries`, and leaves every other table untouched; applied to a disposable SQLite copy that contains users, stores, products, shared entries and personal entries, row counts of all other tables and every `SharedCatalogEntry` row are identical before and after plus the copied absent barcodes; no existing shared name changes and a barcode with several personal names yields exactly one row, the latest.
- AC4 — `scripts/purge-departments.mjs` and its test no longer reference `CatalogEntry`, and the purge still preserves `SharedCatalogEntry`.
- AC5 — `npx prisma validate` and `npx prisma generate` succeed; `npm run typecheck` shows no remaining `catalogEntry` usage.
- AC6 — `docs/engineering/catalog-updates.md` states that the shared base is the only catalog.

## Out of scope

- The DBF update screen, `POST /api/admin/catalog`, `SharedCatalogEntry`.
- Running the migration on production, deploy, backup or restore (a separate authorized task; take a backup first).
- Any change to products, inventory, notifications or Telegram.

## Files and signatures (draft)

- `prisma/schema.prisma` — remove `model CatalogEntry` and `User.catalogEntries`
- `prisma/migrations/20261114000000_drop_personal_catalog/migration.sql` — new; `DROP TABLE "CatalogEntry"` after an `INSERT … SELECT … ON CONFLICT(barcode) DO NOTHING` copy of absent barcodes (option B)
- `src/pages/api/catalog/index.ts` — GET only, shared lookup only
- `scripts/purge-departments.mjs` — drop `CatalogEntry` from the table lists
- `tests/catalog-api.test.cjs` — replace the personal-catalog assertions
- `tests/department-access.test.cjs` — remove `catalogEntry` fixtures (lines ~170–172) and the assertions that depend on personal-first lookup
- `tests/purge-departments.test.mjs` — remove `CatalogEntry` inserts and counts
- `docs/engineering/catalog-updates.md` — one-line statement (AC6)

## Contract change

Existing assertions in `tests/catalog-api.test.cjs` and `tests/department-access.test.cjs` assert that a personal entry is returned before the shared one, that `POST /api/catalog` upserts under the session owner, and that another account does not see it. These become wrong because the personal catalog no longer exists. Replacement: shared-only lookup, 405 for `POST`, and a migration data-preservation test (AC3). Each removed assertion is listed in the PR body.

## Risks and invariants

- Data preservation: the schema change drops a table. The migration is tested on disposable SQLite only; production needs a verified backup and the row count of `CatalogEntry` before it runs. Never reset the database or delete files.
- Visibility: personal names copied by option B become visible to every account; the owner accepted this.
- Identity and scope: GET keeps the verified session check; the shared catalog is readable by any authenticated account, as today.
- Migration order: the new migration sorts after `20261022000000_product_store_required` and every other existing directory.

## Verification plan

- AC1, AC2 → `tests/catalog-api.test.cjs`: statuses and 405/`Allow`, shared-only lookup
- AC3 → new migration test on disposable SQLite (counts before/after for each table, shared rows identical)
- AC4 → `tests/purge-departments.test.mjs`, `tests/department-access.test.cjs`
- AC5 → `npx prisma validate`, `npm run typecheck`
- AC6 → diff review of `docs/engineering/catalog-updates.md`

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context` + `npm run test:harness`, `npm run build`.

## Result and handoff

Pending approval.
