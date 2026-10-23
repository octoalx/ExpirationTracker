# One invalid row must not cancel the whole Excel import

Status: APPROVED
Owner approval: Alex (owner), 2026-10-23, in chat: «сломанные строки пропускаем, грузим то, что можно грузить»
Type: defect
Branch: local/import-partial-rows
Spec gate: `npm run check:spec`

Одобрено владельцем 2026-10-23: битые строки пропускаются, валидные
загружаются, отказы называются причинами. Два решения по умолчанию (все строки
битые → `200` с «импортировано 0»; номера строк из файла Excel, отказы сервера
подписаны отдельно) владелец не оспорил — считаются принятыми вместе с главным.

## Что изменится для вас

Если в файле одна строка сломана — неверная дата, пустое название, нулевое
количество — остальные товары всё равно загрузятся. После импорта окно покажет
три числа: добавлено, уже было, пропущено из-за ошибки, — и назовёт строки,
которые не приняты, с причиной. Сейчас в такой ситуации не загружается ничего:
окно пишет «Ошибка» и предлагает только закрыть его, а строку с опечаткой надо
искать в Excel вручную.

## Problem

Two layers reject the whole batch, so a single broken cell costs the manager the
entire delivery note.

**Client.** `src/components/ImportExcelModal.tsx:80-85` treats any entry in
`parseExcelFile().errors` as a fatal file error: `setPreview(null)`,
`setState("error")`, and the only available action is to close the dialog. The
parser itself is already tolerant: `src/lib/excel-parser.ts:199-201` catches a
per-row failure, pushes `Строка N: <reason>` into `errors` and keeps every valid
row in `products` (proved below). The strict guard arrived together with the
simple-Excel feature in `d4909d5` (2026-10-06, "Add account profile and password
settings and simple Excel imports"); `git log -S "result.errors.length"` shows no
earlier and no later change to that line.

**Server.** `validateInventoryProducts` (`src/lib/inventory-import.ts:80-96`)
maps the whole array and throws on the first bad element;
`src/pages/api/products/import.ts:37-40` converts that throw into `400` for the
entire payload before the transaction opens. So even a client that sends the
valid rows plus one broken row writes nothing. The per-row message exists
(`Строка 3: некорректная дата годности`) but `apiFailure` replaces it with
`Некорректные товары` when the error crosses a realm boundary — the vm-based
test harness loses `instanceof Error`, production does not.

Mechanism: batch-level validation at both ends, not a parser defect. The fix
turns rejection into a per-row outcome on the client and on the server.

## RED evidence

Probe `probe-partial-rows.cjs` (outside the repository, same loading technique as
`tests/import-duplicates.test.cjs`: real parser, real handler, disposable SQLite
seeded from `prisma/migrations`), run on `local/import-partial-rows` at
`ba01963`:

```
$ NODE_PATH=<repo>/node_modules node --import tsx probe-partial-rows.cjs
Parser, 3 data rows where row 3 has an impossible date:
  fileType simple
  products 2 [{"barcode":"111","name":"Сметана","quantity":null,"expiryDate":"2026-11-01"},{"barcode":"333","name":"Молоко","quantity":null,"expiryDate":"2026-11-05"}]
  errors 1 ["Строка 3: Некорректные данные"]
  modal guard (src/components/ImportExcelModal.tsx:80-85): errors.length > 0
    => setPreview(null); setState("error") — nothing importable for the owner
API mixed batch (2 valid + 1 invalid date):
  HTTP 400
  body {"error":"Некорректные товары"}
  product rows created: 0
API same batch without the invalid row:
  HTTP 200 body {"imported":2,"skipped":0,"errors":[]}
  product rows created: 2
```

Both halves of the defect are captured: the parser hands over two importable
rows that the dialog discards, and the endpoint answers `400` and stores nothing
for a batch it could have imported in part.

## Acceptance criteria

- AC1 — a batch that mixes valid and invalid rows imports every valid row: the
  response is `200`, `imported` equals the number of valid rows, and the
  department table contains exactly those rows.
- AC2 — every rejected row is named by its position and its reason: the response
  carries `rejected: number` and `errors: string[]` of the same length; nothing
  is written for a rejected row.
- AC3 — the Excel dialog opens the preview for a file with broken rows instead of
  the error screen: it shows the count of rows the file lost, lists their numbers
  and reasons, and keeps the import button available for the valid rows.
- AC4 — after a partial import the dialog shows all three numbers — imported,
  already present, rejected — in the success state, and the rejected rows are
  listed with their reasons in the same place.
- AC5 — payload-level failures keep the old behaviour: a body that is not an
  array, is empty, or exceeds 10000 items still answers `400` and writes nothing;
  if every row is invalid the answer is `200` with `imported: 0`, `rejected: n`
  and the reasons, and nothing is written.

## Решения владельца (приняты 2026-10-23)

1. **Сломанные строки пропускаются, валидные загружаются.** Импорт не отменяется
   из-за одной ошибки в файле. (Отклонена альтернатива «всё или ничего с ручным
   удалением битых строк в превью».)
2. Все строки битые → `200` с `imported: 0` и списком причин, а не `400`:
   это не сломанный запрос, а нормальный результат «импортировать нечего».
3. Номера строк в окне — из файла Excel (их даёт парсер). Отказы самого сервера
   показываются отдельной подписью «Сервер не принял» с позицией в загруженном
   списке, чтобы не выдавать позицию в списке за номер строки в файле.

Для сравнения, до исправления: файл на 500 строк с одной ошибкой → 0 загруженных
строк. После: 499 загруженных, 1 названная строка с причиной.

## Out of scope

- Тип файла и пятая колонка (`detectFileType`, задача №4 списка): здесь формат
  разбора не меняется.
- Парсеры «Инвентаризация» и «Каталог» (`parseInventory`, `parseCatalog`) молча
  пропускают строки без штрихкода или названия и не сообщают об этом — отдельный
  дефект, отдельная спека.
- `npm run dev` (задача №3), `.release-version` (задача №2), деплой и релиз.
- Правила дедупликации из `2026-10-23-import-duplicates.md` не пересматриваются:
  тот же штрихкод и та же дата внутри отдела по-прежнему склеиваются.
- Схема Prisma и миграции не меняются.
- Импорт из каталога (`/api/catalog`) и Telegram-путь не затрагиваются.

## Files and signatures (draft)

- `src/lib/inventory-import.ts` — new `partitionInventoryProducts(input: unknown):
  { products: InventoryProduct[]; rejected: { position: number; message: string }[] }`;
  payload-level guards (not an array, empty, >10000) keep throwing
- `src/pages/api/products/import.ts` — one validation pass before the transaction,
  loop over `products` only; `ImportResponse` gains `rejected: number`, `errors`
  carries the per-row messages
- `src/components/ImportExcelModal.tsx` — `PreviewData` gains `errors: string[]`;
  preview shown when valid rows exist; warning block with rejected rows; success
  state shows imported / already present / rejected
- `tests/import-partial-rows.test.cjs` — new suite: AC1, AC2, AC5
- `tests/import-duplicates.test.cjs` — replace "a failing row leaves no partial
  import" (see Contract change)
- `package.json` — `test:app` runs the new suite

## Contract change

`tests/import-duplicates.test.cjs`, test "a failing row leaves no partial
import" (added in PR #27). It locks in the behaviour this defect is about: a batch
with one bad row answers `400` and writes nothing, and a rejected duplicate batch
leaves the merged quantity untouched. Following AC1/AC2 the same two calls must
now answer `200`, import the valid rows, report the rejected one, and still apply
the duplicate merge (`5 + 3 = 8`) while writing nothing for the invalid row. The
atomicity assertion is not dropped: it becomes "the invalid row leaves no row of
its own and no partial write", checked by counting rows and reading the merged
quantity after the call.

## Risks and invariants

- Department scope: the validation pass must not read products; the transaction
  still derives `storeId` from `inventoryScope`.
- One transaction: valid rows commit together or not at all; a rejected row never
  produces a write, an event or a merge.
- Duplicate merge order is unchanged: skip/merge decision still happens inside the
  transaction, after validation.
- No invented data: a rejected quantity is never clamped to a valid number.
- Row numbering: file row numbers come from the parser (`Строка N`); server
  positions are labelled separately.
- A partial import must look like a warning with numbers, not like a red failure:
  the owner has to be able to tell how many rows did not land.
- The success screen must stay readable on a phone at 360 px: three numbers and a
  scrollable list of rejected rows, no horizontal scroll.
- Response shape stays additive: `imported` and `skipped` keep their meaning for
  existing callers.

## Verification plan

- AC1 → `tests/import-partial-rows.test.cjs`, «valid rows are imported when one
  row is invalid»
- AC2 → same suite, «the rejected row is named and writes nothing»
- AC3 → same suite asserting the parse result plus a browser walk-through of the
  dialog; the guard itself is UI-only, so the visual check is the evidence
- AC4 → browser walk-through after a partial import (local `next start`), three
  numbers and the rejected list visible
- AC5 → `tests/import-partial-rows.test.cjs`, «payload failures still answer 400»
  and «an all-invalid batch imports nothing and names every row»
- Contract change → `tests/import-duplicates.test.cjs`, both assertions rewritten
  per the section above and green

Standing checks: `npm run typecheck`, `npm run test:app`,
`npm run check:context` + `npm run test:harness`, `npm run build` (bundling
changes), browser walk-through.

## Result and handoff

Not implemented yet: waiting for `Status: APPROVED`.
