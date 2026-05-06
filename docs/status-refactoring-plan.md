# План рефакторинга статусов товаров

## 1. Миграция Prisma

```prisma
model Product {
  id         String   @id @default(cuid())
  name       String
  barcode    String
  expiryDate DateTime
  status     String   @default("ACTIVE") // ACTIVE, ARCHIVED, DEFECT
  isExpired  Boolean  @default(false)   // Авто-флаг просрочки
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([barcode])
  @@index([status])
}
```

## 2. SQL миграция (SQLite)

```sql
-- Добавляем новое поле isExpired
ALTER TABLE Product ADD COLUMN isExpired BOOLEAN DEFAULT 0;

-- Обновляем существующие статусы
UPDATE Product SET status = 'ARCHIVED' WHERE status = 'CONSUMED';
UPDATE Product SET status = 'DEFECT' WHERE status = 'DISCARDED';

-- Авто-определение просроченных
UPDATE Product SET isExpired = 1 
WHERE status = 'ACTIVE' AND expiryDate < datetime('now');
```

## 3. UI фильтры (замена кнопок)

Вместо кнопок "Использованы/Выброшены":
```tsx
// Фильтр-чипы как в AddProductForm (радио-кнопки)
[Все] [Активные] [Просроченные] [Архив] [Брак]
```

## 4. Логика отображения статуса

```typescript
function getDisplayStatus(product: Product): string {
  if (product.status === 'DEFECT') return 'Брак';
  if (product.status === 'ARCHIVED') return 'Архив';
  if (product.isExpired || isPast(product.expiryDate)) return 'Просрочен';
  return 'Активен';
}
```

## 5. Цветовая схема статусов

- **Активен** — emerald (зелёный)
- **Просрочен** — red (красный)
- **Архив** — slate/gray (серый)
- **Брак** — orange/amber (оранжевый)

## 6. Cron job обновление

Обновлять `isExpired` флаг при проверке:
```typescript
await prisma.product.updateMany({
  where: { status: 'ACTIVE', expiryDate: { lt: new Date() } },
  data: { isExpired: true }
});
```
