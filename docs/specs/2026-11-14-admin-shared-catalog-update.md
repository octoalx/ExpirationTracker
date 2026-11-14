# Admin update of the shared scanner catalog (DBF pair)

Status: DRAFT
Owner approval:
Type: feature
Branch: local/admin-dbf-catalog
Spec gate: `npm run check:spec`

## Что изменится для вас

На вкладке «Каталог» в админке появится загрузка двух файлов выгрузки — `goods.dbf` и `barcode.dbf`. Вы выбираете их, нажимаете «Проверить файлы», видите число товаров и несколько примеров, затем «Сохранить каталог»: названия попадают в общую базу сканера, и их видят все сотрудники. Есть полоса прогресса; при обрыве связи тот же набор файлов можно загрузить ещё раз без дублей. Существующие названия обновляются, новые штрих-коды добавляются, отсутствующие в выгрузке остаются. Загрузка из CSV остаётся запасным вариантом, но теперь тоже пишет в общую базу, а не в личный каталог администратора.

## Problem

`docs/engineering/catalog-updates.md` describes an administrator DBF update of `SharedCatalogEntry`, but the UI does not exist on `main`. `src/components/CatalogImport.tsx` accepts only a CSV (≤ 2 MiB) and posts to `/api/catalog`, which writes the personal `CatalogEntry` of the caller. `src/lib/catalog-dbf.ts`, `src/lib/catalog-dbf.worker.ts` and `importCatalogBatches` (`src/lib/catalog-import.ts`) are not referenced by any screen, and `POST /api/admin/catalog` has no caller. The UI was lost in `28719b8` (a working-tree sync); `7166c49` had it. Result: the administrator cannot update the base the scanner falls back to (`GET /api/catalog` reads `SharedCatalogEntry` after the personal entry).

## Acceptance criteria

- AC1 — the Catalog tab shows two file inputs (`goods.dbf`, `barcode.dbf`) and a "check files" action; parsing runs in the browser worker `catalog-dbf.worker.ts`, raw files are never sent to the server.
- AC2 — after a successful check the screen shows goods rows, barcode rows, number of entries to save, deleted/duplicate counts and a sample of entries; any parser error (format, broken record, missing counterpart, conflicting names) is shown in Russian and blocks saving, with no request sent.
- AC3 — "Save catalog" sends entries to `POST /api/admin/catalog` in 500-entry batches via `importCatalogBatches`, shows progress, and reports the saved total; on a failed batch it reports how many were confirmed and states that repeating the same pair is safe.
- AC4 — saved entries are found by a non-admin user's `GET /api/catalog?barcode=` when that user has no personal entry for the code; an existing shared barcode gets the new name, other shared codes are untouched, no duplicates after a repeated upload.
- AC5 — the CSV alternative in the same tab writes through `POST /api/admin/catalog` (shared base), not `/api/catalog`; personal `CatalogEntry` and `Product` rows are not modified by either path.
- AC6 — `POST /api/admin/catalog` returns 401 without a session and 403 for non-ADMIN (existing behaviour kept, covered by a test).
- AC7 — layout uses redesign tokens and works at 375 px (no horizontal scroll, primary action stays the `primary-action` class); the file-size limit (256 MiB per DBF) and the 2 MiB CSV limit are enforced with Russian errors.

## Out of scope

- Schema, migrations, `SharedCatalogEntry` model, the DBF parser rules and `catalog-parser.ts` validation.
- Deleting catalog entries or full replacement of the base.
- Per-user personal catalog UI (`/api/catalog` POST stays as is).
- Production deploy, real data import, other admin tabs.

## Files and signatures (draft)

- `src/components/CatalogImport.tsx` — DBF pair flow (check → preview → batched save), CSV alternative switched to the admin endpoint
- `src/lib/catalog-dbf.worker.ts` — used as is (`new Worker(new URL(...), { type: "module" })`)
- `src/lib/catalog-import.ts` — used as is
- `tests/admin-catalog-update.test.ts` — new: batching/progress/partial-failure reporting, wiring of the endpoint URL
- `tests/catalog-api.test.cjs` — extended: ADMIN upsert visible to another user via `GET`, 401/403, repeat upload without duplicates
- `tests/admin-redesign.test.ts` — only if its catalog assertions (`Файл превышает 2 МБ`, `primary-action`) need to follow the new markup
- `package.json` — add the new suite to `test:app`
- `docs/engineering/catalog-updates.md` — touched only if the final behaviour differs from it

## Contract change

none. `tests/admin-redesign.test.ts` assertions about the CSV size error and the primary button wording stay valid; they change only if markup moves, with no behaviour change.

## Risks and invariants

- Identity and scope: the shared base is written only by ADMIN through the verified session; the administrator still has no product rows, and no `Product` or personal catalog is read or written.
- Data preservation: upsert by unique barcode only, no deletes, no replacement; a partial run leaves confirmed batches saved and is repeat-safe.
- Server load: sequential 500-entry transactions; request body stays under the existing 8 MB limit (500 entries ≪ 8 MB).
- Browser: worker bundling in Next 14 must be confirmed in `npm run build`; large files (up to 256 MiB) are parsed in a worker to keep the tab responsive; the screen must be kept open until the success message.
- Real exports are not available offline: verification uses synthetic DBF fixtures on disposable SQLite, and no real DBF is committed.

## Verification plan

- AC1, AC2 → `tests/catalog-dbf.test.ts` (existing parser cases) + browser walk-through with synthetic DBF pair and a mismatched pair: counts/sample shown, error blocks save
- AC3 → `tests/admin-catalog-update.test.ts` (1,200 entries → 3 requests, progress 500/1000/1200; failure on batch 2 reports 500 confirmed); browser walk-through
- AC4 → `tests/catalog-api.test.cjs` (ADMIN POST then user GET; repeat POST; untouched neighbour code)
- AC5 → `tests/admin-catalog-update.test.ts` asserts the CSV path targets `/api/admin/catalog`; `tests/catalog-api.test.cjs` asserts `Product` and `CatalogEntry` counts unchanged
- AC6 → `tests/catalog-api.test.cjs`
- AC7 → screenshots 1440 and 375 in `redesign/`, size-limit errors in DOM

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context` + `npm run test:harness`, `npm run build` (worker bundling), a real browser walk-through on a disposable database with fake integrations.

## Result and handoff

Pending approval.
