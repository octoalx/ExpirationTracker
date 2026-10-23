# An extra column must not make the Excel file unrecognisable

Status: APPROVED
Owner approval: Alex (owner), 2026-10-23, in chat: «давай исправляй все, выполняй эти пункты» (задача №4 — пятая колонка)
Type: defect
Branch: local/import-fifth-column
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves. Until then no code and no test edits: the spec is the only file that may
be committed. See `docs/engineering/workflow.md`.

## Что изменится для вас

Если в файле появится лишняя колонка — комментарий, цена, номер поставки, даже
пустая, — импорт перестанет отвечать «Не удалось определить тип файла» и
загрузит товары по первым четырём колонкам: штрих-код, название, дата, срок.
Сейчас такой файл не загружается совсем, и приходится удалять колонку в Excel
вручную.

## Problem

`detectFileType` (`src/lib/excel-parser.ts:46-52`) recognises the simple table
only when the sheet's used range ends at column D:

```ts
if (rangeForSimple.e.c <= 3 && header.every(value => typeof value === "string" && value.trim()) && …)
```

`!ref` of a sheet covers every non-empty cell, so one extra filled column — a
comment, a price, a note in the last line — moves `e.c` to 4 and the file matches
none of the three formats. `parseExcelFile` then returns
`fileType: "inventory"` with an empty product list and the error «Не удалось
определить тип файла», and the dialog shows only that error.

Mechanism: the detector reads the width of the whole sheet instead of the width of
the header it actually validates (columns A–D). The parser `parseSimple`
(`src/lib/excel-parser.ts:171-204`) is already bounded to columns A–D, so nothing
downstream needs to change.

## RED evidence

Probe with the real parser module (`probe-five-columns.cjs`, same loading
technique as `tests/simple-excel-import.test.ts`), on `local/import-fifth-column`
at `8d2ba19`:

```
4 columns: simple products 2 errors []
5 columns (comment): inventory products 0 errors ["Не удалось определить тип файла. Поддерживаются: простая таблица, Инвентаризация и Каталог товаров."]
5 columns (price): inventory products 0 errors ["Не удалось определить тип файла. Поддерживаются: простая таблица, Инвентаризация и Каталог товаров."]
5 columns (empty): inventory products 0 errors ["Не удалось определить тип файла. Поддерживаются: простая таблица, Инвентаризация и Каталог товаров."]
catalog 5 columns: catalog products 1 errors []
```

The same four header rows and the same data: four columns parse, five do not —
whether the fifth column holds text, numbers or nothing at all. The catalog format
is unaffected, which is why the fix belongs to the simple-table branch only.

## Acceptance criteria

- AC1 — a simple table with four recognised headers and any number of extra
  columns (text, numeric, empty) is detected as `simple` and returns its product
  rows from columns A–D, ignoring the extra columns.
- AC2 — a file that is neither a simple table, an inventory nor a catalog still
  answers with the existing «Не удалось определить тип файла» error and no
  products; a sheet whose third header is «Доступно» still is not taken for a
  simple table (catalog round-trip unchanged).
- AC3 — the first four columns keep their meaning: an invalid date, an empty
  barcode or a non-integer shelf life in a five-column file produces the same
  per-row error as in a four-column file, and the dialogs' own row numbers are
  unchanged.

## Out of scope

- Reading the extra columns anywhere: price, comment and the like are ignored, not
  stored, and the request payload keeps its four fields.
- `parseInventory` and `parseCatalog`: their column detection by header text is
  unchanged, and their silent skipping of nameless rows stays open (separate
  defect, listed in `memory-bank/activeContext.md`).
- The import deduplication and partial-import rules from
  `2026-10-23-import-duplicates.md` and `2026-10-23-import-partial-rows.md` are not
  revisited.
- `.release-version` and `npm run dev` — separate tasks.

## Files and signatures (draft)

- `src/lib/excel-parser.ts` — `detectFileType` stops requiring `range.e.c <= 3`
  and decides from the header row's first three cells (A–C) alone, since that is
  all it ever validated
- `tests/simple-excel-import.test.ts` — case for a five-column file (AC1), a
  five-column file with a broken date (AC3), and an unrecognised sheet (AC2)

## Contract change

`none` — every existing assertion keeps its meaning; the new cases are added to
the same suite.

## Risks and invariants

- Header detection must not become looser for a four-column file: the same guards
  stay (three non-empty string headers, third header not «Доступно»,
  `инвентаризация` detected before `simple`).
- A catalog sheet must still be detected as `catalog`: a header containing
  «Штрих-код» or «Наименование товара» keeps priority over the simple branch.
- Column order stays fixed A–D; the fix must not start reading headers by name.
- Row numbering in errors comes from `parseSimple` and must not shift.
- No new validation, no new errors, no data invented for the ignored columns.

## Verification plan

- AC1 → `tests/simple-excel-import.test.ts`, «a fifth column does not hide the
  simple table», red before, green after
- AC2 → `tests/simple-excel-import.test.ts`, an unrelated sheet still answers
  «Не удалось определить тип файла»; the existing catalog round-trip test stays green
- AC3 → `tests/simple-excel-import.test.ts`, «a broken cell in a five-column file
  reports the same row as in a four-column file»
- browser walk-through: the five-column file opened in the import dialog shows
  «Найдено товаров: N» and imports them

Standing checks: `npm run typecheck`, `npm run test:app`,
`npm run check:context` + `npm run test:harness`, `npm run build` (bundling
changes), browser walk-through.

## Result and handoff

Реализовано в `src/lib/excel-parser.ts`: `detectFileType` больше не смотрит на
`range.e.c` и решает по первым трём ячейкам заголовка — это ровно то, что читает
`parseSimple` и что проверялось раньше.

- AC1 → PASS — `tests/simple-excel-import.test.ts`, «a fifth column does not hide
  the simple table»: пятая колонка со строкой, числом и пустая — во всех трёх
  случаях `fileType: "simple"`, ошибок нет, товары те же 2 строки из A–D.
  RED до правки (тот же тест): `AC1: a "комментарий" fifth column keeps the type`.
- AC2 → PASS — «an unrecognised sheet still answers with the type error» (пусто в
  товарах, текст ошибки прежний) и существующий тест каталога «legacy catalog and
  inventory…» остаётся зелёным: заголовок «Штрих-код» по-прежнему даёт `catalog`.
- AC3 → PASS — «a broken cell in a five-column file reports the same row as in a
  four-column file»: первая отклонённая строка — «Строка 3: …» в обоих файлах,
  строка, где заполнена только колонка примечания, остаётся строкой 4, принятые
  товары совпадают.
- Браузер: файл `five-columns.xlsx` (5 колонок, у третьей строки 30.02.2026) →
  превью «Тип: Простая таблица · Найдено товаров: 2», «Строк с ошибкой: 1»,
  «Строка 4: Некорректная дата: 30.02.2026»; импорт → «Успешно импортировано: 2»,
  «Не загружено из-за ошибок: 1».

Проверки: `npm run test:app` 114/114 PASS (111 + 3 новых), `npm run typecheck` PASS,
`npm run build` PASS, `npm run check:context` PASS, `npm run test:harness` 13/13 PASS.

Незакрытое: колонки правее D по-прежнему не читаются и не сохраняются (так и
задумано, см. Out of scope); `parseInventory`/`parseCatalog` без изменений.
