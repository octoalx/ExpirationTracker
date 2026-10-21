-- Department-scoped access model: a store row is one department.
-- The primary key was a hardcoded "main" literal; new departments get a cuid.
-- Product.storeId stays nullable for one cycle so existing rows survive; no code
-- path writes null anymore and a later migration makes it NOT NULL after the
-- owner-approved purge.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "urgentThreshold" INTEGER NOT NULL DEFAULT 3,
    "warningThreshold" INTEGER NOT NULL DEFAULT 7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Store" ("id", "name", "urgentThreshold", "warningThreshold", "createdAt")
    SELECT "id", "name", "urgentThreshold", "warningThreshold", CURRENT_TIMESTAMP FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
