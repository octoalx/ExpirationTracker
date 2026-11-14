# Sign-in: floating labels overlap autofilled values

Status: DRAFT
Owner approval:
Type: defect
Branch: claude/signin-floating-labels (fresh from origin/main when approved)
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves this file. Until then no code and no test edits.

## Что изменится для вас

На экране входа подписи «Email» и «Пароль» не будут накладываться на введённые
или автозаполненные значения. Браузерная подсказка для автозаполнения остаётся
как есть: её стиль страница не меняет.

## Problem

Скриншот с телефона (Brave, `expiry.axnode.xyz`): подпись «Email» налезает на
`admin@localhost`, «Пароль» — на точки. В `src/pages/auth/signin.tsx` подпись
переключается по React-state (`focused || value.length > 0`). Браузер заполняет
поле без события `onChange`, state остаётся пустым, подпись стоит в позиции
пустого поля и накладывается на текст. Та же логика в `FloatingInput`.

## Acceptance criteria

- AC1 — при значении в поле, записанном браузером без события ввода, подпись
  находится над полем (класс плавающей позиции), а не поверх текста.
- AC2 — при пустом поле и без фокуса подпись стоит внутри поля на месте placeholder.
- AC3 — при фокусе подпись поднимается, как сейчас.
- AC4 — на ширине 375 px ни одна подпись не перекрывает введённый текст.

## Out of scope

- Вход, NextAuth, валидация, тексты ошибок.
- Отключение автозаполнения браузером (`autoComplete`) — отдельное решение владельца.
- Другие экраны с `FloatingInput`, кроме `signin.tsx`, если их нет в списке файлов.

## Files and signatures (draft)

- `src/pages/auth/signin.tsx` — `FloatingInput`: состояние подписи через
  `peer-placeholder-shown` и `peer-focus` вместо `value.length`
- `tests/signin-floating-label.test.ts` — новый: проверка классов подписи

## Contract change

none

## Risks and invariants

- UI states on a phone: подпись не должна мешать тапу по полю.
- Браузер может не отдавать события ввода; решение не должно зависеть от React-state.

## Verification plan

- AC1 → Playwright: установить `value` через DOM без события ввода, проверить, что подпись получает класс плавающей позиции; скриншот 375 px
- AC2 → Playwright: пустое поле, подпись внутри поля
- AC3 → Playwright: фокус поднимает подпись
- AC4 → скриншот 375 px с автозаполненным значением, проверка перекрытия по геометрии (bounding box)

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context`
+ `npm run test:harness`, `npm run build`, browser walk-through.

## Result and handoff

Not started. Spec is DRAFT.
