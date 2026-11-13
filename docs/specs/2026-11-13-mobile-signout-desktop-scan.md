# Мобильный выход из аккаунта и сканер только на телефоне

Status: APPROVED
Owner approval: Алекс, 13.11.2026, в чате: «Вливай в мейн и дорабатывай все остальное. Нужно убрать, сканировать товар с версии для браузера и добавить выход из аккаунта для мобильной версии»
Type: feature
Branch: local/mobile-signout-desktop-scan
Spec gate: `npm run check:spec`

## Что изменится для вас

На компьютере пропадёт кнопка «Сканировать товар»: со сканером работают с телефона, на компьютере остаётся поиск по названию и штрих-коду. На телефоне появится кнопка выхода из аккаунта в шапке — раньше выйти можно было только с компьютера.

## Problem

Кнопка сканера сейчас одна на все ширины (`src/pages/dashboard.tsx:568`), хотя камера нужна на телефоне; на компьютере она открывает модалку с камерой, которой на рабочем месте нет. Выход из аккаунта живёт только в боковом меню (`src/components/Layout.tsx:29`), а оно скрыто на телефоне — с телефона выйти из аккаунта нельзя.

## Acceptance criteria

- AC1 — at 1440 on `/dashboard` there is no «Сканировать товар» button in the DOM at all, the scanner dialog is not rendered and no control on the page opens it; the add-product dialog also has no camera button at the barcode field. Search by name/barcode and manual barcode entry still work.
- AC2 — at 375 the «Сканировать товар» button is present, opens the scanner dialog and starts the camera; the add-product dialog keeps its camera button.
- AC3 — at 375 the phone header has a sign-out control with an accessible name; pressing it ends the session, lands on `/auth/signin`, and `/api/products` answers 401 afterwards.
- AC4 — at 1440 the sidebar sign-out works as before.
- AC5 — `npm run typecheck`, `npm run test:app`, `npm run build` are green.

## Out of scope

- Remaining screens and dialogs beyond removing the scanner from the desktop.
- API, schema and permission changes.
- Phone header design beyond adding the sign-out button.

## Files and signatures

- `src/pages/dashboard.tsx` — `useIsDesktop` gates the «Сканировать товар» button and the whole scanner `Dialog`; a resize to `md` closes the scanner.
- `src/components/AddProductForm.tsx` — the camera button at the «Штрих-код» field is phone-only; the manual field and catalog lookup stay on every width.
- `src/components/MobileHeader.tsx` — the profile row is rebuilt as a container with the `/settings` link and a sibling sign-out `button` (44×44 minimum) calling `signOut({ callbackUrl: "/auth/signin" })`.
- `src/lib/media-query.ts` — new `useIsDesktop()` hook and `DESKTOP_QUERY` (`(min-width: 768px)`, Tailwind `md`); starts `false` so SSR and hydration agree on the phone-first markup.
- `tests/mobile-product-flow.test.ts` — source checks for both rules above.

`/settings` has no scanner entry point (checked `src/pages/settings.tsx`), so nothing there is touched.

Any file needed beyond this list is added here with an `out-of-spec:` note.

## Contract change

none

## Risks and invariants

- Выход: используется существующий `signOut` из `next-auth/react`; после выхода сессионная cookie очищается, защищённые API отвечают 401 (проверяется запросом).
- Телефон: кнопка выхода не должна быть вложена в ссылку — иначе невалидная разметка и двойной тап; зона нажатия ≥ 44 px.
- Сканер: удаление с десктопа не должно ломать мобильный путь и клавиатурные сокращения, если они используются на телефоне.

## Verification plan

- AC1 → browser at 1440: `document.body.innerText` / `querySelectorAll` count for «Сканировать товар» = 0, no `[role=dialog]` with that title, add-product dialog has no camera button; search and manual barcode entries still render. Screenshot `redesign/dashboard-1440-no-scan.png`.
- AC2 → browser at 375: button found, click opens the dialog, camera element present. Screenshot `redesign/dashboard-375-scan.png`.
- AC3 → browser at 375: click the header sign-out, `location.pathname` = `/auth/signin`, then `fetch("/api/products")` = 401. Screenshot `redesign/mobile-header-signout-375.png`, evidence `redesign/log-signout-check.txt`.
- AC4 → browser at 1440: sidebar «Выйти» still ends the session (code path unchanged, verified by the same 401 check after clicking it).
- AC5 → `npm run typecheck`, `npm run test:app`, `npm run build`.

## Result and handoff

- AC1 → PASS — at 1440 «Сканировать» occurs 0 times in `document.body.innerText`, 0 scanner buttons, `[role=dialog]` count 0; the add-product dialog shows 0 elements with `aria-label="Сканировать штрих-код"` while `#add-barcode` and «Найти название в каталоге» stay; search «Цемент» narrowed 8 → 2 rows. `redesign/dashboard-1440-no-scan.png`.
- AC2 → PASS — at 375 the button (343×52) is present, a click opens the dialog with `<video>`; the walk-through browser has no camera, so the panel shows «Камера не найдена. Введите штрих-код вручную.» — the dialog and the manual field work. `redesign/dashboard-375-scan.png`.
- AC3 → PASS — header sign-out is a sibling `button` (44×44, `aria-label="Выйти из аккаунта: <имя>"`, not inside the `/settings` link); a click lands on `/auth/signin`, the session cookie is empty, `fetch("/api/products")` = 401. `redesign/mobile-header-signout-375.png`, `redesign/log-signout-check.txt`.
- AC4 → PASS — at 1440 the sidebar «Выйти» ends the session at `/auth/signin` and `/api/products` = 401 afterwards.
- AC5 → PASS — typecheck 0 errors; `test:app` 132 tests, 132 pass, 0 fail; `build` completed (dashboard 56.1 kB / 215 kB first load).

Not verified: a real phone camera stream (the test browser has no capture device) and iOS/Android Safari behaviour; both go through the unchanged `BarcodeCamera`.

