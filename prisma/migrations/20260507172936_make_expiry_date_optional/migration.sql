/*
  Warnings:

  - You are about to drop the column `warningNotifiedAt` on the `Product` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "expiryDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "createdAt", "expiryDate", "id", "isExpired", "name", "quantity", "status", "updatedAt", "userId") SELECT "barcode", "createdAt", "expiryDate", "id", "isExpired", "name", "quantity", "status", "updatedAt", "userId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_userId_idx" ON "Product"("userId");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "telegramToken" TEXT,
    "telegramChatId" TEXT,
    "telegramNotifications" BOOLEAN NOT NULL DEFAULT false,
    "notificationEmail" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "notifyBeforeExpiration" INTEGER NOT NULL DEFAULT 3,
    "urgentThreshold" INTEGER NOT NULL DEFAULT 3,
    "warningThreshold" INTEGER NOT NULL DEFAULT 7,
    "urgentNotifyTime" TEXT NOT NULL DEFAULT '10:00',
    "warningNotifyTime" TEXT NOT NULL DEFAULT '10:00',
    "theme" TEXT NOT NULL DEFAULT 'light',
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("emailNotifications", "id", "notificationEmail", "notifyBeforeExpiration", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "telegramChatId", "telegramNotifications", "telegramToken", "theme", "urgentNotifyTime", "urgentThreshold", "userId", "warningNotifyTime", "warningThreshold") SELECT "emailNotifications", "id", "notificationEmail", "notifyBeforeExpiration", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "telegramChatId", "telegramNotifications", "telegramToken", "theme", "urgentNotifyTime", "urgentThreshold", "userId", "warningNotifyTime", "warningThreshold" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
