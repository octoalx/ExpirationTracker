# Admin catalog save: the button keeps looking busy after a successful import

Status: APPROVED
Owner approval: Алекс, 14.11.2026, в чате: «Да: утвердить спеку, ветка local/catalog-save-stuck-loading, фикс, тесты, PR» и выбор варианта «Очищать оба поля после успеха: кнопка возвращается в исходный серый вид без курсора-часов, сообщение с результатом остаётся на экране».
Type: defect
Branch: local/catalog-save-stuck-loading
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves. Until then no code and no test edits: the spec is the only file that may
be committed. See `docs/engineering/workflow.md`.

## Что изменится для вас

После успешного сохранения каталога экран вернётся в исходное состояние: оба поля
с файлами очистятся, кнопка станет обычной серой без курсора-часов, а под ней
останется сообщение с числом загруженных товаров. Курсор ожидания появится только
пока идёт настоящая отправка файлов. Результат импорта в каталоге не меняется.

## Problem

Observed on 2026-11-14 in production after a successful 443 701-row import
(screenshot `dashboard_20261114_215936_image_8a9627.png`, Network panel
`dashboard_20261114_215936_image_0956ca.png` showing chunk offsets 0 and 94371840
and a 24 s `finalize`). The button reads «Сохранить каталог», is disabled, and on
hover shows the wait cursor, so the finished import still looks in progress.

Mechanism, in code, two independent causes:

1. `src/components/CatalogImport.tsx:169` clears the two `File` states after a
   successful import (`setGoodsFile(null); setBarcodeFile(null);`) but both
   `<input type="file">` elements are uncontrolled — there is no `ref` and no
   `value` reset (`grep -c 'ref={' … → 0`). The inputs keep rendering the chosen
   file names while the button is disabled by `disabled={busy || !goodsFile ||
   !barcodeFile}`, so the screen shows "files chosen, button dead".
2. `src/styles/globals.css:310` — `.primary-action:disabled { opacity: .55;
   cursor: wait; }`. The wait cursor is meant for "work in progress", but it is
   applied to every disabled state, including "no files selected". Hovering also
   still hits `.primary-action:hover { background: #12479a; }` (line 308), so a
   disabled button darkens on hover — the "loading animation on hover" the owner
   reported.

The state itself is correct: `busy` is reset in `finally`, the finalize response
and the message arrive. Only the rendered state is wrong.

## RED evidence

Static assertions, because this repository's component tests read the source
(the same technique as `tests/admin-catalog-update.test.ts`). Before the fix:

```
$ grep -c 'ref={' src/components/CatalogImport.tsx
0

$ grep -n ':disabled' src/styles/globals.css
310:.primary-action:disabled { opacity: .55; cursor: wait; transform: none; }
```

The same two assertions inside `tests/admin-catalog-update.test.ts`, with the
source changes stashed and the new tests in place:

```
$ git stash push -- src/components/CatalogImport.tsx src/styles/globals.css
$ node --import tsx --test tests/admin-catalog-update.test.ts
✖ a saved catalog clears both file inputs, not only their React state
  AssertionError [ERR_ASSERTION]: both inputs are bound to a ref
✖ a disabled save button is neutral; the wait cursor means work in progress
  AssertionError [ERR_ASSERTION]: a disabled primary action shows a plain cursor
ℹ pass 4
ℹ fail 2

$ git stash pop
```

## Acceptance criteria

- AC1 — after a successful import both file inputs render empty (their `value` is
  reset together with the `File` state) and the result message stays on screen.
  Check: static assertion in `tests/admin-catalog-update.test.ts` that each file
  input is bound through a `ref` and that the reset sets `input.value = ""`.
- AC2 — a disabled `.primary-action` shows the default cursor, not the wait
  cursor; the wait cursor applies only while work runs, through an explicit
  `data-busy` state on the button.
- AC3 — a disabled `.primary-action` keeps its background on hover.
- AC4 — unchanged behaviour: spinner and «Загрузка…» text while `busy`, byte
  progress line, resume of an interrupted upload, error messages and the retry
  hint.

## Out of scope

- The chunked upload protocol, the four `/api/admin/catalog-upload/*` routes, nginx
  and Cloudflare limits.
- Other screens that reuse `.primary-action` (dialogs, admin tabs): the CSS change
  only touches the `:disabled` and `:disabled:hover` rules, their enabled styling
  is untouched.
- `.dialog-action-danger:disabled` and the other disabled rules at lines 352, 354,
  380, 506.
- The layout and wording of the success message.

## Files and signatures (draft)

- `src/components/CatalogImport.tsx` — `useRef<HTMLInputElement>` for both inputs,
  `data-busy={busy}` on the save button, reset helper clearing state and input value
- `src/styles/globals.css` — `.primary-action:disabled` cursor, new
  `.primary-action[data-busy="true"]:disabled { cursor: wait; }`, disabled hover rule
- `tests/admin-catalog-update.test.ts` — assertions for AC1–AC3

## Contract change

none

## Risks and invariants

- UI on a phone at 360 px: the button and inputs keep their current classes and
  height; only cursor and reset change.
- No API, Prisma or notification behaviour is touched.

## Verification plan

- AC1 → `npm run test:app` — new assertion "the file inputs are cleared after a
  saved catalog", red before, green after
- AC2, AC3 → `npm run test:app` — assertions on the `:disabled` rules in
  `src/styles/globals.css`, red before, green after
- AC4 → `tests/admin-catalog-update.test.ts` and `tests/catalog-upload-chunks.test.cjs`
  unchanged and green; browser walk-through of one save on the dev server
- Standing checks: `npm run typecheck`, `npm run check:context`,
  `npm run check:spec`, `npm run build`

## Result and handoff

- AC1 → PASS — `tests/admin-catalog-update.test.ts` "a saved catalog clears both file
  inputs, not only their React state": red before the fix, green after; the two inputs
  now carry `ref={goodsInput}` / `ref={barcodeInput}` and their `value` is reset with the state.
- AC2 → PASS — same file, "a disabled save button is neutral; the wait cursor means work
  in progress": `.primary-action:disabled` has `cursor: not-allowed`, the wait cursor lives
  on `.primary-action[data-busy="true"]:disabled`, and the built CSS
  (`.next/static/css`) keeps all three rules after cssnano.
- AC3 → PASS — the same test checks `.primary-action:disabled:hover { background: #1554b5 }`.
- AC4 → PASS — `npm run test:app` 201/201, `npm run test:harness` 14/14, `npm run typecheck`,
  `npm run check:context`, `npm run build` all clean.

Limitations: no browser walk-through on a dev server (no local stand with a 230 MB pair in
this session); the fix is verified by static assertions and the production CSS build. The
deployment is not part of this task — it follows the merged PR and the release workflow.
Next useful step: after the merge, one manual save on production to confirm the inputs
clear on screen.
