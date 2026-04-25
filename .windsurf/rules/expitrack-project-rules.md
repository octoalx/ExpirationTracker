---
trigger: model_decision
---

# ExpiTrack Project Rules

## Технологии
- Next.js 14 (Pages Router, НЕ App Router)
- TypeScript строгая типизация
- Tailwind CSS v4 (основной стиль)
- Prisma ORM + SQLite
- NextAuth.js для аутентификации

## Дизайн требования
- Используй ТОЛЬКО Tailwind CSS + shadcn/ui (НЕ используй React Spectrum)
- Все новые компоненты делай на Tailwind
- Цветовая схема: emerald для primary, slate для нейтральных
- Поддерживай тёмную тему (dark: классы)
- Адаптивность обязательна (mobile-first)

## Код стайл
- Компоненты в отдельных файлах с `.tsx`
- Используй функциональные компоненты
- Импорты: React, затем внешние библиотеки, затем локальные
- Прописывай TypeScript интерфейсы для пропсов

## Запрещено
- НЕ используй Adobe React Spectrum (мы от него отказываемся)
- НЕ используй any тип
- НЕ создавай компоненты прямо в page файлах

## Особенности проекта
- Статусы товаров: ACTIVE, CONSUMED, DISCARDED
- Срок годности: вычисляется от даты производства + срок (дни/недели/месяцы)
- Цвета статусов: EXPIRED=red, URGENT=orange, WARNING=yellow, SAFE=green