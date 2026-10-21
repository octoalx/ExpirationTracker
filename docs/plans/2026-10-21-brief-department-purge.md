# Продолжение: очистка прода и правка AGENTS.md

Заполнено 2026-10-21 18:00 UTC. Новая сессия видит только этот файл — всё нужное внутри.

## Состояние на момент записи (проверено командами)

- PR #22 слит: merge-коммит `0c1a771`, ветка `local/department-access-model` удалена и локально, и на GitHub.
- `origin/main` = `0c1a771`, локальный `main` = он же, рабочее дерево чистое.
- **Прод пока на СТАРОМ коде.** Последний успешный релиз — `0de6a25` (workflow `deploy-production.yml`, 2026-10-21T11:35Z). Модели отделов на проде ещё нет.
- Прод: контейнер `expirationtracker-app-1` на `cloudvps` (`146.103.42.228:34657`), БД `/app/data/dev.db`, ~98 МБ, WAL, бэкапы в `/app/backups`.

## Первое действие

Do: проверить, вышел ли релиз `0c1a771` на прод:

```
gh run list --workflow=deploy-production.yml -L 5 --json headSha,status,conclusion,createdAt
```

Если релиза нет — **очистку не начинать**. Сначала сказать владельцу, что нужен релиз (workflow запускает только он, вручную, с подтверждением окружения `production`), и подождать. Релиз идёт 8–25 минут, это норма.

Do NOT start with: не удалять данные и не трогать прод-БД до релиза.

## DONE — что уже сделано и не нужно переделывать

| Пункт | Доказательство |
|---|---|
| Модель отделов реализована | PR #22, коммит `8c6fb5f`, merge `0c1a771` |
| Схема: `Store.id` → cuid, `createdAt` | `prisma/migrations/20261021000000_department_access_model` |
| Спецификация + решения владельца | `docs/plans/2026-10-21-department-access-model.md` |
| Краткий бриф прошлой сессии | `docs/plans/2026-10-21-brief-department-access-model.md` |
| Состояние проекта | `memory-bank/activeContext.md` (раздел про отделы) |
| Проверки | typecheck чисто, `test:app` 98/98, `test:harness` 6/6, `check:context` PASS, `build` exit 0 |
| Прогон живого приложения на одноразовой БД | 25/25 проверок (регистрация, вход 3 ролями, найм, удаление, 403 у админа, реестр отделов, вход/выход поддержки) |

## Правила (из `AGENTS.md`, читать его первым)

- Ветка от свежего `origin/main` (`local/…`), один PR, **в `main` не коммитить**.
- Прод-операции: миграции на боевой БД, удаление данных, восстановление, реальные отправки email/Telegram — только по **явному разрешению владельца**.
- `deploy.sh` и workflow деплоя самому не запускать; окружение `production` подтверждает владелец.
- Не удалять `/app/backups`. Никогда не делать `prisma migrate reset` / `db push` на проде. Не force-push.
- Секреты (Telegram-токен и т.п.) не выводить в чат: они в `%LOCALAPPDATA%\hermes\.env`.
- Код, тесты и техдокументация — на английском; общение с владельцем — на русском.
- Проверки при завершении: `npm run typecheck`, `npm run test:app`, `npm run check:context`, `npm run test:harness`; перед релизом — `npm run verify:release`.

## Задача 1 — очистка прода (BLOCKED: нужен релиз + одно явное «да»)

Числа, измеренные 2026-10-21: 4 аккаунта, 1 магазин `main`, 3 членства, 436 ACTIVE товаров (`storeId=main`, автор `admin`), 3 личных товара Олега (`storeId=null`), 1321 `ProductEvent`, 106 `CatalogEntry`, **444 297 `SharedCatalogEntry`**.

Порядок:

1. **Проверенный бэкап.** Снять копию `/app/data/dev.db` штатным механизмом приложения (не `cp` на живой WAL-базе). Убедиться, что копия открывается на одноразовой базе и `PRAGMA foreign_key_check` пуст. Ничего не удалять до этого шага. Копию сохранить в `/app/backups`.
2. **Показать владельцу точный список удаляемого** и получить одно «да».
3. **Удалить в одной транзакции, строго в этом порядке** (иначе упрётся в FK):
   `ProductClaim` → `TelegramWarning` → `TelegramDelivery` → `TelegramButton` → `TelegramUpdate` → `TelegramLinkRequest` → `TelegramLink` → `ProductEvent` → `Product` → `StoreMembership` → `Store` → все `User`, кроме `admin@localhost`.
   Сохранить: `SharedCatalogEntry`, `Settings`/`Account`/`Session` админа, `SystemLog`, `EmailLog`. `Session`/`Account`/`Settings` удалённых уедут каскадом.
4. **Проверки после:** `User=1`, `Store=0`, `StoreMembership=0`, `Product=0`, `ProductEvent=0`, `SharedCatalogEntry` не уменьшился, `foreign_key_check` пуст.
5. **Проверка в приложении:** войти админом → `/admin` открывается, вкладка «Отделы» показывает «Отделов пока нет», сам админ в списке «Аккаунты без отдела», `/api/products` отдаёт 403, новая регистрация создаёт свежий отдел.

Как делать: операторский скрипт `scripts/purge-departments.ts` с громким флагом подтверждения, на ветке + PR, сначала прогон **на копии**. Данные на проде не менять, пока не пройдёт прогон на копии.

## Задача 2 — вторая миграция `Product.storeId NOT NULL` (PROPOSED, только после очистки)

Сейчас колонка намеренно nullable: иначе миграция упала бы на 3 личных строках Олега. После очистки её можно закрыть, но есть две ловушки — не наступить:

- **Тест легаси-снапшота.** `tests/store-inspection.test.ts`, тест «incremental migration and prepared legacy snapshot preserve every legacy product field» строит базу старше `20261006000000`, кладёт товар без `storeId`, затем прогоняет все миграции подряд. Строка получает `storeId = NULL`, и новая NOT NULL-миграция на ней упадёт. Тест придётся обновить вместе с миграцией.
- **Восстановление старых копий.** `src/pages/api/admin/restore.ts` создаёт товары с `storeId: product.storeId ?? null`, поэтому легаси-архивы (v1.0, личные товары без отделов) после NOT NULL перестанут восстанавливаться. Решить заранее: отказывать с понятным сообщением или пропускать строки без отдела — см. открытые решения.
- Если NOT NULL-миграция удаляет `storeId IS NULL` строки, это удаление данных: делать только в рамках того же явного разрешения на очистку.

Вариант Б — оставить колонку nullable и жить с проверкой в коде (`inventoryScope` уже обязателен). Это безопаснее, но инвариант держится соглашением, а не схемой. Рекомендация: вариант А сразу после очистки, с обновлением теста и явным поведением на легаси-копиях.

## Задача 3 — формулировка в `AGENTS.md`

Заменить в разделе «Required invariants»:

```
- Private APIs derive identity from the verified NextAuth session. Scope product
  reads and mutations by that user's current store membership, or personal ownership
  outside a store. Telegram actions use a confirmed unique account link and recheck
  membership. Store management requires MANAGER; admin operations require ADMIN.
```

на:

```
- Private APIs derive identity from the verified NextAuth session. Scope every
  product read and mutation by the caller's current department membership: there is
  no personal product scope, and the administrator sees no product row. Telegram
  actions use a confirmed unique account link and recheck membership. Department
  management requires MANAGER; admin operations require ADMIN.
```

Правка контракта — решение владельца, менять только после его «да».

## Открытые решения (за владельцем)

1. **Релиз `0c1a771` на прод** — запускать сейчас? Без него очистку начинать нельзя.
2. **Разрешение на очистку** — одно «да» после показа точного списка удаляемого.
3. **`storeId NOT NULL`: вариант А (закрыть после очистки) или Б (оставить nullable)?**
4. **Легаси-копии без отделов:** отказывать при восстановлении или пропускать такие строки?
5. **Админский `TelegramLink` при очистке:** удалить (без отдела привязка бесполезна, действия в боте требуют членства) или сохранить?

## Что не трогать

- `/app/backups` на VPS.
- Прод-БД — только чтение, пока владелец не разрешит удаление.
- Расчёт сроков, таймзона cron (Europe/Minsk) и частота уведомлений — вне задачи.
- `SharedCatalogEntry` (444 297 строк) — единственный дорогой актив, сохраняется всегда.
