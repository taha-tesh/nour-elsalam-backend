-- AlterTable: admin-defined product code
ALTER TABLE "products" ADD COLUMN "productCode" TEXT;

UPDATE "products"
SET "productCode" = 'PRD-' || UPPER(SUBSTRING("id", 1, 8))
WHERE "productCode" IS NULL;

ALTER TABLE "products" ALTER COLUMN "productCode" SET NOT NULL;

CREATE UNIQUE INDEX "products_productCode_key" ON "products"("productCode");
