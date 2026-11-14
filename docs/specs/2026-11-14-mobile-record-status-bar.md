# Mobile product list: status bar misaligned with the card

Status: DRAFT
Owner approval:
Type: defect
Branch: claude/mobile-record-status-bar (fresh from origin/main when approved)
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves this file. Until then no code and no test edits.

## Что изменится для вас

В мобильном списке товаров цветная полоска статуса слева будет выровнена по
скруглённому краю карточки и не будет обрезаться или смещаться. Отступы внутри
карточки станут ровными.

## Problem

Скриншот с телефона, вкладка «Товары»: цветная полоса слева выглядит криво, отступ
внутри карточки неровный. Наблюдение по коду: в `src/components/products/MobileProductList.tsx`
полоса задаётся `border-l-4` на внутреннем блоке группы (строка ~330), а карточка
— `relative rounded-xl` с `overflow-hidden` у записи (строки ~296, ~323). Полоса
не совпадает со скруглением контейнера. Это гипотеза по коду; в браузере не проверена.

## Acceptance criteria

- AC1 — полоса статуса совпадает по высоте и скруглению с карточкой, без зазора
  и без выступа за край на ширине 375 px.
- AC2 — выделенная (highlighted) запись не смещает полосу и текст.
- AC3 — состояния expired / warning / safe сохраняют свои цвета (`GROUP_MARKER`).
- AC4 — горизонтальной прокрутки на 375 px нет.

## Out of scope

- Desktop-таблица (`ProductTableEnhanced.tsx`).
- Цвета статусов и их логика, сроки, группировка.
- `ProductCard.tsx` — отдельный компонент, не в этой задаче, если скриншот не
  покажет его на экране.

## Files and signatures (draft)

- `src/components/products/MobileProductList.tsx` — классы полосы и обёртки записи
- `tests/mobile-product-list.test.ts` — новый: проверка классов полосы и
  отсутствия `border-l` на внутреннем блоке без скругления

## Contract change

none

## Risks and invariants

- UI states on a phone: тап по записи и раскрытие действий не должны меняться.
- Цвета статуса и срок годности не меняются.

## Verification plan

- AC1, AC2 → Playwright, 375 px, скриншоты до и после с `deviceScaleFactor: 2`; сравнение геометрии полосы и карточки
- AC3 → Playwright: три группы с разными статусами, цвета из `GROUP_MARKER`
- AC4 → Playwright: `scrollWidth <= clientWidth`
- Test file → статический тест классов

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context`
+ `npm run test:harness`, `npm run build`, browser walk-through.

## Result and handoff

Not started. Spec is DRAFT. Root cause is a hypothesis from code until a browser
walk-through confirms it.
