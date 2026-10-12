CREATE TABLE "SharedCatalogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SharedCatalogEntry_barcode_key" ON "SharedCatalogEntry"("barcode");
