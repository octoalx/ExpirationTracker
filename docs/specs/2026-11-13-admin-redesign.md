# Админ-панель на дизайн-системе редизайна, русские роли, прощание с Issue Log

Status: APPROVED
Owner approval: Алекс, 13.11.2026, в чате: «Вливай в мейн и дорабатывай все остальное» (этап остальных экранов; админка — последний)
Type: feature
Branch: local/admin-redesign
Spec gate: `npm run check:spec`

## Что изменится для вас

Админ-панель станет такой же, как остальное приложение: те же цвета, шрифты и карточки. Роли перестанут называться по-английски — будет «Сотрудник» и «Администратор», и кнопки тоже по-русски. Отдельная страница «Issue Log», которая была на английском и дублировала вкладку «Журнал», больше не нужна — её заменяет вкладка «Журнал». Всплывающие окна браузера (`confirm`/`prompt`) в админке заменяются нормальными.

## Problem

`/admin` и шесть его вкладок остались на старых классах и на нативных окнах подтверждения; в таблице пользователей роль показана сырыми значениями `USER`/`ADMIN`, кнопки — «Сделать USER / Сделать ADMIN» (`redesign/INVENTORY.md`, проблема 10); кнопка «Сохранить каталог» — зелёная, что нарушает палитру проекта (проблема 12); отдельная страница `/admin/issues` целиком на английском и не связана с навигацией (проблема 9).

## Acceptance criteria

- AC1 — шесть вкладок `/admin` на 1440 и 375 собраны на токенах редизайна; шапка, переключатель вкладок и карточки в том же стиле, что дашборд, «Обход», «Статистика» и «Настройки».
- AC2 — в интерфейсе админки нет латиницы в ролях и действиях: «Сотрудник / Администратор», «Назначить администратором / Снять права администратора»; поиск латинских слов `USER`, `ADMIN`, `Timestamp`, `Level`, `Message`, `Meta`, `No logs found` по видимому тексту админки — 0 совпадений.
- AC3 — `/admin/issues` удалена: маршрут убран, страница и её компоненты не собираются; всё, что она показывала, доступно во вкладке «Журнал».
- AC4 — в админке нет `window.confirm`, `window.prompt`, `window.alert`: удаление пользователя и отдела, сброс пароля, очистка журнала, восстановление из копии, удаление копии, остановка Telegram — через диалог приложения с тем же результатом.
- AC5 — кнопки и метки используют палитру проекта: «Сохранить каталог» — основное синее действие, а не зелёное; красный остаётся только для опасных действий.
- AC6 — на 375 нет горизонтального скролла, цели ≥ 44 px, вкладки не обрезаны, таблица пользователей читается карточками, как сейчас.
- AC7 — `npm run typecheck`, `npm run test:app`, `npm run build` зелёные; ручной проход 1440 и 375 по всем вкладкам, снимки в `redesign/`.

## Out of scope

- Логика администрирования: права, создание учётных записей, бэкапы, импорт/экспорт, Telegram — без изменений.
- Правило пароля «минимум 8» в других местах не унифицируется (отдельная задача).
- Остальные экраны уже переделаны и не трогаются.

## Files and signatures (draft)

- `src/pages/admin/index.tsx`
- `src/components/admin/UsersTab.tsx`
- `src/components/admin/DepartmentsTab.tsx`
- `src/components/admin/LogsTab.tsx`
- `src/components/admin/BackupTab.tsx`
- `src/components/admin/TelegramStatus.tsx`
- `src/components/CatalogImport.tsx`
- `src/lib/admin-labels.ts` (если нужен общий словарь ролей)
- `tests/admin-redesign.test.ts` — новый набор на правила
- `src/pages/admin/issues.tsx`, `src/components/admin/issues/*` — удаление

## Contract change

Роль в интерфейсе переименована «USER/ADMIN» → «Сотрудник/Администратор»; страница `/admin/issues` удалена. Если тесты или проверки ссылались на эти строки — обновить и указать здесь, что именно изменилось.

## Risks and invariants

- Права: ADMIN видит админку, остальные — «Нет доступа» с тем же текстом; проверка сессии и hash-навигация по вкладкам сохраняются.
- Бэкапы и импорт: подтверждения меняют форму, но не результат; восстановление по-прежнему требует подтверждения.
- Удаление `/admin/issues`: убедиться, что на неё нет ссылок в навигации, тестах, документации; если ссылки есть — перевести на вкладку «Журнал».

## Verification plan

- AC1, AC6 → снимки 1440/375 всех вкладок, замер `scrollWidth` и минимальной высоты цели
- AC2 → поиск латиницы по отрендеренному тексту админки (Playwright), список совпадений должен быть пуст, кроме технических полей журнала
- AC3 → `ls src/pages/admin`: файла `issues.tsx` нет; `npm run build` не содержит маршрут `/admin/issues`
- AC4 → `grep -rn "window.confirm\|window.prompt\|window.alert" src/pages/admin src/components/admin` пуст
- AC5 → снимок вкладки «Каталог», кнопка синяя
- AC7 → команды

## Result and handoff

Проверено 13.11.2026 на production-сборке (`next start` на 3115), одноразовая SQLite `C:/tmp/et-admin-check.db`, Chromium 1440×900 и 375×812, вход под `admin@test.local`.

- AC1 → PASS. Шесть вкладок на токенах редизайна: контейнер `inventory-page … max-w-7xl`, шапка `work-page-title` с `entry-icon`, ряд вкладок с подчёркиванием `bg-dash-accent`, панели `border-dash-line bg-dash-panel`. Снимки `redesign/admin-1440-{users,departments,logs,catalog,backup,telegram}.png` и те же шесть на 375.
- AC2 → PASS. Поиск `USER`, `ADMIN`, `Timestamp`, `Level`, `Message`, `Meta`, `No logs found` по видимому тексту всех 12 экранов — 0 совпадений. Роли: «Сотрудник / Администратор», действия «Назначить администратором / Снять права администратора», сводка «Администраторов: 1». Коды `USER`/`ADMIN` остались только значениями формы и API.
- AC3 → PASS. `src/pages/admin` содержит только `index.tsx`; `src/components/admin/issues/` удалены (3 файла); в `pages-manifest.json` есть `/admin` и нет `/admin/issues`; API `/api/admin/issues` не тронут (вкладка «Журнал» читает `/api/admin/logs`).
- AC4 → PASS. `grep -rn "window.confirm\|window.prompt\|window.alert" src/pages/admin src/components/admin src/components/CatalogImport.tsx` пуст (exit 1). Шесть необратимых действий идут через общий диалог `ConfirmAction`: удаление пользователя, удаление отдела (с вводом названия), очистка журнала, восстановление копии, удаление копии, остановка/возобновление Telegram. Снимок диалога — `redesign/admin-1440-confirm.png`.
- AC5 → PASS. «Сохранить каталог» — `primary-action` (синяя #1554b5), зелёная кнопка убрана; красный остался только у опасных действий (класс `.dialog-action-danger` — рамка и текст #b42318, и красная кнопка подтверждения). Снимки `admin-1440-catalog.png`, `admin-375-catalog-save.png`.
- AC6 → PASS. На 375 `scrollWidth` = 375 на всех шести вкладках (на 1440 — 1440). Минимальная высота цели 44 px (Telegram 45, «Сохранить каталог» 48 при увеличенном кегле), ни одного элемента ниже 44. Вкладки в сетке 3×2, не обрезаны. Таблица пользователей на телефоне — карточки `md:hidden`, десктопная таблица скрыта. На дне прокрутки контент выше фиксированной нижней навигации на 31–32 px.
- AC7 → PASS. `npm run typecheck` — 0 ошибок; `npm run test:app` — 170 тестов, 170 pass, 0 fail; `npm run build` — успешно, `/admin` 4.48 kB.

Файлы: `src/pages/admin/index.tsx`, `src/components/admin/{UsersTab,DepartmentsTab,LogsTab,BackupTab,TelegramStatus}.tsx`, `src/components/admin/ConfirmAction.tsx` (новый), `src/components/CatalogImport.tsx`, `src/lib/admin-labels.ts` (новый), `src/styles/globals.css` (`.dialog-action-danger`), `tests/admin-redesign.test.ts` (новый, 7 тестов). Удалено: `src/pages/admin/issues.tsx`, `src/components/admin/issues/{IssueTable,Columns,DataTable}.tsx`.

`out-of-spec: src/components/admin/ConfirmAction.tsx, общий диалог подтверждения для пяти вкладок вместо пяти копий разметки`
`out-of-spec: src/styles/globals.css, класс .dialog-action-danger — утилиты не перебивают неразмеченные правила .dialog-action-secondary`
`out-of-spec: package.json, регистрация tests/admin-redesign.test.ts в test:app`

Ограничения: экранная клавиатура телефона не проверялась; Telegram-вкладка на стенде без настроенного бота показывает «Бот ещё не настроен на сервере» при активной кнопке «Остановить обработку» — это прежняя логика, вне задачи; на 375 в полноэкранных снимках фиксированная нижняя навигация скрыта только на время снимка (её зазор измерен отдельно); очистка журнала, удаление отдела и восстановление копии на стенде до конца не выполнялись — проверена форма подтверждения, не результат запроса; `src/components/admin/users/` остался неиспользуемым (не входил в задачу).
