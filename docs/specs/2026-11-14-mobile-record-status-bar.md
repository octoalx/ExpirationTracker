# Mobile product list: status bar misaligned with the card

Status: APPROVED
Owner approval: Алекс, 14.11.2026, в чате: «реши просто три эти проблемы… предоставь pull-реквесты»
Type: defect
Branch: claude/mobile-record-status-bar
Spec gate: `npm run check:spec`


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
- `tests/mobile-product-list.test.ts` — новый: структура полосы и цвета групп
- `package.json` — `test:app`: добавить `tests/mobile-product-list.test.ts`

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

Checked 14.11.2026 on a disposable SQLite seeded with four products (expired, warning, two safe), `next build` and `next start` with `DISABLE_BACKGROUND_JOBS=true`, Playwright at 375 px.

Root cause confirmed in the browser before the fix: the 4 px coloured border sat on the header row inside the rounded card (radius 14 px, `overflow: hidden`), so the stripe bent at the corners and did not cover the expanded part of the card.

- AC1 → PASS — bar is a separate `span` 4 px wide with 12 px inset top and bottom (measured on all four cards); `tests/mobile-product-list.test.ts`; screenshot `mobile-card-after.png`
- AC2 → PASS — the first card expanded: bar stays inside the card with the same insets; the highlighted state uses the same element
- AC3 → PASS — colours measured: expired rgb(180,35,24), warning rgb(183,121,31), safe rgb(118,130,143), matching the group map
- AC4 → PASS — `scrollWidth` equals `clientWidth` at 375 px
- Static: `tests/mobile-product-list.test.ts` 2/2

Commands: `npm run typecheck` 0 errors; `npm run test:app` 181/181; `npm run test:harness` 14/14; `npm run build` OK.

Limitations: no real phone device; the bottom navigation covered part of the clipped screenshot, so the measurements, not the picture, are the evidence for the bottom edge.

