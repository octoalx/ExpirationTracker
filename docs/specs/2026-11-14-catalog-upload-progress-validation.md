# Catalog upload: progress bar and per-file name validation

Status: APPROVED
Owner approval: Alex, 2026-11-14, chat ("делай")
Type: feature
Branch: local/catalog-upload-progress-validation
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves. Until then no code and no test edits: the spec is the only file that
may be committed. See `docs/engineering/workflow.md`.

## Что изменится для вас

Пока каталог сохраняется, вместо одной строки текста появится полоска
прогресса, которая заполняется по мере отправки файлов и разбора на сервере —
видно, сколько уже сделано и сколько осталось. Выбор файла `goods.dbf` или
`barcode.dbf` сразу проверяется по имени: если выбран не тот файл (неверное
имя), об этом сообщается немедленно рядом с этим полем, и его выбор сбрасывается
— перепутать и отправить не тот файл стало физически нельзя, не только в
момент нажатия «Сохранить каталог», а сразу при выборе.

## Problem

`src/components/CatalogImport.tsx` today:

- Shows progress only as a replaced text line (`Отправлено N из M МБ…`),
  updated once per chunk (90 MB granularity — for a typical ~150-300 MB pair
  that is 1-3 updates total) and with no visual proportion, so a long upload
  looks indistinguishable from a stuck one. This is exactly what produced the
  "крутится загрузка, непонятно что происходит" report that led to this spec.
- Validates the file name only inside `save()` (lines 86-88), after the
  administrator has already picked both files and pressed the button. A wrong
  file sits selected and looks accepted until the button is pressed; nothing
  at the `<input type="file">` itself stops or flags a wrong name at selection
  time, and the two inputs share no per-field error state — a bad name in
  either field only ever produces one shared `message` at submit time.

## Acceptance criteria

- AC1 — while chunks are uploading, a visual progress bar fills proportionally
  to bytes sent (0-100%), not just a text line.
- AC2 — while the server parses and writes the catalog after all chunks are
  sent (the `finalize` call), the bar shows a distinct busy/indeterminate state
  (exact byte progress is not observable server-side), so "uploading" and
  "server is parsing" are visually different from each other and from "idle".
- AC3 — selecting a file in the `goods.dbf` input immediately rejects a wrong
  name (case-insensitive, matching today's check) with an inline message next
  to that specific input, and clears the selection so the wrong file cannot be
  submitted; same independently for the `barcode.dbf` input.
- AC4 — the existing pair-level checks at submit time (same validation,
  oversize check) are unchanged as a second line of defence, so no path to
  `save()` relies solely on the new per-field check.
- AC5 — `Сохранить каталог` is unaffected by this change outside of what AC1-4
  specify: still disabled without both valid files or while busy.

## Out of scope

- Any change to the chunking protocol, chunk size, or server-side endpoints
  (`init`/`chunk`/`status`/`finalize`) — this is a pure `CatalogImport.tsx`
  UI change.
- The cross-tab/cross-device UA mismatch observed in the 2026-11-14 production
  logs — unresolved, separate, needs a live repro.
- Validating DBF file *content* (row shape, headers) before upload — the
  server already rejects a malformed file at parse time; this spec only adds
  a name check at selection time.

## Files and signatures (draft)

- `src/components/CatalogImport.tsx` — add per-field `goodsNameError` /
  `barcodeNameError` state (or equivalent), validate on each `onChange`; add a
  `progress` numeric/phase state (`idle | sending:<percent> | finalizing`)
  driven from the existing `sendChunk`/`progress()` call sites, and render a
  `<progress>`-backed or div-based bar bound to it instead of (or alongside)
  the current text line.
- `tests/catalog-import.test.*` — new or extended, if a component test harness
  already exists for this file; otherwise document why only manual/browser
  verification applies (see Verification plan).

## Contract change

none.

## Risks and invariants

- Must not change the wire format, `CHUNK_BYTES`, or the server-side
  validation in `src/lib/server/catalog-upload-chunks.ts` /
  `src/lib/catalog-upload-format.ts` — only the client component's own state
  and markup.
- Must keep the resumable-upload behaviour (`pending.current`, status check,
  resend of missing ranges) intact; the progress bar is a presentation layer
  on top of the existing `sent`/`upload.totalBytes` numbers, not a new source
  of truth.
- Must not loosen the submit-time validation (AC4) — the per-field check is
  additive, not a replacement.

## Verification plan

- AC1, AC2 → browser walk-through: start a save with a real file pair, observe
  the bar move during chunk sends and switch to the finalizing state during
  `finalize`; screenshot or screen recording as evidence.
- AC3 → browser walk-through: select a file named e.g. `wrong.dbf` in the
  `goods.dbf` input, confirm the inline error appears and the input clears
  without needing to press Save; repeat for `barcode.dbf`.
- AC4 → browser walk-through: bypass the per-field check is not possible from
  the UI; confirm `save()`'s existing name/size guard still fires if reached
  with an unexpected state (code read suffices, since the UI prevents reaching
  it with a bad name).
- AC5 → browser walk-through: button stays disabled with one or zero files
  selected, and during `busy`.

Standing checks: `npm run typecheck`, `npm run check:context`,
`npm run test:harness` if `CatalogImport.tsx` has covered test infrastructure;
`npm run build`.

## Result and handoff

Pending owner approval; no code committed yet.
