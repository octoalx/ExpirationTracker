-- A department is the only product scope, so Product.storeId becomes mandatory.
--
-- Prerequisite on a live database: every row with storeId IS NULL must be gone
-- first. The INSERT ... SELECT below copies rows verbatim, so a single
-- department-less row aborts this migration with "NOT NULL constraint failed:
-- Product.storeId" and rolls the whole migration back — deliberately, because
-- dropping such rows silently during a migration would be an unreviewed data
-- deletion. The approved production purge (scripts/purge-departments.mjs)
-- removes them before this migration is deployed.
--
-- Restoring an older snapshot or a legacy archive that still holds
-- department-less products is handled in application code, not here:
-- src/lib/server/snapshot-restore.ts drops those rows from the restored copy and
-- reports how many, and src/pages/api/admin/restore.ts skips them in a JSON
-- archive and reports the count.

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
    "storeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "resolution" TEXT,
    "missing" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" DATETIME,
    "checkedBy" TEXT,
    "deletedAt" DATETIME,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "checkedAt", "checkedBy", "createdAt", "deletedAt", "expiryDate", "id", "isExpired", "manufacturingDate", "missing", "name", "quantity", "resolution", "shelfLife", "shelfLifeUnit", "status", "storeId", "updatedAt", "userId", "version") SELECT "barcode", "checkedAt", "checkedBy", "createdAt", "deletedAt", "expiryDate", "id", "isExpired", "manufacturingDate", "missing", "name", "quantity", "resolution", "shelfLife", "shelfLifeUnit", "status", "storeId", "updatedAt", "userId", "version" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_userId_idx" ON "Product"("userId");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_storeId_status_idx" ON "Product"("storeId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
