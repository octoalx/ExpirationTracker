# Редизайн ExpirationTracker: сводная спека выпуска

Status: APPROVED
Owner approval: Алекс, 13.11.2026, в чате: «Вливай в мейн и дорабатывай все остальное» и «Сделай деплой на сервер»
Type: feature
Branch: local/redesign-2026-11-13
Spec gate: `npm run check:spec`

## Зачем эта спека

Редизайн шёл семью задачами, у каждой своя спека и свой набор файлов:

- `docs/specs/2026-11-13-dashboard-redesign.md`
- `docs/specs/2026-11-13-mobile-signout-desktop-scan.md`
- `docs/specs/2026-11-13-dashboard-dialogs.md`
- `docs/specs/2026-11-13-store-and-stats-redesign.md`
- `docs/specs/2026-11-13-settings-redesign.md`
- `docs/specs/2026-11-13-admin-redesign.md`

Гейт `scripts/check-spec.mjs` читает из тела PR одну спеку и сверяет с ней весь диф. Ветка защиты `main` не пускает прямые push, поэтому все семь задач приезжают одним PR. Эта спека — сводная: она перечисляет файлы всех этапов и не отменяет ни одну из шести; результаты проверок остаются в них.

## Что изменится для вас

Приложение ExpirationTracker получает новый вид на всех экранах: дашборд, окна, обход, статистика, настройки, админка. Логика, права и данные не меняются. Выпуск идёт через обычный workflow `deploy-production.yml` с резервной копией и проверкой здоровья.

## Acceptance criteria

- AC1 — все шесть спек этапов имеют `Status: APPROVED` и заполненный `Owner approval`, а раздел «Result and handoff» в каждой содержит PASS/FAIL/SKIP по каждому AC, а не `PENDING`.
- AC2 — `npm run typecheck` даёт 0 ошибок, `npm run test:app` проходит полностью, `npm run build` собирается на ревизии ветки.
- AC3 — в приложении нет `window.confirm`, `window.prompt` и `window.alert` (кроме мест, явно перечисленных в спеках этапов), нет латинских `USER`/`ADMIN` в видимом тексте админки, страница `/admin/issues` отсутствует в сборке.
- AC4 — выпуск выполняется workflow `deploy-production.yml` с `ref`, равным ревизии этого PR; health check зелёный, публичный адрес отвечает.

## Out of scope

- Новые функции и изменения API, схемы Prisma, прав ролей.
- Push других веток и release-notes.
- Уборка `dark:`-классов по всему коду и унификация правила пароля — отдельные задачи.

## Files and signatures (draft)

- `package.json`
- `src/components/AddProductForm.tsx`
- `src/components/CatalogImport.tsx`
- `src/components/DashboardProducts.tsx`
- `src/components/EditProductForm.tsx`
- `src/components/ImportExcelModal.tsx`
- `src/components/IntegrationCard.tsx`
- `src/components/MobileHeader.tsx`
- `src/components/TelegramConnect.tsx`
- `src/components/admin/BackupTab.tsx`
- `src/components/admin/ConfirmAction.tsx`
- `src/components/admin/DepartmentsTab.tsx`
- `src/components/admin/LogsTab.tsx`
- `src/components/admin/TelegramStatus.tsx`
- `src/components/admin/UsersTab.tsx`
- `src/components/admin/issues/Columns.tsx`
- `src/components/admin/issues/DataTable.tsx`
- `src/components/admin/issues/IssueTable.tsx`
- `src/components/products/DashboardSummary.tsx`
- `src/components/products/MobileProductList.tsx`
- `src/components/products/ProductTableEnhanced.tsx`
- `src/components/products/index.ts`
- `src/components/store/Inspection.tsx`
- `src/components/store/StoreTeam.tsx`
- `src/lib/admin-labels.ts`
- `src/lib/days-left.ts`
- `src/lib/media-query.ts`
- `src/lib/product-form.ts`
- `src/lib/product-status-actions.ts`
- `src/pages/admin/index.tsx`
- `src/pages/admin/issues.tsx`
- `src/pages/dashboard.tsx`
- `src/pages/settings.tsx`
- `src/pages/stats.tsx`
- `src/pages/store.tsx`
- `src/styles/globals.css`
- `tests/admin-redesign.test.ts`
- `tests/dashboard-dialogs.test.ts`
- `tests/dashboard-expiry-groups.test.ts`
- `tests/mobile-product-flow.test.ts`
- `tests/mobile-product-sort.test.ts`
- `tests/mobile-status-actions.test.ts`
- `tests/settings-redesign.test.ts`
- `tests/store-stats-redesign.test.ts`

## Contract change

Сводная спека ничего не меняет в контракте: изменения контракта описаны в спеках этапов (`mobile-signout-desktop-scan`, `admin-redesign`).

## Risks and invariants

- Выпуск перезапускает контейнер и трогает боевую SQLite: workflow снимает снимок базы и отказывается идти дальше без него.
- На хосте есть неотслеживаемый каталог `release-0afaa25/` — workflow исключает его из проверки «грязного дерева».
- Миграции в этом выпуске аддитивные; откат восстанавливает только код, данные не откатываются.
- Public URL: `https://expiry.axnode.xyz`.

## Verification plan

- AC1 → чтение шести спек: `grep -n "Status:" docs/specs/2026-11-13-*.md` и `grep -n "PENDING" docs/specs/2026-11-13-*.md` — пусто
- AC2 → `npm run typecheck`, `npm run test:app`, `npm run build` на ревизии ветки
- AC3 → `grep -rn "window.confirm\|window.prompt\|window.alert" src | wc -l`, проверка отсутствия `/admin/issues` в `pages-manifest.json`
- AC4 → `gh run view` по запуску workflow: preflight, backup, deploy, health check — success; `curl -I https://expiry.axnode.xyz`

## Result and handoff

- AC1 → PENDING
