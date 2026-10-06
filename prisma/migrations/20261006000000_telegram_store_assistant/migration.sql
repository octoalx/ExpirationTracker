-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "urgentThreshold" INTEGER NOT NULL DEFAULT 3,
    "warningThreshold" INTEGER NOT NULL DEFAULT 7
);

-- CreateTable
CREATE TABLE "StoreMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreMembership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoreMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductClaim" (
    "productId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "ProductClaim_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "storeId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelegramLinkRequest" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "telegramUserId" TEXT,
    "chatId" TEXT,
    "displayName" TEXT,
    CONSTRAINT "TelegramLinkRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelegramButton" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "payload" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TelegramDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scheduleDate" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" DATETIME,
    "messageId" TEXT,
    "error" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TelegramWarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "IntegrationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paused" BOOLEAN NOT NULL DEFAULT false
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "expiryDate" DATETIME,
    "manufacturingDate" TEXT,
    "shelfLife" INTEGER,
    "shelfLifeUnit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "storeId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "resolution" TEXT,
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" DATETIME,
    "checkedBy" TEXT,
    "deletedAt" DATETIME,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "createdAt", "expiryDate", "id", "isExpired", "manufacturingDate", "name", "quantity", "shelfLife", "shelfLifeUnit", "status", "updatedAt", "userId") SELECT "barcode", "createdAt", "expiryDate", "id", "isExpired", "manufacturingDate", "name", "quantity", "shelfLife", "shelfLifeUnit", "status", "updatedAt", "userId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_userId_idx" ON "Product"("userId");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_storeId_status_idx" ON "Product"("storeId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StoreMembership_userId_key" ON "StoreMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEvent_key_key" ON "ProductEvent"("key");

-- CreateIndex
CREATE INDEX "ProductEvent_storeId_createdAt_idx" ON "ProductEvent"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_telegramUserId_key" ON "TelegramLink"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkRequest_tokenHash_key" ON "TelegramLinkRequest"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramDelivery_key_key" ON "TelegramDelivery"("key");

-- CreateIndex
CREATE INDEX "TelegramDelivery_state_availableAt_idx" ON "TelegramDelivery"("state", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramWarning_userId_productId_key" ON "TelegramWarning"("userId", "productId");
