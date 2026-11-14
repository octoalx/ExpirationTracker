-- The shared scanner catalog (SharedCatalogEntry) is the only barcode reference.
-- Personal rows whose barcode is absent from it are copied first, so no name that the
-- scanner could resolve is lost. Existing shared names are never overwritten. When one
-- barcode has several personal names, the most recently updated one wins
-- (ORDER BY updatedAt DESC, id), which makes the result deterministic.
INSERT INTO "SharedCatalogEntry" ("id", "barcode", "name", "createdAt", "updatedAt")
SELECT "id", "barcode", "name", "createdAt", "updatedAt"
FROM (
  SELECT "id", "barcode", "name", "createdAt", "updatedAt",
         ROW_NUMBER() OVER (PARTITION BY "barcode" ORDER BY "updatedAt" DESC, "id") AS "rank"
  FROM "CatalogEntry"
  WHERE "barcode" NOT IN (SELECT "barcode" FROM "SharedCatalogEntry")
)
WHERE "rank" = 1
ON CONFLICT("barcode") DO NOTHING;

-- DropTable
DROP TABLE "CatalogEntry";
