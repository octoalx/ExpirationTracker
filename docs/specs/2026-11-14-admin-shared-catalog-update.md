# Admin update of the shared scanner catalog (DBF pair)

Status: APPROVED
Owner approval: Алекс, 14.11.2026, в чате: «Подтверждаю, правь»
Type: feature
Branch: local/admin-dbf-catalog
Spec gate: `npm run check:spec`

## Что изменится для вас

На вкладке «Каталог» в админке появится загрузка двух файлов выгрузки — `goods.dbf` и `barcode.dbf`. Вы выбираете их, нажимаете «Проверить файлы», видите число товаров и несколько примеров, затем «Сохранить каталог»: названия попадают в общую базу сканера, и их видят все сотрудники. Есть полоса прогресса; при обрыве связи тот же набор файлов можно загрузить ещё раз без дублей. Существующие названия обновляются, новые штрих-коды добавляются, отсутствующие в выгрузке остаются. Это единственный способ пополнить базу сканера: загрузка из CSV на этой вкладке убирается.

## Problem

`docs/engineering/catalog-updates.md` describes an administrator DBF update of `SharedCatalogEntry`, but the UI does not exist on `main`. `src/components/CatalogImport.tsx` accepts only a CSV (≤ 2 MiB) and posts to `/api/catalog`, which writes the personal `CatalogEntry` of the caller. `src/lib/catalog-dbf.ts`, `src/lib/catalog-dbf.worker.ts` and `importCatalogBatches` (`src/lib/catalog-import.ts`) are not referenced by any screen, and `POST /api/admin/catalog` has no caller. The UI was lost in `28719b8` (a working-tree sync); `7166c49` had it. Result: the administrator cannot update the base the scanner falls back to (`GET /api/catalog` reads `SharedCatalogEntry` after the personal entry).

## Acceptance criteria

- AC1 — the Catalog tab shows two file inputs (`goods.dbf`, `barcode.dbf`) and a "check files" action; parsing runs in the browser worker `catalog-dbf.worker.ts`, raw files are never sent to the server.
- AC2 — after a successful check the screen shows goods rows, barcode rows, number of entries to save, deleted/duplicate counts and a sample of entries; any parser error (format, broken record, missing counterpart, conflicting names) is shown in Russian and blocks saving, with no request sent.
- AC3 — "Save catalog" sends entries to `POST /api/admin/catalog` in 500-entry batches via `importCatalogBatches`, shows progress, and reports the saved total; on a failed batch it reports how many were confirmed and states that repeating the same pair is safe.
- AC4 — saved entries are found by a non-admin user's `GET /api/catalog?barcode=` when that user has no personal entry for the code; an existing shared barcode gets the new name, other shared codes are untouched, no duplicates after a repeated upload.
- AC5 — the DBF pair is the only way to add to the shared scanner base: the CSV input is removed from the Catalog tab, no other UI calls `POST /api/admin/catalog`, and the DBF save does not modify personal `CatalogEntry` or `Product` rows.
- AC6 — `POST /api/admin/catalog` returns 401 without a session and 403 for non-ADMIN (existing behaviour kept, covered by a test).
- AC7 — layout uses redesign tokens and works at 375 px (no horizontal scroll, primary action stays the `primary-action` class); the file-size limit (256 MiB per DBF) is enforced with a Russian error.

## Out of scope

- Schema, migrations, `SharedCatalogEntry` model, the DBF parser rules and `catalog-parser.ts` validation.
- Deleting catalog entries or full replacement of the base.
- The personal `POST /api/catalog` endpoint and `CatalogEntry` table: after this change no screen calls them. Removing them needs a `Contract change` and is proposed as a separate task.
- Production deploy, real data import, other admin tabs.

## Files and signatures (draft)

- `src/components/CatalogImport.tsx` — DBF pair flow (check → preview → batched save); CSV input removed
- `src/lib/catalog-dbf.worker.ts` — used as is (`new Worker(new URL(...), { type: "module" })`)
- `src/lib/catalog-import.ts` — used as is
- `tests/admin-catalog-update.test.ts` — new: batching/progress/partial-failure reporting, wiring of the endpoint URL
- `tests/catalog-api.test.cjs` — extended: ADMIN upsert visible to another user via `GET`, 401/403, repeat upload without duplicates
- `tests/admin-redesign.test.ts` — its catalog assertion about the CSV size error (`Файл превышает 2 МБ`) goes away with the CSV input (see Contract change)
- `package.json` — add the new suite to `test:app`
- `docs/engineering/catalog-updates.md` — touched only if the final behaviour differs from it

## Contract change

The CSV catalog input is removed by owner decision ("the base is added only through the two files"). The assertion in `tests/admin-redesign.test.ts` that `CatalogImport.tsx` contains `Файл превышает 2 МБ` becomes wrong because that behaviour no longer exists; it is replaced by an assertion of the 256 MiB DBF limit message. The `primary-action` and "Сохранить каталог" assertions stay.

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
- AC5 → `tests/admin-catalog-update.test.ts` asserts the tab has no CSV input and only the DBF flow calls `/api/admin/catalog`; `tests/catalog-api.test.cjs` asserts `Product` and `CatalogEntry` counts unchanged
- AC6 → `tests/catalog-api.test.cjs`
- AC7 → screenshots 1440 and 375 in `redesign/`, size-limit errors in DOM

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context` + `npm run test:harness`, `npm run build` (worker bundling), a real browser walk-through on a disposable database with fake integrations.

## Result and handoff

Checked 14.11.2026 on disposable SQLite and a production build.

- AC1 -> PARTIAL — `tests/admin-catalog-update.test.ts` asserts two `.dbf` inputs and the worker wiring; `next build` passes and emits the worker chunk (`.next/static/chunks/255.*.js` contains the parser). No browser run.
- AC2 -> PARTIAL — parser errors covered by existing `tests/catalog-dbf.test.ts`; the screen shows counts, sample and blocks saving by construction. Not walked in a browser.
- AC3 -> PASS (logic) — `tests/catalog-import.test.ts` (500-entry batches, progress, partial failure, retry); the screen reports confirmed records and retry safety (`tests/admin-catalog-update.test.ts`).
- AC4 -> PASS — `tests/catalog-api.test.cjs`: ADMIN save is read by another account via `GET /api/catalog`; rename in place, neighbour kept, no duplicates.
- AC5 -> PASS — the CSV/Excel input is gone; the only caller of `/api/admin/catalog` is `CatalogImport.tsx` (source scan); personal `CatalogEntry` and `Product` counts unchanged in the API test.
- AC6 -> PASS — `tests/catalog-api.test.cjs`: 401 without a session, 403 for non-ADMIN, nothing written.
- AC7 -> SKIP — no 1440/375 screenshots or manual layout check; the 256 MiB DBF limit message is asserted in `tests/admin-redesign.test.ts`.

Commands: `npm run typecheck` 0 errors; `npm run test:app` 177/177; `npm run test:harness` 14/14; `npm run check:context` PASS; `npm run build` OK.

Limitations: no real `goods.dbf`/`barcode.dbf` and no browser walk-through (AC1, AC2, AC7); run one real pair on a disposable database before release. Follow-up: remove the now-unused personal `POST /api/catalog` and `CatalogEntry` in a separate spec with a migration.
