=== ПРОЕКТ: ИНФОРМАЦИЯ ДЛЯ ПЕРЕДАЧИ ===

## 1. СТРУКТУРА ПРОЕКТА

```
/home/alex/projects/ExpirationTracker/
├── prisma/
│   ├── dev.db           # SQLite база данных
│   └── schema.prisma    # Схема Prisma
├── scripts/
│   └── startup.ts       # Скрипт запуска
├── src/
│   ├── components/
│   │   ├── AddProductForm.tsx    # Форма добавления товара
│   │   ├── Layout.tsx            # Основной лейаут (sidebar)
│   │   ├── Modal.tsx             # Модальное окно
│   │   ├── ProductCard.tsx       # Карточка товара
│   │   ├── ProductGrid.tsx       # Сетка товаров
│   │   ├── ProductList.jsx       # Список товаров
│   │   ├── ScannerModal.tsx      # Модал сканера штрих-кода
│   │   ├── admin/                # Компоненты админки
│   │   └── ui/                   # UI компоненты (shadcn)
│   ├── lib/
│   │   ├── apiErrorHandler.ts
│   │   ├── auth.ts               # NextAuth конфиг
│   │   ├── cronManager.ts
│   │   ├── prisma.ts
│   │   ├── utils.ts              # Утилиты (getExpiryStatus, cn)
│   │   └── validators.ts
│   ├── pages/
│   │   ├── _app.tsx              # Корневой компонент Next.js
│   │   ├── index.tsx             # Редирект на /dashboard
│   │   ├── dashboard.tsx         # Главная страница (таблица товаров)
│   │   ├── settings.tsx          # Страница настроек
│   │   ├── admin/
│   │   │   ├── index.tsx         # Админ дашборд
│   │   │   ├── users.tsx         # Управление пользователями
│   │   │   └── issues.tsx        # Проблемы/логи
│   │   ├── api/                  # API роуты (Next.js)
│   │   │   ├── admin/            # Админ API
│   │   │   ├── auth/             # NextAuth API
│   │   │   ├── products/         # CRUD товаров
│   │   │   ├── proxy/            # Прокси для внешних API
│   │   │   ├── settings.ts       # API настроек
│   │   │   └── start-cron.ts     # Запуск cron-задач
│   │   └── auth/
│   │       ├── signin.tsx        # Страница входа
│   │       └── register.tsx      # Страница регистрации
│   ├── services/
│   │   └── notifications.ts      # Сервис уведомлений (Email/Telegram)
│   ├── styles/
│   │   └── globals.css           # Глобальные стили (Tailwind v4)
│   └── types/                    # TypeScript типы
├── .env                          # Переменные окружения
├── next.config.js
├── package.json
├── plan.md                       # План редизайна админки
├── tailwind.config.js
└── tsconfig.json
```

## 2. ТЕКУЩИЙ ФУНКЦИОНАЛ

**Уже работает:**
- **Аутентификация:** Регистрация, вход через email/password (NextAuth + bcrypt)
- **Роли пользователей:** USER и ADMIN
- **Дашборд:** Отображение товаров пользователя с фильтрами и сортировкой
- **Управление товарами:**
  - Добавление товара (с штрих-кодом, названием, сроком годности)
  - Расчет срока годности от даты изготовления (дни/недели/месяцы)
  - Отметка товара как "использованный"
  - Возврат товара в статус "активный"
  - Удаление товара
- **Статусы срока годности:**
  - 🔴 Просрочено (expired)
  - 🟠 Срочно (urgent, <3 дней)
  - 🟡 Внимание (warning, <7 дней)
  - 🟢 В норме (safe)
- **Фильтры:** По статусу, срочности, поиск по названию/штрих-коду
- **Сортировка:** Новые/старые, по алфавиту, по сроку годности
- **Настройки:**
  - Личные данные (имя, email)
  - Интеграция Telegram (bot token, chat ID)
  - Интеграция Email/SMTP
  - Настройка порогов уведомлений
  - Переключение темы (light/dark)
- **Админ-панель:** Статистика (всего пользователей, товаров, просроченных)
- **Уведомления:** Cron-задача для отправки уведомлений (Email/Telegram)
- **База данных:** SQLite через Prisma ORM

**Страницы:**
- `/` → редирект на `/dashboard`
- `/dashboard` — главная с товарами
- `/settings` — настройки пользователя
- `/auth/signin` — вход
- `/auth/register` — регистрация
- `/admin` — админ-панель

## 3. ТЕХНОЛОГИИ И БИБЛИОТЕКИ

- **Фреймворк:** Next.js 14 (Pages Router)
- **Сборщик:** Webpack (встроенный в Next.js)
- **Язык:** TypeScript 5
- **Стилизация:** 
  - Tailwind CSS v4.2.3
  - Adobe React Spectrum (UI библиотека)
  - @spectrum-css/vars
- **База данных:** SQLite + Prisma ORM 5.0
- **Аутентификация:** NextAuth.js 4.24.14 (Credentials provider)
- **Уведомления:** 
  - node-cron (планировщик)
  - nodemailer (Email)
  - telegraf (Telegram Bot API)
- **Даты:** date-fns
- **Валидация:** zod
- **Иконки:** lucide-react, @spectrum-icons/workflow
- **Таблицы:** @tanstack/react-table
- **QR/Штрих-коды:** html5-qrcode
- **Утилиты:** 
  - clsx + tailwind-merge (классы)
  - bcryptjs (хеширование паролей)
  - concurrently (одновременный запуск)

**Установленные зависимости (package.json):**
```json
"@adobe/react-spectrum": "^3.47.0",
"@auth/prisma-adapter": "^2.11.2",
"@prisma/client": "^5.0.0",
"@radix-ui/react-checkbox": "^1.3.3",
"@radix-ui/react-dropdown-menu": "^2.1.16",
"@tanstack/react-table": "^8.21.3",
"bcryptjs": "^3.0.3",
"date-fns": "^4.1.0",
"html5-qrcode": "^2.3.8",
"lucide-react": "^1.8.0",
"next": "14.0.0",
"next-auth": "^4.24.14",
"node-cron": "^3.0.3",
"nodemailer": "^7.0.13",
"react": "^18",
"tailwindcss": "^4.2.3",
"telegraf": "^4.16.3",
"zod": "^4.3.6"
```

## 4. ЦЕЛЬ ПРОЕКТА

**Название:** ExpiTrack (Expiration Tracker)

**Проблема:** Пользователи забывают о сроках годности продуктов, лекарств, косметики и других товаров, что приводит к их порче и финансовым потерям.

**Решение:** Веб-приложение для отслеживания сроков годности товаров с уведомлениями.

**Целевая аудитория:**
- Домохозяйки/домохозяева
- Владельцы продуктовых магазинов
- Аптеки и медицинские учреждения
- Люди, закупающие товары запас

**Главная функция:** Отслеживание сроков годности товаров с цветовой индикацией и автоматическими уведомлениями.

**Ключевые экраны:**
1. **Dashboard** — таблица/сетка товаров с фильтрами
2. **Add Product Modal** — форма добавления (штрих-код, название, дата)
3. **Settings** — настройки уведомлений и интеграций
4. **Auth Pages** — вход и регистрация

## 5. ПРОБЛЕМЫ И ОГРАНИЧЕНИЯ

**Что не работает / требует доработки:**
- **Сканер штрих-кодов:** Кнопка "Сканировать" в Layout.tsx вызывает `alert("Scan action!")` — функционал не реализован
- **Админ-панель:** Частично готова, есть план редизайна (`plan.md`) — использует смешанный подход Tailwind + Spectrum
- **Уведомления:** Сервис есть, но требует настройки окружения (SMTP, Telegram токен)
- **Типы в notifications.ts:** Есть несоответствия типов (User, Product)

**Сложности:**
- **Смешанный UI:** Используются одновременно Tailwind и Adobe React Spectrum — создает визуальную непоследовательность
- **Два подхода к стилизации:** 
  - Dashboard использует React Spectrum компоненты
  - AddProductForm и Settings используют Tailwind + обычные HTML элементы
- **Legacy код:** ProductList.jsx (JSX) не используется в Dashboard (используется ProductGrid + ProductCard)

**Что хотелось бы улучшить:**
- Единый дизайн-система (либо полностью Spectrum, либо полностью Tailwind + shadcn)
- Рабочий сканер штрих-кодов
- Полноценный редизайн админки по плану (`plan.md`)
- Мобильная адаптация (сейчас базовая)

## 6. ДИЗАЙН

**Текущий HTML главной страницы (Dashboard):**

```tsx
// dashboard.tsx — использует Adobe React Spectrum
<Grid areas={["header", "stats", "filters", "content"]} ...>
  <View gridArea="header">
    <Heading level={1}>Привет, {session?.user?.name || "Гость"}</Heading>
  </View>
  <View gridArea="stats">
    <QuickStats products={products} settings={settings} />  // 3 карточки статистики
  </View>
  <View gridArea="filters">
    <Flex gap="size-200" wrap="wrap">
      <TextField placeholder="Поиск по названию..." />
      <Picker> // Фильтры статуса
        <Item key="ALL">Все статусы</Item>
        <Item key="ACTIVE">Активные</Item>...
      </Picker>
      <Picker> // Фильтры срочности
        <Item key="ALL">Все</Item>
        <Item key="EXPIRED">Просрочено</Item>...
      </Picker>
      <Picker> // Сортировка
        <Item key="NEWEST_FIRST">Сначала новые</Item>...
      </Picker>
    </Flex>
  </View>
  <View gridArea="content">
    <ProductGrid ... />  // Сетка карточек товаров
  </View>
  <DialogTrigger>  // FAB кнопка добавления
    <ActionButton UNSAFE_style={{ position: "fixed", bottom: "2rem", right: "2rem" }}>
      <Add />
    </ActionButton>
    <Dialog>
      <AddProductForm />
    </Dialog>
  </DialogTrigger>
</Grid>
```

**Используемые Tailwind классы (в основном в Layout.tsx и AddProductForm.tsx):**
```css
/* Layout */
min-h-screen bg-slate-50/50
hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0
flex flex-col grow pt-5 bg-white overflow-y-auto shadow-sm border-r border-slate-100
text-2xl font-bold text-indigo-600  /* Logo */
group flex items-center px-2 py-2 text-sm font-medium rounded-md
bg-slate-100 text-slate-900  /* Active nav item */

/* AddProductForm */
bg-slate-50 border border-slate-100 rounded-xl px-4 py-3
text-slate-600 font-semibold text-xs uppercase tracking-wider
focus:border-emerald-300 focus:bg-white focus:ring-2
w-full bg-emerald-600 hover:bg-emerald-700 text-white
shadow-lg shadow-emerald-200/70 hover:shadow-emerald-300
```

**Цветовая схема:**
- **Primary:** emerald-600 (кнопки, акценты)
- **Background:** slate-50, white
- **Text:** slate-900, slate-600
- **Borders:** slate-100, slate-300
- **Semantic:** 
  - red/negative — просрочено
  - orange/notice — срочно
  - green/positive — в норме
  - gray — неактивно

**Что нравится в дизайне:**
- Чистый, минималистичный интерфейс
- Цветовая индикация статусов срока годности
- FAB кнопка добавления (Material Design pattern)
- Адаптивный sidebar/mobile nav

**Что хочется изменить:**
- Единообразие: смешение React Spectrum и Tailwind выглядит несогласованно
- Карточки товаров — слишком простые, хочется больше информации и лучше типографики
- Нет визуальной иерархии на дашборде

**Примеры сайтов, которые могут нравиться:**
- Notion (чистота, организация)
- Linear (модный дизайн, цвета)
- Vercel Dashboard (статистика, карточки)

## 7. КОМАНДЫ ДЛЯ ЗАПУСКА

**Как запустить проект:**

```bash
# 1. Перейти в директорию проекта
cd /home/alex/projects/ExpirationTracker

# 2. Установить зависимости (если не установлены)
npm install

# 3. Инициализировать базу данных (Prisma)
npx prisma generate
npx prisma db push

# 4. Запустить dev сервер (включает автозапуск cron)
npm run dev
```

**Работающие команды:**
- `npm run dev` — запускает Next.js dev server + cron job
- `npm run build` — production build
- `npm run start` — production server
- `npm run lint` — ESLint

**Команды с ошибками:**
- Не выявлено (требуется проверка)

**Доступ после запуска:**
- http://localhost:3000 — приложение
- http://localhost:3000/api/auth/signin — вход

## 8. ДОПОЛНИТЕЛЬНО

**План редизайна:** Файл `plan.md` содержит подробный план редизайна админки с использованием Adobe Spectrum Design System.

**Особенности реализации:**
- **Гибридный UI:** Dashboard использует React Spectrum, а формы — Tailwind
- **Статусы товаров:** ACTIVE, CONSUMED, DISCARDED
- **Cron-задача:** Запускается автоматически при `npm run dev` через `curl` к `/api/start-cron`
- **База данных:** SQLite файл находится в `prisma/dev.db`

**Файлы, требующие внимания:**
- `src/pages/dashboard.tsx` — главная страница (React Spectrum)
- `src/components/AddProductForm.tsx` — форма (Tailwind)
- `src/pages/settings.tsx` — настройки (Tailwind)
- `src/components/Layout.tsx` — лейаут (Tailwind)
- `plan.md` — план редизайна админки

=== КОНЕЦ ОТЧЕТА ===
