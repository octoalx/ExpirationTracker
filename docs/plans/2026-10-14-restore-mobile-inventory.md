# Restore the mobile-first inventory interface

Status: DONE
Evidence: commit `c34c6c5`

Dated: 2026-10-14. Owner report: "слетело отображение для мобильной версии;
до миграции и внедрения CI/CD все работало отлично."

## Goal and acceptance criteria

Bring the phone inventory interface back to the state it had before the
production-aligned sync, without disturbing the desktop table or production data.

- A phone viewport (360-430 px) shows the mobile product list, not the desktop
  table: `ProductTableEnhanced` renders `MobileProductList` under `md:hidden` and
  the table under `hidden md:block`.
- The dashboard renders the mobile chrome again: `.inventory-page` shell,
  `.work-page-title` heading, the `.primary-action` scan button, the phone sort
  select (`md:hidden`) and `work-panel product-dialog` on its dialogs.
- `getExpiryStatus` accepts `referenceDate` again and the mobile list passes it, so
  the phone status and the desktop status agree on the Minsk calendar day.
- Add/edit product forms carry `.product-entry`, `.entry-segment` and
  `.expiry-preview` again, so the orphaned mobile form CSS applies.
- Desktop behaviour is unchanged: the table, sorting, selection and bulk actions
  still render at `>= 768 px`.
- The mobile assertions removed with the code are restored and pass.

PASS = `typecheck` clean, `test:app` green with the restored suites, `check:context`
and `test:harness` green, `dialog-css` green, `next build` succeeds.

## Scope and approach

Single cause, single commit. `28719b8` ("Sync production working tree with
origin/main (prod-aligned)", PR #7) replaced a whole mobile-first lineage with an
older host tree. It is the only commit touching these files after `dc07476`
("fix: show account identity in mobile header", PR #6), which is the last
known-good mobile state.

Smaller than the diff suggests: `src/styles/globals.css` was **not** changed by
PR #7 and is byte-identical between `dc07476` and `HEAD`. Every mobile rule
(`.work-shell`, `.work-main`, `.phone-nav`, `.work-panel`, `.product-dialog`,
`.inventory-page`, `.primary-action`, `.product-entry`, `.entry-segment`,
`.expiry-preview`, `.dialog-surface`) is still in the stylesheet. What was removed
was the markup that applies it, so the CSS became dead code and
`MobileProductList.tsx` became an unimported component.

Restore `dc07476` content for the files that carry the mobile markup and its
supporting date logic:

| File | Restores |
| --- | --- |
| `src/pages/dashboard.tsx` | `.inventory-page`, `.work-page-title`, `.primary-action`, phone sort, mobile props, `work-panel product-dialog` |
| `src/components/products/ProductTableEnhanced.tsx` | `MobileProductList` import, `md:hidden` / `hidden md:block` split, mobile props, `canDelete` |
| `src/components/products/MobileProductList.tsx` | passes `referenceDate` to `getExpiryStatus` |
| `src/components/AddProductForm.tsx` | `.product-entry`, `.entry-segment`, `.expiry-preview`, `.primary-action` |
| `src/components/EditProductForm.tsx` | `.product-entry`, `.entry-segment` |
| `src/lib/utils.ts` | `referenceDate` parameter and Minsk-based `expiryDays` |
| `tests/mobile-product-flow.test.ts` | search-clear and mobile filter assertions |
| `tests/product-urgency-render.test.ts` | desktop/mobile threshold parity and overdue-day rendering |

Deliberately out of scope, with reasons:

- `src/components/ProductCard.tsx` and `src/components/DashboardProducts.tsx` are
  imported by nothing at `HEAD`, so they cannot affect any viewport.
- `src/pages/stats.tsx` carries the same `.entry-segment` / `.primary-action`
  counts before and after, and PR #7 never touched it.
- `src/styles/globals.css` is unchanged and already correct.
- `src/components/BarcodeCamera.tsx` and `src/components/CatalogImport.tsx` were
  touched by PR #7 but expose an identical camera prop contract; no mobile markup.

`referenceDate` removal is restored as part of the mobile contract, not as a new
timezone decision: the mobile list, the desktop table and `getDaysLeft` all read
the Minsk calendar day from the same helper, which is the behaviour the owner
already confirmed (handoff, "Часовой пояс", 2026-10-13).

## Risks and invariants

- Desktop must not regress. The `md:hidden` / `hidden md:block` split keeps the
  table at `>= 768 px`; verified by render and by the restored threshold test.
- No API, schema, migration, cron or notification change. The restored
  `ProductTableEnhanced` re-sends `version` with `PATCH`, which is the optimistic
  concurrency token the API already expects.
- Identity/ownership is untouched: the dashboard still scopes products through the
  verified session.
- Optional expiry dates, quantities and ACTIVE/ARCHIVED/DEFECT semantics are
  preserved; the restored status config uses the design tokens
  (`text-expiry-ink`, `bg-expiry-marker`) that `globals.css` still defines.
- Production stays untouched. No deploy, no migration, no remote command.

## Verification

Executed on 2026-10-14 on the Windows host. `TZ=Europe/Minsk` in every run.

- `npm run typecheck` — **PASS**: `tsc --noEmit`, 0 errors.
- `npm run check:context` — **PASS**: context budget and documentation links.
- `npm run test:harness` — **PASS**: 6/6.
- `npm run test:app` — **PASS: 93 tests, 93 pass, 0 fail, 0 skipped** (Node 24.21.0).
- `npm run build` — **PASS**: 11/11 pages, `output: standalone`, dashboard 51.2 kB.
  Run with `DATABASE_URL=file:./ci-placeholder.db` and `DISABLE_BACKGROUND_JOBS=true`,
  as CI does.
- Static assertions — **PASS**: `MobileProductList`=2 and `md:hidden`=2 in
  `ProductTableEnhanced.tsx`; `inventory-page`=1, `work-panel`=3,
  `mobileProducts`=1 in `dashboard.tsx`; `product-entry`=1 in `AddProductForm.tsx`;
  `referenceDate`=2 in `lib/utils.ts`.
- Rendered-output check — **PASS**: `renderToStaticMarkup(ProductTableEnhanced, ...)`
  emits the `md:hidden` branch containing `<div class="inventory-list">` **and** the
  `hidden md:block` wrapper containing `<table>`. The phone path and the desktop
  path are both present and mutually exclusive by breakpoint.
- `tests/inventory-thresholds.test.cjs` was restored to its pre-regression form as
  well. Its `HEAD` version had been rewritten (commit `c657690`, PR #10) around the
  comment "production getExpiryStatus ... has no referenceDate argument", i.e. it
  encoded the post-regression signature. It now asserts the Minsk calendar day
  again, which matches the restored helper.

NOT VERIFIED: real device camera, software keyboard, vibration and safe-area
behaviour remain owner-verified only, exactly as recorded in
`2026-10-02-mobile-ux-redesign.md`.

### Environment note (not a defect in this change)

Local `node_modules/better-sqlite3` is built for `NODE_MODULE_VERSION 137`
(Node 24). Under Node 22 (ABI 127) or Node 26 (ABI 147) the 34 database-backed
tests fail with `ERR_DLOPEN_FAILED` before any assertion runs. Under Node 24 the
whole suite is green; under Node 22 the same run shows **59 pass, 34 fail, all 34
`ERR_DLOPEN_FAILED`, zero assertion failures**. The failures are therefore entirely
an ABI mismatch in this checkout, not a behaviour change. CI installs fresh under
Node 22 and is unaffected. A disposable Node 24.21.0 was used for the full run; the
shared `node_modules` was not modified.

## Result and handoff

Restored the mobile-first inventory interface by returning nine files to their
`dc07476` content:

- `src/pages/dashboard.tsx` — `.inventory-page` shell, `.work-page-title`, the
  `.primary-action` scan button, the phone sort select, the mobile list props and
  `work-panel product-dialog` on the dialogs.
- `src/components/products/ProductTableEnhanced.tsx` — `MobileProductList`,
  the `md:hidden` / `hidden md:block` split, and the mobile prop contract.
- `src/components/products/MobileProductList.tsx` — passes `referenceDate`.
- `src/components/AddProductForm.tsx`, `src/components/EditProductForm.tsx` —
  `.product-entry`, `.entry-segment`, `.expiry-preview`.
- `src/lib/utils.ts` — `referenceDate` parameter and Minsk-based `expiryDays`.
- `tests/mobile-product-flow.test.ts`, `tests/product-urgency-render.test.ts`,
  `tests/inventory-thresholds.test.cjs` — the removed mobile assertions.

`src/styles/globals.css` needed no change: PR #7 never touched it, which is why the
styled-but-dead classes were still in the served production CSS.

Remaining limitation: this restores the code, not the deployment. Production still
serves the broken revision until a release is explicitly authorized.

Next useful step: render the restored dashboard on a real phone and confirm the
camera, keyboard and safe-area behaviour, then release only on an explicit owner
request.
