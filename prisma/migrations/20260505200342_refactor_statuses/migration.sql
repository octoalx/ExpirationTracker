-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "createdAt", "expiryDate", "id", "name", "status", "updatedAt", "userId") SELECT "barcode", "createdAt", "expiryDate", "id", "name", "status", "updatedAt", "userId" FROM "Product";

-- Обновляем старые статусы на новые
UPDATE "new_Product" SET "status" = 'ARCHIVED' WHERE "status" = 'CONSUMED';
UPDATE "new_Product" SET "status" = 'DEFECT' WHERE "status" = 'DISCARDED';

-- Авто-определение просроченных товаров
UPDATE "new_Product" SET "isExpired" = 1 WHERE "status" = 'ACTIVE' AND "expiryDate" < datetime('now');

DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_userId_idx" ON "Product"("userId");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_status_idx" ON "Product"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
